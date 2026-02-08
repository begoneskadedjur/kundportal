// src/components/admin/contractBilling/CustomerPipelineRow.tsx
// Kundrad i den månatliga pipeline-vyn

import { AlertCircle, Eye } from 'lucide-react'
import type { MonthlyCustomerEntry } from '../../../types/contractBilling'
import { PIPELINE_STATUS_CONFIG, formatBillingAmount } from '../../../types/contractBilling'

interface CustomerPipelineRowProps {
  entry: MonthlyCustomerEntry
  isSelected: boolean
  onToggleSelection: () => void
  onClick: () => void
}

export function CustomerPipelineRow({
  entry,
  isSelected,
  onToggleSelection,
  onClick
}: CustomerPipelineRowProps) {
  const statusConfig = PIPELINE_STATUS_CONFIG[entry.status]
  const isProjected = entry.items.length === 0 && entry.total_amount > 0
  const hasContract = entry.items.some(i => i.item_type === 'contract')
  const hasAdHoc = entry.items.some(i => i.item_type === 'ad_hoc')
  const isNotBillable = entry.status === 'not_billable'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors border-b border-slate-700/30 last:border-b-0 ${
        isNotBillable
          ? 'opacity-50 hover:opacity-70 cursor-default'
          : 'hover:bg-slate-700/30 cursor-pointer'
      }`}
      onClick={isNotBillable ? undefined : onClick}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        disabled={isNotBillable}
        onChange={(e) => {
          e.stopPropagation()
          onToggleSelection()
        }}
        onClick={(e) => e.stopPropagation()}
        className="rounded border-slate-600 bg-slate-700 text-blue-500 flex-shrink-0 disabled:opacity-30"
      />

      {/* Kundnamn + org.nr */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">
          {entry.customer.company_name}
        </div>
        {entry.customer.organization_number && (
          <div className="text-xs text-slate-500">{entry.customer.organization_number}</div>
        )}
      </div>

      {/* Artikelantal (om items finns) */}
      {entry.item_count > 0 && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300 flex-shrink-0">
          {entry.item_count} {entry.item_count === 1 ? 'artikel' : 'artiklar'}
        </span>
      )}

      {/* Typ-badges (bara om items finns) */}
      {entry.items.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {hasContract && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
              Lopande
            </span>
          )}
          {hasAdHoc && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
              Tillagg
            </span>
          )}
        </div>
      )}

      {/* Belopp */}
      <div className="text-right flex-shrink-0 w-24">
        <div className={`text-sm font-medium ${isProjected ? 'text-slate-400 italic' : 'text-white'}`}>
          {entry.total_amount > 0 ? formatBillingAmount(entry.total_amount) : '-'}
        </div>
        {isProjected && entry.total_amount > 0 && (
          <div className="text-xs text-slate-500">projicerat</div>
        )}
      </div>

      {/* Status badge */}
      <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${statusConfig.bgColor} ${statusConfig.color}`}>
        {statusConfig.label}
      </span>

      {/* Varningsikon */}
      {entry.has_items_requiring_approval && (
        <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" title="Kraver godkannande" />
      )}

      {/* Detalj-ikon (bara om klickbar) */}
      {!isNotBillable && (
        <Eye className="w-4 h-4 text-slate-400 hover:text-white flex-shrink-0" />
      )}
    </div>
  )
}
