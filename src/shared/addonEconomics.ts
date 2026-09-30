// src/shared/addonEconomics.ts
// Tillägg bredvid avtalet: tidslinjen (det som betalas nu mot avtalets år),
// "Tilläggets kalkyl" och uppdelningen av ett ärendes rader i ärendets egna
// och tilläggens. Ren modul utan DB, delas av Ekonomi-fliken, teknikerns
// avslutssteg, kontorets beslut och § 6 i avtalskartan så att de aldrig
// säger olika. Räkna ALDRIG detta lokalt i en vy.
//
// Regler (Christian 2026-09-30, BE-0008974):
// - Ett tillägg ligger bredvid avtalet och rör aldrig premie, § 4 eller
//   avtalets marginal om det inte uttryckligen läggs till i avtalet.
// - Första perioden betalas för tiden kvar till avtalets nästa periodstart,
//   sedan följer tillägget avtalets år på en egen faktura i samband med
//   årsfakturan. Tilläggen slutar när avtalet slutar.
// - Arbetstiden räknas i tilläggets kalkyl: timmar × kundens timpris som
//   intäkt, timmar × Arbetstid Företag som kostnad (att den går back är accepterat).

export const YEAR_DAYS = 365
const DAY_MS = 86_400_000

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const MONTHS_LONG = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

const num = (v: number | string | null | undefined): number => (v == null || v === '' ? 0 : Number(v))
const round2 = (n: number) => Math.round(n * 100) / 100

// ─── Datum (lokala ÅÅÅÅ-MM-DD, aldrig toISOString) ─────────────────────────

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

export function daysBetweenIso(fromIso: string, toIsoDate: string): number {
  return Math.round((parseIso(toIsoDate).getTime() - parseIso(fromIso).getTime()) / DAY_MS)
}

export function todayIso(): string {
  return toIso(new Date())
}

/** "1 jul 2027" */
export function formatDateShortSv(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = parseIso(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** "1 juli" (utan år), för "Avtalets år börjar 1 juli" */
export function formatDayMonthSv(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = parseIso(iso)
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`
}

/** "juni 2028" */
export function formatMonthYearLongSv(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = parseIso(iso)
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
}

/** "7 076 kr" (hela kronor, svensk tusengruppering) */
export function formatKr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0 kr'
  return `${Math.round(n).toLocaleString('sv-SE')} kr`
}

/** "2" / "2,5" timmar */
export function formatHours(h: number | null | undefined): string {
  const v = num(h)
  return Number.isInteger(v) ? String(v) : v.toLocaleString('sv-SE', { maximumFractionDigits: 1 })
}

// ─── Tidslinjen ───────────────────────────────────────────────────────────

export type AddonTimelineUnit = 'station' | 'timme'

export interface AddonTimeline {
  /** Andel av året som betalas nu, 0..1 */
  fraction: number
  /** Dagar som betalas nu (fraction × 365) */
  days: number
  /** Hela månader av tolv som betalas nu */
  months: number
  /** Första dagen som betalas nu, ÅÅÅÅ-MM-DD */
  fromDate: string | null
  /** Sista dagen som betalas nu (dagen före startDate) */
  toDate: string | null
  /** Från och med detta datum följer tillägget avtalets år (billing_start_date) */
  startDate: string | null
  /** Antal enheter som betalas nu (stationer, eller timmar som ökar) */
  quantityNow: number
  /** Antal enheter per år från startDate (stationer, eller timmar totalt) */
  quantityAnnual: number
  perUnitNow: number
  perUnitAnnual: number
  totalNow: number
  totalAnnual: number
  unit: AddonTimelineUnit
  model: 'per_year' | 'per_month'
}

/** Rader som tidslinjen läses ur (case_billing_items). */
export interface AddonTimelineRow {
  quantity: number | string | null
  unit_price: number | string | null
  total_price: number | string | null
  addon_annual_unit_price?: number | string | null
  billing_start_date?: string | null
  is_addon_labour_line?: boolean | null
  addon_labour_hours?: number | string | null
  addon_labour_hours_before?: number | string | null
  addon_model?: string | null
}

export function monthsOfYear(fraction: number): number {
  return Math.max(0, Math.min(12, Math.round(fraction * 12)))
}

/** "9 av 12 månader" */
export function monthsLabel(months: number): string {
  return `${months} av 12 ${months === 1 ? 'månad' : 'månader'}`
}

/**
 * Tidslinjen ur en pro rata-rad. Raden lagrar årspriset per enhet och
 * billing_start_date, så andelen är unit_price / årspris. För arbetstiden
 * betalas bara ökningen nu (timmar minus timmar innan), hela timantalet
 * gäller från periodstarten. `today` behövs bara när andelen inte går att
 * läsa ur beloppen (arbetstid utan ökning).
 */
export function timelineFromRow(row: AddonTimelineRow, today: string = todayIso()): AddonTimeline | null {
  const annualUnit = num(row.addon_annual_unit_price)
  if (!(annualUnit > 0)) return null
  const startDate = row.billing_start_date ?? null
  const model: 'per_year' | 'per_month' = row.addon_model === 'per_month' ? 'per_month' : 'per_year'

  if (row.is_addon_labour_line) {
    const hours = num(row.addon_labour_hours)
    const before = num(row.addon_labour_hours_before)
    const delta = Math.max(hours - before, 0)
    const totalNow = num(row.total_price)
    let fraction = delta > 0 ? totalNow / (delta * annualUnit) : 0
    if (!(fraction > 0) && startDate) fraction = Math.max(daysBetweenIso(today, startDate), 0) / YEAR_DAYS
    fraction = Math.max(0, Math.min(1, fraction))
    const days = Math.round(fraction * YEAR_DAYS)
    return {
      fraction,
      days,
      months: monthsOfYear(fraction),
      fromDate: startDate ? addDaysIso(startDate, -days) : null,
      toDate: startDate ? addDaysIso(startDate, -1) : null,
      startDate,
      quantityNow: delta,
      quantityAnnual: hours,
      perUnitNow: round2(annualUnit * fraction),
      perUnitAnnual: annualUnit,
      totalNow,
      totalAnnual: round2(hours * annualUnit),
      unit: 'timme',
      model: 'per_year',
    }
  }

  const qty = num(row.quantity)
  const unitNow = num(row.unit_price)
  const fraction = Math.max(0, Math.min(1, unitNow / annualUnit))
  const days = Math.round(fraction * YEAR_DAYS)
  return {
    fraction,
    days,
    months: monthsOfYear(fraction),
    fromDate: startDate ? addDaysIso(startDate, -days) : null,
    toDate: startDate ? addDaysIso(startDate, -1) : null,
    startDate,
    quantityNow: qty,
    quantityAnnual: qty,
    perUnitNow: unitNow,
    perUnitAnnual: annualUnit,
    totalNow: num(row.total_price),
    totalAnnual: round2(qty * annualUnit),
    unit: 'station',
    model,
  }
}

/**
 * Tidslinjen för ett förslag som ännu inte finns som rad (teknikerns
 * avslutssteg, kontorets beslut): andel = dagar från `fromDate` till
 * `startDate` / 365, samma formel som RPC:n sync_addon_prorata_line.
 */
export function timelineForProposal(input: {
  fromDate: string
  startDate: string
  perUnitAnnual: number
  quantityNow: number
  quantityAnnual?: number
  unit: AddonTimelineUnit
  model?: 'per_year' | 'per_month'
}): AddonTimeline {
  const days = Math.max(daysBetweenIso(input.fromDate, input.startDate), 0)
  const fraction = Math.max(0, Math.min(1, days / YEAR_DAYS))
  const perUnitNow = round2(input.perUnitAnnual * fraction)
  const qtyAnnual = input.quantityAnnual ?? input.quantityNow
  return {
    fraction,
    days,
    months: monthsOfYear(fraction),
    fromDate: input.fromDate,
    toDate: addDaysIso(input.startDate, -1),
    startDate: input.startDate,
    quantityNow: input.quantityNow,
    quantityAnnual: qtyAnnual,
    perUnitNow,
    perUnitAnnual: input.perUnitAnnual,
    totalNow: round2(perUnitNow * input.quantityNow),
    totalAnnual: round2(input.perUnitAnnual * qtyAnnual),
    unit: input.unit,
    model: input.model ?? 'per_year',
  }
}

/** Förklaringstexten under tidslinjen (datum dynamiskt). */
export function timelineExplanation(startDate: string | null | undefined): string {
  const day = formatDayMonthSv(startDate)
  const lead = day ? `Avtalets år börjar ${day}.` : 'Avtalets år börjar vid nästa periodstart.'
  return `${lead} Kunden betalar därför bara för månaderna som är kvar till dess. Sedan följer tilläggen avtalets år och faktureras på en egen faktura i samband med årsfakturan. Tilläggen slutar när avtalet slutar.`
}

// ─── Tilläggets kalkyl ────────────────────────────────────────────────────

export interface AddonCalcInput {
  /** Utrustning, en gång (stationernas addon_unit_cost) */
  equipmentCost: number
  /** Stationernas intäkt per år (antal × årspris) */
  annualStationRevenue: number
  /** Timmar per år för att hantera tilläggen */
  labourHours: number
  /** Kundens timpris (tjänst 135) */
  labourRate: number | null
  /** Intern timkostnad (Arbetstid Företag) */
  labourCostPerHour: number | null
  /** Det som faktureras nu, första perioden (stationer + arbetstid) */
  firstPeriodRevenue: number
  /** Andel av året för första perioden (0..1) */
  firstPeriodFraction: number
  /** Avtalets nästa periodstart, ÅÅÅÅ-MM-DD */
  startDate: string | null
  /** Idag, ÅÅÅÅ-MM-DD (tester) */
  today?: string
}

export interface AddonCalc {
  equipmentCost: number
  annualStationRevenue: number
  annualLabourRevenue: number
  annualRevenue: number
  annualLabourCost: number
  /** Täckning per år efter arbetstid */
  annualContribution: number
  /** Första periodens intäkt minus arbetstid för samma andel av året */
  firstPeriodNet: number
  /** Dagen utrustningen är betald, ÅÅÅÅ-MM-DD, null = aldrig */
  paybackDate: string | null
  paybackNever: boolean
  /** "juni 2028", "direkt" eller "aldrig" */
  paybackLabel: string
}

/**
 * Tilläggets kalkyl och återbetalning. Första perioden ger nettot pro rata,
 * sedan täcker tillägget sin utrustning med årlig täckning från nästa
 * periodstart. Allt linjärt över tiden, samma som contract_addon_ledger.
 */
export function computeAddonCalc(input: AddonCalcInput): AddonCalc {
  const today = input.today ?? todayIso()
  const rate = num(input.labourRate)
  const costPerHour = num(input.labourCostPerHour)
  const hours = Math.max(num(input.labourHours), 0)
  const annualLabourRevenue = round2(hours * rate)
  const annualStationRevenue = round2(num(input.annualStationRevenue))
  const annualRevenue = round2(annualStationRevenue + annualLabourRevenue)
  const annualLabourCost = round2(hours * costPerHour)
  const annualContribution = round2(annualRevenue - annualLabourCost)
  const fraction = Math.max(0, Math.min(1, num(input.firstPeriodFraction)))
  const firstPeriodNet = round2(num(input.firstPeriodRevenue) - annualLabourCost * fraction)
  const equipmentCost = round2(Math.max(num(input.equipmentCost), 0))

  const base = {
    equipmentCost,
    annualStationRevenue,
    annualLabourRevenue,
    annualRevenue,
    annualLabourCost,
    annualContribution,
    firstPeriodNet,
  }

  if (equipmentCost <= 0) {
    return { ...base, paybackDate: today, paybackNever: false, paybackLabel: 'direkt' }
  }

  const firstDays = input.startDate ? Math.max(daysBetweenIso(today, input.startDate), 0) : Math.round(fraction * YEAR_DAYS)
  // Betald redan under första perioden
  if (firstPeriodNet >= equipmentCost && firstPeriodNet > 0 && firstDays > 0) {
    const d = addDaysIso(today, Math.ceil((equipmentCost / firstPeriodNet) * firstDays))
    return { ...base, paybackDate: d, paybackNever: false, paybackLabel: formatMonthYearLongSv(d) }
  }
  const remaining = equipmentCost - firstPeriodNet
  if (!(annualContribution > 0)) {
    return { ...base, paybackDate: null, paybackNever: true, paybackLabel: 'aldrig' }
  }
  const from = input.startDate ?? addDaysIso(today, firstDays)
  const d = addDaysIso(from, Math.ceil((remaining / annualContribution) * YEAR_DAYS))
  return { ...base, paybackDate: d, paybackNever: false, paybackLabel: formatMonthYearLongSv(d) }
}

// ─── Ärendets rader: ärendets egna mot tilläggens ─────────────────────────

export interface CaseLineLike {
  id: string
  item_type?: string | null
  is_addon_prorata_line?: boolean | null
  is_addon_labour_line?: boolean | null
  mapped_service_id?: string | null
}

/** Tilläggsrad på ett ärende (pro rata per stationstyp eller arbetstid). */
export function isAddonCaseLine(line: CaseLineLike): boolean {
  return line.is_addon_prorata_line === true || line.is_addon_labour_line === true
}

/**
 * Delar ett ärendes rader: tilläggsrader och de artiklar som är mappade
 * mot dem hör till tilläggets kalkyl, allt annat är ärendets egna. Ärendets
 * marginal räknas bara på `caseLines`.
 */
export function splitCaseLines<T extends CaseLineLike>(lines: T[]): { caseLines: T[]; addonLines: T[] } {
  const addonIds = new Set(lines.filter(isAddonCaseLine).map((l) => l.id))
  const caseLines: T[] = []
  const addonLines: T[] = []
  for (const l of lines) {
    const isAddon = addonIds.has(l.id) || (!!l.mapped_service_id && addonIds.has(l.mapped_service_id))
    ;(isAddon ? addonLines : caseLines).push(l)
  }
  return { caseLines, addonLines }
}

// ─── "Lägg till i avtalet" ───────────────────────────────────────────────

/** Premiehöjningen när tillägget läggs in i avtalet: från A till B. */
export function premiumRaise(currentAnnual: number | null | undefined, addAnnual: number): { from: number; to: number; add: number } {
  const from = Math.round(num(currentAnnual))
  const add = Math.round(num(addAnnual))
  return { from, to: from + add, add }
}
