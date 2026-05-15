// WeekGridView.tsx — Vertikal tidsgrid, Google Calendar-stil
import { useMemo, useRef, useEffect } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { isSameDay, getWeekStart, getWeekDays } from './scheduleUtils'
import { TECH_COLORS, WEEK_HOUR_HEIGHT, WEEK_TIME_COL_WIDTH, WEEK_DAY_START, WEEK_DAY_END, WEEK_TOTAL_HOURS, WEEK_GRID_HEIGHT } from './scheduleConstants'
import { GridEventCard } from './GridEventCard'

interface WeekGridViewProps {
  technicians: Technician[]
  cases: BeGoneCaseRow[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onDayClick: (date: Date) => void
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

export function WeekGridView({ technicians, cases, currentDate, onCaseClick, onDayClick }: WeekGridViewProps) {
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const today = new Date()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Bygg techId → index map för färger
  const techIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    technicians.forEach((t, i) => m.set(t.id, i))
    return m
  }, [technicians])

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
                <span className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-500 whitespace-nowrap">
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
            const lanes = assignLanes(dayCases)

            return (
              <div
                key={dayIdx}
                className={`flex-1 relative border-r border-slate-700/40 last:border-r-0 ${isToday ? 'bg-[#20c58f]/5' : ''}`}
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

                  return (
                    <div
                      key={c.id}
                      className="absolute px-0.5 py-0"
                      style={{
                        top,
                        height,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    >
                      <GridEventCard
                        caseData={c}
                        onClick={() => onCaseClick(c)}
                        techColor={techColor}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
