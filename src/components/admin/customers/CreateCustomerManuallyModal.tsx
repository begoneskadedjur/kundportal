import React, { useState, useEffect } from 'react'
import {
  Building2, User, Calendar, Briefcase, FileText,
  CreditCard, CheckCircle, ChevronRight, ChevronLeft, AlertCircle
} from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { CustomerGroupService } from '../../../services/customerGroupService'
import { CustomerGroup } from '../../../types/customerGroups'
import { useContractTypeOptions } from '../../../hooks/useContractTypeOptions'
import toast from 'react-hot-toast'

interface CreateCustomerManuallyModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: () => void
}

type Step = 1 | 2 | 3

const STEPS = [
  { id: 1 as Step, label: 'Företag & Kontakt', icon: Building2 },
  { id: 2 as Step, label: 'Avtal & Ekonomi', icon: Calendar },
  { id: 3 as Step, label: 'Fakturering', icon: CreditCard },
]

const INITIAL_FORM = {
  // Steg 1
  company_name: '',
  organization_number: '',
  business_type: '',
  industry_category: '',
  customer_size: '' as '' | 'small' | 'medium' | 'large',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  customer_group_id: '',
  customer_number: '',
  assigned_account_manager: '',
  account_manager_email: '',
  sales_person: '',
  sales_person_email: '',
  // Steg 2
  contract_type: '',
  contract_status: 'active' as 'active' | 'signed' | 'terminated' | 'expired',
  contract_start_date: '',
  contract_end_date: '',
  contract_length: '',
  service_frequency: '',
  annual_value: '',
  monthly_value: '',
  total_contract_value: '',
  agreement_text: '',
  // Steg 3
  billing_email: '',
  billing_address: '',
  billing_frequency: 'monthly' as 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand',
  billing_reference: '',
  cost_center: '',
  billing_recipient: '',
  billing_active: true,
}

type FormData = typeof INITIAL_FORM

export default function CreateCustomerManuallyModal({
  isOpen,
  onClose,
  onCustomerCreated,
}: CreateCustomerManuallyModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const { options: contractTypeOptions } = useContractTypeOptions()

  useEffect(() => {
    CustomerGroupService.getActiveGroups().then(setCustomerGroups).catch(console.error)
  }, [])

  const handleClose = () => {
    if (isSubmitting) return
    setStep(1)
    setForm(INITIAL_FORM)
    setErrors({})
    onClose()
  }

  const set = (field: keyof FormData, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-beräkna månadsvärde när årsvärde ändras (om månadsf. inte överskrivits)
      if (field === 'annual_value' && value && !prev.monthly_value) {
        const parsed = parseFloat(value)
        if (!isNaN(parsed)) {
          next.monthly_value = (parsed / 12).toFixed(0)
        }
      }
      return next
    })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validateStep = (s: Step): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (s === 1) {
      if (!form.company_name.trim()) errs.company_name = 'Obligatoriskt'
      if (!form.contact_person.trim()) errs.contact_person = 'Obligatoriskt'
      if (!form.contact_email.trim()) {
        errs.contact_email = 'Obligatoriskt'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
        errs.contact_email = 'Ogiltig e-postadress'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const goNext = () => {
    if (validateStep(step)) setStep(s => (s < 3 ? (s + 1) as Step : s))
  }
  const goBack = () => setStep(s => (s > 1 ? (s - 1) as Step : s))

  const handleSubmit = async () => {
    if (!validateStep(step)) return
    setIsSubmitting(true)
    try {
      const payload = {
        company_name: form.company_name.trim(),
        organization_number: form.organization_number.trim() || null,
        business_type: form.business_type || null,
        industry_category: form.industry_category.trim() || null,
        customer_size: (form.customer_size as 'small' | 'medium' | 'large') || null,
        contact_person: form.contact_person.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_phone: form.contact_phone.trim() || null,
        contact_address: form.contact_address.trim() || null,
        customer_group_id: form.customer_group_id || null,
        customer_number: form.customer_number ? parseInt(form.customer_number, 10) : null,
        assigned_account_manager: form.assigned_account_manager.trim() || null,
        account_manager_email: form.account_manager_email.trim() || null,
        sales_person: form.sales_person.trim() || null,
        sales_person_email: form.sales_person_email.trim() || null,
        contract_type: form.contract_type || null,
        contract_status: form.contract_status,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        contract_length: form.contract_length.trim() || null,
        service_frequency: form.service_frequency.trim() || null,
        annual_value: form.annual_value ? parseFloat(form.annual_value) : null,
        monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : null,
        total_contract_value: form.total_contract_value ? parseFloat(form.total_contract_value) : null,
        agreement_text: form.agreement_text.trim() || null,
        billing_email: form.billing_email.trim() || null,
        billing_address: form.billing_address.trim() || null,
        billing_frequency: form.billing_frequency,
        billing_reference: form.billing_reference.trim() || null,
        cost_center: form.cost_center.trim() || null,
        billing_recipient: form.billing_recipient.trim() || null,
        billing_active: form.billing_active,
        source_type: 'manual',
        is_active: true,
      }

      const { error } = await supabase.from('customers').insert(payload)
      if (error) throw error

      toast.success('Kund skapad!')
      onCustomerCreated()
      handleClose()
    } catch (err: any) {
      toast.error('Kunde inte skapa kund: ' + (err.message ?? 'Okänt fel'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const footer = (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <AlertCircle className="w-3.5 h-3.5" />
        Fält märkta med * är obligatoriska
      </div>
      <div className="flex items-center gap-3">
        {step > 1 && (
          <Button variant="ghost" onClick={goBack} disabled={isSubmitting} className="flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" />
            Föregående
          </Button>
        )}
        <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
          Avbryt
        </Button>
        {step < 3 ? (
          <Button variant="primary" onClick={goNext} className="flex items-center gap-1.5">
            Nästa
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2">
            {isSubmitting ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
            Skapa kund
          </Button>
        )}
      </div>
    </div>
  )

  const groupOptions = customerGroups.map(g => ({ value: g.id, label: g.name }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Lägg till kund manuellt"
      size="xl"
      preventClose={isSubmitting}
      footer={footer}
    >
      {/* Stegindikatorer */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = s.id === step
            const done = s.id < step
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs font-semibold transition-colors ${
                    done ? 'bg-[#20c58f] border-[#20c58f] text-white' :
                    active ? 'border-[#20c58f] text-[#20c58f] bg-[#20c58f]/10' :
                    'border-slate-700 text-slate-500 bg-slate-800/50'
                  }`}>
                    {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-white' : done ? 'text-[#20c58f]' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${s.id < step ? 'bg-[#20c58f]/50' : 'bg-slate-700'}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── STEG 1: Företag & Kontakt ── */}
        {step === 1 && (
          <>
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                Företagsinformation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Företagsnamn *"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  error={errors.company_name}
                />
                <Input
                  label="Organisationsnummer"
                  value={form.organization_number}
                  onChange={e => set('organization_number', e.target.value)}
                  placeholder="XXXXXX-XXXX"
                />
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Företagstyp</label>
                  <Select
                    value={form.business_type}
                    onChange={v => set('business_type', v)}
                    placeholder="Välj typ"
                    options={[
                      { value: 'private', label: 'Privatperson' },
                      { value: 'business', label: 'Företag' },
                      { value: 'organization', label: 'Organisation' },
                      { value: 'authority', label: 'Myndighet' },
                    ]}
                  />
                </div>
                <Input
                  label="Bransch"
                  value={form.industry_category}
                  onChange={e => set('industry_category', e.target.value)}
                  placeholder="T.ex. Restaurang, Lantbruk"
                />
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Kundstorlek</label>
                  <Select
                    value={form.customer_size}
                    onChange={v => set('customer_size', v as '' | 'small' | 'medium' | 'large')}
                    placeholder="Välj storlek"
                    options={[
                      { value: 'small', label: 'Liten' },
                      { value: 'medium', label: 'Medel' },
                      { value: 'large', label: 'Stor' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Kundgrupp</label>
                  <Select
                    value={form.customer_group_id}
                    onChange={v => set('customer_group_id', v)}
                    placeholder="Välj grupp"
                    options={groupOptions}
                  />
                </div>
                <Input
                  label="Kundnummer"
                  type="number"
                  value={form.customer_number}
                  onChange={e => set('customer_number', e.target.value)}
                  placeholder="T.ex. 1042"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                Kontaktinformation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Kontaktperson *"
                  value={form.contact_person}
                  onChange={e => set('contact_person', e.target.value)}
                  error={errors.contact_person}
                />
                <Input
                  label="E-postadress *"
                  type="email"
                  value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                  error={errors.contact_email}
                />
                <Input
                  label="Telefonnummer"
                  value={form.contact_phone}
                  onChange={e => set('contact_phone', e.target.value)}
                  placeholder="070-123 45 67"
                />
                <Input
                  label="Adress"
                  value={form.contact_address}
                  onChange={e => set('contact_address', e.target.value)}
                  placeholder="Gatuadress, Postnummer Ort"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-slate-400" />
                Ansvariga hos BeGone
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Account Manager"
                  value={form.assigned_account_manager}
                  onChange={e => set('assigned_account_manager', e.target.value)}
                />
                <Input
                  label="AM e-post"
                  type="email"
                  value={form.account_manager_email}
                  onChange={e => set('account_manager_email', e.target.value)}
                />
                <Input
                  label="Säljare"
                  value={form.sales_person}
                  onChange={e => set('sales_person', e.target.value)}
                />
                <Input
                  label="Säljar-e-post"
                  type="email"
                  value={form.sales_person_email}
                  onChange={e => set('sales_person_email', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* ── STEG 2: Avtal & Ekonomi ── */}
        {step === 2 && (
          <>
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Avtalsinformation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Avtalstyp</label>
                  <Select
                    value={form.contract_type}
                    onChange={v => set('contract_type', v)}
                    placeholder="Välj avtalstyp"
                    options={contractTypeOptions}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Avtalsstatus</label>
                  <Select
                    value={form.contract_status}
                    onChange={v => set('contract_status', v as FormData['contract_status'])}
                    options={[
                      { value: 'active', label: 'Aktiv' },
                      { value: 'signed', label: 'Signerat' },
                      { value: 'terminated', label: 'Uppsagt' },
                      { value: 'expired', label: 'Utgånget' },
                    ]}
                  />
                </div>
                <Input
                  label="Startdatum"
                  type="date"
                  value={form.contract_start_date}
                  onChange={e => set('contract_start_date', e.target.value)}
                />
                <Input
                  label="Slutdatum"
                  type="date"
                  value={form.contract_end_date}
                  onChange={e => set('contract_end_date', e.target.value)}
                />
                <Input
                  label="Avtalslängd"
                  value={form.contract_length}
                  onChange={e => set('contract_length', e.target.value)}
                  placeholder="T.ex. 3 år"
                />
                <Input
                  label="Servicefrekvens"
                  value={form.service_frequency}
                  onChange={e => set('service_frequency', e.target.value)}
                  placeholder="T.ex. Kvartalsvis"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-400" />
                Ekonomi
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Årsvärde (SEK)"
                  type="number"
                  value={form.annual_value}
                  onChange={e => set('annual_value', e.target.value)}
                  placeholder="0"
                />
                <Input
                  label="Månadsvärde (SEK)"
                  type="number"
                  value={form.monthly_value}
                  onChange={e => set('monthly_value', e.target.value)}
                  placeholder="Auto från årsvärde"
                />
                <Input
                  label="Totalt kontraktsvärde (SEK)"
                  type="number"
                  value={form.total_contract_value}
                  onChange={e => set('total_contract_value', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Avtalstext
              </h3>
              <Input
                as="textarea"
                rows={4}
                label="Avtalstext / Tjänstebeskrivning"
                value={form.agreement_text}
                onChange={e => set('agreement_text', e.target.value)}
                placeholder="Beskriv tjänster och avtalsvillkor..."
              />
            </div>
          </>
        )}

        {/* ── STEG 3: Fakturering ── */}
        {step === 3 && (
          <>
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-400" />
                Faktureringsinformation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Faktura e-post"
                  type="email"
                  value={form.billing_email}
                  onChange={e => set('billing_email', e.target.value)}
                  placeholder="Om annan än kontaktepost"
                />
                <Input
                  label="Fakturaadress"
                  value={form.billing_address}
                  onChange={e => set('billing_address', e.target.value)}
                  placeholder="Om annan än kontaktadress"
                />
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Faktureringsfrekvens</label>
                  <Select
                    value={form.billing_frequency}
                    onChange={v => set('billing_frequency', v as FormData['billing_frequency'])}
                    options={[
                      { value: 'monthly', label: 'Månadsvis' },
                      { value: 'quarterly', label: 'Kvartalsvis' },
                      { value: 'semi_annual', label: 'Halvårsvis' },
                      { value: 'annual', label: 'Årsvis' },
                      { value: 'on_demand', label: 'Vid behov' },
                    ]}
                  />
                </div>
                <Input
                  label="Fakturamottagare"
                  value={form.billing_recipient}
                  onChange={e => set('billing_recipient', e.target.value)}
                />
                <Input
                  label="Referens / PO-nummer"
                  value={form.billing_reference}
                  onChange={e => set('billing_reference', e.target.value)}
                />
                <Input
                  label="Kostnadsställe"
                  value={form.cost_center}
                  onChange={e => set('cost_center', e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.billing_active}
                  onChange={e => set('billing_active', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] bg-slate-800"
                />
                <div>
                  <span className="text-sm font-medium text-white">Aktivera fakturering</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    När detta är aktiverat ingår kunden i faktureringskörningar
                  </p>
                </div>
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
