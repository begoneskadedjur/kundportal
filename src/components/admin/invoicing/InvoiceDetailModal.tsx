// src/components/admin/invoicing/InvoiceDetailModal.tsx
// Modal för att visa och hantera fakturadetaljer med ärendekontext och kommunikation

import { useState, useEffect } from 'react'
import {
  X,
  AlertTriangle,
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
  Users,
  Clock,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Home,
  RotateCcw,
  Trash2,
  FileEdit,
  ExternalLink,
  BookCheck,
  Lock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { InvoiceService } from '../../../services/invoiceService'
import { PremiumReviewService } from '../../../services/premiumReviewService'
import { PREMIUM_REVIEW_BLOCK_MESSAGE } from '../../../shared/premiumReview'
import { ContractReviewService, type InvoiceReviewInfo } from '../../../services/contractReviewService'
import { ContractReviewBanner } from './ContractReviewMark'
import { Icon } from '../../icons/Icon'
import { ProvisionService } from '../../../services/provisionService'
import type { CommissionPost } from '../../../types/provision'
import type { FortnoxMirrorHit } from '../../../shared/fortnoxCustomerNumbers'
import { PaymentTermsService } from '../../../services/paymentTermsService'
import type { InvoiceWithItems, InvoiceStatus, InvoiceItem } from '../../../types/invoice'
import { INVOICE_STATUS_CONFIG, formatInvoiceAmount, formatInvoiceDate, isInvoiceOverdue } from '../../../types/invoice'
import { ROT_RUT_PERCENT } from '../../../types/caseBilling'
import { calculateRotRutSummary } from '../../../utils/rotRutConstants'
import { fakturaArRadmodell, fakturaAvdrag } from '../../../shared/rotRutOffert'
import RotRutFakturaRuta from './RotRutFakturaRuta'
import type { CaseBillingItem } from '../../../types/caseBilling'
import { useCaseContext } from '../../../hooks/useCaseContext'
import DateField from '../../ui/DateField'
import ServiceCostBreakdown from '../../shared/ServiceCostBreakdown'
import CaseModalSection from '../../shared/CaseModalSection'
import InvoiceStatusStepper from '../../shared/InvoiceStatusStepper'
import InvoicePulseRow from './InvoicePulseRow'
import EarlySendDialog, { type EarlySendItem } from './queue/EarlySendDialog'
import { earlySendCheck, frequencyFromPeriod, invoiceSchedule, swedishDay } from '../../../shared/invoiceSchedule'
import InvoiceDeliveryPanel from './InvoiceDeliveryPanel'
import { InvoiceDeliveryError } from '../../../services/invoiceDeliveryService'
import type { DeliveryEvaluation } from '../../../shared/invoiceDelivery'
import InvoiceMarkingSection from './InvoiceMarkingSection'
import InvoiceCaseChainSection, { UnbilledRowsNotice } from './InvoiceCaseChain'
import InvoiceVisitTimeline from './InvoiceVisitTimeline'
import { useInvoicePulse, usePriceListCheck } from '../../../hooks/useInvoicePulse'
import { useInvoiceMarking } from '../../../hooks/useInvoiceMarking'
import { useInvoiceCaseChain } from '../../../hooks/useInvoiceCaseChain'
import { useInvoiceVisit } from '../../../hooks/useInvoiceVisit'
import { useCaseReports } from '../../../hooks/useCaseReports'
import WorkPerformedSection from './WorkPerformedSection'
import { useInvoiceAddons } from '../../../hooks/useInvoiceAddons'
import { InvoiceAddonBlock, InvoiceAddonCosts, InvoiceAddonSideCard } from './InvoiceAddonSection'
import { addonLineName, addonPeriodText } from '../../../shared/invoiceAddonLines'
import { sendInvoiceToFortnox } from '../../../services/invoiceFortnoxSendService'
import { splitCaseLines, formatHours } from '../../../shared/addonEconomics'
import CommentSection from '../../communication/CommentSection'
import EmbeddedMapPreview from '../../communication/EmbeddedMapPreview'
import { createSystemComment } from '../../../services/communicationService'
import { useAuth } from '../../../contexts/AuthContext'
import { AddonBillingGroupService } from '../../../services/addonBillingGroupService'
import type { CaseType } from '../../../types/communication'
import type { CasePreparationWithDetails } from '../../../types/casePreparations'

/**
 * Avgränsar ett ärendes case_billing_items till DEN HÄR fakturan.
 *
 * Ett ärende med flera besök har flera omgångar rader. Tar vi alla artiklar på
 * case_id hamnar besök 2:s inköpskostnader i besök 1:s marginal, och fakturan
 * ser olönsam ut fast den inte är det.
 *
 * Urvalet följer samma mönster som privat/företag redan använder:
 *   1. Tjänsteraderna som fakturans rader kommer från (matchade på kod/namn,
 *      det enda contract_billing_items bär vidare).
 *   2. Artiklar vars mapped_service_id pekar på någon av de tjänsteraderna.
 *   3. Sekundärt: artiklar med samma visit_id som de matchade tjänsteraderna.
 *
 * Artiklar som varken är mappade eller besökskopplade följer med ändå — de
 * visas som "Ej tilldelade interna kostnader" och räknas INTE in i marginalen.
 */
function scopeItemsToInvoice(
  items: CaseBillingItem[],
  invoiceRows: Array<{ article_code: string | null; article_name: string | null }>
): CaseBillingItem[] {
  const codes = new Set(invoiceRows.map(r => r.article_code).filter(Boolean) as string[])
  const names = new Set(invoiceRows.map(r => r.article_name).filter(Boolean) as string[])

  const services = items.filter(i => i.item_type === 'service')
  const matchedServices = services.filter(s => {
    const code = s.service_code || s.article_code
    const name = s.service_name || s.article_name
    return (code && codes.has(code)) || (name && names.has(name))
  })

  // Ingen träff (t.ex. namn ändrat efter fakturering): returnera bara artiklar
  // UTAN besöks-/tjänstekoppling. Att visa allt skulle belasta den här fakturans
  // marginal med ett annat besöks inköp — exakt buggen detta ska lösa. Utan
  // kopplade artiklar visar konsumenterna "–" i stället för en falsk siffra.
  if (matchedServices.length === 0) {
    return items.filter(i =>
      i.item_type !== 'service' &&
      !i.mapped_service_id &&
      !(i as CaseBillingItem & { visit_id?: string | null }).visit_id
    )
  }

  const serviceIds = new Set(matchedServices.map(s => s.id))
  const visitIds = new Set(
    matchedServices
      .map(s => (s as CaseBillingItem & { visit_id?: string | null }).visit_id)
      .filter(Boolean) as string[]
  )

  const articles = items.filter(i => i.item_type !== 'service')
  const scopedArticles = articles.filter(a => {
    if (a.mapped_service_id && serviceIds.has(a.mapped_service_id)) return true
    const visitId = (a as CaseBillingItem & { visit_id?: string | null }).visit_id
    if (visitId && visitIds.has(visitId)) return true
    // Ej kopplad artikel: tas med men hamnar i "Ej tilldelade interna kostnader"
    // och exkluderas från marginalen. Artiklar som hör till ETT ANNAT besök är
    // däremot kopplade dit och filtreras bort ovan.
    return !a.mapped_service_id && !visitId
  })

  return [...matchedServices, ...scopedArticles]
}

// Rutan "Utfört arbete" ligger i WorkPerformedSection.tsx (ombyggd 2026-10).
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
  const [approving, setApproving] = useState(false)
  const [sendingToFortnox, setSendingToFortnox] = useState(false)
  // Fakturavägen (InvoiceDeliveryPanel): kundraden kan saknas för engångskunder
  // tills sändningen skapar den, därför egen state + omladdningsnyckel
  const [deliveryEval, setDeliveryEval] = useState<DeliveryEvaluation | null>(null)
  const [deliveryCustomerId, setDeliveryCustomerId] = useState<string | null>(null)
  const [deliveryReloadKey, setDeliveryReloadKey] = useState(0)
  // Flera Fortnox-kunder på samma org.nr (eller bara inaktiva): koordinatorn
  // väljer i modalen innan utkastet skapas (docs/kundnummer-fortnox-plan.md)
  const [fortnoxCandidates, setFortnoxCandidates] = useState<{
    kind: 'multiple' | 'inactive-only'
    candidates: FortnoxMirrorHit[]
  } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(false)
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [savingDueDate, setSavingDueDate] = useState(false)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [preparations, setPreparations] = useState<CasePreparationWithDetails[]>([])
  const [staleInfo, setStaleInfo] = useState<{ stale: boolean; reason?: string } | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [caseBillingItems, setCaseBillingItems] = useState<CaseBillingItem[]>([])
  // Tilläggsfakturans faktureringsgrupp (contract_addon_billing_groups), namnet visas
  const [billingGroupName, setBillingGroupName] = useState<string | null>(null)
  const billingGroupId = (invoice as { addon_billing_group_id?: string | null } | null)?.addon_billing_group_id ?? null
  useEffect(() => {
    let cancelled = false
    if (!billingGroupId) {
      setBillingGroupName(null)
      return
    }
    AddonBillingGroupService.namesByIds([billingGroupId])
      .then((m) => {
        if (!cancelled) setBillingGroupName(m.get(billingGroupId) ?? null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [billingGroupId])
  // Provisionsposter för fakturans ärende — visas som underlag i
  // godkännandepanelen (read-only, ingen provisionslogik ändras här).
  // Posterna skapas redan vid ärendeavslut med status pending_invoice
  // och flyttas till utbetalning av DB-triggern när fakturan betalas.
  const [commissionPosts, setCommissionPosts] = useState<CommissionPost[]>([])
  // Kundens importerade avtalsärende (contracts-raden) — används både av
  // billing-uppslaget och kommunikationspanelen för årspremiefakturor utan case_id
  const [importedContractId, setImportedContractId] = useState<string | null>(null)
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

  // Premie att bekräfta (src/shared/premiumReview.ts): avtal gjorda direkt i
  // Oneflow spärrar avtalsfakturan tills premien bekräftats i avtalskartan
  const [unconfirmedPremiumIds, setUnconfirmedPremiumIds] = useState<string[]>([])
  const premiumCheckId = invoice?.id ?? null
  const premiumCheckType = invoice?.invoice_type ?? null
  const premiumCheckStatus = invoice?.status ?? null
  useEffect(() => {
    if (!isOpen || !premiumCheckId || premiumCheckType !== 'contract') {
      setUnconfirmedPremiumIds([])
      return
    }
    let cancelled = false
    PremiumReviewService.getUnconfirmedContractIdsForInvoice(premiumCheckId)
      .then(ids => { if (!cancelled) setUnconfirmedPremiumIds(ids) })
      .catch(err => { console.warn('[InvoiceDetailModal] Premiekontrollen misslyckades:', err) })
    return () => { cancelled = true }
  }, [isOpen, premiumCheckId, premiumCheckType, premiumCheckStatus])
  const premiumUnconfirmed = unconfirmedPremiumIds.length > 0

  // Kontrollerat avtal (src/shared/contractReview.ts): grön eller gul ruta
  // överst i avtalsfakturan. Spärrar ingenting.
  const [contractReview, setContractReview] = useState<InvoiceReviewInfo | null>(null)
  useEffect(() => {
    if (!isOpen || !premiumCheckId || premiumCheckType !== 'contract') {
      setContractReview(null)
      return
    }
    let cancelled = false
    ContractReviewService.getInvoiceReview(premiumCheckId)
      .then(r => { if (!cancelled) setContractReview(r) })
      .catch(err => { console.warn('[InvoiceDetailModal] Avtalskontrollen kunde inte läsas:', err) })
    return () => { cancelled = true }
  }, [isOpen, premiumCheckId, premiumCheckType, premiumCheckStatus])

  // Kontrollera igen: öppnar avtalskartan i en ny flik. Kontrollen görs där,
  // mot avtalet, av den som får ändra premien. Fakturan och kön ligger kvar.
  const openContractMapForReview = () => {
    const target = contractReview?.contracts.find(c => c.state === 'andrad') ?? contractReview?.contracts[0]
    const customerId = target?.customerId ?? invoice?.customer_id ?? null
    if (!customerId) return
    const base = window.location.pathname.startsWith('/koordinator') ? '/koordinator' : '/admin'
    window.open(`${base}/befintliga-kunder/${customerId}?tab=avtalskarta`, '_blank', 'noopener')
  }

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

  // Besökssnapshotet fakturan avser. När ett återbesök bokats är ärendets egna
  // rapportfält nollställda och scheduled_start flyttad till nästa besök —
  // snapshotet bär då det faktiskt utförda arbetet, dess datum och tekniker.
  const { visit } = useInvoiceVisit(isOpen ? invoice : null)

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
    if (!invoice) { setCaseBillingItems([]); setImportedContractId(null); return }
    if (invoice.invoice_type !== 'contract') setImportedContractId(null)
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
          .select('case_id, article_code, article_name')
          .in('id', cbItemIds)
        const rows = (cbItems as { case_id: string | null; article_code: string | null; article_name: string | null }[] | null) || []
        const caseIds = Array.from(
          new Set(rows.map(c => c.case_id).filter(Boolean) as string[])
        )
        if (caseIds.length === 0) { setCaseBillingItems([]); return }

        const { data } = await supabase
          .from('case_billing_items')
          .select('*, article:articles(is_durable, category)')
          .in('case_id', caseIds)
          .eq('case_type', 'contract')
          // Makulerade rader (t.ex. från ett tidigare avslutsförsök) hör
          // inte till fakturan och ska inte dubblera kostnadsuppdelningen
          .neq('status', 'cancelled')
        setCaseBillingItems(
          scopeItemsToInvoice((data as CaseBillingItem[] | null) || [], rows)
        )
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
        setImportedContractId(contract?.id ?? null)
        if (contract) {
          const { data } = await supabase
            .from('case_billing_items')
            .select('*, article:articles(is_durable, category)')
            .eq('case_id', contract.id)
            .eq('case_type', 'contract')
            .neq('status', 'cancelled')
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
        .select('*, article:articles(is_durable, category)')
        .eq('case_id', invoice.case_id)
        .eq('case_type', invoice.case_type)
        .or(`id.in.(${serviceIds.join(',')}),mapped_service_id.in.(${serviceIds.join(',')})`)
      setCaseBillingItems((data as CaseBillingItem[] | null) || [])
    }
    fetchCaseBilling()
  }, [invoice?.case_id, invoice?.case_type, invoice?.invoice_type, invoice?.customer_id, invoice?.items])

  // Hämta provisionsposter för fakturans ärende medan fakturan väntar på
  // godkännande. commission_posts.case_id är TEXT och matchar invoice.case_id
  // rakt av för både privat/företag och avtalsärenden (adhoc). Fel sväljs -
  // provisionsvisningen får aldrig blockera fakturamodalen.
  //
  // Posterna filtreras på fakturans besök med EXAKT samma predikat som
  // DB-triggern handle_invoice_paid (20260828_provision_per_faktura.sql):
  //   invoice.visit_id is null OR post.visit_id is null OR de matchar
  // dvs delfaktura -> bara sitt besöks poster, slutfaktura/årspremie utan
  // besök -> hela ärendet, och besökslösa poster (rondering, historik) följer
  // alltid ärendets betalning. Håll predikaten identiska - annars kan
  // godkännandepanelen visa annat underlag än det som faktiskt betalas ut.
  useEffect(() => {
    if (!invoice?.case_id || invoice.status !== 'pending_approval') {
      setCommissionPosts([])
      return
    }
    const invoiceVisitId = invoice.visit_id
    let cancelled = false
    ProvisionService.getPostsByCase(invoice.case_id)
      .then(posts => {
        if (cancelled) return
        setCommissionPosts(posts.filter(p =>
          // 'cancelled' finns i DB men inte i CommissionStatus-typen
          (p.status as string) !== 'cancelled' &&
          (invoiceVisitId === null || p.visit_id === null || p.visit_id === invoiceVisitId)
        ))
      })
      .catch(err => {
        console.warn('Kunde inte hämta provisionsposter:', err)
        if (!cancelled) setCommissionPosts([])
      })
    return () => { cancelled = true }
  }, [invoice?.case_id, invoice?.status, invoice?.visit_id])

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

  // Rutan Utfört arbete (WorkPerformedSection): ärendets besöksrapporter och
  // specialrapporter till läspanelen. Samma props på dator och i mobilvyn.
  const caseReports = useCaseReports(
    isOpen && invoice?.case_id ? invoice.case_id : null,
    isOpen && invoice ? effectiveCaseType : null
  )
  const workPerformedProps = {
    caseId: invoice?.case_id ?? null,
    caseNumber: linkedCaseNumber,
    caseContext,
    visit,
    preparations,
    reports: caseReports,
    billingAddress: invoice?.customer_address ?? null,
    customerName: invoice?.customer_name ?? null,
    loading: contextLoading,
  }

  // Besöksnummer per fakturarad. Privat/företag länkar direkt via
  // case_billing_item_id; adhoc/avtal länkar via contract_billing_items som
  // bara bär kod/namn vidare, så där matchas raden på kod eller namn.
  const visitNumberForItem = (item: InvoiceItem): number | null => {
    const direct = item.case_billing_item_id
      ? caseBillingItems.find(cb => cb.id === item.case_billing_item_id)
      : undefined
    const matched = direct ?? caseBillingItems.find(cb =>
      cb.item_type === 'service' && (
        (item.article_code && (cb.service_code === item.article_code || cb.article_code === item.article_code)) ||
        (cb.service_name === item.article_name || cb.article_name === item.article_name)
      )
    )
    const n = (matched as (CaseBillingItem & { visit_number?: number | null }) | undefined)?.visit_number
    return typeof n === 'number' ? n : null
  }

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
      if ((data?.customer_id ?? null) !== deliveryCustomerId) setDeliveryEval(null)
      setDeliveryCustomerId(data?.customer_id ?? null)
      setDeliveryReloadKey(k => k + 1)

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
            effectiveCaseType,
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

  // Återställ makulerad faktura. Har den ett Fortnox-nummer återgår den till
  // sin Fortnox-status i stället för "Redo" (se InvoiceService.restoreInvoice),
  // annars skulle "Skapa utkast i Fortnox" skapa en dubblett.
  const handleRestore = async () => {
    if (!invoice) return

    setUpdating(true)
    try {
      const restored = await InvoiceService.restoreInvoice(invoice.id)
      const label = INVOICE_STATUS_CONFIG[restored.status as InvoiceStatus]?.label ?? restored.status

      if (user && invoice.case_id) {
        const authorName = profile?.display_name || profile?.technicians?.name || profile?.email || 'Okänd'
        try {
          await createSystemComment(
            invoice.case_id,
            effectiveCaseType,
            'status_change',
            `Faktura återställd till "${label}" (${invoice.invoice_number})`,
            user.id,
            authorName
          )
        } catch (err) {
          console.warn('Kunde inte logga återställning:', err)
        }
      }

      toast.success(`Återställd till "${label}"`)
      await loadInvoice()
      onStatusChange?.()
    } catch (error) {
      console.error('Kunde inte återställa fakturan:', error)
      toast.error('Kunde inte återställa fakturan')
    } finally {
      setUpdating(false)
    }
  }

  // Godkännande (faktureringsansvarig) — kvittering som låser upp Fortnox-knappen
  const handleApprove = async () => {
    if (!invoice || !user || !profile?.can_approve_invoices) return
    if (deliveryEval && !deliveryEval.ok) {
      toast.error(deliveryEval.message ?? 'Fakturavägen är inte bekräftad')
      return
    }
    if (premiumUnconfirmed) {
      toast.error(PREMIUM_REVIEW_BLOCK_MESSAGE, { duration: 10000 })
      return
    }

    setApproving(true)
    const approverName = profile?.display_name || profile?.technicians?.name || profile?.email || 'Okänd'
    try {
      await InvoiceService.approveInvoice(invoice.id, user.id, approverName)

      // EN kvittering täcker både rabatt och provision - systemkommentaren
      // nämner rabatten uttryckligen när sådan finns på fakturans rader
      const discountNote = realDiscountRows.length > 0
        ? ' inkl. rabatt ' + [...new Set(realDiscountRows.map(row =>
            `-${Number(row.discount_percent)} %${row.added_by_technician_name ? ` av ${row.added_by_technician_name}` : ''}`
          ))].join(', ')
        : ''

      // Logga godkännandet i ärendets kommunikationspanel
      if (invoice.case_id) {
        try {
          await createSystemComment(
            invoice.case_id,
            effectiveCaseType,
            'status_change',
            `Faktura godkänd av ${approverName}${discountNote} (${invoice.invoice_number})`,
            user.id,
            approverName
          )
        } catch (err) {
          console.warn('Kunde inte logga godkännandet:', err)
        }
      }

      toast.success(realDiscountRows.length > 0 ? 'Faktura godkänd inkl. rabatt' : 'Faktura godkänd')
      await loadInvoice()
      onStatusChange?.()
    } catch (error) {
      console.error('Kunde inte godkänna fakturan:', error)
      if (error instanceof InvoiceDeliveryError) {
        toast.error(error.message)
        setDeliveryReloadKey(k => k + 1)
      } else if (error instanceof Error && error.message === PREMIUM_REVIEW_BLOCK_MESSAGE) {
        toast.error(error.message, { duration: 10000 })
      } else {
        toast.error('Kunde inte godkänna fakturan')
      }
    } finally {
      setApproving(false)
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

  // Skapa utkast i Fortnox. Stegen bor i src/services/invoiceFortnoxSendService.ts
  // (3.125.0), samma väg som Skicka godkända till Fortnox i arbetslistorna.
  // Modalen skickar in det den redan läst (fakturan, besöket, tilläggsraderna,
  // kundansvarig) och tar hand om sina egna paneler via callbackarna.
  const handleSendToFortnox = async (opts: {
    chosenCustomerNumber?: string
    reactivate?: boolean
    forceNew?: boolean
  } = {}) => {
    if (!invoice) return
    setSendingToFortnox(true)
    try {
      const result = await sendInvoiceToFortnox(invoice.id, {
        ...opts,
        actor: user ? { userId: user.id, name: profile?.display_name || profile?.email || 'Okänd' } : null,
        notify: {
          success: (message) => { toast.success(message) },
          error: (message, o) => { if (o) toast.error(message, o); else toast.error(message) },
          info: (message, o) => { toast(message, o) },
        },
        onPremiumChecked: (ids) => setUnconfirmedPremiumIds(ids),
        onDeliveryBlocked: (customerId) => {
          setDeliveryCustomerId(customerId)
          setDeliveryReloadKey(k => k + 1)
        },
        onDeliveryAdopted: () => setDeliveryReloadKey(k => k + 1),
        onCandidatesCleared: () => setFortnoxCandidates(null),
        preloaded: {
          invoice,
          visit,
          addonLines: addons.lines,
          accountManager: contractCustomer?.assigned_account_manager ?? null,
        },
      })
      if (result.status === 'candidates') {
        setFortnoxCandidates({ kind: result.kind, candidates: result.candidates })
        return
      }
      if (result.status === 'created') {
        await loadInvoice()
        onStatusChange?.()
      }
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
      toast.error(invoice.rot_rut_type && error instanceof Error ? error.message : 'Kunde inte exportera faktura')
    }
  }

  // Faktureringsmodaler 2.0 — read-only-insikter, påverkar inte Fortnox-flödet
  const pulse = useInvoicePulse(isOpen ? invoice : null)
  const marking = useInvoiceMarking(isOpen ? invoice : null, effectiveCaseType)
  const chain = useInvoiceCaseChain(isOpen ? invoice : null, effectiveCaseType)
  // Prisavstämning mot kundens avtalsprislista (adhoc) — negativ marginal på
  // avtalat fast pris ska inte larma rött
  // Tilläggsrader (pro rata från etableringen): tidslinje, period, kalkyl
  const addons = useInvoiceAddons(isOpen ? invoice : null)
  const hasAddonLines = addons.lines.length > 0
  const addonByItemId = new Map(addons.lines.map(l => [l.invoiceItemId, l]))
  const priceCheck = usePriceListCheck(isOpen ? invoice : null, caseBillingItems, addons.lines)

  // Faktureringsschemat (3.122.0): ej skickad avtalsfaktura får raden Skulle
  // skickas, Perioden börjar och Förfaller om skickad idag, och en varning
  // innan den skickas för tidigt. Regeln i src/shared/invoiceSchedule.ts.
  const scheduleInvoice = invoice as (InvoiceWithItems & { contract_id?: string | null; contract_invoice_kind?: string | null }) | null
  const isUnsentContract =
    !!scheduleInvoice &&
    scheduleInvoice.invoice_type === 'contract' &&
    !scheduleInvoice.fortnox_document_number &&
    (scheduleInvoice.status === 'pending_approval' || scheduleInvoice.status === 'ready')
  const [scheduleFreq, setScheduleFreq] = useState<string | null>(null)
  const [contractTermsDays, setContractTermsDays] = useState(30)
  const [earlyItems, setEarlyItems] = useState<EarlySendItem[]>([])
  useEffect(() => {
    setEarlyItems([])
    if (!isOpen || !scheduleInvoice || !isUnsentContract) return
    let cancelled = false
    PaymentTermsService.getDays('contract').then((d) => { if (!cancelled) setContractTermsDays(d) }).catch(() => {})
    const kind = scheduleInvoice.contract_invoice_kind
    const fallback =
      kind === 'equipment_monthly' ? 'monthly'
      : kind === 'equipment_gap' ? null
      : frequencyFromPeriod(scheduleInvoice.billing_period_start, scheduleInvoice.billing_period_end)
    setScheduleFreq(fallback)
    if (scheduleInvoice.contract_id && kind !== 'equipment_monthly' && kind !== 'equipment_gap') {
      supabase
        .from('contracts')
        .select('billing_frequency')
        .eq('id', scheduleInvoice.contract_id)
        .maybeSingle()
        .then(({ data }) => {
          const f = (data as { billing_frequency?: string | null } | null)?.billing_frequency
          if (!cancelled && f) setScheduleFreq(f)
        })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scheduleInvoice?.id, isUnsentContract])
  const todaySe = swedishDay(new Date())
  const schedule = isUnsentContract && scheduleInvoice ? invoiceSchedule(scheduleInvoice, todaySe, contractTermsDays) : null

  // Skapa utkast i Fortnox: varna först om avtalsfakturan skickas för tidigt
  const requestSendToFortnox = () => {
    if (schedule && scheduleInvoice) {
      const early = earlySendCheck({ frequency: scheduleFreq, sendDate: schedule.sendDate, periodStart: schedule.periodStart }, todaySe)
      if (early.tooEarly) {
        setEarlyItems([{
          id: scheduleInvoice.id,
          customerName: scheduleInvoice.customer_name,
          invoiceNumber: scheduleInvoice.invoice_number,
          waitUntil: early.waitUntil,
          periodStart: schedule.periodStart,
          daysEarly: early.daysEarly,
          monthly: early.monthly,
        }])
        return
      }
    }
    handleSendToFortnox()
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
  const isPartialInvoice = (invoice?.invoice_type as string | undefined) === 'partial'

  // Bokat framtida besök på ärendet: status Återbesök (starttiden är då nästa
  // besök, samma tolkning som pulsraden) eller en starttid som ligger framåt.
  // Styr fakturakedjans väntar-rad när nästa besöks tjänsterader ännu är tomma.
  const upcomingVisitBooked = !!caseContext && (
    caseContext.status === 'Återbesök' ||
    (!!caseContext.startDate && new Date(caseContext.startDate).getTime() > Date.now())
  )
  const upcomingVisitDate = upcomingVisitBooked ? (caseContext?.startDate ?? null) : null

  // Spärrindikator vid primärknappen: hinder i fast ordning. Read-only —
  // knappen förblir klickbar och klick-logiken är oförändrad.
  const showBlockers = !!invoice && ['pending_approval', 'ready'].includes(invoice.status)
  const blockers: { label: string; severe?: boolean }[] = []
  if (showBlockers && invoice) {
    if (premiumUnconfirmed) {
      blockers.push({ label: 'premien är inte bekräftad i avtalskartan', severe: true })
    }
    if (deliveryEval && !deliveryEval.ok) {
      blockers.push({ label: 'fakturavägen är inte bekräftad', severe: true })
    }
    if (marking && marking.missing.length > 0) {
      blockers.push({ label: `${marking.missing[0]} saknas på ärendet` })
    }
    if ((pulse.overdueTotal ?? 0) > 0) {
      blockers.push({ label: `${formatInvoiceAmount(pulse.overdueTotal ?? 0)} förfallet hos kunden`, severe: true })
    }
    if (invoice.rot_rut_type && !invoice.fastighetsbeteckning && !(invoice.brf_org_number && invoice.apartment_number)) {
      blockers.push({ label: 'fastighetsbeteckning saknas för ROT/RUT' })
    }
    // Förfallodatum är preliminärt före sändning (sätts om vid sändningen till
    // Fortnox) — därför är villkorsavvikelse inte längre ett hinder här.
    if (pulse.premiumMismatch) blockers.push({ label: 'premien avviker från avtalet' })
    // Enligt avtal-läget är INTE ett hinder — negativ marginal på avtalat
    // fast pris är avtalad. Bara faktisk avvikelse mot prislistan flaggas.
    if (priceCheck.mode === 'deviation') {
      blockers.push({ label: 'pris avviker från avtalsprislistan' })
    }
  }
  const severeBlocker = blockers.some(b => b.severe)

  // Kommunikation: case-fakturor via case_id; årspremiefakturor utan case_id
  // binds till kundens importerade avtalsärende (samma contracts-rad som
  // billing-uppslaget använder)
  const commCaseId = invoice?.case_id ?? (invoice?.invoice_type === 'contract' ? importedContractId : null)
  const commCaseType: CaseType | null = invoice?.case_id ? effectiveCaseType : commCaseId ? 'contract' : null

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
              {/* Baseline-linjerad titelrad som radbryter per tagg: varje span är
                  obrytbar (whitespace-nowrap) så långa statusar som "Kräver
                  godkännande" flyttas hela till nästa rad istället för att
                  bryta sin egen text under statuspunkten */}
              <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                <h2 className="text-base font-semibold font-mono text-white whitespace-nowrap">
                  {invoice?.invoice_number || '...'}
                </h2>
                {isPartialInvoice && (
                  <span className="text-xs font-semibold text-teal-400 whitespace-nowrap">◔ Delfaktura</span>
                )}
                {linkedCaseNumber && (
                  <span className="text-xs font-medium font-mono text-slate-400 whitespace-nowrap" title="Fakturans kopplade ärende">
                    {linkedCaseNumber}
                  </span>
                )}
                {/* items-baseline i spannet: med punkten först exporterar items-center
                    punktens underkant som baslinje och texten "svävar" över raden */}
                {invoice && statusConfig && (
                  <span className={`inline-flex items-baseline gap-1.5 text-xs font-semibold whitespace-nowrap ${statusConfig.color}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                    {statusConfig.label}
                  </span>
                )}
              </div>
              {invoice && (
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {invoice.customer_name}
                  {invoice.organization_number && <> · {invoice.organization_number}</>}
                  {caseContext?.status === 'Återbesök' && <> · Ärendestatus: Återbesök</>}
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

        {/* Faktureringsschemat för ej skickad avtalsfaktura (3.122.0) */}
        {invoice && schedule && (
          <div className="flex-shrink-0 flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-2 border-b border-slate-700/50 text-xs">
            <span className="text-slate-400">
              Skulle skickas <span className="font-mono text-white">{schedule.sendDate}</span>
            </span>
            <span className="text-slate-400">
              Perioden börjar <span className="font-mono text-white">{schedule.periodStart ?? '-'}</span>
            </span>
            <span className={schedule.paysAfterPeriodStart ? 'text-red-400' : 'text-slate-400'}>
              Förfaller om skickad idag <span className={`font-mono ${schedule.paysAfterPeriodStart ? 'text-red-400' : 'text-white'}`}>{schedule.dueIfSentToday}</span>
              {schedule.paysAfterPeriodStart && <> · Betalas efter periodstart</>}
            </span>
          </div>
        )}

        {/* Pulsrad — nyckeltal med fast slotordning, read-only */}
        {invoice && (
          <InvoicePulseRow
            invoice={invoice}
            pulse={pulse}
            caseBillingItems={caseBillingItems}
            caseContext={caseContext}
            priceCheck={priceCheck}
            hasAddonLines={hasAddonLines}
          />
        )}

        {/* Fortnox-kandidater: samma org.nr finns på flera (eller bara inaktiva)
            Fortnox-kunder. Koordinatorn väljer, aldrig auto-val. */}
        {invoice && fortnoxCandidates && (
          <div className="mx-4 mt-3 p-3 bg-slate-800/30 border border-amber-500/40 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">
                {fortnoxCandidates.kind === 'multiple'
                  ? 'Flera Fortnox-kunder har detta org.nr'
                  : 'Kunden finns i Fortnox men är inaktiv'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              {fortnoxCandidates.kind === 'multiple'
                ? 'Välj vilken Fortnox-kund fakturautkastet ska skapas på. Kundnumret sparas på kundkortet i portalen.'
                : 'Återaktivera kunden i Fortnox och använd dess nummer, eller skapa en ny kund med nästa lediga nummer i kundgruppen.'}
            </p>
            <div className="space-y-2">
              {fortnoxCandidates.candidates.map(c => (
                <button
                  key={c.customer_number}
                  type="button"
                  disabled={sendingToFortnox}
                  onClick={() => handleSendToFortnox({ chosenCustomerNumber: c.customer_number, reactivate: !c.active })}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-700/50 bg-slate-800/20 hover:border-[#20c58f] transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-sm text-white">{c.customer_number}</span>
                      <span className="text-sm text-slate-300 ml-2 truncate">{c.name ?? 'Namn saknas'}</span>
                    </div>
                    <span className={`text-xs ${c.active ? 'text-[#20c58f]' : 'text-amber-400'}`}>
                      {c.active ? 'aktiv' : 'inaktiv, återaktiveras'}
                    </span>
                  </div>
                  {c.organisation_number && (
                    <div className="text-xs text-slate-500 font-mono">{c.organisation_number}</div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-slate-700/50">
              {fortnoxCandidates.kind === 'inactive-only' && (
                <button
                  type="button"
                  disabled={sendingToFortnox}
                  onClick={() => handleSendToFortnox({ forceNew: true })}
                  className="text-xs text-[#20c58f] hover:underline disabled:opacity-50"
                >
                  Skapa ny Fortnox-kund med nytt nummer
                </button>
              )}
              <button
                type="button"
                onClick={() => setFortnoxCandidates(null)}
                className="text-xs text-slate-400 hover:text-white ml-auto"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        {/* Content — split-view desktop, stacked mobile */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Vänster: Fakturadetaljer */}
          <div className="flex-1 min-h-0 overflow-y-auto lg:border-r lg:border-slate-700">
            {/* Fakturavägen: en rad överst i det rullbara innehållet. Sätts
                automatiskt ur avtalet och ändras på kundsidan; här visas den bara. */}
            {invoice && invoice.status !== 'cancelled' && deliveryCustomerId && (
              <InvoiceDeliveryPanel
                compact
                className="mx-4 mt-3"
                customerId={deliveryCustomerId}
                canEdit={false}
                actorName={profile?.display_name || profile?.email || 'Okänd'}
                onEvaluation={setDeliveryEval}
                reloadKey={deliveryReloadKey}
              />
            )}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                <span className="ml-2 text-slate-400">Laddar...</span>
              </div>
            ) : invoice ? (
              <div className="p-4 space-y-4">
                {/* Kontrollerat avtal: grön eller gul ruta, spärrar ingenting */}
                {invoice.invoice_type === 'contract' && invoice.status !== 'cancelled' && (
                  <ContractReviewBanner review={contractReview} />
                )}

                {/* Premie att bekräfta: avtal gjort direkt i Oneflow. Spärrar
                    Godkänn och Skapa utkast tills premien bekräftats i kartan. */}
                {premiumUnconfirmed && invoice.status !== 'cancelled' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
                    <div>
                      <div className="text-sm font-medium text-amber-400">Premien är inte bekräftad</div>
                      <p className="text-xs text-amber-300/80 mt-0.5">
                        {PREMIUM_REVIEW_BLOCK_MESSAGE}
                        {unconfirmedPremiumIds.length > 1 ? ` Gäller ${unconfirmedPremiumIds.length} av fakturans avtal.` : ''}
                      </p>
                    </div>
                  </div>
                )}

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

                {/* Godkännandepanel — allt godkännaren behöver innan Godkänn-klicket:
                    rabattrader (ordinarie → rabatterat pris, vem, motivering) och
                    provisionsunderlag för fakturans ärende. Visas bara i
                    pending_approval och bara när det finns något att granska.
                    Årspremiefakturor utan rabatt/provision täcks som förut av
                    headerstatus + footerknappen. */}
                {invoice.status === 'pending_approval' &&
                  (realDiscountRows.length > 0 || commissionPosts.length > 0) && (
                    <div className="p-3 bg-slate-800/30 border border-orange-500/30 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-semibold text-white">Att granska innan godkännande</span>
                      </div>

                      {/* Rabattrader */}
                      {realDiscountRows.map(row => {
                        const ordinaryPrice = Number(row.unit_price) * Number(row.quantity || 1)
                        return (
                          <div key={row.id} className="px-3 py-2 bg-slate-900/40 rounded-lg">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <span className="text-sm text-white">{row.service_name || row.article_name}</span>
                              <span className="text-sm font-mono text-slate-300">
                                {formatInvoiceAmount(ordinaryPrice)} {'→'} {formatInvoiceAmount(Number(row.total_price))}
                                <span className="text-orange-400 ml-2">-{Number(row.discount_percent)} %</span>
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Rabatt given av {row.added_by_technician_name || 'okänd tekniker'}
                            </p>
                            {row.discount_motivation?.trim() ? (
                              <p className="text-xs text-slate-300 italic mt-0.5">"{row.discount_motivation}"</p>
                            ) : (
                              <p className="text-xs text-amber-400 mt-0.5">Motivering saknas</p>
                            )}
                          </div>
                        )
                      })}

                      {/* Provisionsunderlag — read-only, posterna ägs av provisionsflödet */}
                      {commissionPosts.length > 0 && (
                        <div className={`space-y-1 ${realDiscountRows.length > 0 ? 'pt-2 border-t border-slate-700/50' : ''}`}>
                          {commissionPosts.map(post => (
                            <div key={post.id} className="flex items-center justify-between gap-3 flex-wrap text-xs">
                              <span className="text-slate-300">
                                Provision · {post.technician_name}
                                {Number(post.share_percentage) < 100 ? ` (${Number(post.share_percentage)} % andel)` : ''}
                                {post.visit_number ? ` · besök ${post.visit_number}` : ''}
                              </span>
                              <span className="font-mono text-slate-300">
                                {formatInvoiceAmount(Number(post.commission_amount))}
                                <span className="text-slate-500 ml-1.5">({Number(post.commission_percentage)} %{post.is_rot_rut ? ' på belopp före ROT/RUT' : ''})</span>
                              </span>
                            </div>
                          ))}
                          <p className="text-xs text-slate-500">
                            Provisionsgrundande - provisionen flyttas till utbetalning automatiskt när fakturan betalas.
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                        Godkänn-knappen är en kvittering som täcker både rabatt och provision och låser upp Fortnox-knappen.
                      </p>
                    </div>
                )}

                {/* Utfört arbete — ärendekontext från teknikern */}
                <WorkPerformedSection {...workPerformedProps} />

                {/* Fakturakedja — delfakturerade ärenden: vad är fakturerat, vad väntar */}
                {invoice.case_id && (
                  <InvoiceCaseChainSection
                    chain={chain}
                    currentInvoiceId={invoice.id}
                    upcomingVisitBooked={upcomingVisitBooked}
                    upcomingVisitDate={upcomingVisitDate}
                  />
                )}

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
                    {/* Besökssnapshotet går före ärendets scheduled_start — den
                        flyttas fram till nästa besök när återbesök bokas */}
                    <div className="text-sm text-white font-medium tabular-nums">
                      {visit?.visit_date
                        ? formatInvoiceDate(visit.visit_date)
                        : caseContext?.startDate
                          ? formatInvoiceDate(caseContext.startDate)
                          : '–'}
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
                        {/* DateField istället för type="date": Chrome ignorerar lang="sv-SE" och
                            visar mm/dd/yyyy efter webbläsarens språk. DateField ger alltid ÅÅÅÅ-MM-DD. */}
                        <div className="flex-1">
                          <DateField
                            value={dueDateDraft}
                            onChange={setDueDateDraft}
                            className="w-full pl-9 pr-2 py-0.5 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                          />
                        </div>
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
                        {invoice.items.map(item => {
                          const itemVisitNumber = visitNumberForItem(item)
                          const addonLine = addonByItemId.get(item.id)
                          const addonPeriod = addonLine ? addonPeriodText(addonLine.timeline) : null
                          return (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <div className="text-sm text-white">
                                {addonLine ? addonLineName(item.article_name, addonLine.kind) : item.article_name}
                                {itemVisitNumber != null && (
                                  <span className="ml-2 text-xs text-slate-500 tabular-nums">
                                    Besök {itemVisitNumber}
                                  </span>
                                )}
                              </div>
                              {addonPeriod && (
                                <div className="text-xs text-slate-400 tabular-nums">
                                  {addonPeriod}, fram till nästa årspremie
                                </div>
                              )}
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
                            <td className="px-3 py-2 text-right text-sm text-slate-300 tabular-nums whitespace-nowrap">
                              {addonLine
                                ? `${formatHours(Number(item.quantity))} ${addonLine.kind === 'labour' ? 'h' : 'st'}`
                                : item.quantity}
                            </td>
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
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tillägg utöver avtalet — samma tidslinje som ärendets Ekonomi-flik */}
                {hasAddonLines && (
                  <InvoiceAddonBlock addons={addons} priceOk={priceCheck.mode === 'agreement'} />
                )}

                {/* Rader utanför fakturan — pending tjänsterader som inte kom med */}
                <UnbilledRowsNotice chain={chain} />

                {/* Summering */}
                <div className="bg-slate-800/50 rounded-lg p-3">
                  {(() => {
                    // ROT/RUT-offertens radmodell (3.127.0): samma avdrag som offerten
                    const rotRutDeduction = invoice.rot_rut_type && fakturaArRadmodell(invoice.items)
                      ? (invoice.rot_rut_asked_amount ?? fakturaAvdrag(invoice.items, invoice.rot_rut_type).avdrag)
                      : calculateRotRutSummary(invoice.items).totalDeduction
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

                {/* ROT/RUT (3.127.0): typ, personnummer maskerat, fastighet, timmar,
                    avdrag mot Fortnox, kontroller och begäran hos Skatteverket */}
                {invoice.rot_rut_type && <RotRutFakturaRuta invoice={invoice} onChanged={loadInvoice} />}
                {(() => {
                  const rotRutDeduction = calculateRotRutSummary(invoice.items).totalDeduction
                  if (invoice.rot_rut_type || rotRutDeduction <= 0) return null
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
                  // Tilläggsrader och artiklarna mappade mot dem räknas i
                  // tilläggets kostnader nedan, aldrig som marginal i procent
                  const costItems = hasAddonLines ? splitCaseLines(caseBillingItems).caseLines : caseBillingItems
                  const serviceRows = isContractOrAdhoc
                    ? costItems
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
                  if (hasAddonLines) {
                    const ownArticles = costItems.filter(i => i.item_type === 'article')
                    const ownRevenue = serviceRows.reduce((s, r) => s + Number(r.revenue || 0), 0)
                    return (
                      <>
                        <InvoiceAddonCosts addons={addons} />
                        {(ownRevenue > 0 || ownArticles.length > 0) && (
                          <ServiceCostBreakdown
                            serviceRows={serviceRows}
                            articleItems={ownArticles}
                            totalRevenue={ownRevenue}
                            formatAmount={formatInvoiceAmount}
                            defaultCollapsed={false}
                            neutralMargin={allAdditionRows}
                          />
                        )}
                      </>
                    )
                  }
                  return (
                    <ServiceCostBreakdown
                      serviceRows={serviceRows}
                      articleItems={caseBillingItems.filter(i => i.item_type === 'article')}
                      totalRevenue={invoice.subtotal}
                      formatAmount={formatInvoiceAmount}
                      defaultCollapsed={false}
                      neutralMargin={allAdditionRows}
                    />
                  )
                })()}

                {/* Prisavstämning mot kundens avtalsprislista (adhoc):
                    grön förklaring när negativ marginal är ett avtalat fast pris,
                    röd per-rad-differens när priset avviker */}
                {priceCheck.mode === 'agreement' && !hasAddonLines && (() => {
                  const articleCost = caseBillingItems
                    .filter(i => i.item_type === 'article')
                    .reduce((s, i) => s + Number(i.total_price || 0), 0)
                  const negativeMargin = Number(invoice.subtotal || 0) > 0 && articleCost > Number(invoice.subtotal || 0)
                  if (!negativeMargin) return null
                  return (
                    <div className="p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
                      <p className="text-sm font-medium text-[#20c58f]">Pris enligt kundens avtalsprislista ✓</p>
                      <p className="text-xs text-slate-300 mt-1">
                        Avtalat fast pris — den negativa marginalen är avtalad, inte ett inmatningsfel.
                      </p>
                    </div>
                  )
                })()}
                {priceCheck.mode === 'deviation' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-sm font-medium text-red-400">
                      Priset avviker {formatInvoiceAmount(priceCheck.diffTotal)} från kundens avtalsprislista
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {priceCheck.rows.map(r => (
                        <div key={r.id} className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="text-slate-300 truncate">{r.name}</span>
                          <span className="text-slate-400 tabular-nums whitespace-nowrap">
                            {formatInvoiceAmount(r.invoiceTotal)} mot avtalat {formatInvoiceAmount(r.listTotal)} ·{' '}
                            <span className="text-red-400">
                              {r.diff > 0 ? '+' : '−'}{formatInvoiceAmount(Math.abs(r.diff))}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Besök under avtalsåret — vad kunden fått för premien */}
                {invoice.invoice_type === 'contract' &&
                  invoice.customer_id &&
                  invoice.billing_period_start &&
                  invoice.billing_period_end && (
                    <InvoiceVisitTimeline
                      customerId={invoice.customer_id}
                      periodStart={invoice.billing_period_start}
                      periodEnd={invoice.billing_period_end}
                    />
                  )}

                {/* Faktureringsgrupp för tilläggsfakturan */}
                {billingGroupName && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <h3 className="text-xs font-medium text-slate-400 mb-1.5">Faktureringsgrupp</h3>
                    <p className="text-sm text-slate-300">{billingGroupName}</p>
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
                {/* Faktureringsuppgifter + avtal + säljare + karta */}
                <div className="flex-shrink-0 overflow-y-auto border-b border-slate-700 p-3 space-y-3">
                  {/* Ärendemärkning — kundens obligatoriska fält + strängen som blir Er referens */}
                  {marking && <InvoiceMarkingSection marking={marking} customerName={invoice.customer_name} />}

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
                  {hasAddonLines && <InvoiceAddonSideCard addons={addons} />}
                  {(invoice.invoice_type === 'contract' || invoice.invoice_type === 'adhoc') && contractCustomer && !hasAddonLines && (
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

                {/* Kommunikation — case-fakturor via ärendet, årspremiefakturor via avtalsärendet */}
                {commCaseId && commCaseType && (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/30">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Kommunikation</span>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col px-3 py-2">
                      <CommentSection
                        caseId={commCaseId}
                        caseType={commCaseType}
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
                    {/* Ärendemärkning — samma panel som desktop */}
                    {marking && <InvoiceMarkingSection marking={marking} customerName={invoice.customer_name} />}

                    {/* Utfört arbete — samma innehåll som desktop-sektionen */}
                    <WorkPerformedSection {...workPerformedProps} />

                    {/* Avtalskontext — mobil */}
                    {(invoice.invoice_type === 'contract' || invoice.invoice_type === 'adhoc') && (
                      <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                        <p className="text-xs text-slate-400">
                          {invoice.invoice_type === 'contract' ? 'Avtalsfakturering' : hasAddonLines ? 'Tillägg utöver avtalet' : 'Merförsäljning'}
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

                    {/* Kommunikation — case-fakturor via ärendet, årspremiefakturor via avtalsärendet */}
                    {commCaseId && commCaseType && (
                      <div className="min-h-[200px]">
                        <CommentSection
                          caseId={commCaseId}
                          caseType={commCaseType}
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

            <div className="flex items-center gap-2">
              {/* Spärrindikator — read-only, knappen förblir klickbar */}
              {showBlockers && blockers.length > 0 && (
                <span className={`text-[11px] max-w-[280px] truncate ${severeBlocker ? 'text-red-400' : 'text-amber-400'}`}>
                  ⚠ {blockers.length} att kontrollera · {blockers[0].label}
                </span>
              )}
              {/* Diskret godkännandekvitto — vem och när */}
              {invoice.approved_by_name && invoice.approved_at && (
                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                  Godkänd av {invoice.approved_by_name} · {invoice.approved_at.slice(0, 10)}
                </span>
              )}
              {/* Kontrollerat avtal ändrat efter kontrollen: öppna avtalskartan */}
              {invoice.invoice_type === 'contract' && contractReview?.state === 'andrad' && invoice.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={openContractMapForReview}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 rounded-lg transition-colors"
                  title="Öppnar avtalskartan i en ny flik. Stäm av avtalet och markera det som kontrollerat där."
                >
                  <Icon name="kund.avtal-kontrollerat" size={16} />
                  Kontrollera igen
                </button>
              )}
              {invoice.status === 'pending_approval' && (
                <button
                  onClick={handleApprove}
                  disabled={approving || !profile?.can_approve_invoices || (!!deliveryEval && !deliveryEval.ok) || premiumUnconfirmed}
                  title={!profile?.can_approve_invoices
                    ? 'Endast faktureringsansvarig kan godkänna'
                    : premiumUnconfirmed
                    ? PREMIUM_REVIEW_BLOCK_MESSAGE
                    : deliveryEval && !deliveryEval.ok
                      ? deliveryEval.message ?? 'Fakturavägen är inte bekräftad'
                      : undefined}
                  className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-[#20c58f] text-[#20c58f] hover:bg-[#20c58f]/10 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approving
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <CheckCircle className="w-3.5 h-3.5" />}
                  {approving ? 'Godkänner...' : 'Godkänn'}
                </button>
              )}
              {(invoice.status === 'pending_approval' || invoice.status === 'ready') && (
                <button
                  onClick={requestSendToFortnox}
                  disabled={sendingToFortnox || invoice.status === 'pending_approval' || (!!deliveryEval && !deliveryEval.ok) || premiumUnconfirmed}
                  title={invoice.status === 'pending_approval'
                    ? 'Låst tills fakturan godkänts av faktureringsansvarig'
                    : premiumUnconfirmed
                    ? PREMIUM_REVIEW_BLOCK_MESSAGE
                    : deliveryEval && !deliveryEval.ok
                      ? deliveryEval.message ?? 'Fakturavägen är inte bekräftad'
                      : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1bb07e] text-sm text-[#fff] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    blockers.length > 0
                      ? severeBlocker
                        ? 'border border-red-400/60'
                        : 'border border-amber-400/50'
                      : ''
                  }`}
                >
                  {sendingToFortnox
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : invoice.status === 'pending_approval'
                      ? <Lock className="w-3.5 h-3.5" />
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
                    onClick={handleRestore}
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

      {/* Varning vid för tidig sändning till Fortnox */}
      <EarlySendDialog
        items={earlyItems}
        today={todaySe}
        onWait={() => setEarlyItems([])}
        onSendAnyway={() => {
          setEarlyItems([])
          handleSendToFortnox()
        }}
      />
    </div>
  )
}
