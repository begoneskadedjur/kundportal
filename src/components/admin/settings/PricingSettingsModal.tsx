// src/components/admin/settings/PricingSettingsModal.tsx
// Global modal för prissättningsinställningar på Tjänsteutbud-sidan

import { useState, useEffect } from 'react'
import { X, Save, Settings2, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { PricingSettingsService } from '../../../services/pricingSettingsService'
import type { PricingSettings } from '../../../types/pricingSettings'

interface PricingSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PricingSettingsModal({ isOpen, onClose }: PricingSettingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [minMargin, setMinMargin] = useState('20')
  const [targetMargin, setTargetMargin] = useState('35')
  const [recommendedMarkup, setRecommendedMarkup] = useState('40')
  const [minCharge, setMinCharge] = useState('3490')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    PricingSettingsService.get()
      .then((s: PricingSettings) => {
        setMinMargin(String(s.min_margin_percent))
        setTargetMargin(String(s.target_margin_percent))
        setRecommendedMarkup(String(s.recommended_markup_percent))
        setMinCharge(String(s.min_charge_amount))
      })
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleSave = async () => {
    const min = parseFloat(minMargin)
    const target = parseFloat(targetMargin)
    const markup = parseFloat(recommendedMarkup)
    const charge = parseFloat(minCharge)

    if (isNaN(min) || isNaN(target) || isNaN(markup) || isNaN(charge)) {
      toast.error('Alla fält måste vara giltiga tal')
      return
    }
    if (min > target) {
      toast.error('Minsta marginal kan inte vara högre än önskvärd marginal')
      return
    }

    setSaving(true)
    try {
      await PricingSettingsService.update({
        min_margin_percent: min,
        target_margin_percent: target,
        recommended_markup_percent: markup,
        min_charge_amount: charge,
      })
      toast.success('Inställningar sparade')
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#20c58f]" />
                <h2 className="text-base font-semibold text-white">Kalkylatorinställningar</h2>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Laddar...</div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Marginaler */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Marginalregler</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Önskvärd marginal %
                      </label>
                      <input
                        type="number"
                        value={targetMargin}
                        onChange={e => setTargetMargin(e.target.value)}
                        min={0} max={100} step={1}
                        className={inputClass}
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Visas grönt i prisguiden</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Minsta marginal %
                      </label>
                      <input
                        type="number"
                        value={minMargin}
                        onChange={e => setMinMargin(e.target.value)}
                        min={0} max={100} step={1}
                        className={inputClass}
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Röd varning om man går under</p>
                    </div>
                  </div>

                  {/* Visuell förklaring av marginalzoner */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      ≥ {targetMargin}%
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                      {minMargin}–{targetMargin}%
                    </span>
                    <span className="flex items-center gap-1 text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      &lt; {minMargin}%
                    </span>
                  </div>
                </div>

                {/* Prisguide */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Prisguide</p>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Rekommenderat påslag %
                    </label>
                    <input
                      type="number"
                      value={recommendedMarkup}
                      onChange={e => setRecommendedMarkup(e.target.value)}
                      min={0} step={5}
                      className={inputClass}
                    />
                    <p className="text-xs text-slate-500 mt-0.5">Startvärde för påslagsslidern</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Minsta debitering (kr, exkl. moms)
                    </label>
                    <input
                      type="number"
                      value={minCharge}
                      onChange={e => setMinCharge(e.target.value)}
                      min={0} step={100}
                      className={inputClass}
                    />
                    <div className="flex items-start gap-1 mt-0.5">
                      <Info className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-500">
                        Prisguiden föreslår aldrig ett belopp under detta, oavsett inköpskostnad
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
              <Button type="button" variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={loading}>
                <Save className="w-3.5 h-3.5 mr-1" />
                Spara
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
