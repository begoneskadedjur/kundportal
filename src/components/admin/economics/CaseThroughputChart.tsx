import React from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Activity } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useCaseThroughput } from '../../../hooks/useEconomicsV2'
import { formatMonth } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-semibold text-slate-200 mb-2">{label}</p>
      <div className="flex justify-between text-xs gap-4 mb-0.5">
        <span className="text-slate-400">Avslutade</span>
        <span className="text-slate-200 font-medium">{d.cases_completed} st</span>
      </div>
      <div className="flex justify-between text-xs gap-4">
        <span className="text-slate-400">Snitt genomströmning</span>
        <span className="text-slate-200 font-medium">{d.avg_days.toFixed(1)} dgr</span>
      </div>
    </div>
  )
}

const CaseThroughputChart: React.FC = () => {
  const { monthsInPeriod } = useEconomicsPeriod()
  const { data, loading } = useCaseThroughput(Math.max(monthsInPeriod, 6))

  const chartData = (data || []).map(p => ({
    ...p,
    month: formatMonth(p.month),
  }))

  const hasAny = chartData.some(p => p.cases_completed > 0)

  return (
    <SectionCard
      title="Ärendegenomströmning"
      subtitle="Genomsnittlig tid från skapat till avslutat per månad"
      icon={<Activity className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-60 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !hasAny ? (
        <EmptyChartState height="h-60" />
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}d`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar yAxisId="left" dataKey="cases_completed" name="Avslutade" fill="#20c58f" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_days"
                name="Snitt dagar"
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

export default CaseThroughputChart
