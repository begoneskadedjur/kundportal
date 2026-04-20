// src/components/admin/sales-pipeline/MarginTrendChart.tsx
// Scatter-plot per avtal med filter-chips (säljare + tjänstegrupp).
// Klick på punkt → callback (scroll + expand i tabell).
import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { Target, X } from 'lucide-react'
import type { MarginTrendPoint } from '../../../services/contractService'

interface MarginTrendChartProps {
  data: MarginTrendPoint[]
  availableSellers: Array<{ email: string; name: string }>
  availableGroups: string[]
  onPointClick?: (contractId: string) => void
}

function formatKr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return `${Math.round(v)}`
}

export default function MarginTrendChart({
  data,
  availableSellers,
  availableGroups,
  onPointClick,
}: MarginTrendChartProps) {
  const [sellerFilter, setSellerFilter] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return data.filter(d => {
      if (sellerFilter && d.seller_email !== sellerFilter) return false
      if (groupFilter && d.top_service_group !== groupFilter) return false
      return true
    })
  }, [data, sellerFilter, groupFilter])

  const points = useMemo(() => {
    return filtered.map(d => {
      const ts = new Date(d.signed_at).getTime()
      return {
        x: ts,
        y: d.margin_pct,
        z: Math.max(Math.log10(Math.max(d.external_total, 1)) * 40, 30),
        contract_id: d.contract_id,
        company_name: d.company_name,
        seller_name: d.seller_name,
        external_total: d.external_total,
        margin_pct: d.margin_pct,
        top_service: d.top_service,
        signed_at: d.signed_at,
      }
    })
  }, [filtered])

  // Trend: medelmarginal
  const avgMargin =
    filtered.length > 0
      ? filtered.reduce((s, d) => s + d.margin_pct, 0) / filtered.length
      : 0

  const dateDomain = useMemo(() => {
    if (points.length === 0) return ['auto', 'auto']
    const mn = Math.min(...points.map(p => p.x))
    const mx = Math.max(...points.map(p => p.x))
    return [mn, mx]
  }, [points])

  const formatDateTick = (ts: number): string => {
    const d = new Date(ts)
    return d.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }).replace('.', '')
  }

  const hasActiveFilter = sellerFilter || groupFilter

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Marginalutveckling per avtal</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Snittmarginal</div>
          <div
            className={`text-sm font-semibold ${
              avgMargin >= 40
                ? 'text-green-400'
                : avgMargin >= 20
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {avgMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Filter-chips */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={sellerFilter || ''}
          onChange={e => setSellerFilter(e.target.value || null)}
          className="text-[11px] bg-slate-800/80 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
        >
          <option value="">Alla säljare</option>
          {availableSellers.map(s => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={groupFilter || ''}
          onChange={e => setGroupFilter(e.target.value || null)}
          className="text-[11px] bg-slate-800/80 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
        >
          <option value="">Alla tjänstegrupper</option>
          {availableGroups.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {hasActiveFilter && (
          <button
            onClick={() => {
              setSellerFilter(null)
              setGroupFilter(null)
            }}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3 h-3" />
            Rensa
          </button>
        )}

        <span className="ml-auto text-[11px] text-slate-500">
          {filtered.length} av {data.length} avtal
        </span>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 14, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              dataKey="x"
              domain={dateDomain as any}
              tickFormatter={formatDateTick}
              stroke="#64748b"
              style={{ fontSize: '10px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              stroke="#64748b"
              style={{ fontSize: '10px' }}
              tickFormatter={v => `${v}%`}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <ZAxis type="number" dataKey="z" range={[30, 300]} />
            <ReferenceLine
              y={avgMargin}
              stroke="#20c58f"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <ReferenceLine y={30} stroke="#64748b" strokeDasharray="2 6" strokeOpacity={0.3} />
            <ReferenceLine y={15} stroke="#64748b" strokeDasharray="2 6" strokeOpacity={0.3} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null
                const p = payload[0].payload as any
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="font-semibold text-white">{p.company_name}</div>
                    <div className="text-slate-400">
                      {new Date(p.signed_at).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
                      <span className="text-slate-500">Värde:</span>
                      <span className="text-white font-medium">
                        {formatKr(p.external_total)} kr
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Marginal:</span>
                      <span
                        className={`font-medium ${
                          p.margin_pct >= 40
                            ? 'text-green-400'
                            : p.margin_pct >= 20
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }`}
                      >
                        {p.margin_pct.toFixed(1)}%
                      </span>
                    </div>
                    {p.seller_name && (
                      <div className="text-slate-500">Säljare: {p.seller_name}</div>
                    )}
                    {p.top_service && (
                      <div className="text-slate-500">Huvudtjänst: {p.top_service}</div>
                    )}
                    <div className="text-[10px] text-[#20c58f] pt-1 border-t border-slate-700">
                      Klicka för detaljer →
                    </div>
                  </div>
                )
              }}
            />
            <Scatter
              data={points}
              fill="#20c58f"
              fillOpacity={0.7}
              stroke="#20c58f"
              strokeOpacity={0.9}
              onClick={(entry: any) => {
                if (entry && onPointClick) onPointClick(entry.contract_id)
              }}
              style={{ cursor: 'pointer' }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
