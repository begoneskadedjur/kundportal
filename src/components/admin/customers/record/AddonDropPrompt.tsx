// src/components/admin/customers/record/AddonDropPrompt.tsx
// Popover när brickor med tilläggsstationer beslutas i avtalskartan:
// § 6 = baka in i årspremien (trappsteg med text), § 5 = tillägg utöver avtalet
// (synkad § 5-rad, egna fakturor). En eller flera brickor på samma avtal:
// gemensamt datum, pris per rad ur prislistan (rättas per rad), besluten
// körs ett i taget med progress i knappen. Faller ett stannar körningen,
// de klara ligger kvar beslutade och raden som brast pekas ut.

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import DateField from '../../../ui/DateField'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import { formatDateSv, formatKr } from '../../../../hooks/useCustomerRecord'
import { todayKey } from '../../../../utils/contractLifecycle'
import type { AddonBrick } from '../../../../types/addonStations'

export interface AddonPromptBrick {
  brick: AddonBrick
  unitName: string
}

export interface AddonDropPromptState {
  x: number
  y: number
  contractLabel: string
  bricks: AddonPromptBrick[]
  zone: 'premium' | 'equipment'
  /** Årspremie som gäller idag (för förhandsvisningen vid inbakning) */
  annualInForce: number | null
}

interface Props {
  prompt: AddonDropPromptState
  onClose: () => void
  /** Ett beslut per bricka, i ordning. Kastar den stannar körningen. */
  onConfirmBrick: (item: AddonPromptBrick, input: { effectiveFrom: string; unitPriceAnnual: number }) => Promise<void>
  /** Alla brickor beslutade: antal stationer och kr/år, för en enda toast */
  onAllDone: (summary: { bricks: number; stations: number; annualKr: number }) => void
}

export const brickKey = (b: AddonBrick) => `${b.unitId}|${b.stationTypeId ?? ''}|${b.model}`

export default function AddonDropPrompt({ prompt, onClose, onConfirmBrick, onAllDone }: Props) {
  const [date, setDate] = useState(todayKey())
  const [priceByKey, setPriceByKey] = useState<Record<string, string>>({})
  const [missingByKey, setMissingByKey] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<{ done: number; failedKey: string | null; error: string | null } | null>(null)
  const isPremium = prompt.zone === 'premium'
  const items = prompt.bricks

  // Pris per rad ur kundens prislista, en fråga per unik enhet + stationstyp
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const seen = new Map<string, Promise<number | null>>()
    Promise.all(
      items.map(async ({ brick }) => {
        const lookupKey = `${brick.unitId}|${brick.stationTypeId ?? ''}`
        let p = seen.get(lookupKey)
        if (!p) {
          p = AddonStationBillingService.getAddonPrices(brick.unitId, brick.stationTypeId ?? undefined)
            .then((r) => r.perYear)
            .catch(() => null)
          seen.set(lookupKey, p)
        }
        return [brickKey(brick), await p] as const
      })
    )
      .then((rows) => {
        if (cancelled) return
        const prices: Record<string, string> = {}
        const missing: Record<string, boolean> = {}
        for (const [key, perYear] of rows) {
          if (perYear != null && perYear > 0) prices[key] = String(perYear)
          else missing[key] = true
        }
        setPriceByKey(prices)
        setMissingByKey(missing)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(({ brick }) => brickKey(brick)).join(',')])

  const parsed = (key: string) => Number((priceByKey[key] ?? '').replace(/\s/g, '').replace(',', '.'))
  const allPriced = items.every(({ brick }) => parsed(brickKey(brick)) > 0)
  const valid = !!date && allPriced && !loading
  const stations = items.reduce((s, { brick }) => s + brick.count, 0)
  const addAnnual = useMemo(
    () => items.reduce((s, { brick }) => s + (parsed(brickKey(brick)) > 0 ? parsed(brickKey(brick)) * brick.count : 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, priceByKey]
  )
  const multi = items.length > 1
  const saving = progress != null && progress.failedKey == null && progress.done < items.length

  const confirm = async () => {
    if (!valid) return
    // Fortsätt efter ett fel: hoppa över de som redan blev klara
    const startAt = progress?.failedKey ? progress.done : 0
    setProgress({ done: startAt, failedKey: null, error: null })
    let done = startAt
    for (let i = startAt; i < items.length; i++) {
      const item = items[i]
      try {
        await onConfirmBrick(item, { effectiveFrom: date, unitPriceAnnual: parsed(brickKey(item.brick)) })
        done = i + 1
        setProgress({ done, failedKey: null, error: null })
      } catch (err) {
        setProgress({ done, failedKey: brickKey(item.brick), error: err instanceof Error ? err.message : 'Beslutet kunde inte sparas' })
        return
      }
    }
    onAllDone({ bricks: items.length, stations, annualKr: addAnnual })
    onClose()
  }

  const title = isPremium ? 'Baka in i årspremien' : 'Tillägg utöver avtalet'
  const single = items[0]

  return (
    <div
      className="fixed z-[130] w-[380px] max-w-[92vw] bg-slate-950 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/60"
      style={{ left: Math.min(prompt.x, window.innerWidth - 400), top: Math.min(prompt.y, window.innerHeight - 420) }}
    >
      <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-0.5">
        <Calendar className="w-3.5 h-3.5 text-[#20c58f]" />
        {title}
        {multi && <span className="font-normal text-slate-400">· {items.length} brickor</span>}
      </h4>
      <p className="text-[11px] text-slate-400 mb-2.5">
        {multi ? (
          <>
            {stations} stationer på {new Set(items.map((i) => i.unitName)).size} {new Set(items.map((i) => i.unitName)).size === 1 ? 'enhet' : 'enheter'}, i{' '}
            <b className="text-slate-300">{prompt.contractLabel}</b>
          </>
        ) : (
          <>
            {single.brick.count} st {single.brick.stationTypeName} på {single.unitName}, {single.brick.model === 'per_month' ? 'per månad' : 'per år'}, i{' '}
            <b className="text-slate-300">{prompt.contractLabel}</b>
          </>
        )}
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

        <div className="text-[11px] text-slate-400">
          Årspris per station (kr, exkl. moms)
          <div className="mt-1 max-h-56 overflow-y-auto divide-y divide-slate-800 rounded-lg border border-slate-800">
            {items.map(({ brick, unitName }) => {
              const key = brickKey(brick)
              const missing = missingByKey[key] && !(parsed(key) > 0)
              const failed = progress?.failedKey === key
              const doneIdx = items.findIndex((i) => brickKey(i.brick) === key)
              const isDone = progress != null && doneIdx < progress.done
              return (
                <div key={key} className={`flex items-center gap-2 px-2 py-1.5 ${failed ? 'bg-red-500/10' : ''}`}>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDone ? 'bg-[#20c58f]' : failed ? 'bg-red-400' : missing ? 'bg-amber-400' : 'bg-slate-600'}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-300" title={`${brick.count} st ${brick.stationTypeName} · ${unitName}`}>
                    {brick.count} st {brick.stationTypeName}
                    {multi && <span className="text-slate-500"> · {unitName}</span>}
                    {brick.model === 'per_month' && <span className="text-slate-500"> · per månad</span>}
                  </span>
                  <input
                    value={priceByKey[key] ?? ''}
                    onChange={(e) => setPriceByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                    inputMode="decimal"
                    disabled={isDone || saving}
                    className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs text-right rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f] disabled:opacity-50"
                    placeholder={loading ? '…' : 'pris'}
                    aria-label={`Årspris ${brick.stationTypeName} ${unitName}`}
                  />
                </div>
              )
            })}
          </div>
          {loading && (
            <span className="mt-1 inline-flex items-center gap-1.5 text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> hämtar priser
            </span>
          )}
          {!loading && !allPriced && (
            <span className="block mt-1 text-amber-400">Pris saknas i prislistan på en eller flera rader. Ange pris.</span>
          )}
          {progress?.error && (
            <span className="block mt-1 text-red-400">{progress.error} De {progress.done} första är sparade, resten står kvar.</span>
          )}
        </div>

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
                Textrad på nästa årspremiefaktura per bricka: "Tilläggsstationer adderade till avtalet, … {formatDateSv(date || todayKey())}"
              </span>
            </>
          ) : (
            <>
              § 5: <b>{stations} st, {formatKr(addAnnual)}/år</b> i egna rader
              <span className="block text-slate-500 mt-0.5">
                Egna fakturor parallellt med årspremien, antal vid varje debitering. Perioden fram till nästa faktura pro rata.
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button onClick={onClose} disabled={saving} className="text-[11px] text-slate-500 hover:text-slate-300 disabled:opacity-50">
          {progress?.failedKey ? 'Stäng' : 'Avbryt'}
        </button>
        <button
          onClick={() => void confirm()}
          disabled={!valid || saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#20c58f] text-[#fff] disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {saving
            ? `Sparar ${Math.min(progress!.done + 1, items.length)} av ${items.length}`
            : progress?.failedKey
              ? 'Försök igen'
              : isPremium
                ? multi
                  ? `Baka in ${items.length} brickor`
                  : 'Baka in'
                : multi
                  ? `Lägg ${items.length} brickor som tillägg`
                  : 'Lägg som tillägg'}
        </button>
      </div>
    </div>
  )
}
