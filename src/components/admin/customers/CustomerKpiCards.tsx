// src/components/admin/customers/CustomerKpiCards.tsx - KPI-kort med tooltips för Success Management

import React from 'react'
import {
  DollarSign, Users, AlertTriangle,
  Activity, Info
} from 'lucide-react'
import Card from '../../ui/Card'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { formatCurrency } from '../../../utils/customerMetrics'

interface KpiCardsProps {
  analytics: {
    totalCustomers: number
    activeCustomers: number
    portfolioValue: number
    renewalValue90Days: number
    averageContractValue: number
    averageHealthScore: number
    highRiskCount: number
    netRevenueRetention: number
    monthlyGrowth: number
  }
}

export default function CustomerKpiCards({ analytics }: KpiCardsProps) {
  const kpiCards = [
    {
      title: 'Totalt Portföljvärde',
      value: formatCurrency(analytics.portfolioValue),
      subtitle: `${analytics.totalCustomers} kunder totalt`,
      icon: DollarSign,
      color: 'from-green-500/10 to-green-600/5 border-green-500/20',
      iconColor: 'text-green-500',
      trend: analytics.monthlyGrowth > 0 ? {
        value: `+${analytics.monthlyGrowth.toFixed(1)}%`,
        label: 'denna månad'
      } : null,
      tooltip: `Total summa av alla aktiva kontraktsvärden

Beräkning:
Summan av alla kunders total_contract_value`
    },
    {
      title: 'Aktiva Kunder',
      value: analytics.activeCustomers.toString(),
      subtitle: `${((analytics.activeCustomers / analytics.totalCustomers) * 100).toFixed(0)}% av totalt`,
      icon: Users,
      color: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
      iconColor: 'text-blue-500',
      tooltip: `Kunder med aktiva eller signerade kontrakt
      
Inkluderar:
• Status = 'active'
• Status = 'signed'

Exkluderar utgångna och uppsagda kontrakt`
    },
    {
      title: 'Health Score',
      value: Math.round(analytics.averageHealthScore).toString(),
      subtitle: '/100 genomsnitt',
      icon: Activity,
      color: analytics.averageHealthScore >= 70 
        ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20'
        : analytics.averageHealthScore >= 50
        ? 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20'
        : 'from-red-500/10 to-red-600/5 border-red-500/20',
      iconColor: analytics.averageHealthScore >= 70 
        ? 'text-emerald-500'
        : analytics.averageHealthScore >= 50
        ? 'text-yellow-500'
        : 'text-red-500',
      tooltip: `Genomsnittlig Health Score för alla kunder
      
Beräknas från:
• Kontraktsålder (25%)
• Kommunikationsfrekvens (25%)
• Supportärenden (25%)
• Betalningshistorik (25%)

Score nivåer:
• 80-100: Excellent (Grön)
• 60-79: Good (Gul)
• 40-59: Fair (Orange)
• 0-39: Poor (Röd)`
    },
    {
      title: 'Churn Risk',
      value: analytics.highRiskCount.toString(),
      subtitle: 'Kunder i riskzonen',
      icon: AlertTriangle,
      color: analytics.highRiskCount > 5
        ? 'from-red-500/10 to-red-600/5 border-red-500/20'
        : analytics.highRiskCount > 2
        ? 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20'
        : 'from-green-500/10 to-green-600/5 border-green-500/20',
      iconColor: analytics.highRiskCount > 5
        ? 'text-red-500'
        : analytics.highRiskCount > 2
        ? 'text-yellow-500'
        : 'text-green-500',
      warning: analytics.highRiskCount > 5,
      tooltip: `Antal kunder med hög risk att säga upp
      
Riskfaktorer:
• Kontrakt löper ut inom 30 dagar
• Låg Health Score (<40)
• Lågt kontraktsvärde
• Ingen tidigare förnyelse

Åtgärd: Kontakta dessa kunder omgående
för att diskutera förnyelse och adressera
eventuella problem.`
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {kpiCards.map((kpi, index) => (
        <Card 
          key={index} 
          className={`p-4 bg-gradient-to-br ${kpi.color} ${
            kpi.warning ? 'animate-pulse' : ''
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400">{kpi.title}</p>
              <TooltipWrapper content={kpi.tooltip} position="bottom">
                <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-help" />
              </TooltipWrapper>
            </div>
            <kpi.icon className={`w-6 h-6 ${kpi.iconColor} opacity-50`} />
          </div>
          
          <p className="text-2xl font-bold text-white mb-1">
            {kpi.value}
          </p>
          
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {kpi.subtitle}
            </p>
            {kpi.trend && (
              <span className="text-xs text-green-400">
                {kpi.trend.value}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}