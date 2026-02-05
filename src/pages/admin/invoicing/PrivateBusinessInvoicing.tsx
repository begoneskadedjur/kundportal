// src/pages/admin/invoicing/PrivateBusinessInvoicing.tsx
// Fakturering för privat- och företagskunder (direktfakturering)

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Search,
  Filter,
  Download,
  CheckCircle,
  Send,
  DollarSign,
  AlertCircle,
  FileEdit,
  XCircle,
  Eye,
  ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { InvoiceService } from '../../../services/invoiceService'
import type { Invoice, InvoiceStatus, InvoiceStats } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'

export default function PrivateBusinessInvoicing() {
  // State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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
      <span className={`px-2 py-1 text-xs rounded-full ${config.bgColor} ${config.color} border ${config.borderColor}`}>
        {config.label}
      </span>
    )
  }

  // KPI-kort
  const KpiCard = ({
    label,
    count,
    amount,
    color,
    icon: Icon,
    onClick,
    isActive
  }: {
    label: string
    count: number
    amount: number
    color: string
    icon: React.ElementType
    onClick?: () => void
    isActive?: boolean
  }) => (
    <button
      onClick={onClick}
      className={`flex-1 p-4 rounded-lg border transition-all ${
        isActive
          ? `${color} border-current`
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isActive ? 'bg-white/10' : 'bg-slate-700'}`}>
          <Icon className={`w-5 h-5 ${isActive ? '' : 'text-slate-400'}`} />
        </div>
        <div className="text-left">
          <div className={`text-2xl font-bold ${isActive ? '' : 'text-white'}`}>{count}</div>
          <div className={`text-xs ${isActive ? 'opacity-80' : 'text-slate-400'}`}>{label}</div>
          <div className={`text-sm font-medium ${isActive ? 'opacity-90' : 'text-slate-300'}`}>
            {formatInvoiceAmount(amount)}
          </div>
        </div>
      </div>
    </button>
  )

  return (
    <div className="space-y-6">
      {/* KPI-kort */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            label="Utkast"
            count={stats.draft.count}
            amount={stats.draft.amount}
            color="text-slate-400 bg-slate-700/50"
            icon={FileEdit}
            onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
            isActive={statusFilter === 'draft'}
          />
          <KpiCard
            label="Kräver godkännande"
            count={stats.pending_approval.count}
            amount={stats.pending_approval.amount}
            color="text-orange-400 bg-orange-500/20"
            icon={AlertCircle}
            onClick={() => setStatusFilter(statusFilter === 'pending_approval' ? 'all' : 'pending_approval')}
            isActive={statusFilter === 'pending_approval'}
          />
          <KpiCard
            label="Redo att skicka"
            count={stats.ready.count}
            amount={stats.ready.amount}
            color="text-blue-400 bg-blue-500/20"
            icon={CheckCircle}
            onClick={() => setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')}
            isActive={statusFilter === 'ready'}
          />
          <KpiCard
            label="Skickade"
            count={stats.sent.count}
            amount={stats.sent.amount}
            color="text-purple-400 bg-purple-500/20"
            icon={Send}
            onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
            isActive={statusFilter === 'sent'}
          />
          <KpiCard
            label="Betalda"
            count={stats.paid.count}
            amount={stats.paid.amount}
            color="text-emerald-400 bg-emerald-500/20"
            icon={DollarSign}
            onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
            isActive={statusFilter === 'paid'}
          />
        </div>
      )}

      {/* Filter och åtgärder */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Sök */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök kund eller fakturanr..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>

          {/* Kundtyp filter */}
          <select
            value={caseTypeFilter}
            onChange={(e) => setCaseTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Alla kundtyper</option>
            <option value="private">Privatpersoner</option>
            <option value="business">Företag</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportera Fortnox
          </button>
        </div>
      </div>

      {/* Fakturalista */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            <span className="ml-2 text-slate-400">Laddar fakturor...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileEdit className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga fakturor hittades</p>
            <p className="text-sm mt-1">
              Fakturor skapas automatiskt när ärenden avslutas med artiklar
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === invoices.length && invoices.length > 0}
                      onChange={(e) => setSelectedIds(e.target.checked ? invoices.map(i => i.id) : [])}
                      className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Fakturanr
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Kund
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Typ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                    Belopp
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                    Åtgärder
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {invoices.map(invoice => {
                  const isOverdue = isInvoiceOverdue(invoice.due_date, invoice.status)

                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-slate-700/30 transition-colors ${
                        isOverdue ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(invoice.id)}
                          onChange={(e) => {
                            setSelectedIds(prev =>
                              e.target.checked
                                ? [...prev, invoice.id]
                                : prev.filter(id => id !== invoice.id)
                            )
                          }}
                          className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-white">
                          {invoice.invoice_number || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{invoice.customer_name}</div>
                        {invoice.organization_number && (
                          <div className="text-xs text-slate-400">{invoice.organization_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          invoice.case_type === 'private'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {invoice.case_type === 'private' ? 'Privat' : 'Företag'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div>{formatInvoiceDate(invoice.created_at)}</div>
                        {invoice.due_date && (
                          <div className={`text-xs ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                            Förfaller: {formatInvoiceDate(invoice.due_date)}
                            {isOverdue && ' (Förfallen)'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-medium">
                          {formatInvoiceAmount(invoice.total_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {invoice.status === 'pending_approval' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'ready')}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                              title="Godkänn"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status === 'ready' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'sent')}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                              title="Markera som skickad"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status === 'sent' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'paid')}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                              title="Markera som betald"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Makulera"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
