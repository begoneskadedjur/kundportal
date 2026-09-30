// src/components/admin/customers/record/AddonDropPrompt.tsx
// "Besluta tillägg": kontorets beslut om tilläggsstationer i avtalskartan.
// Öppnas av drag till § 5/§ 6 och av panelens brickflöde. Dragzonen är bara
// förval; radiovalet avgör:
//   - Tillägg utöver avtalet (förvalt): egen faktura i samband med avtalets
//     årsfaktura, rör aldrig premie, § 4 eller avtalets marginal.
//   - Lägg till i avtalet: premien höjs i trappan och kostnaden läggs i § 4.
// Per enhet: "Arbetstid för att hantera tilläggen" (timmar per år × kundens
// timpris), förifylld med teknikerns förslag. Besluten körs ett i taget:
// först stationerna per bricka, sedan arbetstiden per enhet. Faller ett
// stannar körningen, de klara ligger kvar beslutade och raden som brast
// pekas ut. All matte via addonEconomics, aldrig lokalt.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import DateField from '../../../ui/DateField'
import Button from '../../../ui/Button'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import { todayKey } from '../../../../utils/contractLifecycle'
import {
  computeAddonCalc,
  formatDateShortSv,
  formatHours,
  formatKr,
  monthsLabel,
  premiumRaise,
  timelineForProposal,
  todayIso,
} from '../../../../shared/addonEconomics'
import type { AddonBrick, AddonUnitDecisionInfo } from '../../../../types/addonStations'

export interface AddonPromptBrick {
  brick: AddonBrick
  unitName: string
}

export type AddonDecisionMode = 'separate' | 'included'

export interface AddonDropPromptState {
  x: number
  y: number
  contractId: string
  contractLabel: string
  bricks: AddonPromptBrick[]
  /** Förval: släpp på premien (§ 6) = Lägg till i avtalet, annars Tillägg utöver avtalet */
  zone: 'premium' | 'equipment'
  /** Avtalets årspremie (för "från A till B kr") */
  annualInForce: number | null
}

interface Props {
  prompt: AddonDropPromptState
  onClose: () => void
  /** Ett beslut per bricka, i ordning. Kastar den stannar körningen. */
  onConfirmBrick: (item: AddonPromptBrick, input: { effectiveFrom: string; unitPriceAnnual: number; mode: AddonDecisionMode }) => Promise<void>
  /** Arbetstiden per enhet, efter stationsbesluten. Kastar den stannar körningen. */
  onConfirmLabour: (unit: { unitId: string; unitName: string }, input: { hours: number; mode: AddonDecisionMode; effectiveFrom: string }) => Promise<void>
  /** Allt beslutat: en enda toast */
  onAllDone: (summary: { bricks: number; stations: number; annualKr: number; mode: AddonDecisionMode }) => void
}

export const brickKey = (b: AddonBrick) => `${b.unitId}|${b.stationTypeId ?? ''}|${b.model}`
const labourKey = (unitId: string) => `labour|${unitId}`

const parseNum = (v: string | undefined) => Number((v ?? '').replace(/\s/g, '').replace(',', '.'))
const nf = (n: number) => Math.round(n).toLocaleString('sv-SE')

export default function AddonDropPrompt({ prompt, onClose, onConfirmBrick, onConfirmLabour, onAllDone }: Props) {
  const [mode, setMode] = useState<AddonDecisionMode>(prompt.zone === 'premium' ? 'included' : 'separate')
  const [date, setDate] = useState(todayKey())
  const [priceByKey, setPriceByKey] = useState<Record<string, string>>({})
  const [missingByKey, setMissingByKey] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [infoByUnit, setInfoByUnit] = useState<Record<string, AddonUnitDecisionInfo | null>>({})
  const [hoursByUnit, setHoursByUnit] = useState<Record<string, string>>({})
  const [infoLoading, setInfoLoading] = useState(true)
  const [progress, setProgress] = useState<{ done: number; failedKey: string | null; error: string | null } | null>(null)
  const items = prompt.bricks
  const included = mode === 'included'

  // Enheterna i brickorna, i brickornas ordning
  const units = useMemo(() => {
    const seen = new Map<string, string>()
    for (const { brick, unitName } of items) if (!seen.has(brick.unitId)) seen.set(brick.unitId, unitName)
    return Array.from(seen, ([unitId, unitName]) => ({ unitId, unitName }))
  }, [items])
  const unitsKey = units.map((u) => u.unitId).join(',')

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

  // Underlag per enhet: teknikerns förslag, timmar i dag, timpris, nästa periodstart
  useEffect(() => {
    let cancelled = false
    setInfoLoading(true)
    Promise.all(units.map(async (u) => [u.unitId, await AddonStationBillingService.getUnitDecisionInfo(u.unitId, prompt.contractId).catch(() => null)] as const))
      .then((rows) => {
        if (cancelled) return
        const info: Record<string, AddonUnitDecisionInfo | null> = {}
        const hours: Record<string, string> = {}
        for (const [unitId, d] of rows) {
          info[unitId] = d
          // Talfältet (type=number) vill ha punkt, inte komma
          if (d) hours[unitId] = String(d.proposal_hours ?? d.labour_hours_now ?? 0)
        }
        setInfoByUnit(info)
        setHoursByUnit(hours)
      })
      .finally(() => {
        if (!cancelled) setInfoLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitsKey, prompt.contractId])

  const price = (key: string) => parseNum(priceByKey[key])
  const allPriced = items.every(({ brick }) => price(brickKey(brick)) > 0)
  const stations = items.reduce((s, { brick }) => s + brick.count, 0)
  const stationsAnnual = items.reduce((s, { brick }) => s + (price(brickKey(brick)) > 0 ? price(brickKey(brick)) * brick.count : 0), 0)

  // Arbetstiden per enhet: timmar, timmar i dag, timpris
  const labour = units.map((u) => {
    const info = infoByUnit[u.unitId] ?? null
    const raw = hoursByUnit[u.unitId]
    const hours = raw == null || raw.trim() === '' ? 0 : parseNum(raw)
    const now = info?.labour_hours_now ?? 0
    const rate = info?.hourly_price ?? null
    return {
      ...u,
      info,
      hours: Number.isFinite(hours) && hours >= 0 ? hours : NaN,
      now,
      rate,
      annual: rate != null && Number.isFinite(hours) ? hours * rate : 0,
      increase: rate != null && Number.isFinite(hours) ? Math.max(hours - now, 0) * rate : 0,
    }
  })
  const hoursValid = labour.every((l) => !l.info || Number.isFinite(l.hours))
  // Timpris saknas och timmarna ändras: RPC:n skulle kasta, säg det innan
  const rateMissing = labour.some((l) => l.info && l.rate == null && Number.isFinite(l.hours) && l.hours !== l.now)
  // Enheter där arbetstiden ska beslutas (0 h och 0 h i dag = inget att göra)
  const labourSteps = labour.filter((l) => l.info && Number.isFinite(l.hours) && !(l.hours === 0 && l.now === 0) && !(l.rate == null && l.hours === l.now))
  const labourAnnual = labour.reduce((s, l) => s + l.annual, 0)
  const labourIncrease = labour.reduce((s, l) => s + l.increase, 0)
  const perYear = stationsAnnual + labourAnnual

  // Nästa periodstart och slutdatum: samma avtal, läs första enhetens underlag
  const firstInfo = labour.find((l) => l.info)?.info ?? null
  const nextStart = firstInfo?.next_period_start ?? null
  const today = todayIso()

  // Det som faktureras nu, pro rata till nästa periodstart (samma formel som RPC:n)
  const firstPeriod = useMemo(() => {
    if (!nextStart) return null
    let total = 0
    let fraction = 0
    let months = 0
    for (const { brick } of items) {
      const p = price(brickKey(brick))
      if (!(p > 0)) continue
      const t = timelineForProposal({ fromDate: today, startDate: nextStart, perUnitAnnual: p, quantityNow: brick.count, unit: 'station', model: brick.model })
      total += t.totalNow
      fraction = t.fraction
      months = t.months
    }
    for (const l of labour) {
      if (l.rate == null || !Number.isFinite(l.hours)) continue
      const delta = Math.max(l.hours - l.now, 0)
      const t = timelineForProposal({ fromDate: today, startDate: nextStart, perUnitAnnual: l.rate, quantityNow: delta, quantityAnnual: l.hours, unit: 'timme' })
      total += t.totalNow
      fraction = t.fraction
      months = t.months
    }
    return { total, fraction, months }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextStart, today, items, priceByKey, hoursByUnit, infoByUnit])

  const raise = premiumRaise(prompt.annualInForce, stationsAnnual + labourIncrease)

  // Tilläggets kalkyl: utrustningen för brickornas stationer (obeslutade, per typ)
  const calc = useMemo(() => {
    let equipmentCost = 0
    for (const u of units) {
      const info = infoByUnit[u.unitId]
      if (!info) continue
      const types = new Set(items.filter((i) => i.brick.unitId === u.unitId).map((i) => i.brick.stationTypeId ?? ''))
      equipmentCost += info.pending_articles.filter((a) => types.has(a.station_type_id ?? '')).reduce((s, a) => s + (Number(a.cost) || 0), 0)
    }
    const totalHours = labour.reduce((s, l) => s + (Number.isFinite(l.hours) ? l.hours : 0), 0)
    const pricedHours = labour.reduce((s, l) => s + (l.rate != null && Number.isFinite(l.hours) ? l.hours : 0), 0)
    return computeAddonCalc({
      equipmentCost,
      annualStationRevenue: stationsAnnual,
      labourHours: totalHours,
      // Viktat timpris över enheterna (oftast samma prislista)
      labourRate: pricedHours > 0 ? labourAnnual / pricedHours : firstInfo?.hourly_price ?? null,
      labourCostPerHour: firstInfo?.hourly_cost ?? null,
      firstPeriodRevenue: firstPeriod?.total ?? 0,
      firstPeriodFraction: firstPeriod?.fraction ?? 0,
      startDate: nextStart,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, infoByUnit, items, hoursByUnit, priceByKey, firstPeriod, nextStart])

  const totalSteps = items.length + labourSteps.length
  const valid = !loading && !infoLoading && allPriced && hoursValid && !rateMissing && (!included || !!date)
  const saving = progress != null && progress.failedKey == null && progress.done < totalSteps

  const confirm = async () => {
    if (!valid) return
    // Fortsätt efter ett fel: hoppa över de steg som redan blev klara
    const startAt = progress?.failedKey ? progress.done : 0
    setProgress({ done: startAt, failedKey: null, error: null })
    let done = startAt
    const effectiveFrom = included ? date : todayKey()
    for (let i = startAt; i < totalSteps; i++) {
      const isBrick = i < items.length
      const key = isBrick ? brickKey(items[i].brick) : labourKey(labourSteps[i - items.length].unitId)
      try {
        if (isBrick) {
          const item = items[i]
          await onConfirmBrick(item, { effectiveFrom, unitPriceAnnual: price(brickKey(item.brick)), mode })
        } else {
          const l = labourSteps[i - items.length]
          await onConfirmLabour({ unitId: l.unitId, unitName: l.unitName }, { hours: l.hours, mode, effectiveFrom })
        }
        done = i + 1
        setProgress({ done, failedKey: null, error: null })
      } catch (err) {
        setProgress({ done, failedKey: key, error: err instanceof Error ? err.message : 'Beslutet kunde inte sparas' })
        return
      }
    }
    onAllDone({ bricks: items.length, stations, annualKr: included ? stationsAnnual + labourIncrease : perYear, mode })
    onClose()
  }

  const stepDone = (key: string) => {
    if (!progress) return false
    const idx = items.findIndex((i) => brickKey(i.brick) === key)
    const li = labourSteps.findIndex((l) => labourKey(l.unitId) === key)
    const at = idx >= 0 ? idx : li >= 0 ? items.length + li : -1
    return at >= 0 && at < progress.done
  }

  // Rutan öppnas vid klicket men får aldrig hamna utanför skärmen. Mät
  // rutan och kläm in den med 12 px marginal.
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: Math.max(12, Math.min(prompt.x, window.innerWidth - 460)),
    top: Math.max(12, Math.min(prompt.y, window.innerHeight - 560)),
  })
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const place = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setPos({
        left: Math.max(12, Math.min(prompt.x, window.innerWidth - w - 12)),
        top: Math.max(12, Math.min(prompt.y, window.innerHeight - h - 12)),
      })
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    window.addEventListener('resize', place)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [prompt.x, prompt.y])

  // Esc stänger (inte mitt i en körning)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onClose])

  const multiUnit = units.length > 1
  const busyLoading = loading || infoLoading
  const paybackTone = calc.paybackNever ? 'text-amber-400' : 'text-[#20c58f]'
  const paybackText = calc.paybackNever
    ? 'Betalar inte tillbaka utrustningen med dagens priser'
    : calc.paybackLabel === 'direkt'
      ? 'Betalt tillbaka direkt'
      : `Betalt tillbaka cirka ${calc.paybackLabel}`

  const radioClass = 'mt-[3px] h-3.5 w-3.5 border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]'

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Besluta tillägg"
      className="fixed z-[130] w-[460px] max-w-[94vw] max-h-[calc(100vh-24px)] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-100">Besluta tillägg</h4>
        <p className="text-xs text-slate-400 mt-0.5 truncate" title={`${units.map((u) => u.unitName).join(', ')} · ${prompt.contractLabel}`}>
          {units.map((u) => u.unitName).join(', ')} · {prompt.contractLabel}
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* Vad teknikern satte ut */}
        <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="text-xs font-medium text-slate-400 mb-2">Vad teknikern satte ut</div>
          <div className="space-y-1">
            {units.map((u) => {
              const l = labour.find((x) => x.unitId === u.unitId)!
              const unitBricks = items.filter((i) => i.brick.unitId === u.unitId)
              const lKey = labourKey(u.unitId)
              const lFailed = progress?.failedKey === lKey
              return (
                <div key={u.unitId} className={multiUnit ? 'pt-1 first:pt-0' : ''}>
                  {multiUnit && <div className="text-[11px] font-semibold text-slate-300 mb-0.5 truncate">{u.unitName}</div>}
                  {unitBricks.map(({ brick, unitName }) => {
                    const key = brickKey(brick)
                    const p = price(key)
                    const missing = missingByKey[key] && !(p > 0)
                    const failed = progress?.failedKey === key
                    const isDone = stepDone(key)
                    return (
                      <div key={key} className={`flex items-center gap-2 text-xs py-0.5 rounded ${failed ? 'bg-red-500/10' : ''}`}>
                        <span
                          className={`shrink-0 ${isDone ? 'text-[#20c58f]' : failed ? 'text-red-400' : missing ? 'text-amber-400' : 'text-[#c084fc]'}`}
                          aria-hidden
                        >
                          ●
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-200" title={`${brick.stationTypeName} · ${unitName}`}>
                          {brick.stationTypeName}
                          {brick.model === 'per_month' && <span className="text-slate-500"> · per månad</span>}
                        </span>
                        <span className="w-10 text-right tabular-nums text-slate-300 shrink-0">{brick.count} st</span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-slate-400">
                          <input
                            value={priceByKey[key] ?? ''}
                            onChange={(e) => setPriceByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                            inputMode="decimal"
                            disabled={isDone || saving}
                            className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs text-right rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f] disabled:opacity-50"
                            placeholder={loading ? '…' : 'pris'}
                            aria-label={`Årspris per station ${brick.stationTypeName} ${unitName}`}
                          />
                          kr per år
                        </span>
                        <span className="w-[4.5rem] text-right tabular-nums text-slate-100 shrink-0">{p > 0 ? formatKr(p * brick.count) : ''}</span>
                      </div>
                    )
                  })}
                  {/* Arbetstid för att hantera tilläggen, per enhet */}
                  {l.info ? (
                    <div className={`flex items-start gap-2 text-xs py-0.5 rounded ${lFailed ? 'bg-red-500/10' : ''}`}>
                      <span className={`shrink-0 ${stepDone(lKey) ? 'text-[#20c58f]' : lFailed ? 'text-red-400' : l.rate == null ? 'text-amber-400' : 'text-slate-500'}`} aria-hidden>
                        ●
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-slate-200">Arbetstid för att hantera tilläggen</span>
                        <span className="block text-[11px] text-slate-500 truncate">
                          {l.info.proposal_case_number ? `Teknikerns förslag vid ${l.info.proposal_case_number}` : 'Inget förslag från teknikern'}
                          {l.now > 0 ? ` · ${formatHours(l.now)} h i dag` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1 text-slate-400">
                        <input
                          type="number"
                          step={0.5}
                          min={0}
                          value={hoursByUnit[u.unitId] ?? ''}
                          onChange={(e) => setHoursByUnit((prev) => ({ ...prev, [u.unitId]: e.target.value }))}
                          disabled={stepDone(lKey) || saving}
                          className="w-14 px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs text-right rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f] disabled:opacity-50"
                          aria-label={`Timmar per år för att hantera tilläggen på ${u.unitName}`}
                        />
                        {l.rate != null ? `h × ${nf(l.rate)}` : 'h'}
                      </span>
                      <span className="w-[4.5rem] text-right tabular-nums text-slate-100 shrink-0">{l.rate != null ? formatKr(l.annual) : ''}</span>
                    </div>
                  ) : !infoLoading ? (
                    <div className="text-[11px] text-slate-500 pl-4">Arbetstiden kunde inte läsas för enheten.</div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="flex items-baseline gap-2 mt-2 pt-2 border-t border-slate-700/50 text-xs">
            <span className="flex-1 font-medium text-slate-300">Per år</span>
            <span className="tabular-nums font-semibold text-slate-100">{busyLoading ? '' : formatKr(perYear)}</span>
          </div>
          {busyLoading && (
            <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> hämtar priser och arbetstid
            </span>
          )}
          {!loading && !allPriced && <p className="mt-1 text-[11px] text-amber-400">Pris saknas i prislistan på en eller flera rader. Ange pris.</p>}
          {!infoLoading && rateMissing && (
            <p className="mt-1 text-[11px] text-amber-400">Timpris saknas i kundens prislista (tjänst 135). Lägg in det innan arbetstiden ändras.</p>
          )}
          {!hoursValid && <p className="mt-1 text-[11px] text-amber-400">Ange timmar som 0 eller mer.</p>}
          {progress?.error && (
            <p className="mt-1 text-[11px] text-red-400">
              {progress.error} De {progress.done} första stegen är sparade, resten står kvar.
            </p>
          )}
        </section>

        {/* Hur ska tillägget faktureras? */}
        <fieldset className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl" disabled={saving || (progress?.failedKey != null && progress.done > 0)}>
          <legend className="sr-only">Hur ska tillägget faktureras?</legend>
          <div className="text-xs font-medium text-slate-400 mb-2" aria-hidden>
            Hur ska tillägget faktureras?
          </div>
          <label className="flex items-start gap-2 cursor-pointer mb-2.5">
            <input type="radio" name="addon-decision-mode" checked={mode === 'separate'} onChange={() => setMode('separate')} className={radioClass} />
            <span className="text-xs">
              <span className="block font-medium text-slate-100">Tillägg utöver avtalet</span>
              <span className="block text-slate-300 mt-0.5">
                Egen faktura i samband med avtalets årsfaktura
                {nextStart ? `, första ${formatDateShortSv(nextStart)}` : ''}.
                {firstPeriod && firstPeriod.total > 0 && (
                  <>
                    {' '}
                    Nu faktureras <span className="tabular-nums">{formatKr(firstPeriod.total)}</span> för {monthsLabel(firstPeriod.months)} på etableringsärendet.
                  </>
                )}
              </span>
              <span className="block text-slate-500 mt-0.5">
                Premien och avtalets innehåll rörs inte. Tilläggen slutar när avtalet slutar. Utrustning och arbetstid räknas i tilläggets kalkyl.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" name="addon-decision-mode" checked={mode === 'included'} onChange={() => setMode('included')} className={radioClass} />
            <span className="text-xs">
              <span className="block font-medium text-slate-100">Lägg till i avtalet</span>
              <span className="block text-slate-300 mt-0.5 tabular-nums">
                Årspremien höjs med {formatKr(raise.add)}
                {prompt.annualInForce != null ? `, från ${nf(raise.from)} till ${formatKr(raise.to)}` : ''}, och faktureras med avtalet.
              </span>
              <span className="block text-slate-500 mt-0.5">
                Stationerna och arbetstiden blir en del av avtalets innehåll, och kostnaden läggs i § 4.
              </span>
            </span>
          </label>
          {included && (
            <label className="block mt-2.5 pl-5">
              <span className="block text-xs font-medium text-slate-400 mb-1">Gäller från</span>
              <DateField
                value={date}
                onChange={setDate}
                aria-label="Gäller från"
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
            </label>
          )}
        </fieldset>

        {/* Tilläggets kalkyl (intern) */}
        <section className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
          <div className="text-xs font-medium text-slate-400 mb-1.5">Tilläggets kalkyl</div>
          {busyLoading ? (
            <span className="text-[11px] text-slate-500">räknar</span>
          ) : (
            <>
              <div className={`text-xs font-medium ${paybackTone}`}>
                <span aria-hidden>● </span>
                {paybackText}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                Utrustning {formatKr(calc.equipmentCost)} en gång · intäkt {formatKr(calc.annualRevenue)} per år · arbetstid {formatKr(calc.annualLabourCost)} per år
              </div>
            </>
          )}
        </section>
      </div>

      <div className="px-4 py-2.5 border-t border-slate-700/50 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          {progress?.failedKey ? 'Stäng' : 'Avbryt'}
        </Button>
        <Button variant="primary" size="sm" onClick={() => void confirm()} disabled={!valid || saving} loading={saving}>
          {saving ? `Sparar ${Math.min(progress!.done + 1, totalSteps)} av ${totalSteps}` : progress?.failedKey ? 'Försök igen' : 'Besluta'}
        </Button>
      </div>
    </div>
  )
}
