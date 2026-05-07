// src/components/admin/customers/ContractDetailRow.tsx
// Multi-kontrakt-refaktor (Fas 5): kompakt rad som visar ett kontrakt med
// adress som primär identifierare, avtalsperiod, årsvärde och contract_type-badge.
// Används i SingleCustomerDetailModal när en kund har flera Oneflow-avtal.

import { MapPin, FileSignature, Receipt } from 'lucide-react'
import type { ContractWithBilling } from '../../../types/database'

interface ContractDetailRowProps {
  contract: ContractWithBilling
  onOpenBillingSettings?: (contractId: string) => void
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount || amount <= 0) return 'Avropsavtal'
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ContractDetailRow({ contract, onOpenBillingSettings }: ContractDetailRowProps) {
  const label = contract.address_label || contract.contact_address || contract.agreement_text || 'Okänt avtal'
  const period = contract.contract_start_date || contract.contract_end_date
    ? `${formatDate(contract.contract_start_date)} → ${formatDate(contract.contract_end_date)}`
    : '—'

  return (
    <div className="px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-slate-200 truncate">{label}</span>
              {contract.contract_type && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#20c58f]/15 border border-[#20c58f]/30 text-[#20c58f] rounded-full shrink-0">
                  {contract.contract_type}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span>{period}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{formatCurrency(contract.annual_value)}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500 font-mono text-[10px]">#{contract.oneflow_contract_id}</span>
            </div>
          </div>
        </div>

        {onOpenBillingSettings && !contract._synthetic && (
          <button
            type="button"
            onClick={() => onOpenBillingSettings(contract.id)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-[#20c58f] hover:bg-[#20c58f]/10 rounded-lg transition-colors"
            title="Faktureringsinställningar för detta avtal"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fakturering</span>
          </button>
        )}
      </div>
    </div>
  )
}
