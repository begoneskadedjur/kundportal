import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  decideFortnoxInvoiceSync,
  fortnoxMirrorFields,
  isRotRutAwaitingTaxAgency,
  toPostgrestInList,
} from './fortnoxInvoiceSync'

const NOW = new Date('2026-11-10T12:00:00+01:00')

describe('decideFortnoxInvoiceSync: vanliga fakturor beter sig som förut', () => {
  it('betald: Balance 0 och FinalPayDate ger paid med betaldatum', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: true, Booked: true, Balance: 0, FinalPayDate: '2026-11-05', DueDate: '2026-11-01' },
      { now: NOW },
    )
    expect(d.status).toBe('paid')
    expect(d.timestamp).toBe(new Date('2026-11-05').toISOString())
    expect(d.protectedStatuses).toEqual(['paid', 'cancelled'])
    expect(d.balanceDue).toBe(0)
  })

  it('skickad efter förfallodagen ger overdue', () => {
    const d = decideFortnoxInvoiceSync({ Sent: true, Booked: true, Balance: 500, DueDate: '2026-10-21' }, { now: NOW })
    expect(d.status).toBe('overdue')
    expect(d.protectedStatuses).toEqual(['paid', 'cancelled', 'overdue'])
    expect(d.customerDebt).toBe(500)
  })

  it('skickad före förfallodagen ger sent med vanlig skyddslista', () => {
    const d = decideFortnoxInvoiceSync({ Sent: true, Booked: true, Balance: 500, DueDate: '2026-12-01' }, { now: NOW })
    expect(d.status).toBe('sent')
    expect(d.protectedStatuses).toEqual(['paid', 'cancelled', 'overdue', 'sent'])
    expect(d.rotRutCustomerPaid).toBe(false)
  })

  it('bokförd men inte skickad ger booked', () => {
    const d = decideFortnoxInvoiceSync({ Sent: false, Booked: true, Balance: 500, DueDate: '2026-10-01' }, { now: NOW })
    expect(d.status).toBe('booked')
    expect(d.protectedStatuses).toContain('invoiced')
  })

  it('utkast i Fortnox ger ingen status men speglar ändå saldo och förfallodag', () => {
    const d = decideFortnoxInvoiceSync({ Sent: false, Booked: false, Balance: 1200, DueDate: '2026-12-01' }, { now: NOW })
    expect(d.status).toBeNull()
    expect(fortnoxMirrorFields(d)).toEqual({ balance_due: 1200, due_date: '2026-12-01' })
  })

  it('delbetalning: status overdue, skulden är återstående saldo', () => {
    const d = decideFortnoxInvoiceSync({ Sent: true, Booked: true, Balance: 1234.567, DueDate: '2026-10-01' }, { now: NOW })
    expect(d.status).toBe('overdue')
    expect(d.balanceDue).toBe(1234.57)
    expect(d.customerDebt).toBe(1234.57)
  })

  it('Balance 0 utan FinalPayDate räknas inte som betald (samma som förut)', () => {
    const d = decideFortnoxInvoiceSync({ Sent: true, Booked: true, Balance: 0, DueDate: '2026-12-01' }, { now: NOW })
    expect(d.status).toBe('sent')
  })
})

describe('decideFortnoxInvoiceSync: makulerade', () => {
  it('Cancelled ger cancelled (Fortnox 1063)', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: false, Booked: false, Cancelled: true, Balance: 0, DueDate: '2026-11-01', TaxReduction: null },
      { now: NOW },
    )
    expect(d.status).toBe('cancelled')
    expect(d.protectedStatuses).toEqual(['paid', 'cancelled'])
  })
})

describe('decideFortnoxInvoiceSync: ROT/RUT', () => {
  it('Fortnox 1082: kunden har betalat sin del, 2 400 kr väntar hos Skatteverket', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: true, Booked: true, Balance: 2400, TaxReduction: 2400, DueDate: '2026-11-07', FinalPayDate: null },
      { now: NOW },
    )
    expect(d.status).toBe('sent')
    expect(d.rotRutCustomerPaid).toBe(true)
    expect(d.customerDebt).toBe(0)
    // en tidigare förfallen rad får gå tillbaka till sent
    expect(d.protectedStatuses).toEqual(['paid', 'cancelled', 'sent'])
    expect(fortnoxMirrorFields(d)).toEqual({ balance_due: 2400, due_date: '2026-11-07', rot_rut_fortnox_amount: 2400 })
  })

  it('Fortnox 1155: kunden har betalat sin del före förfallodagen', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: true, Booked: true, Balance: 3840, TaxReduction: 3840, DueDate: '2026-11-13' },
      { now: NOW },
    )
    expect(d.status).toBe('sent')
    expect(d.customerDebt).toBe(0)
  })

  it('kunden har inte betalat: skulden är saldot minus avdraget, och fakturan förfaller', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: true, Booked: true, Balance: 6832, TaxReduction: 2400, DueDate: '2026-11-07' },
      { now: NOW },
    )
    expect(d.status).toBe('overdue')
    expect(d.customerDebt).toBe(4432)
    expect(d.rotRutCustomerPaid).toBe(false)
  })

  it('avslagen begäran hos Skatteverket: hela saldot är kundens skuld', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: true, Booked: true, Balance: 2400, TaxReduction: 2400, DueDate: '2026-11-07' },
      { now: NOW, rotRutClaimStatus: 'rejected' },
    )
    expect(d.status).toBe('overdue')
    expect(d.customerDebt).toBe(2400)
  })

  it('Skatteverket har betalat: Balance 0 ger paid som vanligt', () => {
    const d = decideFortnoxInvoiceSync(
      { Sent: true, Booked: true, Balance: 0, TaxReduction: 2400, DueDate: '2026-11-07', FinalPayDate: '2026-12-01' },
      { now: NOW },
    )
    expect(d.status).toBe('paid')
  })
})

describe('isRotRutAwaitingTaxAgency', () => {
  it('saldo lika med avdraget', () => {
    expect(isRotRutAwaitingTaxAgency({ balance_due: 2400, rot_rut_fortnox_amount: 2400 })).toBe(true)
  })
  it('saldo större än avdraget', () => {
    expect(isRotRutAwaitingTaxAgency({ balance_due: 6832, rot_rut_fortnox_amount: 2400 })).toBe(false)
  })
  it('avslagen', () => {
    expect(isRotRutAwaitingTaxAgency({ balance_due: 2400, rot_rut_fortnox_amount: 2400, rot_rut_claim_status: 'rejected' })).toBe(false)
  })
  it('inget avdrag eller inget saldo', () => {
    expect(isRotRutAwaitingTaxAgency({ balance_due: 100, rot_rut_fortnox_amount: null })).toBe(false)
    expect(isRotRutAwaitingTaxAgency({ balance_due: 0, rot_rut_fortnox_amount: 2400 })).toBe(false)
    expect(isRotRutAwaitingTaxAgency({ balance_due: null, rot_rut_fortnox_amount: 2400 })).toBe(false)
  })
})

describe('kopian i edge-funktionen', () => {
  it('är identisk med src/shared/fortnoxInvoiceSync.ts', () => {
    const shared = readFileSync(resolve(__dirname, 'fortnoxInvoiceSync.ts'), 'utf8').replace(/\r\n/g, '\n')
    const edge = readFileSync(
      resolve(__dirname, '../../supabase/functions/fortnox-sync/fortnoxInvoiceSync.ts'),
      'utf8',
    ).replace(/\r\n/g, '\n')
    expect(edge).toBe(shared)
  })

  it('toPostgrestInList', () => {
    expect(toPostgrestInList(['paid', 'sent'])).toBe('("paid","sent")')
  })
})
