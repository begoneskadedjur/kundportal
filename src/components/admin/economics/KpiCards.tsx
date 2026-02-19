import React from 'react'
import { TrendingUp, Banknote, Users, BarChart3, AlertTriangle, Briefcase, Minus } from 'lucide-react'
import { useKpiDataWithTrends } from '../../../hooks/useEconomicsDashboard'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'
import { formatCurrency } from '../../../utils/formatters'

interface KpiCardData {
  id: string
  title: string
  value: string
  description: string
  icon: React.ComponentType<any>
  color: string
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
    positive: boolean
  }
  badge?: string
  warning?: boolean
}

const KpiCards: React.FC = () => {
  const { dateRange, previousDateRange } = useEconomicsPeriod()
  const { data: kpiData, loading, error } = useKpiDataWithTrends(dateRange, previousDateRange)

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-slate-700 rounded mb-3 w-1/2"></div>
            <div className="h-7 bg-slate-700 rounded mb-2"></div>
            <div className="h-3 bg-slate-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av KPI data: {error}</span>
        </div>
      </div>
    )
  }

  if (!kpiData) return null

  const formatTrend = (value: number, suffix = '%') => {
    if (value === 0) return '0' + suffix
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}${suffix}`
  }

  const kpiCards: KpiCardData[] = [
    {
      id: 'arr',
      title: 'Total ARR',
      value: formatCurrency(kpiData.total_arr),
      description: 'Årlig återkommande intäkt',
      icon: TrendingUp,
      color: 'green',
      trend: {
        value: formatTrend(kpiData.trends.arr_change_percent),
        direction: kpiData.trends.arr_change_percent > 0 ? 'up' : kpiData.trends.arr_change_percent < 0 ? 'down' : 'neutral',
        positive: kpiData.trends.arr_change_percent >= 0
      },
      badge: 'Årlig'
    },
    {
      id: 'mrr',
      title: 'MRR',
      value: formatCurrency(kpiData.monthly_recurring_revenue),
      description: 'Återkommande månatlig intäkt',
      icon: Banknote,
      color: 'yellow',
      trend: {
        value: formatTrend(kpiData.trends.mrr_change_percent),
        direction: kpiData.trends.mrr_change_percent > 0 ? 'up' : kpiData.trends.mrr_change_percent < 0 ? 'down' : 'neutral',
        positive: kpiData.trends.mrr_change_percent >= 0
      },
      badge: 'Månatlig'
    },
    {
      id: 'customers',
      title: 'Aktiva Kunder',
      value: kpiData.active_customers.toString(),
      description: 'Kunder med aktiva avtal',
      icon: Users,
      color: 'green',
      trend: {
        value: kpiData.trends.customers_change !== 0
          ? `${kpiData.trends.customers_change > 0 ? '+' : ''}${kpiData.trends.customers_change} nya`
          : 'Oförändrat',
        direction: kpiData.trends.customers_change > 0 ? 'up' : kpiData.trends.customers_change < 0 ? 'down' : 'neutral',
        positive: kpiData.trends.customers_change >= 0
      }
    },
    {
      id: 'upselling',
      title: 'Merförsäljning',
      value: formatCurrency(kpiData.total_case_revenue_ytd),
      description: 'Extra intäkter från avtalskunder',
      icon: BarChart3,
      color: 'blue',
      trend: {
        value: formatTrend(kpiData.trends.case_revenue_change_percent),
        direction: kpiData.trends.case_revenue_change_percent > 0 ? 'up' : kpiData.trends.case_revenue_change_percent < 0 ? 'down' : 'neutral',
        positive: kpiData.trends.case_revenue_change_percent >= 0
      },
      badge: 'YTD'
    },
    {
      id: 'begone',
      title: 'Engångsjobb',
      value: formatCurrency(kpiData.total_begone_revenue_ytd),
      description: 'Intäkter från engångskunder',
      icon: Briefcase,
      color: 'purple',
      trend: {
        value: formatTrend(kpiData.trends.begone_revenue_change_percent),
        direction: kpiData.trends.begone_revenue_change_percent > 0 ? 'up' : kpiData.trends.begone_revenue_change_percent < 0 ? 'down' : 'neutral',
        positive: kpiData.trends.begone_revenue_change_percent >= 0
      },
      badge: 'YTD'
    },
    {
      id: 'churn',
      title: 'Churn Risk',
      value: kpiData.churn_risk_customers.toString(),
      description: 'Utgående avtal inom 90 dagar',
      icon: AlertTriangle,
      color: kpiData.churn_risk_customers > 5 ? 'red' : kpiData.churn_risk_customers > 0 ? 'yellow' : 'green',
      trend: {
        value: kpiData.churn_risk_customers > 0 ? 'Kräver åtgärd' : 'Inga risker',
        direction: kpiData.churn_risk_customers > 5 ? 'up' : 'neutral',
        positive: kpiData.churn_risk_customers === 0
      },
      warning: kpiData.churn_risk_customers > 5
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiCards.map((card) => (
        <KpiCard key={card.id} {...card} />
      ))}
    </div>
  )
}

const KpiCard: React.FC<KpiCardData> = ({
  title,
  value,
  description,
  icon: IconComponent,
  color,
  trend,
  badge,
  warning
}) => {
  const colorMap: Record<string, { icon: string; bg: string }> = {
    green: { icon: 'text-green-400', bg: 'bg-green-500/20' },
    yellow: { icon: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    purple: { icon: 'text-purple-400', bg: 'bg-purple-500/20' },
    blue: { icon: 'text-blue-400', bg: 'bg-blue-500/20' },
    red: { icon: 'text-red-400', bg: 'bg-red-500/20' },
  }
  const colors = colorMap[color] || colorMap.green

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/40 p-3 sm:p-5 hover:border-slate-600 transition-colors duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <IconComponent className={`w-4 h-4 ${colors.icon}`} />
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded text-[10px] font-medium uppercase tracking-wide">
              {badge}
            </span>
          )}
          {warning && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          )}
        </div>
      </div>

      <p className="text-lg sm:text-xl font-bold text-white mb-1 font-mono">{value}</p>
      <h3 className="text-xs font-medium text-slate-300 mb-0.5">{title}</h3>
      <p className="text-[10px] text-slate-500 mb-3">{description}</p>

      {trend && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
          trend.positive ? 'bg-green-500/15 text-green-400' :
          trend.direction === 'neutral' ? 'bg-slate-500/15 text-slate-400' :
          'bg-red-500/15 text-red-400'
        }`}>
          {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend.direction === 'down' && <TrendingUp className="w-3 h-3 rotate-180" />}
          {trend.direction === 'neutral' && <Minus className="w-3 h-3" />}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}

export default KpiCards
