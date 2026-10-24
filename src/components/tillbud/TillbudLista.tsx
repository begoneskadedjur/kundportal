// src/components/tillbud/TillbudLista.tsx
// Listan på Tillbud och avvikelser: grupper med rubrik, förklaring och rader.
// Raden visar typ, status som punkt och text, beskrivningen, datum och berörda.
// Inga tabeller: samma rad i telefonen och på datorn, med mer till höger på bred skärm.

import { useState } from 'react'
import { Icon, type IconName } from '../icons/Icon'
import type { CaseIncident } from '../../types/caseIncidents'
import { berordaNamn, datum, datumTid, forsenad } from './tillbudLogik'
import { StatusPunkt, TypRund, TypText } from './tillbudUi'

export interface TillbudGrupp {
  nyckel: string
  rubrik: string
  beskrivning: string
  ikon: IconName
  ikonFarg?: string
  rader: CaseIncident[]
  hopfalld?: boolean
}

function Rad({ i, vald, onValj, kanHantera }: { i: CaseIncident; vald: boolean; onValj: () => void; kanHantera: boolean }) {
  const berorda = berordaNamn(i)
  const sen = forsenad(i)
  return (
    <button
      type="button"
      onClick={onValj}
      aria-current={vald ? 'true' : undefined}
      className={`w-full grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[36px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-start px-4 py-3 text-left border-l-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
        vald ? 'border-l-[#20c58f] bg-[#20c58f]/10' : 'border-l-transparent hover:bg-slate-800/60'
      }`}
    >
      <TypRund typ={i.type} />
      <span className="min-w-0 flex flex-col gap-1">
        <span className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[15px] leading-snug">
          <TypText typ={i.type} />
          <StatusPunkt status={i.status} />
          {kanHantera && i.status === 'ny' && <span className="text-sm text-amber-500">Att hantera</span>}
        </span>
        <span className="text-[15px] text-white line-clamp-2 break-words">{i.description}</span>
        {i.action_taken && <span className="text-sm text-slate-400 truncate">Åtgärd: {i.action_taken}</span>}
        <span className="sm:hidden text-sm text-slate-400 truncate">
          {datumTid(i.occurred_at)}{berorda ? `, ${berorda}` : ''}
        </span>
        {i.responsible_name && (
          <span className={`sm:hidden text-sm truncate ${sen ? 'text-red-400' : 'text-slate-400'}`}>
            Ansvarig {i.responsible_name}{i.due_date ? `, klart ${datum(i.due_date)}` : ''}{sen ? ', försenad' : ''}
          </span>
        )}
      </span>
      <span className="hidden sm:flex flex-col items-end gap-1 max-w-[220px] text-right">
        <span className="font-mono text-sm text-slate-400 whitespace-nowrap">{datumTid(i.occurred_at)}</span>
        {berorda && (
          <span className="inline-flex items-center gap-1 text-sm text-slate-300 max-w-[220px]">
            <Icon name="tillbud.berorda" size={16} className="text-slate-500 flex-shrink-0" />
            <span className="truncate">{berorda}</span>
          </span>
        )}
        {i.responsible_name && (
          <span className={`text-sm truncate max-w-[220px] ${sen ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
            {i.responsible_name}{i.due_date ? `, klart ${datum(i.due_date)}` : ''}
          </span>
        )}
      </span>
    </button>
  )
}

function Grupp({ g, valdId, onValj, kanHantera }: { g: TillbudGrupp; valdId: string | null; onValj: (i: CaseIncident) => void; kanHantera: (i: CaseIncident) => boolean }) {
  const [oppen, setOppen] = useState(!g.hopfalld)
  const rubrikId = `tillbud-grupp-${g.nyckel}`
  const visas = oppen
  const rubrik = (
    <>
      <span className={`flex ${g.ikonFarg || 'text-slate-400'}`}><Icon name={g.ikon} size={20} /></span>
      {g.rubrik}
      <span className="font-medium text-slate-400">{g.rader.length}</span>
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
      {visas && g.rader.length > 0 && (
        <ul className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-700/60">
          {g.rader.map(i => (
            <li key={i.id}>
              <Rad i={i} vald={valdId === i.id} onValj={() => onValj(i)} kanHantera={kanHantera(i)} />
            </li>
          ))}
        </ul>
      )}
      {visas && g.rader.length === 0 && <p className="text-sm text-slate-500">Inget här just nu.</p>}
    </section>
  )
}

export default function TillbudLista({ grupper, valdId, onValj, kanHantera }: {
  grupper: TillbudGrupp[]
  valdId: string | null
  onValj: (i: CaseIncident) => void
  kanHantera: (i: CaseIncident) => boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {grupper.map(g => <Grupp key={g.nyckel} g={g} valdId={valdId} onValj={onValj} kanHantera={kanHantera} />)}
    </div>
  )
}
