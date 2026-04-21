import React from 'react'
import { AlertTriangle, Clock, Shield } from 'lucide-react'
import { useExpiringContracts } from '../../../hooks/useEconomicsDashboard'
import { formatCurrency } from '../../../utils/formatters'
import SectionCard from './SectionCard'

const ChurnRiskSection: React.FC = () => {
  const { data: contracts, loading } = useExpiringContracts()

  const highRisk = (contracts || []).filter(c => c.risk_level === 'high')
  const mediumRisk = (contracts || []).filter(c => c.risk_level === 'medium')
  const lowRisk = (contracts || []).filter(c => c.risk_level === 'low')
  const totalAtRisk = (contracts || []).reduce((sum, c) => sum + c.annual_value, 0)

  return (
    <SectionCard
      title="Churn & avtalsrisk"
      subtitle={totalAtRisk > 0 ? `${formatCurrency(totalAtRisk)} ARR i riskzon` : 'Avtal som löper ut inom 90 dagar'}
      icon={<AlertTriangle className="w-4 h-4" />}
    >
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]" />
        </div>
      ) : !contracts || contracts.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-[#20c58f]/10 flex items-center justify-center mb-2">
            <Shield className="w-5 h-5 text-[#20c58f]" />
          </div>
          <p className="text-sm text-slate-300">Inga avtal i riskzonen</p>
          <p className="text-xs text-slate-500 mt-1">Alla avtal har mer än 3 månader kvar</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 font-bold text-lg leading-none">{highRisk.length}</p>
              <p className="text-red-300/70 text-[10px] mt-1">Hög risk</p>
            </div>
            <div className="text-center p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 font-bold text-lg leading-none">{mediumRisk.length}</p>
              <p className="text-amber-300/70 text-[10px] mt-1">Medium</p>
            </div>
            <div className="text-center p-2.5 bg-[#20c58f]/10 border border-[#20c58f]/20 rounded-lg">
              <p className="text-[#20c58f] font-bold text-lg leading-none">{lowRisk.length}</p>
              <p className="text-[#20c58f]/70 text-[10px] mt-1">Låg risk</p>
            </div>
          </div>

          {highRisk.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-red-400 flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3" />
                Kräver omedelbar uppmärksamhet
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {highRisk.slice(0, 5).map(contract => (
                  <div
                    key={contract.customer_id}
                    className="flex items-center justify-between text-xs px-2.5 py-2 bg-red-500/5 border border-red-500/15 rounded-lg"
                  >
                    <span className="text-slate-200 font-medium truncate max-w-[140px]">{contract.company_name}</span>
                    <span className="text-red-400 shrink-0">{contract.months_remaining} mån</span>
                    <span className="text-slate-400 shrink-0">{formatCurrency(contract.annual_value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

export default ChurnRiskSection
