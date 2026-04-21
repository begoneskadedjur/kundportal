import React from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useMarginByMonth } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatMonth, formatCompactNumber, formatPercentage } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[200px]">
      <p className="text-xs font-semibold text-slate-200 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs mb-1 last:mb-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-400">{p.name}</span>
          </div>
          <span className="text-slate-200 font-medium">
            {p.dataKey === 'margin_percent'
              ? formatPercentage(Number(p.value || 0))
              : formatCurrency(Number(p.value || 0))}
          </span>
        </div>
      ))}
    </div>
  )
}

const MarginTrendChart: React.FC = () => {
  const { monthsInPeriod } = useEconomicsPeriod()
  const { data, loading } = useMarginByMonth(Math.max(monthsInPeriod, 6))

  const chartData = (data || []).map(p => ({
    month: formatMonth(p.month),
    Försäljning: p.revenue,
    Kostnad: p.cost,
    margin_percent: p.margin_percent,
  }))

  const hasAny = (data || []).some(p => p.revenue > 0 || p.cost > 0)

  return (
    <SectionCard
      title="Marginaltrend"
      subtitle="Försäljning vs intern kostnad per månad"
      icon={<TrendingUp className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !hasAny ? (
        <EmptyChartState height="h-64" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactNumber(v)} />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="Försäljning" fill="#20c58f" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="Kostnad" fill="#475569" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="margin_percent"
                name="Marginal %"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default MarginTrendChart
