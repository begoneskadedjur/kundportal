// 📁 src/components/admin/commissions/CommissionSummaryCards.tsx - 4 KPI-kort: Total provision, Antal ärenden, Aktiva tekniker, Genomsnitt
import React from 'react'
import { DollarSign, FileText, Users, TrendingUp, Info } from 'lucide-react'
import { formatCurrency } from '../../../services/commissionCalculations'
import type { CommissionKpi } from '../../../types/commission'

interface CommissionSummaryCardsProps {
  kpis: CommissionKpi
  loading?: boolean
  monthDisplay: string
}

const CommissionSummaryCards: React.FC<CommissionSummaryCardsProps> = ({
  kpis,
  loading = false,
  monthDisplay
}) => {
  const cards = [
    {
      id: 'total_commission',
      title: 'Total Provision',
      value: formatCurrency(kpis.total_commission),
      subtitle: `${monthDisplay}`,
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      iconColor: 'text-green-400',
      description: 'Sammanlagd provision för alla avslutade ärenden'
    },
    {
      id: 'total_cases',
      title: 'Antal Ärenden',
      value: kpis.total_cases.toString(),
      subtitle: `${kpis.total_cases} avslutade ärenden`,
      icon: FileText,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      iconColor: 'text-blue-400',
      description: 'Antal ärenden som genererat provision'
    },
    {
      id: 'active_technicians',
      title: 'Aktiva Tekniker',
      value: kpis.active_technicians.toString(),
      subtitle: `${kpis.active_technicians} tekniker med provision`,
      icon: Users,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      iconColor: 'text-purple-400',
      description: 'Tekniker som fått provision denna månad'
    },
    {
      id: 'avg_commission',
      title: 'Genomsnitt per Ärende',
      value: formatCurrency(kpis.avg_commission_per_case),
      subtitle: `⌀ ${formatCurrency(kpis.avg_commission_per_technician)} per tekniker`,
      icon: TrendingUp,
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      iconColor: 'text-orange-400',
      description: 'Genomsnittlig provision per ärende och tekniker'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-700 rounded-lg"></div>
              <div className="w-6 h-6 bg-slate-700 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="w-24 h-4 bg-slate-700 rounded"></div>
              <div className="w-32 h-8 bg-slate-700 rounded"></div>
              <div className="w-28 h-3 bg-slate-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => {
        const Icon = card.icon
        
        return (
          <div
            key={card.id}
            className={`
              ${card.bgColor} ${card.borderColor} border rounded-xl p-6
              hover:bg-opacity-20 transition-all duration-200
              group relative overflow-hidden
            `}
          >
            {/* Gradient overlay på hover */}
            <div className={`
              absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 
              group-hover:opacity-5 transition-opacity duration-300
            `} />
            
            {/* Header med ikon och info */}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className={`
                ${card.bgColor} ${card.borderColor} border rounded-lg p-3
                group-hover:scale-110 transition-transform duration-200
              `}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              
              {/* Info tooltip trigger */}
              <div className="group/tooltip relative">
                <Info className="w-4 h-4 text-slate-400 hover:text-slate-300 cursor-help" />
                
                {/* Tooltip */}
                <div className="
                  absolute right-0 top-6 w-64 p-3 bg-slate-900 border border-slate-700 
                  rounded-lg shadow-xl text-sm text-slate-300 opacity-0 invisible
                  group-hover/tooltip:opacity-100 group-hover/tooltip:visible
                  transition-all duration-200 z-50
                ">
                  {card.description}
                  <div className="absolute -top-1 right-3 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 rotate-45"></div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-sm font-medium text-slate-400 mb-2 relative z-10">
              {card.title}
            </h3>

            {/* Main value */}
            <p className="text-2xl font-bold text-white mb-1 relative z-10 group-hover:text-opacity-90">
              {card.value}
            </p>

            {/* Subtitle */}
            <p className="text-sm text-slate-400 relative z-10">
              {card.subtitle}
            </p>

            {/* Progress bar för visuell effekt */}
            {card.id === 'total_commission' && kpis.total_commission > 0 && (
              <div className="mt-4 relative z-10">
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${card.color} rounded-full transition-all duration-1000 delay-300`}
                    style={{ 
                      width: `${Math.min((kpis.total_commission / 50000) * 100, 100)}%` // Max 50k för full bar
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {kpis.total_commission >= 50000 ? 'Målet nått!' : `${Math.round((kpis.total_commission / 50000) * 100)}% av 50k målet`}
                </p>
              </div>
            )}

            {/* Activity indicator för tekniker-kort */}
            {card.id === 'active_technicians' && kpis.active_technicians > 0 && (
              <div className="mt-4 flex items-center space-x-1 relative z-10">
                {Array.from({ length: Math.min(kpis.active_technicians, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 ${card.bgColor} border ${card.borderColor} rounded-full`}
                    style={{
                      animationDelay: `${i * 100}ms`
                    }}
                  />
                ))}
                {kpis.active_technicians > 8 && (
                  <span className="text-xs text-slate-400 ml-2">
                    +{kpis.active_technicians - 8}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default CommissionSummaryCards