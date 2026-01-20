// src/components/customer/InspectionHistoryList.tsx
// Lista över tidigare inspektioner/servicebesök för kundportalen

import { useState } from 'react'
import { Calendar, User, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import type { InspectionSessionWithRelations } from '../../types/inspectionSession'

interface InspectionHistoryListProps {
  sessions: InspectionSessionWithRelations[]
  onSelectSession: (session: InspectionSessionWithRelations) => void
  currentSessionId?: string
}

export function InspectionHistoryList({
  sessions,
  onSelectSession,
  currentSessionId
}: InspectionHistoryListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  // Formatera datum
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Ej angivet'
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Beräkna varaktighet
  const getDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt || !completedAt) return null
    const start = new Date(startedAt).getTime()
    const end = new Date(completedAt).getTime()
    const minutes = Math.round((end - start) / 60000)

    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours} tim ${remainingMinutes} min` : `${hours} tim`
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-slate-400">Ingen servicehistorik tillgänglig</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, index) => {
        const isExpanded = expandedIndex === index
        const isCurrent = session.id === currentSessionId
        const technicianName = (session.technician as any)?.name || 'Tekniker'
        const totalInspected = session.inspected_outdoor_stations + session.inspected_indoor_stations
        const duration = getDuration(session.started_at, session.completed_at)

        return (
          <div
            key={session.id}
            className={`bg-slate-900/50 rounded-xl border transition-colors ${
              isCurrent
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-700/50 hover:border-slate-600/50'
            }`}
          >
            {/* Main row - always visible */}
            <button
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
              className="w-full p-4 flex items-center gap-4 text-left"
            >
              {/* Date indicator */}
              <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                isCurrent ? 'bg-emerald-500/20' : 'bg-slate-800'
              }`}>
                <span className={`text-lg font-bold ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                  {session.completed_at ? new Date(session.completed_at).getDate() : '-'}
                </span>
                <span className={`text-xs uppercase ${isCurrent ? 'text-emerald-400/70' : 'text-slate-500'}`}>
                  {session.completed_at
                    ? new Date(session.completed_at).toLocaleDateString('sv-SE', { month: 'short' })
                    : '---'
                  }
                </span>
              </div>

              {/* Info */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">
                    Servicebesök
                  </span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded">
                      Senaste
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {technicianName}
                  </span>
                  <span>{totalInspected} stationer</span>
                  {duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {duration}
                    </span>
                  )}
                </div>
              </div>

              {/* Expand icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                isExpanded ? 'bg-emerald-500/20' : 'bg-slate-800'
              }`}>
                {isExpanded ? (
                  <ChevronUp className={`w-5 h-5 ${isExpanded ? 'text-emerald-400' : 'text-slate-400'}`} />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Datum */}
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Datum</p>
                    <p className="text-white text-sm">{formatDate(session.completed_at)}</p>
                    {session.completed_at && (
                      <p className="text-xs text-slate-500">kl. {formatTime(session.completed_at)}</p>
                    )}
                  </div>

                  {/* Stationer */}
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Inspekterade</p>
                    <p className="text-white text-sm">{totalInspected} stationer</p>
                    <p className="text-xs text-slate-500">
                      {session.inspected_outdoor_stations} ute, {session.inspected_indoor_stations} inne
                    </p>
                  </div>
                </div>

                {/* Anteckningar */}
                {session.notes && (
                  <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Anteckningar</p>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{session.notes}</p>
                  </div>
                )}

                {/* Visa detaljer knapp */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectSession(session)
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <span>Visa inspektionsdetaljer</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default InspectionHistoryList
