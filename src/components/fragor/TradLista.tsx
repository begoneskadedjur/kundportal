// src/components/fragor/TradLista.tsx
// Listan i Frågor och uppdrag: grupper med rubrik, förklaring och rader. Raden visar
// ämnet, status som punkt och text, senaste repliken, tid, kund och vem som skrev.

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../icons/Icon'
import { amne, bilagorText, citat, franTillText, tidKort, type Mig, type Status, type Trad } from './fragorLogik'
import { Initial, StatusText } from './fragorUi'

export interface ListRad {
  trad: Trad
  status: Status
  olasta: number
}

export interface ListUndergrupp {
  rubrik: string
  rader: ListRad[]
}

export interface ListGrupp {
  nyckel: string
  rubrik: string
  beskrivning: string
  ikon: IconName
  /** Färg på ikonen i rubriken */
  ikonFarg?: string
  undergrupper: ListUndergrupp[]
  /** Visas hopfälld tills man öppnar den */
  hopfalld?: boolean
  /** Text till höger om antalet, t.ex. "senaste 30 dagarna" */
  extra?: string
  /** Visa fler längst ned */
  fler?: { text: string; onKlick: () => void }
  /** Ersätter antalet (t.ex. totalt antal klara) */
  antal?: number
}

interface Props {
  grupper: ListGrupp[]
  valdId: string | null
  onValj: (trad: Trad) => void
  mig: Mig
  visaNummer?: boolean
}

function Rad({ rad, vald, onValj, mig, visaNummer }: { rad: ListRad; vald: boolean; onValj: () => void; mig: Mig; visaNummer?: boolean }) {
  const { trad, status, olasta } = rad
  const sista = trad.alla[trad.alla.length - 1]
  const motpart = trad.root.author_id === mig.id
    ? (trad.root.mentioned_user_names[0] || trad.svar.find(s => s.author_id !== mig.id)?.author_name || '')
    : trad.root.author_name
  const bilagor = bilagorText(trad)
  const ammne = amne(trad)
  const senast = trad.alla.length > 1 ? citat(sista) : ''
  return (
    <button
      type="button"
      onClick={onValj}
      aria-current={vald ? 'true' : undefined}
      className={`w-full grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[36px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-start px-4 py-3 text-left border-l-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
        vald ? 'border-l-[#20c58f] bg-[#20c58f]/10' : 'border-l-transparent hover:bg-slate-800/60'
      }`}
    >
      {motpart ? <Initial namn={motpart} /> : (
        <span aria-hidden="true" className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
          <Icon name="dok.omnamnd" size={16} />
        </span>
      )}
      <span className="min-w-0 flex flex-col gap-1">
        <span className="flex items-center gap-2 min-w-0">
          {olasta > 0 && <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" aria-label={`${olasta} olästa`} />}
          <span className={`text-[15px] leading-snug text-white truncate ${olasta > 0 ? 'font-bold' : 'font-semibold'}`}>{ammne}</span>
        </span>
        <StatusText ton={status.ton}>{status.text}</StatusText>
        {senast && <span className="text-sm text-slate-400 truncate">&quot;{senast}&quot;</span>}
        <span className="sm:hidden text-sm text-slate-400 truncate">
          {tidKort(trad.senastAt)}, {trad.arende.kund}, {franTillText(trad, mig)}
        </span>
      </span>
      <span className="hidden sm:flex flex-col items-end gap-1 max-w-[200px] text-right">
        <span className="font-mono text-sm text-slate-400 whitespace-nowrap">{tidKort(trad.senastAt)}</span>
        <span className="text-sm text-slate-300 truncate max-w-[200px]">{trad.arende.kund}</span>
        {visaNummer && trad.arende.nummer && <span className="font-mono text-sm text-slate-400">{trad.arende.nummer}</span>}
        <span className="text-sm text-slate-400 truncate max-w-[200px]">{franTillText(trad, mig)}</span>
        {bilagor && (
          <span className="inline-flex items-center gap-1 text-sm text-slate-400">
            <Icon name="rapport.gem" size={16} />
            {bilagor}
          </span>
        )}
      </span>
    </button>
  )
}

function Grupp({ g, valdId, onValj, mig, visaNummer }: { g: ListGrupp; valdId: string | null; onValj: (t: Trad) => void; mig: Mig; visaNummer?: boolean }) {
  const [oppen, setOppen] = useState(!g.hopfalld)
  const antal = g.antal ?? g.undergrupper.reduce((s, u) => s + u.rader.length, 0)
  const rubrikId = `grupp-${g.nyckel}`
  const rubrik: ReactNode = (
    <>
      <span className={`flex ${g.ikonFarg || 'text-slate-400'}`}><Icon name={g.ikon} size={20} /></span>
      {g.rubrik}
      <span className="font-medium text-slate-400">{antal}</span>
      {g.extra && <span className="text-sm font-normal text-slate-400">{g.extra}</span>}
    </>
  )
  return (
    <section aria-labelledby={rubrikId} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        {g.hopfalld ? (
          <h3 id={rubrikId} className="m-0">
            <button
              type="button"
              aria-expanded={oppen}
              onClick={() => setOppen(o => !o)}
              className="min-h-[44px] flex items-center gap-2 text-[17px] font-semibold text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              {rubrik}
              <Icon name="allman.chevron" size={20} className={`text-slate-400 transition-transform ${oppen ? 'rotate-90' : ''}`} />
            </button>
          </h3>
        ) : (
          <h3 id={rubrikId} className="m-0 flex items-center gap-2 text-[17px] font-semibold text-white">{rubrik}</h3>
        )}
        <p className="m-0 text-sm text-slate-400">{g.beskrivning}</p>
      </div>
      {oppen && antal > 0 && (
        <ul className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-700/60">
          {g.undergrupper.map(u => (
            <li key={u.rubrik || 'alla'}>
              {u.rubrik && u.rader.length > 0 && (
                <p className="px-4 pt-2.5 pb-1.5 bg-slate-800/50 text-sm font-semibold text-slate-300 border-b border-slate-700/60">
                  {u.rubrik}<span className="ml-1.5 font-medium text-slate-400">{u.rader.length}</span>
                </p>
              )}
              <ul className="divide-y divide-slate-700/60">
                {u.rader.map(r => (
                  <li key={r.trad.id}>
                    <Rad rad={r} vald={valdId === r.trad.id} onValj={() => onValj(r.trad)} mig={mig} visaNummer={visaNummer} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {g.fler && (
            <li>
              <button type="button" onClick={g.fler.onKlick} className="w-full min-h-[48px] px-4 text-[15px] font-medium text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]">
                {g.fler.text}
              </button>
            </li>
          )}
        </ul>
      )}
      {oppen && antal === 0 && (
        <p className="text-sm text-slate-500">Inget här just nu.</p>
      )}
    </section>
  )
}

export default function TradLista({ grupper, valdId, onValj, mig, visaNummer }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {grupper.map(g => <Grupp key={g.nyckel} g={g} valdId={valdId} onValj={onValj} mig={mig} visaNummer={visaNummer} />)}
    </div>
  )
}
