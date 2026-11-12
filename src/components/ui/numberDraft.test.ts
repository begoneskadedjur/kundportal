import { describe, expect, it } from 'vitest'
import { formatNumberDraft, parseNumberDraft } from './numberDraft'

describe('parseNumberDraft', () => {
  it('tomt eller ogiltigt ger null (föregående värde behålls)', () => {
    expect(parseNumberDraft('')).toBeNull()
    expect(parseNumberDraft('   ')).toBeNull()
    expect(parseNumberDraft('abc')).toBeNull()
    expect(parseNumberDraft('1,2,3')).toBeNull()
    expect(parseNumberDraft('-')).toBeNull()
  })

  it('komma och punkt som decimaltecken, mellanslag ignoreras', () => {
    expect(parseNumberDraft('1,5')).toBe(1.5)
    expect(parseNumberDraft('1.5')).toBe(1.5)
    expect(parseNumberDraft('12 500')).toBe(12500)
    expect(parseNumberDraft('12 500,25')).toBe(12500.25)
  })

  it('heltal avrundas, decimaler till valt antal', () => {
    expect(parseNumberDraft('2,6', { integer: true })).toBe(3)
    expect(parseNumberDraft('1,23456')).toBe(1.23)
    expect(parseNumberDraft('1,23456', { decimals: 3 })).toBe(1.235)
  })

  it('under min blir min, över max blir max', () => {
    expect(parseNumberDraft('0', { min: 1 })).toBe(1)
    expect(parseNumberDraft('-5', { min: 0 })).toBe(0)
    expect(parseNumberDraft('500', { max: 300 })).toBe(300)
  })
})

describe('formatNumberDraft', () => {
  it('decimalkomma utan tusentalsavgränsare', () => {
    expect(formatNumberDraft(1234.5)).toBe('1234,5')
    expect(formatNumberDraft(2)).toBe('2')
    expect(formatNumberDraft(1.23456, 3)).toBe('1,235')
    expect(formatNumberDraft(NaN)).toBe('')
  })
})
