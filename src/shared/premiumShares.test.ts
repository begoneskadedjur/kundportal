import { describe, expect, it } from 'vitest'
import { cronPremiumRowTotals } from './premiumShares'
import { computePlannedPeriods, periodDivisor, type PlanningContract } from './contractPlanner'

// Cronens § 4-belopp (api/cron/generate-continuing-contracts.ts, buildRows).
describe('cronPremiumRowTotals', () => {
  it('Årsta Torg: bärande rad på 0 kr får hela premien (INV-202611-0002 blev 0 kr)', () => {
    const contract: PlanningContract = {
      contract_start_date: '2023-02-01',
      contract_end_date: '2027-02-01',
      billing_frequency: 'annual',
      billing_anchor_month: 2,
      billing_anchor_mode: 'start_day',
      annual_value: 45135.2,
      renewal_mode: 'rolling',
      notice_period_months: 3,
      billing_active: true,
    } as PlanningContract
    const periods = computePlannedPeriods(contract, {
      steps: [{ effective_from: '2023-02-01', annual_value: 45135.2, event_type: 'start' }],
      window: 'binding',
      today: '2026-11-02',
    })
    const p = periods.find((x) => x.periodStart === '2027-02-01')!
    expect(p.periodEnd).toBe('2028-01-31')
    expect(p.amount).toBe(45135)

    const r = cronPremiumRowTotals(
      [{ id: 'bd2dcaca', total_price: 0, quantity: 1, unit_price: 0, is_premium_carrier: true, premium_share: null }],
      p.amount,
      periodDivisor('annual')
    )
    expect(r?.byShares).toBe(true)
    expect(r?.totals.get('bd2dcaca')).toBe(45135)
  })

  it('rader med belopp skalas som förut', () => {
    const r = cronPremiumRowTotals(
      [
        { id: 'a', total_price: 6000, quantity: 1 },
        { id: 'b', total_price: 4000, quantity: 1 },
      ],
      11000,
      1
    )
    expect(r?.byShares).toBe(false)
    expect(r?.totals.get('a')).toBe(6600)
    expect(r?.totals.get('b')).toBe(4400)
  })

  it('bärande rad på 0 kr bredvid rad med belopp: som förut (Rågstacken)', () => {
    const r = cronPremiumRowTotals(
      [
        { id: 'carrier', total_price: 0, quantity: 1, is_premium_carrier: true },
        { id: 'other', total_price: 119000, quantity: 1, is_premium_carrier: false },
      ],
      119000,
      1
    )
    expect(r?.byShares).toBe(false)
    expect(r?.totals.get('carrier')).toBe(0)
    expect(r?.totals.get('other')).toBe(119000)
  })

  it('andelar när raderna summerar till 0: bärande raden tar restposten', () => {
    const r = cronPremiumRowTotals(
      [
        { id: 'carrier', total_price: 0, quantity: 1, is_premium_carrier: true },
        { id: 'x', total_price: 0, quantity: 4, premium_share: 0.25 },
        { id: 'y', total_price: 0, quantity: 2, premium_share: null },
      ],
      10000,
      2
    )
    expect(r?.byShares).toBe(true)
    expect(r?.totals.get('x')).toBe(2500)
    expect(r?.totals.get('carrier')).toBe(7500)
    expect(r?.totals.get('y')).toBe(0)
  })

  it('inga andelar och inga belopp: null, cronen skriver en vanlig premierad', () => {
    expect(cronPremiumRowTotals([{ id: 'a', total_price: 0, quantity: 1 }], 5000, 1)).toBeNull()
  })

  it('premie 0 kr: oförändrat 0 på raderna', () => {
    const r = cronPremiumRowTotals([{ id: 'a', total_price: 0, quantity: 1, is_premium_carrier: true }], 0, 1)
    expect(r?.byShares).toBe(false)
    expect(r?.totals.get('a')).toBe(0)
  })
})
