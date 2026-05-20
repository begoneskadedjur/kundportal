// src/components/customer/CaseDetailsModal.tsx - Med kunduppgifter för PDF
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  DollarSign,
  FileText,
  Images,
  AlertCircle,
  Bug,
  Download,
  Eye,
  Play,
  Mail,
  Phone,
  FileDown,
  Flag,
  Lightbulb,
  Package,
  Wrench,
  ClipboardCheck
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import CasePreparationsSection from '../shared/CasePreparationsSection'
import CustomerAssessmentPanel from './CustomerAssessmentPanel'
import CriticalAcknowledgmentBanner from './CriticalAcknowledgmentBanner'
import CloseWarningDialog from './CloseWarningDialog'
import RevisitHistorySection, { RevisitHistoryEntry } from '../shared/RevisitHistorySection'
import CaseJourneyTimeline from './CaseJourneyTimeline'
import TrafficLightBadge from '../organisation/TrafficLightBadge'
import { generatePDFReport } from '../../utils/pdfReportGenerator'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CaseImageService, CaseImageWithUrl } from '../../services/caseImageService'
import { useAcknowledgment } from '../../hooks/useAcknowledgment'
import { requiresAcknowledgment } from '../../types/acknowledgment'
import toast from 'react-hot-toast'

interface CaseDetailsModalProps {
  caseId: string
  clickupTaskId: string
  isOpen: boolean
  onClose: () => void
  // Fallback-data när clickupTaskId saknas
  fallbackData?: {
    case_number?: string
    title?: string
    pest_type?: string
    status?: string
    pest_level?: number | null
    problem_rating?: number | null
    price?: number | null
    completed_date?: string
    primary_technician_name?: string
    primary_technician_email?: string
    address?: { formatted_address?: string }
    location?: { lat: number; lng: number }
    description?: string
    recommendations?: string | null
    case_type?: 'private' | 'business' | 'contract'
    // Nya fält från cases-tabellen
    work_report?: string
    materials_used?: string
    time_spent_minutes?: number
    service_type?: string
    priority?: string
    work_started_at?: string
    // Filer/foton
    files?: Array<{
      name: string
      url: string
      type: string
      size: number
      uploaded_at: string
    }> | null
    // Trafikljus-metadata
    assessment_date?: string | null
    assessed_by?: string | null
    // Kontaktperson
    contact_person?: string
    contact_email?: string
    contact_phone?: string
    // Datum
    created_at?: string
    updated_at?: string
    start_date?: string      // Privat/företag: timestamptz med tid
    due_date?: string        // Privat/företag: timestamptz med tid
    scheduled_date?: string  // Avtalskunder: endast datum
  }
}

interface TaskDetails {
  success: boolean
  task_id: string
  task_info: {
    name: string
    status: string
    description: string
    url: string
    created: string
    updated: string
  }
  assignees: Array<{
    name: string
    email: string
  }>
  custom_fields: Array<{
    id: string
    name: string
    type: string
    value: any
    has_value: boolean
    type_config?: {
      options?: Array<{
        id: string
        name: string
        color: string
        orderindex: number
      }>
    }
  }>
  priority?: {
    priority: string
    color: string
  }
}

interface CustomerInfo {
  company_name: string
  org_number: string
  contact_person: string
}

export default function CaseDetailsModal({
  caseId,
  clickupTaskId,
  isOpen,
  onClose,
  fallbackData
}: CaseDetailsModalProps) {
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [caseImages, setCaseImages] = useState<CaseImageWithUrl[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [showCloseWarning, setShowCloseWarning] = useState(false)
  const [revisitHistory, setRevisitHistory] = useState<RevisitHistoryEntry[]>([])
  const [inspectionSession, setInspectionSession] = useState<{
    id: string
    status: string
    completed_at: string | null
    total_outdoor_stations: number
    total_indoor_stations: number
    inspected_outdoor_stations: number
    inspected_indoor_stations: number
    notes: string | null
    technician?: { name: string } | null
    activityCount?: number
  } | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const { profile } = useAuth()

  // Hook för läskvitton
  const {
    acknowledgment,
    loading: acknowledgmentLoading,
    hasAcknowledged,
    acknowledge
  } = useAcknowledgment({
    caseId: caseId,
    userId: profile?.id,
    userEmail: profile?.email,
    userName: profile?.display_name
  })

  // Avgör om ärende kräver bekräftelse
  const currentPestLevel = fallbackData?.pest_level ?? null
  const currentProblemRating = fallbackData?.problem_rating ?? null

  // Kontrollera om situationen har försämrats sedan senaste bekräftelsen
  const hasWorsenedSinceAcknowledgment = acknowledgment && (
    (currentPestLevel ?? 0) > (acknowledgment.pest_level_at_acknowledgment ?? 0) ||
    (currentProblemRating ?? 0) > (acknowledgment.problem_rating_at_acknowledgment ?? 0)
  )

  // Kräv ny bekräftelse om:
  // 1. Kritisk status OCH inte bekräftat
  // 2. Kritisk status OCH situationen har försämrats sedan senaste bekräftelsen
  const needsAcknowledgment = requiresAcknowledgment(currentPestLevel, currentProblemRating) &&
    (!hasAcknowledged || hasWorsenedSinceAcknowledgment)

  // Handle acknowledgment
  const handleAcknowledge = useCallback(async () => {
    try {
      await acknowledge(currentPestLevel, currentProblemRating)
      toast.success('Tack för din bekräftelse!')
    } catch (error) {
      console.error('Error acknowledging case:', error)
      toast.error('Kunde inte spara bekräftelse')
    }
  }, [acknowledge, currentPestLevel, currentProblemRating])

  // Handle close with soft block
  const handleClose = useCallback(() => {
    // Om det krävs bekräftelse och användaren inte har bekräftat, visa varning
    if (needsAcknowledgment && !hasAcknowledged) {
      setShowCloseWarning(true)
    } else {
      onClose()
    }
  }, [needsAcknowledgment, hasAcknowledged, onClose])

  // Bekräfta stängning utan bekräftelse
  const handleConfirmClose = useCallback(() => {
    setShowCloseWarning(false)
    onClose()
  }, [onClose])

  // Gå tillbaka till ärendet
  const handleGoBack = useCallback(() => {
    setShowCloseWarning(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Hämta bilder för alla ärenden
      fetchCaseImages()
      // Hämta återbesökshistorik
      fetchRevisitHistory()

      // Hämta inspektionssession om det är ett inspection-ärende
      if (fallbackData?.service_type === 'inspection' && caseId) {
        setLoadingSession(true)
        setInspectionSession(null)
        supabase
          .from('station_inspection_sessions')
          .select('id, status, completed_at, total_outdoor_stations, total_indoor_stations, inspected_outdoor_stations, inspected_indoor_stations, notes, technician:technicians(name)')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(async ({ data }) => {
            if (data) {
              const sessionId = (data as any).id as string
              const [od, ind] = await Promise.all([
                supabase.from('outdoor_station_inspections').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'activity'),
                supabase.from('indoor_station_inspections').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'activity')
              ])
              setInspectionSession({ ...(data as any), activityCount: (od.count || 0) + (ind.count || 0) })
            } else {
              setInspectionSession(null)
            }
            setLoadingSession(false)
          })
      }

      // Om vi har clickupTaskId, försök hämta från ClickUp
      if (clickupTaskId) {
        setUseFallback(false)
        fetchTaskDetails()
        fetchCustomerInfo()
      } else if (fallbackData) {
        // Använd fallback-data från cases-tabellen
        setUseFallback(true)
        setLoading(false)
        fetchCustomerInfo()
      } else {
        // Varken ClickUp-ID eller fallback - visa felmeddelande
        setUseFallback(true)
        setError('Ärendedetaljer saknas')
        setLoading(false)
      }
    }
  }, [isOpen, clickupTaskId, fallbackData])

  const fetchTaskDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/test-clickup?task_id=${clickupTaskId}`)
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta ärendedetaljer')
      }
      
      const data = await response.json()
      setTaskDetails(data)
    } catch (error) {
      console.error('Error fetching task details:', error)
      setError('Kunde inte ladda ärendedetaljer')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomerInfo = async () => {
    if (!profile?.customer_id) return

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('company_name, organization_number, contact_person')
        .eq('id', profile.customer_id)
        .single()

      if (error) {
        console.error('Error fetching customer info:', error)
        return
      }

      setCustomerInfo({
        company_name: data.company_name,
        org_number: data.organization_number,
        contact_person: data.contact_person
      })
    } catch (error) {
      console.error('Error fetching customer info:', error)
    }
  }

  const fetchCaseImages = async () => {
    if (!caseId) return
    setLoadingImages(true)
    try {
      // Försök hämta som contract först, sen business, sen private
      let images = await CaseImageService.getCaseImages(caseId, 'contract')
      if (images.length === 0) {
        images = await CaseImageService.getCaseImages(caseId, 'business')
      }
      if (images.length === 0) {
        images = await CaseImageService.getCaseImages(caseId, 'private')
      }
      setCaseImages(images)
    } catch (error) {
      console.error('Error fetching case images:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  // Hämta återbesökshistorik
  const fetchRevisitHistory = async () => {
    if (!caseId) return
    try {
      const { data, error } = await supabase
        .from('case_updates_log')
        .select('*')
        .eq('case_id', caseId)
        .eq('update_type', 'revisit_scheduled')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching revisit history:', error)
      } else {
        setRevisitHistory(data || [])
      }
    } catch (error) {
      console.error('Error fetching revisit history:', error)
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'bokat': 'bg-blue-500',
      'pågående': 'bg-yellow-500',
      'avslutad': 'bg-green-500',
      'försenad': 'bg-red-500',
      'pausad': 'bg-gray-500',
    }
    return statusColors[status.toLowerCase()] || 'bg-blue-500'
  }

  const getPriorityDisplay = (priority: string | null) => {
    if (!priority) return null
    
    const priorityLower = priority.toLowerCase()
    
    // Prioritetskonfiguration med ClickUps färger
    const config = {
      'urgent': { 
        text: 'Akut', 
        color: '#f87171',
        flagColor: 'text-red-500',
        borderColor: 'border-red-500/50',
        textColor: 'text-red-400'
      },
      'high': { 
        text: 'Hög', 
        color: '#fb923c',
        flagColor: 'text-orange-500',
        borderColor: 'border-orange-500/50',
        textColor: 'text-orange-400'
      },
      'normal': { 
        text: 'Normal', 
        color: '#60a5fa',
        flagColor: 'text-blue-500',
        borderColor: 'border-blue-500/50',
        textColor: 'text-blue-400'
      },
      'low': { 
        text: 'Låg', 
        color: '#9ca3af',
        flagColor: 'text-gray-500',
        borderColor: 'border-gray-500/50',
        textColor: 'text-gray-400'
      }
    }
    
    const priorityConfig = config[priorityLower] || config['normal']
    
    return (
      <span 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig.borderColor} ${priorityConfig.textColor} bg-transparent`}
      >
        <Flag className={`w-3 h-3 ${priorityConfig.flagColor}`} fill="currentColor" />
        <span>{priorityConfig.text}</span>
      </span>
    )
  }

  const getFieldValue = (fieldName: string) => {
    return taskDetails?.custom_fields.find(field => 
      field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
    )
  }

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Images className="w-4 h-4" />
    if (mimetype.startsWith('video/')) return <Play className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  const getDropdownText = (field: any) => {
    if (!field || !field.has_value) return 'Ej specificerat'
    
    if (field.type_config?.options && Array.isArray(field.type_config.options)) {
      const selectedOption = field.type_config.options.find((option: any) => 
        option.orderindex === field.value
      )
      if (selectedOption) {
        return selectedOption.name
      }
    }
    
    return field.value?.toString() || 'Ej specificerat'
  }

  // Uppdaterad PDF-generator som inkluderar kunduppgifter
  const handleGeneratePDF = async () => {
    if (!taskDetails) return

    try {
      await generatePDFReport(taskDetails, customerInfo || undefined)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Kunde inte generera PDF-rapport')
    }
  }

  if (!isOpen) return null

  // Hämta alla custom fields
  const addressField = getFieldValue('adress')
  const pestField = getFieldValue('skadedjur')
  const priceField = getFieldValue('pris')
  const reportField = getFieldValue('rapport')
  const filesField = getFieldValue('filer')
  const caseTypeField = getFieldValue('ärende')

  // Avgör vad som ska visas i header
  const displayTitle = useFallback
    ? (fallbackData?.title || 'Ärendedetaljer')
    : (taskDetails?.task_info.name || 'Laddar ärende...')

  const displayCaseNumber = useFallback
    ? fallbackData?.case_number
    : taskDetails?.task_id

  // Använd Portal för att rendera modalen direkt på body
  // Detta säkerställer att modalen alltid visas ovanför alla andra element
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <Card className="relative">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-start gap-3">
              {/* Trafikljusikon */}
              {(fallbackData?.pest_level !== undefined || fallbackData?.problem_rating !== undefined) && (
                <TrafficLightBadge
                  pestLevel={fallbackData?.pest_level}
                  problemRating={fallbackData?.problem_rating}
                  size="large"
                  showTooltip={true}
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-white">
                  {displayTitle}
                </h2>
                {displayCaseNumber && (
                  <p className="text-slate-400 text-sm">
                    Ärende #{displayCaseNumber}
                  </p>
                )}
                {/* Visa kundinfo i header om tillgänglig */}
                {customerInfo && (
                  <p className="text-slate-300 text-sm">
                    {customerInfo.company_name} • {customerInfo.org_number}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* PDF-rapport knapp med förbättrad loading state */}
              {taskDetails && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGeneratePDF}
                  className="flex items-center gap-2"
                  disabled={loading}
                >
                  <FileDown className="w-4 h-4" />
                  {loading ? 'Genererar...' : 'Ladda ner rapport'}
                </Button>
              )}

              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            )}

            {error && !useFallback && (
              <div className="flex items-center justify-center py-8 text-red-400">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            {/* Fallback-vy när ClickUp-data saknas */}
            {useFallback && fallbackData && !error && (
              <div className="space-y-4">
                {/* Status och datum */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {fallbackData.status && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Status:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(fallbackData.status)}`}>
                          {fallbackData.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Tjänstetyp */}
                    {fallbackData.service_type && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        fallbackData.service_type === 'inspection'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : fallbackData.service_type === 'establishment'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : fallbackData.service_type === 'acute'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {fallbackData.service_type === 'inspection' ? 'Avtalat Servicebesök' :
                         fallbackData.service_type === 'establishment' ? 'Etablering' :
                         fallbackData.service_type === 'acute' ? 'Akut' : 'Servicebesök'}
                      </span>
                    )}
                  </div>

                  {fallbackData.completed_date && (
                    <div className="text-sm text-slate-400">
                      Slutfört: {new Date(fallbackData.completed_date).toLocaleDateString('sv-SE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                </div>

                {/* Bokad tid */}
                {(fallbackData.start_date || fallbackData.scheduled_date) && (
                  <div className="flex items-center gap-2 text-sm bg-slate-800/50 px-3 py-2 rounded-lg">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">Bokad:</span>
                    {fallbackData.start_date ? (
                      // Privat/företag - har start och sluttid
                      <span className="text-white font-medium">
                        {new Date(fallbackData.start_date).toLocaleDateString('sv-SE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'Europe/Stockholm'
                        })}
                        <span className="text-slate-400 mx-1">
                          {new Date(fallbackData.start_date).toLocaleTimeString('sv-SE', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Stockholm'
                          })}
                          {fallbackData.due_date && (
                            <>
                              {' - '}
                              {new Date(fallbackData.due_date).toLocaleTimeString('sv-SE', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Stockholm'
                              })}
                            </>
                          )}
                        </span>
                      </span>
                    ) : (
                      // Avtalskunder - endast datum
                      <span className="text-white font-medium">
                        {new Date(fallbackData.scheduled_date!).toLocaleDateString('sv-SE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'Europe/Stockholm'
                        })}
                      </span>
                    )}
                  </div>
                )}

                {/* Situationsöversikt - Trafikljussystem */}
                {(fallbackData.pest_level !== null || fallbackData.problem_rating !== null) && (
                  <CustomerAssessmentPanel
                    pestLevel={fallbackData.pest_level ?? null}
                    problemRating={fallbackData.problem_rating ?? null}
                  />
                )}

                {/* Läskvitto för kritiska ärenden */}
                {needsAcknowledgment && (
                  <CriticalAcknowledgmentBanner
                    acknowledgment={acknowledgment}
                    loading={acknowledgmentLoading}
                    onAcknowledge={handleAcknowledge}
                  />
                )}

                {/* Ärendets utveckling - Tidslinje med trafikljushistorik */}
                <CaseJourneyTimeline
                  caseId={caseId}
                  currentPestLevel={fallbackData.pest_level}
                  currentProblemRating={fallbackData.problem_rating}
                  assessmentDate={fallbackData.assessment_date}
                  assessedBy={fallbackData.assessed_by}
                  defaultExpanded={true}
                />

                {/* Beskrivning */}
                {fallbackData.description && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Beskrivning
                    </h3>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{fallbackData.description}</p>
                    </div>
                  </div>
                )}

                {/* Arbetsrapport */}
                {fallbackData.work_report && fallbackData.work_report.trim() !== '' && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-blue-400" />
                      Arbetsrapport
                    </h3>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{fallbackData.work_report}</p>
                    </div>
                  </div>
                )}

                {/* Avtalat Servicebesök — inspektionsutfall */}
                {fallbackData.service_type === 'inspection' && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-blue-400" />
                      Kontrollresultat
                    </h3>
                    {loadingSession ? (
                      <div className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-2 text-slate-400 text-sm">
                        <div className="w-3 h-3 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                        Hämtar kontrolldata...
                      </div>
                    ) : inspectionSession ? (
                      <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span>Kontrollerade stationer</span>
                            <span className="font-medium text-white">
                              {inspectionSession.inspected_outdoor_stations + inspectionSession.inspected_indoor_stations}
                              {' / '}
                              {inspectionSession.total_outdoor_stations + inspectionSession.total_indoor_stations}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{
                                width: `${Math.round(
                                  ((inspectionSession.inspected_outdoor_stations + inspectionSession.inspected_indoor_stations) /
                                    Math.max(inspectionSession.total_outdoor_stations + inspectionSession.total_indoor_stations, 1)) * 100
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            inspectionSession.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : inspectionSession.status === 'in_progress'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {inspectionSession.status === 'completed' ? 'Genomförd' :
                             inspectionSession.status === 'in_progress' ? 'Pågår' : 'Schemalagd'}
                          </span>
                          {inspectionSession.activityCount !== undefined && inspectionSession.activityCount > 0 && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                              {inspectionSession.activityCount} station{inspectionSession.activityCount !== 1 ? 'er' : ''} med aktivitet
                            </span>
                          )}
                          {inspectionSession.completed_at && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700/50 text-slate-300">
                              Avslutad {new Date(inspectionSession.completed_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {inspectionSession.notes && (
                          <p className="text-sm text-slate-300 border-t border-slate-700/50 pt-2">{inspectionSession.notes}</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-800/30 border border-dashed border-slate-700/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-2">Kontrolldata fylls i efter genomfört servicebesök</p>
                        <div className="grid grid-cols-2 gap-2">
                          {['Kontrollerade stationer', 'Stationer med aktivitet', 'Genomförd datum', 'Teknikernotering'].map(label => (
                            <div key={label} className="space-y-0.5">
                              <p className="text-xs text-slate-500">{label}</p>
                              <div className="h-4 bg-slate-700/40 rounded w-3/4" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Etablering — preview om arbetsrapport saknas */}
                {fallbackData.service_type === 'establishment' && !fallbackData.work_report && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-400" />
                      Etableringsrapport
                    </h3>
                    <div className="p-3 bg-slate-800/30 border border-dashed border-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-2">Etableringsresultat fylls i efter genomfört besök</p>
                      <div className="grid grid-cols-2 gap-2">
                        {['Installerade stationer', 'Utrustningstyp', 'Rapport', 'Rekommendationer'].map(label => (
                          <div key={label} className="space-y-0.5">
                            <p className="text-xs text-slate-500">{label}</p>
                            <div className="h-4 bg-slate-700/40 rounded w-3/4" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Snabbinfo - professionella chips med textlabels */}
                <div className="flex flex-wrap gap-2">
                  {fallbackData.pest_type && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <span className="text-xs text-slate-400">Skadedjur:</span>
                      <span className="text-sm text-white">{fallbackData.pest_type}</span>
                    </div>
                  )}
                  {fallbackData.price && fallbackData.price > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <span className="text-xs text-slate-400">Pris:</span>
                      <span className="text-sm text-white font-medium">{fallbackData.price} kr</span>
                    </div>
                  )}
                  {fallbackData.time_spent_minutes !== undefined && fallbackData.time_spent_minutes > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <span className="text-xs text-slate-400">Tid:</span>
                      <span className="text-sm text-white">
                        {Math.floor(fallbackData.time_spent_minutes / 60) > 0
                          ? `${Math.floor(fallbackData.time_spent_minutes / 60)}h ${fallbackData.time_spent_minutes % 60}min`
                          : `${fallbackData.time_spent_minutes} min`
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Adress med kartknapp */}
                {fallbackData.address?.formatted_address && (
                  <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                    <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-400 mb-1">Adress</p>
                      <p className="text-white font-medium">
                        {fallbackData.address.formatted_address}
                      </p>
                      {fallbackData.location && (
                        <button
                          className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                          onClick={() => {
                            const { lat, lng } = fallbackData.location!;
                            window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank');
                          }}
                        >
                          Visa på karta
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Kontaktperson och Tekniker i grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Kontaktperson */}
                  {fallbackData.contact_person && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        Kontaktperson
                      </h4>
                      <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {fallbackData.contact_person.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{fallbackData.contact_person}</p>
                          {fallbackData.contact_email && (
                            <p className="text-sm text-slate-400 truncate">{fallbackData.contact_email}</p>
                          )}
                          {fallbackData.contact_phone && (
                            <p className="text-sm text-slate-400">{fallbackData.contact_phone}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {fallbackData.contact_email && (
                            <button
                              onClick={() => window.open(`mailto:${fallbackData.contact_email}`, '_blank')}
                              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                              title="Skicka e-post"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                          {fallbackData.contact_phone && (
                            <button
                              onClick={() => window.open(`tel:${fallbackData.contact_phone}`, '_blank')}
                              className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                              title="Ring"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ansvarig tekniker */}
                  {fallbackData.primary_technician_name && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <User className="w-4 h-4 text-green-400" />
                        Ansvarig tekniker
                      </h4>
                      <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {fallbackData.primary_technician_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{fallbackData.primary_technician_name}</p>
                          {fallbackData.primary_technician_email && (
                            <p className="text-sm text-slate-400 truncate">{fallbackData.primary_technician_email}</p>
                          )}
                        </div>
                        {fallbackData.primary_technician_email && (
                          <button
                            onClick={() => window.open(`mailto:${fallbackData.primary_technician_email}?subject=Fråga om ärende ${fallbackData.title || fallbackData.case_number}`, '_blank')}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                            title={`Skicka e-post till ${fallbackData.primary_technician_name}`}
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Grid med resterande information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Vänster kolumn */}
                  <div className="space-y-3">
                    {/* Material använt */}
                    {fallbackData.materials_used && fallbackData.materials_used.trim() !== '' && (
                      <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                        <Package className="w-4 h-4 text-purple-400" />
                        <div>
                          <p className="text-xs text-slate-400">Material</p>
                          <p className="text-sm text-white">{fallbackData.materials_used}</p>
                        </div>
                      </div>
                    )}

                    {/* Använda preparat */}
                    {caseId && fallbackData?.service_type !== 'inspection' && (
                      <CasePreparationsSection
                        caseId={caseId}
                        caseType="contract"
                        pestType={fallbackData?.pest_type || null}
                        isReadOnly={true}
                      />
                    )}
                  </div>

                  {/* Höger kolumn */}
                  <div className="space-y-3">

                    {/* Bilder från case_images (teknikerns bilder) */}
                    {caseImages.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Images className="w-4 h-4 text-indigo-400" />
                          Bilder ({caseImages.length})
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {caseImages.map((image) => (
                            <div
                              key={image.id}
                              className="relative group rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700 aspect-square"
                            >
                              <img
                                src={image.url}
                                alt={image.original_name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <a
                                  href={image.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-white/20 rounded-full hover:bg-white/30"
                                >
                                  <Eye className="w-3 h-3 text-white" />
                                </a>
                                <a
                                  href={image.url}
                                  download={image.original_name}
                                  className="p-1.5 bg-white/20 rounded-full hover:bg-white/30"
                                >
                                  <Download className="w-3 h-3 text-white" />
                                </a>
                              </div>
                              {image.tags && image.tags.length > 0 && (
                                <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] bg-black/60 text-white rounded">
                                  {image.tags[0] === 'before' ? 'Före' : image.tags[0] === 'after' ? 'Efter' : 'Övrigt'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filer och bilder från fallback (om inga case_images) */}
                    {caseImages.length === 0 && fallbackData.files && fallbackData.files.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Images className="w-4 h-4 text-indigo-400" />
                          Bilder & Filer ({fallbackData.files.length})
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {fallbackData.files.map((file, index) => {
                            const isImage = file.type.startsWith('image/')
                            return (
                              <div
                                key={index}
                                className="relative group rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700 aspect-square"
                              >
                                {isImage ? (
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-slate-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/20 rounded-full hover:bg-white/30"
                                  >
                                    <Eye className="w-3 h-3 text-white" />
                                  </a>
                                  <a
                                    href={file.url}
                                    download={file.name}
                                    className="p-1.5 bg-white/20 rounded-full hover:bg-white/30"
                                  >
                                    <Download className="w-3 h-3 text-white" />
                                  </a>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {taskDetails && (
              <div className="space-y-4">
                {/* Status, prioritet och datum */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Status:</span>
                      <span 
                        className={`px-3 py-1 rounded-full text-sm font-medium text-white ${
                          getStatusColor(taskDetails.task_info.status)
                        }`}
                      >
                        {taskDetails.task_info.status.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* PRIORITET TILL HÖGER OM STATUS */}
                    {taskDetails.priority && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Prioritet:</span>
                        {getPriorityDisplay(taskDetails.priority.priority)}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm text-slate-400">
                    Skapat: {formatDate(taskDetails.task_info.created)}
                    {taskDetails.task_info.updated !== taskDetails.task_info.created && (
                      <span className="ml-4">
                        Uppdaterat: {formatDate(taskDetails.task_info.updated)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Beskrivning */}
                {taskDetails.task_info.description && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Beskrivning</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <p className="text-white whitespace-pre-wrap">
                        {taskDetails.task_info.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Grid med information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vänster kolumn */}
                  <div className="space-y-4">
                    {/* Adress */}
                    {addressField && (
                      <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-400 mb-1">Adress</p>
                          <p className="text-white font-medium">
                            {addressField.value.formatted_address}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-2 text-blue-400 hover:text-blue-300 p-0"
                            onClick={() => {
                              const { lat, lng } = addressField.value.location
                              window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank')
                            }}
                          >
                            Visa på karta
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Skadedjur och ärendetype */}
                    <div className="grid grid-cols-1 gap-4">
                      {pestField && (
                        <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                          <Bug className="w-5 h-5 text-orange-400" />
                          <div>
                            <p className="text-sm text-slate-400">Skadedjur</p>
                            <p className="text-white font-medium">
                              {getDropdownText(pestField)}
                            </p>
                          </div>
                        </div>
                      )}

                      {caseTypeField && (
                        <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-sm text-slate-400">Typ av ärende</p>
                            <p className="text-white font-medium">
                              {getDropdownText(caseTypeField)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pris - Only show if price > 0 */}
                    {priceField && priceField.has_value && priceField.value > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="text-sm text-slate-400">Kostnad</p>
                          <p className="text-white font-medium text-xl">
                            {priceField.value} kr
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Ansvarig tekniker */}
                    {taskDetails.assignees.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Ansvarig tekniker
                        </h4>
                        <div className="space-y-2">
                          {taskDetails.assignees.map((assignee, index) => (
                            <div 
                              key={index}
                              className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                            >
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {assignee.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="flex-1">
                                <p className="text-white font-medium">{assignee.name}</p>
                                <p className="text-sm text-slate-400">{assignee.email}</p>
                              </div>
                              <button
                                onClick={() => window.open(`mailto:${assignee.email}?subject=Fråga om ärende ${taskDetails.task_info.name}`, '_blank')}
                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                title={`Skicka e-post till ${assignee.name}`}
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Höger kolumn */}
                  <div className="space-y-4">
                    {/* Teknikerrapport */}
                    {reportField && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Teknikerrapport
                        </h4>
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <p className="text-white whitespace-pre-wrap">
                            {reportField.value}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Rekommendationer från tekniker */}
                    {fallbackData?.recommendations && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          Teknikerns rekommendationer
                        </h4>
                        <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg">
                          <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">
                            {fallbackData.recommendations}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Använda preparat - endast läsläge för kunder */}
                    {caseId && fallbackData?.pest_type !== 'Inspektion' && (
                      <CasePreparationsSection
                        caseId={caseId}
                        caseType="contract"
                        pestType={fallbackData?.pest_type || null}
                        isReadOnly={true}
                      />
                    )}

                    {/* Filer och bilder */}
                    {filesField && filesField.value && Array.isArray(filesField.value) && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <Images className="w-4 h-4" />
                          Filer ({filesField.value.length})
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {filesField.value.map((file: any, index: number) => (
                            <div 
                              key={file.id} 
                              className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors"
                            >
                              <div className="text-slate-400">
                                {getFileIcon(file.mimetype)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">
                                  {file.title}
                                </p>
                                <p className="text-slate-400 text-sm">
                                  {(file.size / 1024 / 1024).toFixed(1)} MB • {file.extension.toUpperCase()}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(file.url_w_query, '_blank')}
                                  className="p-2"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = file.url_w_host
                                    link.download = file.title
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                  }}
                                  className="p-2"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Phone className="w-4 h-4" />
                <span>Har du frågor? Ring oss på <a href="tel:010-280-44-10" className="text-blue-400 hover:text-blue-300">010 280 44 10</a></span>
              </div>

              <Button
                variant="secondary"
                onClick={handleClose}
                size="sm"
              >
                Stäng
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Close Warning Dialog - visas när användaren försöker stänga utan bekräftelse */}
      <CloseWarningDialog
        isOpen={showCloseWarning}
        onClose={() => setShowCloseWarning(false)}
        onConfirmClose={handleConfirmClose}
        onGoBack={handleGoBack}
      />
    </div>,
    document.body
  )
}