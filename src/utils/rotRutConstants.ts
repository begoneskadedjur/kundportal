// src/utils/rotRutConstants.ts
// Centraliserade ROT/RUT-konstanter för hela appen.
// Procentsatser kan överridas per service (services.rot_rate_percent / rut_rate_percent).
// Maxbelopp är lagstadgade tak per person och år — ändras sällan.

export const DEFAULT_ROT_PERCENT = 30
export const DEFAULT_RUT_PERCENT = 50
export const ROT_MAX_DEDUCTION = 50000
export const RUT_MAX_DEDUCTION = 75000

interface ServiceRateSource {
  rot_rate_percent?: number | null
  rut_rate_percent?: number | null
}

export function getEffectiveRotPercent(service?: ServiceRateSource | null): number {
  return service?.rot_rate_percent ?? DEFAULT_ROT_PERCENT
}

export function getEffectiveRutPercent(service?: ServiceRateSource | null): number {
  return service?.rut_rate_percent ?? DEFAULT_RUT_PERCENT
}

interface DeductibleItem {
  item_type?: 'article' | 'service' | string
  total_price: number
  vat_rate?: number | null
  rot_rut_type?: 'ROT' | 'RUT' | null
  service?: ServiceRateSource | null
}

export interface RotRutSummary {
  /** Sammanlagt avdragsbelopp (det Skatteverket betalar) */
  totalDeduction: number
  /** Vilken typ av avdrag som gäller på ärendet */
  rotRutType: 'ROT' | 'RUT' | null
  /** Sammanlagd arbetskostnad inkl moms (innan avdrag) */
  workCostInkl: number
  /** Konflikt: både ROT och RUT på samma ärende */
  hasConflict: boolean
}

/**
 * Beräknar ROT/RUT-summering över en lista billing-items eller invoice-items.
 *
 * ROT/RUT räknas alltid på arbetskostnaden INKL. moms (Skatteverkets regel).
 * total_price i case_billing_items / invoice_items lagras alltid exkl. moms,
 * så vi adderar moms via vat_rate (default 25 %) här.
 *
 * Endast tjänsterader (item_type='service') med rot_rut_type satt påverkar avdraget.
 */
export function calculateRotRutSummary(items: DeductibleItem[]): RotRutSummary {
  let totalDeduction = 0
  let workCostInkl = 0
  const seenTypes = new Set<'ROT' | 'RUT'>()

  for (const item of items) {
    if (item.item_type && item.item_type !== 'service') continue
    if (!item.rot_rut_type) continue
    seenTypes.add(item.rot_rut_type)
    const vatRate = (item.vat_rate ?? 25) / 100
    const inklPrice = item.total_price * (1 + vatRate)
    const percent = item.rot_rut_type === 'ROT'
      ? getEffectiveRotPercent(item.service)
      : getEffectiveRutPercent(item.service)
    workCostInkl += inklPrice
    totalDeduction += inklPrice * (percent / 100)
  }

  const rotRutType: 'ROT' | 'RUT' | null = seenTypes.size === 1
    ? (seenTypes.values().next().value as 'ROT' | 'RUT')
    : null

  return {
    totalDeduction,
    rotRutType,
    workCostInkl,
    hasConflict: seenTypes.size > 1,
  }
}
