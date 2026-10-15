import { describe, expect, it } from 'vitest'
import {
  caseInvoiceSubtotal,
  isZeroAmount,
  selectInvoiceableCaseRows,
  sumInvoiceableRows,
} from './caseInvoiceRows'

const service = (total: number, extra: Record<string, unknown> = {}) =>
  ({ item_type: 'service', total_price: total, ...extra })
const article = (total: number) => ({ item_type: 'article', total_price: total })

describe('selectInvoiceableCaseRows', () => {
  it('tar tjänsterader och aldrig artiklar när tjänster finns', () => {
    const rows = [service(500), article(120)]
    expect(selectInvoiceableCaseRows(rows, 'case')).toEqual([service(500)])
  })

  it('faller tillbaka på artikelrader för gamla ärenden utan tjänster', () => {
    const rows = [article(120), { item_type: null, total_price: 80 }]
    expect(selectInvoiceableCaseRows(rows, 'case')).toHaveLength(2)
  })

  it('utesluter rader som täcks av avtalet', () => {
    const rows = [service(500, { covered_by_contract: true }), service(300)]
    expect(selectInvoiceableCaseRows(rows, 'case')).toEqual([service(300)])
  })

  it('merförsäljning: tilläggsrader på 0 kr är underlag, inte fakturarader', () => {
    const rows = [service(0, { is_addon_labour_line: true }), service(400)]
    expect(selectInvoiceableCaseRows(rows, 'contract_adhoc')).toEqual([service(400)])
    // Privat/företag har inga tilläggsrader och filtrerar inte på dem
    expect(selectInvoiceableCaseRows(rows, 'case')).toHaveLength(2)
  })
})

describe('0 kr-regeln', () => {
  it('kostnadsfri inspektion summerar till 0 kr', () => {
    const rows = selectInvoiceableCaseRows([service(0), article(45)], 'case')
    expect(isZeroAmount(caseInvoiceSubtotal(rows, null))).toBe(true)
  })

  it('100 % rabatt (total_price 0 trots à-pris) räknas som 0 kr', () => {
    const rows = [{ item_type: 'service', total_price: 0, unit_price: 1200, quantity: 1, discount_percent: 100 }]
    expect(isZeroAmount(caseInvoiceSubtotal(rows, null))).toBe(true)
  })

  it('en 0 kr-rad bredvid en rad med belopp ger faktura', () => {
    const rows = [service(0), service(950)]
    expect(caseInvoiceSubtotal(rows, null)).toBe(950)
    expect(isZeroAmount(caseInvoiceSubtotal(rows, null))).toBe(false)
  })

  it('anpassat pris ersätter radernas summa, 0 räknas som inget anpassat pris', () => {
    expect(caseInvoiceSubtotal([service(0)], 1500)).toBe(1500)
    expect(caseInvoiceSubtotal([service(800)], 0)).toBe(800)
    expect(caseInvoiceSubtotal([service(0)], null)).toBe(0)
  })

  it('ROT/RUT: arbetsraden bär belopp före avdrag, aldrig 0', () => {
    const rows = [service(1000), service(1600, { rot_rut_type: 'ROT' })]
    expect(caseInvoiceSubtotal(rows, null)).toBe(2600)
  })

  it('öresavrundning: summor under ett halvt öre är 0 kr', () => {
    expect(isZeroAmount(sumInvoiceableRows([service(0.1), service(-0.1)]))).toBe(true)
    expect(isZeroAmount(0.004)).toBe(true)
    expect(isZeroAmount(0.01)).toBe(false)
    expect(isZeroAmount(-50)).toBe(false)
  })

  it('tål total_price som sträng och null (numeric från PostgREST)', () => {
    expect(sumInvoiceableRows([{ total_price: '125.50' }, { total_price: null }])).toBe(125.5)
  })
})
