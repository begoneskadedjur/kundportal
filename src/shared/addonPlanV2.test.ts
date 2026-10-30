import { describe, expect, it } from 'vitest'
import {
  addonCadence,
  buildGapDiff,
  computeAddonPlanV2,
  decorateV2Period,
  existingByMarkingGroup,
  planGapGroups,
  stationFullyCovered,
  type GapCandidate,
} from './addonPlanV2'
import { computePlannedPeriods, type EquipmentLine, type PlanningContract } from './contractPlanner'

const contract = (over: Partial<PlanningContract> = {}): PlanningContract => ({
  annual_value: 12000,
  contract_start_date: '2026-07-01',
  contract_end_date: '2028-06-30',
  terminated_at: null,
  billing_frequency: 'annual',
  billing_anchor_month: 7,
  billing_active: true,
  notice_period_months: 6,
  ...over,
})

const line = (over: Partial<EquipmentLine> = {}): EquipmentLine => ({
  id: 'L1',
  contract_id: 'C1',
  name: 'Ljusfälla',
  code: '601',
  quantity: 1,
  unit_price_annual: 1686,
  unit_price_month: 140.5,
  vat_rate: 25,
  billing_model: 'per_year',
  billing_start_date: null,
  station_ids: ['s1'],
  site_customer_id: 'U1',
  unit_name: 'Återvinningscentralen',
  marking: 'YX201',
  ...over,
})

const opts = { window: 'binding' as const, leadDays: 40, today: '2026-11-15', split: true, fallbackMarking: 'AVTAL' }

describe('tilläggens takt', () => {
  it('månadspremie, kvartal/halvår/år och ingen premie', () => {
    expect(addonCadence({ annual_value: 1200, billing_frequency: 'monthly' }, [])).toBe('with_premium')
    expect(addonCadence({ annual_value: 1200, billing_frequency: 'annual' }, [])).toBe('premium_periods')
    expect(addonCadence({ annual_value: 0, billing_frequency: 'monthly' }, [])).toBe('anniversary')
    expect(addonCadence({ annual_value: 1200, billing_frequency: null }, [])).toBe('anniversary')
    expect(addonCadence({ annual_value: 0, billing_frequency: 'annual' }, [{ effective_from: '2026-01-01', annual_value: 5 }])).toBe('premium_periods')
  })
})

describe('A1: månadspremie, tilläggen på månadsfakturan', () => {
  it('1 200 kr/år och två stationer à 1 686 kr/år: 100 + 2 x 140,50', () => {
    const c = contract({ annual_value: 1200, billing_frequency: 'monthly', contract_start_date: '2026-11-01', contract_end_date: '2027-10-31' })
    const lines = [line({ quantity: 2, station_ids: ['s1', 's2'], billing_model: 'per_month', unit_price_month: 140.5, unit_price_annual: 1686 })]
    const plan = computeAddonPlanV2(c, lines, opts)
    expect(plan.cadence).toBe('with_premium')
    expect(plan.groups).toEqual([])
    const months = computePlannedPeriods(c, { ...opts, equipment: plan.premiumEquipment, equipmentMode: 'with_premium' }).map((p) =>
      decorateV2Period(p, plan.premiumEquipment, [], 'AVTAL')
    )
    expect(months[0].amount).toBe(100)
    expect(months[0].equipmentRows).toHaveLength(1)
    expect(months[0].equipmentRows[0]).toMatchObject({ quantity: 2, unit_price: 140.5, total_price: 281, unit_name: 'Återvinningscentralen' })
    expect(months[0].subtotal).toBe(381)
  })
})

describe('A2: årspremie i juli, station beslutad i november', () => {
  it('inga månadsfakturor, en tilläggsfaktura 2027-07-01 med årspris', () => {
    const plan = computeAddonPlanV2(contract(), [line({ billing_start_date: '2027-07-01' })], opts)
    expect(plan.cadence).toBe('premium_periods')
    expect(plan.groups).toHaveLength(1)
    const periods = plan.groups[0].periods
    expect(periods.map((p) => [p.kind, p.periodStart, p.periodEnd])).toEqual([['equipment', '2027-07-01', '2028-06-30']])
    expect(periods[0].equipmentRows[0]).toMatchObject({ unit_price: 1686, quantity: 1, total_price: 1686 })
    expect(plan.groups[0]).toMatchObject({ marking: 'YX201', markingKey: 'YX201' })
  })
})

describe('A3: ingen premie, årsvis på avtalets årsdag (Falu)', () => {
  it('start 2026-09-23 ger 2026-09-23 t.o.m. 2027-09-22 och 2027-09-23 t.o.m. 2028-09-22', () => {
    const c = contract({
      annual_value: 0,
      billing_frequency: 'monthly',
      billing_anchor_month: null,
      contract_start_date: '2026-09-23',
      contract_end_date: '2028-09-22',
    })
    const plan = computeAddonPlanV2(c, [line()], { ...opts, today: '2026-10-30' })
    expect(plan.cadence).toBe('anniversary')
    expect(plan.groups[0].periods.map((p) => [p.periodStart, p.periodEnd])).toEqual([
      ['2026-09-23', '2027-09-22'],
      ['2027-09-23', '2028-09-22'],
    ])
  })
})

describe('A4: en tilläggsfaktura per avtal och referenskod', () => {
  const lines = [
    line({ id: 'A', site_customer_id: 'U1', unit_name: 'Björnhyttan', marking: 'YX201', station_ids: ['a'] }),
    line({ id: 'B', site_customer_id: 'U2', unit_name: 'Gonäs', marking: 'GNU 2026/60', station_ids: ['b'] }),
  ]
  it('två fakturor per period, märkta YX201 respektive GNU 2026/60', () => {
    const plan = computeAddonPlanV2(contract(), lines, opts)
    expect(plan.groups.map((g) => [g.markingKey, g.marking, g.periods.length])).toEqual([
      ['GNU 2026/60', 'GNU 2026/60', 2],
      ['YX201', 'YX201', 2],
    ])
    expect(plan.groups[1].periods[0].equipmentRows.map((r) => r.unit_name)).toEqual(['Björnhyttan'])
  })
  it('utan databasändringen (split falsk): en faktura per period, märkningen per rad', () => {
    const plan = computeAddonPlanV2(contract(), lines, { ...opts, split: false })
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0]).toMatchObject({ markingKey: '', marking: 'AVTAL' })
    const rows = plan.groups[0].periods[0].equipmentRows
    expect(rows.map((r) => r.unit_marking)).toEqual(['YX201', 'GNU 2026/60'])
  })
})

describe('antal minus stationer med täckning för hela perioden', () => {
  it('täckt station räknas inte, delvis täckt räknas', () => {
    const cov = [
      { station_id: 's1', from: '2027-07-01', to: '2028-03-31' },
      { station_id: 's1', from: '2028-04-01', to: '2028-06-30' },
      { station_id: 's2', from: '2027-07-01', to: '2027-12-31' },
    ]
    expect(stationFullyCovered('s1', '2027-07-01', '2028-06-30', cov)).toBe(true)
    expect(stationFullyCovered('s2', '2027-07-01', '2028-06-30', cov)).toBe(false)
    const plan = computeAddonPlanV2(contract(), [line({ quantity: 2, station_ids: ['s1', 's2'] })], { ...opts, coverage: cov })
    const p = plan.groups[0].periods.find((x) => x.periodStart === '2027-07-01')!
    expect(p.equipmentRows[0]).toMatchObject({ quantity: 1, station_ids: ['s2'], total_price: 1686 })
  })
})

describe('FEV: § 6-raden börjar dagen efter avtalsdagen i exakt läge', () => {
  it('raden tas med från periodstart 2027-06-30 i stället för att falla ur', () => {
    const c = contract({ billing_anchor_mode: 'start_day', contract_start_date: '2026-06-30', contract_end_date: '2028-06-29' })
    const plan = computeAddonPlanV2(c, [line({ billing_start_date: '2027-07-01' })], opts)
    const p = plan.groups[0].periods
    expect(p.map((x) => [x.periodStart, x.periodEnd])).toEqual([['2027-06-30', '2028-06-29']])
    expect(p[0].equipmentRows[0].billing_start_snapped).toBe('2027-07-01')
  })
})

describe('befintliga fakturor per märkning', () => {
  const inv = (id: string, status: string, marking_key: string | null = null, invoice_number = `INV-${id}`) => ({
    id,
    status,
    marking_key,
    invoice_number,
    billing_period_start: '2027-07-01',
    billing_period_end: '2028-06-30',
    total_amount: 1,
    subtotal: 1,
    is_historical: false,
    invoice_type: 'contract',
  })
  it('utkast utan nyckel till en grupp, låst utan nyckel till alla, med nyckel till sin grupp', () => {
    const m = existingByMarkingGroup(['YX201', 'YX206'], [inv('d', 'pending_approval'), inv('l', 'sent'), inv('k', 'draft', 'YX301')])
    expect(m.get('YX201')!.map((e) => e.id)).toEqual(['d', 'l'])
    expect(m.get('YX206')!.map((e) => e.id)).toEqual(['l'])
    expect(m.get('YX301')!.map((e) => e.id)).toEqual(['k'])
  })
  it('gruppen utan märkning tar utkastet när den finns', () => {
    const m = existingByMarkingGroup(['', 'YX201'], [inv('d', 'ready')])
    expect(m.get('')!.map((e) => e.id)).toEqual(['d'])
    expect(m.get('YX201')).toEqual([])
  })
})

describe('A6: glappfaktura', () => {
  const cand = (over: Partial<GapCandidate> = {}): GapCandidate => ({
    station_kind: 'outdoor',
    station_id: 's9',
    unit_id: 'U1',
    unit_name: 'Återvinningscentralen',
    station_type_id: 'T1',
    type_name: 'Ljusfälla',
    model: 'per_year',
    annual: 1686,
    start_day: '2026-11-10',
    gap_from: '2026-11-10',
    gap_to: '2027-06-30',
    days: 233,
    end_day: '2027-07-01',
    marking_key: 'YX201',
    on_open_gap_invoice: null,
    ...over,
  })
  it('låst faktura 2026-07-01 t.o.m. 2027-06-30 utan stationen: en glappfaktura 2026-11-10 t.o.m. 2027-06-30', () => {
    const groups = planGapGroups([cand()], { today: '2026-11-15', markingFor: (k) => k })
    expect(groups).toHaveLength(1)
    const p = groups[0].period
    expect([p.kind, p.periodStart, p.periodEnd, p.invoiceDate]).toEqual(['equipment_gap', '2026-11-10', '2027-06-30', '2026-11-15'])
    expect(p.equipmentRows[0]).toMatchObject({ quantity: 1, unit_price: 1076.27, station_ids: ['s9'] })
    expect(p.subtotal).toBe(1076.27)
  })
  it('nästa planering skapar ingen till: samma glapp behålls', () => {
    const groups = planGapGroups([cand()], { today: '2026-11-15', markingFor: (k) => k })
    const existing = [
      {
        id: 'g1',
        status: 'pending_approval',
        marking_key: 'YX201',
        billing_period_start: '2026-11-10',
        billing_period_end: '2027-06-30',
        total_amount: 1345.34,
        subtotal: 1076.27,
        is_historical: false,
        invoice_type: 'contract',
      },
    ]
    expect(buildGapDiff(groups, existing).map((e) => e.action)).toEqual(['keep'])
    expect(buildGapDiff([], existing).map((e) => e.action)).toEqual(['delete'])
  })
  it('stationer med olika glapp får egna fakturor, samma glapp delar faktura och rad', () => {
    const groups = planGapGroups(
      [cand(), cand({ station_id: 's8' }), cand({ station_id: 's7', gap_from: '2026-12-01', days: 212 })],
      { today: '2026-12-02', markingFor: (k) => k }
    )
    expect(groups.map((g) => [g.period.periodStart, g.period.equipmentRows[0].quantity])).toEqual([
      ['2026-11-10', 2],
      ['2026-12-01', 1],
    ])
  })
})
