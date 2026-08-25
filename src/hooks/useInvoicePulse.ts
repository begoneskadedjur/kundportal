// src/hooks/useInvoicePulse.ts
// Datahook för fakturamodalens pulsrad (InvoicePulseRow). Alla läsningar är
// read-only — Fortnox-flödet påverkas inte. Kan ett värde inte beräknas
// returneras null och cellen visar "–", aldrig gissade defaults.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PaymentTermsService, type BillingCategory } from '../services/paymentTermsService'
import { resolveFortnoxCustomerNumber } from '../utils/fortnoxCustomerResolver'
import type { InvoiceWithItems } from '../types/invoice'
import { formatInvoiceAmount } from '../types/invoice'

// Marginaltrösklar för ekonomisignalen: < BAD röd, BAD–WARN amber, > WARN grön
export const MARGIN_BAD_BELOW = 0
export const MARGIN_WARN_BELOW = 15
// Premieavstämning: fakturans subtotal mot avtalets årspremie, tolerans i kr
const PREMIUM_TOLERANCE_KR = 1
// Betalvillkorskontroll: due_date − created_at får avvika så här många dagar
const TERMS_DEVIATION_TOLERANCE_DAYS = 2

const DAY_MS = 24 * 60 * 60 * 1000
const PRE_SEND_STATUSES = ['pending_approval', 'ready']
export const SENT_LIKE_STATUSES = ['sent', 'booked', 'paid', 'overdue']

// Lokal svensk dagnyckel (toISOString vore UTC och kan ge fel dygn kvällstid)
export const localDateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Heldagars differens mellan två datumsträngar (a − b)
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / DAY_MS)

// Kategorin för betalningsvillkor: case_type vinner (partial/case-fakturor),
// därefter invoice_type; contract/adhoc räknas som avtalskund
const billingCategory = (invoice: InvoiceWithItems): BillingCategory => {
  if (invoice.case_type === 'private') return 'private'
  if (invoice.case_type === 'business') return 'business'
  const t = invoice.invoice_type as string
  if (t === 'private') return 'private'
  if (t === 'business') return 'business'
  return 'contract'
}

interface CustomerInvoiceRow {
  id: string
  invoice_number: string | null
  total_amount: number
  status: string
  due_date: string | null
  paid_at: string | null
  created_at: string
}

export interface PayDot {
  key: string
  tone: 'ok' | 'late' | 'due' | 'open'
  title: string
}

export interface InvoicePulse {
  loading: boolean
  /** Betalvillkor i dagar för fakturans kategori, null om uppslag misslyckades */
  termsDays: number | null
  /** Pre-send: due_date avviker >2 dgr från villkoret */
  termsDeviation: boolean
  /** Avtalets årspremie (endast contract-fakturor), null = saknas/ej tillämpligt */
  annualValue: number | null
  /** Contract-faktura vars subtotal avviker från årspremien (±1 kr) */
  premiumMismatch: boolean
  /** null = kundidentifierare saknas, kan inte beräknas */
  outstandingTotal: number | null
  overdueTotal: number | null
  payDots: PayDot[]
  /** Snitt paid_at − due_date i dagar (negativt = före förfall), null = underlag saknas */
  avgPayDiffDays: number | null
  fortnoxCustomerNumber: number | null
  /** Resolvern kastade — visa "–" i stället för "saknas" */
  fortnoxLookupFailed: boolean
}

const EMPTY_PULSE: InvoicePulse = {
  loading: false,
  termsDays: null,
  termsDeviation: false,
  annualValue: null,
  premiumMismatch: false,
  outstandingTotal: null,
  overdueTotal: null,
  payDots: [],
  avgPayDiffDays: null,
  fortnoxCustomerNumber: null,
  fortnoxLookupFailed: false,
}

export function useInvoicePulse(invoice: InvoiceWithItems | null): InvoicePulse {
  const [pulse, setPulse] = useState<InvoicePulse>(EMPTY_PULSE)

  useEffect(() => {
    if (!invoice) {
      setPulse(EMPTY_PULSE)
      return
    }
    let cancelled = false

    const fetchAnnualValue = async (): Promise<number | null> => {
      if (invoice.invoice_type !== 'contract' || !invoice.customer_id) return null
      const { data } = await supabase
        .from('customers')
        .select('annual_value')
        .eq('id', invoice.customer_id)
        .maybeSingle()
      const v = (data as { annual_value: number | null } | null)?.annual_value
      return v != null && Number(v) > 0 ? Number(v) : null
    }

    // Kundens övriga fakturor: matcha på customer_id ELLER org.nr (multisite
    // delar org.nr), exkludera den öppna fakturan
    const fetchCustomerInvoices = async (): Promise<CustomerInvoiceRow[] | null> => {
      let query = supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, status, due_date, paid_at, created_at')
        .neq('id', invoice.id)
        .in('status', ['sent', 'booked', 'overdue', 'paid'])
        .order('created_at', { ascending: false })
        .limit(100)
      if (invoice.customer_id && invoice.organization_number) {
        query = query.or(
          `customer_id.eq.${invoice.customer_id},organization_number.eq.${invoice.organization_number}`
        )
      } else if (invoice.customer_id) {
        query = query.eq('customer_id', invoice.customer_id)
      } else if (invoice.organization_number) {
        query = query.eq('organization_number', invoice.organization_number)
      } else {
        return null
      }
      const { data, error } = await query
      if (error) return null
      return (data as CustomerInvoiceRow[] | null) ?? []
    }

    // Read-only-uppslag av Fortnox-kundnummer; fel får aldrig krascha modalen
    const fetchFortnoxNumber = async (): Promise<{ value: number | null; failed: boolean }> => {
      if (!invoice.customer_id) return { value: null, failed: false }
      try {
        const value = await resolveFortnoxCustomerNumber(invoice.customer_id)
        return { value, failed: false }
      } catch {
        return { value: null, failed: true }
      }
    }

    const load = async () => {
      setPulse({ ...EMPTY_PULSE, loading: true })
      const [termsDays, annualValue, customerRows, fortnox] = await Promise.all([
        PaymentTermsService.getDays(billingCategory(invoice)).catch(() => null),
        fetchAnnualValue().catch(() => null),
        fetchCustomerInvoices().catch(() => null),
        fetchFortnoxNumber(),
      ])
      if (cancelled) return

      const todayKey = localDateKey()
      let outstandingTotal: number | null = null
      let overdueTotal: number | null = null
      let payDots: PayDot[] = []
      let avgPayDiffDays: number | null = null

      if (customerRows) {
        const open = customerRows.filter(r => ['sent', 'booked', 'overdue'].includes(r.status))
        outstandingTotal = open.reduce((s, r) => s + Number(r.total_amount || 0), 0)
        overdueTotal = open
          .filter(r => r.status === 'overdue' || (r.due_date && r.due_date < todayKey))
          .reduce((s, r) => s + Number(r.total_amount || 0), 0)

        // Senaste 8 fakturorna, äldst vänster
        payDots = customerRows.slice(0, 8).reverse().map(r => {
          let tone: PayDot['tone']
          if (r.status === 'paid') {
            tone = r.paid_at && r.due_date && r.paid_at.slice(0, 10) > r.due_date ? 'late' : 'ok'
          } else if (r.status === 'overdue' || (r.due_date && r.due_date < todayKey)) {
            tone = 'due'
          } else {
            tone = 'open'
          }
          return {
            key: r.id,
            tone,
            title: `${r.invoice_number || 'Faktura'} · ${formatInvoiceAmount(Number(r.total_amount || 0))}`,
          }
        })

        const paidWithDates = customerRows.filter(r => r.status === 'paid' && r.paid_at && r.due_date)
        if (paidWithDates.length > 0) {
          const sum = paidWithDates.reduce((s, r) => s + daysBetween(r.paid_at as string, r.due_date as string), 0)
          avgPayDiffDays = Math.round(sum / paidWithDates.length)
        }
      }

      const termsDeviation =
        PRE_SEND_STATUSES.includes(invoice.status) &&
        !!invoice.due_date &&
        termsDays != null &&
        Math.abs(daysBetween(invoice.due_date, invoice.created_at) - termsDays) > TERMS_DEVIATION_TOLERANCE_DAYS

      const premiumMismatch =
        invoice.invoice_type === 'contract' &&
        annualValue != null &&
        Math.abs(Number(invoice.subtotal) - annualValue) > PREMIUM_TOLERANCE_KR

      setPulse({
        loading: false,
        termsDays,
        termsDeviation,
        annualValue,
        premiumMismatch,
        outstandingTotal,
        overdueTotal,
        payDots,
        avgPayDiffDays,
        fortnoxCustomerNumber: fortnox.value,
        fortnoxLookupFailed: fortnox.failed,
      })
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, invoice?.status, invoice?.due_date])

  return pulse
}
