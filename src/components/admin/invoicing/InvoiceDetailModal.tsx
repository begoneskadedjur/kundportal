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
import { resolveFortnoxCustomerNumber } from '../../../utils/fortnoxCustomerResolver'
import { isPersonnummer } from '../../../services/fortnoxService'
import type { InvoiceWithItems, InvoiceStatus } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'
import { ROT_RUT_PERCENT } from '../../../types/caseBilling'
import { calculateRotRutSummary } from '../../../utils/rotRutConstants'
import type { CaseBillingItem } from '../../../types/caseBilling'
import { useCaseContext } from '../../../hooks/useCaseContext'
import type { CaseContext } from '../../../hooks/useCaseContext'
import { formatSwedishDateTime } from '../../../types/database'
import ServiceCostBreakdown from '../../shared/ServiceCostBreakdown'
import CaseModalSection from '../../shared/CaseModalSection'
import InvoiceStatusStepper from '../../shared/InvoiceStatusStepper'
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

// Delat "Utfört arbete"-innehåll — samma JSX för desktop-sektionen och
// den utfällbara mobilvyn: metadatarad + arbetsrapport med visa mer-toggle
// + använda preparat + bilder. Ren presentation, ingen datahämtning.
function WorkPerformedContent({
  caseContext,
  preparations
}: {
  caseContext: CaseContext | null
  preparations: CasePreparationWithDetails[]
}) {
  const [reportExpanded, setReportExpanded] = useState(false)

  if (!caseContext) {
    return <p className="text-sm text-slate-500 py-1">Ingen arbetsrapport ännu</p>
  }

  const timeSpent = formatTimeSpent(caseContext.timeSpentMinutes)

  return (
    <div className="space-y-2.5">
      {/* Metadata: tekniker · utförandedatum · arbetstid · skadedjur */}
      {(caseContext.primaryAssigneeName || caseContext.startDate || timeSpent || caseContext.pestType) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {caseContext.primaryAssigneeName && (
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <User className="w-3.5 h-3.5 text-green-400" />
              {caseContext.primaryAssigneeName}
            </span>
          )}
          {caseContext.startDate && (
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              {formatSwedishDateTime(caseContext.startDate)}
            </span>
          )}
          {timeSpent && (
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <Timer className="w-3.5 h-3.5 text-green-400" />
              {timeSpent}
            </span>
          )}
          {caseContext.pestType && (
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <Bug className="w-3.5 h-3.5 text-orange-400" />
              {caseContext.pestType}
            </span>
          )}
        </div>
      )}

      {/* Arbetsrapport */}
      {caseContext.rapport ? (
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <p className={`text-sm text-slate-300 whitespace-pre-wrap ${reportExpanded ? '' : 'line-clamp-6'}`}>
            {caseContext.rapport}
          </p>
          <button
            type="button"
            onClick={() => setReportExpanded(!reportExpanded)}
            className="mt-1.5 text-xs text-[#20c58f] hover:text-[#1bb07e]"
          >
            {reportExpanded ? 'Visa mindre' : 'Visa mer'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Ingen arbetsrapport ännu</p>
      )}

      {/* Använda preparat */}
      {preparations.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <FlaskConical className="w-3.5 h-3.5 text-teal-400" />
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

      {/* Bilder */}
      <CaseContextImagePreview
        caseId={caseContext.id}
        caseType={caseContext.caseType}
        maxThumbnails={4}
      />
    </div>
  )
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
  const [syncing, setSyncing] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(false)
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [savingDueDate, setSavingDueDate] = useState(false)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [preparations, setPreparations] = useState<CasePreparationWithDetails[]>([])
  const [staleInfo, setStaleInfo] = useState<{ stale: boolean; reason?: string } | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [caseBillingItems, setCaseBillingItems] = useState<CaseBillingItem[]>([])
  const [contractCustomer, setContractCustomer] = useState<{
    contact_person: string | null
    contact_email: string | null
    contact_phone: string | null
    contact_address: string | null
    billing_frequency: string | null
    billing_anchor_month: number | null
    annual_value: number | null
    contract_start_date: string | null
    contract_end_date: string | null
    terminated_at: string | null
    assigned_account_manager: string | null
    account_manager_email: string | null
  } | null>(null)

  // För avtalsfakturor: ladda kunddata + kartposition för rikt sidofält
  useEffect(() => {
    if (!invoice || !invoice.customer_id || (invoice.invoice_type !== 'contract' && invoice.invoice_type !== 'adhoc')) {
      setContractCustomer(null)
      return
    }
    const fetch = async () => {
      const { data } = await supabase
        .from('customers')
        .select('contact_person, contact_email, contact_phone, contact_address, billing_frequency, billing_anchor_month, annual_value, contract_start_date, contract_end_date, terminated_at, assigned_account_manager, account_manager_email')
        .eq('id', invoice.customer_id)
        .maybeSingle()
      setContractCustomer(data as any ?? null)
    }
    fetch()
  }, [invoice?.customer_id, invoice?.invoice_type])

  // Ad-hoc/avtalsfakturor har case_type = null (constraint tillåter bara null/private/business),
  // men deras ärende är ett contract-ärende. Härled 'contract' så ärendekontext,
  // preparat och kommunikationspanelen kan matcha case_comments (som triggern
  // handle_invoice_paid skriver med case_type='contract').
  const effectiveCaseType: CaseType | null = invoice
    ? (invoice.case_type as CaseType | null) ??
      ((invoice.invoice_type === 'adhoc' || invoice.invoice_type === 'contract') ? 'contract' : null)
    : null

  // Hämta ärendekontext via case_id + härledd ärendetyp — för contract/adhoc
  // pekar invoice.case_id på cases-tabellen, som hooken stöder via caseType 'contract'
  const { caseContext, isLoading: contextLoading } = useCaseContext(
    isOpen && invoice ? invoice.case_id : null,
    isOpen && invoice ? effectiveCaseType : null
  )

  // Hämta preparat för ärendet (Privat/Företag + contract/adhoc via härledd ärendetyp)
  useEffect(() => {
    if (!invoice) { setPreparations([]); return }
    if (!invoice.case_id || !effectiveCaseType) { setPreparations([]); return }
    const fetchPreparations = async () => {
      const { data } = await supabase
        .from('case_preparations')
        .select('*, preparation:preparations(*)')
        .eq('case_id', invoice.case_id)
        .eq('case_type', effectiveCaseType)
        .order('created_at', { ascending: true })
      setPreparations((data as CasePreparationWithDetails[] | null) || [])
    }
    fetchPreparations()
  }, [invoice?.case_id, invoice?.case_type, invoice?.invoice_type])

  // Hämta case_billing_items (interna kostnader + tjänster) för att bygga kostnadsuppdelning
  useEffect(() => {
    if (!invoice) { setCaseBillingItems([]); return }
    const fetchCaseBilling = async () => {
      // Ad-hoc/merförsäljning: kostnaderna ligger på det avslutade ärendets case_billing_items.
      // Vägen dit går via fakturans rader → contract_billing_items.case_id (det riktiga ärendet).
      if (invoice.invoice_type === 'adhoc') {
        const cbItemIds = (invoice.items || [])
          .map(i => (i as { contract_billing_item_id?: string | null }).contract_billing_item_id)
          .filter(Boolean) as string[]
        if (cbItemIds.length === 0) { setCaseBillingItems([]); return }

        const { data: cbItems } = await supabase
          .from('contract_billing_items')
          .select('case_id')
          .in('id', cbItemIds)
        const caseIds = Array.from(
          new Set(((cbItems as { case_id: string | null }[] | null) || [])
            .map(c => c.case_id)
            .filter(Boolean) as string[])
        )
        if (caseIds.length === 0) { setCaseBillingItems([]); return }

        const { data } = await supabase
          .from('case_billing_items')
          .select('*')
          .in('case_id', caseIds)
          .eq('case_type', 'contract')
        setCaseBillingItems((data as CaseBillingItem[] | null) || [])
        return
      }
      // Återkommande avtalsfaktura: hämta från kundens importerade contract.
      if (invoice.invoice_type === 'contract' && invoice.customer_id) {
        const { data: contract } = await supabase
          .from('contracts')
          .select('id')
          .eq('customer_id', invoice.customer_id)
          .eq('oneflow_contract_id', `imported-${invoice.customer_id}`)
          .maybeSingle()
        if (contract) {
          const { data } = await supabase
            .from('case_billing_items')
            .select('*')
            .eq('case_id', contract.id)
            .eq('case_type', 'contract')
          setCaseBillingItems((data as CaseBillingItem[] | null) || [])
          return
        }
        setCaseBillingItems([])
        return
      }
      // Privat/Företag-ärenden
      if (!invoice.case_id || !invoice.case_type) { setCaseBillingItems([]); return }

      // Hämta service-items kopplade till denna faktura
      const serviceIds = (invoice.items || [])
        .map(i => i.case_billing_item_id)
        .filter(Boolean) as string[]

      if (serviceIds.length === 0) { setCaseBillingItems([]); return }

      // Hämta service-items + article-items kopplade till dessa tjänster (via mapped_service_id)
      const { data } = await supabase
        .from('case_billing_items')
        .select('*')
        .eq('case_id', invoice.case_id)
        .eq('case_type', invoice.case_type)
        .or(`id.in.(${serviceIds.join(',')}),mapped_service_id.in.(${serviceIds.join(',')})`)
      setCaseBillingItems((data as CaseBillingItem[] | null) || [])
    }
    fetchCaseBilling()
  }, [invoice?.case_id, invoice?.case_type, invoice?.invoice_type, invoice?.customer_id, invoice?.items])

  // Ärendenumret för fakturans kopplade ärende - visas i headern så att
  // kopplingen faktura ↔ ärende alltid är synlig (fakturanumret i sig är
  // en obruten löpande serie och kan inte bygga på ärendenumret)
  const [linkedCaseNumber, setLinkedCaseNumber] = useState<string | null>(null)
  useEffect(() => {
    if (!invoice?.case_id) { setLinkedCaseNumber(null); return }
    const table = invoice.case_type === 'private'
      ? 'private_cases'
      : invoice.case_type === 'business'
        ? 'business_cases'
        : 'cases'
    supabase
      .from(table)
      .select('case_number')
      .eq('id', invoice.case_id)
      .maybeSingle()
      .then(({ data }) => setLinkedCaseNumber(data?.case_number || null))
  }, [invoice?.case_id, invoice?.case_type])

  // Avtalstillägg på fakturans rader: pro rata-pris, inte rabatt.
  // Detaljerna (premieändring, från-datum) hämtas från tilläggslogen.
  const additionRowIds = caseBillingItems
    .filter(i => i.contract_addition_annual != null)
    .map(i => i.id)
  const realDiscountRows = caseBillingItems
    .filter(i => Number(i.discount_percent) > 0 && i.contract_addition_annual == null)
  const [contractAdditions, setContractAdditions] = useState<{
    description: string
    prorated_amount: number
    previous_annual_value: number
    new_annual_value: number
    effective_from: string
    created_by_name: string | null
  }[]>([])
  useEffect(() => {
    if (additionRowIds.length === 0) { setContractAdditions([]); return }
    const fetchAdditions = async () => {
      const { data } = await supabase
        .from('contract_additions')
        .select('description, prorated_amount, previous_annual_value, new_annual_value, effective_from, created_by_name')
        .in('case_billing_item_id', additionRowIds)
      setContractAdditions(data || [])
    }
    fetchAdditions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionRowIds.join(',')])

  // Ladda fakturadata
  useEffect(() => {
    if (isOpen && invoiceId) {
      loadInvoice()
    }
  }, [isOpen, invoiceId])

  // Reset context expanded on close
  useEffect(() => {
    if (!isOpen) {
      setContextExpanded(false)
      setEditingDueDate(false)
    }
  }, [isOpen])

  // Synka due-date-draft när invoice laddas
  useEffect(() => {
    if (invoice?.due_date) setDueDateDraft(invoice.due_date)
  }, [invoice?.due_date])

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

  const handleSyncFromFortnox = async () => {
    if (!invoice?.fortnox_document_number) return
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Du måste vara inloggad')
        return
      }
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/fortnox-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoice_number: invoice.fortnox_document_number }),
      })
      if (!res.ok) throw new Error(`Sync misslyckades (${res.status})`)
      const data = await res.json()
      const result = data.results?.[0]
      if (!result || result.skipped) {
        toast(result?.skipped ? `Inget att uppdatera: ${result.skipped}` : 'Inget att uppdatera')
      } else {
        toast.success(`Synkat till status "${result.fortnoxStatus}"`)
      }
      await loadInvoice()
      onStatusChange?.()
    } catch (err: any) {
      console.error('Sync error:', err)
      toast.error(err.message || 'Kunde inte synka från Fortnox')
    } finally {
      setSyncing(false)
    }
  }

  const handleSendToFortnox = async () => {
    if (!invoice) return
    setSendingToFortnox(true)
    try {
      // 1. Hämta kundnummer — primärt via fakturans customer_id (exakt rad,
      // klarar multisite-enheter som delar org.nr), fallback via org.nr för
      // äldre fakturor utan customer_id. Org.nr-uppslaget är deterministiskt
      // (äldsta raden med kundnummer) eftersom org.nr inte längre är unikt.
      let customerNumber: number | null = null
      if (invoice.customer_id) {
        customerNumber = await resolveFortnoxCustomerNumber(invoice.customer_id)
      }
      if (!customerNumber && invoice.organization_number) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('customer_number')
          .eq('organization_number', invoice.organization_number)
          .not('customer_number', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        customerNumber = (customerData as any)?.customer_number ?? null
      }

      if (!customerNumber) {
        toast.error('Kunden saknar kundnummer — lägg till det på kundkortet innan du skickar till Fortnox')
        return
      }

      // 1b. Hämta ärende-metadata FÖRE kundskapandet — teknikerns namn ska in
      // som Vår referens på både kundkortet och fakturan.
      let caseMetaEarly: {
        case_number?: string | null
        completed_date?: string | null
        start_date?: string | null
        primary_assignee_name?: string | null
        invoice_marking?: string | null
      } | null = null
      if (invoice.case_id) {
        if (effectiveCaseType === 'contract') {
          const { data } = await supabase
            .from('cases')
            .select('case_number, completed_date, scheduled_start, primary_technician_name, invoice_marking')
            .eq('id', invoice.case_id)
            .maybeSingle()
          if (data) {
            const d = data as any
            caseMetaEarly = {
              case_number: d.case_number,
              completed_date: d.completed_date,
              start_date: d.scheduled_start,
              primary_assignee_name: d.primary_technician_name,
              invoice_marking: d.invoice_marking,
            }
          }
        } else if (invoice.case_type === 'business') {
          const { data } = await supabase
            .from('business_cases')
            .select('case_number, completed_date, start_date, primary_assignee_name, markning_faktura')
            .eq('id', invoice.case_id)
            .maybeSingle()
          if (data) {
            const d = data as any
            caseMetaEarly = { ...d, invoice_marking: d.markning_faktura }
          }
        } else {
          const { data } = await supabase
            .from('private_cases')
            .select('case_number, completed_date, start_date, primary_assignee_name')
            .eq('id', invoice.case_id)
            .maybeSingle()
          caseMetaEarly = (data as any) || null
        }
      }
      const technicianName = caseMetaEarly?.primary_assignee_name ?? null

      // Fakturamärkningen kan ha lagts till i ärendet EFTER att fakturan
      // skapades - ärendets aktuella värde vinner över fakturans snapshot,
      // så att "Er referens" i Fortnox alltid speglar senaste märkningen.
      const effectiveMarking = caseMetaEarly?.invoice_marking?.trim() || invoice.invoice_marking || null
      if (effectiveMarking && effectiveMarking !== invoice.invoice_marking) {
        await supabase.from('invoices').update({ invoice_marking: effectiveMarking }).eq('id', invoice.id)
      }

      // 2. Hämta eller skapa kund i Fortnox.
      // Privatpersoner: Type=PRIVATE, 10 dagars betalningsvillkor, priser inkl.
      // moms på kundkortet. Företag: Type=COMPANY. Teknikern sätts som Vår
      // referens. Adressen delas upp i gata/postnr/ort i fortnoxService.
      const isPrivatePerson = invoice.case_type === 'private'
        || (invoice.case_type == null && isPersonnummer(invoice.organization_number))
      const fortnoxCustomerNumber = await FortnoxService.findOrCreateCustomer({
        customer_number: customerNumber,
        company_name: invoice.customer_name,
        organization_number: invoice.organization_number,
        billing_email: invoice.customer_email,
        billing_address: invoice.customer_address,
        phone: invoice.customer_phone,
        customer_type: isPrivatePerson ? 'PRIVATE' : 'COMPANY',
        terms_of_payment: isPrivatePerson ? '10' : null,
        show_price_vat_included: isPrivatePerson ? true : undefined,
        our_reference: technicianName,
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

      // 2c. Ärende-metadata hämtades i steg 1b (behövdes redan för kundkortet)
      const caseMeta = caseMetaEarly

      // 3. Bygg fakturarader. ROT/RUT markeras PER RAD (HouseWork +
      // HouseWorkType) — det är så Fortnox API:t fungerar; fakturanivåns
      // TaxReductionType sätts i steg 4. HouseWorkType-kategorierna är
      // Skatteverkets: ROT → CONSTRUCTION, RUT → CLEANING som standard.
      const houseWorkTypeFor = (rotRut: string | null | undefined) =>
        rotRut?.toUpperCase() === 'ROT' ? 'CONSTRUCTION'
        : rotRut?.toUpperCase() === 'RUT' ? 'CLEANING'
        : undefined
      const invoiceRows = invoice.items.map(item => ({
        ArticleNumber: item.article_code || undefined,
        Description: item.article_name,
        DeliveredQuantity: item.quantity,
        Price: item.unit_price,
        VAT: item.vat_rate,
        ...(item.discount_percent > 0 ? { Discount: item.discount_percent, DiscountType: 'PERCENT' } : {}),
        ...((item as any).rot_rut_type && invoice.fastighetsbeteckning
          ? { HouseWork: true, HouseWorkType: houseWorkTypeFor((item as any).rot_rut_type) }
          : {}),
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
      if (effectiveMarking) fortnoxPayload.YourReference = effectiveMarking
      if (invoice.notes) fortnoxPayload.Remarks = invoice.notes

      // ROT/RUT: fakturanivån bär bara typen ('rot'/'rut'); raderna är
      // flaggade i steg 3, och fastighetsbeteckning + avdragsbelopp
      // registreras via taxreductions-resursen efter att fakturan skapats.
      if (invoice.rot_rut_type && invoice.fastighetsbeteckning) {
        fortnoxPayload.TaxReductionType = invoice.rot_rut_type.toLowerCase()
      }

      const fortnoxInvoice = await FortnoxService.createInvoice(fortnoxPayload)

      // 4b. Registrera ROT/RUT-avdraget (fastighetsbeteckning) mot fakturan.
      // Fel här får inte stoppa flödet — fakturan finns redan i Fortnox;
      // admin kompletterar avdraget manuellt om registreringen misslyckas.
      if (invoice.rot_rut_type && invoice.fastighetsbeteckning) {
        try {
          const rotRutSummary = calculateRotRutSummary(invoice.items)
          await FortnoxService.createTaxReduction({
            asked_amount: rotRutSummary.totalDeduction,
            customer_name: invoice.customer_name,
            property_designation: invoice.fastighetsbeteckning,
            document_number: fortnoxInvoice.DocumentNumber,
            social_security_number: isPrivatePerson ? invoice.organization_number : null,
          })
        } catch (trErr: any) {
          console.error('TaxReduction-registrering misslyckades:', trErr)
          toast.error(
            `Fakturan skapades (nr ${fortnoxInvoice.DocumentNumber}) men ROT/RUT-avdraget kunde inte registreras automatiskt — komplettera fastighetsbeteckningen i Fortnox. (${trErr?.message ?? 'okänt fel'})`
          )
        }
      }

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
  // Förfallodatum kan redigeras tills fakturan är skickad till Fortnox eller terminal
  const canEditDueDate = !!invoice && ['pending_approval', 'ready', 'draft'].includes(invoice.status)

  const handleSaveDueDate = async () => {
    if (!invoice || !dueDateDraft) return
    setSavingDueDate(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ due_date: dueDateDraft })
        .eq('id', invoice.id)
      if (error) throw error
      toast.success('Förfallodatum uppdaterat')
      setEditingDueDate(false)
      await loadInvoice()
      onStatusChange?.()
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte spara förfallodatum')
    } finally {
      setSavingDueDate(false)
    }
  }
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
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold font-mono text-white">
                  {invoice?.invoice_number || '...'}
                </h2>
                {invoice && statusConfig && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {statusConfig.label}
                  </span>
                )}
                {linkedCaseNumber && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono border bg-blue-500/20 text-blue-300 border-blue-500/30"
                    title="Fakturans kopplade ärende"
                  >
                    <ClipboardCheck className="w-3 h-3" />
                    {linkedCaseNumber}
                  </span>
                )}
              </div>
              {invoice && (
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {invoice.customer_name}
                  {invoice.organization_number && <> · {invoice.organization_number}</>}
                  <> · {formatInvoiceAmount(invoice.total_amount)}</>
                </p>
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

        {/* Statusstepper — läsvy av fakturans flöde */}
        {invoice && (
          <div className="flex-shrink-0">
            <InvoiceStatusStepper
              status={invoice.status}
              stepDates={[
                invoice.created_at,
                invoice.approved_at,
                null,
                invoice.booked_at,
                invoice.sent_at,
                invoice.paid_at
              ]}
              isOverdue={isInvoiceOverdue(invoice.due_date, invoice.status)}
              nextStepText={INVOICE_STATUS_CONFIG[invoice.status]?.description}
            />
          </div>
        )}

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

                {/* Avtalstillägg: raden betalas pro rata - inte en rabatt */}
                {contractAdditions.length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg">
                    <RotateCcw className="w-4 h-4 text-[#20c58f] flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-[#20c58f]">Avtalstillägg - betalas pro rata</div>
                      {contractAdditions.map((add, i) => (
                        <p key={i} className="text-xs text-slate-300">
                          <span className="font-medium">{add.description.replace(/^Avtalstillägg:\s*/i, '')}</span>
                          {' '}har lagts till i kundens avtal{add.created_by_name ? ` av ${add.created_by_name}` : ''}.
                          Radpriset {formatInvoiceAmount(Number(add.prorated_amount))} avser återstående tid fram till nästa premieperiod
                          - det är inte ett rabatterat fullpris. Årspremien höjs{' '}
                          {formatInvoiceAmount(Number(add.previous_annual_value))} → {formatInvoiceAmount(Number(add.new_annual_value))}/år
                          {' '}från {formatInvoiceDate(add.effective_from)}.
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kräver godkännande - rabatt-text bara när det finns faktisk rabatt */}
                {invoice.requires_approval && invoice.status === 'pending_approval' && (
                  realDiscountRows.length > 0 ? (
                    <div className="flex items-start gap-3 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1.5 min-w-0">
                        <div className="text-sm font-medium text-orange-400">Rabatt kräver godkännande</div>
                        {realDiscountRows.map(row => (
                          <div key={row.id} className="text-xs text-orange-300">
                            <span className="font-medium">{row.service_name || row.article_name}</span>
                            {' '}-{Number(row.discount_percent)}%
                            {row.discount_motivation?.trim() ? (
                              <span className="block text-slate-300 mt-0.5">Motivering: {row.discount_motivation}</span>
                            ) : (
                              <span className="block text-amber-400 mt-0.5">Motivering saknas</span>
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-orange-300/80">Godkänns av rabattansvarig under Godkännanden.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-slate-300">Kräver godkännande</div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Fakturan måste godkännas innan den kan skickas.
                          {contractAdditions.length > 0 && ' Det låga radpriset är pro rata för ett avtalstillägg - ingen rabatt har lämnats.'}
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Utfört arbete — ärendekontext från teknikern */}
                <CaseModalSection icon={ClipboardCheck} iconClassName="text-amber-400" title="Utfört arbete">
                  {contextLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                    </div>
                  ) : (
                    <WorkPerformedContent caseContext={caseContext} preparations={preparations} />
                  )}
                </CaseModalSection>

                {/* Datum — kompakt */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Skapad
                    </div>
                    <div className="text-sm text-white font-medium">{formatInvoiceDate(invoice.created_at)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Utfört
                    </div>
                    <div className="text-sm text-white font-medium">
                      {caseContext?.startDate ? formatInvoiceDate(caseContext.startDate) : '–'}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isOverdue ? 'bg-red-500/20' : 'bg-slate-800/50'}`}>
                    <div className={`flex items-center justify-between gap-1.5 text-xs mb-1 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Förfaller
                      </span>
                      {canEditDueDate && (
                        <button
                          type="button"
                          onClick={() => setEditingDueDate(true)}
                          className="text-[10px] uppercase tracking-wide text-[#20c58f] hover:text-[#1bb07e]"
                        >
                          Justera
                        </button>
                      )}
                    </div>
                    {editingDueDate && canEditDueDate ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={dueDateDraft}
                          onChange={e => setDueDateDraft(e.target.value)}
                          className="flex-1 px-2 py-0.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                        />
                        <button
                          type="button"
                          onClick={handleSaveDueDate}
                          disabled={savingDueDate}
                          className="px-2 py-0.5 bg-[#20c58f] hover:bg-[#1bb07e] text-[#fff] text-xs rounded disabled:opacity-50"
                        >
                          Spara
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingDueDate(false); setDueDateDraft(invoice.due_date ?? '') }}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
                        >
                          Avbryt
                        </button>
                      </div>
                    ) : (
                      <div className={`text-sm font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                        {formatInvoiceDate(invoice.due_date)}
                        {isOverdue && <span className="text-xs ml-1">(Förfallen)</span>}
                      </div>
                    )}
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
                    const rotRutDeduction = calculateRotRutSummary(invoice.items).totalDeduction
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

                {/* ROT/RUT att ansöka om — framträdande ruta */}
                {(() => {
                  const rotRutDeduction = calculateRotRutSummary(invoice.items).totalDeduction
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

                {/* Intern kalkyl — kostnadsuppdelning per tjänst (från Prisguiden), hopfälld */}
                {(() => {
                  // Tjänsteraderna som artiklarna mappas mot.
                  // Privat/företag: fakturaraderna länkar direkt till case_billing_items via case_billing_item_id.
                  // Ad-hoc/avtal: fakturaraderna länkar via contract_billing_item_id, så vi bygger istället
                  // tjänsteraderna direkt från case_billing_items (vars id är det mapped_service_id pekar på).
                  const isContractOrAdhoc = invoice.invoice_type === 'adhoc' || invoice.invoice_type === 'contract'
                  const serviceRows = isContractOrAdhoc
                    ? caseBillingItems
                        .filter(i => i.item_type === 'service')
                        .map(i => ({
                          id: i.id,
                          serviceItemId: i.id,
                          name: i.service_name || i.article_name,
                          revenue: i.total_price,
                        }))
                    : invoice.items
                        .filter(i => i.case_billing_item_id)
                        .map(i => ({
                          id: i.id,
                          serviceItemId: i.case_billing_item_id!,
                          name: i.article_name,
                          // total_price är exkl. moms för alla ärendetyper — samma bas som artikelkostnaderna.
                          revenue: i.total_price,
                        }))
                  // Pro rata-läge: ALLA tjänsterader är avtalstilläggsrader — marginal
                  // mot pro rata-priset är missvisande, visa neutral text istället.
                  const allAdditionRows =
                    serviceRows.length > 0 &&
                    serviceRows.every(r => additionRowIds.includes(r.serviceItemId))
                  return (
                    <ServiceCostBreakdown
                      serviceRows={serviceRows}
                      articleItems={caseBillingItems.filter(i => i.item_type === 'article')}
                      totalRevenue={invoice.subtotal}
                      formatAmount={formatInvoiceAmount}
                      defaultCollapsed
                      neutralMargin={allAdditionRows}
                    />
                  )
                })()}

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
                {/* Faktureringsuppgifter + avtal + säljare + karta */}
                <div className="flex-shrink-0 overflow-y-auto border-b border-slate-700 p-3 space-y-3">
                  {/* Faktureringsuppgifter — fakturans snapshot, det som skickas till Fortnox */}
                  <CaseModalSection icon={Building2} iconClassName="text-blue-400" title="Faktureringsuppgifter">
                    <div className="space-y-1.5">
                      <p className="text-sm text-white font-medium">{invoice.customer_name}</p>
                      {invoice.organization_number && (
                        <p className="text-xs text-slate-400">
                          {invoice.case_type === 'private' ? 'Personnr' : 'Org.nr'}: {invoice.organization_number}
                        </p>
                      )}
                      {invoice.customer_email && (
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <a href={`mailto:${invoice.customer_email}`} className="text-blue-400 hover:text-blue-300 truncate">
                            {invoice.customer_email}
                          </a>
                        </div>
                      )}
                      {invoice.customer_phone && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <a href={`tel:${invoice.customer_phone}`} className="text-blue-400 hover:text-blue-300">
                            {invoice.customer_phone}
                          </a>
                        </div>
                      )}
                      {invoice.customer_address && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-300">
                          <MapPin className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                          <span>{invoice.customer_address}</span>
                        </div>
                      )}
                      {invoice.fastighetsbeteckning && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-300">
                          <Home className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                          <span>Fastighet: {invoice.fastighetsbeteckning}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 pt-0.5">Uppgifterna skickas till Fortnox</p>

                      {(contractCustomer?.contact_person || contractCustomer?.contact_email || contractCustomer?.contact_phone) && (
                        <div className="pt-1.5 border-t border-slate-700/50 space-y-1">
                          <p className="text-xs font-medium text-slate-400">Kontaktperson</p>
                          {contractCustomer.contact_person && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-300">
                              <User className="w-3 h-3 text-slate-500 flex-shrink-0" />
                              <span>{contractCustomer.contact_person}</span>
                            </div>
                          )}
                          {contractCustomer.contact_email && (
                            <div className="flex items-center gap-1.5 text-xs min-w-0">
                              <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                              <a href={`mailto:${contractCustomer.contact_email}`} className="text-blue-400 hover:text-blue-300 truncate">
                                {contractCustomer.contact_email}
                              </a>
                            </div>
                          )}
                          {contractCustomer.contact_phone && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                              <a href={`tel:${contractCustomer.contact_phone}`} className="text-blue-400 hover:text-blue-300">
                                {contractCustomer.contact_phone}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {invoice.customer_id && (
                        <a
                          href={`/admin/befintliga-kunder?customer=${invoice.customer_id}`}
                          className="inline-flex items-center gap-1 pt-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Öppna kundkort
                        </a>
                      )}
                    </div>
                  </CaseModalSection>

                  {/* Avtal — period/frekvens/årspremie */}
                  {(invoice.invoice_type === 'contract' || invoice.invoice_type === 'adhoc') && contractCustomer && (
                    <CaseModalSection
                      icon={FileText}
                      iconClassName="text-[#20c58f]"
                      title={invoice.invoice_type === 'contract' ? 'Avtal' : 'Avtal (merförsäljning)'}
                    >
                      <div className="space-y-1 text-xs">
                        {invoice.billing_period_start && invoice.billing_period_end && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Faktureringsperiod</span>
                            <span className="text-slate-200">
                              {formatInvoiceDate(invoice.billing_period_start)} – {formatInvoiceDate(invoice.billing_period_end)}
                            </span>
                          </div>
                        )}
                        {contractCustomer.contract_start_date && contractCustomer.contract_end_date && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Period</span>
                            <span className="text-slate-200">
                              {formatInvoiceDate(contractCustomer.contract_start_date)} → {formatInvoiceDate(contractCustomer.contract_end_date)}
                            </span>
                          </div>
                        )}
                        {contractCustomer.billing_frequency && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Frekvens</span>
                            <span className="text-slate-200">
                              {contractCustomer.billing_frequency === 'annual' ? 'Årsvis' :
                               contractCustomer.billing_frequency === 'monthly' ? 'Månadsvis' :
                               contractCustomer.billing_frequency === 'quarterly' ? 'Kvartalsvis' :
                               contractCustomer.billing_frequency}
                            </span>
                          </div>
                        )}
                        {contractCustomer.annual_value != null && contractCustomer.annual_value > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Årspremie</span>
                            <span className="text-slate-200 font-medium">
                              {formatInvoiceAmount(contractCustomer.annual_value)}
                            </span>
                          </div>
                        )}
                        {contractCustomer.terminated_at && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Uppsagt</span>
                            <span className="text-amber-400">
                              {formatInvoiceDate(contractCustomer.terminated_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </CaseModalSection>
                  )}

                  {/* Säljare */}
                  {contractCustomer?.assigned_account_manager && (
                    <CaseModalSection icon={User} iconClassName="text-blue-400" title="Säljare">
                      <p className="text-sm text-slate-200">{contractCustomer.assigned_account_manager}</p>
                      {contractCustomer.account_manager_email && (
                        <a href={`mailto:${contractCustomer.account_manager_email}`} className="text-xs text-blue-400 hover:text-blue-300">
                          {contractCustomer.account_manager_email}
                        </a>
                      )}
                    </CaseModalSection>
                  )}

                  {/* Karta */}
                  {(caseContext?.address || contractCustomer?.contact_address || invoice.customer_address) && (
                    <EmbeddedMapPreview
                      lat={caseContext?.addressLat ?? null}
                      lng={caseContext?.addressLng ?? null}
                      address={caseContext?.address || contractCustomer?.contact_address || invoice.customer_address || null}
                      height={120}
                    />
                  )}
                </div>

                {/* Kommunikation — endast för fakturor med case-koppling */}
                {invoice.case_id && effectiveCaseType && (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/30">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Kommunikation</span>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col px-3 py-2">
                      <CommentSection
                        caseId={invoice.case_id}
                        caseType={effectiveCaseType}
                        caseTitle={caseContext?.title || invoice.customer_name}
                        compact={true}
                      />
                    </div>
                  </div>
                )}
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
                    {/* Utfört arbete — samma innehåll som desktop-sektionen */}
                    <CaseModalSection icon={ClipboardCheck} iconClassName="text-amber-400" title="Utfört arbete">
                      <WorkPerformedContent caseContext={caseContext} preparations={preparations} />
                    </CaseModalSection>

                    {/* Avtalskontext — mobil */}
                    {(invoice.invoice_type === 'contract' || invoice.invoice_type === 'adhoc') && (
                      <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                        <p className="text-xs text-slate-400">
                          {invoice.invoice_type === 'contract' ? 'Avtalsfakturering' : 'Merförsäljning'}
                        </p>
                        {invoice.billing_period_start && invoice.billing_period_end && (
                          <p className="text-xs text-slate-300 mt-1">
                            Period: {formatInvoiceDate(invoice.billing_period_start)} – {formatInvoiceDate(invoice.billing_period_end)}
                          </p>
                        )}
                        {invoice.notes && (
                          <p className="text-xs text-slate-300 mt-1">{invoice.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Kommunikation — endast för fakturor med case-koppling */}
                    {invoice.case_id && effectiveCaseType && (
                      <div className="min-h-[200px]">
                        <CommentSection
                          caseId={invoice.case_id}
                          caseType={effectiveCaseType}
                          caseTitle={caseContext?.title || invoice.customer_name}
                          compact={true}
                        />
                      </div>
                    )}
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
              {invoice.fortnox_document_number &&
                ['draft', 'sent', 'booked'].includes(invoice.status) && (
                <button
                  onClick={handleSyncFromFortnox}
                  disabled={syncing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 rounded-lg transition-colors disabled:opacity-50"
                  title="Hämta senaste status från Fortnox"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  Synka
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {(invoice.status === 'pending_approval' || invoice.status === 'ready') && (
                <button
                  onClick={handleSendToFortnox}
                  disabled={sendingToFortnox}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1bb07e] text-sm text-[#fff] rounded-lg transition-colors disabled:opacity-50"
                >
                  {sendingToFortnox
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <FileEdit className="w-3.5 h-3.5" />}
                  {sendingToFortnox ? 'Skapar utkast...' : 'Skapa utkast i Fortnox'}
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-sm text-[#fff] rounded-lg transition-colors disabled:opacity-50"
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
