// src/pages/shared/intranet/guider/_leads.tsx
// Delade delar för leadsguiderna (guide-leads-tekniker, guide-leads-saljare, guide-leads-kontor).
// Efterbildningar av Leads.tsx (flikarna Att göra, Pågående, Nya tips, Alla, Statistik),
// LeadsTabell.tsx (kolumnerna Företag, Status, Nästa steg, Årspremie, Ägare och grupperna i
// Att göra) och LeadModal.tsx (huvudet, åtgärdsraden och rutan Nästa steg). Etiketter och
// färger kommer från src/types/leads.ts och leadLogik.ts, så de är samma ord som i portalen.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { GRUPP_ETIKETT, type Grupp } from '../../../../components/admin/leads/leadLogik'
import { STAGE_ETIKETT, STAGE_FARG, type LeadStage } from '../../../../types/leads'
import { Markor, type MarkorProps } from '../skarmkit'

export type Mk = (id: string) => MarkorProps | undefined
export const mkFor = (markera: string | undefined, nr: number): Mk => (id: string) => (markera === id ? { pa: true, nr } : undefined)

/** Status som punkt och text i stegets färg (StatusText i LeadsTabell) */
export function LeadStatus({ stage, liten }: { stage: LeadStage; liten?: boolean }) {
  const f = STAGE_FARG[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 ${f.text} ${liten ? 'text-[11px]' : 'text-[12px]'}`}>
      <span className={`h-2 w-2 flex-none rounded-full ${f.punkt}`} />
      {STAGE_ETIKETT[stage]}
    </span>
  )
}

/** Understrukna val, som segmenten i leaden (aldrig piller) */
export function Segment({ val, aktiv, tryck, prefix, mk }: { val: string[]; aktiv: string; tryck: (id: string) => void; prefix: string; mk: Mk }) {
  return (
    <div className="flex flex-wrap border-b border-slate-700/50">
      {val.map(v => (
        <Markor key={v} markor={mk(`${prefix}:${v}`)}>
          <button type="button" onClick={() => tryck(`${prefix}:${v}`)}
            className={`-mb-px border-b-2 px-2 py-1 text-[12px] ${v === aktiv ? 'border-[#20c58f] font-medium text-white' : 'border-transparent text-slate-400'}`}>
            {v}
          </button>
        </Markor>
      ))}
    </div>
  )
}

/** Knapp i leadens åtgärdsrad (Button size sm, secondary eller primary) */
export function Atgard({ id, ikon, text, prim, tryck, mk }: { id: string; ikon?: IconName; text: string; prim?: boolean; tryck: (id: string) => void; mk: Mk }) {
  return (
    <Markor markor={mk(id)}>
      <button type="button" onClick={() => tryck(id)}
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-medium ${prim ? 'border-transparent bg-[#20c58f] text-[#fff]' : 'border-slate-600 bg-slate-800 text-slate-200'}`}>
        {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5" />}
        {text}
      </button>
    </Markor>
  )
}

/** Sektion i leaden (SEKTION i leadLogik) */
export function Sektion({ titel, ikon, children, ram }: { titel?: string; ikon?: IconName; children: ReactNode; ram?: string }) {
  return (
    <div className={`grid gap-1.5 rounded-xl border bg-slate-800/30 p-2.5 ${ram ?? 'border-slate-700'}`}>
      {titel && (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
          {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5 text-[#20c58f]" />}
          {titel}
        </p>
      )}
      {children}
    </div>
  )
}

export const FLIKAR: { id: string; text: string }[] = [
  { id: 'att-gora', text: 'Att göra' },
  { id: 'pagaende', text: 'Pågående' },
  { id: 'nya-tips', text: 'Nya tips' },
  { id: 'alla', text: 'Alla' },
  { id: 'statistik', text: 'Statistik' },
]

export interface ListRad {
  id: string
  foretag: string
  under: string
  stage: LeadStage
  nasta: string
  nar: string
  sen?: boolean
  premie?: string
  agare?: string
}

/** Leads (B2B): rubrik, flikar och tabellen med grupper (bara de som har rader) */
export function LeadsLista({ flik, antal, sektioner, tryck, mk }: {
  flik: string
  antal: Record<string, number>
  sektioner: { grupp: Grupp | null; rader: ListRad[] }[]
  tryck: (id: string) => void
  mk: Mk
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] text-slate-400">Företag och föreningar som kan bli avtalskunder.</p>
        <button type="button" onClick={() => tryck('ny')} className="inline-flex flex-none items-center gap-1 rounded-lg bg-[#20c58f] px-2 py-1 text-[11.5px] font-semibold text-[#fff]">
          <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" /> Ny lead
        </button>
      </div>
      <div className="flex overflow-x-auto border-b border-slate-700/50">
        {FLIKAR.map(f => (
          <Markor key={f.id} markor={mk(`flik:${f.id}`)}>
            <button type="button" onClick={() => tryck(`flik:${f.id}`)}
              className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 text-[12px] ${flik === f.id ? 'border-[#20c58f] font-medium text-white' : 'border-transparent text-slate-400'}`}>
              {f.text}
              {antal[f.id] ? <span className={`ml-1 font-mono text-[10.5px] ${flik === f.id ? 'text-[#20c58f]' : 'text-amber-400'}`}>{antal[f.id]}</span> : null}
            </button>
          </Markor>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
        <div className="grid grid-cols-[2fr_1fr_1.8fr_0.8fr] gap-2 border-b border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10.5px] font-medium text-slate-400">
          <span>Företag</span><span>Status</span><span>Nästa steg</span><span>Ägare</span>
        </div>
        {sektioner.filter(s => s.rader.length > 0).map(s => (
          <div key={s.grupp ?? 'alla'}>
            {s.grupp && (
              <p className={`border-b border-slate-700/50 bg-slate-900/40 px-2.5 py-1 text-[10.5px] font-medium ${s.grupp === 'forsenade' ? 'text-red-400' : 'text-slate-400'}`}>
                {GRUPP_ETIKETT[s.grupp]} <span className="font-mono">{s.rader.length}</span>
              </p>
            )}
            {s.rader.map(r => (
              <Markor key={r.id} markor={mk(`rad:${r.id}`)} block>
                <button type="button" onClick={() => tryck(`rad:${r.id}`)}
                  className="grid w-full grid-cols-[2fr_1fr_1.8fr_0.8fr] items-center gap-2 border-b border-slate-700/50 px-2.5 py-2 text-left text-[12px] last:border-0 hover:bg-slate-700/30">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{r.foretag}</span>
                    <span className="block truncate text-[10.5px] text-slate-400">{r.under}</span>
                  </span>
                  <LeadStatus stage={r.stage} liten />
                  <span className="min-w-0">
                    <span className="block truncate text-slate-200">{r.nasta}</span>
                    <span className={`block font-mono text-[10.5px] ${r.sen ? 'text-red-400' : 'text-slate-400'}`}>{r.nar}</span>
                  </span>
                  <span className={`truncate ${r.agare ? 'text-slate-300' : 'text-amber-400'}`}>{r.agare ?? 'Ingen ägare'}</span>
                </button>
              </Markor>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Leaden som en ruta över sidan (LeadModal, size xl) */
export function LeadFonster({ titel, under, onStang, children }: { titel: string; under: string; onStang: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 p-3">
      <div className="grid max-h-full w-full max-w-2xl gap-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-700 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{titel}</p>
            <p className="truncate text-[11.5px] text-slate-400">{under}</p>
          </div>
          <button type="button" onClick={onStang} aria-label="Stäng" className="rounded p-1 text-slate-400 hover:text-white">
            <Icon name="allman.stang" size={16} />
          </button>
        </div>
        <div className="grid gap-2 overflow-hidden px-3.5 pb-3.5">{children}</div>
      </div>
    </div>
  )
}

/** Raden under titeln i leaden: status, ägare, årspremie och tipsare */
export function LeadHuvud({ stage, agare, premie, tipsare }: { stage: LeadStage; agare?: string; premie?: string; tipsare?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      <LeadStatus stage={stage} />
      <span className="flex items-center gap-1 text-slate-300">
        <Icon name="lead.agare" size={16} className="h-3.5 w-3.5 text-slate-500" />
        {agare ?? <span className="text-amber-400">Ingen ägare</span>}
      </span>
      <span className="flex items-center gap-1 text-slate-300">
        <Icon name="lead.varde" size={16} className="h-3.5 w-3.5 text-slate-500" />
        {premie ?? <span className="text-slate-500">Årspremie ej satt</span>}
      </span>
      {tipsare && (
        <span className="flex items-center gap-1 text-slate-300">
          <Icon name="lead.tipsare" size={16} className="h-3.5 w-3.5 text-slate-500" />
          Tips från {tipsare}
        </span>
      )}
    </div>
  )
}

/** Fält med etikett i leadens stil. tom = platshållartext i grått. */
export function LeadFalt({ id, etikett, varde, tom, tryck, mk, hog }: { id: string; etikett: string; varde: string; tom?: boolean; tryck: (id: string) => void; mk: Mk; hog?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium text-slate-400">{etikett}</span>
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1.5 text-left text-[12px] ${hog ? 'min-h-[44px]' : ''} ${tom ? 'text-slate-500' : 'text-white'}`}>
          {varde}
        </button>
      </Markor>
    </div>
  )
}
