import { describe, expect, it } from 'vitest'
import { addonPaidThroughLabel } from './addonStations'

describe('addonPaidThroughLabel', () => {
  it('efterskänkt täckning heter efterskänkt, inte betald', () => {
    expect(addonPaidThroughLabel({ source: 'waived' })).toBe('Efterskänkt till och med')
  })

  it('alla andra källor och dagens svar heter betald', () => {
    for (const source of ['invoice', 'prorata', 'gap_invoice', 'fortnox_manual', 'backfill', null, undefined] as const) {
      expect(addonPaidThroughLabel({ source })).toBe('Betald till och med')
    }
    expect(addonPaidThroughLabel(null)).toBe('Betald till och med')
  })
})
