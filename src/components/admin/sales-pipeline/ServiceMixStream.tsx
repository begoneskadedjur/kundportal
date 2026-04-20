// src/components/admin/sales-pipeline/ServiceMixStream.tsx
// Stacked area-diagram ("stream"-stil) per tjänstegrupp över månader.
// Visar vilka tjänster som växer eller minskar.
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
import { Layers } from 'lucide-react'
import type { ServiceMixPoint } from '../../../services/contractService'

interface ServiceMixStreamProps {
  data: ServiceMixPoint[]
}

function formatKr(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return `${Math.round(v)}`
}

// Tilldela färger per grupp-index (konsekvent mellan månader)
const GROUP_COLORS = [
  '#20c58f', // brand-green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
]

export default function ServiceMixStream({ data }: ServiceMixStreamProps) {
  const { chartData, groups } = useMemo(() => {
    const groupSet = new Set<string>()
    data.forEach(p => Object.keys(p.groups).forEach(g => groupSet.add(g)))
    const groupList = Array.from(groupSet).sort((a, b) => {
      // Sortera på totalvärde (störst först så dom läggs underst i stacken)
      const aTot = data.reduce((s, p) => s + (p.groups[a] || 0), 0)
      const bTot = data.reduce((s, p) => s + (p.groups[b] || 0), 0)
      return bTot - aTot
    })

    const chart = data.map(p => {
      const row: Record<string, any> = { label: p.label }
      groupList.forEach(g => {
        row[g] = p.groups[g] || 0
      })
      return row
    })

    return { chartData: chart, groups: groupList }
  }, [data])

  if (groups.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Tjänste-mix över tid</h3>
        </div>
        <div className="text-center text-xs text-slate-500 py-6">
          Ingen tjänstedata i vald period.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Tjänste-mix över tid</h3>
        </div>
        <span className="text-[10px] text-slate-500">{groups.length} grupper</span>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
            <defs>
              {groups.map((g, i) => (
                <linearGradient
                  key={g}
                  id={`mix-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={GROUP_COLORS[i % GROUP_COLORS.length]}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={GROUP_COLORS[i % GROUP_COLORS.length]}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
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
              formatter={(value: any, name: string) => [`${formatKr(Number(value))} kr`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
              iconType="circle"
              iconSize={8}
            />
            {groups.map((g, i) => (
              <Area
                key={g}
                type="monotone"
                dataKey={g}
                stackId="1"
                stroke={GROUP_COLORS[i % GROUP_COLORS.length]}
                fill={`url(#mix-${i})`}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
