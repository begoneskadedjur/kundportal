// src/utils/customerRevenue.ts
//
// EN definition av vad kundens intäkt är. Delas av Intäkter, Fakturering och
// Ärenden så att samma kund aldrig visar olika siffror på olika flikar.
//
// REGELN: intäkt är UTFÖRT arbete. Offerter, bokningar och borttagna ärenden
// räknas aldrig, oavsett vilket pris som står på dem.
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

export function isCaseCompleted(c: Pick<RecordCase, 'status' | 'completed_date'>): boolean {
  if (c.completed_date) return true
  return DONE_STATUSES.includes((c.status ?? '').toLowerCase())
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
 * Systemomfattande ligger 634 tkr i det läget, inklusive borttagna ärenden.
 */
export function sumPipeline(cases: RecordCase[]): { amount: number; count: number } {
  let amount = 0
  let count = 0
  for (const c of cases) {
    const p = Number(c.price ?? 0)
    if (p <= 0) continue
    if (isCaseCompleted(c)) continue
    if ((c.status ?? '').toLowerCase() === 'borttaget') continue
    amount += p
    count += 1
  }
  return { amount, count }
}
