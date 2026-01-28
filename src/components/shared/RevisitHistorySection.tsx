// src/components/shared/RevisitHistorySection.tsx
// Återanvändbar komponent för att visa återbesökshistorik

import React, { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Clock, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react'

export interface RevisitHistoryEntry {
  id: string
  update_type: string
  previous_value: string
  new_value: string
  updated_by_name: string
  created_at: string
}

interface RevisitHistorySectionProps {
  history: RevisitHistoryEntry[]
  title?: string
  defaultExpanded?: boolean
  compact?: boolean
}

export default function RevisitHistorySection({
  history,
  title = 'Tidigare återbesök',
  defaultExpanded = false,
  compact = false
}: RevisitHistorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!history || history.length === 0) {
    return null
  }

  // Parsear new_value JSON för att få datum och anteckning
  const parseNewValue = (newValue: string) => {
    try {
      return JSON.parse(newValue)
    } catch {
      return {}
    }
  }

  return (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm font-semibold text-slate-300 uppercase tracking-wider hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-teal-400`} />
          {title} ({history.length})
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className={`${compact ? 'mt-2 space-y-1.5' : 'mt-3 space-y-2'}`}>
          {history.map((entry) => {
            const newValue = parseNewValue(entry.new_value)
            const scheduledDate = newValue.scheduled_start || newValue.start_date

            return (
              <div
                key={entry.id}
                className={`${compact ? 'p-2' : 'p-3'} bg-slate-800/50 rounded-lg border border-slate-700/30`}
              >
                {/* Header med datum och användare */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(entry.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                  </span>
                  <span className="text-slate-500 text-xs flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {entry.updated_by_name}
                  </span>
                </div>

                {/* Bokat datum */}
                {scheduledDate && (
                  <p className={`${compact ? 'text-xs' : 'text-sm'} text-white flex items-center gap-2`}>
                    <span className="text-teal-400">Bokat till:</span>
                    <span className="font-medium">
                      {format(new Date(scheduledDate), 'd MMM yyyy HH:mm', { locale: sv })}
                    </span>
                  </p>
                )}

                {/* Anteckning */}
                {newValue.note && (
                  <p className={`${compact ? 'text-xs mt-1' : 'text-sm mt-1'} text-slate-400 italic`}>
                    "{newValue.note}"
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
