// src/shared/addonLedger.ts
// Tilläggsstationer som resultat över tid. Kostnaden tas en gång (inköpet),
// intäkten löper från beslutet så länge stationen är ute. Plockas den bort
// låses resultatet på borttagningsdatumet och räknas aldrig upp igen.
// Ren funktion: läser stationsrader från contract_addon_ledger(), ingen DB.
//
// Delas av § 5, § 6 och pulsen så de aldrig säger olika.

const DAY = 86_400_000
const YEAR_DAYS = 365.25

export interface LedgerStationInput {
  station_id: string
  kind: 'outdoor' | 'indoor'
  unit_id: string
  unit_name: string | null
  station_type_id: string | null
  station_type_name: string | null
  article_name: string | null
  start_at: string
  removed_at: string | null
  unit_price_annual: number | string | null
  unit_cost: number | string | null
  billing_model: string | null
}

export interface LedgerStation {
  id: string
  kind: 'outdoor' | 'indoor'
  unitId: string
  unitName: string
  stationTypeId: string | null
  stationTypeName: string
  articleName: string | null
  startAt: number
  removedAt: number | null
  annualPrice: number | null
  cost: number
  /** Intäkt från start till i dag (eller borttagning) */
  revenueToDate: number
  resultToDate: number
  /** Intäkt och resultat till avtalsslutet (eller borttagning) */
  revenueToEnd: number
  resultToEnd: number
  /** Med option, null om avtalet saknar option */
  resultToOption: number | null
  /** Dagen intäkten passerar inköpet, null om aldrig (borttagen för tidigt, pris saknas) */
  breakEvenAt: number | null
  removed: boolean
  priceMissing: boolean
}

export interface LedgerTotals {
  count: number
  removed: number
  priceMissing: number
  cost: number
  revenueToDate: number
  resultToDate: number
  revenueToEnd: number
  resultToEnd: number
  resultToOption: number | null
  /** Dagen summan av intäkter passerar summan av inköp, null om aldrig */
  breakEvenAt: number | null
  annualRunRate: number
}

export interface AddonLedger {
  stations: LedgerStation[]
  totals: LedgerTotals
  /** Per stationstyp (namn) */
  byType: Array<{ stationTypeName: string; totals: LedgerTotals }>
  /** Per § 6-rad: enhet + stationstyp */
  byRow: Map<string, LedgerTotals>
  horizon: { today: number; contractEnd: number | null; optionEnd: number | null }
}

export const ledgerRowKey = (unitId: string, stationTypeId: string | null) => `${unitId}|${stationTypeId ?? ''}`

const num = (v: number | string | null | undefined) => (v == null || v === '' ? 0 : Number(v))

function revenueBetween(annual: number, from: number, to: number): number {
  if (to <= from) return 0
  return (annual * (to - from)) / DAY / YEAR_DAYS
}

function sumTotals(list: LedgerStation[], horizon: AddonLedger['horizon']): LedgerTotals {
  const cost = list.reduce((s, x) => s + x.cost, 0)
  const revenueToDate = list.reduce((s, x) => s + x.revenueToDate, 0)
  const revenueToEnd = list.reduce((s, x) => s + x.revenueToEnd, 0)
  const hasOption = horizon.optionEnd != null
  const resultToOption = hasOption ? list.reduce((s, x) => s + (x.resultToOption ?? x.resultToEnd), 0) : null
  // Aggregerad brytpunkt: gå dag för dag i månadssteg tills intäkten passerar inköpet
  let breakEvenAt: number | null = null
  const active = list.filter((x) => x.annualPrice != null && x.annualPrice > 0)
  if (cost > 0 && active.length > 0) {
    const start = Math.min(...active.map((x) => x.startAt))
    const step = 7 * DAY
    const limit = start + 15 * YEAR_DAYS * DAY
    for (let t = start; t <= limit; t += step) {
      const rev = active.reduce((s, x) => s + revenueBetween(x.annualPrice as number, x.startAt, Math.min(t, x.removedAt ?? t)), 0)
      if (rev >= cost) {
        breakEvenAt = t
        break
      }
    }
  }
  return {
    count: list.length,
    removed: list.filter((x) => x.removed).length,
    priceMissing: list.filter((x) => x.priceMissing).length,
    cost,
    revenueToDate,
    resultToDate: revenueToDate - cost,
    revenueToEnd,
    resultToEnd: revenueToEnd - cost,
    resultToOption,
    breakEvenAt,
    annualRunRate: list.filter((x) => !x.removed).reduce((s, x) => s + (x.annualPrice ?? 0), 0),
  }
}

export function computeAddonLedger(
  rows: LedgerStationInput[],
  opts: { today?: number; contractEnd: string | null; optionEnd: string | null }
): AddonLedger {
  const today = opts.today ?? Date.now()
  const contractEnd = opts.contractEnd ? Date.parse(opts.contractEnd) + DAY : null
  const optionEnd = opts.optionEnd ? Date.parse(opts.optionEnd) + DAY : null
  const horizon = { today, contractEnd, optionEnd }
  const endHorizon = contractEnd ?? today

  const stations: LedgerStation[] = rows.map((r) => {
    const startAt = Date.parse(r.start_at)
    const removedAt = r.removed_at ? Date.parse(r.removed_at) : null
    const annualRaw = num(r.unit_price_annual)
    const annual = annualRaw > 0 ? annualRaw : null
    const cost = num(r.unit_cost)
    const stopToDate = Math.min(today, removedAt ?? today)
    const stopToEnd = Math.min(endHorizon, removedAt ?? endHorizon)
    const stopToOption = optionEnd != null ? Math.min(optionEnd, removedAt ?? optionEnd) : null
    const revenueToDate = annual ? revenueBetween(annual, startAt, stopToDate) : 0
    const revenueToEnd = annual ? revenueBetween(annual, startAt, Math.max(stopToEnd, stopToDate)) : 0
    const revenueToOption = annual && stopToOption != null ? revenueBetween(annual, startAt, Math.max(stopToOption, stopToDate)) : null
    let breakEvenAt: number | null = null
    if (annual && cost > 0) {
      const t = startAt + (cost / annual) * YEAR_DAYS * DAY
      breakEvenAt = removedAt != null && t > removedAt ? null : t
    } else if (annual && cost === 0) {
      breakEvenAt = startAt
    }
    return {
      id: r.station_id,
      kind: r.kind,
      unitId: r.unit_id,
      unitName: r.unit_name ?? 'Enhet',
      stationTypeId: r.station_type_id,
      stationTypeName: r.station_type_name ?? 'Station',
      articleName: r.article_name,
      startAt,
      removedAt,
      annualPrice: annual,
      cost,
      revenueToDate,
      resultToDate: revenueToDate - cost,
      revenueToEnd,
      resultToEnd: revenueToEnd - cost,
      resultToOption: revenueToOption != null ? revenueToOption - cost : null,
      breakEvenAt,
      removed: removedAt != null,
      priceMissing: annual == null,
    }
  })

  const byTypeMap = new Map<string, LedgerStation[]>()
  const byRowMap = new Map<string, LedgerStation[]>()
  for (const s of stations) {
    byTypeMap.set(s.stationTypeName, [...(byTypeMap.get(s.stationTypeName) ?? []), s])
    const k = ledgerRowKey(s.unitId, s.stationTypeId)
    byRowMap.set(k, [...(byRowMap.get(k) ?? []), s])
  }
  const byRow = new Map<string, LedgerTotals>()
  for (const [k, list] of byRowMap) byRow.set(k, sumTotals(list, horizon))

  return {
    stations,
    totals: sumTotals(stations, horizon),
    byType: [...byTypeMap.entries()]
      .map(([stationTypeName, list]) => ({ stationTypeName, totals: sumTotals(list, horizon) }))
      .sort((a, b) => b.totals.count - a.totals.count),
    byRow,
    horizon,
  }
}

/** "mars 2028" ur en tidpunkt, svensk månad */
export function formatMonthYearSv(t: number | null): string {
  if (t == null) return 'aldrig'
  return new Date(t).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' }).replace('.', '')
}
