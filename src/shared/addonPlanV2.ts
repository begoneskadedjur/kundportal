// src/shared/addonPlanV2.ts
// Tilläggsregler version 2 i planeringen (steg 11 i
// docs/planer/avtalsar-exakt-arsdag-teknik.md). Gäller BARA avtal med
// contracts.addon_rules = 'v2'; övriga avtal planeras som förut i
// contractPlanner.ts och rör inte den här modulen.
//
// Regler (Christian 2026-10-30):
// - Tilläggen följer premiens takt. Premie per månad: tilläggen ligger på
//   månadsfakturan (årspris / 12, oavsett stationens modell). Premie per
//   kvartal, halvår eller år: egna tilläggsfakturor (kind equipment) med
//   premiens perioder, radpris = årspris / antal perioder per år.
// - Undantag (steg 0, 2026-11-03): en § 6-rad per månad (billing_model
//   'per_month') faktureras månadsvis på egna månadsfakturor (kind
//   equipment_monthly) när premien inte är månadsvis. Se addonCadenceFor.
// - Kund utan premie (eller premie utan intervall): tilläggen årsvis på
//   avtalets exakta årsdag, oavsett billing_frequency och billing_anchor_mode.
// - En tilläggsfaktura per avtal och referenskod (addonMarking.ts), enhetens
//   namn på varje rad.
// - Glappfaktura (kind equipment_gap): station vars ärende är stängt och som
//   saknar täckning från startdagen till dagen före nästa ordinarie
//   periodstart. Underlaget kommer ur SQL (addon_gap_candidates).
// - Antal på en tilläggsfaktura = stationerna minus de som redan har
//   täckning för hela perioden (addon_station_coverage). En station med
//   täckning för en del av perioden faktureras för de otäckta dagarna på en
//   egen rad: à-pris = periodens pris × otäckta dagar / periodens dagar.
//
// Så länge drop-raderna från steg 5 inte är körda (invoice_marking_split_ready
// falsk) kan databasen inte ta två tilläggsfakturor för samma avtal och
// period, och typen equipment_gap finns inte. Då blir det EN tilläggsfaktura
// per avtal och period med märkningen per rad, och glappen visas men skapas inte.
//
// Ren modul utan databas: generatorn, cronen och provskriptet använder den.

import {
  computePlannedEquipmentPeriods,
  computePlannedMonthlyEquipmentPeriods,
  parseLocalDate,
  toLocalIsoDate,
  type EquipmentLine,
  type PlannedEquipmentRow,
  type PlannedPeriod,
  type PlanningContract,
  type PlanOptions,
  type PremiumStep,
} from './contractPlanner'
import { addonMarkingFor, markingKey } from './addonMarking'
import { EDITABLE_STATUSES, isAutoDeletable, LOCKED_STATUSES, type MatchableInvoice, type ContractDiffEntry } from './contractInvoiceMatch'

export const ADDON_RULES_V2 = 'v2'

export function isAddonRulesV2(c: { addon_rules?: string | null } | null | undefined): boolean {
  return c?.addon_rules === ADDON_RULES_V2
}

export type AddonCadence = 'with_premium' | 'premium_periods' | 'anniversary'

/** Premie finns: annual_value > 0 eller steg i trappan (SQL: addon_contract_has_premium). */
export function hasPremium(contract: Pick<PlanningContract, 'annual_value'>, steps: PremiumStep[] | undefined): boolean {
  return Number(contract.annual_value ?? 0) > 0 || (steps?.length ?? 0) > 0
}

/** Tilläggens takt (SQL: contract_addon_next_period_start). */
export function addonCadence(contract: Pick<PlanningContract, 'annual_value' | 'billing_frequency'>, steps: PremiumStep[] | undefined): AddonCadence {
  if (!hasPremium(contract, steps)) return 'anniversary'
  const f = contract.billing_frequency ?? ''
  if (f === 'monthly') return 'with_premium'
  if (f === 'quarterly' || f === 'semi_annual' || f === 'annual') return 'premium_periods'
  return 'anniversary'
}

/** Takten för en enskild § 6-rad: avtalets takt, eller egna månadsfakturor. */
export type AddonLineCadence = AddonCadence | 'monthly'

/**
 * Takten för en § 6-rad i v2 (SQL: contract_addon_next_period_start med
 * stationens modell). Per månad-rader faktureras månadsvis på egna
 * månadsfakturor, utom när premien är månadsvis (då ligger de på
 * premiefakturan som förut). Per år-rader följer avtalets takt.
 * Utbyggnadspunkt: faktureringsgrupper per rad eller station avgörs här.
 */
export function addonCadenceFor(
  line: Pick<EquipmentLine, 'billing_model'>,
  contract: Pick<PlanningContract, 'annual_value' | 'billing_frequency'>,
  steps: PremiumStep[] | undefined
): AddonLineCadence {
  const base = addonCadence(contract, steps)
  if (line.billing_model === 'per_month' && base !== 'with_premium') return 'monthly'
  return base
}

/** Tilläggsraden i v2 på avtalets takt: alltid årspris, oavsett om § 6-raden är per år eller per månad. */
export function normalizeV2Line(l: EquipmentLine): EquipmentLine {
  const annual = l.billing_model === 'per_month' ? Number(l.unit_price_month ?? 0) * 12 || l.unit_price_annual : l.unit_price_annual
  return { ...l, billing_model: 'per_year', unit_price_annual: Math.round(annual * 100) / 100, unit_price_month: annual / 12 }
}

export interface CoverageRange {
  station_id: string
  from: string
  to: string
}

const DAY = 86_400_000
const dayNo = (iso: string) => Math.round(parseLocalDate(iso).getTime() / DAY)

/** Har stationen täckning för varje dag i perioden? */
export function stationFullyCovered(stationId: string, from: string, to: string, coverage: CoverageRange[]): boolean {
  const ranges = coverage
    .filter((c) => c.station_id === stationId && c.to >= from && c.from <= to)
    .map((c) => [Math.max(dayNo(c.from), dayNo(from)), Math.min(dayNo(c.to), dayNo(to))] as const)
    .sort((a, b) => a[0] - b[0])
  let next = dayNo(from)
  for (const [a, b] of ranges) {
    if (a > next) return false
    if (b + 1 > next) next = b + 1
  }
  return next > dayNo(to)
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Otäckta dagar för en station i [from, to]: antal, första och sista otäckta dag. */
export function stationUncoveredSpan(
  stationId: string,
  from: string,
  to: string,
  coverage: CoverageRange[]
): { days: number; first: string | null; last: string | null } {
  const ranges = coverage
    .filter((c) => c.station_id === stationId && c.to >= from && c.from <= to)
    .map((c) => [dayNo(c.from), dayNo(c.to)] as const)
  let days = 0
  let first: number | null = null
  let last: number | null = null
  for (let d = dayNo(from); d <= dayNo(to); d++) {
    if (ranges.some(([f, t]) => d >= f && d <= t)) continue
    days++
    if (first === null) first = d
    last = d
  }
  // Dagnumret är lokal midnatt avrundad; mitt på dagen ger rätt datum
  const iso = (n: number | null) => (n === null ? null : toLocalIsoDate(new Date(n * DAY + 12 * 3_600_000)))
  return { days, first: iso(first), last: iso(last) }
}

function totals(p: PlannedPeriod, rows: PlannedEquipmentRow[]): PlannedPeriod {
  const equipmentSubtotal = rows.reduce((s, r) => s + r.total_price, 0)
  const subtotal = round2(p.amount + equipmentSubtotal)
  const vatAmount = round2(p.amount * 0.25 + rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0))
  return { ...p, equipmentRows: rows, subtotal, vatAmount, totalAmount: round2(subtotal + vatAmount) }
}

/**
 * Raderna i en v2-period: enhetens namn, stationerna och antalet minus
 * stationer med täckning för hela perioden. Stationer med täckning för en
 * del av perioden faktureras för de otäckta dagarna på egen rad (samma
 * otäckta dagar delar rad): à-pris = periodens à-pris × otäckta dagar /
 * periodens dagar, avrundat till öre, och raden bär den fakturerade delen
 * (billed_period). Rader med antal 0 tas bort.
 * invoiceMarking = fakturans märkning; skiljer sig enhetens kod läggs den på raden.
 */
export function decorateV2Period(
  p: PlannedPeriod,
  lines: EquipmentLine[],
  coverage: CoverageRange[],
  invoiceMarking: string | null
): PlannedPeriod {
  const byId = new Map(lines.map((l) => [l.id, l]))
  const rows: PlannedEquipmentRow[] = []
  const periodDays = dayNo(p.periodEnd) - dayNo(p.periodStart) + 1
  for (const r of p.equipmentRows) {
    const line = byId.get(r.source_id)
    const ids = line?.station_ids ?? null
    const unitMarking = line?.marking ?? null
    const common = {
      unit_name: line?.unit_name ?? null,
      ...(unitMarking && markingKey(unitMarking) !== markingKey(invoiceMarking) ? { unit_marking: unitMarking } : {}),
    }
    const full: string[] = []
    const partial = new Map<string, { days: number; first: string; last: string; ids: string[] }>()
    let coveredCount = 0
    for (const s of ids ?? []) {
      const u = stationUncoveredSpan(s, p.periodStart, p.periodEnd, coverage)
      if (u.days <= 0) coveredCount++
      else if (u.days >= periodDays) full.push(s)
      else {
        const k = [u.days, u.first, u.last].join('|')
        const slot = partial.get(k) ?? { days: u.days, first: u.first as string, last: u.last as string, ids: [] }
        slot.ids.push(s)
        partial.set(k, slot)
      }
    }
    const partialCount = [...partial.values()].reduce((n, g) => n + g.ids.length, 0)
    const quantity = Math.max(0, r.quantity - coveredCount - partialCount)
    if (quantity > 0) {
      rows.push({ ...r, quantity, total_price: round2(r.unit_price * quantity), ...common, station_ids: ids ? full : null })
    }
    // Delvis täckta: periodens pris × otäckta dagar / periodens dagar
    for (const g of [...partial.values()].sort((a, b) => a.first.localeCompare(b.first) || a.days - b.days)) {
      const unit = round2((r.unit_price * g.days) / periodDays)
      rows.push({
        ...r,
        quantity: g.ids.length,
        unit_price: unit,
        total_price: round2(unit * g.ids.length),
        ...common,
        station_ids: g.ids,
        billed_period: { from: g.first, to: g.last },
      })
    }
  }
  return totals(p, rows)
}

export interface AddonMarkingGroup {
  marking: string | null
  markingKey: string
  lines: EquipmentLine[]
  periods: PlannedPeriod[]
}

export interface AddonPlanV2 {
  cadence: AddonCadence
  /** Månadspremie: raderna som ska på premiefakturan (normaliserade till årspris) */
  premiumEquipment: EquipmentLine[]
  /** Egna tilläggsfakturor, en grupp per märkning (en grupp när split är falsk) */
  groups: AddonMarkingGroup[]
  /** § 6-rader med egen månadstakt (addonCadenceFor = monthly) */
  monthlyLines: EquipmentLine[]
  /** Egna månadsfakturor (kind equipment_monthly), en per månad och avtal */
  monthly: PlannedPeriod[]
}

export interface AddonPlanV2Options extends Omit<PlanOptions, 'equipment' | 'equipmentMode'> {
  /** Tilläggsfakturor per märkning (invoice_marking_split_ready) */
  split: boolean
  /** Fakturans märkning när allt ligger på en faktura (dagens regel) */
  fallbackMarking: string | null
  coverage?: CoverageRange[]
}

/**
 * Lines ska bära site_customer_id, unit_name och marking (addonMarkingFor)
 * när de finns. Perioder utan rader tas bort.
 */
export function computeAddonPlanV2(contract: PlanningContract, lines: EquipmentLine[], opts: AddonPlanV2Options): AddonPlanV2 {
  const cadence = addonCadence(contract, opts.steps)
  const coverage = opts.coverage ?? []
  const monthlyLines = lines.filter((l) => addonCadenceFor(l, contract, opts.steps) === 'monthly')
  const normalized = lines.filter((l) => !monthlyLines.includes(l)).map(normalizeV2Line)
  // Egna månadsfakturor: kalendermånader (exakt avtalsdag: månader från
  // avtalsdagen) från innevarande månad, täckta stationer dras av
  const monthly = monthlyLines.length
    ? computePlannedMonthlyEquipmentPeriods(contract, {
        paymentTermsDays: opts.paymentTermsDays,
        today: opts.today,
        window: opts.window,
        horizonEnd: opts.horizonEnd,
        equipment: monthlyLines,
      })
        .map((p) => decorateV2Period(p, monthlyLines, coverage, opts.fallbackMarking))
        .filter((p) => p.equipmentRows.length > 0)
    : []
  if (cadence === 'with_premium') return { cadence, premiumEquipment: normalized, groups: [], monthlyLines, monthly }

  const variant: PlanningContract =
    cadence === 'anniversary'
      ? { ...contract, billing_frequency: 'annual', billing_anchor_mode: 'start_day', annual_value: 0 }
      : contract
  const steps = cadence === 'anniversary' ? [] : opts.steps

  const byKey = new Map<string, { marking: string | null; lines: EquipmentLine[] }>()
  for (const l of normalized) {
    const key = opts.split ? markingKey(l.marking ?? null) : ''
    const slot = byKey.get(key) ?? { marking: opts.split ? (l.marking ?? null) : opts.fallbackMarking, lines: [] }
    slot.lines.push(l)
    byKey.set(key, slot)
  }

  const groups: AddonMarkingGroup[] = []
  for (const [key, g] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const raw = computePlannedEquipmentPeriods(variant, {
      paymentTermsDays: opts.paymentTermsDays,
      leadDays: opts.leadDays,
      today: opts.today,
      window: opts.window,
      horizonEnd: opts.horizonEnd,
      steps,
      equipment: g.lines,
    })
    const periods = raw
      .map((p) => decorateV2Period(p, g.lines, coverage, g.marking))
      .filter((p) => p.equipmentRows.length > 0)
      .map((p) => ({ ...p, amount: 0, subtotal: p.subtotal, kind: 'equipment' as const }))
    groups.push({ marking: g.marking, markingKey: key, lines: g.lines, periods })
  }
  return { cadence, premiumEquipment: [], groups, monthlyLines, monthly }
}

/** Med v2-rader (enhetens namn finns) ska fakturaraderna få v2-text. */
export function isV2Row(r: Pick<PlannedEquipmentRow, 'unit_name'>): boolean {
  return r.unit_name !== undefined
}

/** Radtexten i v2: "Ljusfälla, Återvinningscentralen, tillägg utöver avtal X, period, 2 st". */
export function v2AddonRowName(
  eq: Pick<PlannedEquipmentRow, 'name' | 'unit_name' | 'unit_marking' | 'quantity' | 'billed_period'>,
  label: string | null,
  period: string
): string {
  // Delvis täckt station: bara den fakturerade delen av perioden
  if (eq.billed_period) period = `${eq.billed_period.from} t.o.m. ${eq.billed_period.to}`
  const unit = eq.unit_name ? `, ${eq.unit_name}` : ''
  const ref = eq.unit_marking ? `, ref ${eq.unit_marking}` : ''
  return `${eq.name}${unit}${ref}, tillägg utöver avtal${label ? ` ${label}` : ''}, ${period}, ${eq.quantity} st`
}

// ─── Fördelning av befintliga fakturor på märkningsgrupper ─────────────────

export type MarkedInvoice = MatchableInvoice & { marking_key?: string | null }

/**
 * Befintliga tilläggsfakturor per märkningsnyckel. En faktura med
 * marking_key hör till sin grupp (finns ingen planerad grupp blir den en egen
 * grupp utan plan, alltså radering eller låst). Fakturor utan marking_key
 * (dagens, en per avtal): låsta och Fortnox-importer gäller alla grupper
 * (perioden är redan fakturerad för hela avtalet), ett redigerbart utkast går
 * till EN grupp: den utan märkning om den finns, annars den första.
 */
export function existingByMarkingGroup(plannedKeys: string[], existing: MarkedInvoice[]): Map<string, MarkedInvoice[]> {
  const keys = [...new Set(plannedKeys)].sort()
  const out = new Map<string, MarkedInvoice[]>(keys.map((k) => [k, []]))
  const add = (k: string, e: MarkedInvoice) => {
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(e)
  }
  const editableHome = keys.includes('') ? '' : (keys[0] ?? '')
  for (const e of existing) {
    const k = e.marking_key ? markingKey(e.marking_key) : null
    if (k !== null) {
      add(k, e)
      continue
    }
    const isImport = (e.invoice_number ?? '').startsWith('F-') || e.is_historical === true
    if (!isImport && EDITABLE_STATUSES.has(e.status ?? 'draft')) {
      add(editableHome, e)
      continue
    }
    if (keys.length === 0) add('', e)
    for (const key of keys) add(key, e)
  }
  return out
}

/** Samma låsta faktura utan plan kan hamna i flera grupper: visa den en gång. */
export function dedupeLockedWithoutPlan<T extends { action: string; existingId?: string; planned?: unknown }>(entries: T[]): T[] {
  const seen = new Set<string>()
  return entries.filter((e) => {
    if (e.planned || !e.existingId || e.action !== 'locked') return true
    if (seen.has(e.existingId)) return false
    seen.add(e.existingId)
    return true
  })
}

// ─── Glappfakturor ─────────────────────────────────────────────────────────

/** En rad ur addon_gap_candidates (SQL). */
export interface GapCandidate {
  station_kind: string
  station_id: string
  unit_id: string
  unit_name: string | null
  station_type_id: string | null
  type_name: string | null
  model: string | null
  annual: number | null
  start_day: string
  gap_from: string
  gap_to: string
  days: number
  end_day: string
  marking_key: string
  on_open_gap_invoice: string | null
}

export interface GapGroup {
  marking: string | null
  markingKey: string
  period: PlannedPeriod
  /** Stationer utan årspris (kan inte prissättas) */
  missingPrice: string[]
}

export const GAP_YEAR_DAYS = 365

/**
 * Glappfakturor: en per märkning och glapp (samma första dag och sista dag),
 * så att täckningen som skrivs vid sändning börjar där glappet börjar. En rad
 * per enhet och stationstyp, à-pris = årspris × medeldagar / 365 (samma
 * formel som pro rata i SQL). Fakturadatum idag.
 */
export function planGapGroups(
  candidates: GapCandidate[],
  opts: {
    today: string
    paymentTermsDays?: number
    markingFor: (key: string) => string | null
    codeFor?: (unitId: string, stationTypeId: string | null) => string | null
  }
): GapGroup[] {
  const groups = new Map<string, GapCandidate[]>()
  for (const c of candidates) {
    const k = `${c.marking_key}|${c.gap_from}|${c.gap_to}`
    groups.set(k, [...(groups.get(k) ?? []), c])
  }
  const out: GapGroup[] = []
  const due = toLocalIsoDate(new Date(parseLocalDate(opts.today).getTime() + (opts.paymentTermsDays ?? 30) * DAY + 12 * 3_600_000))
  for (const [k, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [key, from, to] = k.split('|')
    const missingPrice = list.filter((c) => !(Number(c.annual) > 0)).map((c) => c.station_id)
    const rowsBy = new Map<string, GapCandidate[]>()
    for (const c of list) {
      if (!(Number(c.annual) > 0)) continue
      const rk = `${c.unit_id}|${c.station_type_id ?? ''}|${Number(c.annual)}`
      rowsBy.set(rk, [...(rowsBy.get(rk) ?? []), c])
    }
    const rows: PlannedEquipmentRow[] = [...rowsBy.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rk, cs]) => {
        const annual = Number(cs[0].annual)
        const avgDays = cs.reduce((s, c) => s + c.days, 0) / cs.length
        const unit = round2((annual * avgDays) / GAP_YEAR_DAYS)
        return {
          source_id: `gap:${rk}`,
          contract_id: null,
          name: cs[0].type_name ?? 'Tilläggsstation',
          code: opts.codeFor?.(cs[0].unit_id, cs[0].station_type_id) ?? null,
          quantity: cs.length,
          unit_price: unit,
          total_price: round2(unit * cs.length),
          vat_rate: 25,
          unit_name: cs[0].unit_name ?? null,
          station_ids: cs.map((c) => c.station_id).sort(),
        }
      })
    if (rows.length === 0 && missingPrice.length === 0) continue
    const base: PlannedPeriod = {
      kind: 'equipment_gap',
      periodStart: from,
      periodEnd: to,
      amount: 0,
      annualInForce: 0,
      equipmentRows: [],
      subtotal: 0,
      vatAmount: 0,
      totalAmount: 0,
      invoiceDate: opts.today,
      dueDate: due,
      isHistorical: false,
      sequenceNumber: 1,
      totalSequenceCount: 1,
    }
    out.push({ marking: opts.markingFor(key), markingKey: key, period: totals(base, rows), missingPrice })
  }
  return out
}

export function gapRowName(eq: Pick<PlannedEquipmentRow, 'name' | 'unit_name' | 'quantity'>, period: string): string {
  return `${eq.name}${eq.unit_name ? `, ${eq.unit_name}` : ''}, tillägg från utsättning, ${period}, ${eq.quantity} st`
}

export const GAP_INVOICE_NOTE = 'Tilläggsstationer från utsättning till nästa periodstart'

/**
 * Diff för glappfakturor: exakt samma märkning, första och sista dag. Ett
 * matchat utkast behålls (eller uppdateras om beloppet ändrats), övriga
 * utkast raderas, låsta lämnas. Ingen överlappsregel: två glapp för olika
 * stationer kan överlappa helt.
 */
export function buildGapDiff(planned: GapGroup[], existing: MarkedInvoice[]): Array<ContractDiffEntry & { gap?: GapGroup }> {
  const used = new Set<string>()
  const out: Array<ContractDiffEntry & { gap?: GapGroup }> = []
  // Makulerade glappfakturor är historik: varken matchas, ändras eller raderas
  const live = existing.filter((e) => e.status !== 'cancelled')
  for (const g of planned) {
    const ex = live.find(
      (e) =>
        !used.has(e.id) &&
        markingKey(e.marking_key ?? '') === g.markingKey &&
        e.billing_period_start === g.period.periodStart &&
        (e.billing_period_end ?? e.billing_period_start) === g.period.periodEnd
    )
    if (!ex) {
      out.push({ action: 'create', planned: g.period, gap: g })
      continue
    }
    used.add(ex.id)
    const status = ex.status ?? 'draft'
    const base = { planned: g.period, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, gap: g }
    if (LOCKED_STATUSES.has(status)) out.push({ ...base, action: 'locked', reason: 'Glappfakturan är redan skickad' })
    else out.push({ ...base, action: Math.abs(Number(ex.subtotal) - g.period.subtotal) < 0.5 ? 'keep' : 'update' })
  }
  for (const e of live) {
    if (used.has(e.id)) continue
    const status = e.status ?? 'draft'
    if (isAutoDeletable(e)) {
      out.push({ action: 'delete', existingId: e.id, existingStatus: status, existingAmount: e.total_amount, existingSubtotal: e.subtotal, reason: 'Glappet finns inte längre' })
    }
  }
  return out
}

/** Märkningen för en grupp: enhetens referens om den finns på någon rad, annars avtalets regel. */
export function markingForUnit(
  unit: { billing_reference?: string | null } | null | undefined,
  contract: { invoice_reference?: string | null },
  root: { billing_reference?: string | null } | null | undefined
): string | null {
  return addonMarkingFor(unit, contract, root)
}
