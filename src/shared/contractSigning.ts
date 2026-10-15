// src/shared/contractSigning.ts
// Ren logik för signeringsbehandlingen av avtal (api/_lib/contractSigning.ts).
// Ingen databas: allt här är testbart och delas mellan webhooken och
// omkörningen i efterhand.
//
// Beslut 2026-10-15 (Christian, fallet Pär-Eric Nilsson, Oneflow 16463726):
//   - Ärendet är bara utgångsläge, wizarden är sista ordet. Premien är det som
//     står i Oneflow-avtalet.
//   - Oneflow visar privatpersoner priser INKL. moms (articlePricingCalculator:
//     individual.basePrice = pris × 1,25). Portalens premie (contracts.annual_value)
//     är alltid EXKL. moms, fakturan lägger på momsen. 7 500 kr i Oneflow för en
//     privatperson är alltså 6 000 kr i premie.
//   - Org/personnummer: ändrar kunden numret i Oneflow till något som inte
//     klarar kontrollsiffran behålls vårt.

import { tolkaIdNummer } from './webLeadUppgifter'
import { orgDigits } from './fortnoxCustomerNumbers'

const round2 = (n: number) => Math.round(n * 100) / 100

// --- Vår kedja ---------------------------------------------------------------

/**
 * Avtalet är skapat genom portalens kedja: avtalswizarden → api/oneflow/create-contract.
 * Markören är contracts.created_by_email: den skrivs ENBART av create-contract
 * (sessionens e-post) och strippas ur alla webhook- och synkuppdateringar
 * (saveOrUpdateContract). Avtal som skapats direkt i Oneflow, importerats eller
 * lagts upp för hand har den tom. Samma definition som dokumentsigneringens
 * statistik ("dokument från nya systemet").
 */
export function isOurChainContract(c: { created_by_email?: string | null }): boolean {
  return !!(c.created_by_email && c.created_by_email.trim())
}

// --- Premien -----------------------------------------------------------------

/**
 * Motparten är en privatperson. Oneflows parttyp vinner; annars ärendetypen
 * (avtal från ett privatärende) och sist numrets form (personnummer).
 */
export function isIndividualParty(input: {
  oneflowPartyType?: string | null
  sourceType?: string | null
  organizationNumber?: string | null
}): boolean {
  if (input.oneflowPartyType === 'individual') return true
  if (input.oneflowPartyType === 'company') return false
  if (input.sourceType === 'private_case') return true
  if (input.sourceType === 'business_case') return false
  if (input.organizationNumber) {
    const t = tolkaIdNummer(input.organizationNumber)
    if (t.tolkat) return t.typ === 'personnummer'
  }
  return false
}

/**
 * Årspremien exkl. moms ur Oneflow-avtalets belopp. Privatpersoner ser priset
 * inkl. moms i Oneflow (wizarden skickar pris × (1 + moms)).
 */
export function premiumExclVatFromOneflow(oneflowTotal: number | string | null | undefined, individual: boolean, vatRatePercent = 25): number | null {
  const total = Number(oneflowTotal ?? 0)
  if (!Number.isFinite(total) || total <= 0) return null
  if (!individual) return round2(total)
  return round2(total / (1 + vatRatePercent / 100))
}

export interface PremiumRow {
  id: string
  quantity: number | string | null
  unit_price: number | string | null
  total_price: number | string | null
  is_premium_carrier?: boolean | null
  premium_share?: number | string | null
}

export interface PremiumRowUpdate {
  id: string
  unit_price?: number
  total_price?: number
  premium_share?: number
}

export interface PremiumCorrection {
  /** Radernas summa före rättning, exkl. moms */
  before: number
  /** Premien raderna rättas mot */
  premium: number
  /** Summan avvek (minst 50 öre) och raderna justerades */
  deviated: boolean
  updates: PremiumRowUpdate[]
}

/**
 * Rätta avtalets premierader (§ 4, billing_model premium) så att summan blir
 * premien. Bärande raden (avtalstypen) får sin del som pris; övriga rader med
 * pris får en andel av premien (premium_share) så att fakturans fördelning
 * följer Oneflow och raden inte flaggas som "gammalt pris" på pappret.
 * Planeraren läser andelarna, aldrig radpriset (avtalsrad-bar-premien).
 *
 * Rader skalas proportionellt; sista raden tar öresdifferensen. Har raderna
 * ingen summa alls får bärande raden (eller första raden) hela premien.
 */
export function correctPremiumRows(rows: PremiumRow[], premium: number): PremiumCorrection {
  const totals = rows.map((r) => Number(r.total_price ?? 0) || 0)
  const before = round2(totals.reduce((s, t) => s + t, 0))
  const result: PremiumCorrection = { before, premium: round2(premium), deviated: false, updates: [] }
  if (rows.length === 0 || !(premium > 0)) return result

  const deviated = Math.abs(before - premium) >= 0.5
  result.deviated = deviated

  // Nya radbelopp
  let newTotals = totals
  if (deviated) {
    if (before <= 0) {
      const target = rows.findIndex((r) => r.is_premium_carrier)
      const idx = target >= 0 ? target : 0
      newTotals = rows.map((_, i) => (i === idx ? round2(premium) : 0))
    } else {
      let allocated = 0
      const lastPriced = totals.reduce((last, t, i) => (t > 0 ? i : last), -1)
      newTotals = totals.map((t, i) => {
        if (t <= 0) return 0
        if (i === lastPriced) return round2(premium - allocated)
        const v = round2((t * premium) / before)
        allocated = round2(allocated + v)
        return v
      })
    }
  }

  const hasCarrier = rows.some((r) => r.is_premium_carrier)
  rows.forEach((r, i) => {
    const update: PremiumRowUpdate = { id: r.id }
    if (deviated && Math.abs(newTotals[i] - totals[i]) >= 0.005) {
      const qty = Number(r.quantity ?? 1) > 0 ? Number(r.quantity ?? 1) : 1
      update.total_price = newTotals[i]
      update.unit_price = round2(newTotals[i] / qty)
    }
    // Andel på icke-bärande rader med pris men utan uttalad andel
    if (hasCarrier && !r.is_premium_carrier && newTotals[i] > 0 && !(Number(r.premium_share ?? 0) > 0)) {
      update.premium_share = Math.round((newTotals[i] / premium) * 10000) / 10000
    }
    if (Object.keys(update).length > 1) result.updates.push(update)
  })
  return result
}

// --- Org- och personnummer -----------------------------------------------------

export type IdentityCheck =
  | { status: 'same' | 'only_signed' | 'only_sent' | 'none'; keep: string | null; message: null }
  | { status: 'changed_valid' | 'changed_invalid'; keep: string; message: string }

function digits10(raw: string | null | undefined): string | null {
  return orgDigits(raw ?? null)
}

/**
 * Jämför numret vi skickade till Oneflow med numret i det signerade avtalet.
 * Har kunden ändrat till ett nummer som inte klarar kontrollsiffran behålls
 * vårt; ett giltigt nytt nummer används men nämns i notisen.
 */
export function compareIdentityNumbers(sent: string | null | undefined, signed: string | null | undefined): IdentityCheck {
  const s = (sent ?? '').trim()
  const g = (signed ?? '').trim()
  if (!s && !g) return { status: 'none', keep: null, message: null }
  if (!s) return { status: 'only_signed', keep: g, message: null }
  if (!g) return { status: 'only_sent', keep: s, message: null }
  if (digits10(s) === digits10(g)) return { status: 'same', keep: g, message: null }

  const tolkat = tolkaIdNummer(g)
  const valid = tolkat.tolkat && tolkat.kontrollsiffraOk
  const word = tolkaIdNummer(s).typ === 'personnummer' || tolkat.typ === 'personnummer' ? 'personnumret' : 'organisationsnumret'
  if (valid) {
    return {
      status: 'changed_valid',
      keep: g,
      message: `Kunden ändrade ${word} i Oneflow från ${s} till ${g}. Det nya numret är giltigt och används.`,
    }
  }
  return {
    status: 'changed_invalid',
    keep: s,
    message: `Kunden ändrade ${word} i Oneflow från ${s} till ${g}, som inte är ett giltigt nummer. Vårt nummer ${s} behålls.`,
  }
}

/**
 * Skrivsätt numret kan stå på i kundregistret (med och utan bindestreck, med
 * och utan sekel för personnummer). För uppslag mot customers.organization_number.
 */
export function identityNumberVariants(raw: string | null | undefined): string[] {
  const out = new Set<string>()
  const text = (raw ?? '').trim()
  if (text) out.add(text)
  const d = digits10(text)
  if (!d || d.length !== 10) return [...out]
  out.add(d)
  out.add(`${d.slice(0, 6)}-${d.slice(6)}`)
  const t = tolkaIdNummer(text)
  if (t.tolkat && t.typ === 'personnummer' && /^\d{8}-\d{4}$/.test(t.normaliserat)) {
    out.add(t.normaliserat)
    out.add(t.normaliserat.replace('-', ''))
  }
  return [...out]
}

// --- Avtalets tjänst -----------------------------------------------------------

export interface ContractServiceCandidate {
  id: string
  name: string
  code: string | null
}

export interface ContractServiceRow {
  id: string
  service_id: string | null
  service_name: string | null
  total_price?: number | string | null
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Avtalets typ ur dess tjänsterader: raden vars tjänst är en avtalstjänst
 * (services.is_contract_service). Matchar på service_id, annars på namnet
 * (wizarden skickade tidigare tjänsterna utan service_id). Dyraste träffen vinner.
 */
export function pickContractService(
  rows: ContractServiceRow[],
  services: ContractServiceCandidate[]
): { row: ContractServiceRow; service: ContractServiceCandidate } | null {
  const byId = new Map(services.map((s) => [s.id, s]))
  const byName = new Map(services.map((s) => [norm(s.name), s]))
  const matches = rows
    .map((row) => ({ row, service: (row.service_id && byId.get(row.service_id)) || byName.get(norm(row.service_name)) || null }))
    .filter((m): m is { row: ContractServiceRow; service: ContractServiceCandidate } => !!m.service)
    .sort((a, b) => Number(b.row.total_price ?? 0) - Number(a.row.total_price ?? 0))
  return matches[0] ?? null
}

// --- Källärendets rader --------------------------------------------------------

export interface SourceCaseRow {
  id: string
  item_type: string | null
  status: string | null
  service_id: string | null
  service_name: string | null
  mapped_service_id?: string | null
  labor_for_item_id?: string | null
}

/**
 * Raderna på källärendet som byggde avtalet och därför aldrig ska faktureras
 * som engångstjänst: ofakturerade tjänsterader (pending/approved) med samma
 * tjänst som avtalets rader, deras arbetsrader (ROT/RUT) och artiklarna som
 * hör till dem. Finns inga andra ofakturerade tjänsterader kvar tas även
 * ärendets lösa artikelrader med: fakturan faktureras annars artiklarna
 * (bakåtkompatibel regel i selectInvoiceableCaseRows).
 */
export function selectSourceRowsCoveredByContract(
  sourceRows: SourceCaseRow[],
  contractRows: Array<{ service_id: string | null; service_name: string | null }>
): { ids: string[]; looseArticles: number } {
  const open = (r: SourceCaseRow) => r.status === 'pending' || r.status === 'approved'
  const ids = new Set(contractRows.map((r) => r.service_id).filter(Boolean) as string[])
  const names = new Set(contractRows.map((r) => norm(r.service_name)).filter(Boolean))

  const services = sourceRows.filter(
    (r) => r.item_type === 'service' && open(r) && ((r.service_id && ids.has(r.service_id)) || names.has(norm(r.service_name)))
  )
  const picked = new Set(services.map((r) => r.id))
  for (const r of sourceRows) {
    if (!open(r) || picked.has(r.id)) continue
    if (r.labor_for_item_id && picked.has(r.labor_for_item_id)) picked.add(r.id)
    else if (r.item_type === 'article' && r.mapped_service_id && picked.has(r.mapped_service_id)) picked.add(r.id)
  }
  let looseArticles = 0
  if (picked.size > 0) {
    const remainingServices = sourceRows.filter((r) => r.item_type === 'service' && open(r) && !picked.has(r.id))
    if (remainingServices.length === 0) {
      for (const r of sourceRows) {
        if (open(r) && !picked.has(r.id) && (r.item_type === 'article' || !r.item_type)) {
          picked.add(r.id)
          looseArticles++
        }
      }
    }
  }
  return { ids: [...picked], looseArticles }
}

// --- Avtalskartan ----------------------------------------------------------------

export interface MapSetupInput {
  contract_start_date: string | null
  start_date?: string | null
  billing_frequency: string | null
  billing_anchor_month: number | null
  notice_period_months: number | null
  visits_per_year?: number | null
  visit_frequency?: string | null
}

/**
 * Det avtalskartan kan få automatiskt ur avtalet, och det som måste lämnas åt
 * en faktureringsansvarig. Gissar aldrig: saknas underlag blir fältet tomt och
 * hamnar i listan missing (texten i notisen).
 */
export function deriveMapSetup(c: MapSetupInput): { updates: { billing_anchor_month?: number }; missing: string[] } {
  const updates: { billing_anchor_month?: number } = {}
  const missing: string[] = []
  const start = c.contract_start_date ?? c.start_date ?? null
  if (!start) missing.push('startdatum')
  if (!c.billing_frequency) missing.push('faktureringsintervall')
  // Fakturamånad = startmånaden om inget annat sagts (Christian 2026-09-17)
  if (!c.billing_anchor_month && c.billing_frequency && c.billing_frequency !== 'on_demand' && start) {
    const m = Number(start.slice(5, 7))
    if (m >= 1 && m <= 12) updates.billing_anchor_month = m
  }
  if (c.notice_period_months == null) missing.push('uppsägningstid')
  if (!c.visits_per_year && !c.visit_frequency) missing.push('besöksfrekvens och schema (§ 3)')
  return { updates, missing }
}
