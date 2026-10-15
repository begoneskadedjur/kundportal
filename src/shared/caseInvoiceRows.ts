// src/shared/caseInvoiceRows.ts
// Vilka av ett ärendes ofakturerade rader som blir fakturarader, och vad de
// summerar till. Ren modul utan databas: delas av invoiceService
// (privat/företag), caseBillingService.caseHasBillableAmount och
// contractBillingService.createAdHocItemsFromCase (merförsäljning avtal).
//
// Regel (Christian 2026-10-15): summerar underlaget till 0 kr skapas ingen
// faktura. Raderna markeras som hanterade (case_billing_items.status='billed')
// så att de inte ligger kvar som ofakturerade, och kommer nya rader med
// belopp senare faktureras de som vanligt.

export type CaseInvoiceContext = 'case' | 'contract_adhoc'

export interface CaseInvoiceSourceRow {
  item_type?: string | null
  total_price: number | string | null
  covered_by_contract?: boolean | null
  is_addon_prorata_line?: boolean | null
  is_addon_labour_line?: boolean | null
}

/**
 * Fakturaraderna bland ärendets ofakturerade rader.
 *
 * - Tjänsterader faktureras. Rader som täcks av avtalet (§ 4,
 *   covered_by_contract) faktureras aldrig.
 * - Merförsäljning avtal: tilläggsrader (pro rata, arbetstid) på 0 kr är
 *   underlag, inte fakturarader.
 * - Artikelrader blir ALDRIG fakturarader, i någon kontext. Deras pris är
 *   intern kostnad (articles.default_price, unit_price = inköpspris). Även
 *   artiklar med kundpris (customer_unit_price, avtalad prisbilaga) säljs via
 *   tjänsteraden de är mappade mot (mapped_service_id): kundpriset låser
 *   tjänstens pris och syns som specifikation på tjänstens fakturarad.
 * - Finns inga fakturerbara tjänsterader är underlaget 0 kr (tom lista):
 *   ingen faktura, raderna markeras hanterade enligt 0 kr-regeln. Ett
 *   anpassat pris (caseInvoiceSubtotal) kan fortfarande ge belopp.
 *
 * Fram till 2026-10-15 föll urvalet tillbaka på artikelraderna när inga
 * tjänsterader fanns, vilket fakturerade inköpspriser mot kund.
 */
export function selectInvoiceableCaseRows<T extends CaseInvoiceSourceRow>(
  items: T[],
  context: CaseInvoiceContext
): T[] {
  return items.filter(i =>
    i.item_type === 'service' &&
    !i.covered_by_contract &&
    !(context === 'contract_adhoc' &&
      (i.is_addon_prorata_line || i.is_addon_labour_line) &&
      !(Number(i.total_price) > 0))
  )
}

/** Radernas summa exkl. moms, avrundad till ören. */
export function sumInvoiceableRows(rows: CaseInvoiceSourceRow[]): number {
  return Math.round(rows.reduce((s, r) => s + Number(r.total_price || 0), 0) * 100) / 100
}

/**
 * Fakturans belopp exkl. moms, samma regel som InvoiceService.createInvoiceFromCase:
 * ett anpassat pris (case_billing_overrides, > 0) ersätter radernas summa.
 */
export function caseInvoiceSubtotal(
  rows: CaseInvoiceSourceRow[],
  customPrice: number | null | undefined
): number {
  if (customPrice) return Math.round(Number(customPrice) * 100) / 100
  return sumInvoiceableRows(rows)
}

/** Belopp som räknas som 0 kr (under ett halvt öre åt något håll). */
export function isZeroAmount(amount: number): boolean {
  return Math.abs(amount) < 0.005
}
