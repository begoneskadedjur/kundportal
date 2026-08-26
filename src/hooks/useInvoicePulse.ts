// src/hooks/useInvoicePulse.ts
// Datahook för fakturamodalens pulsrad (InvoicePulseRow). Alla läsningar är
// read-only — Fortnox-flödet påverkas inte. Kan ett värde inte beräknas
// returneras null och cellen visar "–", aldrig gissade defaults.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PaymentTermsService, type BillingCategory } from '../services/paymentTermsService'
import { PriceListService } from '../services/priceListService'
import { resolveFortnoxCustomerNumber } from '../utils/fortnoxCustomerResolver'
import type { InvoiceWithItems } from '../types/invoice'
import { formatInvoiceAmount } from '../types/invoice'
import type { CaseBillingItem } from '../types/caseBilling'

// Marginaltrösklar för ekonomisignalen: < BAD röd, BAD–WARN amber, > WARN grön
export const MARGIN_BAD_BELOW = 0
export const MARGIN_WARN_BELOW = 15
// Premieavstämning: fakturans subtotal mot avtalets årspremie, tolerans i kr
const PREMIUM_TOLERANCE_KR = 1
// Betalvillkorskontroll (efter sändning): due_date − sent_at får avvika så här många dagar
const TERMS_DEVIATION_TOLERANCE_DAYS = 2

const DAY_MS = 24 * 60 * 60 * 1000
export const PRE_SEND_STATUSES = ['pending_approval', 'ready']
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
  /** Efter sändning till Fortnox: due_date avviker >2 dgr från sent_at + villkoret.
   *  Före sändning är förfallodatumet preliminärt — då varnas aldrig. */
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
  /** Ackumulerad merförsäljning (adhoc, ej makulerade) under innevarande avtalsår
   *  inkl. denna faktura. null = ej adhoc eller contract_start_date saknas */
  upsellYearTotal: number | null
  upsellYearCount: number | null
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
  upsellYearTotal: null,
  upsellYearCount: null,
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

    // Merförsäljning under innevarande avtalsår (adhoc-fakturor). Avtalsåret
    // ankras i customers.contract_start_date — årsdagen närmast bakåt i tiden.
    // Saknas datumet returneras null (ingen gissning, raden döljs i UI:t).
    const fetchUpsellYear = async (): Promise<{ total: number; count: number } | null> => {
      if (invoice.invoice_type !== 'adhoc' || !invoice.customer_id) return null
      const { data: cust } = await supabase
        .from('customers')
        .select('contract_start_date')
        .eq('id', invoice.customer_id)
        .maybeSingle()
      const startRaw = (cust as { contract_start_date: string | null } | null)?.contract_start_date
      if (!startRaw) return null
      const [sy, sm, sd] = startRaw.slice(0, 10).split('-').map(Number)
      if (!sy || !sm || !sd) return null
      const today = new Date()
      // Årsdagen närmast bakåt i tiden
      let anchor = new Date(today.getFullYear(), sm - 1, sd)
      if (anchor.getTime() > today.getTime()) anchor = new Date(today.getFullYear() - 1, sm - 1, sd)
      // Avtalsstart i framtiden → inget innevarande avtalsår att summera
      if (anchor.getTime() < new Date(sy, sm - 1, sd).getTime()) return null
      const nextAnchor = new Date(anchor.getFullYear() + 1, anchor.getMonth(), anchor.getDate())
      const { data, error } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('invoice_type', 'adhoc')
        .eq('customer_id', invoice.customer_id)
        .neq('status', 'cancelled')
        .gte('created_at', localDateKey(anchor))
        .lt('created_at', localDateKey(nextAnchor))
      if (error || !data) return null
      const rows = data as { id: string; total_amount: number | null }[]
      return {
        total: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
        count: rows.length,
      }
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
      const [termsDays, annualValue, customerRows, fortnox, upsellYear] = await Promise.all([
        PaymentTermsService.getDays(billingCategory(invoice)).catch(() => null),
        fetchAnnualValue().catch(() => null),
        fetchCustomerInvoices().catch(() => null),
        fetchFortnoxNumber(),
        fetchUpsellYear().catch(() => null),
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

      // Betalningsvillkoret gäller från sändningen till Fortnox — avvikelse
      // jämförs mot sent_at och bara efter sändning. Före sändning är
      // förfallodatumet preliminärt (räknas om vid sändningen).
      const termsDeviation =
        !PRE_SEND_STATUSES.includes(invoice.status) &&
        !!invoice.sent_at &&
        !!invoice.due_date &&
        termsDays != null &&
        Math.abs(daysBetween(invoice.due_date, invoice.sent_at) - termsDays) > TERMS_DEVIATION_TOLERANCE_DAYS

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
        upsellYearTotal: upsellYear?.total ?? null,
        upsellYearCount: upsellYear?.count ?? null,
      })
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, invoice?.status, invoice?.due_date, invoice?.sent_at])

  return pulse
}

// ============================================================================
// Prisavstämning mot kundens avtalsprislista (adhoc-fakturor)
//
// Negativ marginal på ett avtalat fast pris ska inte larma rött. Fakturans
// tjänsterader (case_billing_items, item_type 'service') jämförs mot kundens
// fasta tjänstepriser (avtalets prislista → kundens prislista, samma
// fallback-kedja som ärendeflödet via PriceListService.getServicePricesForCase).
// Prisguiden är ett FÖRSLAG, inte avtalat pris — den ingår inte i checken.
// ============================================================================

// Tolerans per rad: fakturerat radbelopp får avvika så här mycket från avtalat
const PRICE_LIST_TOLERANCE_KR = 1

export interface PriceCheckRow {
  id: string
  name: string
  /** Radens fakturerade totalbelopp (exkl. moms) */
  invoiceTotal: number
  /** Avtalat pris × antal */
  listTotal: number
  diff: number
}

export interface PriceListCheck {
  loading: boolean
  /** 'agreement' = ALLA tjänsterader har prislistepris och matchar (±1 kr/rad).
   *  'deviation' = minst en rad med prislistepris avviker.
   *  'none' = ingen rad har prislistepris / kund saknar prislista → dagens beteende. */
  mode: 'agreement' | 'deviation' | 'none'
  /** Summa |raddiff| för avvikande rader */
  diffTotal: number
  /** Vid avvikelse: de avvikande raderna. Vid enligt avtal: alla matchade rader. */
  rows: PriceCheckRow[]
}

const EMPTY_PRICE_CHECK: PriceListCheck = { loading: false, mode: 'none', diffTotal: 0, rows: [] }

export function usePriceListCheck(
  invoice: InvoiceWithItems | null,
  caseBillingItems: CaseBillingItem[]
): PriceListCheck {
  const [check, setCheck] = useState<PriceListCheck>(EMPTY_PRICE_CHECK)

  const serviceRows =
    invoice?.invoice_type === 'adhoc'
      ? caseBillingItems.filter(i => i.item_type === 'service')
      : []
  // Stabil nyckel så effekten bara körs om när tjänsteraderna faktiskt ändras
  const rowsKey = serviceRows
    .map(r => `${r.id}:${r.service_id}:${r.total_price}:${r.quantity}`)
    .join('|')

  useEffect(() => {
    if (!invoice || invoice.invoice_type !== 'adhoc' || !invoice.customer_id || serviceRows.length === 0) {
      setCheck(EMPTY_PRICE_CHECK)
      return
    }
    let cancelled = false
    const customerId = invoice.customer_id

    const load = async () => {
      setCheck({ ...EMPTY_PRICE_CHECK, loading: true })
      let prices: Record<string, number>
      try {
        prices = await PriceListService.getServicePricesForCase(customerId)
      } catch {
        if (!cancelled) setCheck(EMPTY_PRICE_CHECK)
        return
      }
      if (cancelled) return

      const withList = serviceRows.filter(r => r.service_id && prices[r.service_id] != null)
      if (withList.length === 0) {
        setCheck(EMPTY_PRICE_CHECK)
        return
      }

      const rows: PriceCheckRow[] = withList.map(r => {
        const listTotal = prices[r.service_id as string] * (Number(r.quantity) || 1)
        const invoiceTotal = Number(r.total_price || 0)
        return {
          id: r.id,
          name: r.service_name || r.article_name,
          invoiceTotal,
          listTotal,
          diff: invoiceTotal - listTotal,
        }
      })
      const deviating = rows.filter(r => Math.abs(r.diff) > PRICE_LIST_TOLERANCE_KR)

      if (deviating.length > 0) {
        setCheck({
          loading: false,
          mode: 'deviation',
          diffTotal: deviating.reduce((s, r) => s + Math.abs(r.diff), 0),
          rows: deviating,
        })
      } else if (withList.length === serviceRows.length) {
        // Alla tjänsterader har avtalat pris och matchar
        setCheck({ loading: false, mode: 'agreement', diffTotal: 0, rows })
      } else {
        // Delvis täckning utan avvikelse → inget läge, dagens beteende
        setCheck(EMPTY_PRICE_CHECK)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, invoice?.invoice_type, invoice?.customer_id, rowsKey])

  return check
}
