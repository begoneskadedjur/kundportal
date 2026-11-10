// src/services/paymentBlockService.ts
// Betalningsspärren (3.128.0). Kunder med förfallna portalfakturor spärras
// automatiskt (evaluate_payment_blocks, pg_cron var 15:e minut och efter varje
// Fortnox-synk) eller manuellt på kundkortet. Spärren stoppar nya ärenden
// (Skapa ärende, api/create-case, AI-bokningen, kundportalens förfrågningar och
// en BEFORE INSERT-trigger på ärendetabellerna) och varnar vid följeärenden,
// återbesök och återkommande scheman. All logik ligger i databasen; här finns
// bara anropen.

import { supabase } from '../lib/supabase'

export interface PaymentBlockInvoice {
  id: string
  invoice_number: string | null
  fortnox_document_number: string | null
  debt: number
  due_date: string
  days_overdue: number
  exempt: boolean
}

export interface PaymentBlockStatus {
  blocked: boolean
  /** Kunden som bär spärren (kunden själv eller huvudkontoret) */
  customer_id?: string
  customer_name?: string | null
  /** Spärren sitter på huvudkontoret */
  via_parent?: boolean
  source?: 'auto' | 'manual' | null
  since?: string | null
  /** Förfallen skuld (kundens del, ej undantagna fakturor) */
  amount?: number
  max_days_overdue?: number | null
  invoices?: PaymentBlockInvoice[]
}

export interface PaymentBlockSettings {
  enabled: boolean
  days_after_due: number
  min_amount: number
  default_pause_days: number
  updated_at?: string
}

export type PaymentBlockAction = 'set' | 'lift' | 'pause' | 'exempt' | 'unexempt'

export interface PaymentBlockHistoryRow {
  id: string
  customer_id: string
  action: PaymentBlockAction
  source: 'auto' | 'manual'
  reason: string | null
  invoice_ids: string[]
  amount: number | null
  days_overdue: number | null
  paused_until: string | null
  created_by_name: string | null
  created_at: string
}

export interface CustomerPaymentBlockFields {
  payment_block_active: boolean
  payment_block_source: 'auto' | 'manual' | null
  payment_block_since: string | null
  payment_block_paused_until: string | null
}

export const PAYMENT_BLOCK_DEFAULTS: PaymentBlockSettings = {
  enabled: true,
  days_after_due: 20,
  min_amount: 100,
  default_pause_days: 14,
}

/** Felet som triggern kastar när ett ärende skapas för en spärrad kund */
export function isPaymentBlockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '')
  return msg.includes('BETALNINGSSPÄRR')
}

/** Läsbar text för triggerns fel, utan prefixet */
export function paymentBlockErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '')
  return msg.replace(/^BETALNINGSSPÄRR:\s*/, '')
}

export class PaymentBlockService {
  /** Status för en kund: egen spärr eller huvudkontorets (interna roller) */
  static async getStatus(customerId: string | null | undefined): Promise<PaymentBlockStatus> {
    if (!customerId) return { blocked: false }
    const { data, error } = await supabase.rpc('get_payment_block_status', { p_customer_id: customerId })
    if (error) throw new Error(`Kunde inte läsa betalningsspärren: ${error.message}`)
    return (data ?? { blocked: false }) as PaymentBlockStatus
  }

  /** Status för ett org.nr eller personnummer (privat- och företagsärenden) */
  static async getStatusByIdentity(identity: string | null | undefined): Promise<PaymentBlockStatus> {
    const digits = (identity ?? '').replace(/\D/g, '')
    if (digits.length < 10) return { blocked: false }
    const { data, error } = await supabase.rpc('get_payment_block_status_by_identity', { p_identity: identity })
    if (error) throw new Error(`Kunde inte läsa betalningsspärren: ${error.message}`)
    return (data ?? { blocked: false }) as PaymentBlockStatus
  }

  /** Varningsflöden: status utan att kasta (fel ger ingen varning) */
  static async getStatusSafe(customerId: string | null | undefined): Promise<PaymentBlockStatus> {
    try {
      return await this.getStatus(customerId)
    } catch (err) {
      console.warn('Betalningsspärr:', err)
      return { blocked: false }
    }
  }

  static async getStatusByIdentitySafe(identity: string | null | undefined): Promise<PaymentBlockStatus> {
    try {
      return await this.getStatusByIdentity(identity)
    } catch (err) {
      console.warn('Betalningsspärr:', err)
      return { blocked: false }
    }
  }

  /** Kundportalen: spärrade kunder inom användarens behörighet */
  static async getMyBlockedCustomerIds(): Promise<string[]> {
    const { data, error } = await supabase.rpc('my_payment_blocked_customer_ids')
    if (error) {
      console.warn('Betalningsspärr (portal):', error.message)
      return []
    }
    return (data ?? []) as string[]
  }

  static async getHistory(customerIds: string[]): Promise<PaymentBlockHistoryRow[]> {
    if (customerIds.length === 0) return []
    const { data, error } = await supabase
      .from('customer_payment_blocks')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .range(0, 499)
    if (error) throw new Error(`Kunde inte läsa historiken: ${error.message}`)
    return (data ?? []) as PaymentBlockHistoryRow[]
  }

  static async getCustomerFields(customerId: string): Promise<CustomerPaymentBlockFields | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('payment_block_active, payment_block_source, payment_block_since, payment_block_paused_until')
      .eq('id', customerId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as CustomerPaymentBlockFields | null) ?? null
  }

  static async setManual(customerId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('payment_block_set_manual', { p_customer_id: customerId, p_reason: reason })
    if (error) throw new Error(error.message)
  }

  static async lift(customerId: string, reason: string, pauseUntil: string | null): Promise<void> {
    const { error } = await supabase.rpc('payment_block_lift', {
      p_customer_id: customerId,
      p_reason: reason,
      p_pause_until: pauseUntil,
    })
    if (error) throw new Error(error.message)
  }

  static async pause(customerId: string, reason: string, until: string): Promise<void> {
    const { error } = await supabase.rpc('payment_block_pause', { p_customer_id: customerId, p_reason: reason, p_until: until })
    if (error) throw new Error(error.message)
  }

  static async setInvoiceExempt(invoiceId: string, exempt: boolean, reason: string): Promise<void> {
    const { error } = await supabase.rpc('payment_block_set_invoice_exempt', {
      p_invoice_id: invoiceId,
      p_exempt: exempt,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)
  }

  static async getSettings(): Promise<PaymentBlockSettings> {
    const { data, error } = await supabase
      .from('payment_block_settings')
      .select('enabled, days_after_due, min_amount, default_pause_days, updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw new Error(`Kunde inte läsa spärrinställningarna: ${error.message}`)
    if (!data) return { ...PAYMENT_BLOCK_DEFAULTS }
    return {
      enabled: !!data.enabled,
      days_after_due: Number(data.days_after_due),
      min_amount: Number(data.min_amount),
      default_pause_days: Number(data.default_pause_days),
      updated_at: data.updated_at as string,
    }
  }

  static async updateSettings(settings: Omit<PaymentBlockSettings, 'updated_at'>, userId: string | null): Promise<void> {
    const { error } = await supabase
      .from('payment_block_settings')
      .update({
        enabled: settings.enabled,
        days_after_due: Math.round(settings.days_after_due),
        min_amount: Math.round(settings.min_amount),
        default_pause_days: Math.round(settings.default_pause_days),
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', 1)
    if (error) throw new Error(`Kunde inte spara: ${error.message}`)
  }
}

/** "12 345 kr" */
export function formatBlockAmount(n: number | null | undefined): string {
  return `${Math.round(Number(n ?? 0)).toLocaleString('sv-SE')} kr`
}

/** Kort sammanfattning för röda och gula rutor */
export function paymentBlockSummary(status: PaymentBlockStatus): string {
  if (!status.blocked) return ''
  const parts: string[] = []
  if (status.via_parent) parts.push(`Spärren sitter på huvudkontoret ${status.customer_name ?? ''}`.trim())
  const invoices = (status.invoices ?? []).filter((i) => !i.exempt)
  if (invoices.length > 0) {
    parts.push(
      `${formatBlockAmount(status.amount)} förfallet på ${invoices.length} ${invoices.length === 1 ? 'faktura' : 'fakturor'}` +
        (status.max_days_overdue ? `, äldsta ${status.max_days_overdue} dagar efter förfallodagen` : '')
    )
  } else if (status.source === 'manual') {
    parts.push('Manuell spärr')
  }
  return parts.join('. ')
}
