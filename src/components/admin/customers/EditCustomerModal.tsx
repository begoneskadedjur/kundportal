// src/components/admin/customers/EditCustomerModal.tsx - Kompakt kundredigering

import React, { useState, useEffect } from 'react'
import { Building2, Save, AlertCircle, Hash } from 'lucide-react'
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

interface Customer {
  id: string
  company_name: string
  organization_number?: string | null
  contact_person?: string | null
  contact_email: string
  contact_phone?: string | null
  contact_address?: string | null
  billing_email?: string | null
  billing_address?: string | null
  business_type?: string | null
  contract_type?: string | null
  industry_category?: string | null
  customer_size?: 'small' | 'medium' | 'large' | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  annual_value?: number | null
  monthly_value?: number | null
  total_contract_value?: number | null
  assigned_account_manager?: string | null
  account_manager_email?: string | null
  sales_person?: string | null
  sales_person_email?: string | null
  customer_group_id?: string | null
  customer_number?: number | null
  service_frequency?: string | null
  product_summary?: string | null
  service_details?: string | null
  agreement_text?: string | null
}

interface EditCustomerModalProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedCustomer: Customer) => void
}

const formatCurrency = (amount: number | null | undefined): string =>
  amount
    ? new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount)
    : '\u2013'

const formatDate = (date: string | null | undefined): string =>
  date
    ? new Date(date).toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : '\u2013'

export default function EditCustomerModal({
  customer,
  isOpen,
  onClose,
  onSave
}: EditCustomerModalProps) {
  const [formData, setFormData] = useState<Partial<Customer>>({})
  const [loading, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const { options: contractTypeOptions } = useContractTypeOptions()

  useEffect(() => {
    CustomerGroupService.getActiveGroups().then(setCustomerGroups).catch(console.error)
  }, [])

  // Initialize form data when customer changes
  useEffect(() => {
    if (customer) {
      setFormData({
        company_name: customer.company_name || '',
        organization_number: customer.organization_number || '',
        contact_person: customer.contact_person || '',
        contact_email: customer.contact_email || '',
        contact_phone: customer.contact_phone || '',
        contact_address: customer.contact_address || '',
        business_type: customer.business_type || '',
        contract_type: customer.contract_type || '',
        industry_category: customer.industry_category || '',
        customer_size: customer.customer_size || null,
        assigned_account_manager: customer.assigned_account_manager || '',
        account_manager_email: customer.account_manager_email || '',
        sales_person: customer.sales_person || '',
        sales_person_email: customer.sales_person_email || '',
        customer_group_id: customer.customer_group_id || '',
        customer_number: customer.customer_number ?? ''
      })
      setErrors({})
    }
  }, [customer])

  const handleInputChange = (field: keyof Customer, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.company_name?.trim()) {
      newErrors.company_name = 'Företagsnamn är obligatoriskt'
    }

    if (!formData.contact_email?.trim()) {
      newErrors.contact_email = 'E-postadress är obligatorisk'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Ogiltig e-postadress'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!customer || !validateForm()) return
    setSaving(true)

    try {
      const editableFields = {
        company_name: formData.company_name,
        organization_number: formData.organization_number,
        business_type: formData.business_type,
        contract_type: formData.contract_type || null,
        industry_category: formData.industry_category,
        customer_size: formData.customer_size,
        contact_person: formData.contact_person,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        contact_address: formData.contact_address,
        assigned_account_manager: formData.assigned_account_manager,
        account_manager_email: formData.account_manager_email,
        sales_person: formData.sales_person,
        sales_person_email: formData.sales_person_email,
        customer_group_id: formData.customer_group_id || null,
        customer_number: formData.customer_number ? Number(formData.customer_number) : null,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('customers')
        .update(editableFields)
        .eq('id', customer.id)
        .select()
        .single()

      if (error) throw error
      toast.success('Kund uppdaterad!')
      onSave(data)
      onClose()
    } catch (error: any) {
      console.error('Error updating customer:', error)
      toast.error('Kunde inte uppdatera kund: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({})
      setErrors({})
      onClose()
    }
  }

  if (!customer) return null

  const hasServiceDetails = customer.service_frequency || customer.product_summary || customer.service_details || customer.agreement_text

  const selectStyles = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Redigera kund"
      subtitle={customer.company_name}
      size="lg"
      preventClose={loading}
      footer={
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Obligatoriska fält markeras med *
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Spara
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {/* Företagsinformation */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Företagsinformation
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Företagsnamn *"
              value={formData.company_name || ''}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              placeholder="Ange företagsnamn"
              error={errors.company_name}
            />
            <Input
              label="Organisationsnummer"
              value={formData.organization_number || ''}
              onChange={(e) => handleInputChange('organization_number', e.target.value)}
              placeholder="XXXXXX-XXXX"
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Företagstyp</label>
              <Select
                value={formData.business_type || ''}
                onChange={(v) => handleInputChange('business_type', v)}
                placeholder="Välj typ"
                options={[
                  { value: 'private', label: 'Privatperson' },
                  { value: 'business', label: 'Företag' },
                  { value: 'organization', label: 'Organisation' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Avtalstyp</label>
              <Select
                value={formData.contract_type || ''}
                onChange={(v) => handleInputChange('contract_type', v)}
                placeholder={contractTypeOptions.length === 0 ? 'Flagga tjänster som "Använd som avtalstyp"' : 'Välj avtalstyp'}
                options={contractTypeOptions}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Kundstorlek</label>
              <Select
                value={formData.customer_size || ''}
                onChange={(v) => handleInputChange('customer_size', v || null)}
                placeholder="Välj storlek"
                options={[
                  { value: 'small', label: 'Liten' },
                  { value: 'medium', label: 'Medel' },
                  { value: 'large', label: 'Stor' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Kundnummer & Grupp */}
        <div className="border-t border-slate-700/50 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" />
            Kundnummer & Grupp
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Kundgrupp</label>
              <Select
                value={formData.customer_group_id as string || ''}
                onChange={(v) => handleInputChange('customer_group_id', v || null)}
                placeholder="Välj kundgrupp"
                options={customerGroups.map(g => ({ value: g.id, label: g.name }))}
              />
            </div>
            <Input
              label="Kundnummer"
              type="number"
              value={formData.customer_number?.toString() || ''}
              onChange={(e) => handleInputChange('customer_number', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="T.ex. 527"
            />
          </div>
        </div>

        {/* Kontaktinformation */}
        <div className="border-t border-slate-700/50 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Kontakt
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kontaktperson"
              value={formData.contact_person || ''}
              onChange={(e) => handleInputChange('contact_person', e.target.value)}
              placeholder="För- och efternamn"
            />
            <Input
              label="E-postadress *"
              type="email"
              value={formData.contact_email || ''}
              onChange={(e) => handleInputChange('contact_email', e.target.value)}
              placeholder="namn@example.com"
              error={errors.contact_email}
            />
            <Input
              label="Telefonnummer"
              value={formData.contact_phone || ''}
              onChange={(e) => handleInputChange('contact_phone', e.target.value)}
              placeholder="070-123 45 67"
            />
            <Input
              label="Adress"
              value={formData.contact_address || ''}
              onChange={(e) => handleInputChange('contact_address', e.target.value)}
              placeholder="Gatuadress, Postnummer Ort"
            />
          </div>
        </div>

        {/* Account Management */}
        <div className="border-t border-slate-700/50 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Account Management
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Account Manager"
              value={formData.assigned_account_manager || ''}
              onChange={(e) => handleInputChange('assigned_account_manager', e.target.value)}
              placeholder="För- och efternamn"
            />
            <Input
              label="AM E-post"
              type="email"
              value={formData.account_manager_email || ''}
              onChange={(e) => handleInputChange('account_manager_email', e.target.value)}
              placeholder="manager@begone.se"
            />
            <Input
              label="Säljare"
              value={formData.sales_person || ''}
              onChange={(e) => handleInputChange('sales_person', e.target.value)}
              placeholder="För- och efternamn"
            />
            <Input
              label="Säljare E-post"
              type="email"
              value={formData.sales_person_email || ''}
              onChange={(e) => handleInputChange('sales_person_email', e.target.value)}
              placeholder="salje@begone.se"
            />
          </div>
        </div>

        {/* Kontraktsinformation — skrivskyddad */}
        <div className="border-t border-slate-700/50 pt-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Kontraktsinformation
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-500 rounded">
              Skrivskyddad
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Kontraktsstart</span>
              <span className="text-slate-300">{formatDate(customer.contract_start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Kontraktsslut</span>
              <span className="text-slate-300">{formatDate(customer.contract_end_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Årsvärde</span>
              <span className="text-slate-300">{formatCurrency(customer.annual_value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Månadsvärde</span>
              <span className="text-slate-300">{formatCurrency(customer.monthly_value)}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-slate-500">Totalt kontraktsvärde</span>
              <span className="text-slate-300 font-medium">{formatCurrency(customer.total_contract_value)}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            Kontraktsvärden hanteras via Oneflow och kan inte ändras här.
          </p>
        </div>

        {/* Servicedetaljer — skrivskyddad */}
        <div className="border-t border-slate-700/50 pt-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Servicedetaljer
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-500 rounded">
              Skrivskyddad
            </span>
          </div>
          {hasServiceDetails ? (
            <div className="space-y-2 text-sm">
              {customer.service_frequency && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Servicefrekvens</span>
                  <span className="text-slate-300">{customer.service_frequency}</span>
                </div>
              )}
              {customer.product_summary && (
                <div>
                  <span className="text-slate-500 text-xs">Produktsammanfattning</span>
                  <p className="text-slate-300 text-sm mt-0.5">{customer.product_summary}</p>
                </div>
              )}
              {customer.service_details && (
                <div>
                  <span className="text-slate-500 text-xs">Servicedetaljer</span>
                  <p className="text-slate-300 text-sm mt-0.5">{customer.service_details}</p>
                </div>
              )}
              {customer.agreement_text && (
                <div>
                  <span className="text-slate-500 text-xs">Avtalstext</span>
                  <p className="text-slate-300 text-sm mt-0.5">{customer.agreement_text}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Inga servicedetaljer registrerade.</p>
          )}
          <p className="text-[11px] text-slate-600 mt-2">
            Servicedetaljer hanteras via prislistor och avtalswizarden.
          </p>
        </div>
      </div>
    </Modal>
  )
}
