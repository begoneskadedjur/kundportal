// src/components/coordinator/EditContractCaseModal.tsx
// Enhanced modal för avtalsärenden med offert, rapport och tidloggning

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  X, User, Phone, Mail, MapPin, Calendar, AlertCircle, Save, 
  Clock, FileText, Users, Crown, Star, Play, Pause, RotateCcw,
  FileSignature, ChevronDown, Download, Send
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
  const [loading, setLoading] = useState(false)
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
      if (caseData.work_started_at && !caseData.work_ended_at) {
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

  const handleTechnicianChange = (role: 'primary' | 'secondary' | 'tertiary', technicianId: string) => {
    const technician = technicians.find(t => t.id === technicianId)
    
    setFormData(prev => ({
      ...prev,
      [`${role}_technician_id`]: technicianId,
      [`${role}_technician_name`]: technician?.name || ''
    }))
  }

  // Timer functions
  const handleStartTimer = () => {
    const now = new Date().toISOString()
    setFormData(prev => ({ ...prev, work_started_at: now }))
    setIsTimerRunning(true)
    setSessionMinutes(0)
    toast.success('Tidtagning startad')
  }

  const handleStopTimer = () => {
    setIsTimerRunning(false)
    const totalMinutes = formData.time_spent_minutes + sessionMinutes
    setFormData(prev => ({ 
      ...prev, 
      time_spent_minutes: totalMinutes,
      work_started_at: null 
    }))
    setSessionMinutes(0)
    toast.success(`Tidtagning stoppad. Total tid: ${totalMinutes} minuter`)
  }

  const handleResetTimer = () => {
    setIsTimerRunning(false)
    setSessionMinutes(0)
    setFormData(prev => ({ 
      ...prev, 
      work_started_at: null,
      time_spent_minutes: 0
    }))
    toast.success('Tidtagning återställd')
  }

  // Quote generation
  const handleGenerateQuote = async () => {
    try {
      setLoading(true)
      // Here you would integrate with your quote generation system
      // For now, we'll just mark that a quote was generated
      const now = new Date().toISOString()
      setFormData(prev => ({ ...prev, quote_generated_at: now }))
      
      toast.success('Offert genererad!')
      setShowQuoteDropdown(false)
      
      // Save the update to database
      if (caseData?.id) {
        await supabase
          .from('cases')
          .update({ quote_generated_at: now })
          .eq('id', caseData.id)
      }
    } catch (error) {
      console.error('Error generating quote:', error)
      toast.error('Kunde inte generera offert')
    } finally {
      setLoading(false)
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
      onClose()
    } catch (error) {
      console.error('Error updating case:', error)
      toast.error('Kunde inte uppdatera ärendet')
    } finally {
      setLoading(false)
    }
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
        onClick={onClose}
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
                  {/* Timer */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-white">
                      {isTimerRunning ? formatTime(sessionMinutes) : formatTime(formData.time_spent_minutes)}
                    </span>
                    {!isTimerRunning ? (
                      <button
                        onClick={handleStartTimer}
                        className="p-1 hover:bg-green-500/20 rounded text-green-400 transition-colors"
                        title="Starta tidtagning"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleStopTimer}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                        title="Stoppa tidtagning"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={handleResetTimer}
                      className="p-1 hover:bg-slate-500/20 rounded text-slate-400 transition-colors"
                      title="Återställ tid"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>

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
                      <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                        <button
                          onClick={handleGenerateQuote}
                          className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <FileSignature className="w-4 h-4" />
                          Generera offert
                        </button>
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                          onClick={() => {
                            toast.info('Skicka offert-funktion kommer snart')
                            setShowQuoteDropdown(false)
                          }}
                        >
                          <Send className="w-4 h-4" />
                          Skicka offert
                        </button>
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
                    onClick={onClose}
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

              {/* Cost summary */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-purple-400" />
                  Kostnad och material
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total tid (minuter)
                    </label>
                    <input
                      type="number"
                      value={formData.time_spent_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, time_spent_minutes: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isCustomerView}
                    />
                  </div>
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
                onClick={onClose}
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