import { describe, it, expect } from 'vitest'
import { invoiceContractIds, unconfirmedPremiumContractIds, isInvoiceBlockedByPremiumReview } from './premiumReview'

describe('invoiceContractIds', () => {
  it('samlar fakturans och radernas avtal utan dubbletter', () => {
    expect(invoiceContractIds({ contract_id: 'a' }, [{ contract_id: 'a' }, { contract_id: 'b' }, { contract_id: null }, {}])).toEqual(['a', 'b'])
  })
  it('klarar saknade värden', () => {
    expect(invoiceContractIds(null, null)).toEqual([])
    expect(invoiceContractIds({ contract_id: null }, [])).toEqual([])
  })
})

describe('unconfirmedPremiumContractIds', () => {
  it('returnerar bara flaggade avtal bland de berörda', () => {
    const contracts = [
      { id: 'a', premium_needs_review: true },
      { id: 'b', premium_needs_review: false },
      { id: 'c', premium_needs_review: true },
    ]
    expect(unconfirmedPremiumContractIds(['a', 'b'], contracts)).toEqual(['a'])
  })
})

describe('isInvoiceBlockedByPremiumReview', () => {
  const contracts = [
    { id: 'a', premium_needs_review: true },
    { id: 'b', premium_needs_review: false },
    { id: 'c' },
  ]
  it('spärrar avtalsfaktura med obekräftad premie', () => {
    expect(isInvoiceBlockedByPremiumReview('contract', ['a'], contracts)).toBe(true)
  })
  it('spärrar samlad faktura om ett av avtalen är obekräftat', () => {
    expect(isInvoiceBlockedByPremiumReview('contract', ['b', 'a'], contracts)).toBe(true)
  })
  it('släpper när alla avtal är bekräftade eller saknar flagga', () => {
    expect(isInvoiceBlockedByPremiumReview('contract', ['b', 'c'], contracts)).toBe(false)
    expect(isInvoiceBlockedByPremiumReview('contract', [], contracts)).toBe(false)
  })
  it('rör inte andra fakturatyper', () => {
    expect(isInvoiceBlockedByPremiumReview('case', ['a'], contracts)).toBe(false)
    expect(isInvoiceBlockedByPremiumReview(null, ['a'], contracts)).toBe(false)
  })
})
