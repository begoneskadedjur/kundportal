// src/hooks/useProvisionDashboard.ts — Provisioner 2.0
//
// Utbetalningsmånaden ÄGS AV DATABASEN (commission_posts.payout_month).
// Hooken räknar ALDRIG ut månaden själv: grupperingen görs av den delade
// groupPostsByPayoutMonth i utils/provisionPayout, exakt samma funktion som
// teknikervyn använder — så att lön och tekniker per konstruktion ser samma
// summa för samma månad.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ProvisionService } from '../services/provisionService'
import type {
  CommissionPost,
  CommissionSettings,
  CommissionStatus,
  ProvisionKpi,
  ProvisionTechnicianSummary,
  ProvisionFilters,
  MonthSelection
} from '../types/provision'
import { getCurrentMonth, getMonthOptions } from '../types/provision'
import {
  DEFAULT_PAYOUT_CUTOFF_DAY,
  UNPAID_AGE_WARNING_DAYS,
  groupPostsByPayoutMonth,
  monthlyEarnedSeries,
  daysSince,
  type PayoutMonthGroup
} from '../utils/provisionPayout'

/** En tekniker inom en payout-månadsgrupp (adminvyns teknikerrader). */
export interface PayoutMonthTechnician {
  technician_id: string
  technician_name: string
  posts: CommissionPost[]
  post_count: number
  total_commission: number
  statuses: { pending: number; ready: number; approved: number; paid: number }
  /** 6 månaders intjänandeserie för teknikerns sparkline */
  spark: number[]
}

/** Månadsgrupp med teknikeruppdelning + andel utbetalt (procentringen). */
export interface PayoutMonthView extends PayoutMonthGroup {
  technicians: PayoutMonthTechnician[]
  technician_count: number
  /** utbetald andel av gruppens totala provision, 0..1 */
  paid_ratio: number
}

/** Arbetskön: de fem cellerna högst upp på adminsidan. */
export interface ProvisionWorkQueue {
  pending: { count: number; total: number; oldestDays: number; warn: boolean }
  ready: { count: number; total: number }
  approved: { count: number; total: number }
  paidThisYear: { count: number; total: number }
  earnedThisYear: { count: number; total: number }
}

const emptyKpis = (): ProvisionKpi => ({
  pending_invoice_total: 0, pending_invoice_count: 0,
  ready_for_payout_total: 0, ready_for_payout_count: 0,
  approved_total: 0, approved_count: 0,
  paid_out_total: 0, paid_out_count: 0
})

export function useProvisionDashboard() {
  const [selectedMonth, setSelectedMonth] = useState<MonthSelection>(getCurrentMonth())
  const [filters, setFilters] = useState<ProvisionFilters>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [kpis, setKpis] = useState<ProvisionKpi>(emptyKpis())
  const [summaries, setSummaries] = useState<ProvisionTechnicianSummary[]>([])
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [yearPosts, setYearPosts] = useState<CommissionPost[]>([])
  const [trendPosts, setTrendPosts] = useState<CommissionPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [availableTechnicians, setAvailableTechnicians] = useState<Array<{ id: string; name: string }>>([])

  const monthOptions = getMonthOptions(12)
  const cutoffDay = settings?.payout_cutoff_day ?? DEFAULT_PAYOUT_CUTOFF_DAY

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const year = new Date().getFullYear()
      const [kpiData, summaryData, settingsData, techsData, yearData, trendData] = await Promise.all([
        ProvisionService.getKpis(selectedMonth.value),
        ProvisionService.getTechnicianSummaries(selectedMonth.value, filters),
        ProvisionService.getSettings(),
        ProvisionService.getAvailableTechnicians(),
        ProvisionService.getAllPostsForYear(year),
        ProvisionService.getPostsForRecentMonths(6)
      ])
      setKpis(kpiData)
      setSummaries(summaryData)
      setSettings(settingsData)
      setAvailableTechnicians(techsData)
      setYearPosts(yearData)
      setTrendPosts(trendData)
    } catch (err) {
      console.error('Kunde inte ladda provisionsdata:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth.value, filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Navigation ────────────────────────────────────────────

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const currentIdx = monthOptions.findIndex(m => m.value === selectedMonth.value)
    if (direction === 'prev' && currentIdx < monthOptions.length - 1) {
      setSelectedMonth(monthOptions[currentIdx + 1])
      setSelectedIds(new Set())
    } else if (direction === 'next' && currentIdx > 0) {
      setSelectedMonth(monthOptions[currentIdx - 1])
      setSelectedIds(new Set())
    }
  }, [selectedMonth, monthOptions])

  const goToMonth = useCallback((month: MonthSelection) => {
    setSelectedMonth(month)
    setSelectedIds(new Set())
  }, [])

  const canNavigatePrev = monthOptions.findIndex(m => m.value === selectedMonth.value) < monthOptions.length - 1
  const canNavigateNext = monthOptions.findIndex(m => m.value === selectedMonth.value) > 0

  // ─── Poster i vald payout-månad (+ sökfilter) ──────────────

  const allPosts: CommissionPost[] = useMemo(() => {
    const posts = summaries.flatMap(s => s.posts)
    if (!searchQuery.trim()) return posts
    const q = searchQuery.toLowerCase()
    return posts.filter(p =>
      (p.case_number?.toLowerCase().includes(q)) ||
      (p.case_title?.toLowerCase().includes(q)) ||
      p.technician_name.toLowerCase().includes(q)
    )
  }, [summaries, searchQuery])

  // ─── Månadsgrupper på payout_month (DELAD logik) ───────────

  const payoutMonths: PayoutMonthView[] = useMemo(() => {
    const groups = groupPostsByPayoutMonth(allPosts, cutoffDay)

    // 6-månaderstrend per tekniker, från det rullande fönstret
    const trendByTech = new Map<string, CommissionPost[]>()
    for (const p of trendPosts) {
      const list = trendByTech.get(p.technician_id)
      if (list) list.push(p)
      else trendByTech.set(p.technician_id, [p])
    }

    return groups.map(group => {
      const byTech = new Map<string, PayoutMonthTechnician>()

      for (const post of group.posts) {
        let entry = byTech.get(post.technician_id)
        if (!entry) {
          entry = {
            technician_id: post.technician_id,
            technician_name: post.technician_name,
            posts: [],
            post_count: 0,
            total_commission: 0,
            statuses: { pending: 0, ready: 0, approved: 0, paid: 0 },
            spark: monthlyEarnedSeries(trendByTech.get(post.technician_id) || [], 6)
          }
          byTech.set(post.technician_id, entry)
        }
        entry.posts.push(post)
        entry.post_count++
        entry.total_commission += post.commission_amount
        if (post.status === 'pending_invoice') entry.statuses.pending++
        else if (post.status === 'ready_for_payout') entry.statuses.ready++
        else if (post.status === 'approved') entry.statuses.approved++
        else if (post.status === 'paid_out') entry.statuses.paid++
      }

      const technicians = Array.from(byTech.values())
        .sort((a, b) => a.technician_name.localeCompare(b.technician_name, 'sv'))

      return {
        ...group,
        technicians,
        technician_count: technicians.length,
        paid_ratio: group.total_commission > 0
          ? group.status_totals.paid / group.total_commission
          : 0
      }
    })
  }, [allPosts, cutoffDay, trendPosts])

  // ─── Arbetskön (fem celler) ────────────────────────────────

  const workQueue: ProvisionWorkQueue = useMemo(() => {
    const now = new Date()
    const queue: ProvisionWorkQueue = {
      pending: { count: 0, total: 0, oldestDays: 0, warn: false },
      ready: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paidThisYear: { count: 0, total: 0 },
      earnedThisYear: { count: 0, total: 0 }
    }
    const year = now.getFullYear()

    for (const post of yearPosts) {
      const createdYear = new Date(post.created_at).getFullYear()

      if (createdYear === year) {
        queue.earnedThisYear.count++
        queue.earnedThisYear.total += post.commission_amount
      }

      switch (post.status) {
        case 'pending_invoice': {
          queue.pending.count++
          queue.pending.total += post.commission_amount
          const age = daysSince(post.created_at, now)
          if (age > queue.pending.oldestDays) queue.pending.oldestDays = age
          break
        }
        case 'ready_for_payout':
          queue.ready.count++
          queue.ready.total += post.commission_amount
          break
        case 'approved':
          queue.approved.count++
          queue.approved.total += post.commission_amount
          break
        case 'paid_out':
          if (post.payout_month?.startsWith(String(year)) || createdYear === year) {
            queue.paidThisYear.count++
            queue.paidThisYear.total += post.commission_amount
          }
          break
      }
    }

    queue.pending.warn = queue.pending.oldestDays > UNPAID_AGE_WARNING_DAYS
    return queue
  }, [yearPosts])

  // ─── Flödesband i sidhuvudet ───────────────────────────────

  const flowSegments = useMemo(() => ([
    { label: 'Väntar', value: workQueue.pending.total, tone: 'slate' as const },
    { label: 'Redo', value: workQueue.ready.total, tone: 'brand' as const },
    { label: 'Godkänt', value: workQueue.approved.total, tone: 'amber' as const },
    { label: 'Utbetalt i år', value: workQueue.paidThisYear.total, tone: 'dim' as const }
  ]), [workQueue])

  // ─── Selection ─────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    const allIds = summaries.flatMap(s => s.posts.map(p => p.id))
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(allIds))
  }, [summaries, selectedIds])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // ─── Statusfilter via arbetskön ────────────────────────────

  const setStatusFilter = useCallback((status: CommissionStatus | null) => {
    setFilters(prev => ({ ...prev, status: status ?? undefined }))
    setSelectedIds(new Set())
  }, [])

  // ─── Åtgärder ──────────────────────────────────────────────

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setActionLoading(true)
    try {
      await fn()
      setSelectedIds(new Set())
      await loadData()
    } finally {
      setActionLoading(false)
    }
  }, [loadData])

  const approveSelected = useCallback(async (approvedBy: string) => {
    if (selectedIds.size === 0) return
    await runAction(() => ProvisionService.updateStatus(Array.from(selectedIds), 'approved', approvedBy))
  }, [selectedIds, runAction])

  const markPaidOut = useCallback(async (paidOutBy?: { userId: string | null; name: string | null }) => {
    if (selectedIds.size === 0) return
    await runAction(() => ProvisionService.markAsPaidOut(
      Array.from(selectedIds),
      paidOutBy ?? { userId: null, name: null }
    ))
  }, [selectedIds, runAction])

  /**
   * ⚠️ Undantagsväg: kringgår regeln "provision betalas först när kundfakturan
   * är betald". Sätter varken invoice_paid_date eller payout_month.
   */
  const markReadyForPayout = useCallback(async (opts: { reason?: string; byName?: string } = {}) => {
    if (selectedIds.size === 0) return
    await runAction(() => ProvisionService.markReadyForPayoutManually(Array.from(selectedIds), opts))
  }, [selectedIds, runAction])

  return {
    // State
    selectedMonth,
    filters,
    searchQuery,
    kpis,
    summaries,
    allPosts,
    payoutMonths,
    workQueue,
    flowSegments,
    cutoffDay,
    yearPosts,
    settings,
    loading,
    selectedIds,
    actionLoading,
    monthOptions,
    availableTechnicians,
    canNavigatePrev,
    canNavigateNext,
    // Actions
    navigateMonth,
    goToMonth,
    setFilters,
    setStatusFilter,
    setSearchQuery,
    toggleSelect,
    toggleAll,
    clearSelection,
    approveSelected,
    markPaidOut,
    markReadyForPayout,
    refreshData: loadData,
  }
}
