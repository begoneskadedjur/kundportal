// src/components/admin/customers/analytics/ArrDistributionHistogram.tsx

import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  customers: { annual_value?: number | null }[]
}

const BUCKETS = [
  { label: '0–10k', min: 0, max: 10000 },
  { label: '10–20k', min: 10000, max: 20000 },
  { label: '20–30k', min: 20000, max: 30000 },
  { label: '30–50k', min: 30000, max: 50000 },
  { label: '50–100k', min: 50000, max: 100000 },
  { label: '100k+', min: 100000, max: Infinity },
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-200 font-medium">{d.label}</p>
      <p className="text-white font-semibold">{d.count} avtal</p>
      <p className="text-slate-400">{d.totalArr.toLocaleString('sv-SE')} kr total ARR</p>
    </div>
  )
}

export default function ArrDistributionHistogram({ customers }: Props) {
  const data = useMemo(() => {
    return BUCKETS.map(b => {
      const matching = customers.filter(c => {
        const v = Number(c.annual_value) || 0
        return v >= b.min && v < b.max
      })
      return {
        label: b.label,
        count: matching.length,
        totalArr: matching.reduce((s, c) => s + (Number(c.annual_value) || 0), 0),
      }
    })
  }, [customers])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#20c58f" opacity={0.6 + i * 0.05} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
