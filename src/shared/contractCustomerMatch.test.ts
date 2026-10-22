import { describe, it, expect } from 'vitest'
import { findContractCustomerMatch, isContractCustomer, streetKey, type MatchableCustomer } from './contractCustomerMatch'

const HK: MatchableCustomer = { id: 'hk', company_name: 'WBAB WessmanBarken Vatten & Återvinning AB', organization_number: '559031-4380', contact_address: 'Frejgatan 5, 777 30 Smedjebacken', is_multisite: true, billing_active: true, annual_value: 100000 }
const ENHET: MatchableCustomer = { id: 'enhet', company_name: 'WBAB - Björnhyttans Avfallsanläggning', contact_address: 'Saxdalsvägen 60, 771 94 Ludvika', parent_customer_id: 'hk', is_multisite: true, billing_active: false }
// Lös rad som faktureringen skapade för ett engångsjobb: ingen avtalskund
const LOS: MatchableCustomer = { id: 'los', company_name: 'WBAB', contact_address: 'Saxdalsvägen 60, 771 65 Ludvika, Sverige', billing_active: false, contract_status: 'signed', source_type: 'manual' }
const ALLA = [LOS, HK, ENHET]

describe('isContractCustomer', () => {
  it('skiljer avtalskunder från engångskundernas rader', () => {
    expect(isContractCustomer(HK)).toBe(true)
    expect(isContractCustomer(ENHET)).toBe(true)
    expect(isContractCustomer(LOS)).toBe(false)
    expect(isContractCustomer({ ...HK, is_active: false })).toBe(false)
    expect(isContractCustomer({ ...HK, contract_status: 'terminated' })).toBe(false)
  })
})

describe('streetKey', () => {
  it('kräver gata med nummer', () => {
    expect(streetKey('Saxdalsvägen 60, 771 65 Ludvika, Sverige')).toBe('saxdalsvägen 60')
    expect(streetKey('Ludvika')).toBeNull()
    expect(streetKey('')).toBeNull()
  })
})

describe('findContractCustomerMatch', () => {
  it('hittar enheten på adressen trots annat postnummer', () => {
    expect(findContractCustomerMatch({ address: 'Saxdalsvägen 60, 771 65 Ludvika, Sverige', name: 'WBAB' }, ALLA))
      .toEqual({ customer: ENHET, reason: 'adress' })
  })

  it('org.nr går före adress', () => {
    expect(findContractCustomerMatch({ orgnr: '5590314380', address: 'Saxdalsvägen 60, Ludvika' }, ALLA)?.customer.id).toBe('hk')
  })

  it('namnets första ord ger huvudkontoret', () => {
    expect(findContractCustomerMatch({ name: 'WBAB', address: 'Okänd väg 1, Ludvika' }, ALLA)).toEqual({ customer: HK, reason: 'namn' })
  })

  it('ingen träff på korta namn eller kunder utan avtal', () => {
    expect(findContractCustomerMatch({ name: 'AB' }, ALLA)).toBeNull()
    expect(findContractCustomerMatch({ name: 'Familjen Exempel', address: 'Exempelvägen 4, Södertälje' }, ALLA)).toBeNull()
  })
})
