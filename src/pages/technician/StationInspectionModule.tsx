// src/pages/technician/StationInspectionModule.tsx
// TEST 6: Lägg till framer-motion (motion + AnimatePresence)

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Building2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'

// Service-funktioner
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer
} from '../../services/inspectionSessionService'

// Typer
import type {
  InspectionSessionWithRelations,
  SessionProgress
} from '../../types/inspectionSession'
import type { InspectionStatus } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [outdoorStations, setOutdoorStations] = useState<any[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus>('ok')
  const [activeTab, setActiveTab] = useState<'outdoor' | 'indoor'>('outdoor')

  useEffect(() => {
    async function loadData() {
      if (!caseId) {
        setError('Inget ärende-ID')
        setLoading(false)
        return
      }

      try {
        console.log('TEST 6: Laddar med framer-motion...')

        const { data, error: caseError } = await supabase
          .from('cases')
          .select('id, title, case_number, customer_id, customers(company_name)')
          .eq('id', caseId)
          .single()

        if (caseError) throw caseError

        const sessionData = await getInspectionSessionByCaseId(caseId)
        setSession(sessionData)

        if (sessionData?.customer_id) {
          const [outdoor, indoor] = await Promise.all([
            getOutdoorStationsForCustomer(sessionData.customer_id),
            getIndoorStationsForCustomer(sessionData.customer_id)
          ])
          setOutdoorStations(outdoor)
          setIndoorStations(indoor)
        }

      } catch (err) {
        console.error('Error:', err)
        setError('Kunde inte ladda ärende')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  const progress: SessionProgress | null = session ? {
    totalStations: session.total_outdoor_stations + session.total_indoor_stations,
    inspectedStations: session.inspected_outdoor_stations + session.inspected_indoor_stations,
    percentComplete: Math.round(
      ((session.inspected_outdoor_stations + session.inspected_indoor_stations) /
      (session.total_outdoor_stations + session.total_indoor_stations || 1)) * 100
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

  const STATUS_OPTIONS = (Object.keys(INSPECTION_STATUS_CONFIG) as InspectionStatus[]).map(key => ({
    key,
    label: INSPECTION_STATUS_CONFIG[key].label,
    icon: INSPECTION_STATUS_CONFIG[key].icon
  }))

  console.log('TEST 6: Render med framer-motion')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-950 p-4"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">TEST 6: framer-motion</h1>
            <p className="text-slate-400 text-sm">motion + AnimatePresence</p>
          </div>
        </div>

        {/* Tabs med AnimatePresence */}
        <div className="glass rounded-xl p-4 mb-4">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('outdoor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'outdoor'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Utomhus ({outdoorStations.length})
            </button>
            <button
              onClick={() => setActiveTab('indoor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'indoor'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Inomhus ({indoorStations.length})
            </button>
          </div>

          {/* AnimatePresence för tab-innehåll */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'outdoor' ? (
                <div className="space-y-2">
                  <h3 className="text-white font-medium">Utomhusstationer</h3>
                  {outdoorStations.map((station, i) => (
                    <motion.div
                      key={station.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-slate-800 p-3 rounded-lg"
                    >
                      <p className="text-slate-300">{station.serial_number || `Station ${i + 1}`}</p>
                      <p className="text-slate-500 text-sm">{station.station_type_data?.name || station.equipment_type}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-white font-medium">Inomhusstationer</h3>
                  {indoorStations.map((station, i) => (
                    <motion.div
                      key={station.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-slate-800 p-3 rounded-lg"
                    >
                      <p className="text-slate-300">{station.station_number || `Station ${i + 1}`}</p>
                      <p className="text-slate-500 text-sm">{station.floor_plan?.name}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Status selector */}
        <div className="glass rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(opt => (
              <motion.button
                key={opt.key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedStatus(opt.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedStatus === opt.key
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Progress</h2>
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentComplete}%` }}
                transition={{ duration: 0.5 }}
                className="bg-green-500 h-3 rounded-full"
              />
            </div>
            <p className="text-slate-300">
              {progress.inspectedStations}/{progress.totalStations} ({progress.percentComplete}%)
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
