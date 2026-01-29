// src/components/admin/contractBilling/ContractBillingGenerateModal.tsx
// Modal för att generera ny faktureringsomgång

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Zap, Calendar, Users, Loader2, AlertTriangle } from 'lucide-react'
import {
  BillingFrequency,
  BILLING_FREQUENCY_CONFIG,
  calculateBillingPeriod,
  formatBillingPeriod
} from '../../../types/contractBilling'
import { ContractBillingService } from '../../../services/contractBillingService'
import toast from 'react-hot-toast'

interface ContractBillingGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ContractBillingGenerateModal({
  isOpen,
  onClose,
  onSuccess
}: ContractBillingGenerateModalProps) {
  const [frequency, setFrequency] = useState<BillingFrequency>('monthly')
  const [generating, setGenerating] = useState(false)
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Beräkna period baserat på vald frekvens
  const period = calculateBillingPeriod(frequency)

  // Hämta antal kunder när frekvens ändras
  const handleFrequencyChange = async (newFrequency: BillingFrequency) => {
    setFrequency(newFrequency)
    setLoadingCustomers(true)
    try {
      const customers = await ContractBillingService.getCustomersForBilling(newFrequency)
      setCustomerCount(customers.length)
    } catch (error) {
      console.error('Kunde inte hämta kunder:', error)
      setCustomerCount(null)
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Generera fakturering
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await ContractBillingService.generateBatchBilling(
        frequency,
        period.start,
        period.end
      )

      toast.success(
        `Genererade ${result.itemCount} faktureringsrader för ${result.customerCount} kunder`
      )
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Fel vid generering:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte generera fakturering')
    } finally {
      setGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !generating && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Generera fakturering</h2>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Frekvensval */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Faktureringsfrekvens
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BILLING_FREQUENCY_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleFrequencyChange(key as BillingFrequency)}
                  disabled={generating}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    frequency === key
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-900/50 border-slate-700/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <p className="font-medium text-sm">{config.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Periodvisning */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">Faktureringsperiod</span>
            </div>
            <p className="text-white font-medium text-lg">
              {formatBillingPeriod(period.start, period.end)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {period.start} - {period.end}
            </p>
          </div>

          {/* Kundantal */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">Kunder att fakturera</span>
            </div>
            {loadingCustomers ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-slate-400">Laddar...</span>
              </div>
            ) : customerCount !== null ? (
              <p className="text-white font-medium text-lg">
                {customerCount} {customerCount === 1 ? 'kund' : 'kunder'}
              </p>
            ) : (
              <p className="text-slate-500">Kunde inte hämta antal</p>
            )}
          </div>

          {/* Varning om inga kunder */}
          {customerCount === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 font-medium">Inga kunder hittades</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Det finns inga kunder med denna faktureringsfrekvens och kopplad prislista.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || customerCount === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Genererar...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generera fakturering
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
