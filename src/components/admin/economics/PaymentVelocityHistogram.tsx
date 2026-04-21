import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Gauge } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { usePaymentVelocity } from '../../../hooks/useEconomicsV2'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-200">{d.bucket}</p>
      <p className="text-xs text-slate-400">{d.count} betalningar</p>
    </div>
  )
}

const PaymentVelocityHistogram: React.FC = () => {
  const { monthsInPeriod } = useEconomicsPeriod()
  const { data, loading } = usePaymentVelocity(Math.max(monthsInPeriod, 6))

  const rows = data || []
  const hasAny = rows.some(r => r.count > 0)

  return (
    <SectionCard
      title="Betalningshastighet"
      subtitle="Dagar från faktura till betalning"
      icon={<Gauge className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !hasAny ? (
        <EmptyChartState height="h-48" message="Visas när fakturor betalas med paid_at-timestamp" />
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
              <Bar dataKey="count" fill="#20c58f" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default PaymentVelocityHistogram
