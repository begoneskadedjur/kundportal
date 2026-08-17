// src/components/coordinator/DistributeTechniciansModal.tsx
// Byt/fördela tekniker för ett eller flera återkommande scheman (alternativ A:
// fördelning per enhet). Välj 1-3 tekniker, få ett tidsbalanserat förslag,
// justera per schema och se konfliktkontroll per besök innan bekräftelse.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Users, Loader2, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import {
  previewTechnicianSwap,
  executeTechnicianSwap,
  type SwapVisitPreview,
} from '../../services/recurringScheduleService'
import type { RecurringScheduleWithRelations } from '../../types/recurringSchedule'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface TechnicianOption {
  id: string
  name: string
}

interface DistributeTechniciansModalProps {
  /** Scheman som ska fördelas (ett för enskilt byte, flera för hel organisation) */
  schedules: RecurringScheduleWithRelations[]
  /** Rubrik, t.ex. enhetens eller organisationens namn */
  title: string
  onClose: () => void
  /** Anropas efter genomfört byte så att listan kan laddas om */
  onDone: () => void
}

const initialsOf = (name: string) =>
  name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

function TechAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]'
  return (
    <span
      className={`${cls} rounded-full bg-[#20c58f]/20 border-2 border-[#20c58f] flex items-center justify-center font-bold text-[#20c58f] shrink-0`}
      title={name}
    >
      {initialsOf(name)}
    </span>
  )
}

export default function DistributeTechniciansModal({
  schedules,
  title,
  onClose,
  onDone,
}: DistributeTechniciansModalProps) {
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([])
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])
  // schemaId → tilldelad tekniker
  const [assignment, setAssignment] = useState<Record<string, string>>({})
  // schemaId → konfliktkontroll per besök
  const [previews, setPreviews] = useState<Record<string, SwapVisitPreview[]>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  // sessionId → lämna kvar hos nuvarande tekniker vid krock
  const [keepSessionIds, setKeepSessionIds] = useState<Set<string>>(new Set())
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    supabase
      .from('technicians')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setTechnicians((data as TechnicianOption[]) || []))
  }, [])

  const techById = useMemo(() => new Map(technicians.map(t => [t.id, t])), [technicians])

  const toggleTech = (id: string) => {
    setSelectedTechIds(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id)
      if (prev.length >= 3) {
        toast('Max 3 tekniker', { icon: '👥' })
        return prev
      }
      return [...prev, id]
    })
  }

  // Tidsbalanserat förslag: tyngsta schemat först, till teknikern med minst last.
  // Vikt = uppskattad besökslängd (antal tillfällen är okänt före konfliktkollen
  // men är oftast lika inom en organisation).
  useEffect(() => {
    if (selectedTechIds.length === 0) {
      setAssignment({})
      return
    }
    const load: Record<string, number> = Object.fromEntries(selectedTechIds.map(id => [id, 0]))
    const next: Record<string, string> = {}
    const sorted = [...schedules].sort(
      (a, b) => (b.estimated_duration_minutes || 60) - (a.estimated_duration_minutes || 60)
    )
    for (const s of sorted) {
      // Behåll nuvarande tekniker om hen är en av de valda och har minst last
      const lightest = selectedTechIds.reduce((min, id) => (load[id] < load[min] ? id : min), selectedTechIds[0])
      const preferCurrent =
        s.technician_id &&
        selectedTechIds.includes(s.technician_id) &&
        load[s.technician_id] <= load[lightest]
      const chosen = preferCurrent ? s.technician_id! : lightest
      next[s.id] = chosen
      load[chosen] += s.estimated_duration_minutes || 60
    }
    setAssignment(next)
  }, [selectedTechIds, schedules])

  // Konfliktkontroll för alla scheman som faktiskt byter tekniker
  useEffect(() => {
    const changed = schedules.filter(s => assignment[s.id] && assignment[s.id] !== s.technician_id)
    if (changed.length === 0) {
      setPreviews({})
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    Promise.all(
      changed.map(async s => [s.id, await previewTechnicianSwap(s.id, assignment[s.id])] as const)
    )
      .then(entries => {
        if (!cancelled) setPreviews(Object.fromEntries(entries))
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assignment, schedules])

  const changedSchedules = schedules.filter(s => assignment[s.id] && assignment[s.id] !== s.technician_id)

  // Krockar: dels serverkollens (mot teknikerns befintliga schema), dels korskrockar
  // mellan två FLYTTADE besök som hamnar hos samma tekniker (osynliga för serverkollen
  // eftersom inget av dem ligger i teknikerns schema ännu)
  const allConflicts = useMemo(() => {
    const previewedVisits = changedSchedules.flatMap(s =>
      (previews[s.id] || []).map(v => ({ schedule: s, visit: v, techId: assignment[s.id] }))
    )
    const spanOf = (v: SwapVisitPreview) => {
      const start = new Date(v.scheduledAt).getTime()
      const end = v.scheduledEnd ? new Date(v.scheduledEnd).getTime() : start + 3_600_000
      return [start, end] as const
    }
    const crossConflictIds = new Set<string>()
    for (let i = 0; i < previewedVisits.length; i++) {
      for (let j = i + 1; j < previewedVisits.length; j++) {
        const a = previewedVisits[i]
        const b = previewedVisits[j]
        if (a.techId !== b.techId || a.schedule.id === b.schedule.id) continue
        const [aStart, aEnd] = spanOf(a.visit)
        const [bStart, bEnd] = spanOf(b.visit)
        if (aStart < bEnd && bStart < aEnd) crossConflictIds.add(b.visit.sessionId)
      }
    }
    return previewedVisits
      .filter(pv => pv.visit.conflict || crossConflictIds.has(pv.visit.sessionId))
      .map(pv => ({
        schedule: pv.schedule,
        visit: pv.visit.conflict
          ? pv.visit
          : { ...pv.visit, conflict: 'Krockar med ett annat flyttat besök hos samma tekniker' },
      }))
  }, [changedSchedules, previews, assignment])

  // Summering per vald tekniker (antal besök + total tid) baserat på konfliktkollen
  const techSummary = useMemo(() => {
    const sum: Record<string, { visits: number; minutes: number }> = {}
    for (const id of selectedTechIds) sum[id] = { visits: 0, minutes: 0 }
    for (const s of schedules) {
      const techId = assignment[s.id]
      if (!techId || !sum[techId]) continue
      const visitCount = previews[s.id]?.length ?? null
      // Oförändrade scheman har ingen preview — räkna inte deras besök, bara markera ägarskap
      if (visitCount !== null) {
        sum[techId].visits += visitCount
        sum[techId].minutes += visitCount * (s.estimated_duration_minutes || 60)
      }
    }
    return sum
  }, [selectedTechIds, assignment, previews, schedules])

  const toggleKeep = (sessionId: string) => {
    setKeepSessionIds(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const handleExecute = useCallback(async () => {
    if (changedSchedules.length === 0) return
    setExecuting(true)
    try {
      let ok = 0
      for (const s of changedSchedules) {
        const skipIds = (previews[s.id] || [])
          .filter(v => v.conflict && keepSessionIds.has(v.sessionId))
          .map(v => v.sessionId)
        const success = await executeTechnicianSwap(s.id, assignment[s.id], { skipSessionIds: skipIds })
        if (success) ok++
      }
      if (ok === changedSchedules.length) {
        toast.success(ok === 1 ? 'Teknikern bytt' : `${ok} scheman omfördelade`)
        onDone()
      } else {
        toast.error(`${ok} av ${changedSchedules.length} scheman kunde uppdateras — ladda om och kontrollera`)
        onDone()
      }
    } finally {
      setExecuting(false)
    }
  }, [changedSchedules, previews, keepSessionIds, assignment, onDone])

  const movedConflicts = allConflicts.filter(c => !keepSessionIds.has(c.visit.sessionId)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#20c58f]" />
            <div>
              <h2 className="text-sm font-semibold text-white">
                {schedules.length === 1 ? 'Byt tekniker' : 'Fördela tekniker'}
              </h2>
              <p className="text-xs text-slate-400">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Teknikerval */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-sm font-semibold text-white mb-2">
              Välj tekniker <span className="text-xs font-normal text-slate-400">(1-3 st)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {technicians.map(t => {
                const selected = selectedTechIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTech(t.id)}
                    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-[#20c58f]/15 border-[#20c58f] text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <TechAvatar name={t.name} size="sm" />
                    {t.name}
                  </button>
                )
              })}
            </div>
            {/* Belastningssummering */}
            {selectedTechIds.length > 0 && Object.values(techSummary).some(s => s.visits > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-700/50">
                {selectedTechIds.map(id => {
                  const t = techById.get(id)
                  const s = techSummary[id]
                  if (!t) return null
                  return (
                    <span key={id} className="text-xs text-slate-400">
                      <span className="text-slate-300 font-medium">{t.name.split(' ')[0]}</span>
                      {': '}
                      {s.visits > 0
                        ? `${s.visits} besök · ${Math.round((s.minutes / 60) * 10) / 10}h`
                        : 'inga flyttade besök'}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Fördelning per schema */}
          {selectedTechIds.length > 0 && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <p className="text-sm font-semibold text-white mb-2">Fördelning per schema</p>
              <div className="space-y-2">
                {schedules.map(s => {
                  const currentTech = s.technician?.name || '—'
                  const assignedId = assignment[s.id]
                  const isChanged = assignedId && assignedId !== s.technician_id
                  return (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{s.customer?.company_name || '—'}</p>
                        <p className="text-xs text-slate-500">
                          {s.preferred_time?.substring(0, 5)} · {s.estimated_duration_minutes} min · idag: {currentTech}
                        </p>
                      </div>
                      {isChanged && <ArrowRight className="w-3.5 h-3.5 text-[#20c58f] shrink-0" />}
                      <select
                        value={assignedId || ''}
                        onChange={e => setAssignment(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                      >
                        {selectedTechIds.map(id => (
                          <option key={id} value={id}>{techById.get(id)?.name || id}</option>
                        ))}
                        {/* Nuvarande tekniker som alternativ om hen inte är bland de valda */}
                        {s.technician_id && !selectedTechIds.includes(s.technician_id) && (
                          <option value={s.technician_id}>{currentTech} (behåll)</option>
                        )}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Konfliktkontroll */}
          {selectedTechIds.length > 0 && changedSchedules.length > 0 && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <p className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                Konfliktkontroll
                {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#20c58f]" />}
              </p>
              {!previewLoading && allConflicts.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Inga krockar — alla {changedSchedules.reduce((n, s) => n + (previews[s.id]?.length || 0), 0)} framtida besök kan flyttas
                </p>
              )}
              {!previewLoading && allConflicts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-start gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {allConflicts.length} besök krockar hos den nya teknikern. Välj per besök om det ska flyttas ändå (dubbelbokning) eller lämnas kvar hos nuvarande tekniker.
                  </p>
                  {allConflicts.map(({ schedule, visit }) => {
                    const keep = keepSessionIds.has(visit.sessionId)
                    return (
                      <div key={visit.sessionId} className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 border border-amber-500/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white">
                            {schedule.customer?.company_name} · {format(new Date(visit.scheduledAt), 'd MMM yyyy HH:mm', { locale: sv })}
                          </p>
                          <p className="text-xs text-amber-400 truncate">{visit.conflict}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => keep && toggleKeep(visit.sessionId)}
                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                              !keep ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Flytta ändå
                          </button>
                          <button
                            onClick={() => !keep && toggleKeep(visit.sessionId)}
                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                              keep ? 'bg-slate-600 text-white border border-slate-500' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Lämna kvar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700">
          <p className="text-xs text-slate-500">
            {changedSchedules.length === 0
              ? 'Ingen ändring vald'
              : `${changedSchedules.length} schema${changedSchedules.length !== 1 ? 'n' : ''} byter tekniker${movedConflicts > 0 ? ` · ${movedConflicts} medveten dubbelbokning` : ''}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleExecute}
              disabled={changedSchedules.length === 0 || previewLoading || executing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#fff] bg-[#20c58f] hover:bg-[#1aaa7a] rounded-lg transition-colors disabled:opacity-40"
            >
              {executing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Genomför byte
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
