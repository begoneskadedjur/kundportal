// src/components/technician/ny/arenden/ArendeVerktyg.tsx
// Lägesväxeln (Att göra, Kommande, Avslutade) och filterraden (sök i listan,
// Filter och Sortera) i Mina ärenden.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { TYP_IKON } from '../besokTyp'
import { TYP_ETIKETT, type BesokTyp } from '../../../../services/teknikerDagService'
import { ALLA_TYPER } from '../schema/schemaLogik'
import {
  ALDER_TEXT, SORTERING_TEXT, filterAktivt, standardFilter,
  type Alder, type ArendeFilter, type Lage, type Sortering,
} from './arendeLogik'

const LAGEN: { lage: Lage; text: string; ikon: IconName }[] = [
  { lage: 'attgora', text: 'Att göra', ikon: 'arendelista.att-gora' },
  { lage: 'kommande', text: 'Kommande', ikon: 'arendelista.kommande' },
  { lage: 'avslutade', text: 'Avslutade', ikon: 'arendelista.avslutade' },
]

export function LageVal({ lage, antal, onLage }: { lage: Lage; antal: Record<Lage, number>; onLage: (l: Lage) => void }) {
  return (
    <div role="tablist" aria-label="Visa ärenden" data-genomgang="mina-lagen" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-800 lg:w-auto">
      {LAGEN.map(l => {
        const aktiv = lage === l.lage
        return (
          <button
            key={l.lage}
            type="button"
            role="tab"
            aria-selected={aktiv}
            onClick={() => onLage(l.lage)}
            className={`h-11 px-2 lg:px-4 flex items-center justify-center gap-1.5 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              aktiv ? 'bg-slate-900 border border-slate-600 text-white font-semibold' : 'border border-transparent text-slate-300 hover:text-white font-medium'
            }`}
          >
            <Icon name={l.ikon} size={20} className={`hidden sm:block ${aktiv ? 'text-[#20c58f]' : ''}`} />
            <span className="truncate">{l.text}</span>
            <span className={`font-mono text-[13px] ${aktiv ? 'text-white' : 'text-slate-400'}`}>{antal[l.lage]}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Knapp med utfällbar panel. Stängs med Escape och klick utanför. */
function Utfall({ ikon, etikett, markerad, aria, children }: {
  ikon: IconName
  etikett: string
  markerad?: boolean
  aria: string
  children: (stang: () => void) => ReactNode
}) {
  const [oppen, setOppen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!oppen) return
    const klick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOppen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOppen(false) }
    document.addEventListener('mousedown', klick)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', klick); window.removeEventListener('keydown', esc) }
  }, [oppen])
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        aria-expanded={oppen}
        aria-haspopup="true"
        aria-label={aria}
        onClick={() => setOppen(v => !v)}
        className={`relative h-11 px-3 flex items-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
          oppen || markerad ? 'border-[#20c58f]/60 bg-slate-900 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
        }`}
      >
        <Icon name={ikon} size={20} className={markerad ? 'text-[#20c58f]' : ''} />
        <span className="hidden sm:inline">{etikett}</span>
      </button>
      {oppen && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2">
          {children(() => setOppen(false))}
        </div>
      )}
    </div>
  )
}

const VAL = 'w-full min-h-[44px] px-2 flex items-center gap-3 rounded-lg text-left text-sm hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]'

function Radio({ vald }: { vald: boolean }) {
  return (
    <span aria-hidden="true" className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${vald ? 'border-[#20c58f]' : 'border-slate-600'}`}>
      {vald && <span className="w-2.5 h-2.5 rounded-full bg-[#20c58f]" />}
    </span>
  )
}

interface FilterRadProps {
  lage: Lage
  sok: string
  onSok: (s: string) => void
  filter: ArendeFilter
  onFilter: (f: ArendeFilter) => void
  typer: Map<BesokTyp, number>
  sortering: Sortering
  onSortering: (s: Sortering) => void
}

export function FilterRad({ lage, sok, onSok, filter, onFilter, typer, sortering, onSortering }: FilterRadProps) {
  const aktiva = filterAktivt(filter)
  const visaAlder = lage !== 'kommande'
  const finnsTyper = ALLA_TYPER.filter(t => typer.has(t))

  const vaxlaTyp = (t: BesokTyp) => {
    const n = new Set(filter.doldaTyper)
    if (n.has(t)) n.delete(t); else n.add(t)
    onFilter({ ...filter, doldaTyper: n })
  }

  return (
    <div data-genomgang="mina-filter" className="flex items-center gap-2 min-w-0">
      <label className="relative flex-1 min-w-0 block">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <Icon name="allman.sok" size={20} />
        </span>
        <input
          type="search"
          value={sok}
          onChange={e => onSok(e.target.value)}
          placeholder="Filtrera listan"
          aria-label="Filtrera listan på kund, adress, telefon eller ärendenummer"
          className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
        />
      </label>

      <Utfall ikon="allman.filter" etikett={aktiva ? `Filter ${aktiva}` : 'Filter'} markerad={aktiva > 0} aria={aktiva ? `Filter, ${aktiva} valda` : 'Filter'}>
        {() => (
          <div className="space-y-2">
            <fieldset>
              <legend className="px-2 pt-1 pb-1 text-[13px] font-semibold text-slate-300">Typ</legend>
              {finnsTyper.map(t => (
                <label key={t} className={`${VAL} cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={!filter.doldaTyper.has(t)}
                    onChange={() => vaxlaTyp(t)}
                    className="h-5 w-5 flex-shrink-0 rounded border-slate-600 bg-slate-800 accent-[#20c58f]"
                  />
                  <Icon name={TYP_IKON[t]} size={16} className="text-slate-400" />
                  <span className="flex-1 text-white">{TYP_ETIKETT[t]}</span>
                  <span className="font-mono text-[13px] text-slate-500">{typer.get(t)}</span>
                </label>
              ))}
            </fieldset>
            {visaAlder && (
              <fieldset className="border-t border-slate-700/60 pt-2">
                <legend className="sr-only">Ålder</legend>
                <p className="px-2 pb-1 flex items-center gap-1.5 text-[13px] font-semibold text-slate-300">
                  <Icon name="arendelista.alder" size={16} className="text-slate-400" />
                  Ålder, räknat från besöksdagen
                </p>
                {(Object.keys(ALDER_TEXT) as Alder[]).map(a => (
                  <button key={a} type="button" role="radio" aria-checked={filter.alder === a} onClick={() => onFilter({ ...filter, alder: a })} className={VAL}>
                    <Radio vald={filter.alder === a} />
                    <span className="text-white">{ALDER_TEXT[a]}</span>
                  </button>
                ))}
              </fieldset>
            )}
            {aktiva > 0 && (
              <button
                type="button"
                onClick={() => onFilter(standardFilter())}
                className="w-full h-11 rounded-xl border border-slate-600 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                Visa alla
              </button>
            )}
          </div>
        )}
      </Utfall>

      <Utfall ikon="arendelista.sortera" etikett={SORTERING_TEXT[sortering]} aria={`Sortera, ${SORTERING_TEXT[sortering]}`}>
        {stang => (
          <div role="radiogroup" aria-label="Sortera">
            <p className="px-2 pt-1 pb-1 text-[13px] font-semibold text-slate-300">Sortera</p>
            {(Object.keys(SORTERING_TEXT) as Sortering[]).map(s => (
              <button key={s} type="button" role="radio" aria-checked={sortering === s} onClick={() => { onSortering(s); stang() }} className={VAL}>
                <Radio vald={sortering === s} />
                <span className="text-white">{SORTERING_TEXT[s]}</span>
              </button>
            ))}
          </div>
        )}
      </Utfall>
    </div>
  )
}
