// src/components/admin/customers/analytics/PortalAdoptionChart.tsx - Portal-tillgång PieChart

import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import Card from '../../../ui/Card'

interface PortalAdoptionChartProps {
  stats: {
    fullAccess: number
    partialAccess: number
    noAccess: number
  }
  onSegmentClick?: (access: string) => void
}

const SEGMENTS = [
  { key: 'full', label: 'Full tillgång', color: '#22c55e' },
  { key: 'partial', label: 'Delvis tillgång', color: '#f59e0b' },
  { key: 'none', label: 'Ingen tillgång', color: '#64748b' },
]

export default function PortalAdoptionChart({ stats, onSegmentClick }: PortalAdoptionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const data = useMemo(() => [
    { name: 'Full tillgång', value: stats.fullAccess, key: 'full' },
    { name: 'Delvis tillgång', value: stats.partialAccess, key: 'partial' },
    { name: 'Ingen tillgång', value: stats.noAccess, key: 'none' },
  ].filter(d => d.value > 0), [stats])

  const total = stats.fullAccess + stats.partialAccess + stats.noAccess
  const adoptionRate = total > 0 ? (((stats.fullAccess + stats.partialAccess) / total) * 100).toFixed(0) : '0'

  const CustomTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    const segment = SEGMENTS.find(s => s.key === item.key)
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-white">{item.name}</p>
        <p className="text-sm" style={{ color: segment?.color }}>
          {item.value} organisationer
        </p>
        <p className="text-xs text-slate-400">
          {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
        </p>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Portal-adoption</h3>
        <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
          {adoptionRate}% adoptionsgrad
        </span>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Ingen data tillgänglig
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="w-48 h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_, index) => onSegmentClick?.(data[index].key)}
                  cursor={onSegmentClick ? 'pointer' : 'default'}
                >
                  {data.map((entry) => {
                    const segment = SEGMENTS.find(s => s.key === entry.key)
                    const dataIdx = data.indexOf(entry)
                    return (
                      <Cell
                        key={entry.key}
                        fill={segment?.color || '#64748b'}
                        opacity={activeIndex === null || activeIndex === dataIdx ? 1 : 0.4}
                        stroke="none"
                      />
                    )
                  })}
                </Pie>
                <Tooltip content={<CustomTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-white">{adoptionRate}%</span>
              <span className="text-xs text-slate-400">adoption</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {SEGMENTS.map((segment) => {
              const value = segment.key === 'full' ? stats.fullAccess
                : segment.key === 'partial' ? stats.partialAccess
                : stats.noAccess
              const dataIdx = data.findIndex(d => d.key === segment.key)
              return (
                <div
                  key={segment.key}
                  className="flex items-center justify-between p-2 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => onSegmentClick?.(segment.key)}
                  onMouseEnter={() => dataIdx >= 0 && setActiveIndex(dataIdx)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="text-sm text-slate-300">{segment.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{value}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {total > 0 ? ((value / total) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
