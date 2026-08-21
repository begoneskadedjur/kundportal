// src/utils/customerRevenue.ts
//
// EN definition av vad kundens intäkt är. Delas av Intäkter, Fakturering och
// Ärenden så att samma kund aldrig visar olika siffror på olika flikar.
//
// REGELN: intäkt är UTFÖRT arbete.
//
// Men statusen är bara tillförlitlig för ärenden skapade i portalen.
// Företagsärendena slutade uppdateras när ClickUp avvecklades — inget är
// skapat efter april 2026, och ett ärende från 2024 som står "Bokad" är i
// verkligheten gjort och betalt. Därför räknas alla företagsärenden före
// juni 2026 som utförda, oavsett vad statusfältet säger.
//
// Borttagna ärenden är aldrig intäkt, oavsett ålder.
//
// Tre källor som aldrig överlappar (verifierat: noll av 290 avslutade
// företagsärenden har en faktura i portalen):
//
//   1. Fakturor skapade i portalen        — framtiden, allt från och med nu
//   2. Fakturor importerade från Fortnox  — historik, is_historical = true
//   3. Avslutade företagsärenden          — ClickUp-eran, slutar april 2026
//
// Källa 3 är historik som aldrig fakturerats i portalen. Arbetet ÄR utfört —
// finns ärendet i systemet på en av våra kunder så har vi gjort jobbet — så
// beloppet är verklig intäkt. Det redovisas som MERFÖRSÄLJNING, samma slag som
// ett extrabesök hos en avtalskund, inte som en egen kategori.

import type { RecordCase, RecordInvoice } from '../hooks/useCustomerRecord'

/** Ärendestatusar som betyder att arbetet är utfört. */
const DONE_STATUSES = ['avslutat', 'stängt', 'stangt']

/** Aldrig intäkt, oavsett ålder. */
const CANCELLED_STATUSES = ['borttaget', 'makulerat']

/**
 * Efter detta datum speglar företagsärendens status verkligheten igen.
 * Sätts efter sista skapade business_case (2026-04-20) med marginal.
 */
const CLICKUP_CUTOFF = '2026-06-01'

export function isCaseCompleted(
  c: Pick<RecordCase, 'status' | 'completed_date' | 'origin' | 'created_at'>
): boolean {
  if (CANCELLED_STATUSES.includes((c.status ?? '').toLowerCase())) return false
  if (c.completed_date) return true
  if (DONE_STATUSES.includes((c.status ?? '').toLowerCase())) return true

  // ClickUp-eran: företagsärenden slutade uppdateras när ClickUp avvecklades.
  // Ett ärende från 2024 som står "Bokad" är inte bokat — det är utfört och
  // betalt, statusen slutade bara följa med. Inget företagsärende har skapats
  // efter april 2026, så allt äldre är avslutat i verkligheten.
  if (c.origin === 'business' && c.created_at < CLICKUP_CUTOFF) return true

  return false
}

export type RevenueKind = 'contract' | 'extra'

export interface RevenueEntry {
  id: string
  kind: RevenueKind
  /** Belopp ex moms */
  amount: number
  /** Datum intäkten hör till */
  date: string
  label: string
  /** Kundraden intäkten hör till — styr fördelning per enhet på multisite */
  customerId: string
  /** true = importerad historik (Fortnox eller ClickUp-eran) */
  historical: boolean
  /** Varifrån posten kommer, för visning */
  source: 'invoice' | 'case'
  /** Fakturanummer när det finns */
  reference: string | null
}

/** Årspremie eller arbete utanför avtalet. */
function invoiceKind(inv: RecordInvoice): RevenueKind {
  return (inv.invoice_type ?? '') === 'contract' ? 'contract' : 'extra'
}

/**
 * Bygger kundens intäktsposter ur båda världarna.
 *
 * Ärenden tas bara med när de är UTFÖRDA och saknar egen faktura — annars
 * skulle samma arbete räknas två gånger den dagen ärendeflödet börjar skapa
 * fakturor.
 */
export function buildRevenueEntries(
  invoices: RecordInvoice[],
  cases: RecordCase[],
  fallbackCustomerId: string
): RevenueEntry[] {
  const entries: RevenueEntry[] = []
  const invoicedCaseIds = new Set(
    invoices.filter((i) => i.case_id && (i.status ?? '') !== 'cancelled').map((i) => i.case_id)
  )

  for (const inv of invoices) {
    if ((inv.status ?? '') === 'cancelled') continue
    entries.push({
      id: inv.id,
      kind: invoiceKind(inv),
      amount: Number(inv.subtotal ?? 0),
      date: inv.billing_period_start ?? inv.created_at,
      label: inv.invoice_number ?? 'Faktura',
      customerId: inv.customer_id,
      historical: !!inv.is_historical,
      source: 'invoice',
      reference: inv.invoice_number,
    })
  }

  for (const c of cases) {
    const amount = Number(c.price ?? 0)
    if (amount <= 0) continue
    // Bara utfört arbete. En signerad offert är sålt, inte levererat.
    if (!isCaseCompleted(c)) continue
    // Har ärendet blivit en faktura är fakturan sanningen
    if (invoicedCaseIds.has(c.id)) continue
    entries.push({
      id: c.id,
      kind: 'extra',
      amount,
      date: c.completed_date ?? c.scheduled_start ?? c.created_at,
      label: c.case_number ?? c.title,
      customerId: c.customer_id ?? fallbackCustomerId,
      // ClickUp-eran: utfört och betalt, men aldrig fakturerat i portalen
      historical: true,
      source: 'case',
      reference: c.case_number,
    })
  }

  return entries.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

export interface RevenueTotals {
  total: number
  contract: number
  extra: number
  historical: number
  count: number
}

export function sumRevenue(entries: RevenueEntry[]): RevenueTotals {
  let contract = 0
  let extra = 0
  let historical = 0
  for (const e of entries) {
    if (e.kind === 'contract') contract += e.amount
    else extra += e.amount
    if (e.historical) historical += e.amount
  }
  return { total: contract + extra, contract, extra, historical, count: entries.length }
}

/**
 * Ärenden som är sålda men INTE utförda — pipeline, aldrig intäkt.
 *
 * Gäller i praktiken bara ärenden som skapats i portalen: företagsärenden
 * från ClickUp-eran räknas som utförda oavsett status (se isCaseCompleted).
 */
export function sumPipeline(cases: RecordCase[]): { amount: number; count: number } {
  let amount = 0
  let count = 0
  for (const c of cases) {
    const p = Number(c.price ?? 0)
    if (p <= 0) continue
    if (isCaseCompleted(c)) continue
    if (CANCELLED_STATUSES.includes((c.status ?? '').toLowerCase())) continue
    amount += p
    count += 1
  }
  return { amount, count }
}
