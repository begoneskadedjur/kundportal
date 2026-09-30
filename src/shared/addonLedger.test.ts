import { describe, it, expect } from 'vitest'
import { computeAddonLedger, ledgerRowKey, type LedgerStationInput } from './addonLedger'
import { computeAddonCalc } from './addonEconomics'

const DAY = 86_400_000
const YEAR = 365.25 * DAY

const station = (over: Partial<LedgerStationInput> = {}): LedgerStationInput => ({
  station_id: 's1',
  kind: 'outdoor',
  unit_id: 'u1',
  unit_name: 'Gonäs Reningsverk',
  station_type_id: 't1',
  station_type_name: 'Aurotrap',
  article_name: 'Aurotrap',
  start_at: '2026-09-07T00:00:00Z',
  removed_at: null,
  unit_price_annual: 2348,
  unit_cost: 3550,
  billing_model: 'per_year',
  ...over,
})

const labour = (over: Partial<LedgerStationInput> = {}): LedgerStationInput => ({
  station_id: 'l1',
  kind: 'labour',
  unit_id: 'u1',
  unit_name: 'Gonäs Reningsverk',
  station_type_id: null,
  station_type_name: 'Arbetstid för att hantera tilläggen',
  article_name: 'Arbetstid Företag',
  start_at: '2026-09-07T00:00:00Z',
  removed_at: null,
  unit_price_annual: 1064,
  unit_cost: 0,
  billing_model: 'per_year',
  labour_hours: 2,
  labour_rate: 532,
  labour_cost_per_hour: 1016,
  ...over,
})

const start = Date.parse('2026-09-07T00:00:00Z')

describe('computeAddonLedger, stationer', () => {
  it('räknar som förut utan arbetstid', () => {
    const l = computeAddonLedger([station()], { today: start + YEAR, contractEnd: null, optionEnd: null })
    expect(l.labour).toEqual([])
    expect(l.totals.labour).toBeNull()
    expect(l.totals.revenueToDate).toBeCloseTo(2348, 0)
    expect(l.totals.resultToDate).toBeCloseTo(2348 - 3550, 0)
    expect(l.stations[0].breakEvenAt).toBeCloseTo(start + (3550 / 2348) * YEAR, -3)
  })
})

describe('computeAddonLedger, arbetstid för att hantera tilläggen', () => {
  it('löpande intäkt och löpande kostnad per år, ingen engångskostnad', () => {
    const l = computeAddonLedger([station(), labour()], { today: start + YEAR, contractEnd: null, optionEnd: null })
    expect(l.stations).toHaveLength(1)
    expect(l.labour).toHaveLength(1)
    const ll = l.labour[0]
    expect(ll.annualRevenue).toBe(1064)
    expect(ll.annualCost).toBe(2032)
    expect(ll.annualNet).toBe(-968)
    expect(ll.revenueToDate).toBeCloseTo(1064, 0)
    expect(ll.costToDate).toBeCloseTo(2032, 0)
    expect(l.labourByUnit.get('u1')?.id).toBe('l1')
    // Arbetstiden är ingen station och ingen engångskostnad
    expect(l.totals.count).toBe(1)
    expect(l.totals.cost).toBe(3550)
    expect(l.totals.annualRunRate).toBe(2348)
    // Tilläggets resultat = stationerna + arbetstidens netto
    expect(l.totals.resultToDate).toBeCloseTo(2348 - 3550 - 968, 0)
    expect(l.totals.labour?.resultToDate).toBeCloseTo(-968, 0)
    // § 5-raden per stationstyp räknar bara stationerna
    expect(l.byRow.get(ledgerRowKey('u1', 't1'))?.resultToDate).toBeCloseTo(2348 - 3550, 0)
  })

  it('årsbeloppen är desamma som i tilläggets kalkyl', () => {
    const l = computeAddonLedger([labour({ labour_hours: '2.5' })], { today: start, contractEnd: null, optionEnd: null })
    const calc = computeAddonCalc({
      equipmentCost: 0,
      annualStationRevenue: 0,
      labourHours: 2.5,
      labourRate: 532,
      labourCostPerHour: 1016,
      firstPeriodRevenue: 0,
      firstPeriodFraction: 0,
      startDate: null,
    })
    expect(l.labour[0].annualRevenue).toBe(calc.annualLabourRevenue)
    expect(l.labour[0].annualCost).toBe(calc.annualLabourCost)
  })

  it('löper till avtalsslutet och vidare med option', () => {
    const l = computeAddonLedger([labour()], { today: start, contractEnd: '2028-06-29', optionEnd: '2030-06-29' })
    const years = (Date.parse('2028-06-29') + DAY - start) / YEAR
    expect(l.labour[0].revenueToEnd).toBeCloseTo(1064 * years, 0)
    expect(l.labour[0].costToEnd).toBeCloseTo(2032 * years, 0)
    const optYears = (Date.parse('2030-06-29') + DAY - start) / YEAR
    expect(l.labour[0].resultToOption).toBeCloseTo(-968 * optYears, 0)
    expect(l.totals.resultToOption).toBeCloseTo(-968 * optYears, 0)
  })

  it('brytpunkten flyttas när arbetstiden går back', () => {
    const without = computeAddonLedger([station()], { today: start, contractEnd: null, optionEnd: null })
    const withLabour = computeAddonLedger([station(), labour()], { today: start, contractEnd: null, optionEnd: null })
    expect(without.totals.breakEvenAt).not.toBeNull()
    expect(withLabour.totals.breakEvenAt).not.toBeNull()
    // 3 550 / (2 348 - 968) per år ≈ 2,57 år
    expect(((withLabour.totals.breakEvenAt as number) - start) / YEAR).toBeCloseTo(3550 / (2348 - 968), 1)
    expect(withLabour.totals.breakEvenAt as number).toBeGreaterThan(without.totals.breakEvenAt as number)
  })

  it('aldrig brytpunkt när arbetstiden äter upp stationernas intäkt', () => {
    const l = computeAddonLedger([station(), labour({ labour_hours: 4 })], { today: start, contractEnd: null, optionEnd: null })
    // 2 348 - 4 × (1 016 - 532) = 412 kr/år, 3 550 kr tar ca 8,6 år
    expect(l.totals.breakEvenAt).not.toBeNull()
    const never = computeAddonLedger([station(), labour({ labour_hours: 5 })], { today: start, contractEnd: null, optionEnd: null })
    expect(never.totals.breakEvenAt).toBeNull()
  })

  it('saknat timpris ger ingen intäkt men kostnaden räknas', () => {
    const l = computeAddonLedger([labour({ labour_rate: null })], { today: start + YEAR, contractEnd: null, optionEnd: null })
    expect(l.labour[0].priceMissing).toBe(true)
    expect(l.labour[0].annualRevenue).toBe(0)
    expect(l.labour[0].costToDate).toBeCloseTo(2032, 0)
  })
})
