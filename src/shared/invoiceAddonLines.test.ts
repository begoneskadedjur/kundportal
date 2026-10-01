import { describe, it, expect } from 'vitest'
import {
  addonExpectedTotal,
  addonInvoicePeriod,
  addonLineName,
  addonPeriodText,
  buildFortnoxInvoiceRows,
  matchInvoiceAddonLines,
  type AddonCaseRow,
  type BillingItemLink,
  type InvoiceItemLike,
} from './invoiceAddonLines'

// INV-202609-915419 (BE-0008974, WBAB Bylandet) efter rättningen 2026-10-01
const CASE = 'case-974'
const caseRows: AddonCaseRow[] = [
  { id: 'k-118', case_id: CASE, item_type: 'service', status: 'billed', service_code: '118', quantity: 1, unit_price: 0, total_price: 0, is_addon_prorata_line: false },
  {
    id: 'k-144', case_id: CASE, item_type: 'service', status: 'billed', service_code: '144', service_id: 's-144',
    quantity: 4, unit_price: 1769.04, total_price: 7076.16, addon_annual_unit_price: 2348, billing_start_date: '2027-07-01',
    addon_model: 'per_year', is_addon_prorata_line: true,
  },
  {
    id: 'k-135', case_id: CASE, item_type: 'service', status: 'billed', service_code: '135', service_id: 's-135',
    quantity: 2, unit_price: 400.82, total_price: 801.64, addon_annual_unit_price: 532, billing_start_date: '2027-07-01',
    is_addon_prorata_line: true, is_addon_labour_line: true, addon_labour_hours: 2, addon_labour_hours_before: 0,
  },
]
const billing: BillingItemLink[] = [
  { id: 'c-118', case_id: CASE, case_billing_item_id: null, article_code: '118' },
  { id: 'c-144', case_id: CASE, case_billing_item_id: 'k-144', article_code: '144' },
  // Äldre rad utan koppling: hittas på ärende + kod
  { id: 'c-135', case_id: CASE, case_billing_item_id: null, article_code: '135' },
]
const items: InvoiceItemLike[] = [
  { id: 'i-118', article_code: '118', article_name: 'Etableringskostnad', quantity: 1, unit_price: 0, total_price: 0, vat_rate: 25, discount_percent: 0, contract_billing_item_id: 'c-118', line_kind: 'service' },
  { id: 'i-144', article_code: '144', article_name: 'Mekanisk fälla (tilläggsstation)', quantity: 4, unit_price: 1769.04, total_price: 7076.16, vat_rate: 25, discount_percent: 0, contract_billing_item_id: 'c-144', line_kind: 'service' },
  { id: 'i-135', article_code: '135', article_name: 'Arbetstid för att hantera tilläggen', quantity: 2, unit_price: 400.82, total_price: 801.64, vat_rate: 25, discount_percent: 0, contract_billing_item_id: 'c-135', line_kind: 'service' },
]

describe('matchInvoiceAddonLines', () => {
  const lines = matchInvoiceAddonLines(items, billing, caseRows)

  it('hittar station och arbetstid, inte etableringen', () => {
    expect(lines.map((l) => [l.invoiceItemId, l.kind])).toEqual([
      ['i-144', 'station'],
      ['i-135', 'labour'],
    ])
  })

  it('perioden under raden: 2026-09-29 till 2027-06-30', () => {
    expect(addonPeriodText(lines[0].timeline)).toBe('2026-09-29 till 2027-06-30')
    expect(addonPeriodText(lines[1].timeline)).toBe('2026-09-29 till 2027-06-30')
    expect(lines[0].timeline.days).toBe(275)
  })

  it('fakturans period och nästa tilläggsfaktura', () => {
    expect(addonInvoicePeriod(lines)).toEqual({ start: '2026-09-29', end: '2027-06-30', nextStart: '2027-07-01' })
  })

  it('tvetydig kod utan koppling ger ingen träff', () => {
    const dup = [...caseRows, { ...caseRows[2], id: 'k-135b' }]
    expect(matchInvoiceAddonLines(items, billing, dup).map((l) => l.invoiceItemId)).toEqual(['i-144'])
  })
})

describe('addonExpectedTotal', () => {
  const lines = matchInvoiceAddonLines(items, billing, caseRows)
  it('avtalspris × dagar / 365, inte helårspriset', () => {
    expect(addonExpectedTotal(lines[0], 2348)).toBe(7076.16)
    expect(addonExpectedTotal(lines[1], 532)).toBe(801.64)
  })
  it('fel årspris avviker', () => {
    expect(addonExpectedTotal(lines[0], 2500)).not.toBe(7076.16)
  })
  it('1,5 h på BE-0008975 stämmer inom en krona', () => {
    const row: AddonCaseRow = {
      id: 'k', case_id: 'c', status: 'billed', service_code: '135', is_addon_prorata_line: true, is_addon_labour_line: true,
      quantity: 1.5, unit_price: 399.37, total_price: 599.05, addon_annual_unit_price: 532, billing_start_date: '2027-07-01',
      addon_labour_hours: 1.5, addon_labour_hours_before: 0,
    }
    const [l] = matchInvoiceAddonLines(
      [{ id: 'i', article_code: '135', contract_billing_item_id: 'cb' }],
      [{ id: 'cb', case_id: 'c', case_billing_item_id: 'k' }],
      [row]
    )
    expect(l.timeline.days).toBe(274)
    expect(Math.abs(addonExpectedTotal(l, 532) - 599.05)).toBeLessThan(1)
  })
})

describe('addonLineName', () => {
  it('stationsrad och arbetstid', () => {
    expect(addonLineName('Mekanisk fälla (tilläggsstation)', 'station')).toBe('Mekanisk fälla, tilläggsstation')
    expect(addonLineName('Arbetstid', 'labour')).toBe('Arbetstid för att hantera tilläggen')
  })
})

describe('buildFortnoxInvoiceRows', () => {
  const lines = matchInvoiceAddonLines(items, billing, caseRows)

  it('INV-202609-915419: periodtext, timmar och förklaring efter raderna', () => {
    const rows = buildFortnoxInvoiceRows(items, { vatIncluded: false, addonLines: lines })
    expect(rows).toEqual([
      { ArticleNumber: '118', Description: 'Etableringskostnad', DeliveredQuantity: 1, Price: 0, VAT: 25 },
      { ArticleNumber: '144', Description: 'Mekanisk fälla, tilläggsstation', DeliveredQuantity: 4, Price: 1769.04, VAT: 25 },
      { Description: 'Period 2026-09-29 till 2027-06-30' },
      { ArticleNumber: '135', Description: 'Arbetstid för att hantera tilläggen, timmar', DeliveredQuantity: 2, Price: 400.82, VAT: 25 },
      { Description: 'Period 2026-09-29 till 2027-06-30' },
      { Description: 'Tilläggsstationerna faktureras för tiden fram till avtalets nästa årspremie.' },
      { Description: 'Från 2027-07-01 faktureras de årsvis i samband med avtalets årsfaktura, med samma faktureringsperiod som avtalet.' },
    ])
    // Fortnox räknar belopp = antal × à-pris, summan ska vara oförändrad
    const net = rows.reduce((s, r) => ('Price' in r ? s + r.Price * r.DeliveredQuantity : s), 0)
    expect(Math.round(net * 100) / 100).toBe(7877.8)
  })

  it('fakturor utan tillägg skickas som förut, textrader som ren beskrivning', () => {
    const plain: InvoiceItemLike[] = [
      { id: 'a', article_code: 'X1', article_name: 'Sanering', quantity: 1, unit_price: 1000, total_price: 1000, vat_rate: 25, discount_percent: 10 },
      { id: 'b', article_code: null, article_name: 'Indexuppräkning 3 %', quantity: 0, unit_price: 0, total_price: 0, vat_rate: 25, discount_percent: 0, line_kind: 'index_note' },
    ]
    expect(buildFortnoxInvoiceRows(plain, { vatIncluded: true })).toEqual([
      { ArticleNumber: 'X1', Description: 'Sanering', DeliveredQuantity: 1, Price: 1250, VAT: 25, Discount: 10, DiscountType: 'PERCENT' },
      { Description: 'Indexuppräkning 3 %' },
    ])
  })

  it('ROT/RUT markeras per rad bara med fastighetsbeteckning', () => {
    const rot: InvoiceItemLike[] = [
      { id: 'a', article_code: 'A', article_name: 'Arbete', quantity: 2, unit_price: 500, total_price: 1000, vat_rate: 25, discount_percent: 0, rot_rut_type: 'ROT' },
    ]
    expect(buildFortnoxInvoiceRows(rot, { vatIncluded: false, fastighetsbeteckning: 'X 1:2' })[0]).toMatchObject({ HouseWork: true, HouseWorkType: 'CONSTRUCTION' })
    expect(buildFortnoxInvoiceRows(rot, { vatIncluded: false })[0]).not.toHaveProperty('HouseWork')
  })
})
