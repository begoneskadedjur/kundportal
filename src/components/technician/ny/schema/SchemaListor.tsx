// src/components/technician/ny/schema/SchemaListor.tsx
// Listor i schemat: sökträffar över alla datum grupperade per dag, och veckan som
// lista i telefonen (läget Vecka).

import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import { TYP_IKON } from '../besokTyp'
import { besokBeskrivning, klockslag, ortUrAdress, type DagBesok } from '../../../../services/teknikerDagService'
import { bokadeText, dagRubrik, schemaStatus, type Belastning } from './schemaLogik'
import { BelastningText } from './SchemaDelar'

function BesokRad({ b, idag, onOppna }: { b: DagBesok; idag: string; onOppna: (b: DagBesok) => void }) {
  const st = schemaStatus(b, idag)
  const ort = ortUrAdress(b.adress)
  return (
    <li>
      <button
        type="button"
        onClick={() => onOppna(b)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[60px] text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${b.avslutad ? 'opacity-70' : ''}`}
      >
        <span className="w-12 flex-shrink-0 flex flex-col">
          <span className="font-mono text-sm font-semibold text-white">{klockslag(b.start) || '--:--'}</span>
          {b.slut && <span className="font-mono text-xs text-slate-500">{klockslag(b.slut)}</span>}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-white truncate">{b.kund}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-slate-400 truncate">
            <Icon name={TYP_IKON[b.typ]} size={16} className="flex-shrink-0" />
            <span className="truncate">{besokBeskrivning(b)}{ort ? `, ${ort}` : ''}{b.arendenummer ? `, ${b.arendenummer}` : ''}</span>
          </span>
          <StatusPunkt ton={st.ton} className="sm:hidden mt-0.5">{st.text}</StatusPunkt>
        </span>
        <StatusPunkt ton={st.ton} className="hidden sm:inline-flex">{st.text}</StatusPunkt>
        <Icon name="allman.chevron" size={16} className="text-slate-500 flex-shrink-0" />
      </button>
    </li>
  )
}

interface SokProps {
  traffar: DagBesok[]
  fraga: string
  idag: string
  onOppna: (b: DagBesok) => void
  onRensa: () => void
  onVisaDag: (dag: string) => void
}

/** Sökträffar över alla datum, närmast i tid först, grupperade per dag */
export function SokTraffar({ traffar, fraga, idag, onOppna, onRensa, onVisaDag }: SokProps) {
  const grupper: { dag: string; besok: DagBesok[] }[] = []
  for (const b of traffar) {
    if (!b.dag) continue
    const g = grupper[grupper.length - 1]
    if (g && g.dag === b.dag) g.besok.push(b)
    else grupper.push({ dag: b.dag, besok: [b] })
  }
  return (
    <section aria-labelledby="schema-sok-rubrik" className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 id="schema-sok-rubrik" className="text-[15px] font-semibold text-white">
          {traffar.length} {traffar.length === 1 ? 'träff' : 'träffar'}
          <span className="ml-2 font-normal text-slate-400">för "{fraga}"</span>
        </h2>
        <button type="button" onClick={onRensa} className="h-11 px-3 flex items-center gap-1.5 rounded-xl border border-slate-600 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
          <Icon name="allman.stang" size={16} />
          Rensa
        </button>
      </header>
      {grupper.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl border border-dashed border-slate-700 text-center">
          <Icon name="allman.sok" size={32} className="mx-auto text-slate-500" />
          <p className="mt-2 text-[15px] font-medium text-white">Inga träffar</p>
          <p className="text-sm text-slate-400">Inga av dina ärenden matchar sökningen.</p>
        </div>
      ) : grupper.map(g => (
        <div key={g.dag} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-300">{dagRubrik(g.dag)}{g.dag === idag ? ', idag' : ''}{g.dag.slice(0, 4) !== idag.slice(0, 4) ? ` ${g.dag.slice(0, 4)}` : ''}</h3>
            <button type="button" onClick={() => onVisaDag(g.dag)} className="min-h-[44px] px-2 text-sm font-medium text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded">
              Visa dagen
            </button>
          </div>
          <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
            {g.besok.map(b => <BesokRad key={b.nyckel} b={b} idag={idag} onOppna={onOppna} />)}
          </ul>
        </div>
      ))}
    </section>
  )
}

interface VeckaProps {
  dagar: string[]
  idag: string
  besokPerDag: Map<string, DagBesok[]>
  belastningFor: (dag: string) => Belastning
  onOppna: (b: DagBesok) => void
  onVisaDag: (dag: string) => void
}

/** Veckan som lista i telefonen: dagrubrik med belastning, sedan besöken */
export function VeckoLista({ dagar, idag, besokPerDag, belastningFor, onOppna, onVisaDag }: VeckaProps) {
  return (
    <div className="space-y-4">
      {dagar.map(dag => {
        const lista = besokPerDag.get(dag) ?? []
        const b = belastningFor(dag)
        return (
          <section key={dag} aria-label={dagRubrik(dag)} className="space-y-1.5">
            <button
              type="button"
              onClick={() => onVisaDag(dag)}
              className="w-full min-h-[44px] flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded-lg"
            >
              <span className={`flex-1 text-[15px] font-semibold ${dag === idag ? 'text-[#20c58f]' : 'text-white'}`}>
                {dagRubrik(dag)}{dag === idag ? ', idag' : ''}
              </span>
              <span className="flex flex-col items-end">
                <BelastningText b={b} />
                {b.niva !== 'ledig' && b.niva !== 'franvaro' && <span className="text-xs text-slate-400">{bokadeText(b)}</span>}
              </span>
              <Icon name="allman.chevron" size={16} className="text-slate-500" />
            </button>
            {lista.length > 0 ? (
              <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
                {lista.map(x => <BesokRad key={x.nyckel} b={x} idag={idag} onOppna={onOppna} />)}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Inga besök.</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
