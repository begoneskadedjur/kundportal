// src/components/admin/customers/analytics/HealthScoreDistributionChart.tsx - Health Score fördelning

import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Card from '../../../ui/Card'
import { ConsolidatedCustomer } from '../../../../hooks/useConsolidatedCustomers'

interface HealthScoreDistributionChartProps {
  customers: ConsolidatedCustomer[]
  onBarClick?: (level: string) => void
}

const BUCKETS = [
  { key: 'poor', label: 'Poor (0-39)', min: 0, max: 39, color: '#ef4444' },
  { key: 'fair', label: 'Fair (40-59)', min: 40, max: 59, color: '#f59e0b' },
  { key: 'good', label: 'Good (60-79)', min: 60, max: 79, color: '#eab308' },
  { key: 'excellent', label: 'Excellent (80-100)', min: 80, max: 100, color: '#22c55e' },
]

export default function HealthScoreDistributionChart({ customers, onBarClick }: HealthScoreDistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const data = useMemo(() => {
    return BUCKETS.map(bucket => {
      const count = customers.filter(c => {
        const score = c.overallHealthScore.score
        return score >= bucket.min && score <= bucket.max
      }).length
      return {
        ...bucket,
        count,
        percentage: customers.length > 0 ? ((count / customers.length) * 100).toFixed(0) : '0'
      }
    })
  }, [customers])

  const CustomTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-white">{item.label}</p>
        <p className="text-sm" style={{ color: item.color }}>
          {item.count} organisationer
        </p>
        <p className="text-xs text-slate-400">{item.percentage}% av totalt</p>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Health Score Fördelning</h3>

      {customers.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Ingen data tillgänglig
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltipContent />} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={(_, index) => onBarClick?.(data[index].key)}
                cursor={onBarClick ? 'pointer' : 'default'}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-700">
        {data.map((bucket) => (
          <div
            key={bucket.key}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onBarClick?.(bucket.key)}
          >
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bucket.color }} />
            <span className="text-xs text-slate-400">
              {bucket.label}: <span className="text-white font-medium">{bucket.count}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
