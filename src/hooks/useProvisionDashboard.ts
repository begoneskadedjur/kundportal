import { useState, useEffect, useCallback } from 'react'
import { ProvisionService } from '../services/provisionService'
import type {
  CommissionSettings,
  CommissionStatus,
  ProvisionKpi,
  ProvisionTechnicianSummary,
  ProvisionFilters,
  MonthSelection
} from '../types/provision'
import { getCurrentMonth, getMonthOptions } from '../types/provision'

export function useProvisionDashboard() {
  const [selectedMonth, setSelectedMonth] = useState<MonthSelection>(getCurrentMonth())
  const [filters, setFilters] = useState<ProvisionFilters>({})
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
    kpis,
    summaries,
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
    toggleSelect,
    toggleAll,
    clearSelection,
    approveSelected,
    markPaidOut,
    markReadyForPayout,
    refreshData: loadData,
  }
}
