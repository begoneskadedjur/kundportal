// src/components/admin/contractBilling/ContractBillingKpiCards.tsx
// KPI-kort för avtalsfakturering

import { Clock, CheckCircle, FileText, Banknote } from 'lucide-react'
import { formatBillingAmount } from '../../../types/contractBilling'

interface BillingStats {
  pending: { count: number; amount: number }
  approved: { count: number; amount: number }
  invoiced: { count: number; amount: number }
  paid: { count: number; amount: number }
}

interface ContractBillingKpiCardsProps {
  stats: BillingStats
  onFilterChange: (status: string | null) => void
  activeFilter: string | null
}

export function ContractBillingKpiCards({
  stats,
  onFilterChange,
  activeFilter
}: ContractBillingKpiCardsProps) {
  const cards = [
    {
      key: 'pending',
      label: 'Väntar',
      count: stats.pending.count,
      amount: stats.pending.amount,
      icon: Clock,
      color: 'yellow',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      iconColor: 'text-yellow-400'
    },
    {
      key: 'approved',
      label: 'Godkända',
      count: stats.approved.count,
      amount: stats.approved.amount,
      icon: CheckCircle,
      color: 'blue',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    {
      key: 'invoiced',
      label: 'Fakturerade',
      count: stats.invoiced.count,
      amount: stats.invoiced.amount,
      icon: FileText,
      color: 'purple',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400'
    },
    {
      key: 'paid',
      label: 'Betalda',
      count: stats.paid.count,
      amount: stats.paid.amount,
      icon: Banknote,
      color: 'emerald',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        const isActive = activeFilter === card.key

        return (
          <button
            key={card.key}
            onClick={() => onFilterChange(isActive ? null : card.key)}
            className={`p-4 rounded-xl border transition-all text-left ${
              isActive
                ? `${card.bgColor} ${card.borderColor} ring-2 ring-${card.color}-500/50`
                : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <span className={`text-2xl font-bold ${isActive ? card.iconColor : 'text-white'}`}>
                {card.count}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-1">{card.label}</p>
            <p className={`text-lg font-semibold ${isActive ? card.iconColor : 'text-white'}`}>
              {formatBillingAmount(card.amount)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
