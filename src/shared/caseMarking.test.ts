import { describe, it, expect } from 'vitest'
import { caseMarkingOnInvoice } from './caseMarking'

describe('caseMarkingOnInvoice', () => {
  it('Falu kommun: arbetsorder och objekt', () => {
    expect(caseMarkingOnInvoice({ work_order_number: '000139192-00', work_object: '10556' })).toEqual({
      orderNumber: '000139192-00 objekt 10556',
      rowText: 'Arbetsorder 000139192-00, objekt 10556',
    })
  })
  it('bara objekt', () => {
    expect(caseMarkingOnInvoice({ work_object: ' 10071 ' })).toEqual({ orderNumber: 'objekt 10071', rowText: 'Objekt 10071' })
  })
  it('tomt ger inget', () => {
    expect(caseMarkingOnInvoice({ work_order_number: ' ', work_object: null })).toEqual({ orderNumber: null, rowText: null })
  })
  it('håller Fortnox gränser', () => {
    const r = caseMarkingOnInvoice({ work_order_number: '1234567890-1234567890', work_object: '99999', room_number: '12B' })
    expect(r.orderNumber!.length).toBeLessThanOrEqual(30)
    expect(r.rowText!.length).toBeLessThanOrEqual(50)
  })
})
