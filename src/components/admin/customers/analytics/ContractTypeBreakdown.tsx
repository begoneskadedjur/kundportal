// src/components/admin/customers/analytics/ContractTypeBreakdown.tsx

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ContractTypeStat } from '../../../../hooks/useContractInsights'

interface Props {
  data: ContractTypeStat[]
}

const COLORS = ['#20c58f', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']

function MarginBadge({ margin, sampleSize }: { margin: number | null; sampleSize: number }) {
  if (margin === null) return <span className="text-slate-600">–</span>
  const color = margin >= 50 ? 'text-[#20c58f]' : margin >= 20 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={`font-medium ${color}`} title={`Baserat på ${sampleSize} kunder`}>
      {margin}%
    </span>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ContractTypeStat
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-200 font-medium mb-1 max-w-[200px]">{d.type}</p>
      <p className="text-slate-400">{d.count} avtal</p>
      <p className="text-white font-semibold">{d.totalArr.toLocaleString('sv-SE')} kr ARR</p>
      <p className="text-slate-400">Snitt: {d.avgArr.toLocaleString('sv-SE')} kr</p>
      {d.margin !== null && (
        <p className="text-[#20c58f]">Marginal: {d.margin}%</p>
      )}
    </div>
  )
}

export default function ContractTypeBreakdown({ data }: Props) {
  // Shorten labels for chart
  const chartData = data.slice(0, 10).map(d => ({
    ...d,
    shortName: d.type.length > 28 ? d.type.slice(0, 28) + '…' : d.type,
  }))

  return (
    <div className="space-y-4">
      {/* Horizontal bar chart */}
      <div style={{ height: Math.max(200, chartData.length * 42) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="shortName"
              width={200}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="totalArr" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60 border-b border-slate-700/50">
            <tr>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Avtalstyp</th>
              <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Antal</th>
              <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Total ARR</th>
              <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Snitt ARR</th>
              <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Marginal</th>
              <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Spann</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row, i) => (
              <tr key={row.type} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-3 py-2.5 text-slate-200">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  {row.type}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-300">{row.count}</td>
                <td className="px-3 py-2.5 text-right text-white font-semibold">
                  {row.totalArr.toLocaleString('sv-SE')} kr
                </td>
                <td className="px-3 py-2.5 text-right text-slate-300">
                  {row.avgArr.toLocaleString('sv-SE')} kr
                </td>
                <td className="px-3 py-2.5 text-right">
                  <MarginBadge margin={row.margin} sampleSize={row.marginSampleSize} />
                </td>
                <td className="px-3 py-2.5 text-right text-slate-500">
                  {row.minArr.toLocaleString('sv-SE')}–{row.maxArr.toLocaleString('sv-SE')} kr
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
