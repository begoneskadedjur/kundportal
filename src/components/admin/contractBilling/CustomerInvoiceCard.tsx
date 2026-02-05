// src/components/admin/contractBilling/CustomerInvoiceCard.tsx
// Kundrad i den grupperade fakturavyn

import { AlertCircle, Eye } from 'lucide-react'
import type { ContractInvoice } from '../../../types/contractBilling'
import { BILLING_ITEM_STATUS_CONFIG, formatBillingAmount } from '../../../types/contractBilling'

interface CustomerInvoiceCardProps {
  invoice: ContractInvoice
  isSelected: boolean
  onToggleSelection: () => void
  onClick: () => void
}

export function CustomerInvoiceCard({
  invoice,
  isSelected,
  onToggleSelection,
  onClick
}: CustomerInvoiceCardProps) {
  const statusConfig = BILLING_ITEM_STATUS_CONFIG[invoice.derived_status]
  const hasContract = invoice.items.some(i => i.item_type === 'contract')
  const hasAdHoc = invoice.items.some(i => i.item_type === 'ad_hoc')

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/30 transition-colors cursor-pointer border-b border-slate-700/30 last:border-b-0"
      onClick={onClick}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation()
          onToggleSelection()
        }}
        onClick={(e) => e.stopPropagation()}
        className="rounded border-slate-600 bg-slate-700 text-blue-500 flex-shrink-0"
      />

      {/* Kundnamn + org.nr */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">
          {invoice.customer.company_name}
        </div>
        {invoice.customer.organization_number && (
          <div className="text-xs text-slate-500">{invoice.customer.organization_number}</div>
        )}
      </div>

      {/* Artikelantal */}
      <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300 flex-shrink-0">
        {invoice.item_count} {invoice.item_count === 1 ? 'artikel' : 'artiklar'}
      </span>

      {/* Typ-badges */}
      <div className="flex gap-1 flex-shrink-0">
        {hasContract && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
            Löpande
          </span>
        )}
        {hasAdHoc && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
            Tillägg
          </span>
        )}
      </div>

      {/* Totalbelopp */}
      <div className="text-right flex-shrink-0 w-24">
        <div className="text-white text-sm font-medium">{formatBillingAmount(invoice.subtotal)}</div>
        {invoice.has_discount && (
          <div className="text-xs text-orange-400">Rabatt</div>
        )}
      </div>

      {/* Status badge */}
      <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${statusConfig.bgColor} ${statusConfig.color}`}>
        {statusConfig.label}
      </span>

      {/* Varningsikon */}
      {invoice.has_items_requiring_approval && (
        <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" title="Kräver godkännande" />
      )}

      {/* Öppna detaljer */}
      <Eye className="w-4 h-4 text-slate-400 hover:text-white flex-shrink-0" />
    </div>
  )
}
