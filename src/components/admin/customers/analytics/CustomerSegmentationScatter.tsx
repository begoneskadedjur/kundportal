// src/components/admin/customers/analytics/CustomerSegmentationScatter.tsx - Kundsegmentering scatter chart

import React, { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import Card from '../../../ui/Card'
import { ConsolidatedCustomer } from '../../../../hooks/useConsolidatedCustomers'

interface CustomerSegmentationScatterProps {
  customers: ConsolidatedCustomer[]
  onCustomerClick?: (companyName: string) => void
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
  return amount.toFixed(0)
}

const getChurnColor = (risk: string): string => {
  switch (risk) {
    case 'high': return '#ef4444'
    case 'medium': return '#f59e0b'
    default: return '#22c55e'
  }
}

export default function CustomerSegmentationScatter({ customers, onCustomerClick }: CustomerSegmentationScatterProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const data = useMemo(() => {
    return customers
      .filter(c => c.totalContractValue > 0)
      .map(c => ({
        x: c.totalContractValue,
        y: c.overallHealthScore.score,
        size: Math.min(Math.max(c.totalSites * 6, 8), 40),
        name: c.company_name,
        churnRisk: c.highestChurnRisk.risk,
        churnScore: c.highestChurnRisk.score,
        totalSites: c.totalSites,
        type: c.organizationType,
        color: getChurnColor(c.highestChurnRisk.risk),
      }))
  }, [customers])

  // Beräkna medianvärde för referenslinjer
  const medianValue = useMemo(() => {
    if (data.length === 0) return 0
    const sorted = [...data].sort((a, b) => a.x - b.x)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1].x + sorted[mid].x) / 2
      : sorted[mid].x
  }, [data])

  const CustomTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg min-w-[200px]">
        <p className="text-sm font-semibold text-white mb-1">{item.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Avtalsvärde:</span>
            <span className="text-green-400 font-medium">
              {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(item.x)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Health Score:</span>
            <span className="text-white font-medium">{item.y}/100</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Churn Risk:</span>
            <span style={{ color: item.color }} className="font-medium">
              {item.churnRisk === 'high' ? 'Hög' : item.churnRisk === 'medium' ? 'Medel' : 'Låg'} ({Math.round(item.churnScore)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Typ:</span>
            <span className="text-white">{item.type === 'multisite' ? `Multisite (${item.totalSites} enheter)` : 'Enskild'}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 pt-1 border-t border-slate-700">Klicka för att visa kund</p>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Kundsegmentering</h3>
          <p className="text-xs text-slate-400 mt-1">Avtalsvärde vs Health Score — storlek = antal enheter, färg = churn risk</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-xs text-slate-400">Låg risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-slate-400">Medel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-slate-400">Hög risk</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          Ingen data tillgänglig
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="x"
                name="Avtalsvärde"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => formatCurrency(v)}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                label={{ value: 'Avtalsvärde (SEK)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Health Score"
                domain={[0, 100]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                label={{ value: 'Health Score', angle: -90, position: 'insideLeft', offset: 5, fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltipContent />} />

              {/* Referenslinjer för kvadranter */}
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="5 5" />
              <ReferenceLine x={medianValue} stroke="#475569" strokeDasharray="5 5" />

              <Scatter
                data={data}
                onClick={(point) => onCustomerClick?.(point.name)}
                cursor={onCustomerClick ? 'pointer' : 'default'}
                onMouseEnter={(_, index) => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.color}
                    r={entry.size / 2}
                    opacity={hoveredIndex === null || hoveredIndex === index ? 0.85 : 0.3}
                    stroke={hoveredIndex === index ? '#fff' : 'none'}
                    strokeWidth={hoveredIndex === index ? 2 : 0}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kvadrant-labels */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-2 p-2 rounded bg-red-500/5">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          <span className="text-xs text-slate-400">Nedre vänster: <span className="text-red-400">Churn-risk</span></span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/5">
          <div className="w-2 h-2 rounded-full bg-amber-500/50" />
          <span className="text-xs text-slate-400">Nedre höger: <span className="text-amber-400">Kräver uppmärksamhet</span></span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
          <span className="text-xs text-slate-400">Övre vänster: <span className="text-emerald-400">Nöjda småkunder</span></span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-green-500/5">
          <div className="w-2 h-2 rounded-full bg-green-500/50" />
          <span className="text-xs text-slate-400">Övre höger: <span className="text-green-400">Ideala kunder</span></span>
        </div>
      </div>
    </Card>
  )
}
