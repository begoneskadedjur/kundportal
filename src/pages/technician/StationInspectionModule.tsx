// src/pages/technician/StationInspectionModule.tsx
// Steg 4: Lägger till inspectionSessionService och typer

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  getInspectionSessionByCaseId,
  getOutdoorStationsForCustomer,
  getIndoorStationsForCustomer,
  getFloorPlansForCustomer
} from '../../services/inspectionSessionService'
import {
  InspectionSessionWithRelations,
  InspectionTab,
  SessionProgress
} from '../../types/inspectionSession'
import { IndoorStationWithRelations } from '../../types/indoor'
import { INSPECTION_STATUS_CONFIG, InspectionStatus } from '../../types/indoor'

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)

  useEffect(() => {
    // Simulera laddning
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar (DEBUG Steg 4)..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl p-6 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-white mb-4">
          Stationskontroll (DEBUG Steg 4)
        </h1>
        <p className="text-slate-400 mb-2">Case ID: {caseId || 'N/A'}</p>
        <p className="text-green-400 mb-4">
          Services och typer importerade OK!
        </p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-slate-800 rounded-lg"
        >
          <div className="flex items-center justify-center gap-2 text-cyan-400">
            <CheckCircle2 className="w-5 h-5" />
            <span>INSPECTION_STATUS_CONFIG finns!</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Statusar: {Object.keys(INSPECTION_STATUS_CONFIG).join(', ')}
          </div>
        </motion.div>

        <Button
          variant="secondary"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>
      </div>
    </div>
  )
}
