// src/pages/technician/StationInspectionModule.tsx
// STEG 5 DEBUG - Minimal StationCard utan INSPECTION_STATUS_CONFIG rendering

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Map,
  Grid3X3,
  Play
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer,
  getFloorPlansForCustomer,
  startInspectionSession,
  calculateSessionProgress
} from '../../services/inspectionSessionService'
import {
  InspectionSessionWithRelations,
  InspectionTab,
  SessionProgress
} from '../../types/inspectionSession'
import { IndoorStationWithRelations, INSPECTION_STATUS_CONFIG, InspectionStatus } from '../../types/indoor'

// ============================================
// TYPES
// ============================================

interface OutdoorStation {
  id: string
  station_number: string | null
  station_type: string | null
  equipment_type_code: string | null
  latitude: number
  longitude: number
  status: string
  location_description: string | null
  comment: string | null
  station_type_data?: {
    id: string
    name: string
    color: string
    measurement_unit: string | null
    threshold_warning: number | null
    threshold_critical: number | null
  } | null
}

interface InspectedStation {
  stationId: string
  status: InspectionStatus
  inspectedAt: string
}

// ============================================
// MINIMAL STATION CARD - STEG 5
// ============================================

interface StationCardProps {
  station: OutdoorStation
  isInspected: boolean
  onClick: () => void
}

function StationCard({ station, isInspected, onClick }: StationCardProps) {
  // Enkel rendering utan INSPECTION_STATUS_CONFIG
  const stationName = station.station_type_data?.name || station.equipment_type_code || 'Station'
  const stationColor = station.station_type_data?.color || '#64748b'

  return (
    <motion.div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        isInspected
          ? 'bg-green-900/20 border-green-500/30'
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
      }`}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${stationColor}20`, borderColor: stationColor, borderWidth: '2px' }}
          >
            <MapPin className="w-5 h-5" style={{ color: stationColor }} />
          </div>
          <div>
            <div className="font-medium text-white">
              {station.station_number || 'Utan nummer'}
            </div>
            <div className="text-sm text-slate-400">{stationName}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInspected && (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [caseData, setCaseData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<InspectionTab>('outdoor')
  const [outdoorStations, setOutdoorStations] = useState<OutdoorStation[]>([])
  const [indoorStations, setIndoorStations] = useState<IndoorStationWithRelations[]>([])
  const [floorPlans, setFloorPlans] = useState<any[]>([])
  const [progress, setProgress] = useState<SessionProgress | null>(null)

  // Inspekterade stationer
  const [inspectedOutdoor, setInspectedOutdoor] = useState<Map<string, InspectedStation>>(new Map())

  // Debug info
  console.log('STEG 5: Minimal StationCard')
  console.log('INSPECTION_STATUS_CONFIG:', INSPECTION_STATUS_CONFIG)

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    if (!caseId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Hämta ärendedata
        const { data: caseResult, error: caseError } = await supabase
          .from('cases')
          .select(`
            *,
            customer:customers(id, company_name, contact_address, contact_phone)
          `)
          .eq('id', caseId)
          .single()

        if (caseError) throw caseError
        setCaseData(caseResult)

        // Hämta inspektionssession
        const sessionData = await getInspectionSessionByCaseId(caseId)
        setSession(sessionData)

        if (!caseResult.customer_id) {
          throw new Error('Ärendet saknar kundkoppling')
        }

        // Hämta stationer
        const [outdoor, indoor, plans] = await Promise.all([
          getOutdoorStationsForCustomer(caseResult.customer_id),
          getIndoorStationsForCustomer(caseResult.customer_id),
          getFloorPlansForCustomer(caseResult.customer_id)
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)
        setFloorPlans(plans)

        // Bestäm aktiv flik
        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
        }

        // Hämta progress
        if (sessionData) {
          const progressData = await calculateSessionProgress(sessionData.id)
          setProgress(progressData)
        }

      } catch (err: any) {
        console.error('Error loading inspection data:', err)
        setError(err.message || 'Kunde inte ladda inspektionsdata')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  // ============================================
  // HANDLERS
  // ============================================

  const handleStartInspection = async () => {
    if (!session) return
    const updatedSession = await startInspectionSession(session.id)
    if (updatedSession) {
      setSession(prev => prev ? { ...prev, ...updatedSession } : null)
    }
  }

  const handleStationClick = (station: OutdoorStation) => {
    console.log('Station clicked:', station.id)
    // Bara logga för nu
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <LoadingSpinner text="Laddar inspektion..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            Tillbaka
          </Button>
        </div>
      </div>
    )
  }

  const isSessionStarted = session?.status === 'in_progress' || session?.status === 'completed'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Stationskontroll (STEG 5)</h1>
            <p className="text-sm text-slate-400">
              {caseData?.customer?.company_name || 'Laddar...'}
            </p>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="p-4 bg-blue-900/30 border-b border-blue-700">
        <p className="text-blue-300 text-sm">
          DEBUG STEG 5: Minimal StationCard utan INSPECTION_STATUS_CONFIG i rendering
        </p>
        <p className="text-blue-400 text-xs mt-1">
          Outdoor: {outdoorStations.length} | Indoor: {indoorStations.length} | Session: {session?.status || 'ingen'}
        </p>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Framsteg</span>
            <span className="text-sm font-medium text-white">
              {progress.inspectedCount} / {progress.totalCount}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Start Session Button */}
      {session && session.status === 'scheduled' && (
        <div className="p-4">
          <Button onClick={handleStartInspection} className="w-full" size="lg">
            <Play className="w-5 h-5 mr-2" />
            Starta kontroll
          </Button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('outdoor')}
          className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'outdoor'
              ? 'text-green-400 border-b-2 border-green-400 bg-green-400/5'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Map className="w-5 h-5" />
          <span>Utomhus ({outdoorStations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('indoor')}
          className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'indoor'
              ? 'text-green-400 border-b-2 border-green-400 bg-green-400/5'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span>Inomhus ({indoorStations.length})</span>
        </button>
      </div>

      {/* Station List */}
      <div className="p-4 space-y-3">
        {activeTab === 'outdoor' && outdoorStations.length > 0 && (
          outdoorStations.map(station => (
            <StationCard
              key={station.id}
              station={station}
              isInspected={inspectedOutdoor.has(station.id)}
              onClick={() => handleStationClick(station)}
            />
          ))
        )}

        {activeTab === 'outdoor' && outdoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga utomhusstationer hittades</p>
          </div>
        )}

        {activeTab === 'indoor' && (
          <div className="text-center py-8 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inomhusvy kommer i nästa steg</p>
            <p className="text-sm mt-2">{indoorStations.length} stationer hittades</p>
          </div>
        )}
      </div>
    </div>
  )
}
