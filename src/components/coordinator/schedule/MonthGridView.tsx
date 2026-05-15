// MonthGridView.tsx — Månadsvy med 4-6 veckors grid
import { useMemo } from 'react'
import { BeGoneCaseRow, Technician } from '../../../types/database'
import { isSameDay } from './scheduleUtils'
import { TECH_COLORS } from './scheduleConstants'
import { GridEventCard } from './GridEventCard'

const MONTH_MAX_EVENTS = 3

interface MonthGridViewProps {
  technicians: Technician[]
  cases: BeGoneCaseRow[]
  currentDate: Date
  onCaseClick: (caseData: BeGoneCaseRow) => void
  onDayClick: (date: Date) => void
}

export function MonthGridView({ technicians, cases, currentDate, onCaseClick, onDayClick }: MonthGridViewProps) {
  const today = new Date()

  // Bygg techId → index map för färger
  const techIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    technicians.forEach((t, i) => m.set(t.id, i))
    return m
  }, [technicians])

  // Alla dagar som ska visas (fyller ut månaden med dagar från angränsande månader)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Första dagen i månaden
    const firstDay = new Date(year, month, 1)
    // Måndag = 1, Söndag = 0 → vi vill att måndag ska vara index 0
    const startOffset = (firstDay.getDay() || 7) - 1

    // Sista dagen i månaden
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

      {/* Veckorader */}
      <div className="flex flex-col flex-1 overflow-y-auto divide-y divide-slate-700/50">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 flex-1 divide-x divide-slate-700/50 min-h-[120px]">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentMonth
              const isToday = isSameDay(day, today)

              const dayCases = cases.filter(c => {
                const d = c.start_date || c.due_date
                return d && isSameDay(new Date(d), day)
              }).sort((a, b) => {
                const aT = a.start_date || a.due_date || ''
                const bT = b.start_date || b.due_date || ''
                return aT.localeCompare(bT)
              })

              const visible = dayCases.slice(0, MONTH_MAX_EVENTS)
              const overflow = dayCases.length - visible.length

              return (
                <div
                  key={di}
                  className={`
                    p-1.5 cursor-pointer transition-colors border-t-2
                    ${isToday ? 'bg-[#20c58f]/5 border-t-red-500' : isCurrentMonth ? 'bg-slate-900/20 border-t-transparent' : 'bg-slate-900/60 border-t-transparent'}
                    hover:bg-slate-800/30
                  `}
                  onClick={() => onDayClick(day)}
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

                  {/* Ärenden */}
                  <div className="space-y-0.5">
                    {visible.map(c => {
                      const techId = c.primary_assignee_id
                      const techIdx = techId ? (techIndexMap.get(techId) ?? 0) : 0
                      const techColor = TECH_COLORS[techIdx % TECH_COLORS.length]
                      return (
                        <GridEventCard
                          key={c.id}
                          caseData={c}
                          onClick={() => onCaseClick(c)}
                          techColor={techColor}
                          compact
                        />
                      )
                    })}

                    {overflow > 0 && (
                      <p className="text-[10px] text-slate-500 hover:text-slate-300 px-1">
                        +{overflow} fler
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
