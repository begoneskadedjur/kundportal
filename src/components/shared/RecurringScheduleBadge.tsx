// src/components/shared/RecurringScheduleBadge.tsx
// Small badge showing recurring schedule status for a customer

import { useState, useEffect } from 'react'
import { Repeat, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  getRecurringSchedulesByCustomer,
  getNextScheduledSession
} from '../../services/recurringScheduleService'
import { FREQUENCY_CONFIG } from '../../types/recurringSchedule'
import type { RecurringScheduleWithRelations } from '../../types/recurringSchedule'

interface RecurringScheduleBadgeProps {
  customerId: string
  compact?: boolean
  onClick?: () => void
}

export function RecurringScheduleBadge({ customerId, compact, onClick }: RecurringScheduleBadgeProps) {
  const [schedule, setSchedule] = useState<RecurringScheduleWithRelations | null>(null)
  const [nextDate, setNextDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const schedules = await getRecurringSchedulesByCustomer(customerId)
        const active = schedules.find(s => s.status === 'active')
        if (!mounted) return

        if (active) {
          setSchedule(active)
          const next = await getNextScheduledSession(active.id)
          if (mounted && next) {
            setNextDate(next.scheduled_at)
          }
        }
      } catch (e) {
        console.error('Error loading schedule badge:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [customerId])

  if (loading) return null

  if (!schedule) {
    if (compact) return null
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-500 border border-slate-700/50 hover:border-slate-600 transition"
      >
        <Calendar className="w-3 h-3" />
        Inget schema
      </button>
    )
  }

  const freqLabel = FREQUENCY_CONFIG[schedule.frequency]?.label || schedule.frequency
  const isPaused = schedule.status === 'paused'

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition ${
          isPaused
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
        }`}
        title={`${freqLabel}${nextDate ? ` - Nasta: ${format(new Date(nextDate), 'd MMM', { locale: sv })}` : ''}`}
      >
        <Repeat className="w-3 h-3" />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition ${
        isPaused
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25'
      }`}
    >
      <Repeat className="w-3 h-3" />
      <span>{freqLabel}</span>
      {nextDate && (
        <span className="text-slate-500">
          Nasta: {format(new Date(nextDate), 'd MMM', { locale: sv })}
        </span>
      )}
      {isPaused && <span className="text-amber-500">(Pausat)</span>}
    </button>
  )
}
