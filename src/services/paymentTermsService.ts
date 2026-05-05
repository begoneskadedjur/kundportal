// src/services/paymentTermsService.ts
// Dynamiska betalningsvillkor per ärendekategori. Lagrade i payment_terms_settings.
// Cache-tid 5 min för att undvika N DB-anrop vid batch-fakturering.

import { supabase } from '../lib/supabase'

export type BillingCategory = 'private' | 'business' | 'contract'

const FALLBACK_DAYS: Record<BillingCategory, number> = {
  private: 20,
  business: 14,
  contract: 30,
}

const CACHE_TTL_MS = 5 * 60 * 1000

interface CachedTerms {
  data: Record<BillingCategory, number>
  expires: number
}

let cache: CachedTerms | null = null

async function fetchAll(): Promise<Record<BillingCategory, number>> {
  const { data, error } = await supabase
    .from('payment_terms_settings')
    .select('category, days_until_due')

  if (error || !data) {
    console.warn('payment_terms_settings: läsfel, använder fallback', error?.message)
    return { ...FALLBACK_DAYS }
  }

  const result: Record<BillingCategory, number> = { ...FALLBACK_DAYS }
  for (const row of data as Array<{ category: BillingCategory; days_until_due: number }>) {
    if (row.category in FALLBACK_DAYS) {
      result[row.category] = row.days_until_due
    }
  }
  return result
}

export class PaymentTermsService {
  static async getAll(): Promise<Record<BillingCategory, number>> {
    if (cache && cache.expires > Date.now()) {
      return cache.data
    }
    const data = await fetchAll()
    cache = { data, expires: Date.now() + CACHE_TTL_MS }
    return data
  }

  static async getDays(category: BillingCategory): Promise<number> {
    const all = await this.getAll()
    return all[category] ?? FALLBACK_DAYS[category]
  }

  static async update(category: BillingCategory, days: number): Promise<void> {
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error('Ogiltigt antal dagar')
    }
    const { error } = await supabase
      .from('payment_terms_settings')
      .update({ days_until_due: Math.round(days), updated_at: new Date().toISOString() })
      .eq('category', category)
    if (error) throw new Error(`Kunde inte uppdatera betalningsvillkor: ${error.message}`)
    cache = null
  }

  /** Tvinga ny läsning vid nästa anrop. */
  static invalidateCache(): void {
    cache = null
  }
}
