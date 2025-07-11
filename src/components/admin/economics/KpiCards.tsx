// src/components/admin/economics/KpiCards.tsx - UPPDATERAD med nya intäktslabels
import React from 'react'
import { TrendingUp, DollarSign, Users, BarChart3, AlertTriangle, Briefcase } from 'lucide-react'
import Card from '../../ui/Card'
import { useKpiData } from '../../../hooks/useEconomicsDashboard'
import { formatCurrency } from '../../../utils/formatters'

const KpiCards: React.FC = () => {
  const { data: kpiData, loading, error } = useKpiData()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-20 bg-slate-700 rounded"></div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Fel vid laddning av KPI data: {error}</span>
        </div>
      </Card>
    )
  }

  if (!kpiData) return null

  const kpiCards = [
    {
      title: 'Total ARR',
      value: formatCurrency(kpiData.total_arr),
      description: 'Årlig återkommande intäkt',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      trend: '+8.2%'
    },
    {
      title: 'MRR',
      value: formatCurrency(kpiData.monthly_recurring_revenue),
      description: 'Återkommande månatlig intäkt',
      icon: DollarSign,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      trend: '+5.4%'
    },
    {
      title: 'Aktiva Kunder',
      value: kpiData.active_customers.toString(),
      description: 'Kunder med aktiva avtal',
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      trend: '+3 nya'
    },
    {
      title: 'Merförsäljning Avtal (YTD)', // 🆕 Uppdaterat namn
      value: formatCurrency(kpiData.total_case_revenue_ytd),
      description: 'Extra intäkter från avtalskunder', // 🆕 Uppdaterad beskrivning
      icon: BarChart3,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/20',
      trend: '+12.1%'
    },
    {
      title: 'Intäkter Engångsjobb (YTD)', // 🆕 Uppdaterat namn
      value: formatCurrency(kpiData.total_begone_revenue_ytd),
      description: 'Intäkter från engångskunder', // 🆕 Uppdaterad beskrivning
      icon: Briefcase,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      trend: `${kpiData.total_begone_revenue_ytd > 0 ? '+' : ''}${((kpiData.total_begone_revenue_ytd / Math.max(kpiData.total_case_revenue_ytd, 1)) * 100).toFixed(1)}%`
    },
    {
      title: 'Churn Risk',
      value: kpiData.churn_risk_customers.toString(),
      description: 'Kunder med utgående avtal inom 90 dagar',
      icon: AlertTriangle,
      color: kpiData.churn_risk_customers > 5 ? 'text-red-500' : 'text-yellow-500',
      bgColor: kpiData.churn_risk_customers > 5 ? 'bg-red-500/20' : 'bg-yellow-500/20',
      trend: kpiData.churn_risk_customers > 0 ? 'Kräver åtgärd' : 'Inga risker'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {kpiCards.map((card, index) => {
        const IconComponent = card.icon
        
        return (
          <Card key={index} className="relative overflow-hidden">
            <div className="p-6">
              {/* Icon och trend */}
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <IconComponent className={`w-5 h-5 ${card.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {card.trend}
                </span>
              </div>
              
              {/* Värde */}
              <div className="mb-2">
                <p className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </p>
              </div>
              
              {/* Titel och beskrivning */}
              <div>
                <p className="text-sm font-medium text-white mb-1">
                  {card.title}
                </p>
                <p className="text-xs text-slate-400">
                  {card.description}
                </p>
              </div>
            </div>
            
            {/* Gradient overlay */}
            <div className={`absolute inset-0 ${card.bgColor} opacity-5 pointer-events-none`} />
          </Card>
        )
      })}
    </div>
  )
}

export default KpiCards