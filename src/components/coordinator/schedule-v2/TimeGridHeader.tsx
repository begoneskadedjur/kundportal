// TimeGridHeader.tsx — Timrad ovanför griden
import { HOUR_WIDTH, DAY_START_HOUR, TOTAL_HOURS, GRID_WIDTH } from './scheduleConstants'

export function TimeGridHeader() {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i)

  return (
    <div className="relative flex-shrink-0 border-b border-slate-700/50" style={{ width: GRID_WIDTH, height: 32 }}>
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
