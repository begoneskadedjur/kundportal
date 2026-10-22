// src/components/technician/ny/schema/SchemaFilter.tsx
// Filtret i schemat: typ av besök och status i sex grupper. De enskilda statusarna
// (samma lista som gamla vyns filter) ligger bakom Välj enskilda statusar.
// Visas i datorns sidopanel och som bottenark i telefonen (FilterArk).

import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../icons/Icon'
import { TYP_IKON } from '../besokTyp'
import { TYP_ETIKETT, type BesokTyp } from '../../../../services/teknikerDagService'
import {
  ALLA_TYPER, ENSKILDA_STATUSAR, STANGDA_GRUPP, STATUS_GRUPPER, filterArAndrat, standardFilter, type SchemaFilter,
} from './schemaLogik'

const RUTA = 'h-5 w-5 flex-shrink-0 rounded border-slate-600 bg-slate-800 accent-[#20c58f] focus:ring-[#20c58f]'
const RAD = 'flex items-center gap-3 min-h-[44px] px-2 rounded-lg cursor-pointer hover:bg-slate-800'

interface Props {
  filter: SchemaFilter
  onFilter: (f: SchemaFilter) => void
}

export function SchemaFilterInnehall({ filter, onFilter }: Props) {
  const [enskilda, setEnskilda] = useState(false)

  const vaxlaTyp = (t: BesokTyp) => {
    const n = new Set(filter.doldaTyper)
    if (n.has(t)) n.delete(t); else n.add(t)
    onFilter({ ...filter, doldaTyper: n })
  }
  const vaxlaGrupp = (statusar: string[], pa: boolean) => {
    const n = new Set(filter.dolda)
    for (const s of statusar) { if (pa) n.delete(s); else n.add(s) }
    onFilter({ ...filter, dolda: n })
  }
  const vaxlaStatus = (s: string) => {
    const n = new Set(filter.dolda)
    if (n.has(s)) n.delete(s); else n.add(s)
    onFilter({ ...filter, dolda: n })
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-slate-300">Typ av besök</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-2">
          {ALLA_TYPER.map(t => (
            <label key={t} className={RAD}>
              <input type="checkbox" className={RUTA} checked={!filter.doldaTyper.has(t)} onChange={() => vaxlaTyp(t)} />
              <Icon name={TYP_IKON[t]} size={16} className="text-slate-400" />
              <span className="text-sm text-white">{TYP_ETIKETT[t]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-slate-300">Status</legend>
        <div>
          {STATUS_GRUPPER.map(g => {
            const pa = g.statusar.every(s => !filter.dolda.has(s))
            const delvis = !pa && g.statusar.some(s => !filter.dolda.has(s))
            return (
              <label key={g.id} className={`${RAD} py-1.5`}>
                <input
                  type="checkbox"
                  className={RUTA}
                  checked={pa}
                  ref={el => { if (el) el.indeterminate = delvis }}
                  onChange={() => vaxlaGrupp(g.statusar, !pa)}
                />
                <span className="flex flex-col">
                  <span className="text-sm text-white">{g.rubrik}</span>
                  <span className="text-xs text-slate-400">{g.text}</span>
                </span>
              </label>
            )
          })}
          <label className={`${RAD} py-1.5`}>
            <input type="checkbox" className={RUTA} checked={filter.visaStangda} onChange={() => onFilter({ ...filter, visaStangda: !filter.visaStangda })} />
            <span className="flex flex-col">
              <span className="text-sm text-white">{STANGDA_GRUPP.rubrik}</span>
              <span className="text-xs text-slate-400">{STANGDA_GRUPP.text}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div>
        <button
          type="button"
          aria-expanded={enskilda}
          aria-controls="schema-enskilda-statusar"
          onClick={() => setEnskilda(v => !v)}
          className="w-full min-h-[44px] px-2 flex items-center justify-between gap-2 rounded-lg text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
        >
          Välj enskilda statusar
          <Icon name="allman.chevron" size={16} className={`text-slate-400 transition-transform ${enskilda ? 'rotate-90' : ''}`} />
        </button>
        {enskilda && (
          <div id="schema-enskilda-statusar" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-2">
            {ENSKILDA_STATUSAR.map(s => (
              <label key={s} className={RAD}>
                <input type="checkbox" className={RUTA} checked={!filter.dolda.has(s)} onChange={() => vaxlaStatus(s)} />
                <span className={`text-sm ${filter.dolda.has(s) ? 'text-slate-400' : 'text-white'}`}>{s}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {filterArAndrat(filter) && (
        <button
          type="button"
          onClick={() => onFilter(standardFilter())}
          className="h-11 px-4 rounded-xl border border-slate-600 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
        >
          Återställ filtret
        </button>
      )}
    </div>
  )
}

/** Filtret som bottenark i telefonen */
export function FilterArk({ oppen, onClose, filter, onFilter }: Props & { oppen: boolean; onClose: () => void }) {
  const stangRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!oppen) return
    stangRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [oppen, onClose])

  if (!oppen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="schema-filter-rubrik"
        className="relative w-full lg:max-w-lg max-h-[85vh] flex flex-col bg-slate-900 border-t lg:border border-slate-700 rounded-t-3xl lg:rounded-2xl shadow-2xl"
      >
        <span aria-hidden="true" className="lg:hidden block mx-auto mt-2 w-10 h-1 rounded-full bg-slate-600" />
        <header className="flex items-center justify-between gap-3 px-4 pt-2 pb-2">
          <h2 id="schema-filter-rubrik" className="text-lg font-semibold text-white">Visa i schemat</h2>
          <button ref={stangRef} type="button" onClick={onClose} aria-label="Stäng" className="w-11 h-11 -mr-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
            <Icon name="allman.stang" size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <SchemaFilterInnehall filter={filter} onFilter={onFilter} />
        </div>
        <footer className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-700/60">
          <button type="button" onClick={onClose} className="w-full h-12 rounded-xl bg-[#20c58f] text-[#04281c] text-[15px] font-semibold hover:bg-[#1bb07f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]">
            Klar
          </button>
        </footer>
      </section>
    </div>
  )
}
