// src/pages/shared/intranet/guider/_leads.tsx
// Delade delar för leadsguiderna (guide-leads-tekniker, guide-leads-saljare, guide-leads-kontor),
// efter sidan Leads och tips från 2026-10-24.
// Efterbildningar av:
//   Leads.tsx       beskrivningen och meningen om läget (till exempel "2 att göra, varav 1 försenad,
//                   3 öppna"), flikarna Att göra, Pågående, Nya tips, Alla, Statistik med antal,
//                   sökrutan "Sök företag, kontakt, org.nr eller telefon" och knappen Ny lead
//   LeadsTabell.tsx grupperna i Att göra med ikon, antal och förklaring (GRUPP_BESKRIVNING),
//                   raderna (Företag, Status, Nästa steg, Årspremie, Ägare) och Ta leaden på raden
//   LeadModal.tsx   huvudet, åtgärdsraden, rutan Nästa steg och sektionen Vad gäller det?
// Etiketter, ikoner och färger kommer från src/types/leads.ts och leadLogik.ts, så de är samma
// ord som i portalen. Påhittade kunder, inget sparas.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { GRUPP_BESKRIVNING, GRUPP_ETIKETT, GRUPP_IKON, type Grupp } from '../../../../components/admin/leads/leadLogik'
import { STAGE_ETIKETT, STAGE_FARG, type LeadStage } from '../../../../types/leads'
import { Markor, type MarkorProps } from '../skarmkit'

export type Mk = (id: string) => MarkorProps | undefined
export const mkFor = (markera: string | undefined, nr: number): Mk => (id: string) => (markera === id ? { pa: true, nr } : undefined)
export const ingenMk: Mk = () => undefined

/** Status som punkt och text i stegets färg (StatusText i LeadsTabell) */
export function LeadStatus({ stage, liten }: { stage: LeadStage; liten?: boolean }) {
  const f = STAGE_FARG[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${f.text} ${liten ? 'text-[11px]' : 'text-[12px]'}`}>
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
            className={`-mb-px border-b-2 px-2 py-1.5 text-[12px] ${v === aktiv ? 'border-[#20c58f] font-medium text-white' : 'border-transparent text-slate-400'}`}>
            {v}
          </button>
        </Markor>
      ))}
    </div>
  )
}

/** Knapp i leadens åtgärdsrad (ATGARD och ATGARD_PRIMAR i leadLogik) */
export function Atgard({ id, ikon, text, prim, tryck, mk }: { id: string; ikon?: IconName; text: string; prim?: boolean; tryck: (id: string) => void; mk: Mk }) {
  return (
    <Markor markor={mk(id)}>
      <button type="button" onClick={() => tryck(id)}
        className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[11.5px] font-medium ${prim ? 'border-transparent bg-[#20c58f] font-semibold text-[#04281c]' : 'border-slate-600 bg-slate-900 text-white'}`}>
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
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
          {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5 text-[#20c58f]" />}
          {titel}
        </p>
      )}
      {children}
    </div>
  )
}

export const FLIKAR: { id: string; text: string; ikon: IconName }[] = [
  { id: 'att-gora', text: 'Att göra', ikon: 'lead.att-gora' },
  { id: 'pagaende', text: 'Pågående', ikon: 'lead.pagaende' },
  { id: 'nya-tips', text: 'Nya tips', ikon: 'lead.tips' },
  { id: 'alla', text: 'Alla', ikon: 'allman.lista' },
  { id: 'statistik', text: 'Statistik', ikon: 'allman.statistik' },
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
  /** Visa Ta leaden på raden (admin och koordinator, lead utan ägare) */
  ta?: boolean
}

const GRUPP_FARG: Record<Grupp, string> = { forsenade: 'text-red-400', idag: 'text-[#20c58f]', saknar: 'text-amber-500', vaknar: 'text-slate-400' }

/**
 * Sidan Leads och tips: beskrivning, läget i en mening, flikar, sökruta och listan med grupper
 * (bara de som har rader). kompakt = telefonens kortlista utan kolumner.
 */
export function LeadsLista({ flik, antal, sektioner, tryck, mk, beskrivning, lage, nyText = 'Ny lead', utanFlikar = [], kompakt, visaNy = true }: {
  flik: string
  antal: Record<string, number>
  sektioner: { grupp: Grupp | null; rader: ListRad[] }[]
  tryck: (id: string) => void
  mk: Mk
  beskrivning: string
  /** Meningen om läget: den fetade början, resten och färgen på början */
  lage: [string, string, string?]
  nyText?: string
  utanFlikar?: string[]
  kompakt?: boolean
  visaNy?: boolean
}) {
  const synliga = sektioner.filter(s => s.rader.length > 0)
  return (
    <div className="grid gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11.5px] text-slate-300">{beskrivning}</p>
          <p className="text-[11.5px] text-slate-400"><span className={`font-semibold ${lage[2] ?? 'text-amber-500'}`}>{lage[0]}</span>{lage[1]}</p>
        </div>
        {visaNy && (
          <Markor markor={mk('ny')}>
            <button type="button" onClick={() => tryck('ny')} className="inline-flex flex-none items-center gap-1 rounded-xl bg-[#20c58f] px-2 py-1 text-[11.5px] font-semibold text-[#04281c]">
              <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" /> {nyText}
            </button>
          </Markor>
        )}
      </div>
      <div className="flex gap-3 overflow-hidden border-b border-slate-700">
        {FLIKAR.filter(f => !utanFlikar.includes(f.id)).map(f => (
          <Markor key={f.id} markor={mk(`flik:${f.id}`)}>
            <button type="button" onClick={() => tryck(`flik:${f.id}`)}
              className={`-mb-px inline-flex items-center gap-1 whitespace-nowrap border-b-2 py-1.5 text-[11.5px] font-semibold ${flik === f.id ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400'}`}>
              {!kompakt && <Icon name={f.ikon} size={16} className="h-3.5 w-3.5" />}
              {f.text}
              {antal[f.id] ? <span className={`font-medium ${flik === f.id ? 'text-[#20c58f]' : 'text-amber-500'}`}>{antal[f.id]}</span> : null}
            </button>
          </Markor>
        ))}
      </div>
      <div className="flex h-7 items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 px-2 text-[10.5px] text-slate-500">
        <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" /> Sök företag, kontakt, org.nr eller telefon
      </div>
      {synliga.length === 0 && (
        <p className="py-3 text-center text-[11px] text-slate-400">Inget att göra just nu. Alla leads har ett nästa steg framåt i tiden.</p>
      )}
      {synliga.map(s => (
        <div key={s.grupp ?? 'alla'} className="grid gap-1">
          {s.grupp && (
            <div>
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
                <span className={GRUPP_FARG[s.grupp]}><Icon name={GRUPP_IKON[s.grupp]} size={16} className="h-4 w-4" /></span>
                {GRUPP_ETIKETT[s.grupp]} <span className="font-medium text-slate-400">{s.rader.length}</span>
              </p>
              <p className="text-[10.5px] text-slate-400">{GRUPP_BESKRIVNING[s.grupp]}</p>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            {!kompakt && (
              <div className="grid grid-cols-[2fr_1fr_1.8fr_0.9fr] gap-2 border-b border-slate-700 bg-slate-800/50 px-2.5 py-1 text-[10.5px] font-medium text-slate-400">
                <span>Företag</span><span>Status</span><span>Nästa steg</span><span>Ägare</span>
              </div>
            )}
            {s.rader.map(r => (
              <Markor key={r.id} markor={mk(`rad:${r.id}`)} block>
                <div role="button" tabIndex={0} onClick={() => tryck(`rad:${r.id}`)}
                  className={`grid w-full cursor-pointer gap-x-2 gap-y-0.5 border-b border-slate-700/60 px-2.5 py-2 text-left text-[12px] last:border-0 hover:bg-slate-800/60 ${kompakt ? 'grid-cols-1' : 'grid-cols-[2fr_1fr_1.8fr_0.9fr] items-center'}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-white">{r.foretag}</span>
                    <span className="block truncate text-[10.5px] text-slate-400">{r.under}</span>
                  </span>
                  <LeadStatus stage={r.stage} liten />
                  <span className="flex min-w-0 items-start gap-1">
                    <Icon name={r.sen ? 'lead.forsenad' : 'lead.nasta-steg'} size={16} className={`mt-0.5 h-3 w-3 flex-none ${r.sen ? 'text-red-400' : 'text-slate-400'}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-slate-200">{r.nasta}</span>
                      <span className={`block font-mono text-[10.5px] ${r.sen ? 'text-red-400' : 'text-slate-400'}`}>{r.nar}</span>
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className={`truncate text-[11px] ${r.agare ? 'text-slate-300' : 'text-amber-400'}`}>{r.agare ?? 'Ingen ägare'}</span>
                    {r.ta && !r.agare && (
                      <Markor markor={mk(`ta:${r.id}`)}>
                        <button type="button" onClick={e => { e.stopPropagation(); tryck(`ta:${r.id}`) }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
                          <Icon name="lead.agare" size={16} className="h-3 w-3" /> Ta leaden
                        </button>
                      </Markor>
                    )}
                  </span>
                </div>
              </Markor>
            ))}
          </div>
        </div>
      ))}
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

/** Sektionen Vad gäller det? i leaden (fältet Beskrivning och behov) */
export function LeadBehov({ text }: { text: string }) {
  return (
    <Sektion titel="Vad gäller det?" ikon="lead.behov">
      <span className="text-[10.5px] text-slate-400">Beskrivning och behov</span>
      <span className="text-[11.5px] leading-snug text-slate-200">{text}</span>
    </Sektion>
  )
}

/** Fält med etikett i leadens stil. tom = platshållartext i grått, fel = röd ram och feltext. */
export function LeadFalt({ id, etikett, varde, tom, tryck, mk, hog, fel }: { id: string; etikett: string; varde: string; tom?: boolean; tryck: (id: string) => void; mk: Mk; hog?: boolean; fel?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-[11px] font-medium text-slate-300">{etikett}</span>
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block w-full truncate rounded-xl border bg-slate-900 px-2.5 py-1.5 text-left text-[12px] ${fel ? 'border-red-500/70' : 'border-slate-600'} ${hog ? 'min-h-[44px] whitespace-normal' : ''} ${tom ? 'text-slate-500' : 'text-white'}`}>
          {varde}
        </button>
      </Markor>
      {fel && <span className="text-[10.5px] text-red-400">{fel}</span>}
    </div>
  )
}
