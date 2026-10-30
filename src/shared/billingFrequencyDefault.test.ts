import { describe, expect, it } from 'vitest'
import { isAvropContractType, materializedBillingFrequency } from './billingFrequencyDefault'

describe('materializedBillingFrequency (steg 13)', () => {
  it('avropsavtal får inget intervall, oavsett kundradens värde', () => {
    expect(materializedBillingFrequency({ customerFrequency: 'monthly', annualValue: 0, contractType: 'Avropsavtal' })).toEqual({ value: null, needsCheck: false })
    expect(materializedBillingFrequency({ customerFrequency: 'annual', annualValue: 12000, contractType: 'Avropsavtal Xpert' })).toEqual({ value: null, needsCheck: false })
  })

  it('premie och kundradens intervall: ärvs och ber om kontroll', () => {
    expect(materializedBillingFrequency({ customerFrequency: 'monthly', annualValue: 12000, contractType: 'Skadedjursavtal' })).toEqual({ value: 'monthly', needsCheck: true })
    expect(materializedBillingFrequency({ customerFrequency: 'quarterly', annualValue: 12000, contractType: null })).toEqual({ value: 'quarterly', needsCheck: true })
  })

  it('premie utan intervall eller med vid behov: årsvis och kontroll', () => {
    expect(materializedBillingFrequency({ customerFrequency: null, annualValue: 12000, contractType: 'Skadedjursavtal' })).toEqual({ value: 'annual', needsCheck: true })
    expect(materializedBillingFrequency({ customerFrequency: 'on_demand', annualValue: 12000, contractType: null })).toEqual({ value: 'annual', needsCheck: true })
  })

  it('utan premie: årsvis, aldrig kundradens tysta månadsvis (Falu)', () => {
    expect(materializedBillingFrequency({ customerFrequency: 'monthly', annualValue: 0, contractType: 'Skadedjursavtal' })).toEqual({ value: 'annual', needsCheck: false })
    expect(materializedBillingFrequency({ customerFrequency: null, annualValue: null, contractType: null })).toEqual({ value: 'annual', needsCheck: false })
  })

  it('känner igen avropstyper', () => {
    expect(isAvropContractType('Avropsavtal')).toBe(true)
    expect(isAvropContractType(' avropsavtal ')).toBe(true)
    expect(isAvropContractType('Skadedjursavtal')).toBe(false)
    expect(isAvropContractType(null)).toBe(false)
  })
})
