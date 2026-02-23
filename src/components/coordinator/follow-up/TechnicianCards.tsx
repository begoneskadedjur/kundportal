// src/components/coordinator/follow-up/TechnicianCards.tsx
// Per-tekniker KPI-kort för koordinatorns offertuppföljning
import { User, AlertTriangle, Clock, TrendingUp, Banknote } from 'lucide-react'
import type { TechnicianOfferStats } from '../../../services/offerFollowUpService'

interface TechnicianCardsProps {
  stats: TechnicianOfferStats[]
  selectedTechnician: string | null
  onSelect: (email: string | null) => void
}

function formatKr(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mkr`
  if (value >= 1_000) return `${Math.round(value / 1_000)} tkr`
  return `${value} kr`
}

export function TechnicianCards({ stats, selectedTechnician, onSelect }: TechnicianCardsProps) {
  if (stats.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {stats.map(t => {
        const isSelected = selectedTechnician === t.technician_email
        const hasOverdue = t.overdue > 0

        return (
          <button
            key={t.technician_id}
            onClick={() => onSelect(isSelected ? null : t.technician_email)}
            className={`p-3 rounded-xl border text-left transition-all ${
              isSelected
                ? 'bg-[#20c58f]/10 border-[#20c58f]/50 ring-1 ring-[#20c58f]/30'
                : hasOverdue
                  ? 'bg-slate-800/30 border-red-500/30 hover:border-red-500/50'
                  : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
            }`}
          >
            {/* Namn */}
            <div className="flex items-center gap-1.5 mb-2">
              <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-sm font-medium text-white truncate">
                {t.technician_name}
              </span>
            </div>

            {/* KPI-rad */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-slate-400">
                  {t.pending} <span className="text-slate-600">vänt.</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className={`w-3 h-3 ${t.overdue > 0 ? 'text-red-400' : 'text-slate-600'}`} />
                <span className={`text-xs ${t.overdue > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {t.overdue} <span className={t.overdue > 0 ? 'text-red-400/60' : 'text-slate-600'}>förf.</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-xs text-slate-400">
                  {t.sign_rate}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Banknote className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-slate-400">
                  {formatKr(t.total_pipeline_value)}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
