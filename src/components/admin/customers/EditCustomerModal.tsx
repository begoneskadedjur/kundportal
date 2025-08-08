// src/components/admin/customers/EditCustomerModal.tsx - Customer edit modal

import React, { useState, useEffect } from 'react'
import { User, Building2, Mail, Phone, MapPin, Calendar, DollarSign, Save, AlertCircle } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
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

export default function EditCustomerModal({ 
  customer, 
  isOpen, 
  onClose, 
  onSave 
}: EditCustomerModalProps) {
  const [formData, setFormData] = useState<Partial<Customer>>({})
  const [loading, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
        industry_category: customer.industry_category || '',
        customer_size: customer.customer_size || null,
        contract_start_date: customer.contract_start_date || '',
        contract_end_date: customer.contract_end_date || '',
        annual_value: customer.annual_value || 0,
        monthly_value: customer.monthly_value || 0,
        total_contract_value: customer.total_contract_value || 0,
        assigned_account_manager: customer.assigned_account_manager || '',
        account_manager_email: customer.account_manager_email || '',
        sales_person: customer.sales_person || '',
        sales_person_email: customer.sales_person_email || '',
        service_frequency: customer.service_frequency || '',
        product_summary: customer.product_summary || '',
        service_details: customer.service_details || '',
        agreement_text: customer.agreement_text || ''
      })
      setErrors({})
    }
  }, [customer])

  // Handle form input changes
  const handleInputChange = (field: keyof Customer, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Required fields
    if (!formData.company_name?.trim()) {
      newErrors.company_name = 'Företagsnamn är obligatoriskt'
    }

    if (!formData.contact_email?.trim()) {
      newErrors.contact_email = 'E-postadress är obligatorisk'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Ogiltig e-postadress'
    }

    // Validate contract dates
    if (formData.contract_start_date && formData.contract_end_date) {
      const startDate = new Date(formData.contract_start_date)
      const endDate = new Date(formData.contract_end_date)
      
      if (endDate <= startDate) {
        newErrors.contract_end_date = 'Slutdatum måste vara efter startdatum'
      }
    }

    // Validate numeric values
    if (formData.annual_value && formData.annual_value < 0) {
      newErrors.annual_value = 'Årsvärde får inte vara negativt'
    }

    if (formData.monthly_value && formData.monthly_value < 0) {
      newErrors.monthly_value = 'Månadsvärde får inte vara negativt'
    }

    if (formData.total_contract_value && formData.total_contract_value < 0) {
      newErrors.total_contract_value = 'Totalt kontraktsvärde får inte vara negativt'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSave = async () => {
    if (!customer || !validateForm()) return

    setSaving(true)
    
    try {
      const updatedData = {
        ...formData,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('customers')
        .update(updatedData)
        .eq('id', customer.id)
        .select()
        .single()

      if (error) throw error

      toast.success('Kund uppdaterad framgångsrikt!')
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Redigera kund"
      subtitle={customer.company_name}
      size="xl"
      preventClose={loading}
      footer={
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4" />
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
              Spara ändringar
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* Basic Company Information */}
        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <Building2 className="w-5 h-5 text-blue-400" />
            Företagsinformation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Företagsnamn *
              </label>
              <Input
                value={formData.company_name || ''}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Ange företagsnamn"
                error={errors.company_name}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Organisationsnummer
              </label>
              <Input
                value={formData.organization_number || ''}
                onChange={(e) => handleInputChange('organization_number', e.target.value)}
                placeholder="XXXXXX-XXXX"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Företagstyp
              </label>
              <select
                value={formData.business_type || ''}
                onChange={(e) => handleInputChange('business_type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="">Välj typ</option>
                <option value="private">Privatperson</option>
                <option value="business">Företag</option>
                <option value="organization">Organisation</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Bransch
              </label>
              <Input
                value={formData.industry_category || ''}
                onChange={(e) => handleInputChange('industry_category', e.target.value)}
                placeholder="T.ex. Restaurang, Kontor, Hotell"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Kundstorlek
              </label>
              <select
                value={formData.customer_size || ''}
                onChange={(e) => handleInputChange('customer_size', e.target.value || null)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="">Välj storlek</option>
                <option value="small">Liten</option>
                <option value="medium">Medel</option>
                <option value="large">Stor</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <User className="w-5 h-5 text-green-400" />
            Kontaktinformation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Kontaktperson
              </label>
              <Input
                value={formData.contact_person || ''}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                placeholder="För- och efternamn"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                E-postadress *
              </label>
              <Input
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                placeholder="namn@example.com"
                error={errors.contact_email}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Telefonnummer
              </label>
              <Input
                value={formData.contact_phone || ''}
                onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                placeholder="070-123 45 67"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Adress
              </label>
              <Input
                value={formData.contact_address || ''}
                onChange={(e) => handleInputChange('contact_address', e.target.value)}
                placeholder="Gatuadress, Postnummer Ort"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Faktura E-post
              </label>
              <Input
                type="email"
                value={formData.billing_email || ''}
                onChange={(e) => handleInputChange('billing_email', e.target.value)}
                placeholder="faktura@example.com"
              />
              {formData.billing_email && formData.billing_email !== formData.contact_email && (
                <p className="text-xs text-yellow-400 mt-1">
                  Skiljer sig från kontakt-email
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Faktura Adress
              </label>
              <Input
                value={formData.billing_address || ''}
                onChange={(e) => handleInputChange('billing_address', e.target.value)}
                placeholder="Fakturaadress om annan än kontaktadress"
              />
            </div>
          </div>
        </Card>

        {/* Contract Information */}
        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            Kontraktsinformation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Kontraktsstart
              </label>
              <Input
                type="date"
                value={formData.contract_start_date || ''}
                onChange={(e) => handleInputChange('contract_start_date', e.target.value)}
                error={errors.contract_start_date}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Kontraktsslut
              </label>
              <Input
                type="date"
                value={formData.contract_end_date || ''}
                onChange={(e) => handleInputChange('contract_end_date', e.target.value)}
                error={errors.contract_end_date}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Årsvärde (SEK)
              </label>
              <Input
                type="number"
                value={formData.annual_value || ''}
                onChange={(e) => handleInputChange('annual_value', parseFloat(e.target.value) || 0)}
                placeholder="0"
                error={errors.annual_value}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Månadsvärde (SEK)
              </label>
              <Input
                type="number"
                value={formData.monthly_value || ''}
                onChange={(e) => handleInputChange('monthly_value', parseFloat(e.target.value) || 0)}
                placeholder="0"
                error={errors.monthly_value}
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Totalt kontraktsvärde (SEK)
              </label>
              <Input
                type="number"
                value={formData.total_contract_value || ''}
                onChange={(e) => handleInputChange('total_contract_value', parseFloat(e.target.value) || 0)}
                placeholder="0"
                error={errors.total_contract_value}
              />
            </div>
          </div>
        </Card>

        {/* Account Management */}
        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <User className="w-5 h-5 text-purple-400" />
            Account Management
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Tilldelad Account Manager
              </label>
              <Input
                value={formData.assigned_account_manager || ''}
                onChange={(e) => handleInputChange('assigned_account_manager', e.target.value)}
                placeholder="För- och efternamn"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Account Manager E-post
              </label>
              <Input
                type="email"
                value={formData.account_manager_email || ''}
                onChange={(e) => handleInputChange('account_manager_email', e.target.value)}
                placeholder="manager@begone.se"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Säljare
              </label>
              <Input
                value={formData.sales_person || ''}
                onChange={(e) => handleInputChange('sales_person', e.target.value)}
                placeholder="För- och efternamn"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Säljare E-post
              </label>
              <Input
                type="email"
                value={formData.sales_person_email || ''}
                onChange={(e) => handleInputChange('sales_person_email', e.target.value)}
                placeholder="salje@begone.se"
              />
            </div>
          </div>
        </Card>

        {/* Service Details */}
        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            Servicedetaljer
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Servicefrekvens
              </label>
              <Input
                value={formData.service_frequency || ''}
                onChange={(e) => handleInputChange('service_frequency', e.target.value)}
                placeholder="T.ex. Månadsvis, Kvartalsvis, Vid behov"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Produktsammanfattning
              </label>
              <textarea
                value={formData.product_summary || ''}
                onChange={(e) => handleInputChange('product_summary', e.target.value)}
                placeholder="Beskrivning av produkter och tjänster"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Servicedetaljer
              </label>
              <textarea
                value={formData.service_details || ''}
                onChange={(e) => handleInputChange('service_details', e.target.value)}
                placeholder="Detaljerad beskrivning av tjänster"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Avtalstext
              </label>
              <textarea
                value={formData.agreement_text || ''}
                onChange={(e) => handleInputChange('agreement_text', e.target.value)}
                placeholder="Avtalsspecifika villkor och anteckningar"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none"
                rows={4}
              />
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  )
}