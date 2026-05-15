// MonthGridView.tsx — Månadsvy med 4-6 veckors grid
import { useMemo, useState } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { isSameDay, formatTime, isTechWorkingDay, isTechWorkingAt, getTechMonthCapacity } from './scheduleUtils'
import { TECH_COLORS, WEEK_DAY_START, WEEK_DAY_END, SNAP_MINUTES } from './scheduleConstants'
import type { WorkSchedule } from '../../../types/database'
import { GridEventCard } from './GridEventCard'

const MONTH_MAX_EVENTS = 3

interface MonthGridViewProps {
  technicians: Technician[]
  cases: BeGoneCaseRow[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onDayClick: (date: Date) => void
  onCaseMoved?: (caseId: string, newStart: Date, caseData: BeGoneCaseRow) => void
}

type TimelineItem =
  | { kind: 'case'; caseData: BeGoneCaseRow; startMs: number }
  | { kind: 'slot'; time: string; startMs: number }

// Bygg kronologisk lista av ärenden + lediga 15-min slots
function buildTimeline(
  day: Date,
  dayCases: BeGoneCaseRow[],
  excludeId: string | null,
  workSchedule?: WorkSchedule | null
): TimelineItem[] {
  const items: TimelineItem[] = []
  const relevant = dayCases.filter(c => c.id !== excludeId)

  // Lägg till befintliga ärenden
  for (const c of relevant) {
    const startMs = new Date(c.start_date || c.due_date!).getTime()
    items.push({ kind: 'case', caseData: c, startMs })
  }

  // Arbetstidsgränser (om schema finns)
  let workStartMins = WEEK_DAY_START * 60
  let workEndMins = WEEK_DAY_END * 60
  if (workSchedule) {
    const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const
    const dayKey = DAYS[day.getDay()] as keyof WorkSchedule
    const ds = workSchedule[dayKey]
    if (ds?.active) {
      const [sh, sm] = ds.start.split(':').map(Number)
      const [eh, em] = ds.end.split(':').map(Number)
      workStartMins = sh * 60 + sm
      workEndMins = eh * 60 + em
    } else {
      return items.sort((a, b) => a.startMs - b.startMs) // Ej arbetsdag — inga slots
    }
  }

  // Lägg till lediga 15-min slots inom arbetstid
  const totalSlots = ((WEEK_DAY_END - WEEK_DAY_START) * 60) / SNAP_MINUTES
  for (let i = 0; i < totalSlots; i++) {
    const mins = WEEK_DAY_START * 60 + i * SNAP_MINUTES
    if (mins < workStartMins || mins >= workEndMins) continue

    const h = Math.floor(mins / 60)
    const m = mins % 60
    const slotStart = new Date(day)
    slotStart.setHours(h, m, 0, 0)
    const slotEnd = new Date(slotStart.getTime() + SNAP_MINUTES * 60000)

    const overlaps = relevant.some(c => {
      const cStart = new Date(c.start_date || c.due_date!).getTime()
      const cEnd = new Date(c.due_date || c.start_date!).getTime()
      return slotStart.getTime() < cEnd && slotEnd.getTime() > cStart
    })

    if (!overlaps) {
      items.push({
        kind: 'slot',
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        startMs: slotStart.getTime(),
      })
    }
  }

  return items.sort((a, b) => a.startMs - b.startMs)
}

export function MonthGridView({ technicians, cases, currentDate, onCaseClick, onDayClick, onCaseMoved }: MonthGridViewProps) {
  const today = new Date()
  const [highlightedTechIds, setHighlightedTechIds] = useState<Set<string>>(new Set())
  const [draggingCaseId, setDraggingCaseId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  function toggleHighlight(techId: string) {
    setHighlightedTechIds(prev => {
      const next = new Set(prev)
      if (next.has(techId)) next.delete(techId)
      else next.add(techId)
      return next
    })
  }

  const techIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    technicians.forEach((t, i) => m.set(t.id, i))
    return m
  }, [technicians])

  const activeTechs = useMemo(() => {
    const ids = new Set(cases.map(c => c.primary_assignee_id).filter(Boolean))
    return technicians.map((t, i) => ({ ...t, idx: i })).filter(t => ids.has(t.id))
  }, [technicians, cases])

  // Beläggning per tekniker denna månad
  const techCapacityMap = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const map = new Map<string, { scheduled: number; capacity: number; pct: number; colorClass: string }>()
    for (const t of activeTechs) {
      const cap = getTechMonthCapacity(t.work_schedule as any, year, month)
      let scheduled = 0
      for (const c of cases) {
        if (c.primary_assignee_id !== t.id) continue
        const d = c.start_date || c.due_date
        if (!d) continue
        const cDate = new Date(d)
        if (cDate.getFullYear() !== year || cDate.getMonth() !== month) continue
        if (c.start_date && c.due_date) {
          scheduled += (new Date(c.due_date).getTime() - new Date(c.start_date).getTime()) / 3_600_000
        }
      }
      const s = Math.round(scheduled * 10) / 10
      const pct = cap > 0 ? Math.round((scheduled / cap) * 10000) / 100 : 0
      const colorClass = cap === 0 || pct === 0
        ? 'text-slate-500'
        : pct < 70 ? 'text-emerald-400'
        : pct < 90 ? 'text-amber-400'
        : 'text-red-400'
      map.set(t.id, { scheduled: s, capacity: cap, pct, colorClass })
    }
    return map
  }, [activeTechs, cases, currentDate])

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const lastDay = new Date(year, month + 1, 0)
    const endOffset = 6 - ((lastDay.getDay() || 7) - 1)
    const days: Date[] = []
    for (let i = -startOffset; i <= lastDay.getDate() - 1 + endOffset; i++) {
      days.push(new Date(year, month, 1 + i))
    }
    return days
  }, [currentDate])

  const currentMonth = currentDate.getMonth()
  const weeks = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7))
    }
    return rows
  }, [calendarDays])

  const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Veckodagsrubriker */}
      <div className="grid grid-cols-7 border-b border-slate-700/50 bg-slate-900/95 flex-shrink-0">
        {dayNames.map(name => (
          <div key={name} className="border-r border-slate-700/50 last:border-r-0 px-3 py-2 text-center">
            <span className="text-xs font-medium text-slate-400">{name}</span>
          </div>
        ))}
      </div>

      {/* Teknikerfilter */}
      {activeTechs.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-700/50 bg-slate-900/80 flex-shrink-0 flex-wrap">
          {activeTechs.map(t => {
            const color = TECH_COLORS[t.idx % TECH_COLORS.length]
            const shortName = t.name.split(' ')[0]
            const isFiltering = highlightedTechIds.size > 0
            const isActive = !isFiltering || highlightedTechIds.has(t.id)
            const cap = techCapacityMap.get(t.id)
            return (
              <button
                key={t.id}
                onClick={e => { e.stopPropagation(); toggleHighlight(t.id) }}
                className={`flex flex-col px-2 py-1 rounded text-xs transition-all select-none
                  ${isActive ? 'bg-slate-700/60 text-white border border-slate-600' : 'bg-transparent text-slate-500 border border-transparent'}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-medium">{shortName}</span>
                </div>
                {cap && (
                  <div className={`text-[10px] font-normal pl-3.5 mt-0.5 ${cap.colorClass}`}>
                    {cap.scheduled}h / {cap.capacity}h · {cap.pct}%
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Veckorader */}
      <div className="flex flex-col flex-1 overflow-y-auto divide-y divide-slate-700/50">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 flex-1 divide-x divide-slate-700/50 min-h-[120px]">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentMonth
              const isToday = isSameDay(day, today)
              const dayKey = day.toISOString()
              const isDragOver = dragOverDay === dayKey
              const isExpanded = expandedDayKey === dayKey

              const dayCases = cases.filter(c => {
                const d = c.start_date || c.due_date
                return d && isSameDay(new Date(d), day)
              }).sort((a, b) => {
                const aT = a.start_date || a.due_date || ''
                const bT = b.start_date || b.due_date || ''
                return aT.localeCompare(bT)
              })

              const filtered = highlightedTechIds.size === 0
                ? dayCases
                : dayCases.filter(c => highlightedTechIds.has(c.primary_assignee_id ?? ''))

              const visible = filtered.slice(0, MONTH_MAX_EVENTS)
              const overflow = filtered.length - visible.length

              // Teknikern som dras — för schemavalidering
              const draggingCase = draggingCaseId ? cases.find(c => c.id === draggingCaseId) : null
              const draggingTech = draggingCase ? technicians.find(t => t.id === draggingCase.primary_assignee_id) : null
              const dayBlocked = draggingTech ? !isTechWorkingDay(draggingTech.work_schedule as WorkSchedule, day) : false

              // Kronologisk timeline för expanderad vy (med arbetstidsfiltrering)
              const timeline = isExpanded ? buildTimeline(day, dayCases, draggingCaseId, draggingTech?.work_schedule as WorkSchedule) : []

              return (
                <div
                  key={di}
                  className={`
                    p-1.5 cursor-pointer transition-all border-t-2
                    ${isToday ? 'bg-[#20c58f]/5 border-t-red-500' : isCurrentMonth ? 'bg-slate-900/20 border-t-transparent' : 'bg-slate-900/60 border-t-transparent'}
                    ${isDragOver && dayBlocked ? 'bg-red-500/5 ring-1 ring-inset ring-red-500/40' : ''}
                    ${isDragOver && !dayBlocked && !isExpanded ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/40' : ''}
                    ${!isDragOver ? 'hover:bg-slate-800/30' : ''}
                    ${isExpanded ? 'z-10 relative' : ''}
                  `}
                  onClick={() => onDayClick(day)}
                  onDragOver={e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = dayBlocked ? 'none' : 'move'
                    setDragOverDay(dayKey)
                    if (!dayBlocked) setExpandedDayKey(dayKey)
                  }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverDay(null)
                      setExpandedDayKey(null)
                      setDragOverSlot(null)
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOverDay(null)
                    setExpandedDayKey(null)
                    setDragOverSlot(null)
                    if (dayBlocked) return
                    const caseId = e.dataTransfer.getData('caseId')
                    if (!caseId || !onCaseMoved) return
                    const caseData = cases.find(c => c.id === caseId)
                    if (!caseData) return
                    const orig = new Date(caseData.start_date || caseData.due_date || '')
                    const newStart = new Date(day)
                    newStart.setHours(orig.getHours(), orig.getMinutes(), 0, 0)
                    // Kontrollera att originaltiden är inom arbetstid
                    const tech = technicians.find(t => t.id === caseData.primary_assignee_id)
                    if (tech && !isTechWorkingAt(tech.work_schedule as WorkSchedule, newStart)) return
                    onCaseMoved(caseId, newStart, caseData)
                  }}
                >
                  {/* Dagnummer */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`
                      text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-[#20c58f] text-white' : isCurrentMonth ? 'text-white' : 'text-slate-600'}
                    `}>
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Expanderad tidsgrid vid drag-hover — ärenden och slots i tidsordning */}
                  {isExpanded ? (
                    <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                      {timeline.map(item => {
                        if (item.kind === 'case') {
                          const c = item.caseData
                          const s = c.start_date || c.due_date
                          const e2 = c.due_date || c.start_date
                          const name = c.company_name || (c as any).bestallare || (c as any).kontaktperson || c.case_number || ''
                          const timeStr = s && e2 ? `${formatTime(new Date(s))}–${formatTime(new Date(e2))}` : ''
                          return (
                            <div key={c.id} className="text-[9px] px-1.5 py-1 rounded bg-slate-700/50 border-l-2 border-slate-400 pointer-events-none flex gap-1 min-w-0">
                              <span className="font-mono text-slate-300 shrink-0">{timeStr}</span>
                              <span className="text-slate-400 truncate">{name}</span>
                            </div>
                          )
                        }
                        const slotKey = `${dayKey}:${item.time}`
                        const isSlotOver = dragOverSlot === slotKey
                        return (
                          <div
                            key={slotKey}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors
                              ${isSlotOver ? 'bg-blue-500/30 text-blue-200 ring-1 ring-blue-400/50' : 'text-slate-500 hover:bg-slate-700/30 hover:text-slate-300'}`}
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverSlot(slotKey) }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSlot(null) }}
                            onDrop={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              setDragOverSlot(null)
                              setExpandedDayKey(null)
                              setDragOverDay(null)
                              const caseId = e.dataTransfer.getData('caseId')
                              if (!caseId || !onCaseMoved) return
                              const caseData = cases.find(c => c.id === caseId)
                              if (!caseData) return
                              const [hh, mm] = item.time.split(':').map(Number)
                              const newStart = new Date(day)
                              newStart.setHours(hh, mm, 0, 0)
                              onCaseMoved(caseId, newStart, caseData)
                            }}
                          >
                            {item.time}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* Normal vy */
                    <div className="space-y-0.5">
                      {visible.map(c => {
                        const techId = c.primary_assignee_id
                        const techIdx = techId ? (techIndexMap.get(techId) ?? 0) : 0
                        const techColor = TECH_COLORS[techIdx % TECH_COLORS.length]
                        return (
                          <div
                            key={c.id}
                            draggable
                            className={`transition-opacity ${draggingCaseId === c.id ? 'opacity-40' : 'opacity-100'}`}
                            onDragStart={e => {
                              setDraggingCaseId(c.id)
                              e.dataTransfer.setData('caseId', c.id)
                              const startMs = new Date(c.start_date || c.due_date!).getTime()
                              const endMs = new Date(c.due_date || c.start_date!).getTime()
                              e.dataTransfer.setData('duration', String(Math.abs(endMs - startMs) || 3600000))
                              e.dataTransfer.effectAllowed = 'move'
                              e.stopPropagation()
                            }}
                            onDragEnd={() => {
                              setDraggingCaseId(null)
                              setDragOverDay(null)
                              setExpandedDayKey(null)
                              setDragOverSlot(null)
                            }}
                          >
                            <GridEventCard
                              caseData={c}
                              onClick={() => onCaseClick(c)}
                              techColor={techColor}
                              compact
                              isDragging={draggingCaseId === c.id}
                            />
                          </div>
                        )
                      })}

                      {overflow > 0 && (
                        <p className="text-[10px] text-slate-500 hover:text-slate-300 px-1">
                          +{overflow} fler
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
