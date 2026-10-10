// src/pages/shared/intranet/interactive/leads/TipsbonusRaknare.tsx
// Leadsguiderna: räknare för tipsbonusen. Läser de aktuella inställningarna i commission_settings
// (alla inloggade får läsa) och räknar med samma regel som databasen (src/utils/tipsbonus.ts).
// Går inställningarna inte att läsa används startvärdena från etapp 7 och det står i rutan.

import { useEffect, useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { ProvisionService } from '../../../../../services/provisionService'
import type { TipsbonusSettings } from '../../../../../types/provision'
import { beraknaTipsbonus } from '../../../../../utils/tipsbonus'
import { lasVariant } from './leadsVariant'

const STARTVARDEN: TipsbonusSettings = {
  aktiv: false,
  procent: 5,
  minBelopp: 500,
  maxBelopp: 5000,
  minPremie: 0,
  utokning: true,
  baraTekniker: false,
  gallerFran: '',
}

const KR = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
const kr = (n: number) => `${KR.format(n)} kr`
const procentText = (p: number) => `${String(p).replace('.', ',')} %`

export default function TipsbonusRaknare({ variant }: { variant?: string }) {
  const v = lasVariant(variant)
  const [s, setS] = useState<TipsbonusSettings | null>(null)
  const [live, setLive] = useState(true)
  const [premie, setPremie] = useState(30000)

  useEffect(() => {
    let avbruten = false
    ProvisionService.getTipsbonusSettings()
      .then((r) => !avbruten && setS(r))
      .catch(() => {
        if (avbruten) return
        setS(STARTVARDEN)
        setLive(false)
      })
    return () => {
      avbruten = true
    }
  }, [])

  if (!s) {
    return <div className="my-5 h-48 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" aria-busy="true" />
  }

  const bonus = beraknaTipsbonus(premie, s)
  const ratt = Math.round(premie * s.procent) / 100
  const forklaring =
    premie <= 0
      ? 'Ingen årspremie, ingen bonus.'
      : premie < s.minPremie
        ? `Under lägsta årspremie för bonus (${kr(s.minPremie)}). Ingen bonus.`
        : s.minBelopp > 0 && ratt < s.minBelopp
          ? `${procentText(s.procent)} av ${kr(premie)} är ${kr(ratt)}. Det höjs till lägsta beloppet ${kr(s.minBelopp)}.`
          : s.maxBelopp > 0 && ratt > s.maxBelopp
            ? `${procentText(s.procent)} av ${kr(premie)} är ${kr(ratt)}. Det sänks till taket ${kr(s.maxBelopp)}.`
            : `${procentText(s.procent)} av ${kr(premie)}.`

  const villkor = [
    s.baraTekniker ? 'Bara den som tipsar och har rollen tekniker får bonus.' : 'Den som tipsar får bonus, oavsett roll.',
    'Ingen bonus om du själv äger leaden när den vinns.',
    s.utokning ? 'Utökning hos en befintlig kund räknas.' : 'Utökning hos en befintlig kund räknas inte, bara nya avtal.',
    ...(s.minPremie > 0 ? [`Årspremien måste vara minst ${kr(s.minPremie)}.`] : []),
    'Underlaget är avtalets årspremie om avtalet är kopplat, annars årspremien på leaden.',
  ]

  return (
    <div className="my-5 p-4 bg-slate-800/30 border border-slate-700 rounded-xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Icon name="lead.tips" size={20} className="text-[#20c58f]" /> Räkna på tipsbonusen
        </p>
        <p className={`text-xs flex items-center gap-1.5 ${s.aktiv ? 'text-[#20c58f]' : 'text-amber-300'}`}>
          <span className={`w-2 h-2 rounded-full ${s.aktiv ? 'bg-[#20c58f]' : 'bg-amber-400'}`} aria-hidden />
          {!live ? 'Exempelvärden' : s.aktiv ? `Påslagen${s.gallerFran ? `, för leads vunna från ${s.gallerFran}` : ''}` : 'Inte påslagen just nu'}
        </p>
      </div>

      <div>
        <label htmlFor={`tb-premie-${v}`} className="flex items-baseline justify-between gap-2 text-xs text-slate-400 mb-1">
          <span>Årspremie för det nya avtalet</span>
          <span className="font-mono text-sm text-white">{kr(premie)}</span>
        </label>
        <input
          id={`tb-premie-${v}`}
          type="range"
          min={0}
          max={150000}
          step={1000}
          value={premie}
          onChange={(e) => setPremie(Number(e.target.value))}
          className="w-full accent-[#20c58f]"
        />
        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
          <span>0 kr</span>
          <span>150 000 kr</span>
        </div>
      </div>

      <div className="p-3 bg-slate-900/40 border border-slate-700/60 rounded-xl" aria-live="polite">
        <p className="text-xs text-slate-400">Tipsbonus</p>
        <p className="text-2xl font-bold text-white font-mono">{kr(bonus)}</p>
        <p className="text-sm text-slate-300 mt-1">{forklaring}</p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Procent</dt>
          <dd className="text-white font-mono">{procentText(s.procent)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Lägsta belopp</dt>
          <dd className="text-white font-mono">{s.minBelopp > 0 ? kr(s.minBelopp) : 'Inget'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Tak</dt>
          <dd className="text-white font-mono">{s.maxBelopp > 0 ? kr(s.maxBelopp) : 'Inget tak'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Lägsta årspremie</dt>
          <dd className="text-white font-mono">{s.minPremie > 0 ? kr(s.minPremie) : 'Ingen'}</dd>
        </div>
      </dl>

      <ul className="space-y-1.5">
        {villkor.map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] mt-2 flex-shrink-0" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-slate-300 leading-relaxed pt-3 border-t border-slate-700/50">
        Bonusen bokförs när leaden vinns och blir klar för utbetalning när kundens första faktura är betald. Därefter betalas den
        ut som din övriga provision.
      </p>
      <p className="text-xs text-slate-500">
        {!live
          ? 'Inställningarna kunde inte läsas, så räknaren visar exempelvärden.'
          : v === 'kontor'
            ? 'Räknaren visar de inställningar som gäller nu. Admin ändrar dem under Inställningar på Provisioner.'
            : 'Räknaren visar de inställningar som gäller nu. Procent, lägsta belopp och tak bestäms av ledningen och kan ändras.'}
      </p>
    </div>
  )
}
