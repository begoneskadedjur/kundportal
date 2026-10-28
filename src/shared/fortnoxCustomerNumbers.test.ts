import { describe, it, expect } from 'vitest'
import {
  buildFortnoxCustomerCard,
  contractFortnoxReadiness,
  decideCandidate,
  formatOrgNrForFortnox,
  fortnoxErrorCode,
  groupForCustomerNumber,
  isFortnoxDuplicateCustomerError,
  isPersonnummer,
  luhnValid,
  nextFreeNumber,
  orgDigits,
  parseFortnoxCustomerNumber,
  parseSwedishAddress,
  planCustomerAutoLinks,
  toVatInclusivePrice,
  type AutoLinkMirrorRow,
  type AutoLinkPortalRow,
  type FortnoxMirrorHit,
} from './fortnoxCustomerNumbers'

describe('parseFortnoxCustomerNumber', () => {
  it('tar rent numeriska nummer', () => {
    expect(parseFortnoxCustomerNumber('10465')).toBe(10465)
    expect(parseFortnoxCustomerNumber(3567)).toBe(3567)
  })
  it('ignorerar alfanumeriska och inledande nollor', () => {
    expect(parseFortnoxCustomerNumber('A123')).toBeNull()
    expect(parseFortnoxCustomerNumber('0042')).toBeNull()
    expect(parseFortnoxCustomerNumber('')).toBeNull()
    expect(parseFortnoxCustomerNumber(null)).toBeNull()
  })
})

describe('orgDigits', () => {
  it('normaliserar bindestreck och 12-siffriga personnummer', () => {
    expect(orgDigits('556481-2138')).toBe('5564812138')
    expect(orgDigits('19560524-8540')).toBe('5605248540')
    expect(orgDigits('195605248540')).toBe('5605248540')
    expect(orgDigits(' ')).toBeNull()
  })
})

describe('formatOrgNrForFortnox / luhnValid', () => {
  it('formaterar till XXXXXX-XXXX', () => {
    expect(formatOrgNrForFortnox('5564812138')).toBe('556481-2138')
    expect(formatOrgNrForFortnox('195605248540')).toBe('560524-8540')
    expect(formatOrgNrForFortnox('123')).toBeNull()
  })
  it('luhn godkänner giltiga och avvisar felaktiga', () => {
    expect(luhnValid('5560161234')).toBe(false)
    expect(luhnValid('5565946661')).toBe(true) // Skatteverkets exempel-org.nr
    expect(luhnValid('8112189876')).toBe(true) // Skatteverkets exempel-personnummer
  })
})

describe('isPersonnummer', () => {
  it('skiljer person- från org.nr', () => {
    expect(isPersonnummer('560524-8540')).toBe(true)
    expect(isPersonnummer('556481-2138')).toBe(false)
    expect(isPersonnummer(null)).toBe(false)
  })
})

describe('nextFreeNumber', () => {
  it('ger seriens första nummer när inget är upptaget', () => {
    expect(nextFreeNumber({ seriesStart: 3500, seriesEnd: 3999, taken: [] })).toBe(3500)
  })
  it('fyller aldrig luckor nedåt', () => {
    expect(nextFreeNumber({ seriesStart: 3500, seriesEnd: 3999, taken: [3500, 3502, 3510] })).toBe(3511)
  })
  it('ignorerar nummer utanför intervallet och null', () => {
    expect(nextFreeNumber({ seriesStart: 3500, seriesEnd: 3999, taken: [10465, null, 3501, 12] })).toBe(3502)
  })
  it('respekterar golv (portalens räknare)', () => {
    expect(nextFreeNumber({ seriesStart: 3500, seriesEnd: 3999, taken: [3505], floor: 3569 })).toBe(3570)
    expect(nextFreeNumber({ seriesStart: 3500, seriesEnd: 3999, taken: [3580], floor: 3569 })).toBe(3581)
  })
  it('returnerar null när serien är full', () => {
    expect(nextFreeNumber({ seriesStart: 1, seriesEnd: 3, taken: [3] })).toBeNull()
  })
})

describe('Fortnox-fel', () => {
  it('känner igen dubblettkod 2000637 oavsett skiftläge', () => {
    expect(isFortnoxDuplicateCustomerError({ ErrorInformation: { code: 2000637, message: 'x' } })).toBe(true)
    expect(isFortnoxDuplicateCustomerError({ ErrorInformation: { Code: '2000637', Message: 'x' } })).toBe(true)
    expect(fortnoxErrorCode({ ErrorInformation: { code: '2001392' } })).toBe(2001392)
  })
  it('känner igen dubblett på meddelandet', () => {
    expect(isFortnoxDuplicateCustomerError({ ErrorInformation: { message: 'Kundnummer 3570 används redan.' } })).toBe(true)
    expect(isFortnoxDuplicateCustomerError({ ErrorInformation: { message: 'Ingen eller felaktig typ av data' } })).toBe(false)
    expect(isFortnoxDuplicateCustomerError(null)).toBe(false)
  })
})

describe('decideCandidate', () => {
  const hit = (n: string, active = true, missing: string | null = null): FortnoxMirrorHit => ({
    customer_number: n,
    numeric_value: parseFortnoxCustomerNumber(n),
    name: `Kund ${n}`,
    organisation_number: '556481-2138',
    active,
    missing_since: missing,
  })
  it('none utan träffar och när alla är raderade', () => {
    expect(decideCandidate([]).kind).toBe('none')
    expect(decideCandidate([hit('39', true, '2026-09-01')]).kind).toBe('none')
  })
  it('single vid exakt en aktiv', () => {
    const d = decideCandidate([hit('113'), hit('39', false)])
    expect(d.kind).toBe('single')
    if (d.kind === 'single') expect(d.hit.customer_number).toBe('113')
  })
  it('multiple vid flera aktiva, sorterat med intervallet först', () => {
    const d = decideCandidate([hit('1511'), hit('2003')], { start: 2000, end: 2499 })
    expect(d.kind).toBe('multiple')
    if (d.kind === 'multiple') expect(d.candidates.map(c => c.customer_number)).toEqual(['2003', '1511'])
  })
  it('inactive-only när bara inaktiva finns', () => {
    expect(decideCandidate([hit('3561', false), hit('3562', false)]).kind).toBe('inactive-only')
  })
  it('klarar range null (kund utan kundgrupp)', () => {
    const d = decideCandidate([hit('1507')], null)
    expect(d.kind).toBe('single')
    const m = decideCandidate([hit('2003'), hit('1511')], null)
    if (m.kind === 'multiple') expect(m.candidates.map(c => c.customer_number)).toEqual(['1511', '2003'])
    else throw new Error('väntade multiple')
  })
})

const GROUPS = [
  { id: 'brf', series_start: 1, series_end: 499, is_active: true },
  { id: 'kommersiell', series_start: 1500, series_end: 1999, is_active: true },
  { id: 'gammal', series_start: 3000, series_end: 3499, is_active: false },
  { id: 'privat', series_start: 10001, series_end: 99999, is_active: true },
]

describe('groupForCustomerNumber', () => {
  it('hittar gruppen vars serie innehåller numret', () => {
    expect(groupForCustomerNumber(GROUPS, 1507)?.id).toBe('kommersiell')
    expect(groupForCustomerNumber(GROUPS, 1)?.id).toBe('brf')
    expect(groupForCustomerNumber(GROUPS, 499)?.id).toBe('brf')
  })
  it('null utanför alla serier, i inaktiv grupp eller utan nummer', () => {
    expect(groupForCustomerNumber(GROUPS, 700)).toBeNull()
    expect(groupForCustomerNumber(GROUPS, 3100)).toBeNull()
    expect(groupForCustomerNumber(GROUPS, null)).toBeNull()
  })
  it('null när serierna överlappar', () => {
    const overlap = [...GROUPS, { id: 'dubbel', series_start: 1500, series_end: 1600 }]
    expect(groupForCustomerNumber(overlap, 1507)).toBeNull()
    expect(groupForCustomerNumber(overlap, 1700)?.id).toBe('kommersiell')
  })
})

describe('planCustomerAutoLinks', () => {
  // 556481-2138 och 556036-0793 är org.nr; 19800101-1234 är ett personnummer
  const cust = (id: string, org: string | null, extra: Partial<AutoLinkPortalRow> = {}): AutoLinkPortalRow => ({
    id,
    customer_number: null,
    organization_number: org,
    customer_group_id: null,
    parent_customer_id: null,
    is_active: true,
    ...extra,
  })
  const card = (nr: string, digits: string, active = true, missing: string | null = null): AutoLinkMirrorRow => ({
    customer_number: nr,
    org_digits: digits,
    active,
    missing_since: missing,
  })
  const ANLOS = '5564812138'

  it('kopplar exakt ett aktivt kort och sätter gruppen ur serien', () => {
    const plan = planCustomerAutoLinks({
      customers: [cust('a', '556481-2138')],
      mirror: [card('1507', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([{ customerId: 'a', customerNumber: 1507, groupId: 'kommersiell' }])
  })
  it('behåller befintlig kundgrupp', () => {
    const plan = planCustomerAutoLinks({
      customers: [cust('a', '556481-2138', { customer_group_id: 'brf' })],
      mirror: [card('1507', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([{ customerId: 'a', customerNumber: 1507, groupId: null }])
  })
  it('inaktivt eller raderat kort räknas inte, ett aktivt bredvid ett inaktivt kopplas', () => {
    expect(planCustomerAutoLinks({
      customers: [cust('a', '556481-2138')],
      mirror: [card('1507', ANLOS, false), card('1508', ANLOS, true, '2026-10-01')],
      groups: GROUPS,
    }).links).toEqual([])
    expect(planCustomerAutoLinks({
      customers: [cust('a', '556481-2138')],
      mirror: [card('1507', ANLOS, false), card('1508', ANLOS)],
      groups: GROUPS,
    }).links.map(l => l.customerNumber)).toEqual([1508])
  })
  it('flera aktiva kort kopplas inte', () => {
    const plan = planCustomerAutoLinks({
      customers: [cust('a', '556481-2138')],
      mirror: [card('1507', ANLOS), card('2003', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([])
    expect(plan.skipped[0].reason).toBe('flera-aktiva-kort')
  })
  it('nummer som redan finns på en annan portalrad kopplas inte', () => {
    const plan = planCustomerAutoLinks({
      customers: [cust('a', '556481-2138'), cust('b', '556036-0793', { customer_number: 1507 })],
      mirror: [card('1507', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([])
    expect(plan.skipped[0].reason).toBe('nummer-upptaget')
  })
  it('samma org.nr redan numrerat på en annan rad kopplas inte', () => {
    const plan = planCustomerAutoLinks({
      customers: [cust('a', '556481-2138'), cust('b', '5564812138', { customer_number: 1600 })],
      mirror: [card('1507', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([])
    expect(plan.skipped[0].reason).toBe('org-nr-har-redan-nummer')
  })
  it('två onumrerade rader med samma org.nr kopplas inte', () => {
    const plan = planCustomerAutoLinks({
      customers: [cust('a', '556481-2138'), cust('b', '5564812138')],
      mirror: [card('1507', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([])
    expect(plan.skipped.map(s => s.reason)).toEqual(['flera-portalrader', 'flera-portalrader'])
  })
  it('privatperson, saknat eller ofullständigt org.nr, inaktiv kund och kund med nummer rörs inte', () => {
    const plan = planCustomerAutoLinks({
      customers: [
        cust('privat', '19800101-1234'),
        cust('utan', null),
        cust('kort', '55648'),
        cust('inaktiv', '556481-2138', { is_active: false }),
        cust('har', '556036-0793', { customer_number: 42 }),
      ],
      mirror: [card('10500', '8001011234'), card('1507', ANLOS), card('42', '5560360793')],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([])
    expect(plan.skipped).toEqual([])
  })
  it('enhet utan eget org.nr eller med huvudkontorets ärver, enhet med eget org.nr kopplas', () => {
    const plan = planCustomerAutoLinks({
      customers: [
        cust('hk', '556036-0793', { customer_number: 5004 }),
        cust('arver', null, { parent_customer_id: 'hk' }),
        cust('samma', '5560360793', { parent_customer_id: 'hk' }),
        cust('eget', '556481-2138', { parent_customer_id: 'hk' }),
      ],
      mirror: [card('5004', '5560360793'), card('1507', ANLOS)],
      groups: GROUPS,
    })
    expect(plan.links).toEqual([{ customerId: 'eget', customerNumber: 1507, groupId: 'kommersiell' }])
  })
})

describe('contractFortnoxReadiness', () => {
  const h = (nr: string, active = true, missing: string | null = null) => ({ customer_number: nr, active, missing_since: missing })
  it('org.nr saknas går först', () => {
    expect(contractFortnoxReadiness({ organizationNumber: null, hasGroup: true, hits: [] }).kind).toBe('no-org')
  })
  it('ett aktivt kort kopplas oavsett grupp', () => {
    expect(contractFortnoxReadiness({ organizationNumber: '556481-2138', hasGroup: false, hits: [h('1507'), h('9', false)] }))
      .toEqual({ kind: 'mirror-single', customerNumber: '1507' })
  })
  it('flera aktiva, bara inaktiva', () => {
    expect(contractFortnoxReadiness({ organizationNumber: '556481-2138', hasGroup: true, hits: [h('1'), h('2')] }).kind).toBe('mirror-multiple')
    expect(contractFortnoxReadiness({ organizationNumber: '556481-2138', hasGroup: true, hits: [h('1', false)] }).kind).toBe('mirror-inactive')
  })
  it('inget kort: nytt nummer med grupp, annars kundgrupp saknas; raderade räknas inte', () => {
    expect(contractFortnoxReadiness({ organizationNumber: '556481-2138', hasGroup: true, hits: [h('1', true, '2026-01-01')] }).kind).toBe('new')
    expect(contractFortnoxReadiness({ organizationNumber: '556481-2138', hasGroup: false, hits: [] }).kind).toBe('no-group')
    expect(contractFortnoxReadiness({ organizationNumber: '19800101-1234', hasGroup: false, hits: [] }).kind).toBe('new')
  })
})

describe('toVatInclusivePrice', () => {
  it('räknar upp exkl-pris till inkl-pris med öresavrundning', () => {
    expect(toVatInclusivePrice(1000, 25)).toBe(1250)
    expect(toVatInclusivePrice(2396, 25)).toBe(2995)
    expect(toVatInclusivePrice(3997.6, 25)).toBe(4997)
    expect(toVatInclusivePrice(333.33, 12)).toBe(373.33)
    expect(toVatInclusivePrice(100, 0)).toBe(100)
    expect(toVatInclusivePrice(100, null)).toBe(100)
  })
})

describe('parseSwedishAddress / buildFortnoxCustomerCard', () => {
  it('delar upp adressen', () => {
    expect(parseSwedishAddress('Bergsängs backar 101, 793 90 Leksand, Sverige')).toEqual({
      address1: 'Bergsängs backar 101', zipCode: '793 90', city: 'Leksand',
    })
  })
  it('utelämnar org.nr som inte validerar och sätter privat-villkor', () => {
    const r = buildFortnoxCustomerCard({
      name: 'Test Testsson',
      organization_number: '811218-9876',
      billing_address: 'Gatan 1, 123 45 Ort',
      customer_type: 'PRIVATE',
      terms_of_payment: '10',
      show_price_vat_included: true,
    })
    expect(r.card.OrganisationNumber).toBe('811218-9876')
    expect(r.card.TermsOfPayment).toBe('10')
    expect(r.card.City).toBe('Ort')
    expect(r.orgNrSkipped).toBe(false)

    const bad = buildFortnoxCustomerCard({ name: 'Bolag AB', organization_number: '556016-1234' })
    expect(bad.card.OrganisationNumber).toBeUndefined()
    expect(bad.orgNrSkipped).toBe(true)
    expect(bad.type).toBe('COMPANY')
  })
})
