// src/pages/technician/StationInspectionModule.tsx
// TEST 3: Med typer från inspectionSession.ts

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

// TEST 3: Importera typer från inspectionSession.ts
import type {
  InspectionSessionWithRelations,
  SessionProgress
} from '../../types/inspectionSession'

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<any>(null)
  // TEST 3: Använd typade states
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [outdoorStations, setOutdoorStations] = useState<any[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      if (!caseId) {
        setError('Inget ärende-ID')
        setLoading(false)
        return
      }

      try {
        console.log('TEST 3: Laddar data med typer...')

        const { data, error: caseError } = await supabase
          .from('cases')
          .select('id, title, case_number, customer_id, customers(company_name)')
          .eq('id', caseId)
          .single()

        if (caseError) throw caseError
        setCaseData(data)

        const sessionData = await getInspectionSessionByCaseId(caseId)
        setSession(sessionData)
        console.log('TEST 3: Session laddad', sessionData)

        if (sessionData?.customer_id) {
          const [outdoor, indoor] = await Promise.all([
            getOutdoorStationsForCustomer(sessionData.customer_id),
            getIndoorStationsForCustomer(sessionData.customer_id)
          ])
          setOutdoorStations(outdoor)
          setIndoorStations(indoor)
          console.log('TEST 3: Stationer laddade', { outdoor: outdoor.length, indoor: indoor.length })
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

  // TEST 3: Beräkna progress med typer
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

  console.log('TEST 3: Render', { progress })

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
            <h1 className="text-xl font-bold text-white">TEST 3: Med typer</h1>
            <p className="text-slate-400 text-sm">import type från inspectionSession.ts</p>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="glass rounded-xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-white mb-4">Progress (typat)</h2>
            <div className="text-slate-300">
              <p>Total: {progress.totalStations} stationer</p>
              <p>Inspekterade: {progress.inspectedStations}</p>
              <p>Procent: {progress.percentComplete}%</p>
              <p>Utomhus: {progress.outdoorProgress.inspected}/{progress.outdoorProgress.total}</p>
              <p>Inomhus: {progress.indoorProgress.inspected}/{progress.indoorProgress.total}</p>
            </div>
          </div>
        )}

        {/* Session */}
        <div className="glass rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-white mb-4">Session</h2>
          <p className="text-slate-300">Kund: {session?.customer?.company_name}</p>
          <p className="text-slate-300">Tekniker: {session?.technician?.name}</p>
          <p className="text-slate-300">Status: {session?.status}</p>
        </div>

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
