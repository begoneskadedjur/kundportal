// src/components/admin/contractBilling/ContractBillingBatchList.tsx
// Lista över faktureringsomgångar (batches)

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle,
  FileText,
  Loader2,
  Calendar
} from 'lucide-react'
import {
  ContractBillingBatch,
  BILLING_BATCH_STATUS_CONFIG,
  formatBillingAmount,
  formatBillingPeriod
} from '../../../types/contractBilling'

interface ContractBillingBatchListProps {
  batches: ContractBillingBatch[]
  loading: boolean
  onBatchSelect: (batchId: string | null) => void
  selectedBatchId: string | null
  onDeleteBatch: (batchId: string) => void
  onApproveBatch: (batchId: string) => void
}

export function ContractBillingBatchList({
  batches,
  loading,
  onBatchSelect,
  selectedBatchId,
  onDeleteBatch,
  onApproveBatch
}: ContractBillingBatchListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Inga faktureringsomgångar</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {batches.map((batch) => {
        const statusConfig = BILLING_BATCH_STATUS_CONFIG[batch.status]
        const isExpanded = expandedId === batch.id
        const isSelected = selectedBatchId === batch.id

        return (
          <div
            key={batch.id}
            className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all ${
              isSelected
                ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
                : 'border-slate-700/50'
            }`}
          >
            {/* Header */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/70 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : batch.id)}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-medium">
                    {formatBillingPeriod(batch.billing_period_start, batch.billing_period_end)}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-white font-medium">
                    {formatBillingAmount(batch.total_amount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {batch.total_items} rader · {batch.total_customers} kunder
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {/* Expanderat innehåll */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-700/50 overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    {/* Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Batch-nummer</p>
                        <p className="text-white font-mono text-xs">{batch.batch_number}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Genererad</p>
                        <p className="text-white">
                          {new Date(batch.generated_at).toLocaleString('sv-SE')}
                        </p>
                      </div>
                      {batch.approved_at && (
                        <div>
                          <p className="text-slate-500">Godkänd</p>
                          <p className="text-white">
                            {new Date(batch.approved_at).toLocaleString('sv-SE')}
                          </p>
                        </div>
                      )}
                      {batch.completed_at && (
                        <div>
                          <p className="text-slate-500">Slutförd</p>
                          <p className="text-white">
                            {new Date(batch.completed_at).toLocaleString('sv-SE')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Åtgärder */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onBatchSelect(isSelected ? null : batch.id)
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {isSelected ? 'Dölj rader' : 'Visa rader'}
                      </button>

                      <div className="flex items-center gap-2">
                        {batch.status === 'generated' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onApproveBatch(batch.id)
                            }}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Godkänn alla"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(batch.status === 'draft' || batch.status === 'generated') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Är du säker på att du vill ta bort denna batch?')) {
                                onDeleteBatch(batch.id)
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Ta bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
