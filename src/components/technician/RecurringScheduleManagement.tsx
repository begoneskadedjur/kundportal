// src/components/technician/RecurringScheduleManagement.tsx
// Panel for viewing and managing recurring schedules within CustomerStationsModal

import { useState, useEffect } from 'react'
import {
  Repeat, Calendar, Clock, Pause, Play, Trash2, Edit3,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, Plus, X
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  getRecurringSchedulesByCustomer,
  getFutureSessionsForSchedule,
  pauseRecurringSchedule,
  resumeRecurringSchedule,
  cancelRecurringSchedule
} from '../../services/recurringScheduleService'
import { supabase } from '../../lib/supabase'
import { FREQUENCY_CONFIG, DAY_PATTERN_CONFIG } from '../../types/recurringSchedule'
import type { RecurringScheduleWithRelations } from '../../types/recurringSchedule'

interface RecurringScheduleManagementProps {
  customerId: string
  technicianId: string
  onCreateNew: () => void
}

interface FutureSession {
  id: string
  scheduled_at: string
  scheduled_end: string | null
  status: string
  notes: string | null
}

export function RecurringScheduleManagement({
  customerId,
  technicianId,
  onCreateNew
}: RecurringScheduleManagementProps) {
  const [schedules, setSchedules] = useState<RecurringScheduleWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null)
  const [futureSessions, setFutureSessions] = useState<FutureSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadSchedules = async () => {
    setLoading(true)
    try {
      const data = await getRecurringSchedulesByCustomer(customerId)
      setSchedules(data)
    } catch (e) {
      console.error('Error loading schedules:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedules()
  }, [customerId])

  const toggleExpand = async (scheduleId: string) => {
    if (expandedScheduleId === scheduleId) {
      setExpandedScheduleId(null)
      return
    }
    setExpandedScheduleId(scheduleId)
    setLoadingSessions(true)
    try {
      const sessions = await getFutureSessionsForSchedule(scheduleId)
      setFutureSessions(sessions)
    } catch (e) {
      console.error('Error loading sessions:', e)
    } finally {
      setLoadingSessions(false)
    }
  }

  const handlePause = async (id: string) => {
    setActionLoading(id)
    const success = await pauseRecurringSchedule(id)
    if (success) {
      toast.success('Schema pausat')
      await loadSchedules()
    } else {
      toast.error('Kunde inte pausa')
    }
    setActionLoading(null)
  }

  const handleResume = async (id: string) => {
    setActionLoading(id)
    const success = await resumeRecurringSchedule(id)
    if (success) {
      toast.success('Schema aterupptaget')
      await loadSchedules()
    } else {
      toast.error('Kunde inte ateruppta')
    }
    setActionLoading(null)
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Ar du saker? Detta avbokar aven alla framtida kontroller.')) return
    setActionLoading(id)
    const success = await cancelRecurringSchedule(id)
    if (success) {
      toast.success('Schema och framtida kontroller avbokade')
      await loadSchedules()
    } else {
      toast.error('Kunde inte avboka')
    }
    setActionLoading(null)
  }

  const handleCancelSession = async (sessionId: string) => {
    const { error } = await supabase
      .from('station_inspection_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)

    if (error) {
      toast.error('Kunde inte avboka')
      return
    }

    toast.success('Kontrolltillfalle avbokat')
    setFutureSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )
  }

  const activeSchedules = schedules.filter(s => s.status !== 'cancelled')

  if (activeSchedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="p-4 rounded-full bg-slate-800">
          <Calendar className="w-8 h-8 text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-slate-400 text-sm">Inget aterkommande kontrollschema</p>
          <p className="text-slate-600 text-xs mt-1">
            Skapa ett schema for att automatiskt boka in kontroller
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Skapa kontrollschema
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeSchedules.map(schedule => {
        const freq = FREQUENCY_CONFIG[schedule.frequency]
        const pattern = DAY_PATTERN_CONFIG[schedule.day_pattern]
        const isExpanded = expandedScheduleId === schedule.id
        const isPaused = schedule.status === 'paused'
        const isActionLoading = actionLoading === schedule.id

        return (
          <div
            key={schedule.id}
            className={`rounded-lg border ${
              isPaused ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-800/50'
            }`}
          >
            {/* Schedule header */}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Repeat className={`w-4 h-4 ${isPaused ? 'text-amber-400' : 'text-blue-400'}`} />
                  <div>
                    <span className="text-sm font-medium text-slate-200">{freq?.label}</span>
                    {isPaused && <span className="text-xs text-amber-400 ml-2">(Pausat)</span>}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {pattern?.label} kl {schedule.preferred_time} ({schedule.estimated_duration_minutes} min)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isPaused ? (
                    <button
                      onClick={() => handleResume(schedule.id)}
                      disabled={isActionLoading}
                      className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition"
                      title="Ateruppta"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePause(schedule.id)}
                      disabled={isActionLoading}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition"
                      title="Pausa"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleCancel(schedule.id)}
                    disabled={isActionLoading}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                    title="Avbryt schema"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-600 mt-2">
                Fran {format(new Date(schedule.schedule_start_date), 'd MMM yyyy', { locale: sv })}
                {' '}| Genererat t.o.m. {format(new Date(schedule.generated_until), 'd MMM yyyy', { locale: sv })}
              </div>
            </div>

            {/* Expandable sessions list */}
            <button
              onClick={() => toggleExpand(schedule.id)}
              className="w-full flex items-center justify-center gap-1 py-2 border-t border-slate-700/50 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              {isExpanded ? (
                <>Dolj kommande kontroller <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Visa kommande kontroller <ChevronDown className="w-3 h-3" /></>
              )}
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 border-t border-slate-700/50">
                {loadingSessions ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                  </div>
                ) : futureSessions.length === 0 ? (
                  <p className="text-xs text-slate-600 py-3 text-center">Inga kommande kontroller</p>
                ) : (
                  <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                    {futureSessions.map(session => (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-2 rounded text-xs ${
                          session.status === 'cancelled' ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-300">
                            {format(new Date(session.scheduled_at), 'EEE d MMM yyyy HH:mm', { locale: sv })}
                          </span>
                          {session.notes && (
                            <span className="text-amber-500" title={session.notes}>
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        {session.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancelSession(session.id)}
                            className="p-1 text-slate-600 hover:text-red-400 transition"
                            title="Avboka"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={onCreateNew}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-700 rounded-lg text-sm text-slate-500 hover:text-blue-400 hover:border-blue-500/50 transition"
      >
        <Plus className="w-4 h-4" />
        Lagg till nytt schema
      </button>
    </div>
  )
}
