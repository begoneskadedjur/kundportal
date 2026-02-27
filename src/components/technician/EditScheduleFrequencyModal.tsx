// src/components/technician/EditScheduleFrequencyModal.tsx
// Kompakt modal för att ändra frekvens på ett återkommande schema

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Repeat, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateRecurringSchedule } from '../../services/recurringScheduleService'
import {
  FREQUENCY_CONFIG,
  STANDARD_FREQUENCIES
} from '../../types/recurringSchedule'
import type { RecurringFrequency } from '../../types/recurringSchedule'

interface EditScheduleFrequencyModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
  scheduleId: string
  currentFrequency: RecurringFrequency
}

export function EditScheduleFrequencyModal({
  isOpen,
  onClose,
  onUpdated,
  scheduleId,
  currentFrequency
}: EditScheduleFrequencyModalProps) {
  const [selectedFrequency, setSelectedFrequency] = useState<RecurringFrequency>(currentFrequency)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (selectedFrequency === currentFrequency) {
      onClose()
      return
    }
    setSaving(true)
    try {
      const result = await updateRecurringSchedule(scheduleId, {
        frequency: selectedFrequency
      })
      if (result) {
        toast.success('Frekvens uppdaterad')
        onUpdated()
      } else {
        toast.error('Kunde inte uppdatera frekvens')
      }
    } catch {
      toast.error('Fel vid uppdatering')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#20c58f]" />
                <h3 className="text-sm font-semibold text-slate-200">Ändra frekvens</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white transition-colors rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                {STANDARD_FREQUENCIES.map(freq => {
                  const config = FREQUENCY_CONFIG[freq]
                  const isSelected = selectedFrequency === freq
                  const isCurrent = currentFrequency === freq
                  return (
                    <button
                      key={freq}
                      onClick={() => setSelectedFrequency(freq)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'border-[#20c58f] bg-[#20c58f]/10'
                          : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${isSelected ? 'text-[#20c58f]' : 'text-slate-300'}`}>
                          {config.label}
                          {isCurrent && (
                            <span className="ml-1.5 text-[10px] text-slate-500 font-normal">(nuvarande)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500">{config.description}</p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Befintliga kontrolltillfällen påverkas inte. Nya sessioner genereras med den nya frekvensen.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-700/50">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-sm font-medium text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || selectedFrequency === currentFrequency}
                className="flex-1 py-2 text-sm font-medium text-[#0a1328] bg-[#20c58f] rounded-xl hover:bg-[#1ab37e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sparar...
                  </>
                ) : (
                  'Spara'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
