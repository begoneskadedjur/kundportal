import { describe, it, expect } from 'vitest'
import { formatPayback, marginTone, paybackTone, summarizeBillingLines, type MarginLine } from './marginEngine'

const svc = (price: number): MarginLine => ({ item_type: 'service', total_price: price })
const art = (price: number, qty: number, extra?: Partial<MarginLine>): MarginLine => ({
  item_type: 'article', total_price: price, quantity: qty, ...extra,
})
const durable = (name: string, price: number, qty: number): MarginLine =>
  art(price, qty, { article_name: name, article: { is_durable: true, category: 'Bekämpning' } })
const labour = (hours: number, rate = 1016): MarginLine =>
  art(hours * rate, hours, { article_name: 'Arbetstid Företag', article: { is_durable: false, category: 'Arbetstid' } })

describe('summarizeBillingLines på avtal', () => {
  // FEV Återvinningscentralen med rätt intäktsbas (annual_value 6 842 + tillägg 22 156)
  const lines: MarginLine[] = [
    svc(0), svc(16436), svc(3372), svc(2348),
    durable('Aurotrap Nature', 24850, 7),
    durable('PW Titan 300 Vit SP', 4838, 2),
    durable('Betesstation Vägg galvad plåt', 108, 1),
    labour(1),
  ]

  it('delar kostnaden i löpande och varaktig', () => {
    const b = summarizeBillingLines(lines, { context: 'contract', revenueOverride: 28998 })
    expect(b.revenue).toBe(28998)
    expect(b.cost_total).toBe(30812)
    expect(b.cost_durable).toBe(29796)
    expect(b.cost_ongoing).toBe(1016)
    expect(b.labour_cost).toBe(1016)
    expect(b.labour_hours).toBe(1)
    expect(b.durable_count).toBe(10)
    expect(b.durable_lines[0]).toEqual({ article_name: 'Aurotrap Nature', quantity: 7, cost: 24850 })
  })

  it('räknar år 1, löpande och återbetalning mot täckningsbidraget', () => {
    const b = summarizeBillingLines(lines, { context: 'contract', revenueOverride: 28998 })
    expect(b.margin_percent_year1).toBeCloseTo(-6.26, 1)
    expect(b.margin_percent_ongoing).toBeCloseTo(96.5, 1)
    expect(b.contribution_ongoing).toBe(27982)
    expect(b.payback_years).toBeCloseTo(1.065, 2)
    expect(b.payback_never).toBe(false)
    expect(b.headline_label).toBe('Löpande marginal')
    expect(b.headline_percent).toBe(b.margin_percent_ongoing)
  })

  it('marginal över tre år', () => {
    const b = summarizeBillingLines(lines, { context: 'contract', revenueOverride: 28998 })
    // (3·28998 − 3·1016 − 29796) / (3·28998)
    expect(b.margin_percent_3y).toBeCloseTo(62.25, 1)
  })

  it('arbetstidsspärren slår när timmarna är färre än besöken', () => {
    const b = summarizeBillingLines(lines, { context: 'contract', revenueOverride: 28998, visitsPerYear: 4 })
    expect(b.labour_missing).toBe(true)
    const ok = summarizeBillingLines([...lines, labour(7)], { context: 'contract', revenueOverride: 28998, visitsPerYear: 4 })
    expect(ok.labour_missing).toBe(false)
    expect(ok.margin_percent_ongoing).toBeCloseTo(71.97, 1)
  })

  it('återbetalas aldrig när täckningsbidraget är noll eller negativt', () => {
    const b = summarizeBillingLines([svc(1000), labour(2), durable('Fälla', 5000, 1)], { context: 'contract' })
    expect(b.contribution_ongoing).toBe(-1032)
    expect(b.payback_years).toBeNull()
    expect(b.payback_never).toBe(true)
  })

  it('utan varaktig utrustning är löpande lika med år 1 och etiketten bara Marginal', () => {
    const b = summarizeBillingLines([svc(10000), labour(3)], { context: 'contract' })
    expect(b.cost_durable).toBe(0)
    expect(b.margin_percent_ongoing).toBe(b.margin_percent_year1)
    expect(b.payback_years).toBeNull()
    expect(b.headline_label).toBe('Marginal')
  })
})

describe('summarizeBillingLines på ärenden', () => {
  it('år 1 är huvudtal: fällan på ett engångsjobb räknas fullt ut', () => {
    const b = summarizeBillingLines([svc(2000), durable('Aurotrap Nature', 3550, 1)], { context: 'case' })
    expect(b.headline_label).toBe('Marginal')
    expect(b.headline_percent).toBeCloseTo(-77.5, 1)
    expect(b.cost_durable).toBe(3550)
    expect(b.labour_missing).toBe(false)
  })

  it('artikel utan relation räknas som löpande, aldrig tyst som varaktig', () => {
    const b = summarizeBillingLines([svc(1000), art(500, 1)], { context: 'case' })
    expect(b.cost_durable).toBe(0)
    expect(b.cost_ongoing).toBe(500)
  })

  it('ignorerar makulerade rader och tål strängbelopp', () => {
    const b = summarizeBillingLines(
      [svc(1000), { item_type: 'article', total_price: '400', quantity: '2', status: 'cancelled' }, { item_type: 'article', total_price: '100' }],
      { context: 'case' }
    )
    expect(b.cost_total).toBe(100)
  })
})

describe('toner och format', () => {
  const settings = { min_margin_percent: 20, target_margin_percent: 35, max_payback_years: 2 }
  it('marginTone följer inställningarna', () => {
    expect(marginTone(40, settings)).toBe('good')
    expect(marginTone(25, settings)).toBe('warn')
    expect(marginTone(10, settings)).toBe('bad')
    expect(marginTone(null, settings)).toBe('none')
  })
  it('paybackTone larmar över gränsen', () => {
    expect(paybackTone({ payback_years: 1.4, payback_never: false }, settings)).toBe('good')
    expect(paybackTone({ payback_years: 2.5, payback_never: false }, settings)).toBe('bad')
    expect(paybackTone({ payback_years: null, payback_never: true }, settings)).toBe('bad')
    expect(paybackTone({ payback_years: null, payback_never: false }, settings)).toBe('none')
  })
  it('formatPayback skriver månader under ett år', () => {
    expect(formatPayback(0.5)).toBe('6 mån')
    expect(formatPayback(1.42)).toBe('1,4 år')
    expect(formatPayback(null)).toBe('')
  })
})
