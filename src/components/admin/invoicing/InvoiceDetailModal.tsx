// src/components/admin/invoicing/InvoiceDetailModal.tsx
// Modal för att visa och hantera fakturadetaljer

import { useState, useEffect } from 'react'
import {
  X,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle,
  Send,
  AlertCircle,
  XCircle,
  Download,
  RefreshCw,
  Percent
} from 'lucide-react'
import toast from 'react-hot-toast'
import { InvoiceService } from '../../../services/invoiceService'
import type { InvoiceWithItems, InvoiceStatus, InvoiceItem } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'

interface InvoiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceId: string | null
  onStatusChange?: () => void
}

export default function InvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
  onStatusChange
}: InvoiceDetailModalProps) {
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Ladda fakturadata
  useEffect(() => {
    if (isOpen && invoiceId) {
      loadInvoice()
    }
  }, [isOpen, invoiceId])

  const loadInvoice = async () => {
    if (!invoiceId) return

    setLoading(true)
    try {
      const data = await InvoiceService.getInvoice(invoiceId)
      setInvoice(data)
    } catch (error) {
      console.error('Kunde inte ladda faktura:', error)
      toast.error('Kunde inte ladda fakturadetaljer')
    } finally {
      setLoading(false)
    }
  }

  // Hantera statusändring
  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return

    setUpdating(true)
    try {
      await InvoiceService.updateInvoiceStatus(invoice.id, newStatus)
      toast.success('Status uppdaterad')
      await loadInvoice()
      onStatusChange?.()
    } catch (error) {
      console.error('Kunde inte uppdatera status:', error)
      toast.error('Kunde inte uppdatera status')
    } finally {
      setUpdating(false)
    }
  }

  // Exportera enskild faktura
  const handleExport = async () => {
    if (!invoice) return

    try {
      const csv = await InvoiceService.exportForFortnox([invoice.id])
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `faktura-${invoice.invoice_number || invoice.id}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Faktura exporterad')
    } catch (error) {
      console.error('Kunde inte exportera:', error)
      toast.error('Kunde inte exportera faktura')
    }
  }

  if (!isOpen) return null

  const isOverdue = invoice ? isInvoiceOverdue(invoice.due_date, invoice.status) : false
  const statusConfig = invoice ? INVOICE_STATUS_CONFIG[invoice.status] : null

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
                Faktura {invoice?.invoice_number || '...'}
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
                      <div className="text-white font-medium">{invoice.customer_name}</div>
                      {invoice.organization_number && (
                        <div className="text-xs text-slate-400">Org.nr: {invoice.organization_number}</div>
                      )}
                    </div>
                  </div>
                  {invoice.customer_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-300">{invoice.customer_email}</span>
                    </div>
                  )}
                  {invoice.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-300">{invoice.customer_phone}</span>
                    </div>
                  )}
                  {invoice.customer_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <span className="text-slate-300">{invoice.customer_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Datum */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    Skapad
                  </div>
                  <div className="text-white font-medium">{formatInvoiceDate(invoice.created_at)}</div>
                </div>
                <div className={`rounded-lg p-4 ${isOverdue ? 'bg-red-500/20' : 'bg-slate-800/50'}`}>
                  <div className={`flex items-center gap-2 text-sm mb-1 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                    <Calendar className="w-4 h-4" />
                    Förfaller
                  </div>
                  <div className={`font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                    {formatInvoiceDate(invoice.due_date)}
                    {isOverdue && <span className="text-xs ml-1">(Förfallen)</span>}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Building2 className="w-4 h-4" />
                    Ärendetyp
                  </div>
                  <div className="text-white font-medium">
                    {invoice.case_type === 'private' ? 'Privatperson' : 'Företag'}
                  </div>
                </div>
              </div>

              {/* Fakturarader */}
              <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400">Fakturarader</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Artikel</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Antal</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Pris</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Rabatt</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Moms</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Summa</th>
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
                          <td className="px-4 py-3 text-right text-slate-300">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-300">
                            {formatInvoiceAmount(item.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.discount_percent > 0 ? (
                              <span className="text-orange-400">-{item.discount_percent}%</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {item.vat_rate}%
                          </td>
                          <td className="px-4 py-3 text-right text-white font-medium">
                            {formatInvoiceAmount(item.total_price)}
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
                    <span className="text-white">{formatInvoiceAmount(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Moms</span>
                    <span className="text-white">{formatInvoiceAmount(invoice.vat_amount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700 flex justify-between">
                    <span className="text-lg font-semibold text-white">Totalt att betala</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {formatInvoiceAmount(invoice.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Varning om rabatt kräver godkännande */}
              {invoice.requires_approval && invoice.status === 'pending_approval' && (
                <div className="flex items-start gap-3 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-orange-400">Rabatt kräver godkännande</div>
                    <p className="text-sm text-orange-300 mt-1">
                      Denna faktura innehåller rabatterade artiklar och måste godkännas innan den kan skickas.
                    </p>
                  </div>
                </div>
              )}

              {/* Anteckningar */}
              {invoice.notes && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Anteckningar</h3>
                  <p className="text-slate-300">{invoice.notes}</p>
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
              {invoice.status === 'pending_approval' && (
                <button
                  onClick={() => handleStatusChange('ready')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Godkänn
                </button>
              )}
              {invoice.status === 'ready' && (
                <button
                  onClick={() => handleStatusChange('sent')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Markera skickad
                </button>
              )}
              {invoice.status === 'sent' && (
                <button
                  onClick={() => handleStatusChange('paid')}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <DollarSign className="w-4 h-4" />
                  Markera betald
                </button>
              )}
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
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
