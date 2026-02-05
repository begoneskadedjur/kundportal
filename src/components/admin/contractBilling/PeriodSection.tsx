// src/components/admin/contractBilling/PeriodSection.tsx
// Expanderbar periodsektion i pipeline-vyn

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BillingPeriodSummary, ContractInvoice } from '../../../types/contractBilling'
import { BILLING_ITEM_STATUS_CONFIG, formatBillingAmount } from '../../../types/contractBilling'
import { CustomerInvoiceCard } from './CustomerInvoiceCard'

interface PeriodSectionProps {
  period: BillingPeriodSummary
  isExpanded: boolean
  onToggle: () => void
  onCustomerClick: (invoice: ContractInvoice) => void
  selectedInvoiceKeys: Set<string>
  onToggleSelection: (key: string) => void
  onSelectAll: (period: BillingPeriodSummary, selected: boolean) => void
}

function getInvoiceKey(invoice: ContractInvoice): string {
  return `${invoice.customer_id}::${invoice.period_start}::${invoice.period_end}`
}

export function PeriodSection({
  period,
  isExpanded,
  onToggle,
  onCustomerClick,
  selectedInvoiceKeys,
  onToggleSelection,
  onSelectAll
}: PeriodSectionProps) {
  const allKeys = period.invoices.map(getInvoiceKey)
  const allSelected = allKeys.length > 0 && allKeys.every(k => selectedInvoiceKeys.has(k))
  const someSelected = allKeys.some(k => selectedInvoiceKeys.has(k))

  // Status-dots för headern
  const statusDots = (['pending', 'approved', 'invoiced', 'paid'] as const).filter(
    s => period.status_breakdown[s] > 0
  )

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        {/* Expand/collapse ikon */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}

        {/* Period-label */}
        <span className="text-white font-medium text-sm">{period.period_label}</span>

        {/* Status-dots */}
        <div className="flex items-center gap-1.5">
          {statusDots.map(status => {
            const config = BILLING_ITEM_STATUS_CONFIG[status]
            return (
              <span
                key={status}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${config.bgColor} ${config.color}`}
              >
                {period.status_breakdown[status]}
              </span>
            )
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Kundantal */}
        <span className="text-xs text-slate-400">
          {period.customer_count} {period.customer_count === 1 ? 'kund' : 'kunder'}
        </span>

        {/* Artikelantal */}
        <span className="text-xs text-slate-500">
          {period.item_count} artiklar
        </span>

        {/* Totalbelopp */}
        <span className="text-white font-medium text-sm">
          {formatBillingAmount(period.total_amount)}
        </span>
      </button>

      {/* Expanderbar body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Markera alla */}
            <div className="px-4 py-1.5 bg-slate-900/30 border-t border-slate-700/50 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected
                }}
                onChange={(e) => onSelectAll(period, e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500"
              />
              <span className="text-xs text-slate-500">Markera alla i perioden</span>
            </div>

            {/* Kundkort */}
            <div>
              {period.invoices.map(invoice => (
                <CustomerInvoiceCard
                  key={getInvoiceKey(invoice)}
                  invoice={invoice}
                  isSelected={selectedInvoiceKeys.has(getInvoiceKey(invoice))}
                  onToggleSelection={() => onToggleSelection(getInvoiceKey(invoice))}
                  onClick={() => onCustomerClick(invoice)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
