import { describe, expect, it } from 'vitest'
import { addonMarkingFor, markingKey, markingKeyColumn, unitDisplayName } from './addonMarking'

describe('märkning av tilläggsfakturor (A4)', () => {
  it('enhetens kod går först', () => {
    expect(addonMarkingFor({ billing_reference: 'YX201' }, { invoice_reference: 'GNU 2026/60' }, { billing_reference: 'HK' })).toBe('YX201')
  })
  it('enhet utan kod: avtalets referens', () => {
    expect(addonMarkingFor({ billing_reference: '  ' }, { invoice_reference: 'GNU 2026/60' }, { billing_reference: 'HK' })).toBe('GNU 2026/60')
  })
  it('enhet utan kod och avtal utan referens: huvudkontorets', () => {
    expect(addonMarkingFor({ billing_reference: null }, { invoice_reference: null }, { billing_reference: '8315' })).toBe('8315')
  })
  it('ingenting: null', () => {
    expect(addonMarkingFor(null, {}, null)).toBeNull()
  })
  it('nyckeln är versaler utan blanksteg i ändarna, tom sträng utan märkning', () => {
    expect(markingKey(' yx201 ')).toBe('YX201')
    expect(markingKey(null)).toBe('')
    expect(markingKeyColumn('')).toBeNull()
    expect(markingKeyColumn('gnu 2026/60')).toBe('GNU 2026/60')
  })
  it('enhetens namn: platsnamnet före kundnamnet', () => {
    expect(unitDisplayName({ site_name: 'ÅVC', company_name: 'FEV' })).toBe('ÅVC')
    expect(unitDisplayName({ site_name: ' ', company_name: 'FEV' })).toBe('FEV')
  })
})
