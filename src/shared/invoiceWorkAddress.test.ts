import { describe, expect, it } from 'vitest'
import { invoiceWorkAddress, sameAddress, workAddressText } from './invoiceWorkAddress'

describe('workAddressText', () => {
  it('läser jsonb, sträng-JSON och ren text', () => {
    expect(workAddressText({ formatted_address: 'Gatan 1, 123 45 Ort' })).toBe('Gatan 1, 123 45 Ort')
    expect(workAddressText('"Boothsgatan 8 C, 802 80 Gävle"')).toBe('Boothsgatan 8 C, 802 80 Gävle')
    expect(workAddressText('{"formatted_address":"A 1, 111 22 B"}')).toBe('A 1, 111 22 B')
    expect(workAddressText('Storgatan 2')).toBe('Storgatan 2')
    expect(workAddressText(null)).toBeNull()
    expect(workAddressText({})).toBeNull()
    expect(workAddressText('  ')).toBeNull()
  })
})

describe('sameAddress', () => {
  it('bortser från land, mellanslag i postnummer, versaler och våning', () => {
    expect(sameAddress('Granvägen 14, 184 32 Åkersberga, Sverige', 'granvägen 14, 18432 ÅKERSBERGA')).toBe(true)
    expect(sameAddress('Boothsgatan 8 C, vån 1, 802 80 Gävle', 'Boothsgatan 8C, 802 80 Gävle')).toBe(true)
  })
  it('olika gata eller postnummer är olika', () => {
    expect(sameAddress('Boothsgatan 8 C, 802 80 Gävle', 'Carl Gustafs väg 1, 21742 MALMÖ')).toBe(false)
    expect(sameAddress('Gatan 1, 111 11 Ort', 'Gatan 1, 111 12 Ort')).toBe(false)
  })
  it('saknad adress är aldrig samma', () => {
    expect(sameAddress(null, 'Gatan 1')).toBe(false)
    expect(sameAddress('Gatan 1', '')).toBe(false)
  })
})

describe('invoiceWorkAddress', () => {
  it('skiljer sig: Fortnox-fälten med land och våning på rad 2', () => {
    const r = invoiceWorkAddress({
      workAddress: { formatted_address: 'Boothsgatan 8 C, vån 1, 802 80 Gävle, Sverige' },
      billingAddress: 'Carl Gustafs väg 1, 21742 MALMÖ',
      name: 'Heimstaden Maria 5 AB',
    })
    expect(r.status).toBe('leverans')
    expect(r.fortnox).toEqual({
      DeliveryName: 'Heimstaden Maria 5 AB',
      DeliveryAddress1: 'Boothsgatan 8 C',
      DeliveryAddress2: 'vån 1',
      DeliveryZipCode: '802 80',
      DeliveryCity: 'Gävle',
      DeliveryCountry: 'Sverige',
    })
  })
  it('samma som fakturaadressen: inget till Fortnox', () => {
    const r = invoiceWorkAddress({ workAddress: 'Granvägen 14, 184 32 Åkersberga', billingAddress: 'Granvägen 14, 184 32 Åkersberga, Sverige', name: 'A' })
    expect(r).toEqual({ status: 'samma', text: 'Granvägen 14, 184 32 Åkersberga', fortnox: null })
  })
  it('saknas: inget till Fortnox', () => {
    expect(invoiceWorkAddress({ workAddress: null, billingAddress: 'x', name: 'A' })).toEqual({ status: 'saknas', text: null, fortnox: null })
  })
  it('utan postnummer: hela texten som gata, land ändå', () => {
    const r = invoiceWorkAddress({ workAddress: 'Lagret vid hamnen', billingAddress: 'Gatan 1, 111 11 Ort', name: null })
    expect(r.fortnox).toEqual({ DeliveryAddress1: 'Lagret vid hamnen', DeliveryCountry: 'Sverige' })
  })
  it('tvättar tecken Fortnox inte godtar', () => {
    const r = invoiceWorkAddress({ workAddress: 'Gatan 1 · port B, 111 11 Ort', billingAddress: null, name: 'Bolag – AB' })
    expect(r.fortnox?.DeliveryName).toBe('Bolag - AB')
    expect(r.fortnox?.DeliveryAddress1).toBe('Gatan 1, port B')
  })
})
