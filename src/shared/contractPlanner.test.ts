import { describe, expect, it } from 'vitest'
import {
  bindingWindow,
  computePlannedMonthlyEquipmentPeriods,
  computePlannedPeriods,
  isDueForCreation,
  lastNoticeDay,
  nextRenewal,
  type PlanningContract,
} from './contractPlanner'

const base = (over: Partial<PlanningContract> = {}): PlanningContract => ({
  annual_value: 12000,
  contract_start_date: '2026-10-14',
  contract_end_date: '2027-10-14',
  terminated_at: null,
  billing_frequency: 'annual',
  billing_anchor_month: null,
  billing_active: true,
  notice_period_months: 3,
  ...over,
})

const plan = (c: PlanningContract, today: string) =>
  computePlannedPeriods(c, { window: 'binding', today, leadDays: 40 })
const starts = (c: PlanningContract, today: string) => plan(c, today).map((p) => p.periodStart)

describe('lastNoticeDay', () => {
  it('slutdatum minus uppsägningstiden', () => {
    expect(lastNoticeDay('2027-10-14', 3)).toBe('2027-07-14')
    expect(lastNoticeDay('2028-01-31', 1)).toBe('2027-12-31')
  })
})

describe('planeringen: bara nuvarande bindningstid', () => {
  it('ettårsavtal planerar bara första året, inte förlängningen (exemplet 2027-10-01)', () => {
    expect(starts(base(), '2026-10-15')).toEqual(['2026-10-01'])
  })

  it('på sista uppsägningsdagen är förlängningen fortfarande inte planerad', () => {
    expect(starts(base(), '2027-07-14')).toEqual(['2026-10-01'])
  })

  it('dagen efter sista uppsägningsdag kommer nästa bindningsperiod med som förlängning', () => {
    const periods = plan(base(), '2027-07-15')
    expect(periods.map((p) => p.periodStart)).toEqual(['2026-10-01', '2027-10-01'])
    expect(periods[0].renewal).toBe(false)
    expect(periods[1].renewal).toBe(true)
    // Fakturadatum periodstart minus ledtid när den ligger framför oss
    expect(periods[1].invoiceDate).toBe('2027-08-22')
  })

  it('kort uppsägningstid: fakturadatum som redan passerat blir idag', () => {
    const periods = plan(base({ notice_period_months: 1 }), '2027-09-15')
    const renewal = periods.find((p) => p.renewal)!
    expect(renewal.periodStart).toBe('2027-10-01')
    expect(renewal.invoiceDate).toBe('2027-09-15')
  })

  it('rullande avtal som redan förlängts: den löpande perioden, inte nästa', () => {
    const c = base({ contract_start_date: '2024-10-14', contract_end_date: '2025-10-14' })
    expect(starts(c, '2026-10-15')).toEqual(['2024-10-01', '2025-10-01', '2026-10-01'])
    const later = plan(c, '2027-07-15')
    expect(later.map((p) => p.periodStart)).toEqual(['2024-10-01', '2025-10-01', '2026-10-01', '2027-10-01'])
    expect(later.filter((p) => p.renewal).map((p) => p.periodStart)).toEqual(['2027-10-01'])
  })

  it('flerårsavtal med fakturamånad som inte är startmånaden: sista årets period hör till bindningstiden', () => {
    const c = base({ contract_start_date: '2026-03-01', contract_end_date: '2029-02-28', billing_anchor_month: 5, notice_period_months: 2 })
    expect(starts(c, '2026-10-15')).toEqual(['2026-05-01', '2027-05-01', '2028-05-01'])
  })

  it('månadsfakturering slutar med bindningstidens sista hela månad', () => {
    const c = base({ billing_frequency: 'monthly', contract_end_date: '2027-10-14' })
    const s = starts(c, '2026-10-15')
    expect(s[0]).toBe('2026-10-01')
    expect(s[s.length - 1]).toBe('2027-09-01')
    // Efter sista uppsägningsdag: tolv nya månader, alla förlängning
    const after = plan(c, '2027-07-15').filter((p) => p.renewal)
    expect(after).toHaveLength(12)
    expect(after[0].periodStart).toBe('2027-10-01')
  })

  it('option förlängs aldrig automatiskt', () => {
    const c = base({ renewal_mode: 'option' })
    expect(starts(c, '2027-09-01')).toEqual(['2026-10-01'])
  })

  it('uppsagt månadsavtal faktureras till och med slutdatumet, inte längre', () => {
    const c = base({
      billing_frequency: 'monthly',
      contract_start_date: '2024-11-01',
      contract_end_date: '2025-11-01',
      terminated_at: '2026-10-21T10:00:00+02:00',
      effective_end_date: '2026-12-31',
    })
    const s = starts(c, '2026-10-21')
    expect(s).toContain('2026-11-01')
    expect(s).toContain('2026-12-01')
    expect(s).not.toContain('2027-01-01')
  })

  it('uppsagt rullande årsavtal: året som redan förlängts faktureras', () => {
    const c = base({
      contract_start_date: '2024-11-04',
      contract_end_date: '2025-11-04',
      billing_anchor_month: 11,
      terminated_at: '2026-10-21T10:00:00+02:00',
      effective_end_date: '2027-11-03',
    })
    const s = starts(c, '2026-10-21')
    expect(s).toContain('2026-11-01')
    expect(s).not.toContain('2027-11-01')
  })

  it('uppsagt avtal planeras som utan horisont (slutdatum och kapning)', () => {
    const c = base({ terminated_at: '2027-01-10' })
    expect(bindingWindow(c, '2027-07-15')).toBeNull()
    expect(starts(c, '2027-07-15')).toEqual(computePlannedPeriods(c, { today: '2027-07-15' }).map((p) => p.periodStart))
  })
})

describe('avtal utan slutdatum (tills vidare)', () => {
  const open = (over: Partial<PlanningContract> = {}) =>
    base({ contract_start_date: '2026-01-01', contract_end_date: null, ...over })

  it('nästa årsperiod kommer med när uppsägning inte längre hinner före periodstart', () => {
    // Uppsägningstid 3 mån: perioden 2027-01-01 kan undvikas med uppsägning senast 2026-10-01
    expect(starts(open(), '2026-10-01')).toEqual(['2026-01-01'])
    const p = plan(open(), '2026-10-02')
    expect(p.map((x) => x.periodStart)).toEqual(['2026-01-01', '2027-01-01'])
    expect(p[1].renewal).toBe(true)
  })

  it('månadsavtal: bara månaderna inom uppsägningstiden', () => {
    const c = open({ billing_frequency: 'monthly', notice_period_months: 2 })
    const s = starts(c, '2026-10-15')
    expect(s[s.length - 1]).toBe('2026-12-01')
  })

  it('utan uppsägningstid används två månader', () => {
    const w = bindingWindow(open({ notice_period_months: null }), '2026-10-15')!
    expect(w.openEnded).toBe(true)
    expect(w.planEnd).toBe('2026-12-15')
  })
})

describe('cronens förnyelseregel', () => {
  it('förlängning skapas direkt, övriga när fakturadatumet är inne', () => {
    expect(isDueForCreation({ renewal: true, invoiceDate: '2027-08-22' }, '2027-07-15')).toBe(true)
    expect(isDueForCreation({ renewal: false, invoiceDate: '2027-08-22' }, '2027-07-15')).toBe(false)
    expect(isDueForCreation({ renewal: false, invoiceDate: '2027-07-15' }, '2027-07-15')).toBe(true)
  })

  it('före sista uppsägningsdag finns ingen förlängning att skapa, efter finns den', () => {
    const before = plan(base(), '2027-07-14').filter((p) => p.renewal && isDueForCreation(p, '2027-07-14'))
    const after = plan(base(), '2027-07-15').filter((p) => p.renewal && isDueForCreation(p, '2027-07-15'))
    expect(before).toHaveLength(0)
    expect(after.map((p) => p.periodStart)).toEqual(['2027-10-01'])
  })

  it('idempotent: samma dag ger samma perioder', () => {
    expect(starts(base(), '2027-07-20')).toEqual(starts(base(), '2027-07-20'))
  })
})

describe('nextRenewal (kundkortets "Därefter")', () => {
  it('sista uppsägningsdag, planeringsdag och första perioden', () => {
    const r = nextRenewal(base(), { today: '2026-10-15', leadDays: 40 })!
    expect(r.noticeDeadline).toBe('2027-07-14')
    expect(r.planDate).toBe('2027-07-15')
    expect(r.period.periodStart).toBe('2027-10-01')
    expect(r.period.invoiceDate).toBe('2027-08-22')
  })

  it('när förlängningen redan är planerad visas nästa', () => {
    const r = nextRenewal(base(), { today: '2027-07-20', leadDays: 40 })!
    expect(r.noticeDeadline).toBe('2028-07-14')
    expect(r.period.periodStart).toBe('2028-10-01')
  })

  it('tills vidare: nästa period och dess sista uppsägningsdag', () => {
    const r = nextRenewal(base({ contract_start_date: '2026-01-01', contract_end_date: null }), { today: '2026-06-01' })!
    expect(r.period.periodStart).toBe('2027-01-01')
    expect(r.noticeDeadline).toBe('2026-10-01')
    expect(r.planDate).toBe('2026-10-02')
  })

  it('option och uppsagt: ingen förlängning', () => {
    expect(nextRenewal(base({ renewal_mode: 'option' }), { today: '2026-10-15' })).toBeNull()
    expect(nextRenewal(base({ terminated_at: '2026-12-01' }), { today: '2026-10-15' })).toBeNull()
  })
})

describe('tillägg per månad följer bindningsfönstret', () => {
  const equipment = [
    { id: 'e1', name: 'Fälla', code: null, quantity: 2, unit_price_annual: 1200, unit_price_month: 100, vat_rate: 25, billing_model: 'per_month' as const },
  ]
  it('stannar vid bindningstidens slut och fortsätter efter sista uppsägningsdag', () => {
    const before = computePlannedMonthlyEquipmentPeriods(base(), { window: 'binding', today: '2026-10-15', equipment })
    expect(before[0].periodStart).toBe('2026-10-01')
    expect(before[before.length - 1].periodStart).toBe('2027-09-01')
    expect(before.some((p) => p.renewal)).toBe(false)
    const after = computePlannedMonthlyEquipmentPeriods(base(), { window: 'binding', today: '2027-07-15', equipment })
    const renewal = after.filter((p) => p.renewal)
    expect(renewal[0].periodStart).toBe('2027-10-01')
    expect(renewal).toHaveLength(12)
  })
})
