// src/components/admin/customers/record/useUpcomingInvoices.ts
//
// Kommande fakturor ur avtalskartans planerare, delade av Fakturering-fliken
// (listan "Kommande fakturor") och Översiktens tidslinje. Två lager:
//   upcoming  perioder som inte börjat, med eller utan utkast i databasen
//   beyond    första perioden i nästa förlängning per avtal (inte planerad än),
//             med sista uppsägningsdag och dagen utkastet skapas
// Samma periodmatematik som planeraren, aldrig egen räkning i vyerna.

import { useEffect, useMemo, useState } from 'react'
import { ContractInvoiceGenerator, type BillingPlanEntry } from '../../../../services/contractInvoiceGenerator'
import { nextRenewal, DEFAULT_INVOICE_LEAD_DAYS, type PlanningContract } from '../../../../shared/contractPlanner'
import { contractDisplayName, formatDateSv, formatKr, formatMonthSv, type RecordContract } from '../../../../hooks/useCustomerRecord'
import type { RecordTimelineEvent } from './ContractTimelineList'

export interface BeyondPeriod {
  contract: RecordContract
  periodStart: string
  periodEnd: string
  invoiceDate: string
  amount: number
  /** Sista dag att säga upp för att slippa perioden */
  noticeDeadline: string | null
  /** Dagen cronen skapar utkastet (dagen efter sista uppsägningsdag) */
  planDate: string
}

export interface UpcomingInvoices {
  /** null = räknar ännu */
  upcoming: BillingPlanEntry[] | null
  error: string | null
  beyond: BeyondPeriod[]
}

export function useUpcomingInvoices(rootId: string, contracts: RecordContract[], invoiceCount: number): UpcomingInvoices {
  const [upcoming, setUpcoming] = useState<BillingPlanEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contracts.length === 0) {
      setUpcoming([])
      return
    }
    let cancelled = false
    setUpcoming(null)
    setError(null)
    ;(async () => {
      try {
        const plans = await ContractInvoiceGenerator.planCombinedForCustomer(rootId)
        const merged = ContractInvoiceGenerator.mergePlans(rootId, plans)
        // Kommande = perioder som inte börjat: både utkast som redan finns
        // (keep/update) och sådana planeraren skulle skapa (create/later).
        const today = new Date().toISOString().slice(0, 10)
        const list = merged.entries
          .filter(
            (e) =>
              e.planned &&
              e.planned.periodStart >= today &&
              (e.action === 'create' || e.action === 'keep' || e.action === 'update' || e.action === 'later')
          )
          .sort((a, b) => (a.planned!.periodStart + (a.kind ?? 'premium')).localeCompare(b.planned!.periodStart + (b.kind ?? 'premium')))
        if (!cancelled) setUpcoming(list)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunde inte räkna fram kommande fakturor')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rootId, contracts.length, invoiceCount])

  const beyond = useMemo<BeyondPeriod[]>(() => {
    const known = new Set((upcoming ?? []).map((e) => `${e.contractId ?? ''}|${e.planned!.periodStart}`))
    const out: BeyondPeriod[] = []
    for (const c of contracts) {
      const pc = c as unknown as PlanningContract
      if (pc.terminated_at || pc.billing_active === false) continue
      // Nästa förlängning som inte är planerad än: den planeras dagen efter
      // sista uppsägningsdag (contractPlanner.nextRenewal, samma regel som cronen).
      const next = nextRenewal(pc, { leadDays: DEFAULT_INVOICE_LEAD_DAYS })
      if (!next || known.has(`${c.id}|${next.period.periodStart}`)) continue
      out.push({
        contract: c,
        periodStart: next.period.periodStart,
        periodEnd: next.period.periodEnd,
        invoiceDate: next.period.invoiceDate,
        amount: next.period.amount,
        noticeDeadline: next.noticeDeadline,
        planDate: next.planDate,
      })
    }
    return out.sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  }, [contracts, upcoming])

  return { upcoming, error, beyond }
}

/**
 * Tidslinjehändelser för kommande fakturor. Datumet är dagen fakturan skapas
 * (utkast) eller kommer att skapas, det är den dagen något händer hos oss.
 */
export function buildUpcomingInvoiceEvents(
  upcoming: BillingPlanEntry[] | null,
  beyond: BeyondPeriod[],
  contracts: RecordContract[]
): RecordTimelineEvent[] {
  const names = new Map(contracts.map((c) => [c.id, contractDisplayName(c)]))
  const events: RecordTimelineEvent[] = []
  for (const e of upcoming ?? []) {
    const p = e.planned
    if (!p) continue
    const exists = e.action !== 'create' && e.action !== 'later' && !!e.existingId
    const tag = e.consolidated ? 'Samlingsfaktura' : e.contractLabel ?? (e.contractId ? names.get(e.contractId) : undefined) ?? undefined
    events.push({
      date: p.invoiceDate,
      kind: 'invoice',
      title: `Faktura ${formatMonthSv(p.periodStart)}`,
      detail: exists
        ? `${formatKr(p.subtotal)} · utkast finns, skickas till Fortnox när det godkänts`
        : `${formatKr(p.subtotal)} · skapas ${formatDateSv(p.invoiceDate)}`,
      tag,
    })
  }
  for (const b of beyond) {
    events.push({
      date: b.invoiceDate,
      kind: 'invoice',
      title: `Faktura ${formatMonthSv(b.periodStart)}`,
      detail:
        `${formatKr(b.amount)} · utkastet skapas ${formatDateSv(b.planDate)} om avtalet inte sägs upp` +
        (b.noticeDeadline ? ` senast ${formatDateSv(b.noticeDeadline)}` : ''),
      tag: contractDisplayName(b.contract),
    })
  }
  return events
}
