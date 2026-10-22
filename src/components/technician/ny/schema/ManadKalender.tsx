// src/components/technician/ny/schema/ManadKalender.tsx
// Månaden som kalender. Stor: läget Månad, med antal besök och belastning per dag,
// tryck på en dag för att se den som dag. Liten: hoppkalendern i datorns sidopanel,
// med veckonummer, tryck på en dag för att visa dess vecka.

import { Icon } from '../../../icons/Icon'
import {
  NIVA_TEXT, dagNummer, dagRubrik, manadRubrik, manadsVeckor, sammaManad, veckonummer, type Belastning,
} from './schemaLogik'
import { BelastningPunkt } from './SchemaDelar'

const RUBRIKER_LANG = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
const RUBRIKER_KORT = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

interface Props {
  /** Någon dag i månaden som visas */
  manad: string
  valdDag: string
  idag: string
  belastningFor: (dag: string) => Belastning
  /** Antal synliga besök (med filtret) per dag */
  antalFor: (dag: string) => number
  onValjDag: (dag: string) => void
  onBytManad: (steg: number) => void
  liten?: boolean
  /** Markera hela veckan för valt datum (hoppkalendern) */
  markeraVecka?: boolean
}

export function ManadNav({ manad, onBytManad, liten = false }: { manad: string; onBytManad: (s: number) => void; liten?: boolean }) {
  const knapp = `${liten ? 'w-9 h-9' : 'w-11 h-11'} flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]`
  return (
    <span className="flex items-center gap-1">
      <button type="button" aria-label="Förra månaden" onClick={() => onBytManad(-1)} className={knapp}>
        <Icon name="allman.chevron-vanster" size={liten ? 20 : 24} />
      </button>
      <span className={`${liten ? 'text-sm min-w-[7.5rem]' : 'text-[15px] min-w-[9rem]'} text-center font-semibold text-white`}>{manadRubrik(manad)}</span>
      <button type="button" aria-label="Nästa månad" onClick={() => onBytManad(1)} className={knapp}>
        <Icon name="allman.chevron" size={liten ? 20 : 24} />
      </button>
    </span>
  )
}

export function ManadKalender(p: Props) {
  const veckor = manadsVeckor(p.manad)
  const liten = !!p.liten

  if (liten) {
    return (
      <div role="grid" aria-label={manadRubrik(p.manad)} className="text-center">
        <div role="row" className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] gap-0.5 text-[11px] text-slate-500 mb-1">
          <span>v.</span>
          {RUBRIKER_KORT.map((r, i) => <span key={i}>{r}</span>)}
        </div>
        {veckor.map(v => {
          const iVald = p.markeraVecka && v.includes(p.valdDag)
          return (
            <div key={v[0]} role="row" className={`grid grid-cols-[28px_repeat(7,minmax(0,1fr))] gap-0.5 rounded-lg ${iVald ? 'bg-[#20c58f]/10' : ''}`}>
              <span className="flex items-center justify-center text-[11px] text-slate-500">{veckonummer(v[0])}</span>
              {v.map(dag => {
                const utanfor = !sammaManad(dag, p.manad)
                const arIdag = dag === p.idag
                const arVald = dag === p.valdDag
                const antal = p.antalFor(dag)
                return (
                  <button
                    key={dag}
                    type="button"
                    onClick={() => p.onValjDag(dag)}
                    aria-current={arIdag ? 'date' : undefined}
                    aria-label={`${dagRubrik(dag)}${antal ? `, ${antal} besök` : ''}`}
                    className={`h-9 rounded-lg text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                      arVald ? 'bg-[#20c58f] text-[#04281c] font-bold'
                        : arIdag ? 'border border-[#20c58f] text-white font-semibold'
                        : utanfor ? 'text-slate-500 hover:bg-slate-800'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {dagNummer(dag)}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div role="grid" aria-label={manadRubrik(p.manad)} data-genomgang="schema-manad" className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden">
      <div role="row" className="grid grid-cols-7 border-b border-slate-700/60">
        {RUBRIKER_LANG.map(r => (
          <span key={r} role="columnheader" className="py-2 text-center text-xs font-medium text-slate-400">{r}</span>
        ))}
      </div>
      {veckor.map(v => (
        <div key={v[0]} role="row" className="grid grid-cols-7 border-b last:border-b-0 border-slate-700/60">
          {v.map(dag => {
            const utanfor = !sammaManad(dag, p.manad)
            const arIdag = dag === p.idag
            const arVald = dag === p.valdDag
            const b = p.belastningFor(dag)
            const antal = p.antalFor(dag)
            const ledig = b.niva === 'ledig' || b.niva === 'franvaro'
            return (
              <button
                key={dag}
                type="button"
                onClick={() => p.onValjDag(dag)}
                aria-current={arIdag ? 'date' : undefined}
                aria-label={`${dagRubrik(dag)}, ${antal} besök, ${NIVA_TEXT[b.niva].toLowerCase()}`}
                className={`relative min-h-[64px] lg:min-h-[88px] p-1.5 lg:p-2 flex flex-col items-center lg:items-start gap-1 border-l first:border-l-0 border-slate-700/60 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
                  ledig ? 'bg-slate-800/50' : ''
                } ${utanfor ? 'opacity-50' : ''} hover:bg-slate-800`}
              >
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm ${
                  arVald ? 'bg-[#20c58f] text-[#04281c] font-bold'
                    : arIdag ? 'border border-[#20c58f] text-white font-semibold'
                    : 'text-white font-medium'
                }`}>
                  {dagNummer(dag)}
                </span>
                {antal > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-slate-300">
                    <BelastningPunkt b={b} />
                    {antal}<span className="hidden lg:inline"> besök</span>
                  </span>
                ) : ledig ? (
                  <span className="text-[11px] text-slate-500">{b.niva === 'franvaro' ? 'Frånvaro' : 'Ledig'}</span>
                ) : null}
                {antal > 0 && !ledig && (
                  <span className="hidden lg:block text-[11px] text-slate-400">{NIVA_TEXT[b.niva]}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default ManadKalender
