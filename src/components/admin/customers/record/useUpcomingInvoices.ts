// src/components/admin/customers/record/useUpcomingInvoices.ts
//
// Kommande fakturor ur avtalskartans planerare, delade av Fakturering-fliken
// (listan "Kommande fakturor") och Översiktens tidslinje. Två lager:
//   upcoming  perioder som inte börjat, med eller utan utkast i databasen
//   beyond    första perioden efter planerarens horisont per avtal, så att det
//             syns att avtalet rullar vidare och när nästa faktura skapas
// Samma periodmatematik som planeraren, aldrig egen räkning i vyerna.

import { useEffect, useMemo, useState } from 'react'
import { ContractInvoiceGenerator, type BillingPlanEntry } from '../../../../services/contractInvoiceGenerator'
import {
  computePlannedPeriods,
  parseLocalDate,
  toLocalIsoDate,
  DEFAULT_INVOICE_LEAD_DAYS,
  type PlanningContract,
} from '../../../../shared/contractPlanner'
import { contractDisplayName, formatDateSv, formatKr, formatMonthSv, type RecordContract } from '../../../../hooks/useCustomerRecord'
import type { RecordTimelineEvent } from './ContractTimelineList'

export interface BeyondPeriod {
  contract: RecordContract
  periodStart: string
  periodEnd: string
  invoiceDate: string
  amount: number
  noticeDeadline: string | null
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
    const today = new Date().toISOString().slice(0, 10)
    const known = new Set((upcoming ?? []).map((e) => `${e.contractId ?? ''}|${e.planned!.periodStart}`))
    const lastKnown = (upcoming ?? []).reduce((m, e) => (e.planned!.periodStart > m ? e.planned!.periodStart : m), today)
    const d = new Date()
    const horizon = toLocalIsoDate(new Date(d.getFullYear() + 2, d.getMonth(), d.getDate()))
    const out: BeyondPeriod[] = []
    for (const c of contracts) {
      const pc = c as unknown as PlanningContract
      if (pc.terminated_at || pc.billing_active === false) continue
      const periods = computePlannedPeriods(pc, { horizonEnd: horizon, leadDays: DEFAULT_INVOICE_LEAD_DAYS })
      const next = periods.find((p) => p.periodStart > lastKnown && !known.has(`${c.id}|${p.periodStart}`))
      if (!next) continue
      const notice = pc.notice_period_months
      let noticeDeadline: string | null = null
      if (notice && notice > 0) {
        const ps = parseLocalDate(next.periodStart)
        noticeDeadline = toLocalIsoDate(new Date(ps.getFullYear(), ps.getMonth() - notice, ps.getDate() - 1))
      }
      out.push({ contract: c, periodStart: next.periodStart, periodEnd: next.periodEnd, invoiceDate: next.invoiceDate, amount: next.amount, noticeDeadline })
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
        `${formatKr(b.amount)} · skapas ${formatDateSv(b.invoiceDate)} om avtalet rullar vidare` +
        (b.noticeDeadline ? `, uppsägning senast ${formatDateSv(b.noticeDeadline)}` : ''),
      tag: contractDisplayName(b.contract),
    })
  }
  return events
}
