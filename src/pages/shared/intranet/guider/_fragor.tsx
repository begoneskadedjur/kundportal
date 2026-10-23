// src/pages/shared/intranet/guider/_fragor.tsx
// Delade skärmdelar för guiderna om Frågor och uppdrag (guide-ticket-systemet och
// guide-ticket-systemet-kontor). Efterbildningar av InternAdministration (rubriken,
// "X väntar på dig, du väntar på svar i Y", Ny fråga eller uppdrag, Min inkorg och Alla,
// sökrutan), TradLista (grupperna med förklaring, raderna med status som punkt och text),
// TradVy (Öppna ärendet, Visa i ärendets kommunikation, Vem är med, Konversation,
// Nytt sedan du läste, Jag tar den, Markera som klar) och SvarsRuta (Svar till ..., Skicka svar).
// Texterna i grupperna är samma som i koden. Påhittade namn, ingenting sparas.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { Markor } from '../skarmkit'
import type { Mk, Tryck } from './_arenden'

export type Ton = 'gron' | 'gul' | 'bla' | 'gra'

const PUNKT: Record<Ton, string> = { gron: 'bg-[#20c58f]', gul: 'bg-amber-500', bla: 'bg-sky-500', gra: 'bg-slate-500' }
const TEXT: Record<Ton, string> = { gron: 'text-[#20c58f]', gul: 'text-amber-500', bla: 'text-sky-400', gra: 'text-slate-400' }

/** Status som punkt och text (StatusText), aldrig piller */
export function StatusRad({ ton, children }: { ton: Ton; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium leading-snug ${TEXT[ton]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${PUNKT[ton]}`} />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

/** Rund bokstav för en person (Initial) */
export function Bokstav({ namn, grupp }: { namn: string; grupp?: boolean }) {
  return (
    <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-300">
      {grupp ? <Icon name="dok.omnamnd" size={16} className="h-3 w-3" /> : namn.charAt(0).toUpperCase()}
    </span>
  )
}

/** Namn som portalen färgar i texten */
export const Namn = ({ children }: { children: ReactNode }) => <span className="font-semibold text-[#20c58f]">{children}</span>

/** Knapp i sidans stil. prim = grön. */
export function Knapp({ id, ikon, prim, full, mk, tryck, children }: {
  id: string; ikon?: IconName; prim?: boolean; full?: boolean; mk: Mk; tryck: Tryck; children: ReactNode
}) {
  return (
    <Markor markor={mk(id)} block={full}>
      <button type="button" onClick={() => tryck(id)}
        className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${full ? 'w-full' : ''} ${prim ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 bg-slate-900 text-white'}`}>
        {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5" />}
        {children}
      </button>
    </Markor>
  )
}

// ─── Listan ────────────────────────────────────────

/** Rubriken överst på sidan: Frågor och uppdrag, sammanfattningen och Ny fråga eller uppdrag */
export function SidHuvud({ vantar, jagVantar, alla, dator, mk, tryck }: {
  vantar: number; jagVantar: number
  /** Sammanfattningen i läget Alla, till exempel "1 till en roll utan svar, ..." */
  alla?: string
  dator?: boolean; mk: Mk; tryck: Tryck
}) {
  return (
    <div className={`flex gap-2 ${dator ? 'items-start justify-between' : 'flex-col'}`}>
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-tight text-white">Frågor och uppdrag</p>
        <p className="mt-0.5 text-[11px] text-slate-300">
          {alla ?? <><strong className={`font-semibold ${vantar > 0 ? 'text-amber-500' : 'text-slate-200'}`}>{vantar} väntar på dig</strong>, du väntar på svar i {jagVantar}</>}
        </p>
      </div>
      <Knapp id="ny" ikon="allman.plus" prim full={!dator} mk={mk} tryck={tryck}>Ny fråga eller uppdrag</Knapp>
    </div>
  )
}

/** Sökrutan */
export function SokRuta({ tryck }: { tryck: Tryck }) {
  return (
    <button type="button" onClick={() => tryck('sok-sida')}
      className="flex w-full items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-left text-[10.5px] text-slate-500">
      <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 flex-none text-slate-400" />
      <span className="truncate">Sök text, kund, ärendenummer eller person</span>
    </button>
  )
}

/** Min inkorg och Alla, bara för admin och koordinator */
export function LageFlikar({ alla, mk, tryck }: { alla: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-slate-700">
      {([['flik-min', 'Min inkorg', !alla], ['flik-alla', 'Alla', alla]] as const).map(([id, text, aktiv]) => (
        <Markor key={id} markor={mk(id)}>
          <button type="button" role="tab" aria-selected={aktiv} onClick={() => tryck(id)}
            className={`-mb-px border-b-2 pb-1 text-[11.5px] font-semibold ${aktiv ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400'}`}>
            {text}
          </button>
        </Markor>
      ))}
    </div>
  )
}

export interface RadData {
  id: string
  amne: string
  ton: Ton
  status: string
  /** Senaste repliken, visas inom citattecken */
  citat?: string
  tid: string
  kund: string
  /** "Du till Anna", "Erik till koordinatorerna" */
  franTill: string
  /** Den som visas i bokstaven, tom = grupp */
  motpart: string
  olast?: boolean
  nummer?: string
}

/** En rad i listan (TradLista › Rad) */
export function TradRad({ r, vald, dator, mk, tryck }: { r: RadData; vald?: boolean; dator?: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(r.id)} block>
      <button type="button" onClick={() => tryck(r.id)}
        className={`grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-2 border-l-[3px] px-2 py-1.5 text-left ${vald ? 'border-l-[#20c58f] bg-[#20c58f]/10' : 'border-l-transparent'}`}>
        <Bokstav namn={r.motpart || '?'} grupp={!r.motpart} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1">
            {r.olast && <span className="h-1.5 w-1.5 flex-none rounded-full bg-sky-500" aria-label="Oläst" />}
            <span className={`truncate text-[11.5px] leading-snug text-white ${r.olast ? 'font-bold' : 'font-semibold'}`}>{r.amne}</span>
          </span>
          <StatusRad ton={r.ton}>{r.status}</StatusRad>
          {r.citat && <span className="truncate text-[10px] text-slate-400">&quot;{r.citat}&quot;</span>}
          {!dator && <span className="truncate text-[10px] text-slate-400">{r.tid}, {r.kund}, {r.franTill}</span>}
        </span>
        {dator ? (
          <span className="flex max-w-[110px] flex-col items-end gap-0.5 text-right text-[10px]">
            <span className="font-mono text-slate-400">{r.tid}</span>
            <span className="truncate text-slate-300">{r.kund}</span>
            {r.nummer && <span className="font-mono text-slate-400">{r.nummer}</span>}
            <span className="truncate text-slate-400">{r.franTill}</span>
          </span>
        ) : <span />}
      </button>
    </Markor>
  )
}

/** En grupp i listan med ikon, rubrik, antal och förklaring (TradLista › Grupp) */
export function Grupp({ ikon, farg = 'text-slate-400', rubrik, antal, text, hopfalld, id, mk, tryck, children }: {
  ikon: IconName; farg?: string; rubrik: string; antal: number; text: string; hopfalld?: boolean
  id?: string; mk?: Mk; tryck?: Tryck; children?: ReactNode
}) {
  const rubrikRad = (
    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
      <span className={farg}><Icon name={ikon} size={16} /></span>
      {rubrik}
      <span className="font-medium text-slate-400">{antal}</span>
      {hopfalld && <Icon name="allman.chevron" size={16} className="h-3 w-3 text-slate-400" />}
    </span>
  )
  return (
    <section className="grid gap-1">
      <div>
        {hopfalld && id && tryck ? (
          <Markor markor={mk?.(id)}>
            <button type="button" onClick={() => tryck(id)}>{rubrikRad}</button>
          </Markor>
        ) : rubrikRad}
        <p className="text-[10px] leading-snug text-slate-400">{text}</p>
      </div>
      {!hopfalld && (antal > 0 && children ? (
        <div className="divide-y divide-slate-700/60 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">{children}</div>
      ) : <p className="text-[10px] text-slate-500">Inget här just nu.</p>)}
    </section>
  )
}

/** Underrubrik i en grupp, som Frågor till dig och Svar till dig */
export function UnderGrupp({ rubrik, antal }: { rubrik: string; antal: number }) {
  return (
    <p className="bg-slate-800/50 px-2 pb-1 pt-1.5 text-[10px] font-semibold text-slate-300">
      {rubrik}<span className="ml-1 font-medium text-slate-400">{antal}</span>
    </p>
  )
}

// ─── Tråden ────────────────────────────────────────

export interface ArendeKort {
  kund: string
  nummer: string
  rad: string
  /** "Privat, bokat 2026-10-24 08:00 hos Erik, bokad" */
  info: string
}

export interface Deltagare {
  namn: string
  beskrivning: string
  ton?: Ton
  lage?: string
  grupp?: boolean
}

export interface Inlagg {
  id: string
  namn: string
  roll?: string
  tid: string
  text: ReactNode
  egen?: boolean
  /** Läskvitto under egen replik, "Läst av Anna 10:20" */
  last?: string
}

/** Tråden (TradVy): rubrik, status, knappar, ärendet, Vem är med, Konversation och svarsrutan */
export function Trad({ amne, ton, status, knappar, hjalp, arende, med, inlagg, nyttFran, svar, tillbaka, mk, tryck }: {
  amne: string; ton: Ton; status: string; knappar?: ReactNode; hjalp?: boolean
  arende: ArendeKort; med: Deltagare[]; inlagg: Inlagg[]; nyttFran?: string
  svar?: { etikett: string; text: string; hint: string }
  tillbaka?: boolean; mk: Mk; tryck: Tryck
}) {
  return (
    <article className="grid content-start gap-2.5">
      {tillbaka && (
        <button type="button" onClick={() => tryck('tillbaka')} className="-ml-1 flex items-center gap-0.5 justify-self-start text-[11.5px] font-medium text-slate-300">
          <Icon name="allman.chevron-vanster" size={16} />
          Frågor och uppdrag
        </button>
      )}
      <header className="grid gap-1.5">
        <p className="text-[13.5px] font-bold leading-snug text-white">{amne}</p>
        <StatusRad ton={ton}>{status}</StatusRad>
        {knappar && <div className="flex flex-wrap gap-1.5">{knappar}</div>}
        {hjalp && <p className="text-[10px] text-slate-400">Klar flyttar tråden till Klara för alla. Ett nytt svar öppnar den igen.</p>}
      </header>

      <section className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2">
        <div className="flex items-start gap-2">
          <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-800 text-slate-300">
            <Icon name="arende.privat" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-white">{arende.kund}<span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">{arende.nummer}</span></p>
            <p className="text-[10.5px] text-slate-300">{arende.rad}</p>
            <p className="text-[10px] text-slate-400">{arende.info}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Knapp id="oppna-arende" ikon="rapport.oppna" mk={mk} tryck={tryck}>Öppna ärendet</Knapp>
          <Knapp id="visa-komm" ikon="dok.konversation" mk={mk} tryck={tryck}>Visa i ärendets kommunikation</Knapp>
        </div>
      </section>

      <section className="grid gap-1">
        <p className="text-[11.5px] font-semibold text-white">Vem är med</p>
        <ul className="divide-y divide-slate-700/60 rounded-xl border border-slate-700 bg-slate-900">
          {med.map(d => (
            <li key={d.namn} className="flex items-center gap-2 px-2 py-1.5">
              <Bokstav namn={d.namn} grupp={d.grupp} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-white">{d.namn}</span>
                <span className="block truncate text-[10px] text-slate-400">{d.beskrivning}</span>
              </span>
              {d.lage && d.ton && <StatusRad ton={d.ton}>{d.lage}</StatusRad>}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-1">
        <p className="text-[11.5px] font-semibold text-white">Konversation <span className="font-normal text-slate-400">{inlagg.length}</span></p>
        <ol className="grid gap-1.5">
          {inlagg.map(c => (
            <li key={c.id} className="grid gap-1">
              {c.id === nyttFran && (
                <div className="flex items-center gap-2" role="separator">
                  <span className="h-px flex-1 bg-sky-500/50" />
                  <span className="text-[10px] font-semibold text-sky-400">Nytt sedan du läste</span>
                  <span className="h-px flex-1 bg-sky-500/50" />
                </div>
              )}
              <div className={`rounded-xl border p-2 ${c.egen ? 'border-[#20c58f]/30 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-900'}`}>
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[11px] font-semibold text-white">{c.egen ? 'Du' : c.namn}</span>
                  {!c.egen && c.roll && <span className="text-[10px] text-slate-400">{c.roll}</span>}
                  <span className="font-mono text-[10px] text-slate-400">{c.tid}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-200">{c.text}</p>
              </div>
              {c.last && <p className="px-2 text-[10px] text-slate-500">{c.last}</p>}
            </li>
          ))}
        </ol>
      </section>

      {svar && (
        <section className="grid gap-1">
          <p className="text-[11px] font-semibold text-white">{svar.etikett}</p>
          <Markor markor={mk('svar-falt')} block>
            <button type="button" onClick={() => tryck('svar-falt')}
              className={`block min-h-[40px] w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-left text-[11px] ${svar.text ? 'text-white' : 'text-slate-500'}`}>
              {svar.text || 'Skriv ditt svar. Skriv @ för att nämna en kollega.'}
            </button>
          </Markor>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => tryck('ta-bild')} aria-label="Ta bild" className="p-1 text-slate-400"><Icon name="allman.foto" size={16} /></button>
            <button type="button" onClick={() => tryck('valj-fil')} aria-label="Välj fil" className="p-1 text-slate-400"><Icon name="rapport.gem" size={16} /></button>
            <button type="button" onClick={() => tryck('namn-knapp')} aria-label="Nämn en kollega" className="p-1 text-slate-400"><Icon name="dok.omnamnd" size={16} /></button>
            <span className="ml-1 flex-1 truncate text-[10px] text-slate-500">{svar.hint}</span>
            <Knapp id="skicka-svar" ikon="rapport.skicka" prim mk={mk} tryck={tryck}>Skicka svar</Knapp>
          </div>
        </section>
      )}
    </article>
  )
}
