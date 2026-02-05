// src/pages/admin/invoicing/ContractInvoicing.tsx
// Kompakt faktureringsvy för avtalskunder

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
  Percent,
  X,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import type {
  ContractBillingItemWithRelations,
  ContractBillingBatch,
  ContractBillingItemStatus,
  ContractBillingItemType
} from '../../../types/contractBilling'
import { ContractBillingGenerateModal } from '../../../components/admin/contractBilling/ContractBillingGenerateModal'

// Formatera belopp
const formatAmount = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount)
}

// Formatera period
const formatPeriod = (start?: string, end?: string) => {
  if (!start) return '-'
  const startDate = new Date(start)
  const month = startDate.toLocaleDateString('sv-SE', { month: 'short' })
  const year = startDate.getFullYear()
  return `${month}. ${year}`
}

export default function ContractInvoicing() {
  // State
  const [items, setItems] = useState<ContractBillingItemWithRelations[]>([])
  const [batches, setBatches] = useState<ContractBillingBatch[]>([])
  const [stats, setStats] = useState({
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    invoiced: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [itemTypeFilter, setItemTypeFilter] = useState<ContractBillingItemType | 'all'>('all')
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showRequiresApproval, setShowRequiresApproval] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  // Ladda data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [batchesData, statsData] = await Promise.all([
        ContractBillingService.getAllBatches(),
        ContractBillingService.getBillingStats()
      ])
      setBatches(batchesData)
      setStats(statsData)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Ladda items
  const loadItems = useCallback(async () => {
    setLoadingItems(true)
    try {
      const filters: any = {}
      if (statusFilter) filters.status = statusFilter
      if (selectedBatchId) filters.batch_id = selectedBatchId
      if (itemTypeFilter !== 'all') filters.item_type = itemTypeFilter
      if (showRequiresApproval) filters.requires_approval = true

      const itemsData = await ContractBillingService.getBillingItems(filters)
      setItems(itemsData)
      setSelectedIds([])
    } catch (error) {
      console.error('Fel vid laddning av items:', error)
      toast.error('Kunde inte ladda faktureringsrader')
    } finally {
      setLoadingItems(false)
    }
  }, [statusFilter, selectedBatchId, itemTypeFilter, showRequiresApproval])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadItems() }, [loadItems])

  // Handlers
  const handleStatusChange = async (id: string, status: ContractBillingItemStatus) => {
    try {
      await ContractBillingService.updateItemStatus(id, status)
      toast.success('Status uppdaterad')
      loadItems()
      loadData()
    } catch (error) {
      toast.error('Kunde inte uppdatera status')
    }
  }

  const handleApproveDiscount = async (id: string) => {
    try {
      await ContractBillingService.approveDiscount(id)
      toast.success('Rabatt godkänd')
      loadItems()
    } catch (error) {
      toast.error('Kunde inte godkänna rabatt')
    }
  }

  const handleBulkStatusChange = async (status: ContractBillingItemStatus) => {
    if (selectedIds.length === 0) return
    try {
      await ContractBillingService.bulkUpdateStatus(selectedIds, status)
      toast.success(`${selectedIds.length} rader uppdaterade`)
      loadItems()
      loadData()
    } catch (error) {
      toast.error('Kunde inte uppdatera rader')
    }
  }

  const handleDeleteBatch = async (batchId: string) => {
    try {
      await ContractBillingService.deleteBatch(batchId)
      toast.success('Batch borttagen')
      if (selectedBatchId === batchId) setSelectedBatchId(null)
      loadData()
      loadItems()
    } catch (error) {
      toast.error('Kunde inte ta bort batch')
    }
  }

  const handleApproveBatch = async (batchId: string) => {
    try {
      const { items: batchItems } = await ContractBillingService.getBatchWithItems(batchId)
      const pendingIds = batchItems.filter(i => i.status === 'pending').map(i => i.id)
      if (pendingIds.length > 0) {
        await ContractBillingService.bulkUpdateStatus(pendingIds, 'approved')
      }
      await ContractBillingService.updateBatchStatus(batchId, 'approved')
      toast.success('Batch godkänd')
      loadData()
      loadItems()
    } catch (error) {
      toast.error('Kunde inte godkänna batch')
    }
  }

  // Counts
  const approvalCount = items.filter(i => i.requires_approval && i.status === 'pending').length

  // Filter items
  const filteredItems = items.filter(item => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      item.customer?.company_name?.toLowerCase().includes(search) ||
      item.article_name?.toLowerCase().includes(search) ||
      item.article_code?.toLowerCase().includes(search)
    )
  })

  // Status badge
  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-blue-500/20 text-blue-400',
      invoiced: 'bg-purple-500/20 text-purple-400',
      paid: 'bg-emerald-500/20 text-emerald-400'
    }
    return styles[status] || 'bg-slate-500/20 text-slate-400'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Väntar',
      approved: 'Godkänd',
      invoiced: 'Fakturerad',
      paid: 'Betald'
    }
    return labels[status] || status
  }

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
            placeholder="Sök..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
          />
        </div>

        {/* Tjänstetyp */}
        <select
          value={itemTypeFilter}
          onChange={(e) => setItemTypeFilter(e.target.value as any)}
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

        {/* Batch dropdown om det finns */}
        {batches.length > 0 && (
          <select
            value={selectedBatchId || ''}
            onChange={(e) => setSelectedBatchId(e.target.value || null)}
            className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Alla omgångar</option>
            {batches.map(batch => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.items_count} st)
              </option>
            ))}
          </select>
        )}

        {/* Åtgärder */}
        <button
          onClick={() => { loadData(); loadItems() }}
          disabled={loading || loadingItems}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading || loadingItems ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Generera
        </button>
      </div>

      {/* Massåtgärder */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <span className="text-blue-400">{selectedIds.length} markerade</span>
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
          </div>
        </div>
      )}

      {/* Tabell */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        {loadingItems ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Inga faktureringsrader</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                      onChange={(e) => setSelectedIds(e.target.checked ? filteredItems.map(i => i.id) : [])}
                      className="rounded border-slate-600 bg-slate-700 text-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Kund</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Artikel</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Typ</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Period</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Belopp</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase w-24">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-700/30">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={(e) => setSelectedIds(prev =>
                          e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                        )}
                        className="rounded border-slate-600 bg-slate-700 text-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white">{item.customer?.company_name || '-'}</div>
                      {item.customer?.organization_number && (
                        <div className="text-xs text-slate-500">{item.customer.organization_number}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-white">{item.article_name}</span>
                        {item.requires_approval && (
                          <AlertCircle className="w-3.5 h-3.5 text-orange-400" title="Kräver godkännande" />
                        )}
                      </div>
                      {item.article_code && (
                        <div className="text-xs text-slate-500">{item.article_code}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        item.item_type === 'contract' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {item.item_type === 'contract' ? 'Löpande' : 'Tillägg'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">
                      {formatPeriod(item.billing_period_start, item.billing_period_end)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-white font-medium">{formatAmount(item.total_price)}</div>
                      {item.discount_percent > 0 && (
                        <div className="text-xs text-orange-400">-{item.discount_percent}%</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusStyle(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        {item.requires_approval && item.status === 'pending' && (
                          <button
                            onClick={() => handleApproveDiscount(item.id)}
                            className="p-1 text-orange-400 hover:bg-orange-500/20 rounded"
                            title="Godkänn rabatt"
                          >
                            <Percent className="w-4 h-4" />
                          </button>
                        )}
                        {item.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(item.id, 'approved')}
                            className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                            title="Godkänn"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {item.status === 'approved' && (
                          <button
                            onClick={() => handleStatusChange(item.id, 'invoiced')}
                            className="p-1 text-purple-400 hover:bg-purple-500/20 rounded"
                            title="Fakturerad"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {item.status === 'invoiced' && (
                          <button
                            onClick={() => handleStatusChange(item.id, 'paid')}
                            className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                            title="Betald"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filteredItems.length > 0 && (
          <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center text-sm">
            <span className="text-slate-400">
              {filteredItems.length} rader
              {selectedIds.length > 0 && ` (${selectedIds.length} markerade)`}
            </span>
            <span className="text-white font-medium">
              Summa: {formatAmount(filteredItems.reduce((sum, i) => sum + i.total_price, 0))}
            </span>
          </div>
        )}
      </div>

      {/* Modal */}
      <ContractBillingGenerateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSuccess={() => {
          setShowGenerateModal(false)
          loadData()
          loadItems()
        }}
      />
    </div>
  )
}
