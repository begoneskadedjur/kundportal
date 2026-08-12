// src/components/shared/ContractAdditionModal.tsx
// Bekräftelsemodal för avtalstillägg: teknikern markerar en tjänsterad
// som tillägg till kundens avtal. Modalen visar exakt vad som händer
// (pro rata nu + höjd årspremie från nästa period) och kräver aktivt
// medgivande innan markeringen sparas - inget ska ske av misstag.

import { useEffect, useState } from 'react'
import { X, Repeat, Loader2, AlertTriangle, Trash2, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  ContractAdditionService,
  type AdditionQuote,
} from '../../services/contractAdditionService'

interface ContractAdditionModalProps {
  itemId: string
  serviceName: string
  customerId: string
  /** Befintligt årsbelopp om raden redan är markerad */
  existingAnnual: number | null
  /** Förifyllt årsbelopp (radens nuvarande pris) vid ny markering */
  defaultAnnual: number
  onConfirm: (annualAmount: number, quote: AdditionQuote) => Promise<void>
  onRemove: () => Promise<void>
  onClose: () => void
}

export default function ContractAdditionModal({
  itemId,
  serviceName,
  customerId,
  existingAnnual,
  defaultAnnual,
  onConfirm,
  onRemove,
  onClose,
}: ContractAdditionModalProps) {
  const [annualInput, setAnnualInput] = useState(String(existingAnnual ?? defaultAnnual ?? ''))
  const [quote, setQuote] = useState<AdditionQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState<{ newAnnual: number } | null>(null)

  const annualAmount = parseInt(annualInput.replace(/\D/g, ''), 10) || 0

  // Är tillägget redan applicerat (ärendet avslutat)? Då är premien höjd
  // och markeringen kan inte tas bort härifrån.
  useEffect(() => {
    supabase
      .from('contract_additions')
      .select('new_annual_value')
      .eq('case_billing_item_id', itemId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAlreadyApplied({ newAnnual: Number(data.new_annual_value) })
      })
  }, [itemId])

  // Räkna om offerten när årsbeloppet ändras (lätt debounce)
  useEffect(() => {
    if (annualAmount <= 0) {
      setQuote(null)
      setQuoteError(null)
      return
    }
    setQuoteLoading(true)
    const timer = setTimeout(async () => {
      const result = await ContractAdditionService.computeQuote(customerId, annualAmount)
      if ('reason' in result) {
        setQuote(null)
        setQuoteError(result.reason)
      } else {
        setQuote(result)
        setQuoteError(null)
      }
      setQuoteLoading(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [customerId, annualAmount])

  const handleConfirm = async () => {
    if (!quote || !understood || saving) return
    setSaving(true)
    try {
      await onConfirm(annualAmount, quote)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onRemove()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <Repeat className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
            <h2 className="text-sm font-semibold text-white truncate">Lägg till i avtalet</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          <p className="text-sm text-slate-300">
            <span className="text-white font-medium">{serviceName}</span> läggs till som en fast del av
            kundens avtal. Det innebär två saker:
          </p>
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] mt-2 flex-shrink-0" />
              <span>Den här raden faktureras nu som <strong className="text-white">pro rata</strong> - kundens kostnad fram till nästa fakturaperiod.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] mt-2 flex-shrink-0" />
              <span>Kundens <strong className="text-white">årspremie höjs</strong> med årsbeloppet från nästa period, när ärendet avslutas.</span>
            </li>
          </ul>

          {alreadyApplied ? (
            <div className="flex items-start gap-3 p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
              <CheckCircle className="w-5 h-5 text-[#20c58f] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                Tillägget är redan applicerat - årspremien är höjd till{' '}
                <strong className="text-white">{alreadyApplied.newAnnual.toLocaleString('sv-SE')} kr/år</strong>.
                Behöver det ändras, kontakta kontoret.
              </p>
            </div>
          ) : (
            <>
              {/* Årsbelopp */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Tilläggsbelopp per år (kr, exkl. moms)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={annualInput}
                  onChange={e => setAnnualInput(e.target.value)}
                  placeholder="T.ex. 2000"
                  className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent tabular-nums"
                />
              </div>

              {/* Offert */}
              {quoteLoading ? (
                <div className="flex items-center gap-2 p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Beräknar...
                </div>
              ) : quoteError ? (
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">{quoteError}</p>
                </div>
              ) : quote ? (
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-400">Faktureras nu (pro rata, {quote.daysCovered} dagar)</span>
                    <span className="text-white font-semibold tabular-nums">{quote.proratedAmount.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-400">Årspremie idag</span>
                    <span className="text-slate-300 tabular-nums">{quote.currentAnnualValue.toLocaleString('sv-SE')} kr/år</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm pt-2 border-t border-slate-700/50">
                    <span className="text-slate-400">Ny årspremie från {new Date(quote.effectiveFrom).toLocaleDateString('sv-SE')}</span>
                    <span className="text-[#20c58f] font-semibold tabular-nums">{quote.newAnnualValue.toLocaleString('sv-SE')} kr/år</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Gäller avtalet för {quote.billingCustomerName}. Premiehöjningen sker när ärendet avslutas
                    och loggas med ditt namn.
                  </p>
                </div>
              ) : null}

              {/* Medgivande */}
              <label className="flex items-start gap-3 p-3 bg-amber-500/[0.06] border border-amber-500/25 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={e => setUnderstood(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded bg-slate-700 border-slate-500 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <span className="text-sm text-slate-300">
                  Jag förstår att kundens avtal och årspremie ändras, och att detta är överenskommet med kunden.
                </span>
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-700">
          {existingAnnual !== null && !alreadyApplied ? (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              Ta bort tillägget
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              {alreadyApplied ? 'Stäng' : 'Avbryt'}
            </button>
            {!alreadyApplied && (
              <button
                onClick={handleConfirm}
                disabled={!quote || !understood || saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] hover:bg-[#1ab37e] disabled:opacity-50 text-[#fff] rounded-lg text-sm font-semibold transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Bekräfta avtalstillägg
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
