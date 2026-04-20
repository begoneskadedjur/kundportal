// src/components/admin/sales-pipeline/SignedVolumeChart.tsx
// Stacked area-diagram: signerad volym över tid (offerter + avtal).
// Visar både mix och trend i en vy.
import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import type { MonthlyVolumePoint } from '../../../services/contractService'

interface SignedVolumeChartProps {
  data: MonthlyVolumePoint[]
  mode: 'all' | 'offer' | 'contract'
}

function formatKr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return `${Math.round(v)}`
}

export default function SignedVolumeChart({ data, mode }: SignedVolumeChartProps) {
  const { series, total } = useMemo(() => {
    const s = data.map(p => ({
      label: p.label,
      offers: p.offer_value,
      contracts: p.contract_value,
      offer_count: p.offer_count,
      contract_count: p.contract_count,
    }))
    const t = data.reduce((sum, p) => sum + p.total_value, 0)
    return { series: s, total: t }
  }, [data])

  const showOffers = mode === 'all' || mode === 'offer'
  const showContracts = mode === 'all' || mode === 'contract'

  const title =
    mode === 'offer'
      ? 'Offertvolym över tid'
      : mode === 'contract'
        ? 'Avtalsvolym över tid'
        : 'Signerad volym över tid'

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Total period</div>
          <div className="text-sm font-semibold text-white">
            {formatKr(total)} kr
          </div>
        </div>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="offerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="contractGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#20c58f" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#20c58f" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              style={{ fontSize: '10px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              style={{ fontSize: '10px' }}
              tickFormatter={formatKr}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
              formatter={(value: any, name: string) => {
                const label =
                  name === 'offers' ? 'Offerter' : name === 'contracts' ? 'Avtal' : name
                return [`${formatKr(Number(value))} kr`, label]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
              formatter={v => (v === 'offers' ? 'Offerter' : v === 'contracts' ? 'Avtal' : v)}
            />
            {showOffers && (
              <Area
                type="monotone"
                dataKey="offers"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#offerGradient)"
                strokeWidth={2}
              />
            )}
            {showContracts && (
              <Area
                type="monotone"
                dataKey="contracts"
                stackId="1"
                stroke="#20c58f"
                fill="url(#contractGradient)"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
