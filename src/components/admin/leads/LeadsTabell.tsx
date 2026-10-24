// src/components/admin/leads/LeadsTabell.tsx
// Listan i Leads och tips (2026-10-24, samma formspråk som Tickets och Mina ärenden).
// I Att göra grupperas raderna under rubriker med ikon, antal och en mening om vad gruppen betyder
// (Försenade, I dag, Saknar nästa steg, Parkerade som vaknar i dag). Övriga flikar är en lista.
// Telefon: kort per rad, ingen tabell. Dator: samma rader med kolumner (Företag, Status, Nästa steg,
// Årspremie, Ägare). Hela raden öppnar leaden. Leads utan ägare har knappen Ta leaden direkt på raden
// för admin och koordinator. Tangentbord: pil upp och ned flyttar, Enter öppnar.
// Status som punkt och text, aldrig piller.

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '../../icons/Icon'
import type { Lead } from '../../../types/database'
import { STAGE_ETIKETT, STAGE_FARG } from '../../../types/leads'
import {
  GRUPP_BESKRIVNING, GRUPP_ETIKETT, GRUPP_IKON, KNAPP_SEKUNDAR, fornamn, kr, nastaStegDatum, ursprungText, type Grupp,
} from './leadLogik'

export interface LeadsSektion {
  grupp: Grupp | null
  rader: Lead[]
}

interface Props {
  sektioner: LeadsSektion[]
  laddar: boolean
  namnFor: (id: string | null) => string
  kanTa: boolean
  onOppna: (id: string) => void
  onTa: (id: string) => void
  tomRubrik: string
  tomText: string
  harFilter: boolean
  onRensaFilter: () => void
}

export function StatusText({ lead, liten }: { lead: Pick<Lead, 'stage' | 'parked_until'>; liten?: boolean }) {
  const f = STAGE_FARG[lead.stage]
  return (
    <span className={`inline-flex items-center gap-2 font-medium ${f.text} ${liten ? 'text-sm' : 'text-[15px]'}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-none ${f.punkt}`} />
      {STAGE_ETIKETT[lead.stage]}
      {lead.stage === 'parkerad' && lead.parked_until ? <span className="text-slate-400 font-mono text-sm font-normal">till {lead.parked_until}</span> : null}
    </span>
  )
}

function NastaSteg({ l }: { l: Lead }) {
  if (l.stage === 'parkerad') {
    return (
      <span className="flex items-start gap-2 text-slate-300 min-w-0">
        <Icon name="lead.parkerad" size={16} className="flex-none mt-0.5 text-slate-400" />
        <span className="truncate">{l.next_action || 'Parkerad'}</span>
      </span>
    )
  }
  if (!l.next_action_at && !l.next_action) {
    return (
      <span className="flex items-center gap-2 text-amber-400">
        <Icon name="lead.nasta-steg" size={16} className="flex-none" />
        Välj nästa steg
      </span>
    )
  }
  const d = nastaStegDatum(l.next_action_at)
  return (
    <span className="flex items-start gap-2 min-w-0">
      <Icon name={d.sen ? 'lead.forsenad' : 'lead.nasta-steg'} size={16} className={`flex-none mt-0.5 ${d.sen ? 'text-red-400' : 'text-slate-400'}`} />
      <span className="min-w-0">
        <span className="block text-slate-200 truncate">{l.next_action || 'Nästa steg'}</span>
        {d.text && <span className={`block font-mono text-sm ${d.sen ? 'text-red-400' : 'text-slate-400'}`}>{d.text}</span>}
      </span>
    </span>
  )
}

const KOLUMNER = 'lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,2fr)_110px_minmax(0,0.9fr)]'

export default function LeadsTabell(p: Props) {
  const lista = useRef<HTMLDivElement>(null)
  const antal = p.sektioner.reduce((s, x) => s + x.rader.length, 0)

  const tangent = (e: ReactKeyboardEvent<HTMLElement>, id: string) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      p.onOppna(id)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const rader = [...(lista.current?.querySelectorAll<HTMLElement>('[data-rad]') ?? [])]
      const idx = rader.indexOf(e.currentTarget)
      rader[e.key === 'ArrowDown' ? Math.min(rader.length - 1, idx + 1) : Math.max(0, idx - 1)]?.focus()
    }
  }

  if (p.laddar && antal === 0) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-[15px] text-slate-400" role="status">
        <Icon name="allman.laddar" size={20} className="animate-spin" />
        Hämtar leads...
      </div>
    )
  }

  if (antal === 0) {
    return (
      <div className="py-10 flex flex-col items-center text-center gap-2">
        <Icon name={p.harFilter ? 'allman.sok' : 'lead.att-gora'} size={32} className="text-slate-500" />
        <p className="text-[17px] font-semibold text-white">{p.tomRubrik}</p>
        <p className="max-w-md text-[15px] text-slate-400">{p.tomText}</p>
        {p.harFilter && (
          <button type="button" onClick={p.onRensaFilter} className={`${KNAPP_SEKUNDAR} mt-2`}>
            <Icon name="allman.aterstall" size={20} />
            Rensa filter
          </button>
        )}
      </div>
    )
  }

  const rad = (l: Lead) => {
    const under = ursprungText(l, p.namnFor)
    const agare = p.namnFor(l.owner_profile_id)
    const kanTa = p.kanTa && !l.owner_profile_id
    return (
      <li key={l.id}>
        <div
          data-rad
          role="button"
          tabIndex={0}
          aria-label={`Öppna ${l.company_name}`}
          onClick={() => p.onOppna(l.id)}
          onKeyDown={(e) => tangent(e, l.id)}
          className={`grid grid-cols-1 ${KOLUMNER} gap-x-4 gap-y-1.5 items-center px-4 py-3 cursor-pointer border-l-[3px] border-l-transparent hover:bg-slate-800/60 focus:outline-none focus-visible:bg-slate-800/60 focus-visible:border-l-[#20c58f]`}
        >
          {/* Företag (i telefonen med årspremien till höger) */}
          <div className="min-w-0 flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-white truncate">{l.company_name}</span>
              {(under || l.organization_number) && (
                <span className="block text-sm text-slate-400 truncate">
                  {under}
                  {under && l.organization_number ? ', ' : ''}
                  {l.organization_number ? <span className="font-mono">{l.organization_number}</span> : null}
                </span>
              )}
            </span>
            {l.estimated_value ? <span className="lg:hidden flex-none font-mono text-sm text-slate-300">{kr(l.estimated_value)}</span> : null}
          </div>
          <div className="min-w-0"><StatusText lead={l} liten /></div>
          <div className="min-w-0 text-[15px]"><NastaSteg l={l} /></div>
          <span className={`hidden lg:block text-right font-mono text-sm ${l.estimated_value ? 'text-slate-200' : 'text-slate-500'}`}>
            {l.estimated_value ? kr(l.estimated_value) : 'ej satt'}
          </span>
          <div className="min-w-0 flex flex-wrap items-center justify-between lg:justify-start gap-2">
            <span className={`flex items-center gap-1.5 text-sm truncate ${agare ? 'text-slate-300' : 'text-amber-400'}`}>
              <Icon name="lead.agare" size={16} className="flex-none lg:hidden text-slate-500" />
              {agare ? fornamn(agare) : 'Ingen ägare'}
            </span>
            {kanTa && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); p.onTa(l.id) }}
                onKeyDown={(e) => e.stopPropagation()}
                className={`${KNAPP_SEKUNDAR} lg:min-h-[36px] lg:px-3 lg:text-sm`}
              >
                <Icon name="lead.agare" size={16} />
                Ta leaden
              </button>
            )}
          </div>
        </div>
      </li>
    )
  }

  const synliga = p.sektioner.filter((s) => s.rader.length > 0)

  return (
    <div ref={lista} className="flex flex-col gap-6">
      {synliga.map((s) => {
        const id = `leads-grupp-${s.grupp ?? 'alla'}`
        return (
          <section key={s.grupp ?? 'alla'} aria-labelledby={s.grupp ? id : undefined} aria-label={s.grupp ? undefined : 'Leads'} className="flex flex-col gap-2">
            {s.grupp && (
              <div className="flex flex-col gap-0.5">
                <h3 id={id} className="m-0 flex items-center gap-2 text-[17px] font-semibold text-white">
                  <span className={`flex ${s.grupp === 'forsenade' ? 'text-red-400' : s.grupp === 'idag' ? 'text-[#20c58f]' : s.grupp === 'saknar' ? 'text-amber-500' : 'text-slate-400'}`}>
                    <Icon name={GRUPP_IKON[s.grupp]} size={20} />
                  </span>
                  {GRUPP_ETIKETT[s.grupp]}
                  <span className="font-medium text-slate-400">{s.rader.length}</span>
                </h3>
                <p className="m-0 text-sm text-slate-400">{GRUPP_BESKRIVNING[s.grupp]}</p>
              </div>
            )}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
              <div className={`hidden lg:grid ${KOLUMNER} gap-x-4 px-4 py-2 border-b border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-400`} aria-hidden="true">
                <span className="pl-[3px]">Företag</span>
                <span>Status</span>
                <span>Nästa steg</span>
                <span className="text-right">Årspremie</span>
                <span>Ägare</span>
              </div>
              <ul className="divide-y divide-slate-700/60">{s.rader.map(rad)}</ul>
            </div>
          </section>
        )
      })}
    </div>
  )
}
