// src/components/coordinator/EditContractCaseModal.tsx
// Enhanced modal för avtalsärenden med offert, rapport och tidloggning

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { 
  X, User, Phone, Mail, MapPin, Calendar, AlertCircle, Save, 
  Clock, FileText, Users, Crown, Star, Play, Pause, RotateCcw,
  FileSignature, ChevronDown, Download, Send, ChevronRight, DollarSign, Lightbulb,
  Building, Building2
} from 'lucide-react'
import Button from '../ui/Button'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { PEST_TYPES } from '../../utils/clickupFieldMapper'
import { DROPDOWN_STATUSES } from '../../types/database'
import TechnicianDropdown from '../admin/TechnicianDropdown'
import WorkReportDropdown from '../shared/WorkReportDropdown'
import { useWorkReportGeneration } from '../../hooks/useWorkReportGeneration'
import { toSwedishISOString } from '../../utils/dateHelpers'

// Registrera svensk lokalisering för DatePicker
registerLocale('sv', sv)

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
    customer_id: null as string | null,  // Koppling till avtalskund
    
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
    reports: [] as any[],
    
    // 🚦 Traffic Light System
    pest_level: undefined as number | undefined,  // 0-3
    problem_rating: undefined as number | undefined,  // 1-5
    
    // Completion tracking
    completed_date: null as string | null,
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
    canGenerateReport,
    hasTechnicianEmail,
    hasContactEmail,
    totalReports,
    hasRecentReport,
    currentReport,
    getTimeSinceReport
  } = useWorkReportGeneration(reportData)

  useEffect(() => {
    if (caseData && isOpen) {
      setFormData({
        case_number: caseData.case_number || '',
        title: caseData.title || '',
        description: caseData.description || '',
        status: caseData.status || 'Öppen',
        customer_id: caseData.customer_id || null,  // Inkludera customer_id
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
        reports: caseData.reports || [],
        // 🚦 Traffic Light System
        pest_level: caseData.pest_level !== null ? caseData.pest_level : undefined,
        problem_rating: caseData.problem_rating !== null ? caseData.problem_rating : undefined,
        // Completion tracking
        completed_date: caseData.completed_date || null,
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
      
      // Om det är en multisite-enhet utan eget org.nr, hämta från huvudkunden
      let finalCustomerData = data
      if (data && data.is_multisite && data.parent_customer_id && !data.organization_number) {
        // Hämta huvudkundens data för organisationsnummer
        const { data: parentData, error: parentError } = await supabase
          .from('customers')
          .select('organization_number, company_name')
          .eq('id', data.parent_customer_id)
          .single()
        
        if (!parentError && parentData) {
          // Använd huvudkundens org.nr om enheten inte har eget
          finalCustomerData = {
            ...data,
            organization_number: data.organization_number || parentData.organization_number,
            parent_organization_number: parentData.organization_number,
            parent_company_name: parentData.company_name
          }
        }
      }
      
      setCustomerData(finalCustomerData)
      
      // Update form with customer data if needed
      if (finalCustomerData) {
        setFormData(prev => ({
          ...prev,
          contact_person: prev.contact_person || finalCustomerData.contact_person || '',
          contact_email: prev.contact_email || finalCustomerData.contact_email || '',
          contact_phone: prev.contact_phone || finalCustomerData.contact_phone || '',
          address: prev.address || finalCustomerData.contact_address || ''
        }))
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    }
  }

  const handleDateChange = (date: Date | null, fieldName: 'scheduled_start' | 'scheduled_end') => {
    setFormData(prev => ({ 
      ...prev, 
      [fieldName]: date 
    }))
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
    // Don't reset sessionMinutes - keep counting from where we left off
    // setSessionMinutes(0) - REMOVED to allow resuming
    
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
    
    const message = formData.time_spent_minutes > 0 ? 'Tidtagning återupptagen' : 'Tidtagning startad'
    toast.success(message)
  }

  const handleStopTimer = async () => {
    setIsTimerRunning(false)
    const totalMinutes = formData.time_spent_minutes + sessionMinutes
    setFormData(prev => ({ 
      ...prev, 
      time_spent_minutes: totalMinutes,
      work_started_at: null 
    }))
    setSessionMinutes(0) // Reset session since we've saved the total
    
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
    
    toast.success(`Tidtagning pausad. Total tid: ${formatTime(totalMinutes)}`)
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
    const email = formData.contact_email || customerData?.contact_email || ''
    const phone = formData.contact_phone || customerData?.contact_phone || ''
    const address = formData.address || customerData?.contact_address || ''
    
    // För multisite, hantera företagsnamn och organisationsnummer korrekt
    let companyName = customerData?.company_name || formData.contact_person || ''
    let orgNumber = customerData?.organization_number || ''
    
    if (customerData?.is_multisite) {
      // Visa alltid enhetsnamn tillsammans med företagsnamn för multisite
      if (customerData?.site_name) {
        companyName = customerData.company_name.includes(customerData.site_name) 
          ? customerData.company_name 
          : `${customerData.company_name} - ${customerData.site_name}`
      }
      
      // Använd organisationsnummer (antingen enhetens eget eller huvudkundens)
      // Detta är redan hanterat i fetchCustomerData
      orgNumber = customerData?.organization_number || ''
      
      // Lägg till debug-loggning för multisite
      console.log('Multisite customer data:', {
        site_name: customerData.site_name,
        company_name: customerData.company_name,
        organization_number: customerData.organization_number,
        parent_organization_number: customerData.parent_organization_number,
        is_multisite: customerData.is_multisite
      })
    }
    
    return {
      Kontaktperson: contactPerson,
      'e-post-kontaktperson': email,
      'telefonnummer-kontaktperson': phone,
      'utforande-adress': address,
      foretag: companyName,
      'org-nr': orgNumber,
      partyType: orgNumber ? 'company' : 'individual',
      // Lägg till extra metadata för Oneflow
      is_multisite: customerData?.is_multisite || false,
      site_name: customerData?.site_name || '',
      parent_company: customerData?.parent_company_name || ''
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
      pestType: formData.pest_type,
      // Add case_id for webhook linking
      case_id: caseData?.id
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
        scheduled_start: formData.scheduled_start ? toSwedishISOString(formData.scheduled_start) : null,
        scheduled_end: formData.scheduled_end ? toSwedishISOString(formData.scheduled_end) : null,
        // 🚦 Traffic Light System
        pest_level: formData.pest_level !== undefined ? formData.pest_level : null,
        problem_rating: formData.problem_rating !== undefined ? formData.problem_rating : null,
        assessment_date: (formData.pest_level !== undefined || formData.problem_rating !== undefined) 
          ? new Date().toISOString() : null,
        assessed_by: (formData.pest_level !== undefined || formData.problem_rating !== undefined)
          ? profile?.email || null : null,
        // Automatically set completed_date when status changes to "Avslutat"
        completed_date: (formData.status === 'Avslutat' && caseData.status !== 'Avslutat')
          ? toSwedishISOString(new Date())
          : (formData.status !== 'Avslutat' ? null : caseData.completed_date || null)
      }

      // Remove fields that don't exist in database
      delete cleanedFormData.reports

      // Försök hitta och koppla customer_id om den saknas
      let customerId = formData.customer_id
      if (!customerId && formData.contact_email) {
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('contact_email', formData.contact_email)
          .single()
        
        if (customer) {
          customerId = customer.id
        }
      }

      const { error } = await supabase
        .from('cases')
        .update({
          ...cleanedFormData,
          customer_id: customerId || null
        })
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

  // Fix React-DatePicker z-index conflicts
  useEffect(() => {
    if (isOpen && caseData) {
      const portalStyles = document.createElement('style')
      portalStyles.id = 'edit-contract-case-modal-portal-styles'
      portalStyles.textContent = `
        .react-datepicker-popper {
          z-index: 10000 !important;
        }
        .react-datepicker {
          z-index: 10000 !important;
          position: fixed !important;
          display: flex !important;
        }
        .react-datepicker__portal {
          z-index: 10000 !important;
        }
        .react-datepicker__time-container {
          float: right !important;
          border-left: 1px solid #334155 !important;
          width: auto !important;
        }
        .react-datepicker__time-container--with-today-button {
          float: right !important;
        }
        .react-datepicker__time {
          background: #1e293b !important;
        }
        .react-datepicker__time-list-item--selected {
          background: #3b82f6 !important;
        }
      `
      document.head.appendChild(portalStyles)
      
      return () => {
        const existingStyles = document.getElementById('edit-contract-case-modal-portal-styles')
        if (existingStyles && document.head.contains(existingStyles)) {
          document.head.removeChild(existingStyles)
        }
      }
    }
  }, [isOpen, caseData])

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

      {/* DatePicker Portal Container */}
      <div id="datepicker-portal" className="fixed z-[10000]" />

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
                    disabled={!canGenerateReport || isGenerating}
                    technicianName={formData.primary_technician_name}
                    contactName={formData.contact_person}
                    totalReports={totalReports}
                    hasRecentReport={hasRecentReport}
                    currentReport={currentReport}
                    getTimeSinceReport={getTimeSinceReport}
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
              {/* Customer information - visa för avtalskunder */}
              {customerData && (
                <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-xl p-6 border border-purple-500/30 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-purple-400" />
                    Kundinformation
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-1">Företag</label>
                      <p className="text-white font-medium">
                        {customerData.is_multisite && customerData.site_name 
                          ? `${customerData.company_name}${customerData.company_name.includes(customerData.site_name) ? '' : ` - ${customerData.site_name}`}`
                          : customerData.company_name}
                      </p>
                      {customerData.is_multisite && customerData.parent_company_name && (
                        <p className="text-xs text-purple-300 mt-1">Del av: {customerData.parent_company_name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-300 mb-1">Organisationsnummer</label>
                      <p className="text-white font-medium">
                        {customerData.organization_number || 'Ej angivet'}
                      </p>
                      {customerData.is_multisite && !customerData.organization_number && customerData.parent_organization_number && (
                        <p className="text-xs text-purple-300 mt-1">Använder huvudorganisationens nr</p>
                      )}
                    </div>
                  </div>
                  {customerData.is_multisite && (
                    <div className="mt-3 pt-3 border-t border-purple-500/20">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                        <Building2 className="w-3 h-3" />
                        Multisite-organisation
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Schemaläggning */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Schemaläggning - Ankomsttid
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Tekniker anländer till kunden inom detta tidsintervall
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Från tid
                    </label>
                    <DatePicker
                      selected={formData.scheduled_start}
                      onChange={(date) => handleDateChange(date, 'scheduled_start')}
                      locale="sv"
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy-MM-dd HH:mm"
                      timeCaption="Tid"
                      placeholderText="Välj från-tid..."
                      isClearable
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-200"
                      calendarClassName="bg-slate-900"
                      wrapperClassName="w-full"
                      portalId="datepicker-portal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Till tid
                    </label>
                    <DatePicker
                      selected={formData.scheduled_end}
                      onChange={(date) => handleDateChange(date, 'scheduled_end')}
                      locale="sv"
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy-MM-dd HH:mm"
                      timeCaption="Tid"
                      placeholderText="Välj till-tid..."
                      isClearable
                      minDate={formData.scheduled_start || undefined}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-200"
                      calendarClassName="bg-slate-900"
                      wrapperClassName="w-full"
                      portalId="datepicker-portal"
                    />
                  </div>
                </div>
                {formData.scheduled_start && formData.scheduled_end && (
                  <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-300">
                      <Clock className="inline w-4 h-4 mr-1" />
                      Tekniker anländer: {formData.scheduled_start.toLocaleDateString('sv-SE')} mellan {formData.scheduled_start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - {formData.scheduled_end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>

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

              {/* 🚦 Professional Assessment & Recommendations - Only for contract customers */}
              {caseData.customer_id && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg">
                      <span className="text-2xl">🚦</span>
                    </div>
                    <div>
                      <span className="text-white">Professionell Bedömning & Rekommendationer</span>
                      <p className="text-sm text-slate-400 font-normal">Trafikljusstatus med åtgärdsförslag</p>
                    </div>
                  </h3>

                  {!isCustomerView ? (
                    <>  
                      {/* Assessment Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Pest Level Assessment */}
                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                          <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                            Skadedjursnivå (0-3)
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { value: 0, label: "Ingen", color: "bg-gray-500", emoji: "✅", desc: "Ingen förekomst" },
                              { value: 1, label: "Låg", color: "bg-green-500", emoji: "🟢", desc: "Minimal aktivitet" },
                              { value: 2, label: "Måttlig", color: "bg-yellow-500", emoji: "🟡", desc: "Synlig förekomst" },
                              { value: 3, label: "Hög", color: "bg-red-500", emoji: "🔴", desc: "Infestation" }
                            ].map(level => (
                              <button
                                key={level.value}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, pest_level: level.value }))}
                                className={`relative p-3 rounded-lg transition-all transform hover:scale-[1.02] ${
                                  formData.pest_level === level.value 
                                    ? `${level.color} text-white shadow-lg ring-2 ring-white/50 scale-[1.02]` 
                                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                                }`}
                              >
                                <div className="text-xl mb-1">{level.emoji}</div>
                                <div className="font-bold text-lg">{level.value}</div>
                                <div className="text-xs leading-tight">{level.label}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Problem Rating Assessment */}
                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                          <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                            Övergripande problembild (1-5)
                          </label>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[
                              { value: 1, label: "Utmärkt", color: "bg-green-600", desc: "Inga problem" },
                              { value: 2, label: "Bra", color: "bg-green-500", desc: "Under kontroll" },
                              { value: 3, label: "OK", color: "bg-yellow-500", desc: "Kräver övervakning" },
                              { value: 4, label: "Allvarligt", color: "bg-orange-500", desc: "Åtgärd krävs" },
                              { value: 5, label: "Kritiskt", color: "bg-red-500", desc: "Brådskande åtgärd" }
                            ].map(rating => (
                              <button
                                key={rating.value}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, problem_rating: rating.value }))}
                                className={`relative p-2.5 rounded-lg transition-all transform hover:scale-[1.02] ${
                                  formData.problem_rating === rating.value 
                                    ? `${rating.color} text-white shadow-lg ring-2 ring-white/50 scale-[1.02]` 
                                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                                }`}
                              >
                                <div className="font-bold text-lg mb-1">{rating.value}</div>
                                <div className="text-xs leading-tight">{rating.label}</div>
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            1-2: Inga åtgärder • 3: Övervakning • 4-5: Kundengagemang krävs
                          </p>
                        </div>
                      </div>

                      {/* Dynamic Assessment Status */}
                      {(formData.pest_level !== undefined || formData.problem_rating !== undefined) && (
                        <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-sm font-medium text-slate-400 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                              Automatisk statusbedömning:
                            </span>
                            <div className={`flex items-center gap-3 px-4 py-2 rounded-full text-sm font-bold ${
                              (formData.problem_rating >= 4 || formData.pest_level >= 3) 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                                : (formData.problem_rating === 3 || formData.pest_level === 2)
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                : 'bg-green-500/20 text-green-400 border border-green-500/50'
                            }`}>
                              <span className="text-xl">
                                {(formData.problem_rating >= 4 || formData.pest_level >= 3) ? '🔴' 
                                  : (formData.problem_rating === 3 || formData.pest_level === 2) ? '🟡' : '🟢'}
                              </span>
                              <span>
                                {(formData.problem_rating >= 4 || formData.pest_level >= 3) 
                                  ? 'KRITISK - Omedelbar åtgärd' 
                                  : (formData.problem_rating === 3 || formData.pest_level === 2)
                                  ? 'VARNING - Övervakning krävs'
                                  : 'OK - Kontrollerad situation'}
                              </span>
                            </div>
                          </div>
                          {(formData.problem_rating >= 4 || formData.pest_level >= 3) && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <p className="text-sm text-red-400 flex items-start gap-2">
                                <span className="text-base mt-0.5">⚠️</span>
                                <span>Denna bedömning indikerar att kundens aktiva engagemang krävs för att lösa problemet effektivt.</span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Context-Aware Quick Recommendations */}
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          Kontextanpassade rekommendationer
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {/* Context-aware recommendations based on assessment */}
                          {(formData.problem_rating >= 4 || formData.pest_level >= 3) ? (
                            // Critical status recommendations
                            <>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🔴 AKUT: Omedelbar åtgärd krävs - kontakta oss inom 24h vid förvärring.'
                                }))}
                                className="px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-300 hover:text-red-200 transition-colors"
                              >
                                🚨 Akut åtgärd
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '📋 Kunden måste implementera föreslagna åtgärder omedelbart för att förhindra spridning.'
                                }))}
                                className="px-3 py-2 text-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-300 hover:text-orange-200 transition-colors"
                              >
                                📋 Kundåtgärd
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🔄 Daglig uppföljning rekommenderas tills situationen är under kontroll.'
                                }))}
                                className="px-3 py-2 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-lg text-yellow-300 hover:text-yellow-200 transition-colors"
                              >
                                🔄 Daglig kontroll
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🛡️ Förstärkt skyddsplan krävs - vi föreslår omfattande åtgärdsprogram.'
                                }))}
                                className="px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-300 hover:text-purple-200 transition-colors"
                              >
                                🛡️ Förstärkt skydd
                              </button>
                            </>
                          ) : (formData.problem_rating === 3 || formData.pest_level === 2) ? (
                            // Warning status recommendations
                            <>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🟡 ÖVERVAKNING: Situation kräver regelbunden uppföljning inom 1-2 veckor.'
                                }))}
                                className="px-3 py-2 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-lg text-yellow-300 hover:text-yellow-200 transition-colors"
                              >
                                🔍 Övervakning
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '📅 Uppföljningsbesök rekommenderas inom 2-4 veckor för kontroll.'
                                }))}
                                className="px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-300 hover:text-blue-200 transition-colors"
                              >
                                📅 Uppföljning
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🔧 Förebyggande åtgärder rekommenderas för att undvika framtida problem.'
                                }))}
                                className="px-3 py-2 text-sm bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-300 hover:text-green-200 transition-colors"
                              >
                                🔧 Förebyggande
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '📋 Kunden bör vara uppmärksam på tidiga varningstecken och rapportera förändringar.'
                                }))}
                                className="px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-300 hover:text-purple-200 transition-colors"
                              >
                                👁️ Tidig upptäckt
                              </button>
                            </>
                          ) : (
                            // Good status recommendations
                            <>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🟢 UTMÄRKT: Situationen är under kontroll - fortsätt med befintligt underhåll.'
                                }))}
                                className="px-3 py-2 text-sm bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-300 hover:text-green-200 transition-colors"
                              >
                                ✅ Bibehåll status
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🛡️ Regelbundet underhåll krävs för att bibehålla den höga skyddsnivån.'
                                }))}
                                className="px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-300 hover:text-blue-200 transition-colors"
                              >
                                🛡️ Rutinunderhåll
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '📊 Rekommenderar säsongsbaserad kontroll för att upprätthålla skyddet.'
                                }))}
                                className="px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-300 hover:text-purple-200 transition-colors"
                              >
                                📊 Säsongskontroll
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  recommendations: (prev.recommendations ? prev.recommendations + '\n\n' : '') + 
                                    '🎯 Befintligt skyddsystem fungerar optimalt - inga ytterligare åtgärder just nu.'
                                }))}
                                className="px-3 py-2 text-sm bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-300 hover:text-amber-200 transition-colors"
                              >
                                🎯 Optimal status
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Professional Recommendations Text Area */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                          Detaljerade rekommendationer till kund
                        </label>
                        <textarea
                          value={formData.recommendations}
                          onChange={(e) => setFormData(prev => ({ ...prev, recommendations: e.target.value }))}
                          rows={5}
                          placeholder="Beskriv detaljerade, professionella rekommendationer baserat på bedömningen..."
                          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-slate-500">
                            Rekommendationerna baseras på trafikljusstatus och visas för kunden som professionella åtgärdsförslag
                          </p>
                          {formData.recommendations && formData.recommendations.length > 200 && (
                            <p className="text-xs text-slate-400">
                              {formData.recommendations.length} tecken
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    // Customer View - Read-only display of assessment and recommendations
                    <div className="space-y-6">
                      {/* Assessment Results Display */}
                      {(formData.pest_level !== undefined || formData.problem_rating !== undefined) && (
                        <div className="bg-gradient-to-r from-slate-800/30 to-slate-900/30 border border-slate-700/50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                            Professionell bedömning av er situation
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {formData.pest_level !== undefined && (
                              <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg">
                                <div className="text-2xl">
                                  {formData.pest_level === 0 ? '✅' : 
                                   formData.pest_level === 1 ? '🟢' : 
                                   formData.pest_level === 2 ? '🟡' : '🔴'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-300">Skadedjursnivå</p>
                                  <p className="text-lg font-bold text-white">
                                    {formData.pest_level === 0 ? 'Ingen förekomst' : 
                                     formData.pest_level === 1 ? 'Låg nivå' : 
                                     formData.pest_level === 2 ? 'Måttlig nivå' : 'Hög nivå/Infestation'}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {formData.problem_rating !== undefined && (
                              <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg">
                                <div className="text-2xl font-bold text-white">{formData.problem_rating}</div>
                                <div>
                                  <p className="text-sm font-medium text-slate-300">Övergripande status</p>
                                  <p className="text-lg font-bold text-white">
                                    {formData.problem_rating === 1 ? 'Utmärkt' :
                                     formData.problem_rating === 2 ? 'Bra' :
                                     formData.problem_rating === 3 ? 'Kräver uppmärksamhet' :
                                     formData.problem_rating === 4 ? 'Allvarligt' : 'Kritiskt'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Overall Status */}
                          <div className={`p-3 rounded-lg border ${
                            (formData.problem_rating >= 4 || formData.pest_level >= 3) 
                              ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                              : (formData.problem_rating === 3 || formData.pest_level === 2)
                              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                              : 'bg-green-500/10 border-green-500/30 text-green-400'
                          }`}>
                            <p className="font-semibold flex items-center gap-2">
                              <span className="text-xl">
                                {(formData.problem_rating >= 4 || formData.pest_level >= 3) ? '🔴' 
                                  : (formData.problem_rating === 3 || formData.pest_level === 2) ? '🟡' : '🟢'}
                              </span>
                              {(formData.problem_rating >= 4 || formData.pest_level >= 3) 
                                ? 'Kritisk situation - Åtgärd krävs omgående' 
                                : (formData.problem_rating === 3 || formData.pest_level === 2)
                                ? 'Varning - Övervakning krävs'
                                : 'OK - Situation under kontroll'}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Recommendations Display */}
                      {formData.recommendations && (
                        <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            Våra professionella rekommendationer för er
                          </h4>
                          <div className="prose prose-slate prose-sm max-w-none">
                            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                              {formData.recommendations}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {(!formData.pest_level && !formData.problem_rating && !formData.recommendations) && (
                        <div className="text-center py-8">
                          <div className="text-slate-500 mb-2">
                            <span className="text-4xl">📋</span>
                          </div>
                          <p className="text-slate-400">Bedömning och rekommendationer kommer att visas här när tekniker har genomfört inspektionen.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                        {formatTime(formData.time_spent_minutes + sessionMinutes)}
                      </div>
                      <div className="text-sm text-slate-400">
                        {isTimerRunning ? (
                          <span className="text-green-400 flex items-center justify-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Startad kl. {new Date(formData.work_started_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : formData.time_spent_minutes > 0 ? 'Pausad' : 'Ej påbörjad'}
                      </div>
                      {isTimerRunning && sessionMinutes > 0 && (
                        <div className="text-xs text-slate-500 mt-2">
                          Denna session: {formatTime(sessionMinutes)}
                        </div>
                      )}
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