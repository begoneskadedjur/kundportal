// src/components/admin/contractBilling/ContractInvoiceModal.tsx
// Modal för att visa och hantera en grupperad avtalsfaktura

import { useState, useEffect } from 'react'
import {
  X,
  FileText,
  User,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle,
  Send,
  AlertCircle,
  XCircle,
  Download,
  RefreshCw,
  Layers
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import type { ContractInvoice, ContractBillingItemStatus } from '../../../types/contractBilling'
import { BILLING_ITEM_STATUS_CONFIG, formatBillingAmount, formatBillingPeriod } from '../../../types/contractBilling'

interface ContractInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string | null
  periodStart: string | null
  periodEnd: string | null
  onStatusChange: () => void
}

export function ContractInvoiceModal({
  isOpen,
  onClose,
  customerId,
  periodStart,
  periodEnd,
  onStatusChange
}: ContractInvoiceModalProps) {
  const [invoice, setInvoice] = useState<ContractInvoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (isOpen && customerId && periodStart && periodEnd) {
      loadInvoice()
    }
  }, [isOpen, customerId, periodStart, periodEnd])

  const loadInvoice = async () => {
    if (!customerId || !periodStart || !periodEnd) return

    setLoading(true)
    try {
      const data = await ContractBillingService.getCustomerInvoice(customerId, periodStart, periodEnd)
      setInvoice(data)
    } catch (error) {
      console.error('Kunde inte ladda faktura:', error)
      toast.error('Kunde inte ladda fakturadetaljer')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: ContractBillingItemStatus) => {
    if (!invoice) return

    setUpdating(true)
    try {
      await ContractBillingService.updateInvoiceStatus(
        invoice.customer_id,
        invoice.period_start,
        invoice.period_end,
        newStatus
      )
      toast.success('Status uppdaterad')
      await loadInvoice()
      onStatusChange()
    } catch (error) {
      console.error('Kunde inte uppdatera status:', error)
      toast.error('Kunde inte uppdatera status')
    } finally {
      setUpdating(false)
    }
  }

  const handleExport = () => {
    if (!invoice) return

    try {
      const csv = ContractBillingService.exportInvoicesForFortnox([invoice])
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `faktura-${invoice.customer.company_name.replace(/\s+/g, '-')}-${invoice.period_start}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Faktura exporterad')
    } catch (error) {
      console.error('Kunde inte exportera:', error)
      toast.error('Kunde inte exportera faktura')
    }
  }

  const handleApproveDiscount = async (itemId: string) => {
    try {
      await ContractBillingService.approveDiscount(itemId)
      toast.success('Rabatt godkänd')
      await loadInvoice()
      onStatusChange()
    } catch (error) {
      toast.error('Kunde inte godkänna rabatt')
    }
  }

  if (!isOpen) return null

  const statusConfig = invoice ? BILLING_ITEM_STATUS_CONFIG[invoice.derived_status] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Faktura - {invoice?.customer.company_name || '...'}
              </h2>
              {invoice && statusConfig && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
              <span className="ml-2 text-slate-400">Laddar...</span>
            </div>
          ) : invoice ? (
            <div className="p-6 space-y-6">
              {/* Kundinformation */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Kundinformation</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-white font-medium">{invoice.customer.company_name}</div>
                      {invoice.customer.organization_number && (
                        <div className="text-xs text-slate-400">Org.nr: {invoice.customer.organization_number}</div>
                      )}
                    </div>
                  </div>
                  {invoice.customer.billing_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-300 text-sm">{invoice.customer.billing_email}</span>
                    </div>
                  )}
                  {(invoice.customer.billing_address || invoice.customer.contact_address) && (
                    <div className="flex items-start gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <span className="text-slate-300 text-sm">
                        {invoice.customer.billing_address || invoice.customer.contact_address}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    Period
                  </div>
                  <div className="text-white font-medium">
                    {formatBillingPeriod(invoice.period_start, invoice.period_end)}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Layers className="w-4 h-4" />
                    Artiklar
                  </div>
                  <div className="text-white font-medium">{invoice.item_count} st</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    Skapad
                  </div>
                  <div className="text-white font-medium">
                    {new Date(invoice.items[0]?.created_at).toLocaleDateString('sv-SE')}
                  </div>
                </div>
              </div>

              {/* Varning om rabatt kräver godkännande */}
              {invoice.has_items_requiring_approval && (
                <div className="flex items-start gap-3 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-orange-400">Rabatter kräver godkännande</div>
                    <p className="text-sm text-orange-300 mt-1">
                      Denna faktura innehåller rabatterade artiklar som måste godkännas.
                    </p>
                  </div>
                </div>
              )}

              {/* Artikeltabell */}
              <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400">Fakturarader</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Artikel</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-400">Typ</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Antal</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Pris</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Rabatt</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Moms</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Summa</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {invoice.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="text-white">{item.article_name}</div>
                            {item.article_code && (
                              <div className="text-xs text-slate-500">{item.article_code}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              item.item_type === 'contract' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {item.item_type === 'contract' ? 'Löpande' : 'Tillägg'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-300">
                            {formatBillingAmount(item.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.discount_percent > 0 ? (
                              <span className="text-orange-400">-{item.discount_percent}%</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">{item.vat_rate}%</td>
                          <td className="px-4 py-3 text-right text-white font-medium">
                            {formatBillingAmount(item.total_price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.requires_approval && item.status === 'pending' && (
                              <button
                                onClick={() => handleApproveDiscount(item.id)}
                                className="p-1 text-orange-400 hover:bg-orange-500/20 rounded"
                                title="Godkänn rabatt"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summering */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Summa exkl. moms</span>
                    <span className="text-white">{formatBillingAmount(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Moms</span>
                    <span className="text-white">{formatBillingAmount(invoice.vat_amount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700 flex justify-between">
                    <span className="text-lg font-semibold text-white">Totalt att betala</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {formatBillingAmount(invoice.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tidslinje */}
              {invoice.items.some(i => i.approved_at || i.invoiced_at || i.paid_at) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Historik</h3>
                  <div className="space-y-2 text-sm">
                    {invoice.items[0]?.created_at && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                        {new Date(invoice.items[0].created_at).toLocaleString('sv-SE')} - Skapad
                      </div>
                    )}
                    {invoice.items[0]?.approved_at && (
                      <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        {new Date(invoice.items[0].approved_at).toLocaleString('sv-SE')} - Godkänd
                      </div>
                    )}
                    {invoice.items[0]?.invoiced_at && (
                      <div className="flex items-center gap-2 text-purple-400">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        {new Date(invoice.items[0].invoiced_at).toLocaleString('sv-SE')} - Fakturerad
                      </div>
                    )}
                    {invoice.items[0]?.paid_at && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        {new Date(invoice.items[0].paid_at).toLocaleString('sv-SE')} - Betald
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Faktura hittades inte
            </div>
          )}
        </div>

        {/* Footer med åtgärder */}
        {invoice && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-between">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportera
            </button>

            <div className="flex gap-2">
              {invoice.derived_status === 'pending' && (
                <button
                  onClick={() => handleStatusChange('approved')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Godkänn alla
                </button>
              )}
              {invoice.derived_status === 'approved' && (
                <button
                  onClick={() => handleStatusChange('invoiced')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Markera fakturerad
                </button>
              )}
              {invoice.derived_status === 'invoiced' && (
                <button
                  onClick={() => handleStatusChange('paid')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <DollarSign className="w-4 h-4" />
                  Markera betald
                </button>
              )}
              {invoice.derived_status !== 'paid' && invoice.derived_status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Makulera
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
