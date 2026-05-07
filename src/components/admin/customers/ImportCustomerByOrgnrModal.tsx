// src/components/admin/customers/ImportCustomerByOrgnrModal.tsx
import { useState, useEffect } from 'react'
import {
  Building2, Search, CheckCircle, AlertCircle, Loader2, ExternalLink, Edit3, Save, Receipt,
  ChevronDown, ChevronRight, CalendarDays, FileSignature
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

// Multi-kontrakt-refaktor (Fas 4): ett extraherat Oneflow-kontrakt från preview-svaret.
// Motsvarar return-typen från extractOneflowData i api/import-customer-by-orgnr.ts.
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

interface ImportCustomerByOrgnrModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: (customerId: string) => void
}

type Step = 'search' | 'preview' | 'saving' | 'done'

// Extraherar antal månader från fritextfältet (t.ex. "6 månader", "3 år").
// Returnerar null vid okänt format så normalisering hoppas över.
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

/** Beräkna nästa N fakturadatum baserat på ankarmånad och frekvens */
function getNextBillingDates(anchorMonth: number, frequency: BillingFrequency, count: number): string[] {
  const config = BILLING_FREQUENCY_CONFIG[frequency]
  if (!config || frequency === 'on_demand') return []
  const intervalMonths = config.months
  const today = new Date()
  const dates: string[] = []
  let year = today.getFullYear()
  let month = anchorMonth

  // Hitta nästa ankarmånad som är >= idag
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

export default function ImportCustomerByOrgnrModal({
  isOpen, onClose, onImported,
}: ImportCustomerByOrgnrModalProps) {
  const [step, setStep] = useState<Step>('search')
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const { options: contractTypeOptions } = useContractTypeOptions()

  useEffect(() => {
    CustomerGroupService.getAllGroups().then(setCustomerGroups).catch(() => {})
    PriceListService.getAllPriceLists().then(setPriceLists).catch(() => {})
  }, [])
  const [orgNr, setOrgNr] = useState('')
  const [searching, setSearching] = useState(false)
  const [sources, setSources] = useState<{ fortnox: boolean; oneflow: boolean } | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [invoices, setInvoices] = useState<FortnoxInvoice[]>([])
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set())
  const [invoiceTypes, setInvoiceTypes] = useState<Record<string, 'contract' | 'ad_hoc'>>({})
  const [error, setError] = useState<{ message: string; existingId?: string; existingName?: string } | null>(null)
  const [savedCustomer, setSavedCustomer] = useState<{ id: string; company_name: string } | null>(null)
  // Multi-kontrakt-refaktor (Fas 4): alla signerade Oneflow-kontrakt från preview-svaret
  // + vilka som ska importeras (alla förvalda). Visas som väljarsektion när > 1.
  const [extractedContracts, setExtractedContracts] = useState<ExtractedContract[]>([])
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set())
  // Multi-kontrakt-refaktor (Fas 4 v2): redigerbara fält per avtal. Tabs-baserad
  // UI låter admin justera varje avtals data (avtalstid, årsvärde, säljare etc)
  // separat innan import. Map<oneflow_contract_id, ExtractedContract>.
  const [editedContracts, setEditedContracts] = useState<Record<string, ExtractedContract>>({})
  const [activeContractTab, setActiveContractTab] = useState<string | null>(null)

  const handleClose = () => {
    setStep('search')
    setOrgNr('')
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

  const handleSearch = async () => {
    const trimmed = orgNr.trim()
    if (!trimmed) return
    setSearching(true)
    setError(null)

    try {
      const res = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_nr: trimmed }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setError({
          message: data.error,
          existingId: data.existing_customer?.id,
          existingName: data.existing_customer?.company_name,
        })
        return
      }
      if (!res.ok || !data.success) {
        setError({ message: data.error || 'Sökning misslyckades' })
        return
      }

      const contractStart = data.preview.contract_start_date
      const anchorMonth = contractStart
        ? new Date(contractStart + 'T00:00:00').getMonth() + 1
        : new Date().getMonth() + 1

      setPreview({
        ...data.preview,
        billing_frequency: data.preview.billing_frequency ?? 'monthly',
        billing_anchor_month: anchorMonth,
        contract_type: data.preview.contract_type ?? null,
        agreement_text: data.preview.agreement_text ?? null,
        sales_person: data.preview.sales_person ?? null,
        sales_person_email: data.preview.sales_person_email ?? null,
        assigned_account_manager: data.preview.assigned_account_manager ?? null,
        account_manager_email: data.preview.account_manager_email ?? null,
        contract_end_date: data.preview.contract_end_date ?? null,
        customer_group_id: data.preview.customer_group_id ?? null,
        price_list_id: data.preview.price_list_id ?? null,
      })

      const fetchedInvoices: FortnoxInvoice[] = data.invoices ?? []
      setInvoices(fetchedInvoices)
      // Default: alla markerade för import som 'contract'
      setSelectedForImport(new Set(fetchedInvoices.map((inv: FortnoxInvoice) => inv.DocumentNumber)))
      setInvoiceTypes(Object.fromEntries(fetchedInvoices.map((inv: FortnoxInvoice) => [inv.DocumentNumber, 'contract' as const])))

      // Multi-kontrakt: lagra alla extraherade Oneflow-kontrakt + förvälj alla.
      // Backend returnerar contracts: ExtractedContract[] (Fas 3).
      const fetchedContracts: ExtractedContract[] = Array.isArray(data.contracts) ? data.contracts : []
      setExtractedContracts(fetchedContracts)
      setSelectedContractIds(new Set(fetchedContracts.map(c => c.oneflow_contract_id)))
      // Bygg per-avtal Map för redigering. Klona varje kontrakt så att admins
      // ändringar inte muterar den oförändrade extractedContracts-arrayen.
      const map: Record<string, ExtractedContract> = {}
      fetchedContracts.forEach(c => { map[c.oneflow_contract_id] = { ...c } })
      setEditedContracts(map)
      setActiveContractTab(fetchedContracts[0]?.oneflow_contract_id ?? null)

      setSources(data.sources)
      setStep('preview')
    } catch {
      setError({ message: 'Nätverksfel – kontrollera anslutningen och försök igen' })
    } finally {
      setSearching(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setStep('saving')

    try {
      // Skicka med fakturainställningar
      const customerPayload = {
        ...preview,
        billing_active: true,
      }

      // Multi-kontrakt: skicka valda kontrakt med redigerade värden från
      // editedContracts-Map (admin kan ha justerat avtalstid, årsvärde, säljare
      // etc per avtal i tabsen). Vid 0 Oneflow-kontrakt skickas tom array →
      // backend skapar bara customer (legacy-läge).
      const selectedContracts = extractedContracts
        .filter(c => selectedContractIds.has(c.oneflow_contract_id))
        .map(c => editedContracts[c.oneflow_contract_id] ?? c)

      const res = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // Generera fakturaplan: skapar autogen för historiska perioder (paid)
      // och framtida (pending_approval). Måste köras INNAN Fortnox-import så
      // dedupe-logiken i importHistoricalItems kan rensa autogen vars period
      // överlappar Fortnox-rader.
      try {
        await ContractInvoiceGenerator.regenerateForCustomer(customerId)
      } catch (e: any) {
        console.warn('[import] fakturaplan-generering misslyckades:', e?.message ?? e)
        toast.error('Kund skapades men fakturaplan kunde inte genereras automatiskt')
      }

      // Importera valda historiska fakturor med rätt typ
      const toImport = invoices
        .filter(inv => selectedForImport.has(inv.DocumentNumber))
        .map(inv => ({ ...inv, importType: invoiceTypes[inv.DocumentNumber] ?? 'contract' as const }))
      if (toImport.length > 0) {
        try {
          const result = await ContractBillingService.importHistoricalItems(customerId, toImport)
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

  // Multi-kontrakt: aktivt kontrakt i tab-vyn (för avtalsfältens redigering).
  // Faller tillbaka till första valda om aktiv tab inte längre är vald.
  const selectedContractsList = extractedContracts.filter(c =>
    selectedContractIds.has(c.oneflow_contract_id)
  )
  const activeContract: ExtractedContract | null = activeContractTab && editedContracts[activeContractTab]
    ? editedContracts[activeContractTab]
    : selectedContractsList[0]
      ? editedContracts[selectedContractsList[0].oneflow_contract_id] ?? selectedContractsList[0]
      : null

  // Auto-välj första valda när aktiv tab avmarkeras
  useEffect(() => {
    if (selectedContractsList.length === 0) return
    if (!activeContractTab || !selectedContractIds.has(activeContractTab)) {
      setActiveContractTab(selectedContractsList[0].oneflow_contract_id)
    }
  }, [selectedContractIds, selectedContractsList, activeContractTab])

  // Uppdatera ett fält på det aktiva avtalet (per-tab redigering).
  const updateContract = <K extends keyof ExtractedContract>(field: K) => (value: ExtractedContract[K]) => {
    if (!activeContractTab) return
    setEditedContracts(prev => ({
      ...prev,
      [activeContractTab]: { ...prev[activeContractTab], [field]: value },
    }))
  }

  // Sync ankarmånad i preview när admin byter tab — så "Kommande faktureringar"
  // och nästa-rad-pillar speglar valt avtals start.
  useEffect(() => {
    if (!activeContract?.contract_start_date) return
    setPreview(prev => {
      if (!prev) return prev
      const month = new Date(activeContract.contract_start_date! + 'T00:00:00').getMonth() + 1
      if (prev.billing_anchor_month === month) return prev
      return { ...prev, billing_anchor_month: month }
    })
  }, [activeContractTab, activeContract?.contract_start_date])

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
          <Building2 className="w-5 h-5 text-[#20c58f]" />
          <span>Importera kund via org.nummer</span>
        </div>
      }
      subtitle={
        step === 'search' ? 'Hämtar data från Fortnox och Oneflow automatiskt' :
        step === 'preview' ? 'Granska och redigera uppgifterna innan import' :
        step === 'saving' ? 'Sparar kunden...' :
        'Kund importerad!'
      }
      size="lg"
    >
      <div className="p-4 space-y-4">

        {/* ── STEG 1: SÖK ── */}
        {step === 'search' && (
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                Organisationsnummer
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orgNr}
                  onChange={e => setOrgNr(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !searching && orgNr.trim() && handleSearch()}
                  placeholder="t.ex. 714800-2590 eller 7148002590"
                  className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                  disabled={searching}
                  autoFocus
                />
                <Button variant="primary" size="sm" onClick={handleSearch} disabled={!orgNr.trim() || searching}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="hidden sm:inline ml-1">{searching ? 'Söker...' : 'Sök'}</span>
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Accepterar format med eller utan bindestreck</p>
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-1">
                <Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" />
                <span>Söker i Fortnox och Oneflow...</span>
              </div>
            )}
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

        {/* ── STEG 2: PREVIEW + REDIGERING ── */}
        {(step === 'preview' || step === 'saving') && preview && (
          <>
            {/* Källindikator */}
            {sources && (
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${sources.fortnox ? 'text-[#20c58f] bg-[#20c58f]/10 border-[#20c58f]/30' : 'text-slate-500 bg-slate-800 border-slate-700'}`}>
                  <CheckCircle className="w-3 h-3" />Fortnox
                </div>
                <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${sources.oneflow ? 'text-[#20c58f] bg-[#20c58f]/10 border-[#20c58f]/30' : 'text-amber-400 bg-amber-400/10 border-amber-400/30'}`}>
                  {sources.oneflow ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  Oneflow {!sources.oneflow && '(ej hittad)'}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                  <Edit3 className="w-3 h-3" />
                  <span>Fälten kan redigeras</span>
                </div>
              </div>
            )}

            {/* Multi-kontrakt-väljare: visas BARA när Oneflow returnerade flera signerade
                kontrakt för samma org.nr. För 0/1 kontrakt fortsätter resten av modalen
                fungera som tidigare (avtalsfälten visar primary contract). */}
            {extractedContracts.length > 1 && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-slate-400" />
                    Avtal från Oneflow ({extractedContracts.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedContractIds(prev =>
                      prev.size === extractedContracts.length
                        ? new Set()
                        : new Set(extractedContracts.map(c => c.oneflow_contract_id))
                    )}
                    className="text-xs text-[#20c58f] hover:text-[#20c58f]/80"
                  >
                    {selectedContractIds.size === extractedContracts.length ? 'Avmarkera alla' : 'Markera alla'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Kunden har flera signerade avtal. Markera de som ska importeras —
                  redigera varje avtals fält separat via tabs nedan.
                </p>
                <div className="space-y-2">
                  {extractedContracts.map(contract => {
                    const checked = selectedContractIds.has(contract.oneflow_contract_id)
                    const label = contract.address_label || contract.contact_address || contract.agreement_text || 'Okänd adress'
                    const period = [contract.contract_start_date, contract.contract_end_date].filter(Boolean).join(' → ') || '—'
                    const annual = contract.annual_value
                      ? formatAmount(contract.annual_value)
                      : 'Avropsavtal'
                    return (
                      <label
                        key={contract.oneflow_contract_id}
                        className={`flex items-start gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#20c58f]/40 bg-[#20c58f]/5'
                            : 'border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedContractIds(prev => {
                            const next = new Set(prev)
                            if (next.has(contract.oneflow_contract_id)) {
                              next.delete(contract.oneflow_contract_id)
                            } else {
                              next.add(contract.oneflow_contract_id)
                            }
                            return next
                          })}
                          className="mt-0.5 rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-slate-200 truncate">{label}</span>
                            {contract.contract_type && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#20c58f]/15 border border-[#20c58f]/30 text-[#20c58f] rounded-full shrink-0">
                                {contract.contract_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{period}</span>
                            <span>·</span>
                            <span>{annual}</span>
                            <span>·</span>
                            <span className="text-slate-500">#{contract.oneflow_contract_id}</span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-[#20c58f]/80">
                  Avtalsfälten nedan visar valt avtal — växla med tabs för att redigera
                  varje avtal separat innan import.
                </p>
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
                {/* Kundgrupp */}
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

            {/* Multi-kontrakt: tabs-rad när admin valt fler än ett avtal.
                Varje tab visar adressetikett + årsvärde. Avtals-/kontaktfält
                under raden bind till valt avtal via activeContract/updateContract. */}
            {selectedContractsList.length > 1 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {selectedContractsList.map(c => {
                  const ec = editedContracts[c.oneflow_contract_id] ?? c
                  const label = ec.address_label || ec.contact_address || `#${ec.oneflow_contract_id}`
                  const isActive = activeContractTab === c.oneflow_contract_id
                  return (
                    <button
                      key={c.oneflow_contract_id}
                      type="button"
                      onClick={() => setActiveContractTab(c.oneflow_contract_id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors max-w-[260px] ${
                        isActive
                          ? 'bg-[#20c58f] text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                      title={label}
                    >
                      <FileSignature className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                      {ec.annual_value != null && ec.annual_value > 0 && (
                        <span className={`text-[10px] shrink-0 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                          {formatAmount(ec.annual_value)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Sektion: Kontaktuppgifter — per avtal (Oneflow-fältet "utforande-adress"
                m.fl. ligger på avtalsnivå). Vid >1 valt avtal: tabsen ovan styr. */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                Kontaktuppgifter
                {selectedContractsList.length > 1 && activeContract && (
                  <span className="text-[10px] text-[#20c58f]/80 font-normal">
                    • avtal: {activeContract.address_label || activeContract.contact_address || `#${activeContract.oneflow_contract_id}`}
                  </span>
                )}
              </h4>
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
                      // Synca address_label automatiskt med utförande-adress
                      // när admin redigerar (om de inte redan ändrat label).
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

            {/* Sektion: Fakturering */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Fakturering</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Faktura e-post" value={preview.billing_email ?? ''} onChange={update('billing_email')} placeholder="Ej hämtat" />
                <div className="col-span-2">
                  <Field label="Faktura adress" value={preview.billing_address ?? ''} onChange={update('billing_address')} placeholder="Ej hämtat" />
                </div>
              </div>
            </div>

            {/* Sektion: Avtal & fakturering — avtalsfält per avtal vid multi-kontrakt */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-slate-400" />Avtal &amp; fakturering
                {selectedContractsList.length > 1 && activeContract && (
                  <span className="text-[10px] text-[#20c58f]/80 font-normal">
                    • avtal: {activeContract.address_label || activeContract.contact_address || `#${activeContract.oneflow_contract_id}`}
                  </span>
                )}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Avtalstyp */}
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
                    if (!months || months >= 12 || !annualVal || annualVal <= 0) return null
                    const totalValue = Math.round(annualVal * (months / 12))
                    return (
                      <p className="text-xs text-amber-400/80 mt-1">
                        Extrapolerad årstakt från {months} mån avtal · totalvärde {totalValue.toLocaleString('sv-SE')} kr
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
                <Field
                  label="Oneflow kontrakt-ID"
                  value={(activeContract?.oneflow_contract_id ?? preview.oneflow_contract_id) ?? ''}
                  onChange={v => activeContract ? updateContract('oneflow_contract_id')(v) : update('oneflow_contract_id')(v)}
                  placeholder="Ej hämtat"
                  readOnly={!!activeContract}
                />

                {/* Avtalsobjekt */}
                {((activeContract?.agreement_text ?? preview.agreement_text) !== null || sources?.oneflow) && (
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
                )}

                {/* Faktureringsfrekvens (kund-nivå — gäller alla avtal) */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Faktureringsfrekvens</label>
                  <Select
                    value={preview.billing_frequency}
                    onChange={v => setPreview(prev => prev ? { ...prev, billing_frequency: v as BillingFrequency } : prev)}
                    options={Object.entries(BILLING_FREQUENCY_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label }))}
                  />
                </div>

                {/* Prislista (kund-nivå — gäller alla avtal) */}
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

            {/* Sektion: Fakturainställningar */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-400" />Fakturainställningar
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Ankarmånad */}
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

                {/* Nästa fakturadatum */}
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

            {/* Sektion: Historiska fakturor */}
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
                        {/* Faktura-rad */}
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                          {/* Import-checkbox */}
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleImport(inv.DocumentNumber)}
                            className="rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] shrink-0"
                            onClick={e => e.stopPropagation()}
                          />

                          {/* Klickbar rad → sätt ankarmånad (bara för avtalsfakturor) */}
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

                          {/* Typ-dropdown: Avtal / Engång */}
                          <select
                            value={invType}
                            onChange={e => setInvoiceType(inv.DocumentNumber, e.target.value as 'contract' | 'ad_hoc')}
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-xs bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                          >
                            <option value="contract">Avtal</option>
                            <option value="ad_hoc">Engång</option>
                          </select>

                          {/* Expand-knapp */}
                          <button
                            onClick={() => toggleExpand(inv.DocumentNumber)}
                            className="text-slate-500 hover:text-slate-300 shrink-0"
                            title={expanded ? 'Dölj rader' : 'Visa rader'}
                          >
                            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Expanderade fakturarader */}
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
          </>
        )}

        {/* ── STEG 3: KLAR ── */}
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
          {step === 'preview' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setStep('search'); setError(null) }}>
                Sök igen
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={extractedContracts.length > 0 && selectedContractIds.size === 0}
                title={
                  extractedContracts.length > 0 && selectedContractIds.size === 0
                    ? 'Markera minst ett avtal för att importera'
                    : undefined
                }
              >
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
