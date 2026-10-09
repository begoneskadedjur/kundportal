import { describe, expect, it } from 'vitest'
import { contractLengthYears, formatContractLength, splitContractLength } from './contractLength'

describe('formatContractLength', () => {
  it('skriver ut enheten så att avtalet blir läsbart', () => {
    expect(formatContractLength('2', 'år')).toBe('2 år')
    expect(formatContractLength('1', 'månader')).toBe('1 månad')
    expect(formatContractLength('6', 'månader')).toBe('6 månader')
    expect(formatContractLength('', 'år')).toBe('')
  })
})

describe('splitContractLength', () => {
  it('läser tillbaka det wizarden skickar', () => {
    expect(splitContractLength('2 år')).toEqual({ value: '2', unit: 'år' })
    expect(splitContractLength('6 månader')).toEqual({ value: '6', unit: 'månader' })
    expect(splitContractLength('1 månad')).toEqual({ value: '1', unit: 'månader' })
  })
  it('bara en siffra är år, hela år i månader visas som år', () => {
    expect(splitContractLength('3')).toEqual({ value: '3', unit: 'år' })
    expect(splitContractLength('36 månader')).toEqual({ value: '3', unit: 'år' })
  })
  it('tomt eller oläsligt ger förvalet', () => {
    expect(splitContractLength(null)).toEqual({ value: '1', unit: 'år' })
    expect(splitContractLength('Tillsvidare')).toEqual({ value: '1', unit: 'år' })
  })
})

describe('contractLengthYears', () => {
  it('räknar månader som del av år', () => {
    expect(contractLengthYears('6 månader')).toBe(0.5)
    expect(contractLengthYears('2 år')).toBe(2)
    expect(contractLengthYears('3')).toBe(3)
    expect(contractLengthYears('Rullande')).toBeNull()
  })
})
