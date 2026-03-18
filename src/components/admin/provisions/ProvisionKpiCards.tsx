import { Clock, CheckCircle, ThumbsUp, Wallet } from 'lucide-react'
import type { ProvisionKpi } from '../../../types/provision'

interface ProvisionKpiCardsProps {
  kpis: ProvisionKpi
  loading?: boolean
}

const formatCurrency = (amount: number) =>
  amount.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr'

export default function ProvisionKpiCards({ kpis, loading }: ProvisionKpiCardsProps) {
  const cards = [
    {
      label: 'Väntar på betalning',
      value: formatCurrency(kpis.pending_invoice_total),
      count: kpis.pending_invoice_count,
      icon: Clock,
      color: 'yellow',
      bgClass: 'bg-yellow-500/10 border-yellow-500/20',
      iconClass: 'text-yellow-400',
    },
    {
      label: 'Redo för utbetalning',
      value: formatCurrency(kpis.ready_for_payout_total),
      count: kpis.ready_for_payout_count,
      icon: CheckCircle,
      color: 'green',
      bgClass: 'bg-emerald-500/10 border-emerald-500/20',
      iconClass: 'text-emerald-400',
    },
    {
      label: 'Godkänd',
      value: formatCurrency(kpis.approved_total),
      count: kpis.approved_count,
      icon: ThumbsUp,
      color: 'blue',
      bgClass: 'bg-blue-500/10 border-blue-500/20',
      iconClass: 'text-blue-400',
    },
    {
      label: 'Utbetald',
      value: formatCurrency(kpis.paid_out_total),
      count: kpis.paid_out_count,
      icon: Wallet,
      color: 'slate',
      bgClass: 'bg-slate-500/10 border-slate-500/20',
      iconClass: 'text-slate-400',
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 animate-pulse">
            <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
            <div className="h-7 w-20 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className={`p-4 rounded-xl border ${card.bgClass}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">{card.label}</span>
            <card.icon className={`w-4 h-4 ${card.iconClass}`} />
          </div>
          <div className="text-lg font-bold text-white">{card.value}</div>
          <div className="text-xs text-slate-500">{card.count} poster</div>
        </div>
      ))}
    </div>
  )
}
