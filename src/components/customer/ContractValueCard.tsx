// src/components/customer/ContractValueCard.tsx - Contract Information Display
import React, { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Shield, Sparkles, CreditCard } from 'lucide-react'
import Card from '../ui/Card'
import { formatCurrency } from '../../utils/formatters'

interface ContractValueCardProps {
  customer: {
    contract_type: string | null
    contract_status: string | null
    annual_value: number | null
    agreement_text: string | null
    service_details: string | null
    product_summary: string | null
    contract_start_date: string | null
  }
}

const ContractValueCard: React.FC<ContractValueCardProps> = ({ customer }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800 via-slate-800/95 to-emerald-900/5 border-slate-700 hover:border-emerald-500/30 transition-all duration-300">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Ert avtal</h3>
              <p className="text-sm text-slate-400">Omfattning och värde</p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm font-medium">Aktivt</span>
          </div>
        </div>

        {/* Contract Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Contract Type */}
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Avtalstyp</span>
            </div>
            <p className="text-white font-semibold flex items-center gap-2">
              {customer.contract_type || 'Premium avtal'}
              <Sparkles className="w-4 h-4 text-yellow-500" />
            </p>
          </div>

          {/* Annual Value */}
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Årspremie</span>
            </div>
            <p className="text-2xl font-bold text-white font-mono">
              {formatCurrency(customer.annual_value || 0)}
            </p>
          </div>

          {/* Member Since */}
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Kund sedan</span>
            </div>
            <p className="text-white font-semibold">
              {formatDate(customer.contract_start_date) || 'N/A'}
            </p>
          </div>
        </div>

        {/* Service Coverage */}
        {(customer.agreement_text || customer.service_details || customer.product_summary) && (
          <div className="border-t border-slate-700/50 pt-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between py-2 text-left hover:bg-slate-900/20 rounded-lg transition-colors px-3"
            >
              <span className="text-sm font-medium text-slate-300">
                Tjänsteomfattning & villkor
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Expandable Content */}
            <div className={`overflow-hidden transition-all duration-300 ${
              isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}>
              <div className="bg-slate-900/30 rounded-lg p-4 space-y-4">
                {customer.agreement_text && (
                  <div>
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">Avtalsomfattning</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {customer.agreement_text}
                    </p>
                  </div>
                )}

                {customer.product_summary && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-400 mb-2">Inkluderade produkter</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {customer.product_summary}
                    </p>
                  </div>
                )}

                {customer.service_details && (
                  <div>
                    <h4 className="text-sm font-medium text-purple-400 mb-2">Servicedetaljer</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {customer.service_details}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Premium Badge */}
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span>Premium Service</span>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <span>Garanterad kvalitet</span>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
              <span>24/7 support</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default ContractValueCard