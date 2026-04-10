// src/components/admin/customers/ImportCustomerByOrgnrModal.tsx
import { useState } from 'react'
import {
  Building2, Search, CheckCircle, AlertCircle, Loader2, ExternalLink, Edit3, Save, Receipt,
  ChevronDown, ChevronRight, CalendarDays
} from 'lucide-react'
import { BILLING_FREQUENCY_CONFIG, type BillingFrequency } from '../../../types/contractBilling'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'
import { ContractBillingService } from '../../../services/contractBillingService'

const MONTHS_SV = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

const CONTRACT_TYPE_OPTIONS = [
  { value: '', label: 'Välj avtalstyp' },
  { value: 'Skadedjursavtal', label: 'Skadedjursavtal' },
  { value: 'Avtal Mekaniska fällor', label: 'Avtal Mekaniska fällor' },
  { value: 'Avtal Betesstationer', label: 'Avtal Betesstationer' },
  { value: 'Avtal Betongstationer', label: 'Avtal Betongstationer' },
  { value: 'Avtal Indikationsfällor', label: 'Avtal Indikationsfällor' },
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
  contract_length: string | null
  annual_value: number | null
  products: any[] | null
  oneflow_contract_id: string | null
  contract_type: string | null
  agreement_text: string | null
  billing_frequency: BillingFrequency
  billing_anchor_month: number
}

interface ImportCustomerByOrgnrModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: (customerId: string) => void
}

type Step = 'search' | 'preview' | 'saving' | 'done'

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
      })

      const fetchedInvoices: FortnoxInvoice[] = data.invoices ?? []
      setInvoices(fetchedInvoices)
      // Default: alla markerade för import som 'contract'
      setSelectedForImport(new Set(fetchedInvoices.map((inv: FortnoxInvoice) => inv.DocumentNumber)))
      setInvoiceTypes(Object.fromEntries(fetchedInvoices.map((inv: FortnoxInvoice) => [inv.DocumentNumber, 'contract' as const])))
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

      const res = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', customer_data: customerPayload }),
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

      // Importera valda historiska fakturor med rätt typ
      const toImport = invoices
        .filter(inv => selectedForImport.has(inv.DocumentNumber))
        .map(inv => ({ ...inv, importType: invoiceTypes[inv.DocumentNumber] ?? 'contract' as const }))
      if (toImport.length > 0) {
        try {
          await ContractBillingService.importHistoricalItems(customerId, toImport)
          toast.success(`${toImport.length} historiska faktura(or) importerade till pipeline`)
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
              </div>
            </div>

            {/* Sektion: Kontaktuppgifter */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Kontaktuppgifter</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kontaktperson" value={preview.contact_person ?? ''} onChange={update('contact_person')} placeholder="Ej hämtat" />
                <Field label="E-post kontakt" value={preview.contact_email ?? ''} onChange={update('contact_email')} placeholder="Ej hämtat" />
                <Field label="Telefon" value={preview.contact_phone ?? ''} onChange={update('contact_phone')} placeholder="Ej hämtat" />
                <Field label="Utförande adress" value={preview.contact_address ?? ''} onChange={update('contact_address')} placeholder="Ej hämtat" />
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

            {/* Sektion: Avtal & fakturering */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-slate-400" />Avtal &amp; fakturering
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Avtalstyp */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Avtalstyp</label>
                  <select
                    value={preview.contract_type ?? ''}
                    onChange={e => setPreview(prev => prev ? { ...prev, contract_type: e.target.value || null } : prev)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                  >
                    {CONTRACT_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <Field label="Avtalsstart" value={preview.contract_start_date ?? ''} onChange={update('contract_start_date')} placeholder="ÅÅÅÅ-MM-DD" />
                <Field label="Avtalslängd" value={preview.contract_length ?? ''} onChange={update('contract_length')} placeholder="t.ex. 3 år" />
                <Field
                  label="Årsvärde (kr)"
                  value={preview.annual_value?.toString() ?? ''}
                  onChange={v => setPreview(prev => prev ? { ...prev, annual_value: parseFloat(v) || null } : prev)}
                  placeholder="0"
                  type="number"
                />
                <Field label="Oneflow kontrakt-ID" value={preview.oneflow_contract_id ?? ''} onChange={update('oneflow_contract_id')} placeholder="Ej hämtat" />

                {/* Avtalsobjekt */}
                {(preview.agreement_text !== null || sources?.oneflow) && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-400 mb-1 block">Avtalsobjekt</label>
                    <textarea
                      value={preview.agreement_text ?? ''}
                      onChange={e => setPreview(prev => prev ? { ...prev, agreement_text: e.target.value || null } : prev)}
                      rows={2}
                      placeholder="Ej hämtat"
                      className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent resize-none"
                    />
                  </div>
                )}

                {/* Faktureringsfrekvens */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Faktureringsfrekvens</label>
                  <select
                    value={preview.billing_frequency}
                    onChange={e => setPreview(prev => prev ? { ...prev, billing_frequency: e.target.value as BillingFrequency } : prev)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                  >
                    {Object.entries(BILLING_FREQUENCY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label} – {cfg.description}</option>
                    ))}
                  </select>
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
                  <select
                    value={preview.billing_anchor_month}
                    onChange={e => setPreview(prev => prev ? { ...prev, billing_anchor_month: parseInt(e.target.value) } : prev)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                  >
                    {MONTHS_SV.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
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
