// src/components/coordinator/InspectionCaseModal.tsx
// Förenklad modal för stationskontroll-ärenden (inspection cases)
// Baserad på EditContractCaseModal men utan: rapport, bilder, bedömning, tidtagning, kostnad

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, User, Phone, Mail, MapPin, Calendar, AlertCircle, Save,
  FileText, Users, ClipboardCheck, Play,
  FileSignature, ChevronDown, ChevronRight, DollarSign,
  Building, Building2, Plus, Trash2, Pencil, Star
} from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { DROPDOWN_STATUSES } from '../../types/database'
import { toSwedishISOString } from '../../utils/dateHelpers'
import DeleteCaseConfirmDialog from '../shared/DeleteCaseConfirmDialog'

registerLocale('sv', sv)

interface InspectionCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  caseData: any
  isCustomerView?: boolean
}

export default function InspectionCaseModal({
  isOpen,
  onClose,
  onSuccess,
  caseData,
  isCustomerView = false
}: InspectionCaseModalProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [customerData, setCustomerData] = useState<any>(null)
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    description: '',
    status: 'Bokad',
    customer_id: null as string | null,

    contact_person: '',
    contact_phone: '',
    contact_email: '',

    address: '',

    scheduled_start: null as Date | null,
    scheduled_end: null as Date | null,

    primary_technician_id: '',
    primary_technician_name: '',
    secondary_technician_id: '',
    secondary_technician_name: '',
    tertiary_technician_id: '',
    tertiary_technician_name: '',
  })

  const [technicians, setTechnicians] = useState<any[]>([])
  const [showQuoteDropdown, setShowQuoteDropdown] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<{
    role: 'platsansvarig' | 'regionchef' | 'verksamhetschef'
    userId?: string
    label: string
    sites?: string[]
    contactPerson?: string
    contactEmail?: string
    contactPhone?: string
  } | null>(null)
  const [organizationSites, setOrganizationSites] = useState<any[]>([])
  const [regionchefSiteIds, setRegionchefSiteIds] = useState<string[]>([])
  const [regionchefContactInfo, setRegionchefContactInfo] = useState<any>(null)
  const [verksamhetschefContactInfo, setVerksamhetschefContactInfo] = useState<any>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  // Inline title edit state
  const [editingTitle, setEditingTitle] = useState(false)

  // Radering state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Följeärende-states
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpLoading, setFollowUpLoading] = useState(false)

  const isMultisiteCustomer = customerData?.is_multisite === true
  const isTechnician = profile?.role === 'technician'

  // Hämta mottagaralternativ för multisite
  const getRecipientOptions = useCallback(() => {
    if (!isMultisiteCustomer || !customerData || !organizationSites.length) return []

    const options = []

    const currentSite = organizationSites.find(site => site.id === customerData.id)
    if (currentSite) {
      const siteName = currentSite.site_name || currentSite.company_name
      options.push({
        role: 'platsansvarig' as const,
        label: `Platschef för ${siteName}`,
        sites: [siteName],
        contactPerson: formData.contact_person || customerData.contact_person,
        contactEmail: formData.contact_email || customerData.contact_email,
        contactPhone: formData.contact_phone || customerData.contact_phone
      })
    }

    if (regionchefSiteIds.length > 0 && regionchefContactInfo) {
      const regionSites = organizationSites.filter(site =>
        regionchefSiteIds.includes(site.id)
      )

      if (regionSites.length > 0) {
        const siteNames = regionSites.map(site => site.site_name || site.company_name).join(', ')
        const truncatedNames = siteNames.length > 50
          ? `${regionSites.length} enheter i regionen`
          : siteNames
        const contactName = regionchefContactInfo.contactPerson ? ` (${regionchefContactInfo.contactPerson})` : ''

        options.push({
          role: 'regionchef' as const,
          label: `Regionchef för ${truncatedNames}${contactName}`,
          sites: regionSites.map(site => site.site_name || site.company_name),
          contactPerson: regionchefContactInfo.contactPerson,
          contactEmail: regionchefContactInfo.contactEmail,
          contactPhone: regionchefContactInfo.contactPhone
        })
      }
    }

    if (organizationSites.length > 0) {
      const contactName = verksamhetschefContactInfo?.contactPerson ? ` (${verksamhetschefContactInfo.contactPerson})` : ''

      options.push({
        role: 'verksamhetschef' as const,
        label: `Verksamhetschef${contactName}`,
        sites: organizationSites.map(site => site.site_name || site.company_name),
        contactPerson: verksamhetschefContactInfo?.contactPerson,
        contactEmail: verksamhetschefContactInfo?.contactEmail,
        contactPhone: verksamhetschefContactInfo?.contactPhone
      })
    }

    return options
  }, [isMultisiteCustomer, customerData, organizationSites, regionchefSiteIds, regionchefContactInfo, verksamhetschefContactInfo, formData])

  // Ladda case data
  useEffect(() => {
    if (caseData && isOpen) {
      setFormData({
        case_number: caseData.case_number || '',
        title: caseData.title || '',
        description: caseData.description || '',
        status: caseData.status || 'Bokad',
        customer_id: caseData.customer_id || null,
        contact_person: caseData.contact_person || '',
        contact_phone: caseData.contact_phone || '',
        contact_email: caseData.contact_email || '',
        address: caseData.address?.formatted_address || caseData.address || '',
        scheduled_start: caseData.scheduled_start ? new Date(caseData.scheduled_start) : null,
        scheduled_end: caseData.scheduled_end ? new Date(caseData.scheduled_end) : null,
        primary_technician_id: caseData.primary_technician_id || '',
        primary_technician_name: caseData.primary_technician_name || '',
        secondary_technician_id: caseData.secondary_technician_id || '',
        secondary_technician_name: caseData.secondary_technician_name || '',
        tertiary_technician_id: caseData.tertiary_technician_id || '',
        tertiary_technician_name: caseData.tertiary_technician_name || '',
      })
    }
  }, [caseData, isOpen])

  // Hämta kunddata
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!caseData?.customer_id) return

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', caseData.customer_id)
        .single()

      if (!error && data) {
        setCustomerData(data)

        // Om multisite, hämta organisation sites
        if (data.is_multisite && data.organization_id) {
          const { data: sites } = await supabase
            .from('customers')
            .select('*')
            .eq('organization_id', data.organization_id)
            .order('site_name')

          if (sites) {
            setOrganizationSites(sites)
          }
        }
      }
    }

    if (isOpen && caseData?.customer_id) {
      fetchCustomerData()
    }
  }, [isOpen, caseData?.customer_id])

  // Hämta tekniker
  useEffect(() => {
    const fetchTechnicians = async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name')

      if (!error && data) {
        setTechnicians(data)
      }
    }

    if (isOpen) {
      fetchTechnicians()
    }
  }, [isOpen])

  const handleClose = () => {
    setShowQuoteDropdown(false)
    setSelectedRecipient(null)
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTechnicianChange = (field: 'primary' | 'secondary' | 'tertiary', technicianId: string) => {
    const technician = technicians.find(t => t.id === technicianId)
    setFormData(prev => ({
      ...prev,
      [`${field}_technician_id`]: technicianId,
      [`${field}_technician_name`]: technician?.name || ''
    }))
  }

  const handleSubmit = async () => {
    if (!caseData?.id) return

    setLoading(true)
    try {
      const cleanedFormData = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        contact_person: formData.contact_person,
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email,
        address: formData.address ? { formatted_address: formData.address } : null,
        scheduled_start: formData.scheduled_start ? toSwedishISOString(formData.scheduled_start) : null,
        scheduled_end: formData.scheduled_end ? toSwedishISOString(formData.scheduled_end) : null,
        primary_technician_id: formData.primary_technician_id || null,
        primary_technician_name: formData.primary_technician_name || null,
        secondary_technician_id: formData.secondary_technician_id || null,
        secondary_technician_name: formData.secondary_technician_name || null,
        tertiary_technician_id: formData.tertiary_technician_id || null,
        tertiary_technician_name: formData.tertiary_technician_name || null,
      }

      const { error } = await supabase
        .from('cases')
        .update(cleanedFormData)
        .eq('id', caseData.id)

      if (error) throw error

      toast.success('Avtalat servicebesök uppdaterat!')
      if (onSuccess) onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error updating case:', error)
      toast.error('Kunde inte spara ändringar')
    } finally {
      setLoading(false)
    }
  }

  // Navigera till inspektionsmodulen
  const handleStartInspection = () => {
    if (caseData?.id) {
      navigate(`/technician/inspection/${caseData.id}`)
      handleClose()
    }
  }

  // Hantera offert via Oneflow
  const handleGenerateQuote = async () => {
    if (isMultisiteCustomer && !selectedRecipient) {
      toast.error('Välj vem som ska motta offerten')
      return
    }

    const prefillData = {
      Kontaktperson: selectedRecipient?.contactPerson || formData.contact_person,
      'e-post-kontaktperson': selectedRecipient?.contactEmail || formData.contact_email,
      'telefonnummer-kontaktperson': selectedRecipient?.contactPhone || formData.contact_phone,
      'utforande-adress': formData.address,
      foretag: customerData?.company_name || '',
      'org-nr': customerData?.organization_number || '',
      partyType: customerData?.organization_number ? 'company' : 'individual',
      documentType: 'offer',
      selectedTemplate: '8598798',
      autoSelectTemplate: true,
      anstalld: formData.primary_technician_name || profile?.display_name || 'BeGone Medarbetare',
      'e-post-anstlld': profile?.email || '',
      avtalslngd: '1',
      begynnelsedag: new Date().toISOString().split('T')[0],
      caseNumber: formData.case_number,
      caseTitle: formData.title,
      pestType: 'Avtalat servicebesök',
      case_id: caseData?.id,
      is_multisite: customerData?.is_multisite || false,
      site_name: customerData?.site_name || '',
      parent_company: customerData?.parent_company_name || ''
    }

    sessionStorage.setItem('prefill_customer_data', JSON.stringify(prefillData))

    // Bestäm Oneflow-rutt baserat på roll
    const oneflowRoute = profile?.role === 'admin' ? '/admin/oneflow' : '/koordinator/oneflow'
    navigate(`${oneflowRoute}?prefill=offer`)

    toast.success('Navigerar till offertskapning...')
    setShowQuoteDropdown(false)

    if (caseData?.id) {
      await supabase
        .from('cases')
        .update({ quote_generated_at: new Date().toISOString() })
        .eq('id', caseData.id)
    }

    setSelectedRecipient(null)
  }

  // Skapa följeärende
  const handleCreateFollowUp = async () => {
    if (!caseData?.id) return

    setFollowUpLoading(true)
    try {
      const newCaseNumber = `INS-${Date.now().toString().slice(-6)}`

      const { data: newCase, error } = await supabase
        .from('cases')
        .insert([{
          customer_id: caseData.customer_id,
          site_id: caseData.site_id,
          title: `Uppföljning: ${formData.title}`,
          description: `Uppföljning av: ${formData.title}\n\nTidigare ärende: ${formData.case_number}`,
          status: 'Öppen',
          service_type: 'inspection',
          case_number: newCaseNumber,
          contact_person: formData.contact_person,
          contact_phone: formData.contact_phone,
          contact_email: formData.contact_email,
          address: formData.address ? { formatted_address: formData.address } : null,
          primary_technician_id: formData.primary_technician_id || null,
          parent_case_id: caseData.id
        }])
        .select()
        .single()

      if (error) throw error

      toast.success(`Följeärende skapat: ${newCaseNumber}`)
      setShowFollowUpDialog(false)
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error creating follow-up case:', error)
      toast.error('Kunde inte skapa följeärende')
    } finally {
      setFollowUpLoading(false)
    }
  }

  if (!isOpen) return null

  // Modal title
  const modalTitle = (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-cyan-500/10 rounded-lg">
        <ClipboardCheck className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">Ärende: {formData.case_number || 'INS-...'}</span>
          {!editingTitle && (
            <button onClick={() => setEditingTitle(true)} className="p-1 text-slate-400 hover:text-white rounded transition-colors" title="Redigera ärendenamn">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-cyan-300">Avtalat servicebesök</p>
      </div>
    </div>
  )

  // Header action buttons
  const headerActions = !isCustomerView && (
    <div className="mb-6 -mt-6 -mx-6 px-4 sm:px-6 py-4 bg-slate-800/30 border-b border-slate-700">
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        {/* Quote dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowQuoteDropdown(!showQuoteDropdown)}
            className="flex items-center gap-2 px-3 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 transition-colors"
          >
            <FileSignature className="w-4 h-4" />
            <span className="text-sm font-medium">Offert</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showQuoteDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
              {isMultisiteCustomer && (
                <div className="p-4 border-b border-slate-700">
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Vem ska motta offerten?
                  </label>
                  <Select
                    value={selectedRecipient ? selectedRecipient.role : ''}
                    onChange={(role) => {
                      const option = getRecipientOptions().find(opt => opt.role === role) ?? null
                      setSelectedRecipient(option)
                    }}
                    placeholder="Välj mottagare..."
                    options={getRecipientOptions().map(opt => ({ value: opt.role, label: opt.label }))}
                  />
                </div>
              )}

              <button
                onClick={handleGenerateQuote}
                disabled={isMultisiteCustomer && !selectedRecipient}
                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4" />
                Skapa offert via Oneflow
                <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
              </button>
            </div>
          )}
        </div>

        {/* Följeärende-knapp */}
        <button
          onClick={() => setShowFollowUpDialog(true)}
          className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Följeärende</span>
        </button>
      </div>
    </div>
  )

  // Modal footer
  const modalFooter = (
    <div className="flex flex-col sm:flex-row justify-between gap-3 p-6 bg-slate-800/50">
      {/* Gå till inspektion - tekniker, koordinator och admin */}
      {(isTechnician || profile?.role === 'coordinator' || profile?.role === 'admin') && (
        <Button
          onClick={handleStartInspection}
          className="bg-cyan-500 hover:bg-cyan-600 order-first sm:order-none"
        >
          <Play className="w-4 h-4 mr-2" />
          Gå till inspektion
        </Button>
      )}

      <div className="flex justify-end gap-3 flex-1">
        <Button
          onClick={handleClose}
          variant="secondary"
          className="bg-slate-700 hover:bg-slate-600"
        >
          Avbryt
        </Button>
        {!isCustomerView && (
          <Button
            onClick={handleSubmit}
            loading={loading}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <Save className="w-4 h-4 mr-2" />
            Spara ändringar
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={modalTitle}
        size="xl"
        footer={modalFooter}
        usePortal={true}
      >
        <div className="p-4 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {headerActions}

          <div className="space-y-3">
            {/* Kundinformation — samlad sektion */}
            <div className="bg-gradient-to-r from-purple-900/20 to-violet-900/20 rounded-xl p-4 border border-purple-500/30">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-purple-400" />
                Kundinformation
              </h3>

              {customerData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-0">
                  <div>
                    <label className="block text-xs font-medium text-purple-300 mb-1">Företag</label>
                    <p className="text-white font-medium">
                      {customerData.is_multisite && customerData.site_name
                        ? `${customerData.company_name}${customerData.company_name.includes(customerData.site_name) ? '' : ` - ${customerData.site_name}`}`
                        : customerData.company_name}
                    </p>
                    {(() => {
                      const amName = customerData.assigned_account_manager
                        || (customerData.is_multisite && organizationSites?.find((s: any) => s.site_type === 'huvudkontor')?.assigned_account_manager);
                      return amName ? <p className="text-xs text-slate-400 mt-0.5">AM: {amName}</p> : null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-purple-300 mb-1">Organisationsnummer</label>
                    <p className="text-white font-medium">{customerData.organization_number || 'Ej angivet'}</p>
                  </div>
                </div>
              )}

              {formData.address && (
                <div className="mt-3 pt-3 border-t border-purple-500/20">
                  <label className="block text-xs font-medium text-purple-300 mb-1">Adress</label>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-white hover:text-[#20c58f] transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    {formData.address}
                  </a>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-purple-500/20">
                <label className="block text-xs font-medium text-purple-300 mb-2">Kontaktperson vid besök</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input type="text" name="contact_person" value={formData.contact_person}
                    onChange={handleChange} disabled={isCustomerView} placeholder="Namn"
                    className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm disabled:opacity-60" />
                  <input type="tel" name="contact_phone" value={formData.contact_phone}
                    onChange={handleChange} disabled={isCustomerView} placeholder="Telefon"
                    className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm disabled:opacity-60" />
                  <input type="email" name="contact_email" value={formData.contact_email}
                    onChange={handleChange} disabled={isCustomerView} placeholder="E-post"
                    className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm disabled:opacity-60" />
                </div>
              </div>
            </div>

            {/* Tekniker + Status */}
            {!isCustomerView && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-slate-400 mr-0.5">Tekniker</span>
                    {([
                      { key: 'primary_technician_id' as const, label: 'Primär' },
                      { key: 'secondary_technician_id' as const, label: 'Sekundär' },
                      { key: 'tertiary_technician_id' as const, label: 'Tertiär' },
                    ]).map((slot) => {
                      const techId = formData[slot.key] || ''
                      const tech = technicians.find(t => t.id === techId)
                      const initials = tech ? tech.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : ''
                      return (
                        <div key={slot.key} className="relative">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                            tech ? 'bg-[#20c58f]/20 border-2 border-[#20c58f]'
                                 : 'border-2 border-dashed border-slate-600 hover:border-slate-500'
                          }`} title={tech ? `${tech.name} (${slot.label})` : `${slot.label} tekniker`}>
                            {tech ? <span className="text-xs font-bold text-[#20c58f]">{initials}</span>
                                   : <Plus className="w-3 h-3 text-slate-500" />}
                          </div>
                          <select
                            value={techId}
                            onChange={(e) => handleTechnicianChange(slot.key.replace('_technician_id', '') as 'primary' | 'secondary' | 'tertiary', e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          >
                            <option value="">Ingen</option>
                            {technicians
                              .filter(t => t.id === techId || ![
                                formData.primary_technician_id,
                                formData.secondary_technician_id,
                                formData.tertiary_technician_id
                              ].filter(id => id !== techId).includes(t.id))
                              .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Select
                      value={formData.status}
                      onChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                      disabled={isCustomerView}
                      options={DROPDOWN_STATUSES.map(s => ({ value: s, label: s }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Schemaläggning */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-400" />
                Schemaläggning - Ankomsttid
              </h3>
              <p className="text-sm text-slate-400 mb-2">Tekniker anländer till kunden inom detta tidsintervall</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Från tid</label>
                  <DatePicker
                    selected={formData.scheduled_start}
                    onChange={(date) => setFormData(prev => ({ ...prev, scheduled_start: date }))}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    locale="sv"
                    disabled={isCustomerView}
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white"
                    placeholderText="Välj starttid..."
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Till tid</label>
                  <DatePicker
                    selected={formData.scheduled_end}
                    onChange={(date) => setFormData(prev => ({ ...prev, scheduled_end: date }))}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    locale="sv"
                    disabled={isCustomerView}
                    minDate={formData.scheduled_start || undefined}
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white"
                    placeholderText="Välj sluttid..."
                    isClearable
                  />
                </div>
              </div>
              {formData.scheduled_start && formData.scheduled_end && (
                <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <p className="text-sm text-cyan-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Tekniker anländer: {formData.scheduled_start.toLocaleDateString('sv-SE')} mellan{' '}
                    {formData.scheduled_start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {formData.scheduled_end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>

            {/* Grundläggande information */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                Grundläggande information
              </h3>
              {editingTitle && !isCustomerView && (
                <div className="flex items-center gap-2 mb-3">
                  <input name="title" value={formData.title} onChange={handleChange}
                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    placeholder="Ärendenamn..."
                    autoFocus
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Beskrivning</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={isCustomerView}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white disabled:opacity-60"
                  placeholder="Anteckningar om ärendet..."
                />
              </div>
            </div>

            {/* Danger Zone - endast för admin/koordinator */}
            {!isCustomerView && (
              <div className="bg-red-900/10 rounded-xl p-4 border border-red-500/30">
                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Danger Zone
                </h3>
                <p className="text-sm text-slate-400 mb-2">
                  Permanenta åtgärder som inte kan ångras.
                </p>
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="secondary"
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Radera ärende
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete confirmation dialog */}
      <DeleteCaseConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        caseId={caseData?.id}
        caseNumber={formData.case_number}
        caseTitle={formData.title}
        onSuccess={() => {
          setShowDeleteDialog(false)
          handleClose()
          if (onSuccess) onSuccess()
        }}
      />

      {/* Följeärende dialog */}
      {showFollowUpDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Skapa följeärende</h3>
            <p className="text-sm text-slate-400 mb-6">
              Vill du skapa ett nytt stationskontroll-ärende baserat på detta ärende?
              Kundinformation och tekniker kopieras automatiskt.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setShowFollowUpDialog(false)}
                variant="secondary"
                className="bg-slate-700 hover:bg-slate-600"
              >
                Avbryt
              </Button>
              <Button
                onClick={handleCreateFollowUp}
                loading={followUpLoading}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Skapa följeärende
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
