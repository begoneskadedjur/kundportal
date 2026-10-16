import { describe, expect, it } from 'vitest'
import { optionLengthText, optionPeriodLines, optionPeriodOf } from './optionPeriod'

describe('optionstiden bakom ikonen', () => {
  it('bara när optionerna ligger efter basavtalets slut och slutet inte är rättat', () => {
    expect(optionPeriodOf({ baseEnd: '2027-03-31', calcEnd: '2027-03-31' })).toBeNull()
    expect(optionPeriodOf({ baseEnd: null, calcEnd: '2029-03-31' })).toBeNull()
    expect(optionPeriodOf({ baseEnd: '2027-03-31', calcEnd: '2029-03-31', correctedEnd: '2028-01-01' })).toBeNull()
    expect(optionPeriodOf({ baseEnd: '2027-03-31', calcEnd: '2029-03-31' })).toMatchObject({ baseEnd: '2027-03-31', maxEnd: '2029-03-31', known: false })
  })

  it('längden som 1 + 1 år', () => {
    expect(optionLengthText({ months: 24, count: 2 })).toBe('1 + 1 år')
    expect(optionLengthText({ months: 24, count: 1 })).toBe('2 år')
    expect(optionLengthText({ months: 12, count: 2 })).toBe('6 + 6 månader')
    expect(optionLengthText({ months: 18, count: null })).toBe('18 månader')
    expect(optionLengthText({ months: null, count: 2 })).toBeNull()
  })

  it('popoverns rader: källa, antagen option och avrop', () => {
    const real = optionPeriodOf({ baseEnd: '2027-03-31', calcEnd: '2029-03-31', months: 24, count: 2, source: 'ted_eforms', text: 'Förlängning är 12 månader' })!
    expect(optionPeriodLines(real, '2026-10-16')).toEqual([
      'Option 1 + 1 år, längst till 2029-03-31.',
      'Källa: TED (BT-58)',
      'Ingen option avropad ännu.',
      '"Förlängning är 12 månader"',
    ])
    const assumed = optionPeriodOf({ baseEnd: '2026-03-31', calcEnd: '2028-03-31', months: 24, count: 2 })!
    const lines = optionPeriodLines(assumed, '2026-10-16')
    expect(lines[0]).toBe('Antagen option 1 + 1 år, längst till 2028-03-31.')
    expect(lines[2]).toContain('troligen avropad')
  })
})
