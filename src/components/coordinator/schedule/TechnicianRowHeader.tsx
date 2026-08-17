// TechnicianRowHeader.tsx — Sticky vänsterkolumn per tekniker med kapacitetsbar
import { useMemo, memo } from 'react'
import { Technician, BeGoneCaseRow } from '../../../types/database'
import { TECH_COL_WIDTH, ROW_HEIGHT, TECH_COLORS } from './scheduleConstants'
import { getTechWorkHours, splitScheduledHours, roundHours } from './scheduleUtils'

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

  // Belastningsfärg på procentsiffran (baren är numera kategorifärgad)
  const pctColor = ratio === 0 ? 'text-slate-400' : ratio < 0.7 ? 'text-emerald-400' : ratio < 0.9 ? 'text-amber-400' : 'text-red-400'

  // Segmentbredder i % av kapaciteten (klipps av containern vid överbeläggning)
  const engangWidth = capacity > 0 ? (engangHours / capacity) * 100 : 0
  const avtalWidth = capacity > 0 ? (avtalHours / capacity) * 100 : 0

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
        {/* Kapacitetsbar — stackad: engångskunder (grön) + avtalskunder (lila) */}
        <div className="mt-1 h-1 w-full rounded-full bg-slate-700/50 overflow-hidden flex">
          <div
            className="h-full bg-[#20c58f] transition-all"
            style={{ width: `${Math.min(engangWidth, 100)}%` }}
          />
          <div
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${Math.min(avtalWidth, Math.max(0, 100 - engangWidth))}%` }}
          />
        </div>
        {/* Beläggningssplit: engång vs avtal */}
        {scheduledHours > 0 && (
          <p className="text-[10px] mt-0.5 truncate">
            <span className="text-[#20c58f]">{engangHours}h engång</span>
            <span className="text-slate-600"> · </span>
            <span className="text-violet-400">{avtalHours}h avtal</span>
          </p>
        )}
      </div>
    </div>
  )
})
