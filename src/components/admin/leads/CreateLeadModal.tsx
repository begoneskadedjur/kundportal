// src/components/admin/leads/CreateLeadModal.tsx - Create new lead modal

import React, { useState, useEffect } from 'react'
import { Plus, Building2, User, Mail, Phone, MapPin, Calendar, AlertCircle, Save, Target, Star, Tag } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import SNIBranchManager from './SNIBranchManager'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { 
  LeadInsert, 
  LeadStatus, 
  ContactMethod, 
  CompanySize,
  LeadPriority,
  LeadSniCode,
  LEAD_STATUS_DISPLAY,
  CONTACT_METHOD_DISPLAY,
  COMPANY_SIZE_DISPLAY,
  LEAD_PRIORITY_DISPLAY
} from '../../../types/database'

interface CreateLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedSniCodes, setSelectedSniCodes] = useState<LeadSniCode[]>([])
  
  const [formData, setFormData] = useState<Partial<LeadInsert>>({
    company_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    status: 'blue_cold',
    organization_number: '',
    business_type: '',
    problem_type: '',
    address: '',
    website: '',
    company_size: null,
    business_description: '',
    sni07_label: '',
    notes: '',
    contact_method: null,
    contact_date: null,
    follow_up_date: null,
    interested_in_quote: false,
    quote_provided_date: null,
    procurement: false,
    contract_status: false,
    contract_with: '',
    contract_end_date: null,
    // Nya fält
    priority: null,
    source: '',
    estimated_value: null,
    probability: null,
    closing_date_estimate: null,
    competitor: '',
    decision_maker: '',
    budget_confirmed: false,
    timeline_confirmed: false,
    authority_confirmed: false,
    needs_confirmed: false,
    tags: []
  })

  const handleInputChange = (field: keyof LeadInsert, value: any) => {
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Required fields
    if (!formData.company_name?.trim()) {
      newErrors.company_name = 'Företagsnamn är obligatoriskt'
    }

    if (!formData.contact_person?.trim()) {
      newErrors.contact_person = 'Kontaktperson är obligatorisk'
    }

    if (!formData.phone_number?.trim()) {
      newErrors.phone_number = 'Telefonnummer är obligatoriskt'
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'E-post är obligatorisk'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ogiltig e-postadress'
    }

    // Website validation if provided
    if (formData.website && formData.website.trim()) {
      const websiteRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
      if (!websiteRegex.test(formData.website)) {
        newErrors.website = 'Ogiltig webbadress'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    if (!user?.id) {
      toast.error('Användare ej inloggad')
      return
    }

    try {
      setLoading(true)

      // Clean data - remove empty strings and convert to null
      const cleanData = { ...formData }
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key as keyof typeof cleanData] === '') {
          cleanData[key as keyof typeof cleanData] = null
        }
      })

      // Add audit fields
      const leadData: LeadInsert = {
        ...cleanData,
        created_by: user.id,
        updated_by: user.id
      } as LeadInsert

      const { data: insertedLead, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single()

      if (error) throw error

      // Insert SNI codes if any are selected
      if (selectedSniCodes.length > 0 && insertedLead) {
        const sniCodeInserts = selectedSniCodes.map(sniCode => ({
          lead_id: insertedLead.id,
          sni_code: sniCode.sni_code,
          sni_description: sniCode.sni_description,
          is_primary: sniCode.is_primary,
          created_by: user.id
        }))

        const { error: sniError } = await supabase
          .from('lead_sni_codes')
          .insert(sniCodeInserts)

        if (sniError) {
          console.error('Warning: Could not save SNI codes:', sniError)
          toast.error('Lead skapad men SNI-koder kunde inte sparas')
        }
      }

      toast.success('Lead skapad framgångsrikt')
      onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        company_name: '',
        contact_person: '',
        phone_number: '',
        email: '',
        status: 'blue_cold',
        organization_number: '',
        business_type: '',
        problem_type: '',
        address: '',
        website: '',
        company_size: null,
        business_description: '',
        sni07_label: '',
        notes: '',
        contact_method: null,
        contact_date: null,
        follow_up_date: null,
        interested_in_quote: false,
        quote_provided_date: null,
        procurement: false,
        contract_status: false,
        contract_with: '',
        contract_end_date: null,
        priority: null,
        source: '',
        estimated_value: null,
        probability: null,
        closing_date_estimate: null,
        competitor: '',
        decision_maker: '',
        budget_confirmed: false,
        timeline_confirmed: false,
        authority_confirmed: false,
        needs_confirmed: false,
        tags: []
      })
      setSelectedSniCodes([])

    } catch (err) {
      console.error('Error creating lead:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte skapa lead')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      setErrors({})
    }
  }


  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-600/10 rounded-lg">
            <Plus className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Skapa ny lead</h2>
            <p className="text-slate-400">Lägg till en potentiell kund i lead-pipelinen</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Obligatorisk huvudinformation */}
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Obligatorisk huvudinformation
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Företagsnamn *
                </label>
                <Input
                  value={formData.company_name || ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Företagsnamn"
                  className={errors.company_name ? 'border-red-500' : ''}
                />
                {errors.company_name && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.company_name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organisationsnummer
                </label>
                <Input
                  value={formData.organization_number || ''}
                  onChange={(e) => handleInputChange('organization_number', e.target.value)}
                  placeholder="XXXXXX-XXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Kontaktperson *
                  <span className="text-slate-500 text-xs ml-2">(Blir huvudkontakt i kontaktlistan)</span>
                </label>
                <Input
                  value={formData.contact_person || ''}
                  onChange={(e) => handleInputChange('contact_person', e.target.value)}
                  placeholder="Namn på kontaktperson"
                  className={errors.contact_person ? 'border-red-500' : ''}
                />
                {errors.contact_person && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.contact_person}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Denna kontakt kommer automatiskt att visas som huvudkontakt i kontakthanteringen
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Telefonnummer *
                </label>
                <Input
                  value={formData.phone_number || ''}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  placeholder="07X-XXX XX XX"
                  className={errors.phone_number ? 'border-red-500' : ''}
                />
                {errors.phone_number && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.phone_number}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  E-post *
                </label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="kontakt@företag.se"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status || 'blue_cold'}
                  onChange={(e) => handleInputChange('status', e.target.value as LeadStatus)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  {Object.entries(LEAD_STATUS_DISPLAY).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Företagsinformation */}
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Företagsinformation
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Verksamhetstyp
                </label>
                <Input
                  value={formData.business_type || ''}
                  onChange={(e) => handleInputChange('business_type', e.target.value)}
                  placeholder="t.ex. Restaurang, Hotell, Kontor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Typ av problem
                </label>
                <Input
                  value={formData.problem_type || ''}
                  onChange={(e) => handleInputChange('problem_type', e.target.value)}
                  placeholder="t.ex. Råttor, Möss, Vägglöss"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Företagsstorlek
                </label>
                <select
                  value={formData.company_size || ''}
                  onChange={(e) => handleInputChange('company_size', e.target.value as CompanySize || null)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="">Välj storlek</option>
                  {Object.entries(COMPANY_SIZE_DISPLAY).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Hemsida
                </label>
                <Input
                  value={formData.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://www.företag.se"
                  className={errors.website ? 'border-red-500' : ''}
                />
                {errors.website && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.website}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Adress
                </label>
                <Input
                  value={formData.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Gatuadress, Postnummer Stad"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Verksamhetsbeskrivning
                </label>
                <textarea
                  value={formData.business_description || ''}
                  onChange={(e) => handleInputChange('business_description', e.target.value)}
                  placeholder="Beskriv verksamheten och eventuella särskilda omständigheter"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              </div>

              <div className="md:col-span-2">
                <SNIBranchManager
                  selectedSniCodes={selectedSniCodes}
                  onSelectionChange={setSelectedSniCodes}
                  disabled={loading}
                />
              </div>
            </div>
          </Card>

          {/* Lead-hantering & prioritering */}
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />
              Lead-hantering & prioritering
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Prioritet
                </label>
                <select
                  value={formData.priority || ''}
                  onChange={(e) => handleInputChange('priority', e.target.value as LeadPriority || null)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="">Välj prioritet</option>
                  {Object.entries(LEAD_PRIORITY_DISPLAY).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Källa
                </label>
                <Input
                  value={formData.source || ''}
                  onChange={(e) => handleInputChange('source', e.target.value)}
                  placeholder="t.ex. Webbsida, Telefon, Referral"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notering
                </label>
                <p className="text-sm text-slate-400 mb-2">
                  Teknikertilldelningar hanteras efter att leadet har skapats
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Uppskattat värde (SEK)
                </label>
                <Input
                  type="number"
                  value={formData.estimated_value || ''}
                  onChange={(e) => handleInputChange('estimated_value', e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sannolikhet (0-100%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability || ''}
                  onChange={(e) => handleInputChange('probability', e.target.value ? Number(e.target.value) : null)}
                  placeholder="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Uppskattat slutdatum
                </label>
                <Input
                  type="date"
                  value={formData.closing_date_estimate || ''}
                  onChange={(e) => handleInputChange('closing_date_estimate', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nuvarande leverantör
                </label>
                <Input
                  value={formData.competitor || ''}
                  onChange={(e) => handleInputChange('competitor', e.target.value)}
                  placeholder="Namn på nuvarande leverantör"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Beslutsfattare
                </label>
                <Input
                  value={formData.decision_maker || ''}
                  onChange={(e) => handleInputChange('decision_maker', e.target.value)}
                  placeholder="Namn på beslutsfattare"
                />
              </div>
            </div>
          </Card>

          {/* BANT-kriterier */}
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              BANT-kvalificering
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.budget_confirmed || false}
                  onChange={(e) => handleInputChange('budget_confirmed', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                Budget bekräftad
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.authority_confirmed || false}
                  onChange={(e) => handleInputChange('authority_confirmed', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                Befogenhet bekräftad
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.needs_confirmed || false}
                  onChange={(e) => handleInputChange('needs_confirmed', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                Behov bekräftat
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.timeline_confirmed || false}
                  onChange={(e) => handleInputChange('timeline_confirmed', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                />
                Tidslinje bekräftad
              </label>
            </div>
          </Card>

          {/* Anteckningar */}
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-green-400" />
              Anteckningar
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kommentarer och anteckningar
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Lägg till kommentarer, mötesinformation eller andra anteckningar här..."
                rows={4}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-700/50">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Skapar lead...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Skapa lead
                </>
              )}
            </Button>
          </div>

        </form>
      </div>
    </Modal>
  )
}