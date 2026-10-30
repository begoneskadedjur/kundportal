import { describe, expect, it } from 'vitest'
import { upcomingImportPeriods } from './importBillingPreview'

describe('upcomingImportPeriods', () => {
  it('årsvis med ankarmånad juli ger perioder från den 1 juli', () => {
    const out = upcomingImportPeriods(
      { contract_start_date: '2025-07-15', contract_end_date: null, annual_value: 12000, billing_frequency: 'annual', billing_anchor_month: 7 },
      '2026-10-30'
    )
    expect(out[0]).toEqual({ periodStart: '2027-07-01', periodEnd: '2028-06-30', amount: 12000 })
    expect(out.length).toBeGreaterThanOrEqual(2)
  })

  it('kvartalsvis ger fyra perioder och kvartalsbelopp', () => {
    const out = upcomingImportPeriods(
      { contract_start_date: '2026-01-01', contract_end_date: '2028-12-31', annual_value: 8000, billing_frequency: 'quarterly', billing_anchor_month: 1 },
      '2026-10-30'
    )
    expect(out.map((p) => p.periodStart)).toEqual(['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01'])
    expect(out[0].amount).toBe(2000)
  })

  it('utan startdatum eller frekvens blir listan tom', () => {
    expect(upcomingImportPeriods({ contract_start_date: null, contract_end_date: null, annual_value: 1, billing_frequency: 'annual', billing_anchor_month: 1 }, '2026-10-30')).toEqual([])
    expect(upcomingImportPeriods({ contract_start_date: '2026-01-01', contract_end_date: null, annual_value: 1, billing_frequency: 'on_demand', billing_anchor_month: 1 }, '2026-10-30')).toEqual([])
  })
})
