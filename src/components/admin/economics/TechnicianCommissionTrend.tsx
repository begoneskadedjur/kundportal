import React, { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useTechnicianCommissionTrend } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatMonth, formatCompactNumber } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const COLORS = [
  '#20c58f', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const items = [...payload]
    .filter((p: any) => (p.value || 0) > 0)
    .sort((a: any, b: any) => b.value - a.value)
  if (items.length === 0) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[220px] max-h-[280px] overflow-y-auto">
      <p className="text-xs font-semibold text-slate-200 mb-2">{label}</p>
      {items.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs mb-1 last:mb-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-slate-400 truncate">{p.dataKey}</span>
          </div>
          <span className="text-slate-200 font-medium shrink-0">{formatCurrency(Number(p.value || 0))}</span>
        </div>
      ))}
    </div>
  )
}

const TechnicianCommissionTrend: React.FC = () => {
  const { monthsInPeriod } = useEconomicsPeriod()
  const { data, loading } = useTechnicianCommissionTrend(Math.max(monthsInPeriod, 6))

  const chartData = useMemo(() => {
    return (data?.data || []).map(p => ({ ...p, month: formatMonth(p.month as string) }))
  }, [data])

  const technicians = data?.technicians || []
  const hasAny = chartData.some(p =>
    technicians.some(t => Number(p[t] || 0) > 0)
  )

  return (
    <SectionCard
      title="Provision per tekniker"
      subtitle="Månadsvis provision — toggla tekniker i legend"
      icon={<LineIcon className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !hasAny ? (
        <EmptyChartState height="h-72" />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              {technicians.map((t, i) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default TechnicianCommissionTrend
