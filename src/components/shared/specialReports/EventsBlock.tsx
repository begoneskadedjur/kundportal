// src/components/shared/specialReports/EventsBlock.tsx
// Händelseblocket: snabbknappar per typ (lägger till en händelse med dagens
// datum och förvald rubrik och öppnar den), tidslinje sorterad på datum,
// redigering direkt i raden och "Hämta från ärendet".

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import Select from '../../ui/Select'
import { EVENT_TYPES, type SpecialReportEvent, type SpecialReportEventType } from '../../../types/specialReport'
import type { FullSection, SectionOps } from './sectionOps'
import { EVENT_ICON, FALT, IKON_KNAPP_LATT, TEXTFALT } from './specialReportUtils'
import ImportEventsModal from './ImportEventsModal'

const TYPER = Object.keys(EVENT_TYPES) as SpecialReportEventType[]

interface EventsBlockProps {
  reportId: string
  section: FullSection
  ops: SectionOps
}

export default function EventsBlock({ reportId, section, ops }: EventsBlockProps) {
  const [oppen, setOppen] = useState<string | null>(null)
  const [lagger, setLagger] = useState<SpecialReportEventType | null>(null)
  const [visaImport, setVisaImport] = useState(false)

  const handelser = useMemo(
    () => [...section.events].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.created_at.localeCompare(b.created_at)),
    [section.events],
  )

  const nyHandelse = async (typ: SpecialReportEventType) => {
    setLagger(typ)
    try {
      const ev = await ops.addEvent(section.id, typ)
      if (ev) setOppen(ev.id)
    } finally {
      setLagger(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TYPER.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => nyHandelse(t)}
            disabled={lagger !== null}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/40 px-2.5 text-xs text-slate-200 hover:border-slate-600 disabled:opacity-60"
          >
            {lagger === t
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <span style={{ color: EVENT_TYPES[t].color }}><Icon name={EVENT_ICON[t]} size={16} /></span>}
            {EVENT_TYPES[t].label}
          </button>
        ))}
        <span className="hidden flex-1 sm:block" />
        <button
          type="button"
          onClick={() => setVisaImport(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-700 px-2.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          <Icon name="rapport.hamta" size={16} />
          Hämta från ärendet
        </button>
      </div>

      {handelser.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Inga händelser än. Välj en typ ovan eller hämta från ärendet.</p>
      ) : (
        <ol className="relative space-y-2 pl-6">
          <span className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-slate-700/60" aria-hidden="true" />
          {handelser.map(ev => (
            <HandelseRad
              key={ev.id}
              ev={ev}
              oppen={oppen === ev.id}
              onOppna={() => setOppen(ev.id)}
              onStang={() => setOppen(null)}
              onAndra={patch => ops.updateEvent(section.id, ev.id, patch)}
              onTaBort={() => ops.deleteEvent(section.id, ev.id)}
            />
          ))}
        </ol>
      )}

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

interface HandelseRadProps {
  ev: SpecialReportEvent
  oppen: boolean
  onOppna: () => void
  onStang: () => void
  onAndra: (patch: Partial<Pick<SpecialReportEvent, 'event_date' | 'type' | 'title' | 'description'>>) => void
  onTaBort: () => Promise<void>
}

function HandelseRad({ ev, oppen, onOppna, onStang, onAndra, onTaBort }: HandelseRadProps) {
  const typ = EVENT_TYPES[ev.type]
  const [tarBort, setTarBort] = useState(false)

  const taBort = async () => {
    setTarBort(true)
    try { await onTaBort() } finally { setTarBort(false) }
  }

  return (
    <li className="relative">
      <span
        className="absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 border-slate-900"
        style={{ background: typ.color }}
        aria-hidden="true"
      />
      {oppen ? (
        <div className="space-y-2 rounded-xl border border-[#20c58f] bg-slate-800/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
            <label className="block">
              <span className="block text-xs font-medium text-slate-400 mb-1">Datum</span>
              <input
                type="date"
                value={ev.event_date}
                onChange={e => e.target.value && onAndra({ event_date: e.target.value })}
                className={FALT}
              />
            </label>
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-1">Typ</span>
              <Select
                value={ev.type}
                onChange={v => onAndra({ type: v as SpecialReportEventType })}
                options={TYPER.map(t => ({ value: t, label: EVENT_TYPES[t].label }))}
              />
            </div>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-400 mb-1">Rubrik</span>
            <input
              value={ev.title}
              onChange={e => onAndra({ title: e.target.value })}
              className={FALT}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-400 mb-1">Beskrivning</span>
            <textarea
              value={ev.description ?? ''}
              onChange={e => onAndra({ description: e.target.value || null })}
              rows={3}
              placeholder="Skriv vad som gjordes och vad du såg."
              className={TEXTFALT}
            />
          </label>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={taBort}
              disabled={tarBort}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              {tarBort ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="allman.radera" size={16} />}
              Ta bort
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
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl border border-slate-700/60 bg-slate-800/30 py-2 pl-3 pr-1">
          <button type="button" onClick={onOppna} className="flex min-w-0 flex-1 gap-3 text-left" aria-label={`Redigera ${ev.title}`}>
            <span className="flex w-[92px] flex-shrink-0 flex-col gap-0.5">
              <span className="text-sm tabular-nums text-white">{ev.event_date}</span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: typ.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: typ.color }} />
                {typ.label}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">{ev.title || 'Utan rubrik'}</span>
              {ev.description && <span className="block text-sm leading-snug text-slate-400">{ev.description}</span>}
            </span>
          </button>
          <button type="button" onClick={taBort} disabled={tarBort} aria-label="Ta bort händelsen" className={IKON_KNAPP_LATT}>
            {tarBort ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="allman.radera" size={16} />}
          </button>
        </div>
      )}
    </li>
  )
}
