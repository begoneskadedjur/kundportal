// src/services/bokaInService.ts
// Boka in ett signerat dokument (offert eller avtal): förifyllning, flytt av
// offertens rader, stängning av ursprungsärendet och markering av dokumentet.
// Påminnelse till dokumentets tekniker och omkörning av signeringen ligger
// också här, så att kontorsläget i Dokumentsignering kan importera dem.
//
// UI: src/components/coordinator/bokaIn/BokaIn.tsx (förstegsdialog + CreateCaseModal)
// och KorOmSignering.tsx (när ett signerat avtal saknar kund).
//
// FLÖDET (beslut Christian 2026-10-23, skisserna KontorBokaIn*.dc.html)
//   1. forberedBokaIn(kalla) läser dokumentet (contracts) och ursprungsärendet
//      och bygger underlaget: förvald ärendetyp, beskrivning, offertens rader,
//      dokumentets ansvariga tekniker.
//   2. Koordinatorn väljer typ och rader och bokar i CreateCaseModal.
//   3. slutforBokaIn(...) körs i CreateCaseModals onCaseCreated:
//      a) offert: valda rader skapas på nya ärendet (nya id, mapped_service_id
//         och labor_for_item_id ompekade). Raderna på ursprungsärendet får
//         status 'cancelled' och notes "Flyttad till BE-xxxx". Fakturerade rader
//         rörs aldrig. Rader ur dokumentets egen behållare (case_id = contracts.id,
//         offert utan ursprungsärende) kopieras bara, behållaren rörs aldrig.
//      b) ursprungsärendet får status Avslutat (avslutsdatum sätts av
//         DB-triggern satt_avslutsdatum) och "Ersatt av BE-xxxx" i beskrivningen.
//         Fakturan: se stangUrsprungsarende.
//      c) dokumentet får booked_case_id och koordinatorstatus booked.
//   "Inget ärende" (t.ex. avropsavtal): slutforIngetArende stänger
//   ursprungsärendet och markerar dokumentet hanterat (dismissed_at,
//   coordinator_status completed, anledningen i coordinator_notes).
//
// FAKTURERING VID STÄNGNING
// Det finns ingen DB-trigger som fakturerar. Fakturan skapas av ärendemodalens
// sparkedja (EditCaseModal.handleSubmit: getOrCreateCaseCustomer +
// InvoiceService.upsertInvoiceFromCase). stangUrsprungsarende gör samma sak för
// private_cases/business_cases när raderna som stannar har ett belopp, och
// 0 kr-regeln (markZeroAmountRowsHandled) när de summerar till 0 kr. Provision
// skapas INTE här (kräver modalens provisionsandelar): när en utförd tjänst
// stannar returneras en varning om att provisionen registreras i ärendet.
// Avtalsärenden (cases) med fakturerbara rader kvar stängs inte automatiskt,
// de faktureras via merförsäljningsflödet i ärendets modal.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { CaseBillingService } from './caseBillingService'
import { InvoiceService } from './invoiceService'
import { CaseCustomerService } from './caseCustomerService'
import { VisitService } from './visitService'
import { CasePipelineService } from './casePipelineService'
import { OFFER_TEMPLATES } from '../constants/oneflowTemplates'
import { isDocumentSignedAwaitingStatus } from '../shared/documentStatus'
import { DOKUMENT_PAMINNELSE_PREFIX } from '../shared/dokumentNotis'
import { tolkaAvtalstext, type TolkadRad } from '../components/technician/ny/utrustning/avtaletsStationer'

// Otypad klient: raderna läses med select('*') och skrivs med explicita fält
const db = supabase as unknown as SupabaseClient

type Row = Record<string, unknown>
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v))

// ─── Typer (API) ───────────────────────────────────────────────────────────

export type ArendeTabell = 'private_cases' | 'business_cases' | 'cases'

/** Var Boka in öppnas ifrån: ett dokument i Dokumentsignering eller ett ärende i schemats låda */
export type BokaInKalla =
  | { typ: 'dokument'; offerId: string }
  | { typ: 'arende'; caseId: string; tabell: ArendeTabell }

/** Ärendetyperna i CreateCaseModal plus "Inget ärende" */
export type BokaInArendetyp =
  | 'private' | 'business' | 'contract' | 'inspection' | 'establishment' | 'rondering' | 'egenkontroll' | 'inget'

export type RotRut = 'ROT' | 'RUT'

export interface BokaInDokument {
  id: string
  typ: 'offer' | 'contract'
  /** Offertnummer/BG-nummer, annars Oneflow-id */
  nummer: string
  oneflowId: string | null
  templateId: string | null
  contractType: string | null
  label: string | null
  status: string | null
  kundnamn: string | null
  orgnr: string | null
  kontaktperson: string | null
  kontaktEpost: string | null
  kontaktTelefon: string | null
  adress: string | null
  /** Offert: totalvärde. Avtal: årspremien exkl. moms (annual_value, annars total_value) */
  belopp: number | null
  startdatum: string | null
  signerad: string | null
  avtalstext: string | null
  customerId: string | null
  customerGroupId: string | null
  bookedCaseId: string | null
  saljare: string | null
  teknikerEpost: string | null
}

export interface BokaInUrsprung {
  id: string
  tabell: ArendeTabell
  caseNumber: string | null
  titel: string | null
  status: string | null
  /** Rå ärenderad (select *) för förifyllning och fakturakunden */
  rad: Row
}

export interface OffertRad {
  id: string
  /** 'ursprung' = raden ligger på ursprungsärendet och flyttas; 'dokument' = kopieras ur dokumentets behållare */
  kalla: 'ursprung' | 'dokument'
  itemType: 'service' | 'article'
  namn: string
  antal: number
  /** total_price exkl. moms */
  belopp: number
  status: string
  rotRut: RotRut | null
  fastighetsbeteckning: string | null
  /** Tjänsteraden raden följer (mapped_service_id för kostnader, labor_for_item_id för arbetsrader) */
  foljerId: string | null
  /** Arbetsrad för ROT/RUT */
  arbetsrad: boolean
  /** Fakturerad: låst, stannar */
  last: boolean
  rad: Row
}

export interface BokaInUnderlag {
  kalla: BokaInKalla
  dokument: BokaInDokument | null
  ursprung: BokaInUrsprung | null
  forvaldTyp: BokaInArendetyp
  /** Förklaring till förvalet, visas i dialogen */
  forvalOrsak: string
  rotRut: RotRut | null
  /** Avtal utan kund: Boka in visar KorOmSignering */
  kundSaknas: boolean
  /** Kund att förvälja i CreateCaseModal: huvudkontoret när kunden är en enhet */
  kundId: string | null
  enhetId: string | null
  /** Offertens rader (tom för avtal: etableringen tar inga rader, premien går via fakturaplanen) */
  rader: OffertRad[]
  /** Stationer per typ ur avtalstexten (tolkaAvtalstext) */
  stationer: TolkadRad[]
  /** Förifylld beskrivning till teknikern */
  beskrivning: string
  /** Dokumentets ansvariga tekniker (technicians.id), den enda som bockas i för bokningsassistenten */
  ansvarigTeknikerId: string | null
  ansvarigTeknikerNamn: string | null
  /** Tjänst att förvälja (services.id): ursprungsärendets eller offertens första tjänst */
  tjanstId: string | null
}

export interface BokaInResultat {
  nyttArendeId: string | null
  nyttArendeNummer: string | null
  nyTabell: ArendeTabell | null
  flyttadeRader: number
  makuleradeRader: number
  ursprungStangt: boolean
  faktura: 'skapad' | 'noll' | 'ingen' | 'fel' | 'ej_aktuell'
  /** Det som koordinatorn behöver veta (visas som toast) */
  varningar: string[]
}

// ─── Hjälpare ──────────────────────────────────────────────────────────────

const TABELL_FOR_CASE_TYPE: Record<'private' | 'business' | 'contract', ArendeTabell> = {
  private: 'private_cases',
  business: 'business_cases',
  contract: 'cases',
}
const CASE_TYPE_FOR_TABELL: Record<ArendeTabell, 'private' | 'business' | 'contract'> = {
  private_cases: 'private',
  business_cases: 'business',
  cases: 'contract',
}

export function tabellForCaseType(t: 'private' | 'business' | 'contract'): ArendeTabell {
  return TABELL_FOR_CASE_TYPE[t]
}

function adressText(v: unknown): string | null {
  if (!v) return null
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v) as { formatted_address?: string }
      return p?.formatted_address || v
    } catch {
      return v
    }
  }
  if (typeof v === 'object') return str((v as { formatted_address?: string }).formatted_address)
  return null
}


/**
 * Förvald ärendetyp ur dokumentet (Christian 2026-10-23):
 * avtal → Etablering; avtal av typen Avropsavtal → Inget ärende;
 * offert efter mall: Exkl moms (Företag) → engångsjobb företag, Inkl moms → privat,
 * ROT → privat + ROT, RUT → privat + RUT. Okänd mall: ursprungsärendets tabell,
 * annars företag när dokumentet har ett org.nr och privat annars.
 */
export function forvaldArendetyp(
  dok: Pick<BokaInDokument, 'typ' | 'templateId' | 'contractType' | 'label' | 'orgnr'> | null,
  ursprungTabell: ArendeTabell | null
): { typ: BokaInArendetyp; rotRut: RotRut | null; orsak: string } {
  if (!dok) {
    const typ: BokaInArendetyp = ursprungTabell === 'business_cases' ? 'business' : ursprungTabell === 'cases' ? 'contract' : 'private'
    return { typ, rotRut: null, orsak: 'Inget dokument kopplat: typen följer ursprungsärendet.' }
  }
  if (dok.typ === 'contract') {
    const avrop = [dok.contractType, dok.label].some((v) => (v || '').trim().toLowerCase() === 'avropsavtal')
    return avrop
      ? { typ: 'inget', rotRut: null, orsak: 'Avtal av typen Avropsavtal: Inget ärende, bokas vid avrop.' }
      : { typ: 'establishment', rotRut: null, orsak: 'Avtal: Etablering.' }
  }
  const mall = OFFER_TEMPLATES.find((t) => t.id === dok.templateId)
  if (mall) {
    const namn = mall.name.toLowerCase()
    // Mallnamnen i oneflowTemplates har tankstreck; visa dem med komma i UI
    const visatNamn = mall.name.replace(/\s*[–—]\s*/g, ', ')
    if (namn.includes('rot')) return { typ: 'private', rotRut: 'ROT', orsak: `Mallen ${visatNamn}: engångsjobb privat med ROT.` }
    if (namn.includes('rut')) return { typ: 'private', rotRut: 'RUT', orsak: `Mallen ${visatNamn}: engångsjobb privat med RUT.` }
    if (mall.category === 'company') return { typ: 'business', rotRut: null, orsak: `Mallen ${visatNamn}: engångsjobb företag.` }
    return { typ: 'private', rotRut: null, orsak: `Mallen ${visatNamn}: engångsjobb privat.` }
  }
  if (ursprungTabell === 'business_cases') return { typ: 'business', rotRut: null, orsak: 'Okänd mall: typen följer ursprungsärendet (företag).' }
  if (ursprungTabell === 'private_cases') return { typ: 'private', rotRut: null, orsak: 'Okänd mall: typen följer ursprungsärendet (privat).' }
  if (ursprungTabell === 'cases') return { typ: 'contract', rotRut: null, orsak: 'Okänd mall: ursprungsärendet är ett avtalsärende, Extrabesök.' }
  const foretag = /^\d{2}[2-9]\d/.test((dok.orgnr || '').replace(/\D/g, ''))
  return foretag
    ? { typ: 'business', rotRut: null, orsak: 'Okänd mall, org.nr: engångsjobb företag.' }
    : { typ: 'private', rotRut: null, orsak: 'Okänd mall: engångsjobb privat.' }
}

function tillDokument(c: Row): BokaInDokument {
  const typ = c.type === 'contract' ? 'contract' : 'offer'
  const belopp = typ === 'contract'
    ? (c.annual_value != null ? num(c.annual_value) : c.total_value != null ? num(c.total_value) : null)
    : (c.total_value != null ? num(c.total_value) : null)
  return {
    id: String(c.id),
    typ,
    nummer: str(c.quote_reference_number) ?? str(c.oneflow_contract_id) ?? String(c.id).slice(0, 8),
    oneflowId: str(c.oneflow_contract_id),
    templateId: str(c.template_id),
    contractType: str(c.contract_type),
    label: str(c.label),
    status: str(c.status),
    kundnamn: str(c.company_name),
    orgnr: str(c.organization_number),
    kontaktperson: str(c.contact_person),
    kontaktEpost: str(c.contact_email),
    kontaktTelefon: str(c.contact_phone),
    adress: str(c.contact_address),
    belopp,
    startdatum: str(c.contract_start_date) ?? str(c.start_date),
    signerad: str(c.signed_at),
    avtalstext: str(c.agreement_text),
    customerId: str(c.customer_id),
    customerGroupId: str(c.customer_group_id),
    bookedCaseId: str(c.booked_case_id),
    saljare: str(c.created_by_name) ?? str(c.begone_employee_name),
    teknikerEpost: str(c.begone_employee_email) ?? str(c.created_by_email),
  }
}

async function hamtaArende(caseId: string, tabell: ArendeTabell): Promise<BokaInUrsprung | null> {
  const { data, error } = await db.from(tabell).select('*').eq('id', caseId).maybeSingle()
  if (error) throw new Error(`Ursprungsärendet: ${error.message}`)
  if (!data) return null
  const r = data as Row
  return { id: String(r.id), tabell, caseNumber: str(r.case_number), titel: str(r.title), status: str(r.status), rad: r }
}

/** Dokumentets ursprungsärende: source_id först, sedan ett väntande ärende med samma Oneflow-id */
async function hittaUrsprung(c: Row): Promise<BokaInUrsprung | null> {
  const sourceId = str(c.source_id)
  const st = str(c.source_type)
  if (sourceId && st !== 'lead' && st !== 'manual') {
    const order: ArendeTabell[] =
      st === 'private_case' ? ['private_cases'] : st === 'business_case' ? ['business_cases'] : ['cases', 'private_cases', 'business_cases']
    for (const t of order) {
      const u = await hamtaArende(sourceId, t)
      if (u) return u
    }
  }
  const oneflowId = str(c.oneflow_contract_id)
  if (!oneflowId) return null
  for (const t of ['private_cases', 'business_cases', 'cases'] as ArendeTabell[]) {
    const { data } = await db.from(t).select('*').eq('oneflow_contract_id', oneflowId).is('deleted_at', null).limit(5)
    const rows = (data ?? []) as Row[]
    const r = rows.find((x) => isDocumentSignedAwaitingStatus(str(x.status))) ?? null
    if (r) return { id: String(r.id), tabell: t, caseNumber: str(r.case_number), titel: str(r.title), status: str(r.status), rad: r }
  }
  return null
}

function tillOffertRad(r: Row, kalla: 'ursprung' | 'dokument'): OffertRad {
  const itemType = r.item_type === 'service' ? 'service' : 'article'
  const status = str(r.status) ?? 'pending'
  return {
    id: String(r.id),
    kalla,
    itemType,
    namn: str(r.service_name) ?? str(r.article_name) ?? 'Rad',
    antal: num(r.quantity) || 1,
    belopp: num(r.total_price),
    status,
    rotRut: r.rot_rut_type === 'ROT' || r.rot_rut_type === 'RUT' ? (r.rot_rut_type as RotRut) : null,
    fastighetsbeteckning: str(r.fastighetsbeteckning),
    foljerId: itemType === 'article' ? str(r.mapped_service_id) : str(r.labor_for_item_id),
    arbetsrad: itemType === 'service' && !!str(r.labor_for_item_id),
    last: kalla === 'ursprung' && status === 'billed',
    rad: r,
  }
}

async function hamtaOffertRader(dok: BokaInDokument | null, ursprung: BokaInUrsprung | null): Promise<OffertRad[]> {
  if (!dok || dok.typ !== 'offer') return []
  if (ursprung) {
    const { data, error } = await db
      .from('case_billing_items')
      .select('*')
      .eq('case_id', ursprung.id)
      .eq('case_type', CASE_TYPE_FOR_TABELL[ursprung.tabell])
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    if (error) throw new Error(`Offertens rader: ${error.message}`)
    const rows = ((data ?? []) as Row[]).filter((r) => !r.covered_by_contract)
    if (rows.length > 0) return rows.map((r) => tillOffertRad(r, 'ursprung'))
  }
  // Offert utan rader på ärendet: dokumentets behållare (samma som fliken Innehåll)
  const { data, error } = await db
    .from('case_billing_items')
    .select('*')
    .eq('case_id', dok.id)
    .eq('case_type', 'contract')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Offertens rader: ${error.message}`)
  return ((data ?? []) as Row[]).map((r) => tillOffertRad(r, 'dokument'))
}

/** Förifylld beskrivning till teknikern: ursprung, omfattning, stationer, startdatum, kontakt, adress */
export function byggBeskrivning(u: {
  dokument: BokaInDokument | null
  ursprung: BokaInUrsprung | null
  rader: OffertRad[]
  stationer: TolkadRad[]
  avtalstext: string | null
}): string {
  const { dokument: d, ursprung, rader, stationer, avtalstext } = u
  const delar: string[] = []
  if (d) {
    const vad = d.typ === 'contract' ? 'avtal' : 'offert'
    delar.push(`Från ${vad} ${d.nummer}${ursprung?.caseNumber ? `, ursprungsärende ${ursprung.caseNumber}` : ''}.`)
  } else if (ursprung?.caseNumber) {
    delar.push(`Ursprungsärende ${ursprung.caseNumber}.`)
  }
  if (stationer.length > 0) {
    delar.push(`Stationer enligt avtalet: ${stationer.map((s) => `${s.antal} ${s.ord}`).join(', ')}.`)
  }
  const tjanster = rader.filter((r) => r.itemType === 'service' && !r.arbetsrad)
  if (tjanster.length > 0) {
    delar.push(`Tjänster:\n${tjanster.map((r) => `- ${r.antal > 1 ? `${r.antal} st ` : ''}${r.namn}`).join('\n')}`)
  }
  if (avtalstext) delar.push(`Omfattning:\n${avtalstext.trim()}`)
  if (d?.startdatum) delar.push(`Startdatum: ${d.startdatum}.`)
  const kontakt = [d?.kontaktperson, d?.kontaktTelefon, d?.kontaktEpost].filter(Boolean).join(', ')
  if (kontakt) delar.push(`Kontakt: ${kontakt}.`)
  if (d?.adress) delar.push(`Adress: ${d.adress}.`)
  const tidigare = str(ursprung?.rad.description)
  if (tidigare) delar.push(`Från ursprungsärendet:\n${tidigare.trim()}`)
  return delar.join('\n\n')
}

// ─── 1. Förbered ───────────────────────────────────────────────────────────

/** Läser dokument och ursprungsärende och bygger underlaget för förstegsdialogen och CreateCaseModal */
export async function forberedBokaIn(kalla: BokaInKalla): Promise<BokaInUnderlag> {
  let kontrakt: Row | null = null
  let ursprung: BokaInUrsprung | null = null

  if (kalla.typ === 'dokument') {
    const { data, error } = await db.from('contracts').select('*').eq('id', kalla.offerId).maybeSingle()
    if (error) throw new Error(`Dokumentet: ${error.message}`)
    if (!data) throw new Error('Dokumentet finns inte')
    kontrakt = data as Row
    ursprung = await hittaUrsprung(kontrakt)
  } else {
    ursprung = await hamtaArende(kalla.caseId, kalla.tabell)
    if (!ursprung) throw new Error('Ärendet finns inte')
    const oneflowId = str(ursprung.rad.oneflow_contract_id)
    if (oneflowId) {
      const { data } = await db.from('contracts').select('*').eq('oneflow_contract_id', oneflowId).maybeSingle()
      kontrakt = (data as Row | null) ?? null
    }
    if (!kontrakt) {
      // Wizard-dokument pekar på ärendet via source_id
      const { data } = await db
        .from('contracts')
        .select('*')
        .eq('source_id', ursprung.id)
        .in('status', ['signed', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
      kontrakt = ((data ?? []) as Row[])[0] ?? null
    }
  }

  const dokument = kontrakt ? tillDokument(kontrakt) : null
  const forval = forvaldArendetyp(dokument, ursprung?.tabell ?? null)
  const rader = await hamtaOffertRader(dokument, ursprung)

  // Kunden: avtalets kund, annars ursprungsärendets (avtalsärende)
  const kundRadId = dokument?.customerId ?? (ursprung?.tabell === 'cases' ? str(ursprung.rad.customer_id) : null)
  let kundId: string | null = null
  let enhetId: string | null = null
  let kundensAvtalstext: string | null = null
  if (kundRadId) {
    const { data: kund } = await db
      .from('customers')
      .select('id, parent_customer_id, agreement_text')
      .eq('id', kundRadId)
      .maybeSingle()
    const k = kund as Row | null
    if (k) {
      kundId = str(k.parent_customer_id) ?? String(k.id)
      enhetId = str(k.parent_customer_id) ? String(k.id) : null
      kundensAvtalstext = str(k.agreement_text)
    }
  }
  const avtalstext = dokument?.typ === 'contract' ? (kundensAvtalstext ?? dokument.avtalstext) : dokument?.avtalstext ?? null
  const stationer = dokument?.typ === 'contract' ? tolkaAvtalstext(avtalstext) : []

  // Dokumentets ansvariga tekniker (avsändaren i wizarden), annars ärendets
  let ansvarigTeknikerId: string | null = null
  let ansvarigTeknikerNamn: string | null = null
  if (dokument?.teknikerEpost) {
    const { data: tek } = await db
      .from('technicians')
      .select('id, name')
      .ilike('email', dokument.teknikerEpost)
      .limit(1)
      .maybeSingle()
    if (tek) {
      ansvarigTeknikerId = String((tek as Row).id)
      ansvarigTeknikerNamn = str((tek as Row).name)
    }
  }
  if (!ansvarigTeknikerId && ursprung) {
    ansvarigTeknikerId = str(ursprung.rad.primary_assignee_id) ?? str(ursprung.rad.primary_technician_id)
    ansvarigTeknikerNamn = str(ursprung.rad.primary_assignee_name) ?? str(ursprung.rad.primary_technician_name)
  }

  const forstaTjanst = rader.find((r) => r.itemType === 'service' && !r.arbetsrad && str(r.rad.service_id))
  const tjanstId = (ursprung && ursprung.tabell !== 'cases' ? str(ursprung.rad.service_id) : null) ?? (forstaTjanst ? str(forstaTjanst.rad.service_id) : null)

  return {
    kalla,
    dokument,
    ursprung,
    forvaldTyp: forval.typ,
    forvalOrsak: forval.orsak,
    rotRut: forval.rotRut ?? (rader.find((r) => r.rotRut)?.rotRut ?? null),
    kundSaknas: dokument?.typ === 'contract' && !dokument.customerId,
    kundId,
    enhetId,
    rader,
    stationer,
    beskrivning: byggBeskrivning({ dokument, ursprung, rader, stationer, avtalstext }),
    ansvarigTeknikerId,
    ansvarigTeknikerNamn,
    tjanstId,
  }
}

/**
 * Formulärfält till CreateCaseModal (initialFormData) för vald typ. Bara kolumner
 * som finns i måltabellen: private/business sprids rakt in i inserten.
 */
export function formularFalt(u: BokaInUnderlag, typ: BokaInArendetyp): Record<string, unknown> {
  const d = u.dokument
  const r = u.ursprung?.rad ?? {}
  const urTabell = u.ursprung?.tabell ?? null
  const kontaktperson = str(r.kontaktperson) ?? str(r.contact_person) ?? d?.kontaktperson ?? null
  const telefon = str(r.telefon_kontaktperson) ?? str(r.contact_phone) ?? d?.kontaktTelefon ?? null
  const epost = str(r.e_post_kontaktperson) ?? str(r.contact_email) ?? d?.kontaktEpost ?? null
  const adress = adressText(r.adress) ?? adressText(r.address) ?? d?.adress ?? null
  const bas: Record<string, unknown> = {
    status: 'Bokad',
    description: u.beskrivning,
    ...(kontaktperson ? { kontaktperson } : {}),
    ...(telefon ? { telefon_kontaktperson: telefon } : {}),
    ...(epost ? { e_post_kontaktperson: epost } : {}),
    ...(adress ? { adress } : {}),
    ...(u.ansvarigTeknikerId ? { primary_assignee_id: u.ansvarigTeknikerId } : {}),
  }
  if (typ === 'private') {
    const fastighet = u.rader.find((x) => x.fastighetsbeteckning)?.fastighetsbeteckning ?? str(r.r_fastighetsbeteckning)
    return {
      ...bas,
      ...(urTabell === 'private_cases' && str(r.personnummer) ? { personnummer: str(r.personnummer) } : {}),
      ...(!str(r.personnummer) && d?.orgnr && d.typ === 'offer' ? { personnummer: d.orgnr } : {}),
      ...(str(r.skadedjur) ? { skadedjur: str(r.skadedjur) } : {}),
      ...(u.rotRut ? { r_rot_rut: u.rotRut } : {}),
      ...(u.rotRut && fastighet ? { r_fastighetsbeteckning: fastighet } : {}),
    }
  }
  if (typ === 'business') {
    const foretag = urTabell === 'business_cases'
    const grupp = (foretag ? str(r.customer_group_id) : null) ?? d?.customerGroupId ?? null
    return {
      ...bas,
      company_name: (foretag ? str(r.company_name) ?? str(r.bestallare) : null) ?? d?.kundnamn ?? '',
      org_nr: (foretag ? str(r.org_nr) : null) ?? d?.orgnr ?? '',
      ...(foretag && str(r.bestallare) ? { bestallare: str(r.bestallare) } : {}),
      ...(foretag && str(r.e_post_faktura) ? { e_post_faktura: str(r.e_post_faktura) } : {}),
      ...(foretag && str(r.markning_faktura) ? { markning_faktura: str(r.markning_faktura) } : {}),
      ...(grupp ? { customer_group_id: grupp } : {}),
      ...(str(r.skadedjur) ? { skadedjur: str(r.skadedjur) } : {}),
    }
  }
  return bas
}

// ─── 2. Flytta offertens rader ─────────────────────────────────────────────

const KOPIERA_INTE = new Set([
  'id', 'case_id', 'case_type', 'created_at', 'updated_at', 'status', 'visit_id', 'visit_number',
  'mapped_service_id', 'labor_for_item_id', 'notes', 'customer_id',
  // Avtalsfält som bara gäller avtalets behållare
  'billing_model', 'is_premium_carrier', 'premium_share', 'contract_addition_annual', 'site_customer_id',
  'billing_start_date', 'covered_by_contract', 'is_addon_station_line', 'is_addon_prorata_line',
  'is_addon_labour_line', 'addon_labour_hours', 'addon_labour_hours_before', 'addon_annual_unit_price', 'addon_model',
  'station_type_id',
  // Rabattens godkännande ägs av triggern trg_cbi_discount_approval: den nya
  // raden ärver godkännandet via discount_source_item_id när källan är
  // godkänd med samma procent, annars väntar rabatten på godkännande igen
  'requires_approval', 'discount_approved_by', 'discount_approved_by_name', 'discount_approved_at',
  'discount_rejected_reason', 'discount_rejected_by_name', 'discount_rejected_at', 'discount_source_item_id',
  // Relationer om raden lästs med join
  'article', 'service',
])

/**
 * Skapar de valda raderna på nya ärendet och makulerar dem på ursprungsärendet.
 * Kopplade kostnader (mapped_service_id) och arbetsrader (labor_for_item_id)
 * följer sin tjänst: väljs tjänsten följer de med, väljs den inte stannar de.
 * Fakturerade rader rörs aldrig. Returnerar antal skapade och makulerade.
 */
export async function flyttaOffertRader(
  rader: OffertRad[],
  valdaIds: Set<string>,
  nytt: { id: string; tabell: ArendeTabell; caseNumber: string | null; customerId: string | null }
): Promise<{ skapade: number; makulerade: number }> {
  // Följande rader ärver tjänstens val
  const valda = rader.filter((r) => {
    if (r.last) return false
    if (r.foljerId && rader.some((x) => x.id === r.foljerId)) {
      const foralder = rader.find((x) => x.id === r.foljerId)!
      return !foralder.last && valdaIds.has(foralder.id)
    }
    return valdaIds.has(r.id)
  })
  if (valda.length === 0) return { skapade: 0, makulerade: 0 }

  const nyCaseType = CASE_TYPE_FOR_TABELL[nytt.tabell]
  const idMap = new Map<string, string>()
  // Tjänster först (arbetsrader och kostnader pekar på dem), sedan arbetsrader, sist artiklar
  const ordning = [
    ...valda.filter((r) => r.itemType === 'service' && !r.arbetsrad),
    ...valda.filter((r) => r.itemType === 'service' && r.arbetsrad),
    ...valda.filter((r) => r.itemType === 'article'),
  ]
  for (const r of ordning) {
    const ny: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r.rad)) {
      if (!KOPIERA_INTE.has(k)) ny[k] = v
    }
    ny.case_id = nytt.id
    ny.case_type = nyCaseType
    ny.status = 'pending'
    ny.customer_id = nytt.tabell === 'cases' ? nytt.customerId : (str(r.rad.customer_id) ?? null)
    ny.notes = str(r.rad.notes)
    // Rabatten följer med, liksom dess godkännande (se KOPIERA_INTE)
    if (Number(r.rad.discount_percent ?? 0) > 0) ny.discount_source_item_id = r.id
    if (r.itemType === 'article') {
      const m = str(r.rad.mapped_service_id)
      ny.mapped_service_id = m ? idMap.get(m) ?? null : null
    } else {
      const l = str(r.rad.labor_for_item_id)
      ny.labor_for_item_id = l ? idMap.get(l) ?? null : null
    }
    const { data, error } = await db.from('case_billing_items').insert(ny).select('id').single()
    if (error) throw new Error(`Raden "${r.namn}" kunde inte skapas: ${error.message}`)
    idMap.set(r.id, String((data as Row).id))
  }

  // Makulera på ursprungsärendet (bara rader som ligger där, aldrig dokumentets behållare)
  const attMakulera = valda.filter((r) => r.kalla === 'ursprung')
  const notis = `Flyttad till ${nytt.caseNumber ?? 'nytt ärende'}`
  for (const r of attMakulera) {
    const tidigare = str(r.rad.notes)
    const { error } = await db
      .from('case_billing_items')
      .update({ status: 'cancelled', notes: tidigare ? `${tidigare}\n${notis}` : notis })
      .eq('id', r.id)
      .neq('status', 'billed')
    if (error) throw new Error(`Raden "${r.namn}" kunde inte makuleras på ursprungsärendet: ${error.message}`)
  }
  return { skapade: ordning.length, makulerade: attMakulera.length }
}

// ─── 3. Stäng ursprungsärendet ─────────────────────────────────────────────

/**
 * Stänger ursprungsärendet med status Avslutat. Fakturering som i ärendemodalens
 * sparkedja (EditCaseModal.handleSubmit): finns rader med belopp kvar skapas
 * fakturakunden och fakturan (upsertInvoiceFromCase), summerar de till 0 kr
 * markeras de hanterade (ingen faktura). Avtalsärenden (cases) med belopp kvar
 * lämnas öppna.
 */
export async function stangUrsprungsarende(
  ursprung: BokaInUrsprung,
  notering: string
): Promise<{ stangt: boolean; faktura: BokaInResultat['faktura']; varningar: string[] }> {
  const varningar: string[] = []
  const caseType = CASE_TYPE_FOR_TABELL[ursprung.tabell]
  const harRader = await CaseBillingService.caseHasBillingItems(ursprung.id, caseType)
  const harBelopp = harRader ? await CaseBillingService.caseHasBillableAmount(ursprung.id, caseType) : false

  const r = ursprung.rad
  const beskrivning = str(r.description)
  const nyBeskrivning = beskrivning ? `${notering}\n\n${beskrivning}` : notering

  if (ursprung.tabell === 'cases' && harBelopp) {
    const { error } = await db.from('cases').update({ description: nyBeskrivning }).eq('id', ursprung.id)
    if (error) throw new Error(`Ursprungsärendet: ${error.message}`)
    varningar.push(`Ursprungsärendet ${ursprung.caseNumber ?? ''} har fakturerbara rader kvar och lämnas öppet. Avsluta det i ärendet så att merförsäljningen faktureras.`)
    return { stangt: false, faktura: 'ej_aktuell', varningar }
  }

  const { error: statusError } = await db
    .from(ursprung.tabell)
    .update({ status: 'Avslutat', description: nyBeskrivning })
    .eq('id', ursprung.id)
  if (statusError) throw new Error(`Ursprungsärendet kunde inte stängas: ${statusError.message}`)

  if (ursprung.tabell === 'cases') return { stangt: true, faktura: 'ej_aktuell', varningar }
  if (!harRader) return { stangt: true, faktura: 'ingen', varningar }

  const typ = caseType as 'private' | 'business'
  try {
    if (!harBelopp) {
      await CaseBillingService.markZeroAmountRowsHandled(ursprung.id, typ)
      return { stangt: true, faktura: 'noll', varningar }
    }

    // Slutbesöket före fakturan, som i EditCaseModal (fakturaraderna får besökskoppling)
    await VisitService.createVisitSnapshot({
      caseId: ursprung.id,
      caseType: typ,
      source: 'completion',
      isFinal: true,
      customerId: str(r.customer_id),
      technicianId: str(r.primary_assignee_id),
      technicianName: str(r.primary_assignee_name),
      workPerformed: str(r.rapport),
      timeSpentMinutes: r.time_spent_minutes != null ? num(r.time_spent_minutes) : null,
    })

    const namn = typ === 'business'
      ? (str(r.company_name) ?? str(r.bestallare) ?? str(r.kontaktperson) ?? 'Okänd kund')
      : (str(r.kontaktperson) ?? 'Okänd kund')
    const epost = typ === 'business'
      ? (str(r.e_post_faktura) ?? str(r.e_post_kontaktperson))
      : str(r.e_post_kontaktperson)
    const adress = adressText(r.adress)
    const kund = await CaseCustomerService.getOrCreateCaseCustomer({
      caseType: typ,
      name: namn,
      personnummer: typ === 'private' ? str(r.personnummer) : null,
      organization_number: typ === 'business' ? str(r.org_nr) : null,
      email: epost,
      phone: str(r.telefon_kontaktperson),
      address: adress,
      customerGroupId: typ === 'business' ? (str(r.customer_group_id) ?? undefined) : undefined,
    })
    const faktura = await InvoiceService.upsertInvoiceFromCase(ursprung.id, typ, {
      name: namn,
      email: epost ?? undefined,
      phone: str(r.telefon_kontaktperson) ?? undefined,
      address: adress ?? undefined,
      organization_number: (typ === 'business' ? str(r.org_nr) : str(r.personnummer)) ?? undefined,
      invoice_marking: typ === 'business' ? (str(r.markning_faktura) ?? undefined) : undefined,
      customer_id: kund.customerId,
    })
    varningar.push(`En utförd tjänst stannar på ${ursprung.caseNumber ?? 'ursprungsärendet'} och har fakturerats där. Provisionen registreras när ärendet öppnas och sparas.`)
    return { stangt: true, faktura: faktura ? 'skapad' : 'noll', varningar }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    varningar.push(`Ursprungsärendet är stängt men fakturan kunde inte skapas: ${msg}`)
    return { stangt: true, faktura: 'fel', varningar }
  }
}

// ─── 4. Dokumentet ─────────────────────────────────────────────────────────

/** Dokumentet bokat: booked_case_id (kön flyttar det till Bokade) och koordinatorstatus booked */
export async function markeraDokumentBokat(contractId: string, nyttArendeId: string, userId: string | null): Promise<void> {
  const { error } = await db.from('contracts').update({ booked_case_id: nyttArendeId }).eq('id', contractId)
  if (error) throw new Error(`Dokumentet kunde inte markeras som bokat: ${error.message}`)
  await CasePipelineService.updateOfferStatus(contractId, 'booked', userId)
}

/** Dokumentet hanterat utan nytt ärende: dismissed_at, status completed och anledningen */
export async function markeraDokumentHanterat(contractId: string, anledning: string, userId: string | null): Promise<void> {
  const nu = new Date().toISOString()
  const { error } = await db
    .from('coordinator_case_actions')
    .upsert(
      {
        contract_id: contractId,
        coordinator_status: 'completed',
        status_updated_at: nu,
        status_updated_by: userId,
        dismissed_at: nu,
        dismissed_by: userId,
        coordinator_notes: `Inget ärende: ${anledning}`,
      },
      { onConflict: 'contract_id' }
    )
  if (error) throw new Error(`Dokumentet kunde inte markeras som hanterat: ${error.message}`)
}

// ─── Efterstegen ───────────────────────────────────────────────────────────

/**
 * Körs när CreateCaseModal skapat det nya ärendet (onCaseCreated). Fel i ett
 * steg stoppar inte de följande: allt som inte gick samlas i varningar.
 */
export async function slutforBokaIn(params: {
  underlag: BokaInUnderlag
  nyttArendeId: string
  caseType: 'private' | 'business' | 'contract'
  valdaRadIds: Set<string>
  userId: string | null
}): Promise<BokaInResultat> {
  const { underlag: u, nyttArendeId, caseType, valdaRadIds, userId } = params
  const tabell = TABELL_FOR_CASE_TYPE[caseType]
  const res: BokaInResultat = {
    nyttArendeId,
    nyttArendeNummer: null,
    nyTabell: tabell,
    flyttadeRader: 0,
    makuleradeRader: 0,
    ursprungStangt: false,
    faktura: 'ingen',
    varningar: [],
  }

  const { data: nyRad } = await db.from(tabell).select('id, case_number, description, customer_id').eq('id', nyttArendeId).maybeSingle()
  const ny = (nyRad as Row | null) ?? {}
  res.nyttArendeNummer = str(ny.case_number)
  const nyttNr = res.nyttArendeNummer ?? 'nya ärendet'

  // Länk på nya ärendet (beskrivningen förifylls med den, men koordinatorn kan ha skrivit om den)
  const d = u.dokument
  const lank = d
    ? `Från ${d.typ === 'contract' ? 'avtal' : 'offert'} ${d.nummer}${u.ursprung?.caseNumber ? `, ursprungsärende ${u.ursprung.caseNumber}` : ''}.`
    : u.ursprung?.caseNumber ? `Ursprungsärende ${u.ursprung.caseNumber}.` : null
  const nuvarande = str(ny.description)
  if (lank && !(nuvarande ?? '').includes(lank)) {
    const { error } = await db.from(tabell).update({ description: nuvarande ? `${lank}\n\n${nuvarande}` : lank }).eq('id', nyttArendeId)
    if (error) res.varningar.push(`Länken till ursprunget kunde inte skrivas på ${nyttNr}: ${error.message}`)
  }

  // a) offertens rader
  if (d?.typ === 'offer' && u.rader.length > 0) {
    try {
      const f = await flyttaOffertRader(u.rader, valdaRadIds, { id: nyttArendeId, tabell, caseNumber: res.nyttArendeNummer, customerId: str(ny.customer_id) })
      res.flyttadeRader = f.skapade
      res.makuleradeRader = f.makulerade
    } catch (err) {
      res.varningar.push(err instanceof Error ? err.message : String(err))
    }
  }

  // b) ursprungsärendet
  if (u.ursprung && u.ursprung.id !== nyttArendeId) {
    try {
      const s = await stangUrsprungsarende(u.ursprung, `Ersatt av ${nyttNr} (bokad in ${new Date().toLocaleDateString('sv-SE')}).`)
      res.ursprungStangt = s.stangt
      res.faktura = s.faktura
      res.varningar.push(...s.varningar)
    } catch (err) {
      res.varningar.push(err instanceof Error ? err.message : String(err))
    }
  }

  // c) dokumentet
  if (d) {
    try {
      await markeraDokumentBokat(d.id, nyttArendeId, userId)
    } catch (err) {
      res.varningar.push(err instanceof Error ? err.message : String(err))
    }
  }
  return res
}

/** "Inget ärende": ursprungsärendet stängs och dokumentet markeras hanterat med anledningen */
export async function slutforIngetArende(params: {
  underlag: BokaInUnderlag
  anledning: string
  userId: string | null
}): Promise<BokaInResultat> {
  const { underlag: u, anledning, userId } = params
  const res: BokaInResultat = {
    nyttArendeId: null,
    nyttArendeNummer: null,
    nyTabell: null,
    flyttadeRader: 0,
    makuleradeRader: 0,
    ursprungStangt: false,
    faktura: 'ingen',
    varningar: [],
  }
  if (!anledning.trim()) throw new Error('Ange en anledning')
  if (u.ursprung) {
    const s = await stangUrsprungsarende(u.ursprung, `Inget nytt ärende: ${anledning.trim()} (${new Date().toLocaleDateString('sv-SE')}).`)
    res.ursprungStangt = s.stangt
    res.faktura = s.faktura
    res.varningar.push(...s.varningar)
  }
  if (u.dokument) await markeraDokumentHanterat(u.dokument.id, anledning.trim(), userId)
  return res
}

// ─── Kör om signeringen (koordinatorn) ─────────────────────────────────────

export interface SigneringsDiagnosPost {
  field: 'company_name' | 'contact_email' | 'organization_number' | 'contact_person' | 'contact_phone' | 'contact_address' | null
  label: string
  current: string | null
  level: 'hinder' | 'varning' | 'info'
  problem: string
  fixIn: 'portal' | 'oneflow' | 'ingen'
}

export interface SigneringsKorning {
  contractId: string | null
  dryRun: boolean
  skipped?: string
  customerId: string | null
  customerCreated: boolean
  invoicesCreated: number
  actions: string[]
  notes: string[]
  diagnos: { contractId: string; canCreateCustomer: boolean; customerId: string | null; items: SigneringsDiagnosPost[] }
}

/** Provkör (dryRun true, förvalt) eller kör signeringen på riktigt. Läser och skriver bara portalens databas. */
export async function korOmSignering(contractId: string, dryRun = true): Promise<SigneringsKorning> {
  const res = await apiFetch('/api/oneflow/reprocess-signed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractId, dryRun }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || 'Signeringen kunde inte köras')
  return body as SigneringsKorning
}

export type SigneringsFalt = Partial<Record<'company_name' | 'contact_email' | 'organization_number' | 'contact_person' | 'contact_phone' | 'contact_address', string>>

/** Fyller i uppgifter på avtalsraden (contracts) före omkörningen. Bara de sex fälten diagnosen pekar på. */
export async function sparaSigneringsUppgifter(contractId: string, falt: SigneringsFalt): Promise<void> {
  const tillatna = ['company_name', 'contact_email', 'organization_number', 'contact_person', 'contact_phone', 'contact_address'] as const
  const upd: Record<string, string | null> = {}
  for (const k of tillatna) {
    if (falt[k] !== undefined) upd[k] = (falt[k] ?? '').trim() || null
  }
  if (Object.keys(upd).length === 0) return
  const { error } = await db.from('contracts').update(upd).eq('id', contractId)
  if (error) throw new Error(`Uppgifterna kunde inte sparas: ${error.message}`)
}

// ─── Påminn teknikern ──────────────────────────────────────────────────────

/** Rubrikens början känns igen av notislistorna (src/shared/dokumentNotis.ts) */
export { DOKUMENT_PAMINNELSE_PREFIX }

/**
 * Notis i portalen till dokumentets tekniker: "Påminnelse: följ upp <dokument>, <kund>".
 * Klick öppnar /technician/dokumentsignering?id=<id> (notisen har case_id = contracts.id
 * och case_type null). Teknikern = avsändaren i wizarden (begone_employee_email,
 * annars created_by_email) med inloggning i portalen.
 */
export async function paminnTekniker(
  offerId: string,
  avsandare: { userId: string; namn: string }
): Promise<{ mottagareNamn: string }> {
  const { data: c, error } = await db
    .from('contracts')
    .select('id, type, quote_reference_number, oneflow_contract_id, company_name, contact_person, begone_employee_email, created_by_email')
    .eq('id', offerId)
    .maybeSingle()
  if (error) throw new Error(`Dokumentet: ${error.message}`)
  if (!c) throw new Error('Dokumentet finns inte')
  const k = c as Row
  const epost = str(k.begone_employee_email) ?? str(k.created_by_email)
  if (!epost) throw new Error('Dokumentet har ingen tekniker')

  const { data: tek } = await db.from('technicians').select('id, name').ilike('email', epost).limit(1).maybeSingle()
  const t = tek as Row | null
  if (!t) throw new Error(`Hittar ingen tekniker med e-post ${epost}`)
  const { data: prof } = await db.from('profiles').select('user_id').eq('technician_id', String(t.id)).limit(1).maybeSingle()
  const mottagare = str((prof as Row | null)?.user_id)
  if (!mottagare) throw new Error(`${str(t.name) ?? 'Teknikern'} har ingen inloggning i portalen`)

  const dokument = `${k.type === 'contract' ? 'avtal' : 'offert'} ${str(k.quote_reference_number) ?? str(k.oneflow_contract_id) ?? ''}`.trim()
  const kund = str(k.company_name) ?? str(k.contact_person) ?? 'kunden'
  const { error: insError } = await db.from('notifications').insert({
    recipient_id: mottagare,
    case_id: offerId,
    case_type: null,
    title: `${DOKUMENT_PAMINNELSE_PREFIX} ${dokument}, ${kund}`,
    preview: `${avsandare.namn} vill att du följer upp ${dokument} till ${kund}. Öppna dokumentet i Dokumentsignering.`,
    case_title: kund,
    sender_id: avsandare.userId,
    sender_name: avsandare.namn,
    is_read: false,
  })
  if (insError) throw new Error(`Påminnelsen kunde inte skickas: ${insError.message}`)
  return { mottagareNamn: str(t.name) ?? 'Teknikern' }
}
