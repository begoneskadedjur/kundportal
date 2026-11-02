import { describe, expect, it } from 'vitest'
import { buildContractInvoiceRows, contractSourcesFromRows, type ContractSourceItemRow } from './contractInvoiceRows'
import { computePlannedPeriods, type PlanningContract } from './contractPlanner'

// Nattjobbet (api/cron/generate-continuing-contracts.ts) bygger sedan
// 2026-11-02 sina rader med samma kod som Planera fakturor: källorna med
// contractSourcesFromRows och raderna med buildContractInvoiceRows.

const billingItem = (id: string, extra: Partial<ContractSourceItemRow> = {}): ContractSourceItemRow => ({
  id,
  article_code: null,
  article_name: null,
  service_code: '39',
  service_name: 'Skadedjursavtal Betongstation',
  quantity: 1,
  unit_price: 0,
  total_price: 0,
  vat_rate: 25,
  discount_percent: 0,
  billing_model: 'premium',
  ...extra,
})

describe('förlängningsfakturans premierader', () => {
  it('Årsta Torg: bärande rad på 0 kr får hela premien (INV-202611-0002 blev 0 kr)', () => {
    const contract: PlanningContract = {
      contract_start_date: '2023-02-01',
      contract_end_date: '2027-02-01',
      billing_frequency: 'annual',
      billing_anchor_month: 2,
      billing_anchor_mode: 'start_day',
      annual_value: 45135.2,
      renewal_mode: 'rolling',
      notice_period_months: 3,
      billing_active: true,
    } as PlanningContract
    const sources = contractSourcesFromRows(
      'C1',
      { label: 'Skadedjursavtal Betongstation' },
      [{ effective_from: '2023-02-01', annual_value: 45135.2, event_type: 'start' }],
      [billingItem('bd2dcaca', { is_premium_carrier: true })],
      []
    )
    const periods = computePlannedPeriods(contract, { steps: sources.steps, window: 'binding', today: '2026-11-02' })
    const p = periods.find((x) => x.periodStart === '2027-02-01')!
    expect(p.periodEnd).toBe('2028-01-31')
    const rows = buildContractInvoiceRows('C1', sources, p)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      line_kind: 'premium',
      article_name: 'Årspremie Skadedjursavtal Betongstation, 2027-02-01 t.o.m. 2028-01-31',
      quantity: 1,
      total_price: 45135,
    })
  })

  it('Rågstacken: bärande rad på 0 kr bredvid gammal importrad med belopp, bärande raden tar premien', () => {
    const sources = contractSourcesFromRows(
      'C2',
      { label: 'Skadedjursavtal Betongstation' },
      [{ effective_from: '2025-11-01', annual_value: 119000, event_type: 'start' }],
      [
        billingItem('053733dc', { is_premium_carrier: true }),
        billingItem('c62981fd', { quantity: 1, unit_price: 119000, total_price: 119000 }),
      ],
      []
    )
    const p = {
      kind: 'premium' as const,
      periodStart: '2026-11-01',
      periodEnd: '2027-10-31',
      amount: 119000,
      annualInForce: 119000,
      equipmentRows: [],
      subtotal: 119000,
      vatAmount: 29750,
      totalAmount: 148750,
      invoiceDate: '2026-10-15',
      dueDate: '2026-11-14',
      isHistorical: false,
      sequenceNumber: 1,
      totalSequenceCount: 1,
    }
    const rows = buildContractInvoiceRows('C2', sources, p)
    expect(rows.map((r) => [r.line_kind, r.total_price])).toEqual([
      ['premium', 119000],
      ['index_note', 0],
    ])
    expect(rows[1].article_name).toBe('Skadedjursavtal Betongstation, ingår i avtalet')
  })

  it('källorna: namn, stationer och rabatt som Planera fakturor', () => {
    const sources = contractSourcesFromRows(
      'C3',
      { display_name: '  ', label: 'Avtal A', invoice_reference: 'REF', diary_number: 'D-1' },
      [{ effective_from: '2026-01-01', annual_value: '1000', event_type: 'addition', note: 'Tillägg' }],
      [
        billingItem('p', { discount_percent: '10', premium_share: '0.25' }),
        billingItem('e', { billing_model: 'per_month', unit_price: 50, site_customer_id: 'U', station_type_id: 'T' }),
      ],
      [
        { station_id: 's1', unit_id: 'U', station_type_id: 'T', removed_at: null },
        { station_id: 's2', unit_id: 'U', station_type_id: 'T', removed_at: '2026-02-01' },
      ]
    )
    expect(sources.label).toBe('Avtal A')
    expect(sources.invoiceReference).toBe('REF')
    expect(sources.diaryNumber).toBe('D-1')
    expect(sources.additionNotes).toEqual([{ effective_from: '2026-01-01', note: 'Tillägg' }])
    expect(sources.premiumItems[0]).toMatchObject({ discount_percent: 10, premium_share: 0.25, is_premium_carrier: false })
    expect(sources.equipment[0]).toMatchObject({ unit_price_annual: 600, unit_price_month: 50, station_ids: ['s1'], billing_model: 'per_month' })
  })
})
