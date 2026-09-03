// src/components/admin/customers/record/AddonDropPrompt.tsx
// Popover när en bricka med tilläggsstationer släpps på ett avtal i avtalskartan:
// § 7 = baka in i årspremien (trappsteg med text), § 6 = tillägg utöver avtalet
// (synkad § 6-rad, egna fakturor). Datum och pris per station bekräftas här.

import { useEffect, useState } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import DateField from '../../../ui/DateField'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import { formatDateSv, formatKr } from '../../../../hooks/useCustomerRecord'
import { todayKey } from '../../../../utils/contractLifecycle'
import type { AddonBrick, AddonPrices } from '../../../../types/addonStations'

export interface AddonDropPromptState {
  x: number
  y: number
  contractLabel: string
  unitName: string
  brick: AddonBrick
  zone: 'premium' | 'equipment'
  /** Årspremie som gäller idag (för förhandsvisningen vid inbakning) */
  annualInForce: number | null
}

interface Props {
  prompt: AddonDropPromptState
  onClose: () => void
  onConfirm: (input: { effectiveFrom: string; unitPriceAnnual: number }) => Promise<void>
}

export default function AddonDropPrompt({ prompt, onClose, onConfirm }: Props) {
  const [date, setDate] = useState(todayKey())
  const [price, setPrice] = useState('')
  const [prices, setPrices] = useState<AddonPrices | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    AddonStationBillingService.getAddonPrices(prompt.brick.unitId)
      .then((p) => {
        if (cancelled) return
        setPrices(p)
        if (p.perYear != null) setPrice(String(p.perYear))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [prompt.brick.unitId])

  const annual = Number(price.replace(/\s/g, '').replace(',', '.'))
  const valid = !!date && annual > 0
  const b = prompt.brick
  const addAnnual = valid ? Math.round(annual * b.count * 100) / 100 : 0
  const isPremium = prompt.zone === 'premium'

  const confirm = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await onConfirm({ effectiveFrom: date, unitPriceAnnual: annual })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed z-[130] w-80 bg-slate-950 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/60"
      style={{ left: Math.min(prompt.x, window.innerWidth - 340), top: Math.min(prompt.y, window.innerHeight - 340) }}
    >
      <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-0.5">
        <Calendar className="w-3.5 h-3.5 text-[#20c58f]" />
        {isPremium ? 'Baka in i årspremien' : 'Tillägg utöver avtalet'}
      </h4>
      <p className="text-[11px] text-slate-400 mb-2.5">
        {b.count} st {b.stationTypeName} på {prompt.unitName}, {b.model === 'per_month' ? 'per månad' : 'per år'}, i {prompt.contractLabel}
      </p>

      <div className="space-y-2">
        <label className="block text-[11px] text-slate-400">
          {isPremium ? 'Gäller från' : 'Debiteras från'}
          <DateField
            value={date}
            onChange={setDate}
            aria-label="Datum"
            className="mt-1 w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          />
        </label>
        <label className="block text-[11px] text-slate-400">
          Årspris per station (kr, exkl. moms)
          <div className="mt-1 flex items-center gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              placeholder={loading ? 'hämtar pris' : 'pris saknas i prislistan'}
            />
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
          </div>
          {prices && prices.perYear == null && !loading && (
            <span className="block mt-1 text-amber-400">Kundens prislista saknar årspris för tilläggsstationer. Ange pris manuellt.</span>
          )}
        </label>

        <div className="rounded-lg border border-slate-700/60 px-3 py-2 text-[11px] text-slate-300 tabular-nums">
          {isPremium ? (
            <>
              Premien höjs med <b>{formatKr(addAnnual)}/år</b>
              {prompt.annualInForce != null && valid ? (
                <>
                  : {formatKr(prompt.annualInForce)} → <b>{formatKr(prompt.annualInForce + addAnnual)}</b>
                </>
              ) : null}
              <span className="block text-slate-500 mt-0.5">
                Textrad på nästa årspremiefaktura: "Tilläggsstationer adderade till avtalet, {b.count} st {b.stationTypeName} på {prompt.unitName}, {formatDateSv(date || todayKey())}"
              </span>
            </>
          ) : (
            <>
              § 6: <b>{b.count} st à {formatKr(b.model === 'per_month' ? Math.round((annual / 12) * 100) / 100 : annual)}</b>
              {b.model === 'per_month' ? '/mån' : '/år'}
              <span className="block text-slate-500 mt-0.5">
                Egna fakturor {b.model === 'per_month' ? 'varje månad' : 'parallellt med årspremien'}, antal vid varje debitering. Perioden fram till nästa faktura pro rata.
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button onClick={onClose} className="text-[11px] text-slate-500 hover:text-slate-300">
          Avbryt
        </button>
        <button
          onClick={() => void confirm()}
          disabled={!valid || saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#20c58f] text-[#fff] disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {isPremium ? 'Baka in' : 'Lägg som tillägg'}
        </button>
      </div>
    </div>
  )
}
