// src/pages/shared/intranet/guider/_nyvy_tickets.tsx
// Delade skärmdelar för teknikerguiderna i nya arbetsvyn om Tickets och ärendets
// verktyg (guide-ticket-systemet, guide-foljearenden, guide-avbryta-arenden,
// guide-specialrapporter). Telefon och dator enligt läsarens val (useGuideEnhet).
//
// Efterbildningar, texterna ur koden 2026-10-24:
// - ArendeVerktygArk (rubriken Ärendets verktyg, underrubriken "nummer, kund",
//   bottenark i telefonen, panel uppe till höger på datorn) med grupperna och valen
//   som EditCaseModal skickar in för privat- och företagsärenden.
// - Steget Framme i EditCaseModal (Är du framme hos kunden?, Öppna i kartor, Ring,
//   den gröna knappen Jag är framme).
// - CommunicationSlidePanel och CommentInput (Kommunikation, platshållaren
//   "Skriv en kommentar... (använd @ för att nämna någon)", @ nämn, Skicka).
// - NyFragaDialog (Ny ticket: 1 Till vem?, 2 Om vilket ärende?, 3 Vad gäller det?,
//   4 Bild eller fil, Avbryt, Skicka till ...). Telefon: ark nerifrån. Dator: i mitten.
// Påhittade kunder och kollegor, ingenting sparas.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import type { StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import { Markor } from '../skarmkit'
import { NyArende, NyGrupp, NyHjalp, NyRad, NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { Mk, Tryck } from './_arenden'
import { Bokstav } from './_fragor'

export const KUND = 'Familjen Exempel'
export const NR = 'BE-0001234'

// ─── Mina ärenden bakom ärendet ────────────────────

/** Mina ärenden med veckans besök, som bakgrund till ärendet */
export function MinaArendenLista({ mk, tryck, utanFamilj }: { mk?: Mk; tryck?: Tryck; utanFamilj?: boolean }) {
  return (
    <NyGrupp titel="Den här veckan" antal={utanFamilj ? 2 : 3} text="Dina besök från idag till och med söndag.">
      {!utanFamilj && <NyRad titel={KUND} tid="Idag 08:00" under="Privat, råttor" status="Bokad" markor={mk?.('rad-familj')} onClick={() => tryck?.('rad-familj')} />}
      <NyRad titel="Exempel AB" tid="Idag 10:30" under="Företag, myror" status="Bokad" onClick={() => tryck?.('rad-ab')} />
      <NyRad titel="Brf Exempelgården" tid="Imorgon 09:00" under="Företag, kackerlackor" status="Bokad" onClick={() => tryck?.('rad-brf')} />
    </NyGrupp>
  )
}

// ─── Steget Framme i ett privatärende ──────────────

/** Innehållet i steget Framme (EditCaseModal, nya vyn) */
export function FrammeInnehall({ kollega, tryck }: { kollega?: boolean; tryck?: Tryck }) {
  return (
    <div className="grid gap-2">
      <NyHjalp rubrik="Är du framme hos kunden?">
        {kollega
          ? 'Du är inte tilldelad ärendet. Du kan läsa det och svara i kommunikationen, men ärendet sköts av den som har det.'
          : 'Tryck på den gröna knappen när du står på plats. Kontrollera kontakten och adressen.'}
      </NyHjalp>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => tryck?.('kartor')} className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-600 bg-slate-800/60 text-[11px] font-semibold text-white">
          <Icon name="falt.navigera" size={16} />Öppna i kartor
        </button>
        <button type="button" onClick={() => tryck?.('ring')} className="flex h-9 items-center justify-center gap-1 truncate rounded-xl border border-slate-600 bg-slate-800/60 px-1 text-[11px] font-semibold text-white">
          <Icon name="kontakt.telefon" size={16} /><span className="truncate">Ring {KUND}</span>
        </button>
      </div>
      <div className="grid gap-1 rounded-lg border border-slate-700/60 bg-slate-800/30 p-2 text-[11px]">
        <p className="text-slate-400">Kontaktperson <span className="text-slate-200">{KUND}</span></p>
        <p className="text-slate-400">Adress <span className="text-slate-200">Exempelvägen 4, Södertälje</span></p>
        <p className="text-slate-400">Skadedjur <span className="text-slate-200">Råttor</span></p>
      </div>
    </div>
  )
}

// ─── Ärendet i nya vyn ─────────────────────────────

export interface ArendeRamProps {
  steg?: StegId
  /** Det som står i steget */
  innehall?: ReactNode
  /** Lager ovanpå ärendet: verktygen, en ruta, panelen */
  ovanpa?: ReactNode
  /** Ärendet är stängt: bara listan syns */
  stangt?: boolean
  /** Text på den gröna knappen, standard Jag är framme i steget Framme */
  nastaText?: string
  status?: string
  markor?: NyMarkor
  /** Klick i ramen och i ärendet: 'verktyg', 'flikvy', 'stang', 'nasta', 'tillbaka', 'steg:<id>', nav-mål */
  onRam: (mal: string) => void
  mk?: Mk
  tryck?: Tryck
  /** Notis längst ner */
  notis?: ReactNode
  /** Ärendet är borttaget: listan utan Familjen Exempel */
  borttaget?: boolean
}

/** Mina ärenden med privatärendet hos Familjen Exempel öppet i stegflödet */
export function ArendeRam({ steg = 'framme', innehall, ovanpa, stangt, nastaText, status = 'Bokad', markor, onRam, mk, tryck, notis, borttaget }: ArendeRamProps) {
  const gron = nastaText ?? (steg === 'framme' ? 'Jag är framme' : undefined)
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under="3 att ta hand om nu" onRam={onRam} markor={stangt ? markor : undefined}
      over={<>
        {!stangt && (
          <NyArende typ="privat" aktivt={steg} nr={NR} status={status} kund={`${KUND}, Exempelvägen 4`}
            nastaText={gron} markor={markor}
            onNasta={() => onRam('nasta')} onTillbaka={() => onRam('tillbaka')}
            onSteg={id => onRam(`steg:${id}`)} onIkon={m => onRam(m)}>
            {innehall ?? <FrammeInnehall tryck={tryck} />}
          </NyArende>
        )}
        {ovanpa}
        {notis}
      </>}>
      <MinaArendenLista mk={mk} tryck={tryck} utanFamilj={borttaget} />
    </NySkarm>
  )
}

// ─── Ärendets verktyg ──────────────────────────────

export interface VerktygVal { id: string; ikon: IconName; text: string; beskrivning?: string; fara?: boolean }
export interface VerktygGrupp { id: string; rubrik: string; val: VerktygVal[] }

/** Valen som EditCaseModal skickar in för ett privat- eller företagsärende */
export const VERKTYG_PRIVAT: VerktygGrupp[] = [
  { id: 'rapporter', rubrik: 'Rapporter', val: [
    { id: 'ladda-ned', ikon: 'rapport.ladda', text: 'Ladda ned rapporten', beskrivning: 'Saneringsrapporten som PDF. Finns en rapport redan frågar appen om en ny version.' },
    { id: 'skicka-tekniker', ikon: 'rapport.skicka', text: 'Skicka till ansvarig tekniker' },
    { id: 'skicka-kontakt', ikon: 'kontakt.mejl', text: 'Skicka till kontaktperson' },
    { id: 'specialrapport', ikon: 'falt.specialrapport', text: 'Specialrapporter', beskrivning: 'Skapa, öppna och ladda ned specialrapporter. De finns i steget Rapport.' },
  ] },
  { id: 'avtal-offert', rubrik: 'Avtal och offert', val: [
    { id: 'avtal', ikon: 'dok.avtal', text: 'Skapa avtal' },
    { id: 'offert', ikon: 'dok.offert', text: 'Skapa offert' },
  ] },
  { id: 'aterbesok', rubrik: 'Återbesök och nytt ärende', val: [
    { id: 'boka-aterbesok', ikon: 'arende.aterbesok', text: 'Boka återbesök', beskrivning: 'Flytta ärendet till ett framtida datum. Delfakturering är en kryssruta i dialogen.' },
    { id: 'nytt-arende', ikon: 'allman.plus', text: 'Skapa nytt ärende', beskrivning: 'Nytt problem hos samma kund (annat skadedjur).' },
    { id: 'duplicera', ikon: 'rapport.kopia', text: 'Duplicera ärende', beskrivning: 'Skapa en kopia och välj vad som följer med.' },
  ] },
  { id: 'kontakt', rubrik: 'Kontakt och plats', val: [
    { id: 'kommunikation', ikon: 'kontakt.mote', text: 'Kommunikation', beskrivning: 'Intern chatt om ärendet med kontoret och andra tekniker.' },
    { id: 'kartor', ikon: 'falt.navigera', text: 'Öppna adressen i kartor', beskrivning: 'Exempelvägen 4, Södertälje' },
    { id: 'ring', ikon: 'kontakt.telefon', text: `Ring ${KUND}` },
  ] },
  { id: 'arendet', rubrik: 'Ärendet', val: [
    { id: 'byt-namn', ikon: 'rapport.penna', text: 'Byt ärendenamn' },
    { id: 'historik', ikon: 'allman.historik', text: 'Historik', beskrivning: 'Ändringar och händelser i ärendet.' },
    { id: 'lead', ikon: 'lead.tips', text: 'Skapa lead' },
    { id: 'alla-uppgifter', ikon: 'falt.uppgifter', text: 'Alla uppgifter' },
    { id: 'status', ikon: 'arende.status', text: 'Ändra status' },
  ] },
  { id: 'ta-bort', rubrik: 'Ta bort', val: [
    { id: 'radera', ikon: 'allman.radera', text: 'Radera ärende', beskrivning: 'Frågar en gång till innan ärendet tas bort.', fara: true },
  ] },
]

/**
 * Ärendets verktyg: bottenark i telefonen, panel uppe till höger på datorn.
 * fran = gruppen listan är rullad till (grupperna före syns inte), oppen = gruppen
 * där valen visas med beskrivning.
 */
export function VerktygArk({ fran, oppen, mk, tryck, grupper = VERKTYG_PRIVAT }: { fran?: string; oppen?: string; mk: Mk; tryck: Tryck; grupper?: VerktygGrupp[] }) {
  const enhet = useGuideEnhet()
  const start = Math.max(0, grupper.findIndex(g => g.id === fran))
  const synliga = grupper.slice(start)
  return (
    <div className={`absolute inset-0 z-30 flex ${enhet === 'mobil' ? 'items-end bg-black/60' : 'items-start justify-end bg-black/30 p-2'}`}>
      <div className={`flex max-h-[88%] w-full flex-col overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl ${enhet === 'mobil' ? 'rounded-t-2xl' : 'max-w-[250px] rounded-2xl'}`}>
        <div className="flex flex-none items-start gap-2 border-b border-slate-700/50 px-3 pb-2 pt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-tight text-white">Ärendets verktyg</p>
            <p className="truncate text-[10.5px] text-slate-400">{NR}, {KUND}</p>
          </div>
          <Markor markor={mk('verktyg-stang')}>
            <button type="button" onClick={() => tryck('verktyg-stang')} aria-label="Stäng ärendets verktyg" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"><Icon name="allman.stang" size={16} /></button>
          </Markor>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-1.5 pb-2">
          {start > 0 && <p className="px-1.5 pt-1 text-center text-[9.5px] text-slate-500">Rullat ner i listan</p>}
          {synliga.map(g => (
            <section key={g.id} className="pt-1.5">
              <p className="px-1.5 pb-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">{g.rubrik}</p>
              {g.val.map(v => (
                <Markor key={v.id} markor={mk(v.id)} block>
                  <button type="button" onClick={() => tryck(v.id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left ${v.fara ? 'text-red-400' : 'text-white'}`}>
                    <Icon name={v.ikon} size={16} className={`mt-0.5 flex-none ${v.fara ? 'text-red-400' : 'text-slate-300'}`} />
                    <span className="min-w-0">
                      <span className="block text-[11.5px] font-medium leading-snug">{v.text}</span>
                      {g.id === oppen && v.beskrivning && <span className="block text-[10px] leading-snug text-slate-400">{v.beskrivning}</span>}
                    </span>
                  </button>
                </Markor>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Kommunikation i ärendet ───────────────────────

export interface Kommentar { id: string; namn: string; tid: string; text: ReactNode; egen?: boolean }

/** Panelen Kommunikation (CommunicationSlidePanel): ark i telefonen, panel till höger på datorn */
export function KommPanel({ kommentarer, text, mk, tryck }: { kommentarer: Kommentar[]; text?: string; mk: Mk; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${enhet === 'mobil' ? 'items-end' : 'justify-end'}`}>
      <div className={`flex w-full flex-col overflow-hidden border border-slate-700 bg-slate-900 ${enhet === 'mobil' ? 'h-[85%] rounded-t-2xl' : 'h-full max-w-[270px]'}`}>
        <div className="flex flex-none items-center justify-between border-b border-slate-800 px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-md bg-purple-500/15 p-1 text-purple-400"><Icon name="dok.konversation" size={16} /></span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-slate-100">Kommunikation</p>
              <p className="truncate text-[10px] text-slate-500">{NR}</p>
            </div>
          </div>
          <Markor markor={mk('panel-stang')}>
            <button type="button" onClick={() => tryck('panel-stang')} aria-label="Stäng panel" className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500"><Icon name="allman.stang" size={16} /></button>
          </Markor>
        </div>
        <div className="grid min-h-0 flex-1 content-start gap-1.5 overflow-hidden p-2.5">
          {kommentarer.length === 0 && <p className="py-4 text-center text-[11px] text-slate-500">Inga kommentarer än.</p>}
          {kommentarer.map(k => (
            <div key={k.id} className={`rounded-xl border p-2 ${k.egen ? 'border-[#20c58f]/30 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/40'}`}>
              <p className="flex items-center gap-1.5"><Bokstav namn={k.namn} /><span className="text-[11px] font-semibold text-white">{k.egen ? 'Du' : k.namn}</span><span className="font-mono text-[10px] text-slate-400">{k.tid}</span></p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-200">{k.text}</p>
            </div>
          ))}
        </div>
        <div className="flex-none border-t border-slate-800 p-2">
          <div className="rounded-lg border border-slate-700 bg-slate-800/40">
            <Markor markor={mk('komm-falt')} block>
              <button type="button" onClick={() => tryck('komm-falt')} className={`block min-h-[36px] w-full px-2 py-1.5 text-left text-[11px] ${text ? 'text-slate-200' : 'text-slate-500'}`}>
                {text || 'Skriv en kommentar... (använd @ för att nämna någon)'}
              </button>
            </Markor>
            <div className="flex items-center justify-between border-t border-slate-700/40 px-1.5 py-1">
              <span className="flex items-center gap-1 text-[10px] text-slate-600"><Icon name="rapport.gem" size={16} className="h-3.5 w-3.5 text-slate-500" />@ nämn</span>
              <Markor markor={mk('komm-skicka')}>
                <button type="button" onClick={() => tryck('komm-skicka')} aria-label="Skicka"
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${text ? 'bg-[#20c58f] text-[#fff]' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Icon name="rapport.skicka" size={16} className="h-3 w-3" />{enhet === 'dator' && 'Skicka'}
                </button>
              </Markor>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ruta i mitten (dialoger som portalen visar centrerat) ─

export function MittRuta({ titel, under, ikon, ikonFarg = 'text-amber-400', children }: { titel: string; under?: string; ikon?: IconName; ikonFarg?: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3">
      <div className="grid w-full max-w-[290px] gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3 shadow-2xl">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white">{ikon && <Icon name={ikon} size={16} className={ikonFarg} />}{titel}</p>
        {under && <p className="text-[11px] leading-snug text-slate-400">{under}</p>}
        {children}
      </div>
    </div>
  )
}

/** Knapp i en ruta. prim = grön, fara = röd, inaktiv = nedtonad men tryckbar (övningen förklarar) */
export function RutKnapp({ id, prim, fara, inaktiv, ikon, mk, tryck, children }: { id: string; prim?: boolean; fara?: boolean; inaktiv?: boolean; ikon?: IconName; mk: Mk; tryck: Tryck; children: ReactNode }) {
  const stil = fara ? 'bg-red-500/90 text-[#fff]' : prim ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 bg-slate-900 text-white'
  return (
    <span className="min-w-0 flex-1">
      <Markor markor={mk(id)} block>
        <button type="button" onClick={() => tryck(id)} aria-disabled={inaktiv}
          className={`flex h-8 w-full items-center justify-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold ${stil} ${inaktiv ? 'opacity-50' : ''}`}>
          {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5" />}{children}
        </button>
      </Markor>
    </span>
  )
}

// ─── Ny ticket ─────────────────────────────────────

export type TillVem = 'personer' | 'roll' | 'alla'

export interface NyTicketLage {
  typ: TillVem
  /** Vald kollega (En kollega) */
  anna: boolean
  /** Vald roll (En roll) */
  koordinator: boolean
  arende: boolean
  text: string
  /** Vilken del som syns överst (dialogen är rullad) */
  fran: 1 | 2 | 3
}

function StegRubrik({ n, titel }: { n: number; titel: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
      <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 font-mono text-[10px] text-slate-300">{n}</span>
      {titel}
    </p>
  )
}

function TypKort({ id, ikon, titel, text, aktiv, mk, tryck }: { id: string; ikon: IconName; titel: string; text: string; aktiv: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" role="radio" aria-checked={aktiv} onClick={() => tryck(id)}
        className={`flex w-full items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left ${aktiv ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900'}`}>
        <Icon name={ikon} size={16} className="flex-none text-slate-300" />
        <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-white">{titel}</span><span className="block truncate text-[9.5px] text-slate-400">{text}</span></span>
      </button>
    </Markor>
  )
}

function ValRad({ id, namn, under, ikon, mk, tryck }: { id: string; namn: ReactNode; under: string; ikon: ReactNode; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-800">
        {ikon}
        <span className="min-w-0 flex-1"><span className="block truncate text-[11px] text-white">{namn}</span><span className="block truncate text-[10px] text-slate-400">{under}</span></span>
      </button>
    </Markor>
  )
}

/** Mottagarna som text, som NyFragaDialog: "Anna", "koordinatorerna", "alla" */
export function mottagareText(l: NyTicketLage): string {
  if (l.typ === 'alla') return 'alla'
  if (l.typ === 'roll') return l.koordinator ? 'koordinatorerna' : ''
  return l.anna ? 'Anna' : ''
}

/** Dialogen Ny ticket: ark nerifrån i telefonen, ruta i mitten på datorn */
export function NyTicketDialog({ l, mk, tryck }: { l: NyTicketLage; mk: Mk; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  const till = mottagareText(l)
  const kan = !!till && l.arende && l.text.trim().length > 0
  const fran = enhet === 'dator' ? Math.max(1, l.fran - 1) : l.fran

  const delar: { n: number; innehall: ReactNode }[] = [
    { n: 1, innehall: <>
      <StegRubrik n={1} titel="Till vem?" />
      <div className={`grid gap-1 ${enhet === 'dator' ? 'grid-cols-3' : ''}`}>
        <TypKort id="typ-personer" ikon="rapport.person" titel="En kollega" text="En eller flera personer" aktiv={l.typ === 'personer'} mk={mk} tryck={tryck} />
        <TypKort id="typ-roll" ikon="dok.omnamnd" titel="En roll" text="Admin, koordinator eller tekniker" aktiv={l.typ === 'roll'} mk={mk} tryck={tryck} />
        <TypKort id="typ-alla" ikon="allman.foretag" titel="Alla" text="För kännedom, 12 personer" aktiv={l.typ === 'alla'} mk={mk} tryck={tryck} />
      </div>
      {l.typ === 'personer' && (l.anna ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/5 px-1.5 py-1">
          <Bokstav namn="Anna" />
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-white">Anna Exempel</span><span className="block text-[10px] text-slate-400">Koordinator</span></span>
          <button type="button" onClick={() => tryck('ta-bort-anna')} aria-label="Ta bort Anna Exempel" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} className="h-3.5 w-3.5" /></button>
        </div>
      ) : <>
        <button type="button" onClick={() => tryck('sok-kollega')} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-left text-[10.5px] text-slate-500">
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-400" />Sök kollega
        </button>
        <div className="grid">
          <ValRad id="kollega-anna" namn="Anna Exempel" under="Koordinator" ikon={<Bokstav namn="Anna" />} mk={mk} tryck={tryck} />
          <ValRad id="kollega-erik" namn="Erik Exempel" under="Tekniker" ikon={<Bokstav namn="Erik" />} mk={mk} tryck={tryck} />
        </div>
      </>)}
      {l.typ === 'roll' && (
        <div className="grid gap-1">
          {([['roll-admin', 'Admin', 2, false], ['roll-koordinator', 'Koordinator', 3, l.koordinator], ['roll-tekniker', 'Tekniker', 7, false]] as const).map(([id, namn, antal, vald]) => (
            <Markor key={id} markor={mk(id)} block>
              <button type="button" role="checkbox" aria-checked={vald} onClick={() => tryck(id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-1.5 py-1 text-left ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900'}`}>
                <span aria-hidden className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${vald ? 'border-[#20c58f] bg-[#20c58f] text-[#04281c]' : 'border-slate-500'}`}>{vald && <Icon name="allman.bock" size={16} className="h-3 w-3" />}</span>
                <span><span className="block text-[11px] font-semibold text-white">{namn}</span><span className="block text-[10px] text-slate-400">{antal} personer</span></span>
              </button>
            </Markor>
          ))}
        </div>
      )}
    </> },
    { n: 2, innehall: <>
      <StegRubrik n={2} titel="Om vilket ärende?" />
      <p className="text-[10px] text-slate-400">Tråden sparas i ärendet, så den som öppnar ärendet ser den också. Kunden ser den aldrig.</p>
      {l.arende ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/5 px-2 py-1.5">
          <Icon name="arende.privat" size={16} className="flex-none text-slate-300" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold text-white">{KUND} <span className="font-mono text-[10px] font-normal text-slate-400">{NR}</span></span>
            <span className="block truncate text-[10px] text-slate-400">2026-10-26 08:00, Råttor, Exempelvägen 4</span>
          </span>
          <button type="button" onClick={() => tryck('byt-arende')} className="rounded-lg border border-slate-600 px-1.5 py-0.5 text-[10px] text-white">Byt ärende</button>
        </div>
      ) : <>
        <button type="button" onClick={() => tryck('sok-arende')} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-left text-[10.5px] text-slate-500">
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-400" />Sök på ärendenummer, kund eller adress
        </button>
        <p className="text-[10px] text-slate-400">Förslag: dina ärenden i dag och i morgon. Sök för andra.</p>
        <div className="grid gap-0.5">
          <ValRad id="arende-familj" namn={<>{KUND} <span className="font-mono text-[10px] text-slate-400">{NR}</span></>} under="2026-10-26 08:00, Råttor, Exempelvägen 4" ikon={<Icon name="arende.privat" size={16} className="flex-none text-slate-400" />} mk={mk} tryck={tryck} />
          <ValRad id="arende-brf" namn={<>Brf Exempelgården <span className="font-mono text-[10px] text-slate-400">BE-0001240</span></>} under="2026-10-27 09:00, Kackerlackor, Exempelgatan 2" ikon={<Icon name="allman.foretag" size={16} className="flex-none text-slate-400" />} mk={mk} tryck={tryck} />
        </div>
      </>}
    </> },
    { n: 3, innehall: <>
      <StegRubrik n={3} titel="Vad gäller det?" />
      <p className="text-[10.5px] font-medium text-slate-300">Meddelande</p>
      <Markor markor={mk('meddelande')} block>
        <button type="button" onClick={() => tryck('meddelande')} className={`block min-h-[40px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-left text-[11px] ${l.text ? 'text-white' : 'text-slate-500'}`}>{l.text || ' '}</button>
      </Markor>
      <p className="text-[10px] text-slate-400">Skriv som om du ringde: vad behöver du, och till när.</p>
    </> },
    { n: 4, innehall: <>
      <StegRubrik n={4} titel="Bild eller fil" />
      <p className="text-[10px] text-slate-400">Valfritt. Bilder och PDF upp till 5 MB.</p>
      <div className="flex gap-1.5">
        {([['ta-bild', 'allman.foto', 'Ta bild'], ['valj-fil', 'rapport.gem', 'Välj fil']] as const).map(([id, ikon, text]) => (
          <button key={id} type="button" onClick={() => tryck(id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white"><Icon name={ikon} size={16} className="h-3.5 w-3.5" />{text}</button>
        ))}
      </div>
    </> },
  ]

  const fot = till ? `${till.charAt(0).toUpperCase()}${till.slice(1)} får en notis direkt.` : 'Välj vem som ska få frågan.'
  return (
    <div className={`absolute inset-0 z-30 flex bg-black/60 ${enhet === 'mobil' ? 'items-end' : 'items-center justify-center p-3'}`}>
      <section className={`flex max-h-[96%] w-full flex-col border-slate-700 bg-slate-900 ${enhet === 'mobil' ? 'rounded-t-2xl border-t' : 'max-w-[440px] rounded-2xl border shadow-2xl'}`}>
        <header className="flex items-start justify-between gap-2 border-b border-slate-700/60 px-3 pb-2 pt-2.5">
          <div>
            <p className="text-[13px] font-semibold text-white">Ny ticket</p>
            <p className="text-[10px] text-slate-400">Den du skickar till får en notis och ser tråden under Väntar på dig.</p>
          </div>
          <button type="button" onClick={() => tryck('stang')} aria-label="Stäng" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </header>
        <div className="grid min-h-0 flex-1 content-start gap-2.5 overflow-hidden px-3 py-2">
          {fran > 1 && <p className="text-center text-[9.5px] text-slate-500">Rullat ner i rutan</p>}
          {delar.filter(d => d.n >= fran).map(d => <div key={d.n} className="grid gap-1.5">{d.innehall}</div>)}
        </div>
        <footer className={`grid gap-1.5 border-t border-slate-700/60 px-3 py-2 ${enhet === 'dator' ? 'grid-cols-[1fr_auto] items-center' : ''}`}>
          <p className="text-[10px] text-slate-400">{fot}</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => tryck('avbryt')} className="flex-1 rounded-lg border border-slate-600 px-2 py-1.5 text-[11px] font-medium text-white">Avbryt</button>
            <Markor markor={mk('skicka')}>
              <button type="button" onClick={() => tryck('skicka')} aria-disabled={!kan}
                className={`flex items-center gap-1.5 rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11px] font-semibold text-[#04281c] ${kan ? '' : 'opacity-50'}`}>
                <Icon name="rapport.skicka" size={16} className="h-3.5 w-3.5" />
                {till ? `Skicka till ${till}` : 'Skicka'}
              </button>
            </Markor>
          </div>
        </footer>
      </section>
    </div>
  )
}
