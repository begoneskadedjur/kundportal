// src/components/shared/PriceCalculatorPanel.tsx
// Prisguide 2.0: tilldela interna kostnader till fakturarader, sätt påslag per rad, applicera

import { useEffect } from 'react'
import { X, Calculator, TrendingUp, AlertTriangle, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import Button from '../ui/Button'
import { PricingSettingsService } from '../../services/pricingSettingsService'
import type { PricingSettings } from '../../types/pricingSettings'
import { DEFAULT_PRICING_SETTINGS } from '../../types/pricingSettings'
import { calculateSuggestedPrice, calculateMarginPercent } from '../../types/caseBilling'

interface ArticleItem {
  id: string
  article_name: string
  article_code?: string | null
  quantity: number
  unit_price: number
  total_price: number
}

interface ServiceItem {
  id: string
  service_name?: string | null
  service_code?: string | null
  unit_price: number
  quantity: number
  discount_percent: number
}

interface PriceCalculatorPanelProps {
  isOpen: boolean
  onClose: () => void
  articleItems: ArticleItem[]
  serviceItems: ServiceItem[]
  // Lyfta till föräldra-state så tilldelningar överlever öppna/stäng
  assignments: Record<string, string>
  markups: Record<string, number>
  onAssignmentsChange: (a: Record<string, string>) => void
  onMarkupsChange: (m: Record<string, number>) => void
  onApplyPrices: (prices: Record<string, number>) => Promise<void>
}

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export default function PriceCalculatorPanel({
  isOpen,
  onClose,
  articleItems,
  serviceItems,
  assignments,
  markups,
  onAssignmentsChange,
  onMarkupsChange,
  onApplyPrices,
}: PriceCalculatorPanelProps) {
  const [settings, setSettings] = useState<PricingSettings>({ id: '', ...DEFAULT_PRICING_SETTINGS, updated_at: '' })
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [applying, setApplying] = useState(false)
  const [showPricing, setShowPricing] = useState(false)

  // Ladda inställningar vid första öppning; initiera markup för nya servicerader
  useEffect(() => {
    if (!isOpen) return
    setLoadingSettings(true)
    PricingSettingsService.get()
      .then(s => {
        setSettings(s)
        // Initiera markup bara för rader som saknas (nya rader) — rör ej befintliga
        onMarkupsChange(
          Object.fromEntries(
            serviceItems.map(si => [si.id, markups[si.id] ?? s.recommended_markup_percent])
          )
        )
      })
      .catch(() => {
        onMarkupsChange(
          Object.fromEntries(
            serviceItems.map(si => [si.id, markups[si.id] ?? DEFAULT_PRICING_SETTINGS.recommended_markup_percent])
          )
        )
      })
      .finally(() => setLoadingSettings(false))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const purchaseCostByService = (serviceId: string) =>
    articleItems
      .filter(a => assignments[a.id] === serviceId)
      .reduce((sum, a) => sum + a.total_price, 0)

  const getMarginColor = (margin: number) => {
    if (margin >= settings.target_margin_percent) return 'text-emerald-400'
    if (margin >= settings.min_margin_percent) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getMarginIcon = (margin: number) =>
    margin >= settings.min_margin_percent
      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      : <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />

  const handleApply = async () => {
    setApplying(true)
    try {
      const rec = settings.recommended_markup_percent

      // Beräkna råpriser per rad
      const entries = serviceItems
        .map(si => ({
          id: si.id,
          cost: purchaseCostByService(si.id),
          markup: markups[si.id] ?? rec,
        }))
        .filter(e => e.cost > 0)

      const rawPrices = entries.map(e => ({
        ...e,
        price: calculateSuggestedPrice(e.cost, e.markup),
      }))

      // min_charge_amount gäller HELA ärendet, inte per rad
      const rawTotal = rawPrices.reduce((s, e) => s + e.price, 0)
      if (rawTotal < settings.min_charge_amount && rawPrices.length > 0) {
        const diff = settings.min_charge_amount - rawTotal
        const maxIdx = rawPrices.reduce((best, e, i) => e.cost > rawPrices[best].cost ? i : best, 0)
        rawPrices[maxIdx].price += diff
      }

      const prices: Record<string, number> = {}
      rawPrices.forEach(e => { prices[e.id] = Math.round(e.price) })

      await onApplyPrices(prices)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const anyAssigned = Object.values(assignments).some(v => v !== '')

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#20c58f]" />
                <h2 className="text-base font-semibold text-white">Prisguide</h2>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loadingSettings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#20c58f]" />
                </div>
              ) : (
                <div className="p-4 space-y-4">

                  {/* ── Steg 1: Tilldela artiklar ── */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">
                      Tilldela interna kostnader till fakturarader
                    </p>

                    {articleItems.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-3">
                        Inga interna artiklar tillagda ännu.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {articleItems.map(a => (
                          <div key={a.id} className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                            {/* Namn på egen rad – fullt utrymme på mobil */}
                            <div className="mb-2">
                              <div className="text-sm text-white font-medium leading-snug">
                                {a.article_code && (
                                  <span className="text-xs text-slate-500 mr-1">{a.article_code}</span>
                                )}
                                {a.article_name}
                                {a.quantity > 1 && (
                                  <span className="text-xs text-slate-500 ml-1">×{a.quantity}</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">{fmt(a.total_price)}</div>
                            </div>
                            <select
                              value={assignments[a.id] ?? ''}
                              onChange={e => onAssignmentsChange({ ...assignments, [a.id]: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                            >
                              <option value="">— Ej tilldelad —</option>
                              {serviceItems.map(si => (
                                <option key={si.id} value={si.id}>
                                  {si.service_code ? `${si.service_code} ` : ''}{si.service_name || 'Okänd tjänst'}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Steg 2: Påslag per rad (expanderbar) ── */}
                  {anyAssigned && (
                    <div className="border border-slate-700 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPricing(!showPricing)}
                        className="flex items-center justify-between w-full px-3 py-2.5 bg-slate-800/30 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                      >
                        <span>Justera påslag & marginal</span>
                        {showPricing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showPricing && (
                        <div className="p-3 space-y-4">
                          {serviceItems.map(si => {
                            const cost = purchaseCostByService(si.id)
                            const markup = markups[si.id] ?? settings.recommended_markup_percent
                            const raw = calculateSuggestedPrice(cost, markup)
                            const price = cost > 0 ? raw : 0
                            const margin = price > 0 ? calculateMarginPercent(price, cost) : 0
                            const hasArticles = cost > 0

                            return (
                              <div key={si.id} className={`p-3 rounded-xl border ${hasArticles ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-800/10 border-slate-700/30'}`}>
                                {/* Tjänstnamn på egen rad */}
                                <div className="mb-2">
                                  <div className="text-sm font-medium text-white leading-snug">
                                    {si.service_code && (
                                      <span className="text-xs text-slate-400 mr-1">{si.service_code}</span>
                                    )}
                                    {si.service_name || 'Okänd tjänst'}
                                  </div>
                                  {hasArticles && (
                                    <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${getMarginColor(margin)}`}>
                                      {getMarginIcon(margin)}
                                      {margin.toFixed(0)}% marginal
                                    </div>
                                  )}
                                </div>

                                {hasArticles ? (
                                  <>
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                      <span>Inköp: {fmt(cost)}</span>
                                      <span className="font-semibold text-white text-sm">{fmt(price)}</span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs text-slate-500">
                                        <span>Påslag</span>
                                        <span className="font-medium text-slate-300">{markup.toFixed(0)}%</span>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={300}
                                        step={5}
                                        value={markup}
                                        onChange={e => onMarkupsChange({ ...markups, [si.id]: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-[#20c58f]"
                                      />
                                      <div className="flex justify-between text-xs text-slate-600">
                                        <span>0%</span>
                                        <span>Rek: {settings.recommended_markup_percent}%</span>
                                        <span>300%</span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-slate-500">
                                    Nuvarande pris: {fmt(si.unit_price * si.quantity)} – berörs ej
                                  </p>
                                )}
                              </div>
                            )
                          })}

                          {/* Marginalzoner */}
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
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700/50 shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={applying}>
                Avbryt
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={loadingSettings || applying || !anyAssigned}
                onClick={handleApply}
              >
                {applying
                  ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  : <TrendingUp className="w-3.5 h-3.5 mr-1" />
                }
                Applicera priser
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
