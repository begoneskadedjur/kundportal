import { describe, it, expect } from 'vitest'
import { swedishMonthKey, pickDefaultMonthKey } from './egenkontrollMonth'

describe('swedishMonthKey', () => {
  it('räknar månaden i svensk tid, inte UTC', () => {
    // 2026-10-31 23:30 UTC = 2026-11-01 00:30 svensk vintertid
    expect(swedishMonthKey('2026-10-31T23:30:00+00:00')).toBe('2026-11')
    expect(swedishMonthKey('2026-11-15T10:00:00+01:00')).toBe('2026-11')
  })
})

describe('pickDefaultMonthKey', () => {
  const now = new Date('2026-11-11T09:00:00+01:00')

  it('ger innevarande månad när det saknas data', () => {
    expect(pickDefaultMonthKey([], now)).toBe('2026-11')
  })

  it('ger innevarande månad när den har data', () => {
    expect(pickDefaultMonthKey(['2026-12', '2026-11', '2026-10'], now)).toBe('2026-11')
  })

  it('ger senaste passerade månaden när innevarande saknar data', () => {
    expect(pickDefaultMonthKey(['2027-01', '2026-09', '2026-10'], now)).toBe('2026-10')
  })

  it('ger innevarande månad när bara framtida månader finns', () => {
    expect(pickDefaultMonthKey(['2027-02'], now)).toBe('2026-11')
  })

  it('räknar innevarande månad i svensk tid vid månadsskiftet', () => {
    const nyarsnatt = new Date('2026-12-31T23:30:00Z') // 2027-01-01 00:30 i Sverige
    expect(pickDefaultMonthKey([], nyarsnatt)).toBe('2027-01')
  })
})
