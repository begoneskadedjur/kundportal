// WeekGridView.tsx — Vertikal tidsgrid, Google Calendar-stil
import { useMemo, useRef, useEffect, useState } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { isSameDay, getWeekStart, getWeekDays, formatTime, isTechWorkingAt, getTechWeekCapacity } from './scheduleUtils'
import type { WorkSchedule } from '../../../types/database'
import { TECH_COLORS, WEEK_HOUR_HEIGHT, WEEK_TIME_COL_WIDTH, WEEK_DAY_START, WEEK_DAY_END, WEEK_TOTAL_HOURS, WEEK_GRID_HEIGHT, SNAP_MINUTES } from './scheduleConstants'
import { GridEventCard } from './GridEventCard'

interface WeekGridViewProps {
  technicians: Technician[]
  cases: BeGoneCaseRow[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onDayClick: (date: Date) => void
  onCaseMoved?: (caseId: string, newStart: Date, caseData: BeGoneCaseRow) => void
}

function timeToY(date: Date): number {
  const h = date.getHours() - WEEK_DAY_START
  const m = date.getMinutes()
  return Math.max(0, (h * 60 + m) / 60 * WEEK_HOUR_HEIGHT)
}

function eventHeight(start: Date, end: Date): number {
  const mins = (end.getTime() - start.getTime()) / 60000
  return Math.max(mins / 60 * WEEK_HOUR_HEIGHT, 24)
}

interface LaneInfo { lane: number; total: number }

function assignLanes(events: BeGoneCaseRow[]): Map<string, LaneInfo> {
  const sorted = [...events].sort((a, b) => {
    const aT = a.start_date || a.due_date || ''
    const bT = b.start_date || b.due_date || ''
    return aT.localeCompare(bT)
  })
  const laneEnds: number[] = []
  const result = new Map<string, LaneInfo>()

  for (const ev of sorted) {
    const start = new Date(ev.start_date || ev.due_date || 0).getTime()
    const end = new Date(ev.due_date || ev.start_date || 0).getTime()
    let lane = laneEnds.findIndex(endTs => endTs <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end
    result.set(ev.id, { lane, total: 0 })
  }
  const total = laneEnds.length || 1
  result.forEach(v => { v.total = total })
  return result
}

export function WeekGridView({ technicians, cases, currentDate, onCaseClick, onDayClick, onCaseMoved }: WeekGridViewProps) {
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const today = new Date()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragOverDayIdx, setDragOverDayIdx] = useState<number | null>(null)
  const [dropPreview, setDropPreview] = useState<{ dayIdx: number; y: number; time: Date } | null>(null)
  const [draggingCaseId, setDraggingCaseId] = useState<string | null>(null)
  const [dropBlocked, setDropBlocked] = useState(false)
  const [highlightedTechIds, setHighlightedTechIds] = useState<Set<string>>(new Set())

  function toggleHighlight(techId: string) {
    setHighlightedTechIds(prev => {
      const next = new Set(prev)
      if (next.has(techId)) next.delete(techId)
      else next.add(techId)
      return next
    })
  }
  const colRefs = useRef<(HTMLDivElement | null)[]>([])

  function yToTime(clientY: number, colEl: HTMLElement, day: Date): Date {
    const rect = colEl.getBoundingClientRect()
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    const relY = clientY - rect.top + scrollTop
    const totalMinutes = (relY / WEEK_HOUR_HEIGHT) * 60 + WEEK_DAY_START * 60
    const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
    const clamped = Math.max(WEEK_DAY_START * 60, Math.min((WEEK_DAY_END - 0.25) * 60, snapped))
    const d = new Date(day)
    d.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0)
    return d
  }

  // Bygg techId → index map för färger
  const techIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    technicians.forEach((t, i) => m.set(t.id, i))
    return m
  }, [technicians])

  // Tekniker med ärenden denna vecka (för legende)
  const activeTechs = useMemo(() => {
    const techIdsThisWeek = new Set(
      cases
        .filter(c => {
          const d = c.start_date || c.due_date
          return d && weekDays.some(w => isSameDay(new Date(d), w))
        })
        .map(c => c.primary_assignee_id)
        .filter(Boolean)
    )
    return technicians
      .map((t, i) => ({ ...t, idx: i }))
      .filter(t => techIdsThisWeek.has(t.id))
  }, [technicians, cases, weekDays])

  // Beläggning per tekniker denna vecka
  const techCapacityMap = useMemo(() => {
    const map = new Map<string, { scheduled: number; capacity: number; pct: number; colorClass: string }>()
    for (const t of activeTechs) {
      const cap = getTechWeekCapacity(t.work_schedule as any, weekStart)
      let scheduled = 0
      for (const c of cases) {
        if (c.primary_assignee_id !== t.id) continue
        const d = c.start_date || c.due_date
        if (!d || !weekDays.some(w => isSameDay(new Date(d), w))) continue
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
  }, [activeTechs, cases, weekStart, weekDays])

  // Ärenden per dag
  const casesByDay = useMemo(() => {
    return weekDays.map(day =>
      cases.filter(c => {
        const d = c.start_date || c.due_date
        return d && isSameDay(new Date(d), day)
      })
    )
  }, [cases, weekDays])

  // Scrolla till 07:30 vid mount (lite ovanför 08:00)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, WEEK_HOUR_HEIGHT * 0.5 - 20)
    }
  }, [])

  // NowIndicator — bara om nuet är inom veckan och inom arbetstid
  const nowY = useMemo(() => {
    const now = new Date()
    const isThisWeek = weekDays.some(d => isSameDay(d, now))
    if (!isThisWeek) return null
    const h = now.getHours()
    if (h < WEEK_DAY_START || h >= WEEK_DAY_END) return null
    return timeToY(now)
  }, [weekDays])

  const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

  // Tidsetiketter var 30:e minut
  const timeSlots = useMemo(() => {
    const slots: { label: string; y: number; isHour: boolean }[] = []
    for (let i = 0; i <= WEEK_TOTAL_HOURS * 2; i++) {
      const totalMins = i * 30
      const h = WEEK_DAY_START + Math.floor(totalMins / 60)
      const m = totalMins % 60
      if (h > WEEK_DAY_END) break
      slots.push({
        label: m === 0 ? `${String(h).padStart(2, '0')}:00` : '',
        y: (totalMins / 60) * WEEK_HOUR_HEIGHT,
        isHour: m === 0,
      })
    }
    return slots
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sticky header: tomt hörn + 7 dag-headers */}
      <div
        className="flex border-b border-slate-700/50 bg-slate-900/95 flex-shrink-0"
      >
        {/* Tomt hörn ovanför tidskolumnen */}
        <div style={{ width: WEEK_TIME_COL_WIDTH }} className="flex-shrink-0 border-r border-slate-700/50" />

        {/* Dag-headers */}
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const count = casesByDay[i].length
          return (
            <div
              key={i}
              className={`flex-1 border-r border-slate-700/50 last:border-r-0 cursor-pointer hover:bg-slate-800/30 transition-colors border-t-2 ${isToday ? 'border-t-red-500' : 'border-t-transparent'}`}
              onClick={() => onDayClick(day)}
            >
              <div className="px-3 pt-2 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">{dayNames[i]}</span>
                  <span className={`text-sm font-bold ${isToday ? 'text-[#20c58f]' : 'text-white'}`}>
                    {day.getDate()}
                  </span>
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {count} {count === 1 ? 'ärende' : 'ärenden'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Teknikerlegende — samma stil som statusfiltret */}
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
                onClick={() => toggleHighlight(t.id)}
                className={`flex flex-col px-2 py-1 rounded text-xs transition-all select-none
                  ${isActive
                    ? 'bg-slate-700/60 text-white border border-slate-600'
                    : 'bg-transparent text-slate-500 border border-transparent'
                  }`}
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

      {/* Scrollbar body */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto overflow-x-hidden">
        {/* Tidskolumn */}
        <div
          className="flex-shrink-0 relative border-r border-slate-700/50 bg-slate-900/50"
          style={{ width: WEEK_TIME_COL_WIDTH, height: WEEK_GRID_HEIGHT }}
        >
          {timeSlots.map((slot, i) => (
            <div
              key={i}
              className="absolute right-0 left-0"
              style={{ top: slot.y }}
            >
              {slot.label && (
                <span className={`absolute right-2 text-[10px] text-slate-500 whitespace-nowrap ${i === 0 ? 'top-0' : '-translate-y-1/2'}`}>
                  {slot.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Dag-kolumner */}
        <div className="flex flex-1 relative" style={{ height: WEEK_GRID_HEIGHT }}>
          {/* Horisontella gridlinjer (var 30 min) */}
          {timeSlots.map((slot, i) => (
            <div
              key={i}
              className={`absolute left-0 right-0 pointer-events-none ${slot.isHour ? 'border-t border-slate-700/40' : 'border-t border-slate-700/20'}`}
              style={{ top: slot.y }}
            />
          ))}

          {/* NowIndicator */}
          {nowY !== null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: nowY }}
            >
              <div className="relative h-0">
                <div className="absolute left-0 right-0 h-[2px] bg-red-500" />
                <div className="absolute -left-1 -top-[5px] w-3 h-3 rounded-full bg-red-500 border-2 border-red-300" />
              </div>
            </div>
          )}

          {/* 7 dagkolumner */}
          {weekDays.map((day, dayIdx) => {
            const dayCases = casesByDay[dayIdx]
            const isToday = isSameDay(day, today)
            const isDragTarget = dragOverDayIdx === dayIdx
            const lanes = assignLanes(dayCases)

            return (
              <div
                key={dayIdx}
                ref={el => { colRefs.current[dayIdx] = el }}
                className={`flex-1 relative border-r border-slate-700/40 last:border-r-0 transition-colors
                  ${isToday ? 'bg-[#20c58f]/5' : ''}
                  ${isDragTarget ? 'bg-blue-500/8' : ''}
                `}
                onDragOver={e => {
                  e.preventDefault()
                  setDragOverDayIdx(dayIdx)
                  const colEl = colRefs.current[dayIdx]
                  if (!colEl) return
                  const snappedTime = yToTime(e.clientY, colEl, day)
                  const draggingCase = draggingCaseId ? cases.find(c => c.id === draggingCaseId) : null
                  const tech = draggingCase ? technicians.find(t => t.id === draggingCase.primary_assignee_id) : null
                  const blocked = tech ? !isTechWorkingAt(tech.work_schedule as WorkSchedule, snappedTime) : false
                  setDropBlocked(blocked)
                  e.dataTransfer.dropEffect = blocked ? 'none' : 'move'
                  setDropPreview({ dayIdx, y: timeToY(snappedTime), time: snappedTime })
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverDayIdx(null)
                    setDropPreview(null)
                  }
                }}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverDayIdx(null)
                  setDropPreview(null)
                  setDropBlocked(false)
                  setDraggingCaseId(null)
                  const caseId = e.dataTransfer.getData('caseId')
                  if (!caseId || !onCaseMoved) return
                  const caseData = cases.find(c => c.id === caseId)
                  if (!caseData) return
                  const colEl = colRefs.current[dayIdx]
                  if (!colEl) return
                  const newStart = yToTime(e.clientY, colEl, day)
                  const tech = technicians.find(t => t.id === caseData.primary_assignee_id)
                  if (tech && !isTechWorkingAt(tech.work_schedule as WorkSchedule, newStart)) return
                  onCaseMoved(caseId, newStart, caseData)
                }}
              >
                {dayCases.map(c => {
                  const startRaw = c.start_date || c.due_date
                  const endRaw = c.due_date || c.start_date
                  if (!startRaw) return null

                  const start = new Date(startRaw)
                  const end = endRaw ? new Date(endRaw) : new Date(start.getTime() + 60 * 60000)

                  const top = timeToY(start)
                  const height = eventHeight(start, end)

                  const laneInfo = lanes.get(c.id) ?? { lane: 0, total: 1 }
                  const widthPct = 100 / laneInfo.total
                  const leftPct = (laneInfo.lane / laneInfo.total) * 100

                  const techId = c.primary_assignee_id
                  const techIdx = techId ? (techIndexMap.get(techId) ?? 0) : 0
                  const techColor = TECH_COLORS[techIdx % TECH_COLORS.length]
                  const techName = techId ? (technicians[techIdx]?.name ?? '') : ''
                  const isFaded = highlightedTechIds.size > 0 && !highlightedTechIds.has(techId ?? '')

                  return (
                    <div
                      key={c.id}
                      draggable
                      className={`absolute px-0.5 py-0 cursor-grab active:cursor-grabbing transition-opacity ${isFaded ? 'opacity-20' : 'opacity-100'}`}
                      style={{
                        top,
                        height,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      onDragStart={e => {
                        setDraggingCaseId(c.id)
                        const duration = Math.abs(
                          new Date(c.due_date || c.start_date!).getTime() -
                          new Date(c.start_date || c.due_date!).getTime()
                        )
                        e.dataTransfer.setData('caseId', c.id)
                        e.dataTransfer.setData('duration', String(duration))
                        e.dataTransfer.setData('case_type', c.case_type || 'private')
                        e.dataTransfer.effectAllowed = 'move'
                        e.stopPropagation()
                      }}
                      onDragEnd={() => setDraggingCaseId(null)}
                    >
                      <GridEventCard
                        caseData={c}
                        onClick={() => onCaseClick(c)}
                        techColor={techColor}
                        technicianName={techName}
                        isDragging={draggingCaseId === c.id}
                        heightPx={height}
                        widthPct={widthPct}
                      />
                    </div>
                  )
                })}

                {/* Drop-preview linje — röd om blockerat, blå om ok */}
                {dropPreview?.dayIdx === dayIdx && (
                  <div
                    className={`absolute left-0 right-0 h-[2px] pointer-events-none z-30 ${dropBlocked ? 'bg-red-400' : 'bg-blue-400'}`}
                    style={{ top: dropPreview.y }}
                  >
                    <span className={`absolute left-1 -top-5 text-[10px] bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap font-mono ${dropBlocked ? 'text-red-300' : 'text-blue-300'}`}>
                      {dropBlocked ? 'Ej arbetstid' : formatTime(dropPreview.time)}
                    </span>
                    <div className={`absolute -left-1 -top-[3px] w-2 h-2 rounded-full ${dropBlocked ? 'bg-red-400' : 'bg-blue-400'}`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
