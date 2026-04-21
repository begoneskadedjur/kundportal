// src/components/admin/invoicing/InvoiceDetailModal.tsx
// Modal för att visa och hantera fakturadetaljer med ärendekontext och kommunikation

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
  Bug,
  Users,
  Clock,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FlaskConical,
  Timer,
  Home,
  RotateCcw,
  Trash2,
  FileEdit,
  ExternalLink,
  BookCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { InvoiceService } from '../../../services/invoiceService'
import { FortnoxService } from '../../../services/fortnoxService'
import type { InvoiceWithItems, InvoiceStatus } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'
import { calculateRotRutDeduction, ROT_RUT_PERCENT, calculateMarginPercent } from '../../../types/caseBilling'
import type { CaseBillingItem } from '../../../types/caseBilling'
import { useCaseContext } from '../../../hooks/useCaseContext'
import { formatSwedishDateTime } from '../../../types/database'
import CommentSection from '../../communication/CommentSection'
import CaseContextImagePreview from '../../communication/CaseContextImagePreview'
import EmbeddedMapPreview from '../../communication/EmbeddedMapPreview'
import { createSystemComment } from '../../../services/communicationService'
import { useAuth } from '../../../contexts/AuthContext'
import type { CaseType } from '../../../types/communication'
import type { CasePreparationWithDetails } from '../../../types/casePreparations'

// Formatera minuter till "Xh Ym"
const formatTimeSpent = (minutes: number | null): string | null => {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

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
  const { user, profile } = useAuth()
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [sendingToFortnox, setSendingToFortnox] = useState(false)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [preparations, setPreparations] = useState<CasePreparationWithDetails[]>([])
  const [staleInfo, setStaleInfo] = useState<{ stale: boolean; reason?: string } | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [caseBillingItems, setCaseBillingItems] = useState<CaseBillingItem[]>([])
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

  // Hämta ärendekontext via case_id/case_type
  const { caseContext, isLoading: contextLoading } = useCaseContext(
    isOpen && invoice ? invoice.case_id : null,
    isOpen && invoice ? (invoice.case_type as CaseType) : null
  )

  // Hämta preparat för ärendet
  useEffect(() => {
    if (!invoice) { setPreparations([]); return }
    const fetchPreparations = async () => {
      const { data } = await supabase
        .from('case_preparations')
        .select('*, preparation:preparations(*)')
        .eq('case_id', invoice.case_id)
        .eq('case_type', invoice.case_type)
        .order('created_at', { ascending: true })
      setPreparations((data as CasePreparationWithDetails[] | null) || [])
    }
    fetchPreparations()
  }, [invoice?.case_id, invoice?.case_type])

  // Hämta case_billing_items (interna kostnader + tjänster) för att bygga kostnadsuppdelning
  useEffect(() => {
    if (!invoice) { setCaseBillingItems([]); return }
    const fetchCaseBilling = async () => {
      const { data } = await supabase
        .from('case_billing_items')
        .select('*')
        .eq('case_id', invoice.case_id)
        .eq('case_type', invoice.case_type)
      setCaseBillingItems((data as CaseBillingItem[] | null) || [])
    }
    fetchCaseBilling()
  }, [invoice?.case_id, invoice?.case_type])

  // Ladda fakturadata
  useEffect(() => {
    if (isOpen && invoiceId) {
      loadInvoice()
    }
  }, [isOpen, invoiceId])

  // Reset context expanded on close
  useEffect(() => {
    if (!isOpen) setContextExpanded(false)
  }, [isOpen])

  const loadInvoice = async () => {
    if (!invoiceId) return

    setLoading(true)
    try {
      const data = await InvoiceService.getInvoice(invoiceId)
      setInvoice(data)

      // Kolla om fakturan är inaktuell
      if (data && !['sent', 'paid', 'cancelled'].includes(data.status)) {
        const stale = await InvoiceService.isInvoiceStale(invoiceId)
        setStaleInfo(stale)
      } else {
        setStaleInfo(null)
      }
    } catch (error) {
      console.error('Kunde inte ladda faktura:', error)
      toast.error('Kunde inte ladda fakturadetaljer')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!invoice) return
    setRegenerating(true)
    try {
      await InvoiceService.regenerateInvoiceItems(invoice.id)
      toast.success('Fakturarader uppdaterade')
      await loadInvoice()
      onStatusChange?.()
    } catch (error) {
      console.error('Kunde inte uppdatera faktura:', error)
      toast.error('Kunde inte uppdatera fakturarader')
    } finally {
      setRegenerating(false)
    }
  }

  // Hantera statusändring + logga system-event
  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return

    setUpdating(true)
    try {
      await InvoiceService.updateInvoiceStatus(invoice.id, newStatus)

      // Logga statusändring i ärendets kommunikationspanel
      if (user && invoice.case_id) {
        const authorName = profile?.display_name || profile?.technicians?.name || profile?.email || 'Okänd'
        try {
          await createSystemComment(
            invoice.case_id,
            invoice.case_type as CaseType,
            'status_change',
            `Fakturastatus ändrad till "${INVOICE_STATUS_CONFIG[newStatus].label}" (${invoice.invoice_number})`,
            user.id,
            authorName
          )
        } catch (err) {
          console.warn('Kunde inte logga statusändring:', err)
        }
      }

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

  const handleDelete = async () => {
    if (!invoice) return
    if (!confirm(`Vill du radera faktura ${invoice.invoice_number} permanent? Detta går inte att ångra.`)) return

    setUpdating(true)
    try {
      await InvoiceService.deleteInvoice(invoice.id)
      toast.success('Fakturan har raderats')
      onStatusChange?.()
      onClose()
    } catch (error) {
      console.error('Kunde inte radera faktura:', error)
      toast.error('Kunde inte radera fakturan')
    } finally {
      setUpdating(false)
    }
  }

  const handleSendToFortnox = async () => {
    if (!invoice) return
    setSendingToFortnox(true)
    try {
      // 1. Hämta kundnummer via org.nr
      let customerNumber: number | null = null
      if (invoice.organization_number) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('customer_number')
          .eq('organization_number', invoice.organization_number)
          .maybeSingle()
        customerNumber = (customerData as any)?.customer_number ?? null
      }

      if (!customerNumber) {
        toast.error('Kunden saknar kundnummer — lägg till det på kundkortet innan du skickar till Fortnox')
        return
      }

      // 2. Hämta eller skapa kund i Fortnox
      const fortnoxCustomerNumber = await FortnoxService.findOrCreateCustomer({
        customer_number: customerNumber,
        company_name: invoice.customer_name,
        organization_number: invoice.organization_number,
        billing_email: invoice.customer_email,
        billing_address: invoice.customer_address,
      })

      // 2b. Säkerställ att alla artiklar/tjänster finns i Fortnox innan fakturan skickas.
      // Vi använder våra interna service-/artikelkoder som ArticleNumber.
      // Saknas artikeln i Fortnox skapas den (Type: SERVICE, med unit + VAT).
      await FortnoxService.ensureArticlesExistForInvoiceItems(
        invoice.items.map(i => ({
          article_code: i.article_code,
          article_name: i.article_name,
          vat_rate: i.vat_rate,
        }))
      )

      // 2c. Hämta ärende-metadata för berikning av Fortnox-payloaden
      // (leveransdatum, teknikerns namn, ärendenummer för spårbarhet)
      const caseTable = invoice.case_type === 'private' ? 'private_cases' : 'business_cases'
      const { data: caseMeta } = await supabase
        .from(caseTable)
        .select('case_number, completed_date, start_date, primary_assignee_name')
        .eq('id', invoice.case_id)
        .maybeSingle()

      // 3. Bygg fakturarader
      const invoiceRows = invoice.items.map(item => ({
        ArticleNumber: item.article_code || undefined,
        Description: item.article_name,
        DeliveredQuantity: item.quantity,
        Price: item.unit_price,
        VAT: item.vat_rate,
        ...(item.discount_percent > 0 ? { Discount: item.discount_percent, DiscountType: 'PERCENT' } : {}),
      }))

      // 4. Skapa faktura i Fortnox
      const today = new Date().toISOString().split('T')[0]
      const dueDate = invoice.due_date || new Date(new Date(today).getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]

      // Leveransdatum: när jobbet utfördes (completed_date primärt, start_date fallback)
      const deliveryDateRaw = (caseMeta as any)?.completed_date || (caseMeta as any)?.start_date
      const deliveryDate = deliveryDateRaw
        ? new Date(deliveryDateRaw).toISOString().split('T')[0]
        : undefined

      const fortnoxPayload: Record<string, unknown> = {
        CustomerNumber: fortnoxCustomerNumber,
        InvoiceDate: today,
        DueDate: dueDate,
        InvoiceRows: invoiceRows,
      }

      if (deliveryDate) fortnoxPayload.DeliveryDate = deliveryDate
      if ((caseMeta as any)?.primary_assignee_name) {
        fortnoxPayload.OurReference = (caseMeta as any).primary_assignee_name
      }
      if ((caseMeta as any)?.case_number) {
        fortnoxPayload.ExternalInvoiceReference1 = (caseMeta as any).case_number
      }
      if (invoice.invoice_number) {
        fortnoxPayload.ExternalInvoiceReference2 = invoice.invoice_number
      }
      if (invoice.invoice_marking) fortnoxPayload.YourReference = invoice.invoice_marking
      if (invoice.notes) fortnoxPayload.Remarks = invoice.notes

      // ROT/RUT
      if (invoice.rot_rut_type && invoice.fastighetsbeteckning) {
        fortnoxPayload.HouseWork = true
        fortnoxPayload.HouseWorkType = invoice.rot_rut_type.toUpperCase()
        fortnoxPayload.Housework = {
          HouseWorkType: invoice.rot_rut_type.toUpperCase(),
          HouseWorkAmount: Math.round(invoice.subtotal * ROT_RUT_PERCENT),
        }
      }

      const fortnoxInvoice = await FortnoxService.createInvoice(fortnoxPayload)

      // 5. Spara DocumentNumber på fakturan
      await supabase
        .from('invoices')
        .update({ fortnox_document_number: fortnoxInvoice.DocumentNumber })
        .eq('id', invoice.id)

      // 6. Uppdatera status till draft (utkast i Fortnox — ej bokfört, ej skickat ännu)
      await InvoiceService.updateInvoiceStatus(invoice.id, 'draft')
      if (user && invoice.case_id) {
        const authorName = profile?.display_name || profile?.email || 'Okänd'
        try {
          await createSystemComment(
            invoice.case_id,
            invoice.case_type as CaseType,
            'status_change',
            `Utkast skapat i Fortnox (nr ${fortnoxInvoice.DocumentNumber}) — ${invoice.invoice_number}`,
            user.id,
            authorName
          )
        } catch {
          // Logga tyst
        }
      }

      toast.success(`Utkast skapat i Fortnox (nr ${fortnoxInvoice.DocumentNumber})`)
      await loadInvoice()
      onStatusChange?.()
    } catch (err: any) {
      console.error(err)
      toast.error('Kunde inte skicka till Fortnox: ' + (err.message || 'Okänt fel'))
    } finally {
      setSendingToFortnox(false)
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
  // Privat = visa pris inkl. moms i UI. Företag/avtal = exkl. moms. (Lagring/Fortnox påverkas inte.)
  const isPrivate = invoice?.case_type === 'private'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — bredare för split-view */}
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold text-white">
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

        {/* Content — split-view desktop, stacked mobile */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Vänster: Fakturadetaljer */}
          <div className="flex-1 min-h-0 overflow-y-auto lg:border-r lg:border-slate-700">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                <span className="ml-2 text-slate-400">Laddar...</span>
              </div>
            ) : invoice ? (
              <div className="p-4 space-y-4">
                {/* Kundinformation */}
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <h3 className="text-xs font-medium text-slate-400 mb-2">Kundinformation</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-white font-medium">{invoice.customer_name}</div>
                        {invoice.organization_number && (
                          <div className="text-xs text-slate-400">{invoice.case_type === 'private' ? 'Personnr' : 'Org.nr'}: {invoice.organization_number}</div>
                        )}
                      </div>
                    </div>
                    {invoice.customer_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-300 truncate">{invoice.customer_email}</span>
                      </div>
                    )}
                    {invoice.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-300">{invoice.customer_phone}</span>
                      </div>
                    )}
                    {invoice.customer_address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <span className="text-sm text-slate-300">{invoice.customer_address}</span>
                      </div>
                    )}
                    {invoice.fastighetsbeteckning && (
                      <div className="flex items-start gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-slate-400">Fastighetsbeteckning</div>
                          <div className="text-sm text-white">{invoice.fastighetsbeteckning}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Datum — kompakt */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Skapad
                    </div>
                    <div className="text-sm text-white font-medium">{formatInvoiceDate(invoice.created_at)}</div>
                  </div>
                  <div className={`rounded-lg p-3 ${isOverdue ? 'bg-red-500/20' : 'bg-slate-800/50'}`}>
                    <div className={`flex items-center gap-1.5 text-xs mb-1 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      Förfaller
                    </div>
                    <div className={`text-sm font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                      {formatInvoiceDate(invoice.due_date)}
                      {isOverdue && <span className="text-xs ml-1">(Förfallen)</span>}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Building2 className="w-3.5 h-3.5" />
                      Ärendetyp
                    </div>
                    <div className="text-sm text-white font-medium">
                      {invoice.case_type === 'private' ? 'Privatperson' : 'Företag'}
                    </div>
                  </div>
                </div>

                {/* Fakturarader */}
                <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <h3 className="text-xs font-medium text-slate-400">Fakturarader</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-900/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Artikel</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Antal</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Pris</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rabatt</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Moms</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {invoice.items.map(item => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <div className="text-sm text-white">{item.article_name}</div>
                              {item.article_code && (
                                <div className="text-xs text-slate-500">{item.article_code}</div>
                              )}
                              {item.rot_rut_type && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">
                                    {item.rot_rut_type} ({ROT_RUT_PERCENT[item.rot_rut_type]}%)
                                  </span>
                                  {item.fastighetsbeteckning && (
                                    <span className="text-[10px] text-slate-500">
                                      Fastighet: {item.fastighetsbeteckning}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-slate-300">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-300">
                              {formatInvoiceAmount(isPrivate ? item.unit_price * (1 + item.vat_rate / 100) : item.unit_price)}
                            </td>
                            <td className="px-3 py-2 text-right text-sm">
                              {item.discount_percent > 0 ? (
                                <span className="text-orange-400">-{item.discount_percent}%</span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-slate-400">
                              {item.vat_rate}%
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-white font-medium">
                              {formatInvoiceAmount(isPrivate ? item.total_price * (1 + item.vat_rate / 100) : item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summering */}
                <div className="bg-slate-800/50 rounded-lg p-3">
                  {(() => {
                    const rotRutDeduction = invoice.items.reduce((sum, item) =>
                      sum + calculateRotRutDeduction(item.total_price, item.rot_rut_type), 0)
                    return (
                      <div className="space-y-1.5">
                        {!isPrivate && (
                          <>
                            <div className="flex justify-between text-sm text-slate-400">
                              <span>Summa exkl. moms</span>
                              <span className="text-white">{formatInvoiceAmount(invoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-400">
                              <span>Moms</span>
                              <span className="text-white">{formatInvoiceAmount(invoice.vat_amount)}</span>
                            </div>
                          </>
                        )}
                        <div className={`${!isPrivate ? 'pt-2 border-t border-slate-700 ' : ''}flex justify-between items-baseline`}>
                          <span className="text-sm font-semibold text-white">Totalt{isPrivate ? ' (inkl. moms)' : ''}</span>
                          <span className="text-xl font-bold text-emerald-400">
                            {formatInvoiceAmount(invoice.total_amount)}
                          </span>
                        </div>
                        {rotRutDeduction > 0 && (
                          <>
                            <div className="flex justify-between text-sm text-[#20c58f]">
                              <span>{invoice.rot_rut_type}-avdrag ({ROT_RUT_PERCENT[invoice.rot_rut_type!]}%)</span>
                              <span>-{formatInvoiceAmount(rotRutDeduction)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-700 flex justify-between items-baseline">
                              <span className="text-sm font-semibold text-[#20c58f]">Att betala efter avdrag</span>
                              <span className="text-xl font-bold text-[#20c58f]">
                                {formatInvoiceAmount(invoice.total_amount - rotRutDeduction)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Kostnadsuppdelning per tjänst (från Prisguiden) */}
                {(() => {
                  const articleItems = caseBillingItems.filter(i => i.item_type === 'article')
                  if (articleItems.length === 0) return null

                  const serviceRows = invoice.items.filter(i => i.case_billing_item_id)
                  if (serviceRows.length === 0) return null

                  // Mappa artiklar per tjänst
                  const articlesByService = new Map<string, CaseBillingItem[]>()
                  const unmapped: CaseBillingItem[] = []
                  for (const art of articleItems) {
                    if (art.mapped_service_id && serviceRows.some(s => s.case_billing_item_id === art.mapped_service_id)) {
                      const list = articlesByService.get(art.mapped_service_id) || []
                      list.push(art)
                      articlesByService.set(art.mapped_service_id, list)
                    } else {
                      unmapped.push(art)
                    }
                  }

                  // Räkna total kostnad & total marginal — ALLTID på exkl.-basen (momsen är aldrig bolagets intäkt).
                  const totalCost = articleItems.reduce((sum, a) => sum + a.total_price, 0)
                  const totalRevenue = invoice.subtotal
                  const totalMargin = calculateMarginPercent(totalRevenue, totalCost)

                  return (
                    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="text-xs font-medium text-slate-400">
                          Kostnadsuppdelning per tjänst
                          <span className="ml-2 text-slate-500 font-normal">
                            — så här kalkylerade teknikern priset
                          </span>
                        </h3>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400">
                            Inköpskostnad: <span className="text-white font-medium">{formatInvoiceAmount(totalCost)}</span>
                          </span>
                          <span className={`font-semibold ${totalMargin >= 50 ? 'text-emerald-400' : totalMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                            {totalMargin.toFixed(1)}% marginal
                          </span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-700/50">
                        {serviceRows.map(serviceRow => {
                          const svcId = serviceRow.case_billing_item_id!
                          const mappedArticles = articlesByService.get(svcId) || []
                          const svcCost = mappedArticles.reduce((sum, a) => sum + a.total_price, 0)
                          // Marginal räknas på exkl.-basen — total_price är redan exkl. för alla ärendetyper.
                          const svcRevenue = serviceRow.total_price
                          const svcMargin = calculateMarginPercent(svcRevenue, svcCost)
                          const isExpanded = expandedServices.has(svcId)

                          if (mappedArticles.length === 0) {
                            return (
                              <div key={serviceRow.id} className="px-3 py-2 flex items-center justify-between text-sm">
                                <span className="text-slate-300">{serviceRow.article_name}</span>
                                <span className="text-xs text-slate-500">Inga interna kostnader tilldelade</span>
                              </div>
                            )
                          }

                          return (
                            <div key={serviceRow.id}>
                              <button
                                onClick={() => {
                                  const next = new Set(expandedServices)
                                  if (next.has(svcId)) next.delete(svcId)
                                  else next.add(svcId)
                                  setExpandedServices(next)
                                }}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/30 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded
                                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                  <span className="text-sm text-white">{serviceRow.article_name}</span>
                                  <span className="text-xs text-slate-500">
                                    {mappedArticles.length} {mappedArticles.length === 1 ? 'kostnadspost' : 'kostnadsposter'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-slate-400">
                                    Kostnad <span className="text-slate-200">{formatInvoiceAmount(svcCost)}</span>
                                  </span>
                                  <span className="text-slate-400">
                                    Intäkt <span className="text-slate-200">{formatInvoiceAmount(svcRevenue)}</span>
                                  </span>
                                  <span className={`font-semibold min-w-[60px] text-right ${svcMargin >= 50 ? 'text-emerald-400' : svcMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {svcMargin.toFixed(1)}%
                                  </span>
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="bg-slate-900/50 px-3 py-2">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="text-[10px] text-slate-500 uppercase">
                                        <th className="text-left py-1 font-medium">Artikel</th>
                                        <th className="text-right py-1 font-medium">À-pris</th>
                                        <th className="text-right py-1 font-medium">Antal</th>
                                        <th className="text-right py-1 font-medium">Summa</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {mappedArticles.map(art => (
                                        <tr key={art.id} className="text-xs">
                                          <td className="py-1 text-slate-300">
                                            <span className="text-slate-500 mr-2">{art.article_code}</span>
                                            {art.article_name}
                                          </td>
                                          <td className="py-1 text-right text-slate-400">
                                            {formatInvoiceAmount(art.unit_price)}
                                          </td>
                                          <td className="py-1 text-right text-slate-400">
                                            {art.quantity} st
                                          </td>
                                          <td className="py-1 text-right text-slate-200 font-medium">
                                            {formatInvoiceAmount(art.total_price)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {unmapped.length > 0 && (
                          <div className="px-3 py-2 bg-slate-900/30">
                            <div className="text-xs text-slate-500 mb-1">
                              Ej tilldelade interna kostnader ({formatInvoiceAmount(unmapped.reduce((s, a) => s + a.total_price, 0))})
                            </div>
                            <div className="space-y-0.5">
                              {unmapped.map(art => (
                                <div key={art.id} className="flex justify-between text-xs text-slate-400">
                                  <span>
                                    <span className="text-slate-500 mr-2">{art.article_code}</span>
                                    {art.article_name} × {art.quantity}
                                  </span>
                                  <span>{formatInvoiceAmount(art.total_price)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* ROT/RUT att ansöka om — framträdande ruta */}
                {(() => {
                  const rotRutDeduction = invoice.items.reduce((sum, item) =>
                    sum + calculateRotRutDeduction(item.total_price, item.rot_rut_type), 0)
                  if (rotRutDeduction <= 0) return null
                  return (
                    <div className="bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-[#20c58f]" />
                        <h3 className="text-sm font-semibold text-[#20c58f]">Att ansöka om hos Skatteverket</h3>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-slate-300">
                            {invoice.rot_rut_type}-avdrag ({ROT_RUT_PERCENT[invoice.rot_rut_type!]}%)
                          </span>
                          <span className="text-lg font-bold text-[#20c58f]">
                            {formatInvoiceAmount(rotRutDeduction)}
                          </span>
                        </div>
                        {invoice.fastighetsbeteckning && (
                          <div className="text-xs text-slate-400">
                            Fastighetsbeteckning: <span className="text-slate-300">{invoice.fastighetsbeteckning}</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-400">
                          Kund: <span className="text-slate-300">{invoice.customer_name}</span>
                          {invoice.organization_number && ` (${invoice.case_type === 'private' ? 'Personnr' : 'Org.nr'}: ${invoice.organization_number})`}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Varning om inaktuella fakturarader */}
                {staleInfo?.stale && (
                  <div className="flex items-center justify-between gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-amber-400">Fakturan är inaktuell</div>
                        <p className="text-xs text-amber-300/80 mt-0.5">
                          {staleInfo.reason} sedan fakturan skapades
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                      Uppdatera
                    </button>
                  </div>
                )}

                {/* Varning om rabatt kräver godkännande */}
                {invoice.requires_approval && invoice.status === 'pending_approval' && (
                  <div className="flex items-start gap-3 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-orange-400">Rabatt kräver godkännande</div>
                      <p className="text-xs text-orange-300 mt-0.5">
                        Fakturan innehåller rabatterade artiklar och måste godkännas innan den kan skickas.
                      </p>
                    </div>
                  </div>
                )}

                {/* Märkning faktura */}
                {invoice.invoice_marking && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <h3 className="text-xs font-medium text-slate-400 mb-1.5">Märkning faktura</h3>
                    <p className="text-sm text-slate-300">{invoice.invoice_marking}</p>
                  </div>
                )}

                {/* Anteckningar */}
                {invoice.notes && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <h3 className="text-xs font-medium text-slate-400 mb-1.5">Anteckningar</h3>
                    <p className="text-sm text-slate-300">{invoice.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                Faktura hittades inte
              </div>
            )}
          </div>

          {/* Höger: Ärendekontext + Kommunikation */}
          {invoice && (
            <div className="lg:w-[400px] flex-shrink-0 flex flex-col min-h-0 border-t lg:border-t-0 border-slate-700">
              {/* Desktop: always visible context + comm */}
              <div className="hidden lg:flex lg:flex-col lg:h-full lg:min-h-0">
                {/* Ärendekontext — scrollbar topp-del */}
                <div className="flex-shrink-0 max-h-[45%] overflow-y-auto border-b border-slate-700">
                  {contextLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                  ) : caseContext ? (
                    <div className="p-3 space-y-3">
                      {/* Ärendetitel + status */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100 truncate">{caseContext.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${caseContext.statusColor}20`,
                              color: caseContext.statusColor
                            }}
                          >
                            {caseContext.status}
                          </span>
                          {caseContext.pestType && (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                              <Bug className="w-3 h-3" />
                              {caseContext.pestType}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tekniker */}
                      {(caseContext.primaryAssigneeName || caseContext.secondaryAssigneeName) && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                            <Users className="w-3 h-3 text-blue-400" />
                            Tekniker
                          </h4>
                          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50 space-y-0.5">
                            {caseContext.primaryAssigneeName && (
                              <p className="text-sm text-slate-200">{caseContext.primaryAssigneeName}</p>
                            )}
                            {caseContext.secondaryAssigneeName && (
                              <p className="text-sm text-slate-400">{caseContext.secondaryAssigneeName}</p>
                            )}
                            {caseContext.tertiaryAssigneeName && (
                              <p className="text-sm text-slate-400">{caseContext.tertiaryAssigneeName}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Schema */}
                      {(caseContext.startDate || caseContext.dueDate) && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                            <Calendar className="w-3 h-3 text-purple-400" />
                            Schemalagt
                          </h4>
                          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50 space-y-1">
                            {caseContext.startDate && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span className="text-slate-400">Start:</span>
                                <span className="text-slate-200">{formatSwedishDateTime(caseContext.startDate)}</span>
                              </div>
                            )}
                            {caseContext.dueDate && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span className="text-slate-400">Slut:</span>
                                <span className="text-slate-200">{formatSwedishDateTime(caseContext.dueDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Beskrivning */}
                      {caseContext.description && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                            <FileText className="w-3 h-3 text-blue-400" />
                            Beskrivning
                          </h4>
                          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">{caseContext.description}</p>
                          </div>
                        </div>
                      )}

                      {/* Saneringsrapport */}
                      {caseContext.rapport && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-amber-400 uppercase tracking-wide">
                            <ClipboardCheck className="w-3 h-3" />
                            Dokumentation Tekniker
                          </h4>
                          <div className="bg-amber-500/5 rounded-lg p-2.5 border border-amber-500/20">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">{caseContext.rapport}</p>
                          </div>
                        </div>
                      )}

                      {/* Arbetstid */}
                      {formatTimeSpent(caseContext.timeSpentMinutes) && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                            <Timer className="w-3 h-3 text-green-400" />
                            Arbetstid
                          </h4>
                          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                            <p className="text-sm text-slate-200 font-medium">{formatTimeSpent(caseContext.timeSpentMinutes)}</p>
                          </div>
                        </div>
                      )}

                      {/* ROT/RUT */}
                      {caseContext.rotRut && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                            <Home className="w-3 h-3 text-[#20c58f]" />
                            {caseContext.rotRut}-avdrag
                          </h4>
                          <div className="bg-[#20c58f]/5 rounded-lg p-2.5 border border-[#20c58f]/20">
                            <span className="px-1.5 py-0.5 text-xs rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">
                              {caseContext.rotRut}
                            </span>
                            {caseContext.fastighetsbeteckning && (
                              <p className="text-xs text-slate-400 mt-1">Fastighet: {caseContext.fastighetsbeteckning}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Preparat */}
                      {preparations.length > 0 && (
                        <div className="space-y-1">
                          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                            <FlaskConical className="w-3 h-3 text-teal-400" />
                            Använda preparat
                          </h4>
                          <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 divide-y divide-slate-700/50">
                            {preparations.map(p => (
                              <div key={p.id} className="px-2.5 py-2 flex items-center justify-between">
                                <div>
                                  <span className="text-sm text-slate-200">{p.preparation?.name || 'Okänt preparat'}</span>
                                  {p.preparation?.type && (
                                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-teal-500/20 text-teal-400 font-medium">
                                      {p.preparation.type}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-400">{p.quantity} {p.unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Plats */}
                      {caseContext.address && (
                        <EmbeddedMapPreview
                          lat={caseContext.addressLat}
                          lng={caseContext.addressLng}
                          address={caseContext.address}
                          height={120}
                        />
                      )}

                      {/* Bilder */}
                      <CaseContextImagePreview
                        caseId={caseContext.id}
                        caseType={caseContext.caseType}
                        maxThumbnails={4}
                      />
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Kunde inte ladda ärendedata
                    </div>
                  )}
                </div>

                {/* Kommunikation */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/30">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Kommunikation</span>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col px-3 py-2">
                    <CommentSection
                      caseId={invoice.case_id}
                      caseType={invoice.case_type as CaseType}
                      caseTitle={caseContext?.title || invoice.customer_name}
                      compact={true}
                    />
                  </div>
                </div>
              </div>

              {/* Mobil: Collapsible ärendekontext + kommunikation */}
              <div className="lg:hidden">
                <button
                  onClick={() => setContextExpanded(!contextExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    Ärende & Kommunikation
                  </span>
                  {contextExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {contextExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Ärendekontext — kompakt mobil */}
                    {caseContext && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: `${caseContext.statusColor}20`,
                              color: caseContext.statusColor
                            }}
                          >
                            {caseContext.status}
                          </span>
                          {caseContext.pestType && (
                            <span className="text-xs text-orange-400">{caseContext.pestType}</span>
                          )}
                          {caseContext.primaryAssigneeName && (
                            <span className="text-xs text-slate-400">• {caseContext.primaryAssigneeName}</span>
                          )}
                          {formatTimeSpent(caseContext.timeSpentMinutes) && (
                            <span className="text-xs text-green-400">• {formatTimeSpent(caseContext.timeSpentMinutes)}</span>
                          )}
                        </div>
                        {caseContext.rapport && (
                          <div className="bg-amber-500/5 rounded-lg p-2 border border-amber-500/20">
                            <p className="text-xs text-slate-300 line-clamp-3">{caseContext.rapport}</p>
                          </div>
                        )}
                        {preparations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {preparations.map(p => (
                              <span key={p.id} className="px-1.5 py-0.5 text-[10px] rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                {p.preparation?.name} ({p.quantity} {p.unit})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Kommunikation */}
                    <div className="min-h-[200px]">
                      <CommentSection
                        caseId={invoice.case_id}
                        caseType={invoice.case_type as CaseType}
                        caseTitle={caseContext?.title || invoice.customer_name}
                        compact={true}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer med åtgärder */}
        {invoice && (
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-700 bg-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportera
              </button>
              {invoice.fortnox_document_number && (
                <a
                  href={`https://app.fortnox.se/f/faktura/fakturalista/${invoice.fortnox_document_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm text-[#20c58f] rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Fortnox (nr {invoice.fortnox_document_number})
                </a>
              )}
            </div>

            <div className="flex gap-2">
              {(invoice.status === 'pending_approval' || invoice.status === 'ready') && (
                <button
                  onClick={handleSendToFortnox}
                  disabled={sendingToFortnox}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1bb07e] text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {sendingToFortnox
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <FileEdit className="w-3.5 h-3.5" />}
                  {sendingToFortnox ? 'Skapar utkast...' : 'Skapa utkast i Fortnox'}
                </button>
              )}
              {invoice.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('booked')}
                  disabled={updating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <BookCheck className="w-3.5 h-3.5" />
                  Bokför
                </button>
              )}
              {invoice.status === 'booked' && (
                <button
                  onClick={() => handleStatusChange('sent')}
                  disabled={updating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Markera skickad
                </button>
              )}
              {invoice.status === 'sent' && (
                <button
                  onClick={() => handleStatusChange('paid')}
                  disabled={updating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Markera betald
                </button>
              )}
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Makulera
                </button>
              )}
              {invoice.status === 'cancelled' && (
                <>
                  <button
                    onClick={() => handleStatusChange('ready')}
                    disabled={updating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Återställ
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={updating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Radera
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
