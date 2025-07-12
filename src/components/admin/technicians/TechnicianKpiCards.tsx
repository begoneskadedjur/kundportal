// 📁 src/components/admin/technicians/TechnicianKpiCards.tsx - KPI CARDS MED VERKLIG DATA
import React from 'react'
import { Users, DollarSign, TrendingUp, Target, AlertTriangle, Wrench } from 'lucide-react'
import Card from '../../ui/Card'
import { useTechnicianKpi } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency, formatNumber } from '../../../utils/formatters'

const TechnicianKpiCards: React.FC = () => {
  const { data: kpiData, loading, error } = useTechnicianKpi()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-24 bg-slate-700 rounded"></div>
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
          <span>Fel vid laddning av tekniker KPI: {error}</span>
        </div>
      </Card>
    )
  }

  if (!kpiData) return null

  const kpiCards = [
    {
      title: 'Aktiva Tekniker',
      value: kpiData.active_technicians.toString(),
      description: `${kpiData.total_technicians} totalt registrerade`,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      trend: kpiData.active_technicians === kpiData.total_technicians ? 'Alla aktiva' : `${kpiData.total_technicians - kpiData.active_technicians} inaktiva`
    },
    {
      title: 'Total Intäkt YTD',
      value: formatCurrency(kpiData.total_revenue_ytd),
      description: 'Alla avslutade ärenden i år',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      trend: `${formatNumber(kpiData.total_cases_ytd)} ärenden`
    },
    {
      title: 'Genomsnitt/Tekniker',
      value: formatCurrency(kpiData.avg_revenue_per_technician),
      description: 'Intäkt per aktiv tekniker YTD',
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      trend: `${formatNumber(kpiData.avg_cases_per_technician)} ärenden/tekniker`
    },
    {
      title: 'Genomsnitt/Ärende',
      value: formatCurrency(kpiData.avg_case_value_all),
      description: 'Alla avslutade ärenden YTD',
      icon: Target,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      trend: 'Över alla affärstyper'
    },
    {
      title: 'Totala Ärenden YTD',
      value: formatNumber(kpiData.total_cases_ytd),
      description: 'Avslutade ärenden i år',
      icon: Wrench,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/20',
      trend: kpiData.active_technicians > 0 
        ? `${Math.round(kpiData.total_cases_ytd / kpiData.active_technicians)} per tekniker`
        : 'Ingen data'
    },
    {
      title: 'Produktivitet',
      value: kpiData.active_technicians > 0 && kpiData.total_cases_ytd > 0
        ? `${Math.round((kpiData.total_cases_ytd / kpiData.active_technicians) * 12 / new Date().getMonth() || 1)}`
        : '0',
      description: 'Uppskattat ärenden/år/tekniker',
      icon: TrendingUp,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/20',
      trend: 'Baserat på YTD-trend'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {kpiCards.map((card, index) => (
        <Card 
          key={index} 
          className="relative overflow-hidden hover:scale-105 transition-transform duration-300"
        >
          <div className="p-6">
            {/* Icon */}
            <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center mb-4`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>

            {/* Värde */}
            <div className="mb-2">
              <h3 className="text-2xl font-bold text-white">{card.value}</h3>
              <p className="text-sm font-medium text-slate-300">{card.title}</p>
            </div>

            {/* Beskrivning */}
            <p className="text-xs text-slate-400 mb-2">{card.description}</p>

            {/* Trend */}
            <div className="flex items-center">
              <span className="text-xs text-slate-500">{card.trend}</span>
            </div>

            {/* Gradient overlay */}
            <div className={`absolute top-0 right-0 w-20 h-20 ${card.bgColor} rounded-full blur-2xl opacity-20 -translate-y-10 translate-x-10`}></div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default TechnicianKpiCards