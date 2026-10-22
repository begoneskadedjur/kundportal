import { describe, it, expect } from 'vitest'
import {
  buildFortnoxDeliveryUpdate,
  classifyOneflowBillingField,
  evaluateInvoiceDelivery,
  fromFortnoxDeliveryType,
  resolveDeliveryOwner,
  toFortnoxDeliveryType,
  validateDeliveryChoice,
  type DeliveryCustomer,
} from './invoiceDelivery'
import { buildFortnoxCustomerCard } from './fortnoxCustomerNumbers'

const kund = (over: Partial<DeliveryCustomer> = {}): DeliveryCustomer => ({
  id: 'k1',
  company_name: 'Nacka vatten och avfall AB',
  customer_number: null,
  organization_number: '559066-7589',
  parent_customer_id: null,
  invoice_delivery_method: null,
  billing_email: null,
  billing_address: null,
  contact_address: null,
  billing_reference: null,
  ...over,
})

describe('classifyOneflowBillingField', () => {
  it('giltig e-post blir fakturamejl', () => {
    expect(classifyOneflowBillingField(' tapeten@centsoft.se ')).toEqual({ billingEmail: 'tapeten@centsoft.se', billingText: null })
  })
  it('skanningsadress sparas oförändrad som text', () => {
    expect(classifyOneflowBillingField('Nacka vatten och avfall AB Ansvar 28310 INX 9099-002 831 90 Östersund')).toEqual({
      billingEmail: null,
      billingText: 'Nacka vatten och avfall AB Ansvar 28310 INX 9099-002 831 90 Östersund',
    })
  })
  it('e-post med text runt om är inte ett fakturamejl', () => {
    expect(classifyOneflowBillingField('faktura@x.se, ref 123').billingEmail).toBeNull()
  })
  it('tomt fält ger inget', () => {
    expect(classifyOneflowBillingField('   ')).toEqual({ billingEmail: null, billingText: null })
    expect(classifyOneflowBillingField(null)).toEqual({ billingEmail: null, billingText: null })
  })
})

describe('Fortnox-mappning', () => {
  it('går fram och tillbaka för alla tre vägar', () => {
    for (const m of ['email', 'print', 'einvoice'] as const) {
      expect(fromFortnoxDeliveryType(toFortnoxDeliveryType(m))).toBe(m)
    }
    expect(toFortnoxDeliveryType('einvoice')).toBe('ELECTRONICINVOICE')
  })
  it('okänt Fortnox-värde ger null', () => {
    expect(fromFortnoxDeliveryType('PRINTSERVICE')).toBeNull()
    expect(fromFortnoxDeliveryType(undefined)).toBeNull()
  })
})

describe('resolveDeliveryOwner', () => {
  const hk = kund({ id: 'hk', customer_number: 5007, organization_number: '556000-0001' })
  it('enhet utan nummer och utan eget org.nr ägs av huvudkontoret', () => {
    const enhet = kund({ id: 'e1', organization_number: null, parent_customer_id: 'hk' })
    expect(resolveDeliveryOwner(enhet, hk).id).toBe('hk')
  })
  it('enhet med samma org.nr ägs av huvudkontoret', () => {
    const enhet = kund({ id: 'e1', organization_number: '5560000001', parent_customer_id: 'hk' })
    expect(resolveDeliveryOwner(enhet, hk).id).toBe('hk')
  })
  it('enhet med eget kundnummer äger sin väg', () => {
    const enhet = kund({ id: 'e1', customer_number: 5008, organization_number: null, parent_customer_id: 'hk' })
    expect(resolveDeliveryOwner(enhet, hk).id).toBe('e1')
  })
  it('enhet med annat org.nr äger sin väg', () => {
    const enhet = kund({ id: 'e1', organization_number: '559066-7589', parent_customer_id: 'hk' })
    expect(resolveDeliveryOwner(enhet, hk).id).toBe('e1')
  })
})

describe('evaluateInvoiceDelivery', () => {
  it('obekräftad väg stoppar', () => {
    const r = evaluateInvoiceDelivery(kund())
    expect(r.ok).toBe(false)
    expect(r.issue).toBe('unconfirmed')
    expect(r.message).toContain('Nacka vatten och avfall AB')
  })
  it('e-post utan fakturamejl stoppar när kortet ska skapas', () => {
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'email' })).issue).toBe('email_missing')
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'email', billing_email: 'a@b.se' })).ok).toBe(true)
  })
  it('brev kräver adress med postnummer och ort', () => {
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'print', billing_address: 'Ansvar 28310' })).issue).toBe('address_missing')
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'print', billing_address: 'INX 9099-002, 831 90 Östersund' })).ok).toBe(true)
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'print', contact_address: 'Örkroken 15, 138 40 Älta' })).ok).toBe(true)
  })
  it('e-faktura kräver organisationsnummer, inte personnummer', () => {
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'einvoice' })).ok).toBe(true)
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'einvoice', organization_number: '811218-9876' })).issue).toBe('einvoice_private')
  })
  it('befintligt Fortnox-kort bär uppgifterna, bara vägen krävs', () => {
    expect(evaluateInvoiceDelivery(kund({ customer_number: 3549, invoice_delivery_method: 'email' })).ok).toBe(true)
    expect(evaluateInvoiceDelivery(kund({ customer_number: 3549 })).ok).toBe(false)
  })
  it('okänt värde i kolumnen räknas som obekräftat', () => {
    expect(evaluateInvoiceDelivery(kund({ invoice_delivery_method: 'fax' })).issue).toBe('unconfirmed')
  })
})

describe('validateDeliveryChoice', () => {
  const choice = { billingEmail: null, billingAddress: null, billingReference: null }
  it('kräver uppgifterna för vald väg', () => {
    expect(validateDeliveryChoice({ ...choice, method: 'email' }, '559066-7589')).not.toBeNull()
    expect(validateDeliveryChoice({ ...choice, method: 'email', billingEmail: 'faktura@nvoa.se' }, '559066-7589')).toBeNull()
    expect(validateDeliveryChoice({ ...choice, method: 'print', billingAddress: 'INX 9099-002' }, '559066-7589')).not.toBeNull()
    expect(validateDeliveryChoice({ ...choice, method: 'print', billingAddress: 'INX 9099-002, 831 90 Östersund' }, '559066-7589')).toBeNull()
    expect(validateDeliveryChoice({ ...choice, method: 'einvoice' }, '559066-7589')).toBeNull()
    expect(validateDeliveryChoice({ ...choice, method: 'einvoice' }, null)).not.toBeNull()
  })
})

describe('Fortnox-kortet', () => {
  it('uppdateringen skickar bara leveranssättet och ifyllda fält', () => {
    expect(buildFortnoxDeliveryUpdate({ method: 'einvoice', billingEmail: null, billingAddress: null, billingReference: null })).toEqual({
      DefaultDeliveryTypes: { Invoice: 'ELECTRONICINVOICE' },
    })
    expect(buildFortnoxDeliveryUpdate({
      method: 'print', billingEmail: '', billingAddress: 'INX 9099-002, 831 90 Östersund', billingReference: ' Ansvar 28310 ',
    })).toEqual({
      DefaultDeliveryTypes: { Invoice: 'PRINT' },
      Address1: 'INX 9099-002', ZipCode: '831 90', City: 'Östersund',
      YourReference: 'Ansvar 28310',
    })
  })
  it('nytt kort får leveranssätt och Er referens', () => {
    const { card } = buildFortnoxCustomerCard({
      name: 'Nacka vatten och avfall AB',
      organization_number: '559066-7589',
      billing_address: 'INX 9099-002, 831 90 Östersund',
      invoice_delivery_type: 'PRINT',
      your_reference: 'Ansvar 28310',
    })
    expect(card.DefaultDeliveryTypes).toEqual({ Invoice: 'PRINT' })
    expect(card.YourReference).toBe('Ansvar 28310')
    expect(card.Address1).toBe('INX 9099-002')
    expect(card.City).toBe('Östersund')
  })
  it('utan väg lämnas Fortnox standard', () => {
    const { card } = buildFortnoxCustomerCard({ name: 'X AB' })
    expect(card.DefaultDeliveryTypes).toBeUndefined()
    expect(card.YourReference).toBeUndefined()
  })
})
