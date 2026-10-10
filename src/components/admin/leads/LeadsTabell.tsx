// src/components/admin/leads/LeadsTabell.tsx
// Listan i Leads (B2B): tabell från md och kortlista på mobil. Hela raden öppnar leaden, radmenyn har
// Öppna och Ta leaden. I Att göra grupperas raderna (Försenade, I dag, Saknar nästa steg, Parkerade som
// vaknar i dag). Tangentbord: pil upp/ned flyttar, Enter öppnar. Status som punkt och text, aldrig piller.

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '../../icons/Icon'
import type { Lead } from '../../../types/database'
import { STAGE_ETIKETT, STAGE_FARG } from '../../../types/leads'
import WebLeadRadMeny, { type RadMenyVal } from '../webLeads/WebLeadRadMeny'
import { GRUPP_ETIKETT, fornamn, kr, nastaStegDatum, ursprungText, type Grupp } from './leadLogik'

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
  tomText: string
  harFilter: boolean
  onRensaFilter: () => void
}

export function StatusText({ lead, liten }: { lead: Pick<Lead, 'stage' | 'parked_until'>; liten?: boolean }) {
  const f = STAGE_FARG[lead.stage]
  return (
    <span className={`inline-flex items-center gap-1.5 ${f.text} ${liten ? 'text-xs' : ''}`}>
      <span className={`w-2 h-2 rounded-full flex-none ${f.punkt}`} />
      {STAGE_ETIKETT[lead.stage]}
      {lead.stage === 'parkerad' && lead.parked_until ? <span className="text-slate-500 font-mono text-xs">till {lead.parked_until}</span> : null}
    </span>
  )
}

function NastaSteg({ l }: { l: Lead }) {
  if (l.stage === 'parkerad') {
    return <span className="text-slate-400">{l.next_action || 'Parkerad'}</span>
  }
  if (!l.next_action_at && !l.next_action) {
    return (
      <span className="flex items-center gap-1.5 text-amber-400">
        <Icon name="lead.nasta-steg" size={16} />
        Välj nästa steg
      </span>
    )
  }
  const d = nastaStegDatum(l.next_action_at)
  return (
    <div className="min-w-0">
      <span className="block text-slate-200 truncate">{l.next_action || 'Nästa steg'}</span>
      {d.text && <span className={`block font-mono text-xs ${d.sen ? 'text-red-400' : 'text-slate-400'}`}>{d.text}</span>}
    </div>
  )
}

export default function LeadsTabell(p: Props) {
  const tbody = useRef<HTMLDivElement>(null)
  const kort = useRef<HTMLDivElement>(null)
  const antal = p.sektioner.reduce((s, x) => s + x.rader.length, 0)

  const menyVal = (l: Lead): RadMenyVal[] => [
    { label: 'Öppna', ikon: <Icon name="lead.lead" size={16} />, onClick: () => p.onOppna(l.id) },
    ...(p.kanTa && !l.owner_profile_id
      ? [{ label: 'Ta leaden', ikon: <Icon name="lead.agare" size={16} />, onClick: () => p.onTa(l.id) }]
      : []),
  ]

  const tangent = (e: ReactKeyboardEvent<HTMLElement>, id: string, behallare: HTMLElement | null) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter') {
      e.preventDefault()
      p.onOppna(id)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const rader = [...(behallare?.querySelectorAll<HTMLElement>('[data-rad]') ?? [])]
      const idx = rader.indexOf(e.currentTarget)
      rader[e.key === 'ArrowDown' ? Math.min(rader.length - 1, idx + 1) : Math.max(0, idx - 1)]?.focus()
    }
  }

  if (p.laddar && antal === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl divide-y divide-slate-700/50" aria-busy="true" aria-label="Hämtar leads">
        {Array.from({ length: 5 }).map((_, n) => (
          <div key={n} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
            <div className="flex-1 space-y-2">
              <div className="w-1/3 h-3 rounded bg-slate-700/60" />
              <div className="w-1/5 h-2.5 rounded bg-slate-700/40" />
            </div>
            <div className="hidden md:block w-24 h-3 rounded bg-slate-700/50" />
            <div className="hidden md:block w-32 h-3 rounded bg-slate-700/50" />
          </div>
        ))}
      </div>
    )
  }

  if (antal === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12 text-center">
        <Icon name="lead.att-gora" size={32} className="text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-300">{p.tomText}</p>
        {p.harFilter && (
          <button
            type="button"
            onClick={p.onRensaFilter}
            className="mt-2 text-sm text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
          >
            Rensa filter
          </button>
        )}
      </div>
    )
  }

  const rubrik = (s: LeadsSektion) =>
    s.grupp ? (
      <div className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b border-slate-700/50 bg-slate-900/40 ${s.grupp === 'forsenade' ? 'text-red-400' : 'text-slate-400'}`}>
        {GRUPP_ETIKETT[s.grupp]}
        <span className="font-mono">{s.rader.length}</span>
      </div>
    ) : null

  return (
    <>
      {/* Tabell från md */}
      <div className="hidden md:block bg-slate-800/30 border border-slate-700 rounded-xl overflow-auto max-h-[calc(100dvh-280px)] min-h-[280px]">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_40px] gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-700 text-xs font-medium text-slate-400">
          <span>Företag</span>
          <span>Status</span>
          <span>Nästa steg</span>
          <span className="text-right">Årspremie</span>
          <span>Ägare</span>
          <span className="sr-only">Åtgärder</span>
        </div>
        <div ref={tbody}>
          {p.sektioner.filter((s) => s.rader.length > 0).map((s) => (
            <div key={s.grupp ?? 'alla'}>
              {rubrik(s)}
              {s.rader.map((l) => {
                const under = ursprungText(l, p.namnFor)
                const agare = p.namnFor(l.owner_profile_id)
                return (
                  <div
                    key={l.id}
                    data-rad
                    role="button"
                    tabIndex={0}
                    onClick={() => p.onOppna(l.id)}
                    onKeyDown={(e) => tangent(e, l.id, tbody.current)}
                    className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_40px] gap-3 items-center px-4 py-3 text-sm border-b border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-700/30 focus:outline-none focus-visible:bg-slate-700/40 focus-visible:shadow-[inset_3px_0_0_#20c58f]"
                  >
                    <div className="min-w-0">
                      <span className="block text-white font-medium truncate">{l.company_name}</span>
                      <span className="block text-xs text-slate-400 truncate">
                        {under}
                        {under && l.organization_number ? ' · ' : ''}
                        {l.organization_number ? <span className="font-mono">{l.organization_number}</span> : null}
                      </span>
                    </div>
                    <div className="min-w-0"><StatusText lead={l} /></div>
                    <NastaSteg l={l} />
                    <span className={`text-right font-mono text-xs ${l.estimated_value ? 'text-slate-200' : 'text-slate-500'}`}>
                      {l.estimated_value ? kr(l.estimated_value) : 'ej satt'}
                    </span>
                    <span className={`truncate ${agare ? 'text-slate-300' : 'text-amber-400'}`}>{agare ? fornamn(agare) : 'Ingen ägare'}</span>
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <WebLeadRadMeny val={menyVal(l)} etikett={`Åtgärder för ${l.company_name}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Kortlista på mobil */}
      <div ref={kort} className="md:hidden space-y-3">
        {p.sektioner.filter((s) => s.rader.length > 0).map((s) => (
          <div key={s.grupp ?? 'alla'} className="space-y-2">
            {s.grupp && (
              <p className={`text-xs font-medium px-1 ${s.grupp === 'forsenade' ? 'text-red-400' : 'text-slate-400'}`}>
                {GRUPP_ETIKETT[s.grupp]} <span className="font-mono">{s.rader.length}</span>
              </p>
            )}
            {s.rader.map((l) => {
              const agare = p.namnFor(l.owner_profile_id)
              return (
                <div
                  key={l.id}
                  data-rad
                  role="button"
                  tabIndex={0}
                  onClick={() => p.onOppna(l.id)}
                  onKeyDown={(e) => tangent(e, l.id, kort.current)}
                  className="p-3 min-h-[44px] bg-slate-800/30 border border-slate-700 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white font-medium truncate">{l.company_name}</span>
                    <span className="flex-none"><StatusText lead={l} liten /></span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{ursprungText(l, p.namnFor)}</p>
                  <div className="mt-1.5 text-sm"><NastaSteg l={l} /></div>
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-slate-400">
                    <span className={agare ? '' : 'text-amber-400'}>{agare ? fornamn(agare) : 'Ingen ägare'}</span>
                    <span className="font-mono">{l.estimated_value ? kr(l.estimated_value) : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
