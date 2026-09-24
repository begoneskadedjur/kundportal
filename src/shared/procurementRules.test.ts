import { describe, expect, it } from 'vitest'
import { awardRelevance, canonicalOrgNumber, computeContractEnd, parseDurationText } from './procurementRules'

describe('computeContractEnd', () => {
  it('TED slutdatum plus förlängningar går först', () => {
    const r = computeContractEnd({ tedEnd: '2026-06-30Z', renewalMax: 2, awardDate: '2024-05-01' })
    expect(r).toMatchObject({ date: '2028-06-30', source: 'ted_end_plus_renewals' })
  })

  it('räknar från avtalsstart plus avtalstid när slutdatum saknas', () => {
    const r = computeContractEnd({ contractSignedDate: '2024-03-15', durationMonths: 24, renewalMax: 2, durationFrom: 'ted' })
    expect(r).toMatchObject({ date: '2028-03-15', source: 'contract_duration', startBasis: '2024-03-15' })
  })

  it('antagandet räknas från tilldelning plus en månad, inte från tilldelningsdatumet', () => {
    const r = computeContractEnd({ awardDate: '2024-01-10' })
    expect(r).toMatchObject({ date: '2028-02-10', source: 'assumption_2_2', startBasis: '2024-02-10' })
  })

  it('UHM: annonsen plus sex månader', () => {
    const r = computeContractEnd({ tenderPublishedDate: '2022-03-01' })
    expect(r.startBasis).toBe('2022-09-01')
    expect(r.date).toBe('2026-09-01')
  })

  it('känt antal förlängningar ersätter antagandets två år', () => {
    const r = computeContractEnd({ contractStart: '2024-01-01', renewalMax: 0 })
    expect(r.date).toBe('2026-01-01')
  })
})

describe('parseDurationText', () => {
  it('2+1+1 år', () => {
    expect(parseDurationText('Avtalet gäller 2+1+1 år från tecknandet.')).toEqual({ months: 24, renewalMonths: 24 })
  })
  it('avtalstid med förlängning', () => {
    expect(parseDurationText('Avtalstiden är två (2) år med möjlighet till förlängning två gånger om ett år.')).toEqual({ months: 24, renewalMonths: 24 })
  })
  it('månader och förlängning upp till', () => {
    expect(parseDurationText('Avtalstid 36 månader. Avtalet kan förlängas med upp till 12 månader.')).toEqual({ months: 36, renewalMonths: 12 })
  })
  it('ingen avtalstid ger null', () => {
    expect(parseDurationText('Skadedjursbekämpning i kommunens fastigheter.')).toBeNull()
  })
})

describe('awardRelevance', () => {
  it('vassklippning med 90922000 bland CPV är en felträff', () => {
    const r = awardRelevance(['77211400', '77211300', '90922000'], 'Vassklippning och tjänster inom allmänna grönområden')
    expect(r.relevant).toBe(false)
  })
  it('lokalvård är en felträff', () => {
    expect(awardRelevance(['90910000'], 'Lokalvård Serviceförvaltningen').relevant).toBe(false)
  })
  it('skadedjursord i titeln räcker', () => {
    expect(awardRelevance(['90920000'], 'Skadedjursbekämpning').relevant).toBe(true)
  })
  it('huvud-CPV 90922000 med neutral titel räcker', () => {
    expect(awardRelevance(['90922000', '90920000'], 'Generell del').relevant).toBe(true)
  })
  it('bred sanering utan skadedjursord är en felträff', () => {
    expect(awardRelevance(['90920000'], 'Biologisk rening').relevant).toBe(false)
  })
})

describe('canonicalOrgNumber', () => {
  it('Nomors felskrivna orgnr slås ihop', () => {
    expect(canonicalOrgNumber('556529-3976')).toBe('5565263976')
    expect(canonicalOrgNumber('5560329285')).toBe('5560329285')
  })
})
