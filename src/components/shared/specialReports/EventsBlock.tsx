// src/components/shared/specialReports/EventsBlock.tsx
// Händelseblocket (3.53.0): varje händelse som ett kort med datumruta i typens
// ton, typ med punkt, rubrik och beskrivning. Klick på kortet redigerar direkt
// i raden. Gemknappen bifogar bilder: de kopplas till händelsen (event_id) och
// hamnar i delens bildblock, som skapas om det saknas. Under listan: Ny händelse,
// snabbknappar per typ och "Hämta från ärendet".

import { useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import Select from '../../ui/Select'
import { EVENT_TYPES, type SpecialReportEvent, type SpecialReportEventType, type SpecialReportImage } from '../../../types/specialReport'
import type { EventPatch, FullSection, SectionOps } from './sectionOps'
import { EVENT_TON, FALT, IKON_KNAPP, IKON_KNAPP_LATT, PRIMAR_KNAPP, TEXTFALT, dagOchManad } from './specialReportUtils'
import ImportEventsModal from './ImportEventsModal'

const TYPER = Object.keys(EVENT_TYPES) as SpecialReportEventType[]
/** Snabbknapparna under listan */
const SNABBA: SpecialReportEventType[] = ['inspektion', 'besok', 'betning', 'atgard']

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
  const filRef = useRef<HTMLInputElement>(null)
  const malRef = useRef<string | null>(null)

  const handelser = useMemo(
    () => [...section.events].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.created_at.localeCompare(b.created_at)),
    [section.events],
  )
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

  return (
    <div className="space-y-2.5">
      {handelser.length === 0 ? (
        <p className="rounded-2xl border-[1.5px] border-dashed border-slate-700 px-4 py-5 text-center text-sm text-slate-500">
          Inga händelser än. Lägg till en ny händelse eller hämta från ärendet.
        </p>
      ) : (
        <ol className="space-y-2.5">
          {handelser.map(ev => {
            const egna = bilder
              .map((b, i) => ({ bild: b, nr: i + 1 }))
              .filter(x => x.bild.event_id === ev.id)
            return (
              <HandelseKort
                key={ev.id}
                ev={ev}
                bilder={egna}
                oppen={oppen === ev.id}
                bifogar={bifogar === ev.id}
                onOppna={() => setOppen(ev.id)}
                onStang={() => setOppen(null)}
                onAndra={patch => ops.updateEvent(section.id, ev.id, patch)}
                onTaBort={() => ops.deleteEvent(section.id, ev.id)}
                onBifoga={() => valjBilder(ev.id)}
              />
            )
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={() => nyHandelse('besok', 'ny')} disabled={lagger !== null} className={PRIMAR_KNAPP}>
          {lagger === 'ny' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.plus" size={20} />}
          Ny händelse
        </button>
        <span className="hidden text-xs text-slate-500 sm:inline">eller snabbt:</span>
        {SNABBA.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => nyHandelse(t)}
            disabled={lagger !== null}
            className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${EVENT_TON[t]}`}
          >
            {lagger === t && <Loader2 className="h-4 w-4 animate-spin" />}
            {EVENT_TYPES[t].label}
          </button>
        ))}
        <span className="hidden flex-1 sm:block" />
        <button
          type="button"
          onClick={() => setVisaImport(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 hover:bg-slate-800"
        >
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
    </div>
  )
}

interface HandelseKortProps {
  ev: SpecialReportEvent
  /** Bilder kopplade till händelsen, med numret i rapporten */
  bilder: { bild: SpecialReportImage; nr: number }[]
  oppen: boolean
  bifogar: boolean
  onOppna: () => void
  onStang: () => void
  onAndra: (patch: EventPatch) => void
  onTaBort: () => Promise<void>
  onBifoga: () => void
}

function HandelseKort({ ev, bilder, oppen, bifogar, onOppna, onStang, onAndra, onTaBort, onBifoga }: HandelseKortProps) {
  const typ = EVENT_TYPES[ev.type] ?? EVENT_TYPES.notering
  const ton = EVENT_TON[ev.type] ?? EVENT_TON.notering
  const { dag, manad } = dagOchManad(ev.event_date)
  const [tarBort, setTarBort] = useState(false)

  const taBort = async () => {
    setTarBort(true)
    try { await onTaBort() } finally { setTarBort(false) }
  }

  const gemKnapp = (
    <button
      type="button"
      onClick={onBifoga}
      disabled={bifogar}
      aria-label={`Bifoga bild till ${ev.title || 'händelsen'}`}
      title="Bifoga bild"
      className={`${IKON_KNAPP} bg-slate-900`}
    >
      {bifogar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="rapport.gem" size={16} />}
    </button>
  )

  if (oppen) {
    return (
      <li className="space-y-2.5 rounded-2xl border-[1.5px] border-[#20c58f] bg-slate-800/30 p-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[170px_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Datum</span>
            <input
              type="date"
              value={ev.event_date}
              onChange={e => e.target.value && onAndra({ event_date: e.target.value })}
              className={FALT}
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Typ</span>
            <Select
              value={ev.type}
              onChange={v => onAndra({ type: v as SpecialReportEventType })}
              options={TYPER.map(t => ({ value: t, label: EVENT_TYPES[t].label }))}
            />
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Rubrik</span>
          <input value={ev.title} onChange={e => onAndra({ title: e.target.value })} className={FALT} autoFocus />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Beskrivning</span>
          <textarea
            value={ev.description ?? ''}
            onChange={e => onAndra({ description: e.target.value || null })}
            rows={3}
            placeholder="Skriv vad som gjordes och vad du såg."
            className={TEXTFALT}
          />
        </label>
        {bilder.length > 0 && <Miniatyrer bilder={bilder} farg={typ.color} />}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={taBort}
            disabled={tarBort}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            {tarBort ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.radera" size={16} />}
            Ta bort
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onBifoga}
            disabled={bifogar}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
          >
            {bifogar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="rapport.gem" size={16} />}
            Bifoga bild
          </button>
          <button
            type="button"
            onClick={onStang}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Icon name="allman.bock" size={16} />
            Klar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li
      className={`flex gap-3 rounded-2xl border-[1.5px] bg-slate-800/30 p-3 sm:gap-3.5 sm:p-3.5 ${bilder.length > 0 ? '' : 'border-slate-800'}`}
      style={bilder.length > 0 ? { borderColor: `${typ.color}66` } : undefined}
    >
      <button type="button" onClick={onOppna} className="flex min-w-0 flex-1 gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 sm:gap-3.5" aria-label={`Redigera ${ev.title || 'händelsen'}, ${ev.event_date}`}>
        <span className={`flex h-[58px] w-[54px] flex-shrink-0 flex-col items-center justify-center rounded-xl ${ton}`}>
          <span className="text-xl font-extrabold leading-none">{dag}</span>
          <span className="text-[11px] font-semibold uppercase">{manad}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${ton.split(' ').find(c => c.startsWith('text-'))}`}>
            <span className="h-[7px] w-[7px] rounded-full bg-current" />
            {typ.label}
          </span>
          <span className="text-[15px] font-bold text-white">{ev.title || 'Utan rubrik'}</span>
          {ev.description?.trim() && <span className="whitespace-pre-line text-sm leading-snug text-slate-400">{ev.description.trim()}</span>}
          {bilder.length > 0 && <Miniatyrer bilder={bilder} farg={typ.color} />}
        </span>
      </button>
      <span className="flex flex-col gap-1">
        {gemKnapp}
        <button type="button" onClick={taBort} disabled={tarBort} aria-label="Ta bort händelsen" title="Ta bort händelsen" className={IKON_KNAPP_LATT}>
          {tarBort ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.radera" size={16} />}
        </button>
      </span>
    </li>
  )
}

/** Gem, miniatyrer med ring i händelsens färg och "N bilder i rapporten" */
function Miniatyrer({ bilder, farg }: { bilder: { bild: SpecialReportImage; nr: number }[]; farg: string }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2">
      <Icon name="rapport.gem" size={16} className="text-slate-400" />
      {bilder.slice(0, 6).map(({ bild, nr }) => (
        <span
          key={bild.id}
          className="block h-10 w-10 overflow-hidden rounded-lg bg-slate-800"
          style={{ boxShadow: `0 0 0 2px var(--color-slate-900, #0f172a), 0 0 0 3.5px ${farg}` }}
          title={`Bild ${nr}`}
        >
          {bild.url && <img src={bild.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </span>
      ))}
      <span className="text-xs text-slate-400">
        {bilder.length === 1 ? '1 bild' : `${bilder.length} bilder`} i rapporten ({bilder.map(b => `bild ${b.nr}`).join(', ')})
      </span>
    </span>
  )
}
