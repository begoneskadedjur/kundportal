// src/pages/technician/StationInspectionModule.tsx
// DEBUG VERSION - Minimal för att hitta felet

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl p-6 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-white mb-4">
          Stationskontroll (DEBUG)
        </h1>
        <p className="text-slate-400 mb-2">Case ID: {caseId || 'N/A'}</p>
        <p className="text-green-400 mb-6">
          Om du ser detta fungerar grundläggande rendering!
        </p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka
        </button>
      </div>
    </div>
  )
}
