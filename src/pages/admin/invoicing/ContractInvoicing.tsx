// src/pages/admin/invoicing/ContractInvoicing.tsx
// Kundgrupperad pipeline-vy för avtalsfakturering

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  DollarSign,
  Send,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import type {
  ContractBillingBatch,
  ContractBillingItemStatus,
  ContractBillingItemType,
  ContractBillingPipelineFilters,
  BillingPeriodSummary,
  ContractInvoice
} from '../../../types/contractBilling'
import { formatBillingAmount } from '../../../types/contractBilling'
import { ContractBillingGenerateModal } from '../../../components/admin/contractBilling/ContractBillingGenerateModal'
import { PeriodSection } from '../../../components/admin/contractBilling/PeriodSection'
import { ContractInvoiceModal } from '../../../components/admin/contractBilling/ContractInvoiceModal'

function getInvoiceKey(invoice: ContractInvoice): string {
  return `${invoice.customer_id}::${invoice.period_start}::${invoice.period_end}`
}

export default function ContractInvoicing() {
  // Data state
  const [periods, setPeriods] = useState<BillingPeriodSummary[]>([])
  const [batches, setBatches] = useState<ContractBillingBatch[]>([])
  const [stats, setStats] = useState({
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    invoiced: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 }
  })
  const [loading, setLoading] = useState(true)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [itemTypeFilter, setItemTypeFilter] = useState<ContractBillingItemType | 'all'>('all')
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showRequiresApproval, setShowRequiresApproval] = useState(false)

  // Expansion state
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  // Selection state
  const [selectedInvoiceKeys, setSelectedInvoiceKeys] = useState<Set<string>>(new Set())

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [modalTarget, setModalTarget] = useState<{
    customerId: string
    periodStart: string
    periodEnd: string
  } | null>(null)

  // Ladda all data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const filters: ContractBillingPipelineFilters = {}
      if (statusFilter) filters.status = statusFilter as ContractBillingItemStatus
      if (itemTypeFilter !== 'all') filters.item_type = itemTypeFilter
      if (selectedBatchId) filters.batch_id = selectedBatchId
      if (showRequiresApproval) filters.requires_approval = true
      if (searchTerm) filters.search = searchTerm

      const [periodsData, batchesData, statsData] = await Promise.all([
        ContractBillingService.getBillingPipeline(filters),
        ContractBillingService.getAllBatches(),
        ContractBillingService.getBillingStats()
      ])

      setPeriods(periodsData)
      setBatches(batchesData)
      setStats(statsData)

      // Auto-expandera nyaste perioden om ingen är expanderad
      if (periodsData.length > 0 && expandedPeriods.size === 0) {
        setExpandedPeriods(new Set([periodsData[0].period_start]))
      }
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, itemTypeFilter, selectedBatchId, showRequiresApproval, searchTerm])

  useEffect(() => { loadData() }, [loadData])

  // Toggle period expansion
  const togglePeriod = (periodStart: string) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(periodStart)) {
        next.delete(periodStart)
      } else {
        next.add(periodStart)
      }
      return next
    })
  }

  // Selection handlers
  const toggleInvoiceSelection = (key: string) => {
    setSelectedInvoiceKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAllInPeriod = (period: BillingPeriodSummary, selected: boolean) => {
    setSelectedInvoiceKeys(prev => {
      const next = new Set(prev)
      for (const invoice of period.invoices) {
        const key = getInvoiceKey(invoice)
        if (selected) {
          next.add(key)
        } else {
          next.delete(key)
        }
      }
      return next
    })
  }

  // Bulk status change
  const handleBulkStatusChange = async (status: ContractBillingItemStatus) => {
    if (selectedInvoiceKeys.size === 0) return

    try {
      // Samla alla item-IDs från valda fakturor
      const allItemIds: string[] = []
      for (const period of periods) {
        for (const invoice of period.invoices) {
          const key = getInvoiceKey(invoice)
          if (selectedInvoiceKeys.has(key)) {
            for (const item of invoice.items) {
              if (item.status !== 'cancelled' && item.status !== status) {
                allItemIds.push(item.id)
              }
            }
          }
        }
      }

      if (allItemIds.length > 0) {
        await ContractBillingService.bulkUpdateStatus(allItemIds, status)
        toast.success(`${selectedInvoiceKeys.size} fakturor uppdaterade`)
        setSelectedInvoiceKeys(new Set())
        loadData()
      }
    } catch (error) {
      toast.error('Kunde inte uppdatera status')
    }
  }

  // Bulk export
  const handleBulkExport = () => {
    const selectedInvoices: ContractInvoice[] = []
    for (const period of periods) {
      for (const invoice of period.invoices) {
        if (selectedInvoiceKeys.has(getInvoiceKey(invoice))) {
          selectedInvoices.push(invoice)
        }
      }
    }

    if (selectedInvoices.length === 0) return

    const csv = ContractBillingService.exportInvoicesForFortnox(selectedInvoices)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `avtalsfakturor-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${selectedInvoices.length} fakturor exporterade`)
  }

  // Totalt antal items som kräver godkännande
  const approvalCount = periods.reduce((sum, p) =>
    sum + p.invoices.filter(inv => inv.has_items_requiring_approval).length, 0
  )

  // Filter badges
  const filterBadges = [
    { key: 'pending', label: 'Väntar', count: stats.pending.count, icon: Clock, color: 'yellow' },
    { key: 'approved', label: 'Godkända', count: stats.approved.count, icon: CheckCircle, color: 'blue' },
    { key: 'invoiced', label: 'Fakturerade', count: stats.invoiced.count, icon: FileText, color: 'purple' },
    { key: 'paid', label: 'Betalda', count: stats.paid.count, icon: DollarSign, color: 'emerald' }
  ]

  const getFilterColor = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      yellow: { active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-yellow-500/50' },
      blue: { active: 'bg-blue-500/20 text-blue-400 border-blue-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-blue-500/50' },
      purple: { active: 'bg-purple-500/20 text-purple-400 border-purple-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-purple-500/50' },
      emerald: { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500/50' }
    }
    return colors[color]?.[isActive ? 'active' : 'inactive'] || colors.blue.inactive
  }

  return (
    <div className="space-y-3">
      {/* Kompakt filter-rad */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sök */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Sök kund eller artikel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
          />
        </div>

        {/* Tjänstetyp */}
        <select
          value={itemTypeFilter}
          onChange={(e) => setItemTypeFilter(e.target.value as ContractBillingItemType | 'all')}
          className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Alla</option>
          <option value="contract">Löpande</option>
          <option value="ad_hoc">Tillägg</option>
        </select>

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

        {/* Kräver godkännande */}
        {approvalCount > 0 && (
          <button
            onClick={() => setShowRequiresApproval(!showRequiresApproval)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${
              showRequiresApproval
                ? 'bg-orange-500/20 text-orange-400 border-orange-500'
                : 'bg-slate-800 text-orange-400 border-slate-700 hover:border-orange-500/50'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-orange-500 text-white">
              {approvalCount}
            </span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Batch dropdown */}
        {batches.length > 0 && (
          <select
            value={selectedBatchId || ''}
            onChange={(e) => setSelectedBatchId(e.target.value || null)}
            className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Alla omgångar</option>
            {batches.map(batch => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_number} ({batch.total_items} st)
              </option>
            ))}
          </select>
        )}

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

      {/* Massåtgärder */}
      {selectedInvoiceKeys.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <span className="text-blue-400">{selectedInvoiceKeys.size} fakturor markerade</span>
          <div className="flex gap-1">
            <button
              onClick={() => handleBulkStatusChange('approved')}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
            >
              Godkänn
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
            <div className="w-px h-5 bg-blue-500/30 mx-1" />
            <button
              onClick={handleBulkExport}
              className="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded text-xs"
            >
              Exportera
            </button>
          </div>
          <button
            onClick={() => setSelectedInvoiceKeys(new Set())}
            className="ml-auto p-0.5 text-blue-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pipeline-vy */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
          <span className="ml-2 text-sm text-slate-400">Laddar...</span>
        </div>
      ) : periods.length === 0 ? (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-500 opacity-50" />
          <p className="text-sm text-slate-400">Inga faktureringsrader</p>
          <p className="text-xs text-slate-500 mt-1">Generera en ny omgång för att komma igång</p>
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map(period => (
            <PeriodSection
              key={`${period.period_start}::${period.period_end}`}
              period={period}
              isExpanded={expandedPeriods.has(period.period_start)}
              onToggle={() => togglePeriod(period.period_start)}
              onCustomerClick={(invoice) => setModalTarget({
                customerId: invoice.customer_id,
                periodStart: invoice.period_start,
                periodEnd: invoice.period_end
              })}
              selectedInvoiceKeys={selectedInvoiceKeys}
              onToggleSelection={toggleInvoiceSelection}
              onSelectAll={selectAllInPeriod}
            />
          ))}

          {/* Footer med total */}
          <div className="px-4 py-2 text-sm text-slate-400 flex justify-between">
            <span>
              {periods.reduce((sum, p) => sum + p.customer_count, 0)} kunder i {periods.length} {periods.length === 1 ? 'period' : 'perioder'}
            </span>
            <span className="text-white font-medium">
              Totalt: {formatBillingAmount(periods.reduce((sum, p) => sum + p.total_amount, 0))}
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
