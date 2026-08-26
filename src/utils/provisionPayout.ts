// src/utils/provisionPayout.ts — Delad payout-månadslogik för Provisioner 2.0
//
// SANNINGEN för utbetalningsmånad är DB-kolumnen commission_posts.payout_month,
// satt av DB-funktionen compute_payout_month() (trigger vid betald faktura).
// Den ENDA klientberäkningen här är den PRELIMINÄRA månaden för obetalda poster
// ("om fakturan betalades idag") — samma brytdagsregel som DB-funktionen:
//   betald dag 1..brytdag  -> nästa månads lön
//   betald efter brytdagen -> månaden därpå
// Både adminvyn och teknikervyn grupperar via groupPostsByPayoutMonth så att
// tekniker och lön per konstruktion ser samma summa för samma månad.

import type { CommissionPost, CommissionStatus } from '../types/provision'

export const DEFAULT_PAYOUT_CUTOFF_DAY = 20

const SWEDISH_MONTHS_LOWER = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Speglar DB:s compute_payout_month — används ENDAST för preliminär månad på obetalda poster. */
export function computePreliminaryPayoutMonth(referenceDate: Date, cutoffDay: number): string {
  const addMonths = referenceDate.getDate() <= cutoffDay ? 1 : 2
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + addMonths, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** Payout-månad för en post: DB-värdet om det finns, annars preliminärt (som om fakturan betalades idag). */
export function getPostPayoutMonth(
  post: Pick<CommissionPost, 'payout_month'>,
  cutoffDay: number,
  now: Date = new Date()
): { month: string; preliminary: boolean } {
  if (post.payout_month) return { month: post.payout_month, preliminary: false }
  return { month: computePreliminaryPayoutMonth(now, cutoffDay), preliminary: true }
}

/** 'YYYY-MM' -> 'september 2026' (gemener, som i portalens månadsgrupper). */
export function formatPayoutMonthLower(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const name = SWEDISH_MONTHS_LOWER[(month || 1) - 1] || monthKey
  return `${name} ${year}`
}

/** 'YYYY-MM' -> 'septemberlönen' (klartext i statusrader). */
export function payoutSalaryLabel(monthKey: string): string {
  const month = Number(monthKey.split('-')[1])
  const name = SWEDISH_MONTHS_LOWER[(month || 1) - 1] || monthKey
  return `${name}lönen`
}

/** 'YYYY-MM' -> 'sep' (kort etikett för knappar). */
export function shortMonthLabel(monthKey: string): string {
  const month = Number(monthKey.split('-')[1])
  const name = SWEDISH_MONTHS_LOWER[(month || 1) - 1] || monthKey
  return name.slice(0, 3)
}

/** Hela dygn sedan ett datum (för åldershint på obetalda fakturor). */
export function daysSince(dateStr: string, now: Date = new Date()): number {
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000))
}

/** Gräns (dagar) då en obetald kundfaktura får amber åldersvarning. */
export const UNPAID_AGE_WARNING_DAYS = 30

export interface PayoutStatusBreakdown {
  pending: number
  ready: number
  approved: number
  paid: number
}

export interface PayoutMonthGroup {
  month_key: string
  month_label: string
  /** true när gruppen ENBART innehåller obetalda poster med preliminär månad */
  preliminary: boolean
  posts: CommissionPost[]
  total_commission: number
  post_count: number
  statuses: PayoutStatusBreakdown
  status_totals: PayoutStatusBreakdown
  /** senaste paid_out_at i gruppen (om alla poster är utbetalda) */
  paid_out_date: string | null
}

export function countStatus(statuses: PayoutStatusBreakdown, status: CommissionStatus, amount = 1): void {
  if (status === 'pending_invoice') statuses.pending += amount
  else if (status === 'ready_for_payout') statuses.ready += amount
  else if (status === 'approved') statuses.approved += amount
  else if (status === 'paid_out') statuses.paid += amount
}

/**
 * Grupperar poster på payout-månad (DB-värdet; obetalda preliminärt) —
 * DELAS av admin- och teknikervyn. Sorteras senaste månad först.
 */
export function groupPostsByPayoutMonth(
  posts: CommissionPost[],
  cutoffDay: number,
  now: Date = new Date()
): PayoutMonthGroup[] {
  const byMonth = new Map<string, { posts: CommissionPost[]; preliminaryOnly: boolean }>()

  for (const post of posts) {
    const { month, preliminary } = getPostPayoutMonth(post, cutoffDay, now)
    let entry = byMonth.get(month)
    if (!entry) {
      entry = { posts: [], preliminaryOnly: true }
      byMonth.set(month, entry)
    }
    entry.posts.push(post)
    if (!preliminary) entry.preliminaryOnly = false
  }

  const groups: PayoutMonthGroup[] = []
  for (const [monthKey, entry] of byMonth) {
    const statuses: PayoutStatusBreakdown = { pending: 0, ready: 0, approved: 0, paid: 0 }
    const statusTotals: PayoutStatusBreakdown = { pending: 0, ready: 0, approved: 0, paid: 0 }
    let total = 0
    let latestPaidOut: string | null = null
    let allPaid = entry.posts.length > 0

    for (const p of entry.posts) {
      total += p.commission_amount
      countStatus(statuses, p.status)
      countStatus(statusTotals, p.status, p.commission_amount)
      if (p.status === 'paid_out') {
        if (p.paid_out_at && (!latestPaidOut || p.paid_out_at > latestPaidOut)) {
          latestPaidOut = p.paid_out_at
        }
      } else {
        allPaid = false
      }
    }

    groups.push({
      month_key: monthKey,
      month_label: formatPayoutMonthLower(monthKey),
      preliminary: entry.preliminaryOnly,
      posts: entry.posts,
      total_commission: total,
      post_count: entry.posts.length,
      statuses,
      status_totals: statusTotals,
      paid_out_date: allPaid ? latestPaidOut : null
    })
  }

  groups.sort((a, b) => b.month_key.localeCompare(a.month_key))
  return groups
}

/** Summa provision per skapandemånad, de senaste `months` månaderna (för sparklines). */
export function monthlyEarnedSeries(
  posts: Array<Pick<CommissionPost, 'created_at' | 'commission_amount'>>,
  months: number,
  now: Date = new Date()
): number[] {
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  const sums = new Map<string, number>(keys.map(k => [k, 0]))
  for (const p of posts) {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    if (sums.has(key)) sums.set(key, (sums.get(key) || 0) + p.commission_amount)
  }
  return keys.map(k => sums.get(k) || 0)
}
