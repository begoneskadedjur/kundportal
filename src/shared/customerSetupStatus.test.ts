import { describe, it, expect } from 'vitest'
import { computeSetupStatus, isPrivateCustomer, type SetupCustomerRow, type SetupInput, type SetupSchedule } from './customerSetupStatus'

const TODAY = '2026-10-22'

const row = (over: Partial<SetupCustomerRow> = {}): SetupCustomerRow => ({
  id: 'k1',
  company_name: 'TP Förskolor',
  customer_number: 2560,
  fortnox_verified_at: '2026-09-21T10:00:00Z',
  organization_number: '556677-8899',
  parent_customer_id: null,
  is_active: true,
  business_type: 'business',
  contract_type: 'Serviceavtal',
  invoice_delivery_method: 'email',
  invoice_delivery_source: 'kund',
  invoice_delivery_confirmed_by_name: 'Fakturamejl i avtalet',
  billing_email: 'faktura@tpforskolor.se',
  billing_address: null,
  contract_start_date: '2025-11-01',
  contract_end_date: '2026-11-01',
  notice_period_months: 2,
  ...over,
})

const schedule = (over: Partial<SetupSchedule> = {}): SetupSchedule => ({
  id: 's1',
  customer_id: 'k1',
  technician_id: 't1',
  technician_name: 'Mathias Carlsson',
  frequency: 'quarterly',
  generated_until: '2027-11-01',
  contract: { contract_start_date: '2025-11-01', contract_end_date: '2026-11-01', notice_period_months: 2 },
  ...over,
})

const input = (over: Partial<SetupInput> = {}): SetupInput => ({
  kind: 'single',
  root: row(),
  units: [],
  terminated: false,
  map: { root_customer_id: 'k1', status: 'complete', missing: [] },
  schedules: [schedule()],
  contractTypes: [{ customer_id: 'k1', contract_type: 'Serviceavtal' }],
  portal: { active: false, invited: true },
  today: TODAY,
  ...over,
})

const state = (i: SetupInput, key: string) => computeSetupStatus(i).items.find((x) => x.key === key)!

describe('computeSetupStatus', () => {
  it('komplett kund: alla klara, inget kvar', () => {
    const s = computeSetupStatus(input())
    expect(s.complete).toBe(true)
    expect(s.remaining).toBe(0)
    expect(s.next).toBeNull()
    expect(s.items.map((i) => i.key)).toEqual(['avtal', 'fortnox', 'vag', 'schema', 'portal'])
    expect(s.items.every((i) => i.state === 'done')).toBe(true)
  })

  it('uppsagd kund får ingen status', () => {
    const s = computeSetupStatus(input({ terminated: true }))
    expect(s.terminated).toBe(true)
    expect(s.items).toHaveLength(0)
  })

  it('avtal: saknas utan karta, påbörjat med steg kvar, Schema räknas inte två gånger', () => {
    expect(state(input({ map: { root_customer_id: 'k1', status: 'none', missing: [] } }), 'avtal').state).toBe('missing')
    const p = state(input({ map: { root_customer_id: 'k1', status: 'incomplete', missing: ['Fakturaplan', 'Schema'] } }), 'avtal')
    expect(p.state).toBe('partial')
    expect(p.reason).toContain('Fakturaplan')
    expect(p.reason).not.toContain('Schema')
    expect(p.target).toEqual({ page: 'record', customerId: 'k1', tab: 'avtalskarta' })
    expect(state(input({ map: { root_customer_id: 'k1', status: 'incomplete', missing: ['Schema'] } }), 'avtal').state).toBe('done')
  })

  it('fortnox: verifierat, ej verifierat, inget nummer', () => {
    expect(state(input(), 'fortnox').state).toBe('done')
    const p = state(input({ root: row({ fortnox_verified_at: null }) }), 'fortnox')
    expect(p.state).toBe('partial')
    expect(p.reason).toContain('2560')
    expect(p.nextLabel).toBe('Verifiera i Fortnox')
    expect(p.target).toEqual({ page: 'edit', customerId: 'k1' })
    expect(state(input({ root: row({ customer_number: null }) }), 'fortnox').state).toBe('missing')
  })

  it('fakturaväg: satt, kontaktpersonens e-post som reserv, saknas', () => {
    const d = state(input(), 'vag')
    expect(d.state).toBe('done')
    expect(d.reason).toContain('faktura@tpforskolor.se')
    expect(state(input({ root: row({ invoice_delivery_confirmed_by_name: 'Kontaktpersonens e-post (avtalet saknade fakturauppgift)' }) }), 'vag').state).toBe('partial')
    expect(state(input({ root: row({ invoice_delivery_method: null }) }), 'vag').state).toBe('missing')
  })

  it('schema: klart, utan tekniker, slutar före avtalsåret, saknas, avrop', () => {
    expect(state(input(), 'schema').state).toBe('done')
    const noTech = state(input({ schedules: [schedule({ technician_id: null })] }), 'schema')
    expect(noTech.state).toBe('partial')
    expect(noTech.nextLabel).toBe('Sätt tekniker på schemat')
    // Avtalsåret slutar 2026-11-01, sista uppsägningsdag passerad: 2027-11-01 gäller
    const early = state(input({ schedules: [schedule({ generated_until: '2026-12-20' })] }), 'schema')
    expect(early.state).toBe('partial')
    expect(early.reason).toContain('2026-12-20')
    // En månads marginal före avtalsårets slut räcker
    expect(state(input({ schedules: [schedule({ generated_until: '2027-10-15' })] }), 'schema').state).toBe('done')
    expect(state(input({ schedules: [] }), 'schema').state).toBe('missing')
    const avrop = state(input({ schedules: [], contractTypes: [{ customer_id: 'k1', contract_type: 'Avropsavtal' }] }), 'schema')
    expect(avrop.state).toBe('na')
    expect(avrop.target).toBeNull()
    // Avrop med schema bedöms som vanligt
    expect(state(input({ contractTypes: [{ customer_id: 'k1', contract_type: 'Avropsavtal' }] }), 'schema').state).toBe('done')
    expect(state(input({ schedules: [], onDemandCustomerIds: new Set(['k1']) }), 'schema').state).toBe('na')
  })

  it('kundportalen: inbjuden, ej inbjuden, privatkund', () => {
    expect(state(input(), 'portal').state).toBe('done')
    expect(state(input({ portal: { active: false, invited: false } }), 'portal').state).toBe('missing')
    expect(state(input({ root: row({ business_type: 'private' }) }), 'portal').state).toBe('na')
    expect(state(input({ root: row({ organization_number: '19800101-1234', business_type: null }) }), 'portal').state).toBe('na')
  })

  it('nästa åtgärd följer ordningen avtal, Fortnox, fakturaväg, schema, kundportalen', () => {
    const s = computeSetupStatus(input({
      root: row({ fortnox_verified_at: null }),
      portal: { active: false, invited: false },
    }))
    expect(s.remaining).toBe(2)
    expect(s.next?.key).toBe('fortnox')
    expect(s.next?.nextLabel).toBe('Verifiera i Fortnox')
    expect(s.complete).toBe(false)
  })
})

describe('multisite', () => {
  const hk = row({ id: 'hk', company_name: 'WBAB', customer_number: 5007 })
  const unit = (id: string, over: Partial<SetupCustomerRow> = {}) =>
    row({ id, site_name: `Enhet ${id}`, parent_customer_id: 'hk', customer_number: null, fortnox_verified_at: null, invoice_delivery_method: null, organization_number: '556677-8899', ...over })

  const multi = (units: SetupCustomerRow[], over: Partial<SetupInput> = {}) => input({
    kind: 'multisite', root: hk, units,
    map: { root_customer_id: 'hk', status: 'complete', missing: [] },
    schedules: units.map((u, i) => schedule({ id: `s${i}`, customer_id: u.id })),
    contractTypes: [],
    ...over,
  })

  it('enheter i huvudkontorets bolag gäller inte: huvudraden är klar', () => {
    const s = computeSetupStatus(multi([unit('u1'), unit('u2')]))
    expect(s.items.find((i) => i.key === 'fortnox')!.state).toBe('done')
    expect(s.items.find((i) => i.key === 'vag')!.state).toBe('done')
  })

  it('sämsta läget bland enheterna, orsaken räknar enheterna', () => {
    const units = [
      unit('u1'),
      unit('u2', { organization_number: '559000-0001' }),
      unit('u3', { organization_number: '559000-0002' }),
    ]
    const f = state(multi(units), 'fortnox')
    expect(f.state).toBe('missing')
    expect(f.reason).toContain('2 av 3 enheter har inget eget kundnummer')
    expect(f.target).toEqual({ page: 'record', customerId: 'hk', tab: 'enheter' })
    const v = state(multi(units), 'vag')
    expect(v.state).toBe('missing')
    expect(v.reason).toContain('2 av 3 enheter')
  })

  it('delat nummer: enhet vars org.nr bärs av en annan rad i familjen', () => {
    const units = [
      unit('u1', { organization_number: '559000-0001', customer_number: 7001, fortnox_verified_at: '2026-10-01' }),
      unit('u2', { organization_number: '559000-0001' }),
    ]
    expect(state(multi(units), 'fortnox').state).toBe('done')
  })

  it('schema: enheter utan schema räknas när avtalskartan kräver schema', () => {
    const units = [unit('u1'), unit('u2'), unit('u3')]
    const scheds = [schedule({ customer_id: 'u1' })]
    expect(state(multi(units, { schedules: scheds }), 'schema').state).toBe('done')
    const m = state(multi(units, { schedules: scheds, map: { root_customer_id: 'hk', status: 'incomplete', missing: ['Schema'] } }), 'schema')
    expect(m.state).toBe('missing')
    expect(m.reason).toContain('2 av 3 enheter saknar återkommande besök')
  })

  it('inaktiva enheter räknas inte', () => {
    const units = [unit('u1'), unit('u2', { organization_number: '559000-0001', is_active: false })]
    expect(state(multi(units), 'fortnox').state).toBe('done')
  })
})

describe('isPrivateCustomer', () => {
  it('personnummer eller business_type private', () => {
    expect(isPrivateCustomer({ organization_number: '198001011234', business_type: null })).toBe(true)
    expect(isPrivateCustomer({ organization_number: '5593789208', business_type: 'business' })).toBe(false)
    expect(isPrivateCustomer({ organization_number: null, business_type: 'private' })).toBe(true)
  })
})
