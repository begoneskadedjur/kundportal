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
  Camera,
  History,
  Map,
  List,
  Upload,
  Trash2,
  Image as ImageIcon,
  Clock,
  User,
  FileText
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
  getInspectionPhotoUrl
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

  // Historik state
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [stationHistory, setStationHistory] = useState<InspectionHistoryItem[]>([])

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-950"
    >
      {/* Header */}
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

            {/* Session status */}
            {session?.status === 'scheduled' && (
              <Button onClick={handleStartInspection} loading={isSubmitting}>
                <Play className="w-4 h-4 mr-2" />
                Starta
              </Button>
            )}
            {session?.status === 'in_progress' && progress && progress.inspectedStations > 0 && (
              <Button onClick={handleCompleteInspection} loading={isSubmitting}>
                <Check className="w-4 h-4 mr-2" />
                Avsluta
              </Button>
            )}
          </div>

          {/* Progress */}
          {progress && (
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
            </div>
          )}

          {/* Tabs */}
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
        </div>
      </div>

      {/* Content */}
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
              {/* View mode toggle for outdoor */}
              <div className="flex items-center justify-between">
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
                <p className="text-sm text-slate-500">
                  {session?.status === 'in_progress' ? 'Klicka på station för att inspektera' : 'Starta för att inspektera'}
                </p>
              </div>

              {outdoorStations.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga utomhusstationer</p>
                </div>
              ) : outdoorViewMode === 'map' ? (
                // Map view
                <div className="glass rounded-xl overflow-hidden">
                  <EquipmentMap
                    equipment={outdoorEquipment}
                    height="400px"
                    readOnly
                    showControls={true}
                    showNumbers={true}
                    enableClustering={false}
                    onEquipmentClick={handleOutdoorStationClick}
                  />
                </div>
              ) : (
                // List view
                <div className="space-y-3">
                  {outdoorStations.map((station) => {
                    const isInspected = inspectedStationIds.has(station.id)
                    const stationName = station.serial_number || station.station_number || 'Unnamed'
                    const typeName = station.station_type_data?.name || station.equipment_type || station.station_type

                    return (
                      <motion.button
                        key={station.id}
                        onClick={() => handleSelectStation(station)}
                        disabled={session?.status !== 'in_progress'}
                        className={`w-full glass rounded-xl p-4 text-left transition-all ${
                          session?.status === 'in_progress'
                            ? 'hover:bg-slate-800/50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed'
                        } ${isInspected ? 'border-l-4 border-green-500' : ''}`}
                        whileHover={session?.status === 'in_progress' ? { scale: 1.01 } : {}}
                        whileTap={session?.status === 'in_progress' ? { scale: 0.99 } : {}}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isInspected ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full border-2 border-slate-600"
                                style={{
                                  backgroundColor: station.station_type_data?.color
                                    ? `${station.station_type_data.color}20`
                                    : undefined
                                }}
                              />
                            )}
                            <div>
                              <p className="font-medium text-white">{stationName}</p>
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
              {/* Floor plan selector */}
              {floorPlans.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {floorPlans.map((fp) => (
                    <button
                      key={fp.id}
                      onClick={() => setSelectedFloorPlanId(fp.id)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedFloorPlanId === fp.id
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {fp.building_name ? `${fp.building_name} - ` : ''}{fp.name}
                    </button>
                  ))}
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
                // Floor plan viewer
                <div className="glass rounded-xl overflow-hidden">
                  <FloorPlanViewer
                    imageUrl={floorPlanImageUrl}
                    stations={indoorStationsForViewer}
                    selectedStationId={null}
                    placementMode="view"
                    onStationClick={handleIndoorStationClick}
                    height="400px"
                    showNumbers={true}
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
                    const stationName = station.station_number || station.serial_number || 'Unnamed'
                    const typeName = station.station_type_data?.name || station.station_type

                    return (
                      <motion.button
                        key={station.id}
                        onClick={() => handleSelectStation(station)}
                        disabled={session?.status !== 'in_progress'}
                        className={`w-full glass rounded-xl p-4 text-left transition-all ${
                          session?.status === 'in_progress'
                            ? 'hover:bg-slate-800/50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed'
                        } ${isInspected ? 'border-l-4 border-green-500' : ''}`}
                        whileHover={session?.status === 'in_progress' ? { scale: 1.01 } : {}}
                        whileTap={session?.status === 'in_progress' ? { scale: 0.99 } : {}}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isInspected ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full border-2 border-slate-600"
                                style={{
                                  backgroundColor: station.station_type_data?.color
                                    ? `${station.station_type_data.color}20`
                                    : undefined
                                }}
                              />
                            )}
                            <div>
                              <p className="font-medium text-white">{stationName}</p>
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
                    {selectedStation.serial_number || selectedStation.station_number || 'Station'}
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
