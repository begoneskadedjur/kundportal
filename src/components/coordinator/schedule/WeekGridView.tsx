// WeekGridView.tsx — Veckovy med dagar som kolumner, ärenden staplade vertikalt
import { useMemo } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { isSameDay, getWeekStart, getWeekDays, formatTime } from './scheduleUtils'
import { TECH_COLORS } from './scheduleConstants'
import { GridEventCard } from './GridEventCard'

const DAY_MAX_EVENTS = 6

interface WeekGridViewProps {
  technicians: Technician[]
  cases: BeGoneCaseRow[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onDayClick: (date: Date) => void
}

export function WeekGridView({ technicians, cases, currentDate, onCaseClick, onDayClick }: WeekGridViewProps) {
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const today = new Date()

  // Bygg en Map techId → teknikerindex (för färg)
  const techIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    technicians.forEach((t, i) => m.set(t.id, i))
    return m
  }, [technicians])

  // Bygg en Map techId → namn
  const techNameMap = useMemo(() => {
    const m = new Map<string, string>()
    technicians.forEach(t => m.set(t.id, t.name || ''))
    return m
  }, [technicians])

  // Per dag: samla alla ärenden, sortera efter starttid
  const casesByDay = useMemo(() => {
    return weekDays.map(day => {
      const dayCases = cases.filter(c => {
        const d = c.start_date || c.due_date
        return d && isSameDay(new Date(d), day)
      })

      // Sortera efter starttid
      dayCases.sort((a, b) => {
        const aT = a.start_date || a.due_date || ''
        const bT = b.start_date || b.due_date || ''
        return aT.localeCompare(bT)
      })

      return dayCases
    })
  }, [cases, weekDays])

  const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Dag-headers */}
      <div className="grid grid-cols-7 border-b border-slate-700/50 bg-slate-900/95 flex-shrink-0">
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const count = casesByDay[i].length
          return (
            <div
              key={i}
              className="border-r border-slate-700/50 last:border-r-0 px-3 py-2 cursor-pointer hover:bg-slate-800/30 transition-colors"
              onClick={() => onDayClick(day)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{dayNames[i]}</span>
                <span className={`text-sm font-bold ${isToday ? 'text-[#20c58f]' : 'text-white'}`}>
                  {day.getDate()}
                </span>
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {count} {count === 1 ? 'ärende' : 'ärenden'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Dag-kolumner med ärenden */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {weekDays.map((day, dayIdx) => {
          const dayCases = casesByDay[dayIdx]
          const isToday = isSameDay(day, today)
          const visible = dayCases.slice(0, DAY_MAX_EVENTS)
          const overflow = dayCases.length - visible.length

          // Gruppera ärenden som startar vid samma tid → visa sida vid sida
          const timeGroups: BeGoneCaseRow[][] = []
          const placed = new Set<string>()

          for (const c of visible) {
            if (placed.has(c.id)) continue
            const cStart = c.start_date || c.due_date || ''
            const group = visible.filter(o => {
              if (placed.has(o.id)) return false
              const oStart = o.start_date || o.due_date || ''
              // Samma starttid (på minuten)
              return oStart.slice(0, 16) === cStart.slice(0, 16)
            })
            group.forEach(o => placed.add(o.id))
            timeGroups.push(group)
          }

          return (
            <div
              key={dayIdx}
              className={`
                border-r border-slate-700/50 last:border-r-0 p-1.5 min-h-[120px]
                ${isToday ? 'bg-[#20c58f]/5' : 'bg-slate-900/30'}
              `}
            >
              <div className="space-y-1">
                {timeGroups.map((group, gi) => (
                  <div key={gi} className={`flex gap-1 ${group.length > 1 ? 'flex-row' : ''}`}>
                    {group.map(c => {
                      const techId = c.primary_assignee_id
                      const techIdx = techId ? (techIndexMap.get(techId) ?? 0) : 0
                      const techColor = TECH_COLORS[techIdx % TECH_COLORS.length]
                      const techName = techId ? techNameMap.get(techId) : undefined
                      return (
                        <div
                          key={c.id}
                          className="min-w-0"
                          style={{ flex: group.length > 1 ? `1 1 0` : undefined }}
                        >
                          <GridEventCard
                            caseData={c}
                            onClick={() => onCaseClick(c)}
                            technicianName={techName}
                            techColor={techColor}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}

                {overflow > 0 && (
                  <button
                    onClick={() => onDayClick(day)}
                    className="w-full text-left text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700/50 transition-colors"
                  >
                    +{overflow} fler
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
