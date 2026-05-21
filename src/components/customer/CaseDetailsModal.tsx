// src/components/customer/CaseDetailsModal.tsx - Med kunduppgifter för PDF
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  FileText,
  Images,
  AlertCircle,
  Download,
  Eye,
  Play,
  FileDown,
  Flag,
  Lightbulb,
  Package,
  ChevronDown,
  ChevronUp,
  Camera
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
import { InspectionPhotoLightbox } from './InspectionPhotoLightbox'
import type { Photo } from './InspectionPhotoLightbox'
import { generatePDFReport } from '../../utils/pdfReportGenerator'
import { generateInspectionPDF, generateInspectionExcel } from '../../services/inspectionReportService'
import { getInspectionPhotoUrl } from '../../services/inspectionSessionService'
import { useInspectionStatusLabels } from '../../hooks/useInspectionStatusLabels'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CaseImageService, CaseImageWithUrl } from '../../services/caseImageService'
import { useAcknowledgment } from '../../hooks/useAcknowledgment'
import { requiresAcknowledgment } from '../../types/acknowledgment'
import { serviceTypeConfig } from '../../types/cases'
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
  const [visitHistory, setVisitHistory] = useState<Array<{
    id: string
    visit_date: string
    visit_number: number | null
    technician_name: string | null
    work_performed: string | null
    recommendations: string | null
    pest_level: number | null
    time_spent_minutes: number | null
  }>>([])
  const [visitBillingItems, setVisitBillingItems] = useState<Array<{
    visit_number: number
    description: string
    quantity: number
  }>>([])
  const [currentBillingItems, setCurrentBillingItems] = useState<Array<{
    id: string
    description: string
    quantity: number
  }>>([])

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
  const [stationInspections, setStationInspections] = useState<{
    outdoor: any[]
    indoor: any[]
  } | null>(null)
  const [showStationDetails, setShowStationDetails] = useState(false)
  const [inspectionPhotos, setInspectionPhotos] = useState<Photo[]>([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [generatingReport, setGeneratingReport] = useState<'pdf' | 'excel' | null>(null)
  const { profile } = useAuth()
  const { getLabel: getInspStatusLabel, getColor: getInspStatusColor } = useInspectionStatusLabels()

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
      // Hämta per-besökshistorik
      fetchVisitHistory()

      // Hämta inspektionssession om det är ett inspection-ärende
      if (fallbackData?.service_type === 'inspection' && caseId) {
        setLoadingSession(true)
        setInspectionSession(null)
        setStationInspections(null)
        setInspectionPhotos([])
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

              // Hämta stationsinspektioner + aktivitetsräknare parallellt
              const [odActivity, indActivity, outdoorData, indoorData] = await Promise.all([
                supabase.from('outdoor_station_inspections').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'activity'),
                supabase.from('indoor_station_inspections').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('status', 'activity'),
                supabase.from('outdoor_station_inspections').select('id, status, findings, measurement_value, measurement_unit, photo_path, inspected_at, station:equipment_placements(id, serial_number, equipment_type, station_type_data:station_types(name, color, measurement_label, measurement_unit)), preparation:preparations(name, registration_number)').eq('session_id', sessionId).order('inspected_at'),
                supabase.from('indoor_station_inspections').select('id, status, findings, measurement_value, measurement_unit, photo_path, inspected_at, station:indoor_stations(id, station_number, station_type, floor_plan:floor_plans(name), station_type_data:station_types(name, color, measurement_label, measurement_unit)), preparation:preparations(name, registration_number)').eq('session_id', sessionId).order('inspected_at')
              ])

              setInspectionSession({ ...(data as any), activityCount: (odActivity.count || 0) + (indActivity.count || 0) })
              const outdoor = outdoorData.data || []
              const indoor = indoorData.data || []
              setStationInspections({ outdoor, indoor })

              // Hämta signed URLs för foton
              const allWithPhotos = [
                ...outdoor.filter((r: any) => r.photo_path).map((r: any) => ({ ...r, stationType: 'outdoor' as const })),
                ...indoor.filter((r: any) => r.photo_path).map((r: any) => ({ ...r, stationType: 'indoor' as const }))
              ]
              if (allWithPhotos.length > 0) {
                const photoPromises = allWithPhotos.map(async (r) => {
                  const url = await getInspectionPhotoUrl(r.photo_path)
                  if (!url) return null
                  const stationNumber = r.stationType === 'outdoor'
                    ? (r.station?.serial_number || 'Utomhus')
                    : (r.station?.station_number || 'Inomhus')
                  return {
                    url,
                    stationNumber,
                    stationType: r.stationType,
                    status: r.status,
                    inspectedAt: r.inspected_at,
                    findings: r.findings || undefined
                  } as Photo
                })
                const photos = (await Promise.all(photoPromises)).filter(Boolean) as Photo[]
                setInspectionPhotos(photos)
              }
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

  // Hämta per-besökshistorik + nuvarande billing items (utan priser för kunden)
  const fetchVisitHistory = async () => {
    if (!caseId) return
    try {
      const [visitsRes, billingRes, currentRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, visit_date, visit_number, technician_name, work_performed, recommendations, pest_level, time_spent_minutes')
          .eq('case_id', caseId)
          .order('visit_date', { ascending: false }),
        supabase
          .from('case_billing_items')
          .select('visit_number, description, quantity')
          .eq('case_id', caseId)
          .eq('item_type', 'service')
          .not('visit_number', 'is', null),
        supabase
          .from('case_billing_items')
          .select('id, description, quantity')
          .eq('case_id', caseId)
          .eq('item_type', 'service')
          .eq('status', 'pending')
          .is('visit_number', null)
      ])
      setVisitHistory(visitsRes.data || [])
      setVisitBillingItems((billingRes.data || []).filter(i => i.visit_number != null) as Array<{ visit_number: number; description: string; quantity: number }>)
      setCurrentBillingItems(currentRes.data || [])
    } catch (error) {
      console.error('Error fetching visit history:', error)
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

  const handleInspectionPDF = async () => {
    if (!inspectionSession) return
    setGeneratingReport('pdf')
    try {
      await generateInspectionPDF(inspectionSession.id)
    } catch (error) {
      toast.error('Kunde inte generera PDF-rapport')
    } finally {
      setGeneratingReport(null)
    }
  }

  const handleInspectionExcel = async () => {
    if (!inspectionSession) return
    setGeneratingReport('excel')
    try {
      await generateInspectionExcel(inspectionSession.id)
    } catch (error) {
      toast.error('Kunde inte generera Excel-rapport')
    } finally {
      setGeneratingReport(null)
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

  // Statusfärg som ren textfärg (ingen pill)
  const getStatusDotColor = (status: string): string => {
    if (status === 'open' || status === 'Öppen') return '#60a5fa'
    if (status === 'Bokad') return '#facc15'
    if (status === 'Avslutat') return '#34d399'
    if (status === 'Borttaget') return '#94a3b8'
    if (status === 'Återbesök') return '#a78bfa'
    if (status === 'Offert skickad' || status === 'Offert signerad - boka in') return '#fb923c'
    if (status === 'Reklamation') return '#f87171'
    return '#94a3b8'
  }

  const getStatusDisplayLabel = (status: string): string => {
    const map: Record<string, string> = {
      'open': 'Öppen', 'Öppen': 'Öppen', 'Bokad': 'Bokad',
      'Avslutat': 'Genomförd', 'Borttaget': 'Avbokat',
      'Offert skickad': 'Offert skickad', 'Offert signerad - boka in': 'Offert signerad',
      'Bomkörning': 'Bomkörning', 'Ombokning': 'Ombokning', 'Reklamation': 'Reklamation',
      'Återbesök': 'Återbesök',
    }
    return map[status] ?? status
  }

  const serviceTypeLabel = (t?: string | null) => {
    if (!t) return ''
    if (t === 'inspection') return 'Avtalat servicebesök'
    if (t === 'establishment') return 'Etablering'
    const config = serviceTypeConfig[t as keyof typeof serviceTypeConfig]
    return config?.label ?? t
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="px-6 py-5 border-b border-slate-700/50 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {displayCaseNumber && (
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                {useFallback
                  ? (String(displayCaseNumber).startsWith('BE-') ? String(displayCaseNumber) : `BE-${displayCaseNumber}`)
                  : `#${displayCaseNumber}`}
              </p>
            )}
            <h2 className="text-lg font-semibold text-white leading-snug">
              {displayTitle}
            </h2>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              {/* Status som prick + text */}
              {(fallbackData?.status || taskDetails?.task_info.status) && (() => {
                const st = fallbackData?.status || taskDetails?.task_info.status || ''
                const dot = getStatusDotColor(st)
                return (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: dot }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
                    {getStatusDisplayLabel(st)}
                  </span>
                )
              })()}
              {/* Servicetyp */}
              {fallbackData?.service_type && (
                <span className="text-xs text-slate-500">
                  {serviceTypeLabel(fallbackData.service_type)}
                </span>
              )}
              {/* Tekniker */}
              {fallbackData?.primary_technician_name && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {fallbackData.primary_technician_name}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── CONTENT ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-10">
              <LoadingSpinner />
            </div>
          )}

          {/* Error */}
          {error && !useFallback && (
            <div className="flex items-center justify-center py-10 text-red-400 gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* ── FALLBACK-VY ────────────────────────────────── */}
          {useFallback && fallbackData && !error && (
            <>
              {/* Bokad tid */}
              {(fallbackData.start_date || fallbackData.scheduled_date) && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="text-slate-500">Bokad:</span>
                  {fallbackData.start_date ? (
                    <span className="text-white">
                      {new Date(fallbackData.start_date).toLocaleDateString('sv-SE', {
                        weekday: 'long', day: 'numeric', month: 'long',
                        timeZone: 'Europe/Stockholm'
                      })}
                      {' '}
                      <span className="text-slate-400">
                        {new Date(fallbackData.start_date).toLocaleTimeString('sv-SE', {
                          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm'
                        })}
                        {fallbackData.due_date && (
                          <>
                            {'–'}
                            {new Date(fallbackData.due_date).toLocaleTimeString('sv-SE', {
                              hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm'
                            })}
                          </>
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-white">
                      {new Date(fallbackData.scheduled_date!).toLocaleDateString('sv-SE', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        timeZone: 'Europe/Stockholm'
                      })}
                    </span>
                  )}
                </div>
              )}

              {/* Kritisk bekräftelse */}
              {needsAcknowledgment && (
                <CriticalAcknowledgmentBanner
                  acknowledgment={acknowledgment}
                  loading={acknowledgmentLoading}
                  onAcknowledge={handleAcknowledge}
                />
              )}

              {/* Beskrivning — tidigt så kunden förstår ärendet direkt */}
              {fallbackData.description && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Beskrivning</p>
                  <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{fallbackData.description}</p>
                  </div>
                </div>
              )}

              {/* Situationsöversikt — ej relevant för avtalade servicebesök */}
              {fallbackData.service_type !== 'inspection' && (
                <>
                  {((fallbackData.pest_level ?? 0) > 0 || (fallbackData.problem_rating ?? 0) > 0) && (
                    <CustomerAssessmentPanel
                      pestLevel={fallbackData.pest_level ?? null}
                      problemRating={fallbackData.problem_rating ?? null}
                    />
                  )}
                  {/* Ärendehistorik — visas bara om det finns återbesök */}
                  {visitHistory.length > 0 && (
                    <CaseJourneyTimeline
                      caseId={caseId}
                      currentPestLevel={fallbackData.pest_level}
                      currentProblemRating={fallbackData.problem_rating}
                      assessmentDate={fallbackData.assessment_date}
                      assessedBy={fallbackData.assessed_by}
                      defaultExpanded={false}
                      title="Ärendehistorik"
                    />
                  )}
                </>
              )}

              {/* ── INSPEKTIONSRESULTAT ── */}
              {fallbackData.service_type === 'inspection' && (
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                  {/* Sektionsrubrik */}
                  <div className="px-4 pt-4 pb-3 border-b border-slate-700/40">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Resultat av avtalat servicebesök
                      {inspectionSession?.completed_at && (
                        <span className="ml-2 normal-case font-normal text-slate-500">
                          {new Date(inspectionSession.completed_at).toLocaleDateString('sv-SE', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                      )}
                    </p>
                  </div>

                  {loadingSession ? (
                    <div className="px-4 py-6 flex items-center gap-2 text-slate-400 text-sm">
                      <div className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                      Hämtar kontrolldata...
                    </div>
                  ) : inspectionSession ? (
                    <>
                      {/* Sammanfattning */}
                      <div className="px-4 py-4">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">Kontrollerade</p>
                            <p className="text-2xl font-bold text-white leading-none">
                              {inspectionSession.inspected_outdoor_stations + inspectionSession.inspected_indoor_stations}
                              <span className="text-sm font-normal text-slate-500 ml-1">
                                / {inspectionSession.total_outdoor_stations + inspectionSession.total_indoor_stations}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">Status</p>
                            <p className="text-sm font-medium text-emerald-400">
                              {inspectionSession.status === 'completed' ? 'Genomförd' :
                               inspectionSession.status === 'in_progress' ? 'Pågår' : 'Schemalagd'}
                            </p>
                          </div>
                          {inspectionSession.technician && (
                            <div>
                              <p className="text-xs text-slate-500 mb-0.5">Tekniker</p>
                              <p className="text-sm text-white truncate">{(inspectionSession.technician as any).name}</p>
                            </div>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="h-px bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{
                              width: `${Math.round(
                                ((inspectionSession.inspected_outdoor_stations + inspectionSession.inspected_indoor_stations) /
                                  Math.max(inspectionSession.total_outdoor_stations + inspectionSession.total_indoor_stations, 1)) * 100
                              )}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Aktivitetssummering */}
                      {stationInspections && (() => {
                        const all = [...stationInspections.outdoor, ...stationInspections.indoor]
                        const okCount = all.filter(r => r.status === 'ok' || r.status === 'none').length
                        const activityCount = all.filter(r => ['activity', 'medium', 'high', 'low', 'needs_service'].includes(r.status)).length
                        if (okCount + activityCount === 0) return null
                        return (
                          <div className="px-4 py-3 border-t border-slate-700/40 flex gap-6">
                            {okCount > 0 && (
                              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                {okCount} utan aktivitet
                              </span>
                            )}
                            {activityCount > 0 && (
                              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                {activityCount} med aktivitet
                              </span>
                            )}
                          </div>
                        )
                      })()}

                      {/* Stationstabell */}
                      {stationInspections && (stationInspections.outdoor.length + stationInspections.indoor.length) > 0 && (
                        <div className="border-t border-slate-700/40">
                          <button
                            onClick={() => setShowStationDetails(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors"
                          >
                            <span className="uppercase tracking-wider font-medium">
                              Stationer ({stationInspections.outdoor.length + stationInspections.indoor.length})
                            </span>
                            {showStationDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {showStationDetails && (() => {
                            const unitLabel: Record<string, string> = { gram: 'g', st: 'st', ml: 'ml', procent: '%', kg: 'kg' }
                            const rows = [
                              ...stationInspections.outdoor.map((r: any) => ({
                                ...r, _label: r.station?.station_type_data?.name || r.station?.equipment_type || 'Utomhus',
                                _color: r.station?.station_type_data?.color || '#6b7280'
                              })),
                              ...stationInspections.indoor.map((r: any) => ({
                                ...r, _label: r.station?.station_type_data?.name || r.station?.station_type || 'Inomhus',
                                _color: r.station?.station_type_data?.color || '#6b7280'
                              }))
                            ]
                            return (
                              <>
                                {/* Kolumnhuvud */}
                                <div className="px-4 py-2 bg-slate-900/40 flex items-center gap-3 text-[10px] text-slate-500 uppercase tracking-wider border-t border-slate-700/30">
                                  <span className="flex-1">Station</span>
                                  <span className="w-28 text-right">Status</span>
                                  <span className="w-16 text-right">Mätvärde</span>
                                  <span className="w-5" />
                                </div>
                                <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
                                  {rows.map((row: any) => {
                                    const statusLabel = getInspStatusLabel(row.status)
                                    const statusColor = getInspStatusColor(row.status)
                                    const unit = row.measurement_unit || row.station?.station_type_data?.measurement_unit || ''
                                    const prepText = row.preparation?.name
                                      ? `${row.preparation.name}${row.preparation.registration_number ? ` · Reg.nr: ${row.preparation.registration_number}` : ''}`
                                      : null
                                    return (
                                      <div key={row.id} className="px-4 py-3 hover:bg-slate-800/40 transition-colors">
                                        <div className="flex items-center gap-3">
                                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row._color }} />
                                          <span className="flex-1 text-sm text-white truncate">{row._label}</span>
                                          <span
                                            className="w-28 text-right text-xs font-medium shrink-0"
                                            style={{ color: statusColor }}
                                          >
                                            {statusLabel}
                                          </span>
                                          <span className="w-16 text-right text-xs text-slate-500 shrink-0">
                                            {row.measurement_value != null ? `${row.measurement_value} ${unitLabel[unit] || unit}` : ''}
                                          </span>
                                          <div className="w-5 shrink-0 flex justify-end">
                                            {row.photo_path && <Camera className="w-3.5 h-3.5 text-slate-500" />}
                                          </div>
                                        </div>
                                        {row.findings && (
                                          <p className="mt-1 ml-[22px] text-xs text-slate-500 line-clamp-2">{row.findings}</p>
                                        )}
                                        {prepText && (
                                          <p className="mt-0.5 ml-[22px] text-xs text-slate-400">{prepText}</p>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      )}

                      {/* Foton */}
                      {inspectionPhotos.length > 0 && (
                        <div className="border-t border-slate-700/40 px-4 py-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                            Foton ({inspectionPhotos.length})
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {inspectionPhotos.map((photo, i) => (
                              <button
                                key={i}
                                onClick={() => { setLightboxIndex(i); setLightboxOpen(true) }}
                                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors"
                              >
                                <img src={photo.url} alt={photo.stationNumber} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rapport-nedladdning */}
                      <div className="border-t border-slate-700/40 px-4 py-3 flex items-center gap-3">
                        <span className="text-xs text-slate-500 mr-1">Ladda ner rapport</span>
                        <button
                          onClick={handleInspectionPDF}
                          disabled={generatingReport !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          {generatingReport === 'pdf' ? 'Genererar...' : 'PDF'}
                        </button>
                        <button
                          onClick={handleInspectionExcel}
                          disabled={generatingReport !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {generatingReport === 'excel' ? 'Genererar...' : 'Excel'}
                        </button>
                      </div>

                      {/* Sessionnotering */}
                      {inspectionSession.notes && (
                        <div className="border-t border-slate-700/40 px-4 py-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Teknikernotering</p>
                          <p className="text-sm text-slate-300">{inspectionSession.notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-4 py-6">
                      <p className="text-xs text-slate-500 mb-3">Kontrolldata fylls i efter genomfört servicebesök</p>
                      <div className="grid grid-cols-2 gap-3">
                        {['Kontrollerade stationer', 'Stationer med aktivitet', 'Genomförd datum', 'Teknikernotering'].map(label => (
                          <div key={label}>
                            <p className="text-xs text-slate-500 mb-1">{label}</p>
                            <div className="h-3 bg-slate-700/40 rounded w-3/4" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Etablering — placeholder */}
              {fallbackData.service_type === 'establishment' && !fallbackData.work_report && (
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                  <div className="px-4 pt-4 pb-3 border-b border-slate-700/40">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Etableringsrapport</p>
                  </div>
                  <div className="px-4 py-6">
                    <p className="text-xs text-slate-500 mb-3">Etableringsresultat fylls i efter genomfört besök</p>
                    <div className="grid grid-cols-2 gap-3">
                      {['Installerade stationer', 'Utrustningstyp', 'Rapport', 'Rekommendationer'].map(label => (
                        <div key={label}>
                          <p className="text-xs text-slate-500 mb-1">{label}</p>
                          <div className="h-3 bg-slate-700/40 rounded w-3/4" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Arbetsrapport */}
              {fallbackData.work_report && fallbackData.work_report.trim() !== '' && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Arbetsrapport</p>
                  <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{fallbackData.work_report}</p>
                  </div>
                </div>
              )}

              {/* Utförda tjänster — nuvarande besök (pending, ej historiska) */}
              {currentBillingItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Utförda tjänster</p>
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3 space-y-1.5">
                    {currentBillingItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item.description}</span>
                        {item.quantity !== 1 && (
                          <span className="text-slate-500 text-xs ml-2 flex-shrink-0">× {item.quantity}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tidigare besök */}
              {visitHistory.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Tidigare besök</p>
                  <div className="space-y-2">
                    {visitHistory.map((visit) => {
                      const itemsForVisit = visitBillingItems.filter(b => b.visit_number === visit.visit_number)
                      return (
                        <div key={visit.id} className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500">
                              {visit.visit_number ? `Besök #${visit.visit_number} · ` : ''}
                              {new Date(visit.visit_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {visit.pest_level != null && visit.pest_level > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                visit.pest_level >= 3 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                visit.pest_level === 2 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              }`}>
                                Nivå {visit.pest_level}
                              </span>
                            )}
                          </div>
                          {visit.work_performed && (
                            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{visit.work_performed}</p>
                          )}
                          {visit.recommendations && (
                            <p className="text-xs text-amber-400 mt-1 italic">{visit.recommendations}</p>
                          )}
                          {itemsForVisit.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700/40">
                              <p className="text-xs text-slate-500 mb-1">Utförda tjänster</p>
                              <div className="space-y-0.5">
                                {itemsForVisit.map((item, i) => (
                                  <p key={i} className="text-xs text-slate-400">
                                    {item.description}{item.quantity !== 1 ? ` × ${item.quantity}` : ''}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Info-grid: Adress + Tekniker + Kontaktperson + Snabbinfo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Adress */}
                {fallbackData.address?.formatted_address && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Adress
                    </p>
                    <p className="text-sm text-white">{fallbackData.address.formatted_address}</p>
                    {fallbackData.location && (
                      <button
                        className="mt-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        onClick={() => {
                          const { lat, lng } = fallbackData.location!
                          window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank')
                        }}
                      >
                        Visa på karta
                      </button>
                    )}
                  </div>
                )}

                {/* Tekniker */}
                {fallbackData.primary_technician_name && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tekniker</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-xs font-semibold shrink-0">
                        {fallbackData.primary_technician_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{fallbackData.primary_technician_name}</p>
                        {fallbackData.primary_technician_email && (
                          <a
                            href={`mailto:${fallbackData.primary_technician_email}?subject=Fråga om ärende ${fallbackData.title || fallbackData.case_number}`}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors truncate block"
                          >
                            {fallbackData.primary_technician_email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Kontaktperson */}
                {fallbackData.contact_person && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Kontaktperson</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-xs font-semibold shrink-0">
                        {fallbackData.contact_person.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{fallbackData.contact_person}</p>
                        {fallbackData.contact_email && (
                          <a
                            href={`mailto:${fallbackData.contact_email}`}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors truncate block"
                          >
                            {fallbackData.contact_email}
                          </a>
                        )}
                        {fallbackData.contact_phone && (
                          <a
                            href={`tel:${fallbackData.contact_phone}`}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {fallbackData.contact_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Snabbinfo */}
                {(fallbackData.pest_type || (fallbackData.price && fallbackData.price > 0) || (fallbackData.time_spent_minutes && fallbackData.time_spent_minutes > 0)) && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3 space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ärendeinfo</p>
                    {fallbackData.pest_type && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Tjänst</span>
                        <span className="text-xs text-white">{fallbackData.pest_type}</span>
                      </div>
                    )}
                    {fallbackData.price && fallbackData.price > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Pris</span>
                        <span className="text-xs text-white font-medium">{fallbackData.price} kr</span>
                      </div>
                    )}
                    {fallbackData.time_spent_minutes !== undefined && fallbackData.time_spent_minutes > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Tid</span>
                        <span className="text-xs text-white">
                          {Math.floor(fallbackData.time_spent_minutes / 60) > 0
                            ? `${Math.floor(fallbackData.time_spent_minutes / 60)}h ${fallbackData.time_spent_minutes % 60}min`
                            : `${fallbackData.time_spent_minutes} min`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Material / preparat (ej inspection) */}
              {fallbackData.service_type !== 'inspection' && (
                <>
                  {fallbackData.materials_used && fallbackData.materials_used.trim() !== '' && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        Material
                      </p>
                      <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
                        <p className="text-sm text-slate-300">{fallbackData.materials_used}</p>
                      </div>
                    </div>
                  )}
                  {caseId && (
                    <CasePreparationsSection
                      caseId={caseId}
                      caseType="contract"
                      pestType={fallbackData?.pest_type || null}
                      isReadOnly={true}
                    />
                  )}
                </>
              )}

              {/* Bilder */}
              {(caseImages.length > 0 || ((fallbackData.files?.length ?? 0) > 0)) && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5" />
                    Bilder {caseImages.length > 0 ? `(${caseImages.length})` : `(${fallbackData.files?.length})`}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {caseImages.length > 0
                      ? caseImages.map((image) => (
                          <div
                            key={image.id}
                            className="relative group rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700 aspect-square"
                          >
                            <img src={image.url} alt={image.original_name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <a href={image.url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 bg-white/20 rounded-full hover:bg-white/30">
                                <Eye className="w-3 h-3 text-white" />
                              </a>
                              <a href={image.url} download={image.original_name}
                                className="p-1.5 bg-white/20 rounded-full hover:bg-white/30">
                                <Download className="w-3 h-3 text-white" />
                              </a>
                            </div>
                            {image.tags && image.tags.length > 0 && (
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] bg-black/60 text-white rounded">
                                {image.tags[0] === 'before' ? 'Före' : image.tags[0] === 'after' ? 'Efter' : 'Övrigt'}
                              </span>
                            )}
                          </div>
                        ))
                      : (fallbackData.files || []).map((file, index) => {
                          const isImage = file.type.startsWith('image/')
                          return (
                            <div key={index}
                              className="relative group rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700 aspect-square">
                              {isImage
                                ? <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><FileText className="w-6 h-6 text-slate-400" /></div>
                              }
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <a href={file.url} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 bg-white/20 rounded-full hover:bg-white/30">
                                  <Eye className="w-3 h-3 text-white" />
                                </a>
                                <a href={file.url} download={file.name}
                                  className="p-1.5 bg-white/20 rounded-full hover:bg-white/30">
                                  <Download className="w-3 h-3 text-white" />
                                </a>
                              </div>
                            </div>
                          )
                        })
                    }
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── CLICKUP-VY (taskDetails) ────────────────────── */}
          {taskDetails && (
            <>
              {/* Status + datum */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  {(() => {
                    const st = taskDetails.task_info.status
                    const dot = getStatusDotColor(st)
                    return (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: dot }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />
                        {st}
                      </span>
                    )
                  })()}
                  {taskDetails.priority && getPriorityDisplay(taskDetails.priority.priority)}
                </div>
                <span className="text-xs text-slate-500">
                  Skapat {formatDate(taskDetails.task_info.created)}
                </span>
              </div>

              {/* Beskrivning */}
              {taskDetails.task_info.description && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Beskrivning</p>
                  <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{taskDetails.task_info.description}</p>
                  </div>
                </div>
              )}

              {/* Teknikerrapport */}
              {reportField && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Teknikerrapport</p>
                  <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{reportField.value}</p>
                  </div>
                </div>
              )}

              {/* Rekommendationer */}
              {fallbackData?.recommendations && (
                <div>
                  <p className="text-xs font-medium text-amber-500/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Teknikerns rekommendationer
                  </p>
                  <div className="bg-amber-500/5 border-l-2 border-amber-500/40 rounded-r-xl px-4 py-3">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{fallbackData.recommendations}</p>
                  </div>
                </div>
              )}

              {/* Grid: Adress + Tekniker + Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addressField && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Adress
                    </p>
                    <p className="text-sm text-white">{addressField.value.formatted_address}</p>
                    <button
                      className="mt-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      onClick={() => {
                        const { lat, lng } = addressField.value.location
                        window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank')
                      }}
                    >
                      Visa på karta
                    </button>
                  </div>
                )}

                {taskDetails.assignees.length > 0 && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tekniker</p>
                    {taskDetails.assignees.map((assignee, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-xs font-semibold shrink-0">
                          {assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">{assignee.name}</p>
                          <a
                            href={`mailto:${assignee.email}?subject=Fråga om ärende ${taskDetails.task_info.name}`}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors truncate block"
                          >
                            {assignee.email}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(pestField || caseTypeField || (priceField && priceField.has_value && priceField.value > 0)) && (
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 px-4 py-3 space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ärendeinfo</p>
                    {pestField && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Skadedjur</span>
                        <span className="text-xs text-white">{getDropdownText(pestField)}</span>
                      </div>
                    )}
                    {caseTypeField && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Ärendetyp</span>
                        <span className="text-xs text-white">{getDropdownText(caseTypeField)}</span>
                      </div>
                    )}
                    {priceField && priceField.has_value && priceField.value > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Kostnad</span>
                        <span className="text-xs text-white font-medium">{priceField.value} kr</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preparat */}
              {caseId && fallbackData?.pest_type !== 'Inspektion' && (
                <CasePreparationsSection
                  caseId={caseId}
                  caseType="contract"
                  pestType={fallbackData?.pest_type || null}
                  isReadOnly={true}
                />
              )}

              {/* Filer från ClickUp */}
              {filesField && filesField.value && Array.isArray(filesField.value) && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5" />
                    Filer ({filesField.value.length})
                  </p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {filesField.value.map((file: any) => (
                      <div key={file.id}
                        className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 rounded-lg hover:bg-slate-800/60 transition-colors border border-slate-700/40">
                        <div className="text-slate-500">{getFileIcon(file.mimetype)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{file.title}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => window.open(file.url_w_query, '_blank')}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const link = document.createElement('a')
                              link.href = file.url_w_host
                              link.download = file.title
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between shrink-0">
          <a href="tel:010-280-44-10" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            010 280 44 10
          </a>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>

      {/* Close Warning Dialog */}
      <CloseWarningDialog
        isOpen={showCloseWarning}
        onClose={() => setShowCloseWarning(false)}
        onConfirmClose={handleConfirmClose}
        onGoBack={handleGoBack}
      />

      {/* Foto-lightbox */}
      <InspectionPhotoLightbox
        photos={inspectionPhotos}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>,
    document.body
  )
}