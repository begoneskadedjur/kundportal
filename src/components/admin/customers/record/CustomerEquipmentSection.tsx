// src/components/admin/customers/record/CustomerEquipmentSection.tsx
//
// Utrustningsvyn för admin och koordinator.
//
// Byggd för EN fråga: "vilken enhet är eftersatt?" — inte för att navigera ett
// bestånd, vilket kundportalens vy gör. Därför ligger överblicken först och
// kartan sist, och enheterna sorteras på oro.
//
// Tre nivåer:
//   1. Beståndsband      vad kunden har totalt
//   2. Enhetsregister    en rad per enhet, det som är fel ligger överst
//   3. Enhetsuppslag     karta ELLER planritning, en enhet i taget
//
// Enkelkund kör samma tre nivåer med en enda enhetsrad — ingen separat kodväg.

import { lazy, Suspense, useMemo, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import {
  useCustomerEquipment,
  ALARM_RANK,
  type UnitEquipment,
  type LastInspection,
} from '../../../../hooks/useCustomerEquipment'
import {
  customerRowName,
  formatDateSv,
  type RecordCustomer,
  type RecordInspectionSession,
} from '../../../../hooks/useCustomerRecord'
import { countByCanonicalType } from '../../../../utils/stationTaxonomy'
import { BestandGlyph, StationAlarmMark, NoEquipmentIllustration } from './EquipmentGlyphs'
import { RecurringGlyph } from './CaseCategoryGlyph'

const EquipmentMap = lazy(() => import('../../../shared/equipment/EquipmentMap'))

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  inspections: RecordInspectionSession[]
}

/** Aktivitetsnivåernas färg och text. Ordningen är allvarsgrad. */
const LEVEL: Record<string, { label: string; dot: string; text: string }> = {
  high: { label: 'Hög', dot: 'bg-red-400', text: 'text-red-300' },
  medium: { label: 'Medel', dot: 'bg-orange-400', text: 'text-orange-300' },
  low: { label: 'Låg', dot: 'bg-amber-400', text: 'text-amber-300' },
  ok: { label: 'Utan anm.', dot: 'bg-[#20c58f]', text: 'text-[#20c58f]' },
  none: { label: 'Ingen', dot: 'bg-slate-600', text: 'text-slate-400' },
}

export default function CustomerEquipmentSection({ root, units, inspections }: Props) {
  const { data, loading } = useCustomerEquipment(root, units, inspections)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (loading) {
    return <p className="text-sm text-slate-500 py-8 text-center">Hämtar utrustning…</p>
  }
  if (!data || data.withEquipment.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-12 rounded-2xl border border-dashed border-slate-800">
        <NoEquipmentIllustration className="mb-4" />
        <p className="text-sm text-slate-300 font-medium">Ingen utrustning placerad</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Stationer registreras av tekniker vid etablering och servicebesök.
        </p>
      </div>
    )
  }

  const isMultisite = units.length > 0
  const overallTone =
    data.alarmCount > 0 ? 'bad' : data.totalOutdoor + data.totalIndoor > 0 ? 'ok' : 'none'

  return (
    <div className="space-y-4">
      {/* NIVÅ 1 — beståndsbandet */}
      <div className="flex items-stretch rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="grid place-items-center px-4 border-r border-slate-800">
          <BestandGlyph outdoor={data.totalOutdoor} indoor={data.totalIndoor} tone={overallTone} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 flex-1 divide-x divide-y sm:divide-y-0 divide-slate-800">
          <Stat label="Stationer" value={String(data.totalOutdoor + data.totalIndoor)} hint={isMultisite ? `${data.withEquipment.length} enheter` : null} />
          <Stat label="Utomhus" value={String(data.totalOutdoor)} hint="på karta" />
          <Stat
            label="Inomhus"
            value={String(data.totalIndoor)}
            hint={data.totalPlans > 0 ? `${data.totalPlans} planritning${data.totalPlans === 1 ? '' : 'ar'}` : null}
          />
          <Stat
            label="Att åtgärda"
            value={String(data.alarmCount)}
            hint={data.lastInspectedAt ? `senast ${formatDateSv(data.lastInspectedAt)}` : 'aldrig kontrollerad'}
            tone={data.alarmCount > 0 ? 'bad' : 'ok'}
          />
        </div>
      </div>

      {/* NIVÅ 2 — enhetsregistret. Sorterat på oro av hooken. */}
      <div className="space-y-2">
        {data.withEquipment.map((u) => (
          <UnitRow
            key={u.unit.id}
            data={u}
            showName={isMultisite}
            open={expanded === u.unit.id || data.withEquipment.length === 1}
            onToggle={() => setExpanded(expanded === u.unit.id ? null : u.unit.id)}
          />
        ))}
      </div>

      {/* Enheter utan utrustning — verifierbara, men skräpar inte */}
      {data.withoutEquipment.length > 0 && (
        <details className="border border-slate-800/60 rounded-2xl">
          <summary className="cursor-pointer px-4 py-2.5 text-xs text-slate-500 select-none flex items-center gap-2 hover:text-slate-300 transition-colors">
            <MapPin className="w-3 h-3 text-slate-600" />
            {data.withoutEquipment.length} enhet{data.withoutEquipment.length === 1 ? '' : 'er'} utan
            utrustning
          </summary>
          <ul className="px-4 pb-3 space-y-1">
            {data.withoutEquipment.map((u) => (
              <li key={u.unit.id} className="text-xs text-slate-500">
                {customerRowName(u.unit)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string | null
  tone?: 'ok' | 'bad'
}) {
  return (
    <div className="px-4 py-3.5 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-1.5 truncate">{label}</div>
      <div
        className={`text-[19px] font-semibold tabular-nums leading-none ${
          tone === 'bad' ? 'text-red-400' : tone === 'ok' ? 'text-[#20c58f]' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-500 mt-1 truncate">{hint}</div>}
    </div>
  )
}

function UnitRow({
  data,
  showName,
  open,
  onToggle,
}: {
  data: UnitEquipment
  showName: boolean
  open: boolean
  onToggle: () => void
}) {
  const alarmKind = data.alarm === 'empty' ? 'never' : data.alarm
  const tone =
    ALARM_RANK[data.alarm] >= ALARM_RANK.activity_high
      ? 'bad'
      : ALARM_RANK[data.alarm] >= ALARM_RANK.activity
        ? 'warn'
        : data.alarm === 'never'
          ? 'none'
          : 'ok'

  // Kontrollhjulet: hur många av årets förväntade besök som är utförda
  const perYear = data.intervalDays ? Math.max(1, Math.round(365 / data.intervalDays)) : 4
  const doneThisYear = data.lastInspectedAt
    ? Math.min(perYear, Math.max(1, Math.round((365 - (data.daysSince ?? 0)) / (data.intervalDays ?? 365))))
    : 0

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-3 py-3 text-left hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors"
      >
        <BestandGlyph outdoor={data.outdoor.length} indoor={data.indoorCount} tone={tone} size={44} />

        <div className="min-w-0 flex-1">
          {showName && (
            <p className="text-sm font-semibold text-slate-100 truncate">{customerRowName(data.unit)}</p>
          )}
          <p className="text-xs text-slate-400 tabular-nums">
            {data.outdoor.length} ute · {data.indoorCount} inne
            {data.floorPlans.length > 0 && (
              <span className="text-slate-500">
                {' '}
                · {data.floorPlans.length} planritning{data.floorPlans.length === 1 ? '' : 'ar'}
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.lastInspectedAt ? (
              <>
                Senast kontrollerad {formatDateSv(data.lastInspectedAt)}
                {data.daysSince != null && data.daysSince > 45 && (
                  <span className="text-amber-400"> · {Math.round(data.daysSince / 30)} mån sedan</span>
                )}
              </>
            ) : (
              'Ingen kontroll registrerad'
            )}
          </p>
        </div>

        <div className="hidden sm:grid place-items-center shrink-0">
          <RecurringGlyph size={40} total={perYear} done={doneThisYear} late={data.overdueSession ? 1 : 0} />
        </div>

        <StationAlarmMark kind={alarmKind} subLabel={data.alarmDetail} />

        <ChevronDown
          className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* NIVÅ 3 — uppslaget. Avmonteras när stängd så kartan inte laddas i onödan. */}
      {open && <UnitDetail data={data} />}
    </section>
  )
}

function UnitDetail({ data }: { data: UnitEquipment }) {
  // Segment: utomhus + en per planritning. Renderas bara när de har innehåll,
  // så en enhet med 0 ute (Katrineborgsgatan) inte får en tom karta.
  const segments = useMemo(() => {
    const s: { id: string; label: string; count: number }[] = []
    if (data.outdoor.length > 0) s.push({ id: 'outdoor', label: 'Utomhus', count: data.outdoor.length })
    for (const p of data.floorPlans) {
      const count = data.indoorByPlan[p.id]?.length ?? 0
      if (count > 0) s.push({ id: p.id, label: p.building_name ?? p.name ?? 'Planritning', count })
    }
    return s
  }, [data])

  const [active, setActive] = useState(segments[0]?.id ?? 'outdoor')
  const typeCounts = useMemo(() => countByCanonicalType(data.outdoor), [data.outdoor])

  // Stationer som kontrollerades vid senaste besöket — visas med bock på kartan
  const inspectedIds = useMemo(
    () => new Set(Object.keys(data.lastByStation)),
    [data.lastByStation]
  )

  return (
    <div className="border-t border-slate-700/70 p-3 space-y-3">
      {segments.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {segments.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`inline-flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 transition-colors ${
                active === s.id
                  ? 'border-[#20c58f]/50 bg-[#20c58f]/10 text-[#20c58f]'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.label}
              <span className="tabular-nums opacity-70">{s.count}</span>
            </button>
          ))}
        </div>
      )}

      {active === 'outdoor' && data.outdoor.length > 0 && (
        <>
          <div className="rounded-lg overflow-hidden border border-slate-700">
            <Suspense fallback={<div className="h-[340px] grid place-items-center text-xs text-slate-500">Laddar karta…</div>}>
              <EquipmentMap
                equipment={data.outdoor as never}
                height="340px"
                readOnly
                showControls={false}
                showNumbers
                enableClustering={data.outdoor.length > 80}
                inspectedStationIds={inspectedIds}
              />
            </Suspense>
          </div>
          {typeCounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {typeCounts.map((t) => (
                <span
                  key={t.code}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300"
                >
                  {t.label}
                  <span className="font-mono text-slate-400 tabular-nums">{t.count}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {active !== 'outdoor' && (
        <IndoorPanel
          stations={data.indoorByPlan[active] ?? []}
          lastByStation={data.lastByStation}
        />
      )}

      {/* Stationslistan för utomhus */}
      {active === 'outdoor' && (
        <StationList stations={data.outdoor} lastByStation={data.lastByStation} />
      )}
    </div>
  )
}

/**
 * Inomhusstationer. Planritningsbilden kräver en signerad URL med 1 h
 * livslängd — den hämtas därför först när segmentet öppnas, inte vid
 * sidladdning.
 */
function IndoorPanel({
  stations,
  lastByStation,
}: {
  stations: import('../../../../hooks/useCustomerEquipment').IndoorStation[]
  lastByStation: Record<string, LastInspection>
}) {
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-800/60">
        {stations.map((s, i) => {
          const insp = lastByStation[s.id]
          const level = LEVEL[insp?.status ?? 'none']
          return (
            <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-7 text-xs text-slate-500 tabular-nums shrink-0">
                {s.station_number ?? i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-slate-200 truncate">
                  {s.location_description || s.comment || s.station_type || 'Station'}
                </span>
                {insp?.findings && (
                  <span className="block text-xs text-slate-500 truncate">{insp.findings}</span>
                )}
              </span>
              <span className={`flex items-center gap-1.5 text-xs shrink-0 ${level.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} />
                {level.label}
              </span>
              <span className="text-xs text-slate-500 tabular-nums w-[68px] text-right shrink-0">
                {insp ? formatDateSv(insp.inspected_at) : '–'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StationList({
  stations,
  lastByStation,
}: {
  stations: import('../../../../hooks/useCustomerEquipment').OutdoorStation[]
  lastByStation: Record<string, LastInspection>
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? stations : stations.slice(0, 12)

  return (
    <div>
      <ul className="divide-y divide-slate-800/60">
        {shown.map((s, i) => {
          const insp = lastByStation[s.id]
          const level = LEVEL[insp?.status ?? 'none']
          // Betesstationer saknar ofta serienummer — kommentaren ("Tält 3",
          // "Port 11") är då den faktiska identifieraren.
          const label = s.serial_number?.trim() || s.comment?.trim() || `#${i + 1}`
          return (
            <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-7 text-xs text-slate-500 tabular-nums shrink-0">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-slate-200 truncate">{label}</span>
                {insp?.findings && (
                  <span className="block text-xs text-slate-500 truncate">{insp.findings}</span>
                )}
              </span>
              {insp?.measurement_value != null && (
                <span className="hidden sm:block text-xs text-slate-500 tabular-nums shrink-0">
                  {Number(insp.measurement_value).toLocaleString('sv-SE')} {insp.measurement_unit ?? ''}
                </span>
              )}
              <span className={`flex items-center gap-1.5 text-xs shrink-0 ${level.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} />
                {level.label}
              </span>
              <span className="text-xs text-slate-500 tabular-nums w-[68px] text-right shrink-0">
                {insp ? formatDateSv(insp.inspected_at) : '–'}
              </span>
            </li>
          )
        })}
      </ul>
      {stations.length > 12 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs text-slate-500 hover:text-[#20c58f] transition-colors"
        >
          Visa alla {stations.length} stationer
        </button>
      )}
    </div>
  )
}
