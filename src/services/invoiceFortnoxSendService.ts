// src/services/invoiceFortnoxSendService.ts
// Skapa utkast i Fortnox för EN faktura (3.125.0). Logiken låg tidigare i
// InvoiceDetailModal (handleSendToFortnox) och är utbruten oförändrad hit så
// att knappen Skicka godkända till Fortnox i /admin/fakturering skapar utkast
// på exakt samma sätt som knappen Skapa utkast i Fortnox i fakturamodalen.
//
// Steg: kundnummer (kundkort, allocate-customer), fakturavägen, kundkortet i
// Fortnox, ompläggning av avtalsfakturan, artiklar, rader
// (buildFortnoxInvoiceRows), Er referens/ordernummer/textrad från
// ärendemärkningen, leveransadress (invoiceWorkAddress), betalningsvillkor
// (PaymentTermsService), InvoiceDate = svensk dag, DueDate, utkastet, ROT/RUT,
// Fortnox-numret och statusen draft, systemkommentar i ärendet.
//
// Toasten i modalen går via notify, så samma texter kan samlas i en lista när
// flera fakturor skickas i följd. Ändras ett steg här ändras båda knapparna.
// Payloaden är låst i invoiceFortnoxSendService.test.ts.
//
// any-typningen följde med oförändrad från modalen; den rensas i en egen
// leverans så att utbrytningen kan jämföras rad för rad.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from '../lib/supabase'
import { InvoiceService } from './invoiceService'
import { PremiumReviewService } from './premiumReviewService'
import { PREMIUM_REVIEW_BLOCK_MESSAGE } from '../shared/premiumReview'
import { FortnoxService, isPersonnummer } from './fortnoxService'
import { ContractInvoiceGenerator } from './contractInvoiceGenerator'
import { resolveFortnoxCustomerNumber } from '../utils/fortnoxCustomerResolver'
import { FortnoxMirrorService } from './fortnoxMirrorService'
import { CaseCustomerService } from './caseCustomerService'
import { orgDigits, type FortnoxMirrorHit } from '../shared/fortnoxCustomerNumbers'
import { PaymentTermsService, type BillingCategory } from './paymentTermsService'
import type { InvoiceStatus, InvoiceWithItems } from '../types/invoice'
import { calculateRotRutSummary } from '../utils/rotRutConstants'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import { caseMarkingOnInvoice } from '../shared/caseMarking'
import { invoiceWorkAddress } from '../shared/invoiceWorkAddress'
import { InvoiceDeliveryService } from './invoiceDeliveryService'
import { toFortnoxDeliveryType, isInvoiceDeliveryMethod } from '../shared/invoiceDelivery'
import { buildFortnoxInvoiceRows, fortnoxText, type InvoiceAddonLine, type InvoiceItemLike } from '../shared/invoiceAddonLines'
import { fakturaArRadmodell, fakturaAvdrag, fakturaBrister, fastighetText, personnummer12, type Avdrag } from '../shared/rotRutOffert'
import { workAddressText } from '../shared/invoiceWorkAddress'
import { createSystemComment } from './communicationService'
import { fetchInvoiceVisit, type VisitSnapshot } from '../hooks/useInvoiceVisit'
import { fetchInvoiceAddonLines } from '../hooks/useInvoiceAddons'
import type { CaseType } from '../types/communication'

/** Samma signaturer som react-hot-toast: toast.success, toast.error och toast(msg, { icon }). */
export interface FortnoxSendNotify {
  success: (message: string) => void
  error: (message: string, opts?: { duration?: number }) => void
  info: (message: string, opts: { icon: string; duration?: number }) => void
}

export interface FortnoxSendOptions {
  /** Val i modalen när flera eller bara inaktiva Fortnox-kunder har samma org.nr */
  chosenCustomerNumber?: string
  reactivate?: boolean
  forceNew?: boolean
  /**
   * Skicka bara om fakturan fortfarande har den här statusen (listorna i
   * /admin/fakturering skickar bara godkända, status ready). Modalen skickar
   * inte med den: där styr knappens spärrar som förut.
   */
  requireStatus?: InvoiceStatus
  /** Den som skickar: systemkommentaren i ärendet skrivs bara när den finns */
  actor?: { userId: string; name: string } | null
  notify?: FortnoxSendNotify
  /** Premiekontrollen lästes färskt (modalen visar spärren) */
  onPremiumChecked?: (unconfirmedContractIds: string[]) => void
  /** Fakturavägen är inte bekräftad: panelen pekas om till kundraden */
  onDeliveryBlocked?: (customerId: string) => void
  /** Portalen tog över leveranssättet från Fortnox-kortet */
  onDeliveryAdopted?: () => void
  /** Kundnumret är klart efter allocate-customer: kandidatlistan stängs */
  onCandidatesCleared?: () => void
  /**
   * Det modalen redan har läst. Saknas ett fält läses det här, på samma sätt
   * som modalens hookar gör (useInvoiceVisit, useInvoiceAddons och
   * kundkortets kundansvarige).
   */
  preloaded?: {
    invoice?: InvoiceWithItems
    visit?: VisitSnapshot | null
    addonLines?: InvoiceAddonLine[]
    accountManager?: string | null
  }
}

export type FortnoxSendResult =
  | { status: 'created'; documentNumber: string; invoiceNumber: string | null }
  /** Stoppad före Fortnox: redan skickad, premie eller fakturaväg att bekräfta, inget kundnummer */
  | { status: 'blocked'; message: string }
  /** Flera eller bara inaktiva Fortnox-kunder: någon måste välja i fakturamodalen */
  | { status: 'candidates'; kind: 'multiple' | 'inactive-only'; candidates: FortnoxMirrorHit[]; message: string }
  | { status: 'failed'; message: string }

const SILENT: FortnoxSendNotify = { success: () => {}, error: () => {}, info: () => {} }

/**
 * Ad-hoc- och avtalsfakturor har case_type = null men deras ärende är ett
 * contract-ärende (samma härledning som fakturamodalen).
 */
export function effectiveInvoiceCaseType(invoice: Pick<InvoiceWithItems, 'case_type' | 'invoice_type'>): CaseType | null {
  return (invoice.case_type as CaseType | null) ??
    ((invoice.invoice_type === 'adhoc' || invoice.invoice_type === 'contract') ? 'contract' : null)
}

async function loadAccountManager(customerId: string | null): Promise<string | null> {
  if (!customerId) return null
  const { data } = await supabase
    .from('customers')
    .select('assigned_account_manager')
    .eq('id', customerId)
    .maybeSingle()
  return (data as { assigned_account_manager?: string | null } | null)?.assigned_account_manager ?? null
}

/**
 * Skapar ett utkast i Fortnox för fakturan. Kastar aldrig: fel blir
 * status failed med svenskt meddelande (samma text som modalens toast).
 */
export async function sendInvoiceToFortnox(invoiceId: string, opts: FortnoxSendOptions = {}): Promise<FortnoxSendResult> {
  const notify = opts.notify ?? SILENT
  const fail = (message: string): FortnoxSendResult => {
    notify.error(message)
    return { status: 'blocked', message }
  }

  let invoice: InvoiceWithItems | null = opts.preloaded?.invoice ?? null
  if (!invoice) {
    try {
      invoice = await InvoiceService.getInvoice(invoiceId)
    } catch (err) {
      const message = 'Kunde inte skicka till Fortnox: ' + ((err as Error)?.message || 'Okänt fel')
      notify.error(message)
      return { status: 'failed', message }
    }
    if (!invoice) {
      const message = 'Fakturan hittades inte'
      notify.error(message)
      return { status: 'failed', message }
    }
  }
  const effectiveCaseType = effectiveInvoiceCaseType(invoice)

  if (opts.requireStatus && invoice.status !== opts.requireStatus) {
    return fail('Fakturan är inte längre godkänd för sändning. Uppdatera listan.')
  }

  // Fakturan finns redan i Fortnox: ett nytt utkast blir en dubblett med
  // nytt nummer. Rätt väg är Synka, eller makulera i Fortnox först.
  if (invoice.fortnox_document_number) {
    return fail(`Fakturan finns redan i Fortnox (nr ${invoice.fortnox_document_number}). Använd Synka för att hämta dess status.`)
  }
  // Avtalsfaktura med obekräftad premie (avtal gjort direkt i Oneflow)
  // skickas inte. Läses färskt så att en bekräftelse i kartan släpper direkt.
  if (invoice.invoice_type === 'contract') {
    try {
      const unconfirmed = await PremiumReviewService.getUnconfirmedContractIdsForInvoice(invoice.id)
      opts.onPremiumChecked?.(unconfirmed)
      if (unconfirmed.length > 0) {
        notify.error(PREMIUM_REVIEW_BLOCK_MESSAGE, { duration: 10000 })
        return { status: 'blocked', message: PREMIUM_REVIEW_BLOCK_MESSAGE }
      }
    } catch (err) {
      return fail(`Kunde inte kontrollera avtalets premie: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  try {
    // 1. Hitta kundraden och dess Fortnox-nummer. Primärt via fakturans
    // customer_id (exakt rad, klarar multisite-enheter som delar org.nr),
    // fallback via org.nr för fakturor utan customer_id. Engångskunder får
    // sitt nummer först här (allokeras mot Fortnox i steg 1c), så raden
    // hämtas UTAN krav på nummer: rad med nummer föredras, sedan äldst.
    let customerNumber: number | null = null
    let customerRowId: string | null = invoice.customer_id ?? null
    if (invoice.customer_id) {
      customerNumber = await resolveFortnoxCustomerNumber(invoice.customer_id)
    }
    if (!customerNumber && invoice.organization_number) {
      const { data: customerRow } = await supabase
        .from('customers')
        .select('id, customer_number')
        .eq('organization_number', invoice.organization_number)
        .is('parent_customer_id', null)
        .order('customer_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (customerRow) {
        customerRowId = (customerRow as any).id
        customerNumber = (customerRow as any).customer_number ?? null
      }
    }

    const isOneOffInvoice = invoice.case_type === 'private' || invoice.case_type === 'business'
    // Engångs- och avtalskunder får sitt nummer från Fortnox första gången
    // ett utkast skickas (steg 1c). Portalen reserverar aldrig nummer i
    // förväg: Fortnox kan då ge samma nummer till någon annan (10524, 2026-10-19).
    const allocatesAtSend = isOneOffInvoice || (invoice.invoice_type === 'contract' && !!customerRowId)
    if (!customerNumber && !allocatesAtSend) {
      return fail('Kunden saknar kundnummer — lägg till det på kundkortet innan du skickar till Fortnox')
    }

    // 1b. Hämta ärende-metadata FÖRE kundskapandet — teknikerns namn ska in
    // som Vår referens på både kundkortet och fakturan.
    let caseMetaEarly: {
      case_number?: string | null
      completed_date?: string | null
      start_date?: string | null
      primary_assignee_name?: string | null
      invoice_marking?: string | null
      customer_group_id?: string | null
      work_order_number?: string | null
      work_object?: string | null
      room_number?: string | null
      /** Utförandeadressen (jsonb), blir leveransadress i Fortnox */
      address?: unknown
    } | null = null
    if (invoice.case_id) {
      if (effectiveCaseType === 'contract') {
        const { data } = await supabase
          .from('cases')
          .select('case_number, completed_date, scheduled_start, primary_technician_name, invoice_marking, work_order_number, work_object, room_number, address')
          .eq('id', invoice.case_id)
          .maybeSingle()
        if (data) {
          const d = data as any
          caseMetaEarly = {
            case_number: d.case_number,
            completed_date: d.completed_date,
            start_date: d.scheduled_start,
            primary_assignee_name: d.primary_technician_name,
            invoice_marking: d.invoice_marking,
            work_order_number: d.work_order_number,
            work_object: d.work_object,
            room_number: d.room_number,
            address: d.address,
          }
        }
      } else if (invoice.case_type === 'business') {
        const { data } = await supabase
          .from('business_cases')
          .select('case_number, completed_date, start_date, primary_assignee_name, markning_faktura, customer_group_id, adress')
          .eq('id', invoice.case_id)
          .maybeSingle()
        if (data) {
          const d = data as any
          caseMetaEarly = { ...d, invoice_marking: d.markning_faktura, address: d.adress }
        }
      } else {
        const { data } = await supabase
          .from('private_cases')
          .select('case_number, completed_date, start_date, primary_assignee_name, adress')
          .eq('id', invoice.case_id)
          .maybeSingle()
        const d = data as { case_number: string | null; completed_date: string | null; start_date: string | null; primary_assignee_name: string | null; adress: unknown } | null
        caseMetaEarly = d ? { ...d, address: d.adress } : null
      }
    }
    const technicianName = caseMetaEarly?.primary_assignee_name ?? null

    // Kundkortets kundansvarige (modalen visar den under Säljare). Används
    // som Vår referens i reserv, samma värde modalen läser.
    const needsAccountManager = invoice.invoice_type === 'contract' || invoice.invoice_type === 'adhoc'
    const accountManager: string | null = opts.preloaded && 'accountManager' in opts.preloaded
      ? opts.preloaded.accountManager ?? null
      : needsAccountManager ? await loadAccountManager(invoice.customer_id ?? null).catch(() => null) : null

    // 1c-pre. Engångskund MED portalnummer: kontrollera mot Fortnox-spegeln
    // att numret inte tillhör någon annan (portalens gamla räknare och
    // Fortnox gled isär, t.ex. portal 10465 = annan person i Fortnox).
    // Ett bevisat fel nummer släpps så att Fortnox får ge ett nytt.
    if (customerNumber && isOneOffInvoice && customerRowId) {
      const ours = orgDigits(invoice.organization_number)
      if (ours) {
        const { data: mirrorRow } = await supabase
          .from('fortnox_customer_numbers')
          .select('customer_number, name, org_digits')
          .eq('customer_number', String(customerNumber))
          .maybeSingle()
        const theirs = (mirrorRow as any)?.org_digits as string | null | undefined
        if (mirrorRow && theirs && theirs !== ours) {
          await supabase.from('customers').update({ customer_number: null }).eq('id', customerRowId)
          notify.info(
            `Kundnummer ${customerNumber} tillhör "${(mirrorRow as any).name}" i Fortnox. Kunden får ett nytt nummer.`,
            { icon: '⚠️', duration: 8000 }
          )
          customerNumber = null
        }
      }
    }

    // 1c. Kund utan Fortnox-nummer (engångs- eller avtalskund): se till att
    // kundraden finns och låt servern hitta/adoptera/skapa Fortnox-kunden
    // med nästa lediga nummer i kundgruppens intervall
    // (api/fortnox/allocate-customer). Avtalskundens grupp valdes i
    // avtalswizarden och sattes på kunden vid signeringen.
    // Flera Fortnox-träffar på samma org.nr → koordinatorn väljer i modalen.
    if (!customerNumber && allocatesAtSend && !customerRowId && isOneOffInvoice) {
      const oneOffType = invoice.case_type as 'private' | 'business'
      const created = await CaseCustomerService.getOrCreateCaseCustomer({
        caseType: oneOffType,
        name: invoice.customer_name,
        personnummer: oneOffType === 'private' ? invoice.organization_number : null,
        organization_number: oneOffType === 'business' ? invoice.organization_number : null,
        email: invoice.customer_email,
        phone: invoice.customer_phone,
        address: invoice.customer_address,
        customerGroupId: caseMetaEarly?.customer_group_id ?? undefined,
      })
      customerRowId = created.customerId
      customerNumber = created.customerNumber
    }

    // 1c-väg. Fakturavägen måste vara bekräftad innan Fortnox-kortet skapas
    // eller fakturan skickas (src/shared/invoiceDelivery.ts). Engångskundens
    // rad finns först nu, så panelen pekas om dit för att ekonomi ska kunna välja.
    let delivery: Awaited<ReturnType<typeof InvoiceDeliveryService.getForCustomer>> = null
    if (customerRowId) {
      delivery = await InvoiceDeliveryService.getForCustomer(customerRowId)
      if (delivery && !delivery.evaluation.ok) {
        opts.onDeliveryBlocked?.(customerRowId)
        const message = delivery.evaluation.message ?? 'Fakturavägen är inte bekräftad'
        notify.error(message, { duration: 8000 })
        return { status: 'blocked', message }
      }
    }

    if (!customerNumber && allocatesAtSend) {
      if (!customerNumber && customerRowId) {
        const result = await FortnoxMirrorService.allocateCustomer({
          customerId: customerRowId,
          invoiceId: invoice.id,
          groupId: caseMetaEarly?.customer_group_id ?? null,
          chosenCustomerNumber: opts.chosenCustomerNumber,
          reactivate: opts.reactivate,
          forceNew: opts.forceNew,
          ourReference: technicianName ?? accountManager ?? null,
        })
        if (result.status === 'candidates') {
          const message = result.kind === 'multiple'
            ? 'Flera Fortnox-kunder har samma org.nr. Välj vilken fakturan ska gå till.'
            : 'Kunden finns i Fortnox men är inaktiv. Välj återaktivering eller nytt nummer.'
          notify.info(message, { icon: 'ℹ️', duration: 6000 })
          return { status: 'candidates', kind: result.kind, candidates: result.candidates, message }
        }
        opts.onCandidatesCleared?.()
        customerNumber = Number(result.customerNumber)
        for (const w of result.warnings ?? []) notify.info(w, { icon: '⚠️', duration: 8000 })
        if (result.status === 'created') {
          notify.success(`Ny Fortnox-kund ${result.customerNumber}${result.groupName ? ` (${result.groupName})` : ''}`)
        } else if (result.status === 'reused') {
          notify.success(`Befintlig Fortnox-kund ${result.customerNumber} används${result.outsideGroup ? ' (utanför vald kundgrupp)' : ''}`)
        } else if (result.status === 'conflict-adopted') {
          notify.info(`Kundnummer ${result.customerNumber} bärs redan av en annan kundrad i portalen. Fakturan kopplades dit.`, { icon: '⚠️', duration: 8000 })
        }
      }
    }
    if (!customerNumber) {
      return fail('Kunden saknar kundnummer — lägg till det på kundkortet innan du skickar till Fortnox')
    }

    // Fakturamärkningen kan ha lagts till i ärendet EFTER att fakturan
    // skapades - ärendets aktuella värde vinner över fakturans snapshot,
    // så att "Er referens" i Fortnox alltid speglar senaste märkningen.
    const effectiveMarking = caseMetaEarly?.invoice_marking?.trim() || invoice.invoice_marking || null
    if (effectiveMarking && effectiveMarking !== invoice.invoice_marking) {
      await supabase.from('invoices').update({ invoice_marking: effectiveMarking }).eq('id', invoice.id)
    }

    // 2. Hämta eller skapa kund i Fortnox.
    // Privatpersoner: Type=PRIVATE, 10 dagars betalningsvillkor, priser inkl.
    // moms på kundkortet. Företag: Type=COMPANY. Teknikern sätts som Vår
    // referens. Adressen delas upp i gata/postnr/ort i fortnoxService.
    const isPrivatePerson = invoice.case_type === 'private'
      || (invoice.case_type == null && isPersonnummer(invoice.organization_number))
    const fortnoxCustomerNumber = await FortnoxService.findOrCreateCustomer({
      customer_number: customerNumber,
      company_name: invoice.customer_name,
      organization_number: invoice.organization_number,
      billing_email: invoice.customer_email,
      billing_address: invoice.customer_address,
      phone: invoice.customer_phone,
      customer_type: isPrivatePerson ? 'PRIVATE' : 'COMPANY',
      terms_of_payment: isPrivatePerson ? '10' : null,
      show_price_vat_included: isPrivatePerson ? true : undefined,
      our_reference: technicianName,
      invoice_delivery_type: isInvoiceDeliveryMethod(delivery?.owner.invoice_delivery_method)
        ? toFortnoxDeliveryType(delivery.owner.invoice_delivery_method)
        : null,
      your_reference: delivery?.owner.billing_reference ?? null,
    }, {
      // Kortet finns redan: Fortnox-kortets leveranssätt gäller för fakturan.
      // Har någon ändrat det direkt i Fortnox tar portalen över det.
      onExisting: async (card) => {
        if (!delivery) return
        const adopted = await InvoiceDeliveryService.adoptFromFortnoxCard(delivery.owner.id, card.DefaultDeliveryTypes?.Invoice)
        if (adopted) {
          notify.info(`Fortnox-kortet säger ${adopted === 'email' ? 'e-post' : adopted === 'print' ? 'brev' : 'e-faktura'}. Portalen har uppdaterats.`, { icon: 'ℹ️', duration: 6000 })
          opts.onDeliveryAdopted?.()
        }
      },
    })

    // 2a2. Debiteringstillfället är sändningen: en avtalsfaktura planeras om
    // så att tilläggsstationer och utrustningsrader speglar antalet just nu.
    // Rör bara redigerbara fakturor och bara den här fakturan.
    let itemsForSend = invoice.items
    // Nya tilläggsregler (steg 11): tilläggsraderna delas till högst 50 tecken
    let splitAddonRows = false
    if (invoice.invoice_type === 'contract') {
      const refreshed = await ContractInvoiceGenerator.refreshContractInvoiceBeforeSend(invoice.id)
      splitAddonRows = refreshed.splitAddonRows === true
      if (refreshed.changed) {
        itemsForSend = refreshed.items as unknown as typeof invoice.items
        notify.info('Fakturan uppdaterades med dagens antal tilläggsstationer innan sändning', { icon: 'ℹ️' })
      }
    }

    // 2b. Säkerställ att alla artiklar/tjänster finns i Fortnox innan fakturan skickas.
    // Vi använder våra interna service-/artikelkoder som ArticleNumber.
    // Saknas artikeln i Fortnox skapas den (Type: SERVICE, med unit + VAT).
    await FortnoxService.ensureArticlesExistForInvoiceItems(
      itemsForSend.map(i => ({
        article_code: i.article_code,
        article_name: i.article_name,
        vat_rate: i.vat_rate,
      }))
    )

    // 2c. Ärende-metadata hämtades i steg 1b (behövdes redan för kundkortet)
    const caseMeta = caseMetaEarly

    // Tilläggsraderna (merförsäljning) och besöket fakturan avser: som
    // modalens useInvoiceAddons och useInvoiceVisit, fel ger tomt.
    const addonLines: InvoiceAddonLine[] = invoice.invoice_type !== 'adhoc'
      ? []
      : opts.preloaded && 'addonLines' in opts.preloaded
        ? opts.preloaded.addonLines ?? []
        : await fetchInvoiceAddonLines(invoice).then(r => r.lines).catch(() => [])
    const visit: VisitSnapshot | null = opts.preloaded && 'visit' in opts.preloaded
      ? opts.preloaded.visit ?? null
      : invoice.case_id ? await fetchInvoiceVisit(invoice).catch(() => null) : null

    // 3. Bygg fakturarader. ROT/RUT markeras PER RAD (HouseWork +
    // HouseWorkType) — det är så Fortnox API:t fungerar; fakturanivåns
    // TaxReductionType sätts i steg 4. HouseWorkType-kategorierna är
    // Skatteverkets: ROT → CONSTRUCTION, RUT → CLEANING som standard.
    // Momsläge sätts ALLTID uttryckligen. Utelämnas VATIncluded tar Fortnox
    // kundkortets standard, och privatkundkort har "priser inkl. moms":
    // då tolkas radens Price som inklusive moms och en 1 000 kr-rad blir
    // 1 000 kr inkl. moms (utkast 890, 2026-09-03). Privatpersoner får
    // därför inkl-priser + VATIncluded=true, företag exkl-priser + false.
    const vatIncluded = isPrivatePerson
    // ROT/RUT (3.127.0): bostadsrätt (föreningens org.nr + lägenhetsnummer) i
    // stället för fastighetsbeteckning, och ROT/RUT-offertens radmodell där
    // arbetsraden heter Arbetskostnad och bär timmarna
    const rotTyp: Avdrag | null = invoice.rot_rut_type === 'ROT' || invoice.rot_rut_type === 'RUT' ? invoice.rot_rut_type : null
    const rotBrf = !!String(invoice.brf_org_number ?? '').trim() && !!String(invoice.apartment_number ?? '').trim()
    const rotRadmodell = !!rotTyp && fakturaArRadmodell(itemsForSend)
    // Raderna byggs i src/shared/invoiceAddonLines.ts (enhetstestad):
    // textrader (index_note) som ren Description, ROT/RUT per rad.
    // Tilläggsrader får perioden som textrad under raden, arbetstiden
    // går som timmar och en förklaring om nästa tilläggsfaktura läggs sist.
    const invoiceRows = buildFortnoxInvoiceRows(itemsForSend as unknown as InvoiceItemLike[], {
      vatIncluded,
      fastighetsbeteckning: invoice.fastighetsbeteckning,
      addonLines,
      splitAddonRows,
      husarbete: !!rotTyp && rotBrf,
      hoppaOverNollrader: rotRadmodell,
    })

    // 4. Skapa faktura i Fortnox
    // Betalningsvillkoret gäller FRÅN sändningen till Fortnox: förfallodatum
    // = idag + kategorins dagar (PaymentTermsService). Ett ev. preliminärt/
    // manuellt satt due_date på fakturan skrivs medvetet över här.
    // Svensk dag: toISOString() gav gårdagens datum vid sändning före 01.00
    const today = toLocalISOStringWithOffset(new Date()).slice(0, 10)
    const termsCategory: BillingCategory =
      invoice.case_type === 'private' ? 'private'
      : invoice.case_type === 'business' ? 'business'
      : effectiveCaseType === 'contract' ? 'contract'
      : isPersonnummer(invoice.organization_number) ? 'private' : 'business'
    const paymentTermsDays = await PaymentTermsService.getDays(termsCategory)
    const dueDateObj = new Date()
    dueDateObj.setDate(dueDateObj.getDate() + paymentTermsDays)
    const dueDate = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`

    // Leveransdatum: när jobbet utfördes. Besökssnapshotet först — ärendets
    // datum är flyttat till NÄSTA besök när ett återbesök bokats. Datumet
    // plockas i LOKAL tid; toISOString() hade flyttat kvällsbesök en dag bakåt.
    const deliveryDateRaw =
      visit?.visit_date || (caseMeta as any)?.completed_date || (caseMeta as any)?.start_date
    const deliveryDateObj = deliveryDateRaw ? new Date(deliveryDateRaw) : null
    const deliveryDate =
      deliveryDateObj && !Number.isNaN(deliveryDateObj.getTime())
        ? toLocalISOStringWithOffset(deliveryDateObj).slice(0, 10)
        : undefined

    // ROT/RUT: saknas något som Skatteverket kräver stoppas fakturan här, före
    // Fortnox. Avdraget tas aldrig bort i tysthet (3.127.0).
    const rotPlats = workAddressText(caseMetaEarly?.address)
    if (rotTyp) {
      const brister = fakturaBrister({
        typ: rotTyp,
        privat: isPrivatePerson,
        personnummer: invoice.organization_number,
        fastighet: {
          brf: rotBrf,
          fastighetsbeteckning: invoice.fastighetsbeteckning,
          brfOrgNr: invoice.brf_org_number ?? null,
          lagenhetsnummer: invoice.apartment_number ?? null,
        },
        utforandeAdress: rotPlats,
        utforandeDatum: deliveryDate ?? null,
        harArbetsrad: itemsForSend.some(i => i.rot_rut_type === rotTyp && Number(i.total_price) > 0),
      })
      if (brister.length > 0) {
        return fail(`${rotTyp}-fakturan kan inte skickas: ${brister.join('. ')}. Rätta det på ärendet eller fakturan och försök igen.`)
      }
      // Plats, datum och fastighet som textrader, så att kunden och Skatteverket ser dem
      const fastighetRad = rotBrf
        ? fastighetText({ brf: true, brfOrgNr: invoice.brf_org_number, lagenhetsnummer: invoice.apartment_number })
        : `Fastighetsbeteckning: ${String(invoice.fastighetsbeteckning ?? '').trim()}`
      invoiceRows.push(
        { Description: fortnoxText(`Utfört ${deliveryDate} på ${rotPlats}`).slice(0, 200) },
        { Description: fortnoxText(fastighetRad).slice(0, 200) },
      )
    }

    const fortnoxPayload: Record<string, unknown> = {
      CustomerNumber: fortnoxCustomerNumber,
      InvoiceDate: today,
      DueDate: dueDate,
      VATIncluded: vatIncluded,
      InvoiceRows: invoiceRows,
    }

    if (deliveryDate) fortnoxPayload.DeliveryDate = deliveryDate
    // Vår referens: teknikern som UTFÖRDE jobbet (besökssnapshotet), inte den
    // som råkar vara bokad på nästa besök
    const ourReference = visit?.technician_name || (caseMeta as any)?.primary_assignee_name
    if (ourReference) {
      fortnoxPayload.OurReference = ourReference
    }
    if ((caseMeta as any)?.case_number) {
      fortnoxPayload.ExternalInvoiceReference1 = (caseMeta as any).case_number
    }
    if (invoice.invoice_number) {
      fortnoxPayload.ExternalInvoiceReference2 = invoice.invoice_number
    }
    if (effectiveMarking) fortnoxPayload.YourReference = effectiveMarking
    if (invoice.notes) fortnoxPayload.Remarks = invoice.notes

    // Ärendemärkningen (arbetsorder, objekt, rum) till fakturan: Ert
    // ordernummer och en textrad överst, som när fakturorna skrevs för hand
    // (src/shared/caseMarking.ts). Förut nådde bara märkningen fakturan.
    const caseMarking = caseMarkingOnInvoice({
      work_order_number: caseMetaEarly?.work_order_number,
      work_object: caseMetaEarly?.work_object,
      room_number: caseMetaEarly?.room_number,
    })
    if (caseMarking.orderNumber) fortnoxPayload.YourOrderNumber = caseMarking.orderNumber
    if (caseMarking.rowText) {
      fortnoxPayload.InvoiceRows = [{ Description: fortnoxText(caseMarking.rowText) }, ...invoiceRows]
    }

    // Utförandeadressen som leveransadress när den skiljer sig från
    // fakturaadressen (src/shared/invoiceWorkAddress.ts). Fortnox skriver ut
    // den som eget block "Leveransadress"; kundkortet påverkas inte.
    // Läses från ärendet vid sändningen, som märkningen.
    const workAddress = invoiceWorkAddress({
      workAddress: caseMetaEarly?.address,
      billingAddress: invoice.customer_address,
      name: invoice.customer_name,
    })
    if (workAddress.fortnox) Object.assign(fortnoxPayload, workAddress.fortnox)

    // Årspremiefakturor (inget ärende): avtalets diarienummer som extern
    // referens och kundansvarig som Vår referens. Samlad faktura (flera
    // avtal): diarienummer från raderna, gemensam kundansvarig om alla delar.
    if (!invoice.case_id && invoice.invoice_type === 'contract') {
      const contractIds = new Set<string>()
      if ((invoice as any).contract_id) contractIds.add((invoice as any).contract_id)
      for (const it of invoice.items as Array<{ contract_id?: string | null }>) {
        if (it.contract_id) contractIds.add(it.contract_id)
      }
      if (contractIds.size > 0) {
        const { data: contractRows } = await supabase
          .from('contracts')
          .select('id, diary_number, account_manager_name, begone_employee_name')
          .in('id', [...contractIds])
        const rows = (contractRows ?? []) as Array<{ diary_number: string | null; account_manager_name: string | null; begone_employee_name: string | null }>
        const diaries = [...new Set(rows.map((r) => r.diary_number?.trim()).filter((d): d is string => !!d))]
        if (diaries.length > 0) fortnoxPayload.ExternalInvoiceReference1 = diaries.join(' / ').slice(0, 80)
        // Kundansvarig, annars avtalets säljare (wizardens "BeGone-ansvarig").
        // account_manager_name är tomt på nästan alla avtal, så utan
        // reservvägen kom ingen Vår referens med (Pär-Eric, faktura 1055).
        const managers = [...new Set(rows
          .map((r) => (r.account_manager_name || r.begone_employee_name)?.trim())
          .filter((m): m is string => !!m))]
        if (managers.length === 1 && !fortnoxPayload.OurReference) fortnoxPayload.OurReference = managers[0]
      }
      // Sista reserv: kundkortets kundansvarige, samma namn som modalen visar under Säljare
      if (!fortnoxPayload.OurReference && accountManager?.trim()) {
        fortnoxPayload.OurReference = accountManager.trim()
      }
    }

    // ROT/RUT: fakturanivån bär bara typen ('rot'/'rut'); raderna är
    // flaggade i steg 3, och fastighetsbeteckning + avdragsbelopp
    // registreras via taxreductions-resursen efter att fakturan skapats.
    if (invoice.rot_rut_type && (invoice.fastighetsbeteckning || rotBrf)) {
      fortnoxPayload.TaxReductionType = invoice.rot_rut_type.toLowerCase()
    }

    // Fritexterna tvättas: ett enda tecken Fortnox inte godtar (t.ex. "·" i
    // avtalsfakturans anteckning) stoppar hela fakturan med 2005016.
    for (const key of ['Remarks', 'YourReference', 'YourOrderNumber', 'OurReference', 'ExternalInvoiceReference1', 'ExternalInvoiceReference2']) {
      const value = fortnoxPayload[key]
      if (typeof value === 'string') fortnoxPayload[key] = fortnoxText(value)
    }

    const fortnoxInvoice = await FortnoxService.createInvoice(fortnoxPayload)

    // 4b. Registrera ROT/RUT-avdraget (fastighetsbeteckning) mot fakturan.
    // Fel här får inte stoppa flödet — fakturan finns redan i Fortnox;
    // admin kompletterar avdraget manuellt om registreringen misslyckas.
    if (invoice.rot_rut_type && (invoice.fastighetsbeteckning || rotBrf)) {
      // Begärt avdrag: radmodellen räknar som offerten (hela kronor, nedåt),
      // äldre fakturor som förut. Belopp, Fortnox egen uträkning och ev. fel
      // sparas på fakturan och visas i fakturamodalen.
      const begart = rotRadmodell && rotTyp
        ? fakturaAvdrag(itemsForSend, rotTyp).avdrag
        : Math.round(calculateRotRutSummary(invoice.items).totalDeduction)
      const fortnoxAvdrag = Number((fortnoxInvoice as unknown as { TaxReduction?: number | string | null }).TaxReduction)
      try {
        await FortnoxService.createTaxReduction({
          asked_amount: begart,
          customer_name: invoice.customer_name,
          // Bostadsrätt: lägenhetsnumret är beteckningen, föreningens org.nr skickas separat
          property_designation: rotBrf ? String(invoice.apartment_number) : String(invoice.fastighetsbeteckning),
          document_number: fortnoxInvoice.DocumentNumber,
          // Tio siffror (ÅÅMMDD-XXXX) skickas med sekel, ÅÅÅÅMMDD-XXXX (3.127.2)
          social_security_number: isPrivatePerson ? (personnummer12(invoice.organization_number) ?? invoice.organization_number) : null,
          residence_association_org_nr: rotBrf ? invoice.brf_org_number : null,
        })
        await supabase
          .from('invoices')
          .update({
            rot_rut_asked_amount: begart,
            rot_rut_fortnox_amount: Number.isFinite(fortnoxAvdrag) ? fortnoxAvdrag : null,
            rot_rut_error: null,
          })
          .eq('id', invoice.id)
      } catch (trErr: any) {
        console.error('TaxReduction-registrering misslyckades:', trErr)
        const felText = String(trErr?.message ?? 'okänt fel').slice(0, 500)
        await supabase
          .from('invoices')
          .update({
            rot_rut_asked_amount: begart,
            rot_rut_fortnox_amount: Number.isFinite(fortnoxAvdrag) ? fortnoxAvdrag : null,
            rot_rut_error: felText,
          })
          .eq('id', invoice.id)
        notify.error(
          `Fakturan skapades (nr ${fortnoxInvoice.DocumentNumber}) men ROT/RUT-avdraget kunde inte registreras automatiskt. Felet syns i fakturan. Komplettera avdraget i Fortnox. (${felText})`
        )
      }
    }

    // 5. Spara DocumentNumber + det förfallodatum och den leveransadress
    // som skickades till Fortnox
    await supabase
      .from('invoices')
      .update({
        fortnox_document_number: fortnoxInvoice.DocumentNumber,
        due_date: dueDate,
        delivery_address: workAddress.status === 'leverans' ? workAddress.text : null,
      })
      .eq('id', invoice.id)

    // 6. Uppdatera status till draft (utkast i Fortnox — ej bokfört, ej skickat ännu)
    await InvoiceService.updateInvoiceStatus(invoice.id, 'draft')
    if (opts.actor && invoice.case_id) {
      try {
        await createSystemComment(
          invoice.case_id,
          effectiveCaseType,
          'status_change',
          `Utkast skapat i Fortnox (nr ${fortnoxInvoice.DocumentNumber}) — ${invoice.invoice_number}`,
          opts.actor.userId,
          opts.actor.name
        )
      } catch {
        // Logga tyst
      }
    }

    notify.success(`Utkast skapat i Fortnox (nr ${fortnoxInvoice.DocumentNumber})`)
    return { status: 'created', documentNumber: String(fortnoxInvoice.DocumentNumber), invoiceNumber: invoice.invoice_number ?? null }
  } catch (err: any) {
    console.error(err)
    const message = 'Kunde inte skicka till Fortnox: ' + (err?.message || 'Okänt fel')
    notify.error(message)
    return { status: 'failed', message }
  }
}
