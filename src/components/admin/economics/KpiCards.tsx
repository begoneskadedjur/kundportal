// 📁 src/components/admin/economics/KpiCards.tsx - MODERNA KPI CARDS
import React from 'react'
import { TrendingUp, DollarSign, Users, BarChart3, AlertTriangle, Briefcase, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import ModernCard from '../../ui/ModernCard'
import { useKpiData } from '../../../hooks/useEconomicsDashboard'
import { formatCurrency } from '../../../utils/formatters'

interface KpiCardData {
  id: string
  title: string
  value: string
  description: string
  icon: React.ComponentType<any>
  gradient: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow'
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
          <ModernCard key={i} className="animate-pulse">
            <div className="p-6">
              <div className="h-4 bg-slate-700 rounded mb-3"></div>
              <div className="h-8 bg-slate-700 rounded mb-2"></div>
              <div className="h-3 bg-slate-700 rounded"></div>
            </div>
          </ModernCard>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <ModernCard gradient="red" glowing className="p-6">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av KPI data: {error}</span>
        </div>
      </ModernCard>
    )
  }

  if (!kpiData) return null

  // Skapa KPI kort data med moderna properties
  const kpiCards: KpiCardData[] = [
    {
      id: 'arr',
      title: 'Total ARR',
      value: formatCurrency(kpiData.total_arr),
      description: 'Årlig återkommande intäkt',
      icon: TrendingUp,
      gradient: 'green',
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
      icon: DollarSign,
      gradient: 'blue',
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
      gradient: 'purple',
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
      gradient: 'yellow',
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
      gradient: 'orange',
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
      gradient: kpiData.churn_risk_customers > 5 ? 'red' : 'yellow',
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
        <ModernKpiCard key={card.id} {...card} />
      ))}
    </div>
  )
}

// Modern KPI Card Component
const ModernKpiCard: React.FC<KpiCardData> = ({
  title,
  value,
  description,
  icon: IconComponent,
  gradient,
  trend,
  badge,
  warning
}) => {
  const getTrendIcon = () => {
    if (!trend) return null
    
    switch (trend.direction) {
      case 'up':
        return <ArrowUp className="w-3 h-3" />
      case 'down':
        return <ArrowDown className="w-3 h-3" />
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

  return (
    <ModernCard 
      gradient={gradient} 
      glowing 
      hoverable
      className="group relative overflow-hidden"
    >
      <div className="p-4">
        {/* Header with icon and badge */}
        <div className="flex items-center justify-between mb-3">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            bg-gradient-to-r ${
              gradient === 'green' ? 'from-green-500 to-emerald-500' :
              gradient === 'blue' ? 'from-blue-500 to-cyan-500' :
              gradient === 'purple' ? 'from-purple-500 to-violet-500' :
              gradient === 'yellow' ? 'from-yellow-500 to-amber-500' :
              gradient === 'orange' ? 'from-orange-500 to-red-500' :
              'from-red-500 to-pink-500'
            }
            shadow-lg group-hover:scale-110 transition-transform duration-300
          `}>
            <IconComponent className="w-5 h-5 text-white" />
          </div>
          
          {badge && (
            <span className="px-2 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-white">
              {badge}
            </span>
          )}
          
          {warning && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          )}
        </div>

        {/* Main value */}
        <div className="mb-2">
          <h3 className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
            {value}
          </h3>
        </div>

        {/* Title and description */}
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-white/90 mb-1">
            {title}
          </h4>
          <p className="text-xs text-white/70 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Warning pulse effect */}
      {warning && (
        <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
      )}
    </ModernCard>
  )
}

export default KpiCards