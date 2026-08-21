// src/components/admin/customers/record/ContractTimeline.tsx
//
// Kundens tidslinje på Översikt. Byggarna i ContractTimelineList producerar
// redan tolv semantiska händelsetyper — den gamla renderingen kastade bort
// all den informationen och ritade varje typ som en identisk 2,5px-prick.
//
// Fyra grepp gör skillnaden:
//   1. Varje händelsetyp får sin egen tecknade markör
//   2. Årsband grupperar strömmen och följer med under scroll
//   3. IDAG är en materialförändring i axeln, inte ännu en rad
//   4. Filterchips döljer brus och fungerar samtidigt som färgnyckel
//
// ContractTimelineList behålls för compact-läget inne i avtalskortet — där är
// den platta listan rätt.

import { useMemo, useState } from 'react'
import { formatDayMonthSv } from '../../../../hooks/useCustomerRecord'
import { TimelineMarker, TIMELINE_STYLE, type TimelineKind } from './ContractGlyphs'
import type { RecordTimelineEvent } from './ContractTimelineList'

interface Props {
  events: RecordTimelineEvent[]
  emptyText?: string
  /** Hur många passerade händelser som visas innan "visa tidigare" */
  initialPastLimit?: number
}

const todayKey = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export default function ContractTimeline({
  events,
  emptyText = 'Inga avtalshändelser ännu.',
  initialPastLimit = 12,
}: Props) {
  const [hidden, setHidden] = useState<Set<TimelineKind>>(new Set())
  const [showAllPast, setShowAllPast] = useState(false)

  const model = useMemo(() => {
    const today = todayKey()
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))

    const countByKind = {} as Record<TimelineKind, number>
    for (const e of sorted) {
      const k = e.kind as TimelineKind
      countByKind[k] = (countByKind[k] ?? 0) + 1
    }
    const presentKinds = (Object.keys(countByKind) as TimelineKind[]).sort(
      (a, b) => countByKind[b] - countByKind[a]
    )

    const visible = sorted.filter((e) => !hidden.has(e.kind as TimelineKind))
    const past = visible.filter((e) => e.date.slice(0, 10) <= today)
    const future = visible.filter((e) => e.date.slice(0, 10) > today)

    // Framtida händelser visas alltid — de är de handlingsbara. Historiken
    // kapas, annars blir en kund med månadsfakturering en vägg av rader.
    const trimmedPast = showAllPast ? past : past.slice(-initialPastLimit)
    const hiddenPastCount = past.length - trimmedPast.length

    return { past: trimmedPast, future, hiddenPastCount, presentKinds, countByKind, today }
  }, [events, hidden, showAllPast, initialPastLimit])

  const toggle = (k: TimelineKind) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  if (events.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>
  }

  const rows: React.ReactNode[] = []
  let lastYear = ''

  const pushYearBand = (year: string, count: number) => {
    rows.push(
      <li
        key={`year-${year}`}
        className="sticky top-0 z-20 flex items-baseline gap-3 -mx-1 px-1 py-2 bg-slate-950/85 backdrop-blur-sm"
      >
        <span className="text-[13px] font-bold tabular-nums text-slate-300 tracking-[0.08em]">{year}</span>
        <span className="flex-1 h-px bg-slate-800" aria-hidden />
        <span className="text-[10px] text-slate-600 tabular-nums shrink-0">
          {count} {count === 1 ? 'händelse' : 'händelser'}
        </span>
      </li>
    )
  }

  const countForYear = (year: string) =>
    [...model.past, ...model.future].filter((e) => e.date.slice(0, 4) === year).length

  const pushEvent = (e: RecordTimelineEvent, isFuture: boolean, idx: number) => {
    const year = e.date.slice(0, 4)
    if (year !== lastYear) {
      pushYearBand(year, countForYear(year))
      lastYear = year
    }
    rows.push(
      <li key={`${e.kind}-${e.date}-${idx}`} className="relative flex gap-3 pb-4 last:pb-0">
        {/* Axelsegment bakom markören — heldraget bakåt, streckat framåt */}
        <span
          className={`absolute left-[10px] top-[22px] bottom-0 w-[2px] ${
            isFuture ? 'border-l-2 border-dashed border-slate-800' : 'bg-slate-800'
          }`}
          aria-hidden
        />
        <TimelineMarker kind={e.kind as TimelineKind} isFuture={isFuture} />
        <div className="min-w-0 flex-1 -mt-[1px]">
          <div className="flex items-baseline gap-2 flex-wrap">
            <time
              dateTime={e.date}
              className={`text-[11px] tabular-nums shrink-0 w-[68px] ${
                isFuture ? 'text-slate-600' : 'text-slate-500'
              }`}
            >
              {formatDayMonthSv(e.date)}
            </time>
            <span className={`text-sm font-medium ${isFuture ? 'text-slate-400' : 'text-slate-100'}`}>
              {e.title}
            </span>
            {e.tag && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-slate-800 bg-slate-900 text-slate-500 truncate max-w-[14rem]">
                {e.tag}
              </span>
            )}
          </div>
          {e.detail && (
            <p
              className={`text-xs mt-1 leading-relaxed pl-[76px] ${
                isFuture ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {e.detail}
            </p>
          )}
        </div>
      </li>
    )
  }

  model.past.forEach((e, i) => pushEvent(e, false, i))

  // IDAG som gräns, inte som händelse
  rows.push(
    <li key="today" className="relative flex items-center gap-3 my-1.5 py-1" aria-label="Idag">
      <span className="relative z-10 grid place-items-center w-[22px] h-[22px] shrink-0">
        <span className="w-[22px] h-[22px] rounded-full bg-[#20c58f]/15 ring-2 ring-[#20c58f] motion-safe:animate-[pulse_3s_ease-in-out_infinite]" />
        <span className="absolute w-2 h-2 rounded-full bg-[#20c58f]" />
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#20c58f] shrink-0">Idag</span>
      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
        {new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
      <span className="flex-1 h-px bg-gradient-to-r from-[#20c58f]/50 to-transparent" aria-hidden />
    </li>
  )

  lastYear = '' // framtiden får egna årsband
  model.future.forEach((e, i) => pushEvent(e, true, i))

  return (
    <div>
      {/* Filterchips — döljer brus och fungerar som färgnyckel */}
      {model.presentKinds.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {model.presentKinds.map((k) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              aria-pressed={!hidden.has(k)}
              className={`inline-flex items-center gap-1.5 text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                hidden.has(k)
                  ? 'border-slate-800 text-slate-600 hover:text-slate-400'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: TIMELINE_STYLE[k].color, opacity: hidden.has(k) ? 0.3 : 1 }}
                aria-hidden
              />
              {TIMELINE_STYLE[k].label}
              <span className="tabular-nums text-slate-600">{model.countByKind[k]}</span>
            </button>
          ))}
        </div>
      )}

      {model.hiddenPastCount > 0 && (
        <button
          onClick={() => setShowAllPast(true)}
          className="mb-3 text-xs text-slate-500 hover:text-[#20c58f] transition-colors"
        >
          Visa {model.hiddenPastCount} tidigare händelser
        </button>
      )}

      <ol className="relative">{rows}</ol>
    </div>
  )
}
