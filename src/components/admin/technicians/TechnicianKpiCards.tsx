import React from 'react'
import { Users, Banknote, TrendingUp, Target, AlertTriangle, Wrench } from 'lucide-react'
import { useTechnicianKpi } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency, formatNumber } from '../../../utils/formatters'

const colorMap: Record<string, { icon: string; bg: string }> = {
  green: { icon: 'text-green-400', bg: 'bg-green-500/20' },
  yellow: { icon: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  purple: { icon: 'text-purple-400', bg: 'bg-purple-500/20' },
  blue: { icon: 'text-blue-400', bg: 'bg-blue-500/20' },
}

const TechnicianKpiCards: React.FC = () => {
  const { data: kpiData, loading, error } = useTechnicianKpi()

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
          <span>Fel vid laddning av tekniker KPI: {error}</span>
        </div>
      </div>
    )
  }

  if (!kpiData) return null

  const kpiCards = [
    {
      title: 'Aktiva Tekniker',
      value: kpiData.active_technicians.toString(),
      description: `${kpiData.total_technicians} totalt registrerade`,
      icon: Users,
      color: 'blue',
      trend: kpiData.active_technicians === kpiData.total_technicians
        ? 'Alla aktiva'
        : `${kpiData.total_technicians - kpiData.active_technicians} inaktiva`
    },
    {
      title: 'Total Intäkt YTD',
      value: formatCurrency(kpiData.total_revenue_ytd),
      description: 'Alla avslutade ärenden i år',
      icon: Banknote,
      color: 'green',
      trend: `${formatNumber(kpiData.total_cases_ytd)} ärenden`,
      badge: 'YTD'
    },
    {
      title: 'Genomsnitt/Tekniker',
      value: formatCurrency(kpiData.avg_revenue_per_technician),
      description: 'Intäkt per aktiv tekniker YTD',
      icon: TrendingUp,
      color: 'purple',
      trend: `${formatNumber(kpiData.avg_cases_per_technician)} ärenden/tekniker`
    },
    {
      title: 'Genomsnitt/Ärende',
      value: formatCurrency(kpiData.avg_case_value_all),
      description: 'Alla avslutade ärenden YTD',
      icon: Target,
      color: 'yellow',
      trend: 'Över alla affärstyper'
    },
    {
      title: 'Totala Ärenden YTD',
      value: formatNumber(kpiData.total_cases_ytd),
      description: 'Avslutade ärenden i år',
      icon: Wrench,
      color: 'green',
      trend: kpiData.active_technicians > 0
        ? `${Math.round(kpiData.total_cases_ytd / kpiData.active_technicians)} per tekniker`
        : 'Ingen data',
      badge: 'YTD'
    },
    {
      title: 'Produktivitet',
      value: kpiData.active_technicians > 0 && kpiData.total_cases_ytd > 0
        ? `${Math.round((kpiData.total_cases_ytd / kpiData.active_technicians) * 12 / (new Date().getMonth() || 1))}`
        : '0',
      description: 'Uppskattat ärenden/år/tekniker',
      icon: TrendingUp,
      color: 'purple',
      trend: 'Baserat på YTD-trend'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiCards.map((card, index) => {
        const colors = colorMap[card.color] || colorMap.green
        return (
          <div
            key={index}
            className="bg-slate-800/50 rounded-2xl border border-slate-700/40 p-5 hover:border-slate-600 transition-colors duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <card.icon className={`w-4 h-4 ${colors.icon}`} />
              </div>
              {card.badge && (
                <span className="px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded text-[10px] font-medium uppercase tracking-wide">
                  {card.badge}
                </span>
              )}
            </div>

            <p className="text-xl font-bold text-white mb-1 font-mono">{card.value}</p>
            <h3 className="text-xs font-medium text-slate-300 mb-0.5">{card.title}</h3>
            <p className="text-[10px] text-slate-500 mb-3">{card.description}</p>

            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/15 text-slate-400">
              <span>{card.trend}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TechnicianKpiCards
