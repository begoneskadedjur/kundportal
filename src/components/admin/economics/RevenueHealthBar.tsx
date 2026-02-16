import React from 'react'
import { useRevenueHealth } from '../../../hooks/useEconomicsDashboard'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { REVENUE_COLORS, REVENUE_LABELS } from '../../../utils/revenueColors'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)

const RevenueHealthBar: React.FC = () => {
  const { dateRange } = useEconomicsPeriod()
  const { data, loading } = useRevenueHealth(dateRange)

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-32 mb-3"></div>
        <div className="h-6 bg-slate-700 rounded-full"></div>
      </div>
    )
  }

  if (!data || data.total_revenue === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-400 mb-2">Intäktsmix</h3>
        <p className="text-xs text-slate-500">Ingen intäktsdata för vald period</p>
      </div>
    )
  }

  const segments = [
    { key: 'contract' as const, percent: data.contract_percent, amount: data.contract_revenue },
    { key: 'case' as const, percent: data.case_percent, amount: data.case_revenue },
    { key: 'engangsjobb' as const, percent: data.begone_percent, amount: data.begone_revenue },
  ]

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">Intäktsmix</h3>
        <span className="text-xs text-slate-500">Totalt {formatCurrency(data.total_revenue)}</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-5 rounded-full overflow-hidden bg-slate-700/30 mb-3">
        {segments.map(seg => (
          seg.percent > 0 && (
            <div
              key={seg.key}
              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${Math.max(seg.percent, 2)}%`, backgroundColor: REVENUE_COLORS[seg.key] }}
            />
          )
        ))}
      </div>

      {/* Labels */}
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REVENUE_COLORS[seg.key] }} />
            <span className="text-slate-400">{REVENUE_LABELS[seg.key]}</span>
            <span className="text-white font-medium">{formatCurrency(seg.amount)}</span>
            <span className="text-slate-500">({seg.percent.toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RevenueHealthBar
