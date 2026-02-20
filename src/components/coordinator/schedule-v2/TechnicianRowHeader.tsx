// TechnicianRowHeader.tsx — Sticky vänsterkolumn per tekniker med kapacitetsbar
import { useMemo } from 'react'
import { Technician, BeGoneCaseRow } from '../../../types/database'
import { TECH_COL_WIDTH, ROW_HEIGHT, TECH_COLORS } from './scheduleConstants'
import { getTechWorkHours } from './scheduleUtils'

interface TechnicianRowHeaderProps {
  technician: Technician
  cases: BeGoneCaseRow[]
  index: number
  currentDate: Date
}

export function TechnicianRowHeader({ technician, cases, index, currentDate }: TechnicianRowHeaderProps) {
  const color = TECH_COLORS[index % TECH_COLORS.length]

  const { caseCount, scheduledHours, capacity, ratio } = useMemo(() => {
    const count = cases.length
    let hours = 0
    for (const c of cases) {
      if (c.start_date && c.due_date) {
        const ms = new Date(c.due_date).getTime() - new Date(c.start_date).getTime()
        hours += ms / 3_600_000
      }
    }
    const cap = getTechWorkHours(technician.work_schedule as any, currentDate)
    return {
      caseCount: count,
      scheduledHours: Math.round(hours * 10) / 10,
      capacity: cap,
      ratio: cap > 0 ? hours / cap : 0,
    }
  }, [cases, technician.work_schedule, currentDate])

  const barColor = ratio < 0.7 ? 'bg-emerald-500' : ratio < 0.9 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div
      className="flex items-center gap-2 px-3 border-b border-slate-800/60 bg-slate-900/95 backdrop-blur-sm"
      style={{ width: TECH_COL_WIDTH, height: ROW_HEIGHT }}
    >
      {/* Färgrand */}
      <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{technician.name}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {caseCount} ärenden · {scheduledHours}h / {capacity}h
        </p>
        {/* Kapacitetsbar */}
        <div className="mt-1 h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(ratio * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
