import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AlertOctagon } from 'lucide-react'
import { useOverdueAging } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatCompactNumber } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const BUCKET_COLORS: Record<string, string> = {
  '0-30':  '#f59e0b',
  '31-60': '#f97316',
  '61-90': '#ef4444',
  '90+':   '#b91c1c',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-200 mb-1">{label} dagar</p>
      <p className="text-xs text-slate-400">{d.count} fakturor</p>
      <p className="text-xs text-slate-200 font-medium">{formatCurrency(d.total)}</p>
    </div>
  )
}

const OverdueAgingChart: React.FC = () => {
  const { data, loading } = useOverdueAging()
  const rows = data || []
  const hasAny = rows.some(r => r.count > 0)
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <SectionCard
      title="Förfallna fakturor"
      subtitle={hasAny ? `Totalt ${formatCurrency(grandTotal)} utestående` : 'Inga förfallna fakturor'}
      icon={<AlertOctagon className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !hasAny ? (
        <div className="h-48 flex items-center justify-center text-center">
          <div>
            <div className="w-10 h-10 rounded-full bg-[#20c58f]/10 flex items-center justify-center mx-auto mb-2">
              <AlertOctagon className="w-5 h-5 text-[#20c58f]" />
            </div>
            <p className="text-sm text-slate-300">Alla fakturor i tid</p>
            <p className="text-xs text-slate-500 mt-1">Inga förfallna betalningar just nu</p>
          </div>
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={BUCKET_COLORS[r.bucket]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default OverdueAgingChart
