// src/components/admin/contractBilling/ContractBillingItemsTable.tsx
// Tabell för faktureringsrader

import { useState } from 'react'
import {
  Check,
  X,
  FileText,
  MoreHorizontal,
  Building2,
  CheckCircle,
  Loader2
} from 'lucide-react'
import {
  ContractBillingItemWithRelations,
  ContractBillingItemStatus,
  BILLING_ITEM_STATUS_CONFIG,
  formatBillingAmount,
  formatBillingPeriod
} from '../../../types/contractBilling'

interface ContractBillingItemsTableProps {
  items: ContractBillingItemWithRelations[]
  loading: boolean
  selectedIds: string[]
  onSelectItem: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onStatusChange: (id: string, status: ContractBillingItemStatus) => void
}

export function ContractBillingItemsTable({
  items,
  loading,
  selectedIds,
  onSelectItem,
  onSelectAll,
  onStatusChange
}: ContractBillingItemsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const allSelected = items.length > 0 && selectedIds.length === items.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length

  const handleStatusChange = async (id: string, status: ContractBillingItemStatus) => {
    setUpdatingId(id)
    await onStatusChange(id, status)
    setUpdatingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Inga faktureringsrader att visa</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="p-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                />
              </th>
              <th className="p-4 text-left text-sm font-medium text-slate-400">Kund</th>
              <th className="p-4 text-left text-sm font-medium text-slate-400">Artikel</th>
              <th className="p-4 text-left text-sm font-medium text-slate-400">Period</th>
              <th className="p-4 text-right text-sm font-medium text-slate-400">Belopp</th>
              <th className="p-4 text-center text-sm font-medium text-slate-400">Status</th>
              <th className="p-4 text-right text-sm font-medium text-slate-400">Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const statusConfig = BILLING_ITEM_STATUS_CONFIG[item.status]
              const isSelected = selectedIds.includes(item.id)
              const isUpdating = updatingId === item.id

              return (
                <tr
                  key={item.id}
                  className={`border-b border-slate-700/30 transition-colors ${
                    isSelected ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectItem(item.id, e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-700/50 rounded-lg">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {item.customer?.company_name || 'Okänd kund'}
                        </p>
                        {item.customer?.organization_number && (
                          <p className="text-xs text-slate-500">
                            {item.customer.organization_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{item.article_name}</p>
                      {item.article_code && (
                        <p className="text-xs text-slate-500 font-mono">{item.article_code}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-slate-300 text-sm">
                      {formatBillingPeriod(item.billing_period_start, item.billing_period_end)}
                    </p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="text-white font-medium">
                      {formatBillingAmount(item.total_price)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.vat_rate}% moms
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                      ) : (
                        <>
                          {item.status === 'pending' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'approved')}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                              title="Godkänn"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {item.status === 'approved' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'invoiced')}
                              className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded transition-colors"
                              title="Markera som fakturerad"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          {item.status === 'invoiced' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'paid')}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                              title="Markera som betald"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {item.status !== 'cancelled' && item.status !== 'paid' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'cancelled')}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Avbryt"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summering */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {selectedIds.length > 0 ? (
              <span>{selectedIds.length} av {items.length} valda</span>
            ) : (
              <span>Totalt {items.length} rader</span>
            )}
          </p>
          <p className="text-white font-medium">
            Summa: {formatBillingAmount(items.reduce((sum, item) => sum + item.total_price, 0))}
          </p>
        </div>
      </div>
    </div>
  )
}
