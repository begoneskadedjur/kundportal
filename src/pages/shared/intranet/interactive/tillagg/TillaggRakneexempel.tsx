// src/pages/shared/intranet/interactive/tillagg/TillaggRakneexempel.tsx
// Guiden Tilläggsstationer: räkneexemplet med 4 mekaniska fällor. Läsaren
// kan byta utsättningsdag och timmar och se hur Betalas nu, årsbeloppet och
// återbetalningen ändras. All matte via raknaExempel (addonEconomics).

import { useMemo, useState } from 'react'
import { Calculator } from 'lucide-react'
import AddonBillingTimeline from '../../../../../components/shared/AddonBillingTimeline'
import { formatDateShortSv, formatKr, monthsLabel } from '../../../../../shared/addonEconomics'
import { EXEMPEL, raknaExempel } from './tillaggExempel'
import { SECTION, SUB_SECTION } from './tillaggShared'

const DATUM = [
  { value: '2026-07-02', label: '2 juli 2026 (dagen efter att avtalsåret börjat)' },
  { value: '2026-09-29', label: '29 september 2026 (exemplet)' },
  { value: '2027-01-15', label: '15 januari 2027' },
  { value: '2027-05-01', label: '1 maj 2027' },
  { value: '2027-06-20', label: '20 juni 2027 (strax före nytt avtalsår)' },
]
const TIMMAR = [0, 1, 2, 3, 4]

const SELECT =
  'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]'

function Rad({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 text-sm ${strong ? 'font-semibold border-t border-slate-700 pt-1.5 mt-1' : ''}`}>
      <span className={strong ? 'text-white' : 'text-slate-300'}>{label}</span>
      <span className={`tabular-nums whitespace-nowrap ${strong ? 'text-white' : 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

export default function TillaggRakneexempel() {
  const [datum, setDatum] = useState<string>(EXEMPEL.placedOn)
  const [timmar, setTimmar] = useState<number>(EXEMPEL.hours)
  const r = useMemo(() => raknaExempel(datum, timmar), [datum, timmar])
  const arFran = formatDateShortSv(EXEMPEL.periodStart)
  const internArbetstid = timmar * EXEMPEL.hourlyCost
  const arExemplet = datum === EXEMPEL.placedOn && timmar === EXEMPEL.hours

  return (
    <div className="my-6 rounded-xl border border-[#20c58f]/30 overflow-hidden">
      <div className="px-4 py-3 bg-[#20c58f]/10 border-b border-[#20c58f]/20 flex items-center gap-2">
        <Calculator className="w-4 h-4 text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Exempel: en enhet med 4 mekaniska fällor</p>
      </div>

      <div className="p-4 space-y-3 bg-slate-900/40">
        {/* Förutsättningar */}
        <div className={SECTION}>
          <p className="text-sm font-semibold text-white mb-2">Förutsättningar</p>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-sm text-slate-300">
            <li>Avtalsåret börjar <span className="text-white">1 juli</span></li>
            <li>Kundens pris <span className="text-white tabular-nums">{formatKr(EXEMPEL.stationPrice)}</span> per station och år</li>
            <li>Kundens timpris <span className="text-white tabular-nums">{formatKr(EXEMPEL.hourlyPrice)}</span></li>
            <li>Vår interna timkostnad <span className="text-white tabular-nums">{formatKr(EXEMPEL.hourlyCost)}</span></li>
            <li>Utrustningen kostar oss <span className="text-white tabular-nums">{formatKr(EXEMPEL.equipmentCost)}</span> en gång</li>
          </ul>
        </div>

        {/* Prova själv */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-slate-400 mb-1">Stationerna sätts ut</span>
            <select value={datum} onChange={(e) => setDatum(e.target.value)} className={SELECT}>
              {DATUM.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-400 mb-1">Teknikerns svar: arbetstid per år</span>
            <select value={timmar} onChange={(e) => setTimmar(Number(e.target.value))} className={SELECT}>
              {TIMMAR.map((h) => (
                <option key={h} value={h}>{h} {h === 1 ? 'timme' : 'timmar'} per år{h === EXEMPEL.hours ? ' (exemplet)' : ''}</option>
              ))}
            </select>
          </label>
        </div>
        {!arExemplet && (
          <button
            type="button"
            onClick={() => { setDatum(EXEMPEL.placedOn); setTimmar(EXEMPEL.hours) }}
            className="text-xs text-slate-400 underline decoration-dotted hover:text-white"
          >
            Tillbaka till exemplet
          </button>
        )}

        {/* Tidslinjerna, samma komponent som i Ekonomi-fliken */}
        <div className={SECTION}>
          <p className="text-sm font-semibold text-white mb-1">{EXEMPEL.stationType} · {EXEMPEL.count} st</p>
          <AddonBillingTimeline timeline={r.stations} />
          {timmar > 0 && (
            <>
              <p className="text-sm font-semibold text-white mt-4 mb-1">Arbetstid för att hantera tilläggen · {timmar} h per år</p>
              <AddonBillingTimeline timeline={r.labour} />
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Nu */}
          <div className={SECTION}>
            <p className="text-sm font-semibold text-[#20c58f]">Nu, {monthsLabel(r.stations.months)}</p>
            <p className="text-xs text-slate-400 mb-2">{r.stations.days} dagar av 365 · på merförsäljningsfakturan</p>
            <Rad label={`${EXEMPEL.count} × ${formatKr(r.stations.perUnitNow)}`} value={formatKr(r.stations.totalNow)} />
            {timmar > 0 && <Rad label={`Arbetstid ${timmar} h × ${formatKr(r.labour.perUnitNow)}`} value={formatKr(r.labour.totalNow)} />}
            <Rad label="På fakturan nu" value={formatKr(r.nowTotal)} strong />
          </div>
          {/* Sedan */}
          <div className={SECTION}>
            <p className="text-sm font-semibold text-slate-200">Från {arFran}, varje avtalsår</p>
            <p className="text-xs text-slate-400 mb-2">egen faktura i samband med årsfakturan</p>
            <Rad label={`${EXEMPEL.count} × ${formatKr(EXEMPEL.stationPrice)}`} value={formatKr(r.stations.totalAnnual)} />
            {timmar > 0 && <Rad label={`Arbetstid ${timmar} h × ${formatKr(EXEMPEL.hourlyPrice)}`} value={formatKr(r.labour.totalAnnual)} />}
            <Rad label="Per år" value={formatKr(r.annualTotal)} strong />
          </div>
        </div>

        {/* Intern kalkyl */}
        <div className={SUB_SECTION}>
          <p className="text-sm font-semibold text-white mb-1">Tilläggets kalkyl (intern, kunden ser den aldrig)</p>
          <Rad label="Utrustning, en gång" value={formatKr(EXEMPEL.equipmentCost)} />
          <Rad label={`Arbetstid internt, ${timmar} × ${formatKr(EXEMPEL.hourlyCost)} per år`} value={formatKr(internArbetstid)} />
          <p className={`text-sm font-medium mt-2 ${r.calc.paybackNever ? 'text-amber-400' : 'text-[#20c58f]'}`}>
            <span aria-hidden>● </span>
            {r.calc.paybackNever
              ? 'Betalar inte tillbaka utrustningen med dagens priser'
              : r.calc.paybackLabel === 'direkt'
                ? 'Betalt tillbaka direkt'
                : `Betalt tillbaka cirka ${r.calc.paybackLabel}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Kunden betalar {formatKr(EXEMPEL.hourlyPrice)} per timme medan timmen kostar oss {formatKr(EXEMPEL.hourlyCost)}. Det är känt och accepterat, stationerna bär resten.
          </p>
        </div>

        <p className="text-xs text-slate-400">
          Varför {formatKr(r.stations.perUnitNow)} och inte {formatKr(EXEMPEL.stationPrice)}? Kunden betalar bara för dagarna fram till 1 juli:
          {' '}{formatKr(EXEMPEL.stationPrice)} × {r.stations.days} / 365. Från 1 juli betalar kunden hela årspriset.
        </p>
      </div>
    </div>
  )
}
