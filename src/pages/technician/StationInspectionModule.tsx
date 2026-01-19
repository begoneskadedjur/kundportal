// src/pages/technician/StationInspectionModule.tsx
// STEG 6: Utan AnimatePresence - testar om det är problemet

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
  AlertCircle,
  ChevronRight,
  Map,
  Play,
  X,
  Check
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer,
  getFloorPlansForCustomer,
  startInspectionSession,
  completeInspectionSession,
  createOutdoorInspection,
  createIndoorInspection,
  calculateSessionProgress
} from '../../services/inspectionSessionService'
import type {
  InspectionSessionWithRelations,
  InspectionTab,
  SessionProgress
} from '../../types/inspectionSession'

// ============================================
// LOCAL TYPES
// ============================================

type InspectionStatus = 'ok' | 'activity' | 'needs_service' | 'replaced'

const STATUS_OPTIONS = [
  { key: 'ok' as const, label: 'OK - Inga fynd', icon: '✓', color: 'green' },
  { key: 'activity' as const, label: 'Aktivitet upptäckt', icon: '!', color: 'amber' },
  { key: 'needs_service' as const, label: 'Behöver service', icon: '⚠', color: 'orange' },
  { key: 'replaced' as const, label: 'Utbytt', icon: '↻', color: 'blue' }
]

interface OutdoorStation {
  id: string
  serial_number: string | null
  equipment_type: string | null
  latitude: number
  longitude: number
  status: string
  comment: string | null
  station_type_data?: {
    id: string
    name: string
    color: string
    measurement_unit: string | null
  } | null
}

interface IndoorStation {
  id: string
  station_number: string | null
  station_type: string | null
  position_x_percent: number
  position_y_percent: number
  status: string
  location_description: string | null
  comment: string | null
  floor_plan?: {
    id: string
    name: string
    building_name: string | null
  }
  station_type_data?: {
    id: string
    name: string
    color: string
    measurement_unit: string | null
  } | null
}

interface InspectedStation {
  stationId: string
  status: InspectionStatus
  inspectedAt: string
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
  const [indoorStations, setIndoorStations] = useState<IndoorStation[]>([])
  const [progress, setProgress] = useState<SessionProgress | null>(null)

  // Inspected stations
  const [inspectedOutdoor, setInspectedOutdoor] = useState<Map<string, InspectedStation>>(new Map())
  const [inspectedIndoor, setInspectedIndoor] = useState<Map<string, InspectedStation>>(new Map())

  // Form state
  const [selectedStation, setSelectedStation] = useState<{
    station: OutdoorStation | IndoorStation
    type: 'outdoor' | 'indoor'
  } | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus | null>(null)
  const [findings, setFindings] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Completion state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // Debug
  console.log('STEG 6: Utan AnimatePresence')

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    if (!caseId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: caseResult, error: caseError } = await supabase
          .from('cases')
          .select(`*, customer:customers(id, company_name, contact_address, contact_phone)`)
          .eq('id', caseId)
          .single()

        if (caseError) throw caseError
        setCaseData(caseResult)

        const sessionData = await getInspectionSessionByCaseId(caseId)
        setSession(sessionData)

        if (!caseResult.customer_id) {
          throw new Error('Ärendet saknar kundkoppling')
        }

        const [outdoor, indoor] = await Promise.all([
          getOutdoorStationsForCustomer(caseResult.customer_id),
          getIndoorStationsForCustomer(caseResult.customer_id)
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)

        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
        }

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

  const handleStationClick = (station: OutdoorStation | IndoorStation, type: 'outdoor' | 'indoor') => {
    setSelectedStation({ station, type })
    setSelectedStatus(null)
    setFindings('')
    setIsFormOpen(true)
  }

  const handleInspectionSubmit = async () => {
    if (!selectedStation || !session || !profile || !selectedStatus) return

    setIsSubmitting(true)
    try {
      if (selectedStation.type === 'outdoor') {
        await createOutdoorInspection({
          station_id: selectedStation.station.id,
          session_id: session.id,
          status: selectedStatus,
          findings: findings || undefined,
          inspected_by: profile.id
        })

        setInspectedOutdoor(prev => {
          const next = new Map(prev)
          next.set(selectedStation.station.id, {
            stationId: selectedStation.station.id,
            status: selectedStatus,
            inspectedAt: new Date().toISOString()
          })
          return next
        })
      } else {
        await createIndoorInspection({
          station_id: selectedStation.station.id,
          session_id: session.id,
          status: selectedStatus,
          findings: findings || undefined,
          inspected_by: profile.id
        })

        setInspectedIndoor(prev => {
          const next = new Map(prev)
          next.set(selectedStation.station.id, {
            stationId: selectedStation.station.id,
            status: selectedStatus,
            inspectedAt: new Date().toISOString()
          })
          return next
        })
      }

      const progressData = await calculateSessionProgress(session.id)
      setProgress(progressData)

      setIsFormOpen(false)
      setSelectedStation(null)
    } catch (err) {
      console.error('Error creating inspection:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteInspection = async () => {
    if (!session) return

    setIsCompleting(true)
    try {
      await completeInspectionSession(session.id)
      navigate(-1)
    } catch (err) {
      console.error('Error completing inspection:', err)
    } finally {
      setIsCompleting(false)
    }
  }

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getStatusColor = (status: InspectionStatus | undefined) => {
    if (!status) return 'slate'
    switch (status) {
      case 'ok': return 'green'
      case 'activity': return 'amber'
      case 'needs_service': return 'orange'
      case 'replaced': return 'blue'
      default: return 'slate'
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Stationskontroll</h1>
              <p className="text-sm text-slate-400">
                {caseData?.customer?.company_name || 'Laddar...'}
              </p>
            </div>
          </div>

          {isSessionStarted && (
            <Button variant="primary" size="sm" onClick={() => setShowCompletionDialog(true)}>
              Avsluta
            </Button>
          )}
        </div>
      </div>

      {/* Debug */}
      <div className="p-2 bg-cyan-900/30 border-b border-cyan-700">
        <p className="text-cyan-300 text-xs">STEG 6: Utan AnimatePresence</p>
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

      {/* Start Button */}
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
        {activeTab === 'outdoor' && outdoorStations.map(station => {
          const inspected = inspectedOutdoor.get(station.id)
          const color = getStatusColor(inspected?.status)
          return (
            <motion.div
              key={station.id}
              onClick={() => handleStationClick(station, 'outdoor')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                inspected
                  ? `bg-${color}-500/20 border-${color}-500/30`
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-700">
                    {inspected ? (
                      <CheckCircle2 className={`w-5 h-5 text-${color}-400`} />
                    ) : (
                      <MapPin className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {station.serial_number || 'Utan nummer'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {station.station_type_data?.name || station.equipment_type || 'Station'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>
            </motion.div>
          )
        })}

        {activeTab === 'outdoor' && outdoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga utomhusstationer</p>
          </div>
        )}

        {activeTab === 'indoor' && indoorStations.map(station => {
          const inspected = inspectedIndoor.get(station.id)
          const color = getStatusColor(inspected?.status)
          return (
            <motion.div
              key={station.id}
              onClick={() => handleStationClick(station, 'indoor')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                inspected
                  ? `bg-${color}-500/20 border-${color}-500/30`
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-700">
                    {inspected ? (
                      <CheckCircle2 className={`w-5 h-5 text-${color}-400`} />
                    ) : (
                      <Building2 className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {station.station_number || 'Utan nummer'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {station.station_type_data?.name || station.station_type || 'Station'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>
            </motion.div>
          )
        })}

        {activeTab === 'indoor' && indoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga inomhusstationer</p>
          </div>
        )}
      </div>

      {/* Inspection Form Modal (simple, no AnimatePresence) */}
      {isFormOpen && selectedStation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-slate-900 w-full rounded-t-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Inspektera station</h2>
                <p className="text-sm text-slate-400">
                  {selectedStation.type === 'outdoor'
                    ? (selectedStation.station as OutdoorStation).serial_number
                    : (selectedStation.station as IndoorStation).station_number
                  }
                </p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Välj status</label>
                <div className="grid grid-cols-2 gap-3">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedStatus(opt.key)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedStatus === opt.key
                          ? `border-${opt.color}-500 bg-${opt.color}-500/20`
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{opt.icon}</div>
                      <div className={`font-medium ${selectedStatus === opt.key ? `text-${opt.color}-400` : 'text-white'}`}>
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Findings */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Anteckningar (valfritt)
                </label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Beskriv eventuella fynd..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-green-500 focus:outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleInspectionSubmit}
                disabled={!selectedStatus || isSubmitting}
                loading={isSubmitting}
                className="w-full"
                size="lg"
              >
                <Check className="w-5 h-5 mr-2" />
                Spara inspektion
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Dialog (simple) */}
      {showCompletionDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl max-w-md w-full p-6 border border-slate-700">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Avsluta kontroll?</h2>
              <p className="text-slate-400 mb-6">
                Du har inspekterat {progress?.inspectedCount || 0} av {progress?.totalCount || 0} stationer.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCompletionDialog(false)} className="flex-1">
                  Avbryt
                </Button>
                <Button onClick={handleCompleteInspection} loading={isCompleting} className="flex-1">
                  Avsluta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
