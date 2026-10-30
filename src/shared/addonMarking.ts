// src/shared/addonMarking.ts
// Märkningen (Er referens) på tilläggsfakturor med nya tilläggsregler
// (contracts.addon_rules = 'v2', steg 11 i docs/planer/avtalsar-exakt-arsdag-teknik.md).
// En tilläggsfaktura per avtal och referenskod. Regeln (beslut 2026-10-30):
// enhetens kod (customers.billing_reference), annars avtalets
// invoice_reference, annars huvudkontorets eller kundens billing_reference.
// SQL-tvillingen är public.addon_marking_key_for_unit (samma regel, samma nyckel).
// Ren modul utan databas.

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim()
  return t ? t : null
}

export function addonMarkingFor(
  unit: { billing_reference?: string | null } | null | undefined,
  contract: { invoice_reference?: string | null } | null | undefined,
  root: { billing_reference?: string | null } | null | undefined
): string | null {
  return clean(unit?.billing_reference) ?? clean(contract?.invoice_reference) ?? clean(root?.billing_reference) ?? null
}

/** Nyckeln som skiljer fakturorna åt: versaler, utan blanksteg i ändarna, tom sträng utan märkning. */
export function markingKey(marking: string | null | undefined): string {
  return (marking ?? '').trim().toUpperCase()
}

/** Det som skrivs i invoices.marking_key: nyckeln, eller NULL när den är tom (samma som dagens fakturor). */
export function markingKeyColumn(marking: string | null | undefined): string | null {
  const k = markingKey(marking)
  return k ? k : null
}

/** Enhetens namn på fakturaraden: platsnamnet om det finns, annars kundnamnet. */
export function unitDisplayName(unit: { site_name?: string | null; company_name?: string | null } | null | undefined): string | null {
  return clean(unit?.site_name) ?? clean(unit?.company_name) ?? null
}
