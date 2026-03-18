import { useState, useEffect, useCallback, useMemo } from 'react'
import { ProvisionService } from '../services/provisionService'
import type {
  CommissionPost,
  CommissionSettings,
  CommissionStatus,
  ProvisionKpi,
  ProvisionTechnicianSummary,
  ProvisionFilters,
  MonthSelection,
  PayoutTechnicianSummary,
  MonthlyProvisionSummary,
  TechnicianPayoutEntry
} from '../types/provision'
import { getCurrentMonth, getMonthOptions, formatSwedishMonth } from '../types/provision'

export function useProvisionDashboard() {
  const [selectedMonth, setSelectedMonth] = useState<MonthSelection>(getCurrentMonth())
  const [filters, setFilters] = useState<ProvisionFilters>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [kpis, setKpis] = useState<ProvisionKpi>({
    pending_invoice_total: 0, pending_invoice_count: 0,
    ready_for_payout_total: 0, ready_for_payout_count: 0,
    approved_total: 0, approved_count: 0,
    paid_out_total: 0, paid_out_count: 0
  })
  const [summaries, setSummaries] = useState<ProvisionTechnicianSummary[]>([])
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [availableTechnicians, setAvailableTechnicians] = useState<Array<{ id: string; name: string }>>([])

  const monthOptions = getMonthOptions(12)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiData, summaryData, settingsData, techsData] = await Promise.all([
        ProvisionService.getKpis(selectedMonth.value),
        ProvisionService.getTechnicianSummaries(selectedMonth.value, filters),
        ProvisionService.getSettings(),
        ProvisionService.getAvailableTechnicians()
      ])
      setKpis(kpiData)
      setSummaries(summaryData)
      setSettings(settingsData)
      setAvailableTechnicians(techsData)
    } catch (err) {
      console.error('Kunde inte ladda provisionsdata:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth.value, filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Navigation
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

  // Flat list of all posts with search filtering
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

  // Aggregerad utbetalningsöversikt per tekniker
  const payoutSummary: PayoutTechnicianSummary[] = useMemo(() => {
    const cutoff = settings?.payout_cutoff_day ?? 20
    const byTech = new Map<string, PayoutTechnicianSummary>()

    for (const post of allPosts) {
      let existing = byTech.get(post.technician_id)
      if (!existing) {
        existing = {
          technician_id: post.technician_id,
          technician_name: post.technician_name,
          post_count: 0,
          total_commission: 0,
          payout_month: null,
          statuses: { pending: 0, ready: 0, approved: 0, paid: 0 }
        }
        byTech.set(post.technician_id, existing)
      }
      existing.post_count++
      existing.total_commission += post.commission_amount
      if (post.status === 'pending_invoice') existing.statuses.pending++
      else if (post.status === 'ready_for_payout') existing.statuses.ready++
      else if (post.status === 'approved') existing.statuses.approved++
      else if (post.status === 'paid_out') existing.statuses.paid++

      // Beräkna utbetalningsmånad baserat på invoice_paid_date + brytdatum
      if (post.invoice_paid_date) {
        const paidDate = new Date(post.invoice_paid_date)
        const day = paidDate.getDate()
        let payoutYear = paidDate.getFullYear()
        let payoutMonth = paidDate.getMonth() // 0-indexed
        if (day > cutoff) {
          payoutMonth++
          if (payoutMonth > 11) { payoutMonth = 0; payoutYear++ }
        }
        const pm = `${payoutYear}-${String(payoutMonth + 1).padStart(2, '0')}`
        if (!existing.payout_month || pm < existing.payout_month) {
          existing.payout_month = pm
        }
      }
    }

    return Array.from(byTech.values()).sort((a, b) => a.technician_name.localeCompare(b.technician_name))
  }, [allPosts, settings?.payout_cutoff_day])

  // Månadsaggregerad utbetalningsvy
  const monthlyPayouts: MonthlyProvisionSummary[] = useMemo(() => {
    const cutoff = settings?.payout_cutoff_day ?? 20
    const byMonth = new Map<string, Map<string, CommissionPost[]>>()

    for (const post of allPosts) {
      let monthKey: string
      if (post.invoice_paid_date && post.status !== 'pending_invoice') {
        const paidDate = new Date(post.invoice_paid_date)
        const day = paidDate.getDate()
        let year = paidDate.getFullYear()
        let month = paidDate.getMonth() // 0-indexed
        if (day > cutoff) {
          month++
          if (month > 11) { month = 0; year++ }
        }
        monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
      } else {
        // pending_invoice: grupperas per skapad-månad
        const created = new Date(post.created_at)
        monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`
      }

      if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Map())
      const techMap = byMonth.get(monthKey)!
      if (!techMap.has(post.technician_id)) techMap.set(post.technician_id, [])
      techMap.get(post.technician_id)!.push(post)
    }

    const result: MonthlyProvisionSummary[] = []
    for (const [monthKey, techMap] of byMonth) {
      const technicians: TechnicianPayoutEntry[] = []
      const monthStatuses = { pending: 0, ready: 0, approved: 0, paid: 0 }

      for (const [techId, posts] of techMap) {
        const statuses = { pending: 0, ready: 0, approved: 0, paid: 0 }
        let total = 0
        for (const p of posts) {
          total += p.commission_amount
          if (p.status === 'pending_invoice') statuses.pending++
          else if (p.status === 'ready_for_payout') statuses.ready++
          else if (p.status === 'approved') statuses.approved++
          else if (p.status === 'paid_out') statuses.paid++
        }
        monthStatuses.pending += statuses.pending
        monthStatuses.ready += statuses.ready
        monthStatuses.approved += statuses.approved
        monthStatuses.paid += statuses.paid

        technicians.push({
          technician_id: techId,
          technician_name: posts[0].technician_name,
          posts,
          total_commission: total,
          post_count: posts.length,
          statuses
        })
      }

      technicians.sort((a, b) => a.technician_name.localeCompare(b.technician_name, 'sv'))

      result.push({
        month_key: monthKey,
        month_label: formatSwedishMonth(monthKey),
        technicians,
        total_technicians: technicians.length,
        total_posts: technicians.reduce((s, t) => s + t.post_count, 0),
        total_commission: technicians.reduce((s, t) => s + t.total_commission, 0),
        statuses: monthStatuses
      })
    }

    // Sortera senaste månad först
    result.sort((a, b) => b.month_key.localeCompare(a.month_key))
    return result
  }, [allPosts, settings?.payout_cutoff_day])

  // Selection
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
    const allSelected = allIds.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(allIds))
  }, [summaries, selectedIds])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // Actions
  const approveSelected = useCallback(async (approvedBy: string) => {
    if (selectedIds.size === 0) return
    setActionLoading(true)
    try {
      await ProvisionService.updateStatus(
        Array.from(selectedIds),
        'approved',
        approvedBy
      )
      setSelectedIds(new Set())
      await loadData()
    } catch (err) {
      console.error('Kunde inte godkänna:', err)
      throw err
    } finally {
      setActionLoading(false)
    }
  }, [selectedIds, loadData])

  const markPaidOut = useCallback(async () => {
    if (selectedIds.size === 0) return
    setActionLoading(true)
    try {
      await ProvisionService.updateStatus(
        Array.from(selectedIds),
        'paid_out'
      )
      setSelectedIds(new Set())
      await loadData()
    } catch (err) {
      console.error('Kunde inte markera utbetalda:', err)
      throw err
    } finally {
      setActionLoading(false)
    }
  }, [selectedIds, loadData])

  const markReadyForPayout = useCallback(async () => {
    if (selectedIds.size === 0) return
    setActionLoading(true)
    try {
      await ProvisionService.updateStatus(
        Array.from(selectedIds),
        'ready_for_payout'
      )
      setSelectedIds(new Set())
      await loadData()
    } catch (err) {
      console.error('Kunde inte markera redo:', err)
      throw err
    } finally {
      setActionLoading(false)
    }
  }, [selectedIds, loadData])

  return {
    // State
    selectedMonth,
    filters,
    searchQuery,
    kpis,
    summaries,
    allPosts,
    payoutSummary,
    monthlyPayouts,
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
