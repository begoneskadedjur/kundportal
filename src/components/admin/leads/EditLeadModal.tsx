// src/components/admin/leads/EditLeadModal.tsx - Edit existing lead modal

import React, { useState, useEffect } from 'react'
import { Edit3, Building2, User, Mail, Phone, MapPin, Calendar, AlertCircle, Save, Trash2, Target, Star, Users } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { 
  Lead,
  LeadUpdate, 
  LeadStatus, 
  ContactMethod, 
  CompanySize,
  LeadPriority,
  LEAD_STATUS_DISPLAY,
  CONTACT_METHOD_DISPLAY,
  COMPANY_SIZE_DISPLAY,
  LEAD_PRIORITY_DISPLAY
} from '../../../types/database'
import LeadTechnicianManager from './LeadTechnicianManager'
import SNIBranchManager from './SNIBranchManager'

interface EditLeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditLeadModal({ lead, isOpen, onClose, onSuccess }: EditLeadModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<Partial<LeadUpdate>>({})
  const [leadTechnicians, setLeadTechnicians] = useState<any[]>([])
  const [selectedSniCodes, setSelectedSniCodes] = useState<any[]>([])

  // Initialize form data when lead changes
  useEffect(() => {
    if (lead) {
      setFormData({
        company_name: lead.company_name || '',
        contact_person: lead.contact_person || '',
        phone_number: lead.phone_number || '',
        email: lead.email || '',
        status: lead.status,
        organization_number: lead.organization_number || '',
        business_type: lead.business_type || '',
        problem_type: lead.problem_type || '',
        address: lead.address || '',
        website: lead.website || '',
        company_size: lead.company_size,
        business_description: lead.business_description || '',
        sni07_label: lead.sni07_label || '',
        notes: lead.notes || '',
        contact_method: lead.contact_method,
        contact_date: lead.contact_date ? new Date(lead.contact_date).toISOString().slice(0, 16) : '',
        follow_up_date: lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().slice(0, 16) : '',
        interested_in_quote: lead.interested_in_quote || false,
        quote_provided_date: lead.quote_provided_date ? new Date(lead.quote_provided_date).toISOString().slice(0, 10) : '',
        procurement: lead.procurement || false,
        contract_status: lead.contract_status || false,
        contract_with: lead.contract_with || '',
        contract_end_date: lead.contract_end_date ? new Date(lead.contract_end_date).toISOString().slice(0, 10) : '',
        // Nya fält
        priority: lead.priority,
        source: lead.source || '',
        estimated_value: lead.estimated_value,
        probability: lead.probability,
        closing_date_estimate: lead.closing_date_estimate ? new Date(lead.closing_date_estimate).toISOString().slice(0, 10) : '',
        decision_maker: lead.decision_maker || '',
        budget_confirmed: lead.budget_confirmed || false,
        timeline_confirmed: lead.timeline_confirmed || false,
        authority_confirmed: lead.authority_confirmed || false,
        needs_confirmed: lead.needs_confirmed || false,
        tags: lead.tags || []
      })
      setErrors({})
      
      // Fetch SNI codes for this lead
      fetchLeadSniCodes()
    }
  }, [lead])

  const fetchLeadSniCodes = async () => {
    if (!lead?.id) return
    
    try {
      const { data, error } = await supabase
        .from('lead_sni_codes')
        .select('*')
        .eq('lead_id', lead.id)
        .order('is_primary', { ascending: false })
      
      if (error) throw error
      setSelectedSniCodes(data || [])
    } catch (error) {
      console.error('Error fetching SNI codes:', error)
    }
  }

  const handleInputChange = (field: keyof LeadUpdate, value: any) => {
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
    
    if (!validateForm() || !lead?.id || !user?.id) {
      return
    }

    try {
      setLoading(true)

      // Clean data - remove empty strings and convert to null, handle specific types
      const cleanData = { ...formData }
      
      // Clean string fields only
      Object.keys(cleanData).forEach(key => {
        const value = cleanData[key as keyof typeof cleanData]
        if (typeof value === 'string' && value.trim() === '') {
          cleanData[key as keyof typeof cleanData] = null
        }
      })

      // Handle date fields specifically
      if (cleanData.contact_date && cleanData.contact_date.trim() === '') {
        cleanData.contact_date = null
      }
      if (cleanData.follow_up_date && cleanData.follow_up_date.trim() === '') {
        cleanData.follow_up_date = null
      }
      if (cleanData.quote_provided_date && cleanData.quote_provided_date.trim() === '') {
        cleanData.quote_provided_date = null
      }
      if (cleanData.contract_end_date && cleanData.contract_end_date.trim() === '') {
        cleanData.contract_end_date = null
      }
      if (cleanData.closing_date_estimate && cleanData.closing_date_estimate.trim() === '') {
        cleanData.closing_date_estimate = null
      }

      // Remove undefined fields and validate data integrity
      const filteredData = Object.fromEntries(
        Object.entries(cleanData).filter(([key, value]) => {
          // Filter out undefined values
          if (value === undefined) return false
          
          // Validate numeric fields
          if (['estimated_value', 'probability'].includes(key) && value !== null) {
            const numValue = Number(value)
            if (isNaN(numValue)) {
              console.warn(`Invalid numeric value for ${key}:`, value)
              return false
            }
          }
          
          // Validate date fields format
          if (key.includes('date') && value !== null && typeof value === 'string') {
            if (value.trim() && !value.match(/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
              console.warn(`Invalid date format for ${key}:`, value)
              return false
            }
          }
          
          return true
        })
      )

      // Add audit fields
      const updateData: LeadUpdate = {
        ...filteredData,
        updated_by: user.id
      } as LeadUpdate

      // Debug log the update data
      console.log('Updating lead with data:', updateData)
      console.log('Lead ID:', lead.id)
      console.log('Payload size:', JSON.stringify(updateData).length, 'characters')

      // Step 1: Update lead data first - split large updates for better performance
      // Remove large text fields temporarily to reduce payload
      const { sni07_label, notes, business_description, ...coreData } = updateData
      
      // First update core data
      const { error } = await supabase
        .from('leads')
        .update(coreData)
        .eq('id', lead.id)
      
      // Then update text fields separately if no error
      if (!error && (sni07_label || notes || business_description)) {
        const textFields = {}
        if (sni07_label) textFields.sni07_label = sni07_label
        if (notes) textFields.notes = notes  
        if (business_description) textFields.business_description = business_description
        
        const { error: textError } = await supabase
          .from('leads')
          .update(textFields)
          .eq('id', lead.id)
          
        if (textError) {
          console.warn('Text fields update failed:', textError)
          // Core data still saved, warn user
          toast.error('Lead uppdaterad men vissa textfält kunde inte sparas')
        }
      }

      if (error) {
        console.error('Supabase update error:', error)
        
        // More specific error handling
        if (error.message?.includes('CORS') || error.message?.includes('cors')) {
          throw new Error('Nätverksfel - kontrollera internetanslutning och försök igen')
        }
        
        if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
          throw new Error('Timeout - försök igen med mindre data åt gången')
        }
        
        if (error.message?.includes('constraint') || error.message?.includes('violates')) {
          throw new Error('Datavalidering misslyckades - kontrollera alla fält')
        }
        
        throw new Error(`Kunde inte spara lead: ${error.message}`)
      }

      // Step 2: Update SNI codes separately with better error handling
      if (selectedSniCodes.length > 0) {
        try {
          // Delete existing SNI codes
          const { error: deleteError } = await supabase
            .from('lead_sni_codes')
            .delete()
            .eq('lead_id', lead.id)

          if (deleteError) {
            console.warn('Could not delete existing SNI codes:', deleteError)
          }

          // Insert new SNI codes with validation
          const sniCodeInserts = selectedSniCodes
            .filter(sniCode => sniCode.sni_code && sniCode.sni_code.trim()) // Only valid codes
            .map(sniCode => ({
              lead_id: lead.id,
              sni_code: sniCode.sni_code.trim(),
              sni_description: sniCode.sni_description?.trim() || '',
              is_primary: sniCode.is_primary,
              created_by: user.id
            }))

          if (sniCodeInserts.length > 0) {
            const { error: sniError } = await supabase
              .from('lead_sni_codes')
              .insert(sniCodeInserts)

            if (sniError) {
              console.error('SNI codes insert error:', sniError)
              toast.error('Lead uppdaterad men SNI-koder kunde inte sparas')
            } else {
              // Update sni07_label with concatenated codes after successful insert
              const sniString = sniCodeInserts
                .map(code => `${code.sni_code} ${code.sni_description}`)
                .join(' ')
              
              const { error: labelError } = await supabase
                .from('leads')
                .update({ sni07_label: sniString })
                .eq('id', lead.id)
                
              if (labelError) {
                console.warn('SNI label update failed:', labelError)
              }
            }
          }
        } catch (sniErr) {
          console.error('SNI codes update failed:', sniErr)
          toast.error('Lead uppdaterad men SNI-koder kunde inte sparas')
        }
      }

      toast.success('Lead uppdaterad framgångsrikt')
      onSuccess()
      onClose()

    } catch (err) {
      console.error('Error updating lead:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte uppdatera lead')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!lead?.id) return

    if (!window.confirm('Är du säker på att du vill ta bort denna lead? Detta kan inte ångras.')) {
      return
    }

    try {
      setDeleting(true)

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id)

      if (error) throw error

      toast.success('Lead borttagen framgångsrikt')
      onSuccess()
      onClose()

    } catch (err) {
      console.error('Error deleting lead:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort lead')
    } finally {
      setDeleting(false)
    }
  }

  const handleClose = () => {
    if (!loading && !deleting) {
      onClose()
      setErrors({})
    }
  }

  // Fetch lead technicians
  useEffect(() => {
    const fetchLeadTechnicians = async () => {
      if (!lead?.id) return

      try {
        const { data, error } = await supabase
          .from('lead_technicians')
          .select(`
            id,
            technician_id,
            is_primary,
            assigned_at,
            assigned_by,
            notes,
            technicians!inner(
              id,
              name,
              email,
              is_active
            )
          `)
          .eq('lead_id', lead.id)
          .order('is_primary', { ascending: false })
          .order('assigned_at')

        if (error) throw error
        setLeadTechnicians(data || [])
      } catch (error) {
        console.error('Error fetching lead technicians:', error)
      }
    }

    if (isOpen && lead) {
      fetchLeadTechnicians()
    }
  }, [isOpen, lead])

  if (!lead) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-600/10 rounded-lg">
              <Edit3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Redigera lead</h2>
              <p className="text-slate-400">{lead.company_name}</p>
            </div>
          </div>

          <Button
            onClick={handleDelete}
            disabled={loading || deleting}
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            {deleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </Button>
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

          {/* Lead-hantering & uppföljning */}
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-400" />
              Lead-hantering & uppföljning
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Kontaktmetod
                </label>
                <select
                  value={formData.contact_method || ''}
                  onChange={(e) => handleInputChange('contact_method', e.target.value as ContactMethod || null)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="">Välj metod</option>
                  {Object.entries(CONTACT_METHOD_DISPLAY).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Kontaktad datum
                </label>
                <Input
                  type="datetime-local"
                  value={formData.contact_date || ''}
                  onChange={(e) => handleInputChange('contact_date', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ta kontakt igen datum
                </label>
                <Input
                  type="datetime-local"
                  value={formData.follow_up_date || ''}
                  onChange={(e) => handleInputChange('follow_up_date', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Offert lämnad datum
                </label>
                <Input
                  type="date"
                  value={formData.quote_provided_date || ''}
                  onChange={(e) => handleInputChange('quote_provided_date', e.target.value)}
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.interested_in_quote || false}
                    onChange={(e) => handleInputChange('interested_in_quote', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                  />
                  Intresserad av offert
                </label>

                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.procurement || false}
                    onChange={(e) => handleInputChange('procurement', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                  />
                  Upphandling
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Befintligt avtal hos kunden</h4>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="radio"
                        name="hasContract"
                        checked={!formData.contract_status}
                        onChange={() => handleInputChange('contract_status', false)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      Nej - inget befintligt avtal
                    </label>
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="radio"
                        name="hasContract"
                        checked={formData.contract_status || false}
                        onChange={() => handleInputChange('contract_status', true)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      Ja - har befintligt avtal
                    </label>
                  </div>
                </div>
                
                {formData.contract_status && (
                  <div className="bg-slate-700/30 p-4 rounded-lg space-y-4 border border-slate-600/50">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Nuvarande leverantör
                        <span className="text-slate-500 text-xs ml-2">(Namnet på företaget de har avtal med)</span>
                      </label>
                      <Input
                        value={formData.contract_with || ''}
                        onChange={(e) => handleInputChange('contract_with', e.target.value)}
                        placeholder="t.ex. Anticimex, Rentokil"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Avtal löper ut
                        <span className="text-slate-500 text-xs ml-2">(När avtalet kan sägas upp eller löper ut)</span>
                      </label>
                      <Input
                        type="date"
                        value={formData.contract_end_date || ''}
                        onChange={(e) => handleInputChange('contract_end_date', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Avtalsdetaljer
                      </label>
                      <textarea
                        placeholder="Ytterligare information om avtalet, uppsägningstid, etc."
                        rows={2}
                        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                      />
                    </div>
                  </div>
                )}
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
                <SNIBranchManager
                  leadId={lead?.id}
                  selectedSniCodes={selectedSniCodes}
                  onSelectionChange={setSelectedSniCodes}
                  disabled={loading}
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
                  Förhoppning om att slutföra affär till
                  <span className="text-slate-500 text-xs ml-2">(Ungefärligt datum när affären kan avslutas)</span>
                </label>
                <Input
                  type="date"
                  value={formData.closing_date_estimate || ''}
                  onChange={(e) => handleInputChange('closing_date_estimate', e.target.value)}
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
              <User className="w-5 h-5 text-yellow-400" />
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

          {/* Tekniker-hantering */}
          <LeadTechnicianManager
            leadId={lead.id}
            assignedTechnicians={leadTechnicians}
            onTechniciansChange={() => {
              // Refresh lead technicians when changes occur
              const fetchLeadTechnicians = async () => {
                if (!lead?.id) return

                try {
                  const { data, error } = await supabase
                    .from('lead_technicians')
                    .select(`
                      id,
                      technician_id,
                      is_primary,
                      assigned_at,
                      assigned_by,
                      notes,
                      technicians!inner(
                        id,
                        name,
                        email,
                        is_active
                      )
                    `)
                    .eq('lead_id', lead.id)
                    .order('is_primary', { ascending: false })
                    .order('assigned_at')

                  if (error) throw error
                  setLeadTechnicians(data || [])
                } catch (error) {
                  console.error('Error fetching lead technicians:', error)
                }
              }
              
              fetchLeadTechnicians()
            }}
          />

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-700/50">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading || deleting}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={loading || deleting}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Uppdaterar...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Uppdatera lead
                </>
              )}
            </Button>
          </div>

        </form>
      </div>
    </Modal>
  )
}