// src/services/fortnoxPlanCheck.ts
// Fortnox-kontroll i fakturaplanen för perioder som redan har börjat.
//
// Planeraren jämför bara mot portalens egna fakturor. Ett utkast för en
// passerad period räknades därför som täckt och låg kvar som "Väntar" även när
// fakturan redan gått i Fortnox och betalats (avstämning 2026-10-15: St
// Johannes 495, Bockholmen 51, Vigelsboäng 213 m.fl.). Godkänns utkastet blir
// det en dubblett. Kontrollen körs EFTER grundplanen och blockerar den aldrig.
//
// Steg för steg:
//  1. Poster att kontrollera: premie eller tillägg per år, periodstart idag
//     eller tidigare men tidigast 2026-02-02 (Fortnox-historiken börjar då),
//     och antingen ett redigerbart utkast utan Fortnox-nummer (keep/update)
//     eller ingen faktura alls (uncovered/create).
//  2. Fortnox-kundnummer per kundrad (resolveFortnoxCustomerNumber), ett
//     anrop mot fakturalistan per kundnummer, cachat under modalens livstid.
//  3. Kandidat: ej makulerad, fakturadatum inom ±120 dagar från periodstart,
//     inte redan kopplad till någon faktura i portalen.
//  4. Exakt träff: Total inom ±1 kr från postens belopp inkl. moms, eller
//     uppskattat Net inom ±1 kr från beloppet exkl. moms.
//     Indexerad träff (bara om ingen exakt): Net 0 till 8 % över beloppet.
//  5. En träff ger link-fortnox / link-fortnox-indexed med valt nummer. Flera
//     träffar: användaren väljer, aldrig automatiskt. Ingen träff: utkastet
//     blir overdue-send (godkänn och skicka), övriga poster flaggas.

import { supabase } from '../lib/supabase'
import { FortnoxService, type FortnoxInvoice } from './fortnoxService'
import { resolveFortnoxCustomerNumber } from '../utils/fortnoxCustomerResolver'
import {
  summarize,
  type BillingPlan,
  type BillingPlanEntry,
  type FortnoxCandidate,
  type FortnoxCheckInfo,
} from './contractInvoiceGenerator'
import { parseLocalDate, toLocalIsoDate, todayLocal } from '../shared/contractPlanner'

/** Fortnox API har inget före detta datum (se fortnox-historik-start) */
export const FORTNOX_HISTORY_START = '2026-02-02'
const WINDOW_DAYS = 120
const INDEX_MAX_SHARE = 0.08
const AMOUNT_TOLERANCE = 1
const EDITABLE = new Set(['draft', 'pending_approval', 'ready'])
const CHECKED_KINDS = new Set(['premium', 'equipment'])
const DAY_MS = 24 * 60 * 60 * 1000

/** Fakturalistan per Fortnox-kundnummer, cachad under modalens livstid */
export type FortnoxInvoiceCache = Map<string, Promise<FortnoxInvoice[]>>

export interface FortnoxCheckResult {
  plan: BillingPlan
  /** Mjuk notis när Fortnox inte kunde nås (planen är då oförändrad för de posterna) */
  error: string | null
  /** Antal poster som kontrollerades */
  checked: number
  /** Poster som inte kunde kontrolleras för att kundraden saknar Fortnox-kundnummer */
  missingCustomerNumber: number
}

function isEligible(e: BillingPlanEntry, today: string): boolean {
  if (!e.planned || e.fortnox) return false
  if (!CHECKED_KINDS.has(e.kind ?? 'premium')) return false
  const start = e.planned.periodStart
  if (start > today || start < FORTNOX_HISTORY_START) return false
  if (e.action === 'uncovered' || e.action === 'create') return !e.existingId
  if (e.action === 'keep' || e.action === 'update') {
    return !!e.existingId && EDITABLE.has(e.existingStatus ?? 'draft') && !e.existingFortnoxNumber
  }
  return false
}

/** Finns det något i planen som Fortnox-kontrollen ska titta på? */
export function hasFortnoxCheckCandidates(plan: BillingPlan | null): boolean {
  if (!plan) return false
  const today = toLocalIsoDate(todayLocal())
  return plan.entries.some((e) => isEligible(e, today))
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function dayDistance(a: string, b: string): number {
  return Math.abs(parseLocalDate(a).getTime() - parseLocalDate(b).getTime()) / DAY_MS
}

function entryCustomerId(plan: BillingPlan, e: BillingPlanEntry): string {
  return e.consolidated ? plan.customerId : (e.customerId ?? plan.customerId)
}

/** Fortnox-nummer som redan sitter på en faktura i portalen (kan inte täcka en till period) */
async function loadUsedFortnoxNumbers(customerIds: string[]): Promise<Set<string>> {
  const used = new Set<string>()
  if (customerIds.length === 0) return used
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number, fortnox_document_number')
    .in('customer_id', customerIds)
    .or('fortnox_document_number.not.is.null,invoice_number.like.F-%')
  for (const row of (data ?? []) as Array<{ invoice_number: string | null; fortnox_document_number: string | null }>) {
    if (row.fortnox_document_number) used.add(String(row.fortnox_document_number))
    const m = /^F-(\d+)$/i.exec(row.invoice_number ?? '')
    if (m) used.add(m[1])
  }
  return used
}

type Scored = FortnoxCandidate & { distance: number }

function scoreCandidates(e: BillingPlanEntry, invoices: FortnoxInvoice[], used: Set<string>): Scored[] {
  const p = e.planned!
  const vatShare = p.subtotal > 0 ? p.vatAmount / p.subtotal : 0.25
  const subs = [p.subtotal, e.existingSubtotal].filter((v): v is number => typeof v === 'number' && v > 0)
  const totals = [p.totalAmount, e.existingAmount].filter((v): v is number => typeof v === 'number' && v > 0)
  const out: Scored[] = []
  for (const inv of invoices) {
    if (inv.Cancelled) continue
    const nr = String(inv.DocumentNumber)
    if (used.has(nr) || !inv.InvoiceDate) continue
    const distance = dayDistance(inv.InvoiceDate, p.periodStart)
    if (distance > WINDOW_DAYS) continue
    const total = Math.round(num(inv.Total) * 100) / 100
    const net = Math.round((total / (1 + vatShare)) * 100) / 100
    const exact =
      totals.some((t) => Math.abs(total - t) <= AMOUNT_TOLERANCE) || subs.some((s) => Math.abs(net - s) <= AMOUNT_TOLERANCE)
    const indexed = !exact && subs.some((s) => net >= s && net <= s * (1 + INDEX_MAX_SHARE))
    if (!exact && !indexed) continue
    out.push({
      documentNumber: nr,
      invoiceDate: inv.InvoiceDate,
      dueDate: inv.DueDate || null,
      finalPayDate: inv.FinalPayDate || null,
      total,
      net,
      balance: Math.round(num(inv.Balance) * 100) / 100,
      sent: !!inv.Sent,
      booked: !!inv.Booked,
      match: exact ? 'exact' : 'indexed',
      distance,
    })
  }
  return out.sort((a, b) => a.distance - b.distance)
}

function withCheck(e: BillingPlanEntry, info: FortnoxCheckInfo): BillingPlanEntry {
  if (info.status === 'missing') {
    return { ...e, action: info.originalAction === 'keep' ? 'overdue-send' : info.originalAction, fortnox: info }
  }
  const lead = info.chosen ? info.candidates.find((c) => c.documentNumber === info.chosen) : info.candidates[0]
  return { ...e, action: lead?.match === 'indexed' ? 'link-fortnox-indexed' : 'link-fortnox', fortnox: info }
}

/**
 * Kontrollera planens passerade perioder mot Fortnox. Returnerar en ny plan
 * (originalet rörs inte). Fel mot Fortnox ger en mjuk notis och lämnar de
 * berörda posterna som de var.
 */
export async function checkPlanAgainstFortnox(plan: BillingPlan, cache: FortnoxInvoiceCache): Promise<FortnoxCheckResult> {
  const today = toLocalIsoDate(todayLocal())
  const targets = plan.entries.map((e, i) => ({ e, i })).filter(({ e }) => isEligible(e, today))
  if (targets.length === 0) return { plan, error: null, checked: 0, missingCustomerNumber: 0 }

  // Kundnummer per kundrad (enhetsavtal kan ha egen Fortnox-kund)
  const customerIds = [...new Set(targets.map(({ e }) => entryCustomerId(plan, e)))]
  const numberByCustomer = new Map<string, string | null>()
  for (const id of customerIds) {
    const n = await resolveFortnoxCustomerNumber(id).catch(() => null)
    numberByCustomer.set(id, n != null ? String(n) : null)
  }

  // Ett anrop per kundnummer
  let error: string | null = null
  const invoicesByNumber = new Map<string, FortnoxInvoice[]>()
  for (const nr of new Set([...numberByCustomer.values()].filter((v): v is string => !!v))) {
    let pending = cache.get(nr)
    if (!pending) {
      pending = FortnoxService.getInvoices(nr, { fromDate: '2026-01-01', limit: 500 })
      cache.set(nr, pending)
    }
    try {
      invoicesByNumber.set(nr, await pending)
    } catch (err) {
      cache.delete(nr)
      console.warn('Fortnox-kontrollen kunde inte hämta fakturor för kund', nr, err)
      error = 'Fortnox kunde inte nås, kopplingar inte kontrollerade'
    }
  }

  const used = await loadUsedFortnoxNumbers(customerIds)

  // Kandidater per post
  const scored = new Map<number, Scored[]>()
  let missingCustomerNumber = 0
  for (const { e, i } of targets) {
    const nr = numberByCustomer.get(entryCustomerId(plan, e))
    if (!nr) {
      missingCustomerNumber++
      continue
    }
    const invoices = invoicesByNumber.get(nr)
    if (!invoices) continue // Fortnox-fel: posten lämnas orörd
    scored.set(i, scoreCandidates(e, invoices, used))
  }

  // En Fortnox-faktura kan bara vara EN periods faktura: den stannar hos
  // posten som ligger närmast i datum (kvartalsfakturor har överlappande fönster).
  const owner = new Map<string, { i: number; distance: number }>()
  for (const [i, list] of scored) {
    for (const c of list) {
      const cur = owner.get(c.documentNumber)
      if (!cur || c.distance < cur.distance) owner.set(c.documentNumber, { i, distance: c.distance })
    }
  }

  const entries = plan.entries.slice()
  for (const [i, list] of scored) {
    const mine = list.filter((c) => owner.get(c.documentNumber)?.i === i)
    const exact = mine.filter((c) => c.match === 'exact')
    const pool = exact.length > 0 ? exact : mine.filter((c) => c.match === 'indexed')
    const e = entries[i]
    const base = e.existingSubtotal ?? e.planned!.subtotal
    const candidates: FortnoxCandidate[] = pool.map((c) => {
      const { distance, ...rest } = c
      void distance
      return rest
    })
    const info: FortnoxCheckInfo = {
      status: candidates.length === 0 ? 'missing' : candidates.length === 1 ? 'match' : 'choose',
      candidates,
      chosen: candidates.length === 1 ? candidates[0].documentNumber : null,
      originalAction: e.action,
      baseSubtotal: base,
    }
    entries[i] = withCheck(e, info)
  }

  return {
    plan: { ...plan, entries, summary: summarize(entries) },
    error,
    checked: scored.size,
    missingCustomerNumber,
  }
}

/**
 * Användarens val vid flera träffar (eller "ingen av dem", nr = null).
 * Returnerar en ny plan.
 */
export function chooseFortnoxCandidate(plan: BillingPlan, entryIndex: number, documentNumber: string | null): BillingPlan {
  const e = plan.entries[entryIndex]
  if (!e?.fortnox) return plan
  const info: FortnoxCheckInfo =
    documentNumber == null
      ? { ...e.fortnox, status: 'missing', chosen: null }
      : { ...e.fortnox, status: e.fortnox.candidates.length > 1 ? 'choose' : 'match', chosen: documentNumber }
  const entries = plan.entries.slice()
  entries[entryIndex] = withCheck(e, info)
  return { ...plan, entries, summary: summarize(entries) }
}

/** Status som kopplingen ger i portalen, samma regel som importen */
export function candidateStatusLabel(c: FortnoxCandidate): string {
  const paid = c.balance === 0 && (c.booked || c.sent)
  if (paid) return `betald${c.finalPayDate ? ` ${c.finalPayDate}` : ''}`
  if (c.sent) return `skickad ${c.invoiceDate}, obetald`
  if (c.booked) return `bokförd ${c.invoiceDate}`
  return `fakturerad ${c.invoiceDate}`
}
