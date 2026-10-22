// src/components/technician/ny/schema/VeckoRemsa.tsx
// Veckoremsan i telefonen: måndag till söndag med antal besök och en punkt för hur
// full dagen är. Pilarna och svep byter vecka, Idag hoppar tillbaka.

import { useRef } from 'react'
import { Icon } from '../../../icons/Icon'
import { klockslag } from '../../../../services/teknikerDagService'
import {
  NIVA_TEXT, NIVA_TON, bokadeText, dagNummer, dagRubrik, veckansDagar, veckodagKort, veckonummer, veckoSpann,
  type Belastning, type Lucka,
} from './schemaLogik'
import { BelastningPunkt, PUNKT_FARG } from './SchemaDelar'

interface Props {
  valdDag: string
  idag: string
  belastningFor: (dag: string) => Belastning
  /** Lediga stunder den valda dagen, för sammanfattningen */
  luckor: Lucka[]
  onValjDag: (dag: string) => void
  onBytVecka: (steg: number) => void
  onIdag: () => void
}

export function VeckoNav({ valdDag, onBytVecka, onIdag, rubrik }: { valdDag: string; onBytVecka: (s: number) => void; onIdag: () => void; rubrik?: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Förra veckan" onClick={() => onBytVecka(-1)} className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <Icon name="allman.chevron-vanster" size={24} />
      </button>
      <h2 className="flex-1 text-center text-[15px] font-semibold text-white">
        {rubrik ?? `Vecka ${veckonummer(valdDag)}, ${veckoSpann(valdDag)}`}
      </h2>
      <button type="button" aria-label="Nästa vecka" onClick={() => onBytVecka(1)} className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <Icon name="allman.chevron" size={24} />
      </button>
      <button type="button" onClick={onIdag} className="h-11 px-3 flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <Icon name="falt.idag" size={16} />
        Idag
      </button>
    </div>
  )
}

function etikett(dag: string, idag: string, b: Belastning): string {
  const delar = [dagRubrik(dag)]
  if (dag === idag) delar.push('idag')
  if (b.niva === 'ledig') delar.push('ledig')
  else if (b.niva === 'franvaro') delar.push('frånvaro')
  else {
    delar.push(`${b.antal} besök`, bokadeText(b, true))
    if (b.niva === 'hog' || b.niva === 'full') delar.push(NIVA_TEXT[b.niva].toLowerCase())
  }
  return delar.join(', ')
}

export function VeckoRemsa(p: Props) {
  const dagar = veckansDagar(p.valdDag)
  const svep = useRef<{ x: number; y: number } | null>(null)
  const vald = p.belastningFor(p.valdDag)

  const sammanfattning = (() => {
    const vilken = p.valdDag === p.idag ? 'idag' : dagRubrik(p.valdDag).toLowerCase()
    if (vald.niva === 'ledig') return { fet: `Ledig ${vilken}.`, rest: vald.antal ? ` ${vald.antal} besök ändå inbokade.` : '' }
    if (vald.niva === 'franvaro') return { fet: `Frånvaro ${vilken}.`, rest: vald.antal ? ` ${vald.antal} besök ändå inbokade.` : '' }
    const forsta = p.luckor[0]
    return {
      fet: `${bokadeText(vald, true)} ${vilken}.`,
      rest: forsta ? ` Plats kvar mellan ${klockslag(forsta.start)} och ${klockslag(forsta.slut)}.` : vald.niva === 'full' ? ' Dagen är full.' : '',
    }
  })()

  return (
    <section aria-label="Veckan" className="space-y-2">
      <VeckoNav valdDag={p.valdDag} onBytVecka={p.onBytVecka} onIdag={p.onIdag} />
      <ol
        aria-label={`Dagar i vecka ${veckonummer(p.valdDag)}, svep för nästa vecka`}
        data-genomgang="schema-remsa"
        className="grid grid-cols-7 gap-1"
        onTouchStart={e => { const t = e.touches[0]; svep.current = { x: t.clientX, y: t.clientY } }}
        onTouchEnd={e => {
          const s = svep.current
          svep.current = null
          if (!s) return
          const t = e.changedTouches[0]
          const dx = t.clientX - s.x
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(t.clientY - s.y) * 1.5) p.onBytVecka(dx < 0 ? 1 : -1)
        }}
      >
        {dagar.map(dag => {
          const b = p.belastningFor(dag)
          const arVald = dag === p.valdDag
          const arIdag = dag === p.idag
          const ledig = (b.niva === 'ledig' || b.niva === 'franvaro') && b.antal === 0
          return (
            <li key={dag}>
              <button
                type="button"
                onClick={() => p.onValjDag(dag)}
                aria-pressed={arVald}
                aria-current={arIdag ? 'date' : undefined}
                aria-label={etikett(dag, p.idag, b)}
                className={`w-full min-h-[76px] flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  arVald ? 'border-[#20c58f] bg-[#20c58f] text-[#04281c]'
                    : ledig ? 'border-dashed border-slate-600 text-slate-400'
                    : arIdag ? 'border-[#20c58f]/60 bg-slate-900 text-white'
                    : 'border-slate-700/60 bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <span className={`text-xs ${arVald ? 'font-semibold' : 'text-slate-400'}`}>{arIdag ? 'Idag' : veckodagKort(dag)}</span>
                <span className={`text-[17px] ${arVald ? 'font-bold' : 'font-semibold'}`}>{dagNummer(dag)}</span>
                {ledig ? (
                  <span className="text-[11px]">{b.niva === 'franvaro' ? 'Frånvaro' : 'Ledig'}</span>
                ) : (
                  <span className={`flex items-center gap-1 text-xs ${arVald ? 'font-semibold' : 'text-slate-300'}`}>
                    {arVald
                      ? <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-[#04281c]" />
                      : <BelastningPunkt b={b} />}
                    {b.antal}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-[13px] leading-relaxed text-slate-300">
        <span aria-hidden="true" className={`w-2 h-2 flex-shrink-0 mt-1.5 rounded-full ${PUNKT_FARG[NIVA_TON[vald.niva]]}`} />
        <span><strong className="font-semibold text-white">{sammanfattning.fet}</strong>{sammanfattning.rest}</span>
      </p>
    </section>
  )
}

export default VeckoRemsa
