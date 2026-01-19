// src/pages/technician/StationInspectionModule.tsx
// FINAL VERSION - Baserad på TEST 1-7

import { useState, useEffect, useCallback } from 'react'
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
  ChevronRight
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import AnimatedProgressBar from '../../components/ui/AnimatedProgressBar'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Service-funktioner
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer,
  startInspectionSession,
  completeInspectionSession,
  createOutdoorInspection,
  createIndoorInspection,
  updateInspectionSession
} from '../../services/inspectionSessionService'

// Typer
import type {
  InspectionSessionWithRelations,
  SessionProgress
} from '../../types/inspectionSession'
import type { InspectionStatus } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'

// Lokal typ för station (undvik problematiska importer)
interface StationData {
  id: string
  serial_number?: string | null
  station_number?: string | null
  equipment_type?: string | null
  station_type?: string | null
  status: string
  station_type_data?: {
    id: string
    name: string
    color: string
    measurement_unit?: string | null
  } | null
  floor_plan?: {
    id: string
    name: string
    building_name?: string | null
  } | null
}

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [outdoorStations, setOutdoorStations] = useState<StationData[]>([])
  const [indoorStations, setIndoorStations] = useState<StationData[]>([])
  const [activeTab, setActiveTab] = useState<'outdoor' | 'indoor'>('outdoor')
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus>('ok')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [inspectedStationIds, setInspectedStationIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

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

        const [outdoor, indoor] = await Promise.all([
          getOutdoorStationsForCustomer(sessionData.customer_id),
          getIndoorStationsForCustomer(sessionData.customer_id)
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)

        // Välj första fliken med stationer
        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
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

  // Spara stationsinspektion
  const handleSaveInspection = async () => {
    if (!session || !selectedStation) return

    try {
      setIsSubmitting(true)

      const isOutdoor = outdoorStations.some(s => s.id === selectedStation.id)

      if (isOutdoor) {
        await createOutdoorInspection({
          station_id: selectedStation.id,
          session_id: session.id,
          status: selectedStatus,
          findings: inspectionNotes || undefined
        }, session.technician_id || undefined)

        // Uppdatera session count
        await updateInspectionSession(session.id, {
          inspected_outdoor_stations: session.inspected_outdoor_stations + 1
        })

        setSession({
          ...session,
          inspected_outdoor_stations: session.inspected_outdoor_stations + 1
        })
      } else {
        await createIndoorInspection({
          station_id: selectedStation.id,
          session_id: session.id,
          status: selectedStatus,
          findings: inspectionNotes || undefined
        }, session.technician_id || undefined)

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

  // Wizard steps
  const wizardSteps = [
    { id: 1, title: 'Utomhus', icon: MapPin },
    { id: 2, title: 'Inomhus', icon: Building2 }
  ]

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

  // Get current stations
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
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {currentStations.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center">
                <p className="text-slate-400">Inga {activeTab === 'outdoor' ? 'utomhus' : 'inomhus'}stationer</p>
              </div>
            ) : (
              currentStations.map((station) => {
                const isInspected = inspectedStationIds.has(station.id)
                const stationName = station.serial_number || station.station_number || 'Unnamed'
                const typeName = station.station_type_data?.name || station.equipment_type || station.station_type

                return (
                  <motion.button
                    key={station.id}
                    onClick={() => session?.status === 'in_progress' && setSelectedStation(station)}
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
                          {station.floor_plan && (
                            <p className="text-xs text-slate-500">{station.floor_plan.name}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </div>
                  </motion.button>
                )
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Inspection Modal */}
      <AnimatePresence>
        {selectedStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedStation(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass rounded-2xl p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedStation.serial_number || selectedStation.station_number}
                  </h2>
                  <p className="text-slate-400">
                    {selectedStation.station_type_data?.name || selectedStation.equipment_type}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStation(null)}
                  className="p-2 rounded-lg hover:bg-slate-700"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

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
                          ? `bg-${opt.color}/20 text-white border-2 border-${opt.color}`
                          : 'bg-slate-800 text-slate-300 border-2 border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
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
