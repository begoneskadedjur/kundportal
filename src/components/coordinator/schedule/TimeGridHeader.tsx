// TimeGridHeader.tsx — Timrad ovanför griden (dag) eller dagkolumner (vecka)
import { HOUR_WIDTH, DAY_START_HOUR, TOTAL_HOURS, DAY_GRID_WIDTH, WEEK_DAY_COL_WIDTH, WEEK_GRID_WIDTH, WEEK_HOUR_WIDTH } from './scheduleConstants'
import { getWeekDays } from './scheduleUtils'
import type { ViewMode } from './ScheduleHeader'

interface TimeGridHeaderProps {
  viewMode: ViewMode
  weekStart: Date
}

export function TimeGridHeader({ viewMode, weekStart }: TimeGridHeaderProps) {
  if (viewMode === 'week') {
    const days = getWeekDays(weekStart)
    const dayNames = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön']
    return (
      <div className="relative flex-shrink-0 border-b border-slate-700/50" style={{ width: WEEK_GRID_WIDTH, height: 32 }}>
        {days.map((day, i) => (
          <div
            key={i}
            className="absolute top-0 h-full flex items-center border-l border-slate-700/40"
            style={{ left: i * WEEK_DAY_COL_WIDTH, width: WEEK_DAY_COL_WIDTH }}
          >
            <span className="pl-2 text-[10px] font-medium text-slate-500">
              {dayNames[i]} {day.getDate()}/{day.getMonth() + 1}
            </span>
            {/* Subtila timmarkeringar inuti varje dagkolumn */}
            {Array.from({ length: TOTAL_HOURS }, (_, h) => (
              <div
                key={h}
                className="absolute top-0 h-full border-l border-slate-800/20"
                style={{ left: h * WEEK_HOUR_WIDTH }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Dagvy
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i)
  return (
    <div className="relative flex-shrink-0 border-b border-slate-700/50" style={{ width: DAY_GRID_WIDTH, height: 32 }}>
      {hours.map(h => (
        <div
          key={h}
          className="absolute top-0 h-full flex items-center border-l border-slate-700/40"
          style={{ left: (h - DAY_START_HOUR) * HOUR_WIDTH, width: HOUR_WIDTH }}
        >
          <span className="pl-2 text-[10px] font-medium text-slate-500">
            {String(h).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  )
}
