// src/components/admin/customers/analytics/RevenueBreakdownChart.tsx - Intäktsfördelning PieChart

import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import Card from '../../../ui/Card'
import { ConsolidatedCustomer } from '../../../../hooks/useConsolidatedCustomers'

interface RevenueBreakdownChartProps {
  customers: ConsolidatedCustomer[]
  onSegmentClick?: (type: string) => void
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b']

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function RevenueBreakdownChart({ customers, onSegmentClick }: RevenueBreakdownChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const data = useMemo(() => {
    const contractTotal = customers.reduce((sum, c) => sum + (c.totalAnnualValue || 0), 0)
    const casesTotal = customers.reduce((sum, c) => sum + (c.totalCasesValue || 0), 0)

    return [
      { name: 'Avtalsintäkter', value: contractTotal, type: 'contract' },
      { name: 'Ärenden utöver avtal', value: casesTotal, type: 'cases' },
    ].filter(d => d.value > 0)
  }, [customers])

  const total = data.reduce((sum, d) => sum + d.value, 0)

  const CustomTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-white">{item.name}</p>
        <p className="text-sm text-green-400">{formatCurrency(item.value)}</p>
        <p className="text-xs text-slate-400">
          {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}% av total
        </p>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Intäktsfördelning</h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Ingen intäktsdata tillgänglig
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="w-48 h-48">
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
                  onClick={(_, index) => onSegmentClick?.(data[index].type)}
                  cursor={onSegmentClick ? 'pointer' : 'default'}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={index}
                      fill={COLORS[index]}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-3">
            {data.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => onSegmentClick?.(item.type)}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-sm text-slate-300">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-white">{formatCurrency(item.value)}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Totalt</span>
                <span className="text-sm font-bold text-white">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
