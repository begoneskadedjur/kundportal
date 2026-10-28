// api/_lib/contractSigning.ts
// Signeringsbehandlingen av ett AVTAL (contracts.type = 'contract').
//
// Körs av Oneflow-webhooken vid contract:sign och kan köras om i efterhand för
// ett givet avtal (api/oneflow/reprocess-signed.ts). Varje steg är idempotent:
// det läser läget först och skriver bara det som saknas eller är fel, så en
// omkörning på ett redan behandlat avtal gör ingenting.
//
// Steg (beslut från Christian 2026-10-15, fallet Pär-Eric Nilsson):
//   F  Org/personnummer: kundens ändring i Oneflow som inte klarar
//      kontrollsiffran ersätts med numret vi skickade.
//   D  Avtalsfälten och premien: premien är Oneflow-avtalets belopp rakt av.
//      Priset i Oneflow är alltid exkl. moms, även för privatpersoner (beslut
//      2026-10-19). Avtalets tjänsterader rättas så att summan stämmer.
//   G  Avtalstypen = avtalets tjänst i katalogen (bärande § 4-rad via triggern
//      trg_contracts_ensure_carrier).
//   A  Kunden skapas eller kopplas (signed OCH active är signerade: triggern
//      contract_signed_becomes_active byter direkt till active när startdagen
//      redan passerat).
//   G  Avtalskartan: omfattning, fakturamånad; fakturaplanen skapas med samma
//      perioder och rader som Planera fakturor i webben.
//   B/E Källärendet: status "Avtal signerat - Etablera", och ärendets avtalsrad
//      tas ur engångsfaktureringen.
//   A  Notis till faktureringsansvariga, med allt som inte kunde härledas.
//
// "Vår kedja" = contracts.created_by_email satt (se isOurChainContract i
// src/shared/contractSigning.ts). Bara då rättas premieraderna, sätts kartan
// upp och planeras fakturorna. Avtal skapade direkt i Oneflow får kund och notis
// som förut.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  compareIdentityNumbers,
  correctPremiumRows,
  deriveMapSetup,
  identityNumberVariants,
  isIndividualParty,
  isOurChainContract,
  pickContractService,
  premiumExclVatFromOneflow,
  selectSourceRowsCoveredByContract,
  type ContractServiceCandidate,
  type PremiumRow,
  type SourceCaseRow,
} from '../../src/shared/contractSigning'
import {
  CONTRACT_SIGNED_STATUS,
  isDocumentSentStatus,
  isSignedContractStatus,
} from '../../src/shared/documentStatus'
import {
  computePlannedPeriods,
  DEFAULT_INVOICE_LEAD_DAYS,
  parseLocalDate,
  toLocalIsoDate,
  todayLocal,
  type EquipmentLine,
  type PlannedPeriod,
  type PlanningContract,
  type PremiumStep,
} from '../../src/shared/contractPlanner'
import {
  buildContractInvoiceNotes,
  buildContractInvoiceRows,
  invoiceTotals,
  nextInvoiceNumber,
  toInvoiceItemRows,
  type ContractServiceItem,
} from '../../src/shared/contractInvoiceRows'
import { deriveDeliveryFromContract, type DerivedDelivery } from '../../src/shared/invoiceDelivery'
import { tolkaIdNummer } from '../../src/shared/webLeadUppgifter'
import { jamforIdNummer, kundensIdNummer, valideraKundOchOmfattning, type KopplingsKund } from '../../src/shared/avtalsKundKoppling'

export interface SigningOptions {
  /** Inga skrivningar: rapporten beskriver vad som skulle göras */
  dryRun?: boolean
  /** Oneflows parttyp för motparten ('individual' | 'company'), när den är känd */
  oneflowPartyType?: string | null
}

export interface SigningReport {
  contractId: string | null
  oneflowContractId: string | null
  ourChain: boolean
  dryRun: boolean
  skipped?: string
  customerId: string | null
  customerCreated: boolean
  invoicesCreated: number
  /** Vad som gjordes (eller skulle göras vid dryRun) */
  actions: string[]
  /** Det som ska kontrolleras: hamnar i notisen till faktureringsansvariga */
  notes: string[]
}

type Db = SupabaseClient

// Rader som läses med select('*'): typas löst, fälten används explicit
type Row = Record<string, unknown>
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))
const kr = (n: number) => `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n)} kr`

interface Ctx {
  db: Db
  dryRun: boolean
  report: SigningReport
}

async function write(ctx: Ctx, description: string, fn: () => Promise<void>): Promise<boolean> {
  ctx.report.actions.push(ctx.dryRun ? `[provkörning] ${description}` : description)
  if (ctx.dryRun) return false
  await fn()
  return true
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

// === Hjälpare flyttade från webhooken (oförändrad semantik) ===================

export const parseContractLength = (lengthText: string | null): number => {
  if (!lengthText) return 12 // Default 1 år
  if (/^\d+$/.test(lengthText.trim())) return parseInt(lengthText.trim()) * 12
  const yearMatch = lengthText.match(/(\d+)\s*år/i)
  if (yearMatch) return parseInt(yearMatch[1]) * 12
  const monthMatch = lengthText.match(/(\d+)\s*månad/i)
  if (monthMatch) return parseInt(monthMatch[1])
  return 12
}

export const calculateEndDate = (startDate: string | null, lengthText: string | null): string | null => {
  if (!startDate) return null
  const start = parseLocalDate(startDate)
  start.setMonth(start.getMonth() + parseContractLength(lengthText))
  return toLocalIsoDate(start)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const generateProductSummary = (productGroups: any[] | null): string | null => {
  if (!productGroups || !Array.isArray(productGroups)) return null
  const summaries: string[] = []
  for (const group of productGroups) {
    if (group.products && Array.isArray(group.products)) {
      for (const product of group.products) summaries.push(`${product.quantity?.amount || 1}st ${product.name || 'Okänd produkt'}`)
    } else if (group.name) {
      summaries.push(`${group.quantity?.amount || 1}st ${group.name}`)
    }
  }
  return summaries.length > 0 ? summaries.join(', ') : null
}

const extractServiceDetails = (productGroups: any[] | null): string | null => {
  if (!productGroups || !Array.isArray(productGroups)) return null
  const details: string[] = []
  for (const group of productGroups) {
    if (group.products && Array.isArray(group.products)) {
      for (const product of group.products) if (product.description) details.push(product.description)
    }
  }
  return details.length > 0 ? details.join('. ') : null
}

const detectServiceFrequency = (agreementText: string | null): string | null => {
  const t = agreementText?.toLowerCase() || ''
  if (t.includes('månadsvis') || t.includes('månatlig') || t.includes('varje månad') || t.includes('per månad')) return 'monthly'
  if (t.includes('kvartalsvis') || t.includes('kvartal') || t.includes('var tredje månad')) return 'quarterly'
  if (t.includes('halvårsvis') || t.includes('halvår') || t.includes('var sjätte månad')) return 'biannual'
  if (t.includes('årsvis') || t.includes('årlig') || t.includes('en gång per år')) return 'annual'
  if (t.includes('veckovis') || t.includes('varje vecka')) return 'weekly'
  if (t.includes('varannan vecka')) return 'biweekly'
  if (t.includes('vid behov') || t.includes('efter behov')) return 'on_demand'
  if (t.includes('regelbunden') || t.includes('kontinuerlig')) return 'monthly'
  return null
}

const detectBusinessType = (companyName: string | null, products: any[] | null): string | null => {
  const n = companyName?.toLowerCase() || ''
  if (n.includes('bostadsrättsförening') || n.includes('hsb')) return 'housing_association'
  if (n.includes('restaurang') || n.includes('kök')) return 'restaurant'
  if (n.includes('hotell') || n.includes('logi')) return 'hotel'
  if (n.includes('skola') || n.includes('förskola')) return 'education'
  if (products && Array.isArray(products)) {
    const names = products.map((p) => p.name?.toLowerCase() || '').join(' ')
    if (names.includes('restaurang') || names.includes('kök')) return 'restaurant'
    if (names.includes('hotell') || names.includes('logi')) return 'hotel'
  }
  return 'general'
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const mapToIndustryCategory = (businessType: string | null): string | null => {
  const mapping: Record<string, string> = {
    housing_association: 'residential',
    restaurant: 'commercial',
    hotel: 'commercial',
    education: 'public',
    general: 'commercial',
    private: 'residential',
  }
  return businessType ? mapping[businessType] || 'commercial' : null
}

const calculateCustomerSize = (totalValue: number | null): 'small' | 'medium' | 'large' | null => {
  if (!totalValue) return null
  if (totalValue < 25000) return 'small'
  if (totalValue < 100000) return 'medium'
  return 'large'
}

// Kontrakttyp-mappning baserat på template ID (fallback när avtalets tjänst saknas)
export const getContractTypeName = (templateId: string | null): string | null => {
  const mapping: Record<string, string> = {
    '8486368': 'Skadedjursavtal',
    '8462854': 'Mekaniska fällor',
    '9324573': 'Betesstationer',
    '8465556': 'Betongstationer',
    '8732196': 'Indikationsfällor',
  }
  return templateId ? mapping[templateId] || 'Okänt avtal' : null
}

// === Källärendet ================================================================

type SourceTable = 'private_cases' | 'business_cases' | 'cases'

async function loadSourceCase(db: Db, contract: Row): Promise<{ table: SourceTable; row: Row } | null> {
  const sourceId = str(contract.source_id)
  if (!sourceId) return null
  const st = str(contract.source_type)
  if (st === 'lead' || st === 'manual') return null
  const order: SourceTable[] =
    st === 'private_case' ? ['private_cases'] : st === 'business_case' ? ['business_cases'] : ['cases', 'private_cases', 'business_cases']
  for (const table of order) {
    const { data } = await db.from(table).select('*').eq('id', sourceId).maybeSingle()
    if (data) return { table, row: data as Row }
  }
  return null
}

const caseTypeForTable = (t: SourceTable): string => (t === 'private_cases' ? 'private' : t === 'business_cases' ? 'business' : 'contract')

// === Huvudfunktionen =============================================================

export async function processSignedContract(
  db: Db,
  ref: { contractId?: string | null; oneflowContractId?: string | null },
  opts: SigningOptions = {}
): Promise<SigningReport> {
  const report: SigningReport = {
    contractId: ref.contractId ?? null,
    oneflowContractId: ref.oneflowContractId ?? null,
    ourChain: false,
    dryRun: !!opts.dryRun,
    customerId: null,
    customerCreated: false,
    invoicesCreated: 0,
    actions: [],
    notes: [],
  }
  const ctx: Ctx = { db, dryRun: !!opts.dryRun, report }

  let q = db.from('contracts').select('*')
  q = ref.contractId ? q.eq('id', ref.contractId) : q.eq('oneflow_contract_id', ref.oneflowContractId ?? '')
  const { data: loaded } = await q.maybeSingle()
  if (!loaded) {
    report.skipped = 'Avtalet finns inte i databasen'
    return report
  }
  const contract = { ...(loaded as Row) }
  report.contractId = str(contract.id)
  report.oneflowContractId = str(contract.oneflow_contract_id)

  // Endast signerade AVTAL. 'active' räknas: triggern contract_signed_becomes_active
  // byter signed → active direkt när startdagen redan passerat.
  if (contract.type !== 'contract' || !isSignedContractStatus(str(contract.status))) {
    report.skipped = `Inte ett signerat avtal (typ ${str(contract.type)}, status ${str(contract.status)})`
    return report
  }

  const contractId = String(contract.id)
  const ourChain = isOurChainContract({ created_by_email: str(contract.created_by_email) })
  report.ourChain = ourChain
  const source = await loadSourceCase(db, contract)

  // --- F: org/personnummer ---
  const sentNumber =
    str(contract.sent_organization_number) ??
    (source ? str(source.row.personnummer) ?? str(source.row.org_nr) : null)
  const identity = compareIdentityNumbers(sentNumber, str(contract.organization_number))
  if (identity.message) report.notes.push(identity.message)
  if (identity.keep && identity.keep !== str(contract.organization_number)) {
    await write(ctx, `Org/personnummer på avtalet sätts till ${identity.keep} (vårt nummer)`, async () => {
      must(await db.from('contracts').update({ organization_number: identity.keep }).eq('id', contractId), 'Org.nr')
    })
    contract.organization_number = identity.keep
  }

  const individual = isIndividualParty({
    oneflowPartyType: opts.oneflowPartyType ?? null,
    sourceType: str(contract.source_type),
    organizationNumber: sentNumber ?? str(contract.organization_number),
  })

  // --- G: avtalstypen ur avtalets tjänst (vår kedja) ---
  let typeName: string | null = null
  let contractRows: Row[] = []
  const loadContractRows = async () => {
    const { data } = await db
      .from('case_billing_items')
      .select('id, service_id, service_code, service_name, article_name, quantity, unit_price, total_price, vat_rate, discount_percent, rot_rut_type, fastighetsbeteckning, billing_model, billing_start_date, is_premium_carrier, premium_share, status, customer_id, article_id, article_code')
      .eq('case_id', contractId)
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    contractRows = (data ?? []) as Row[]
  }
  await loadContractRows()

  const { data: serviceRows } = await db
    .from('services')
    .select('id, name, code')
    .eq('is_contract_service', true)
    .eq('is_active', true)
  const contractServices = (serviceRows ?? []) as ContractServiceCandidate[]
  const premiumRowsOf = () => contractRows.filter((r) => (str(r.billing_model) ?? 'premium') === 'premium')

  const pick = pickContractService(
    premiumRowsOf().map((r) => ({ id: String(r.id), service_id: str(r.service_id), service_name: str(r.service_name), total_price: num(r.total_price) })),
    contractServices
  )
  if (pick) typeName = pick.service.name

  if (ourChain && pick) {
    const row = contractRows.find((r) => r.id === pick.row.id)!
    if (!str(row.service_id)) {
      await write(ctx, `Avtalets tjänsterad "${pick.service.name}" kopplas till tjänsten i katalogen`, async () => {
        must(
          await db.from('case_billing_items').update({ service_id: pick.service.id, service_code: pick.service.code }).eq('id', String(row.id)),
          'Tjänsterad'
        )
      })
      row.service_id = pick.service.id
      row.service_code = pick.service.code
    }
    const currentType = str(contract.contract_type)
    const isCatalogName = !!currentType && contractServices.some((s) => s.name.toLowerCase() === currentType.toLowerCase())
    if (!isCatalogName) {
      // Triggern trg_contracts_ensure_carrier gör raden med samma tjänst till bärande rad
      await write(ctx, `Avtalstypen sätts till "${pick.service.name}"${currentType ? ` (var "${currentType}", mallens namn)` : ''}`, async () => {
        const upd: Record<string, unknown> = { contract_type: pick.service.name }
        if (!str(contract.label)) upd.label = pick.service.name
        must(await db.from('contracts').update(upd).eq('id', contractId), 'Avtalstyp')
      })
      contract.contract_type = pick.service.name
      if (!str(contract.label)) contract.label = pick.service.name
      if (ctx.dryRun) {
        // Simulera triggern: raden med avtalstjänsten blir bärande
        if (!contractRows.some((r) => r.is_premium_carrier)) row.is_premium_carrier = true
      } else {
        await loadContractRows()
      }
    } else if (!contractRows.some((r) => r.is_premium_carrier)) {
      // Typen stod redan rätt men raden saknade tjänst: tvinga triggern
      await write(ctx, 'Bärande § 4-rad säkerställs (ensure_contract_carrier_row)', async () => {
        must(await db.rpc('ensure_contract_carrier_row', { p_contract_id: contractId }), 'Bärande rad')
      })
      if (ctx.dryRun) row.is_premium_carrier = true
      else await loadContractRows()
    }
  } else if (ourChain && !pick) {
    report.notes.push('Avtalstypen kunde inte härledas ur avtalets tjänster. Välj avtalstyp i kartan.')
  }

  // --- D: avtalsfälten och premien ---
  // Priset i Oneflow är alltid exkl. moms (beslut 2026-10-19): beloppet är premien
  const premium = premiumExclVatFromOneflow(num(contract.total_value))
  const startDate = str(contract.contract_start_date) ?? str(contract.start_date)
  const lockedInvoices = await hasLockedInvoices(db, contractId)
  {
    const updates: Record<string, unknown> = {}
    const currentAnnual = num(contract.annual_value)
    // Saknas premien sätts den till Oneflow-beloppet, annars lämnas den
    if (premium && currentAnnual == null) {
      updates.annual_value = premium
    }
    const months = parseContractLength(str(contract.contract_length))
    const effectivePremium = (updates.annual_value as number | undefined) ?? currentAnnual ?? premium
    if (num(contract.total_contract_value) == null && effectivePremium && effectivePremium > 0) {
      updates.total_contract_value = months >= 12 ? Math.round(effectivePremium * (months / 12)) : Math.round(effectivePremium)
    }
    if (!str(contract.contract_start_date) && str(contract.start_date)) updates.contract_start_date = str(contract.start_date)
    const endDate = calculateEndDate(str(contract.start_date) ?? str(contract.contract_start_date), str(contract.contract_length))
    if (!str(contract.contract_end_date) && endDate) updates.contract_end_date = endDate
    if (!str(contract.signed_at)) updates.signed_at = toLocalIsoDate(todayLocal())
    if (!typeName) {
      const fromTemplate = getContractTypeName(str(contract.template_id))
      if (fromTemplate && fromTemplate !== 'Okänt avtal') typeName = fromTemplate
    }
    if (!str(contract.contract_type) && typeName) updates.contract_type = typeName
    if (!str(contract.label) && typeName) updates.label = typeName

    if (Object.keys(updates).length > 0) {
      await write(ctx, `Avtalsfält kompletteras: ${Object.entries(updates).map(([k, v]) => `${k} = ${v}`).join(', ')}`, async () => {
        must(await db.from('contracts').update(updates).eq('id', contractId), 'Avtalsfält')
      })
      Object.assign(contract, updates)
    }

    // Premietrappans startpunkt
    const annual = num(contract.annual_value)
    if (annual && annual > 0 && startDate) {
      const { data: events } = await db.from('contract_premium_events').select('id, annual_value, event_type, source').eq('contract_id', contractId)
      const list = (events ?? []) as Row[]
      if (list.length === 0) {
        await write(ctx, `Premietrappans start ${startDate}: ${kr(annual)}`, async () => {
          must(
            await db.from('contract_premium_events').insert({
              contract_id: contractId,
              effective_from: startDate,
              annual_value: annual,
              event_type: 'start',
              source: 'oneflow',
              note: 'Avtalet signerat via Oneflow',
            }),
            'Premietrappa'
          )
        })
      } else if (list.length === 1 && list[0].event_type === 'start' && list[0].source === 'oneflow' && Math.abs(Number(list[0].annual_value) - annual) >= 0.5 && !lockedInvoices) {
        await write(ctx, `Premietrappans start rättas från ${kr(Number(list[0].annual_value))} till ${kr(annual)}`, async () => {
          must(await db.from('contract_premium_events').update({ annual_value: annual }).eq('id', String(list[0].id)), 'Premietrappa')
        })
      }
    }
  }

  // --- D: tjänsteraderna rättas mot premien (vår kedja) ---
  const annualNow = num(contract.annual_value)
  if (ourChain && annualNow && annualNow > 0) {
    const rows = premiumRowsOf()
    const correction = correctPremiumRows(
      rows.map((r) => ({
        id: String(r.id),
        quantity: num(r.quantity),
        unit_price: num(r.unit_price),
        total_price: num(r.total_price),
        is_premium_carrier: !!r.is_premium_carrier,
        premium_share: num(r.premium_share),
        discount_percent: num(r.discount_percent),
      })) as PremiumRow[],
      annualNow
    )
    if (correction.deviated) {
      report.notes.push(
        `Avtalets tjänsterader summerade ${kr(correction.before)} men Oneflow-avtalet ger ${kr(correction.premium)} exkl. moms. Raderna är rättade efter Oneflow.`
      )
    }
    for (const u of correction.updates) {
      const { id, ...fields } = u
      await write(ctx, `Tjänsterad ${id} rättas: ${Object.entries(fields).map(([k, v]) => `${k} = ${v}`).join(', ')}`, async () => {
        must(await db.from('case_billing_items').update(fields).eq('id', id), 'Tjänsterad')
      })
      const row = contractRows.find((r) => r.id === id)
      if (row) Object.assign(row, fields)
    }
  }

  // --- A: kund ---
  const customer = await createOrLinkCustomer(ctx, contract, { individual, typeName })
  report.customerId = customer.customerId
  report.customerCreated = customer.created
  if (customer.customerId && ourChain) {
    const missingCustomer = contractRows.filter((r) => !str(r.customer_id)).map((r) => String(r.id))
    if (missingCustomer.length > 0) {
      await write(ctx, `Avtalets ${missingCustomer.length} tjänsterad(er) kopplas till kunden`, async () => {
        must(await db.from('case_billing_items').update({ customer_id: customer.customerId }).in('id', missingCustomer), 'Kundkoppling rader')
      })
    }
  }

  // --- G: avtalskartan (vår kedja) ---
  if (ourChain && customer.customerId) {
    await setUpContractMap(ctx, contract, customer.customerId)
  }

  // --- B/E: källärendet ---
  if (source) {
    await handleSourceCase(ctx, contract, source)
  }

  // --- G: fakturaplanen (vår kedja) ---
  if (ourChain && customer.customerId) {
    await planInvoices(ctx, contract, customer.customerId, contractRows)
  }

  // --- A: notis ---
  if (customer.customerId) {
    await notifyInvoiceApprovers(ctx, contract, customer.customerId)
  }

  return report
}

async function hasLockedInvoices(db: Db, contractId: string): Promise<boolean> {
  const { data } = await db
    .from('invoices')
    .select('id')
    .eq('contract_id', contractId)
    .in('status', ['booked', 'sent', 'paid'])
    .limit(1)
  return (data ?? []).length > 0
}

// === A: kund ======================================================================

async function createOrLinkCustomer(
  ctx: Ctx,
  contract: Row,
  info: { individual: boolean; typeName: string | null }
): Promise<{ customerId: string | null; created: boolean }> {
  const { db, report } = ctx
  const contractId = String(contract.id)
  const oneflowId = str(contract.oneflow_contract_id)

  // Fakturavägen sätts automatiskt ur avtalets fakturafält (beslut 2026-10-22):
  // e-post i fältet → e-post, adress → brev, inget → kontaktpersonens e-post
  // (src/shared/invoiceDelivery.ts). Ändras vid behov på kundsidan.
  const delivery = deriveDeliveryFromContract({
    billingText: str(contract.billing_email) ?? str(contract.billing_address),
    contactEmail: str(contract.contact_email),
    companyName: str(contract.company_name),
  })

  if (str(contract.customer_id)) {
    // Org.nr är kundens identitet (beslut 2026-10-28): skiljer sig det signerade
    // numret från den kopplade kundens (enhet utan eget: huvudkontorets) släpps
    // kopplingen och avtalet matchas som utan vald kund, på det nya numret.
    // Urvalet av enheter hörde till den gamla kunden och följer inte med.
    const kopplatId = String(contract.customer_id)
    const { data: kopplad } = await db
      .from('customers')
      .select('id, company_name, customer_number, organization_number, parent_customer_id')
      .eq('id', kopplatId)
      .maybeSingle()
    const k = kopplad as Row | null
    let foralderNr: string | null = null
    if (k && str(k.parent_customer_id) && !str(k.organization_number)) {
      const { data: hk } = await db.from('customers').select('organization_number').eq('id', String(k.parent_customer_id)).maybeSingle()
      foralderNr = str((hk as Row | null)?.organization_number)
    }
    const kundensNr = k ? kundensIdNummer({ organization_number: str(k.organization_number) }, { organization_number: foralderNr }) : null
    const signeratNr = str(contract.organization_number)
    if (k && jamforIdNummer(signeratNr, kundensNr) === 'annat') {
      const namn = str(k.company_name) ?? 'kunden'
      const nr = k.customer_number != null ? `, kundnr ${String(k.customer_number)}` : ''
      const ord = info.individual ? 'personnumret' : 'org.nr'
      report.notes.push(
        `Avtalet var kopplat till ${namn}${nr} (${ord} ${kundensNr}) men signerades med ${ord} ${signeratNr}. Kopplingen släpptes och avtalet matchades på det signerade numret. Kontrollera kunden och avtalskartan.`
      )
      console.warn(`[contractSigning] Avtal ${contractId}: signerat ${ord} stämmer inte med kopplad kund ${kopplatId}, kopplingen släpps`)
      await write(ctx, `Kopplingen till kund ${kopplatId} släpps: signerat ${ord} skiljer sig från kundkortet`, async () => {
        must(
          await db.from('contracts').update({ customer_id: null, site_ids: null, covers_all_sites: false }).eq('id', contractId),
          'Släpp kundkoppling'
        )
      })
      contract.customer_id = null
      contract.site_ids = null
      contract.covers_all_sites = false
    } else {
      // Kopplad redan (wizarden valde kunden): avtalet sätter vägen om den saknas
      await applyDeliveryToExisting(ctx, kopplatId, delivery)
      return { customerId: kopplatId, created: false }
    }
  }
  const companyName = str(contract.company_name)
  const email = str(contract.contact_email)
  if (!email || !companyName) {
    report.notes.push('Ingen kund skapades: avtalet saknar kontaktens e-post eller kundnamn.')
    return { customerId: null, created: false }
  }

  // Befintlig kund: Oneflow-id → org/personnummer (alla skrivsätt) → e-post
  let existingId: string | null = null
  let matchedBy = ''
  if (oneflowId) {
    const { data } = await db.from('customers').select('id').eq('oneflow_contract_id', oneflowId).limit(1).maybeSingle()
    if (data) {
      existingId = String((data as Row).id)
      matchedBy = 'Oneflow-id'
    }
  }
  const variants = identityNumberVariants(str(contract.organization_number))
  if (!existingId && variants.length > 0) {
    // Org.nr är inte unikt (multisite-enheter delar bolag): huvudkontor först, sedan äldst
    const { data } = await db
      .from('customers')
      .select('id, site_type')
      .in('organization_number', variants)
      .order('created_at', { ascending: true })
      .limit(10)
    const rows = (data ?? []) as Row[]
    const preferred = rows.find((c) => c.site_type === 'huvudkontor') ?? rows[0]
    if (preferred) {
      existingId = String(preferred.id)
      matchedBy = 'org/personnummer'
    }
  }
  if (!existingId) {
    const { data } = await db.from('customers').select('id').eq('contact_email', email).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (data) {
      existingId = String((data as Row).id)
      matchedBy = 'e-post'
    }
  }

  const groupId = str(contract.customer_group_id)
  // Kundgruppen från avtalswizarden sätts på kunden, men inget nummer: det
  // ges av Fortnox första gången ett utkast skickas (allocate-customer).
  // Ett nummer som bara reserveras i portalen kan Fortnox ge till någon
  // annan (10524, 2026-10-19).
  const assignGroup = async (customerId: string) => {
    if (!groupId) return
    const { data: cust } = await db.from('customers').select('customer_group_id').eq('id', customerId).maybeSingle()
    if (cust && (cust as Row).customer_group_id) return
    await write(ctx, 'Kundgruppen från avtalet sätts på kunden', async () => {
      must(await db.from('customers').update({ customer_group_id: groupId }).eq('id', customerId), 'Kundgrupp')
    })
  }

  if (existingId) {
    const id = existingId
    await write(ctx, `Avtalet kopplas till befintlig kund ${id} (matchad på ${matchedBy})`, async () => {
      must(await db.from('contracts').update({ customer_id: id }).eq('id', contractId), 'Kundkoppling')
    })
    contract.customer_id = id
    await assignGroup(id)
    await applyDeliveryToExisting(ctx, id, delivery)
    return { customerId: id, created: false }
  }

  // Ny kund
  const annualValue = num(contract.annual_value)
  const months = parseContractLength(str(contract.contract_length))
  const totalContractValue = annualValue && annualValue > 0 ? (months >= 12 ? Math.round(annualValue * (months / 12)) : Math.round(annualValue)) : null
  const businessType = info.individual ? 'private' : detectBusinessType(companyName, contract.selected_products as unknown[] | null)
  const customerData = {
    company_name: companyName,
    organization_number: str(contract.organization_number),
    contact_person: str(contract.contact_person),
    contact_email: email,
    contact_phone: str(contract.contact_phone),
    contact_address: str(contract.contact_address),
    billing_email: delivery?.billingEmail ?? null,
    billing_address: delivery?.billingAddress ?? str(contract.contact_address),
    invoice_delivery_method: delivery?.method ?? null,
    invoice_delivery_source: delivery ? ('kund' as const) : null,
    invoice_delivery_confirmed_at: delivery ? new Date().toISOString() : null,
    invoice_delivery_confirmed_by_name: delivery?.reason ?? null,
    oneflow_contract_id: oneflowId,
    created_from_contract_id: contractId,
    contract_template_id: str(contract.template_id),
    contract_type: info.typeName ?? getContractTypeName(str(contract.template_id)),
    contract_status: 'signed' as const,
    contract_length: str(contract.contract_length),
    contract_start_date: str(contract.contract_start_date) ?? str(contract.start_date),
    contract_end_date: str(contract.contract_end_date) ?? calculateEndDate(str(contract.start_date), str(contract.contract_length)),
    total_contract_value: totalContractValue,
    annual_value: annualValue,
    monthly_value: annualValue ? annualValue / 12 : null,
    currency: 'SEK',
    agreement_text: str(contract.agreement_text),
    products: contract.selected_products ?? null,
    product_summary: generateProductSummary(contract.selected_products as unknown[] | null),
    service_details: extractServiceDetails(contract.selected_products as unknown[] | null),
    assigned_account_manager: str(contract.begone_employee_name),
    account_manager_email: str(contract.begone_employee_email),
    sales_person: str(contract.created_by_name) ?? str(contract.begone_employee_name),
    sales_person_email: str(contract.created_by_email) ?? str(contract.begone_employee_email),
    business_type: businessType,
    industry_category: mapToIndustryCategory(businessType),
    customer_size: calculateCustomerSize(totalContractValue),
    service_frequency: detectServiceFrequency(str(contract.agreement_text)),
    price_list_id: str(contract.price_list_id),
    source_type: 'oneflow' as const,
    is_active: true,
  }

  let newId: string | null = null
  await write(ctx, `Ny kund skapas: ${companyName}`, async () => {
    const { data, error } = await db.from('customers').insert([customerData]).select('id').single()
    if (error || !data) throw new Error(`Kund: ${error?.message ?? 'okänt fel'}`)
    newId = String((data as Row).id)
    must(await db.from('contracts').update({ customer_id: newId }).eq('id', contractId), 'Kundkoppling')
  })
  if (!delivery) {
    report.notes.push('Avtalet saknar fakturauppgift och kontaktpersonen saknar e-post. Ange fakturavägen på kundsidan under fliken Fakturering.')
  }
  if (!newId) return { customerId: ctx.dryRun ? '(ny kund)' : null, created: ctx.dryRun }
  contract.customer_id = newId
  await assignGroup(newId)
  return { customerId: newId, created: true }
}

/**
 * Befintlig kund utan fakturaväg: avtalet sätter den. En väg som redan finns
 * (ändrad för hand, från Fortnox-kortet eller tidigare) skrivs aldrig över.
 */
async function applyDeliveryToExisting(ctx: Ctx, customerId: string, delivery: DerivedDelivery | null): Promise<void> {
  const { db, report } = ctx
  const { data } = await db
    .from('customers')
    .select('invoice_delivery_method')
    .eq('id', customerId)
    .maybeSingle()
  const cust = data as Row | null
  if (!cust || str(cust.invoice_delivery_method)) return
  if (!delivery) {
    report.notes.push('Avtalet saknar fakturauppgift och kontaktpersonen saknar e-post. Ange fakturavägen på kundsidan under fliken Fakturering.')
    return
  }
  const update: Record<string, unknown> = {
    invoice_delivery_method: delivery.method,
    invoice_delivery_source: 'kund',
    invoice_delivery_confirmed_at: new Date().toISOString(),
    invoice_delivery_confirmed_by_name: delivery.reason,
  }
  if (delivery.billingEmail) update.billing_email = delivery.billingEmail
  if (delivery.billingAddress) update.billing_address = delivery.billingAddress
  await write(ctx, `Fakturaväg ur avtalet: ${delivery.method === 'print' ? `brev till ${delivery.billingAddress}` : `e-post till ${delivery.billingEmail}`} (${delivery.reason})`, async () => {
    must(await db.from('customers').update(update).eq('id', customerId), 'Fakturaväg')
  })
}

// === G: avtalskartan ================================================================

async function setUpContractMap(ctx: Ctx, contract: Row, customerId: string): Promise<void> {
  const { db, report } = ctx
  const contractId = String(contract.id)
  const startDate = str(contract.contract_start_date) ?? str(contract.start_date)
  const isNewCustomer = customerId === '(ny kund)'

  // Omfattning (§ 1). Finns redan rader görs ingenting (omkörning, eller
  // omfattning som ändrats för hand). Valde guiden enheter (contracts.site_ids)
  // skrivs de, annars kundens egen rad om kunden inte har enheter.
  if (!contract.covers_all_sites) {
    const { data: scope } = await db.from('contract_sites').select('id').eq('contract_id', contractId).limit(1)
    const valda = Array.isArray(contract.site_ids) ? (contract.site_ids as unknown[]).filter((v): v is string => typeof v === 'string') : []
    if ((scope ?? []).length === 0 && valda.length > 0 && !isNewCustomer) {
      // Kontrolleras igen mot registret: bara kundens egen rad och dess aktiva enheter
      const { data: rader } = await db.from('customers').select('id, is_active, parent_customer_id').in('id', valda)
      const giltiga = ((rader ?? []) as Row[])
        .filter((r) => valideraKundOchOmfattning({ id: customerId }, { siteIds: [String(r.id)] }, [r as unknown as KopplingsKund], true).ok)
        .map((r) => String(r.id))
      const borta = valda.length - giltiga.length
      if (borta > 0) report.notes.push(`${borta} av enheterna som valdes i guiden hör inte längre till kunden eller är inaktiva och togs inte med i § 1.`)
      if (giltiga.length > 0) {
        await write(ctx, `Omfattning (§ 1): ${giltiga.length} kundrad(er) som valdes i guiden, från ${startDate ?? 'startdatum saknas'}`, async () => {
          must(
            await db.from('contract_sites').insert(giltiga.map((id) => ({ contract_id: contractId, customer_id: id, active_from: startDate }))),
            'Omfattning'
          )
        })
      } else {
        report.notes.push('Välj vilka enheter avtalet omfattar i § 1.')
      }
    } else if ((scope ?? []).length === 0) {
      const { data: units } = isNewCustomer
        ? { data: [] as Row[] }
        : await db.from('customers').select('id').eq('parent_customer_id', customerId).limit(1)
      if ((units ?? []).length > 0) {
        report.notes.push('Kunden har enheter: välj vilka enheter avtalet omfattar i § 1.')
      } else {
        await write(ctx, `Omfattning (§ 1): kundens egen lokal från ${startDate ?? 'startdatum saknas'}`, async () => {
          must(
            await db.from('contract_sites').insert({ contract_id: contractId, customer_id: customerId, active_from: startDate }),
            'Omfattning'
          )
        })
      }
    }
  }

  // Fakturering och löptid
  const setup = deriveMapSetup({
    contract_start_date: str(contract.contract_start_date),
    start_date: str(contract.start_date),
    billing_frequency: str(contract.billing_frequency),
    billing_anchor_month: num(contract.billing_anchor_month),
    notice_period_months: num(contract.notice_period_months),
    visits_per_year: num(contract.visits_per_year),
    visit_frequency: str(contract.visit_frequency),
  })
  if (setup.updates.billing_anchor_month) {
    const m = setup.updates.billing_anchor_month
    await write(ctx, `Fakturamånad sätts till startmånaden (${m})`, async () => {
      must(await db.from('contracts').update({ billing_anchor_month: m }).eq('id', contractId), 'Fakturamånad')
    })
    contract.billing_anchor_month = m
  }
  if (setup.missing.length > 0) report.notes.push(`Ej satt automatiskt: ${setup.missing.join(', ')}.`)
}

// === B/E: källärendet ================================================================

async function handleSourceCase(ctx: Ctx, contract: Row, source: { table: SourceTable; row: Row }): Promise<void> {
  const { db, report } = ctx
  const caseId = String(source.row.id)
  const oneflowId = str(contract.oneflow_contract_id)
  const current = str(source.row.status)

  // B: status "Avtal signerat - Etablera". Bara från dokumentsteget eller ett
  // öppet ärende: en omkörning skriver aldrig över en bokning eller ett avslut.
  if (current !== CONTRACT_SIGNED_STATUS && (isDocumentSentStatus(current) || current === 'Öppen' || !current)) {
    const update: Record<string, unknown> =
      source.table === 'cases'
        ? { status: CONTRACT_SIGNED_STATUS, oneflow_contract_id: oneflowId, quote_status: 'signed', quote_signed_at: new Date().toISOString() }
        : { status: CONTRACT_SIGNED_STATUS, oneflow_contract_id: oneflowId, start_date: null, due_date: null }
    await write(ctx, `Ärendet ${str(source.row.case_number) ?? caseId} får status "${CONTRACT_SIGNED_STATUS}" (var "${current ?? 'tom'}")`, async () => {
      must(await db.from(source.table).update(update).eq('id', caseId), 'Ärendestatus')
    })
  } else if (current !== CONTRACT_SIGNED_STATUS) {
    report.notes.push(`Ärendet ${str(source.row.case_number) ?? caseId} står som "${current}" och ändrades inte.`)
  }

  // E: ärendets avtalsrad(er) tas ur engångsfaktureringen
  const caseType = caseTypeForTable(source.table)
  const [{ data: sourceRows }, { data: contractRows }] = await Promise.all([
    db
      .from('case_billing_items')
      .select('id, item_type, status, service_id, service_name, mapped_service_id, labor_for_item_id, total_price, notes')
      .eq('case_id', caseId)
      .eq('case_type', caseType),
    db
      .from('case_billing_items')
      .select('service_id, service_name')
      .eq('case_id', String(contract.id))
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .neq('status', 'cancelled'),
  ])
  const picked = selectSourceRowsCoveredByContract((sourceRows ?? []) as unknown as SourceCaseRow[], (contractRows ?? []) as Array<{ service_id: string | null; service_name: string | null }>)
  if (picked.ids.length === 0) return
  const byId = new Map(((sourceRows ?? []) as Row[]).map((r) => [String(r.id), r]))
  const sum = picked.ids.reduce((s, id) => s + Number(byId.get(id)?.total_price ?? 0), 0)
  const note = `Ingår i avtalet (Oneflow ${oneflowId ?? '?'}), faktureras via avtalet och aldrig som engångstjänst.`
  await write(
    ctx,
    `${picked.ids.length} rad(er) på ärendet (${kr(sum)}) tas ur engångsfaktureringen: status cancelled, covered_by_contract = true`,
    async () => {
      for (const id of picked.ids) {
        const prev = str(byId.get(id)?.notes)
        must(
          await db
            .from('case_billing_items')
            .update({ status: 'cancelled', covered_by_contract: true, notes: prev ? `${prev}\n${note}` : note })
            .eq('id', id),
          'Ärendets rader'
        )
      }
    }
  )
  if (picked.looseArticles > 0) {
    report.notes.push(`${picked.looseArticles} artikelrad(er) utan tjänst på ärendet togs också ur engångsfaktureringen. Kontrollera ärendet.`)
  }
}

// === G: fakturaplanen ==================================================================

async function planInvoices(ctx: Ctx, contract: Row, customerId: string, contractRows: Row[]): Promise<void> {
  const { db, report } = ctx
  const contractId = String(contract.id)
  if (contract.billing_active === false) return
  const freq = str(contract.billing_frequency)
  const annual = num(contract.annual_value)
  if (!freq || freq === 'on_demand' || !annual || annual <= 0) {
    report.notes.push('Fakturaplanen är inte gjord: premie eller faktureringsintervall saknas. Klicka Planera fakturor när kartan är klar.')
    return
  }
  const isNewCustomer = customerId === '(ny kund)'

  // Samlad faktura (gemet) med flera avtal: planeras i kartan, aldrig här
  if (!isNewCustomer) {
    const { data: cust } = await db.from('customers').select('contract_invoice_mode').eq('id', customerId).maybeSingle()
    if (str((cust as Row | null)?.contract_invoice_mode) === 'consolidated') {
      const { data: others } = await db
        .from('contracts')
        .select('id')
        .eq('customer_id', customerId)
        .eq('type', 'contract')
        .in('status', ['signed', 'active'])
        .neq('id', contractId)
        .limit(1)
      if ((others ?? []).length > 0) {
        report.notes.push('Kunden har samlad faktura för flera avtal: fakturaplanen görs med Planera fakturor i kartan.')
        return
      }
    }
  }

  const [{ data: stepRows }, { data: terms }] = await Promise.all([
    db.from('contract_premium_events').select('effective_from, annual_value, event_type, note').eq('contract_id', contractId),
    db.from('payment_terms_settings').select('days_until_due').eq('category', 'contract').maybeSingle(),
  ])
  let steps: PremiumStep[] = ((stepRows ?? []) as Row[]).map((s) => ({ effective_from: String(s.effective_from), annual_value: Number(s.annual_value) }))
  if (ctx.dryRun && steps.length <= 1) {
    // Provkörning: startsteget som det blir efter stegen ovan (inget har skrivits)
    const start = str(contract.contract_start_date) ?? str(contract.start_date)
    steps = start ? [{ effective_from: start, annual_value: annual }] : steps
  }
  const additionNotes = ((stepRows ?? []) as Row[])
    .filter((s) => s.event_type === 'addition' && !!s.note)
    .map((s) => ({ effective_from: String(s.effective_from), note: String(s.note) }))
  const paymentTermsDays = Number((terms as Row | null)?.days_until_due ?? 30) || 30

  const premiumItems: ContractServiceItem[] = contractRows
    .filter((r) => (str(r.billing_model) ?? 'premium') === 'premium')
    .map((s) => ({
      case_billing_item_id: String(s.id),
      article_id: str(s.article_id),
      display_code: str(s.service_code) ?? str(s.article_code),
      display_name: str(s.service_name) ?? str(s.article_name) ?? 'Avtalstjänst',
      quantity: Number(s.quantity ?? 1),
      unit_price: Number(s.unit_price ?? 0),
      total_price: Number(s.total_price ?? 0),
      vat_rate: Number(s.vat_rate ?? 25),
      discount_percent: Number(s.discount_percent ?? 0),
      rot_rut_type: str(s.rot_rut_type),
      fastighetsbeteckning: str(s.fastighetsbeteckning),
      is_premium_carrier: !!s.is_premium_carrier,
      premium_share: num(s.premium_share),
    }))
  const equipmentRows = contractRows.filter((r) => r.billing_model === 'per_year' || r.billing_model === 'per_month')
  if (equipmentRows.length > 0) {
    report.notes.push('Avtalet har tilläggsrader per år eller månad: deras fakturor planeras med Planera fakturor i kartan.')
  }
  const equipment: EquipmentLine[] = []
  const label = str(contract.display_name)?.trim() || str(contract.label) || str(contract.contract_type)

  const planning: PlanningContract = {
    annual_value: annual,
    contract_start_date: str(contract.contract_start_date) ?? str(contract.start_date),
    contract_end_date: str(contract.contract_end_date),
    terminated_at: str(contract.terminated_at),
    billing_frequency: freq,
    billing_anchor_month: num(contract.billing_anchor_month),
    billing_active: contract.billing_active === false ? false : null,
    notice_period_months: num(contract.notice_period_months),
    renewal_mode: str(contract.renewal_mode),
  }
  // Samma anrop som ContractInvoiceGenerator.planForContract: hela den
  // nuvarande bindningstiden planeras direkt. Förlängningen efter
  // slutdatumet skapas av cronen dagen efter sista uppsägningsdag.
  const periods = computePlannedPeriods(planning, {
    paymentTermsDays,
    steps,
    equipment,
    leadDays: DEFAULT_INVOICE_LEAD_DAYS,
    equipmentMode: 'separate',
    window: 'binding',
  })
  if (periods.length === 0) {
    report.notes.push('Fakturaplanen gav inga perioder (kontrollera startdatum, slutdatum och intervall).')
    return
  }

  // Befintliga fakturor: samma täckningsregel som planeraren (månadsnyckel per avtal,
  // samlingsfakturor med rad för avtalet, Fortnox-importer som täcker minst halva perioden)
  const covered = new Set<string>()
  const fortnoxRanges: Array<{ start: string; end: string }> = []
  if (!isNewCustomer) {
    const { data: invoices } = await db
      .from('invoices')
      .select('id, invoice_number, invoice_type, is_historical, is_consolidated, contract_id, contract_invoice_kind, billing_period_start, billing_period_end, invoice_items(contract_id)')
      .eq('customer_id', customerId)
      .in('invoice_type', ['contract', 'adhoc'])
      .neq('status', 'cancelled')
    for (const inv of (invoices ?? []) as Row[]) {
      const start = str(inv.billing_period_start)
      if (!start) continue
      if ((str(inv.contract_invoice_kind) ?? 'premium') !== 'premium') continue
      const number = str(inv.invoice_number) ?? ''
      if (inv.is_historical && number.startsWith('F-') && str(inv.billing_period_end)) {
        fortnoxRanges.push({ start, end: String(inv.billing_period_end) })
        continue
      }
      if (inv.invoice_type !== 'contract') continue
      const items = (inv.invoice_items ?? []) as Row[]
      const mine =
        inv.contract_id === contractId ||
        (!inv.contract_id && !inv.is_consolidated) ||
        (!!inv.is_consolidated && items.some((it) => it.contract_id === contractId))
      if (mine) covered.add(start.slice(0, 7))
    }
  }
  const overlapShare = (p: PlannedPeriod, r: { start: string; end: string }) => {
    const ps = parseLocalDate(p.periodStart).getTime()
    const pe = parseLocalDate(p.periodEnd).getTime()
    const os = Math.max(ps, parseLocalDate(r.start).getTime())
    const oe = Math.min(pe, parseLocalDate(r.end).getTime())
    if (oe < os || pe <= ps) return 0
    return (oe - os) / (pe - ps)
  }

  const sources = { premiumItems, equipment, additionNotes, label, diaryNumber: str(contract.diary_number) }
  const { data: customerRow } = isNewCustomer ? { data: null } : await db.from('customers').select('*').eq('id', customerId).maybeSingle()
  const cust = (customerRow ?? {
    company_name: contract.company_name,
    organization_number: contract.organization_number,
    contact_email: contract.contact_email,
    billing_email: contract.billing_email ?? contract.contact_email,
    contact_phone: contract.contact_phone,
    contact_address: contract.contact_address,
    billing_address: contract.billing_address ?? contract.contact_address,
    billing_reference: null,
    parent_customer_id: null,
  }) as Row
  let orgNr = str(cust.organization_number)
  if (!orgNr && str(cust.parent_customer_id)) {
    const { data: parent } = await db.from('customers').select('organization_number').eq('id', String(cust.parent_customer_id)).maybeSingle()
    orgNr = str((parent as Row | null)?.organization_number)
  }

  for (const p of periods) {
    const key = p.periodStart.slice(0, 7)
    if (covered.has(key)) continue
    if (fortnoxRanges.some((r) => overlapShare(p, r) >= 0.5)) continue
    if (p.isHistorical) {
      report.notes.push(`Perioden ${p.periodStart} t.o.m. ${p.periodEnd} har redan passerat utan faktura. Koppla Fortnox-fakturan eller planera den i kartan.`)
      continue
    }

    const rows = buildContractInvoiceRows(contractId, sources, p)
    if (rows.length === 0) continue
    const totals = invoiceTotals(rows)
    const notes = buildContractInvoiceNotes(p, label, str(contract.diary_number))
    const created = await write(
      ctx,
      `Faktura (utkast, väntar på godkännande) för ${p.periodStart} t.o.m. ${p.periodEnd}: ${kr(totals.subtotal)} exkl. moms, fakturadatum ${p.invoiceDate}`,
      async () => {
        const now = new Date()
        const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
        const { data: highest } = await db
          .from('invoices')
          .select('invoice_number')
          .like('invoice_number', `${prefix}-%`)
          .order('invoice_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        const invoiceNumber = nextInvoiceNumber(prefix, str((highest as Row | null)?.invoice_number))
        const { data: inv, error } = await db
          .from('invoices')
          .insert({
            invoice_number: invoiceNumber,
            invoice_type: 'contract',
            customer_id: customerId,
            contract_id: contractId,
            is_consolidated: false,
            contract_invoice_kind: 'premium',
            case_id: null,
            case_type: null,
            customer_name: cust.company_name,
            customer_email: cust.billing_email ?? cust.contact_email,
            customer_phone: cust.contact_phone,
            customer_address: cust.billing_address ?? cust.contact_address,
            organization_number: orgNr,
            subtotal: totals.subtotal,
            vat_amount: totals.vat,
            total_amount: totals.total,
            status: 'pending_approval',
            requires_approval: false,
            billing_period_start: p.periodStart,
            billing_period_end: p.periodEnd,
            due_date: p.dueDate,
            is_historical: false,
            invoice_marking: str(contract.invoice_reference) ?? str(cust.billing_reference),
            notes,
            created_at: parseLocalDate(p.invoiceDate).toISOString(),
          })
          .select('id')
          .single()
        if (error || !inv) throw new Error(`Faktura: ${error?.message ?? 'okänt fel'}`)
        const invoiceId = String((inv as Row).id)
        must(await db.from('invoice_items').insert(toInvoiceItemRows(invoiceId, rows)), 'Fakturarader')
      }
    )
    if (created) report.invoicesCreated++
  }
}

// === A: notis ============================================================================

async function notifyInvoiceApprovers(ctx: Ctx, contract: Row, customerId: string): Promise<void> {
  const { db, report } = ctx
  try {
    const isNewCustomer = customerId === '(ny kund)'
    const { data: cust } = isNewCustomer
      ? { data: null }
      : await db.from('customers').select('id, parent_customer_id, company_name').eq('id', customerId).maybeSingle()
    const c = cust as Row | null
    // Notisen pekar på huvudkunden: avtalskartan ligger där även för enheter
    const rootId = str(c?.parent_customer_id) ?? customerId
    const companyName = str(c?.company_name) ?? str(contract.company_name) ?? 'Ny avtalskund'

    const { data: approvers } = await db.from('profiles').select('user_id').eq('can_approve_invoices', true).eq('is_active', true)
    const recipients = ((approvers ?? []) as Row[]).map((p) => str(p.user_id)).filter((v): v is string => !!v)
    if (recipients.length === 0) return

    const annual = num(contract.annual_value) ?? num(contract.total_value)
    const freqLabel: Record<string, string> = { annual: 'årsvis', semi_annual: 'halvårsvis', quarterly: 'kvartalsvis', monthly: 'månadsvis' }
    const freq = str(contract.billing_frequency)
    const start = str(contract.contract_start_date) ?? str(contract.start_date)
    const bits = [
      str(contract.label) ?? str(contract.contract_type) ?? 'Avtal',
      annual ? `${new Intl.NumberFormat('sv-SE').format(Math.round(annual))} kr per år exkl. moms` : null,
      freq ? freqLabel[freq] ?? freq : 'faktureringsintervall saknas',
      start ? `start ${start}` : null,
    ].filter(Boolean)

    const title = report.ourChain ? `Avtal upplagt automatiskt · ${companyName}` : `Nytt avtal signerat · ${companyName}`
    const lead = report.ourChain
      ? `${bits.join(' · ')}. Kunden, avtalskartan och fakturaplanen är upplagda automatiskt och ska kontrolleras.`
      : `${bits.join(' · ')}. Kontrollera avtalskartan: omfattning, fakturering och schema.`
    const preview = [lead, ...report.notes].join(' ')

    // En notis per mottagare och avtal: hoppa över dem som redan har en oläst
    const { data: existing } = isNewCustomer
      ? { data: [] as Row[] }
      : await db.from('notifications').select('recipient_id').eq('case_type', 'customer').eq('case_id', rootId).eq('title', title).eq('is_read', false)
    const already = new Set(((existing ?? []) as Row[]).map((n) => String(n.recipient_id)))
    const rows = recipients
      .filter((id) => !already.has(id))
      .map((id) => ({
        recipient_id: id,
        case_id: rootId,
        case_type: 'customer',
        title,
        preview,
        case_title: companyName,
        sender_id: id,
        sender_name: 'Systemet',
        is_read: false,
      }))
    if (rows.length === 0) return
    await write(ctx, `Notis till ${rows.length} faktureringsansvariga: "${title}". ${preview}`, async () => {
      must(await db.from('notifications').insert(rows), 'Notis')
    })
  } catch (err) {
    // Aldrig kritiskt: signeringen får inte fallera på en notis
    console.error('⚠️ Kunde inte notifiera faktureringsansvariga:', err instanceof Error ? err.message : err)
  }
}

// === Diagnos före omkörning ===========================================================
//
// Vad som hindrar (eller påverkar) att kunden läggs upp när signeringen körs om.
// Läser bara databasen. Varje post säger vilket fält det gäller, vad som står
// nu och var det rättas. Används av api/oneflow/reprocess-signed.ts och visas
// för koordinatorn i Boka in (src/components/coordinator/bokaIn/KorOmSignering.tsx).

export type SigningDiagnosisLevel = 'hinder' | 'varning' | 'info'

export interface SigningDiagnosisItem {
  /** Kolumnen på contracts som posten gäller, null när det inte är ett fält */
  field: 'company_name' | 'contact_email' | 'organization_number' | 'contact_person' | 'contact_phone' | 'contact_address' | null
  label: string
  current: string | null
  level: SigningDiagnosisLevel
  problem: string
  /** 'portal' = kan fyllas i på avtalsraden före omkörningen, 'oneflow' = bara i dokumentet, 'ingen' = inget att rätta */
  fixIn: 'portal' | 'oneflow' | 'ingen'
}

export interface SigningDiagnosis {
  contractId: string
  /** Kunden kan läggas upp eller kopplas när signeringen körs om */
  canCreateCustomer: boolean
  customerId: string | null
  items: SigningDiagnosisItem[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function diagnoseSignedContract(db: Db, contractId: string): Promise<SigningDiagnosis> {
  const { data } = await db
    .from('contracts')
    .select('id, type, status, customer_id, company_name, contact_email, organization_number, contact_person, contact_phone, contact_address, sent_organization_number, oneflow_contract_id')
    .eq('id', contractId)
    .maybeSingle()
  const items: SigningDiagnosisItem[] = []
  if (!data) {
    items.push({ field: null, label: 'Avtalet', current: null, level: 'hinder', problem: 'Avtalet finns inte i databasen.', fixIn: 'ingen' })
    return { contractId, canCreateCustomer: false, customerId: null, items }
  }
  const c = data as Row
  if (c.type !== 'contract' || !isSignedContractStatus(str(c.status))) {
    items.push({
      field: null,
      label: 'Avtalet',
      current: `${str(c.type)}, ${str(c.status)}`,
      level: 'hinder',
      problem: 'Bara signerade avtal kan köras om. Offerter blir aldrig kund i signeringen.',
      fixIn: 'ingen',
    })
    return { contractId, canCreateCustomer: false, customerId: str(c.customer_id), items }
  }
  if (str(c.customer_id)) {
    items.push({ field: null, label: 'Kund', current: str(c.customer_id), level: 'info', problem: 'Avtalet är redan kopplat till en kund.', fixIn: 'ingen' })
    return { contractId, canCreateCustomer: true, customerId: str(c.customer_id), items }
  }

  const companyName = str(c.company_name)
  const email = str(c.contact_email)
  if (!companyName) {
    items.push({ field: 'company_name', label: 'Kundnamn', current: null, level: 'hinder', problem: 'Kundnamnet saknas. Utan namn läggs ingen kund upp.', fixIn: 'portal' })
  }
  if (!email) {
    items.push({ field: 'contact_email', label: 'Kontaktens e-post', current: null, level: 'hinder', problem: 'Kontaktens e-post saknas. Utan e-post läggs ingen kund upp.', fixIn: 'portal' })
  } else if (!EMAIL_RE.test(email)) {
    items.push({ field: 'contact_email', label: 'Kontaktens e-post', current: email, level: 'hinder', problem: 'E-postadressen ser inte giltig ut.', fixIn: 'portal' })
  }

  const orgnr = str(c.organization_number)
  const identity = compareIdentityNumbers(str(c.sent_organization_number), orgnr)
  if (!orgnr) {
    items.push({ field: 'organization_number', label: 'Org/personnummer', current: null, level: 'varning', problem: 'Numret saknas. Kunden läggs upp utan nummer och kan inte matchas mot en befintlig kund på nummer.', fixIn: 'portal' })
  } else {
    const t = tolkaIdNummer(orgnr)
    if (!t.tolkat || !t.kontrollsiffraOk) {
      items.push({
        field: 'organization_number',
        label: 'Org/personnummer',
        current: orgnr,
        level: 'varning',
        problem: identity.status === 'changed_invalid'
          ? `${identity.message ?? 'Numret är ogiltigt.'}`
          : 'Numret klarar inte kontrollsiffran. Rätta det innan kunden läggs upp.',
        fixIn: 'portal',
      })
    }
    const variants = identityNumberVariants(orgnr)
    if (variants.length > 0) {
      const { data: same } = await db
        .from('customers')
        .select('id, company_name, site_type')
        .in('organization_number', variants)
        .order('created_at', { ascending: true })
        .limit(10)
      const rows = (same ?? []) as Row[]
      const preferred = rows.find((r) => r.site_type === 'huvudkontor') ?? rows[0]
      if (preferred) {
        items.push({
          field: 'organization_number',
          label: 'Befintlig kund',
          current: str(preferred.company_name),
          level: 'info',
          problem: `Numret finns redan i kundregistret. Avtalet kopplas till ${str(preferred.company_name) ?? 'den kunden'} i stället för att en ny kund skapas.`,
          fixIn: 'ingen',
        })
      }
    }
  }
  if (email && EMAIL_RE.test(email) && !items.some((i) => i.label === 'Befintlig kund')) {
    const { data: byMail } = await db.from('customers').select('id, company_name').eq('contact_email', email).limit(1).maybeSingle()
    if (byMail) {
      items.push({
        field: 'contact_email',
        label: 'Befintlig kund',
        current: str((byMail as Row).company_name),
        level: 'info',
        problem: `E-postadressen finns redan i kundregistret. Avtalet kopplas till ${str((byMail as Row).company_name) ?? 'den kunden'}.`,
        fixIn: 'ingen',
      })
    }
  }
  if (!str(c.contact_person)) {
    items.push({ field: 'contact_person', label: 'Kontaktperson', current: null, level: 'varning', problem: 'Kontaktperson saknas på kunden som skapas.', fixIn: 'portal' })
  }
  if (!str(c.contact_address)) {
    items.push({ field: 'contact_address', label: 'Adress', current: null, level: 'varning', problem: 'Adress saknas. Etableringen och fakturan behöver en adress.', fixIn: 'portal' })
  }
  const canCreateCustomer = !items.some((i) => i.level === 'hinder')
  return { contractId, canCreateCustomer, customerId: null, items }
}
