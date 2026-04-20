// src/components/admin/sales-pipeline/SellerMomentumGrid.tsx
// Kompakt sparkline-grid per säljare.
// Varje säljare: mini area-chart över månader + 30d-delta-indikator.
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react'
import type { SellerMomentumRow } from '../../../services/contractService'

interface SellerMomentumGridProps {
  data: SellerMomentumRow[]
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

export default function SellerMomentumGrid({ data }: SellerMomentumGridProps) {
  if (data.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Säljar-momentum</h3>
        </div>
        <div className="text-center text-xs text-slate-500 py-6">
          Ingen säljardata i vald period.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Säljar-momentum</h3>
        </div>
        <span className="text-[10px] text-slate-500">30d vs 30d innan</span>
      </div>

      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {data.map(seller => {
          const delta = seller.delta_pct
          const isPositive = delta !== null && delta >= 0
          const DeltaIcon =
            delta === null ? Minus : isPositive ? TrendingUp : TrendingDown
          const deltaColor =
            delta === null
              ? 'text-slate-500'
              : isPositive
                ? 'text-green-400'
                : 'text-red-400'

          return (
            <div
              key={seller.email}
              className="flex items-center gap-3 p-2 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              {/* Avatar */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#20c58f]/30 to-blue-500/30 border border-slate-700 text-[10px] font-bold text-white flex-shrink-0">
                {initials(seller.name)}
              </div>

              {/* Name + period total */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">
                  {seller.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {formatKr(seller.total_period)} kr period
                </div>
              </div>

              {/* Sparkline */}
              <div className="w-24 h-10 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={seller.monthly}
                    margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                  >
                    <defs>
                      <linearGradient
                        id={`spark-${seller.email.replace(/[^a-z0-9]/gi, '')}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#20c58f" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#20c58f" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={[0, 'auto']} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#20c58f"
                      strokeWidth={1.5}
                      fill={`url(#spark-${seller.email.replace(/[^a-z0-9]/gi, '')})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Delta */}
              <div className={`flex items-center gap-1 w-16 justify-end ${deltaColor}`}>
                <DeltaIcon className="w-3 h-3" />
                <span className="text-xs font-semibold tabular-nums">
                  {delta === null ? '—' : `${isPositive ? '+' : ''}${delta}%`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
