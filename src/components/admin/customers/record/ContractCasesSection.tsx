// src/components/admin/customers/record/ContractCasesSection.tsx
//
// Ärendefliken för avtalskunder UTAN Rum nr — "vaktronden" (designskiss
// godkänd aug 2026). Teknikern går en fast rond och kvitterar station för
// station; blyplomben är kvittensmärket.
//
//   Ärendetyper & utrustning — kategoristripp med graverade glyfer som filter
//   Kräver handling          — klartextrader, försvinner när de är åtgärdade
//   Ronden                   — avtalets rytm mot våra utförda besök + pärlband
//   Extraärenden             — artrader på samma tidsaxel + kö äldst först
//   Tempo                    — ledtid bokning → utfört med medianlinjer
//   Ärendeflöde              — klickbar lista som speglar ärendemodalen
//
// Designbeslut (ändra inte utan att fråga): inga KPI-kort, inga piller utom
// statuspillren i flödet, nyckeltal som fetstil i löptext, "våra besök"-språk,
// förklaringar som diskreta klickbara i-poppar.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import {
  formatDateSv,
  formatKr,
  VISIT_FREQUENCY_LABEL,
  VISITS_PER_YEAR_BY_FREQUENCY,
  type RecordCase,
  type RecordContract,
  type RecordCustomer,
  type RecordInspectionSession,
  type RecordInvoice,
  type RecordSchedule,
} from '../../../../hooks/useCustomerRecord'
import {
  caseCategory,
  daysSince,
  sessionLateness,
  LATENESS_STYLE,
  type Lateness,
} from '../../../../utils/caseCategory'
import { isCompletedStatus, type ClickUpStatus } from '../../../../types/database'

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  cases: RecordCase[]
  inspections: RecordInspectionSession[]
  schedules: RecordSchedule[]
  contracts: RecordContract[]
  invoices: RecordInvoice[]
  onOpenCase: (c: RecordCase) => void
}

type Cat = 'kontroll' | 'extra' | 'etabl'
const CAT: Record<Cat, { label: string; color: string }> = {
  kontroll: { label: 'Kontrollbesök', color: '#56a8e8' },
  extra: { label: 'Extraärenden', color: '#b48be8' },
  etabl: { label: 'Etablering', color: '#d9a04a' },
}
const GREEN = '#2fc98f'
const AMBER = '#e0a83a'
const RED = '#e46a5f'
const DAY = 86_400_000

function toCat(c: RecordCase): Cat {
  const k = caseCategory(c)
  return k === 'recurring' ? 'kontroll' : k === 'establishment' ? 'etabl' : 'extra'
}

/** Blå inspektion, lila bekämpning — samma färgspråk som rumsvyn. */
function extraDotColor(c: RecordCase): string {
  return /inspektion|kontroll/i.test(`${c.title} ${c.service_type ?? ''}`) ? '#56a8e8' : CAT.extra.color
}

// ---------------------------------------------------------------------------
// Graverade glyfer

function Glyph({ kind, size = 42, color }: { kind: Cat | 'station'; size?: number; color?: string }) {
  const c = color ?? (kind === 'station' ? GREEN : CAT[kind].color)
  const thick = size <= 26 ? 0.5 : 0
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      {kind === 'kontroll' && (
        <>
          <path d="M22 9A13 13 0 1 1 10.74 15.5" stroke={c} strokeWidth={1.6 + thick} strokeLinecap="round" />
          <path d="M10.74 15.5V21M10.74 15.5L5.98 18.25" stroke={c} strokeWidth={1.6 + thick} strokeLinecap="round" />
          <path d="M16.5 23l4 4 8.5-9" stroke={c} strokeWidth={1.8 + thick} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === 'extra' && (
        <>
          <path d="M9 10a3 3 0 0 1 3-3h11l6 6v21a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z" stroke={c} strokeWidth={1.6 + thick} strokeLinejoin="round" />
          <path d="M23 7v6h6" stroke={c} strokeWidth={1.4 + thick} strokeLinejoin="round" />
          <path d="M13 19h12M13 24h12M13 29h7" stroke={c} strokeWidth={1.4 + thick} strokeLinecap="round" />
          <path d="M35 25.5v13M28.5 32H41.5" stroke={c} strokeWidth={2 + thick} strokeLinecap="round" />
        </>
      )}
      {kind === 'etabl' && (
        <>
          <path d="M8 34h28" stroke={c} strokeWidth={1.6 + thick} strokeLinecap="round" />
          <rect x="14" y="24" width="16" height="10" rx="2.5" stroke={c} strokeWidth={1.6 + thick} />
          <path d="M22 27.2l2 2.8h-4z" stroke={c} strokeWidth={1.2 + thick} strokeLinejoin="round" />
          <path d="M22 7v10" stroke={c} strokeWidth={1.6 + thick} strokeLinecap="round" />
          <path d="M18.5 13.5L22 17l3.5-3.5" stroke={c} strokeWidth={1.6 + thick} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === 'station' && (
        <>
          <rect x="7" y="14" width="30" height="19" rx="4.5" stroke={c} strokeWidth={1.6 + thick} />
          <path d="M7 21.5h30" stroke={c} strokeWidth={1.4 + thick} />
          <path d="M22 15.9l2.3 3.2h-4.6z" stroke={c} strokeWidth={1.3 + thick} strokeLinejoin="round" />
          <path d="M12.5 33v-2.4a2.8 2.8 0 0 1 5.6 0V33" stroke={c} strokeWidth={1.4 + thick} />
          <path d="M25.9 33v-2.4a2.8 2.8 0 0 1 5.6 0V33" stroke={c} strokeWidth={1.4 + thick} />
        </>
      )}
    </svg>
  )
}

/** Klocka vars visare passerat spärrstrecket — försenat besök. */
function LateGlyph({ size = 26, color = RED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      <circle cx="22" cy="24" r="10" stroke={color} strokeWidth="1.7" />
      <path d="M22 13v-3" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M22 24l6.5-7.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Diskret klickbar förklaring

function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])
  return (
    <span ref={ref} className="relative inline-flex self-center">
      <button
        type="button"
        aria-label="Så läser du modulen"
        onClick={() => setOpen((v) => !v)}
        className={`grid h-[17px] w-[17px] place-items-center rounded-full border font-serif text-[10.5px] font-semibold italic leading-none transition-colors ${
          open ? 'border-[#20c58f] text-[#20c58f]' : 'border-slate-700 text-slate-500 hover:border-[#20c58f] hover:text-[#20c58f]'
        }`}
      >
        i
      </button>
      {open && (
        <span className="absolute right-[-4px] top-[25px] z-40 block w-[360px] max-w-[82vw] rounded-xl border border-[#33507a] bg-[#16233a] p-3.5 text-xs font-normal normal-case not-italic leading-relaxed tracking-normal text-slate-300 shadow-2xl">
          {text}
        </span>
      )}
    </span>
  )
}

function SectionHead({ title, aux, info }: { title: string; aux?: string; info?: string }) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3 border-b-[1.5px] border-slate-700 pb-1.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">{title}</h2>
      {aux && <span className="ml-auto text-xs text-slate-500">{aux}</span>}
      {info && <InfoDot text={info} />}
    </div>
  )
}

const PANEL_STYLE = {
  background: 'linear-gradient(180deg,#14212f,#101b2c 48px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 16px 40px -24px rgba(0,0,0,.7)',
} as const

// ---------------------------------------------------------------------------
// Stationsdata: antal ute/inne + vilka stationer senaste besöket missade

interface StationData {
  outdoor: number
  indoor: number
  missedNames: string[]
}

function useStationData(customerIds: string[], latestSessionId: string | null): StationData | null {
  const [data, setData] = useState<StationData | null>(null)
  const key = customerIds.join(',')
  useEffect(() => {
    let alive = true
    if (customerIds.length === 0) return
    ;(async () => {
      try {
        const [outRes, planRes] = await Promise.all([
          supabase.from('equipment_placements').select('id, serial_number, comment, status').in('customer_id', customerIds),
          supabase.from('floor_plans').select('id').in('customer_id', customerIds),
        ])
        const out = (outRes.data ?? []) as Array<{ id: string; serial_number: string | null; comment: string | null; status: string | null }>
        const planIds = ((planRes.data ?? []) as Array<{ id: string }>).map((p) => p.id)
        const indRes = planIds.length
          ? await supabase.from('indoor_stations').select('id, station_number, location_description, status').in('floor_plan_id', planIds)
          : { data: [] }
        const ind = (indRes.data ?? []) as Array<{ id: string; station_number: number | null; location_description: string | null; status: string | null }>
        const activeOut = out.filter((s) => (s.status ?? 'active') !== 'removed')
        const activeInd = ind.filter((s) => (s.status ?? 'active') !== 'removed')

        let missedNames: string[] = []
        if (latestSessionId) {
          const [oi, ii] = await Promise.all([
            supabase.from('outdoor_station_inspections').select('station_id').eq('session_id', latestSessionId),
            supabase.from('indoor_station_inspections').select('station_id').eq('session_id', latestSessionId),
          ])
          const seen = new Set(
            [...((oi.data ?? []) as Array<{ station_id: string }>), ...((ii.data ?? []) as Array<{ station_id: string }>)].map((r) => r.station_id)
          )
          if (seen.size > 0) {
            missedNames = [
              ...activeOut.filter((s) => !seen.has(s.id)).map((s) => s.comment || s.serial_number || 'Utestation'),
              ...activeInd
                .filter((s) => !seen.has(s.id))
                .map((s) => s.location_description || (s.station_number != null ? `Station ${s.station_number}` : 'Innestation')),
            ]
          }
        }
        if (alive) setData({ outdoor: activeOut.length, indoor: activeInd.length, missedNames })
      } catch {
        if (alive) setData(null)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, latestSessionId])
  return data
}

// ---------------------------------------------------------------------------

function arcPath(cx: number, cy: number, r: number, frac: number): string {
  const f = Math.min(0.995, Math.max(0.02, frac))
  const a = f * Math.PI * 2
  const x = cx + r * Math.sin(a)
  const y = cy - r * Math.cos(a)
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`
}

/** Blyplomben: teknikerns kvittens på ett utfört kontrollbesök. */
function Plomb({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle cx={x} cy={y} r="4.5" stroke={GREEN} strokeWidth="1.5" fill="#0b1421" />
      <path d={`M${x - 2.8} ${y - 2.8}l5.6 5.6M${x + 2.8} ${y - 2.8}l-5.6 5.6`} stroke={GREEN} strokeWidth="1.1" />
    </>
  )
}

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']

interface RondVisit {
  kind: 'done' | 'late' | 'booked'
  x: number
  session: RecordInspectionSession | null
  expectedAt: number | null
  driftDays: number | null
  coverage: { inspected: number; total: number } | null
}

// ---------------------------------------------------------------------------

export default function ContractCasesSection({
  root,
  units,
  cases,
  inspections,
  schedules,
  contracts,
  invoices,
  onOpenCase,
}: Props) {
  const [query, setQuery] = useState('')
  const [hoverCat, setHoverCat] = useState<Cat | null>(null)
  const [lockedCat, setLockedCat] = useState<Cat | null>(null)
  const [showAllTempo, setShowAllTempo] = useState(false)
  const [rondHover, setRondHover] = useState<{ px: number; label: string; visit: RondVisit | null } | null>(null)
  const rondRef = useRef<HTMLDivElement>(null)
  const activeCat = lockedCat ?? hoverCat

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of [root, ...units]) m.set(c.id, c.company_name ?? c.site_name ?? '')
    return m
  }, [root, units])

  const customerIds = useMemo(() => [root.id, ...units.map((u) => u.id)], [root, units])

  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])

  const invoiceAmounts = useMemo(
    () => new Set(invoices.filter((i) => (i.status ?? '') !== 'cancelled').map((i) => Math.round(Number(i.subtotal ?? 0)))),
    [invoices]
  )

  // -------------------------------------------------------------------------
  // Grunddata: rader, kategorier, sessioner

  const base = useMemo(() => {
    const sessionByCase = new Map<string, RecordInspectionSession>()
    for (const s of inspections) if (s.case_id) sessionByCase.set(s.case_id, s)

    const now = Date.now()
    const yearAgo = now - 365 * DAY

    const rows = cases.map((c) => {
      const session = sessionByCase.get(c.id) ?? null
      const done = session
        ? session.status === 'completed' || !!session.completed_at
        : !!c.completed_date || isCompletedStatus(c.status as ClickUpStatus)
      const date = session?.completed_at ?? session?.scheduled_at ?? c.completed_date ?? c.scheduled_start ?? c.created_at
      const lateness: Lateness = session
        ? sessionLateness(session.scheduled_at, session.status ?? '')
        : done
          ? 'ontime'
          : sessionLateness(c.scheduled_start, 'scheduled')
      return {
        case: c,
        cat: toCat(c),
        session,
        done,
        date,
        lateness,
        unitName: units.length > 0 ? (nameById.get(c.customer_id ?? '') ?? null) : null,
      }
    })

    const counts: Record<Cat, number> = { kontroll: 0, extra: 0, etabl: 0 }
    const latest: Partial<Record<Cat, string>> = {}
    for (const r of rows) {
      if (new Date(r.date ?? 0).getTime() < yearAgo) continue
      counts[r.cat]++
      if (!latest[r.cat] || (r.date ?? '') > (latest[r.cat] as string)) latest[r.cat] = r.date ?? undefined
    }
    // Etableringen är en engångshändelse — visa den även om den är äldre än 12 mån
    if (counts.etabl === 0) {
      const etabl = rows.filter((r) => r.cat === 'etabl')
      counts.etabl = etabl.length
      latest.etabl = etabl.map((r) => r.date ?? '').sort().pop() || undefined
    }

    const completedSessions = inspections
      .filter((s) => (s.status === 'completed' || !!s.completed_at) && s.completed_at)
      .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''))
    const lateSessions = inspections
      .filter((s) => sessionLateness(s.scheduled_at, s.status ?? '') !== 'ontime')
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
    const bookedSessions = inspections
      .filter((s) => s.status === 'scheduled' && Date.parse(s.scheduled_at ?? '') >= now)
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))

    return { rows, counts, latest, completedSessions, lateSessions, bookedSessions }
  }, [cases, inspections, units, nameById])

  const latestDoneSession = base.completedSessions[base.completedSessions.length - 1] ?? null
  const stations = useStationData(customerIds, latestDoneSession?.id ?? null)

  // -------------------------------------------------------------------------
  // Ronden: avtalets rytm mot verkligheten

  const rond = useMemo(() => {
    const hasRecurring = inspections.length > 0 || schedules.length > 0
    if (!hasRecurring) return null

    const activeSchedule = schedules.find((s) => s.status === 'active') ?? schedules[0] ?? null
    const contractWithFreq = contracts.find((c) => c.visits_per_year || c.visit_frequency)
    const visitsPerYear =
      contractWithFreq?.visits_per_year ??
      (contractWithFreq?.visit_frequency ? VISITS_PER_YEAR_BY_FREQUENCY[contractWithFreq.visit_frequency] : null) ??
      (activeSchedule?.frequency ? VISITS_PER_YEAR_BY_FREQUENCY[activeSchedule.frequency] : null) ??
      null
    const frequencyLabel = contractWithFreq?.visit_frequency
      ? VISIT_FREQUENCY_LABEL[contractWithFreq.visit_frequency]
      : activeSchedule?.frequency
        ? (VISIT_FREQUENCY_LABEL[activeSchedule.frequency] ?? 'Anpassat schema')
        : null

    // Tidsdomän: 12 månader bakåt + 2 framåt, hela månader
    const now = new Date()
    const domainStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime()
    const domainEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59).getTime()
    const X0 = 20
    const XW = 960
    const x = (t: number) => X0 + ((t - domainStart) / (domainEnd - domainStart)) * XW
    const todayX = x(Date.now())

    const months: Array<{ x: number; label: string; future: boolean }> = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 15)
      months.push({ x: x(d.getTime()), label: MONTH_SHORT[d.getMonth()], future: i >= 12 })
    }

    // Förväntansspåret: avtalets rytm förankrad i schemastarten
    const stepMs = visitsPerYear ? (365.25 / visitsPerYear) * DAY : null
    const expected: number[] = []
    if (stepMs) {
      const anchorIso = activeSchedule?.schedule_start_date ?? base.completedSessions[0]?.completed_at ?? null
      const anchor = anchorIso ? Date.parse(anchorIso) : domainStart
      const n0 = Math.ceil((domainStart - anchor) / stepMs)
      for (let t = anchor + n0 * stepMs; t <= domainEnd; t += stepMs) expected.push(t)
    }

    // Matcha utförda besök mot förväntade tider
    const doneInWindow = base.completedSessions.filter((s) => Date.parse(s.completed_at!) >= domainStart)
    const matchedDone = new Set<string>()
    const visits: RondVisit[] = []
    const lateExpected: Array<{ t: number; x: number }> = []

    for (const exp of expected) {
      if (stepMs == null) break
      if (exp > Date.now()) continue
      let best: RecordInspectionSession | null = null
      let bestDiff = stepMs * 1.25
      for (const s of doneInWindow) {
        if (matchedDone.has(s.id)) continue
        const diff = Date.parse(s.completed_at!) - exp
        if (diff >= -stepMs * 0.5 && Math.abs(diff) < bestDiff) {
          best = s
          bestDiff = Math.abs(diff)
        }
      }
      if (best) {
        matchedDone.add(best.id)
        const total = (best.total_outdoor_stations ?? 0) + (best.total_indoor_stations ?? 0)
        const inspected = (best.inspected_outdoor_stations ?? 0) + (best.inspected_indoor_stations ?? 0)
        visits.push({
          kind: 'done',
          x: x(Date.parse(best.completed_at!)),
          session: best,
          expectedAt: exp,
          driftDays: Math.round((Date.parse(best.completed_at!) - exp) / DAY),
          coverage: total > 0 ? { inspected, total } : null,
        })
      } else {
        // Täcks den förväntade tiden av en kommande bokning? Då är den inte försenad.
        const covered = base.bookedSessions.some((s) => Math.abs(Date.parse(s.scheduled_at ?? '') - exp) < stepMs * 0.75)
        if (!covered) lateExpected.push({ t: exp, x: x(exp) })
      }
    }

    // Utförda besök utan förväntansmatchning (extra kontroller, tätare schema)
    for (const s of doneInWindow) {
      if (matchedDone.has(s.id)) continue
      const total = (s.total_outdoor_stations ?? 0) + (s.total_indoor_stations ?? 0)
      const inspected = (s.inspected_outdoor_stations ?? 0) + (s.inspected_indoor_stations ?? 0)
      visits.push({
        kind: 'done',
        x: x(Date.parse(s.completed_at!)),
        session: s,
        expectedAt: null,
        driftDays: null,
        coverage: total > 0 ? { inspected, total } : null,
      })
    }

    for (const s of base.bookedSessions) {
      const t = Date.parse(s.scheduled_at ?? '')
      if (t <= domainEnd) visits.push({ kind: 'booked', x: x(t), session: s, expectedAt: null, driftDays: null, coverage: null })
    }
    for (const le of lateExpected) {
      visits.push({ kind: 'late', x: le.x, session: null, expectedAt: le.t, driftDays: Math.round((Date.now() - le.t) / DAY), coverage: null })
    }
    visits.sort((a, b) => a.x - b.x)

    // Snittintervall mellan utförda besök
    const gaps: number[] = []
    for (let i = 1; i < doneInWindow.length; i++) {
      gaps.push((Date.parse(doneInWindow[i].completed_at!) - Date.parse(doneInWindow[i - 1].completed_at!)) / DAY)
    }
    const meanGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null
    const targetGap = visitsPerYear ? Math.round(365 / visitsPerYear) : null

    const expectedRings = expected.map((t) => ({ t, x: x(t) }))
    const nextBooked = base.bookedSessions[0] ?? null

    return {
      visitsPerYear,
      frequencyLabel,
      expectedRings,
      visits,
      todayX,
      months,
      doneCount: doneInWindow.length,
      lateCount: lateExpected.length + base.lateSessions.length,
      lateExpected,
      meanGap,
      targetGap,
      nextBooked,
      domainStart,
      domainEnd,
      x,
    }
  }, [inspections, schedules, contracts, base])

  // -------------------------------------------------------------------------
  // Extraärenden + tempo

  const extra = useMemo(() => {
    const now = Date.now()
    const yearAgo = now - 365 * DAY
    const all = base.rows.filter((r) => r.cat === 'extra')
    const inWindow = all.filter((r) => new Date(r.date ?? 0).getTime() >= yearAgo)

    // Artrader: gruppera på skadedjur, största först, max 5 + Övrigt
    const byPest = new Map<string, typeof inWindow>()
    for (const r of inWindow) {
      const key = r.case.pest_type?.trim() || 'Övrigt'
      if (!byPest.has(key)) byPest.set(key, [])
      byPest.get(key)!.push(r)
    }
    const sorted = [...byPest.entries()].sort((a, b) => b[1].length - a[1].length)
    const pestRows = sorted.slice(0, 5)
    const rest = sorted.slice(5).flatMap(([, v]) => v)
    if (rest.length > 0) {
      const existing = pestRows.find(([k]) => k === 'Övrigt')
      if (existing) existing[1].push(...rest)
      else pestRows.push(['Övrigt', rest])
    }

    const isSaleCase = (c: RecordCase) => invoiceAmounts.has(Math.round(Number(c.price ?? 0)))
    const doneRevenue = inWindow
      .filter((r) => r.done && r.case.price != null && !isSaleCase(r.case))
      .reduce((s, r) => s + Number(r.case.price ?? 0), 0)
    const queue = all
      .filter((r) => !r.done)
      .sort((a, b) => a.case.created_at.localeCompare(b.case.created_at))
    const queueSum = queue.reduce((s, r) => s + Number(r.case.price ?? 0), 0)
    const topPest = pestRows[0] ?? null

    // Tempo: ledtid bokning → utfört. ClickUp-importerad historik har
    // created_at = importtidpunkten och skulle ljuga — bara rimliga spann räknas.
    const leadOf = (c: RecordCase) => {
      if (!c.completed_date) return null
      const lead = (Date.parse(c.completed_date) - Date.parse(c.created_at)) / DAY
      if (lead <= 0 || lead > 120) return null
      return lead
    }
    const tempoRows = inWindow
      .filter((r) => r.done && leadOf(r.case) != null)
      .map((r) => {
        const created = Date.parse(r.case.created_at)
        const toDone = leadOf(r.case)!
        const toBookedRaw = r.case.scheduled_start ? (Date.parse(r.case.scheduled_start) - created) / DAY : null
        const toBooked = toBookedRaw != null && toBookedRaw > 0 && toBookedRaw <= toDone ? toBookedRaw : null
        return { row: r, toBooked, toDone }
      })
      .sort((a, b) => b.row.case.created_at.localeCompare(a.row.case.created_at))

    const median = (xs: number[]) => {
      if (!xs.length) return null
      const s = [...xs].sort((a, b) => a - b)
      return s[Math.floor(s.length / 2)]
    }
    const medianBooked = median(tempoRows.map((t) => t.toBooked).filter((v): v is number => v != null))
    const medianDone = median(tempoRows.map((t) => t.toDone))
    const prevRows = all.filter((r) => {
      const t = new Date(r.date ?? 0).getTime()
      return r.done && t < yearAgo && t >= now - 730 * DAY && leadOf(r.case) != null
    })
    const prevMedian = median(prevRows.map((r) => leadOf(r.case)!))
    const slowest = tempoRows.length
      ? tempoRows.reduce((m, t) => (t.toDone > m.toDone ? t : m), tempoRows[0])
      : null

    return { all, inWindow, pestRows, doneRevenue, queue, queueSum, topPest, tempoRows, medianBooked, medianDone, prevMedian, slowest }
  }, [base.rows, invoiceAmounts])

  // -------------------------------------------------------------------------
  // Kräver handling

  const actions = useMemo(() => {
    const list: Array<{ key: string; icon: React.ReactNode; body: React.ReactNode; cta: string; onClick: (() => void) | null }> = []

    for (const s of base.lateSessions.slice(0, 3)) {
      const c = s.case_id ? caseById.get(s.case_id) : null
      list.push({
        key: `late-${s.id}`,
        icon: <LateGlyph />,
        body: (
          <>
            Kontrollbesöket planerat <b className="tabular-nums text-slate-100">{formatDateSv(s.scheduled_at)}</b> har passerat utan avslut —{' '}
            <span className="font-semibold text-[#e46a5f]">försenat {daysSince(s.scheduled_at)} dagar</span>.
            {s.technician_name && <> Tekniker: {s.technician_name}.</>}
          </>
        ),
        cta: 'Öppna ärendet →',
        onClick: c ? () => onOpenCase(c) : null,
      })
    }

    // Sjunkande stationstäckning: tre senaste besöken i strikt fallande täckning
    const last3 = base.completedSessions.slice(-3)
    if (last3.length === 3) {
      const cov = last3.map((s) => {
        const total = (s.total_outdoor_stations ?? 0) + (s.total_indoor_stations ?? 0)
        const insp = (s.inspected_outdoor_stations ?? 0) + (s.inspected_indoor_stations ?? 0)
        return { total, insp, ratio: total > 0 ? insp / total : 1 }
      })
      if (cov.every((c) => c.total > 0) && cov[0].ratio > cov[1].ratio && cov[1].ratio > cov[2].ratio) {
        const c = last3[2].case_id ? caseById.get(last3[2].case_id) : null
        const missed = stations?.missedNames.slice(0, 2) ?? []
        list.push({
          key: 'coverage',
          icon: <Glyph kind="station" size={26} color={AMBER} />,
          body: (
            <>
              Stationstäckningen har sjunkit två besök i rad —{' '}
              <span className="font-semibold tabular-nums text-[#e0a83a]">
                {cov.map((x) => x.insp).join(' → ')} <span className="text-[11px]">av</span> {cov[2].total}
              </span>
              .{missed.length > 0 && <> {missed.join(' och ')} missades senast.</>}
            </>
          ),
          cta: 'Se besöket →',
          onClick: c ? () => onOpenCase(c) : null,
        })
      }
    }

    const oldest = extra.queue[0]
    if (oldest) {
      const wait = daysSince(oldest.case.created_at) ?? 0
      if (wait > 14) {
        list.push({
          key: 'queue',
          icon: <Glyph kind="extra" size={26} color={AMBER} />,
          body: (
            <>
              Äldsta sålda extraärendet har väntat <b className="tabular-nums text-slate-100">{wait} dagar</b> på utförande —{' '}
              <b className="text-slate-100">
                {oldest.case.title}
                {Number(oldest.case.price ?? 0) > 0 && <>, {formatKr(Number(oldest.case.price))}</>}
              </b>
              .
            </>
          ),
          cta: 'Öppna →',
          onClick: () => onOpenCase(oldest.case),
        })
      }
    }

    return list
  }, [base, extra.queue, caseById, stations, onOpenCase])

  // -------------------------------------------------------------------------
  // Ärendeflödet

  const flow = useMemo(() => {
    const q = query.trim().toLowerCase()
    return base.rows
      .filter((r) => !activeCat || r.cat === activeCat)
      .filter(
        (r) =>
          !q ||
          (r.case.case_number ?? '').toLowerCase().includes(q) ||
          r.case.title.toLowerCase().includes(q) ||
          (r.case.primary_technician_name ?? '').toLowerCase().includes(q) ||
          (r.case.pest_type ?? '').toLowerCase().includes(q) ||
          (r.unitName ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aLate = a.lateness !== 'ontime' && !a.done
        const bLate = b.lateness !== 'ontime' && !b.done
        if (aLate !== bLate) return aLate ? -1 : 1
        return (b.date ?? '').localeCompare(a.date ?? '')
      })
  }, [base.rows, query, activeCat])

  // -------------------------------------------------------------------------

  const onRondMove = (e: React.MouseEvent) => {
    if (!rond || !rondRef.current) return
    const rect = rondRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const ux = (px / rect.width) * 1000
    if (ux < 20 || ux > 980) {
      setRondHover(null)
      return
    }
    const frac = (ux - 20) / 960
    const t = rond.domainStart + frac * (rond.domainEnd - rond.domainStart)
    const d = new Date(t)
    let best: RondVisit | null = null
    let bestDiff = 35
    for (const v of rond.visits) {
      const diff = Math.abs(v.x - ux)
      if (diff < bestDiff) {
        bestDiff = diff
        best = v
      }
    }
    setRondHover({ px, label: `${MONTH_SHORT[d.getMonth()].toLowerCase()} ${d.getFullYear()}`, visit: best })
  }

  const openVisitCase = (v: RondVisit) => {
    const c = v.session?.case_id ? caseById.get(v.session.case_id) : null
    if (c) onOpenCase(c)
  }

  const pearlBand = useMemo(() => {
    if (!latestDoneSession) return null
    const total = (latestDoneSession.total_outdoor_stations ?? 0) + (latestDoneSession.total_indoor_stations ?? 0)
    const inspected = (latestDoneSession.inspected_outdoor_stations ?? 0) + (latestDoneSession.inspected_indoor_stations ?? 0)
    if (total === 0) return null
    return { total, inspected, missed: Math.max(0, total - inspected) }
  }, [latestDoneSession])

  const totalCases = base.counts.kontroll + base.counts.extra + base.counts.etabl

  return (
    <div className="space-y-8">
      {/* ================= Ärendetyper & utrustning ================= */}
      <section>
        <SectionHead title="Ärendetyper & utrustning" aux="senaste 12 mån · hovra för att filtrera flödet, klicka för att låsa" />
        <div className="flex items-stretch max-md:flex-wrap max-md:gap-y-3">
          {(Object.keys(CAT) as Cat[]).map((cat, i) => (
            <button
              key={cat}
              onMouseEnter={() => setHoverCat(cat)}
              onMouseLeave={() => setHoverCat(null)}
              onClick={() => setLockedCat(lockedCat === cat ? null : cat)}
              className={`flex flex-1 items-center gap-3.5 py-1 pr-5 text-left ${i > 0 ? 'border-l border-slate-800 pl-5' : ''}`}
            >
              <Glyph kind={cat} />
              <div>
                <span
                  className={`text-[30px] font-light leading-none tabular-nums tracking-tight ${base.counts[cat] === 0 ? 'text-slate-600' : 'text-slate-100'}`}
                >
                  {base.counts[cat]}
                </span>
                <span className="mt-1 block h-0.5 w-4 rounded-full" style={{ background: CAT[cat].color, opacity: base.counts[cat] === 0 ? 0.25 : 1 }} />
              </div>
              <div>
                <div className={`text-[12.5px] ${lockedCat === cat ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>{CAT[cat].label}</div>
                <div className="text-[11px] text-slate-500">
                  {base.latest[cat]
                    ? `${cat === 'etabl' ? 'utförd' : 'senast'} ${formatDateSv(base.latest[cat] ?? null)}`
                    : '—'}
                </div>
              </div>
            </button>
          ))}
          {stations && stations.outdoor + stations.indoor > 0 && (
            <div className="flex flex-1 items-center gap-3.5 border-l border-slate-800 py-1 pl-5 pr-5">
              <Glyph kind="station" />
              <div>
                <span className="text-[30px] font-light leading-none tabular-nums tracking-tight text-slate-100">
                  {stations.outdoor + stations.indoor}
                </span>
                <span className="mt-1 block h-0.5 w-4 rounded-full" style={{ background: GREEN }} />
              </div>
              <div>
                <div className="text-[12.5px] text-slate-400">Betesstationer</div>
                <div className="text-[11px] tabular-nums text-slate-500">
                  {stations.outdoor} ute · {stations.indoor} inne
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================= Kräver handling ================= */}
      {actions.length > 0 && (
        <section>
          <SectionHead title="Kräver handling" aux="försvinner när det är åtgärdat" />
          <div className="flex flex-col">
            {actions.map((a, i) => (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick ?? undefined}
                className={`group -mx-2.5 flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[13px] text-slate-400 transition-colors hover:bg-amber-500/[.06] ${
                  i > 0 ? 'border-t border-dashed border-slate-800' : ''
                } ${a.onClick ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="shrink-0">{a.icon}</span>
                <span className="min-w-0">{a.body}</span>
                {a.onClick && (
                  <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-[#20c58f] opacity-0 transition-opacity group-hover:opacity-100">
                    {a.cta}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ================= Ronden ================= */}
      {rond && (
        <section>
          <SectionHead
            title="Ronden — leverans mot avtalet"
            aux={
              rond.visitsPerYear
                ? `avtalet ger ${rond.visitsPerYear} kontrollbesök per år${rond.frequencyLabel ? ` · ${rond.frequencyLabel.toLowerCase()}` : ''}`
                : (rond.frequencyLabel ?? undefined)
            }
            info="Övre spåret är avtalets rytm, undre är våra utförda besök — plomben är teknikerns kvittens. Linjens lutning mellan spåren visar förseningen: brant = i tid, flack och bärnstensfärgad = sent. En ring som står kvar utan plomb är ett försenat besök, och den streckade linjen växer för varje dag fram till idag. Allt är klickbart och öppnar ärendet."
          />
          <p className="max-w-[74ch] text-sm text-slate-400">
            {rond.visitsPerYear ? (
              <>
                <b className="tabular-nums text-slate-100">
                  {Math.min(rond.doneCount, rond.visitsPerYear)} av {rond.visitsPerYear}
                </b>{' '}
                avtalade kontrollbesök är utförda de senaste 12 månaderna.
              </>
            ) : (
              <>
                <b className="tabular-nums text-slate-100">{rond.doneCount}</b> kontrollbesök är utförda de senaste 12 månaderna.
              </>
            )}
            {rond.lateExpected.length > 0 && (
              <>
                {' '}
                <span className="font-semibold text-[#e46a5f]">
                  {rond.lateExpected.length === 1
                    ? `Ett besök är försenat sedan ${Math.round((Date.now() - rond.lateExpected[0].t) / DAY)} dagar`
                    : `${rond.lateExpected.length} besök är försenade`}
                </span>
                .
              </>
            )}
            {rond.nextBooked && (
              <>
                {' '}
                Nästa är bokat <b className="tabular-nums text-slate-100">{formatDateSv(rond.nextBooked.scheduled_at)}</b>
                {rond.nextBooked.technician_name && (
                  <>
                    {' '}
                    med <b className="text-slate-100">{rond.nextBooked.technician_name}</b>
                  </>
                )}
                .
              </>
            )}
            {rond.meanGap != null && rond.targetGap != null && (
              <>
                {' '}
                Snittintervall <b className="tabular-nums text-slate-100">{rond.meanGap} dagar</b> mot avtalade{' '}
                <b className="tabular-nums text-slate-100">{rond.targetGap}</b>.
              </>
            )}
          </p>

          <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-700" style={PANEL_STYLE}>
            <div ref={rondRef} className="relative px-1 pt-1.5" onMouseMove={onRondMove} onMouseLeave={() => setRondHover(null)}>
              <svg viewBox="0 0 1000 172" className="block w-full overflow-visible" aria-label="Kontrollbesök mot avtalsplan">
                {/* framtidszon */}
                <rect x={rond.todayX} y="6" width={Math.max(0, 994 - rond.todayX)} height="140" fill="rgba(255,255,255,.015)" />
                <line x1={rond.todayX} y1="6" x2={rond.todayX} y2="146" stroke="#20c58f" strokeOpacity=".45" strokeWidth="1" />
                <path d={`M${rond.todayX - 4} 146l4 6 4-6z`} fill="#20c58f" fillOpacity=".6" />
                <text x={rond.todayX + 7} y="16" fontSize="9" fill="#20c58f" opacity=".8">
                  idag
                </text>

                <text x="20" y="34" fontSize="9" letterSpacing="1.5" fill="#5d6f88">
                  AVTALAT
                </text>
                <line x1="20" y1="46" x2="980" y2="46" stroke="#223247" strokeWidth="1" strokeDasharray="1 4" />
                <text x="20" y="100" fontSize="9" letterSpacing="1.5" fill="#5d6f88">
                  UTFÖRT
                </text>
                <line x1="20" y1="112" x2="980" y2="112" stroke="#223247" strokeWidth="1" />

                {/* förväntansringar */}
                {rond.expectedRings.map((r, i) => (
                  <circle key={`exp-${i}`} cx={r.x} cy="46" r="4" stroke="#2c3c52" strokeWidth="1.4" fill="none" />
                ))}

                {/* ledlinjer + besök */}
                {rond.visits.map((v, i) => {
                  if (v.kind === 'done') {
                    const drift = v.driftDays
                    const lineColor = drift == null ? null : drift > 45 ? RED : drift > 14 ? AMBER : '#3a4c63'
                    return (
                      <g key={`v-${i}`} className="cursor-pointer" onClick={() => openVisitCase(v)}>
                        {v.expectedAt != null && lineColor && (
                          <line x1={rond.x(v.expectedAt)} y1="50" x2={v.x} y2="107" stroke={lineColor} strokeWidth="1.4" />
                        )}
                        {v.coverage &&
                          (v.coverage.inspected >= v.coverage.total ? (
                            <circle cx={v.x} cy="112" r="8" stroke={GREEN} strokeOpacity=".55" strokeWidth="1.4" fill="none" />
                          ) : (
                            <path
                              d={arcPath(v.x, 112, 8, v.coverage.inspected / v.coverage.total)}
                              stroke={v.coverage.inspected / v.coverage.total < 0.9 ? AMBER : GREEN}
                              strokeOpacity=".7"
                              strokeWidth="1.4"
                              fill="none"
                            />
                          ))}
                        <Plomb x={v.x} y={112} />
                      </g>
                    )
                  }
                  if (v.kind === 'late') {
                    return (
                      <g key={`v-${i}`}>
                        <circle cx={v.x} cy="46" r="4.5" stroke={RED} strokeWidth="1.7" fill="none" />
                        <line x1={v.x + 6} y1="46" x2={Math.max(v.x + 6, rond.todayX - 2)} y2="46" stroke={RED} strokeWidth="1.3" strokeDasharray="3 3" />
                        <text x={Math.min(v.x + 18, 840)} y="36" fontSize="9.5" fill={RED}>
                          {v.driftDays} dagar försenat
                        </text>
                      </g>
                    )
                  }
                  return (
                    <g key={`v-${i}`} className="cursor-pointer" onClick={() => openVisitCase(v)}>
                      <circle cx={v.x} cy="46" r="4.5" stroke="#20c58f" strokeWidth="1.6" strokeDasharray="2.5 2.5" fill="none" />
                      <text x={Math.min(v.x - 18, 930)} y="32" fontSize="9.5" fill="#20c58f">
                        bokat {formatDateSv(v.session?.scheduled_at ?? null)}
                      </text>
                    </g>
                  )
                })}

                {/* månadsaxel */}
                {rond.months.map((m, i) => (
                  <text key={i} x={m.x} y="164" textAnchor="middle" fontSize="8.5" letterSpacing="1" fill="#5d6f88" opacity={m.future ? 0.7 : 1}>
                    {m.label}
                  </text>
                ))}
              </svg>

              {rondHover && (
                <>
                  <div className="pointer-events-none absolute bottom-[26px] top-2 z-[3] w-px bg-[#20c58f]/45" style={{ left: rondHover.px }}>
                    <span className="absolute -top-0.5 left-1.5 whitespace-nowrap rounded border border-[#20c58f]/30 bg-[#0b1421] px-1.5 text-[10px] text-[#20c58f]">
                      {rondHover.label}
                    </span>
                  </div>
                  {rondHover.visit && (
                    <div
                      className="pointer-events-none absolute top-8 z-[5] w-[250px] rounded-xl border border-[#33507a] bg-[#16233a] p-3 text-xs text-slate-400 shadow-2xl"
                      style={{ left: Math.min(Math.max(4, (rondHover.visit.x / 1000) * (rondRef.current?.clientWidth ?? 1000) + 14), (rondRef.current?.clientWidth ?? 1000) - 260) }}
                    >
                      {rondHover.visit.kind === 'done' && rondHover.visit.session && (
                        <>
                          <div className="mb-0.5 text-[12.5px] font-semibold text-slate-100">
                            Kontrollbesök · {formatDateSv(rondHover.visit.session.completed_at)}
                          </div>
                          {rondHover.visit.session.technician_name && <>{rondHover.visit.session.technician_name} · </>}
                          {rondHover.visit.coverage && (
                            <b className="tabular-nums text-slate-100">
                              {rondHover.visit.coverage.inspected} av {rondHover.visit.coverage.total}
                            </b>
                          )}
                          {rondHover.visit.coverage && ' stationer'}
                          {rondHover.visit.driftDays != null && rondHover.visit.driftDays > 0 && (
                            <div className={rondHover.visit.driftDays > 14 ? 'text-[#e0a83a]' : ''}>
                              {rondHover.visit.driftDays} dagar efter avtalad tid
                            </div>
                          )}
                        </>
                      )}
                      {rondHover.visit.kind === 'late' && (
                        <>
                          <div className="mb-0.5 text-[12.5px] font-semibold text-slate-100">Avtalat besök</div>
                          <span className="font-semibold text-[#e46a5f]">Försenat {rondHover.visit.driftDays} dagar — inte utfört</span>
                        </>
                      )}
                      {rondHover.visit.kind === 'booked' && rondHover.visit.session && (
                        <>
                          <div className="mb-0.5 text-[12.5px] font-semibold text-slate-100">
                            Nästa besök · {formatDateSv(rondHover.visit.session.scheduled_at)}
                          </div>
                          Bokat{rondHover.visit.session.technician_name && <> · {rondHover.visit.session.technician_name}</>}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pärlband — senaste besökets stationstäckning */}
            {pearlBand && (
              <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 px-4 py-3">
                {pearlBand.total <= 28 && (
                  <svg width={pearlBand.total * 14 + 8} height="26" aria-label={`${pearlBand.inspected} av ${pearlBand.total} stationer inspekterade`}>
                    <line x1="4" y1="13" x2={pearlBand.total * 14} y2="13" stroke="#223247" strokeWidth="1" />
                    {Array.from({ length: pearlBand.total }).map((_, i) => {
                      const cx = 8 + i * 14
                      const ok = i < pearlBand.inspected
                      return (
                        <g key={i}>
                          <circle cx={cx} cy="13" r="3" stroke={ok ? GREEN : AMBER} strokeWidth="1.3" fill="none" />
                          {ok && <circle cx={cx} cy="13" r="1.1" fill={GREEN} />}
                        </g>
                      )
                    })}
                  </svg>
                )}
                <span className="max-w-[56ch] text-[12.5px] text-slate-400">
                  Senaste besöket ({formatDateSv(latestDoneSession?.completed_at ?? null)}) täckte{' '}
                  <b className="tabular-nums text-slate-100">
                    {pearlBand.inspected} <span className="text-[11px] text-slate-500">av</span> {pearlBand.total}
                  </b>{' '}
                  stationer
                  {pearlBand.missed > 0 && stations && stations.missedNames.length > 0 && (
                    <>
                      {' '}
                      — <span className="font-semibold text-[#e0a83a]">{stations.missedNames.slice(0, 3).join(', ')}</span>
                      {stations.missedNames.length > 3 && ` och ${stations.missedNames.length - 3} till`} missades
                    </>
                  )}
                  . Täckningen per besök syns som ringen kring varje plomb i tidslinjen ovanför.
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= Extraärenden ================= */}
      {extra.all.length > 0 && (
        <section>
          <SectionHead
            title="Extraärenden — merförsäljning"
            aux="arbete utanför avtalet"
            info="Varje rad är ett skadedjur, varje prick ett ärende på sitt datum — fylld prick är utförd, ihålig är såld men inte utförd. Färgen är ärendets kategori (lila bekämpning, blå inspektion). Raderna delar tidsaxel med ronden ovanför, så säsongsmönstret kan läsas rakt mot kontrollbesöken."
          />
          <p className="max-w-[74ch] text-sm text-slate-400">
            <b className="tabular-nums text-slate-100">{extra.inWindow.length} extraärenden</b> de senaste 12 månaderna
            {extra.doneRevenue > 0 && (
              <>
                , <b className="tabular-nums text-slate-100">{formatKr(extra.doneRevenue)}</b> utfört
              </>
            )}
            {extra.topPest && extra.topPest[1].length > 1 && (
              <>
                {' '}
                — tyngdpunkten är <b className="text-slate-100">{extra.topPest[0].toLowerCase()}</b> ({extra.topPest[1].length} st)
              </>
            )}
            .
            {extra.queue.length > 0 && (
              <>
                {' '}
                <b className="tabular-nums text-slate-100">{extra.queue.length} {extra.queue.length === 1 ? 'ärende' : 'ärenden'}</b> är{' '}
                <span className="font-semibold text-[#e0a83a]">{extra.queue.length === 1 ? 'sålt men ännu inte utfört' : 'sålda men ännu inte utförda'}</span>
                {extra.queueSum > 0 && (
                  <>
                    {' '}
                    (<b className="tabular-nums text-slate-100">{formatKr(extra.queueSum)}</b>)
                  </>
                )}{' '}
                — kön nedanför är sorterad äldst först.
              </>
            )}
          </p>

          <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-700" style={PANEL_STYLE}>
            {rond && extra.pestRows.length > 0 && (
              <div className="pt-1">
                {extra.pestRows.map(([pest, rows]) => {
                  const sum = rows.filter((r) => r.done).reduce((s, r) => s + Number(r.case.price ?? 0), 0)
                  const dots = rows
                    .map((r) => ({ r, t: new Date(r.date ?? 0).getTime() }))
                    .filter((d) => d.t >= rond.domainStart)
                    .sort((a, b) => a.t - b.t)
                  let lastX = -99
                  let lane = 0
                  return (
                    <div key={pest} className="grid grid-cols-[120px_1fr_84px] items-center gap-3 px-4 py-[3px] max-md:grid-cols-[90px_1fr_70px]">
                      <span className="truncate text-xs text-slate-400">{pest}</span>
                      <svg viewBox="0 0 860 22" preserveAspectRatio="none" className="block h-[22px] w-full overflow-visible">
                        <line x1="0" y1="11" x2="860" y2="11" stroke="#1a2940" strokeWidth="1" />
                        {dots.map(({ r, t }, i) => {
                          const cx = ((rond.x(t) - 20) / 960) * 860
                          if (cx - lastX < 14) lane = (lane + 1) % 3
                          else lane = 0
                          lastX = cx
                          const cy = lane === 0 ? 11 : lane === 1 ? 5 : 17
                          const color = extraDotColor(r.case)
                          return (
                            <g key={i} className="cursor-pointer" onClick={() => onOpenCase(r.case)}>
                              {r.done ? (
                                <circle cx={cx} cy={cy} r="3" fill={color}>
                                  <title>{`${formatDateSv(r.date)} · ${r.case.title}${Number(r.case.price ?? 0) > 0 ? ` · ${formatKr(Number(r.case.price))}` : ''}`}</title>
                                </circle>
                              ) : (
                                <circle cx={cx} cy={cy} r="3" fill="none" stroke={color} strokeWidth="1.4">
                                  <title>{`${formatDateSv(r.date)} · ${r.case.title} — såld, ej utförd`}</title>
                                </circle>
                              )}
                            </g>
                          )
                        })}
                      </svg>
                      <span className="text-right text-[11.5px] tabular-nums text-slate-500">{sum > 0 ? formatKr(sum) : ''}</span>
                    </div>
                  )
                })}
                <div className="grid grid-cols-[120px_1fr_84px] gap-3 px-4 pb-2.5 pt-0.5 max-md:grid-cols-[90px_1fr_70px]">
                  <span />
                  <div className="relative h-[14px]">
                    {rond.months
                      .filter((m) => !m.future)
                      .map((m, i) => (
                        <span
                          key={i}
                          className="absolute top-0 -translate-x-1/2 text-[8.5px] tracking-[.08em] text-slate-600"
                          style={{ left: `${(((m.x - 20) / 960) * 100).toFixed(1)}%` }}
                        >
                          {m.label}
                        </span>
                      ))}
                  </div>
                  <span />
                </div>
              </div>
            )}

            {extra.queue.length > 0 && (
              <div className={rond && extra.pestRows.length > 0 ? 'border-t border-slate-800' : ''}>
                <div className="px-4 pb-0.5 pt-2.5 text-[10.5px] font-bold uppercase tracking-[.12em] text-slate-500">
                  Sålt men inte utfört — äldst först
                </div>
                {extra.queue.map((r) => (
                  <button
                    key={r.case.id}
                    onClick={() => onOpenCase(r.case)}
                    className="group grid w-full grid-cols-[92px_1fr_92px_90px_60px] items-center gap-3 px-4 py-2 text-left text-[12.5px] transition-colors hover:bg-[#b48be8]/[.05] max-md:grid-cols-[92px_1fr]"
                  >
                    <span className="text-xs tabular-nums text-slate-500">skapad {formatDateSv(r.case.created_at)}</span>
                    <span className="min-w-0 truncate text-slate-200">
                      {r.case.title}
                      {r.case.case_number && <span className="ml-1.5 text-[11px] text-slate-500">{r.case.case_number}</span>}
                    </span>
                    <span className="text-xs tabular-nums text-[#e0a83a] max-md:hidden">väntar {daysSince(r.case.created_at)} d</span>
                    <span className="text-right text-xs tabular-nums text-slate-400 max-md:hidden">
                      {Number(r.case.price ?? 0) > 0 ? formatKr(Number(r.case.price)) : ''}
                    </span>
                    <span className="text-right text-[11px] text-[#20c58f] opacity-0 transition-opacity group-hover:opacity-100 max-md:hidden">
                      Öppna →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= Tempo ================= */}
      {extra.tempoRows.length >= 3 && (
        <section>
          <SectionHead
            title="Tempo — från bokning till utfört"
            aux="extraärenden senaste 12 mån · kontrollbesök styrs av schemat och ingår inte"
            info="Alla ärenden är lagda på samma dagskala med bokningsdagen som nollpunkt, så de går att jämföra direkt. Den streckade delen är väntan på inbokat besök, den färgade är tiden fram till utförandet. Uteliggare markeras i bärnsten. Importerad historik utan riktigt bokningsdatum ingår inte."
          />
          <p className="max-w-[74ch] text-sm text-slate-400">
            Vi utför extraärenden i median{' '}
            <b className="tabular-nums text-slate-100">{Math.round(extra.medianDone ?? 0)} dagar</b> efter att bokningen skapats
            {extra.medianBooked != null && (
              <>
                {' '}
                — <b className="tabular-nums text-slate-100">{Math.round(extra.medianBooked)} dagar</b> till inbokat besök och resten till utförande
              </>
            )}
            .
            {extra.prevMedian != null && extra.medianDone != null && (
              <>
                {' '}
                Föregående period var medianen <b className="tabular-nums text-slate-100">{Math.round(extra.prevMedian)} dagar</b>, så tempot har{' '}
                <b className="text-slate-100">{extra.medianDone <= extra.prevMedian ? 'förbättrats' : 'försämrats'}</b>.
              </>
            )}
            {extra.slowest && (
              <>
                {' '}
                Långsammast i år:{' '}
                <b className="text-slate-100">
                  {extra.slowest.row.case.title}, {Math.round(extra.slowest.toDone)} dagar
                </b>
                .
              </>
            )}
          </p>

          {(() => {
            const maxD = Math.max(14, Math.ceil(Math.max(...extra.tempoRows.map((t) => t.toDone)) * 1.12))
            const xd = (d: number) => (d / maxD) * 860
            const medB = extra.medianBooked
            const medD = extra.medianDone
            const visible = showAllTempo ? extra.tempoRows : extra.tempoRows.slice(0, 6)
            const step = Math.max(1, Math.round(maxD / 6))
            return (
              <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-700" style={PANEL_STYLE}>
                <div className="flex gap-5 px-4 pb-0.5 pt-2 text-[10.5px] text-slate-500">
                  <span>
                    <i className="mr-1.5 inline-block w-[18px] border-t-2 border-dashed border-slate-500 align-middle" />
                    skapad → inbokat besök
                  </span>
                  <span>
                    <i className="mr-1.5 inline-block w-[18px] border-t-2 align-middle" style={{ borderColor: CAT.extra.color }} />
                    inbokat → utfört
                  </span>
                  {medB != null && medD != null && (
                    <span className="ml-auto tabular-nums">
                      lodräta linjer = median {Math.round(medB)} d respektive {Math.round(medD)} d
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[158px_1fr] px-4 pt-1 max-md:grid-cols-[110px_1fr]">
                  <span />
                  <div className="relative h-[15px]">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute top-0 -translate-x-1/2 text-[9px] tabular-nums text-slate-600"
                        style={{ left: `${((i * step) / maxD) * 100}%` }}
                      >
                        {i * step} d
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pb-1.5">
                  {visible.map(({ row, toBooked, toDone }) => {
                    const outlier = medD != null && toDone > 2 * medD
                    const color = outlier ? AMBER : extraDotColor(row.case)
                    const knee = toBooked ?? 0
                    return (
                      <button
                        key={row.case.id}
                        onClick={() => onOpenCase(row.case)}
                        className="grid w-full grid-cols-[158px_1fr] items-center gap-0 px-4 py-0.5 text-left transition-opacity hover:opacity-100 max-md:grid-cols-[110px_1fr]"
                      >
                        <span className="truncate pr-3 text-[11.5px] text-slate-500">
                          {formatDateSv(row.case.created_at)} · <span className="text-slate-400">{row.case.pest_type ?? row.case.title}</span>
                        </span>
                        <svg viewBox="0 0 860 18" preserveAspectRatio="none" className="block h-[18px] w-full overflow-visible">
                          {medB != null && <line x1={xd(medB)} y1="2" x2={xd(medB)} y2="16" stroke="#3a4c63" strokeWidth="1" strokeDasharray="3 3" />}
                          {medD != null && <line x1={xd(medD)} y1="2" x2={xd(medD)} y2="16" stroke={CAT.extra.color} strokeOpacity=".5" strokeWidth="1" />}
                          <circle cx="1.5" cy="9" r="2.5" stroke="#64748b" strokeWidth="1.2" fill="none" />
                          {knee > 0 && (
                            <>
                              <line x1="4" y1="9" x2={xd(knee)} y2="9" stroke="#64748b" strokeWidth="1.4" strokeDasharray="3 3" />
                              <line x1={xd(knee)} y1="4" x2={xd(knee)} y2="14" stroke="#64748b" strokeWidth="1.4" />
                            </>
                          )}
                          <line x1={xd(knee)} y1="9" x2={xd(toDone)} y2="9" stroke={color} strokeWidth="1.8" />
                          <circle cx={xd(toDone)} cy="9" r="3.2" fill={color} />
                          <text x={Math.min(xd(toDone) + 9, 800)} y="12.5" fontSize="9.5" fill={outlier ? AMBER : '#5d6f88'}>
                            {Math.round(toDone)} d{outlier ? ' — uteliggare' : ''}
                          </text>
                        </svg>
                      </button>
                    )
                  })}
                </div>
                {extra.tempoRows.length > 6 && (
                  <button
                    onClick={() => setShowAllTempo((v) => !v)}
                    className="mx-4 mb-3 mt-1 block text-xs text-[#20c58f] hover:underline"
                  >
                    {showAllTempo ? 'Visa färre' : `Visa alla ${extra.tempoRows.length} ärenden`}
                  </button>
                )}
              </div>
            )
          })()}
        </section>
      )}

      {/* ================= Ärendeflöde ================= */}
      <section>
        <SectionHead title="Ärendeflöde" aux="klicka för att öppna i ärendemodalen" />

        {flow.length > 8 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök ärendenummer, tekniker, skadedjur…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
            />
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-700" style={PANEL_STYLE}>
          <div className="grid grid-cols-[74px_30px_1fr_108px_86px_74px_92px_22px] gap-3 border-b border-slate-700 px-4 py-2 text-[10.5px] uppercase tracking-[.1em] text-slate-500 max-md:hidden">
            <span>Datum</span>
            <span />
            <span>Ärende</span>
            <span>Tekniker</span>
            <span>Stationer</span>
            <span>Pris</span>
            <span>Status</span>
            <span />
          </div>
          {flow.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {query || activeCat ? 'Inga ärenden matchar filtret.' : 'Inga ärenden registrerade för kunden.'}
            </p>
          ) : (
            flow.map((r) => {
              const st = r.session
              const stTotal = st ? (st.total_outdoor_stations ?? 0) + (st.total_indoor_stations ?? 0) : 0
              const stInsp = st ? (st.inspected_outdoor_stations ?? 0) + (st.inspected_indoor_stations ?? 0) : 0
              return (
                <button
                  key={r.case.id}
                  onClick={() => onOpenCase(r.case)}
                  className="group grid w-full grid-cols-[74px_30px_1fr_108px_86px_74px_92px_22px] items-center gap-3 border-t border-slate-800/70 px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-[#121f33] max-md:grid-cols-[74px_1fr]"
                  style={{ opacity: activeCat && r.cat !== activeCat ? 0.18 : 1 }}
                >
                  <span className="text-xs tabular-nums text-slate-500">{formatDateSv(r.date)}</span>
                  <span className="max-md:hidden">
                    <Glyph kind={r.cat} size={26} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-slate-200">
                      {r.case.title}
                      {r.case.case_number && r.case.case_number !== r.case.title && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-500">{r.case.case_number}</span>
                      )}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-500">
                      {r.case.pest_type}
                      {r.unitName && `${r.case.pest_type ? ' · ' : ''}${r.unitName}`}
                    </span>
                  </span>
                  <span className="truncate text-xs text-slate-400 max-md:hidden">{r.case.primary_technician_name ?? ''}</span>
                  <span className="text-[11.5px] tabular-nums text-slate-500 max-md:hidden">
                    {stTotal > 0 ? (
                      <>
                        {stInsp} <span className="text-[10px]">av</span> {stTotal} st
                      </>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </span>
                  <span className="text-right text-xs tabular-nums text-slate-200 max-md:hidden">
                    {r.case.price != null && Number(r.case.price) > 0 ? formatKr(Number(r.case.price)) : <span className="text-slate-600">—</span>}
                  </span>
                  <span className="max-md:hidden">
                    {r.done ? (
                      <span className="rounded-full bg-[#34c26b]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#34c26b]">Utfört</span>
                    ) : r.lateness !== 'ontime' ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LATENESS_STYLE[r.lateness].text} bg-amber-500/10`}>
                        {LATENESS_STYLE[r.lateness].label} · {daysSince(r.session?.scheduled_at ?? r.case.scheduled_start)} d
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#56a8e8]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#56a8e8]">{r.case.status}</span>
                    )}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-700 transition-colors group-hover:text-[#20c58f] max-md:hidden" />
                </button>
              )
            })
          )}
        </div>
      </section>

      {totalCases === 0 && extra.all.length === 0 && !rond && (
        <p className="py-8 text-center text-sm text-slate-500">Inga ärenden registrerade för kunden.</p>
      )}
    </div>
  )
}
