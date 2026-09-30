// src/shared/addonLedger.ts
// Tilläggsstationer som resultat över tid. Kostnaden tas en gång (inköpet),
// intäkten löper från beslutet så länge stationen är ute. Plockas den bort
// låses resultatet på borttagningsdatumet och räknas aldrig upp igen.
// Ren funktion: läser stationsrader från contract_addon_ledger(), ingen DB.
//
// Arbetstid för att hantera tilläggen (kind = 'labour', en rad per enhet) är
// ingen engångskostnad: intäkten (timmar × kundens timpris) och kostnaden
// (timmar × Arbetstid Företag) löper båda per år från samma dag som
// stationerna och tills avtalet slutar. Årsbeloppen räknas med
// computeAddonCalc så ledgern och "Tilläggets kalkyl" aldrig säger olika.
// Timmarna saknar historik: nuvarande värde räknas från start.
//
// Delas av marginalnotisen, § 5 och pulsen så de aldrig säger olika.

import { computeAddonCalc } from './addonEconomics'

const DAY = 86_400_000
const YEAR_DAYS = 365.25

export interface LedgerStationInput {
  station_id: string
  kind: 'outdoor' | 'indoor' | 'labour'
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
  /** Bara arbetstid: timmar per år, kundens timpris, intern timkostnad */
  labour_hours?: number | string | null
  labour_rate?: number | string | null
  labour_cost_per_hour?: number | string | null
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

/** Arbetstid för att hantera tilläggen på en enhet: löpande intäkt och löpande kostnad */
export interface LedgerLabour {
  id: string
  unitId: string
  unitName: string
  costArticleName: string | null
  startAt: number
  hours: number
  rate: number | null
  costPerHour: number | null
  annualRevenue: number
  annualCost: number
  /** Intäkt minus kostnad per år (negativ = arbetstiden går back, accepterat) */
  annualNet: number
  revenueToDate: number
  costToDate: number
  resultToDate: number
  revenueToEnd: number
  costToEnd: number
  resultToEnd: number
  resultToOption: number | null
  priceMissing: boolean
}

export interface LedgerLabourTotals {
  hours: number
  annualRevenue: number
  annualCost: number
  annualNet: number
  revenueToDate: number
  costToDate: number
  resultToDate: number
  revenueToEnd: number
  costToEnd: number
  resultToEnd: number
  resultToOption: number | null
}

export interface LedgerTotals {
  /** Stationer (arbetstiden räknas inte som station) */
  count: number
  removed: number
  priceMissing: number
  /** Utrustning, en gång */
  cost: number
  /** Stationernas intäkt (arbetstidens ligger i labour) */
  revenueToDate: number
  /** Stationer och arbetstid: intäkter minus inköp minus arbetstidens kostnad */
  resultToDate: number
  revenueToEnd: number
  resultToEnd: number
  resultToOption: number | null
  /** Dagen stationernas intäkt plus arbetstidens netto passerar inköpet, null om aldrig */
  breakEvenAt: number | null
  /** Stationernas intäkt per år just nu */
  annualRunRate: number
  /** Arbetstiden för att hantera tilläggen, null om ingen */
  labour: LedgerLabourTotals | null
}

export interface AddonLedger {
  stations: LedgerStation[]
  /** Arbetstid per enhet (tom om ingen är beslutad) */
  labour: LedgerLabour[]
  totals: LedgerTotals
  /** Per stationstyp (namn), bara stationer */
  byType: Array<{ stationTypeName: string; totals: LedgerTotals }>
  /** Per § 5-rad: enhet + stationstyp, bara stationer */
  byRow: Map<string, LedgerTotals>
  /** Arbetstid per enhet (unitId) */
  labourByUnit: Map<string, LedgerLabour>
  horizon: { today: number; contractEnd: number | null; optionEnd: number | null }
}

export const ledgerRowKey = (unitId: string, stationTypeId: string | null) => `${unitId}|${stationTypeId ?? ''}`

const num = (v: number | string | null | undefined) => (v == null || v === '' ? 0 : Number(v))

function revenueBetween(annual: number, from: number, to: number): number {
  if (to <= from) return 0
  return (annual * (to - from)) / DAY / YEAR_DAYS
}

function sumLabour(list: LedgerLabour[], horizon: AddonLedger['horizon']): LedgerLabourTotals | null {
  if (list.length === 0) return null
  const sum = (f: (x: LedgerLabour) => number) => list.reduce((s, x) => s + f(x), 0)
  const annualRevenue = sum((x) => x.annualRevenue)
  const annualCost = sum((x) => x.annualCost)
  return {
    hours: sum((x) => x.hours),
    annualRevenue,
    annualCost,
    annualNet: annualRevenue - annualCost,
    revenueToDate: sum((x) => x.revenueToDate),
    costToDate: sum((x) => x.costToDate),
    resultToDate: sum((x) => x.resultToDate),
    revenueToEnd: sum((x) => x.revenueToEnd),
    costToEnd: sum((x) => x.costToEnd),
    resultToEnd: sum((x) => x.resultToEnd),
    resultToOption: horizon.optionEnd != null ? sum((x) => x.resultToOption ?? x.resultToEnd) : null,
  }
}

function sumTotals(list: LedgerStation[], horizon: AddonLedger['horizon'], labourList: LedgerLabour[] = []): LedgerTotals {
  const cost = list.reduce((s, x) => s + x.cost, 0)
  const revenueToDate = list.reduce((s, x) => s + x.revenueToDate, 0)
  const revenueToEnd = list.reduce((s, x) => s + x.revenueToEnd, 0)
  const hasOption = horizon.optionEnd != null
  const labour = sumLabour(labourList, horizon)
  const stationOption = hasOption ? list.reduce((s, x) => s + (x.resultToOption ?? x.resultToEnd), 0) : null
  const resultToOption = stationOption != null ? stationOption + (labour?.resultToOption ?? 0) : null
  // Aggregerad brytpunkt: gå i veckosteg tills stationernas intäkt plus
  // arbetstidens netto (intäkt minus kostnad, kan vara negativt) passerar inköpet
  let breakEvenAt: number | null = null
  const active = list.filter((x) => x.annualPrice != null && x.annualPrice > 0)
  const labourActive = labourList.filter((x) => x.annualNet !== 0)
  if (cost > 0 && active.length > 0) {
    const start = Math.min(...active.map((x) => x.startAt), ...labourActive.map((x) => x.startAt))
    const step = 7 * DAY
    const limit = start + 15 * YEAR_DAYS * DAY
    for (let t = start; t <= limit; t += step) {
      const rev =
        active.reduce((s, x) => s + revenueBetween(x.annualPrice as number, x.startAt, Math.min(t, x.removedAt ?? t)), 0) +
        labourActive.reduce((s, x) => s + revenueBetween(x.annualNet, x.startAt, t), 0)
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
    resultToDate: revenueToDate - cost + (labour?.resultToDate ?? 0),
    revenueToEnd,
    resultToEnd: revenueToEnd - cost + (labour?.resultToEnd ?? 0),
    resultToOption,
    breakEvenAt,
    annualRunRate: list.filter((x) => !x.removed).reduce((s, x) => s + (x.annualPrice ?? 0), 0),
    labour,
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

  const labour: LedgerLabour[] = rows
    .filter((r) => r.kind === 'labour')
    .map((r) => {
      const startAt = Date.parse(r.start_at)
      const hours = Math.max(num(r.labour_hours), 0)
      const rateRaw = num(r.labour_rate)
      const cphRaw = num(r.labour_cost_per_hour)
      // Samma årsbelopp som "Tilläggets kalkyl"
      const calc = computeAddonCalc({
        equipmentCost: 0,
        annualStationRevenue: 0,
        labourHours: hours,
        labourRate: rateRaw > 0 ? rateRaw : null,
        labourCostPerHour: cphRaw > 0 ? cphRaw : null,
        firstPeriodRevenue: 0,
        firstPeriodFraction: 0,
        startDate: null,
      })
      const annualRevenue = calc.annualLabourRevenue
      const annualCost = calc.annualLabourCost
      // Löper tills avtalet slutar. En nollad rad (0 h) kommer aldrig hit.
      const stopToEnd = Math.max(endHorizon, today)
      const stopToOption = optionEnd != null ? Math.max(optionEnd, today) : null
      const revenueToDate = revenueBetween(annualRevenue, startAt, today)
      const costToDate = revenueBetween(annualCost, startAt, today)
      const revenueToEnd = revenueBetween(annualRevenue, startAt, stopToEnd)
      const costToEnd = revenueBetween(annualCost, startAt, stopToEnd)
      return {
        id: r.station_id,
        unitId: r.unit_id,
        unitName: r.unit_name ?? 'Enhet',
        costArticleName: r.article_name,
        startAt,
        hours,
        rate: rateRaw > 0 ? rateRaw : null,
        costPerHour: cphRaw > 0 ? cphRaw : null,
        annualRevenue,
        annualCost,
        annualNet: annualRevenue - annualCost,
        revenueToDate,
        costToDate,
        resultToDate: revenueToDate - costToDate,
        revenueToEnd,
        costToEnd,
        resultToEnd: revenueToEnd - costToEnd,
        resultToOption: stopToOption != null ? revenueBetween(annualRevenue - annualCost, startAt, stopToOption) : null,
        priceMissing: !(rateRaw > 0),
      }
    })

  const stations: LedgerStation[] = rows
    .filter((r): r is LedgerStationInput & { kind: 'outdoor' | 'indoor' } => r.kind !== 'labour')
    .map((r) => {
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
  const labourByUnit = new Map<string, LedgerLabour>()
  for (const l of labour) labourByUnit.set(l.unitId, l)

  return {
    stations,
    labour,
    totals: sumTotals(stations, horizon, labour),
    byType: [...byTypeMap.entries()]
      .map(([stationTypeName, list]) => ({ stationTypeName, totals: sumTotals(list, horizon) }))
      .sort((a, b) => b.totals.count - a.totals.count),
    byRow,
    labourByUnit,
    horizon,
  }
}

/** "mars 2028" ur en tidpunkt, svensk månad */
export function formatMonthYearSv(t: number | null): string {
  if (t == null) return 'aldrig'
  return new Date(t).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' }).replace('.', '')
}
