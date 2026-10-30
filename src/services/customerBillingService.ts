// src/services/customerBillingService.ts
// Kundradens faktureringsval som visas på flera ställen (kundkortets flik
// Fakturering, avtalskartan för avrop). Steg 12 i
// docs/planer/avtalsar-exakt-arsdag-teknik.md.
//
// Ärendefakturering (customers.adhoc_invoice_grouping): per_case = en faktura
// per avslutat ärende, monthly_batch = samlingsfaktura per månad. Läses av
// ContractBillingService när ett ärende faktureras, på ärendets kundrad.

import { supabase } from '../lib/supabase'

export type AdhocInvoiceGrouping = 'per_case' | 'monthly_batch'

export const ADHOC_GROUPING_LABEL: Record<AdhocInvoiceGrouping, string> = {
  per_case: 'per ärende',
  monthly_batch: 'samlat per månad',
}

/** Kolumnens standard är per_case; okänt eller tomt läses som per ärende. */
export function adhocGroupingOf(value: string | null | undefined): AdhocInvoiceGrouping {
  return value === 'monthly_batch' ? 'monthly_batch' : 'per_case'
}

export class CustomerBillingService {
  /** Samma skrivning som BillingSettingsModal gör (kundraden, RLS för personal). */
  static async setAdhocGrouping(customerId: string, value: AdhocInvoiceGrouping): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ adhoc_invoice_grouping: value, updated_at: new Date().toISOString() })
      .eq('id', customerId)
    if (error) throw new Error(`Kunde inte spara ärendefaktureringen: ${error.message}`)
  }
}
