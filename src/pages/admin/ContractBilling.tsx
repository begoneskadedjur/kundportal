// src/pages/admin/ContractBilling.tsx
// Huvudsida för avtalsfakturering

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Receipt,
  Search,
  CheckCircle,
  FileText,
  Filter
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { PageHeader } from '../../components/shared'
import Button from '../../components/ui/Button'
import { ContractBillingService } from '../../services/contractBillingService'
import {
  ContractBillingItemWithRelations,
  ContractBillingBatch,
  ContractBillingItemStatus
} from '../../types/contractBilling'
import { ContractBillingKpiCards } from '../../components/admin/contractBilling/ContractBillingKpiCards'
import { ContractBillingItemsTable } from '../../components/admin/contractBilling/ContractBillingItemsTable'
import { ContractBillingBatchList } from '../../components/admin/contractBilling/ContractBillingBatchList'
import { ContractBillingGenerateModal } from '../../components/admin/contractBilling/ContractBillingGenerateModal'
import { ArticlePriceListNav } from '../../components/admin/settings/ArticlePriceListNav'
import toast from 'react-hot-toast'

export default function ContractBilling() {
  const navigate = useNavigate()

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
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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
      if (selectedBatchId) filters.batchId = selectedBatchId

      const itemsData = await ContractBillingService.getBillingItems(filters)
      setItems(itemsData)
      setSelectedIds([])
    } catch (error) {
      console.error('Fel vid laddning av items:', error)
      toast.error('Kunde inte ladda faktureringsrader')
    } finally {
      setLoadingItems(false)
    }
  }, [statusFilter, selectedBatchId])

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
      loadData() // Uppdatera statistik
    } catch (error) {
      console.error('Fel vid statusändring:', error)
      toast.error('Kunde inte uppdatera status')
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
      // Hämta alla items i batchen och godkänn dem
      const batchItems = await ContractBillingService.getBillingItems({ batchId })
      const pendingItems = batchItems.filter(i => i.status === 'pending')

      if (pendingItems.length === 0) {
        toast.error('Inga väntande rader att godkänna')
        return
      }

      await ContractBillingService.bulkUpdateStatus(
        pendingItems.map(i => i.id),
        'approved'
      )

      await ContractBillingService.updateBatchStatus(batchId, 'approved')

      toast.success(`${pendingItems.length} rader godkända`)
      loadData()
      loadItems()
    } catch (error) {
      console.error('Fel vid godkännande:', error)
      toast.error('Kunde inte godkänna batch')
    }
  }

  // Filtrera items baserat på sök
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-emerald-500/5" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Receipt className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Avtalsfakturering</h1>
                <p className="text-slate-400 text-sm">
                  Periodisk fakturering för avtalskunder
                </p>
              </div>
            </div>
          </div>

          {/* Åtgärder */}
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  loadData()
                  loadItems()
                }}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowGenerateModal(true)}
            >
              <Plus className="w-4 h-4" />
              Generera fakturering
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <ArticlePriceListNav />
        </div>

        {/* KPI-kort */}
        <div className="mb-8">
          <ContractBillingKpiCards
            stats={stats}
            onFilterChange={setStatusFilter}
            activeFilter={statusFilter}
          />
        </div>

        {/* Innehåll */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Vänster: Batches */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Faktureringsomgångar
            </h2>
            <ContractBillingBatchList
              batches={batches}
              loading={loading}
              onBatchSelect={setSelectedBatchId}
              selectedBatchId={selectedBatchId}
              onDeleteBatch={handleDeleteBatch}
              onApproveBatch={handleApproveBatch}
            />
          </div>

          {/* Höger: Items */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-slate-400" />
                Faktureringsrader
                {statusFilter && (
                  <span className="text-sm font-normal text-slate-400">
                    (filtrerade)
                  </span>
                )}
              </h2>

              {/* Sökfält */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Sök kund eller artikel..."
                  className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                />
              </div>
            </div>

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <div className="mb-4 p-3 bg-slate-800/70 rounded-lg border border-slate-700/50 flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  {selectedIds.length} rader valda
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkStatusChange('approved')}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Godkänn valda
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkStatusChange('invoiced')}
                  >
                    <FileText className="w-4 h-4" />
                    Markera fakturerade
                  </Button>
                </div>
              </div>
            )}

            <ContractBillingItemsTable
              items={filteredItems}
              loading={loadingItems}
              selectedIds={selectedIds}
              onSelectItem={handleSelectItem}
              onSelectAll={handleSelectAll}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </div>

      {/* Generate Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <ContractBillingGenerateModal
            isOpen={showGenerateModal}
            onClose={() => setShowGenerateModal(false)}
            onSuccess={() => {
              loadData()
              loadItems()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
