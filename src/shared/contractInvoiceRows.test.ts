import { describe, expect, it } from 'vitest'
import { buildContractInvoiceNotes, buildContractInvoiceRows, invoiceTotals, nextInvoiceNumber } from './contractInvoiceRows'
import type { PlannedPeriod } from './contractPlanner'

const period: PlannedPeriod = {
  kind: 'premium',
  periodStart: '2026-10-01',
  periodEnd: '2027-09-30',
  amount: 6000,
  annualInForce: 6000,
  equipmentRows: [],
  subtotal: 6000,
  vatAmount: 1500,
  totalAmount: 7500,
  invoiceDate: '2026-10-15',
  dueDate: '2026-11-14',
  isHistorical: false,
  sequenceNumber: 1,
  totalSequenceCount: 2,
}

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  case_billing_item_id: id,
  article_id: null,
  display_code: '39',
  display_name: 'Avtal mekaniska fällor',
  quantity: 1,
  unit_price: 6000,
  total_price: 6000,
  vat_rate: 25,
  discount_percent: 0,
  rot_rut_type: null,
  fastighetsbeteckning: null,
  ...extra,
})

describe('fakturarader för en avtalsperiod', () => {
  it('bärande raden blir årspremien', () => {
    const rows = buildContractInvoiceRows(
      'c1',
      { premiumItems: [item('r1', { is_premium_carrier: true })], equipment: [], additionNotes: [], label: 'Mekaniska fällor', diaryNumber: null },
      period
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      contract_id: 'c1',
      line_kind: 'premium',
      case_billing_item_id: 'r1',
      article_name: 'Årspremie Mekaniska fällor, 2026-10-01 t.o.m. 2027-09-30',
      total_price: 6000,
      vat_rate: 25,
    })
    expect(invoiceTotals(rows)).toEqual({ subtotal: 6000, vat: 1500, total: 7500 })
  })

  it('rabatt på avtalsraden dras inte en gång till på årspremien', () => {
    // Premien 6 000 kr är redan priset efter rabatt (Oneflow-beloppet är netto)
    const rows = buildContractInvoiceRows(
      'c1',
      { premiumItems: [item('r1', { is_premium_carrier: true, unit_price: 6666.67, discount_percent: 10 })], equipment: [], additionNotes: [], label: 'Mekaniska fällor', diaryNumber: null },
      period
    )
    expect(rows[0]).toMatchObject({ unit_price: 6000, total_price: 6000, discount_percent: 0 })
  })

  it('andel 0 blir textrad som ingår', () => {
    const rows = buildContractInvoiceRows(
      'c1',
      {
        premiumItems: [item('r1', { is_premium_carrier: true }), item('r2', { display_name: 'Återbesök', is_premium_carrier: false, premium_share: 0 })],
        equipment: [],
        additionNotes: [],
        label: null,
        diaryNumber: 'GNU-1',
      },
      period
    )
    expect(rows.map((r) => r.line_kind)).toEqual(['premium', 'index_note'])
    expect(rows[1].article_name).toBe('Återbesök, ingår i avtalet')
    expect(rows[0].article_name).toContain('(GNU-1)')
  })

  it('anteckning och fakturanummer', () => {
    expect(buildContractInvoiceNotes(period, 'Mekaniska fällor', null)).toBe(
      'Årspremie Mekaniska fällor · Betalning 1/2 · Period 2026-10-01 t.o.m. 2027-09-30'
    )
    expect(nextInvoiceNumber('INV-202610', 'INV-202610-0041')).toBe('INV-202610-0042')
    expect(nextInvoiceNumber('INV-202610', null)).toBe('INV-202610-0001')
  })
})
