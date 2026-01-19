// src/pages/technician/StationInspectionModule.tsx
// TEST 4: Direkt import type från indoor.ts

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'

// Service-funktioner
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer
} from '../../services/inspectionSessionService'

// Typer från inspectionSession.ts
import type {
  InspectionSessionWithRelations,
  SessionProgress
} from '../../types/inspectionSession'

// TEST 4: Direkt import type från indoor.ts
import type { InspectionStatus } from '../../types/indoor'

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<any>(null)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [outdoorStations, setOutdoorStations] = useState<any[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])

  // TEST 4: State med InspectionStatus typ
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus>('ok')

  useEffect(() => {
    async function loadData() {
      if (!caseId) {
        setError('Inget ärende-ID')
        setLoading(false)
        return
      }

      try {
        console.log('TEST 4: Laddar med InspectionStatus typ...')

        const { data, error: caseError } = await supabase
          .from('cases')
          .select('id, title, case_number, customer_id, customers(company_name)')
          .eq('id', caseId)
          .single()

        if (caseError) throw caseError
        setCaseData(data)

        const sessionData = await getInspectionSessionByCaseId(caseId)
        setSession(sessionData)

        if (sessionData?.customer_id) {
          const [outdoor, indoor] = await Promise.all([
            getOutdoorStationsForCustomer(sessionData.customer_id),
            getIndoorStationsForCustomer(sessionData.customer_id)
          ])
          setOutdoorStations(outdoor)
          setIndoorStations(indoor)
          console.log('TEST 4: Stationer laddade', { outdoor: outdoor.length, indoor: indoor.length })
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

  // TEST 4: Lokalt definierade statusval (inte importerade)
  const STATUS_OPTIONS: { key: InspectionStatus; label: string }[] = [
    { key: 'ok', label: 'OK' },
    { key: 'activity', label: 'Aktivitet' },
    { key: 'needs_service', label: 'Service' },
    { key: 'replaced', label: 'Ersatt' }
  ]

  console.log('TEST 4: Render', { selectedStatus })

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
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">TEST 4: import type indoor.ts</h1>
            <p className="text-slate-400 text-sm">Direkt import type InspectionStatus</p>
          </div>
        </div>

        {/* Status selector TEST */}
        <div className="glass rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-white mb-4">Status (InspectionStatus typ)</h2>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSelectedStatus(opt.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === opt.key
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-slate-400 mt-2">Vald status: {selectedStatus}</p>
        </div>

        {/* Progress */}
        {progress && (
          <div className="glass rounded-xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-white mb-4">Progress</h2>
            <p className="text-slate-300">
              {progress.inspectedStations}/{progress.totalStations} ({progress.percentComplete}%)
            </p>
          </div>
        )}

        {/* Stationer */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Stationer</h2>
          <p className="text-slate-300">Utomhus: {outdoorStations.length}</p>
          <p className="text-slate-300">Inomhus: {indoorStations.length}</p>
        </div>
      </div>
    </div>
  )
}
