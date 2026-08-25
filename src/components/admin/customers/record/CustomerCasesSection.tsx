// src/components/admin/customers/record/CustomerCasesSection.tsx
//
// Ärendefliken på kundsidan — enligt godkänd designskiss (aug 2026):
//   Ärendetyper   — kategoristripp med graverade glyfer; hovra = filtrera, klicka = lås
//   Rumsanalys    — för kunder med Rum nr aktiverat (RoomAnalysisSection)
//   Ärendeflöde   — ett samlat, klickbart flöde med tekniker, trafikljus, pris, status
//
// Leveransmätaren mot avtalet behålls överst — den är operativ och ersätts
// inte av designen.

import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
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
import { expectedVisitsToDate, sessionLateness, LATENESS_STYLE, daysSince, type Lateness } from '../../../../utils/caseCategory'
import { isCompletedStatus, type ClickUpStatus } from '../../../../types/database'
import { RecurringGlyph, MissedGlyph } from './CaseCategoryGlyph'
import RoomAnalysisSection, { flowCategory } from './RoomAnalysisSection'
import ClassicCasesSection from './ClassicCasesSection'

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

type FlowCat = ReturnType<typeof flowCategory>
const CAT_META: Record<FlowCat, { label: string; color: string }> = {
  service: { label: 'Servicebesök', color: '#2fc98f' },
  inspektion: { label: 'Inspektioner', color: '#56a8e8' },
  extra: { label: 'Saneringar', color: '#b48be8' },
  etabl: { label: 'Etableringar', color: '#d9a04a' },
}
const LIGHTS = { ok: '#34c26b', varning: '#e0a83a', kritisk: '#e46a5f', saknas: '#45566e' }

/** Graverade kategoriglyfer — samma formspråk som avtalskartan */
function CatGlyph({ cat, size = 42 }: { cat: FlowCat; size?: number }) {
  const c = CAT_META[cat].color
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      {cat === 'service' && (
        <>
          <rect x="7" y="9" width="30" height="28" rx="5" stroke={c} strokeWidth="1.6" />
          <path d="M7 17h30" stroke={c} strokeWidth="1.6" />
          <path d="M14 6v6M30 6v6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M15 27l4.5 4.5L29 22" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {cat === 'inspektion' && (
        <>
          <circle cx="19" cy="19" r="10.5" stroke={c} strokeWidth="1.6" />
          <path d="M27 27l8.5 8.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14.5 19c1.5-3 3-4.5 4.5-4.5s3 1.5 4.5 4.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="19" cy="21.5" r="1.4" fill={c} />
        </>
      )}
      {cat === 'extra' && (
        <>
          {/* Avtalsdokument med plus utanfor kanten: arbete utover avtalet */}
          <path d="M9 10a3 3 0 0 1 3-3h11l6 6v21a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M23 7v6h6" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M13 19h12M13 24h12M13 29h7" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M35 25.5v13M28.5 32H41.5" stroke={c} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {cat === 'etabl' && (
        <>
          <path d="M9 36h26" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13 36V22a9 9 0 0 1 18 0v14" stroke={c} strokeWidth="1.6" />
          <path d="M22 13V7m0 0 5 2.6L22 12" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

function lightColor(level: number | null | undefined): string | null {
  if (level == null || level === 0) return null
  return level >= 3 ? LIGHTS.kritisk : level === 2 ? LIGHTS.varning : LIGHTS.ok
}

// VÄXELN: kunder med Rum nr aktiverat får den nya rumsdesignen nedan —
// alla andra får den klassiska grupperade vyn (stationsräkning,
// merförsäljningssummor). Nya designen är RUMSKUNDERNAS vy, inte en global.
export default function CustomerCasesSection(props: Props) {
  const roomsView =
    !!(props.root as { room_number_enabled?: boolean }).room_number_enabled ||
    props.cases.some((c) => c.room_number)
  if (!roomsView) return <ClassicCasesSection {...props} />
  return <RoomCasesView {...props} />
}

function RoomCasesView({
  root, units, cases, inspections, schedules, contracts, onOpenCase,
}: Props) {
  const [query, setQuery] = useState('')
  const [hoverCat, setHoverCat] = useState<FlowCat | null>(null)
  const [lockedCat, setLockedCat] = useState<FlowCat | null>(null)
  const activeCat = lockedCat ?? hoverCat

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of [root, ...units]) m.set(c.id, c.company_name ?? c.site_name ?? '')
    return m
  }, [root, units])

  const derived = useMemo(() => {
    const sessionByCase = new Map<string, RecordInspectionSession>()
    for (const s of inspections) if (s.case_id) sessionByCase.set(s.case_id, s)

    const yearAgo = Date.now() - 365 * 86_400_000
    const rows = cases.map((c) => {
      const session = sessionByCase.get(c.id) ?? null
      const done = session
        ? session.status === 'completed' || !!session.completed_at
        : !!c.completed_date || isCompletedStatus(c.status as ClickUpStatus)
      const date = session?.completed_at ?? session?.scheduled_at ?? c.completed_date ?? c.scheduled_start ?? c.created_at
      const lateness: Lateness = session
        ? sessionLateness(session.scheduled_at, session.status ?? '')
        : done ? 'ontime' : sessionLateness(c.scheduled_start, 'scheduled')
      return { case: c, cat: flowCategory(c), session, done, date, lateness,
        unitName: units.length > 0 ? (nameById.get(c.customer_id ?? '') ?? null) : null }
    })

    const counts = { service: 0, inspektion: 0, extra: 0, etabl: 0 } as Record<FlowCat, number>
    const latest: Partial<Record<FlowCat, string>> = {}
    for (const r of rows) {
      if (new Date(r.date ?? 0).getTime() < yearAgo) continue
      counts[r.cat]++
      if (!latest[r.cat] || (r.date ?? '') > (latest[r.cat] as string)) latest[r.cat] = r.date ?? undefined
    }

    const q = query.trim().toLowerCase()
    const flow = rows
      .filter((r) => !activeCat || r.cat === activeCat)
      .filter((r) =>
        !q ||
        (r.case.case_number ?? '').toLowerCase().includes(q) ||
        r.case.title.toLowerCase().includes(q) ||
        (r.case.primary_technician_name ?? '').toLowerCase().includes(q) ||
        (r.case.pest_type ?? '').toLowerCase().includes(q) ||
        (r.case.room_number ?? '').toLowerCase().includes(q) ||
        (r.unitName ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aLate = a.lateness !== 'ontime' && !a.done
        const bLate = b.lateness !== 'ontime' && !b.done
        if (aLate !== bLate) return aLate ? -1 : 1
        return (b.date ?? '').localeCompare(a.date ?? '')
      })

    // Leveransmätaren mot avtalet (oförändrad logik)
    const activeSchedule = schedules.find((s) => s.status === 'active') ?? schedules[0] ?? null
    const contractWithFreq = contracts.find((c) => c.visits_per_year || c.visit_frequency)
    const visitsPerYear =
      contractWithFreq?.visits_per_year ??
      (contractWithFreq?.visit_frequency ? VISITS_PER_YEAR_BY_FREQUENCY[contractWithFreq.visit_frequency] : null) ??
      (activeSchedule?.frequency ? VISITS_PER_YEAR_BY_FREQUENCY[activeSchedule.frequency] : null) ?? null
    const doneLast12 = inspections.filter(
      (s) => new Date(s.completed_at ?? 0).getTime() > yearAgo && (s.status === 'completed' || !!s.completed_at)
    ).length
    const lateCount = inspections.filter((s) => sessionLateness(s.scheduled_at, s.status ?? '') !== 'ontime').length
    const nextVisit =
      inspections
        .filter((s) => s.status === 'scheduled' && (s.scheduled_at ?? '') >= new Date().toISOString())
        .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))[0] ?? null

    return {
      flow, counts, latest,
      hasRecurring: inspections.length > 0 || schedules.length > 0,
      visitsPerYear,
      expected: expectedVisitsToDate(visitsPerYear, activeSchedule?.schedule_start_date ?? null),
      doneLast12, lateCount, nextVisit,
      frequencyLabel: contractWithFreq?.visit_frequency
        ? VISIT_FREQUENCY_LABEL[contractWithFreq.visit_frequency]
        : activeSchedule?.frequency ? (VISIT_FREQUENCY_LABEL[activeSchedule.frequency] ?? 'Anpassat schema') : null,
    }
  }, [cases, inspections, schedules, contracts, units, nameById, query, activeCat])

  const roomsEnabled =
    !!(root as { room_number_enabled?: boolean }).room_number_enabled || cases.some((c) => c.room_number)

  return (
    <div className="space-y-8">
      {/* Leveransmätare mot avtalet */}
      {derived.hasRecurring && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl flex items-center gap-4">
          <RecurringGlyph total={derived.visitsPerYear ?? 4} done={derived.doneLast12} late={derived.lateCount} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-200">Leverans mot avtal</span>
              {derived.frequencyLabel && <span className="text-xs text-slate-500">{derived.frequencyLabel}</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {derived.doneLast12} utförda senaste året
              {derived.expected != null && ` · ${derived.expected} förväntade hittills`}
              {derived.visitsPerYear && ` · ${derived.visitsPerYear} ingår per år`}
            </p>
            {derived.nextVisit && (
              <p className="text-xs text-slate-500 mt-0.5">
                Nästa besök {formatDateSv(derived.nextVisit.scheduled_at)}
                {derived.nextVisit.technician_name && ` · ${derived.nextVisit.technician_name}`}
              </p>
            )}
          </div>
          {derived.lateCount > 0 && (
            <span className="shrink-0 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 tabular-nums">
              <MissedGlyph size={28} />
              {derived.lateCount} försenat
            </span>
          )}
        </div>
      )}

      {/* Ärendetyper — kategoristripp utan lådor: siffran bär, färgen är tick */}
      <section>
        <div className="flex items-baseline gap-3 border-b-[1.5px] border-slate-700 pb-1.5 mb-3.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Ärendetyper</h2>
          <span className="ml-auto text-xs text-slate-500">senaste 12 mån · hovra för att filtrera, klicka för att låsa</span>
        </div>
        <div className="flex items-stretch">
          {(Object.keys(CAT_META) as FlowCat[]).map((cat, i) => (
            <button
              key={cat}
              onMouseEnter={() => setHoverCat(cat)}
              onMouseLeave={() => setHoverCat(null)}
              onClick={() => setLockedCat(lockedCat === cat ? null : cat)}
              className={`flex flex-1 items-center gap-3.5 py-1 pr-5 text-left ${i > 0 ? 'border-l border-slate-800 pl-5' : ''}`}
            >
              <CatGlyph cat={cat} />
              <div>
                <span className={`text-[30px] font-light leading-none tabular-nums tracking-tight ${derived.counts[cat] === 0 ? 'text-slate-600' : 'text-slate-100'}`}>
                  {derived.counts[cat]}
                </span>
                <span className="mt-1 block h-0.5 w-4 rounded-full" style={{ background: CAT_META[cat].color, opacity: derived.counts[cat] === 0 ? 0.25 : 1 }} />
              </div>
              <div>
                <div className={`text-[12.5px] ${lockedCat === cat ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>{CAT_META[cat].label}</div>
                <div className="text-[11px] text-slate-500">
                  {derived.latest[cat] ? `senast ${formatDateSv(derived.latest[cat] ?? null)}` : '—'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Rumsanalys — bara för kunder med Rum nr */}
      {roomsEnabled && (
        <RoomAnalysisSection root={root} cases={cases} onOpenCase={onOpenCase} dimCategory={activeCat} />
      )}

      {/* Ärendeflöde */}
      <section>
        <div className="flex items-baseline gap-3 border-b-[1.5px] border-slate-700 pb-1.5 mb-3.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">Ärendeflöde</h2>
          <span className="ml-auto text-xs text-slate-500">klicka för att öppna i ärendemodalen</span>
        </div>

        {derived.flow.length > 8 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök ärendenummer, tekniker, skadedjur, rum…"
              className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
            />
          </div>
        )}

        <div
          className="overflow-hidden rounded-2xl border border-slate-700"
          style={{ background: 'linear-gradient(180deg,#14212f,#101b2c 48px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 16px 40px -24px rgba(0,0,0,.7)' }}
        >
          <div className="grid grid-cols-[74px_30px_1fr_108px_78px_74px_88px_22px] gap-3 border-b border-slate-700 px-4 py-2 text-[10.5px] uppercase tracking-[.1em] text-slate-500 max-md:hidden">
            <span>Datum</span><span /><span>Ärende</span><span>Tekniker</span><span>Trafikljus</span><span>Pris</span><span>Status</span><span />
          </div>
          {derived.flow.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {query || activeCat ? 'Inga ärenden matchar filtret.' : 'Inga ärenden registrerade för kunden.'}
            </p>
          ) : (
            derived.flow.map((r) => (
              <button
                key={r.case.id}
                onClick={() => onOpenCase(r.case)}
                className="group grid w-full grid-cols-[74px_30px_1fr_108px_78px_74px_88px_22px] items-center gap-3 border-t border-slate-800/70 px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-[#121f33] max-md:grid-cols-[74px_1fr]"
                style={{ opacity: activeCat && r.cat !== activeCat ? 0.18 : 1 }}
              >
                <span className="text-xs tabular-nums text-slate-500">{formatDateSv(r.date)}</span>
                <span className="max-md:hidden"><CatGlyph cat={r.cat} size={28} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-200">
                    {r.case.title}
                    {r.case.case_number && r.case.case_number !== r.case.title && (
                      <span className="ml-1.5 text-[11px] font-normal text-slate-500">{r.case.case_number}</span>
                    )}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-500">
                    {r.case.room_number && <b className="font-semibold text-slate-400 tabular-nums">Rum {r.case.room_number}</b>}
                    {r.case.room_number && (r.case.pest_type || r.unitName) && ' · '}
                    {r.case.pest_type}
                    {r.unitName && `${r.case.pest_type ? ' · ' : ''}${r.unitName}`}
                  </span>
                </span>
                <span className="truncate text-xs text-slate-400 max-md:hidden">{r.case.primary_technician_name ?? ''}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 max-md:hidden">
                  {lightColor(r.case.pest_level) ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: lightColor(r.case.pest_level)! }} />
                      {r.case.pest_level! >= 3 ? 'Kritisk' : r.case.pest_level === 2 ? 'Varning' : 'OK'}
                    </>
                  ) : r.case.origin === 'case' && r.done ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: LIGHTS.saknas }} />
                      Ej ifyllt
                    </>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </span>
                <span className="text-right text-xs tabular-nums text-slate-200 max-md:hidden">
                  {r.case.price != null && Number(r.case.price) > 0 ? formatKr(Number(r.case.price)) : <span className="text-slate-600">—</span>}
                </span>
                <span className="max-md:hidden">
                  {r.done ? (
                    <span className="rounded-full bg-[#34c26b]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#34c26b]">Avslutat</span>
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
            ))
          )}
        </div>
      </section>
    </div>
  )
}
