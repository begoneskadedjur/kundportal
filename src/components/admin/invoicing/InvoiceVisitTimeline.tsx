// src/components/admin/invoicing/InvoiceVisitTimeline.tsx
// "Besök under avtalsåret" på årspremiefakturor (invoice_type 'contract'):
// tidslinje över fakturans billing-period med kundens kontrollbesök
// (station_inspection_sessions) och contract-ärenden (cases). Read-only —
// underlag när kunden frågar vad premien ger. Inga besök i perioden är
// också information och visas som text, aldrig som gissade prickar.

import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { isCompletedStatus, type ClickUpStatus } from '../../../types/database'

type DotKind = 'done' | 'booked' | 'plan'

interface TimelinePoint {
  key: string
  /** ÅÅÅÅ-MM-DD — positionerar pricken procentuellt i perioden */
  date: string
  title: string
  kind: DotKind
}

const DOT_CLASS: Record<DotKind, string> = {
  // Genomförda: fylld prick. Bokade framtida: brand-ring. Övriga schemalagda
  // ej genomförda: slate-ring.
  done: 'bg-[#20c58f]',
  booked: 'bg-slate-900 border border-[#20c58f]',
  plan: 'bg-slate-900 border border-slate-600',
}

const localDateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Kort svensk månadsetikett utan punkt ("juli" → "juli", "aug." → "aug")
const monthLabel = (dateKey: string): string => {
  const d = new Date(`${dateKey.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('sv-SE', { month: 'short' }).format(d).replace(/\.$/, '')
}

interface SessionRow {
  id: string
  case_id: string | null
  scheduled_at: string | null
  completed_at: string | null
  status: string | null
}

interface CaseRow {
  id: string
  title: string | null
  status: string | null
  scheduled_start: string | null
  completed_date: string | null
}

interface InvoiceVisitTimelineProps {
  customerId: string
  /** invoice.billing_period_start (ÅÅÅÅ-MM-DD) */
  periodStart: string
  /** invoice.billing_period_end (ÅÅÅÅ-MM-DD) */
  periodEnd: string
}

export default function InvoiceVisitTimeline({ customerId, periodStart, periodEnd }: InvoiceVisitTimelineProps) {
  const [points, setPoints] = useState<TimelinePoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const start = periodStart.slice(0, 10)
    const end = periodEnd.slice(0, 10)
    const todayKey = localDateKey()

    const load = async () => {
      const [sessionsRes, casesRes] = await Promise.all([
        supabase
          .from('station_inspection_sessions')
          .select('id, case_id, scheduled_at, completed_at, status')
          .eq('customer_id', customerId)
          .gte('scheduled_at', start)
          .lte('scheduled_at', `${end}T23:59:59`),
        supabase
          .from('cases')
          .select('id, title, status, scheduled_start, completed_date')
          .eq('customer_id', customerId)
          .not('scheduled_start', 'is', null)
          .gte('scheduled_start', start)
          .lte('scheduled_start', `${end}T23:59:59`),
      ])
      if (cancelled) return

      const sessions = (sessionsRes.data as SessionRow[] | null) || []
      const cases = (casesRes.data as CaseRow[] | null) || []

      const kindFor = (done: boolean, dateKey: string, booked: boolean): DotKind =>
        done ? 'done' : booked && dateKey >= todayKey ? 'booked' : 'plan'

      const result: TimelinePoint[] = []
      for (const s of sessions) {
        const done = s.status === 'completed' || !!s.completed_at
        const raw = (done && s.completed_at) || s.scheduled_at
        if (!raw) continue
        const dateKey = String(raw).slice(0, 10)
        result.push({
          key: `s-${s.id}`,
          date: dateKey,
          title: 'Stationskontroll',
          kind: kindFor(done, dateKey, s.status === 'scheduled'),
        })
      }
      // Ärenden vars besök redan representeras av en session dubbleras inte
      const sessionCaseIds = new Set(sessions.map(s => s.case_id).filter(Boolean) as string[])
      for (const c of cases) {
        if (sessionCaseIds.has(c.id)) continue
        const done = !!c.completed_date || isCompletedStatus(c.status as ClickUpStatus)
        const raw = (done && c.completed_date) || c.scheduled_start
        if (!raw) continue
        const dateKey = String(raw).slice(0, 10)
        result.push({
          key: `c-${c.id}`,
          date: dateKey,
          title: c.title || 'Ärende',
          kind: kindFor(done, dateKey, true),
        })
      }
      result.sort((a, b) => a.date.localeCompare(b.date))
      setPoints(result)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [customerId, periodStart, periodEnd])

  // Laddar fortfarande — rendera inget hellre än en tom sektion som blinkar
  if (points === null) return null

  const start = periodStart.slice(0, 10)
  const end = periodEnd.slice(0, 10)
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  const spanMs = endMs - startMs
  if (!Number.isFinite(spanMs) || spanMs <= 0) return null

  const pct = (dateKey: string): number =>
    Math.min(100, Math.max(0, ((Date.parse(dateKey) - startMs) / spanMs) * 100))

  const todayKey = localDateKey()
  const todayInRange = todayKey >= start && todayKey <= end
  const doneCount = points.filter(p => p.kind === 'done').length
  const next = points.find(p => p.kind === 'booked' && p.date >= todayKey) ?? null

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white mb-2">
        <CalendarRange className="w-4 h-4 text-teal-400" />
        Besök under avtalsåret
      </h3>
      {points.length === 0 ? (
        <p className="text-xs text-slate-500">Inga besök registrerade under perioden ännu</p>
      ) : (
        <>
          <div className="relative h-[34px] mx-0.5">
            <div className="absolute left-0 right-0 top-[13px] h-px bg-slate-700" aria-hidden="true" />
            {points.map(p => (
              <span
                key={p.key}
                title={`${p.date} · ${p.title}`}
                className={`absolute top-[9px] w-2 h-2 rounded-full -translate-x-1/2 ${DOT_CLASS[p.kind]}`}
                style={{ left: `${pct(p.date)}%` }}
              />
            ))}
            {todayInRange && (
              <span
                className="absolute top-[5px] w-px h-[18px] bg-slate-400 -translate-x-1/2"
                style={{ left: `${pct(todayKey)}%` }}
                title={`${todayKey} · idag`}
              />
            )}
            <span className="absolute left-0 top-[22px] text-[10px] text-slate-500">{monthLabel(start)}</span>
            <span className="absolute right-0 top-[22px] text-[10px] text-slate-500">{monthLabel(end)}</span>
          </div>
          {(doneCount > 0 || next) && (
            <p className="text-xs text-slate-400 tabular-nums mt-1">
              {doneCount > 0 && `${doneCount} ${doneCount === 1 ? 'genomfört' : 'genomförda'}`}
              {doneCount > 0 && next && ' · '}
              {next && (
                <>
                  nästa: {next.date} · {next.title}
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  )
}
