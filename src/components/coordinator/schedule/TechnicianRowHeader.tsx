// TechnicianRowHeader.tsx — Sticky vänsterkolumn per tekniker med kapacitetsbarer
import { useMemo, memo } from 'react'
import { Technician, BeGoneCaseRow } from '../../../types/database'
import { TECH_COL_WIDTH, ROW_HEIGHT, TECH_COLORS } from './scheduleConstants'
import { getTechWorkHours, splitScheduledHours, roundHours } from './scheduleUtils'
import { CapacitySplitBars } from './CapacitySplitBars'

interface TechnicianRowHeaderProps {
  technician: Technician
  cases: BeGoneCaseRow[]
  index: number
  currentDate: Date
}

export const TechnicianRowHeader = memo(function TechnicianRowHeader({ technician, cases, index, currentDate }: TechnicianRowHeaderProps) {
  const color = TECH_COLORS[index % TECH_COLORS.length]

  const { caseCount, scheduledHours, engangHours, avtalHours, capacity, ratio, pct } = useMemo(() => {
    const split = splitScheduledHours(cases)
    const cap = getTechWorkHours(technician.work_schedule as any, currentDate)
    return {
      caseCount: cases.length,
      scheduledHours: roundHours(split.total),
      engangHours: roundHours(split.engang),
      avtalHours: roundHours(split.avtal),
      capacity: cap,
      ratio: cap > 0 ? split.total / cap : 0,
      pct: cap > 0 ? Math.round((split.total / cap) * 10000) / 100 : 0,
    }
  }, [cases, technician.work_schedule, currentDate])

  // Belastningsfärg på procentsiffran (barerna är kategorifärgade)
  const pctColor = ratio === 0 ? 'text-slate-400' : ratio < 0.7 ? 'text-emerald-400' : ratio < 0.9 ? 'text-amber-400' : 'text-red-400'

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
          {caseCount} ärenden · {scheduledHours}h / {capacity}h · <span className={pctColor}>{pct}%</span>
        </p>
        {/* Dubbla mini-barer: Engångskunder vs Avtalskunder */}
        <div className="mt-1">
          <CapacitySplitBars engang={engangHours} avtal={avtalHours} capacity={capacity} />
        </div>
      </div>
    </div>
  )
})
