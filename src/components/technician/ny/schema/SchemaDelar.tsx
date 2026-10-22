// src/components/technician/ny/schema/SchemaDelar.tsx
// Små delar som schemats lägen delar: lägesväxeln, belastningsraden och arbetstiden.

/* eslint-disable react-refresh/only-export-components -- hookar och delar hör ihop */
import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import type { DagBesok } from '../../../../services/teknikerDagService'
import { NIVA_TEXT, NIVA_TON, arbetadeMinuter, timerText, varaktighet, type Belastning } from './schemaLogik'

export type SchemaVy = 'dag' | 'vecka' | 'manad'

const VYER: { vy: SchemaVy; text: string; ikon: IconName }[] = [
  { vy: 'dag', text: 'Dag', ikon: 'falt.idag' },
  { vy: 'vecka', text: 'Vecka', ikon: 'falt.vecka' },
  { vy: 'manad', text: 'Månad', ikon: 'falt.manad' },
]

export function VyVal({ vy, onVy, className = '' }: { vy: SchemaVy; onVy: (v: SchemaVy) => void; className?: string }) {
  return (
    <div role="group" aria-label="Visa schemat som" data-genomgang="schema-vy" className={`grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-800 ${className}`}>
      {VYER.map(v => (
        <button
          key={v.vy}
          type="button"
          aria-pressed={vy === v.vy}
          onClick={() => onVy(v.vy)}
          className={`h-11 lg:h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
            vy === v.vy ? 'bg-slate-900 border border-slate-600 text-white font-semibold' : 'border border-transparent text-slate-300 hover:text-white font-medium'
          }`}
        >
          <Icon name={v.ikon} size={20} />
          {v.text}
        </button>
      ))}
    </div>
  )
}

export const PUNKT_FARG: Record<string, string> = {
  gron: 'bg-[#20c58f]',
  gul: 'bg-amber-500',
  rod: 'bg-red-500',
  bla: 'bg-sky-500',
  gra: 'bg-slate-500',
}

export const TON_TEXT: Record<string, string> = {
  gron: 'text-[#20c58f]',
  gul: 'text-amber-500',
  rod: 'text-red-400',
  bla: 'text-sky-400',
  gra: 'text-slate-400',
}

/** Punkt i belastningens färg, utan text */
export function BelastningPunkt({ b, className = '' }: { b: Belastning; className?: string }) {
  if (b.niva === 'ledig' || b.niva === 'franvaro') return null
  return <span aria-hidden="true" className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${PUNKT_FARG[NIVA_TON[b.niva]]} ${className}`} />
}

/** "Plats kvar" med punkt */
export function BelastningText({ b, className = '' }: { b: Belastning; className?: string }) {
  return <StatusPunkt ton={NIVA_TON[b.niva]} className={className}>{NIVA_TEXT[b.niva]}</StatusPunkt>
}

/** Uppdaterar varje sekund medan ett arbetspass pågår */
function useSekund(aktiv: boolean): Date {
  const [nu, setNu] = useState(() => new Date())
  useEffect(() => {
    if (!aktiv) return
    const t = window.setInterval(() => setNu(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [aktiv])
  return nu
}

/** "Pågår 00:12:34" eller "arbetat 52 min". Ingenting när ingen tid finns. */
export function ArbetsTid({ b, kort = false }: { b: DagBesok; kort?: boolean }) {
  const nu = useSekund(!!b.arbeteStartat)
  if (b.arbeteStartat) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-[#20c58f]">
        <Icon name="allman.klocka" size={16} />
        <span>Pågår <span className="font-mono">{timerText(arbetadeMinuter(b, nu))}</span></span>
      </span>
    )
  }
  if (b.arbetadeMinuter > 0) {
    return <span>{kort ? '' : 'arbetat '}{varaktighet(b.arbetadeMinuter)}</span>
  }
  return null
}
