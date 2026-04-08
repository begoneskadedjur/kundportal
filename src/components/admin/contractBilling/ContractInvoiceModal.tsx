// src/components/admin/contractBilling/ContractInvoiceModal.tsx
// Fakturavy – komplett layout för Fortnox-kompatibel faktura

import { useState, useEffect } from 'react'
import {
  X, FileText, CheckCircle, Send, XCircle, Download,
  RefreshCw, AlertCircle, DollarSign, Zap, Building2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import { supabase } from '../../../lib/supabase'
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

const fmtOrgnr = (s: string | null) => {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : s
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '–'
  return new Date(s).toLocaleDateString('sv-SE')
}

const addDays = (s: string, days: number) => {
  const d = new Date(s)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

// Momsspecifikation per skattesats
function VatBreakdown({ items }: { items: ContractInvoice['items'] }) {
  const byRate = items.reduce<Record<number, { base: number; vat: number }>>((acc, item) => {
    if (item.status === 'cancelled') return acc
    const r = item.vat_rate
    if (!acc[r]) acc[r] = { base: 0, vat: 0 }
    acc[r].base += item.total_price
    acc[r].vat += item.total_price * (r / 100)
    return acc
  }, {})

  return (
    <>
      {Object.entries(byRate)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([rate, { base, vat }]) => (
          <div key={rate} className="flex justify-between text-sm text-slate-400">
            <span>Moms {rate}% (på {formatBillingAmount(base)})</span>
            <span className="text-white">{formatBillingAmount(vat)}</span>
          </div>
        ))}
    </>
  )
}

export function ContractInvoiceModal({
  isOpen, onClose, customerId, periodStart, periodEnd, onStatusChange
}: ContractInvoiceModalProps) {
  const [invoice, setInvoice] = useState<ContractInvoice | null>(null)
  const [customerName, setCustomerName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (isOpen && customerId && periodStart && periodEnd) {
      loadInvoice()
    } else {
      setInvoice(null)
      setCustomerName('')
    }
  }, [isOpen, customerId, periodStart, periodEnd])

  const loadInvoice = async () => {
    if (!customerId || !periodStart || !periodEnd) return
    setLoading(true)
    try {
      const data = await ContractBillingService.getCustomerInvoice(customerId, periodStart, periodEnd)
      setInvoice(data)
      if (!data) {
        // Hämta kundnamn för tomvy
        const { data: c } = await supabase
          .from('customers')
          .select('company_name')
          .eq('id', customerId)
          .single()
        setCustomerName((c as any)?.company_name || '')
      }
    } catch (err) {
      console.error(err)
      toast.error('Kunde inte ladda fakturadetaljer')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!customerId || !periodStart || !periodEnd) return
    setGenerating(true)
    try {
      await ContractBillingService.generateBillingItems(customerId, periodStart, periodEnd)
      toast.success('Fakturarader genererade')
      await loadInvoice()
      onStatusChange()
    } catch (err: any) {
      toast.error('Kunde inte generera fakturarader: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleStatusChange = async (newStatus: ContractBillingItemStatus) => {
    if (!invoice) return
    setUpdating(true)
    try {
      await ContractBillingService.updateInvoiceStatus(
        invoice.customer_id, invoice.period_start, invoice.period_end, newStatus
      )
      toast.success('Status uppdaterad')
      await loadInvoice()
      onStatusChange()
    } catch (err) {
      toast.error('Kunde inte uppdatera status')
    } finally {
      setUpdating(false)
    }
  }

  const handleApproveDiscount = async (itemId: string) => {
    try {
      await ContractBillingService.approveDiscount(itemId)
      toast.success('Rabatt godkänd')
      await loadInvoice()
      onStatusChange()
    } catch {
      toast.error('Kunde inte godkänna rabatt')
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
    } catch {
      toast.error('Kunde inte exportera faktura')
    }
  }

  if (!isOpen) return null

  const statusConfig = invoice ? BILLING_ITEM_STATUS_CONFIG[invoice.derived_status] : null
  const today = new Date().toISOString().split('T')[0]
  const invoiceDate = invoice?.items[0]?.invoiced_at
    ? new Date(invoice.items[0].invoiced_at).toISOString().split('T')[0]
    : today
  const dueDate = addDays(invoiceDate, 30)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700 bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#20c58f]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#20c58f]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {invoice?.customer.company_name || customerName || '...'}
              </h2>
              {invoice && statusConfig && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              )}
              {!invoice && !loading && (
                <span className="text-xs text-slate-500">Ej genererad</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Innehåll */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mr-2" />
              <span className="text-slate-400">Laddar...</span>
            </div>

          ) : !invoice ? (
            /* ── Tom vy – inga fakturarader ── */
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
              <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center">
                <FileText className="w-7 h-7 text-slate-500" />
              </div>
              <div>
                <p className="text-white font-medium mb-1">Inga fakturarader genererade</p>
                <p className="text-sm text-slate-400">
                  Period: {periodStart && periodEnd ? formatBillingPeriod(periodStart, periodEnd) : '–'}
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#20c58f] hover:bg-[#1bb07e] text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {generating ? 'Genererar...' : 'Generera fakturarader'}
              </button>
            </div>

          ) : (
            /* ── Fakturavy ── */
            <div className="p-5 space-y-4">

              {/* Fakturahuvud */}
              <div className="flex items-start justify-between gap-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                {/* Avsändare */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#20c58f]/10 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-[#20c58f]" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">BeGone Skadedjur AB</p>
                    <p className="text-xs text-slate-400">556789-0000 · info@begone.se</p>
                  </div>
                </div>

                {/* Fakturametadata */}
                <div className="text-right space-y-0.5">
                  <p className="text-xl font-bold text-white tracking-wide">FAKTURA</p>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    {invoice.items[0]?.invoice_number ? (
                      <p>Nr: <span className="text-white font-medium">{invoice.items[0].invoice_number}</span></p>
                    ) : (
                      <p className="text-amber-400 text-[10px] font-medium uppercase tracking-wide">Förhandsvisning</p>
                    )}
                    <p>Datum: <span className="text-slate-300">{fmtDate(invoiceDate)}</span></p>
                    <p>Förfallodatum: <span className="text-slate-300">{dueDate}</span></p>
                    {invoice.customer.customer_number && (
                      <p>Kundnr: <span className="text-slate-300">{invoice.customer.customer_number}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Mottagare + Referens */}
              <div className="grid grid-cols-2 gap-4">
                {/* Fakturamottagare */}
                <div className="p-3.5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2">Fakturamottagare</p>
                  <p className="text-white font-semibold text-sm">
                    {invoice.customer.billing_recipient || invoice.customer.company_name}
                  </p>
                  {invoice.customer.billing_recipient && invoice.customer.billing_recipient !== invoice.customer.company_name && (
                    <p className="text-xs text-slate-400">{invoice.customer.company_name}</p>
                  )}
                  {invoice.customer.billing_address && (
                    <p className="text-xs text-slate-400 mt-1 whitespace-pre-line">{invoice.customer.billing_address}</p>
                  )}
                  {invoice.customer.organization_number && (
                    <p className="text-xs text-slate-500 mt-1">Org.nr: {fmtOrgnr(invoice.customer.organization_number)}</p>
                  )}
                  {invoice.customer.billing_email && (
                    <p className="text-xs text-slate-500">{invoice.customer.billing_email}</p>
                  )}
                </div>

                {/* Referensfält */}
                <div className="p-3.5 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2">Referens</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <p className="text-slate-500">Period</p>
                      <p className="text-slate-300">{formatBillingPeriod(invoice.period_start, invoice.period_end)}</p>
                    </div>
                    {invoice.customer.billing_reference && (
                      <div>
                        <p className="text-slate-500">Er referens</p>
                        <p className="text-slate-300">{invoice.customer.billing_reference}</p>
                      </div>
                    )}
                    {invoice.customer.cost_center && (
                      <div>
                        <p className="text-slate-500">Kostnadsställe</p>
                        <p className="text-slate-300">{invoice.customer.cost_center}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-500">Betalningsvillkor</p>
                      <p className="text-slate-300">30 dagar netto</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Varning rabatt */}
              {invoice.has_items_requiring_approval && (
                <div className="flex items-start gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-400">Rabatter kräver godkännande</p>
                    <p className="text-xs text-orange-300/80 mt-0.5">Godkänn rabatterade rader nedan innan fakturan skickas.</p>
                  </div>
                </div>
              )}

              {/* Artikeltabell */}
              <div className="border border-slate-700/50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/60 text-xs text-slate-400">
                      <th className="px-3 py-2.5 text-left font-medium">Art.nr</th>
                      <th className="px-3 py-2.5 text-left font-medium">Beskrivning</th>
                      <th className="px-3 py-2.5 text-center font-medium">Typ</th>
                      <th className="px-3 py-2.5 text-right font-medium">Antal</th>
                      <th className="px-3 py-2.5 text-right font-medium">À-pris</th>
                      <th className="px-3 py-2.5 text-right font-medium">Rabatt</th>
                      <th className="px-3 py-2.5 text-right font-medium">Moms</th>
                      <th className="px-3 py-2.5 text-right font-medium">Belopp</th>
                      <th className="px-3 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {invoice.items.map(item => (
                      <tr key={item.id} className={`${item.status === 'cancelled' ? 'opacity-40 line-through' : 'hover:bg-slate-800/20'} transition-colors`}>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-500 font-mono">{item.article_code || '–'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-white">{item.article_name}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                            item.item_type === 'contract'
                              ? 'bg-[#20c58f]/15 text-[#20c58f]'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {item.item_type === 'contract' ? 'Löpande' : 'Tillägg'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{formatBillingAmount(item.unit_price)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {item.discount_percent > 0
                            ? <span className="text-orange-400">-{item.discount_percent}%</span>
                            : <span className="text-slate-600">–</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{item.vat_rate}%</td>
                        <td className="px-3 py-2.5 text-right text-white font-medium">{formatBillingAmount(item.total_price)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {item.requires_approval && item.status === 'pending' && (
                            <button
                              onClick={() => handleApproveDiscount(item.id)}
                              title="Godkänn rabatt"
                              className="p-0.5 text-orange-400 hover:bg-orange-500/20 rounded"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summering */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Netto (exkl. moms)</span>
                    <span className="text-white">{formatBillingAmount(invoice.subtotal)}</span>
                  </div>
                  <VatBreakdown items={invoice.items} />
                  <div className="pt-2 border-t border-slate-600 flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-white">Att betala</span>
                    <span className="text-xl font-bold text-[#20c58f]">{formatBillingAmount(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Betalningsinformation */}
              <div className="p-3 bg-slate-800/20 border border-slate-700/30 rounded-xl">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2">Betalningsinformation</p>
                <div className="grid grid-cols-3 gap-4 text-xs text-slate-400">
                  <div><span className="text-slate-500">Bankgiro</span><br /><span className="text-slate-300">xxx-xxxx</span></div>
                  <div><span className="text-slate-500">Betalningsvillkor</span><br /><span className="text-slate-300">30 dagar netto · förfaller {dueDate}</span></div>
                  <div><span className="text-slate-500">Vid frågor</span><br /><span className="text-slate-300">{invoice.customer.billing_email || 'faktura@begone.se'}</span></div>
                </div>
              </div>

              {/* Historik */}
              {invoice.items.some(i => i.approved_at || i.invoiced_at || i.paid_at) && (
                <div className="p-3 bg-slate-800/20 border border-slate-700/30 rounded-xl">
                  <p className="text-xs font-medium text-slate-400 mb-2">Historik</p>
                  <div className="space-y-1 text-xs">
                    {invoice.items[0]?.created_at && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        {fmtDate(invoice.items[0].created_at)} – Skapad
                      </div>
                    )}
                    {invoice.items[0]?.approved_at && (
                      <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {fmtDate(invoice.items[0].approved_at)} – Godkänd
                      </div>
                    )}
                    {invoice.items[0]?.invoiced_at && (
                      <div className="flex items-center gap-2 text-purple-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {fmtDate(invoice.items[0].invoiced_at)} – Fakturerad
                      </div>
                    )}
                    {invoice.items[0]?.paid_at && (
                      <div className="flex items-center gap-2 text-[#20c58f]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />
                        {fmtDate(invoice.items[0].paid_at)} – Betald
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer – åtgärder */}
        {invoice && (
          <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between gap-2 shrink-0">
            {/* Vänster: export + Fortnox */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportera CSV
              </button>
              <div className="relative group">
                <button
                  disabled
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-slate-500 border border-slate-700 rounded-lg cursor-not-allowed"
                >
                  <Zap className="w-4 h-4" />
                  Skicka till Fortnox
                </button>
                <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1 bg-slate-700 text-xs text-slate-300 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  API-integration kommer snart
                </div>
              </div>
            </div>

            {/* Höger: statusknappar */}
            <div className="flex items-center gap-2">
              {invoice.derived_status === 'pending' && (
                <button
                  onClick={() => handleStatusChange('approved')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Godkänn
                </button>
              )}
              {invoice.derived_status === 'approved' && (
                <button
                  onClick={() => handleStatusChange('invoiced')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Markera fakturerad
                </button>
              )}
              {invoice.derived_status === 'invoiced' && (
                <button
                  onClick={() => handleStatusChange('paid')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#20c58f] hover:bg-[#1bb07e] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <DollarSign className="w-4 h-4" />
                  Markera betald
                </button>
              )}
              {invoice.derived_status !== 'paid' && invoice.derived_status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
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
