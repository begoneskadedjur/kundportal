import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useRevenuePulse } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatMonth, formatCompactNumber } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const COLORS = {
  contract:  '#20c58f', // brand green
  adhoc:     '#38bdf8', // cyan
  private:   '#a78bfa', // lila
  business:  '#f59e0b', // orange
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const total = payload.reduce((s: number, p: any) => s + Number(p.value || 0), 0)
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-200 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-400">{p.name}</span>
          </div>
          <span className="text-slate-200 font-medium">{formatCurrency(Number(p.value || 0))}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
        <span className="text-slate-400">Totalt</span>
        <span className="text-white font-semibold">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

const RevenuePulseChart: React.FC = () => {
  const { monthsInPeriod } = useEconomicsPeriod()
  // hero: visa alltid upp till 12 mån bakåt men fäll ihop till period (max(months, 12))
  const months = Math.max(monthsInPeriod, 12)
  const { data, loading } = useRevenuePulse(months)

  const chartData = (data || []).map(p => ({
    month: formatMonth(p.month),
    Årspremie: p.contract_revenue,
    Merförsäljning: p.adhoc_revenue,
    'Engångsjobb privat': p.case_private_revenue,
    'Engångsjobb företag': p.case_business_revenue,
  }))

  const hasAny = (data || []).some(p => p.total_revenue > 0)

  return (
    <SectionCard
      title="Intäktspuls"
      subtitle="De fyra intäktsströmmarna över tid"
      icon={<Activity className="w-4 h-4" />}
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
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(COLORS).map(([key, color]) => (
                  <linearGradient key={key} id={`pulse-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Area type="monotone" dataKey="Årspremie"            stackId="1" stroke={COLORS.contract} fill="url(#pulse-contract)" strokeWidth={2} />
              <Area type="monotone" dataKey="Merförsäljning"       stackId="1" stroke={COLORS.adhoc}    fill="url(#pulse-adhoc)"    strokeWidth={2} />
              <Area type="monotone" dataKey="Engångsjobb privat"   stackId="1" stroke={COLORS.private}  fill="url(#pulse-private)"  strokeWidth={2} />
              <Area type="monotone" dataKey="Engångsjobb företag"  stackId="1" stroke={COLORS.business} fill="url(#pulse-business)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default RevenuePulseChart
