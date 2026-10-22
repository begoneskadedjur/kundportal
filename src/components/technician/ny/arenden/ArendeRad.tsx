// src/components/technician/ny/arenden/ArendeRad.tsx
// En rad i Mina ärenden. Dator: en rad med kolumnerna datum, kund och ort, typ,
// status och åtgärd. Telefon: två rader. Hela raden är klickbar. Bredvid ligger en
// sekundär ikonknapp (Ring för det som ska bokas, annars Navigera) och på datorn
// en knapp som öppnar ärendet direkt.

import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import { TYP_IKON, statusTon, type Ton } from '../besokTyp'
import {
  besokBeskrivning, klockslag, kortDag, navigeraUrl, ortUrAdress, telUrl, type DagBesok,
} from '../../../../services/teknikerDagService'
import { schemaStatus, veckodagKort } from '../schema/schemaLogik'
import { alderTon, avslutsdag, dagarSedan, kortDatum, sedanText } from './arendeLogik'

/** Vilken lista raden står i, styr datum, status och knapp */
export type RadSort = 'vecka' | 'boka' | 'avsluta' | 'ovrig' | 'kommande' | 'avslutad'

/** Kolumnerna på datorn, delas med listans rubrikrad */
export const DATOR_KOLUMNER = 'lg:grid lg:grid-cols-[104px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-4 lg:items-center'

interface Props {
  b: DagBesok
  sort: RadSort
  idag: string
  vald?: boolean
  arDator: boolean
  onKlick: (b: DagBesok) => void
  onOppna: (b: DagBesok) => void
}

function datum(b: DagBesok, sort: RadSort, idag: string): { forsta: string; andra: string } {
  if (sort === 'avslutad') {
    const d = avslutsdag(b)
    return { forsta: d ? kortDatum(d, idag) : 'Utan datum', andra: '' }
  }
  if (!b.dag) return { forsta: 'Ingen tid', andra: '' }
  const tid = klockslag(b.start)
  if (sort === 'vecka') return { forsta: kortDag(b.dag, idag), andra: tid }
  if (sort === 'kommande') return { forsta: `${veckodagKort(b.dag)} ${kortDatum(b.dag, idag)}`, andra: tid }
  return { forsta: kortDatum(b.dag, idag), andra: tid }
}

/**
 * Status som platt text med punkt. Det som ska bokas är neutralt när det bara står
 * Öppen, och gult när kunden redan har signerat (då väntar kunden på oss).
 */
function status(b: DagBesok, sort: RadSort, idag: string): { ton: Ton; text: string; extra?: string } {
  if (sort === 'avsluta' && b.dag) {
    const d = dagarSedan(b.dag, idag)
    return { ton: alderTon(d), text: 'Inte avslutat', extra: sedanText(d) }
  }
  if (sort === 'boka') {
    const st = statusTon(b)
    return { ton: b.status === 'Öppen' ? 'gra' : st.ton, text: st.text }
  }
  return schemaStatus(b, idag)
}

const IKONKNAPP = 'w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'

function SekundarKnapp({ b, sort }: { b: DagBesok; sort: RadSort }) {
  if (sort === 'avslutad') return null
  const ring = b.telefon ? (
    <a href={telUrl(b.telefon)} className={IKONKNAPP} aria-label={`Ring ${b.kontaktperson || b.kund}`} title={`Ring ${b.telefon}`}>
      <Icon name="kontakt.telefon" size={20} />
    </a>
  ) : null
  const navigera = b.adress ? (
    <a href={navigeraUrl(b.adress)} target="_blank" rel="noopener noreferrer" className={IKONKNAPP} aria-label={`Navigera till ${b.kund}`} title="Navigera">
      <Icon name="falt.navigera" size={20} />
    </a>
  ) : null
  // Det som ska bokas börjar med ett samtal, resten med en vägbeskrivning
  const forst = sort === 'boka' ? ring ?? navigera : navigera ?? ring
  return forst ?? <span aria-hidden="true" className="w-11 h-11 flex-shrink-0" />
}

export function ArendeRad({ b, sort, idag, vald = false, arDator, onKlick, onOppna }: Props) {
  const d = datum(b, sort, idag)
  const st = status(b, sort, idag)
  const ort = ortUrAdress(b.adress)
  const plats = ort || b.adress
  const nedtonad = b.avslutad && sort !== 'avslutad'

  return (
    <li className={`relative flex items-center gap-1 pr-1 transition-colors ${vald ? 'bg-slate-800' : 'hover:bg-slate-800/60'}`}>
      {vald && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#20c58f]" />}
      <button
        type="button"
        onClick={() => onKlick(b)}
        onDoubleClick={arDator ? () => onOppna(b) : undefined}
        aria-current={vald ? 'true' : undefined}
        className={`flex-1 min-w-0 text-left pl-3 py-2.5 min-h-[60px] lg:min-h-[52px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] rounded-lg ${DATOR_KOLUMNER} ${nedtonad ? 'opacity-60' : ''}`}
      >
        {/* Telefon: rad 1 kund och datum, rad 2 typ, ort och status */}
        <span className="lg:hidden flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium text-white truncate">{b.kund}</span>
          <span className="flex-shrink-0 text-[13px] text-slate-300">
            {d.forsta}{d.andra && <span className="font-mono text-slate-400"> {d.andra}</span>}
          </span>
        </span>
        <span className="lg:hidden mt-0.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 min-w-0 text-[13px] text-slate-400">
            <Icon name={TYP_IKON[b.typ]} size={16} className="flex-shrink-0" />
            <span className="truncate">{besokBeskrivning(b)}{plats ? `, ${plats}` : ''}</span>
          </span>
          <span className="flex-shrink-0">
            {st.extra
              ? <StatusPunkt ton={st.ton}><span className={st.ton === 'gra' ? 'text-slate-400 font-normal' : ''}>{st.extra}</span></StatusPunkt>
              : <StatusPunkt ton={st.ton}>{st.text}</StatusPunkt>}
          </span>
        </span>

        {/* Dator: kolumner */}
        <span className="hidden lg:flex flex-col">
          <span className="text-sm font-medium text-white">{d.forsta}</span>
          {d.andra && <span className="font-mono text-[13px] text-slate-400">{d.andra}</span>}
        </span>
        <span className="hidden lg:flex flex-col min-w-0">
          <span className="text-[15px] font-medium text-white truncate">{b.kund}</span>
          <span className="text-[13px] text-slate-400 truncate">{plats || 'Adress saknas'}</span>
        </span>
        <span className="hidden lg:flex items-center gap-2 min-w-0 text-sm text-slate-300">
          <Icon name={TYP_IKON[b.typ]} size={16} className="flex-shrink-0 text-slate-400" />
          <span className="truncate">{besokBeskrivning(b)}</span>
        </span>
        <span className="hidden lg:flex flex-col min-w-0">
          <StatusPunkt ton={st.ton}>{st.text}</StatusPunkt>
          {st.extra && <span className="pl-3.5 text-[13px] text-slate-400">{st.extra}</span>}
        </span>
      </button>

      <SekundarKnapp b={b} sort={sort} />
      {arDator && (
        <button type="button" onClick={() => onOppna(b)} className={IKONKNAPP} aria-label={`Öppna ärendet ${b.kund}`} title="Öppna ärendet">
          <Icon name="arende.arende" size={20} />
        </button>
      )}
    </li>
  )
}

/** Kolumnrubriker ovanför en lista på datorn */
export function ListHuvud({ datum = 'Datum' }: { datum?: string }) {
  return (
    <div aria-hidden="true" className="hidden lg:flex items-center gap-1 pr-1 border-b border-slate-700/60">
      <div className={`flex-1 pl-3 py-2 text-xs font-medium text-slate-500 ${DATOR_KOLUMNER}`}>
        <span>{datum}</span>
        <span>Kund och ort</span>
        <span>Typ</span>
        <span>Status</span>
      </div>
      <span className="w-[92px] flex-shrink-0 text-xs font-medium text-slate-500 text-right pr-3">Åtgärd</span>
    </div>
  )
}

export default ArendeRad
