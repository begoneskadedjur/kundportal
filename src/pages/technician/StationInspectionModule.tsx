// src/pages/technician/StationInspectionModule.tsx
// Huvudmodul för stationskontroll (Fas 5)

import { useState, useEffect, useMemo } from 'react'
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
  Grid3X3,
  Play,
  Check,
  X
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
import { IndoorStationWithRelations } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG, InspectionStatus } from '../../types/indoor'

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
  }
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
  const [indoorStations, setIndoorStations] = useState<IndoorStationWithRelations[]>([])
  const [floorPlans, setFloorPlans] = useState<any[]>([])
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null)
  const [progress, setProgress] = useState<SessionProgress | null>(null)

  // Inspekterade stationer (lokalt state för snabb UI)
  const [inspectedOutdoor, setInspectedOutdoor] = useState<Map<string, InspectedStation>>(new Map())
  const [inspectedIndoor, setInspectedIndoor] = useState<Map<string, InspectedStation>>(new Map())

  // Aktiv station för formulär
  const [selectedStation, setSelectedStation] = useState<{
    station: OutdoorStation | IndoorStationWithRelations
    type: 'outdoor' | 'indoor'
  } | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Avslutningsvy
  const [isCompleting, setIsCompleting] = useState(false)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)

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

        // Sätt första planritningen som vald
        if (plans.length > 0) {
          setSelectedFloorPlanId(plans[0].id)
        }

        // Bestäm aktiv flik baserat på tillgängliga stationer
        if (outdoor.length === 0 && indoor.length > 0) {
          setActiveTab('indoor')
        }

        // Hämta progress om session finns
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

  const handleStationClick = (station: OutdoorStation | IndoorStationWithRelations, type: 'outdoor' | 'indoor') => {
    setSelectedStation({ station, type })
    setIsFormOpen(true)
  }

  const handleInspectionSubmit = async (status: InspectionStatus, findings?: string, measurementValue?: number) => {
    if (!selectedStation || !session) return

    const technicianId = profile?.technician_id

    if (selectedStation.type === 'outdoor') {
      const result = await createOutdoorInspection({
        station_id: selectedStation.station.id,
        session_id: session.id,
        status,
        findings,
        measurement_value: measurementValue
      }, technicianId)

      if (result) {
        setInspectedOutdoor(prev => {
          const newMap = new Map(prev)
          newMap.set(selectedStation.station.id, {
            stationId: selectedStation.station.id,
            status,
            inspectedAt: new Date().toISOString()
          })
          return newMap
        })
      }
    } else {
      const result = await createIndoorInspection({
        station_id: selectedStation.station.id,
        session_id: session.id,
        status,
        findings,
        measurement_value: measurementValue
      }, technicianId)

      if (result) {
        setInspectedIndoor(prev => {
          const newMap = new Map(prev)
          newMap.set(selectedStation.station.id, {
            stationId: selectedStation.station.id,
            status,
            inspectedAt: new Date().toISOString()
          })
          return newMap
        })
      }
    }

    // Uppdatera progress
    if (session) {
      const progressData = await calculateSessionProgress(session.id)
      setProgress(progressData)
    }

    setIsFormOpen(false)
    setSelectedStation(null)
  }

  const handleCompleteInspection = async () => {
    if (!session || !caseId) return

    setIsCompleting(true)

    try {
      // Avsluta sessionen
      await completeInspectionSession(session.id)

      // Uppdatera ärendestatus
      await supabase
        .from('cases')
        .update({ status: 'Avslutat' })
        .eq('id', caseId)

      // Navigera tillbaka
      navigate('/technician/schedule')
    } catch (err) {
      console.error('Error completing inspection:', err)
    } finally {
      setIsCompleting(false)
    }
  }

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const totalStations = outdoorStations.length + indoorStations.length
  const inspectedCount = inspectedOutdoor.size + inspectedIndoor.size
  const progressPercent = totalStations > 0 ? Math.round((inspectedCount / totalStations) * 100) : 0

  const filteredIndoorStations = useMemo(() => {
    if (!selectedFloorPlanId) return indoorStations
    return indoorStations.filter(s => s.floor_plan_id === selectedFloorPlanId)
  }, [indoorStations, selectedFloorPlanId])

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar inspektionsdata..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-red-400 font-medium">Fel vid laddning</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold text-white">Stationskontroll</h1>
              <p className="text-sm text-slate-400">
                {caseData?.customer?.company_name || 'Okänd kund'}
              </p>
            </div>
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-400">Progress</span>
              <span className="text-cyan-400 font-medium">
                {inspectedCount} / {totalStations} stationer ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setActiveTab('outdoor')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'outdoor'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800 text-slate-400 border border-transparent'
            }`}
          >
            <Map className="w-4 h-4" />
            Utomhus ({outdoorStations.length})
          </button>
          <button
            onClick={() => setActiveTab('indoor')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'indoor'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800 text-slate-400 border border-transparent'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Inomhus ({indoorStations.length})
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Status banner för ej startad session */}
        {session?.status === 'scheduled' && (
          <div className="px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-white">Kontroll ej startad</p>
                  <p className="text-xs text-slate-400">Tryck på knappen för att börja</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleStartInspection}
                className="bg-cyan-600 hover:bg-cyan-500"
              >
                <Play className="w-4 h-4 mr-1" />
                Starta
              </Button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'outdoor' ? (
            <motion.div
              key="outdoor"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-4 space-y-3"
            >
              {outdoorStations.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Inga utomhusstationer</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Denna kund har inga utomhusstationer registrerade
                  </p>
                </div>
              ) : (
                outdoorStations.map(station => (
                  <StationCard
                    key={station.id}
                    station={station}
                    type="outdoor"
                    isInspected={inspectedOutdoor.has(station.id)}
                    inspectionStatus={inspectedOutdoor.get(station.id)?.status}
                    onClick={() => handleStationClick(station, 'outdoor')}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="indoor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              {/* Planritningsväljare */}
              {floorPlans.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {floorPlans.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedFloorPlanId(plan.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                        selectedFloorPlanId === plan.id
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {plan.name}
                    </button>
                  ))}
                </div>
              )}

              {indoorStations.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Inga inomhusstationer</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Denna kund har inga inomhusstationer registrerade
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIndoorStations.map(station => (
                    <StationCard
                      key={station.id}
                      station={station}
                      type="indoor"
                      isInspected={inspectedIndoor.has(station.id)}
                      inspectionStatus={inspectedIndoor.get(station.id)?.status}
                      onClick={() => handleStationClick(station, 'indoor')}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer med avsluta-knapp */}
      {session?.status === 'in_progress' && (
        <footer className="sticky bottom-0 z-40 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 px-4 py-4">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-500"
            onClick={() => setShowCompletionDialog(true)}
            disabled={inspectedCount === 0}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Avsluta kontroll ({inspectedCount}/{totalStations})
          </Button>
        </footer>
      )}

      {/* Inspektionsformulär */}
      <AnimatePresence>
        {isFormOpen && selectedStation && (
          <InspectionFormSheet
            station={selectedStation.station}
            type={selectedStation.type}
            onClose={() => {
              setIsFormOpen(false)
              setSelectedStation(null)
            }}
            onSubmit={handleInspectionSubmit}
          />
        )}
      </AnimatePresence>

      {/* Bekräftelsedialog */}
      <AnimatePresence>
        {showCompletionDialog && (
          <CompletionDialog
            inspectedCount={inspectedCount}
            totalStations={totalStations}
            isLoading={isCompleting}
            onConfirm={handleCompleteInspection}
            onCancel={() => setShowCompletionDialog(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// STATION CARD COMPONENT
// ============================================

interface StationCardProps {
  station: OutdoorStation | IndoorStationWithRelations
  type: 'outdoor' | 'indoor'
  isInspected: boolean
  inspectionStatus?: InspectionStatus
  onClick: () => void
}

function StationCard({ station, type, isInspected, inspectionStatus, onClick }: StationCardProps) {
  const statusConfig = inspectionStatus ? INSPECTION_STATUS_CONFIG[inspectionStatus] : null

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl text-left transition-all ${
        isInspected
          ? 'bg-emerald-500/10 border border-emerald-500/30'
          : 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          isInspected ? 'bg-emerald-500/20' : 'bg-slate-700/50'
        }`}>
          {isInspected ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            type === 'outdoor' ? (
              <MapPin className="w-6 h-6 text-slate-400" />
            ) : (
              <Building2 className="w-6 h-6 text-slate-400" />
            )
          )}
        </div>

        {/* Station info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white truncate">
              {station.station_number || 'Utan nummer'}
            </h3>
            {isInspected && statusConfig && (
              <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor} ${statusConfig.color.includes('green') ? 'text-green-400' : statusConfig.color.includes('amber') ? 'text-amber-400' : statusConfig.color.includes('orange') ? 'text-orange-400' : 'text-blue-400'}`}>
                {statusConfig.label.split(' - ')[0]}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">
            {station.location_description || (type === 'indoor' ? (station as IndoorStationWithRelations).floor_plan?.name : 'Ingen platsbeskrivning')}
          </p>
        </div>

        {/* Arrow */}
        <ChevronRight className={`w-5 h-5 ${isInspected ? 'text-emerald-400' : 'text-slate-500'}`} />
      </div>
    </button>
  )
}

// ============================================
// INSPECTION FORM SHEET
// ============================================

interface InspectionFormSheetProps {
  station: OutdoorStation | IndoorStationWithRelations
  type: 'outdoor' | 'indoor'
  onClose: () => void
  onSubmit: (status: InspectionStatus, findings?: string, measurementValue?: number) => void
}

function InspectionFormSheet({ station, type, onClose, onSubmit }: InspectionFormSheetProps) {
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus | null>(null)
  const [findings, setFindings] = useState('')
  const [measurementValue, setMeasurementValue] = useState<string>('')

  const stationTypeData = type === 'outdoor'
    ? (station as OutdoorStation).station_type_data
    : (station as IndoorStationWithRelations).station_type_data

  const handleSubmit = () => {
    if (!selectedStatus) return
    onSubmit(
      selectedStatus,
      findings || undefined,
      measurementValue ? parseFloat(measurementValue) : undefined
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {station.station_number || 'Station'}
              </h2>
              <p className="text-sm text-slate-400">
                {station.location_description || 'Registrera kontrollresultat'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Status buttons */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Kontrollresultat *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(INSPECTION_STATUS_CONFIG) as [InspectionStatus, typeof INSPECTION_STATUS_CONFIG[InspectionStatus]][]).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedStatus === status
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center mx-auto mb-2`}>
                    <span className="text-xl">{config.icon}</span>
                  </div>
                  <p className={`text-sm font-medium ${selectedStatus === status ? 'text-cyan-400' : 'text-white'}`}>
                    {config.label.split(' - ')[0]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Measurement input (if applicable) */}
          {stationTypeData?.measurement_unit && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mätvärde ({stationTypeData.measurement_unit})
              </label>
              <input
                type="number"
                value={measurementValue}
                onChange={e => setMeasurementValue(e.target.value)}
                placeholder="T.ex. 15"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Findings textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Anteckningar (valfritt)
            </label>
            <textarea
              value={findings}
              onChange={e => setFindings(e.target.value)}
              rows={3}
              placeholder="Beskriv eventuella fynd eller observationer..."
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!selectedStatus}
          >
            <Check className="w-5 h-5 mr-2" />
            Registrera kontroll
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================
// COMPLETION DIALOG
// ============================================

interface CompletionDialogProps {
  inspectedCount: number
  totalStations: number
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

function CompletionDialog({ inspectedCount, totalStations, isLoading, onConfirm, onCancel }: CompletionDialogProps) {
  const allInspected = inspectedCount === totalStations

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-900 rounded-2xl max-w-sm w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            allInspected ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}>
            {allInspected ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : (
              <AlertCircle className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Avsluta kontroll?
          </h3>
          <p className="text-slate-400">
            {allInspected ? (
              <>Alla {totalStations} stationer är kontrollerade.</>
            ) : (
              <>
                Du har kontrollerat {inspectedCount} av {totalStations} stationer.
                {' '}<span className="text-amber-400">{totalStations - inspectedCount} stationer kvarstår.</span>
              </>
            )}
          </p>
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            Avbryt
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-500"
            onClick={onConfirm}
            loading={isLoading}
          >
            Avsluta
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
