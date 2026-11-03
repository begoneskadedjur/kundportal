import { describe, expect, it } from 'vitest'
import {
  billingGroupAnchor,
  blockedGroupSlots,
  blockedSlotKey,
  addonFirstBillableStart,
  addonInvoiceCadenceText,
  describeBillingGroup,
  groupNextPeriodStart,
  stockholmDate,
  type AddonBillingGroup,
} from './addonBillingGroups'
import { bucketKeyColumn, buildGapDiff, computeAddonPlanV2, planGapGroups, planIndexSlots, type GapCandidate } from './addonPlanV2'
import type { EquipmentLine, PlanningContract } from './contractPlanner'

// Maserfrakt 4c40f714: årspremie 72 240 från 2026-03-01, exakt avtalsdag
const maser: PlanningContract = {
  annual_value: 72240,
  contract_start_date: '2026-03-01',
  contract_end_date: '2029-02-28',
  terminated_at: null,
  billing_frequency: 'annual',
  billing_anchor_month: 3,
  billing_anchor_mode: 'start_day',
  billing_active: true,
  notice_period_months: 2,
}

const line = (over: Partial<EquipmentLine> = {}): EquipmentLine => ({
  id: 'L1',
  contract_id: 'C1',
  name: 'Ljusfälla',
  code: '601',
  quantity: 1,
  unit_price_annual: 2850,
  unit_price_month: 237.5,
  vat_rate: 25,
  billing_model: 'per_year',
  billing_start_date: null,
  station_ids: ['s1'],
  site_customer_id: 'U1',
  unit_name: 'Gjutargatan',
  marking: null,
  ...over,
})

const group = (over: Partial<AddonBillingGroup> = {}): AddonBillingGroup => ({
  id: 'G1',
  contract_id: 'C1',
  name: 'Grupp',
  cadence: 'monthly',
  anchor_date: null,
  marking: null,
  created_at: '2026-11-03T09:00:00+01:00',
  ...over,
})

const opts = { window: 'binding' as const, leadDays: 40, today: '2026-11-03', split: true, fallbackMarking: null }

describe('gruppens startdag och nästa periodstart (SQL-tvillingen)', () => {
  it('startdagen: anchor_date, avtalsdagen i exakt läge, premiens månadsankare i gamla läget', () => {
    expect(billingGroupAnchor(group({ anchor_date: '2027-01-15' }), maser)).toBe('2027-01-15')
    expect(billingGroupAnchor(group(), maser)).toBe('2026-03-01')
    const old = { contract_start_date: '2026-09-23', billing_anchor_mode: null, billing_anchor_month: 1 }
    expect(billingGroupAnchor(group({ cadence: 'annual' }), old)).toBe('2026-01-01')
    expect(billingGroupAnchor(group({ cadence: 'quarterly' }), old)).toBe('2026-09-01')
    expect(billingGroupAnchor(group(), { contract_start_date: null, billing_anchor_mode: null, billing_anchor_month: null })).toBeNull()
  })

  it('nästa periodstart: månad, kvartal, före startdagen och följer premien', () => {
    expect(groupNextPeriodStart(group(), maser, '2026-11-03')).toBe('2026-12-01')
    expect(groupNextPeriodStart(group({ cadence: 'quarterly' }), maser, '2026-11-03')).toBe('2026-12-01')
    expect(groupNextPeriodStart(group({ cadence: 'quarterly', anchor_date: '2027-01-01' }), maser, '2026-11-03')).toBe('2027-01-01')
    expect(groupNextPeriodStart(group({ cadence: 'semi_annual', anchor_date: '2026-01-31' }), maser, '2026-11-03')).toBe('2027-01-31')
    expect(groupNextPeriodStart(group({ cadence: 'annual', anchor_date: '2026-02-28' }), maser, '2026-11-03')).toBe('2027-02-28')
    expect(groupNextPeriodStart(group({ cadence: 'follows_premium' }), maser, '2026-11-03')).toBeNull()
  })

  it('skapad-dagen i svensk tid och beskrivningen', () => {
    expect(stockholmDate('2026-11-02T23:30:00Z')).toBe('2026-11-03')
    expect(stockholmDate('2026-11-03')).toBe('2026-11-03')
    expect(describeBillingGroup(group({ cadence: 'quarterly', anchor_date: '2027-01-01', marking: 'KV-1' }))).toBe('Varje kvartal, från 2027-01-01, märkning KV-1')
  })
})

describe('prov: Maserfrakt med en månadsgrupp och en kvartalsgrupp', () => {
  const mek = line({ id: 'MEK', name: 'Mekanisk fälla', quantity: 2, billing_model: 'per_month', unit_price_month: 325, unit_price_annual: 3900, billing_start_date: '2026-12-01', station_ids: ['m1', 'm2'] })
  const bete = line({ id: 'BETE', name: 'Betesstation', quantity: 2, billing_model: 'per_month', unit_price_month: 165, unit_price_annual: 1980, billing_start_date: '2026-12-01', station_ids: ['b1', 'b2'] })
  const ljusB = line({ id: 'LB', billing_start_date: '2027-03-01', station_ids: ['lb'] })
  const ljusG = line({ id: 'LG', billing_start_date: '2027-03-01', station_ids: ['lg'], unit_name: 'Katrineborgsgatan', site_customer_id: 'U2' })
  const manad = group({ id: 'GM', name: 'Månadsvis', cadence: 'monthly', marking: 'MÅN-1' })
  const kvartal = group({ id: 'GK', name: 'Kvartalsvis', cadence: 'quarterly', anchor_date: '2027-01-01' })
  const lines = [mek, { ...bete, billing_group_id: 'GM' }, { ...ljusB, billing_group_id: 'GK' }, ljusG]

  it('utan grupper: exakt dagens plan (grupplistan tom eller raden utan grupp)', () => {
    const base = computeAddonPlanV2(maser, [mek, bete, ljusB, ljusG], opts)
    const withEmpty = computeAddonPlanV2(maser, [mek, bete, ljusB, ljusG], { ...opts, billingGroups: [manad, kvartal] })
    expect(withEmpty).toEqual(base)
    expect(base.groupBuckets).toEqual([])
    // Rad med grupp som inte finns på avtalet: som utan grupp
    const unknown = computeAddonPlanV2(maser, [{ ...mek, billing_group_id: 'X' }, bete, ljusB, ljusG], { ...opts, billingGroups: [manad] })
    expect(unknown.monthly).toEqual(base.monthly)
    expect(unknown.groupBuckets).toEqual([])
  })

  const plan = computeAddonPlanV2(maser, lines, { ...opts, billingGroups: [manad, kvartal] })

  it('rader utan grupp följer dagens regler: mekaniska fällor månadsvis, ljusfällan årsvis', () => {
    expect(plan.monthlyLines.map((l) => l.id)).toEqual(['MEK'])
    expect(plan.monthly[0]).toMatchObject({ periodStart: '2026-12-01', subtotal: 650 })
    expect(plan.groups.flatMap((g) => g.lines.map((l) => l.id))).toEqual(['LG'])
    expect(plan.groups[0].periods[0]).toMatchObject({ periodStart: '2027-03-01', periodEnd: '2028-02-29', subtotal: 2850 })
  })

  it('månadsgruppen: betesstationerna på egna månadsfakturor med gruppens märkning', () => {
    const b = plan.groupBuckets.find((x) => x.billingGroupId === 'GM')!
    expect(b).toMatchObject({ kind: 'equipment_monthly', marking: 'MÅN-1', markingKey: 'MÅN-1', groupName: 'Månadsvis' })
    // Exakt läge: månader från avtalsdagen (den 1:a), från 2026-12-01 (radens start)
    expect(b.periods[0]).toMatchObject({ kind: 'equipment_monthly', periodStart: '2026-12-01', periodEnd: '2026-12-31', subtotal: 330 })
    expect(b.periods.every((p) => p.subtotal === 330)).toBe(true)
    expect(bucketKeyColumn(b, true)).toBe('MÅN-1')
  })

  it('kvartalsgruppen: ljusfällan 2 850 / 4 = 712,50 per kvartal i kvartal från 2027-01-01', () => {
    const b = plan.groupBuckets.find((x) => x.billingGroupId === 'GK')!
    expect(b.kind).toBe('equipment')
    expect(b.periods.slice(0, 3).map((p) => [p.kind, p.periodStart, p.periodEnd, p.subtotal])).toEqual([
      // Raden börjar 2027-03-01, mitt i kvartalet: startdagen snäpps till kvartalets start
      // (dagarna före är betalda och dras av via täckningen, se nästa test)
      ['equipment', '2027-01-01', '2027-03-31', 712.5],
      ['equipment', '2027-04-01', '2027-06-30', 712.5],
      ['equipment', '2027-07-01', '2027-09-30', 712.5],
    ])
  })

  it('täckning dras av per grupp: ljusfällan täckt t.o.m. 2027-08-09 ger delvis kvartal', () => {
    const p = computeAddonPlanV2(maser, lines, { ...opts, billingGroups: [manad, kvartal], coverage: [{ station_id: 'lb', from: '2026-08-10', to: '2027-08-09' }] })
    const b = p.groupBuckets.find((x) => x.billingGroupId === 'GK')!
    expect(b.periods[0]).toMatchObject({ periodStart: '2027-07-01' })
    const r = b.periods[0].equipmentRows[0]
    // 2027-08-10 t.o.m. 2027-09-30 = 52 av 92 dagar: 712,50 × 52 / 92 = 402,72
    expect([r.unit_price, r.billed_period]).toEqual([402.72, { from: '2027-08-10', to: '2027-09-30' }])
  })

  it('perioder före gruppens skapad-dag tas inte med', () => {
    const late = group({ id: 'GK', name: 'Kvartalsvis', cadence: 'quarterly', anchor_date: '2027-01-01', created_at: '2027-05-10T08:00:00Z' })
    const p = computeAddonPlanV2(maser, lines, { ...opts, billingGroups: [manad, late] })
    expect(p.groupBuckets.find((x) => x.billingGroupId === 'GK')!.periods[0].periodStart).toBe('2027-07-01')
  })

  it('följer premien: egna fakturor för gruppen men premiens perioder', () => {
    const f = group({ id: 'GF', name: 'Följer', cadence: 'follows_premium', marking: 'EGEN' })
    const p = computeAddonPlanV2(maser, [{ ...ljusB, billing_group_id: 'GF' }], { ...opts, billingGroups: [f] })
    expect(p.groups).toEqual([])
    const b = p.groupBuckets[0]
    expect(b).toMatchObject({ kind: 'equipment', marking: 'EGEN' })
    expect(b.periods[0]).toMatchObject({ periodStart: '2027-03-01', periodEnd: '2028-02-29', subtotal: 2850 })
    // Månadspremie: följer premien = på premiefakturan som förut
    const mp = computeAddonPlanV2({ ...maser, billing_frequency: 'monthly' }, [{ ...ljusB, billing_group_id: 'GF' }], { ...opts, billingGroups: [f] })
    expect(mp.premiumEquipment.map((l) => l.id)).toEqual(['LB'])
    expect(mp.groupBuckets).toEqual([])
  })

  it('månadsgrupp vid månadspremie: egna månadsfakturor, årsrad delad på 12', () => {
    const p = computeAddonPlanV2({ ...maser, billing_frequency: 'monthly' }, [{ ...ljusB, billing_start_date: '2026-12-01', billing_group_id: 'GM' }], { ...opts, billingGroups: [manad] })
    expect(p.premiumEquipment).toEqual([])
    expect(p.groupBuckets[0].periods[0]).toMatchObject({ kind: 'equipment_monthly', periodStart: '2026-12-01', subtotal: 237.5 })
  })
})

describe('gamla unika indexet: krockande gruppfakturor väntar', () => {
  const mek = line({ id: 'MEK', billing_model: 'per_month', unit_price_month: 325, billing_start_date: '2026-12-01', station_ids: ['m1'] })
  const bete = line({ id: 'BETE', billing_model: 'per_month', unit_price_month: 165, billing_start_date: '2026-12-01', station_ids: ['b1'], billing_group_id: 'GM' })
  const plan = computeAddonPlanV2(maser, [mek, bete], { ...opts, billingGroups: [group({ id: 'GM', marking: null })] })

  it('samma typ, periodstart och märkning som fakturan utan grupp: gruppens hålls tillbaka, utan grupp aldrig', () => {
    const blocked = blockedGroupSlots(planIndexSlots(plan, true), [], false)
    expect(blocked.has(blockedSlotKey('GM', 'equipment_monthly', '2026-12-01', null))).toBe(true)
    expect([...blocked].every((k) => k.startsWith('GM|'))).toBe(true)
    // Drop-raden körd: inget väntar
    expect(blockedGroupSlots(planIndexSlots(plan, true), [], true).size).toBe(0)
  })

  it('egen märkning: ingen krock', () => {
    const p = computeAddonPlanV2(maser, [mek, bete], { ...opts, billingGroups: [group({ id: 'GM', marking: 'EGEN' })] })
    expect(blockedGroupSlots(planIndexSlots(p, true), [], false).size).toBe(0)
  })

  it('befintlig faktura i en annan grupp krockar också', () => {
    const p = computeAddonPlanV2(maser, [{ ...bete }], { ...opts, billingGroups: [group({ id: 'GM', marking: 'EGEN' })] })
    const blocked = blockedGroupSlots(planIndexSlots(p, true), [{ kind: 'equipment_monthly', start: '2027-01-01', key: 'EGEN', groupId: 'ANNAN' }], false)
    expect([...blocked]).toEqual([blockedSlotKey('GM', 'equipment_monthly', '2027-01-01', 'EGEN')])
  })
})

describe('glapp per grupp', () => {
  const cand = (over: Partial<GapCandidate>): GapCandidate => ({
    station_kind: 'outdoor',
    station_id: 's1',
    unit_id: 'U1',
    unit_name: 'Gjutargatan',
    station_type_id: 'T1',
    type_name: 'Ljusfälla',
    model: 'per_year',
    annual: 3650,
    start_day: '2026-11-10',
    gap_from: '2026-11-10',
    gap_to: '2026-11-30',
    days: 21,
    end_day: '2026-12-01',
    marking_key: '',
    on_open_gap_invoice: null,
    ...over,
  })

  it('utan grupp som förut; med grupp egen glappfaktura och egen matchning', () => {
    const groups = planGapGroups([cand({}), cand({ station_id: 's2', billing_group_id: 'GM' })], { today: '2026-11-15', markingFor: () => null })
    expect(groups.map((g) => [g.billingGroupId ?? null, g.period.equipmentRows[0].station_ids])).toEqual([
      [null, ['s1']],
      ['GM', ['s2']],
    ])
    const diff = buildGapDiff(groups, [
      { id: 'I1', status: 'draft', billing_period_start: '2026-11-10', billing_period_end: '2026-11-30', total_amount: 0, subtotal: 210, is_historical: false, marking_key: null, addon_billing_group_id: null },
    ])
    expect(diff.map((d) => [d.action, d.gap?.billingGroupId ?? null])).toEqual([
      ['keep', null],
      ['create', 'GM'],
    ])
  })
})

describe('pro rata-spegeln räknar till gruppens nästa periodstart', () => {
  it('kvartalsgrupp från 2027-01-01: station utsatt 2026-11-10 räknas till 2027-01-01, utan grupp till avtalsdagen', async () => {
    const { prorataEnd } = await import('./addonProrata')
    const c = { contract_start_date: '2026-03-01', billing_frequency: 'annual', billing_anchor_mode: 'start_day', billing_anchor_month: 3 }
    expect(prorataEnd('s1', '2026-11-10', c, [], { cadence: 'quarterly', anchor_date: '2027-01-01' })?.endDay).toBe('2027-01-01')
    expect(prorataEnd('s1', '2026-11-10', c, [], { cadence: 'monthly', anchor_date: null })?.endDay).toBe('2026-12-01')
    expect(prorataEnd('s1', '2026-11-10', c, [], { cadence: 'follows_premium', anchor_date: null })?.endDay).toBe('2027-03-01')
    expect(prorataEnd('s1', '2026-11-10', c, [])?.endDay).toBe('2027-03-01')
  })
})

describe('addonInvoiceCadenceText (Besluta tillägg)', () => {
  it('utan grupp och med följer premien: samma text som förut', () => {
    expect(addonInvoiceCadenceText(null)).toBe('Egen faktura i samband med avtalets årsfaktura')
    expect(addonInvoiceCadenceText(undefined)).toBe('Egen faktura i samband med avtalets årsfaktura')
    expect(addonInvoiceCadenceText('follows_premium')).toBe('Egen faktura i samband med avtalets årsfaktura')
  })
  it('gruppens takt', () => {
    expect(addonInvoiceCadenceText('monthly')).toBe('Egen faktura varje månad')
    expect(addonInvoiceCadenceText('quarterly')).toBe('Egen faktura varje kvartal')
    expect(addonInvoiceCadenceText('semi_annual')).toBe('Egen faktura varje halvår')
    expect(addonInvoiceCadenceText('annual')).toBe('Egen faktura varje år')
  })
  it('okänt intervall faller tillbaka', () => {
    expect(addonInvoiceCadenceText('okand')).toBe('Egen faktura i samband med avtalets årsfaktura')
  })
})

describe('steg 0c: pro rata räknar till första periodstart planeraren fakturerar', () => {
  const c = { contract_start_date: '2026-03-01', billing_frequency: 'annual', billing_anchor_mode: 'start_day', billing_anchor_month: 3 }
  const today = '2026-11-03'
  const bete = line({ id: 'BETE', name: 'Betesstation', quantity: 2, billing_model: 'per_month', unit_price_month: 325, unit_price_annual: 3900, station_ids: ['b1', 'b2'] })
  const firstPlanned = (g: AddonBillingGroup, bsd: string, model: 'per_month' | 'per_year' = 'per_month') => {
    const l = model === 'per_month' ? { ...bete, billing_start_date: bsd, billing_group_id: g.id } : { ...line({ station_ids: ['b1'] }), billing_start_date: bsd, billing_group_id: g.id }
    const p = computeAddonPlanV2(maser, [l], { ...opts, billingGroups: [g] })
    // Planeraren skapar inga passerade perioder (isHistorical, före innevarande månad)
    return p.groupBuckets[0].periods.find((x) => !x.isHistorical)?.periodStart ?? null
  }
  const scenario = async (g: AddonBillingGroup, bsd: string, startDay: string, model: 'per_month' | 'per_year' = 'per_month') => {
    const { prorataEnd } = await import('./addonProrata')
    const minStart = addonFirstBillableStart({ group: g, contract: maser, model, premiumFrequency: 'annual', today, lineStart: bsd })
    return { minStart, end: prorataEnd('b1', startDay, c, [], g, { minStart })?.endDay, planned: firstPlanned(g, bsd, model) }
  }

  it('månadsgrupp skapad i dag (T10): 2026-12-01 i stället för 2026-10-01', async () => {
    const g = group({ id: 'GM', cadence: 'monthly' })
    // Ny rad i gruppen: gruppens nästa periodstart (addon_line_start_for_group)
    const bsd = groupNextPeriodStart(g, maser, today)!
    expect(bsd).toBe('2026-12-01')
    const { prorataEnd } = await import('./addonProrata')
    expect(prorataEnd('b1', '2026-09-23', c, [], g)?.endDay).toBe('2026-10-01')
    expect(await scenario(g, bsd, '2026-09-23')).toEqual({ minStart: '2026-12-01', end: '2026-12-01', planned: '2026-12-01' })
  })

  it('månadsgrupp skapad 2026-10-15 med raden från 2026-11-01: november faktureras av planeraren', async () => {
    const g = group({ id: 'GM', cadence: 'monthly', created_at: '2026-10-15T08:00:00Z' })
    expect(await scenario(g, '2026-11-01', '2026-09-23')).toEqual({ minStart: '2026-11-01', end: '2026-11-01', planned: '2026-11-01' })
  })

  it('kvartalsgrupp från 2027-01-01: oförändrat 2027-01-01', async () => {
    const g = group({ id: 'GK', cadence: 'quarterly', anchor_date: '2027-01-01' })
    expect(await scenario(g, '2027-01-01', '2026-09-23', 'per_year')).toEqual({ minStart: '2027-01-01', end: '2027-01-01', planned: '2027-01-01' })
  })

  it('kvartalsgrupp från avtalsdagen: passerad period och perioden före gruppen hoppas över', async () => {
    const g = group({ id: 'GK', cadence: 'quarterly', created_at: '2026-10-15T08:00:00Z' })
    // Utsatt 2026-07-10: nästa periodstart 2026-09-01 är passerad, planeraren börjar 2026-12-01
    expect(await scenario(g, '2026-12-01', '2026-07-10', 'per_year')).toEqual({ minStart: '2026-12-01', end: '2026-12-01', planned: '2026-12-01' })
  })

  it('utan grupp: per månad till radens start, per år ingen gräns (oförändrat)', () => {
    const base = { group: null, contract: maser, premiumFrequency: 'annual', today }
    expect(addonFirstBillableStart({ ...base, model: 'per_month', lineStart: '2026-12-01' })).toBe('2026-12-01')
    expect(addonFirstBillableStart({ ...base, model: 'per_month', lineStart: '2026-10-01' })).toBe('2026-11-01')
    expect(addonFirstBillableStart({ ...base, model: 'per_year', lineStart: '2027-03-01' })).toBeNull()
    // Månadspremie: per månad ligger på premiefakturan, ingen gräns
    expect(addonFirstBillableStart({ ...base, premiumFrequency: 'monthly', model: 'per_month', lineStart: '2026-12-01' })).toBeNull()
  })

  it('utkast före första planerade periodstart: med stationen stoppar, utan stationen hoppas över', async () => {
    const { prorataEnd } = await import('./addonProrata')
    const g = group({ id: 'GM', cadence: 'monthly' })
    const oct = { periodStart: '2026-10-01', periodEnd: '2026-10-31' }
    expect(prorataEnd('b1', '2026-09-23', c, [], g, { minStart: '2026-12-01', openInvoices: [{ ...oct, stationIds: ['b1'] }] })?.endDay).toBe('2026-10-01')
    expect(prorataEnd('b1', '2026-09-23', c, [], g, { minStart: '2026-12-01', openInvoices: [{ ...oct, stationIds: ['x'] }] })?.endDay).toBe('2026-12-01')
    // Låst faktura med stationen stoppar som förut
    expect(prorataEnd('b1', '2026-09-23', c, [{ ...oct, stationIds: ['b1'] }], g, { minStart: '2026-12-01' })?.endDay).toBe('2026-10-01')
  })
})
