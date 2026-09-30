// src/components/technician/AddonLabourStep.tsx
// Steget "Arbetstid för att hantera tilläggen" i teknikerns avslut. Visas
// bara när enheten fått NYA tilläggsstationer per år/per månad under
// ärendet. Två varianter:
// - Ny: enheten hade inga tillägg innan. Teknikern anger timmar per år.
// - Befintlig: enheten hade tillägg innan. Nej (timmarna räcker) är förvalt,
//   Ja kräver ett nytt totalt som är större än i dag.
// Timmarna sparas som förslag, kontoret beslutar i avtalskartan. Kundpriset
// kommer alltid från kundens timpris i prislistan.
//
// Tillstånd och sparande: src/hooks/useAddonLabourStep.ts. All matte:
// src/shared/addonEconomics.ts. Komponenten räknar ingenting själv.

import type { CSSProperties, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { AddonLabourStepController } from '../../hooks/useAddonLabourStep'
import { formatDateShortSv, formatDayMonthSv, formatHours, formatKr, monthsLabel } from '../../shared/addonEconomics'

const STRIPES: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, var(--color-slate-700) 0 6px, var(--color-slate-800) 6px 12px)',
}

const SECTION = 'p-3 bg-slate-800/30 border border-slate-700 rounded-xl'
const INPUT =
  'w-24 h-11 px-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f] disabled:opacity-50'

const hoursWord = (h: number) => (h === 1 ? 'timme' : 'timmar')
/** "0,4" (en decimal) */
const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toLocaleString('sv-SE', { maximumFractionDigits: 1 })

function StationName({ name, sub }: { name: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-slate-200">
        <span className="text-[#c084fc]" aria-hidden>●</span>
        <span className="truncate">{name}</span>
      </div>
      {sub}
    </div>
  )
}

function PriceMissing() {
  return (
    <p className="text-xs text-amber-400">
      <span aria-hidden>● </span>Timpriset saknas i kundens prislista. Kontoret lägger in det.
    </p>
  )
}

export default function AddonLabourStep({ step, className = '' }: { step: AddonLabourStepController; className?: string }) {
  if (step.loading && !step.summary) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-400 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Hämtar tilläggen på enheten
      </div>
    )
  }
  const s = step.summary
  const e = step.economics
  if (!step.visible || !s || !e || !s.next_period_start) return null

  const rate = s.hourly_price
  const before = s.labour_hours_before
  const hours = step.chosenHours
  const isNew = step.variant === 'new'
  const pct = Math.max(12, Math.min(88, Math.round(e.yearTimeline.fraction * 100)))
  const fromLabel = `Från ${formatDateShortSv(s.next_period_start)}`
  const day = formatDayMonthSv(s.next_period_start)
  const errorLine = step.showError && step.error ? (
    <p className="text-sm text-red-400" role="alert">{step.error}</p>
  ) : null

  // ─── Variant A: tabell över nya tillägg ─────────────────────────────────
  const newTable = (
    <section className={SECTION}>
      <h4 className="text-sm font-semibold text-white mb-2">Nya tillägg du har satt ut</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="text-left font-normal pb-1">Station</th>
            <th className="text-right font-normal pb-1 pl-2">Antal</th>
            <th className="text-right font-normal pb-1 pl-2">Pris per år</th>
            <th className="text-right font-normal pb-1 pl-2">Per år</th>
          </tr>
        </thead>
        <tbody>
          {e.stationLines.map(({ type: t }) => (
            <tr key={`${t.station_type_id ?? 'x'}-${t.model}`} className="border-t border-slate-700/50">
              <td className="py-1.5"><StationName name={t.station_type_name} /></td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-slate-200 whitespace-nowrap">{t.new} st</td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-slate-300 whitespace-nowrap">
                {t.annual_price != null ? formatKr(t.annual_price) : <span className="text-amber-400">Pris saknas</span>}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-slate-200 whitespace-nowrap">
                {t.annual_price != null ? formatKr(t.annual_price * t.new) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )

  // ─── Variant B: innan, nya, efter ───────────────────────────────────────
  const existingTypes = s.types.filter((t) => t.before > 0 || t.new > 0)
  const includedTypes = s.types.filter((t) => t.included > 0)
  const existingTable = (
    <section className={SECTION}>
      <h4 className="text-sm font-semibold text-white mb-2">Tillägg på enheten</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="text-left font-normal pb-1">Station</th>
            <th className="text-right font-normal pb-1 pl-2">Innan</th>
            <th className="text-right font-normal pb-1 pl-2">Nya</th>
            <th className="text-right font-normal pb-1 pl-2">Efter</th>
          </tr>
        </thead>
        <tbody>
          {existingTypes.map((t) => (
            <tr key={`${t.station_type_id ?? 'x'}-${t.model}`} className="border-t border-slate-700/50 align-top">
              <td className="py-1.5">
                <StationName
                  name={t.station_type_name}
                  sub={t.before_pending > 0 ? (
                    <p className="text-xs text-amber-400 mt-0.5"><span aria-hidden>● </span>väntar på beslut</p>
                  ) : undefined}
                />
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-slate-300">{t.before}</td>
              <td className={`py-1.5 pl-2 text-right tabular-nums ${t.new > 0 ? 'text-[#20c58f] font-medium' : 'text-slate-500'}`}>
                {t.new > 0 ? `+${t.new}` : '0'}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-slate-200">{t.before + t.new}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-600 font-semibold">
            <td className="pt-2 text-white">Stationer totalt</td>
            <td className="pt-2 pl-2 text-right tabular-nums text-slate-200">{e.stationsBefore}</td>
            <td className="pt-2 pl-2 text-right tabular-nums text-[#20c58f]">+{e.stationsNew}</td>
            <td className="pt-2 pl-2 text-right tabular-nums text-white">{e.stationsAfter}</td>
          </tr>
          {includedTypes.map((t) => (
            <tr key={`inc-${t.station_type_id ?? 'x'}-${t.model}`} className="text-slate-500">
              <td className="pt-1.5">
                <span className="block">Ingår i avtalet</span>
                <span className="block text-xs">{t.station_type_name}</span>
              </td>
              <td colSpan={3} className="pt-1.5 pl-2 text-right tabular-nums align-top">{t.included} st</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )

  // ─── Frågan ─────────────────────────────────────────────────────────────
  const newQuestion = (
    <section className={SECTION}>
      <label htmlFor="addon-labour-hours" className="block text-sm font-medium text-slate-200 mb-2">
        Hur mycket arbetstid ska vi debitera för att hantera dessa tillägg?
      </label>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <input
          id="addon-labour-hours"
          type="number"
          inputMode="decimal"
          step={0.5}
          min={0}
          value={step.hoursInput}
          onChange={(ev) => step.setHoursInput(ev.target.value)}
          className={INPUT}
          placeholder=""
        />
        <span className="text-sm font-semibold text-white">timmar per år</span>
        {rate != null && <span className="text-sm text-slate-400">× {formatKr(rate)}</span>}
        {rate != null && (
          <span className="ml-auto text-sm font-semibold text-white tabular-nums">
            {formatKr(e.labourTimeline.totalAnnual)} per år
          </span>
        )}
      </div>
      {errorLine && <div className="mt-2">{errorLine}</div>}
      <p className="text-xs text-slate-400 mt-2">
        Tiden gäller ett helt år: kontroller, byten och rapportering av tilläggsstationerna. Timpriset kommer från kundens prislista.
      </p>
      {rate == null && <div className="mt-2"><PriceMissing /></div>}
    </section>
  )

  const perStation = e.stationsBefore > 0 ? before / e.stationsBefore : null
  const sameRate = perStation != null && before > 0 ? perStation * e.stationsAfter : null
  const radioRow = 'flex items-center gap-3 min-h-[44px] cursor-pointer'
  const existingQuestion = (
    <section className={SECTION}>
      <h4 className="text-sm font-semibold text-white mb-2">Arbetstid för att hantera tilläggen</h4>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-xs text-slate-400">Debiteras idag</p>
          <p className="text-sm font-semibold text-white">{formatHours(before)} h per år</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Kostar kunden</p>
          <p className="text-sm font-semibold text-white">
            {rate != null ? `${formatKr(before * rate)} per år` : <span className="text-amber-400 font-normal">Timpris saknas</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Per station idag</p>
          <p className="text-sm font-semibold text-white">{perStation != null ? `${oneDecimal(perStation)} h per år` : 'Inga stationer'}</p>
        </div>
      </div>

      <fieldset className="border-t border-slate-700/50 pt-2 min-w-0">
        <legend className="float-left w-full text-sm font-medium text-slate-200 mb-1">
          Behöver vi debitera mer tid nu när det blivit {e.stationsAfter} stationer?
        </legend>
        <label className={radioRow}>
          <input
            type="radio"
            name="addon-labour-choice"
            checked={step.choice === 'no'}
            onChange={() => step.setChoice('no')}
            className="w-5 h-5 accent-[#20c58f]"
          />
          <span className="text-sm text-slate-200">
            {before > 0 ? `Nej, ${formatHours(before)} ${hoursWord(before)} per år räcker` : 'Nej, ingen arbetstid behövs'}
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <label className={radioRow}>
            <input
              type="radio"
              name="addon-labour-choice"
              checked={step.choice === 'yes'}
              onChange={() => step.setChoice('yes')}
              className="w-5 h-5 accent-[#20c58f]"
            />
            <span className="text-sm text-slate-200">Ja, nytt totalt:</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step={0.5}
            min={0}
            aria-label="Nytt totalt, timmar per år"
            value={step.yesInput}
            onFocus={() => step.setChoice('yes')}
            onChange={(ev) => {
              step.setChoice('yes')
              step.setYesInput(ev.target.value)
            }}
            className={INPUT}
          />
          <span className="text-sm font-semibold text-white">timmar per år</span>
          {rate != null && <span className="text-sm text-slate-400">× {formatKr(rate)}</span>}
          {rate != null && step.choice === 'yes' && hours != null && (
            <span className="text-sm font-semibold text-white tabular-nums">= {formatKr(e.labourTimeline.totalAnnual)} per år</span>
          )}
        </div>
        {sameRate != null && (
          <p className="text-xs text-slate-400 mt-1">
            Samma tid per station som idag skulle vara ungefär {oneDecimal(sameRate)} timmar per år.
          </p>
        )}
        {errorLine && <div className="mt-2">{errorLine}</div>}
        {rate == null && <div className="mt-2"><PriceMissing /></div>}
      </fieldset>
    </section>
  )

  // ─── Så faktureras det ──────────────────────────────────────────────────
  const row = (label: string, amount: number, key: string) => (
    <div key={key} className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-slate-300 min-w-0">{label}</span>
      <span className="text-slate-200 tabular-nums whitespace-nowrap">{formatKr(amount)}</span>
    </div>
  )
  const nowRows = isNew
    ? [
        row('Stationer', e.stationsNow, 'st'),
        ...(rate != null && hours != null && e.labourDelta > 0 ? [row('Arbetstid', e.labourNow, 'lab')] : []),
      ]
    : [
        ...e.stationLines.map((l) =>
          row(`${l.type.station_type_name}, ${l.type.new} ${l.type.new === 1 ? 'ny' : 'nya'}`, l.timeline.totalNow, `${l.type.station_type_id}-${l.type.model}`)
        ),
        ...(rate != null && e.labourDelta > 0
          ? [row(`${formatHours(e.labourDelta)} ${hoursWord(e.labourDelta)} mer arbetstid`, e.labourNow, 'lab')]
          : []),
      ]
  const annualHours = hours ?? 0
  const billing = (
    <section className={SECTION}>
      <h4 className="text-sm font-semibold text-white mb-2">Så faktureras det</h4>
      <div className="flex h-2.5 gap-[3px] mb-2" aria-hidden>
        <div className="rounded-l-full bg-[#20c58f]" style={{ width: `${pct}%` }} />
        <div className="flex-1 rounded-r-full" style={STRIPES} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#20c58f]">
            {isNew ? `Nu, ${monthsLabel(e.yearTimeline.months)}` : `Nu, bara det nya, ${monthsLabel(e.yearTimeline.months)}`}
          </span>
          {nowRows}
          <div className="flex items-baseline justify-between gap-2 text-xs font-semibold border-t border-slate-700 pt-1">
            <span className="text-white">På den här fakturan</span>
            <span className="text-white tabular-nums whitespace-nowrap">{formatKr(e.invoiceNow)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-300">{fromLabel}</span>
          <span className="text-sm font-semibold text-white tabular-nums">{formatKr(e.annualTotal)} per år</span>
          <span className="text-xs text-slate-400">
            {isNew
              ? 'Egen faktura i samband med avtalets årsfaktura'
              : `Alla ${e.stationsAfter} stationer och ${formatHours(annualHours)} h, egen faktura i samband med årsfakturan`}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        {day ? `Avtalets år börjar ${day}.` : 'Avtalets år börjar vid nästa periodstart.'} Kunden betalar bara för månaderna som är kvar till dess, sedan följer tilläggen avtalets år.
        {!isNew && ' Det kunden redan betalar för i år faktureras inte igen.'}
      </p>
    </section>
  )

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        {isNew && <h3 className="text-base font-semibold text-white">Arbetstid för att hantera tilläggen</h3>}
        {s.unit_name && <p className="text-xs text-slate-400">{s.unit_name}</p>}
      </div>
      {isNew ? newTable : existingTable}
      {isNew ? newQuestion : existingQuestion}
      {billing}
      <p className="text-xs text-amber-400">
        <span aria-hidden>● </span>Kontoret beslutar tilläggen i avtalskartan. Dina timmar följer med som förslag.
      </p>
    </div>
  )
}
