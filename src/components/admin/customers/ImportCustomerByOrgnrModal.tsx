// src/components/admin/customers/ImportCustomerByOrgnrModal.tsx
import { useState } from 'react'
import {
  Building2, Search, CheckCircle, AlertCircle, Loader2, ExternalLink, Edit3, Save
} from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

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
}

interface ImportCustomerByOrgnrModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: (customerId: string) => void
}

type Step = 'search' | 'preview' | 'saving' | 'done'

// Enkelt textfält med label
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

export default function ImportCustomerByOrgnrModal({
  isOpen, onClose, onImported,
}: ImportCustomerByOrgnrModalProps) {
  const [step, setStep] = useState<Step>('search')
  const [orgNr, setOrgNr] = useState('')
  const [searching, setSearching] = useState(false)
  const [sources, setSources] = useState<{ fortnox: boolean; oneflow: boolean } | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState<{ message: string; existingId?: string; existingName?: string } | null>(null)
  const [savedCustomer, setSavedCustomer] = useState<{ id: string; company_name: string } | null>(null)

  const handleClose = () => {
    setStep('search')
    setOrgNr('')
    setPreview(null)
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

      setPreview(data.preview)
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
      const res = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', customer_data: preview }),
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

            {/* Sektion: Avtal */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Avtal</h4>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            </div>
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
