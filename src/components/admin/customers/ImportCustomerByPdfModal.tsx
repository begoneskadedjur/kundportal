// src/components/admin/customers/ImportCustomerByPdfModal.tsx
// Importerar avtalskund via AI-scannad PDF — identisk preview/confirm som ImportCustomerByOrgnrModal
// men med PDF-upload + Gemini AI-extraktion istället för Oneflow som avtalskälla.
import { useState, useEffect, useRef } from 'react'
import {
  Building2, CheckCircle, AlertCircle, Loader2, ExternalLink, Edit3, Save, Receipt,
  ChevronDown, ChevronRight, CalendarDays, FileSignature, Upload, FileText, Sparkles
} from 'lucide-react'
import { BILLING_FREQUENCY_CONFIG, type BillingFrequency } from '../../../types/contractBilling'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'
import { ContractInvoiceGenerator } from '../../../services/contractInvoiceGenerator'
import { CustomerGroupService } from '../../../services/customerGroupService'
import { PriceListService } from '../../../services/priceListService'
import { supabase, getAuthHeaders } from '../../../lib/supabase'
import type { PriceList } from '../../../types/articles'
import type { CustomerGroup } from '../../../types/customerGroups'
import { useContractTypeOptions } from '../../../hooks/useContractTypeOptions'

const MONTHS_SV = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

interface FortnoxInvoiceRow {
  ArticleNumber?: string
  Description: string
  DeliveredQuantity: number
  Price: number
  Total?: number
}

interface FortnoxInvoice {
  DocumentNumber: string
  Total: number
  Balance: number
  DueDate: string
  InvoiceDate: string
  FinalPayDate: string | null
  Sent: boolean
  InvoiceRows: FortnoxInvoiceRow[]
}

interface PreviewData {
  company_name: string
  organization_number: string
  customer_number: number | null
  billing_email: string | null
  billing_address: string | null
  currency: string
  is_active: boolean
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  contract_length: string | null
  annual_value: number | null
  products: any[] | null
  oneflow_contract_id: string | null
  contract_type: string | null
  agreement_text: string | null
  sales_person: string | null
  sales_person_email: string | null
  assigned_account_manager: string | null
  account_manager_email: string | null
  customer_group_id: string | null
  billing_frequency: BillingFrequency
  billing_anchor_month: number
  price_list_id: string | null
}

interface ExtractedContract {
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  address_label: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  contract_length: string | null
  company_name_oneflow: string | null
  annual_value: number | null
  total_contract_value: number | null
  products: Array<{ name: string; quantity: number; price: number; description: string }> | null
  oneflow_contract_id: string
  contract_type: string | null
  agreement_text: string | null
  sales_person: string | null
  sales_person_email: string | null
  assigned_account_manager: string | null
  account_manager_email: string | null
}

interface AiExtractedData {
  company_name: string | null
  organization_number: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  billing_email: string | null
  billing_address: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  contract_length: string | null
  annual_value: number | null
  agreement_text: string | null
  products: Array<{ name: string; description?: string; quantity?: number; price?: number }> | null
  sales_person: string | null
  sales_person_email: string | null
  assigned_account_manager: string | null
  account_manager_email: string | null
  business_type: string | null
  confidence_score: number
  extraction_notes: string
}

interface ImportCustomerByPdfModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: (customerId: string) => void
}

type Step = 'upload' | 'extracting' | 'preview' | 'saving' | 'done'

function parseContractLengthMonthsStrict(text: string | null | undefined): number | null {
  if (!text) return null
  const match = String(text).match(/(\d+)\s*(år|year|years|months?|månader?|månad|mån)/i)
  if (!match) return null
  const n = parseInt(match[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return /år|year/i.test(match[2]) ? n * 12 : n
}

function Field({
  label, value, onChange, placeholder, type = 'text', readOnly = false
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  readOnly?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder ?? ''}
        readOnly={readOnly}
        className={`w-full px-3 py-1.5 text-sm rounded-lg border text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent
          ${readOnly
            ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 cursor-default'
            : 'bg-slate-800 border-slate-600'
          }`}
      />
    </div>
  )
}

function getNextBillingDates(anchorMonth: number, frequency: BillingFrequency, count: number): string[] {
  const config = BILLING_FREQUENCY_CONFIG[frequency]
  if (!config || frequency === 'on_demand') return []
  const intervalMonths = config.months
  const today = new Date()
  const dates: string[] = []
  let year = today.getFullYear()
  let month = anchorMonth
  while (dates.length < count) {
    const d = new Date(year, month - 1, 1)
    if (d >= today) {
      dates.push(d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }))
    }
    month += intervalMonths
    if (month > 12) { month -= 12; year++ }
    if (year > today.getFullYear() + 3) break
  }
  return dates.slice(0, count)
}

const formatAmount = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

export default function ImportCustomerByPdfModal({
  isOpen, onClose, onImported,
}: ImportCustomerByPdfModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const { options: contractTypeOptions } = useContractTypeOptions()

  useEffect(() => {
    CustomerGroupService.getAllGroups().then(setCustomerGroups).catch(() => {})
    PriceListService.getAllPriceLists().then(setPriceLists).catch(() => {})
  }, [])

  // PDF-upload state
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [aiExtracted, setAiExtracted] = useState<AiExtractedData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview state (identisk med ImportCustomerByOrgnrModal)
  const [sources, setSources] = useState<{ fortnox: boolean; pdf: boolean } | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [invoices, setInvoices] = useState<FortnoxInvoice[]>([])
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set())
  const [invoiceTypes, setInvoiceTypes] = useState<Record<string, 'contract' | 'ad_hoc'>>({})
  const [error, setError] = useState<{ message: string; existingId?: string; existingName?: string } | null>(null)
  const [savedCustomer, setSavedCustomer] = useState<{ id: string; company_name: string } | null>(null)
  const [extractedContracts, setExtractedContracts] = useState<ExtractedContract[]>([])
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set())
  const [editedContracts, setEditedContracts] = useState<Record<string, ExtractedContract>>({})
  const [activeContractTab, setActiveContractTab] = useState<string | null>(null)

  const handleClose = () => {
    setStep('upload')
    setSelectedFile(null)
    setAiExtracted(null)
    setPreview(null)
    setInvoices([])
    setExpandedInvoices(new Set())
    setSelectedForImport(new Set())
    setInvoiceTypes({})
    setError(null)
    setSources(null)
    setSavedCustomer(null)
    setExtractedContracts([])
    setSelectedContractIds(new Set())
    setEditedContracts({})
    setActiveContractTab(null)
    onClose()
  }

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Endast PDF-filer stöds')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF-filen är för stor (max 10 MB)')
      return
    }
    setSelectedFile(file)
    setError(null)
  }

  const handleExtract = async () => {
    if (!selectedFile) return
    setStep('extracting')
    setError(null)

    try {
      // Konvertera PDF till base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Ta bort data URL-prefix
          resolve(result.split(',')[1] || result)
        }
        reader.onerror = reject
        reader.readAsDataURL(selectedFile)
      })

      // Steg 1: AI extraherar avtalsdata från PDF
      const aiRes = await fetch('/api/extract-begone-contract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 }),
      })
      const aiData = await aiRes.json()

      if (!aiRes.ok || !aiData.success) {
        setError({ message: aiData.error || 'AI-extraktion misslyckades' })
        setStep('upload')
        return
      }

      const extracted: AiExtractedData = aiData.data
      setAiExtracted(extracted)

      // Steg 2: Hämta Fortnox-data via org.nr (samma som ImportCustomerByOrgnrModal)
      const orgNr = extracted.organization_number?.trim()
      if (!orgNr) {
        setError({ message: 'AI kunde inte hitta organisationsnumret i PDF:en. Kontrollera att det är ett företagsavtal.' })
        setStep('upload')
        return
      }

      const fortnoxRes = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ org_nr: orgNr }),
      })
      const fortnoxData = await fortnoxRes.json()

      if (fortnoxRes.status === 409) {
        setError({
          message: fortnoxData.error,
          existingId: fortnoxData.existing_customer?.id,
          existingName: fortnoxData.existing_customer?.company_name,
        })
        setStep('upload')
        return
      }

      // Fortnox-fel är icke-blockerande — fortsätt med enbart AI-data
      const fortnoxOk = fortnoxRes.ok && fortnoxData.success
      const fortnoxPreview = fortnoxOk ? fortnoxData.preview : null
      const fetchedInvoices: FortnoxInvoice[] = fortnoxOk ? (fortnoxData.invoices ?? []) : []

      // Bygg preview: AI-data har prioritet för avtalsdetaljer, Fortnox för företagsinfo
      const contractStart = extracted.contract_start_date
      const anchorMonth = contractStart
        ? new Date(contractStart + 'T00:00:00').getMonth() + 1
        : new Date().getMonth() + 1

      // Unikt pseudo-ID för det AI-extraherade avtalet (aldrig Oneflow)
      const pseudoContractId = `pdf-import-${Date.now()}`

      const mergedPreview: PreviewData = {
        // Fortnox-data (auktoritativ för bolagsinfo)
        company_name: fortnoxPreview?.company_name ?? extracted.company_name ?? '',
        organization_number: fortnoxPreview?.organization_number ?? orgNr,
        customer_number: fortnoxPreview?.customer_number ?? null,
        currency: fortnoxPreview?.currency ?? 'SEK',
        is_active: true,
        // AI-data har prioritet för kontakt + fakturering (direkt ur avtalet)
        contact_person: extracted.contact_person ?? fortnoxPreview?.contact_person ?? null,
        contact_email: extracted.contact_email ?? fortnoxPreview?.contact_email ?? null,
        contact_phone: extracted.contact_phone ?? fortnoxPreview?.contact_phone ?? null,
        contact_address: extracted.contact_address ?? fortnoxPreview?.contact_address ?? null,
        billing_email: extracted.billing_email ?? fortnoxPreview?.billing_email ?? null,
        billing_address: extracted.billing_address ?? fortnoxPreview?.billing_address ?? null,
        // Avtalsdata från AI
        contract_start_date: extracted.contract_start_date ?? null,
        contract_end_date: extracted.contract_end_date ?? null,
        contract_length: extracted.contract_length ?? null,
        annual_value: extracted.annual_value ?? null,
        products: extracted.products ?? null,
        oneflow_contract_id: pseudoContractId,
        contract_type: null,
        agreement_text: extracted.agreement_text ?? null,
        sales_person: extracted.sales_person ?? null,
        sales_person_email: extracted.sales_person_email ?? null,
        assigned_account_manager: extracted.assigned_account_manager ?? null,
        account_manager_email: extracted.account_manager_email ?? null,
        customer_group_id: fortnoxPreview?.customer_group_id ?? null,
        billing_frequency: fortnoxPreview?.billing_frequency ?? 'annual',
        billing_anchor_month: anchorMonth,
        price_list_id: fortnoxPreview?.price_list_id
          ?? priceLists.find(pl => pl.is_default)?.id
          ?? null,
      }

      setPreview(mergedPreview)
      setInvoices(fetchedInvoices)
      setSelectedForImport(new Set(fetchedInvoices.map((inv: FortnoxInvoice) => inv.DocumentNumber)))
      setInvoiceTypes(Object.fromEntries(fetchedInvoices.map((inv: FortnoxInvoice) => [inv.DocumentNumber, 'contract' as const])))

      // Bygg ett ExtractedContract från AI-datan (som "singel-kontrakt" — samma mönster som Oneflow)
      const aiContract: ExtractedContract = {
        contact_person: extracted.contact_person ?? null,
        contact_email: extracted.contact_email ?? null,
        contact_phone: extracted.contact_phone ?? null,
        contact_address: extracted.contact_address ?? null,
        address_label: extracted.contact_address ?? null,
        contract_start_date: extracted.contract_start_date ?? null,
        contract_end_date: extracted.contract_end_date ?? null,
        contract_length: extracted.contract_length ?? null,
        company_name_oneflow: extracted.company_name ?? null,
        annual_value: extracted.annual_value ?? null,
        total_contract_value: null,
        products: (extracted.products ?? null) as any,
        oneflow_contract_id: pseudoContractId,
        contract_type: null,
        agreement_text: extracted.agreement_text ?? null,
        sales_person: extracted.sales_person ?? null,
        sales_person_email: extracted.sales_person_email ?? null,
        assigned_account_manager: extracted.assigned_account_manager ?? null,
        account_manager_email: extracted.account_manager_email ?? null,
      }

      setExtractedContracts([aiContract])
      setSelectedContractIds(new Set([pseudoContractId]))
      setEditedContracts({ [pseudoContractId]: { ...aiContract } })
      setActiveContractTab(pseudoContractId)

      setSources({ fortnox: fortnoxOk, pdf: true })
      setStep('preview')
    } catch {
      setError({ message: 'Nätverksfel – kontrollera anslutningen och försök igen' })
      setStep('upload')
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setStep('saving')

    try {
      const customerPayload = { ...preview, billing_active: true }

      const selectedContracts = extractedContracts
        .filter(c => selectedContractIds.has(c.oneflow_contract_id))
        .map(c => editedContracts[c.oneflow_contract_id] ?? c)

      const res = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: 'confirm',
          customer_data: customerPayload,
          selected_contracts: selectedContracts,
        }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setError({ message: data.error, existingId: data.existing_customer?.id })
        setStep('preview')
        return
      }
      if (!res.ok || !data.success) {
        setError({ message: data.error || 'Kunde inte spara kunden' })
        setStep('preview')
        return
      }

      const customerId = data.customer.id

      try {
        await ContractInvoiceGenerator.regenerateForCustomer(customerId)
      } catch (e: any) {
        console.warn('[pdf-import] fakturaplan-generering misslyckades:', e?.message ?? e)
        toast.error('Kund skapades men fakturaplan kunde inte genereras automatiskt')
      }

      const { data: contractRow } = await supabase
        .from('contracts')
        .select('id')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const toImport = invoices
        .filter(inv => selectedForImport.has(inv.DocumentNumber))
        .map(inv => ({ ...inv, importType: invoiceTypes[inv.DocumentNumber] ?? 'contract' as const }))

      if (toImport.length > 0) {
        try {
          const result = await ContractBillingService.importHistoricalItems(customerId, toImport, contractRow?.id)
          const baseMsg = `${result.imported || toImport.length} historiska faktura(or) importerade`
          if (result.replacedAutogen > 0) {
            toast.success(`${baseMsg}. ${result.replacedAutogen} autogenererad(e) dubblett(er) rensades.`)
          } else {
            toast.success(`${baseMsg} till pipeline`)
          }
        } catch (e: any) {
          toast.error(`Kund skapades men historikimport misslyckades: ${e.message}`)
        }
      }

      setSavedCustomer(data.customer)
      setStep('done')
      toast.success(`${data.customer.company_name} importerad!`)
    } catch {
      setError({ message: 'Nätverksfel vid sparning' })
      setStep('preview')
    }
  }

  const update = (field: keyof PreviewData) => (value: string) => {
    setPreview(prev => prev ? { ...prev, [field]: value || null } : prev)
  }

  const selectedContractsList = extractedContracts.filter(c =>
    selectedContractIds.has(c.oneflow_contract_id)
  )
  const activeContract: ExtractedContract | null = activeContractTab && editedContracts[activeContractTab]
    ? editedContracts[activeContractTab]
    : selectedContractsList[0]
      ? editedContracts[selectedContractsList[0].oneflow_contract_id] ?? selectedContractsList[0]
      : null

  useEffect(() => {
    if (selectedContractsList.length === 0) return
    if (!activeContractTab || !selectedContractIds.has(activeContractTab)) {
      setActiveContractTab(selectedContractsList[0].oneflow_contract_id)
    }
  }, [selectedContractIds, selectedContractsList, activeContractTab])

  useEffect(() => {
    if (!activeContract?.contract_start_date) return
    setPreview(prev => {
      if (!prev) return prev
      const month = new Date(activeContract.contract_start_date! + 'T00:00:00').getMonth() + 1
      if (prev.billing_anchor_month === month) return prev
      return { ...prev, billing_anchor_month: month }
    })
  }, [activeContractTab, activeContract?.contract_start_date])

  const updateContract = <K extends keyof ExtractedContract>(field: K) => (value: ExtractedContract[K]) => {
    if (!activeContractTab) return
    setEditedContracts(prev => ({
      ...prev,
      [activeContractTab]: { ...prev[activeContractTab], [field]: value },
    }))
  }

  const setInvoiceType = (docNr: string, type: 'contract' | 'ad_hoc') => {
    setInvoiceTypes(prev => ({ ...prev, [docNr]: type }))
  }

  const toggleExpand = (docNr: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev)
      if (next.has(docNr)) next.delete(docNr); else next.add(docNr)
      return next
    })
  }

  const toggleImport = (docNr: string) => {
    setSelectedForImport(prev => {
      const next = new Set(prev)
      if (next.has(docNr)) next.delete(docNr); else next.add(docNr)
      return next
    })
  }

  const nextBillingDates = preview
    ? getNextBillingDates(preview.billing_anchor_month, preview.billing_frequency, 4)
    : []

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span>Importera kund via PDF</span>
        </div>
      }
      subtitle={
        step === 'upload' ? 'AI scannar avtalet och hämtar historik från Fortnox' :
        step === 'extracting' ? 'AI analyserar avtalet...' :
        step === 'preview' ? 'Granska och redigera uppgifterna innan import' :
        step === 'saving' ? 'Sparar kunden...' :
        'Kund importerad!'
      }
      size="lg"
    >
      <div className="p-4 space-y-4">

        {/* ── STEG 1: PDF-UPLOAD ── */}
        {step === 'upload' && (
          <div className="space-y-3">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handleFileSelect(file)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-violet-400 bg-violet-500/10'
                  : selectedFile
                    ? 'border-[#20c58f]/50 bg-[#20c58f]/5'
                    : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-[#20c58f]" />
                  <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(0)} KB — klicka för att byta fil</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-slate-500" />
                  <p className="text-sm font-medium text-slate-300">Dra och släpp PDF-avtal här</p>
                  <p className="text-xs text-slate-500">eller klicka för att välja fil (max 10 MB)</p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="flex items-start gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                <span>Gemini AI extraherar avtalsdetaljer och söker sedan upp historiska fakturor i Fortnox automatiskt.</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEG 2: AI ANALYSERAR ── */}
        {step === 'extracting' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-violet-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">AI analyserar avtalet...</p>
              <p className="text-xs text-slate-400 mt-1">Extraherar kunduppgifter och hämtar Fortnox-historik</p>
            </div>
          </div>
        )}

        {/* ── FEL ── */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="text-sm text-red-300 font-medium">{error.message}</p>
                {error.existingName && (
                  <p className="text-xs text-red-400">Befintlig kund: <span className="font-medium text-red-300">{error.existingName}</span></p>
                )}
                {error.existingId && (
                  <button
                    onClick={() => { handleClose(); window.location.href = `/admin/befintliga-kunder/${error.existingId}` }}
                    className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />Öppna befintlig kund
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEG 3: PREVIEW + REDIGERING ── */}
        {(step === 'preview' || step === 'saving') && preview && (
          <>
            {/* Källindikator */}
            {sources && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${sources.fortnox ? 'text-[#20c58f] bg-[#20c58f]/10 border-[#20c58f]/30' : 'text-amber-400 bg-amber-400/10 border-amber-400/30'}`}>
                  {sources.fortnox ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  Fortnox {!sources.fortnox && '(ej hittad)'}
                </div>
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border text-violet-400 bg-violet-400/10 border-violet-400/30">
                  <Sparkles className="w-3 h-3" />
                  PDF (AI-extraktion)
                </div>
                {aiExtracted && (
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
                    aiExtracted.confidence_score >= 80
                      ? 'text-[#20c58f] bg-[#20c58f]/10 border-[#20c58f]/30'
                      : aiExtracted.confidence_score >= 50
                        ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                        : 'text-red-400 bg-red-400/10 border-red-400/30'
                  }`}>
                    {aiExtracted.confidence_score}% säkerhet
                  </div>
                )}
                {aiExtracted?.extraction_notes && (
                  <div className="flex items-center gap-1 text-xs text-amber-400/80 ml-auto" title={aiExtracted.extraction_notes}>
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[200px]">{aiExtracted.extraction_notes}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                  <Edit3 className="w-3 h-3" />
                  <span>Fälten kan redigeras</span>
                </div>
              </div>
            )}

            {/* Sektion: Företagsinformation */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />Företagsinformation
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Företagsnamn" value={preview.company_name ?? ''} onChange={update('company_name')} />
                <Field label="Org.nummer" value={preview.organization_number ?? ''} readOnly />
                <Field label="Kundnummer (Fortnox)" value={preview.customer_number?.toString() ?? ''} readOnly />
                <Field label="Valuta" value={preview.currency ?? 'SEK'} onChange={update('currency')} />
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    Kundgrupp
                    {preview.customer_group_id && <span className="ml-1 text-[#20c58f]">(auto-matchad)</span>}
                  </label>
                  <Select
                    value={preview.customer_group_id ?? ''}
                    onChange={v => setPreview(prev => prev ? { ...prev, customer_group_id: v || null } : prev)}
                    placeholder="Välj kundgrupp"
                    options={[
                      { value: '', label: 'Välj kundgrupp' },
                      ...customerGroups.map(g => ({ value: g.id, label: `${g.name} (${g.series_start}–${g.series_end})` }))
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Kontaktuppgifter */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Kontaktuppgifter</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Kontaktperson"
                  value={(activeContract?.contact_person ?? preview.contact_person) ?? ''}
                  onChange={v => activeContract ? updateContract('contact_person')(v || null) : update('contact_person')(v)}
                  placeholder="Ej hämtat"
                />
                <Field
                  label="E-post kontakt"
                  value={(activeContract?.contact_email ?? preview.contact_email) ?? ''}
                  onChange={v => activeContract ? updateContract('contact_email')(v || null) : update('contact_email')(v)}
                  placeholder="Ej hämtat"
                />
                <Field
                  label="Telefon"
                  value={(activeContract?.contact_phone ?? preview.contact_phone) ?? ''}
                  onChange={v => activeContract ? updateContract('contact_phone')(v || null) : update('contact_phone')(v)}
                  placeholder="Ej hämtat"
                />
                <Field
                  label="Utförande adress"
                  value={(activeContract?.contact_address ?? preview.contact_address) ?? ''}
                  onChange={v => {
                    if (activeContract) {
                      updateContract('contact_address')(v || null)
                      if (!activeContract.address_label || activeContract.address_label === activeContract.contact_address) {
                        updateContract('address_label')(v || null)
                      }
                    } else {
                      update('contact_address')(v)
                    }
                  }}
                  placeholder="Ej hämtat"
                />
              </div>
            </div>

            {/* Fakturering */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Fakturering</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Faktura e-post" value={preview.billing_email ?? ''} onChange={update('billing_email')} placeholder="Ej hämtat" />
                <div className="col-span-2">
                  <Field label="Faktura adress" value={preview.billing_address ?? ''} onChange={update('billing_address')} placeholder="Ej hämtat" />
                </div>
              </div>
            </div>

            {/* Avtal & fakturering */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-slate-400" />Avtal &amp; fakturering
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Avtalstyp</label>
                  <Select
                    value={(activeContract?.contract_type ?? preview.contract_type) ?? ''}
                    onChange={v => activeContract
                      ? updateContract('contract_type')(v || null)
                      : setPreview(prev => prev ? { ...prev, contract_type: v || null } : prev)
                    }
                    placeholder={contractTypeOptions.length === 0 ? 'Flagga tjänster som "Använd som avtalstyp"' : 'Välj avtalstyp'}
                    options={contractTypeOptions}
                  />
                </div>

                <Field
                  label="Avtalsstart"
                  value={(activeContract?.contract_start_date ?? preview.contract_start_date) ?? ''}
                  onChange={v => activeContract ? updateContract('contract_start_date')(v || null) : update('contract_start_date')(v)}
                  placeholder="ÅÅÅÅ-MM-DD"
                />
                <Field
                  label="Kontraktsslut"
                  value={(activeContract?.contract_end_date ?? preview.contract_end_date) ?? ''}
                  onChange={v => activeContract ? updateContract('contract_end_date')(v || null) : update('contract_end_date')(v)}
                  placeholder="ÅÅÅÅ-MM-DD"
                />
                <Field
                  label="Avtalslängd"
                  value={(activeContract?.contract_length ?? preview.contract_length) ?? ''}
                  onChange={v => activeContract ? updateContract('contract_length')(v || null) : update('contract_length')(v)}
                  placeholder="t.ex. 3 år"
                />
                <div>
                  <Field
                    label="Årsvärde (kr)"
                    value={(activeContract?.annual_value ?? preview.annual_value)?.toString() ?? ''}
                    onChange={v => {
                      const num = parseFloat(v) || null
                      if (activeContract) {
                        updateContract('annual_value')(num)
                      } else {
                        setPreview(prev => prev ? { ...prev, annual_value: num } : prev)
                      }
                    }}
                    placeholder="0"
                    type="number"
                  />
                  {(() => {
                    const lengthVal = activeContract?.contract_length ?? preview.contract_length
                    const annualVal = activeContract?.annual_value ?? preview.annual_value
                    const months = parseContractLengthMonthsStrict(lengthVal)
                    if (!months || !annualVal || annualVal <= 0) return null
                    if (months >= 12) {
                      const total = Math.round(annualVal * (months / 12))
                      return (
                        <p className="text-xs text-slate-500 mt-1">
                          Avtalstid {months} mån · totalvärde {total.toLocaleString('sv-SE')} kr
                        </p>
                      )
                    }
                    return (
                      <p className="text-xs text-slate-500 mt-1">
                        Kortare avtal ({months} mån) — årspremien debiteras en gång
                      </p>
                    )
                  })()}
                </div>
                <Field
                  label="Account Manager"
                  value={(activeContract?.assigned_account_manager ?? preview.assigned_account_manager) ?? ''}
                  onChange={v => activeContract ? updateContract('assigned_account_manager')(v || null) : update('assigned_account_manager')(v)}
                  placeholder="Ej hämtat"
                />
                <Field
                  label="Account Manager e-post"
                  value={(activeContract?.account_manager_email ?? preview.account_manager_email) ?? ''}
                  onChange={v => activeContract ? updateContract('account_manager_email')(v || null) : update('account_manager_email')(v)}
                  placeholder="Ej hämtat"
                />
                <Field
                  label="Säljare"
                  value={(activeContract?.sales_person ?? preview.sales_person) ?? ''}
                  onChange={v => activeContract ? updateContract('sales_person')(v || null) : update('sales_person')(v)}
                  placeholder="Ej hämtat"
                />
                <Field
                  label="Säljare e-post"
                  value={(activeContract?.sales_person_email ?? preview.sales_person_email) ?? ''}
                  onChange={v => activeContract ? updateContract('sales_person_email')(v || null) : update('sales_person_email')(v)}
                  placeholder="Ej hämtat"
                />

                {/* Avtalsobjekt */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Avtalsobjekt</label>
                  <textarea
                    value={(activeContract?.agreement_text ?? preview.agreement_text) ?? ''}
                    onChange={e => {
                      const v = e.target.value || null
                      if (activeContract) updateContract('agreement_text')(v)
                      else setPreview(prev => prev ? { ...prev, agreement_text: v } : prev)
                    }}
                    rows={2}
                    placeholder="Ej hämtat"
                    className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-none"
                  />
                </div>

                {/* Faktureringsfrekvens */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Faktureringsfrekvens</label>
                  <Select
                    value={preview.billing_frequency}
                    onChange={v => setPreview(prev => prev ? { ...prev, billing_frequency: v as BillingFrequency } : prev)}
                    options={Object.entries(BILLING_FREQUENCY_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label }))}
                  />
                </div>

                {/* Prislista */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Prislista för extra-tjänster</label>
                  <Select
                    value={preview.price_list_id ?? ''}
                    onChange={v => setPreview(prev => prev ? { ...prev, price_list_id: v || null } : prev)}
                    options={[
                      { value: '', label: 'Standardprislista (auto)' },
                      ...priceLists.map(pl => ({ value: pl.id, label: pl.name })),
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Fakturainställningar */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-400" />Fakturainställningar
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    Ankarmånad
                    {preview.contract_start_date && (
                      <span className="ml-1 text-slate-500">(härledd från avtalsstart)</span>
                    )}
                  </label>
                  <Select
                    value={String(preview.billing_anchor_month)}
                    onChange={v => setPreview(prev => prev ? { ...prev, billing_anchor_month: parseInt(v) } : prev)}
                    options={MONTHS_SV.map((name, i) => ({ value: String(i + 1), label: name }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Kommande faktureringar</label>
                  {nextBillingDates.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {nextBillingDates.map((d, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-[#20c58f]/10 border border-[#20c58f]/30 text-[#20c58f] rounded-full">{d}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Historiska fakturor */}
            {invoices.length > 0 && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-slate-300">Historiska fakturor (Fortnox)</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{selectedForImport.size}/{invoices.length} markerade för import</span>
                    <button
                      onClick={() => setSelectedForImport(
                        selectedForImport.size === invoices.length
                          ? new Set()
                          : new Set(invoices.map(inv => inv.DocumentNumber))
                      )}
                      className="text-[#20c58f] hover:text-[#20c58f]/80"
                    >
                      {selectedForImport.size === invoices.length ? 'Avmarkera alla' : 'Markera alla'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Klicka på en faktura för att sätta den månaden som ankarmånad. Bocka i för att importera till fakturapipelinen.</p>
                <div className="space-y-1">
                  {invoices.map(inv => {
                    const paid = !!inv.FinalPayDate || inv.Balance === 0
                    const expanded = expandedInvoices.has(inv.DocumentNumber)
                    const checked = selectedForImport.has(inv.DocumentNumber)
                    const invoiceMonth = new Date(inv.InvoiceDate + 'T00:00:00').getMonth() + 1
                    const invType = invoiceTypes[inv.DocumentNumber] ?? 'contract'
                    const isContract = invType === 'contract'
                    const isAnchor = isContract && preview.billing_anchor_month === invoiceMonth

                    return (
                      <div key={inv.DocumentNumber} className={`rounded-lg border transition-colors ${isAnchor ? 'border-[#20c58f]/40 bg-[#20c58f]/5' : 'border-slate-700/50 bg-slate-800/40'}`}>
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleImport(inv.DocumentNumber)}
                            className="rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] shrink-0"
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            className={`flex items-center gap-2 flex-1 text-left ${isContract ? 'hover:opacity-80' : 'cursor-default'}`}
                            onClick={() => {
                              if (isContract) setPreview(prev => prev ? { ...prev, billing_anchor_month: invoiceMonth } : prev)
                            }}
                            title={isContract ? 'Klicka för att använda denna månaden som ankarmånad' : undefined}
                          >
                            <span className="text-slate-400 w-24 shrink-0">{inv.InvoiceDate}</span>
                            <span className="text-slate-300 w-20 shrink-0">#{inv.DocumentNumber}</span>
                            <span className="text-slate-300 flex-1 text-right pr-2">{formatAmount(inv.Total)}</span>
                            <span className={`w-16 text-right shrink-0 ${paid ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {paid ? 'Betald' : 'Obetald'}
                            </span>
                            {isAnchor && (
                              <span className="ml-1 text-[#20c58f] text-[10px] font-medium shrink-0">● Ankarmånad</span>
                            )}
                          </button>
                          <select
                            value={invType}
                            onChange={e => setInvoiceType(inv.DocumentNumber, e.target.value as 'contract' | 'ad_hoc')}
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-xs bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                          >
                            <option value="contract">Avtal</option>
                            <option value="ad_hoc">Engång</option>
                          </select>
                          <button
                            onClick={() => toggleExpand(inv.DocumentNumber)}
                            className="text-slate-500 hover:text-slate-300 shrink-0"
                          >
                            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {expanded && inv.InvoiceRows.length > 0 && (
                          <div className="border-t border-slate-700/50 px-3 py-2 space-y-1">
                            {inv.InvoiceRows.map((row, ri) => (
                              <div key={ri} className="flex items-center justify-between text-xs text-slate-400">
                                <span className="flex-1 truncate">{row.Description || '—'}</span>
                                <span className="ml-2 shrink-0 text-slate-500">{row.DeliveredQuantity} st</span>
                                <span className="ml-3 shrink-0 text-slate-300">{formatAmount(row.Price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {expanded && inv.InvoiceRows.length === 0 && (
                          <div className="border-t border-slate-700/50 px-3 py-2 text-xs text-slate-500">
                            Inga raddetaljer tillgängliga
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tom Fortnox-varning */}
            {invoices.length === 0 && sources && !sources.fortnox && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Kunden hittades inte i Fortnox — inga historiska fakturor importeras. Övriga fält kan fortfarande sparas.</span>
              </div>
            )}
          </>
        )}

        {/* ── STEG 4: KLAR ── */}
        {step === 'done' && savedCustomer && (
          <div className="p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#20c58f]" />
              <p className="text-sm text-[#20c58f] font-medium">Kund importerad!</p>
            </div>
            <p className="text-sm text-slate-300">{savedCustomer.company_name} har lagts till i systemet.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          {step === 'done' ? 'Stäng' : 'Avbryt'}
        </Button>

        <div className="flex gap-2">
          {step === 'upload' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleExtract}
              disabled={!selectedFile}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Analysera med AI
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setError(null) }}>
                Byt PDF
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirm}>
                <Save className="w-4 h-4 mr-1" />
                Bekräfta import
              </Button>
            </>
          )}
          {step === 'saving' && (
            <Button variant="primary" size="sm" disabled>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Sparar...
            </Button>
          )}
          {step === 'done' && savedCustomer && (
            <Button variant="primary" size="sm" onClick={() => { onImported(savedCustomer.id); handleClose() }}>
              <ExternalLink className="w-4 h-4 mr-1" />
              Visa kund
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
