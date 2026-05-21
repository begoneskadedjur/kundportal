import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ContractValueCardProps {
  customer: {
    contract_type: string | null
    contract_status: string | null
    agreement_text: string | null
    service_details: string | null
    product_summary: string | null
    contract_start_date: string | null
    contract_end_date: string | null
  }
}

const ContractValueCard: React.FC<ContractValueCardProps> = ({ customer }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const hasDetails =
    customer.agreement_text ||
    customer.service_details ||
    customer.product_summary

  const startStr = formatDate(customer.contract_start_date)
  const endStr = formatDate(customer.contract_end_date)
  const periodStr =
    startStr && endStr
      ? `${startStr} – ${endStr}`
      : startStr
      ? `Från ${startStr}`
      : null

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-base font-semibold text-white">Ert avtal</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
        {customer.contract_type && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avtalstyp</p>
            <p className="text-sm font-medium text-white">{customer.contract_type}</p>
          </div>
        )}

        {periodStr && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avtalstid</p>
            <p className="text-sm font-medium text-white">{periodStr}</p>
          </div>
        )}

      </div>

      {hasDetails && (
        <div className="mt-4 border-t border-slate-700/50 pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Tjänsteomfattning & villkor
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-4">
              {customer.agreement_text && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avtalsomfattning</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{customer.agreement_text}</p>
                </div>
              )}
              {customer.product_summary && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Inkluderade produkter</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{customer.product_summary}</p>
                </div>
              )}
              {customer.service_details && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Servicedetaljer</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{customer.service_details}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ContractValueCard
