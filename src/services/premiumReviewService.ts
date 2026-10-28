// src/services/premiumReviewService.ts
// Premie att bekräfta (beslut 2026-10-28), se src/shared/premiumReview.ts.
import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import {
  PREMIUM_REVIEW_BLOCK_MESSAGE,
  invoiceContractIds,
  unconfirmedPremiumContractIds,
} from '../shared/premiumReview'

/** Kolumnen finns inte än (migrationen 20261028 ej körd): ingen spärr. */
const isMissingColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42703' || /premium_needs_review/.test(error.message ?? ''))

export class PremiumReviewService {
  /**
   * Avtalen bakom en avtalsfaktura vars premie inte är bekräftad.
   * Tom lista för andra fakturatyper eller när allt är bekräftat.
   */
  static async getUnconfirmedContractIdsForInvoice(invoiceId: string): Promise<string[]> {
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, invoice_type, contract_id')
      .eq('id', invoiceId)
      .maybeSingle()
    if (invError) throw new Error(invError.message)
    if (!invoice || (invoice as { invoice_type?: string | null }).invoice_type !== 'contract') return []

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('contract_id')
      .eq('invoice_id', invoiceId)
    if (itemsError) throw new Error(itemsError.message)

    const ids = invoiceContractIds(invoice as { contract_id?: string | null }, (items ?? []) as { contract_id?: string | null }[])
    if (ids.length === 0) return []

    const { data: contracts, error: cError } = await supabase
      .from('contracts')
      .select('id, premium_needs_review')
      .in('id', ids)
    if (cError) {
      if (isMissingColumn(cError)) return []
      throw new Error(cError.message)
    }
    return unconfirmedPremiumContractIds(ids, (contracts ?? []) as { id: string; premium_needs_review?: boolean | null }[])
  }

  /** Kastar med texten till användaren om avtalsfakturans premie inte är bekräftad. */
  static async assertInvoicePremiumConfirmed(invoiceId: string): Promise<void> {
    const unconfirmed = await this.getUnconfirmedContractIdsForInvoice(invoiceId)
    if (unconfirmed.length > 0) throw new Error(PREMIUM_REVIEW_BLOCK_MESSAGE)
  }

  /** Fälten som släpper flaggan; används både av Bekräfta och när premien ändras. */
  static confirmationFields(profileId: string | null, name: string | null) {
    return {
      premium_needs_review: false,
      premium_confirmed_at: toLocalISOStringWithOffset(new Date()),
      premium_confirmed_by: profileId,
      premium_confirmed_by_name: name,
    }
  }

  /** Bekräfta premien i avtalskartan. */
  static async confirmPremium(contractId: string, profileId: string | null, name: string | null): Promise<void> {
    const { error } = await supabase
      .from('contracts')
      .update(this.confirmationFields(profileId, name))
      .eq('id', contractId)
    if (error) throw new Error(error.message)
  }
}
