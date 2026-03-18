import { COMMISSION_STATUS_CONFIG, type CommissionStatus } from '../../../types/provision'

interface ProvisionStatusBadgeProps {
  status: CommissionStatus
  size?: 'sm' | 'md'
}

export default function ProvisionStatusBadge({ status, size = 'sm' }: ProvisionStatusBadgeProps) {
  const config = COMMISSION_STATUS_CONFIG[status]

  return (
    <span className={`
      inline-flex items-center gap-1 rounded-full border font-medium
      ${config.bgClass} ${config.textClass}
      ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'pending_invoice' ? 'bg-yellow-400' :
        status === 'ready_for_payout' ? 'bg-emerald-400' :
        status === 'approved' ? 'bg-blue-400' :
        'bg-slate-400'
      }`} />
      {config.label}
    </span>
  )
}
