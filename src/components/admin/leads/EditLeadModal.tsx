// src/components/admin/leads/EditLeadModal.tsx - Edit existing lead modal

import React, { useState, useEffect } from 'react'
import { Edit3, Building2, Calendar, AlertCircle, Save, Trash2, Target, Star } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import DateField from '../../ui/DateField'
import Select from '../../ui/Select'
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
import { logLeadEvent } from '../../../utils/leadEventLogger'
import LeadTechnicianManager from './LeadTechnicianManager'
import SNIBranchManager from './SNIBranchManager'

interface EditLeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditLeadModal({ lead, isOpen, onClose, onSuccess }: EditLeadModalProps) {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<Partial<LeadUpdate>>({})
  const [leadTechnicians, setLeadTechnicians] = useState<any[]>([])
  const [selectedSniCodes, setSelectedSniCodes] = useState<any[]>([])

  // Ursprungsvärdena i formuläret. Sparning skickar bara fält som skiljer sig
  // från dessa, så att fält som formuläret inte rört aldrig skrivs över.
  const [initialForm, setInitialForm] = useState<Partial<LeadUpdate>>({})
  const [initialSniKey, setInitialSniKey] = useState('')

  const buildFormData = (l: Lead): Partial<LeadUpdate> => ({
    company_name: l.company_name || '',
    contact_person: l.contact_person || '',
    phone_number: l.phone_number || '',
    email: l.email || '',
    status: l.status,
    organization_number: l.organization_number || '',
    business_type: l.business_type || '',
    problem_type: l.problem_type || '',
    address: l.address || '',
    website: l.website || '',
    company_size: l.company_size,
    business_description: l.business_description || '',
    sni07_label: l.sni07_label || '',
    notes: l.notes || '',
    contact_method: l.contact_method,
    contact_date: l.contact_date ? new Date(l.contact_date).toISOString().slice(0, 16) : '',
    follow_up_date: l.follow_up_date ? new Date(l.follow_up_date).toISOString().slice(0, 16) : '',
    interested_in_quote: l.interested_in_quote || false,
    quote_provided_date: l.quote_provided_date ? new Date(l.quote_provided_date).toISOString().slice(0, 10) : '',
    procurement: l.procurement || false,
    contract_status: l.contract_status || false,
    contract_with: l.contract_with || '',
    contract_end_date: l.contract_end_date ? new Date(l.contract_end_date).toISOString().slice(0, 10) : '',
    priority: l.priority,
    source: l.source || '',
    estimated_value: l.estimated_value,
    probability: l.probability,
    closing_date_estimate: l.closing_date_estimate ? new Date(l.closing_date_estimate).toISOString().slice(0, 10) : '',
    competitor: l.competitor || '',
    decision_maker: l.decision_maker || '',
    budget_confirmed: l.budget_confirmed || false,
    timeline_confirmed: l.timeline_confirmed || false,
    authority_confirmed: l.authority_confirmed || false,
    needs_confirmed: l.needs_confirmed || false,
    tags: l.tags || []
  })

  // Initiera formuläret när modalen öppnas. Hela raden hämtas på id, så att
  // formuläret aldrig bygger på ett ofullständigt listobjekt.
  useEffect(() => {
    if (!lead || !isOpen) return
    let cancelled = false

    const initial = buildFormData(lead)
    setFormData(initial)
    setInitialForm(initial)
    setErrors({})

    const loadFullLead = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead.id)
        .single()
      if (cancelled || error || !data) return
      const full = buildFormData(data as Lead)
      setFormData(full)
      setInitialForm(full)
    }
    loadFullLead()

    // Fetch SNI codes for this lead
    fetchLeadSniCodes()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, isOpen])

  const sniKey = (codes: Array<{ sni_code?: string | null; sni_description?: string | null; is_primary?: boolean | null }>) =>
    JSON.stringify(
      codes
        .map(c => [String(c.sni_code || '').trim(), String(c.sni_description || '').trim(), !!c.is_primary])
        .sort()
    )

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
      setInitialSniKey(sniKey(data || []))
    } catch (error) {

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

  const FIELD_LABELS: Record<string, string> = {
    company_name: 'Företagsnamn',
    contact_person: 'Kontaktperson',
    phone_number: 'Telefon',
    email: 'E-post',
    status: 'Status',
    organization_number: 'Organisationsnummer',
    business_type: 'Verksamhetstyp',
    problem_type: 'Problemtyp',
    address: 'Adress',
    website: 'Hemsida',
    company_size: 'Företagsstorlek',
    business_description: 'Verksamhetsbeskrivning',
    sni07_label: 'Bransch (SNI)',
    notes: 'Anteckningar',
    contact_method: 'Kontaktsätt',
    contact_date: 'Kontaktdatum',
    follow_up_date: 'Uppföljningsdatum',
    interested_in_quote: 'Intresserad av offert',
    quote_provided_date: 'Offertdatum',
    procurement: 'Upphandling',
    contract_status: 'Har avtal',
    contract_with: 'Avtal med',
    contract_end_date: 'Avtalets slutdatum',
    priority: 'Prioritet',
    source: 'Källa',
    estimated_value: 'Uppskattat värde',
    probability: 'Sannolikhet',
    closing_date_estimate: 'Beräknat avslut',
    competitor: 'Konkurrent',
    decision_maker: 'Beslutsfattare',
    budget_confirmed: 'Budget bekräftad',
    timeline_confirmed: 'Tidslinje bekräftad',
    authority_confirmed: 'Befogenhet bekräftad',
    needs_confirmed: 'Behov bekräftat',
    tags: 'Taggar'
  }

  // Tomma strängar blir null så att jämförelse och sparning ser samma värde
  const normalizeValue = (value: unknown) => {
    if (typeof value === 'string') {
      return value.trim() === '' ? null : value
    }
    return value === undefined ? null : value
  }

  const isValidValue = (key: string, value: unknown) => {
    if (value === null) return true
    if (['estimated_value', 'probability'].includes(key) && isNaN(Number(value))) return false
    if (key.includes('date') && typeof value === 'string' &&
        !value.match(/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) return false
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !lead?.id || (!profile?.id && !user?.id)) {
      return
    }

    try {
      setLoading(true)

      // Steg 1: räkna ut vilka fält som faktiskt ändrats mot ursprungsvärdet
      const changes: Record<string, unknown> = {}
      for (const key of Object.keys(formData)) {
        const next = normalizeValue(formData[key as keyof LeadUpdate])
        const prev = normalizeValue(initialForm[key as keyof LeadUpdate])
        if (JSON.stringify(next) === JSON.stringify(prev)) continue
        if (!isValidValue(key, next)) continue
        changes[key] = next
      }

      const sniChanged = sniKey(selectedSniCodes) !== initialSniKey
      const changedKeys = Object.keys(changes)

      if (changedKeys.length === 0 && !sniChanged) {
        toast('Inga ändringar att spara')
        onClose()
        return
      }

      // Steg 2: spara bara de ändrade fälten (updated_by sätts av triggern)
      if (changedKeys.length > 0) {
        const { error } = await supabase
          .from('leads')
          .update(changes as LeadUpdate)
          .eq('id', lead.id)

        if (error) {
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
      }

      // Steg 3: SNI-koder skrivs bara om när de ändrats
      if (sniChanged) {
        try {
          await supabase
            .from('lead_sni_codes')
            .delete()
            .eq('lead_id', lead.id)

          const sniCodeInserts = selectedSniCodes
            .filter(sniCode => sniCode.sni_code && sniCode.sni_code.trim())
            .map(sniCode => ({
              lead_id: lead.id,
              sni_code: sniCode.sni_code.trim(),
              sni_description: sniCode.sni_description?.trim() || '',
              is_primary: sniCode.is_primary,
              created_by: user!.id
            }))

          if (sniCodeInserts.length > 0) {
            const { error: sniError } = await supabase
              .from('lead_sni_codes')
              .insert(sniCodeInserts)

            if (sniError) {
              toast.error('Lead uppdaterad men SNI-koder kunde inte sparas')
            } else {
              const sniString = sniCodeInserts
                .map(code => `${code.sni_code} ${code.sni_description}`)
                .join(' ')
              await supabase
                .from('leads')
                .update({ sni07_label: sniString })
                .eq('id', lead.id)
            }
          }
        } catch {
          toast.error('Lead uppdaterad men SNI-koder kunde inte sparas')
        }
      }

      // Steg 4: en enda händelse per sparning med de fält som ändrats.
      // Triggern log_lead_events loggar redan statusbyte, tilldelning och
      // offertdatum (en sak per uppdatering, i den ordningen), så de tas inte med här.
      try {
        const statusChanged = changedKeys.includes('status')
        const triggerLogsQuote = !statusChanged && changes.quote_provided_date != null
        const loggedKeys = changedKeys.filter(key =>
          key !== 'status' && !(key === 'quote_provided_date' && triggerLogsQuote)
        )
        const labels = loggedKeys.map(key => FIELD_LABELS[key] || key)
        if (sniChanged && !loggedKeys.includes('sni07_label')) labels.push('SNI-koder')

        if (labels.length > 0) {
          const fieldChanges = Object.fromEntries(
            loggedKeys.map(key => [
              key,
              { from: normalizeValue(initialForm[key as keyof LeadUpdate]), to: changes[key] }
            ])
          )
          await logLeadEvent({
            leadId: lead.id,
            eventType: 'updated',
            title: 'Lead uppdaterad',
            description: `Ändrade fält: ${labels.join(', ')}`,
            data: {
              changed_fields: loggedKeys,
              changes: fieldChanges,
              sni_changed: sniChanged,
              changed_by_profile: user?.email
            },
            userId: user!.id
          })
        }
      } catch (eventError) {
        console.warn('Could not log lead update event:', eventError)
      }

      toast.success('Lead uppdaterad framgångsrikt')
      onSuccess()
      onClose()

    } catch (err) {

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

      }
    }

    if (isOpen && lead) {
      fetchLeadTechnicians()
    }
  }, [isOpen, lead])

  if (!lead) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-400" />
          <span>Redigera lead</span>
        </div>
      }
      subtitle={lead.company_name}
      headerActions={
        <Button
          onClick={handleDelete}
          disabled={loading || deleting}
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          {deleting ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      }
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-2.5">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={loading || deleting}>
            Avbryt
          </Button>
          <Button
            type="submit"
            form="edit-lead-form"
            disabled={loading || deleting}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                Uppdaterar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Uppdatera lead
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="p-4">
        <form id="edit-lead-form" onSubmit={handleSubmit} className="space-y-3">
          
          {/* Obligatorisk huvudinformation */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-purple-400" />
              Obligatorisk huvudinformation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Organisationsnummer
                </label>
                <Input
                  value={formData.organization_number || ''}
                  onChange={(e) => handleInputChange('organization_number', e.target.value)}
                  placeholder="XXXXXX-XXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Status
                </label>
                <Select
                  value={formData.status || 'blue_cold'}
                  onChange={(v) => handleInputChange('status', v as LeadStatus)}
                  options={Object.entries(LEAD_STATUS_DISPLAY).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Lead-hantering & uppföljning */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-green-400" />
              Lead-hantering & uppföljning
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Kontaktmetod
                </label>
                <Select
                  value={formData.contact_method || ''}
                  onChange={(v) => handleInputChange('contact_method', v as ContactMethod || null)}
                  placeholder="Välj metod"
                  options={Object.entries(CONTACT_METHOD_DISPLAY).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Kontaktad datum
                </label>
                <DateField
                  withTime
                  value={formData.contact_date || ''}
                  onChange={(v) => handleInputChange('contact_date', v)}
                  aria-label="Kontaktad datum"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Ta kontakt igen datum
                </label>
                <DateField
                  withTime
                  value={formData.follow_up_date || ''}
                  onChange={(v) => handleInputChange('follow_up_date', v)}
                  aria-label="Ta kontakt igen datum"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Offert lämnad datum
                </label>
                {/* DateField istället för <input type="date">: Chrome ignorerar lang="sv-SE"
                    och visar mm/dd/yyyy efter webbläsarens språk, aldrig dokumentets */}
                <DateField
                  value={formData.quote_provided_date || ''}
                  onChange={(v) => handleInputChange('quote_provided_date', v)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.interested_in_quote || false}
                    onChange={(e) => handleInputChange('interested_in_quote', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  Intresserad av offert
                </label>

                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.procurement || false}
                    onChange={(e) => handleInputChange('procurement', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
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
                        className="text-[#20c58f] focus:ring-[#20c58f]"
                      />
                      Nej - inget befintligt avtal
                    </label>
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="radio"
                        name="hasContract"
                        checked={formData.contract_status || false}
                        onChange={() => handleInputChange('contract_status', true)}
                        className="text-[#20c58f] focus:ring-[#20c58f]"
                      />
                      Ja - har befintligt avtal
                    </label>
                  </div>
                </div>
                
                {formData.contract_status && (
                  <div className="bg-slate-800/30 p-3 rounded-lg space-y-3 border border-slate-700/40">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
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
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Avtal löper ut
                        <span className="text-slate-500 text-xs ml-2">(När avtalet kan sägas upp eller löper ut)</span>
                      </label>
                      <DateField
                        value={formData.contract_end_date || ''}
                        onChange={(v) => handleInputChange('contract_end_date', v)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Avtalsdetaljer
                      </label>
                      <textarea
                        value={formData.competitor || ''}
                        onChange={(e) => handleInputChange('competitor', e.target.value)}
                        placeholder="Ytterligare information om avtalet, uppsägningstid, etc."
                        rows={2}
                        className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Företagsinformation + Anteckningar (merged) */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-400" />
              Företagsinformation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Verksamhetstyp
                </label>
                <Input
                  value={formData.business_type || ''}
                  onChange={(e) => handleInputChange('business_type', e.target.value)}
                  placeholder="t.ex. Restaurang, Hotell, Kontor"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Typ av problem
                </label>
                <Input
                  value={formData.problem_type || ''}
                  onChange={(e) => handleInputChange('problem_type', e.target.value)}
                  placeholder="t.ex. Råttor, Möss, Vägglöss"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Företagsstorlek
                </label>
                <Select
                  value={formData.company_size || ''}
                  onChange={(v) => handleInputChange('company_size', v as CompanySize || null)}
                  placeholder="Välj storlek"
                  options={Object.entries(COMPANY_SIZE_DISPLAY).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Verksamhetsbeskrivning
                </label>
                <textarea
                  value={formData.business_description || ''}
                  onChange={(e) => handleInputChange('business_description', e.target.value)}
                  placeholder="Beskriv verksamheten och eventuella särskilda omständigheter"
                  rows={3}
                  className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>
              {/* Anteckningar (merged into this card) */}
              <div className="md:col-span-2 border-t border-slate-700/50 pt-3 mt-1">
                <h4 className="text-sm font-medium text-slate-300 mb-1.5">Anteckningar</h4>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Lägg till kommentarer, mötesinformation eller andra anteckningar här..."
                  rows={3}
                  className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Lead-hantering & prioritering + BANT (merged) */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-orange-400" />
              Lead-hantering & prioritering
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Prioritet
                </label>
                <Select
                  value={formData.priority || ''}
                  onChange={(v) => handleInputChange('priority', v as LeadPriority || null)}
                  placeholder="Välj prioritet"
                  options={Object.entries(LEAD_PRIORITY_DISPLAY).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Källa
                </label>
                <Input
                  value={formData.source || ''}
                  onChange={(e) => handleInputChange('source', e.target.value)}
                  placeholder="t.ex. Webbsida, Telefon, Referral"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Förhoppning om att slutföra affär till
                  <span className="text-slate-500 text-xs ml-2">(Ungefärligt datum när affären kan avslutas)</span>
                </label>
                <DateField
                  value={formData.closing_date_estimate || ''}
                  onChange={(v) => handleInputChange('closing_date_estimate', v)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Beslutsfattare
                </label>
                <Input
                  value={formData.decision_maker || ''}
                  onChange={(e) => handleInputChange('decision_maker', e.target.value)}
                  placeholder="Namn på beslutsfattare"
                />
              </div>
            </div>

            {/* BANT-kvalificering (merged into this card) */}
            <div className="border-t border-slate-700/50 pt-3 mt-3">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                BANT-kvalificering
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.budget_confirmed || false}
                    onChange={(e) => handleInputChange('budget_confirmed', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  Budget bekräftad
                </label>

                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.authority_confirmed || false}
                    onChange={(e) => handleInputChange('authority_confirmed', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  Befogenhet bekräftad
                </label>

                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.needs_confirmed || false}
                    onChange={(e) => handleInputChange('needs_confirmed', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  Behov bekräftat
                </label>

                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.timeline_confirmed || false}
                    onChange={(e) => handleInputChange('timeline_confirmed', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                  Tidslinje bekräftad
                </label>
              </div>
            </div>
          </div>

          {/* Kollega-hantering */}
          <LeadTechnicianManager
            leadId={lead.id}
            assignedTechnicians={leadTechnicians}
            onTechniciansChange={() => {
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
                  // silent
                }
              }
              fetchLeadTechnicians()
            }}
          />

        </form>
      </div>
    </Modal>
  )
}