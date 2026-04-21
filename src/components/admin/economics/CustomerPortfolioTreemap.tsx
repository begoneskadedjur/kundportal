import React from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { Building2 } from 'lucide-react'
import { useCustomerPortfolio } from '../../../hooks/useEconomicsV2'
import { formatCurrency, formatPercentage } from '../../../utils/formatters'
import SectionCard from './SectionCard'
import EmptyChartState from './EmptyChartState'

const colorForMargin = (pct: number | null): string => {
  if (pct == null || Number.isNaN(pct)) return '#475569' // slate-600 = okänd
  if (pct >= 40) return '#20c58f'
  if (pct >= 25) return '#22c55e'
  if (pct >= 15) return '#84cc16'
  if (pct >= 5)  return '#f59e0b'
  if (pct >= 0)  return '#f97316'
  return '#ef4444'
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[200px]">
      <p className="text-xs font-semibold text-slate-200 mb-1 truncate">{d.company_name}</p>
      <div className="flex justify-between text-xs gap-4 mb-0.5">
        <span className="text-slate-400">ARR</span>
        <span className="text-slate-200 font-medium">{formatCurrency(d.annual_value)}</span>
      </div>
      <div className="flex justify-between text-xs gap-4 mb-0.5">
        <span className="text-slate-400">Marginal</span>
        <span className="text-slate-200 font-medium">
          {d.case_count === 0 ? 'Ingen data' : formatPercentage(d.margin_percent)}
        </span>
      </div>
      <div className="flex justify-between text-xs gap-4">
        <span className="text-slate-400">Ärenden (12m)</span>
        <span className="text-slate-200 font-medium">{d.case_count}</span>
      </div>
    </div>
  )
}

const TreemapContent: React.FC<any> = (props) => {
  const { x, y, width, height, company_name, annual_value, margin_percent, case_count } = props
  if (width < 2 || height < 2) return null
  const fill = case_count > 0 ? colorForMargin(margin_percent) : '#334155'
  const showLabel = width > 80 && height > 40
  const showValue = width > 100 && height > 60
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: '#0f172a',
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 18}
          fill="#f1f5f9"
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {company_name.length > Math.floor(width / 7) ? company_name.slice(0, Math.floor(width / 7)) + '…' : company_name}
        </text>
      )}
      {showValue && (
        <text
          x={x + 8}
          y={y + 34}
          fill="#e2e8f0"
          fontSize={10}
          style={{ pointerEvents: 'none' }}
        >
          {formatCurrency(annual_value)}
        </text>
      )}
    </g>
  )
}

const LegendSwatch: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
    <span className="text-[10px] text-slate-400">{label}</span>
  </div>
)

const CustomerPortfolioTreemap: React.FC = () => {
  const { data, loading } = useCustomerPortfolio()
  const rows = (data || []).filter(r => r.annual_value > 0)

  return (
    <SectionCard
      title="Kundportfölj"
      subtitle="Storlek = ARR, färg = marginal senaste 12 mån"
      icon={<Building2 className="w-4 h-4" />}
      action={
        <div className="hidden lg:flex items-center gap-2">
          <LegendSwatch color="#20c58f" label="≥40%" />
          <LegendSwatch color="#22c55e" label="25-40%" />
          <LegendSwatch color="#84cc16" label="15-25%" />
          <LegendSwatch color="#f59e0b" label="5-15%" />
          <LegendSwatch color="#ef4444" label="<0%" />
          <LegendSwatch color="#334155" label="Ingen data" />
        </div>
      }
    >
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyChartState
          height="h-80"
          title="Inga aktiva kunder med ARR"
          message="Treemap visas när aktiva kunder har annual_value registrerat"
        />
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={rows}
              dataKey="annual_value"
              nameKey="company_name"
              aspectRatio={4 / 3}
              stroke="#0f172a"
              content={<TreemapContent />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

export default CustomerPortfolioTreemap
