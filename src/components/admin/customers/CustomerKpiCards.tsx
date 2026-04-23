// src/components/admin/customers/CustomerKpiCards.tsx - KPI-kort i ekonomi-stil (kompakt, brand-green)

import React from 'react'
import {
  Coins, Users, AlertTriangle,
  Activity, Info
} from 'lucide-react'
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

function healthValueColor(score: number) {
  if (score >= 70) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function churnValueColor(count: number) {
  if (count > 5) return 'text-red-400'
  if (count > 2) return 'text-yellow-400'
  return 'text-emerald-400'
}

export default function CustomerKpiCards({ analytics }: KpiCardsProps) {
  const activePct = analytics.totalCustomers > 0
    ? Math.round((analytics.activeCustomers / analytics.totalCustomers) * 100)
    : 0

  const cards = [
    {
      title: 'Totalt Portföljvärde',
      value: formatCurrency(analytics.portfolioValue),
      subtitle: `${analytics.totalCustomers} kunder totalt`,
      icon: Coins,
      valueClass: 'text-white',
      trend: analytics.monthlyGrowth > 0
        ? { value: `+${analytics.monthlyGrowth.toFixed(1)}%`, label: 'denna månad' }
        : null,
      tooltip: `Total summa av alla aktiva kontraktsvärden\n\nBeräkning:\nSumman av alla kunders total_contract_value`,
    },
    {
      title: 'Aktiva Kunder',
      value: analytics.activeCustomers.toString(),
      subtitle: `${activePct}% av totalt`,
      icon: Users,
      valueClass: 'text-white',
      tooltip: `Kunder med aktiva eller signerade kontrakt\n\nInkluderar:\n• Status = 'active'\n• Status = 'signed'\n\nExkluderar utgångna och uppsagda kontrakt`,
    },
    {
      title: 'Health Score',
      value: Math.round(analytics.averageHealthScore).toString(),
      subtitle: '/100 genomsnitt',
      icon: Activity,
      valueClass: healthValueColor(analytics.averageHealthScore),
      tooltip: `Genomsnittlig Health Score för alla kunder\n\nBeräknas från:\n• Kontraktsålder (25%)\n• Kommunikationsfrekvens (25%)\n• Supportärenden (25%)\n• Betalningshistorik (25%)\n\nScore nivåer:\n• 80-100: Excellent (Grön)\n• 60-79: Good (Gul)\n• 40-59: Fair (Orange)\n• 0-39: Poor (Röd)`,
    },
    {
      title: 'Churn Risk',
      value: analytics.highRiskCount.toString(),
      subtitle: 'Kunder i riskzonen',
      icon: AlertTriangle,
      valueClass: churnValueColor(analytics.highRiskCount),
      tooltip: `Antal kunder med hög risk att säga upp\n\nRiskfaktorer:\n• Kontrakt löper ut inom 30 dagar\n• Låg Health Score (<40)\n• Lågt kontraktsvärde\n• Ingen tidigare förnyelse\n\nÅtgärd: Kontakta dessa kunder omgående\nför att diskutera förnyelse och adressera\neventuella problem.`,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.title}
            className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl flex items-start gap-3"
          >
            <div className="p-2.5 rounded-xl bg-[#20c58f]/10 text-[#20c58f] shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide truncate">
                  {kpi.title}
                </p>
                <TooltipWrapper content={kpi.tooltip} position="bottom">
                  <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-help shrink-0" />
                </TooltipWrapper>
              </div>
              <p className={`text-2xl font-semibold mb-0.5 ${kpi.valueClass}`}>
                {kpi.value}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 truncate">
                  {kpi.subtitle}
                </p>
                {kpi.trend && (
                  <span className="text-xs text-[#20c58f] shrink-0">
                    {kpi.trend.value}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
