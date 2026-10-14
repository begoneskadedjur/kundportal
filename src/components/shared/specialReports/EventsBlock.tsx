// src/components/shared/specialReports/EventsBlock.tsx
// Händelseblocket. 3.55.0: en tät lista med rader på cirka 40 px: grepp för
// dra och släpp, kort datum, typens ikon, rubrik i fetstil och beskrivningen i
// grått på samma rad, miniatyr och "Bild N" när en bild är kopplad, gemknapp
// och ⋯-meny (Redigera, Flytta upp, Flytta ned, Ta bort). Alt och pil upp eller
// ned flyttar raden från tangentbordet. Ordningen är händelsens position, inte
// datumet. Klick på raden öppnar en tät redigering direkt i listan.
// En avvikelse får svag röd bakgrund och röd rubrik.
// Gemknappen bifogar bilder: de kopplas till händelsen (event_id) och hamnar i
// delens bildblock, som skapas om det saknas. Under listan: Ny händelse,
// snabbval per typ och "Hämta från ärendet".

import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import ConfirmModal from '../../ui/ConfirmModal'
import {
  EVENT_TYPES,
  handelseOrdning,
  type SpecialReportEvent,
  type SpecialReportEventType,
  type SpecialReportImage,
} from '../../../types/specialReport'
import type { EventPatch, FullSection, SectionOps } from './sectionOps'
import { LITEN_IKON_KNAPP, LITEN_TEXT_KNAPP, LITET_FALT, kortDatum } from './specialReportUtils'
import ImportEventsModal from './ImportEventsModal'
import { HandelseIkon } from './handelseIkoner'
import Meny from './Meny'

const TYPER = Object.keys(EVENT_TYPES) as SpecialReportEventType[]
/** Snabbvalen under listan */
const SNABBA: SpecialReportEventType[] = ['inspektion', 'besok', 'betning', 'atgard', 'avvikelse']

type Kopplad = { bild: SpecialReportImage; nr: number }

interface EventsBlockProps {
  reportId: string
  section: FullSection
  ops: SectionOps
}

export default function EventsBlock({ reportId, section, ops }: EventsBlockProps) {
  const [oppen, setOppen] = useState<string | null>(null)
  const [lagger, setLagger] = useState<SpecialReportEventType | 'ny' | null>(null)
  const [visaImport, setVisaImport] = useState(false)
  // Händelsen som får bilder just nu (uppladdning pågår)
  const [bifogar, setBifogar] = useState<string | null>(null)
  const [bekraftaBort, setBekraftaBort] = useState<SpecialReportEvent | null>(null)
  const [tarBort, setTarBort] = useState(false)
  // Dra och släpp: raden som dras och var den hamnar (före eller efter målet)
  const [dragId, setDragId] = useState<string | null>(null)
  const [slapp, setSlapp] = useState<{ id: string; fore: boolean } | null>(null)
  const filRef = useRef<HTMLInputElement>(null)
  const malRef = useRef<string | null>(null)
  const radRefs = useRef(new Map<string, HTMLButtonElement>())

  const handelser = useMemo(() => [...section.events].sort(handelseOrdning), [section.events])
  // Bilderna i delens ordning, med numret de får i rapporten
  const bilder = useMemo(() => [...section.images].sort((a, b) => a.position - b.position), [section.images])

  const nyHandelse = async (typ: SpecialReportEventType, knapp: SpecialReportEventType | 'ny' = typ) => {
    setLagger(knapp)
    try {
      const ev = await ops.addEvent(section.id, typ)
      if (ev) setOppen(ev.id)
    } finally {
      setLagger(null)
    }
  }

  const valjBilder = (eventId: string) => {
    malRef.current = eventId
    filRef.current?.click()
  }

  const bilderValda = async (lista: FileList | null) => {
    const eventId = malRef.current
    const filer = Array.from(lista ?? [])
    if (filRef.current) filRef.current.value = ''
    if (!eventId || filer.length === 0) return
    setBifogar(eventId)
    try {
      await ops.uploadImages(section.id, filer, eventId)
    } finally {
      setBifogar(null)
      malRef.current = null
    }
  }

  /** Sparar en ny ordning (alla id:n) om den skiljer sig från den nuvarande */
  const sparaOrdning = (ids: string[]) => {
    if (ids.length !== handelser.length) return
    if (ids.every((id, i) => handelser[i].id === id)) return
    ops.reorderEvents(section.id, ids)
  }

  const flyttaSteg = (eventId: string, steg: -1 | 1) => {
    const ids = handelser.map(e => e.id)
    const i = ids.indexOf(eventId)
    const j = i + steg
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    sparaOrdning(ids)
    requestAnimationFrame(() => radRefs.current.get(eventId)?.focus())
  }

  const slappPa = (malId: string, fore: boolean) => {
    const fran = dragId
    setDragId(null)
    setSlapp(null)
    if (!fran || fran === malId) return
    const ids = handelser.map(e => e.id).filter(id => id !== fran)
    const till = ids.indexOf(malId)
    if (till < 0) return
    ids.splice(fore ? till : till + 1, 0, fran)
    sparaOrdning(ids)
  }

  const taBort = async () => {
    if (!bekraftaBort) return
    setTarBort(true)
    try {
      await ops.deleteEvent(section.id, bekraftaBort.id)
      if (oppen === bekraftaBort.id) setOppen(null)
    } finally {
      setTarBort(false)
      setBekraftaBort(null)
    }
  }

  return (
    <div className="space-y-2">
      {handelser.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-center text-xs text-slate-500">
          Inga händelser än. Lägg till en ny händelse eller hämta från ärendet.
        </p>
      ) : (
        <ol className="overflow-visible rounded-lg border border-slate-800" onDragLeave={e => { if (e.currentTarget === e.target) setSlapp(null) }}>
          {handelser.map((ev, i) => {
            const egna = bilder
              .map((b, n) => ({ bild: b, nr: n + 1 }))
              .filter(x => x.bild.event_id === ev.id)
            const linje = slapp?.id === ev.id && dragId && dragId !== ev.id ? (slapp.fore ? 'fore' : 'efter') : null
            return (
              <HandelseRad
                key={ev.id}
                ev={ev}
                sista={i === handelser.length - 1}
                forsta={i === 0}
                bilder={egna}
                oppen={oppen === ev.id}
                bifogar={bifogar === ev.id}
                dras={dragId === ev.id}
                linje={linje}
                knappRef={el => { if (el) radRefs.current.set(ev.id, el); else radRefs.current.delete(ev.id) }}
                onOppna={() => setOppen(ev.id)}
                onStang={() => { setOppen(null); requestAnimationFrame(() => radRefs.current.get(ev.id)?.focus()) }}
                onAndra={patch => ops.updateEvent(section.id, ev.id, patch)}
                onTaBort={() => setBekraftaBort(ev)}
                onBifoga={() => valjBilder(ev.id)}
                onFlytta={steg => flyttaSteg(ev.id, steg)}
                onDragStart={e => {
                  try { e.dataTransfer.setData('text/plain', ev.id); e.dataTransfer.effectAllowed = 'move' } catch { /* äldre webbläsare */ }
                  setDragId(ev.id)
                }}
                onDragEnd={() => { setDragId(null); setSlapp(null) }}
                onDragOver={e => {
                  if (!dragId) return
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  const fore = e.clientY < r.top + r.height / 2
                  if (slapp?.id !== ev.id || slapp.fore !== fore) setSlapp({ id: ev.id, fore })
                }}
                onDrop={e => {
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  slappPa(ev.id, e.clientY < r.top + r.height / 2)
                }}
              />
            )
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => nyHandelse('besok', 'ny')}
          disabled={lagger !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#20c58f] px-3 text-[13px] font-bold text-[#04140d] transition-colors hover:bg-[#1ba876] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-50"
        >
          {lagger === 'ny' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.plus" size={16} />}
          Ny händelse
        </button>
        <div role="group" aria-label="Snabbval av händelsetyp" className="inline-flex h-8 flex-wrap divide-x divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          {SNABBA.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => nyHandelse(t)}
              disabled={lagger !== null}
              className="inline-flex h-full items-center gap-1.5 px-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {lagger === t
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <HandelseIkon typ={t} size={16} />}
              {EVENT_TYPES[t].label}
            </button>
          ))}
        </div>
        <span className="hidden flex-1 sm:block" />
        <button type="button" onClick={() => setVisaImport(true)} className={`${LITEN_TEXT_KNAPP} h-8 text-slate-400 hover:text-white`}>
          <Icon name="rapport.hamta" size={16} />
          Hämta från ärendet
        </button>
      </div>

      {/* Gemknappen: bilder kopplas till händelsen. Utan capture erbjuder mobilen både kamera och bildbibliotek */}
      <input
        ref={filRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => void bilderValda(e.target.files)}
      />

      <ImportEventsModal
        isOpen={visaImport}
        onClose={() => setVisaImport(false)}
        reportId={reportId}
        sectionId={section.id}
        sectionTitle={section.title}
        onImported={evs => ops.eventsImported(section.id, evs)}
      />
      <ConfirmModal
        isOpen={!!bekraftaBort}
        onClose={() => setBekraftaBort(null)}
        onConfirm={taBort}
        title="Ta bort händelsen?"
        message={`"${bekraftaBort?.title.trim() || 'Utan rubrik'}" tas bort. Kopplade bilder finns kvar i delen. Det går inte att ångra.`}
        confirmLabel="Ta bort"
        variant="danger"
        loading={tarBort}
      />
    </div>
  )
}

interface HandelseRadProps {
  ev: SpecialReportEvent
  forsta: boolean
  sista: boolean
  /** Bilder kopplade till händelsen, med numret i rapporten */
  bilder: Kopplad[]
  oppen: boolean
  bifogar: boolean
  dras: boolean
  /** Linjen som visar var den dragna raden hamnar */
  linje: 'fore' | 'efter' | null
  knappRef: (el: HTMLButtonElement | null) => void
  onOppna: () => void
  onStang: () => void
  onAndra: (patch: EventPatch) => void
  onTaBort: () => void
  onBifoga: () => void
  onFlytta: (steg: -1 | 1) => void
  onDragStart: (e: DragEvent<HTMLSpanElement>) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent<HTMLLIElement>) => void
  onDrop: (e: DragEvent<HTMLLIElement>) => void
}

function HandelseRad(p: HandelseRadProps) {
  const { ev, bilder, oppen, bifogar } = p
  const [meny, setMeny] = useState(false)
  const menyRef = useRef<HTMLButtonElement>(null)
  const avvikelse = ev.type === 'avvikelse'
  const typ = EVENT_TYPES[ev.type] ?? EVENT_TYPES.notering
  const menyVal = 'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] outline-none hover:bg-slate-800 focus:bg-slate-800 disabled:opacity-40'

  const tangent = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); p.onFlytta(-1) }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); p.onFlytta(1) }
  }

  const gemKnapp = (
    <button
      type="button"
      onClick={p.onBifoga}
      disabled={bifogar}
      aria-label={`Bifoga bild till ${ev.title || 'händelsen'}`}
      title="Bifoga bild"
      className={`${LITEN_IKON_KNAPP} h-7 w-7`}
    >
      {bifogar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="rapport.gem" size={16} />}
    </button>
  )

  return (
    <li
      onDragOver={p.onDragOver}
      onDrop={p.onDrop}
      className={`relative ${p.sista ? '' : 'border-b border-slate-800'} ${avvikelse ? 'bg-red-500/[0.07]' : ''} ${p.forsta ? 'rounded-t-lg' : ''} ${p.sista ? 'rounded-b-lg' : ''}`}
    >
      {/* Linjen där raden hamnar */}
      {p.linje && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-[#20c58f] ${p.linje === 'fore' ? '-top-px' : '-bottom-px'}`}
        />
      )}

      {oppen ? (
        <Redigering {...p} />
      ) : (
        <div className={`flex min-h-10 items-center gap-2 py-1 pl-1 pr-1.5 ${p.dras ? 'opacity-40' : ''}`}>
          <span
            draggable
            onDragStart={p.onDragStart}
            onDragEnd={p.onDragEnd}
            title="Dra för att flytta"
            aria-hidden="true"
            className="hidden h-7 w-[18px] flex-shrink-0 cursor-grab items-center justify-center text-slate-600 hover:text-slate-400 active:cursor-grabbing sm:flex"
          >
            <Icon name="rapport.dra" size={16} />
          </span>
          <span className="w-[46px] flex-shrink-0 pl-1 text-xs tabular-nums text-slate-400 sm:pl-0" title={ev.event_date}>
            {kortDatum(ev.event_date)}
          </span>
          <HandelseIkon typ={ev.type} size={18} className="flex-shrink-0" />
          <button
            ref={p.knappRef}
            type="button"
            onClick={p.onOppna}
            onKeyDown={tangent}
            aria-label={`${typ.label} ${ev.event_date}, ${ev.title || 'utan rubrik'}. Redigera. Alt och pil upp eller ned flyttar.`}
            className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden whitespace-nowrap rounded py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
          >
            <span className={`flex-shrink-0 text-[13px] font-semibold ${avvikelse ? 'text-red-400' : 'text-white'}`}>
              {ev.title.trim() || 'Utan rubrik'}
            </span>
            <span className="min-w-0 truncate text-xs text-slate-500">
              {ev.description?.trim() ? ev.description.trim().replace(/\s*\n\s*/g, ' ') : ''}
            </span>
          </button>
          {bilder.length > 0 && (
            <span className="hidden flex-shrink-0 items-center gap-1 text-[11px] text-slate-400 sm:flex" title={bilder.map(b => `Bild ${b.nr}`).join(', ')}>
              <span className="block h-[22px] w-[22px] overflow-hidden rounded bg-slate-800">
                {bilder[0].bild.url && <img src={bilder[0].bild.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </span>
              {bilder.length === 1 ? `Bild ${bilder[0].nr}` : `Bild ${bilder.map(b => b.nr).join(', ')}`}
            </span>
          )}
          {gemKnapp}
          <span className="relative flex-shrink-0">
            <button
              ref={menyRef}
              type="button"
              aria-label={`Fler val för ${ev.title || 'händelsen'}`}
              aria-haspopup="menu"
              aria-expanded={meny}
              onClick={() => setMeny(m => !m)}
              className={`${LITEN_IKON_KNAPP} h-7 w-7`}
            >
              <Icon name="allman.meny" size={16} />
            </button>
            <Meny open={meny} onClose={() => setMeny(false)} anchorRef={menyRef} label={ev.title.trim() || 'Händelsen'} align="right" className="sm:w-44">
              <button type="button" role="menuitem" onClick={() => { setMeny(false); p.onOppna() }} className={`${menyVal} text-slate-200`}>
                <Icon name="rapport.penna" size={16} className="text-slate-400" />
                Redigera
              </button>
              <button type="button" role="menuitem" disabled={p.forsta} onClick={() => { setMeny(false); p.onFlytta(-1) }} className={`${menyVal} text-slate-200`}>
                <Icon name="allman.chevron" size={16} className="-rotate-90 text-slate-400" />
                Flytta upp
              </button>
              <button type="button" role="menuitem" disabled={p.sista} onClick={() => { setMeny(false); p.onFlytta(1) }} className={`${menyVal} text-slate-200`}>
                <Icon name="allman.chevron" size={16} className="rotate-90 text-slate-400" />
                Flytta ned
              </button>
              <button type="button" role="menuitem" onClick={() => { setMeny(false); p.onTaBort() }} className={`${menyVal} text-red-400`}>
                <Icon name="allman.radera" size={16} />
                Ta bort
              </button>
            </Meny>
          </span>
        </div>
      )}
    </li>
  )
}

/** Tät redigering i raden: datum, typ och rubrik på en rad, beskrivning under */
function Redigering({ ev, bilder, bifogar, onStang, onAndra, onTaBort, onBifoga }: HandelseRadProps) {
  const typ = EVENT_TYPES[ev.type] ?? EVENT_TYPES.notering
  return (
    <div
      className="flex flex-col gap-1.5 bg-slate-800/40 p-2 sm:pl-7"
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onStang() } }}
    >
      <div className="flex flex-wrap gap-1.5 sm:flex-nowrap">
        <input
          type="date"
          aria-label="Datum"
          value={ev.event_date}
          onChange={e => e.target.value && onAndra({ event_date: e.target.value })}
          className={`${LITET_FALT} w-[138px] flex-shrink-0`}
        />
        <span className="relative flex w-[150px] flex-shrink-0 items-center">
          <HandelseIkon typ={ev.type} size={16} className="pointer-events-none absolute left-2" />
          <select
            aria-label="Typ"
            value={ev.type}
            onChange={e => onAndra({ type: e.target.value as SpecialReportEventType })}
            className={`${LITET_FALT} w-full pl-8`}
          >
            {TYPER.map(t => <option key={t} value={t}>{EVENT_TYPES[t].label}</option>)}
          </select>
        </span>
        <input
          aria-label="Rubrik"
          value={ev.title}
          onChange={e => onAndra({ title: e.target.value })}
          placeholder={typ.defaultTitle}
          autoFocus
          className={`${LITET_FALT} min-w-0 flex-1 basis-full font-semibold sm:basis-auto`}
        />
      </div>
      <textarea
        aria-label="Beskrivning"
        value={ev.description ?? ''}
        onChange={e => onAndra({ description: e.target.value || null })}
        rows={2}
        placeholder="Vad gjordes och vad såg du?"
        className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-[13px] leading-snug text-slate-100 placeholder-slate-500 focus:border-[#20c58f] focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onBifoga}
          disabled={bifogar}
          className={`${LITEN_TEXT_KNAPP} border border-slate-700 bg-slate-900 text-slate-200`}
        >
          {bifogar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon name="rapport.gem" size={16} />}
          Bifoga bild
        </button>
        {bilder.length > 0 && (
          <span className="flex items-center gap-1.5">
            {bilder.slice(0, 5).map(({ bild, nr }) => (
              <span key={bild.id} className="block h-7 w-7 overflow-hidden rounded bg-slate-800" title={`Bild ${nr}`}>
                {bild.url && <img src={bild.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </span>
            ))}
            <span className="text-[11px] text-slate-400">{bilder.map(b => `Bild ${b.nr}`).join(', ')}</span>
          </span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onTaBort} className={`${LITEN_TEXT_KNAPP} text-red-400`}>
          Ta bort
        </button>
        <button
          type="button"
          onClick={onStang}
          className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-900 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
        >
          Klar
        </button>
      </div>
    </div>
  )
}
