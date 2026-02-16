import React from 'react'
import { Wrench } from 'lucide-react'
import { useTechnicianRevenue } from '../../../hooks/useEconomicsDashboard'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)

const getInitials = (name: string): string => {
  const parts = name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const TechnicianRevenueSection: React.FC = () => {
  const { data: technicians, loading } = useTechnicianRevenue()
  const top8 = technicians.slice(0, 8)
  const maxRevenue = top8.length > 0 ? top8[0].total_revenue : 0

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-48 mb-4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-700/30 rounded mb-2"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-4">
        <Wrench className="w-4 h-4 text-[#20c58f]" />
        Intäkter per Tekniker
      </h3>

      {top8.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Wrench className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Ingen teknikerdata tillgänglig</p>
        </div>
      ) : (
        <div className="space-y-2">
          {top8.map((tech, i) => (
            <div key={tech.technician_name} className="group">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs text-slate-500 w-4 text-right font-mono">{i + 1}.</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-white">{getInitials(tech.technician_name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white font-medium truncate block">{tech.technician_name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] text-slate-500">{tech.cases_completed} ärenden</span>
                  <span className="text-xs text-[#20c58f] font-semibold w-20 text-right">{formatCurrency(tech.total_revenue)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-700/30 rounded-full overflow-hidden ml-[52px]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#20c58f]/60 to-[#20c58f]/30 transition-all duration-500"
                  style={{ width: maxRevenue > 0 ? `${(tech.total_revenue / maxRevenue) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TechnicianRevenueSection
