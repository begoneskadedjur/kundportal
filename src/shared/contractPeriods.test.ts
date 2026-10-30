import { describe, expect, it } from 'vitest'
import {
  addMonthsClampedIso,
  exactPeriods,
  nextPeriodStart,
  periodContaining,
  periodStepMonths,
} from './contractPeriods'
import {
  computePlannedMonthlyEquipmentPeriods,
  computePlannedPeriods,
  parseLocalDate,
  toLocalIsoDate,
  type PlanningContract,
} from './contractPlanner'

const exact = (over: Partial<PlanningContract> = {}): PlanningContract => ({
  annual_value: 12000,
  contract_start_date: '2026-06-30',
  contract_end_date: '2028-06-29',
  terminated_at: null,
  billing_frequency: 'annual',
  billing_anchor_month: 7,
  billing_active: true,
  notice_period_months: 3,
  billing_anchor_mode: 'start_day',
  ...over,
})

const ranges = (c: PlanningContract, today: string) =>
  computePlannedPeriods(c, { window: 'binding', today, leadDays: 40 }).map((p) => [p.periodStart, p.periodEnd])

const iso = (rs: Array<{ periodStart: Date; periodEnd: Date }>) =>
  rs.map((r) => [toLocalIsoDate(r.periodStart), toLocalIsoDate(r.periodEnd)])

describe('addMonthsClampedIso', () => {
  it('klampar till månadens sista dag och glider inte', () => {
    expect(addMonthsClampedIso('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClampedIso('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonthsClampedIso('2026-01-31', 3)).toBe('2026-04-30')
    expect(addMonthsClampedIso('2024-02-29', 12)).toBe('2025-02-28')
    expect(addMonthsClampedIso('2024-02-29', 48)).toBe('2028-02-29')
    expect(addMonthsClampedIso('2026-11-15', -1)).toBe('2026-10-15')
  })

  it('periodlängder per frekvens, NULL och on_demand är årsvis', () => {
    expect(periodStepMonths('monthly')).toBe(1)
    expect(periodStepMonths('quarterly')).toBe(3)
    expect(periodStepMonths('semi_annual')).toBe(6)
    expect(periodStepMonths('annual')).toBe(12)
    expect(periodStepMonths(null)).toBe(12)
    expect(periodStepMonths('on_demand')).toBe(12)
  })
})

describe('exakt avtalsdag i planeraren', () => {
  it('X1: start 2026-06-30, årsvis, slut 2028-06-29', () => {
    expect(ranges(exact(), '2026-10-30')).toEqual([
      ['2026-06-30', '2027-06-29'],
      ['2027-06-30', '2028-06-29'],
    ])
  })

  it('X2: start 2024-02-29, årsvis, 29 februari blir 28 februari vanliga år', () => {
    const rs = iso(exactPeriods('2024-02-29', parseLocalDate('2029-02-28'), parseLocalDate('2029-02-27'), 12, false))
    expect(rs.slice(1)).toEqual([
      ['2025-02-28', '2026-02-27'],
      ['2026-02-28', '2027-02-27'],
      ['2027-02-28', '2028-02-28'],
      ['2028-02-29', '2029-02-27'],
    ])
    expect(rs[0]).toEqual(['2024-02-29', '2025-02-27'])
  })

  it('X3: start 2026-01-31, månadsvis, räknat från startdagen', () => {
    const rs = iso(exactPeriods('2026-01-31', parseLocalDate('2026-05-01'), parseLocalDate('2026-05-01'), 1, false))
    expect(rs).toEqual([
      ['2026-01-31', '2026-02-27'],
      ['2026-02-28', '2026-03-30'],
      ['2026-03-31', '2026-04-29'],
      ['2026-04-30', '2026-05-30'],
    ])
  })

  it('X4: start 2026-11-15, halvårsvis, slut 2027-11-14 ger två perioder', () => {
    const c = exact({ contract_start_date: '2026-11-15', contract_end_date: '2027-11-14', billing_frequency: 'semi_annual' })
    expect(ranges(c, '2026-10-30')).toEqual([
      ['2026-11-15', '2027-05-14'],
      ['2027-05-15', '2027-11-14'],
    ])
  })

  it('X5: start 2026-08-17, kvartalsvis, tills vidare, perioder som börjar före 2026-12-30', () => {
    const c = exact({ contract_start_date: '2026-08-17', contract_end_date: null, billing_frequency: 'quarterly', notice_period_months: 2 })
    expect(ranges(c, '2026-10-30')).toEqual([
      ['2026-08-17', '2026-11-16'],
      ['2026-11-17', '2027-02-16'],
    ])
  })

  it('X6: uppsagt med effective_end_date 2027-03-31, årsvis från 2025-04-10', () => {
    const c = exact({
      contract_start_date: '2025-04-10',
      contract_end_date: '2027-04-09',
      terminated_at: '2026-12-15T10:00:00+01:00',
      effective_end_date: '2027-03-31',
    })
    expect(ranges(c, '2026-10-30').map((r) => r[0])).toEqual(['2025-04-10', '2026-04-10'])
  })

  it('gamla läget är orört: samma avtal utan läge börjar den 1:a', () => {
    const c = exact({ billing_anchor_mode: null })
    expect(ranges(c, '2026-10-30')).toEqual([
      ['2026-07-01', '2027-06-30'],
      ['2027-07-01', '2028-06-30'],
    ])
  })

  it('exakt läge utan startdatum faller tillbaka på gamla regeln (planerar inget)', () => {
    expect(ranges(exact({ contract_start_date: null }), '2026-10-30')).toEqual([])
  })

  it('månadsavtal i exakt läge följer avtalsdagen, belopp per period oförändrat', () => {
    const c = exact({ contract_start_date: '2026-10-15', contract_end_date: '2027-10-14', billing_frequency: 'monthly' })
    const ps = computePlannedPeriods(c, { window: 'binding', today: '2026-10-30' })
    expect(ps.length).toBe(12)
    expect(ps[0].periodStart).toBe('2026-10-15')
    expect(ps[0].periodEnd).toBe('2026-11-14')
    expect(ps[11].periodEnd).toBe('2027-10-14')
    expect(ps[0].amount).toBe(1000)
  })
})

describe('månadsfakturor för § 5 per månad i exakt läge', () => {
  const eq = [
    {
      id: 'e1',
      name: 'Station',
      code: null,
      quantity: 2,
      unit_price_annual: 1200,
      unit_price_month: 100,
      vat_rate: 25,
      billing_model: 'per_month' as const,
      billing_start_date: null,
    },
  ]
  it('första perioden innehåller idag och följer avtalsdagen', () => {
    const c = exact({ contract_start_date: '2026-01-31', contract_end_date: '2027-01-30', notice_period_months: 2 })
    const ps = computePlannedMonthlyEquipmentPeriods(c, { window: 'binding', today: '2026-10-30', equipment: eq })
    expect(ps.slice(0, 3).map((p) => [p.periodStart, p.periodEnd])).toEqual([
      ['2026-09-30', '2026-10-30'],
      ['2026-10-31', '2026-11-29'],
      ['2026-11-30', '2026-12-30'],
    ])
    expect(ps[ps.length - 1].periodEnd).toBe('2027-01-30')
  })

  it('tidigaste billing_start_date senare än idag styr första perioden', () => {
    const c = exact({ contract_start_date: '2026-01-31', contract_end_date: '2027-01-30', notice_period_months: 2 })
    const late = [{ ...eq[0], billing_start_date: '2026-11-30' }]
    const ps = computePlannedMonthlyEquipmentPeriods(c, { window: 'binding', today: '2026-10-30', equipment: late })
    expect(ps[0].periodStart).toBe('2026-11-30')
  })

  it('gamla läget ger kalendermånader som i dag', () => {
    const c = exact({ billing_anchor_mode: null, contract_start_date: '2026-01-31', contract_end_date: '2027-01-30', notice_period_months: 2 })
    const ps = computePlannedMonthlyEquipmentPeriods(c, { window: 'binding', today: '2026-10-30', equipment: eq })
    expect(ps[0].periodStart).toBe('2026-10-01')
    expect(ps[0].periodEnd).toBe('2026-10-31')
  })
})

describe('periodContaining och nextPeriodStart', () => {
  it('X8: exakt läge från 2026-10-30 ger 2026-11-25; gamla läget med ankare 11 ger 2026-11-01', () => {
    const c = { contract_start_date: '2025-11-25', billing_frequency: 'annual', billing_anchor_month: 11 }
    expect(nextPeriodStart({ ...c, billing_anchor_mode: 'start_day' }, '2026-10-30')).toBe('2026-11-25')
    expect(nextPeriodStart({ ...c, billing_anchor_mode: null }, '2026-10-30')).toBe('2026-11-01')
  })

  it('FEV-exemplet: start 2026-06-30, nästa periodstart 2027-06-30', () => {
    const c = { contract_start_date: '2026-06-30', billing_frequency: 'annual', billing_anchor_month: 7, billing_anchor_mode: 'start_day' }
    expect(periodContaining(c, '2026-10-30')).toEqual({ periodStart: '2026-06-30', periodEnd: '2027-06-29' })
    expect(nextPeriodStart(c, '2026-10-30')).toBe('2027-06-30')
    // Sista dagen i perioden hör till perioden, dagen efter till nästa
    expect(nextPeriodStart(c, '2027-06-29')).toBe('2027-06-30')
    expect(nextPeriodStart(c, '2027-06-30')).toBe('2028-06-30')
  })

  it('dag före startdagen ger första perioden', () => {
    const c = { contract_start_date: '2026-11-15', billing_frequency: 'quarterly', billing_anchor_mode: 'start_day' }
    expect(periodContaining(c, '2026-10-30')).toEqual({ periodStart: '2026-11-15', periodEnd: '2027-02-14' })
  })

  it('exakt läge med frekvens NULL räknar årsvis på avtalsdagen', () => {
    const c = { contract_start_date: '2025-03-31', billing_frequency: null, billing_anchor_mode: 'start_day' }
    expect(periodContaining(c, '2026-10-30')).toEqual({ periodStart: '2026-03-31', periodEnd: '2027-03-30' })
  })

  it('gamla läget: samma regel som contract_next_period_start i SQL', () => {
    expect(nextPeriodStart({ contract_start_date: '2026-03-17', billing_frequency: 'monthly' }, '2026-10-30')).toBe('2026-11-01')
    expect(nextPeriodStart({ contract_start_date: '2026-03-17', billing_frequency: 'quarterly' }, '2026-10-30')).toBe('2026-12-01')
    expect(nextPeriodStart({ contract_start_date: '2026-03-17', billing_frequency: 'semi_annual' }, '2026-10-30')).toBe('2027-03-01')
    expect(nextPeriodStart({ contract_start_date: '2026-03-17', billing_frequency: 'annual' }, '2026-10-30')).toBe('2027-03-01')
    expect(nextPeriodStart({ contract_start_date: '2026-03-17', billing_frequency: 'on_demand' }, '2026-10-30')).toBeNull()
    expect(nextPeriodStart({ contract_start_date: '2026-03-17', billing_frequency: null }, '2026-10-30')).toBeNull()
    expect(periodContaining({ contract_start_date: '2026-03-17', billing_frequency: 'quarterly' }, '2026-10-30')).toEqual({
      periodStart: '2026-09-01',
      periodEnd: '2026-11-30',
    })
  })
})
