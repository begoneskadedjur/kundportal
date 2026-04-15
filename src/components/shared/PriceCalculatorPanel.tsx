// src/components/shared/PriceCalculatorPanel.tsx
// Prisguide-panel: visar inköpsartiklar och föreslår försäljningspris
// Regler hämtas från globala kalkylatorinställningar (pricing_settings)

import { useState, useEffect } from 'react'
import { X, Calculator, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../ui/Button'
import { PricingSettingsService } from '../../services/pricingSettingsService'
import type { PricingSettings } from '../../types/pricingSettings'
import { DEFAULT_PRICING_SETTINGS } from '../../types/pricingSettings'
import type { ArticleWithEffectivePrice } from '../../types/caseBilling'
import { calculateSuggestedPrice, calculateMarginPercent } from '../../types/caseBilling'

interface PriceCalculatorPanelProps {
  isOpen: boolean
  onClose: () => void
  /** Artiklar (inköpspriser) som lagts till som kalkyl */
  articleItems: { article: ArticleWithEffectivePrice['article']; quantity: number; unit_price: number }[]
  /** Callback när användaren klickar "Använd detta pris" */
  onApplyPrice: (price: number) => void
}

export default function PriceCalculatorPanel({
  isOpen,
  onClose,
  articleItems,
  onApplyPrice,
}: PriceCalculatorPanelProps) {
  const [settings, setSettings] = useState<PricingSettings>({
    id: '',
    ...DEFAULT_PRICING_SETTINGS,
    updated_at: '',
  })
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [markupPercent, setMarkupPercent] = useState(DEFAULT_PRICING_SETTINGS.recommended_markup_percent)

  // Ladda globala inställningar när panelen öppnas
  useEffect(() => {
    if (!isOpen) return
    setLoadingSettings(true)
    PricingSettingsService.get()
      .then(s => {
        setSettings(s)
        setMarkupPercent(s.recommended_markup_percent)
      })
      .catch(() => {/* håll defaults */})
      .finally(() => setLoadingSettings(false))
  }, [isOpen])

  const totalPurchaseCost = articleItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )

  // Föreslagen pris – aldrig under min_charge_amount
  const rawSuggested = calculateSuggestedPrice(totalPurchaseCost, markupPercent)
  const suggestedPrice = Math.max(rawSuggested, settings.min_charge_amount)
  const clampedByMin = rawSuggested < settings.min_charge_amount

  const marginPercent = suggestedPrice > 0
    ? calculateMarginPercent(suggestedPrice, totalPurchaseCost)
    : 0

  // Tre zoner: grön ≥ target, gul mellan min och target, röd < min
  const getMarginColor = () => {
    if (marginPercent >= settings.target_margin_percent) return 'text-emerald-400'
    if (marginPercent >= settings.min_margin_percent) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getMarginIcon = () => {
    if (marginPercent >= settings.min_margin_percent) return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
    return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
  }

  const belowMin = marginPercent < settings.min_margin_percent

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#20c58f]" />
                <h2 className="text-base font-semibold text-white">Prisguide</h2>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {loadingSettings ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#20c58f]" />
                </div>
              ) : (
                <>
                  {/* Inköpsartiklar */}
                  {articleItems.length > 0 ? (
                    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                      <p className="text-xs font-semibold text-slate-400 mb-2">Inköpskostnader (intern kalkyl)</p>
                      <div className="space-y-1">
                        {articleItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-300 truncate mr-2">
                              {item.quantity > 1 && <span className="text-slate-400 mr-1">{item.quantity}×</span>}
                              {item.article.name}
                            </span>
                            <span className="text-slate-200 whitespace-nowrap">
                              {(item.unit_price * item.quantity).toFixed(0)} kr
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-700/50 mt-2 pt-2 flex justify-between text-sm font-semibold">
                        <span className="text-slate-300">Total inköpskostnad</span>
                        <span className="text-white">{totalPurchaseCost.toFixed(0)} kr</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl text-center">
                      <p className="text-xs text-slate-400">Inga inköpsartiklar tillagda ännu.</p>
                      <p className="text-xs text-slate-500 mt-0.5">Lägg till artiklar i kalkylatorn för en bättre prisrekommendation.</p>
                    </div>
                  )}

                  {/* Påslagsjustering */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-400">Påslag</label>
                      <span className="text-sm font-bold text-white">{markupPercent.toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={300}
                      step={5}
                      value={markupPercent}
                      onChange={(e) => setMarkupPercent(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-[#20c58f]"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>0%</span>
                      <span>Rek: {settings.recommended_markup_percent}%</span>
                      <span>300%</span>
                    </div>
                  </div>

                  {/* Föreslaget pris + marginal */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400">Föreslagen försäljningspris</span>
                      <div className="flex items-center gap-1.5">
                        {getMarginIcon()}
                        <span className={`text-xs font-medium ${getMarginColor()}`}>
                          {marginPercent.toFixed(0)}% marginal
                        </span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {suggestedPrice.toFixed(0)} kr
                    </div>
                    {clampedByMin && (
                      <p className="text-xs text-yellow-400 mt-1">
                        Justerat till minsta debitering ({settings.min_charge_amount.toFixed(0)} kr)
                      </p>
                    )}
                    {belowMin && !clampedByMin && (
                      <p className="text-xs text-red-400 mt-1">
                        Under minimikravet på {settings.min_margin_percent}% marginal
                      </p>
                    )}
                  </div>

                  {/* Marginalzoner-guide */}
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      ≥ {settings.target_margin_percent}%
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                      {settings.min_margin_percent}–{settings.target_margin_percent}%
                    </span>
                    <span className="flex items-center gap-1 text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      &lt; {settings.min_margin_percent}%
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={loadingSettings}
                onClick={() => { onApplyPrice(Math.round(suggestedPrice)); onClose() }}
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                Använd {Math.round(suggestedPrice)} kr
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
