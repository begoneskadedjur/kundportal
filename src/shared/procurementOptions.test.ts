import { describe, expect, it } from 'vitest'
import { computeContractEnd, contactFromTed, contractWorkWindow, parseRenewalOptions, windowEntriesToNotify, windowReferenceEnd, workWindow, type WindowAwardRow } from './procurementRules'
// @ts-expect-error ren .mjs utan typer: spegeln som importskripten använder
import * as mirror from '../../scripts/lib/procurementImportShared.mjs'

// Texterna nedan är riktiga BT-57/BT-54-värden ur procurement_awards.raw (2026-10-16)
describe('parseRenewalOptions', () => {
  it('längd per förlängning gånger antalet ur BT-58', () => {
    expect(parseRenewalOptions({ count: 2, renewalText: 'Förlängning är 12 månader' })).toMatchObject({ count: 2, monthsEach: 12, totalMonths: 24, known: true })
    expect(parseRenewalOptions({ count: 1, renewalText: 'Förlängning är 24 månader' })).toMatchObject({ totalMonths: 24, known: true })
    expect(parseRenewalOptions({ count: 2, renewalText: 'Renewal lenght is 12 months' })).toMatchObject({ totalMonths: 24 })
  })

  it('längd gånger antal i texten', () => {
    expect(parseRenewalOptions({ count: 2, renewalText: '24 months * 2' })).toMatchObject({ count: 2, monthsEach: 24, totalMonths: 48 })
    expect(parseRenewalOptions({ count: null, renewalText: 'Avtalet kan förlängas 2 x 12 månader' })).toMatchObject({ count: 2, totalMonths: 24 })
  })

  it('total förlängning och 1+1 år', () => {
    expect(parseRenewalOptions({ count: 2, renewalText: 'Förlängning kan ske i max 2 år' })).toMatchObject({ totalMonths: 24, monthsEach: 12 })
    expect(parseRenewalOptions({ count: null, renewalText: 'Option på förlängning 1+1 år' })).toMatchObject({ count: 2, totalMonths: 24 })
  })

  it('sista möjliga slutdatum', () => {
    const r = parseRenewalOptions({ count: 2, renewalText: 'Förlängningsoption av avtal max till 2030-03-27.' })
    expect(r).toMatchObject({ maxEnd: '2030-03-27', known: true })
  })

  it('N/A och optioner som inte gäller förlängning ger inget', () => {
    expect(parseRenewalOptions({ count: 2, renewalText: 'N/A' }).known).toBe(false)
    expect(parseRenewalOptions({ count: 2, optionText: 'Möjlighet bör finnas att avropa sensorer för temperaturmätning.' }).known).toBe(false)
    expect(parseRenewalOptions({ count: 2, optionText: 'Options to extend the term by 24 months * 2' })).toMatchObject({ totalMonths: 48 })
  })
})

describe('computeContractEnd med riktiga optioner', () => {
  it('TED slutdatum plus optioner ur annonsen, med motivering', () => {
    const r = computeContractEnd({ tedEnd: '2023-06-30', renewalMax: 1, optionMonths: 24, optionsText: 'Förlängning är 24 månader' })
    expect(r).toMatchObject({ date: '2025-06-30', source: 'ted_end_plus_renewals', baseEnd: '2023-06-30', optionMonths: 24 })
    expect(r.basis).toContain('enligt annonsen')
  })

  it('sista möjliga slut går före antagandet två plus två år', () => {
    const r = computeContractEnd({ contractSignedDate: '2026-02-27', renewalMax: 2, optionsMaxEnd: '2030-03-27', optionsText: 'max till 2030-03-27' })
    expect(r).toMatchObject({ date: '2030-03-27', source: 'assumption_2_2', baseEnd: '2028-02-27' })
    expect(r.basis).toContain('förlängning till 2030-03-27')
  })

  it('utan optionstext antas ett år per förlängning som förut', () => {
    const r = computeContractEnd({ tedEnd: '2026-06-30Z', renewalMax: 2 })
    expect(r).toMatchObject({ date: '2028-06-30', baseEnd: '2026-06-30', optionMonths: 24 })
    expect(r.basis).toContain('antaget ett år vardera')
  })

  it('bearbetningsfönstret räknas mot basavtalets slut, inte mot optionerna (beslut 2026-10-16)', () => {
    const assumed = computeContractEnd({ tedEnd: '2027-01-31', renewalMax: 1 })
    const real = computeContractEnd({ tedEnd: '2027-01-31', renewalMax: 1, optionMonths: 24 })
    expect(real.date).toBe('2029-01-31')
    expect(contractWorkWindow(assumed)).toEqual({ start: '2025-07-31', end: '2026-01-31' })
    expect(contractWorkWindow(real)).toEqual({ start: '2025-07-31', end: '2026-01-31' })
    // Utan basavtal (Mercell) räknas fönstret mot slutet som förut
    const mercell = computeContractEnd({ mercellExpiry: '2027-06-30' })
    expect(contractWorkWindow(mercell)).toEqual(workWindow('2027-06-30'))
  })

  it('rättat slut går före basavtalet, basavtalet före beräknat slut', () => {
    expect(windowReferenceEnd({ correctedEnd: '2028-01-01', baseEnd: '2027-01-31', calcEnd: '2029-01-31' })).toBe('2028-01-01')
    expect(windowReferenceEnd({ baseEnd: '2027-01-31', calcEnd: '2029-01-31' })).toBe('2027-01-31')
    expect(windowReferenceEnd({ baseEnd: null, calcEnd: '2029-01-31' })).toBe('2029-01-31')
  })

  it('spegeln i scripts/lib/procurementImportShared.mjs räknar likadant', () => {
    const inputs = [
      { tedEnd: '2027-01-31', renewalMax: 2, optionMonths: 24, optionsText: 'Förlängning är 12 månader' },
      { contractSignedDate: '2026-02-27', renewalMax: 2, optionsMaxEnd: '2030-03-27', optionsText: 'max till 2030-03-27' },
      { contractStart: '2024-05-07', durationMonths: 48, durationFrom: 'ted' as const, renewalMax: 2, optionMonths: 48 },
      { awardDate: '2024-01-10' },
      { contractStart: '2024-01-01', renewalMax: 0 },
      { tedEnd: '2026-06-30Z', renewalMax: 2 },
    ]
    for (const i of inputs) {
      expect(mirror.computeContractEnd(i)).toEqual(computeContractEnd(i))
      expect(mirror.contractWorkWindow(mirror.computeContractEnd(i))).toEqual(contractWorkWindow(computeContractEnd(i)))
    }
    const refs = [{ correctedEnd: '2028-01-01', baseEnd: '2027-01-31', calcEnd: '2029-01-31' }, { baseEnd: '2027-01-31', calcEnd: '2029-01-31' }, { calcEnd: '2029-01-31' }, {}]
    for (const r of refs) expect(mirror.windowReferenceEnd(r)).toEqual(windowReferenceEnd(r))
    const texts = ['Förlängning är 12 månader', '24 months * 2', 'Förlängningsoption av avtal max till 2030-03-27.', 'Förlängning kan ske i max 2 år', 'N/A']
    for (const t of texts) expect(mirror.parseRenewalOptions({ count: 2, renewalText: t })).toEqual(parseRenewalOptions({ count: 2, renewalText: t }))
  })
})

describe('windowEntriesToNotify', () => {
  const row = (over: Partial<WindowAwardRow>): WindowAwardRow => ({
    id: 'a1',
    source: 'ted',
    source_ref: '100-2025',
    buyer_id: 'b1',
    buyer_name: 'Uppsala kommun',
    title: 'Skadedjursbekämpning',
    winner_name: 'Anticimex',
    calc_end_date: '2028-04-15',
    corrected_end_date: null,
    status: 'open',
    followup_status: null,
    window_notified_at: null,
    ...over,
  })

  it('en notis när fönstret öppnat, per upphandling', () => {
    const r = windowEntriesToNotify([row({}), row({ id: 'a2', winner_name: 'Nomor' })], '2026-10-16')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ awardIds: ['a1', 'a2'], windowStart: '2026-10-15', winners: ['Anticimex', 'Nomor'] })
  })

  it('ingen notis före fönstret eller efter det', () => {
    expect(windowEntriesToNotify([row({})], '2026-10-14')).toHaveLength(0)
    expect(windowEntriesToNotify([row({})], '2027-04-16')).toHaveLength(0)
  })

  it('bara en gång: en notifierad rad i gruppen räcker', () => {
    expect(windowEntriesToNotify([row({ window_notified_at: '2026-10-15T04:00:00Z' })], '2026-10-16')).toHaveLength(0)
    expect(windowEntriesToNotify([row({}), row({ id: 'a2', window_notified_at: '2026-10-15T04:00:00Z' })], '2026-10-16')).toHaveLength(0)
  })

  it('hoppar över ignorerade, felträffar och köpare som annonserat på nytt', () => {
    expect(windowEntriesToNotify([row({ status: 'ignored' })], '2026-10-16')).toHaveLength(0)
    expect(windowEntriesToNotify([row({ excluded_reason: 'lokalvård' })], '2026-10-16')).toHaveLength(0)
    expect(windowEntriesToNotify([row({ followup_status: 'new_notice' })], '2026-10-16')).toHaveLength(0)
  })

  it('rättat slutdatum styr fönstret och samma köpare i två källor ger en notis', () => {
    expect(windowEntriesToNotify([row({ corrected_end_date: '2029-01-01' })], '2026-10-16')).toHaveLength(0)
    const two = windowEntriesToNotify([row({}), row({ id: 'u1', source: 'uhm', source_ref: 'x' })], '2026-10-16')
    expect(two).toHaveLength(1)
  })

  it('fönstret räknas mot basavtalets slut och sista möjliga slut följer med', () => {
    // Basavtal 2028-04-15, optioner till 2030-04-15: fönstret öppnade 2026-10-15
    const r = windowEntriesToNotify([row({ base_end_date: '2028-04-15', calc_end_date: '2030-04-15' })], '2026-10-16')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ endDate: '2028-04-15', maxEnd: '2030-04-15', windowStart: '2026-10-15', windowEnd: '2027-04-15' })
    // Utan basavtal räknas fönstret mot sista slutet: inte i fönstret än
    expect(windowEntriesToNotify([row({ calc_end_date: '2030-04-15' })], '2026-10-16')).toHaveLength(0)
    // Rättat slut vinner över basavtalet
    expect(windowEntriesToNotify([row({ base_end_date: '2028-04-15', calc_end_date: '2030-04-15', corrected_end_date: '2030-04-15' })], '2026-10-16')).toHaveLength(0)
  })
})

describe('contactFromTed', () => {
  it('kontaktpunkt, e-post och telefon för huvudköparen', () => {
    expect(
      contactFromTed({ 'buyer-contact-point': ['Mona Lindberg'], 'buyer-email': ['Mona.Lindberg@migrationsverket.se'], 'organisation-tel-buyer': ['077-1235235'] })
    ).toEqual({ name: 'Mona Lindberg', email: 'mona.lindberg@migrationsverket.se', phone: '077-1235235' })
    expect(contactFromTed({ 'organisation-tel-buyer': ['0240-86000'] })).toBeNull()
  })
})
