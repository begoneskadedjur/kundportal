// src/components/admin/customers/record/RoomAnalysisSection.tsx
//
// Rumsanalys på kundkortets Ärenden-flik — för kunder med Rum nr aktiverat
// (boendeverksamheter). Bygger HELT på våra egna besök: ärendena och
// rumsnumren teknikern angett, aldrig hotellets data.
//
// Design enligt godkänd skiss (aug 2026): dörrskyltar med graverad siffra,
// Återkommande-stämpel, delad tidsaxel med krysshår och intervallbågar,
// problemrums-kvadrant, expanderbar detalj med trendstaplar och trafikljusspår.
// Trafikljuset visas bara när teknikern fyllt i det — aldrig ett gissat värde.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { formatDateSv, formatKr, type RecordCase, type RecordCustomer } from '../../../../hooks/useCustomerRecord'
import { roomsFromString } from '../../../../services/caseRoomService'

// Kategorifärger — följer ärendetypen, aldrig rang
const CAT_COLOR: Record<string, string> = {
  service: '#2fc98f', inspektion: '#56a8e8', extra: '#b48be8', etabl: '#d9a04a',
}
const LIGHT = { ok: '#34c26b', varning: '#e0a83a', kritisk: '#e46a5f', saknas: '#45566e' }

/** Grov flödeskategori för glyf/färg — tjänsten/rubriken avgör, service_type i botten */
export function flowCategory(c: RecordCase): 'service' | 'inspektion' | 'extra' | 'etabl' {
  if (c.service_type === 'establishment') return 'etabl'
  const t = `${c.title} ${c.pest_type ?? ''}`.toLowerCase()
  if (/saner|värmebehandl|ånga|kisel/.test(t)) return 'extra'
  if (
    ['inspection', 'rondering_trafikkontoret', 'egenkontroll_trafikkontoret'].includes(c.service_type ?? '') ||
    /inspektion|kontroll/.test(t)
  ) return 'inspektion'
  return 'service'
}

function lightColor(level: number | null | undefined): string | null {
  if (level == null || level === 0) return null
  if (level >= 3) return LIGHT.kritisk
  if (level === 2) return LIGHT.varning
  return LIGHT.ok
}

interface Thresholds { minVisits: number; months: number; samePestDays: number }
const DEFAULT_THRESHOLDS: Thresholds = { minVisits: 3, months: 12, samePestDays: 45 }

interface Visit {
  case: RecordCase
  date: string // ISO
  cat: ReturnType<typeof flowCategory>
}
interface Room {
  name: string
  visits: Visit[]
  intervals: number[] // dagar mellan besök, kronologiskt
  avgInterval: number | null
  recurring: boolean
  recurringReason: string | null
  flaggedSince: string | null
  techs: string[]
  debited: number
  trendRatio: number | null // <1 = tätnar
  lastLight: number | null
}

const DAY = 86_400_000

function initials(name: string | null): string {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')
}

/** Dörrskylten — graverad plåt med skruvar */
function Plate({ name, stamped }: { name: string; stamped?: boolean }) {
  return (
    <span className="relative inline-block">
      {stamped && (
        <span
          className="absolute -right-3 -top-2.5 z-10 rotate-[-6deg] rounded px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[.13em]"
          style={{
            color: LIGHT.varning, border: `1.5px solid ${LIGHT.varning}`,
            background: 'rgba(224,168,58,.07)',
            WebkitMaskImage: 'repeating-linear-gradient(35deg, #000 0 2px, rgba(0,0,0,.72) 2px 3px)',
            maskImage: 'repeating-linear-gradient(35deg, #000 0 2px, rgba(0,0,0,.72) 2px 3px)',
          }}
        >
          Återkommande
        </span>
      )}
      <span
        className="relative inline-grid h-10 min-w-16 place-items-center rounded-lg px-2.5"
        style={{
          background: 'linear-gradient(165deg,#1b2a41,#131f31)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.4)',
        }}
      >
        <span className="absolute left-[5px] top-1 h-[3px] w-[3px] rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #4a5d78, #0d1522)' }} />
        <span className="absolute bottom-1 right-[5px] h-[3px] w-[3px] rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #4a5d78, #0d1522)' }} />
        <b
          className="tabular-nums font-bold tracking-[.04em]"
          style={{ fontSize: name.length > 4 ? 12 : 16, color: '#c8d4e4', textShadow: '0 -1px 0 rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.05)' }}
        >
          {name}
        </b>
      </span>
    </span>
  )
}

interface Props {
  root: RecordCustomer
  cases: RecordCase[]
  onOpenCase: (c: RecordCase) => void
  /** Kategorifilter från kategoristrippen — dimmar prickar av andra typer */
  dimCategory?: string | null
}

export default function RoomAnalysisSection({ root, cases, onOpenCase, dimCategory }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [popOpen, setPopOpen] = useState(false)
  const [xhair, setXhair] = useState<{ x: number; label: string } | null>(null)
  const [thresholds, setThresholds] = useState<Thresholds>(() => ({
    ...DEFAULT_THRESHOLDS,
    ...((root as { room_flag_thresholds?: Partial<Thresholds> | null }).room_flag_thresholds ?? {}),
  }))

  const periodStart = useMemo(() => Date.now() - 365 * DAY, [])
  const pos = (iso: string) => Math.max(0, Math.min(1, (new Date(iso).getTime() - periodStart) / (365 * DAY))) * 1000

  const rooms = useMemo<Room[]>(() => {
    const byRoom = new Map<string, Visit[]>()
    for (const c of cases) {
      const date = c.completed_date ?? c.scheduled_start ?? c.created_at
      if (!date || new Date(date).getTime() < periodStart) continue
      for (const r of roomsFromString(c.room_number)) {
        const list = byRoom.get(r) ?? []
        list.push({ case: c, date, cat: flowCategory(c) })
        byRoom.set(r, list)
      }
    }
    const out: Room[] = []
    for (const [name, visits] of byRoom) {
      visits.sort((a, b) => a.date.localeCompare(b.date))
      const intervals: number[] = []
      for (let i = 1; i < visits.length; i++) {
        intervals.push(Math.round((new Date(visits[i].date).getTime() - new Date(visits[i - 1].date).getTime()) / DAY))
      }
      // Återkommande: minst N besök i perioden, ELLER samma skadedjur inom X dagar
      let recurringReason: string | null = null
      let flaggedSince: string | null = null
      if (visits.length >= thresholds.minVisits) {
        recurringReason = `${thresholds.minVisits}+ besök på ${thresholds.months} mån`
        flaggedSince = visits[thresholds.minVisits - 1]?.date ?? null
      }
      for (let i = 1; i < visits.length && !recurringReason; i++) {
        const same = visits[i].case.pest_type && visits[i].case.pest_type === visits[i - 1].case.pest_type
        if (same && intervals[i - 1] <= thresholds.samePestDays) {
          recurringReason = `samma skadedjur inom ${thresholds.samePestDays} dagar`
          flaggedSince = visits[i].date
        }
      }
      const later = intervals.slice(-2)
      const earlier = intervals.slice(0, -2)
      const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
      const trendRatio =
        visits.length >= 3 && med(later) != null && med(earlier.length ? earlier : later) != null
          ? (med(later) as number) / Math.max(1, med(earlier.length ? earlier : later) as number)
          : null
      const lastWithLight = [...visits].reverse().find((v) => lightColor(v.case.pest_level) !== null)
      out.push({
        name, visits, intervals,
        avgInterval: intervals.length ? Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length) : null,
        recurring: !!recurringReason,
        recurringReason, flaggedSince,
        techs: Array.from(new Set(visits.map((v) => v.case.primary_technician_name).filter(Boolean))) as string[],
        debited: visits.reduce((s, v) => s + Number(v.case.price ?? 0), 0),
        trendRatio,
        lastLight: lastWithLight?.case.pest_level ?? null,
      })
    }
    // Flaggade först, värst (tätnande) överst
    return out.sort((a, b) => {
      if (a.recurring !== b.recurring) return a.recurring ? -1 : 1
      return (a.trendRatio ?? 9) - (b.trendRatio ?? 9) || b.visits.length - a.visits.length
    })
  }, [cases, periodStart, thresholds])

  const flagged = rooms.filter((r) => r.recurring)
  const okRooms = rooms.filter((r) => !r.recurring)
  const topRoom = flagged[0] ?? null
  const missingLights = cases.filter(
    (c) => c.origin === 'case' && (c.completed_date || c.scheduled_start) && lightColor(c.pest_level) === null
  )
  const missingByTech = new Map<string, number>()
  for (const c of missingLights) {
    if (c.primary_technician_name) missingByTech.set(c.primary_technician_name, (missingByTech.get(c.primary_technician_name) ?? 0) + 1)
  }
  const topMissing = [...missingByTech.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const avgAll = useMemo(() => {
    const all = rooms.flatMap((r) => r.intervals)
    return all.length ? Math.round(all.reduce((s, d) => s + d, 0) / all.length) : null
  }, [rooms])

  const saveThresholds = async (t: Thresholds) => {
    setThresholds(t)
    const { error } = await supabase.from('customers').update({ room_flag_thresholds: t }).eq('id', root.id)
    if (error) toast.error('Kunde inte spara tröskeln')
  }

  // "Boka grundorsaksutredning" — förifyllt ärende via sessionStorage → koordinatorschemat
  const bookInvestigation = (room: Room) => {
    const pest = room.visits.map((v) => v.case.pest_type).filter(Boolean).pop() ?? null
    const history = room.visits.map((v) => v.case.case_number).filter(Boolean).join(', ')
    const techCount = new Map<string, number>()
    for (const v of room.visits) if (v.case.primary_technician_name) techCount.set(v.case.primary_technician_name, (techCount.get(v.case.primary_technician_name) ?? 0) + 1)
    const suggestedTech = [...techCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    sessionStorage.setItem('begone-grundorsak-prefill', JSON.stringify({
      customer_id: root.id,
      case_type: 'contract',
      room_number: room.name,
      pest_type: pest,
      title: `Grundorsaksutredning rum ${room.name}`,
      description:
        `Grundorsaksutredning — rum ${room.name} är flaggat som återkommande (${room.recurringReason}).\n` +
        `Tidigare ärenden i rummet: ${history || '–'}.` +
        (suggestedTech ? `\nFöreslagen tekniker: ${suggestedTech}.` : ''),
    }))
    navigate('/koordinator/schema')
  }

  const dim = (cat: string) => (dimCategory && dimCategory !== cat ? 0.18 : 1)

  const monthLabels = useMemo(() => {
    const out: { left: string; label: string }[] = []
    const d = new Date(periodStart)
    d.setDate(1)
    for (let i = 0; i < 12; i += 2) {
      const m = new Date(d.getFullYear(), d.getMonth() + i, 1)
      out.push({
        left: `${Math.max(0, Math.min(100, ((m.getTime() - periodStart) / (365 * DAY)) * 100))}%`,
        label: m.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '').toUpperCase(),
      })
    }
    return out
  }, [periodStart])

  const arcColor = (days: number, prev: number | null) => {
    if (days <= thresholds.samePestDays) return prev != null && days < prev ? LIGHT.kritisk : LIGHT.varning
    return '#223247'
  }

  if (rooms.length === 0) return null

  return (
    <section>
      <div className="flex items-baseline gap-3 border-b-[1.5px] border-slate-700 pb-1.5 mb-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Rumsanalys</h2>
        <span className="ml-auto text-xs text-slate-500">bygger på våra egna besök — inte kundens data</span>
      </div>

      <div className="mb-4 grid items-start gap-6 lg:grid-cols-[1fr_460px]">
      <div>
      {/* Lede — integrerad summering, inga KPI-kort */}
      <p className="text-sm text-slate-400 max-w-[66ch]">
        <b className="text-slate-200 tabular-nums">{rooms.length} rum</b> har haft besök av oss det senaste året.{' '}
        {flagged.length > 0 ? (
          <>
            <span className="font-semibold text-amber-400">
              {flagged.length === 1 ? 'Ett rum kräver uppmärksamhet' : `${flagged.length} rum kräver uppmärksamhet`}:
            </span>{' '}
            i{' '}
            <button
              className="font-semibold text-slate-200 underline decoration-dotted decoration-slate-500 underline-offset-[3px] hover:decoration-[#20c58f]"
              onClick={() => setExpanded(topRoom!.name)}
            >
              rum {topRoom!.name}
            </button>{' '}
            har vi varit inne <b className="text-slate-200">{topRoom!.visits.length} gånger</b>
            {topRoom!.trendRatio != null && topRoom!.trendRatio < 1 && ' — och det går allt kortare tid mellan besöken'}
            {topRoom!.debited > 0 && (
              <>
                . Kunden har debiterats <b className="text-slate-200">{formatKr(topRoom!.debited)}</b> för rummet
              </>
            )}
            {avgAll != null && <>. Snittintervall för kunden: <b className="text-slate-200">{avgAll} dagar</b>.</>}
          </>
        ) : (
          <>Inget rum flaggas som återkommande med nuvarande tröskel.</>
        )}
      </p>

      {/* Tröskelrad */}
      <div className="relative my-3.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Flaggas som återkommande vid:</span>
        <button
          onClick={() => setPopOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-slate-400 hover:border-slate-500 hover:text-slate-200"
        >
          <b className="text-slate-200 tabular-nums">{thresholds.minVisits}+</b> besök /{' '}
          <b className="text-slate-200 tabular-nums">{thresholds.months} mån</b> <span className="text-[10px]">▾</span>
        </button>
        <span>eller</span>
        <button
          onClick={() => setPopOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-slate-400 hover:border-slate-500 hover:text-slate-200"
        >
          samma skadedjur inom <b className="text-slate-200 tabular-nums">{thresholds.samePestDays} dagar</b>{' '}
          <span className="text-[10px]">▾</span>
        </button>
        {popOpen && (
          <div className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-slate-600 bg-slate-800 p-3.5 shadow-2xl">
            {(
              [
                ['Minst antal besök', 'minVisits', 1, 10],
                ['…inom period (mån)', 'months', 3, 24],
                ['Samma skadedjur inom (dagar)', 'samePestDays', 7, 180],
              ] as const
            ).map(([label, key, min, max]) => (
              <div key={key} className="flex items-center justify-between py-1 text-xs text-slate-400">
                <span>{label}</span>
                <span className="inline-flex items-center gap-2">
                  <button
                    className="h-[22px] w-[22px] rounded-md border border-slate-600 leading-none text-slate-200"
                    onClick={() => saveThresholds({ ...thresholds, [key]: Math.max(min, thresholds[key] - (key === 'samePestDays' ? 5 : 1)) })}
                  >
                    −
                  </button>
                  <b className="min-w-6 text-center tabular-nums text-slate-200">{thresholds[key]}</b>
                  <button
                    className="h-[22px] w-[22px] rounded-md border border-slate-600 leading-none text-slate-200"
                    onClick={() => saveThresholds({ ...thresholds, [key]: Math.min(max, thresholds[key] + (key === 'samePestDays' ? 5 : 1)) })}
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
            <div className="mt-2 border-t border-slate-700 pt-2 text-xs text-slate-400">
              Med denna tröskel flaggas <b className="text-amber-400 tabular-nums">{flagged.length} rum</b>
              {flagged.length > 0 && <> — {flagged.map((r) => r.name).join(', ')}</>}
            </div>
            <div className="mt-1 text-[10.5px] text-slate-500">Sparas per kund. Listan uppdateras direkt.</div>
          </div>
        )}
      </div>

      {missingLights.length > 0 && (
        <p className="mb-3 text-xs text-slate-400">
          Trafikljus saknas på <b className="text-slate-200 tabular-nums">{missingLights.length} besök</b>
          {topMissing && topMissing[1] > 1 && (
            <> — <span className="text-amber-400">{topMissing[1]} av dem {topMissing[0]}</span></>
          )}
          .
        </p>
      )}
      </div>

      {/* Problemrums-kvadranten: frekvens × riktning — var ska vi agera först? */}
      <div
        className="rounded-2xl border border-slate-700 px-3 pb-1.5 pt-2.5"
        style={{ background: 'linear-gradient(180deg,#14212f,#101b2c 48px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 16px 40px -24px rgba(0,0,0,.7)' }}
      >
        <h3 className="px-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[.12em] text-slate-500">Var ska vi agera först?</h3>
        {(() => {
          const withTrend = rooms.filter((r) => r.trendRatio != null)
          const noTrend = rooms.filter((r) => r.trendRatio == null)
          const maxX = Math.max(6, ...rooms.map((r) => r.visits.length)) + 1
          const qx = (n: number) => 46 + (n / maxX) * (448 - 46)
          const qy = (ratio: number) => Math.max(18, Math.min(208, 114 + Math.max(-1.5, Math.min(1.5, Math.log2(ratio))) * 68))
          return (
            <svg viewBox="0 0 460 268" width="100%" role="img" aria-label="Problemrums-kvadrant">
              <line x1="46" y1="12" x2="46" y2="216" stroke="#223247" strokeWidth="1" />
              <line x1="46" y1="216" x2="448" y2="216" stroke="#223247" strokeWidth="1" />
              <line x1={qx(thresholds.minVisits)} y1="12" x2={qx(thresholds.minVisits)} y2="216" stroke="#223247" strokeWidth="1" strokeDasharray="3 4" />
              <line x1="46" y1="114" x2="448" y2="114" stroke="#223247" strokeWidth="1" strokeDasharray="3 4" />
              <text x="52" y="24" fontSize="9" letterSpacing="1.5" fill="#5d6f88">TIDIG ESKALATION</text>
              <text x="392" y="24" fontSize="9" letterSpacing="1.5" fill={LIGHT.kritisk} textAnchor="end" fontWeight="700">AKUT</text>
              <text x="52" y="208" fontSize="9" letterSpacing="1.5" fill="#5d6f88">UNDER KONTROLL</text>
              <text x="392" y="208" fontSize="9" letterSpacing="1.5" fill="#5d6f88" textAnchor="end">BEVAKA</text>
              <text x="247" y="240" fontSize="9" fill="#5d6f88" textAnchor="middle">antal besök av oss under perioden →</text>
              <text x="16" y="114" fontSize="9" fill="#5d6f88" transform="rotate(-90 16 114)" textAnchor="middle">tiden mellan besöken krymper ↑</text>
              <text x={qx(thresholds.minVisits)} y="228" fontSize="8.5" fill="#5d6f88" textAnchor="middle">{thresholds.minVisits}</text>
              {withTrend.map((r) => {
                const cat = r.visits[r.visits.length - 1]?.cat ?? 'extra'
                return (
                  <g key={r.name} style={{ cursor: 'pointer', opacity: dim(cat) }} onClick={() => setExpanded(r.name)}>
                    <circle cx={qx(r.visits.length)} cy={qy(r.trendRatio!)} r="7" fill={CAT_COLOR[cat]} stroke="#101b2c" strokeWidth="2" />
                    <text x={qx(r.visits.length) + 12} y={qy(r.trendRatio!) + 4} fontSize="11" fontWeight="700" fill="#e8eef6">{r.name}</text>
                  </g>
                )
              })}
              {noTrend.length > 0 && (
                <>
                  <line x1="46" y1="248" x2="448" y2="248" stroke="#1a2940" strokeWidth="1" />
                  <text x="52" y="262" fontSize="9" fill="#5d6f88">FÖR FÅ BESÖK FÖR TREND:</text>
                  {noTrend.slice(0, 4).map((r, i) => {
                    const cat = r.visits[r.visits.length - 1]?.cat ?? 'service'
                    return (
                      <g key={r.name} style={{ cursor: 'pointer', opacity: dim(cat) }} onClick={() => setExpanded(r.name)}>
                        <circle cx={200 + i * 62} cy="258" r="5" fill={CAT_COLOR[cat]} stroke="#101b2c" strokeWidth="2" />
                        <text x={209 + i * 62} y="262" fontSize="10" fill="#8fa0b5">{r.name}</text>
                      </g>
                    )
                  })}
                </>
              )}
            </svg>
          )
        })()}
      </div>
      </div>

      {/* Rumsmatrisen */}
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-700"
        style={{ background: 'linear-gradient(180deg,#14212f,#101b2c 48px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 16px 40px -24px rgba(0,0,0,.7)' }}
        onPointerMove={(e) => {
          const tl = (e.currentTarget as HTMLElement).querySelector('[data-tl]')
          if (!tl) return
          const r = tl.getBoundingClientRect()
          if (e.clientX < r.left || e.clientX > r.right) { setXhair(null); return }
          const frac = (e.clientX - r.left) / r.width
          const d = new Date(periodStart + frac * 365 * DAY)
          const box = e.currentTarget.getBoundingClientRect()
          setXhair({ x: e.clientX - box.left, label: d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '') })
        }}
        onPointerLeave={() => setXhair(null)}
      >
        {xhair && (
          <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px" style={{ left: xhair.x, background: 'rgba(32,197,143,.45)' }}>
            <span className="absolute left-1.5 top-1 whitespace-nowrap rounded border border-[#20c58f]/30 bg-[#0b1421] px-1.5 text-[10px] text-[#20c58f]">
              {xhair.label}
            </span>
          </div>
        )}
        <div className="grid grid-cols-[100px_1fr_140px_104px_92px_26px] items-end gap-3.5 px-4 pb-1 pt-2 text-[10.5px] uppercase tracking-[.1em] text-slate-500 max-md:hidden">
          <span>Rum</span>
          <div className="relative h-4">
            {monthLabels.map((m) => (
              <span key={m.label + m.left} className="absolute top-0 -translate-x-1/2 text-[8.5px] tracking-[.08em]" style={{ left: m.left }}>
                {m.label}
              </span>
            ))}
          </div>
          <span>Frekvens</span><span>Tekniker</span><span>Bedömning</span><span />
        </div>

        {(showAll ? rooms : flagged.length > 0 ? flagged : rooms).map((room) => (
          <div key={room.name}>
            <button
              className={`grid w-full grid-cols-[100px_1fr_140px_104px_92px_26px] items-center gap-3.5 border-t border-slate-800/70 px-4 py-3 text-left transition-colors hover:bg-[#121f33] max-md:grid-cols-[92px_1fr] ${expanded === room.name ? 'bg-[#0f1d2c]' : ''}`}
              onClick={() => setExpanded(expanded === room.name ? null : room.name)}
            >
              <Plate name={room.name} stamped={room.recurring} />
              <div data-tl className="relative">
                <svg className="block h-[34px] w-full overflow-visible" viewBox="0 0 1000 34" preserveAspectRatio="none">
                  <line x1="0" y1="22" x2="1000" y2="22" stroke="#223247" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  {room.visits.slice(1).map((v, i) => {
                    const x1 = pos(room.visits[i].date)
                    const x2 = pos(v.date)
                    const h = Math.max(4, Math.min(19, room.intervals[i] / 6))
                    return (
                      <path
                        key={i}
                        d={`M${x1} 22 Q${(x1 + x2) / 2} ${22 - h} ${x2} 22`}
                        fill="none"
                        stroke={arcColor(room.intervals[i], i > 0 ? room.intervals[i - 1] : null)}
                        strokeWidth="1.3"
                        vectorEffect="non-scaling-stroke"
                        opacity=".85"
                      />
                    )
                  })}
                  {room.visits.map((v, i) => (
                    <circle
                      key={i}
                      cx={pos(v.date)}
                      cy="22"
                      r="5.5"
                      fill={CAT_COLOR[v.cat]}
                      stroke="#14212f"
                      strokeWidth="2"
                      style={{ opacity: dim(v.cat), transition: 'opacity .2s' }}
                    >
                      <title>{`${formatDateSv(v.date)} · ${v.case.title}${v.case.primary_technician_name ? ' · ' + v.case.primary_technician_name : ''}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>
              <div className="text-[11px] text-slate-500 max-md:hidden">
                <b className="text-[15px] font-bold tabular-nums text-slate-200">{room.visits.length}</b>{' '}
                <span className="text-slate-400">besök{room.avgInterval != null && <> · var <b className="text-[13px] text-slate-200">{room.avgInterval}</b>:e dag</>}</span>
              </div>
              <div className="flex gap-1 max-md:hidden">
                {room.techs.slice(0, 3).map((t) => (
                  <span key={t} className="grid h-6 w-6 place-items-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-bold text-slate-400" title={t}>
                    {initials(t)}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 max-md:hidden">
                {room.visits.slice(-3).map((v, i) => {
                  const c = lightColor(v.case.pest_level)
                  return c ? (
                    <span key={i} className="h-[9px] w-[9px] rounded-[2.5px]" style={{ background: c }} />
                  ) : (
                    <span key={i} className="h-[9px] w-[9px] rounded-[2.5px] border border-dashed" style={{ borderColor: LIGHT.saknas }} />
                  )
                })}
                <span className="ml-1 text-[10.5px] text-slate-500">senaste {Math.min(3, room.visits.length)}</span>
              </div>
              <span className="text-right text-[13px] text-slate-500 max-md:hidden">{expanded === room.name ? '▾' : '›'}</span>
            </button>

            {expanded === room.name && (
              <div className="relative px-5 py-4" style={{ background: '#0a1220', boxShadow: 'inset 0 3px 10px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.03)' }}>
                <div className="flex flex-wrap items-center gap-3.5">
                  <Plate name={room.name} stamped={room.recurring} />
                  <div>
                    <div className="text-xs text-slate-500">
                      {(['extra', 'inspektion', 'service'] as const)
                        .map((cat) => [cat, room.visits.filter((v) => v.cat === cat).length] as const)
                        .filter(([, n]) => n > 0)
                        .map(([cat, n]) => `${n} ${cat === 'extra' ? 'sanering' : cat === 'inspektion' ? 'inspektion' : 'servicebesök'}${n > 1 && cat !== 'service' ? 'er' : ''}`)
                        .join(' · ')}
                      {room.techs.length > 1 && ` · ${room.techs.length} olika tekniker`}
                      {room.debited > 0 && <> · <b className="text-slate-200">{formatKr(room.debited)} debiterat</b></>}
                    </div>
                    {room.flaggedSince && (
                      <div className="text-[11.5px] text-amber-400">
                        Flaggad i {Math.round((Date.now() - new Date(room.flaggedSince).getTime()) / DAY)} dagar
                        {room.recurringReason && ` · ${room.recurringReason}`}
                      </div>
                    )}
                  </div>
                </div>

                {room.intervals.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-stretch gap-6">
                    <div className="w-full text-[10px] uppercase tracking-[.1em] text-slate-500 -mb-4">Dagar mellan våra besök i rummet</div>
                    <div className="flex items-end gap-3.5">
                      {room.intervals.map((d, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 text-[10.5px] text-slate-500">
                          <i
                            className="block w-[34px] rounded-t-[3px]"
                            style={{
                              height: Math.max(10, Math.min(60, d * 1.6)),
                              background: i > 0 && d < room.intervals[i - 1] ? 'rgba(228,106,95,.14)' : 'rgba(224,168,58,.16)',
                              borderTop: `2px solid ${i > 0 && d < room.intervals[i - 1] ? LIGHT.kritisk : LIGHT.varning}`,
                            }}
                          />
                          <b className="text-[13px] tabular-nums text-slate-200">{d}</b>
                        </div>
                      ))}
                    </div>
                    <div className="min-w-60 max-w-[50ch] flex-1 self-center text-xs text-slate-400">
                      {room.trendRatio != null && room.trendRatio < 0.85 ? (
                        <>Det går <b className="text-amber-400">allt kortare tid mellan besöken</b>: {room.intervals.join(' → ')} dagar.{' '}
                        {room.techs.length > 1 && `${room.techs.length} olika tekniker har behandlat utan att problemet försvunnit — `}
                        nästa steg bör vara en <b className="text-amber-400">grundorsaksutredning</b>, inte ännu ett besök.</>
                      ) : (
                        <>Tid mellan besöken: {room.intervals.join(' → ')} dagar.</>
                      )}
                    </div>
                  </div>
                )}

                {/* Trafikljusspår, tidsalignat */}
                <div className="relative mb-1 mt-4 h-[22px]">
                  <span className="absolute -top-1 left-0 bg-[#0a1220] pr-2 text-[10px] uppercase tracking-[.1em] text-slate-500">Teknikerns trafikljus per besök</span>
                  <div className="absolute left-0 right-0 top-[10px] h-px bg-slate-800" />
                  {room.visits.map((v, i) => {
                    const c = lightColor(v.case.pest_level)
                    return (
                      <span
                        key={i}
                        className="absolute top-[5px] h-2.5 w-2.5 rounded-[3px]"
                        style={c ? { left: `${pos(v.date) / 10}%`, background: c } : { left: `${pos(v.date) / 10}%`, border: `1px dashed ${LIGHT.saknas}` }}
                        title={`${formatDateSv(v.date)}: ${c ? '' : 'ej ifyllt'}`}
                      />
                    )
                  })}
                  {room.visits.some((v) => !lightColor(v.case.pest_level)) && (
                    <span className="absolute -top-0.5 right-0 text-[11px] text-slate-500">
                      {room.visits.filter((v) => !lightColor(v.case.pest_level)).length} besök utan ifyllt trafikljus
                    </span>
                  )}
                </div>

                <div className="mt-3 border-t border-slate-800/70">
                  {[...room.visits].reverse().map((v) => (
                    <button
                      key={v.case.id}
                      onClick={() => onOpenCase(v.case)}
                      className="group grid w-full grid-cols-[84px_1fr_110px_100px_16px_60px] items-center gap-3 rounded-md border-b border-dashed border-slate-800/70 px-1 py-2 text-left text-[12.5px] hover:bg-[#20c58f]/5 max-md:grid-cols-[84px_1fr]"
                    >
                      <span className="tabular-nums text-slate-500">{formatDateSv(v.date)}</span>
                      <span className="text-slate-200">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px]" style={{ background: CAT_COLOR[v.cat] }} />
                        {v.case.title}
                        {v.case.case_number && <span className="ml-1.5 text-[11px] text-slate-500">{v.case.case_number}</span>}
                      </span>
                      <span className="text-slate-400 max-md:hidden">{v.case.pest_type ?? ''}</span>
                      <span className="text-slate-400 max-md:hidden">{v.case.primary_technician_name ?? ''}</span>
                      <span className="max-md:hidden">
                        {lightColor(v.case.pest_level) ? (
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: lightColor(v.case.pest_level)! }} />
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: LIGHT.saknas }} />
                        )}
                      </span>
                      <span className="text-right text-[11px] text-[#20c58f] opacity-0 group-hover:opacity-100 max-md:hidden">Öppna →</span>
                    </button>
                  ))}
                </div>

                {room.recurring && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => bookInvestigation(room)}
                      className="rounded-lg bg-[#20c58f] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#06251b] hover:brightness-110"
                    >
                      Boka grundorsaksutredning
                    </button>
                    <span className="basis-full text-[10.5px] text-slate-500">
                      Öppnar bokningen i schemat med kund, rum, skadedjur och ärendetexten "Grundorsaksutredning"
                      med rummets historik förifyllt. Koordinatorn väljer bara tid.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {flagged.length > 0 && okRooms.length > 0 && (
          <button
            className="w-full border-t border-slate-800/70 px-4 py-2.5 text-left text-[12.5px] text-slate-400 hover:text-slate-200"
            onClick={() => setShowAll((s) => !s)}
          >
            <b className="text-slate-200 tabular-nums">{okRooms.length} rum utan anmärkning</b> · {showAll ? 'Dölj ▴' : 'Visa alla ▾'}
          </button>
        )}
      </div>

      <p className="mt-3 max-w-[80ch] text-xs italic text-slate-500">
        Bågarna mellan prickarna visar tiden mellan besöken: slate = normal takt, bärnsten = under{' '}
        {thresholds.samePestDays}-dagarströskeln, röd = tiden krymper dessutom. Streckad tom ruta = teknikern har
        inte fyllt i trafikljuset — aldrig ett gissat värde. Allt är klickbart och öppnar ärendet.
      </p>
    </section>
  )
}
