import React from 'react'
import { AlertTriangle, Clock, Shield } from 'lucide-react'
import { useExpiringContracts } from '../../../hooks/useEconomicsDashboard'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)

const ChurnRiskSection: React.FC = () => {
  const { data: contracts, loading } = useExpiringContracts()

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-40 mb-4"></div>
        <div className="h-20 bg-slate-700/30 rounded"></div>
      </div>
    )
  }

  const highRisk = contracts.filter(c => c.risk_level === 'high')
  const mediumRisk = contracts.filter(c => c.risk_level === 'medium')
  const lowRisk = contracts.filter(c => c.risk_level === 'low')
  const totalAtRisk = contracts.reduce((sum, c) => sum + c.annual_value, 0)

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          Churn & Avtalsrisk
        </h3>
        {totalAtRisk > 0 && (
          <span className="text-xs text-yellow-400 font-medium">{formatCurrency(totalAtRisk)} ARR i riskzon</span>
        )}
      </div>

      {contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Shield className="w-8 h-8 mb-2 text-green-400/50" />
          <p className="text-sm text-green-400">Inga avtal i riskzonen</p>
          <p className="text-xs text-slate-500 mt-1">Alla avtal har mer än 3 månader kvar</p>
        </div>
      ) : (
        <>
          {/* Risk summary badges */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 font-bold text-lg">{highRisk.length}</p>
              <p className="text-red-300/70 text-[10px]">Hög risk</p>
            </div>
            <div className="text-center p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 font-bold text-lg">{mediumRisk.length}</p>
              <p className="text-yellow-300/70 text-[10px]">Medium</p>
            </div>
            <div className="text-center p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 font-bold text-lg">{lowRisk.length}</p>
              <p className="text-green-300/70 text-[10px]">Låg risk</p>
            </div>
          </div>

          {/* High risk customer list */}
          {highRisk.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-red-400 flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3" />
                Kräver omedelbar uppmärksamhet
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {highRisk.slice(0, 5).map(contract => (
                  <div key={contract.customer_id} className="flex items-center justify-between text-xs px-2.5 py-2 bg-red-500/5 border border-red-500/15 rounded-lg">
                    <span className="text-white font-medium truncate max-w-[140px]">{contract.company_name}</span>
                    <span className="text-red-400 flex-shrink-0">{contract.months_remaining} mån</span>
                    <span className="text-slate-400 flex-shrink-0">{formatCurrency(contract.annual_value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ChurnRiskSection
