// src/components/admin/sales-pipeline/TechnicianDeliveryGrid.tsx
// Visar topp-10 tekniker som primärt utför ärenden kopplade till signerade avtal.
// Klick på tekniker → callback som filtrerar avtalstabellen på deras contract_ids.
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts'
import { Wrench, ArrowUpRight } from 'lucide-react'
import type { TechnicianDeliveryRow } from '../../../services/contractService'

interface TechnicianDeliveryGridProps {
  data: TechnicianDeliveryRow[]
  onTechnicianClick?: (tech: TechnicianDeliveryRow) => void
  activeTechnicianId?: string | null
}

function formatKr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return `${Math.round(v)}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function marginColor(pct: number | null): string {
  if (pct === null) return 'text-slate-500'
  if (pct >= 40) return 'text-green-400'
  if (pct >= 20) return 'text-amber-400'
  return 'text-red-400'
}

export default function TechnicianDeliveryGrid({
  data,
  onTechnicianClick,
  activeTechnicianId,
}: TechnicianDeliveryGridProps) {
  if (data.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Tekniker-leverans</h3>
        </div>
        <div className="text-center text-xs text-slate-500 py-8">
          Inga tekniker-kopplade ärenden i vald period.
        </div>
      </div>
    )
  }

  const top = data.slice(0, 10)

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Tekniker-leverans</h3>
          <span className="text-[10px] text-slate-500">({data.length} st · top 10)</span>
        </div>
        <span className="text-[10px] text-slate-500">Signerade avtal ↔ primärtekniker</span>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {top.map(t => {
          const isActive = activeTechnicianId === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTechnicianClick?.(t)}
              className={`w-full flex items-center gap-3 p-2 bg-slate-800/30 border rounded-lg transition-colors text-left ${
                isActive
                  ? 'border-[#20c58f]/60 bg-[#20c58f]/5'
                  : 'border-slate-700/50 hover:bg-slate-800/50'
              }`}
              title="Klicka för att filtrera avtalstabellen på denna tekniker"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-slate-700 text-[10px] font-bold text-white flex-shrink-0">
                {initials(t.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white truncate">{t.name}</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-600" />
                </div>
                <div className="text-[10px] text-slate-500">
                  {t.case_count} ärenden · {t.contract_count} avtal
                </div>
              </div>

              {/* Sparkline */}
              <div className="w-20 h-8 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={t.monthly}
                    margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                  >
                    <defs>
                      <linearGradient
                        id={`tech-${t.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={[0, 'auto']} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#a855f7"
                      strokeWidth={1.5}
                      fill={`url(#tech-${t.id})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Marginal */}
              <div className={`w-12 text-right ${marginColor(t.avg_margin_pct)}`}>
                <div className="text-[9px] text-slate-500">Marg</div>
                <div className="text-xs font-semibold tabular-nums">
                  {t.avg_margin_pct !== null ? `${t.avg_margin_pct}%` : '—'}
                </div>
              </div>

              {/* Värde */}
              <div className="w-16 text-right">
                <div className="text-[9px] text-slate-500">Värde</div>
                <div className="text-xs font-semibold text-white tabular-nums">
                  {formatKr(t.total_contract_value)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
