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
  Wand2,
  SkipForward
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
  getIndoorInspectionsForSession
} from '../../services/inspectionSessionService'

// Typer
import type {
  InspectionSessionWithRelations,
  SessionProgress
} from '../../types/inspectionSession'
import type { InspectionStatus } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'
import type { EquipmentPlacementWithRelations } from '../../types/database'
import type { IndoorStationWithRelations } from '../../types/indoor'

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

// ViewMode för utomhus
type OutdoorViewMode = 'map' | 'list'

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
  const [outdoorViewMode, setOutdoorViewMode] = useState<OutdoorViewMode>('map')
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null)

  // Inspektionsmodal state
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus>('ok')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [measurementValue, setMeasurementValue] = useState<string>('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [inspectedStationIds, setInspectedStationIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sammanställningspanel state - spara inspektionsresultat per station
  // OBS: Använder Record istället för Map för att undvika Vite/Terser minifieringsproblem
  const [showSummary, setShowSummary] = useState(false)
  const [inspectionResults, setInspectionResults] = useState<Record<string, {
    status: InspectionStatus
    findings: string | null
    measurementValue: number | null
    measurementUnit: string | null
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

  // Senaste inspektion och aktivitetsstationer (för ankomstkort)
  const [lastInspection, setLastInspection] = useState<{
    completed_at: string | null
    technician_name: string | null
    total_inspected: number
    stations_with_activity: number
  } | null>(null)
  const [activityStationIds, setActivityStationIds] = useState<Set<string>>(new Set())

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

        const [outdoor, indoor, plans] = await Promise.all([
          getOutdoorStationsForCustomer(sessionData.customer_id),
          getIndoorStationsForCustomer(sessionData.customer_id),
          getFloorPlansForCustomer(sessionData.customer_id)
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)
        setFloorPlans(plans)

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
            hasPhoto: boolean
            timestamp: string
          }> = {}

          // Utomhusinspektioner
          existingOutdoor.forEach(insp => {
            alreadyInspectedIds.add(insp.station_id)
            existingResults[insp.station_id] = {
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              measurementValue: insp.measurement_value,
              measurementUnit: insp.measurement_unit,
              hasPhoto: !!insp.photo_path,
              timestamp: insp.inspected_at
            }
          })

          // Inomhusinspektioner
          existingIndoor.forEach(insp => {
            alreadyInspectedIds.add(insp.station_id)
            existingResults[insp.station_id] = {
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              measurementValue: insp.measurement_value,
              measurementUnit: insp.measurement_unit,
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
  const handleSelectStation = useCallback((station: StationData) => {
    if (session?.status !== 'in_progress') {
      toast.error('Starta inspektionen först')
      return
    }
    setSelectedStation(station)
    setSelectedStatus('ok')
    setInspectionNotes('')
    setMeasurementValue('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setShowHistory(false)
    setStationHistory([])
  }, [session?.status])

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
    if (session?.status !== 'in_progress') {
      toast.error('Starta inspektionen först')
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

    // Öppna första stationen för inspektion
    const firstStation = outdoorStations.find(s => s.id === queue[0])
    if (firstStation) {
      handleSelectStation(firstStation)
    }

    toast.success(`Wizard startad! ${queue.length} stationer kvar.`)
  }, [session?.status, outdoorStations, inspectedStationIds, outdoorNumberMap, handleSelectStation])

  // Starta indoor wizard för vald planritning
  const startIndoorWizard = useCallback(() => {
    if (session?.status !== 'in_progress') {
      toast.error('Starta inspektionen först')
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

    // Öppna första stationen för inspektion
    const firstStation = indoorStations.find(s => s.id === queue[0])
    if (firstStation) {
      handleSelectStation(firstStation)
    }

    toast.success(`Wizard startad! ${queue.length} stationer kvar.`)
  }, [session?.status, selectedFloorPlanId, filteredIndoorStations, inspectedStationIds, indoorNumberMap, indoorStations, handleSelectStation])

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

    // Öppna nästa station för inspektion
    const stations = wizardMode === 'outdoor' ? outdoorStations : indoorStations
    const nextStation = stations.find(s => s.id === nextStationId)
    if (nextStation) {
      handleSelectStation(nextStation)
    }
  }, [wizardMode, wizardStationQueue, currentWizardStationId, outdoorStations, indoorStations, handleSelectStation])

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
      const stations = wizardMode === 'outdoor' ? outdoorStations : indoorStations
      const nextStation = stations.find(s => s.id === nextId)
      if (nextStation) {
        handleSelectStation(nextStation)
      }
    }

    toast('Station hoppades över')
  }, [wizardMode, currentWizardStationId, wizardStationQueue, outdoorStations, indoorStations, handleSelectStation])

  // Avsluta wizard
  const stopWizard = useCallback(() => {
    setWizardMode('off')
    setCurrentWizardStationId(null)
    setWizardStationQueue([])
    setSelectedStation(null)
    toast('Wizard avslutad')
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
        session_id: session.id,
        status: selectedStatus,
        findings: inspectionNotes || undefined,
        photo_path: photoPath || undefined,
        measurement_value: measurementValue ? parseFloat(measurementValue) : undefined,
        measurement_unit: measurementUnit || undefined
      }

      if (isOutdoor) {
        await createOutdoorInspection(inspectionData, session.technician_id || undefined)

        // Uppdatera session count
        await updateInspectionSession(session.id, {
          inspected_outdoor_stations: session.inspected_outdoor_stations + 1
        })

        setSession({
          ...session,
          inspected_outdoor_stations: session.inspected_outdoor_stations + 1
        })
      } else {
        await createIndoorInspection(inspectionData, session.technician_id || undefined)

        await updateInspectionSession(session.id, {
          inspected_indoor_stations: session.inspected_indoor_stations + 1
        })

        setSession({
          ...session,
          inspected_indoor_stations: session.inspected_indoor_stations + 1
        })
      }

      // Markera som inspekterad
      setInspectedStationIds(prev => new Set(prev).add(selectedStation.id))

      // Spara resultat till sammanställning
      setInspectionResults(prev => ({
        ...prev,
        [selectedStation.id]: {
          status: selectedStatus,
          findings: inspectionNotes || null,
          measurementValue: measurementValue ? parseFloat(measurementValue) : null,
          measurementUnit: measurementUnit || null,
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

    } catch (err) {
      console.error('Error saving inspection:', err)
      toast.error('Kunde inte spara inspektionen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Avsluta inspektion
  const handleCompleteInspection = async () => {
    if (!session) return

    try {
      setIsSubmitting(true)
      const updated = await completeInspectionSession(session.id)
      if (updated) {
        toast.success('Inspektion avslutad!')
        navigate(-1)
      }
    } catch (err) {
      toast.error('Kunde inte avsluta inspektionen')
    } finally {
      setIsSubmitting(false)
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
              <Button onClick={handleCompleteInspection} loading={isSubmitting}>
                <Check className="w-4 h-4 mr-2" />
                Avsluta
              </Button>
            )}
          </div>

          {/* Progress - endast under aktiv inspektion */}
          {session?.status === 'in_progress' && progress && (
            <div className="mb-4">
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
            {session?.status === 'in_progress' && showSummary && inspectedStationIds.size > 0 && (
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

          {/* Tabs - endast under aktiv inspektion */}
          {session?.status === 'in_progress' && (
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
                Utomhus ({progress?.outdoorProgress.inspected || 0}/{outdoorStations.length})
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
                Inomhus ({progress?.indoorProgress.inspected || 0}/{indoorStations.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ANKOMSTKORT - Visas innan inspektion har startats */}
      {session?.status === 'scheduled' && (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Kundinformation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-400" />
              {session.customer?.company_name}
            </h2>

            {/* Adress med navigation */}
            {session.customer?.contact_address && (
              <div className="mb-4">
                <div className="flex items-start gap-3 mb-2">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-300">{session.customer.contact_address}</p>
                </div>
                <div className="flex gap-2 ml-8">
                  <button
                    onClick={handleNavigate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Navigera hit
                  </button>
                  <button
                    onClick={handleCopyAddress}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Kontaktperson */}
            {(session.customer?.contact_person || session.customer?.contact_phone) && (
              <div className="border-t border-slate-700/50 pt-4 mt-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Kontaktperson</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {session.customer.contact_person || 'Ej angiven'}
                      </p>
                      {session.customer.contact_phone && (
                        <p className="text-slate-400 text-sm">{session.customer.contact_phone}</p>
                      )}
                    </div>
                  </div>
                  {session.customer.contact_phone && (
                    <button
                      onClick={handleCall}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Ring
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Senaste inspektion */}
          {lastInspection && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <History className="w-5 h-5 text-slate-400" />
                <h3 className="font-medium text-white">Senaste inspektion</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Datum</p>
                  <p className="text-white">{formatDate(lastInspection.completed_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tekniker</p>
                  <p className="text-white">{lastInspection.technician_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Kontrollerade</p>
                  <p className="text-white">{lastInspection.total_inspected} stationer</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Med aktivitet</p>
                  <p className={`font-medium ${lastInspection.stations_with_activity > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                    {lastInspection.stations_with_activity} stationer
                  </p>
                </div>
              </div>

              {/* Varning om aktivitet */}
              {lastInspection.stations_with_activity > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-200 text-sm font-medium">
                      {lastInspection.stations_with_activity} stationer hade aktivitet
                    </p>
                    <p className="text-amber-200/70 text-xs mt-1">
                      Dessa stationer är markerade med varningssymbol i listan
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Översikt stationer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-slate-400" />
              <h3 className="font-medium text-white">Översikt</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <span className="text-2xl font-bold text-white">{outdoorStations.length}</span>
                </div>
                <p className="text-slate-400 text-sm">Utomhus</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <span className="text-2xl font-bold text-white">{indoorStations.length}</span>
                </div>
                <p className="text-slate-400 text-sm">Inomhus</p>
              </div>
            </div>

            {floorPlans.length > 0 && (
              <p className="text-slate-500 text-sm">
                {floorPlans.length} planritning{floorPlans.length !== 1 ? 'ar' : ''} tillgängliga
              </p>
            )}
          </motion.div>

          {/* Starta-knapp - stor och tydlig */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={handleStartInspection}
              loading={isSubmitting}
              fullWidth
              className="py-4 text-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Starta inspektion
            </Button>
          </motion.div>
        </div>
      )}

      {/* Content - endast under aktiv inspektion */}
      {session?.status === 'in_progress' && (
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
              {/* Wizard-läge banner (visas när wizard är aktiv) */}
              {wizardMode === 'outdoor' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-blue-400" />
                      <span className="font-medium text-white">Wizard-läge aktivt</span>
                    </div>
                    <button
                      onClick={stopWizard}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      Avsluta
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-300">
                      Station {wizardStationQueue.indexOf(currentWizardStationId || '') + 1} av {wizardStationQueue.length}
                    </span>
                    <button
                      onClick={wizardSkipStation}
                      className="flex items-center gap-1 text-slate-400 hover:text-white"
                    >
                      <SkipForward className="w-4 h-4" />
                      Hoppa över
                    </button>
                  </div>
                </motion.div>
              )}

              {/* View mode toggle for outdoor */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => setOutdoorViewMode('map')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      outdoorViewMode === 'map'
                        ? 'bg-green-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Map className="w-4 h-4" />
                    Karta
                  </button>
                  <button
                    onClick={() => setOutdoorViewMode('list')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      outdoorViewMode === 'list'
                        ? 'bg-green-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    Lista
                  </button>
                </div>

                {/* Wizard start-knapp (dold om wizard redan är aktiv) */}
                {wizardMode !== 'outdoor' && outdoorStations.length > 0 && (
                  <button
                    onClick={startOutdoorWizard}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Wand2 className="w-4 h-4" />
                    Starta wizard
                  </button>
                )}
              </div>

              {outdoorStations.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga utomhusstationer</p>
                </div>
              ) : outdoorViewMode === 'map' ? (
                // Map view - ökad höjd för bättre mobil UX
                <div className="glass rounded-xl overflow-hidden">
                  <EquipmentMap
                    equipment={outdoorEquipment}
                    height="calc(100vh - 280px)"
                    readOnly
                    showControls={true}
                    showNumbers={true}
                    enableClustering={false}
                    onEquipmentClick={handleOutdoorStationClick}
                    inspectedStationIds={inspectedStationIds}
                    highlightedStationId={wizardMode === 'outdoor' ? currentWizardStationId : null}
                  />
                </div>
              ) : (
                // List view
                <div className="space-y-3">
                  {outdoorStations.map((station) => {
                    const isInspected = inspectedStationIds.has(station.id)
                    const stationNumber = outdoorNumberMap[station.id] || '?'
                    const typeName = station.station_type_data?.name || station.equipment_type || station.station_type
                    const hadActivity = activityStationIds.has(station.id)

                    return (
                      <motion.button
                        key={station.id}
                        onClick={() => handleSelectStation(station)}
                        disabled={session?.status !== 'in_progress'}
                        className={`w-full glass rounded-xl p-4 text-left transition-all ${
                          session?.status === 'in_progress'
                            ? 'hover:bg-slate-800/50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed'
                        } ${isInspected ? 'border-l-4 border-green-500' : hadActivity ? 'border-l-4 border-amber-500' : ''}`}
                        whileHover={session?.status === 'in_progress' ? { scale: 1.01 } : {}}
                        whileTap={session?.status === 'in_progress' ? { scale: 0.99 } : {}}
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
                          <ChevronRight className="w-5 h-5 text-slate-500" />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
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
              {/* Wizard-läge banner för inomhus */}
              {wizardMode === 'indoor' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-blue-400" />
                      <span className="font-medium text-white">Wizard-läge aktivt</span>
                    </div>
                    <button
                      onClick={stopWizard}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      Avsluta
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-300">
                      Station {wizardStationQueue.indexOf(currentWizardStationId || '') + 1} av {wizardStationQueue.length}
                    </span>
                    <button
                      onClick={wizardSkipStation}
                      className="flex items-center gap-1 text-slate-400 hover:text-white"
                    >
                      <SkipForward className="w-4 h-4" />
                      Hoppa över
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Floor plan selector med progress */}
              {floorPlans.length > 0 && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {floorPlans.map((fp) => {
                      // Räkna stationer och inspekterade per planritning
                      const stationsOnPlan = indoorStations.filter(s => s.floor_plan_id === fp.id)
                      const inspectedOnPlan = stationsOnPlan.filter(s => inspectedStationIds.has(s.id)).length
                      const totalOnPlan = stationsOnPlan.length
                      const allDone = totalOnPlan > 0 && inspectedOnPlan === totalOnPlan

                      return (
                        <button
                          key={fp.id}
                          onClick={() => setSelectedFloorPlanId(fp.id)}
                          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            selectedFloorPlanId === fp.id
                              ? 'bg-green-500 text-white'
                              : allDone
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {allDone && <CheckCircle2 className="w-4 h-4" />}
                            <span>{fp.building_name ? `${fp.building_name} - ` : ''}{fp.name}</span>
                            <span className={`text-xs ${selectedFloorPlanId === fp.id ? 'text-white/70' : 'text-slate-500'}`}>
                              {inspectedOnPlan}/{totalOnPlan}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Wizard start-knapp för inomhus */}
                  {wizardMode !== 'indoor' && selectedFloorPlanId && filteredIndoorStations.length > 0 && (
                    <button
                      onClick={startIndoorWizard}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                    >
                      <Wand2 className="w-4 h-4" />
                      Starta wizard
                    </button>
                  )}
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
                    height="calc(100vh - 320px)"
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
                        disabled={session?.status !== 'in_progress'}
                        className={`w-full glass rounded-xl p-4 text-left transition-all ${
                          session?.status === 'in_progress'
                            ? 'hover:bg-slate-800/50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed'
                        } ${isInspected ? 'border-l-4 border-green-500' : hadActivity ? 'border-l-4 border-amber-500' : ''}`}
                        whileHover={session?.status === 'in_progress' ? { scale: 1.01 } : {}}
                        whileTap={session?.status === 'in_progress' ? { scale: 0.99 } : {}}
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
                          <ChevronRight className="w-5 h-5 text-slate-500" />
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
              className="w-full max-w-lg glass rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Station {outdoorNumberMap[selectedStation.id] || indoorNumberMap[selectedStation.id] || '?'}
                  </h2>
                  <p className="text-slate-400">
                    {selectedStation.station_type_data?.name || selectedStation.equipment_type || selectedStation.station_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadHistory}
                    className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title="Visa historik"
                  >
                    <History className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="p-2 rounded-lg hover:bg-slate-700"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* History Panel */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-6 overflow-hidden"
                  >
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-white flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Inspektionshistorik
                        </h3>
                        <button
                          onClick={() => setShowHistory(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {historyLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : stationHistory.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-4">
                          Ingen tidigare historik
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {stationHistory.map((item) => (
                            <div key={item.id} className="bg-slate-900/50 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{INSPECTION_STATUS_CONFIG[item.status]?.icon}</span>
                                  <span className="text-sm font-medium text-white">
                                    {INSPECTION_STATUS_CONFIG[item.status]?.label || item.status}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500">
                                  {new Date(item.inspected_at).toLocaleDateString('sv-SE')}
                                </span>
                              </div>
                              {item.measurement_value !== null && (
                                <p className="text-sm text-slate-400 mb-1">
                                  Mätvärde: {item.measurement_value} {item.measurement_unit}
                                </p>
                              )}
                              {item.findings && (
                                <p className="text-sm text-slate-400 mb-1">
                                  {item.findings}
                                </p>
                              )}
                              {item.technician && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {item.technician.name}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
              {selectedStation.station_type_data?.measurement_label && (
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
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
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
              )}

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
              <div className="mb-6">
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

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setSelectedStation(null)}
                >
                  Avbryt
                </Button>
                <Button
                  fullWidth
                  onClick={handleSaveInspection}
                  loading={isSubmitting}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Spara
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
