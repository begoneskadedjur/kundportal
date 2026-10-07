// Gemensamma byggstenar för sidan Marknad: sektion, nyckeltal, sorterbar tabellrubrik, statuspunkt.
// Inga piller: status visas som platt text med statuspunkt.

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { procent } from './marknadFormat'

export function Sektion({ titel, under, hoger, children }: { titel: string; under?: ReactNode; hoger?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{titel}</h2>
          {under && <p className="text-xs text-slate-400 mt-0.5">{under}</p>}
        </div>
        {hoger}
      </div>
      {children}
    </section>
  )
}

export function Punkt({ farg }: { farg: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${farg}`} aria-hidden="true" />
}

/** Förändring mot föregående period. omvand: lägre är bättre (t.ex. kostnad per konvertering). */
export function Forandring({ varde, omvand = false, neutral = false }: { varde: number | null; omvand?: boolean; neutral?: boolean }) {
  if (varde == null) return <span className="text-xs text-slate-500">ingen jämförelse</span>
  const upp = varde > 0
  const bra = neutral ? null : omvand ? !upp : upp
  const farg = bra == null || Math.abs(varde) < 0.005 ? 'text-slate-400' : bra ? 'text-[#20c58f]' : 'text-red-400'
  const Ikon = upp ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${farg}`}>
      <Ikon className="w-3 h-3" aria-hidden="true" />
      {procent(Math.abs(varde), 0)}
      <span className="sr-only">{upp ? 'upp' : 'ner'} mot föregående period</span>
    </span>
  )
}

export function Nyckeltal({
  etikett,
  varde,
  under,
  forandring,
  saknas,
}: {
  etikett: string
  varde: ReactNode
  under?: ReactNode
  forandring?: ReactNode
  saknas?: string
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-700/70 rounded-lg p-3 min-w-0">
      <div className="text-xs text-slate-400">{etikett}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums truncate ${saknas ? 'text-slate-500' : 'text-white'}`}>{varde}</div>
      {saknas ? (
        <div className="mt-1 text-xs text-amber-400/90">{saknas}</div>
      ) : (
        (under || forandring) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            {forandring}
            {under}
          </div>
        )
      )}
    </div>
  )
}

export type Riktning = 'asc' | 'desc'

export function SortRubrik<K extends string>({
  falt,
  aktiv,
  riktning,
  onSort,
  children,
  hoger = true,
}: {
  falt: K
  aktiv: K
  riktning: Riktning
  onSort: (f: K) => void
  children: ReactNode
  hoger?: boolean
}) {
  const ar = falt === aktiv
  return (
    <th
      scope="col"
      aria-sort={ar ? (riktning === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-2 py-2 font-medium whitespace-nowrap ${hoger ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(falt)}
        className={`inline-flex items-center gap-1 hover:text-white ${ar ? 'text-white' : ''}`}
      >
        {children}
        {ar && (riktning === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  )
}

export function Tomt({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-slate-500">{children}</div>
}
