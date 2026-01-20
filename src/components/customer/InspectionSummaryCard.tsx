// src/components/customer/InspectionSummaryCard.tsx
// Sammanfattningskort för senaste stationskontroll - visas i kundportalen

import { Calendar, User, CheckCircle2, AlertTriangle, Clock, ChevronRight, Sparkles } from 'lucide-react'
import type { InspectionSessionWithRelations } from '../../types/inspectionSession'

interface InspectionSummaryCardProps {
  session: InspectionSessionWithRelations
  statusCounts: {
    ok: number
    activity: number
    other: number
  }
  onViewDetails?: () => void
}

export function InspectionSummaryCard({
  session,
  statusCounts,
  onViewDetails
}: InspectionSummaryCardProps) {
  const totalInspected = session.inspected_outdoor_stations + session.inspected_indoor_stations

  // Hämta teknikernamn - hantera olika format från Supabase
  const getTechnicianName = (): string => {
    const tech = session.technician
    if (!tech) return 'Okänd tekniker'
    // Supabase kan returnera antingen objekt direkt eller som array med ett element
    if (Array.isArray(tech)) {
      return tech[0]?.name || 'Okänd tekniker'
    }
    return tech.name || 'Okänd tekniker'
  }
  const technicianName = getTechnicianName()

  // Formatera datum
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Ej angivet'
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      weekday: 'long',
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

  // Beräkna övergripande status
  const getOverallStatus = () => {
    if (statusCounts.activity > 0) {
      return {
        label: 'Aktivitet upptäckt',
        color: 'amber',
        icon: AlertTriangle,
        description: `${statusCounts.activity} station${statusCounts.activity > 1 ? 'er' : ''} med aktivitet`
      }
    }
    if (statusCounts.other > 0) {
      return {
        label: 'Åtgärd krävs',
        color: 'blue',
        icon: Clock,
        description: `${statusCounts.other} station${statusCounts.other > 1 ? 'er' : ''} kräver åtgärd`
      }
    }
    return {
      label: 'Allt OK',
      color: 'emerald',
      icon: CheckCircle2,
      description: 'Alla stationer i gott skick'
    }
  }

  const overallStatus = getOverallStatus()
  const StatusIcon = overallStatus.icon

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header med statusindikator */}
      <div className={`px-6 py-4 border-b border-slate-700/50 ${
        overallStatus.color === 'emerald' ? 'bg-emerald-500/10' :
        overallStatus.color === 'amber' ? 'bg-amber-500/10' :
        'bg-blue-500/10'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              overallStatus.color === 'emerald' ? 'bg-emerald-500/20' :
              overallStatus.color === 'amber' ? 'bg-amber-500/20' :
              'bg-blue-500/20'
            }`}>
              <StatusIcon className={`w-5 h-5 ${
                overallStatus.color === 'emerald' ? 'text-emerald-400' :
                overallStatus.color === 'amber' ? 'text-amber-400' :
                'text-blue-400'
              }`} />
            </div>
            <div>
              <h3 className={`font-semibold ${
                overallStatus.color === 'emerald' ? 'text-emerald-400' :
                overallStatus.color === 'amber' ? 'text-amber-400' :
                'text-blue-400'
              }`}>
                {overallStatus.label}
              </h3>
              <p className="text-sm text-slate-400">{overallStatus.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Senaste kontroll</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Service info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Datum */}
          <div className="bg-slate-900/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">Datum</span>
            </div>
            <p className="text-white font-medium text-sm">
              {formatDate(session.completed_at)}
            </p>
            {session.completed_at && (
              <p className="text-xs text-slate-500 mt-0.5">
                kl. {formatTime(session.completed_at)}
              </p>
            )}
          </div>

          {/* Tekniker */}
          <div className="bg-slate-900/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">Tekniker</span>
            </div>
            <p className="text-white font-medium text-sm">{technicianName}</p>
          </div>

          {/* Antal inspekterade */}
          <div className="bg-slate-900/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">Inspekterade</span>
            </div>
            <p className="text-white font-medium text-sm">{totalInspected} stationer</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {session.inspected_outdoor_stations} ute, {session.inspected_indoor_stations} inne
            </p>
          </div>

          {/* Statusfördelning */}
          <div className="bg-slate-900/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500 border border-slate-900"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500 border border-slate-900"></div>
              </div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-white font-medium text-sm">{statusCounts.ok}</span>
              </div>
              {statusCounts.activity > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-amber-400 font-medium text-sm">{statusCounts.activity}</span>
                </div>
              )}
              {statusCounts.other > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-blue-400 font-medium text-sm">{statusCounts.other}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Anteckningar om det finns */}
        {session.notes && (
          <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Teknikerns anteckning</p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}

        {/* CTA knapp */}
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>Visa alla inspektionsdetaljer</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
