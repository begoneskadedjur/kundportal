// StatusLegend.tsx — Inline statusfärg-legend
import { STATUS_LEGEND } from './scheduleConstants'

export function StatusLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-400">
      {STATUS_LEGEND.map(s => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
