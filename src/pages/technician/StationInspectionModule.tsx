// src/pages/technician/StationInspectionModule.tsx
// FULLSTÄNDIG VERSION - Utan direkta indoor.ts imports i komponenten

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Map,
  Play,
  X,
  Check,
  Camera,
  FileText
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
import {
  InspectionSessionWithRelations,
  InspectionTab,
  SessionProgress
} from '../../types/inspectionSession'

// ============================================
// LOCAL TYPES (istället för import från indoor.ts)
// ============================================

type InspectionStatus = 'ok' | 'activity' | 'needs_service' | 'replaced'

// Lokalt definierad status config (samma som i indoor.ts)
const INSPECTION_STATUS_CONFIG: Record<InspectionStatus, {
  label: string
  color: string
  bgColor: string
  icon: string
}> = {
  ok: {
    label: 'OK - Inga fynd',
    color: 'green-500',
    bgColor: 'bg-green-500/20',
    icon: '✓'
  },
  activity: {
    label: 'Aktivitet upptäckt',
    color: 'amber-500',
    bgColor: 'bg-amber-500/20',
    icon: '!'
  },
  needs_service: {
    label: 'Behöver service',
    color: 'orange-500',
    bgColor: 'bg-orange-500/20',
    icon: '⚠'
  },
  replaced: {
    label: 'Utbytt',
    color: 'blue-500',
    bgColor: 'bg-blue-500/20',
    icon: '↻'
  }
}

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
    threshold_warning: number | null
    threshold_critical: number | null
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
// HELPER FUNCTIONS
// ============================================

function getStatusTextColor(status: InspectionStatus | undefined): string {
  if (!status) return 'text-slate-400'
  switch (status) {
    case 'ok': return 'text-green-400'
    case 'activity': return 'text-amber-400'
    case 'needs_service': return 'text-orange-400'
    case 'replaced': return 'text-blue-400'
    default: return 'text-slate-400'
  }
}

function getStatusBgColor(status: InspectionStatus | undefined): string {
  if (!status) return 'bg-slate-500/20'
  switch (status) {
    case 'ok': return 'bg-green-500/20'
    case 'activity': return 'bg-amber-500/20'
    case 'needs_service': return 'bg-orange-500/20'
    case 'replaced': return 'bg-blue-500/20'
    default: return 'bg-slate-500/20'
  }
}

// ============================================
// STATION CARD COMPONENT
// ============================================

interface StationCardProps {
  station: OutdoorStation | IndoorStation
  type: 'outdoor' | 'indoor'
  inspectedStatus?: InspectionStatus
  onClick: () => void
}

function StationCard({ station, type, inspectedStatus, onClick }: StationCardProps) {
  const isOutdoor = type === 'outdoor'
  const stationNumber = isOutdoor
    ? (station as OutdoorStation).serial_number
    : (station as IndoorStation).station_number
  const stationName = station.station_type_data?.name ||
    (isOutdoor ? (station as OutdoorStation).equipment_type : (station as IndoorStation).station_type) ||
    'Station'
  const stationColor = station.station_type_data?.color || '#64748b'

  return (
    <motion.div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        inspectedStatus
          ? `${getStatusBgColor(inspectedStatus)} border-${INSPECTION_STATUS_CONFIG[inspectedStatus]?.color || 'slate-500'}/30`
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
      }`}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
            style={{
              backgroundColor: `${stationColor}20`,
              borderColor: inspectedStatus ? undefined : stationColor
            }}
          >
            {inspectedStatus ? (
              <CheckCircle2 className={`w-5 h-5 ${getStatusTextColor(inspectedStatus)}`} />
            ) : (
              isOutdoor ? (
                <MapPin className="w-5 h-5" style={{ color: stationColor }} />
              ) : (
                <Building2 className="w-5 h-5" style={{ color: stationColor }} />
              )
            )}
          </div>
          <div>
            <div className="font-medium text-white">
              {stationNumber || 'Utan nummer'}
            </div>
            <div className="text-sm text-slate-400">{stationName}</div>
            {inspectedStatus && (
              <div className={`text-xs mt-1 ${getStatusTextColor(inspectedStatus)}`}>
                {INSPECTION_STATUS_CONFIG[inspectedStatus]?.label}
              </div>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-slate-500" />
      </div>
    </motion.div>
  )
}

// ============================================
// INSPECTION FORM SHEET
// ============================================

interface InspectionFormSheetProps {
  station: OutdoorStation | IndoorStation
  type: 'outdoor' | 'indoor'
  isOpen: boolean
  onClose: () => void
  onSubmit: (status: InspectionStatus, findings?: string, measurementValue?: number) => Promise<void>
  isSubmitting: boolean
}

function InspectionFormSheet({ station, type, isOpen, onClose, onSubmit, isSubmitting }: InspectionFormSheetProps) {
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus | null>(null)
  const [findings, setFindings] = useState('')
  const [measurementValue, setMeasurementValue] = useState<string>('')

  const isOutdoor = type === 'outdoor'
  const stationNumber = isOutdoor
    ? (station as OutdoorStation).serial_number
    : (station as IndoorStation).station_number
  const measurementUnit = station.station_type_data?.measurement_unit

  const handleSubmit = async () => {
    if (!selectedStatus) return
    const numValue = measurementValue ? parseFloat(measurementValue) : undefined
    await onSubmit(selectedStatus, findings || undefined, numValue)
    // Reset form
    setSelectedStatus(null)
    setFindings('')
    setMeasurementValue('')
  }

  const statusOptions: Array<{ key: InspectionStatus; config: typeof INSPECTION_STATUS_CONFIG[InspectionStatus] }> = [
    { key: 'ok', config: INSPECTION_STATUS_CONFIG.ok },
    { key: 'activity', config: INSPECTION_STATUS_CONFIG.activity },
    { key: 'needs_service', config: INSPECTION_STATUS_CONFIG.needs_service },
    { key: 'replaced', config: INSPECTION_STATUS_CONFIG.replaced }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Inspektera station</h2>
                  <p className="text-sm text-slate-400">{stationNumber || 'Utan nummer'}</p>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Välj status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {statusOptions.map(({ key, config }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedStatus(key)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedStatus === key
                          ? `border-${config.color} ${config.bgColor}`
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className={`text-2xl mb-1`}>{config.icon}</div>
                      <div className={`font-medium ${selectedStatus === key ? getStatusTextColor(key) : 'text-white'}`}>
                        {config.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Measurement Value (if applicable) */}
              {measurementUnit && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Mätvärde ({measurementUnit})
                  </label>
                  <input
                    type="number"
                    value={measurementValue}
                    onChange={(e) => setMeasurementValue(e.target.value)}
                    placeholder={`Ange värde i ${measurementUnit}`}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                  />
                </div>
              )}

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

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!selectedStatus || isSubmitting}
                loading={isSubmitting}
                className="w-full"
                size="lg"
              >
                <Check className="w-5 h-5 mr-2" />
                Spara inspektion
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================
// COMPLETION DIALOG
// ============================================

interface CompletionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  progress: SessionProgress | null
  isSubmitting: boolean
}

function CompletionDialog({ isOpen, onClose, onConfirm, progress, isSubmitting }: CompletionDialogProps) {
  if (!isOpen) return null

  const allInspected = progress ? progress.inspectedCount >= progress.totalCount : false

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 rounded-xl max-w-md w-full p-6 border border-slate-700"
      >
        <div className="text-center">
          {allInspected ? (
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          )}

          <h2 className="text-xl font-bold text-white mb-2">
            {allInspected ? 'Alla stationer inspekterade!' : 'Avsluta kontroll?'}
          </h2>

          <p className="text-slate-400 mb-6">
            {allInspected
              ? `Du har inspekterat alla ${progress?.totalCount} stationer. Vill du avsluta kontrollen?`
              : `Du har inspekterat ${progress?.inspectedCount} av ${progress?.totalCount} stationer. Vill du ändå avsluta?`
            }
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              onClick={onConfirm}
              loading={isSubmitting}
              className="flex-1"
            >
              Avsluta kontroll
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
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
  const [indoorStations, setIndoorStations] = useState<IndoorStation[]>([])
  const [floorPlans, setFloorPlans] = useState<any[]>([])
  const [progress, setProgress] = useState<SessionProgress | null>(null)

  // Inspected stations (local state for quick UI)
  const [inspectedOutdoor, setInspectedOutdoor] = useState<Map<string, InspectedStation>>(new Map())
  const [inspectedIndoor, setInspectedIndoor] = useState<Map<string, InspectedStation>>(new Map())

  // Form state
  const [selectedStation, setSelectedStation] = useState<{
    station: OutdoorStation | IndoorStation
    type: 'outdoor' | 'indoor'
  } | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Completion state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    if (!caseId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch case data
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

        // Fetch inspection session
        const sessionData = await getInspectionSessionByCaseId(caseId)
        setSession(sessionData)

        if (!caseResult.customer_id) {
          throw new Error('Ärendet saknar kundkoppling')
        }

        // Fetch stations
        const [outdoor, indoor, plans] = await Promise.all([
          getOutdoorStationsForCustomer(caseResult.customer_id),
          getIndoorStationsForCustomer(caseResult.customer_id),
          getFloorPlansForCustomer(caseResult.customer_id)
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)
        setFloorPlans(plans)

        // Set active tab based on available stations
        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
        }

        // Fetch progress
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
    setIsFormOpen(true)
  }

  const handleInspectionSubmit = async (status: InspectionStatus, findings?: string, measurementValue?: number) => {
    if (!selectedStation || !session || !profile) return

    setIsSubmitting(true)
    try {
      if (selectedStation.type === 'outdoor') {
        await createOutdoorInspection({
          station_id: selectedStation.station.id,
          session_id: session.id,
          status,
          findings,
          measurement_value: measurementValue,
          inspected_by: profile.id
        })

        setInspectedOutdoor(prev => {
          const next = new Map(prev)
          next.set(selectedStation.station.id, {
            stationId: selectedStation.station.id,
            status,
            inspectedAt: new Date().toISOString()
          })
          return next
        })
      } else {
        await createIndoorInspection({
          station_id: selectedStation.station.id,
          session_id: session.id,
          status,
          findings,
          measurement_value: measurementValue,
          inspected_by: profile.id
        })

        setInspectedIndoor(prev => {
          const next = new Map(prev)
          next.set(selectedStation.station.id, {
            stationId: selectedStation.station.id,
            status,
            inspectedAt: new Date().toISOString()
          })
          return next
        })
      }

      // Update progress
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
  const totalStations = outdoorStations.length + indoorStations.length
  const inspectedCount = inspectedOutdoor.size + inspectedIndoor.size

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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCompletionDialog(true)}
            >
              Avsluta
            </Button>
          )}
        </div>
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
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Session Status / Start Button */}
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
              type="outdoor"
              inspectedStatus={inspectedOutdoor.get(station.id)?.status}
              onClick={() => handleStationClick(station, 'outdoor')}
            />
          ))
        )}

        {activeTab === 'outdoor' && outdoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga utomhusstationer hittades</p>
          </div>
        )}

        {activeTab === 'indoor' && indoorStations.length > 0 && (
          indoorStations.map(station => (
            <StationCard
              key={station.id}
              station={station}
              type="indoor"
              inspectedStatus={inspectedIndoor.get(station.id)?.status}
              onClick={() => handleStationClick(station, 'indoor')}
            />
          ))
        )}

        {activeTab === 'indoor' && indoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga inomhusstationer hittades</p>
          </div>
        )}
      </div>

      {/* Inspection Form Sheet */}
      {selectedStation && (
        <InspectionFormSheet
          station={selectedStation.station}
          type={selectedStation.type}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false)
            setSelectedStation(null)
          }}
          onSubmit={handleInspectionSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Completion Dialog */}
      <CompletionDialog
        isOpen={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
        onConfirm={handleCompleteInspection}
        progress={progress}
        isSubmitting={isCompleting}
      />
    </div>
  )
}
