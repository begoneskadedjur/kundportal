// AbsenceBlock.tsx — Frånvaro-block med diagonala ränder
import { useState } from 'react'
import { eventX, eventWidth, clampToGrid, formatTime } from './scheduleUtils'
import { ROW_HEIGHT } from './scheduleConstants'
import type { ViewMode } from './ScheduleHeader'

export interface Absence {
  id: string
  technician_id: string
  start_date: string
  end_date: string
  reason: string
  notes?: string
}

interface AbsenceBlockProps {
  absence: Absence
  onClick?: (absence: Absence) => void
  viewMode: ViewMode
  weekStart: Date
}

export function AbsenceBlock({ absence, onClick, viewMode, weekStart }: AbsenceBlockProps) {
  const [hovered, setHovered] = useState(false)

  const start = new Date(absence.start_date || absence.end_date)
  const end = new Date(absence.end_date || absence.start_date)
  const rawX = eventX(start, viewMode, weekStart)
  const rawW = eventWidth(start, end, viewMode)
  const { x, width } = clampToGrid(rawX, rawW, viewMode)
  if (width <= 0) return null

  const isAdmin = absence.reason === 'Admin'
  const bgClass = isAdmin ? 'bg-indigo-700/30' : 'bg-slate-700/40'
  const borderClass = isAdmin ? 'border-l-indigo-500' : 'border-l-slate-500'

  const startStr = formatTime(start)
  const endStr = formatTime(end)
  const isWeek = viewMode === 'week'

  return (
    <div
      className={`
        absolute top-1 rounded-md border-l-4 cursor-pointer
        transition-all duration-150 hover:brightness-110
        ${bgClass} ${borderClass}
      `}
      style={{
        left: x,
        width,
        height: ROW_HEIGHT - 10,
        backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(0,0,0,0.08) 8px, rgba(0,0,0,0.08) 16px)',
      }}
      onClick={() => onClick?.(absence)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-1.5 py-1 h-full flex flex-col justify-center overflow-hidden">
        <p className={`${isWeek ? 'text-[9px]' : 'text-xs'} font-semibold text-slate-200 truncate`}>{absence.reason}</p>
        {!isWeek && <p className="text-[10px] text-slate-400 mt-0.5">{startStr} – {endStr}</p>}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute left-0 bottom-full mb-2 z-50 pointer-events-none">
          <div className="w-56 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 text-xs">
            <p className="font-semibold text-white mb-1">{absence.reason}</p>
            <p className="text-slate-400">{startStr} – {endStr}</p>
            {absence.notes && <p className="text-slate-400 mt-1">{absence.notes}</p>}
            <p className="text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-slate-700">
              Klicka för detaljer
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
