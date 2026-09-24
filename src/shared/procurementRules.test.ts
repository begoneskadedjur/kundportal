import { describe, it, expect } from 'vitest'
import {
  buildDedupKey,
  computeContractEnd,
  countiesFromNuts,
  estimateWinProbability,
  normalizeName,
  normalizeOrgNumber,
  normalizeTedNumber,
  scoreNotice,
  workWindow,
} from './procurementRules'

describe('scoreNotice', () => {
  it('ger 100 på CPV 9092 och länstillägg i BeGones län', () => {
    const r = scoreNotice({ title: 'Ramavtal Skadedjur', cpv_codes: ['90922000'], county_codes: ['SE122'] })
    expect(r.hard).toBe(true)
    expect(r.score).toBe(110)
  })

  it('hittar Järfällahus på CPV 70000000 via titeln', () => {
    const r = scoreNotice({ title: 'Skadedjursbekämpning Järfällahus', cpv_codes: ['70000000'], county_codes: ['SE110'] })
    expect(r.hard).toBe(false)
    // 50 mjuk + 2 nyckelord (skadedjur, skadedjursbekämpning) + län
    expect(r.score).toBe(80)
  })

  it('ger noll utan nyckelord även på närliggande CPV', () => {
    const r = scoreNotice({ title: 'Lokalvård', cpv_codes: ['90910000'] })
    expect(r.score).toBe(0)
  })

  it('drar av för negativa ord', () => {
    const r = scoreNotice({ title: 'Rivning och sanering av anläggningar', cpv_codes: ['90650000'] })
    expect(r.score).toBeLessThan(60)
  })
})

describe('normalisering och dedup', () => {
  it('orgnr blir tio siffror', () => {
    expect(normalizeOrgNumber('559378-9208')).toBe('5593789208')
    expect(normalizeOrgNumber('165593789208')).toBe('5593789208')
    expect(normalizeOrgNumber('SE123')).toBeNull()
  })

  it('BeGones två TED-stavningar normaliseras lika', () => {
    expect(normalizeName('BeGone Skadedjur & Sanering AB')).toBe(normalizeName('BeGone Skadedjur och sanering AB'))
  })

  it('Mercells TED-nummer tappar inledande nollor', () => {
    expect(normalizeTedNumber('00657962-2026')).toBe('657962-2026')
  })

  it('samma upphandling från två källor ger samma nyckel', () => {
    const a = buildDedupKey({ buyerOrgNumber: '556450-9486', title: 'Ramavtal Skadedjur', deadline: '2026-09-09T21:59:00Z' })
    const b = buildDedupKey({ buyerOrgNumber: '5564509486', title: 'Ramavtal skadedjur.', deadline: '2026-09-09T23:59:00+02:00' })
    expect(a).toBe(b)
  })

  it('län ur NUTS', () => {
    expect(countiesFromNuts(['SE122', 'SWE', 'SE122', 'SE1'])).toEqual(['SE122'])
  })
})

describe('avtalsklockan', () => {
  it('TED slutdatum plus förlängningar', () => {
    expect(computeContractEnd({ tedEnd: '2028-10-31Z', renewalMax: 2 })).toEqual({ date: '2030-10-31', source: 'ted_end_plus_renewals' })
  })
  it('Mercell som andra källa', () => {
    expect(computeContractEnd({ mercellExpiry: '2027-12-30T23:00:00Z' }).date).toBe('2027-12-31')
  })
  it('två plus två år som reserv', () => {
    expect(computeContractEnd({ startOrAwardDate: '2024-03-01' })).toEqual({ date: '2028-03-01', source: 'assumption_2_2' })
  })
  it('fönster 18 till 12 månader före', () => {
    expect(workWindow('2028-03-01')).toEqual({ start: '2026-09-01', end: '2027-03-01' })
  })
})

describe('sannolikhet', () => {
  it('tre anbud med oss ger en tredjedel', () => {
    expect(estimateWinProbability({}).probability).toBeCloseTo(1 / 3)
  })
})
