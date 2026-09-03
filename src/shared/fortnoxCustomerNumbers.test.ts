import { describe, it, expect } from 'vitest'
import {
  buildFortnoxCustomerCard,
  decideCandidate,
  formatOrgNrForFortnox,
  fortnoxErrorCode,
  isFortnoxDuplicateCustomerError,
  isPersonnummer,
  luhnValid,
  nextFreeNumber,
  orgDigits,
  parseFortnoxCustomerNumber,
  parseSwedishAddress,
  toVatInclusivePrice,
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
