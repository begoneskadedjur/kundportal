// src/pages/technician/StationInspectionModule.tsx
// STEG 4b DEBUG - UTAN indoor.ts imports

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

// NOTERA: Ingen import från indoor.ts!

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
  const [outdoorStations, setOutdoorStations] = useState<any[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])
  const [progress, setProgress] = useState<SessionProgress | null>(null)

  // Debug info
  console.log('STEG 4b: UTAN indoor.ts imports')

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
        const [outdoor, indoor] = await Promise.all([
          getOutdoorStationsForCustomer(caseResult.customer_id),
          getIndoorStationsForCustomer(caseResult.customer_id)
        ])

        setOutdoorStations(outdoor)
        setIndoorStations(indoor)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Stationskontroll (STEG 4b)</h1>
            <p className="text-sm text-slate-400">
              {caseData?.customer?.company_name || 'Laddar...'}
            </p>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="p-4 bg-purple-900/30 border-b border-purple-700">
        <p className="text-purple-300 text-sm font-bold">
          DEBUG STEG 4b: UTAN indoor.ts imports
        </p>
        <p className="text-purple-400 text-xs mt-1">
          Om detta funkar är problemet i indoor.ts
        </p>
        <p className="text-purple-400 text-xs mt-1">
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

      {/* Simple Station List */}
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white mb-4">
          Utomhusstationer ({outdoorStations.length})
        </h2>

        {outdoorStations.map((station: any) => (
          <motion.div
            key={station.id}
            className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-green-400" />
              <div>
                <div className="font-medium text-white">
                  {station.station_number || 'Utan nummer'}
                </div>
                <div className="text-sm text-slate-400">
                  {station.station_type_data?.name || station.equipment_type_code || 'Station'}
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {outdoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga utomhusstationer hittades</p>
          </div>
        )}

        <h2 className="text-lg font-semibold text-white mt-8 mb-4">
          Inomhusstationer ({indoorStations.length})
        </h2>

        {indoorStations.map((station: any) => (
          <motion.div
            key={station.id}
            className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-blue-400" />
              <div>
                <div className="font-medium text-white">
                  {station.station_number || 'Utan nummer'}
                </div>
                <div className="text-sm text-slate-400">
                  {station.station_type_data?.name || 'Inomhusstation'}
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {indoorStations.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inga inomhusstationer hittades</p>
          </div>
        )}
      </div>
    </div>
  )
}
