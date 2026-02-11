// 📁 src/components/admin/economics/KpiCards.tsx - MODERNA KPI CARDS
import React from 'react'
import { TrendingUp, Banknote, Users, BarChart3, AlertTriangle, Briefcase, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useKpiData } from '../../../hooks/useEconomicsDashboard'
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
  const { data: kpiData, loading, error } = useKpiData()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-slate-700 rounded mb-3"></div>
            <div className="h-8 bg-slate-700 rounded mb-2"></div>
            <div className="h-3 bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av KPI data: {error}</span>
        </div>
      </div>
    )
  }

  if (!kpiData) return null

  // Skapa KPI kort data med BeGone design standards
  const kpiCards: KpiCardData[] = [
    {
      id: 'arr',
      title: 'Total ARR',
      value: formatCurrency(kpiData.total_arr),
      description: 'Årlig återkommande intäkt',
      icon: TrendingUp,
      color: 'green',
      trend: {
        value: '8.2%',
        direction: 'up',
        positive: true
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
        value: '5.4%',
        direction: 'up',
        positive: true
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
        value: '3 nya',
        direction: 'up',
        positive: true
      }
    },
    {
      id: 'upselling',
      title: 'Merförsäljning',
      value: formatCurrency(kpiData.total_case_revenue_ytd),
      description: 'Extra intäkter från avtalskunder',
      icon: BarChart3,
      color: 'green',
      trend: {
        value: '12.1%',
        direction: 'up',
        positive: true
      },
      badge: 'YTD'
    },
    {
      id: 'begone',
      title: 'Intäkter Engångsjobb',
      value: formatCurrency(kpiData.total_begone_revenue_ytd),
      description: 'Intäkter från engångskunder',
      icon: Briefcase,
      color: 'green',
      trend: {
        value: `${((kpiData.total_begone_revenue_ytd / Math.max(kpiData.total_case_revenue_ytd, 1)) * 100).toFixed(1)}%`,
        direction: kpiData.total_begone_revenue_ytd > kpiData.total_case_revenue_ytd ? 'up' : 'down',
        positive: kpiData.total_begone_revenue_ytd > 0
      },
      badge: 'YTD'
    },
    {
      id: 'churn',
      title: 'Churn Risk',
      value: kpiData.churn_risk_customers.toString(),
      description: 'Kunder med utgående avtal inom 90 dagar',
      icon: AlertTriangle,
      color: kpiData.churn_risk_customers > 5 ? 'red' : 'yellow',
      trend: {
        value: kpiData.churn_risk_customers > 0 ? 'Kräver åtgärd' : 'Inga risker',
        direction: kpiData.churn_risk_customers > 5 ? 'up' : 'neutral',
        positive: kpiData.churn_risk_customers === 0
      },
      warning: kpiData.churn_risk_customers > 5
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiCards.map((card) => (
        <BeGoneKpiCard key={card.id} {...card} />
      ))}
    </div>
  )
}

// BeGone Standard KPI Card Component
const BeGoneKpiCard: React.FC<KpiCardData> = ({
  title,
  value,
  description,
  icon: IconComponent,
  color,
  trend,
  badge,
  warning
}) => {
  const getTrendIcon = () => {
    if (!trend) return null
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" />
      case 'down':
        return <TrendingUp className="w-3 h-3 rotate-180" />
      default:
        return <Minus className="w-3 h-3" />
    }
  }

  const getTrendColor = () => {
    if (!trend) return 'text-slate-400'
    
    if (trend.positive) {
      return 'text-green-400'
    } else if (trend.direction === 'down') {
      return 'text-red-400'
    } else {
      return 'text-yellow-400'
    }
  }

  const getIconColor = () => {
    switch (color) {
      case 'green':
        return 'text-green-400'
      case 'yellow':
        return 'text-yellow-400'
      case 'purple':
        return 'text-purple-400'
      case 'blue':
        return 'text-blue-400'
      case 'red':
        return 'text-red-400'
      default:
        return 'text-slate-400'
    }
  }

  const getIconBackground = () => {
    switch (color) {
      case 'green':
        return 'bg-green-500/20'
      case 'yellow':
        return 'bg-yellow-500/20'
      case 'purple':
        return 'bg-purple-500/20'
      case 'blue':
        return 'bg-blue-500/20'
      case 'red':
        return 'bg-red-500/20'
      default:
        return 'bg-slate-500/20'
    }
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors duration-200">
      {/* Header with icon and top-right indicators */}
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${getIconBackground()}`}>
          <IconComponent className={`w-5 h-5 ${getIconColor()}`} />
        </div>
        
        <div className="flex items-center gap-2">
          {badge && (
            <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-medium">
              {badge}
            </span>
          )}
          
          {warning && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          )}
        </div>
      </div>

      {/* Main value */}
      <div className="mb-2">
        <p className="text-2xl font-bold text-white">
          {value}
        </p>
      </div>

      {/* Title and description */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-slate-300 mb-1">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>

      {/* Trend indicator at bottom */}
      {trend && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          trend.positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {getTrendIcon()}
          <span>{trend.value.includes('%') ? (trend.value.includes('-') ? '' : '+') : ''}{trend.value}</span>
        </div>
      )}
    </div>
  )
}

export default KpiCards