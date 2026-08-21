// src/components/admin/customers/record/CustomerCasesSection.tsx
//
// Ärendefliken på kundsidan. Delar upp arbetet i de grupper verksamheten
// faktiskt tänker i:
//   Återkommande & kontroll — det kunden betalar avtalet för
//   Etablering             — utplaceringen vid avtalsstart (engång)
//   Extraärenden           — arbete utanför avtalet = merförsäljning
//
// Tabellform, inte kort: största kunden har 36 ärenden och listan ska gå att
// skanna. Varje rad öppnar hela ärendet.

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
import {
  caseCategory,
  daysSince,
  expectedVisitsToDate,
  sessionLateness,
  LATENESS_STYLE,
  type CaseCategory,
  type Lateness,
} from '../../../../utils/caseCategory'
import { getCaseKindLabel } from '../../../../constants/caseTypeLabels'
import { isCaseCompleted, sumPipeline } from '../../../../utils/customerRevenue'
import { isCompletedStatus, type ClickUpStatus } from '../../../../types/database'
import { RecurringGlyph, ExtraGlyph, EstablishmentGlyph, MissedGlyph } from './CaseCategoryGlyph'

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  cases: RecordCase[]
  inspections: RecordInspectionSession[]
  schedules: RecordSchedule[]
  contracts: RecordContract[]
  /** Fakturor — för att inte visa säljärendet som merförsäljning */
  invoices: RecordInvoice[]
  /** Öppnar hela ärendet i ärendemodalen */
  onOpenCase: (c: RecordCase) => void
}

/** Ett ärende som det visas i tabellen — sessionen bär sanningen om utförandet. */
interface CaseRow {
  case: RecordCase
  session: RecordInspectionSession | null
  lateness: Lateness
  done: boolean
  date: string | null
  unitName: string | null
}

export default function CustomerCasesSection({
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

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of [root, ...units]) m.set(c.id, c.company_name ?? c.site_name ?? '')
    return m
  }, [root, units])

  const invoiceAmounts = useMemo(
    () =>
      new Set(
        invoices
          .filter((i) => (i.status ?? '') !== 'cancelled')
          .map((i) => Math.round(Number(i.subtotal ?? 0)))
      ),
    [invoices]
  )

  const derived = useMemo(() => {
    // Sessionerna nycklas på case_id — kopplingen är 1:1 för kontrollärenden
    const sessionByCase = new Map<string, RecordInspectionSession>()
    for (const s of inspections) {
      if (s.case_id) sessionByCase.set(s.case_id, s)
    }

    const rows: CaseRow[] = cases.map((c) => {
      const session = sessionByCase.get(c.id) ?? null
      // För kontrollbesök styr SESSIONEN, inte ärendestatusen: ett ärende kan
      // stå 'Bokad' medan sessionen passerat sitt datum för länge sedan.
      const done = session
        ? session.status === 'completed' || !!session.completed_at
        : !!c.completed_date || isCompletedStatus(c.status as ClickUpStatus)
      const when = session?.scheduled_at ?? c.scheduled_start ?? null
      return {
        case: c,
        session,
        lateness: session
          ? sessionLateness(session.scheduled_at, session.status ?? '')
          : done
            ? 'ontime'
            : sessionLateness(c.scheduled_start, 'scheduled'),
        done,
        date: session?.completed_at ?? when ?? c.completed_date ?? c.created_at,
        unitName: units.length > 0 ? (nameById.get(c.customer_id ?? '') ?? null) : null,
      }
    })

    const q = query.trim().toLowerCase()
    const match = (r: CaseRow) =>
      !q ||
      (r.case.case_number ?? '').toLowerCase().includes(q) ||
      r.case.title.toLowerCase().includes(q) ||
      (r.case.primary_technician_name ?? '').toLowerCase().includes(q) ||
      (r.case.pest_type ?? '').toLowerCase().includes(q) ||
      (r.unitName ?? '').toLowerCase().includes(q)

    const byCategory = (cat: CaseCategory) =>
      rows
        .filter((r) => caseCategory(r.case) === cat && match(r))
        // Nyast först, men försenade alltid överst — de kräver handling
        .sort((a, b) => {
          const aLate = a.lateness !== 'ontime' && !a.done
          const bLate = b.lateness !== 'ontime' && !b.done
          if (aLate !== bLate) return aLate ? -1 : 1
          return (b.date ?? '').localeCompare(a.date ?? '')
        })

    const recurring = byCategory('recurring')
    const establishment = byCategory('establishment')
    const extra = byCategory('extra')

    // Leveransmätning: avtalat mot faktiskt utfört senaste 12 månaderna
    const activeSchedule = schedules.find((s) => s.status === 'active') ?? schedules[0] ?? null
    const contractWithFreq = contracts.find((c) => c.visits_per_year || c.visit_frequency)
    const visitsPerYear =
      contractWithFreq?.visits_per_year ??
      (contractWithFreq?.visit_frequency
        ? VISITS_PER_YEAR_BY_FREQUENCY[contractWithFreq.visit_frequency]
        : null) ??
      (activeSchedule?.frequency ? VISITS_PER_YEAR_BY_FREQUENCY[activeSchedule.frequency] : null) ??
      null

    const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString()
    const doneLast12 = inspections.filter(
      (s) => (s.completed_at ?? '') > yearAgo && (s.status === 'completed' || !!s.completed_at)
    ).length
    const lateCount = inspections.filter(
      (s) => sessionLateness(s.scheduled_at, s.status ?? '') !== 'ontime'
    ).length
    const nextVisit =
      inspections
        .filter((s) => s.status === 'scheduled' && (s.scheduled_at ?? '') >= new Date().toISOString())
        .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))[0] ?? null

    const frequencyLabel =
      contractWithFreq?.visit_frequency
        ? VISIT_FREQUENCY_LABEL[contractWithFreq.visit_frequency]
        : activeSchedule?.frequency
          ? VISIT_FREQUENCY_LABEL[activeSchedule.frequency] ?? 'Anpassat schema'
          : null

    return {
      recurring,
      establishment,
      extra,
      hasRecurring: inspections.length > 0 || schedules.length > 0,
      visitsPerYear,
      expected: expectedVisitsToDate(visitsPerYear, activeSchedule?.schedule_start_date ?? null),
      doneLast12,
      lateCount,
      nextVisit,
      frequencyLabel,
      // Merförsäljning mäts per KUND: allt arbete utanför avtalet, oavsett om
      // avtalskopplingen råkar vara satt på raden.
      //
      // Bara UTFÖRT arbete räknas som intäkt — samma regel som Intäkter och
      // Fakturering använder (se utils/customerRevenue.ts). En signerad offert
      // är sålt, inte levererat, och hörde tidigare felaktigt hit.
      // Ärenden vars pris exakt motsvarar en faktura är samma pengar —
      // säljärendet som ledde till avtalet bär premiebeloppet. Samma spärr som
      // intäktsvyn använder, annars visar flikarna olika siffror.
      extraRevenue: extra
        .filter((r) => isCaseCompleted(r.case) && !invoiceAmounts.has(Math.round(Number(r.case.price ?? 0))))
        .reduce((sum, r) => sum + Number(r.case.price ?? 0), 0),
      extraPipeline: sumPipeline(extra.map((r) => r.case)),
    }
  }, [cases, inspections, schedules, contracts, units, nameById, query, invoiceAmounts])

  const totalShown = derived.recurring.length + derived.establishment.length + derived.extra.length

  return (
    <div className="space-y-4">
      {/* Leveransmätare — bara för kunder som faktiskt har återkommande besök */}
      {derived.hasRecurring && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl flex items-center gap-4">
          <RecurringGlyph
            total={derived.visitsPerYear ?? 4}
            done={derived.doneLast12}
            late={derived.lateCount}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-200">Leverans mot avtal</span>
              {derived.frequencyLabel && (
                <span className="text-xs text-slate-500">{derived.frequencyLabel}</span>
              )}
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

      {/* Sök — börjar löna sig runt 20 ärenden */}
      {totalShown > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök ärendenummer, tekniker, skadedjur…"
            className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          />
        </div>
      )}

      {derived.establishment.length > 0 && (
        <CaseGroup
          title="Etablering"
          hint="utplacering vid avtalsstart"
          glyph={<EstablishmentGlyph size={44} />}
          rows={derived.establishment}
          showUnit={units.length > 0}
          onOpenCase={onOpenCase}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <CaseGroup
          title="Återkommande & kontroll"
          hint="ingår i avtalet"
          glyph={<RecurringGlyph total={derived.visitsPerYear ?? 4} done={derived.doneLast12} late={derived.lateCount} size={44} />}
          rows={derived.recurring}
          showStations
          showUnit={units.length > 0}
          onOpenCase={onOpenCase}
          emptyText="Inga kontrollbesök registrerade."
        />
        <CaseGroup
          title="Extraärenden"
          hint="utanför avtalet — merförsäljning"
          glyph={<ExtraGlyph count={derived.extra.length} size={44} />}
          rows={derived.extra}
          showPrice
          showUnit={units.length > 0}
          onOpenCase={onOpenCase}
          emptyText="Inga extraärenden."
          footer={
            derived.extraRevenue > 0 || derived.extraPipeline.amount > 0 ? (
              <span className="text-right">
                {derived.extraRevenue > 0 && (
                  <span className="block tabular-nums">
                    {formatKr(derived.extraRevenue)} <span className="text-slate-500">utfört</span>
                  </span>
                )}
                {derived.extraPipeline.amount > 0 && (
                  <span className="block text-xs text-slate-500 tabular-nums">
                    {formatKr(derived.extraPipeline.amount)} sålt, ej utfört
                  </span>
                )}
              </span>
            ) : null
          }
        />
      </div>

      {totalShown === 0 && (
        <p className="text-sm text-slate-500 py-8 text-center">
          {query ? 'Inga ärenden matchar sökningen.' : 'Inga ärenden registrerade för kunden.'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function CaseGroup({
  title,
  hint,
  glyph,
  rows,
  showStations,
  showPrice,
  showUnit,
  onOpenCase,
  emptyText,
  footer,
}: {
  title: string
  hint: string
  glyph: React.ReactNode
  rows: CaseRow[]
  showStations?: boolean
  showPrice?: boolean
  showUnit?: boolean
  onOpenCase: (c: RecordCase) => void
  emptyText?: string
  footer?: React.ReactNode
}) {
  const lateInGroup = rows.filter((r) => !r.done && r.lateness !== 'ontime').length

  return (
    <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-3 mb-2">
        {glyph}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-200">
            {title} <span className="text-slate-500 tabular-nums font-normal">({rows.length})</span>
          </h3>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        {footer && <span className="shrink-0 text-sm text-slate-300">{footer}</span>}
      </div>

      {lateInGroup > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <MissedGlyph size={24} />
          {lateInGroup} besök har passerat sin planerade tid
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs italic text-slate-500 py-3">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-800/70">
          {rows.map((r) => (
            <li key={r.case.id}>
              <button
                type="button"
                onClick={() => onOpenCase(r.case)}
                className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg text-left hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors group"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    r.done ? 'bg-[#20c58f]' : LATENESS_STYLE[r.lateness].dot
                  }`}
                  aria-hidden
                />
                <span className="text-xs text-slate-500 tabular-nums w-[68px] shrink-0">
                  {formatDateSv(r.date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-200 truncate">
                    {r.case.case_number ?? r.case.title}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {getCaseKindLabel(r.case.service_type)?.short ??
                      (r.case.origin === 'business' ? 'Företagsärende' : 'Ärende')}
                    {r.case.pest_type && ` · ${r.case.pest_type}`}
                    {showUnit && r.unitName && ` · ${r.unitName}`}
                  </span>
                </span>
                {showStations && r.session && (
                  <span className="hidden sm:block text-xs text-slate-500 tabular-nums shrink-0">
                    {(r.session.inspected_outdoor_stations ?? 0) + (r.session.inspected_indoor_stations ?? 0)}
                    {' / '}
                    {(r.session.total_outdoor_stations ?? 0) + (r.session.total_indoor_stations ?? 0)} st
                  </span>
                )}
                {showPrice && r.case.price != null && Number(r.case.price) > 0 && (
                  <span className="text-xs text-slate-300 tabular-nums shrink-0">
                    {formatKr(Number(r.case.price))}
                  </span>
                )}
                <span
                  className={`hidden md:block text-xs truncate max-w-24 shrink-0 ${
                    r.done ? 'text-[#20c58f]' : LATENESS_STYLE[r.lateness].text
                  }`}
                >
                  {r.done
                    ? 'Utfört'
                    : r.lateness === 'ontime'
                      ? r.case.status
                      : `${LATENESS_STYLE[r.lateness].label} · ${daysSince(r.session?.scheduled_at ?? r.case.scheduled_start)} d`}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-[#20c58f] transition-colors shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
