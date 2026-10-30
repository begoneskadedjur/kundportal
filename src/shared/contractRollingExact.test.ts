import { describe, expect, it } from 'vitest'
import {
  computePlannedPeriods,
  nextRenewal,
  periodBeforeLimit,
  parseLocalDate,
  toLocalIsoDate,
  type PlanningContract,
} from './contractPlanner'
import { buildContractDiff, fortnoxCovers, plannedShareCovered, type MatchableInvoice } from './contractInvoiceMatch'

// Datasteg 18, STRUL 1 (2026-10-31): löpande avtal efter bindningstidens slut
// tappade perioder i exakt läge. Fallen är avtalen som gick tillbaka till den
// 1:a: Lars Kleberg 534bccf3, Heimstaden Maria 5 f0861788 och 5b13c325,
// Bockholmen 1f88b97e. Exakt läge ska förlänga som gamla läget, bara med
// perioder från avtalsdagen.

const TODAY = '2026-10-31'

const base = (over: Partial<PlanningContract>): PlanningContract => ({
  annual_value: 10000,
  contract_start_date: null,
  contract_end_date: null,
  terminated_at: null,
  billing_frequency: 'annual',
  billing_anchor_month: null,
  billing_active: true,
  notice_period_months: null,
  renewal_mode: 'rolling',
  effective_end_date: null,
  billing_anchor_mode: null,
  ...over,
})

const kleberg = base({ annual_value: 9540, contract_start_date: '2025-10-03', contract_end_date: '2026-04-03', billing_anchor_month: 10 })
const bockholmen = base({ annual_value: 9570, contract_start_date: '2026-02-06', contract_end_date: '2026-08-06', billing_anchor_month: 2 })
const maria5b = base({ annual_value: 11700, contract_start_date: '2025-05-07', contract_end_date: '2026-05-07', billing_anchor_month: 5, notice_period_months: 2 })
const maria5f = base({ annual_value: 26200, contract_start_date: '2025-07-11', contract_end_date: '2026-07-11', billing_anchor_month: 7, notice_period_months: 2 })

const plan = (c: PlanningContract, today = TODAY) =>
  computePlannedPeriods(c, { window: 'binding', today, leadDays: 40 }).map(
    (p) => `${p.periodStart}..${p.periodEnd}${p.renewal ? ' R' : ''}`
  )
const exact = (c: PlanningContract): PlanningContract => ({ ...c, billing_anchor_mode: 'start_day' })

describe('löpande avtal efter bindningstiden, exakt läge som gamla läget', () => {
  it('Kleberg: sex månaders bindning, årsvis; perioden 2026-10-03 kommer med', () => {
    expect(plan(kleberg)).toEqual(['2025-10-01..2026-09-30', '2026-10-01..2027-09-30'])
    expect(plan(exact(kleberg))).toEqual(['2025-10-03..2026-10-02', '2026-10-03..2027-10-02'])
  })

  it('Bockholmen: sex månaders bindning, årsvis; nästa årsperiod 2027-02-06 kommer med', () => {
    expect(plan(bockholmen)).toEqual(['2026-02-01..2027-01-31', '2027-02-01..2028-01-31'])
    expect(plan(exact(bockholmen))).toEqual(['2026-02-06..2027-02-05', '2027-02-06..2028-02-05'])
  })

  it('Maria 5 (två avtal): ett års bindning, rullat ett år', () => {
    expect(plan(maria5b)).toEqual(['2025-05-01..2026-04-30', '2026-05-01..2027-04-30'])
    expect(plan(exact(maria5b))).toEqual(['2025-05-07..2026-05-06', '2026-05-07..2027-05-06'])
    expect(plan(maria5f)).toEqual(['2025-07-01..2026-06-30', '2026-07-01..2027-06-30'])
    expect(plan(exact(maria5f))).toEqual(['2025-07-11..2026-07-10', '2026-07-11..2027-07-10'])
  })

  it('samma antal perioder och förlängningar i båda lägena, varje vecka i drygt ett år', () => {
    for (const c of [kleberg, bockholmen, maria5b, maria5f]) {
      for (let i = 0; i < 420; i += 7) {
        const d = parseLocalDate('2026-06-01')
        d.setDate(d.getDate() + i)
        const today = toLocalIsoDate(d)
        const legacy = plan(c, today)
        const ex = plan(exact(c), today)
        expect(ex.length, `${c.contract_start_date} ${today}`).toBe(legacy.length)
        expect(ex.map((s) => s.endsWith(' R'))).toEqual(legacy.map((s) => s.endsWith(' R')))
      }
    }
  })

  it('efter sista uppsägningsdag kommer nästa år med som förlängning (Kleberg 2027-02-04)', () => {
    expect(plan(exact(kleberg), '2027-02-04')).toEqual([
      '2025-10-03..2026-10-02',
      '2026-10-03..2027-10-02',
      '2027-10-03..2028-10-02 R',
    ])
    expect(plan(kleberg, '2027-02-04')).toEqual([
      '2025-10-01..2026-09-30',
      '2026-10-01..2027-09-30',
      '2027-10-01..2028-09-30 R',
    ])
  })

  it('nästa förlängning visas i båda lägena', () => {
    expect(nextRenewal(exact(kleberg), { today: TODAY })?.period.periodStart).toBe('2027-10-03')
    expect(nextRenewal(kleberg, { today: TODAY })?.period.periodStart).toBe('2027-10-01')
  })

  it('option förlängs inte, uppsägning kapar som förut', () => {
    expect(plan(exact({ ...kleberg, renewal_mode: 'option' }))).toEqual(['2025-10-03..2026-10-02'])
    expect(plan({ ...kleberg, renewal_mode: 'option' })).toEqual(['2025-10-01..2026-09-30'])
    const terminated = { ...kleberg, terminated_at: '2026-09-01T10:00:00Z', effective_end_date: '2027-10-02' }
    expect(plan(exact(terminated))).toEqual(['2025-10-03..2026-10-02', '2026-10-03..2027-10-02'])
  })

  it('hela års bindning påverkas inte: perioden efter slutdatumet hör till nästa år', () => {
    const c = base({ contract_start_date: '2025-06-30', contract_end_date: '2027-06-30', notice_period_months: 3 })
    expect(plan(exact(c))).toEqual(['2025-06-30..2026-06-29', '2026-06-30..2027-06-29'])
  })

  it('periodBeforeLimit: exakt läge avgörs av samma månader räknat från den 1:a', () => {
    const limit = parseLocalDate('2027-04-03')
    // Gamla läget: mittpunkten 2027-04-01 före gränsen
    expect(periodBeforeLimit(parseLocalDate('2026-10-01'), parseLocalDate('2027-09-30'), limit, null)).toBe(true)
    // Exakt period med gamla regeln: mittpunkten på gränsen, inte före (felet)
    expect(periodBeforeLimit(parseLocalDate('2026-10-03'), parseLocalDate('2027-10-02'), limit, null)).toBe(false)
    expect(periodBeforeLimit(parseLocalDate('2026-10-03'), parseLocalDate('2027-10-02'), limit, 12)).toBe(true)
  })
})

describe('Fortnox-täckning i exakt läge räknas mot den planerade perioden', () => {
  const year = { periodStart: '2026-05-07', periodEnd: '2027-05-06' }

  it('en endags- eller månadsimport för ett ärende täcker inte årsperioden (Maria 5 F-502, Kleberg F-416)', () => {
    expect(plannedShareCovered({ start: year.periodStart, end: year.periodEnd }, { start: '2026-05-28', end: '2026-05-28' })).toBeLessThan(0.01)
    expect(fortnoxCovers(year, [{ start: '2026-05-28', end: '2026-05-28' }], 'overlap')).toBe(false)
    expect(fortnoxCovers(year, [{ start: '2026-04-30', end: '2026-05-30' }], 'overlap')).toBe(false)
  })

  it('en årsimport med annan dag täcker fortfarande, nästa år gör den inte', () => {
    expect(fortnoxCovers({ periodStart: '2026-02-06', periodEnd: '2027-02-05' }, [{ start: '2026-02-01', end: '2027-01-31' }], 'overlap')).toBe(true)
    expect(fortnoxCovers({ periodStart: '2027-02-06', periodEnd: '2028-02-05' }, [{ start: '2026-02-06', end: '2027-02-05' }], 'overlap')).toBe(false)
  })

  it('diffen: perioderna står kvar som uncovered trots en liten ärendeimport', () => {
    const imports: MatchableInvoice[] = [
      {
        id: 'f502',
        invoice_number: 'F-502',
        status: 'paid',
        billing_period_start: '2026-05-28',
        billing_period_end: '2026-05-28',
        total_amount: 7487.5,
        subtotal: 5990,
        is_historical: true,
        invoice_type: 'adhoc',
        fortnox_document_number: '502',
        has_generic_items: false,
      },
    ]
    const planned = computePlannedPeriods(exact(maria5b), { window: 'binding', today: TODAY })
    const diff = buildContractDiff(planned, imports, { real: true, mode: 'overlap' })
    expect(diff.filter((e) => e.planned).map((e) => [e.action, e.planned!.periodStart])).toEqual([
      ['uncovered', '2025-05-07'],
      ['uncovered', '2026-05-07'],
    ])
  })
})

describe('STRUL 2: indexsteg daterat den 1:a i exakt läge', () => {
  // AngelRekt a8637f0a: avtalsdag 15 februari, indexsteget 2026-03-01 (16 692)
  const angel = base({ annual_value: 15540, contract_start_date: '2024-02-15', contract_end_date: '2025-02-15', billing_anchor_month: 3, notice_period_months: 2 })
  const steps = [
    { effective_from: '2024-02-15', annual_value: 15540, event_type: 'start' },
    { effective_from: '2026-03-01', annual_value: 16692, event_type: 'indexation' },
  ]
  const amounts = (c: PlanningContract, s: typeof steps) =>
    computePlannedPeriods(c, { window: 'binding', today: TODAY, steps: s }).map((p) => `${p.periodStart} ${p.amount}`)

  it('steget inom 31 dagar efter periodstart gäller från avtalsdagen', () => {
    expect(amounts(exact(angel), steps)).toEqual(['2024-02-15 15540', '2025-02-15 15540', '2026-02-15 16692'])
  })

  it('gamla läget oförändrat', () => {
    expect(amounts(angel, steps)).toEqual(['2024-03-01 15540', '2025-03-01 15540', '2026-03-01 16692'])
  })

  it('andra steg än index flyttas inte (tillägg mitt i perioden)', () => {
    const addition = [steps[0], { effective_from: '2026-03-01', annual_value: 16692, event_type: 'addition' }]
    expect(amounts(exact(angel), addition)).toEqual(['2024-02-15 15540', '2025-02-15 15540', '2026-02-15 15540'])
  })

  it('index mer än 31 dagar in i perioden flyttas inte', () => {
    const late = [steps[0], { effective_from: '2026-04-01', annual_value: 16692, event_type: 'indexation' }]
    expect(amounts(exact(angel), late)).toEqual(['2024-02-15 15540', '2025-02-15 15540', '2026-02-15 15540'])
  })
})
