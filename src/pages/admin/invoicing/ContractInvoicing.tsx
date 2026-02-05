// src/pages/admin/invoicing/ContractInvoicing.tsx
// Fakturering för avtalskunder (batch-fakturering)
// Baserad på befintlig ContractBilling.tsx men med utökad funktionalitet

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Plus,
  Search,
  CheckCircle,
  FileText,
  Filter,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import {
  ContractBillingItemWithRelations,
  ContractBillingBatch,
  ContractBillingItemStatus,
  ContractBillingItemType
} from '../../../types/contractBilling'
import { ContractBillingKpiCards } from '../../../components/admin/contractBilling/ContractBillingKpiCards'
import { ContractBillingItemsTable } from '../../../components/admin/contractBilling/ContractBillingItemsTable'
import { ContractBillingBatchList } from '../../../components/admin/contractBilling/ContractBillingBatchList'
import { ContractBillingGenerateModal } from '../../../components/admin/contractBilling/ContractBillingGenerateModal'

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

  // Ladda items baserat på filter
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

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Hantera statusändring
  const handleStatusChange = async (id: string, status: ContractBillingItemStatus) => {
    try {
      await ContractBillingService.updateItemStatus(id, status)
      toast.success('Status uppdaterad')
      loadItems()
      loadData()
    } catch (error) {
      console.error('Fel vid statusändring:', error)
      toast.error('Kunde inte uppdatera status')
    }
  }

  // Hantera rabattgodkännande
  const handleApproveDiscount = async (id: string) => {
    try {
      await ContractBillingService.approveDiscount(id)
      toast.success('Rabatt godkänd')
      loadItems()
    } catch (error) {
      console.error('Fel vid godkännande:', error)
      toast.error('Kunde inte godkänna rabatt')
    }
  }

  // Hantera massuppdatering
  const handleBulkStatusChange = async (status: ContractBillingItemStatus) => {
    if (selectedIds.length === 0) return

    try {
      await ContractBillingService.bulkUpdateStatus(selectedIds, status)
      toast.success(`${selectedIds.length} rader uppdaterade`)
      loadItems()
      loadData()
    } catch (error) {
      console.error('Fel vid massuppdatering:', error)
      toast.error('Kunde inte uppdatera rader')
    }
  }

  // Hantera val
  const handleSelectItem = (id: string, selected: boolean) => {
    setSelectedIds(prev =>
      selected ? [...prev, id] : prev.filter(i => i !== id)
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? items.map(i => i.id) : [])
  }

  // Hantera batch-operationer
  const handleDeleteBatch = async (batchId: string) => {
    try {
      await ContractBillingService.deleteBatch(batchId)
      toast.success('Batch borttagen')
      if (selectedBatchId === batchId) {
        setSelectedBatchId(null)
      }
      loadData()
      loadItems()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
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
      console.error('Fel vid godkännande:', error)
      toast.error('Kunde inte godkänna batch')
    }
  }

  // Räkna items som kräver godkännande
  const approvalCount = items.filter(i => i.requires_approval && i.status === 'pending').length

  // Filtrera baserat på sökning
  const filteredItems = items.filter(item => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      item.customer?.company_name?.toLowerCase().includes(search) ||
      item.article_name?.toLowerCase().includes(search) ||
      item.article_code?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="space-y-6">
      {/* KPI-kort */}
      <ContractBillingKpiCards
        stats={stats}
        activeStatus={statusFilter}
        onStatusClick={(status) => setStatusFilter(status === statusFilter ? null : status)}
      />

      {/* Åtgärdsfält */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Vänster: Batch-lista */}
        <div className="lg:w-72 flex-shrink-0">
          <ContractBillingBatchList
            batches={batches}
            selectedBatchId={selectedBatchId}
            onSelectBatch={setSelectedBatchId}
            onDeleteBatch={handleDeleteBatch}
            onApproveBatch={handleApproveBatch}
          />
        </div>

        {/* Höger: Filter och tabell */}
        <div className="flex-1 space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Sök */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Sök kund, artikel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Artikeltyp filter */}
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Alla typer</option>
              <option value="contract">Avtalsartiklar</option>
              <option value="ad_hoc">Ad-hoc</option>
            </select>

            {/* Godkännande filter */}
            <button
              onClick={() => setShowRequiresApproval(!showRequiresApproval)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showRequiresApproval
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              <span>Kräver godkännande</span>
              {approvalCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-orange-500 text-white">
                  {approvalCount}
                </span>
              )}
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  loadData()
                  loadItems()
                }}
                disabled={loading || loadingItems}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading || loadingItems ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Generera
              </button>
            </div>
          </div>

          {/* Massåtgärder */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <span className="text-blue-400 text-sm">
                {selectedIds.length} rad{selectedIds.length !== 1 ? 'er' : ''} markerade
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkStatusChange('approved')}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Godkänn
                </button>
                <button
                  onClick={() => handleBulkStatusChange('invoiced')}
                  className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                >
                  Markera fakturerad
                </button>
                <button
                  onClick={() => handleBulkStatusChange('paid')}
                  className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                >
                  Markera betald
                </button>
              </div>
            </div>
          )}

          {/* Tabell */}
          <ContractBillingItemsTable
            items={filteredItems}
            loading={loadingItems}
            selectedIds={selectedIds}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
            onStatusChange={handleStatusChange}
            onApproveDiscount={handleApproveDiscount}
            showItemType={true}
          />
        </div>
      </div>

      {/* Generera modal */}
      {showGenerateModal && (
        <ContractBillingGenerateModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false)
            loadData()
            loadItems()
          }}
        />
      )}
    </div>
  )
}
