import { describe, it, expect } from 'vitest'
import { buildCustomerMirrorPatch, type MirrorContractFields } from './customerMirrorPatch'

const base: MirrorContractFields = {
  billing_frequency: 'annual',
  billing_anchor_month: 6,
  contract_start_date: '2026-06-30',
  contract_end_date: '2028-06-29',
  notice_period_months: 3,
  display_order: 1,
  price_list_id: 'pl-1',
}

describe('buildCustomerMirrorPatch', () => {
  it('speglar delade värden', () => {
    expect(buildCustomerMirrorPatch([base])).toEqual({
      billing_frequency: 'annual',
      billing_anchor_month: 6,
      contract_start_date: '2026-06-30',
      contract_end_date: '2028-06-29',
      notice_period_months: 3,
      price_list_id: 'pl-1',
    })
  })

  it('skriver aldrig NULL när avtalet saknar prislista och slutdatum (löptidsändring)', () => {
    const patch = buildCustomerMirrorPatch([
      { ...base, price_list_id: null, contract_end_date: null, notice_period_months: 2 },
    ])
    expect(patch).not.toHaveProperty('price_list_id')
    expect(patch).not.toHaveProperty('contract_end_date')
    expect(patch.notice_period_months).toBe(2)
    expect(Object.values(patch)).not.toContain(null)
  })

  it('tar bara bort prislistan när den uttryckligen tas bort i avtalskartan', () => {
    const patch = buildCustomerMirrorPatch([{ ...base, price_list_id: null }], { allowClearPriceList: true })
    expect(patch.price_list_id).toBeNull()
  })

  it('lämnar fält som avtalen inte delar orörda', () => {
    const patch = buildCustomerMirrorPatch([
      base,
      { ...base, display_order: 2, contract_end_date: '2029-01-01', price_list_id: 'pl-2' },
    ])
    expect(patch).not.toHaveProperty('contract_end_date')
    expect(patch.price_list_id).toBe('pl-1')
  })

  it('första pappret saknar prislista: inget skrivs utan uttrycklig borttagning', () => {
    const live = [
      { ...base, price_list_id: null },
      { ...base, display_order: 2, price_list_id: 'pl-2' },
    ]
    expect(buildCustomerMirrorPatch(live)).not.toHaveProperty('price_list_id')
    expect(buildCustomerMirrorPatch(live, { allowClearPriceList: true }).price_list_id).toBeNull()
  })

  it('inga levande avtal ger tom patch', () => {
    expect(buildCustomerMirrorPatch([])).toEqual({})
  })
})
