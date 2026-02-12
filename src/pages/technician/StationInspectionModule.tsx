// src/pages/technician/StationInspectionModule.tsx
// UPGRADED VERSION - Med karta, planritningar, foto, mätvärden och historik

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Camera,
  History,
  Map,
  List,
  Upload,
  Trash2,
  Image as ImageIcon,
  Clock,
  User,
  FileText,
  Phone,
  Navigation,
  Copy,
  AlertTriangle,
  Calendar,
  Info,
  ExternalLink,
  BarChart2,
  SkipForward,
  Unlock,
  Beaker
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Komponenter för karta och planritning
import { EquipmentMap } from '../../components/shared/equipment'
import { FloorPlanViewer } from '../../components/shared/indoor/FloorPlanViewer'

// Service-funktioner
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer,
  getFloorPlansForCustomer,
  startInspectionSession,
  completeInspectionSession,
  createOutdoorInspection,
  createIndoorInspection,
  updateInspectionSession,
  uploadInspectionPhoto,
  getInspectionPhotoUrl,
  getLastInspectionSummary,
  getStationsWithRecentActivity,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession,
  reopenInspectionSession,
  updateCaseStatusToCompleted
} from '../../services/inspectionSessionService'
import { PreparationService } from '../../services/preparationService'
import type { Preparation } from '../../types/preparations'

// Typer
import type {
  InspectionSessionWithRelations,
  SessionProgress
} from '../../types/inspectionSession'
import type { InspectionStatus } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'
import type { EquipmentPlacementWithRelations } from '../../types/database'
import type { IndoorStationWithRelations } from '../../types/indoor'

// Hjälpfunktion för att bestämma färg baserat på mätvärde och tröskelvärden
// direction: 'above' = värden över tröskel är dåliga (standard för förbrukning)
// direction: 'below' = värden under tröskel är dåliga
function getMeasurementColor(
  value: number | null | undefined,
  warningThreshold: number | null | undefined,
  criticalThreshold: number | null | undefined,
  direction: string | null | undefined = 'above'
): 'green' | 'amber' | 'red' | 'default' {
  if (value === null || value === undefined) return 'default'

  const isAbove = direction !== 'below'

  if (criticalThreshold !== null && criticalThreshold !== undefined) {
    if (isAbove ? value >= criticalThreshold : value <= criticalThreshold) {
      return 'red'
    }
  }

  if (warningThreshold !== null && warningThreshold !== undefined) {
    if (isAbove ? value >= warningThreshold : value <= warningThreshold) {
      return 'amber'
    }
  }

  return 'green'
}

// Lokal typ för station (både indoor och outdoor)
interface StationData {
  id: string
  serial_number?: string | null
  station_number?: string | null
  equipment_type?: string | null
  station_type?: string | null
  status: string
  latitude?: number
  longitude?: number
  position_x_percent?: number
  position_y_percent?: number
  floor_plan_id?: string | null
  placed_at?: string
  station_type_data?: {
    id: string
    name: string
    color: string
    code?: string
    measurement_unit?: string | null
    measurement_label?: string | null
    threshold_warning?: number | null
    threshold_critical?: number | null
    threshold_direction?: string | null
  } | null
  floor_plan?: {
    id: string
    name: string
    building_name?: string | null
    image_path?: string | null
  } | null
}

// Historik-typ
interface InspectionHistoryItem {
  id: string
  inspected_at: string
  status: InspectionStatus
  findings: string | null
  photo_path: string | null
  measurement_value: number | null
  measurement_unit: string | null
  technician?: {
    id: string
    name: string
  } | null
}

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [outdoorStations, setOutdoorStations] = useState<StationData[]>([])
  const [indoorStations, setIndoorStations] = useState<StationData[]>([])
  const [floorPlans, setFloorPlans] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'outdoor' | 'indoor'>('outdoor')
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null)

  // Inspektionsmodal state
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus>('ok')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [measurementValue, setMeasurementValue] = useState<string>('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedPreparationId, setSelectedPreparationId] = useState<string | null>(null)
  const [inspectedStationIds, setInspectedStationIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preparatdata
  const [preparations, setPreparations] = useState<Preparation[]>([])

  // Sammanställningspanel state - spara inspektionsresultat per station
  // OBS: Använder Record istället för Map för att undvika Vite/Terser minifieringsproblem
  const [showSummary, setShowSummary] = useState(false)
  const [inspectionResults, setInspectionResults] = useState<Record<string, {
    status: InspectionStatus
    findings: string | null
    measurementValue: number | null
    measurementUnit: string | null
    preparationId: string | null
    preparationName: string | null
    hasPhoto: boolean
    timestamp: string
  }>>({})

  // Wizard-läge state
  const [wizardMode, setWizardMode] = useState<'off' | 'outdoor' | 'indoor'>('off')
  const [currentWizardStationId, setCurrentWizardStationId] = useState<string | null>(null)
  const [wizardStationQueue, setWizardStationQueue] = useState<string[]>([])

  // Historik state
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [stationHistory, setStationHistory] = useState<InspectionHistoryItem[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // Snabb-OK bekräftelsedialog
  const [quickOkStation, setQuickOkStation] = useState<StationData | null>(null)

  // Foto lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  // Bekräftelsedialog för att avsluta inspektion
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  // Bekräftelsedialog för att låsa upp avslutad inspektion
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  // Senaste inspektion och aktivitetsstationer (för ankomstkort)
  const [lastInspection, setLastInspection] = useState<{
    completed_at: string | null
    technician_name: string | null
    total_inspected: number
    stations_with_activity: number
  } | null>(null)
  const [activityStationIds, setActivityStationIds] = useState<Set<string>>(new Set())

  // Auto-start: Om inspektion sparas före manuell start, starta sessionen automatiskt
  const [shouldAutoStartOnSave, setShouldAutoStartOnSave] = useState(false)

  // Expanderad planritning för förhandsvisning på ankomstsidan
  const [expandedFloorPlan, setExpandedFloorPlan] = useState<any | null>(null)

  // Ladda data
  useEffect(() => {
    async function loadData() {
      if (!caseId) {
        setError('Inget ärende-ID')
        setLoading(false)
        return
      }

      try {
        const sessionData = await getInspectionSessionByCaseId(caseId)

        if (!sessionData) {
          setError('Ingen inspektionssession hittades för detta ärende')
          setLoading(false)
          return
        }

        setSession(sessionData)

        const [outdoor, indoor, plans, preps] = await Promise.all([
          getOutdoorStationsForCustomer(sessionData.customer_id),
          getIndoorStationsForCustomer(sessionData.customer_id),
          getFloorPlansForCustomer(sessionData.customer_id),
          PreparationService.getActivePreparations().catch(() => [] as Preparation[])
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)
        setFloorPlans(plans)
        setPreparations(preps)

        // Välj första fliken med stationer
        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
        }

        // Välj första planritningen som default
        if (plans.length > 0) {
          setSelectedFloorPlanId(plans[0].id)
        }

        // Hämta senaste inspektion och aktivitetsstationer (för ankomstkort)
        const [lastInsp, activityIds] = await Promise.all([
          getLastInspectionSummary(sessionData.customer_id, sessionData.id),
          getStationsWithRecentActivity(sessionData.customer_id)
        ])
        setLastInspection(lastInsp)
        setActivityStationIds(activityIds)

        // ======================================================
        // ÅTERUPPTAGANDE: Ladda befintliga inspektioner om sessionen är pågående
        // ======================================================
        if (sessionData.status === 'in_progress') {
          const [existingOutdoor, existingIndoor] = await Promise.all([
            getOutdoorInspectionsForSession(sessionData.id),
            getIndoorInspectionsForSession(sessionData.id)
          ])

          // Populera inspectedStationIds och inspectionResults
          const alreadyInspectedIds = new Set<string>()
          const existingResults: Record<string, {
            status: InspectionStatus
            findings: string | null
            measurementValue: number | null
            measurementUnit: string | null
            preparationId: string | null
            preparationName: string | null
            hasPhoto: boolean
            timestamp: string
          }> = {}

          // Utomhusinspektioner
          existingOutdoor.forEach(insp => {
            alreadyInspectedIds.add(insp.station_id)
            const prep = preps.find(p => p.id === (insp as any).preparation_id)
            existingResults[insp.station_id] = {
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              measurementValue: insp.measurement_value,
              measurementUnit: insp.measurement_unit,
              preparationId: (insp as any).preparation_id || null,
              preparationName: prep?.name || null,
              hasPhoto: !!insp.photo_path,
              timestamp: insp.inspected_at
            }
          })

          // Inomhusinspektioner
          existingIndoor.forEach(insp => {
            alreadyInspectedIds.add(insp.station_id)
            const prep = preps.find(p => p.id === (insp as any).preparation_id)
            existingResults[insp.station_id] = {
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              measurementValue: insp.measurement_value,
              measurementUnit: insp.measurement_unit,
              preparationId: (insp as any).preparation_id || null,
              preparationName: prep?.name || null,
              hasPhoto: !!insp.photo_path,
              timestamp: insp.inspected_at
            }
          })

          const inspectedCount = Object.keys(existingResults).length
          if (inspectedCount > 0) {
            setInspectedStationIds(alreadyInspectedIds)
            setInspectionResults(existingResults)
            console.log(`Laddade ${inspectedCount} befintliga inspektioner för återupptagande`)
          }
        }

      } catch (err) {
        console.error('Error loading data:', err)
        setError('Kunde inte ladda inspektionsdata')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  // Beräkna progress
  const progress: SessionProgress | null = session ? {
    totalStations: session.total_outdoor_stations + session.total_indoor_stations,
    inspectedStations: session.inspected_outdoor_stations + session.inspected_indoor_stations,
    percentComplete: Math.round(
      ((session.inspected_outdoor_stations + session.inspected_indoor_stations) /
      Math.max(session.total_outdoor_stations + session.total_indoor_stations, 1)) * 100
    ),
    outdoorProgress: {
      total: session.total_outdoor_stations,
      inspected: session.inspected_outdoor_stations
    },
    indoorProgress: {
      total: session.total_indoor_stations,
      inspected: session.inspected_indoor_stations
    }
  } : null

  // Hämta nuvarande planritnings-bild URL
  const currentFloorPlan = useMemo(() => {
    if (!selectedFloorPlanId) return null
    return floorPlans.find(fp => fp.id === selectedFloorPlanId)
  }, [selectedFloorPlanId, floorPlans])

  const [floorPlanImageUrl, setFloorPlanImageUrl] = useState<string>('')

  // Hämta signerad URL för planritning
  useEffect(() => {
    async function fetchSignedUrl() {
      if (!currentFloorPlan?.image_path) {
        setFloorPlanImageUrl('')
        return
      }

      const { data, error } = await supabase.storage
        .from('floor-plans')
        .createSignedUrl(currentFloorPlan.image_path, 3600) // 1 timme

      if (error) {
        console.error('Fel vid hämtning av signerad URL:', error)
        setFloorPlanImageUrl('')
        return
      }

      setFloorPlanImageUrl(data.signedUrl)
    }

    fetchSignedUrl()
  }, [currentFloorPlan])

  // Filtrera inomhusstationer för vald planritning
  const filteredIndoorStations = useMemo(() => {
    if (!selectedFloorPlanId) return []
    return indoorStations.filter(s => s.floor_plan_id === selectedFloorPlanId)
  }, [indoorStations, selectedFloorPlanId])

  // Skapa nummermappning för outdoor stationer (baserat på placed_at, äldsta = 1)
  const outdoorNumberMap = useMemo((): Record<string, number> => {
    const sorted = [...outdoorStations].sort((a, b) => {
      const dateA = new Date(a.placed_at || 0).getTime()
      const dateB = new Date(b.placed_at || 0).getTime()
      return dateA - dateB
    })
    const map: Record<string, number> = {}
    sorted.forEach((station, index) => {
      map[station.id] = index + 1
    })
    return map
  }, [outdoorStations])

  // Skapa nummermappning för indoor stationer per planritning (baserat på placed_at)
  const indoorNumberMap = useMemo((): Record<string, number> => {
    const sorted = [...filteredIndoorStations].sort((a, b) => {
      const dateA = new Date(a.placed_at || 0).getTime()
      const dateB = new Date(b.placed_at || 0).getTime()
      return dateA - dateB
    })
    const map: Record<string, number> = {}
    sorted.forEach((station, index) => {
      map[station.id] = index + 1
    })
    return map
  }, [filteredIndoorStations])

  // Konvertera outdoor stations till EquipmentPlacementWithRelations format för kartan
  const outdoorEquipment: EquipmentPlacementWithRelations[] = useMemo(() => {
    return outdoorStations
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        id: s.id,
        customer_id: session?.customer_id || '',
        serial_number: s.serial_number || s.station_number || '',
        equipment_type: s.equipment_type || s.station_type || 'unknown',
        status: s.status as any,
        latitude: s.latitude!,
        longitude: s.longitude!,
        placed_at: s.placed_at || new Date().toISOString(),
        notes: null,
        station_type_id: s.station_type_data?.id || null,
        station_type_data: s.station_type_data ? {
          id: s.station_type_data.id,
          code: s.station_type_data.code || '',
          name: s.station_type_data.name,
          color: s.station_type_data.color,
          icon: 'target',
          prefix: '',
          description: null,
          is_active: true,
          measurement_unit: s.station_type_data.measurement_unit as any,
          measurement_label: s.station_type_data.measurement_label || null,
          threshold_warning: s.station_type_data.threshold_warning ? String(s.station_type_data.threshold_warning) : null,
          threshold_critical: s.station_type_data.threshold_critical ? String(s.station_type_data.threshold_critical) : null,
          threshold_direction: s.station_type_data.threshold_direction as any,
          sort_order: 0,
          created_at: '',
          updated_at: ''
        } : null
      })) as EquipmentPlacementWithRelations[]
  }, [outdoorStations, session])

  // Konvertera indoor stations till IndoorStationWithRelations format för FloorPlanViewer
  const indoorStationsForViewer: IndoorStationWithRelations[] = useMemo(() => {
    return filteredIndoorStations.map(s => ({
      id: s.id,
      floor_plan_id: s.floor_plan_id || '',
      station_type: (s.station_type || 'bait_station') as any,
      station_number: s.station_number || s.serial_number || null,
      position_x_percent: s.position_x_percent || 50,
      position_y_percent: s.position_y_percent || 50,
      status: s.status as any,
      notes: null,
      placed_at: s.placed_at || new Date().toISOString(),
      placed_by: null,
      station_type_id: s.station_type_data?.id || null,
      calculated_status: null,
      station_type_data: s.station_type_data ? {
        id: s.station_type_data.id,
        code: s.station_type_data.code || '',
        name: s.station_type_data.name,
        color: s.station_type_data.color,
        icon: 'target',
        prefix: '',
        description: null,
        is_active: true,
        measurement_unit: s.station_type_data.measurement_unit as any,
        measurement_label: s.station_type_data.measurement_label || null,
        threshold_warning: s.station_type_data.threshold_warning ? String(s.station_type_data.threshold_warning) : null,
        threshold_critical: s.station_type_data.threshold_critical ? String(s.station_type_data.threshold_critical) : null,
        threshold_direction: s.station_type_data.threshold_direction as any,
        sort_order: 0,
        created_at: '',
        updated_at: ''
      } : null,
      floor_plan: s.floor_plan ? {
        id: s.floor_plan.id,
        customer_id: session?.customer_id || '',
        name: s.floor_plan.name,
        building_name: s.floor_plan.building_name || null,
        floor_number: null,
        image_path: s.floor_plan.image_path || null,
        image_width: null,
        image_height: null,
        sort_order: 0,
        created_at: ''
      } : undefined
    })) as IndoorStationWithRelations[]
  }, [filteredIndoorStations, session])

  // Starta inspektion
  const handleStartInspection = async () => {
    if (!session) return

    try {
      setIsSubmitting(true)
      const updated = await startInspectionSession(session.id)
      if (updated) {
        setSession({ ...session, status: 'in_progress', started_at: new Date().toISOString() })
        toast.success('Inspektion startad!')
      }
    } catch (err) {
      toast.error('Kunde inte starta inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Välj station (från karta, planritning eller lista)
  // Tillåter klick även under 'scheduled' - auto-start vid första sparning
  const handleSelectStation = useCallback(async (station: StationData) => {
    // Om session inte är startad, markera för auto-start vid första sparning
    if (session?.status === 'scheduled') {
      setShouldAutoStartOnSave(true)
    }

    setSelectedStation(station)
    setSelectedStatus('ok')
    setInspectionNotes('')
    setMeasurementValue('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setShowHistory(true) // Visa historik inline automatiskt
    setStationHistory([])
    setHistoryLoading(true)

    // Ladda historik automatiskt
    try {
      const isOutdoor = outdoorStations.some(s => s.id === station.id)
      const tableName = isOutdoor ? 'outdoor_station_inspections' : 'indoor_station_inspections'

      const { data, error } = await supabase
        .from(tableName)
        .select(`
          id,
          inspected_at,
          status,
          findings,
          photo_path,
          measurement_value,
          measurement_unit,
          technician:technicians(id, name)
        `)
        .eq('station_id', station.id)
        .order('inspected_at', { ascending: false })
        .limit(5)

      if (error) throw error

      // Hämta foto-URLs
      const historyWithPhotos = await Promise.all(
        (data || []).map(async (item: any) => {
          let photoUrl = null
          if (item.photo_path) {
            photoUrl = await getInspectionPhotoUrl(item.photo_path)
          }
          return { ...item, photo_url: photoUrl }
        })
      )

      setStationHistory(historyWithPhotos)
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [session?.status, outdoorStations])

  // Hantera klick på outdoor station (från kartan)
  const handleOutdoorStationClick = useCallback((equipment: EquipmentPlacementWithRelations) => {
    const station = outdoorStations.find(s => s.id === equipment.id)
    if (station) {
      handleSelectStation(station)
    }
  }, [outdoorStations, handleSelectStation])

  // Hantera klick på indoor station (från planritning)
  const handleIndoorStationClick = useCallback((indoorStation: IndoorStationWithRelations) => {
    const station = indoorStations.find(s => s.id === indoorStation.id)
    if (station) {
      handleSelectStation(station)
    }
  }, [indoorStations, handleSelectStation])

  // ============================================
  // WIZARD-LÄGE FUNKTIONER
  // ============================================

  // Starta outdoor wizard
  const startOutdoorWizard = useCallback(() => {
    if (session?.status === 'completed') {
      toast.error('Inspektionen är avslutad')
      return
    }

    // Bygg kö av ej-inspekterade stationer, sorterade efter nummer
    const uninspected = outdoorStations
      .filter(s => !inspectedStationIds.has(s.id))
      .sort((a, b) => {
        const numA = outdoorNumberMap[a.id] || 999
        const numB = outdoorNumberMap[b.id] || 999
        return numA - numB
      })

    if (uninspected.length === 0) {
      toast.success('Alla utomhusstationer är redan kontrollerade!')
      return
    }

    const queue = uninspected.map(s => s.id)
    setWizardStationQueue(queue)
    setCurrentWizardStationId(queue[0])
    setWizardMode('outdoor')

    // Stationen pulserar nu - teknikern klickar själv på den
    toast.success(`Guide startad! Klicka på den pulserande stationen.`)
  }, [session?.status, outdoorStations, inspectedStationIds, outdoorNumberMap])

  // Starta indoor wizard för vald planritning
  const startIndoorWizard = useCallback(() => {
    if (session?.status === 'completed') {
      toast.error('Inspektionen är avslutad')
      return
    }

    if (!selectedFloorPlanId) {
      toast.error('Välj en planritning först')
      return
    }

    // Bygg kö av ej-inspekterade stationer på denna planritning
    const uninspected = filteredIndoorStations
      .filter(s => !inspectedStationIds.has(s.id))
      .sort((a, b) => {
        const numA = indoorNumberMap[a.id] || 999
        const numB = indoorNumberMap[b.id] || 999
        return numA - numB
      })

    if (uninspected.length === 0) {
      toast.success('Alla inomhusstationer på denna planritning är redan kontrollerade!')
      return
    }

    const queue = uninspected.map(s => s.id)
    setWizardStationQueue(queue)
    setCurrentWizardStationId(queue[0])
    setWizardMode('indoor')

    // Stationen pulserar nu - teknikern klickar själv på den
    toast.success(`Guide startad! Klicka på den pulserande stationen.`)
  }, [session?.status, selectedFloorPlanId, filteredIndoorStations, inspectedStationIds, indoorNumberMap])

  // Gå till nästa station i wizard
  const wizardNextStation = useCallback(() => {
    if (wizardMode === 'off' || wizardStationQueue.length === 0) return

    // Hitta index för nuvarande station och gå till nästa
    const currentIndex = wizardStationQueue.indexOf(currentWizardStationId || '')
    const nextIndex = currentIndex + 1

    if (nextIndex >= wizardStationQueue.length) {
      // Wizard klar!
      setWizardMode('off')
      setCurrentWizardStationId(null)
      setWizardStationQueue([])
      toast.success('🎉 Alla stationer kontrollerade!')
      return
    }

    const nextStationId = wizardStationQueue[nextIndex]
    setCurrentWizardStationId(nextStationId)
    // Stationen pulserar nu - teknikern klickar själv på den
  }, [wizardMode, wizardStationQueue, currentWizardStationId])

  // Gå till föregående station i wizard
  const wizardPrevStation = useCallback(() => {
    if (wizardMode === 'off' || wizardStationQueue.length === 0) return

    const currentIndex = wizardStationQueue.indexOf(currentWizardStationId || '')
    const prevIndex = currentIndex - 1

    if (prevIndex < 0) {
      toast('Du är på första stationen')
      return
    }

    const prevStationId = wizardStationQueue[prevIndex]
    setCurrentWizardStationId(prevStationId)
    // Stationen pulserar nu - teknikern klickar själv på den
  }, [wizardMode, wizardStationQueue, currentWizardStationId])

  // Hoppa över station i wizard
  const wizardSkipStation = useCallback(() => {
    if (wizardMode === 'off') return

    // Flytta aktuell station till slutet av kön
    const currentId = currentWizardStationId
    if (!currentId) return

    setWizardStationQueue(prev => {
      const withoutCurrent = prev.filter(id => id !== currentId)
      return [...withoutCurrent, currentId]
    })

    // Gå till nästa (som nu är först i kön)
    const newQueue = wizardStationQueue.filter(id => id !== currentId)
    if (newQueue.length > 0) {
      const nextId = newQueue[0]
      setCurrentWizardStationId(nextId)
      // Stationen pulserar nu - teknikern klickar själv på den
    }

    toast('Station hoppades över')
  }, [wizardMode, currentWizardStationId, wizardStationQueue])

  // Avsluta wizard
  const stopWizard = useCallback(() => {
    setWizardMode('off')
    setCurrentWizardStationId(null)
    setWizardStationQueue([])
    setSelectedStation(null)
    toast('Guide avslutad')
  }, [])

  // Auto-progress till nästa efter lyckad inspektion (om wizard är aktiv)
  useEffect(() => {
    // Om en station just inspekterades och wizard är aktiv, gå till nästa
    if (wizardMode !== 'off' && currentWizardStationId && inspectedStationIds.has(currentWizardStationId)) {
      // Kort delay för att visa feedback innan vi går vidare
      const timer = setTimeout(() => {
        wizardNextStation()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [wizardMode, currentWizardStationId, inspectedStationIds, wizardNextStation])

  // ============================================

  // Hantera fototagning/uppladdning
  const handlePhotoCapture = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validera filtyp
      if (!file.type.startsWith('image/')) {
        toast.error('Endast bildfiler tillåtna')
        return
      }
      // Validera storlek (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Bilden får max vara 10MB')
        return
      }
      setPhotoFile(file)
      // Skapa förhandsvisning
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Ladda stationshistorik
  const handleLoadHistory = async () => {
    if (!selectedStation) return

    setHistoryLoading(true)
    setShowHistory(true)

    try {
      const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)
      const tableName = isOutdoor ? 'outdoor_station_inspections' : 'indoor_station_inspections'

      const { data, error } = await supabase
        .from(tableName)
        .select(`
          id,
          inspected_at,
          status,
          findings,
          photo_path,
          measurement_value,
          measurement_unit,
          technician:technicians(id, name)
        `)
        .eq('station_id', selectedStation.id)
        .order('inspected_at', { ascending: false })
        .limit(20)

      if (error) throw error

      // Hämta foto-URLs för de med photo_path
      const historyWithPhotos = await Promise.all(
        (data || []).map(async (item: any) => {
          let photoUrl = null
          if (item.photo_path) {
            photoUrl = await getInspectionPhotoUrl(item.photo_path)
          }
          return {
            ...item,
            photo_url: photoUrl
          }
        })
      )

      setStationHistory(historyWithPhotos)
    } catch (err) {
      console.error('Error loading history:', err)
      toast.error('Kunde inte ladda historik')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Spara stationsinspektion
  const handleSaveInspection = async () => {
    if (!session || !selectedStation) return

    try {
      setIsSubmitting(true)

      // Auto-starta session om det är första inspektionen (innan manuell start)
      let currentSession = session
      if (shouldAutoStartOnSave && session.status === 'scheduled') {
        const updated = await startInspectionSession(session.id)
        if (updated) {
          currentSession = { ...session, status: 'in_progress', started_at: new Date().toISOString() }
          setSession(currentSession)
          setShouldAutoStartOnSave(false)
          toast.success('Inspektion startad!')
        } else {
          toast.error('Kunde inte starta inspektionen')
          setIsSubmitting(false)
          return
        }
      }

      let photoPath: string | null = null

      // Ladda upp foto om det finns
      if (photoFile) {
        const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)
        photoPath = await uploadInspectionPhoto(
          photoFile,
          selectedStation.id,
          isOutdoor ? 'outdoor' : 'indoor'
        )
        if (!photoPath) {
          toast.error('Kunde inte ladda upp foto')
          setIsSubmitting(false)
          return
        }
      }

      const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)
      const measurementUnit = selectedStation.station_type_data?.measurement_unit || null

      const inspectionData = {
        station_id: selectedStation.id,
        session_id: currentSession.id,
        status: selectedStatus,
        findings: inspectionNotes || undefined,
        photo_path: photoPath || undefined,
        measurement_value: measurementValue ? parseFloat(measurementValue) : undefined,
        measurement_unit: measurementUnit || undefined,
        preparation_id: selectedPreparationId || undefined
      }

      if (isOutdoor) {
        await createOutdoorInspection(inspectionData, currentSession.technician_id || undefined)

        // Uppdatera session count
        await updateInspectionSession(currentSession.id, {
          inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
        })

        setSession({
          ...currentSession,
          inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
        })
      } else {
        await createIndoorInspection(inspectionData, currentSession.technician_id || undefined)

        await updateInspectionSession(currentSession.id, {
          inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
        })

        setSession({
          ...currentSession,
          inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
        })
      }

      // Markera som inspekterad
      setInspectedStationIds(prev => new Set(prev).add(selectedStation.id))

      // Spara resultat till sammanställning
      const selectedPrep = preparations.find(p => p.id === selectedPreparationId)
      setInspectionResults(prev => ({
        ...prev,
        [selectedStation.id]: {
          status: selectedStatus,
          findings: inspectionNotes || null,
          measurementValue: measurementValue ? parseFloat(measurementValue) : null,
          measurementUnit: measurementUnit || null,
          preparationId: selectedPreparationId,
          preparationName: selectedPrep?.name || null,
          hasPhoto: !!photoPath,
          timestamp: new Date().toISOString()
        }
      }))

      toast.success('Inspektion sparad!')
      setSelectedStation(null)
      setSelectedStatus('ok')
      setInspectionNotes('')
      setMeasurementValue('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setSelectedPreparationId(null)

    } catch (err) {
      console.error('Error saving inspection:', err)
      toast.error('Kunde inte spara inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Snabb-OK: Visa bekräftelsedialog
  const handleQuickOk = (station: StationData, e: React.MouseEvent) => {
    e.stopPropagation() // Förhindra att modalen öppnas
    if (!session || session.status === 'completed') return
    setQuickOkStation(station) // Visa bekräftelsedialog
  }

  // Bekräfta snabb-OK: Faktiskt spara
  const confirmQuickOk = async () => {
    if (!quickOkStation || !session) return

    try {
      // Auto-starta session om det behövs
      let currentSession = session
      if (session.status === 'scheduled') {
        const updated = await startInspectionSession(session.id)
        if (updated) {
          currentSession = { ...session, status: 'in_progress', started_at: new Date().toISOString() }
          setSession(currentSession)
          toast.success('Inspektion startad!')
        } else {
          toast.error('Kunde inte starta inspektionen')
          setQuickOkStation(null)
          return
        }
      }

      const isOutdoor = outdoorStations.some(s => s.id === quickOkStation.id)

      const inspectionData = {
        station_id: quickOkStation.id,
        session_id: currentSession.id,
        status: 'ok' as InspectionStatus,
      }

      if (isOutdoor) {
        await createOutdoorInspection(inspectionData, currentSession.technician_id || undefined)
        await updateInspectionSession(currentSession.id, {
          inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
        })
        setSession({
          ...currentSession,
          inspected_outdoor_stations: currentSession.inspected_outdoor_stations + 1
        })
      } else {
        await createIndoorInspection(inspectionData, currentSession.technician_id || undefined)
        await updateInspectionSession(currentSession.id, {
          inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
        })
        setSession({
          ...currentSession,
          inspected_indoor_stations: currentSession.inspected_indoor_stations + 1
        })
      }

      setInspectedStationIds(prev => new Set(prev).add(quickOkStation.id))
      setInspectionResults(prev => ({
        ...prev,
        [quickOkStation.id]: {
          status: 'ok',
          findings: null,
          measurementValue: null,
          measurementUnit: null,
          preparationId: null,
          preparationName: null,
          hasPhoto: false,
          timestamp: new Date().toISOString()
        }
      }))

      toast.success('Station markerad som OK')
      setQuickOkStation(null) // Stäng dialog
    } catch (err) {
      console.error('Error quick-OK inspection:', err)
      toast.error('Kunde inte spara')
      setQuickOkStation(null)
    }
  }

  // Avsluta inspektion
  const handleCompleteInspection = async () => {
    if (!session) return

    try {
      setIsSubmitting(true)
      const updated = await completeInspectionSession(session.id)
      if (updated) {
        // Uppdatera även ärendets status till "Avslutat" om case_id finns
        if (session.case_id) {
          await updateCaseStatusToCompleted(session.case_id)
        }
        toast.success('Inspektion avslutad!')
        navigate(-1)
      }
    } catch (err) {
      toast.error('Kunde inte avsluta inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Lås upp avslutad inspektion för korrigering
  const handleReopenInspection = async () => {
    if (!session) return

    try {
      setIsSubmitting(true)
      const updated = await reopenInspectionSession(session.id)
      if (updated) {
        setSession({ ...session, ...updated })
        toast.success('Inspektionen är nu öppen för korrigering')
      }
    } catch (err) {
      toast.error('Kunde inte öppna inspektionen')
    } finally {
      setIsSubmitting(false)
      setShowReopenConfirm(false)
    }
  }

  // Statusval
  const STATUS_OPTIONS = (Object.keys(INSPECTION_STATUS_CONFIG) as InspectionStatus[]).map(key => ({
    key,
    label: INSPECTION_STATUS_CONFIG[key].label,
    icon: INSPECTION_STATUS_CONFIG[key].icon,
    color: INSPECTION_STATUS_CONFIG[key].color
  }))

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar inspektion..." />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400 text-center">{error}</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>
      </div>
    )
  }

  // Get current stations for list view
  const currentStations = activeTab === 'outdoor' ? outdoorStations : indoorStations

  // Hjälpfunktioner för navigation och kontakt
  const handleNavigate = () => {
    const address = session?.customer?.contact_address
    if (!address) {
      toast.error('Ingen adress tillgänglig')
      return
    }
    // Öppna Google Maps med adressen
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank')
  }

  const handleCopyAddress = async () => {
    const address = session?.customer?.contact_address
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      toast.success('Adress kopierad!')
    } catch {
      toast.error('Kunde inte kopiera adress')
    }
  }

  const handleCall = () => {
    const phone = session?.customer?.contact_phone
    if (!phone) {
      toast.error('Inget telefonnummer tillgängligt')
      return
    }
    window.location.href = `tel:${phone}`
  }

  // Formatera datum
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-950"
    >
      {/* Header - Kompakt för aktiv inspektion */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-white">Stationskontroll</h1>
                <p className="text-slate-400 text-sm">{session?.customer?.company_name}</p>
              </div>
            </div>

            {/* Session status - bara visa när aktiv */}
            {session?.status === 'in_progress' && progress && progress.inspectedStations > 0 && (
              <Button onClick={() => setShowCompleteConfirm(true)} loading={isSubmitting}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Markera som färdig
              </Button>
            )}

            {/* Lås upp-knapp för avslutade inspektioner */}
            {session?.status === 'completed' && (
              <Button
                onClick={() => setShowReopenConfirm(true)}
                loading={isSubmitting}
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 bg-transparent"
              >
                <Unlock className="w-4 h-4 mr-2" />
                Lås upp
              </Button>
            )}
          </div>

          {/* Progress - visa för både in_progress och completed */}
          {session && progress && (
            <div className="mb-4">
              {/* Avslutad-badge */}
              {session.status === 'completed' && (
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">Inspektion avslutad</span>
                  {session.completed_at && (
                    <span className="text-slate-500 text-sm">
                      {new Date(session.completed_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} kl {new Date(session.completed_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}

              <div className="flex justify-between text-sm text-slate-400 mb-1">
                <span>{progress.inspectedStations} av {progress.totalStations} stationer</span>
                <span>{progress.percentComplete}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentComplete}%` }}
                  className="bg-green-500 h-2 rounded-full"
                />
              </div>

              {/* Återupptagande-info - visas om det redan finns inspekterade stationer vid sidladdning */}
              {inspectedStationIds.size > 0 && session?.status === 'in_progress' && progress && progress.inspectedStations > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-amber-200 text-sm">
                    Du fortsätter en påbörjad inspektion. {inspectedStationIds.size} stationer är redan kontrollerade.
                  </span>
                </motion.div>
              )}

              {/* Sammanställningsknapp - visa endast om det finns inspekterade stationer */}
              {inspectedStationIds.size > 0 && (
                <button
                  onClick={() => setShowSummary(!showSummary)}
                  className="mt-2 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>Sammanställning ({inspectedStationIds.size} st)</span>
                  {showSummary ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Sammanställningspanel - kollapsbar */}
          <AnimatePresence>
            {showSummary && inspectedStationIds.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="bg-slate-800/50 rounded-xl p-4 max-h-64 overflow-y-auto">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Inspekterade stationer
                  </h3>

                  {/* Utomhus-sektion */}
                  {(() => {
                    const inspectedOutdoor = outdoorStations.filter(s => inspectedStationIds.has(s.id))
                    if (inspectedOutdoor.length === 0) return null
                    return (
                      <div className="mb-3">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Utomhus ({inspectedOutdoor.length})
                        </p>
                        <div className="space-y-1.5">
                          {inspectedOutdoor.map(station => {
                            const result = inspectionResults[station.id]
                            const stationNumber = outdoorNumberMap[station.id] || '?'
                            return (
                              <div key={station.id} className="flex items-center gap-2 text-sm bg-slate-900/50 rounded-lg px-3 py-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{ backgroundColor: '#22c55e' }}
                                >
                                  ✓
                                </div>
                                <span className="text-white">Station {stationNumber}</span>
                                {result && (
                                  <>
                                    <span className="text-lg">{INSPECTION_STATUS_CONFIG[result.status]?.icon}</span>
                                    {result.measurementValue !== null && (
                                      <span className="text-slate-400 text-xs">
                                        {result.measurementValue} {result.measurementUnit === 'gram' ? 'g' : result.measurementUnit}
                                      </span>
                                    )}
                                    {result.preparationName && (
                                      <span className="text-emerald-400/70 text-xs flex items-center gap-0.5">
                                        <Beaker className="w-3 h-3" />{result.preparationName}
                                      </span>
                                    )}
                                    {result.hasPhoto && <Camera className="w-3.5 h-3.5 text-slate-500" />}
                                    {result.findings && (
                                      <span className="text-slate-400 text-xs truncate max-w-24" title={result.findings}>
                                        "{result.findings}"
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Inomhus-sektion */}
                  {(() => {
                    const inspectedIndoor = indoorStations.filter(s => inspectedStationIds.has(s.id))
                    if (inspectedIndoor.length === 0) return null
                    return (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          Inomhus ({inspectedIndoor.length})
                        </p>
                        <div className="space-y-1.5">
                          {inspectedIndoor.map(station => {
                            const result = inspectionResults[station.id]
                            const stationNumber = indoorNumberMap[station.id] || '?'
                            const floorPlan = floorPlans.find(fp => fp.id === station.floor_plan_id)
                            return (
                              <div key={station.id} className="flex items-center gap-2 text-sm bg-slate-900/50 rounded-lg px-3 py-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{ backgroundColor: '#22c55e' }}
                                >
                                  ✓
                                </div>
                                <span className="text-white">Station {stationNumber}</span>
                                {floorPlan && (
                                  <span className="text-slate-500 text-xs">({floorPlan.name})</span>
                                )}
                                {result && (
                                  <>
                                    <span className="text-lg">{INSPECTION_STATUS_CONFIG[result.status]?.icon}</span>
                                    {result.measurementValue !== null && (
                                      <span className="text-slate-400 text-xs">
                                        {result.measurementValue} {result.measurementUnit === 'gram' ? 'g' : result.measurementUnit}
                                      </span>
                                    )}
                                    {result.preparationName && (
                                      <span className="text-emerald-400/70 text-xs flex items-center gap-0.5">
                                        <Beaker className="w-3 h-3" />{result.preparationName}
                                      </span>
                                    )}
                                    {result.hasPhoto && <Camera className="w-3.5 h-3.5 text-slate-500" />}
                                    {result.findings && (
                                      <span className="text-slate-400 text-xs truncate max-w-24" title={result.findings}>
                                        "{result.findings}"
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Statistik-sammanfattning */}
                  <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-400">
                        {Object.values(inspectionResults).filter(r => r.status === 'ok').length}
                      </p>
                      <p className="text-xs text-slate-500">OK</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-400">
                        {Object.values(inspectionResults).filter(r => r.status === 'activity').length}
                      </p>
                      <p className="text-xs text-slate-500">Aktivitet</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-400">
                        {Object.values(inspectionResults).filter(r => r.status !== 'ok' && r.status !== 'activity').length}
                      </p>
                      <p className="text-xs text-slate-500">Övrigt</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs - visas alltid */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('outdoor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'outdoor'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Utomhus ({inspectedStationIds.size > 0 ? outdoorStations.filter(s => inspectedStationIds.has(s.id)).length : 0}/{outdoorStations.length})
            </button>
            <button
              onClick={() => setActiveTab('indoor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'indoor'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Inomhus ({inspectedStationIds.size > 0 ? indoorStations.filter(s => inspectedStationIds.has(s.id)).length : 0}/{indoorStations.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main content - visas alltid (sessionen startas automatiskt vid första sparning) */}
      {session && (
      <div className="max-w-4xl mx-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'outdoor' ? (
            <motion.div
              key="outdoor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Guidat läge - visar vilken station som är näst */}
              {wizardMode === 'outdoor' && (
                <div className="flex items-center justify-between bg-slate-800/80 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Navigation className="w-4 h-4 text-cyan-400" />
                      <span>Station {wizardStationQueue.indexOf(currentWizardStationId || '') + 1} av {wizardStationQueue.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={wizardPrevStation}
                        disabled={wizardStationQueue.indexOf(currentWizardStationId || '') === 0}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        title="Föregående"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={wizardSkipStation}
                        className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                        title="Hoppa över"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                      <button
                        onClick={wizardNextStation}
                        className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                        title="Nästa"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={stopWizard}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Avsluta
                  </button>
                </div>
              )}

              {/* Knapp för att starta guidat läge */}
              {wizardMode !== 'outdoor' && outdoorStations.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={startOutdoorWizard}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Starta guide
                  </button>
                </div>
              )}

              {outdoorStations.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga utomhusstationer</p>
                </div>
              ) : (
                <>
                  {/* Karta */}
                  <div className="glass rounded-xl overflow-hidden">
                    <EquipmentMap
                      equipment={outdoorEquipment}
                      height="min(55vh, 450px)"
                      readOnly
                      showControls={true}
                      showNumbers={true}
                      enableClustering={false}
                      onEquipmentClick={handleOutdoorStationClick}
                      inspectedStationIds={inspectedStationIds}
                      highlightedStationId={wizardMode === 'outdoor' ? currentWizardStationId : null}
                    />
                  </div>

                  {/* Lista under kartan */}
                  <div className="space-y-3 mt-4">
                    <p className="text-sm text-slate-400 px-1">{outdoorStations.length} utomhusstationer</p>
                    {outdoorStations.map((station) => {
                      const isInspected = inspectedStationIds.has(station.id)
                      const stationNumber = outdoorNumberMap[station.id] || '?'
                      const typeName = station.station_type_data?.name || station.equipment_type || station.station_type
                      const hadActivity = activityStationIds.has(station.id)

                      return (
                        <motion.button
                          key={station.id}
                          onClick={() => handleSelectStation(station)}
                          className={`w-full glass rounded-xl p-4 text-left transition-all hover:bg-slate-800/50 cursor-pointer ${isInspected ? 'border-l-4 border-green-500' : hadActivity ? 'border-l-4 border-amber-500' : ''}`}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isInspected ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                              ) : hadActivity ? (
                                <div className="relative">
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                    style={{ backgroundColor: station.station_type_data?.color || '#6b7280' }}
                                  >
                                    {stationNumber}
                                  </div>
                                  <AlertTriangle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-amber-400" />
                                </div>
                              ) : (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{
                                    backgroundColor: station.station_type_data?.color || '#6b7280'
                                  }}
                                >
                                  {stationNumber}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-white">Station {stationNumber}</p>
                                  {hadActivity && !isInspected && (
                                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                      Aktivitet senast
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-400">{typeName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Snabb-OK-knapp */}
                              {!isInspected && session?.status !== 'completed' && (
                                <button
                                  onClick={(e) => handleQuickOk(station, e)}
                                  className="p-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg transition-colors"
                                  title="Markera som OK"
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                              )}
                              <ChevronRight className="w-5 h-5 text-slate-500" />
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="indoor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Guidat läge för inomhus */}
              {wizardMode === 'indoor' && (
                <div className="flex items-center justify-between bg-slate-800/80 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Navigation className="w-4 h-4 text-cyan-400" />
                      <span>Station {wizardStationQueue.indexOf(currentWizardStationId || '') + 1} av {wizardStationQueue.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={wizardPrevStation}
                        disabled={wizardStationQueue.indexOf(currentWizardStationId || '') === 0}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        title="Föregående"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={wizardSkipStation}
                        className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                        title="Hoppa över"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                      <button
                        onClick={wizardNextStation}
                        className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                        title="Nästa"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={stopWizard}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Avsluta
                  </button>
                </div>
              )}

              {/* Planritningsväljare med progress - liggande miniatyrer */}
              {floorPlans.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Planritningar</span>
                    {/* Knapp för att starta guidat läge för inomhus */}
                    {wizardMode !== 'indoor' && selectedFloorPlanId && filteredIndoorStations.length > 0 && (
                      <button
                        onClick={startIndoorWizard}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                      >
                        <Navigation className="w-4 h-4" />
                        Starta guide
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {floorPlans.map((fp) => {
                      // Räkna stationer och inspekterade per planritning
                      const stationsOnPlan = indoorStations.filter(s => s.floor_plan_id === fp.id)
                      const inspectedOnPlan = stationsOnPlan.filter(s => inspectedStationIds.has(s.id)).length
                      const totalOnPlan = stationsOnPlan.length
                      const allDone = totalOnPlan > 0 && inspectedOnPlan === totalOnPlan
                      const isSelected = selectedFloorPlanId === fp.id

                      return (
                        <button
                          key={fp.id}
                          onClick={() => setSelectedFloorPlanId(fp.id)}
                          className={`flex-shrink-0 w-44 rounded-xl overflow-hidden transition-all ${
                            isSelected
                              ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900'
                              : allDone
                                ? 'ring-1 ring-green-500/50'
                                : 'hover:ring-1 hover:ring-slate-600'
                          }`}
                        >
                          {/* Liggande aspect ratio för thumbnail */}
                          <div className={`aspect-[16/10] relative ${
                            isSelected ? 'bg-green-500/20' : 'bg-slate-800'
                          }`}>
                            <Building2 className="w-10 h-10 text-slate-600 absolute inset-0 m-auto" />
                            {/* Progress overlay */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent p-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className={isSelected ? 'text-green-400' : 'text-slate-300'}>
                                  {inspectedOnPlan}/{totalOnPlan}
                                </span>
                                {allDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                              </div>
                            </div>
                          </div>
                          {/* Label under thumbnail */}
                          <div className={`p-2 text-left ${
                            isSelected ? 'bg-green-500/20' : 'bg-slate-800'
                          }`}>
                            <p className={`text-xs font-medium truncate ${
                              isSelected ? 'text-green-400' : 'text-slate-300'
                            }`}>
                              {fp.building_name ? `${fp.building_name}` : fp.name}
                            </p>
                            {fp.building_name && fp.name && (
                              <p className="text-xs text-slate-500 truncate">{fp.name}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {indoorStations.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga inomhusstationer</p>
                </div>
              ) : !selectedFloorPlanId || !floorPlanImageUrl ? (
                <div className="glass rounded-xl p-8 text-center">
                  <p className="text-slate-400">Välj en planritning ovan</p>
                </div>
              ) : (
                // Floor plan viewer - ökad höjd för bättre mobil UX
                <div className="glass rounded-xl overflow-hidden">
                  <FloorPlanViewer
                    imageUrl={floorPlanImageUrl}
                    stations={indoorStationsForViewer}
                    selectedStationId={null}
                    placementMode="view"
                    onStationClick={handleIndoorStationClick}
                    height="min(55vh, 450px)"
                    showNumbers={true}
                    inspectedStationIds={inspectedStationIds}
                    highlightedStationId={wizardMode === 'indoor' ? currentWizardStationId : null}
                  />
                </div>
              )}

              {/* Indoor stations list */}
              {filteredIndoorStations.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    {filteredIndoorStations.length} stationer på denna planritning
                  </p>
                  {filteredIndoorStations.map((station) => {
                    const isInspected = inspectedStationIds.has(station.id)
                    const stationNumber = indoorNumberMap[station.id] || '?'
                    const typeName = station.station_type_data?.name || station.station_type
                    const hadActivity = activityStationIds.has(station.id)

                    return (
                      <motion.button
                        key={station.id}
                        onClick={() => handleSelectStation(station)}
                        className={`w-full glass rounded-xl p-4 text-left transition-all hover:bg-slate-800/50 cursor-pointer ${isInspected ? 'border-l-4 border-green-500' : hadActivity ? 'border-l-4 border-amber-500' : ''}`}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isInspected ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : hadActivity ? (
                              <div className="relative">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{ backgroundColor: station.station_type_data?.color || '#6b7280' }}
                                >
                                  {stationNumber}
                                </div>
                                <AlertTriangle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-amber-400" />
                              </div>
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{
                                  backgroundColor: station.station_type_data?.color || '#6b7280'
                                }}
                              >
                                {stationNumber}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">Station {stationNumber}</p>
                                {hadActivity && !isInspected && (
                                  <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                    Aktivitet senast
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-400">{typeName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Snabb-OK-knapp */}
                            {!isInspected && session?.status !== 'completed' && (
                              <button
                                onClick={(e) => handleQuickOk(station, e)}
                                className="p-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg transition-colors"
                                title="Markera som OK"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                            )}
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Snabb-OK bekräftelsedialog */}
      <AnimatePresence>
        {quickOkStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setQuickOkStation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-xl p-5 max-w-xs w-full shadow-xl border border-slate-700"
            >
              <p className="text-white text-center mb-4">
                Markera <span className="font-bold text-green-400">Station {outdoorNumberMap[quickOkStation.id] || indoorNumberMap[quickOkStation.id] || '?'}</span> som OK?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setQuickOkStation(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmQuickOk}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Foto lightbox */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxPhoto(null)}
          >
            <img
              src={lightboxPhoto}
              alt="Foto"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bekräftelsedialog för att avsluta inspektion */}
      <AnimatePresence>
        {showCompleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCompleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Markera som färdig?</h3>
              </div>

              <p className="text-slate-300 mb-2">
                Har du inspekterat alla stationer?
              </p>

              {progress && (
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Utomhus:</span>
                    <span className={progress.outdoorProgress.inspected === progress.outdoorProgress.total ? 'text-green-400' : 'text-amber-400'}>
                      {progress.outdoorProgress.inspected}/{progress.outdoorProgress.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Inomhus:</span>
                    <span className={progress.indoorProgress.inspected === progress.indoorProgress.total ? 'text-green-400' : 'text-amber-400'}>
                      {progress.indoorProgress.inspected}/{progress.indoorProgress.total}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => {
                    setShowCompleteConfirm(false)
                    handleCompleteInspection()
                  }}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
                >
                  Ja, markera färdig
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bekräftelsedialog för att låsa upp inspektion */}
      <AnimatePresence>
        {showReopenConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowReopenConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-full">
                  <Unlock className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Lås upp inspektion?</h3>
              </div>

              <p className="text-slate-300 mb-4">
                Du kan sedan korrigera eller lägga till inspektioner på stationer.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReopenConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleReopenInspection}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
                >
                  Ja, lås upp
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inspection Modal */}
      <AnimatePresence>
        {selectedStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedStation(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Sticky Header med actions */}
              <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Station {outdoorNumberMap[selectedStation.id] || indoorNumberMap[selectedStation.id] || '?'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {selectedStation.station_type_data?.name || selectedStation.equipment_type || selectedStation.station_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {session?.status === 'completed' ? 'Stäng' : 'Avbryt'}
                  </button>
                  {session?.status !== 'completed' && (
                    <Button
                      size="sm"
                      onClick={handleSaveInspection}
                      loading={isSubmitting}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Spara
                    </Button>
                  )}
                </div>
              </div>

              {/* Scrollbart innehåll */}
              <div className="flex-1 overflow-y-auto p-6">

              {/* History Panel - expanderbar med findings/foto/tekniker */}
              {historyLoading ? (
                <div className="mb-4 bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-400">Laddar historik...</span>
                  </div>
                </div>
              ) : stationHistory.length > 0 ? (
                <div className="mb-4 bg-slate-800/50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Senaste inspektioner
                  </h4>
                  <div className="space-y-2">
                    {stationHistory.slice(0, 5).map((item) => {
                      const isExpanded = expandedHistoryId === item.id
                      const hasDetails = item.findings || item.photo_url || item.technician

                      return (
                        <div key={item.id} className="bg-slate-900/50 rounded-lg overflow-hidden">
                          {/* Klickbar rubrikrad */}
                          <button
                            onClick={() => hasDetails && setExpandedHistoryId(isExpanded ? null : item.id)}
                            className={`w-full flex items-center justify-between p-2 text-xs ${
                              hasDetails ? 'hover:bg-slate-800/50 cursor-pointer' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{INSPECTION_STATUS_CONFIG[item.status]?.icon}</span>
                              <span className="text-slate-300">
                                {INSPECTION_STATUS_CONFIG[item.status]?.label || item.status}
                              </span>
                              {item.measurement_value !== null && (() => {
                                const histColor = getMeasurementColor(
                                  item.measurement_value,
                                  selectedStation?.station_type_data?.threshold_warning,
                                  selectedStation?.station_type_data?.threshold_critical,
                                  selectedStation?.station_type_data?.threshold_direction
                                )
                                const histColorClass = {
                                  green: 'text-green-400',
                                  amber: 'text-amber-400',
                                  red: 'text-red-400',
                                  default: 'text-slate-300'
                                }[histColor]
                                return (
                                  <span className={`${histColorClass} font-mono`}>
                                    {item.measurement_value}g
                                  </span>
                                )
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.technician && (
                                <span className="text-slate-500 text-[10px]">{item.technician.name}</span>
                              )}
                              <span className="text-slate-600">
                                {new Date(item.inspected_at).toLocaleDateString('sv-SE')}
                              </span>
                              {hasDetails && (
                                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              )}
                            </div>
                          </button>

                          {/* Expanderad sektion */}
                          {isExpanded && (
                            <div className="px-2 pb-2 space-y-2 border-t border-slate-700/50">
                              {item.findings && (
                                <p className="text-xs text-slate-400 italic mt-2">
                                  "{item.findings}"
                                </p>
                              )}
                              {item.photo_url && (
                                <img
                                  src={item.photo_url}
                                  alt="Tidigare foto"
                                  className="w-24 h-24 object-cover rounded-lg mt-2 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setLightboxPhoto(item.photo_url)
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Status selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedStatus(opt.key)}
                      className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all ${
                        selectedStatus === opt.key
                          ? 'bg-green-500/20 text-white border-2 border-green-500'
                          : 'bg-slate-800 text-slate-300 border-2 border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Measurement field - dynamic based on station type */}
              {selectedStation.station_type_data?.measurement_label && (() => {
                const numValue = measurementValue ? parseFloat(measurementValue) : null
                const color = getMeasurementColor(
                  numValue,
                  selectedStation.station_type_data?.threshold_warning,
                  selectedStation.station_type_data?.threshold_critical,
                  selectedStation.station_type_data?.threshold_direction
                )
                const inputColorClass = {
                  green: 'border-green-500 text-green-400',
                  amber: 'border-amber-500 text-amber-400',
                  red: 'border-red-500 text-red-400',
                  default: 'border-slate-600 text-white'
                }[color]

                return (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {selectedStation.station_type_data.measurement_label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={measurementValue}
                        onChange={(e) => setMeasurementValue(e.target.value)}
                        placeholder="0"
                        step="0.1"
                        min="0"
                        className={`flex-1 bg-slate-800 border rounded-xl p-3 placeholder-slate-500 focus:outline-none focus:ring-1 ${inputColorClass}`}
                      />
                      <span className="text-slate-400 text-sm">
                        {selectedStation.station_type_data.measurement_unit === 'gram' ? 'g' :
                         selectedStation.station_type_data.measurement_unit === 'st' ? 'st' :
                         selectedStation.station_type_data.measurement_unit || ''}
                      </span>
                    </div>
                    {/* Threshold indicators */}
                    {(selectedStation.station_type_data.threshold_warning || selectedStation.station_type_data.threshold_critical) && (
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        {selectedStation.station_type_data.threshold_warning && (
                          <span className="text-amber-400">
                            Varning: {selectedStation.station_type_data.threshold_warning}
                          </span>
                        )}
                        {selectedStation.station_type_data.threshold_critical && (
                          <span className="text-red-400">
                            Kritisk: {selectedStation.station_type_data.threshold_critical}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Preparatval — filtrerat efter stationstyp */}
              {(() => {
                const stationTypeId = selectedStation.station_type_data?.id
                const filteredPreparations = preparations.filter(p =>
                  !p.station_type_ids?.length || (stationTypeId && p.station_type_ids.includes(stationTypeId))
                )
                if (filteredPreparations.length === 0) return null
                return (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                      <Beaker className="w-4 h-4" />
                      Preparat (valfritt)
                    </label>
                    <select
                      value={selectedPreparationId || ''}
                      onChange={(e) => setSelectedPreparationId(e.target.value || null)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                    >
                      <option value="">Inget preparat</option>
                      {(['biocidprodukt', 'giftfritt', 'desinfektionsmedel'] as const).map(cat => {
                        const catPreps = filteredPreparations.filter(p => p.category === cat)
                        if (catPreps.length === 0) return null
                        const catLabel = cat === 'biocidprodukt' ? 'Biocidprodukt' : cat === 'giftfritt' ? 'Giftfritt' : 'Desinfektionsmedel'
                        return (
                          <optgroup key={cat} label={catLabel}>
                            {catPreps.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.registration_number ? ` (${p.registration_number})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )
                      })}
                    </select>
                    {selectedPreparationId && (() => {
                      const prep = preparations.find(p => p.id === selectedPreparationId)
                      if (!prep) return null
                      return (
                        <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                          {prep.active_substances && <p>Verksamt ämne: {prep.active_substances}</p>}
                          {prep.dosage && <p>Dosering: {prep.dosage}</p>}
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* Photo capture */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Foto (valfritt)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />

                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Förhandsvisning"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handlePhotoCapture}
                    className="w-full h-32 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-green-500 hover:text-green-400 transition-colors"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm">Ta foto eller välj bild</span>
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Anteckningar (valfritt)
                </label>
                <textarea
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="Beskriv eventuella fynd..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
                />
              </div>

              </div>{/* Slut på scrollbart innehåll */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
