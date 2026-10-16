// src/pages/shared/intranet/guider/_arenden.tsx
// Delade delar för guiderna om ärenden, schema och dokumentsignering
// (guide-skapa-arenden, guide-schemavyn, guide-foljearenden, guide-foljearenden-kontor,
// guide-avbryta-arenden, guide-avbryta-arenden-kontor, guide-dokumentsignering).
//
// Efterbildningar, förenklade:
// - SchemaHuvud: ScheduleHeader.tsx (Schemaöversikt, pilarna, Dag/Vecka/Månad, Idag,
//   Sök ärende..., Filter, Nytt ärende, Frånvaro).
// - SchemaRutnat: dagvyn i ScheduleGrid/TimeGridRow, en rad per tekniker med besöksblock.
//   Blocken går att dra (HTML5 drag & drop) som i portalen.
// - ArendeDator / ArendeTelefon: EditCaseModal med fotspåren, klockan och pratbubblan
//   uppe till höger, flikarna och foten Radera · Avbryt · Spara ändringar.
// - KommPanel: CommunicationSlidePanel med CommentInput.
// - TaBortArk: DeleteCaseConfirmDialog.
// - ValArk och FoljeArk: EditCaseModal "Vad vill du göra?" och "Skapa nytt ärende".
// Påhittade kunder och kollegor. Ingenting sparas.

import type { ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Ark, Falt, Flikar, Knapprad, Kort, Markor, PKnapp, Rad, Status, Val, type MarkorProps } from '../skarmkit'

/** Markörfunktion för en skärm: mk('id') ger markören om id är det som ska markeras */
export type Mk = (id: string) => MarkorProps | undefined
export const gorMk = (markera: string | undefined, nr: number): Mk => (id: string) =>
  markera === id ? { pa: true, nr } : undefined
export const ingenMk: Mk = () => undefined

export type Tryck = (id: string) => void

// ─── Lokala ikoner (ikonstandard 24/1,6, currentColor) ─────────
// Saknas i ikonbiblioteket: pratbubblan för kommunikation (portalen använder
// lucide MessageSquare). Önskas som allman.kommunikation.

export function PratbubblaIkon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.3-4.2A7.5 7.5 0 1 1 20 11.5Z" />
      <path d="M8.5 10h7M8.5 13.5h4.5" />
    </svg>
  )
}

/** Ikonknapp med valfri ritning, som IkonKnapp i skärmkitet */
export function IkonRuta({ etikett, onClick, markor, children }: { etikett: string; onClick?: () => void; markor?: MarkorProps; children: ReactNode }) {
  return (
    <Markor markor={markor}>
      <button type="button" onClick={onClick} aria-label={etikett} title={etikett}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        {children}
      </button>
    </Markor>
  )
}

// ─── Schemat ─────────────────────────────────────

export interface Besok {
  id: string
  kund: string
  /** Start och slut i timmar, t.ex. 9 och 10.5 */
  fran: number
  till: number
  rad: string
  farg?: string
  dimmad?: boolean
  /** Två besök samtidigt delar raden: 0 = övre halvan, 1 = undre */
  lane?: 0 | 1
}

export interface TeknikerRad { id: string; namn: string }

export const TIMMAR = [8, 9, 10, 11, 12, 13, 14, 15, 16]
const FORSTA = TIMMAR[0]
const ANTAL = TIMMAR.length

const klock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

/** Schemats sidhuvud. Sökfältet och listan Nytt ärende ritas av guiden via props. */
export function SchemaHuvud({ datum, mk, tryck, sok, nyttMeny, filterMeny }: {
  datum: string
  mk: Mk
  tryck: Tryck
  sok?: ReactNode
  nyttMeny?: ReactNode
  filterMeny?: ReactNode
}) {
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-700/60 bg-slate-900/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon name="allman.kalender" size={20} className="text-blue-400" />
        <div>
          <p className="text-[13px] font-bold text-white">Schemaöversikt</p>
          <p className="text-[10px] text-slate-400">3 tekniker</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => tryck('dag-forra')} aria-label="Föregående dag" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          <Icon name="allman.chevron" size={16} className="rotate-180" />
        </button>
        <p className="min-w-[128px] text-center text-[12px] font-semibold text-white">{datum}</p>
        <Markor markor={mk('dag-nasta')}>
          <button type="button" onClick={() => tryck('dag-nasta')} aria-label="Nästa dag" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <Icon name="allman.chevron" size={16} />
          </button>
        </Markor>
        <div className="ml-1 flex rounded-lg border border-slate-700/60 bg-slate-800/50 p-0.5">
          {['Dag', 'Vecka', 'Månad'].map((v, i) => (
            <button key={v} type="button" onClick={() => tryck(`vy-${v}`)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${i === 0 ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'}`}>
              {v}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => tryck('idag')} className="ml-1 rounded-lg border border-slate-700/60 px-2 py-0.5 text-[11px] text-slate-400 hover:text-white">Idag</button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {sok ?? (
          <button type="button" onClick={() => tryck('sok')} className="flex w-36 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2 py-1 text-left text-[11px] text-slate-500">
            <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" />Sök ärende...
          </button>
        )}
        <div className="relative">
          <button type="button" onClick={() => tryck('filter')} className="flex items-center gap-1 rounded-lg border border-slate-700/60 px-2 py-1 text-[11px] text-slate-400 hover:text-white">
            <Icon name="allman.filter" size={16} className="h-3.5 w-3.5" />Filter
          </button>
          {filterMeny}
        </div>
        <div className="relative">
          <Markor markor={mk('nytt')}>
            <button type="button" onClick={() => tryck('nytt')} className="flex items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 py-1 text-[11.5px] font-semibold text-[#fff]">
              <Icon name="arende.arende" size={16} className="h-3.5 w-3.5" />Nytt ärende
              <Icon name="allman.chevron" size={16} className="h-3 w-3 rotate-90" />
            </button>
          </Markor>
          {nyttMeny}
        </div>
        <button type="button" onClick={() => tryck('franvaro')} className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11.5px] font-semibold text-slate-200">Frånvaro</button>
      </div>
    </div>
  )
}

/** Listan under Nytt ärende, samma rubriker och namn som ScheduleHeader */
export const NYTT_ENGANG = [
  { id: 'typ-private', text: 'Engångsjobb Privatperson' },
  { id: 'typ-business', text: 'Engångsjobb Företag' },
]
export const NYTT_AVTAL = [
  { id: 'typ-contract', text: 'Extrabesök Avtalskund' },
  { id: 'typ-inspection', text: 'Stationskontroll Avtalskund' },
  { id: 'typ-establishment', text: 'Etablering Avtalskund' },
  { id: 'typ-rondering', text: 'Rondering Trafikkontoret' },
  { id: 'typ-egenkontroll', text: 'Egenkontroll' },
]

export function NyttMeny({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  const rad = (r: { id: string; text: string }) => (
    <Markor key={r.id} markor={mk(r.id)} block>
      <button type="button" onClick={() => tryck(r.id)} className="w-full px-3 py-1.5 text-left text-[12px] text-slate-200 hover:bg-slate-700/60">{r.text}</button>
    </Markor>
  )
  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-800 py-1.5 shadow-2xl">
      <p className="px-3 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">Engångsärenden</p>
      {NYTT_ENGANG.map(rad)}
      <div className="my-1 border-t border-slate-700" />
      <p className="px-3 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">Avtalskunder</p>
      {NYTT_AVTAL.map(rad)}
    </div>
  )
}

/**
 * Dagvyn: tidsrubrik och en rad per tekniker. Lediga timmar är klickbara
 * (slot:<rad>:<timme>) och tar emot släppta besök. Besöken är klickbara
 * (besok:<id>) och går att dra (drag:<id>).
 */
export function SchemaRutnat({ rader, besok, mk, tryck, linje }: {
  rader: TeknikerRad[]
  besok: Besok[]
  mk: Mk
  tryck: Tryck
  /** Blå släpplinje, som när man drar ett besök i portalen */
  linje?: { rad: string; timme: number }
}) {
  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex border-b border-slate-700/60 text-[10px] text-slate-500">
        <div className="w-24 flex-none px-2 py-1">Tekniker</div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${ANTAL}, minmax(0, 1fr))` }}>
          {TIMMAR.map(h => <div key={h} className="border-l border-slate-800/60 px-1 py-1">{klock(h)}</div>)}
        </div>
      </div>
      {rader.map(r => (
        <div key={r.id} className="flex border-b border-slate-800/60">
          <div className="flex w-24 flex-none items-center gap-1.5 px-2 py-2">
            <span className="h-6 w-1 rounded-full bg-[#20c58f]/60" aria-hidden />
            <span className="truncate text-[11.5px] font-medium text-white">{r.namn}</span>
          </div>
          <div className="relative h-12 flex-1">
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${ANTAL}, minmax(0, 1fr))` }}>
              {TIMMAR.map(h => {
                const id = `slot:${r.id}:${h}`
                return (
                  <Markor key={h} markor={mk(id)} block>
                    <button type="button" aria-label={`${r.namn} ${klock(h)}`}
                      onClick={() => tryck(id)}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={e => { e.preventDefault(); tryck(id) }}
                      className="block h-12 w-full border-l border-slate-800/40 hover:bg-blue-500/5" />
                  </Markor>
                )
              })}
            </div>
            {linje && linje.rad === r.id && (
              <div className="pointer-events-none absolute top-0 z-20 h-full w-[2px] bg-blue-400" style={{ left: `${((linje.timme - FORSTA) / ANTAL) * 100}%` }}>
                <span className="absolute left-1.5 top-0.5 whitespace-nowrap rounded bg-slate-900/90 px-1 font-mono text-[10px] text-blue-300">{klock(linje.timme)}</span>
              </div>
            )}
            {besok.filter(b => b.rad === r.id).map(b => (
              <div key={b.id} className="absolute z-10" style={{ left: `${((b.fran - FORSTA) / ANTAL) * 100}%`, width: `${((b.till - b.fran) / ANTAL) * 100}%`, top: b.lane === 1 ? 25 : 6, height: b.lane === undefined ? 36 : 18 }}>
                <Markor markor={mk(`besok:${b.id}`)} block>
                  <button type="button" draggable
                    onClick={() => tryck(`besok:${b.id}`)}
                    onDragStart={e => { e.dataTransfer.setData('text/plain', b.id); e.dataTransfer.effectAllowed = 'move'; tryck(`drag:${b.id}`) }}
                    className={`flex ${b.lane === undefined ? 'h-9' : 'h-[18px]'} w-full cursor-grab flex-col justify-center overflow-hidden rounded-md border-l-4 px-1.5 text-left ${b.farg ?? 'border-amber-400 bg-amber-500/20'} ${b.dimmad ? 'opacity-40 ring-2 ring-white/30' : ''}`}>
                    <span className="truncate text-[10.5px] font-semibold text-white">{b.kund}</span>
                    <span className="truncate font-mono text-[9.5px] text-slate-300">{klock(b.fran)}-{klock(b.till)}</span>
                  </button>
                </Markor>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Stor dialog på datorn (CreateCaseModal, EditCaseModal): rubrik, innehåll och fot.
 * Ritas i flödet i stället för schemat bakom, så att datorramen växer med innehållet.
 */
export function DatorModal({ titel, huvud, ikoner, children, fot }: { titel?: string; huvud?: ReactNode; ikoner?: ReactNode; children: ReactNode; fot?: ReactNode }) {
  return (
    <div className="flex min-h-[380px] items-start justify-center bg-slate-950/70 p-3">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-700 px-3.5 py-2.5">
          <div className="min-w-0">{titel ? <p className="truncate text-[13px] font-bold text-white">{titel}</p> : huvud}</div>
          {ikoner && <div className="flex flex-none gap-0.5">{ikoner}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        {fot && <div className="border-t border-slate-700 px-3.5 py-2">{fot}</div>}
      </div>
    </div>
  )
}

// ─── Ärendet ─────────────────────────────────────

export interface ArendeData {
  nr: string
  status: string
  statusFarg?: string
  kund: string
  beskrivning: string
  tid: string
  foljearende?: boolean
}

/** Ikonerna uppe till höger i engångsärendet: fotspåren, klockan och pratbubblan */
export function ArendeIkoner({ mk, tryck, fotspar = true }: { mk: Mk; tryck: Tryck; fotspar?: boolean }) {
  return (
    <>
      {fotspar && (
        <IkonRuta etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} markor={mk('fotspar')}>
          <Icon name="arende.aterbesok" size={20} />
        </IkonRuta>
      )}
      <IkonRuta etikett="Ärendehistorik" onClick={() => tryck('historik')} markor={mk('historik')}>
        <Icon name="allman.historik" size={20} />
      </IkonRuta>
      <IkonRuta etikett="Öppna kommunikation" onClick={() => tryck('komm')} markor={mk('komm')}>
        <PratbubblaIkon />
      </IkonRuta>
    </>
  )
}

/** Innehållet i fliken Ärende, förenklat */
export function ArendeInnehall({ a, tryck }: { a: ArendeData; tryck: Tryck }) {
  return (
    <>
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
      {a.foljearende && (
        <div className="mx-2.5 mt-2.5 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[11.5px] text-blue-400">
          <Icon name="guide.fraga" size={16} className="h-3.5 w-3.5" />Detta är ett följeärende
        </div>
      )}
      <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v={a.beskrivning} /></Kort>
      <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v={a.tid} /></Kort>
    </>
  )
}

/** Foten i ärendet: Radera till vänster, Avbryt och Spara ändringar till höger */
export function ArendeFot({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Markor markor={mk('radera')}>
        <button type="button" onClick={() => tryck('radera')} className="flex items-center gap-1 py-1 text-[11px] text-red-400/80 hover:text-red-400">
          <Icon name="allman.radera" size={16} className="h-3 w-3" />Radera
        </button>
      </Markor>
      <div className="flex gap-1.5">
        <PKnapp onClick={() => tryck('avbryt-arende')} markor={mk('avbryt-arende')}>Avbryt</PKnapp>
        <PKnapp prim onClick={() => tryck('spara')}>Spara ändringar</PKnapp>
      </div>
    </div>
  )
}

/** Ärendets huvud på datorn: nummer, status och kund */
export function ArendeHuvudDator({ a }: { a: ArendeData }) {
  return (
    <div className="grid gap-0.5">
      <p className="font-mono text-[13px] font-semibold text-white">{a.nr}</p>
      <Status text={a.status} farg={a.statusFarg} />
      <p className="truncate text-[11px] text-slate-400">{a.kund}</p>
    </div>
  )
}

/** Ärendet som dialog på datorn */
export function ArendeDator({ a, mk, tryck, fotspar = true, children }: { a: ArendeData; mk: Mk; tryck: Tryck; fotspar?: boolean; children?: ReactNode }) {
  return (
    <DatorModal huvud={<ArendeHuvudDator a={a} />} ikoner={<ArendeIkoner mk={mk} tryck={tryck} fotspar={fotspar} />} fot={<ArendeFot mk={mk} tryck={tryck} />}>
      <div className="relative h-full min-h-[220px]">
        <ArendeInnehall a={a} tryck={tryck} />
        {children}
      </div>
    </DatorModal>
  )
}

/** Foten längst ner i telefonen, samma knappar som i ärendet */
export function TelefonFot({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-slate-700 bg-slate-900 px-3 py-2">
      <ArendeFot mk={mk} tryck={tryck} />
    </div>
  )
}

// ─── Kommunikation ───────────────────────────────

export interface Kommentar { av: string; text: string; nar: string }

/** CommunicationSlidePanel: rubriken Kommunikation, krysset, kommentarerna och skrivfältet */
export function KommPanel({ kommentarer, utkast, mk, tryck, mobil }: {
  kommentarer: Kommentar[]
  /** Text i skrivfältet, tom = platshållaren */
  utkast: string
  mk: Mk
  tryck: Tryck
  mobil?: boolean
}) {
  return (
    <div className={`absolute z-30 flex flex-col border-slate-700 bg-slate-900 shadow-2xl ${mobil ? 'inset-0' : 'bottom-0 right-0 top-0 w-72 border-l'}`}>
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-100"><PratbubblaIkon size={16} />Kommunikation</p>
        <Markor markor={mk('stang-komm')}>
          <button type="button" onClick={() => tryck('stang-komm')} aria-label="Stäng panel" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <Icon name="allman.stang" size={16} />
          </button>
        </Markor>
      </div>
      <div className="grid flex-1 content-start gap-2 overflow-hidden p-3">
        {kommentarer.length === 0 && <p className="text-center text-[11.5px] text-slate-500">Inga kommentarer ännu</p>}
        {kommentarer.map((k, i) => (
          <div key={i} className="rounded-lg bg-slate-800/60 px-2.5 py-2">
            <p className="text-[11px] font-semibold text-white">{k.av} <span className="font-normal text-slate-500">{k.nar}</span></p>
            <p className="text-[12px] text-slate-300">{k.text}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1.5 border-t border-slate-700 p-2.5">
        <Markor markor={mk('skriv')} block>
          <button type="button" onClick={() => tryck('skriv')}
            className={`block min-h-[36px] w-full flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-left text-[12px] ${utkast ? 'text-white' : 'text-slate-500'}`}>
            {utkast || 'Skriv en kommentar... (använd @ för att nämna någon)'}
          </button>
        </Markor>
        <Markor markor={mk('skicka')}>
          <button type="button" onClick={() => tryck('skicka')} aria-label="Skicka"
            className={`flex items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 py-2 text-[12px] font-semibold text-[#fff] ${utkast ? '' : 'opacity-50'}`}>
            <Icon name="rapport.skicka" size={16} />{!mobil && 'Skicka'}
          </button>
        </Markor>
      </div>
    </div>
  )
}

// ─── Dialogerna ──────────────────────────────────

/** DeleteCaseConfirmDialog: Ta bort ärende */
export function TaBortArk({ titel, mk, tryck }: { titel: string; mk: Mk; tryck: Tryck }) {
  return (
    <Ark titel="Ta bort ärende">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-500/20 text-red-400"><Icon name="rapport.avvikelse" size={16} /></span>
        <div>
          <p className="text-[13px] font-medium text-white">{titel}</p>
          <p className="text-[11.5px] text-slate-400">Ärendet markeras som borttaget och döljs från alla vyer. All data behålls.</p>
        </div>
      </div>
      <Knapprad>
        <PKnapp onClick={() => tryck('avbryt-tabort')}>Avbryt</PKnapp>
        <PKnapp fara ikon="allman.radera" onClick={() => tryck('tabort')} markor={mk('tabort')}>Ta bort</PKnapp>
      </Knapprad>
    </Ark>
  )
}

/** EditCaseModal: Vad vill du göra? */
export function ValArk({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <Ark titel="Vad vill du göra?">
      <Val titel="Boka återbesök" text="Flytta ärendet till ett framtida datum för uppföljning av skadedjursstatus" onClick={() => tryck('val-aterbesok')} markor={mk('val-aterbesok')} />
      <Val titel="Skapa nytt ärende" text="Nytt problem hos samma kund (annat skadedjur)" onClick={() => tryck('val-nytt')} markor={mk('val-nytt')} />
      <Val titel="Duplicera ärende" text="Skapa en kopia och välj vad som följer med" onClick={() => tryck('val-duplicera')} markor={mk('val-duplicera')} />
      <button type="button" onClick={() => tryck('val-avbryt')} className="py-1 text-[12px] text-slate-400 hover:text-white">Avbryt</button>
    </Ark>
  )
}

/** Några av skadedjurstyperna i PEST_TYPE_OPTIONS */
export const SKADEDJUR = ['Råttor', 'Möss', 'Getingar', 'Silverfisk', 'Myror']

/** EditCaseModal: Skapa nytt ärende (följeärendet) */
export function FoljeArk({ valt, listaOppen, mk, tryck }: { valt: string | null; listaOppen: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Ark titel="Skapa nytt ärende" under="Välj skadedjurstyp. Kundinformation, adress och schemaläggning kopieras automatiskt.">
      <Falt etikett="Skadedjurstyp *" varde={valt ?? 'Välj skadedjurstyp...'} tom={!valt} onClick={() => tryck('skadedjur')} markor={mk('skadedjur')} />
      {listaOppen && (
        <div className="grid gap-0.5 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {SKADEDJUR.map(s => (
            <Markor key={s} markor={mk(`djur-${s}`)} block>
              <button type="button" onClick={() => tryck(`djur-${s}`)} className="w-full rounded-md px-2 py-1 text-left text-[12px] text-slate-200 hover:bg-slate-700">{s}</button>
            </Markor>
          ))}
        </div>
      )}
      <Knapprad>
        <PKnapp onClick={() => tryck('avbryt-folje')}>Avbryt</PKnapp>
        <PKnapp prim ikon="allman.plus" inaktiv={!valt} onClick={() => tryck('skapa-folje')} markor={mk('skapa-folje')}>Skapa nytt ärende</PKnapp>
      </Knapprad>
    </Ark>
  )
}
