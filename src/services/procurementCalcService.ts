// src/services/procurementCalcService.ts
// Anbudskalkylen (verktyg 1 i planen): volymer in, kostnad ut, golvpris vid
// minmarginal, målpris vid målmarginal, vinnande band mot kända anbud och
// förväntat täckningsbidrag vid olika priser.
//
// All marginal räknas i src/shared/marginEngine.ts. Kalkylen bygger samma
// radtyper som ett avtal (arbetstid som artikel i kategorin Arbetstid,
// förbrukning, varaktig utrustning med is_durable) och låter motorn räkna.
// Arbetstidsspärren (0,5 h per besök) gäller därför även här.
//
// Pris i kalkylen är alltid ÅRSPRIS exkl. moms. Varaktig utrustning fördelas
// över avtalstiden när golv och mål räknas, eftersom ett anbud gäller hela
// avtalsperioden (till skillnad från rullande avtal i marginEngine).

import {
  MIN_LABOUR_HOURS_PER_VISIT,
  summarizeBillingLines,
  type MarginBreakdown,
  type MarginLine,
  type MarginSettings,
} from '../shared/marginEngine'
import { estimateWinProbability } from '../shared/procurementRules'
import type { ProcurementAward } from '../types/procurement'

/** Internt timpris för arbetstid (artikeln Arbetstid Företag) */
export const DEFAULT_HOURLY_COST = 1016

export interface CalcInput {
  /** Antal objekt/fastigheter i underlaget */
  objects: number
  /** Planerade besök per objekt och år */
  visitsPerObjectPerYear: number
  /** Timmar på plats per besök */
  hoursPerVisit: number
  /** Restid per besök i timmar */
  travelHoursPerVisit: number
  /** Akuta utryckningar per år totalt */
  calloutsPerYear: number
  hoursPerCallout: number
  /** Förbrukning (bete, gift, lim) per besök i kr */
  consumablesPerVisit: number
  /** Varaktig utrustning: antal stationer/fällor och inköp per styck */
  durableUnits: number
  durableUnitCost: number
  /** Internt timpris */
  hourlyCost: number
  /** Avtalstid inklusive förlängningar i år */
  contractYears: number
  /** Förväntat antal ANDRA anbudsgivare (köparens historik, annars median 2) */
  expectedOtherBids: number | null
  criteriaType: string | null
  /** Egen historik */
  ownWins?: number
  ownBids?: number
  /** Känt prisband per år ur tilldelningar (lägsta och högsta kända anbud) */
  bandLow?: number | null
  bandHigh?: number | null
  /** Lämnat eller planerat årspris att utvärdera */
  plannedPrice?: number | null
}

export const DEFAULT_CALC_INPUT: CalcInput = {
  objects: 10,
  visitsPerObjectPerYear: 4,
  hoursPerVisit: 1,
  travelHoursPerVisit: 0.25,
  calloutsPerYear: 0,
  hoursPerCallout: 1.5,
  consumablesPerVisit: 50,
  durableUnits: 0,
  durableUnitCost: 150,
  hourlyCost: DEFAULT_HOURLY_COST,
  contractYears: 4,
  expectedOtherBids: null,
  criteriaType: null,
  bandLow: null,
  bandHigh: null,
  plannedPrice: null,
}

export interface CalcScenario {
  label: string
  price: number
  breakdown: MarginBreakdown
  /** Täckningsbidrag per år (pris minus löpande kostnad) */
  contributionPerYear: number
  /** Täckningsbidrag över hela avtalet, efter utrustningen */
  contributionContract: number
  probability: number
  /** Sannolikhet gånger TB över avtalet */
  expectedContribution: number
  belowFloor: boolean
}

export interface CalcResult {
  visitsPerYear: number
  labourHours: number
  labourCost: number
  consumableCost: number
  /** Löpande kostnad per år */
  annualCost: number
  durableCost: number
  /** Löpande kostnad plus utrustningen fördelad över avtalstiden */
  annualCostWithDurable: number
  floorPrice: number
  targetPrice: number
  baseProbability: number
  expectedBids: number
  scenarios: CalcScenario[]
  best: CalcScenario | null
  labourWarning: string | null
  settings: MarginSettings
}

const round = (n: number, step = 100) => Math.round(n / step) * step

function linesFor(input: CalcInput, price: number): MarginLine[] {
  const visits = input.objects * input.visitsPerObjectPerYear
  const hours = visits * (input.hoursPerVisit + input.travelHoursPerVisit) + input.calloutsPerYear * input.hoursPerCallout
  const lines: MarginLine[] = [
    { item_type: 'service', total_price: price, quantity: 1, article_name: 'Årspris' },
    {
      item_type: 'article',
      total_price: hours * input.hourlyCost,
      quantity: hours,
      article_name: 'Arbetstid',
      article: { is_durable: false, category: 'Arbetstid' },
    },
    {
      item_type: 'article',
      total_price: visits * input.consumablesPerVisit,
      quantity: visits,
      article_name: 'Förbrukning',
      article: { is_durable: false, category: 'Bekämpning' },
    },
  ]
  if (input.durableUnits > 0) {
    lines.push({
      item_type: 'article',
      total_price: input.durableUnits * input.durableUnitCost,
      quantity: input.durableUnits,
      article_name: 'Stationer och fällor',
      article: { is_durable: true, category: 'Bekämpning' },
    })
  }
  return lines
}

/**
 * Sannolikhet vid ett visst pris. Basen är 1 delat med förväntat antal anbud
 * (estimateWinProbability). Kända anbud flyttar den: under lägsta kända anbud
 * ökar chansen, över högsta minskar den kraftigt. Vid kvalitetsutvärdering
 * väger priset hälften så mycket.
 */
export function probabilityAtPrice(price: number, base: number, input: Pick<CalcInput, 'bandLow' | 'bandHigh' | 'criteriaType'>, targetPrice: number): number {
  let factor = 1
  const low = input.bandLow ?? null
  const high = input.bandHigh ?? null
  if (low != null && high != null && high >= low && low > 0) {
    if (price <= low) factor = 1.4
    else if (price <= high) factor = 1.4 - 0.6 * ((price - low) / Math.max(1, high - low))
    else factor = 0.4
  } else if (targetPrice > 0) {
    const rel = price / targetPrice
    factor = rel <= 1 ? 1 + Math.min(0.3, (1 - rel) * 1.5) : Math.max(0.3, 1 - (rel - 1) * 1.5)
  }
  if (input.criteriaType === 'quality' || input.criteriaType === 'mixed') factor = 1 + (factor - 1) / 2
  return Math.min(0.85, Math.max(0.01, base * factor))
}

export class ProcurementCalcService {
  /** Hela kalkylen. Ren funktion, inga databasanrop. */
  static calculate(input: CalcInput, settings: MarginSettings): CalcResult {
    const years = Math.max(1, input.contractYears || 1)
    const zero = summarizeBillingLines(linesFor(input, 0), {
      context: 'contract',
      settings,
      visitsPerYear: input.objects * input.visitsPerObjectPerYear,
    })
    const annualCost = zero.cost_ongoing
    const durableCost = zero.cost_durable
    const annualCostWithDurable = annualCost + durableCost / years
    const minM = Math.min(95, Math.max(0, settings.min_margin_percent)) / 100
    const tgtM = Math.min(95, Math.max(0, settings.target_margin_percent)) / 100
    const floorPrice = annualCostWithDurable / (1 - minM)
    const targetPrice = annualCostWithDurable / (1 - tgtM)

    const prob = estimateWinProbability({
      expectedOtherBids: input.expectedOtherBids,
      criteriaType: input.criteriaType,
      ownWins: input.ownWins,
      ownBids: input.ownBids,
    })

    const candidates: Array<{ label: string; price: number }> = [
      { label: 'Golv', price: floorPrice },
      { label: 'Mellan', price: (floorPrice + targetPrice) / 2 },
      { label: 'Mål', price: targetPrice },
      { label: 'Mål +10 %', price: targetPrice * 1.1 },
      { label: 'Mål +20 %', price: targetPrice * 1.2 },
    ]
    if (input.bandLow && input.bandLow > 0) candidates.push({ label: 'Lägsta kända', price: input.bandLow })
    if (input.bandHigh && input.bandHigh > 0 && input.bandHigh !== input.bandLow) candidates.push({ label: 'Högsta kända', price: input.bandHigh })
    if (input.plannedPrice && input.plannedPrice > 0) candidates.push({ label: 'Vårt pris', price: input.plannedPrice })

    const scenarios: CalcScenario[] = candidates
      .filter((c) => Number.isFinite(c.price) && c.price > 0)
      .map((c) => {
        const price = c.label === 'Vårt pris' ? c.price : Math.max(0, round(c.price))
        const breakdown = summarizeBillingLines(linesFor(input, price), {
          context: 'contract',
          settings,
          revenueOverride: price,
          visitsPerYear: input.objects * input.visitsPerObjectPerYear,
        })
        const contributionPerYear = price - annualCost
        const contributionContract = contributionPerYear * years - durableCost
        const probability = probabilityAtPrice(price, prob.probability, input, targetPrice)
        return {
          label: c.label,
          price,
          breakdown,
          contributionPerYear,
          contributionContract,
          probability,
          expectedContribution: probability * Math.max(0, contributionContract),
          belowFloor: price < floorPrice - 1,
        }
      })
      .sort((a, b) => a.price - b.price)

    const eligible = scenarios.filter((s) => !s.belowFloor)
    const best = eligible.reduce<CalcScenario | null>((acc, s) => (!acc || s.expectedContribution > acc.expectedContribution ? s : acc), null)

    const visitsPerYear = input.objects * input.visitsPerObjectPerYear
    const labourHours = zero.labour_hours
    const labourWarning =
      visitsPerYear > 0 && labourHours < visitsPerYear * MIN_LABOUR_HOURS_PER_VISIT
        ? `Arbetstiden är under ${String(MIN_LABOUR_HOURS_PER_VISIT).replace('.', ',')} timmar per besök`
        : null

    return {
      visitsPerYear,
      labourHours,
      labourCost: zero.labour_cost,
      consumableCost: zero.consumable_cost,
      annualCost,
      durableCost,
      annualCostWithDurable,
      floorPrice,
      targetPrice,
      baseProbability: prob.probability,
      expectedBids: prob.expectedBids,
      scenarios,
      best,
      labourWarning,
      settings,
    }
  }

  /**
   * Prisband per år ur kända tilldelningar. Bara verkliga anbudspriser
   * (lägsta och högsta anbud, eller värde av arten actual) räknas: ramtak är
   * inte vinnande pris. Totalpris delas med avtalstiden (start till slut,
   * annars fyra år).
   */
  static bandFromAwards(awards: Array<Pick<ProcurementAward, 'lowest_bid' | 'highest_bid' | 'value' | 'value_kind' | 'contract_start' | 'contract_end' | 'calc_end_date'>>): { low: number | null; high: number | null; samples: number } {
    const perYear: number[] = []
    for (const a of awards) {
      const start = a.contract_start ? new Date(a.contract_start) : null
      const end = a.contract_end ?? a.calc_end_date
      const years = start && end ? Math.max(1, (new Date(end).getTime() - start.getTime()) / (365.25 * 86400000)) : 4
      if (a.lowest_bid) perYear.push(Number(a.lowest_bid) / years)
      if (a.highest_bid) perYear.push(Number(a.highest_bid) / years)
      if (!a.lowest_bid && !a.highest_bid && a.value_kind === 'actual' && a.value) perYear.push(Number(a.value) / years)
    }
    if (perYear.length === 0) return { low: null, high: null, samples: 0 }
    return { low: Math.min(...perYear), high: Math.max(...perYear), samples: perYear.length }
  }

  /** Förslag på indata ur upphandlingens volymer och avtalstid */
  static inputFromNotice(notice: {
    volumes?: { objects?: number | null; apartments?: number | null; visits_per_year?: number | null; stations?: number | null; callouts_per_year?: number | null } | null
    duration_months?: number | null
    renewal_max?: number | null
    criteria_type?: string | null
    expected_bids?: number | null
  }): Partial<CalcInput> {
    const v = notice.volumes ?? {}
    const objects = v.objects ?? (v.apartments ? Math.max(1, Math.round(v.apartments / 40)) : null)
    const out: Partial<CalcInput> = {}
    if (objects) out.objects = objects
    if (objects && v.visits_per_year) out.visitsPerObjectPerYear = Math.max(1, Math.round((v.visits_per_year / objects) * 10) / 10)
    if (v.stations) out.durableUnits = v.stations
    if (v.callouts_per_year) out.calloutsPerYear = v.callouts_per_year
    if (notice.duration_months) out.contractYears = Math.max(1, notice.duration_months / 12 + (notice.renewal_max ?? 0))
    out.criteriaType = notice.criteria_type ?? null
    if (notice.expected_bids && notice.expected_bids > 1) out.expectedOtherBids = notice.expected_bids - 1
    return out
  }
}
