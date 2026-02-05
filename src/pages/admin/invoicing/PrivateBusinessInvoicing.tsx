// src/pages/admin/invoicing/PrivateBusinessInvoicing.tsx
// Kompakt faktureringsvy för privat- och företagskunder

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Search,
  Download,
  CheckCircle,
  Send,
  DollarSign,
  AlertCircle,
  FileEdit,
  XCircle,
  Eye,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { InvoiceService } from '../../../services/invoiceService'
import type { Invoice, InvoiceStatus, InvoiceStats } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'
import InvoiceDetailModal from '../../../components/admin/invoicing/InvoiceDetailModal'

export default function PrivateBusinessInvoicing() {
  // State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'private' | 'business'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Ladda data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      if (caseTypeFilter !== 'all') filters.case_type = caseTypeFilter
      if (searchTerm) filters.search = searchTerm

      const [invoicesData, statsData] = await Promise.all([
        InvoiceService.getInvoices(filters),
        InvoiceService.getInvoiceStats()
      ])

      setInvoices(invoicesData)
      setStats(statsData)
      setSelectedIds([])
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda fakturor')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, caseTypeFilter, searchTerm])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Hantera statusändring
  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      await InvoiceService.updateInvoiceStatus(id, status)
      toast.success('Status uppdaterad')
      loadData()
    } catch (error) {
      console.error('Fel vid statusändring:', error)
      toast.error('Kunde inte uppdatera status')
    }
  }

  // Exportera till Fortnox
  const handleExport = async () => {
    const idsToExport = selectedIds.length > 0
      ? selectedIds
      : invoices.filter(i => i.status === 'ready' || i.status === 'sent').map(i => i.id)

    if (idsToExport.length === 0) {
      toast.error('Inga fakturor att exportera')
      return
    }

    try {
      const csv = await InvoiceService.exportForFortnox(idsToExport)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `fortnox-export-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${idsToExport.length} fakturor exporterade`)
    } catch (error) {
      console.error('Fel vid export:', error)
      toast.error('Kunde inte exportera')
    }
  }

  // Status badge komponent
  const StatusBadge = ({ status }: { status: InvoiceStatus }) => {
    const config = INVOICE_STATUS_CONFIG[status]
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${config.bgColor} ${config.color}`}>
        {config.label}
      </span>
    )
  }

  // Filter badge data
  const filterBadges = stats ? [
    { key: 'draft' as InvoiceStatus, label: 'Utkast', count: stats.draft.count, amount: stats.draft.amount, icon: FileEdit, color: 'slate' },
    { key: 'pending_approval' as InvoiceStatus, label: 'Godkännas', count: stats.pending_approval.count, amount: stats.pending_approval.amount, icon: AlertCircle, color: 'orange' },
    { key: 'ready' as InvoiceStatus, label: 'Redo', count: stats.ready.count, amount: stats.ready.amount, icon: CheckCircle, color: 'blue' },
    { key: 'sent' as InvoiceStatus, label: 'Skickade', count: stats.sent.count, amount: stats.sent.amount, icon: Send, color: 'purple' },
    { key: 'paid' as InvoiceStatus, label: 'Betalda', count: stats.paid.count, amount: stats.paid.amount, icon: DollarSign, color: 'emerald' }
  ] : []

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      slate: { active: 'bg-slate-600 text-white border-slate-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' },
      orange: { active: 'bg-orange-500/20 text-orange-400 border-orange-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50' },
      blue: { active: 'bg-blue-500/20 text-blue-400 border-blue-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-blue-500/50' },
      purple: { active: 'bg-purple-500/20 text-purple-400 border-purple-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-purple-500/50' },
      emerald: { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500', inactive: 'bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500/50' }
    }
    return colors[color]?.[isActive ? 'active' : 'inactive'] || colors.slate.inactive
  }

  return (
    <div className="space-y-3">
      {/* Kompakt filter-rad med badges */}
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

        {/* Kundtyp */}
        <select
          value={caseTypeFilter}
          onChange={(e) => setCaseTypeFilter(e.target.value as any)}
          className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Alla</option>
          <option value="private">Privat</option>
          <option value="business">Företag</option>
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
              onClick={() => setStatusFilter(isActive ? 'all' : badge.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${getColorClasses(badge.color, isActive)}`}
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

        {/* Åtgärder */}
        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Fortnox
        </button>
      </div>

      {/* Tabell med sticky header */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileEdit className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Inga fakturor hittades</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === invoices.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? invoices.map(i => i.id) : [])}
                      className="rounded border-slate-600 bg-slate-700 text-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Nr</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Kund</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Typ</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Datum</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Belopp</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase w-24">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {invoices.map(invoice => {
                  const isOverdue = isInvoiceOverdue(invoice.due_date, invoice.status)
                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-slate-700/30 ${isOverdue ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(invoice.id)}
                          onChange={(e) => setSelectedIds(prev =>
                            e.target.checked ? [...prev, invoice.id] : prev.filter(id => id !== invoice.id)
                          )}
                          className="rounded border-slate-600 bg-slate-700 text-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-white text-xs">
                        {invoice.invoice_number || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-white">{invoice.customer_name}</div>
                        {invoice.organization_number && (
                          <div className="text-xs text-slate-500">{invoice.organization_number}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          invoice.case_type === 'private' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {invoice.case_type === 'private' ? 'Privat' : 'Företag'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs">
                        <div>{formatInvoiceDate(invoice.created_at)}</div>
                        {isOverdue && (
                          <div className="text-red-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Förfallen
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-white">
                        {formatInvoiceAmount(invoice.total_amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {invoice.status === 'pending_approval' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'ready')}
                              className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                              title="Godkänn"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status === 'ready' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'sent')}
                              className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                              title="Skickad"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status === 'sent' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'paid')}
                              className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                              title="Betald"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                              className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                              title="Makulera"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedInvoiceId(invoice.id)}
                            className="p-1 text-slate-400 hover:bg-slate-600/50 rounded"
                            title="Detaljer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer med summa */}
        {invoices.length > 0 && (
          <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center text-sm">
            <span className="text-slate-400">
              {invoices.length} fakturor
              {selectedIds.length > 0 && ` (${selectedIds.length} markerade)`}
            </span>
            <span className="text-white font-medium">
              Summa: {formatInvoiceAmount(invoices.reduce((sum, i) => sum + i.total_amount, 0))}
            </span>
          </div>
        )}
      </div>

      {/* Modal */}
      <InvoiceDetailModal
        isOpen={selectedInvoiceId !== null}
        onClose={() => setSelectedInvoiceId(null)}
        invoiceId={selectedInvoiceId}
        onStatusChange={loadData}
      />
    </div>
  )
}
