import { describe, it, expect } from 'vitest'
import { DEFAULT_CALC_INPUT, ProcurementCalcService } from './procurementCalcService'

const settings = { min_margin_percent: 20, target_margin_percent: 35, max_payback_years: 2 }

describe('ProcurementCalcService.calculate', () => {
  it('golv och mål räknas på löpande kostnad plus utrustning fördelad över avtalet', () => {
    const r = ProcurementCalcService.calculate(
      { ...DEFAULT_CALC_INPUT, objects: 10, visitsPerObjectPerYear: 4, hoursPerVisit: 1, travelHoursPerVisit: 0, consumablesPerVisit: 0, durableUnits: 40, durableUnitCost: 100, contractYears: 4, hourlyCost: 1000 },
      settings
    )
    // 40 besök á 1 h á 1 000 kr = 40 000 kr per år, utrustning 4 000 kr över 4 år = 1 000 kr per år
    expect(r.annualCost).toBe(40000)
    expect(r.annualCostWithDurable).toBe(41000)
    expect(r.floorPrice).toBeCloseTo(41000 / 0.8)
    expect(r.targetPrice).toBeCloseTo(41000 / 0.65)
    expect(r.scenarios.find((s) => s.label === 'Golv')?.belowFloor).toBe(false)
    expect(r.best).not.toBeNull()
  })

  it('varnar när arbetstiden är under en halvtimme per besök', () => {
    const r = ProcurementCalcService.calculate({ ...DEFAULT_CALC_INPUT, hoursPerVisit: 0.2, travelHoursPerVisit: 0 }, settings)
    expect(r.labourWarning).not.toBeNull()
  })

  it('prisband ur verkliga anbud, inte ramtak', () => {
    const band = ProcurementCalcService.bandFromAwards([
      { lowest_bid: 400000, highest_bid: 800000, value: 5000000, value_kind: 'ceiling', contract_start: null, contract_end: null, calc_end_date: null },
    ])
    expect(band).toEqual({ low: 100000, high: 200000, samples: 2 })
  })
})
