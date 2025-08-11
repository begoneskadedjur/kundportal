// src/components/coordinator/EditContractCaseModal.tsx
// Enhanced modal för avtalsärenden med offert, rapport och tidloggning

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { 
  X, User, Phone, Mail, MapPin, Calendar, AlertCircle, Save, 
  Clock, FileText, Users, Crown, Star, Play, Pause, RotateCcw,
  FileSignature, ChevronDown, Download, Send, ChevronRight, DollarSign
} from 'lucide-react'
import Button from '../ui/Button'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { PEST_TYPES } from '../../utils/clickupFieldMapper'
import { DROPDOWN_STATUSES } from '../../types/database'
import TechnicianDropdown from '../admin/TechnicianDropdown'
import WorkReportDropdown from '../shared/WorkReportDropdown'
import { useWorkReportGeneration } from '../../hooks/useWorkReportGeneration'

interface EditContractCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  caseData: any
  isCustomerView?: boolean
}

// Generate BE-number for contract cases
const generateBENumber = async (): Promise<string> => {
  try {
    // Get the latest BE number
    const { data, error } = await supabase
      .from('cases')
      .select('case_number')
      .like('case_number', 'BE-%')
      .order('case_number', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error
    }

    let nextNumber = 1001 // Start from BE-1001
    
    if (data?.case_number) {
      const currentNumber = parseInt(data.case_number.replace('BE-', ''), 10)
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1
      }
    }

    return `BE-${nextNumber}`
  } catch (error) {
    console.error('Error generating BE number:', error)
    // Fallback to timestamp-based number
    return `BE-${Date.now().toString().slice(-6)}`
  }
}

export default function EditContractCaseModal({
  isOpen,
  onClose,
  onSuccess,
  caseData,
  isCustomerView = false
}: EditContractCaseModalProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [customerData, setCustomerData] = useState<any>(null)
  const [formData, setFormData] = useState({
    // Grundläggande information
    case_number: '',
    title: '',
    description: '',
    status: 'Öppen',
    
    // Kontaktperson
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    alternative_contact_person: '',
    alternative_contact_phone: '',
    alternative_contact_email: '',
    
    // Adress och skadedjur
    address: '',
    pest_type: '',
    other_pest_type: '',
    
    // Schemaläggning
    scheduled_start: null as Date | null,
    scheduled_end: null as Date | null,
    
    // Tekniker (upp till 3)
    primary_technician_id: '',
    primary_technician_name: '',
    secondary_technician_id: '',
    secondary_technician_name: '',
    tertiary_technician_id: '',
    tertiary_technician_name: '',
    
    // Arbetsrapport och rekommendationer
    work_report: '',
    recommendations: '',
    
    // Tid, material och pris
    time_spent_minutes: 0,
    materials_used: '',
    material_cost: 0,
    price: 0,
    
    // Nya fält för tidloggning
    work_started_at: null as string | null,
    
    // Rapporter och offerter
    quote_generated_at: null as string | null,
    report_generated_at: null as string | null,
    reports: [] as any[]
  })

  const [technicians, setTechnicians] = useState<any[]>([])
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [sessionMinutes, setSessionMinutes] = useState(0)
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [showQuoteDropdown, setShowQuoteDropdown] = useState(false)
  const [showReportDropdown, setShowReportDropdown] = useState(false)

  // Hook för rapport-generering
  const reportData = {
    ...caseData,
    case_type: 'contract' as const,
    rapport: formData.work_report,
    kontaktperson: formData.contact_person,
    telefon_kontaktperson: formData.contact_phone,
    e_post_kontaktperson: formData.contact_email,
    skadedjur: formData.pest_type,
    adress: formData.address,
    case_price: formData.price,
    primary_assignee_name: formData.primary_technician_name
  }
  
  const {
    downloadReport,
    sendToTechnician,
    sendToContact,
    isGenerating,
    hasTechnicianEmail,
    hasContactEmail
  } = useWorkReportGeneration(reportData)

  useEffect(() => {
    if (caseData && isOpen) {
      setFormData({
        case_number: caseData.case_number || '',
        title: caseData.title || '',
        description: caseData.description || '',
        status: caseData.status || 'Öppen',
        contact_person: caseData.contact_person || caseData.kontaktperson || '',
        contact_phone: caseData.contact_phone || caseData.telefon_kontaktperson || '',
        contact_email: caseData.contact_email || caseData.email || '',
        alternative_contact_person: caseData.alternative_contact_person || '',
        alternative_contact_phone: caseData.alternative_contact_phone || '',
        alternative_contact_email: caseData.alternative_contact_email || '',
        address: caseData.address?.formatted_address || caseData.address || caseData.adress || '',
        pest_type: caseData.pest_type || caseData.skadedjur || '',
        other_pest_type: caseData.other_pest_type || caseData.annat_skadedjur || '',
        scheduled_start: caseData.scheduled_start ? new Date(caseData.scheduled_start) : null,
        scheduled_end: caseData.scheduled_end ? new Date(caseData.scheduled_end) : null,
        primary_technician_id: caseData.primary_technician_id || '',
        primary_technician_name: caseData.primary_technician_name || '',
        secondary_technician_id: caseData.secondary_technician_id || '',
        secondary_technician_name: caseData.secondary_technician_name || '',
        tertiary_technician_id: caseData.tertiary_technician_id || '',
        tertiary_technician_name: caseData.tertiary_technician_name || '',
        work_report: caseData.work_report || caseData.rapport || '',
        recommendations: caseData.recommendations || '',
        time_spent_minutes: caseData.time_spent_minutes || 0,
        materials_used: caseData.materials_used || '',
        material_cost: caseData.material_cost || 0,
        price: caseData.price || 0,
        work_started_at: caseData.work_started_at || null,
        quote_generated_at: caseData.quote_generated_at || null,
        report_generated_at: caseData.report_generated_at || null,
        reports: caseData.reports || []
      })
      
      // Check if timer was running
      if (caseData.work_started_at) {
        setIsTimerRunning(true)
        const startTime = new Date(caseData.work_started_at).getTime()
        const now = Date.now()
        const elapsed = Math.floor((now - startTime) / 60000)
        setSessionMinutes(elapsed)
      }
    }
  }, [caseData, isOpen])

  useEffect(() => {
    fetchTechnicians()
    
    // Generate BE number if not present
    if (isOpen && caseData && !caseData.case_number) {
      generateBENumber().then(number => {
        setFormData(prev => ({ ...prev, case_number: number }))
      })
    }
    
    // Fetch customer data if customer_id exists
    if (isOpen && caseData?.customer_id) {
      fetchCustomerData(caseData.customer_id)
    }
  }, [isOpen, caseData])

  useEffect(() => {
    // Timer logic
    if (isTimerRunning && formData.work_started_at) {
      const interval = setInterval(() => {
        const startTime = new Date(formData.work_started_at!).getTime()
        const now = Date.now()
        const elapsed = Math.floor((now - startTime) / 60000)
        setSessionMinutes(elapsed)
      }, 1000)
      
      setTimerInterval(interval)
      
      return () => {
        if (interval) clearInterval(interval)
      }
    } else if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
  }, [isTimerRunning, formData.work_started_at])

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setTechnicians(data || [])
    } catch (error) {
      console.error('Error fetching technicians:', error)
    }
  }
  
  const fetchCustomerData = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()
      
      if (error) throw error
      setCustomerData(data)
      
      // Update form with customer data if needed
      if (data) {
        setFormData(prev => ({
          ...prev,
          contact_person: prev.contact_person || data.contact_person || '',
          contact_email: prev.contact_email || data.email || '',
          contact_phone: prev.contact_phone || data.phone || '',
          address: prev.address || data.service_address || ''
        }))
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    }
  }

  const handleTechnicianChange = (role: 'primary' | 'secondary' | 'tertiary', technicianId: string) => {
    const technician = technicians.find(t => t.id === technicianId)
    
    setFormData(prev => ({
      ...prev,
      [`${role}_technician_id`]: technicianId,
      [`${role}_technician_name`]: technician?.name || ''
    }))
  }

  // Timer functions
  const handleStartTimer = async () => {
    const now = new Date().toISOString()
    setFormData(prev => ({ ...prev, work_started_at: now }))
    setIsTimerRunning(true)
    setSessionMinutes(0)
    
    // Save to database immediately
    if (caseData?.id) {
      try {
        await supabase
          .from('cases')
          .update({ work_started_at: now })
          .eq('id', caseData.id)
      } catch (error) {
        console.error('Error starting timer:', error)
      }
    }
    
    toast.success('Tidtagning startad')
  }

  const handleStopTimer = async () => {
    setIsTimerRunning(false)
    const totalMinutes = formData.time_spent_minutes + sessionMinutes
    setFormData(prev => ({ 
      ...prev, 
      time_spent_minutes: totalMinutes,
      work_started_at: null 
    }))
    setSessionMinutes(0)
    
    // Save to database immediately
    if (caseData?.id) {
      try {
        await supabase
          .from('cases')
          .update({ 
            time_spent_minutes: totalMinutes,
            work_started_at: null 
          })
          .eq('id', caseData.id)
      } catch (error) {
        console.error('Error saving time:', error)
      }
    }
    
    toast.success(`Tidtagning stoppad. Total tid: ${totalMinutes} minuter`)
  }

  const handleResetTimer = async () => {
    setIsTimerRunning(false)
    setSessionMinutes(0)
    setFormData(prev => ({ 
      ...prev, 
      work_started_at: null,
      time_spent_minutes: 0
    }))
    
    // Save to database immediately
    if (caseData?.id) {
      try {
        await supabase
          .from('cases')
          .update({ 
            time_spent_minutes: 0,
            work_started_at: null 
          })
          .eq('id', caseData.id)
      } catch (error) {
        console.error('Error resetting time:', error)
      }
    }
    
    toast.success('Tidtagning återställd')
  }

  // Get Oneflow route based on user role
  const getOneflowRoute = useCallback(() => {
    const role = profile?.role || 'admin'
    switch (role) {
      case 'koordinator':
        return '/koordinator/oneflow-contract-creator'
      case 'technician':
        return '/technician/oneflow-contract-creator'
      default:
        return '/admin/oneflow-contract-creator'
    }
  }, [profile?.role])
  
  // Prepare customer data for Oneflow
  const prepareCustomerDataForOneflow = useCallback(() => {
    if (!customerData && !formData.contact_person) {
      toast.error('Kundinformation saknas')
      return null
    }
    
    // Use customer data if available, otherwise use form data
    const contactPerson = formData.contact_person || customerData?.contact_person || ''
    const email = formData.contact_email || customerData?.email || ''
    const phone = formData.contact_phone || customerData?.phone || ''
    const address = formData.address || customerData?.service_address || ''
    const companyName = customerData?.company_name || formData.contact_person || ''
    const orgNumber = customerData?.organization_number || ''
    
    return {
      Kontaktperson: contactPerson,
      'e-post-kontaktperson': email,
      'telefonnummer-kontaktperson': phone,
      'utforande-adress': address,
      foretag: companyName,
      'org-nr': orgNumber,
      partyType: orgNumber ? 'company' : 'individual'
    }
  }, [customerData, formData])
  
  // Quote generation via Oneflow
  const handleGenerateQuote = async () => {
    const oneflowData = prepareCustomerDataForOneflow()
    if (!oneflowData) return
    
    const prefillData = {
      ...oneflowData,
      documentType: 'offer',
      selectedTemplate: '8598798', // Template ID for "Offertförslag – Exkl Moms (Företag)"
      autoSelectTemplate: true, // Flag to trigger auto-selection and skip to step 6
      // Add technician info
      anstalld: formData.primary_technician_name || profile?.display_name || 'BeGone Medarbetare',
      'e-post-anstlld': profile?.email || '',
      // For offers, we still set these values (they won't be shown in UI but are needed for API compatibility)
      avtalslngd: '1',
      begynnelsedag: new Date().toISOString().split('T')[0],
      // Add case details for reference
      caseNumber: formData.case_number,
      caseTitle: formData.title,
      pestType: formData.pest_type
    }
    
    // Debug logging
    console.log('Sending prefill data to Oneflow:', prefillData)
    
    // Save customer data to sessionStorage for Oneflow
    sessionStorage.setItem('prefill_customer_data', JSON.stringify(prefillData))
    
    // Navigate to Oneflow contract creator
    const oneflowRoute = getOneflowRoute()
    navigate(`${oneflowRoute}?prefill=offer`)
    
    toast.success('Navigerar till offertskapning med kundinformation...')
    setShowQuoteDropdown(false)
    
    // Mark quote as generated
    const now = new Date().toISOString()
    if (caseData?.id) {
      await supabase
        .from('cases')
        .update({ quote_generated_at: now })
        .eq('id', caseData.id)
    }
  }

  const handleSubmit = async () => {
    if (!caseData?.id) return

    setLoading(true)
    try {
      // Clean form data
      const cleanedFormData = {
        ...formData,
        primary_technician_id: formData.primary_technician_id || null,
        secondary_technician_id: formData.secondary_technician_id || null,
        tertiary_technician_id: formData.tertiary_technician_id || null,
        primary_technician_name: formData.primary_technician_name || null,
        secondary_technician_name: formData.secondary_technician_name || null,
        tertiary_technician_name: formData.tertiary_technician_name || null,
        scheduled_start: formData.scheduled_start?.toISOString() || null,
        scheduled_end: formData.scheduled_end?.toISOString() || null,
      }

      // Remove fields that don't exist in database
      delete cleanedFormData.reports

      const { error } = await supabase
        .from('cases')
        .update(cleanedFormData)
        .eq('id', caseData.id)

      if (error) throw error

      toast.success('Ärende uppdaterat!')
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error('Error updating case:', error)
      toast.error('Kunde inte uppdatera ärendet')
    } finally {
      setLoading(false)
    }
  }

  // Handle closing with timer running
  const handleClose = async () => {
    // If timer is running, save current progress
    if (isTimerRunning && caseData?.id) {
      const totalMinutes = formData.time_spent_minutes + sessionMinutes
      try {
        await supabase
          .from('cases')
          .update({ 
            time_spent_minutes: totalMinutes,
            // Keep work_started_at so timer can resume
          })
          .eq('id', caseData.id)
      } catch (error) {
        console.error('Error saving time on close:', error)
      }
    }
    onClose()
  }

  if (!isOpen) return null

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl">
        {/* Glass morphism background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-purple-500/5" />
        
        {/* Border glow */}
        <div className="absolute inset-0 rounded-2xl border border-purple-500/20" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full max-h-[90vh]">
          {/* Enhanced Header */}
          <div className="p-6 border-b border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Crown className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">
                      {isCustomerView ? 'Serviceärende' : 'Avtalsärende'}
                    </h2>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-medium">
                      {formData.case_number || 'Genererar...'}
                    </span>
                  </div>
                  <p className="text-sm text-purple-300">Premium kundsupport</p>
                </div>
              </div>
              
              {/* Action buttons */}
              {!isCustomerView && (
                <div className="flex items-center gap-2">
                  {/* Quote dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowQuoteDropdown(!showQuoteDropdown)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 transition-colors"
                    >
                      <FileSignature className="w-4 h-4" />
                      <span className="text-sm font-medium">Offert</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    
                    {showQuoteDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                        <button
                          onClick={handleGenerateQuote}
                          className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <DollarSign className="w-4 h-4" />
                          Skapa offert via Oneflow
                          <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                        </button>
                        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
                          Öppnar Oneflow med förifyllda kunduppgifter
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Report dropdown */}
                  <WorkReportDropdown
                    onDownload={downloadReport}
                    onSendToTechnician={sendToTechnician}
                    onSendToContact={sendToContact}
                    isGenerating={isGenerating}
                    hasTechnicianEmail={hasTechnicianEmail}
                    hasContactEmail={hasContactEmail}
                    technicianName={formData.primary_technician_name}
                    contactName={formData.contact_person}
                  />

                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Basic information */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Grundläggande information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Titel
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    >
                      {DROPDOWN_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Beskrivning
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                </div>
              </div>

              {/* Contact information */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Kontaktinformation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Kontaktperson
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      E-post
                    </label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                </div>
              </div>

              {/* Location and pest */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  Plats och skadedjur
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Adress
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Skadedjur
                    </label>
                    <select
                      value={formData.pest_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, pest_type: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    >
                      <option value="">Välj skadedjur</option>
                      {PEST_TYPES.map(pest => (
                        <option key={pest} value={pest}>{pest}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Technicians */}
              {!isCustomerView && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Tilldelade tekniker
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <TechnicianDropdown
                      label="Primär tekniker"
                      value={formData.primary_technician_id}
                      onChange={(id) => handleTechnicianChange('primary', id)}
                      technicians={technicians}
                      variant="primary"
                    />
                    <TechnicianDropdown
                      label="Sekundär tekniker"
                      value={formData.secondary_technician_id}
                      onChange={(id) => handleTechnicianChange('secondary', id)}
                      technicians={technicians}
                      variant="secondary"
                    />
                    <TechnicianDropdown
                      label="Tertiär tekniker"
                      value={formData.tertiary_technician_id}
                      onChange={(id) => handleTechnicianChange('tertiary', id)}
                      technicians={technicians}
                      variant="tertiary"
                    />
                  </div>
                </div>
              )}

              {/* Work report */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Arbetsrapport
                </h3>
                <textarea
                  value={formData.work_report}
                  onChange={(e) => setFormData(prev => ({ ...prev, work_report: e.target.value }))}
                  rows={6}
                  placeholder="Beskriv utfört arbete..."
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isCustomerView}
                />
              </div>

              {/* Time tracking */}
              {!isCustomerView && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-400" />
                    Tidtagning
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="text-center mb-4">
                      <div className={`text-3xl font-bold font-mono mb-2 ${isTimerRunning ? 'text-green-400' : 'text-white'}`}>
                        {isTimerRunning ? formatTime(sessionMinutes) : formatTime(formData.time_spent_minutes)}
                      </div>
                      <div className="text-sm text-slate-400">
                        {isTimerRunning ? (
                          <span className="text-green-400 flex items-center justify-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Startad kl. {new Date(formData.work_started_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : formData.time_spent_minutes > 0 ? 'Pausad' : 'Ej påbörjad'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {isTimerRunning ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleStopTimer}
                            className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-300 transition-colors flex items-center justify-center gap-2"
                          >
                            <Pause className="w-4 h-4" />
                            Pausa
                          </button>
                          <button
                            type="button"
                            onClick={handleStopTimer}
                            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-300 transition-colors flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Slutför
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartTimer}
                          className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-300 transition-colors flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          {formData.time_spent_minutes > 0 ? 'Återuppta Arbete' : 'Starta Arbetstid'}
                        </button>
                      )}
                      {formData.time_spent_minutes > 0 && !isTimerRunning && (
                        <button
                          type="button"
                          onClick={handleResetTimer}
                          className="w-full px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Nollställ arbetstid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cost summary */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-purple-400" />
                  Kostnad och material
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Materialkostnad (SEK)
                    </label>
                    <input
                      type="number"
                      value={formData.material_cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, material_cost: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Totalpris (SEK)
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-purple-500/20">
            <div className="flex justify-end gap-3">
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
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Spara ändringar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}