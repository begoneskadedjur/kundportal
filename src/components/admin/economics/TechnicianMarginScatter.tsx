import React from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ZAxis,
} from 'recharts'
import { Users } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useTechnicianMarginScatter } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatPercentage } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[200px]">
      <p className="text-xs font-semibold text-slate-200 mb-1">{d.technician_name}</p>
      <div className="flex justify-between text-xs gap-4 mb-0.5">
        <span className="text-slate-400">Avslutade</span>
        <span className="text-slate-200 font-medium">{d.cases_completed} st</span>
      </div>
      <div className="flex justify-between text-xs gap-4 mb-0.5">
        <span className="text-slate-400">Marginal</span>
        <span className="text-slate-200 font-medium">{formatPercentage(d.avg_margin_percent)}</span>
      </div>
      <div className="flex justify-between text-xs gap-4">
        <span className="text-slate-400">Intäkt</span>
        <span className="text-slate-200 font-medium">{formatCurrency(d.total_revenue)}</span>
      </div>
    </div>
  )
}

const TechnicianMarginScatter: React.FC = () => {
  const { dateRange } = useEconomicsPeriod()
  const { data, loading } = useTechnicianMarginScatter(dateRange)

  const rows = data || []
  const hasAny = rows.length > 0

  return (
    <SectionCard
      title="Tekniker: volym vs marginal"
      subtitle="Antal ärenden mot genomsnittlig marginal senaste perioden"
      icon={<Users className="w-4 h-4" />}
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
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="cases_completed"
                name="Avslutade ärenden"
                stroke="#94a3b8"
                fontSize={11}
                label={{ value: 'Avslutade ärenden', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="avg_margin_percent"
                name="Marginal %"
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => `${Math.round(v)}%`}
                domain={[(min: number) => Math.min(0, Math.floor(min)), (max: number) => Math.ceil(max + 5)]}
              />
              <ZAxis type="number" dataKey="total_revenue" range={[50, 400]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#475569' }} />
              <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '20%', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
              <Scatter data={rows} fill="#20c58f" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default TechnicianMarginScatter
