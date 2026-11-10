// api/_lib/paymentBlock.ts
// Betalningsspärren (3.128.0) för serverless-endpoints som skapar ärenden.
// Endpoints kör som service_role och släpps därför igenom av databasens
// BEFORE INSERT-trigger; de måste själva fråga och svara 423.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ServerPaymentBlockStatus {
  blocked: boolean
  customer_id?: string
  customer_name?: string | null
  via_parent?: boolean
  amount?: number
}

export const PAYMENT_BLOCK_HTTP_STATUS = 423

export const PAYMENT_BLOCK_CUSTOMER_MESSAGE =
  'Vi har obetalda fakturor registrerade på ert konto och kan därför inte ta emot nya ärenden just nu. Kontakta oss så hjälper vi er.'

export const PAYMENT_BLOCK_STAFF_MESSAGE =
  'Kunden har betalningsspärr på grund av obetalda fakturor. Nya ärenden kan inte skapas förrän spärren hävs på kundkortet.'

/** Spärrstatus för en kund (egen spärr eller huvudkontorets). Fel ger { blocked: false } och loggas. */
export async function getServerPaymentBlock(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
): Promise<ServerPaymentBlockStatus> {
  if (!customerId) return { blocked: false }
  const { data, error } = await supabase.rpc('get_payment_block_status', { p_customer_id: customerId })
  if (error) {
    console.error('Betalningsspärr: kunde inte läsa status', error.message)
    return { blocked: false }
  }
  return (data ?? { blocked: false }) as ServerPaymentBlockStatus
}

/** Spärrstatus för ett org.nr eller personnummer (privat- och företagsärenden) */
export async function getServerPaymentBlockByIdentity(
  supabase: SupabaseClient,
  identity: string | null | undefined,
): Promise<ServerPaymentBlockStatus> {
  if ((identity ?? '').replace(/\D/g, '').length < 10) return { blocked: false }
  const { data, error } = await supabase.rpc('get_payment_block_status_by_identity', { p_identity: identity })
  if (error) {
    console.error('Betalningsspärr: kunde inte läsa status', error.message)
    return { blocked: false }
  }
  return (data ?? { blocked: false }) as ServerPaymentBlockStatus
}
