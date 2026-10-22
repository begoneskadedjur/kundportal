// src/components/technician/ny/arenden/ArendeSektion.tsx
// Sektioner i Mina ärenden: rubrik med antal och en mening, listan med rader,
// hopfällbara grupper (per kund, per månad) och tomma lägen.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import type { DagBesok } from '../../../../services/teknikerDagService'
import { ArendeRad, ListHuvud, type RadSort } from './ArendeRad'

interface RadLista {
  idag: string
  arDator: boolean
  valdNyckel: string | null
  onKlick: (b: DagBesok) => void
  onOppna: (b: DagBesok) => void
}

export type ListaProps = RadLista

/** Raderna i en ruta, med kolumnrubriker på datorn */
export function Lista({ besok, sort, datumRubrik, utanRam = false, ...p }: RadLista & { besok: DagBesok[]; sort: RadSort; datumRubrik?: string; utanRam?: boolean }) {
  return (
    <div className={utanRam ? '' : 'rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden'}>
      {!utanRam && <ListHuvud datum={datumRubrik} />}
      <ul className="divide-y divide-slate-700/60">
        {besok.map(b => (
          <ArendeRad
            key={b.nyckel}
            b={b}
            sort={sort}
            idag={p.idag}
            arDator={p.arDator}
            vald={p.arDator && p.valdNyckel === b.nyckel}
            onKlick={p.onKlick}
            onOppna={p.onOppna}
          />
        ))}
      </ul>
    </div>
  )
}

/** Rubrik med ikon, antal och en förklarande mening (följer Visa hjälptexter) */
export function SektionRubrik({ id, rubrik, ikon, antal, betonad = false, children }: {
  id: string
  rubrik: string
  ikon: IconName
  antal: number
  betonad?: boolean
  children: ReactNode
}) {
  return (
    <HjalpText
      id={id}
      rubrik={rubrik}
      ikon={ikon}
      niva={betonad ? 'h2' : 'h3'}
      hoger={<span className={`font-mono text-sm ${betonad ? 'text-white' : 'text-slate-400'}`}>{antal}</span>}
    >
      {children}
    </HjalpText>
  )
}

/** Gruppnamn ovanför flera sektioner, till exempel Väntar på dig */
export function GruppEtikett({ text, antal }: { text: string; antal: number }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{text}</span>
      <span className="font-mono text-xs text-slate-500">{antal}</span>
      <span aria-hidden="true" className="flex-1 h-px bg-slate-700/60" />
    </div>
  )
}

/** Knapp som fäller ut och ihop en grupp */
export function Hopfall({ id, rubrik, detalj, antal, oppen, onToggle, inbaddad = false }: {
  id: string
  rubrik: string
  detalj?: string
  antal: number
  oppen: boolean
  onToggle: () => void
  inbaddad?: boolean
}) {
  return (
    <button
      type="button"
      aria-expanded={oppen}
      aria-controls={id}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 min-h-[52px] text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
        inbaddad ? 'hover:bg-slate-800/60' : 'rounded-2xl bg-slate-900 border border-slate-700/60 hover:bg-slate-800'
      }`}
    >
      <Icon name="allman.chevron" size={16} className={`flex-shrink-0 text-slate-400 transition-transform ${oppen ? 'rotate-90' : ''}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-white truncate">{rubrik}</span>
        {detalj && <span className="block text-[13px] text-slate-400 truncate">{detalj}</span>}
      </span>
      <span className="font-mono text-sm text-slate-400">{antal}</span>
    </button>
  )
}

/** Litet tomt läge inne i en sektion */
export function TomRad({ children }: { children: ReactNode }) {
  return <p className="px-1 text-sm text-slate-500">{children}</p>
}

/** Stort tomt läge för ett helt läge */
export function TomtLage({ rubrik, text, children }: { rubrik: string; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 flex flex-col items-center text-center gap-2">
      <Icon name="arendelista.tomt" size={32} className="text-[#20c58f]" />
      <p className="text-[15px] font-semibold text-white">{rubrik}</p>
      <p className="max-w-sm text-sm text-slate-400">{text}</p>
      {children}
    </div>
  )
}

/** Laddläge: rader som skimrar i stället för en ensam snurra */
export function Laddar() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Hämtar dina ärenden</span>
      <div className="h-5 w-2/3 max-w-md rounded bg-slate-800 animate-pulse" />
      <div className="h-[52px] rounded-xl bg-slate-800/70 animate-pulse" />
      <div className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 px-3 h-[60px]">
            <div className="h-4 w-14 rounded bg-slate-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-slate-800 animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-slate-800/70 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
