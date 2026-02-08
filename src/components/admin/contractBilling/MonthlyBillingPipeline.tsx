// src/components/admin/contractBilling/MonthlyBillingPipeline.tsx
// Manadsvis pipeline-vy for avtalsfakturering

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Calendar,
  CheckCircle,
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import type {
  MonthlyPipelineSummary,
  MonthlyCustomerEntry,
  MonthlyCustomerStatus,
  ContractBillingItemStatus
} from '../../../types/contractBilling'
import { PIPELINE_STATUS_CONFIG, formatBillingAmount } from '../../../types/contractBilling'
import { ContractBillingGenerateModal } from './ContractBillingGenerateModal'
import { ContractInvoiceModal } from './ContractInvoiceModal'
import { CustomerPipelineRow } from './CustomerPipelineRow'

function getEntryKey(entry: MonthlyCustomerEntry, monthKey: string): string {
  return `${entry.customer.id}::${monthKey}`
}

export function MonthlyBillingPipeline() {
  // Data
  const [months, setMonths] = useState<MonthlyPipelineSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Navigation - offset i manader fran nuvarande
  const [monthOffset, setMonthOffset] = useState(0)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<MonthlyCustomerStatus | null>(null)

  // Expansion
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  // Selection
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [modalTarget, setModalTarget] = useState<{
    customerId: string
    periodStart: string
    periodEnd: string
  } | null>(null)

  // Berakna start/slut baserat pa offset
  const { startMonth, endMonth, spanLabel } = useMemo(() => {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + monthOffset + 12, 1)
    const startLabel = startDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
    const endLabel = endDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
    return {
      startMonth: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
      endMonth: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`,
      spanLabel: `${startLabel} - ${endLabel}`,
    }
  }, [monthOffset])

  // Ladda data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ContractBillingService.getMonthlyPipelineData(startMonth, endMonth)
      setMonths(data)

      // Auto-expandera nuvarande manad om inget ar expanderat
      if (data.length > 0 && expandedMonths.size === 0) {
        const now = new Date()
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const match = data.find(m => m.month_key === currentKey)
        if (match) {
          setExpandedMonths(new Set([match.month_key]))
        } else {
          setExpandedMonths(new Set([data[0].month_key]))
        }
      }
    } catch (error) {
      console.error('Fel vid laddning av pipeline:', error)
      toast.error('Kunde inte ladda pipeline-data')
    } finally {
      setLoading(false)
    }
  }, [startMonth, endMonth])

  useEffect(() => { loadData() }, [loadData])

  // Filtrera kunder inom varje manad
  const filteredMonths = useMemo(() => {
    if (!searchTerm && !statusFilter) return months

    return months.map(month => {
      let filtered = month.customers

      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filtered = filtered.filter(e =>
          e.customer.company_name.toLowerCase().includes(term) ||
          e.customer.organization_number?.toLowerCase().includes(term) ||
          e.customer.billing_email?.toLowerCase().includes(term)
        )
      }

      if (statusFilter) {
        filtered = filtered.filter(e => e.status === statusFilter)
      }

      return { ...month, customers: filtered, total_customers: filtered.length }
    })
  }, [months, searchTerm, statusFilter])

  // Toggle expansion
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }

  // Selection
  const toggleSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAllInMonth = (month: MonthlyPipelineSummary, selected: boolean) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      for (const entry of month.customers) {
        if (entry.status === 'not_billable') continue
        const key = getEntryKey(entry, month.month_key)
        if (selected) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }

  // Bulk status change
  const handleBulkStatusChange = async (status: ContractBillingItemStatus) => {
    if (selectedKeys.size === 0) return

    try {
      const allItemIds: string[] = []
      for (const month of months) {
        for (const entry of month.customers) {
          const key = getEntryKey(entry, month.month_key)
          if (selectedKeys.has(key)) {
            for (const item of entry.items) {
              if (item.status !== 'cancelled' && item.status !== status) {
                allItemIds.push(item.id)
              }
            }
          }
        }
      }

      if (allItemIds.length > 0) {
        await ContractBillingService.bulkUpdateStatus(allItemIds, status)
        toast.success(`${selectedKeys.size} kunder uppdaterade`)
        setSelectedKeys(new Set())
        loadData()
      }
    } catch {
      toast.error('Kunde inte uppdatera status')
    }
  }

  // Aggregerad statistik over alla manader
  const totalStats = useMemo(() => {
    const stats = {
      pending: 0,
      approved: 0,
      invoiced: 0,
      paid: 0,
      awaiting_generation: 0,
      not_billable: 0,
    }
    for (const month of months) {
      stats.pending += month.status_breakdown.pending || 0
      stats.approved += month.status_breakdown.approved || 0
      stats.invoiced += month.status_breakdown.invoiced || 0
      stats.paid += month.status_breakdown.paid || 0
      stats.awaiting_generation += month.status_breakdown.awaiting_generation || 0
      stats.not_billable += month.status_breakdown.not_billable || 0
    }
    return stats
  }, [months])

  // Status filter badges
  const filterBadges: {
    key: MonthlyCustomerStatus
    label: string
    count: number
    icon: typeof Clock
    color: string
  }[] = [
    { key: 'awaiting_generation', label: 'Ej genererade', count: totalStats.awaiting_generation, icon: Calendar, color: 'amber' },
    { key: 'pending', label: 'Vantar', count: totalStats.pending, icon: Clock, color: 'yellow' },
    { key: 'approved', label: 'Godkanda', count: totalStats.approved, icon: CheckCircle, color: 'blue' },
    { key: 'invoiced', label: 'Fakturerade', count: totalStats.invoiced, icon: FileText, color: 'purple' },
    { key: 'paid', label: 'Betalda', count: totalStats.paid, icon: DollarSign, color: 'emerald' },
  ]

  const getFilterColor = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      amber: { active: 'bg-amber-500/20 text-amber-400 border-amber-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-amber-500/50' },
      yellow: { active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-yellow-500/50' },
      blue: { active: 'bg-blue-500/20 text-blue-400 border-blue-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-blue-500/50' },
      purple: { active: 'bg-purple-500/20 text-purple-400 border-purple-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-purple-500/50' },
      emerald: { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500/50' },
    }
    return colors[color]?.[isActive ? 'active' : 'inactive'] || colors.blue.inactive
  }

  // Nuvarande manad for markering
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  return (
    <div className="space-y-3">
      {/* Filter-rad */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sok */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Sok kund..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-700" />

        {/* Status filter badges */}
        {filterBadges.map(badge => {
          const Icon = badge.icon
          const isActive = statusFilter === badge.key
          return (
            <button
              key={badge.key}
              onClick={() => setStatusFilter(isActive ? null : badge.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${getFilterColor(badge.color, isActive)}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{badge.label}</span>
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                {badge.count}
              </span>
            </button>
          )
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Manad-navigering */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="1 manad bakåt"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs text-slate-300 select-none">
            {spanLabel}
          </span>
          <button
            onClick={() => setMonthOffset(o => o + 1)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="1 manad framat"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {monthOffset !== 0 && (
            <button
              onClick={() => setMonthOffset(0)}
              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
              title="Aterstall till nuvarande manad"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Uppdatera */}
        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Generera */}
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Generera
        </button>
      </div>

      {/* Massatgarder */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <span className="text-blue-400">{selectedKeys.size} kunder markerade</span>
          <div className="flex gap-1">
            <button
              onClick={() => handleBulkStatusChange('approved')}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
            >
              Godkann
            </button>
            <button
              onClick={() => handleBulkStatusChange('invoiced')}
              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
            >
              Fakturerad
            </button>
            <button
              onClick={() => handleBulkStatusChange('paid')}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs"
            >
              Betald
            </button>
          </div>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="ml-auto p-0.5 text-blue-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pipeline - manadsvis */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
          <span className="ml-2 text-sm text-slate-400">Laddar pipeline...</span>
        </div>
      ) : filteredMonths.length === 0 ? (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-500 opacity-50" />
          <p className="text-sm text-slate-400">Inga avtalskunder hittades</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMonths.map(month => {
            const isExpanded = expandedMonths.has(month.month_key)
            const isCurrent = month.month_key === currentMonthKey
            const hasActionNeeded = (month.status_breakdown.pending || 0) + (month.status_breakdown.awaiting_generation || 0) + (month.status_breakdown.mixed || 0) > 0

            // Status dots for header
            const statusDots = ([
              'awaiting_generation', 'pending', 'approved', 'invoiced', 'paid'
            ] as MonthlyCustomerStatus[]).filter(s => (month.status_breakdown[s] || 0) > 0)

            // Markera alla
            const selectableEntries = month.customers.filter(e => e.status !== 'not_billable')
            const allKeys = selectableEntries.map(e => getEntryKey(e, month.month_key))
            const allSelected = allKeys.length > 0 && allKeys.every(k => selectedKeys.has(k))
            const someSelected = allKeys.some(k => selectedKeys.has(k))

            return (
              <div
                key={month.month_key}
                className={`bg-slate-800/50 rounded-lg border overflow-hidden ${
                  isCurrent ? 'border-emerald-500/40' : 'border-slate-700'
                }`}
              >
                {/* Month header */}
                <button
                  onClick={() => toggleMonth(month.month_key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}

                  {/* Manad-label */}
                  <span className="text-white font-medium text-sm capitalize">
                    {month.month_label}
                  </span>

                  {/* "Nu" badge */}
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                      Nu
                    </span>
                  )}

                  {/* Varning om atgarder kravs */}
                  {hasActionNeeded && !isCurrent && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  )}

                  {/* Status dots */}
                  <div className="flex items-center gap-1.5">
                    {statusDots.map(status => {
                      const config = PIPELINE_STATUS_CONFIG[status]
                      return (
                        <span
                          key={status}
                          className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${config.bgColor} ${config.color}`}
                        >
                          {month.status_breakdown[status]}
                        </span>
                      )
                    })}
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Kundantal */}
                  <span className="text-xs text-slate-400">
                    {month.total_customers} {month.total_customers === 1 ? 'kund' : 'kunder'}
                  </span>

                  {/* Saknar prislista-varning */}
                  {month.missing_setup_customers > 0 && (
                    <span className="text-xs text-slate-500" title="Saknar prislista">
                      ({month.missing_setup_customers} utan prislista)
                    </span>
                  )}

                  {/* Totalbelopp */}
                  <span className="text-white font-medium text-sm">
                    {formatBillingAmount(month.total_amount)}
                  </span>
                </button>

                {/* Expanderbar body */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {/* Markera alla */}
                      <div className="px-4 py-1.5 bg-slate-900/30 border-t border-slate-700/50 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected
                          }}
                          onChange={(e) => selectAllInMonth(month, e.target.checked)}
                          className="rounded border-slate-600 bg-slate-700 text-blue-500"
                        />
                        <span className="text-xs text-slate-500">Markera alla i perioden</span>
                      </div>

                      {/* Kundrader */}
                      {month.customers.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                          Inga kunder matchar filtret
                        </div>
                      ) : (
                        <div>
                          {month.customers.map(entry => (
                            <CustomerPipelineRow
                              key={getEntryKey(entry, month.month_key)}
                              entry={entry}
                              isSelected={selectedKeys.has(getEntryKey(entry, month.month_key))}
                              onToggleSelection={() => toggleSelection(getEntryKey(entry, month.month_key))}
                              onClick={() => {
                                if (entry.items.length > 0) {
                                  setModalTarget({
                                    customerId: entry.customer.id,
                                    periodStart: month.period_start,
                                    periodEnd: month.period_end,
                                  })
                                }
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Footer */}
          <div className="px-4 py-2 text-sm text-slate-400 flex justify-between">
            <span>
              {months.length > 0 ? `${months[0].month_label} - ${months[months.length - 1].month_label}` : ''}
              {' '}({filteredMonths.reduce((sum, m) => sum + m.total_customers, 0)} kunder totalt)
            </span>
            <span className="text-white font-medium">
              Totalt: {formatBillingAmount(filteredMonths.reduce((sum, m) => sum + m.total_amount, 0))}
            </span>
          </div>
        </div>
      )}

      {/* Generera-modal */}
      <ContractBillingGenerateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSuccess={() => {
          setShowGenerateModal(false)
          loadData()
        }}
      />

      {/* Fakturadetalj-modal */}
      <ContractInvoiceModal
        isOpen={modalTarget !== null}
        onClose={() => setModalTarget(null)}
        customerId={modalTarget?.customerId ?? null}
        periodStart={modalTarget?.periodStart ?? null}
        periodEnd={modalTarget?.periodEnd ?? null}
        onStatusChange={loadData}
      />
    </div>
  )
}
