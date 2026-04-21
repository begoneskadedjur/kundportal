import React from 'react'
import { Medal, AlertTriangle } from 'lucide-react'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { useServiceMarginRanking } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatPercentage } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'
import type { ServiceMarginRow } from '../../../services/economicsServiceV2'

const MarginBar: React.FC<{ row: ServiceMarginRow }> = ({ row }) => {
  const target = row.min_margin_percent ?? 20
  const aboveTarget = row.margin_percent >= target
  const barColor = aboveTarget ? '#20c58f' : '#ef4444'
  const pct = Math.max(0, Math.min(100, row.margin_percent))

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{row.service_name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {row.cases_count} ärenden · {formatCurrency(row.revenue)} intäkt
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-semibold ${aboveTarget ? 'text-[#20c58f]' : 'text-red-400'}`}>
            {formatPercentage(row.margin_percent)}
          </div>
          {row.min_margin_percent != null && (
            <div className="text-[10px] text-slate-500">mål {row.min_margin_percent}%</div>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
        {row.min_margin_percent != null && (
          <div
            className="absolute top-0 h-full w-px bg-slate-400/60"
            style={{ left: `${Math.min(100, target)}%` }}
          />
        )}
      </div>
    </div>
  )
}

const ServiceMarginRanking: React.FC = () => {
  const { dateRange } = useEconomicsPeriod()
  const { data, loading } = useServiceMarginRanking(dateRange)

  const rows = data || []
  const top = rows.slice(0, 5)
  const bottom = rows.slice(-5).reverse()

  return (
    <SectionCard
      title="Marginalranking per tjänst"
      subtitle="Topp 5 och botten 5 senaste perioden"
      icon={<Medal className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyChartState height="h-64" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-[#20c58f] uppercase tracking-wide mb-2">Topp 5</div>
            <div className="space-y-2">
              {top.map(r => <MarginBar key={r.service_id} row={r} />)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
              <AlertTriangle className="w-3 h-3" />
              Botten 5
            </div>
            <div className="space-y-2">
              {bottom.map(r => <MarginBar key={r.service_id} row={r} />)}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default ServiceMarginRanking
