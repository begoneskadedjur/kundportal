// src/components/customer/CaseJourneyTimeline.tsx
// Tidslinje som visar kundens ärenderesa med trafikljusutveckling

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface TrafficLightUpdate {
  id: string
  update_type: string
  previous_value: string
  new_value: string
  updated_by_name: string
  created_at: string
}

interface CaseJourneyTimelineProps {
  caseId: string
  currentPestLevel?: number | null
  currentProblemRating?: number | null
  assessmentDate?: string | null
  assessedBy?: string | null
  defaultExpanded?: boolean
}

// Beräkna trafikljusstatus
const getTrafficLightStatus = (pestLevel?: number | null, problemRating?: number | null) => {
  if (pestLevel === null && problemRating === null) return null
  if (pestLevel === undefined && problemRating === undefined) return null

  const pest = pestLevel ?? -1
  const problem = problemRating ?? -1

  if (pest >= 3 || problem >= 4) return 'red'
  if (pest === 2 || problem === 3) return 'yellow'
  if (pest >= 0 || problem >= 0) return 'green'
  return null
}

// Statusetiketter och stilar
const statusConfig = {
  green: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
    icon: '🟢',
    label: 'Under kontroll',
    description: 'Situationen är under kontroll'
  },
  yellow: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    icon: '🟡',
    label: 'Förbättras',
    description: 'Situationen kräver fortsatt övervakning'
  },
  red: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    icon: '🔴',
    label: 'Kritiskt',
    description: 'Kritisk situation som kräver åtgärd'
  }
}

const CaseJourneyTimeline: React.FC<CaseJourneyTimelineProps> = ({
  caseId,
  currentPestLevel,
  currentProblemRating,
  // assessmentDate och assessedBy behålls i interfacet för bakåtkompatibilitet men används inte längre
  defaultExpanded = true
}) => {
  const [updates, setUpdates] = useState<TrafficLightUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    const fetchUpdates = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('case_updates_log')
          .select('*')
          .eq('case_id', caseId)
          .in('update_type', ['traffic_light_updated', 'revisit_scheduled'])
          .order('created_at', { ascending: true })

        if (error) throw error
        setUpdates(data || [])
      } catch (error) {
        console.error('Error fetching case journey:', error)
      } finally {
        setLoading(false)
      }
    }

    if (caseId) {
      fetchUpdates()
    }
  }, [caseId])

  // Bygg tidslinje med besök
  const buildTimeline = () => {
    const timeline: Array<{
      id: string
      date: string
      type: 'initial' | 'update' | 'revisit'
      pestLevel?: number | null
      problemRating?: number | null
      previousPestLevel?: number | null
      previousProblemRating?: number | null
      updatedBy?: string
      note?: string
      workReport?: string
      recommendations?: string
    }> = []

    // Gå igenom alla uppdateringar
    updates.forEach((update, index) => {
      if (update.update_type === 'traffic_light_updated') {
        try {
          const newValue = JSON.parse(update.new_value)
          const previousValue = update.previous_value ? JSON.parse(update.previous_value) : {}

          timeline.push({
            id: update.id,
            date: update.created_at,
            type: 'update',
            pestLevel: newValue.pest_level,
            problemRating: newValue.problem_rating,
            previousPestLevel: previousValue.pest_level,
            previousProblemRating: previousValue.problem_rating,
            updatedBy: update.updated_by_name,
            workReport: newValue.work_report,
            recommendations: newValue.recommendations
          })
        } catch (e) {
          console.warn('Could not parse update:', e)
        }
      } else if (update.update_type === 'revisit_scheduled') {
        try {
          const newValue = JSON.parse(update.new_value)
          timeline.push({
            id: update.id,
            date: update.created_at,
            type: 'revisit',
            updatedBy: update.updated_by_name,
            note: newValue.note
          })
        } catch (e) {
          console.warn('Could not parse revisit:', e)
        }
      }
    })

    return timeline
  }

  const timeline = buildTimeline()

  // Beräkna trend mellan två bedömningar
  const getTrend = (
    prevPest: number | null | undefined,
    prevProblem: number | null | undefined,
    newPest: number | null | undefined,
    newProblem: number | null | undefined
  ) => {
    const prevStatus = getTrafficLightStatus(prevPest, prevProblem)
    const newStatus = getTrafficLightStatus(newPest, newProblem)

    if (!prevStatus || !newStatus) return 'stable'

    const statusOrder = { green: 0, yellow: 1, red: 2 }
    const diff = statusOrder[prevStatus] - statusOrder[newStatus]

    if (diff > 0) return 'improving'
    if (diff < 0) return 'worsening'
    return 'stable'
  }

  // Ingen historik och inget nuvarande värde
  const currentStatus = getTrafficLightStatus(currentPestLevel, currentProblemRating)
  if (!currentStatus && timeline.length === 0 && !loading) {
    return null
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Ärendets utveckling
          </span>
          {timeline.length > 0 && (
            <span className="text-xs text-slate-500">
              ({timeline.length} uppdatering{timeline.length !== 1 ? 'ar' : ''})
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="relative">
              {/* Tidslinje-linje */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />

              {/* Historiska uppdateringar (nyaste först) - "Nuläge"-rutan borttagen då senaste uppdateringen visar nuläget */}
              {[...timeline].reverse().map((entry, index) => {
                if (entry.type === 'revisit') {
                  return (
                    <div key={entry.id} className="relative pl-10 pb-4">
                      <div className="absolute left-2 w-5 h-5 rounded-full bg-teal-500/20 border-2 border-teal-500/50 flex items-center justify-center z-10">
                        <Calendar className="w-3 h-3 text-teal-400" />
                      </div>
                      <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                        <p className="text-sm text-slate-300">
                          Återbesök bokat
                        </p>
                        {entry.note && (
                          <p className="text-sm text-slate-400 italic mt-1">"{entry.note}"</p>
                        )}
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(entry.date), 'd MMMM yyyy HH:mm', { locale: sv })}
                          {entry.updatedBy && <span>• {entry.updatedBy}</span>}
                        </p>
                      </div>
                    </div>
                  )
                }

                const status = getTrafficLightStatus(entry.pestLevel, entry.problemRating)
                if (!status) return null

                const trend = getTrend(
                  entry.previousPestLevel,
                  entry.previousProblemRating,
                  entry.pestLevel,
                  entry.problemRating
                )

                const config = statusConfig[status]

                // Beräkna tidigare status för att visa "från → till"
                const previousStatus = getTrafficLightStatus(entry.previousPestLevel, entry.previousProblemRating)
                const previousConfig = previousStatus ? statusConfig[previousStatus] : null

                return (
                  <div key={entry.id} className="relative pl-10 pb-4">
                    <div className={`absolute left-2 w-5 h-5 rounded-full ${config.bg} ${config.border} border-2 flex items-center justify-center z-10`}>
                      {trend === 'improving' ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : trend === 'worsening' ? (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      ) : (
                        <Minus className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                    <div className={`p-3 rounded-lg ${config.bg} ${config.border} border`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-lg">{config.icon}</span>
                        <span className={`font-semibold ${config.text}`}>
                          {config.label}
                        </span>
                        {trend === 'improving' && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Förbättring
                          </span>
                        )}
                        {trend === 'worsening' && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Försämring
                          </span>
                        )}
                      </div>
                      {/* Visa explicit statusförändring (från → till) */}
                      {previousConfig && previousStatus !== status && (
                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                          <span>{previousConfig.icon} {previousConfig.label}</span>
                          <span>→</span>
                          <span>{config.icon} {config.label}</span>
                        </div>
                      )}

                      {/* Rekommendationer (arbetsrapporten visas i modalen under Beskrivning istället) */}
                      {entry.recommendations && (
                        <div className="mt-2">
                          <p className="text-sm text-slate-400 italic whitespace-pre-line">
                            <span className="font-medium text-slate-300">Rekommendation:</span> {entry.recommendations}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(entry.date), 'd MMMM yyyy HH:mm', { locale: sv })}
                        {entry.updatedBy && (
                          <>
                            <span>•</span>
                            <User className="w-3 h-3" />
                            {entry.updatedBy}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Om inga uppdateringar */}
              {timeline.length === 0 && currentStatus && (
                <div className="relative pl-10 pt-2">
                  <p className="text-sm text-slate-500 italic">
                    Detta är den första bedömningen av ärendet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CaseJourneyTimeline
