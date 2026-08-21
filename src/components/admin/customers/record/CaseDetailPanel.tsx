// src/components/admin/customers/record/CaseDetailPanel.tsx
//
// LÄSVY för ett ärende på kundsidan. Ingen redigering.
//
// Varför inte de befintliga modalerna: EditCaseModal är byggd för
// private_cases/business_cases och läser helt andra kolumnnamn än cases
// (kontaktperson vs contact_person, primary_assignee_id vs
// primary_technician_id, ...). Skickar man in en cases-rad blir nästan varje
// fält tomt — OCH en sparning skulle försöka skriva kolumner som inte finns.
// De tre avtalsmodalerna kan läsa råa cases-rader men är fulla
// arbetsverktyg. Här ska ärendet bara visas.
//
// Panelen läser BÅDA tabellerna och normaliserar fältnamnen på ett ställe.

import { useEffect, useId, useState } from 'react'
import { Check, Copy, Mail, MapPin, Phone, X } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { formatDateSv, formatKr, type RecordCase } from '../../../../hooks/useCustomerRecord'
import { getCaseKindLabel } from '../../../../constants/caseTypeLabels'
import { caseCategory, daysSince, sessionLateness, LATENESS_STYLE } from '../../../../utils/caseCategory'
import { RecurringGlyph, ExtraGlyph, EstablishmentGlyph, MissedGlyph } from './CaseCategoryGlyph'

/** Ett ärende med fältnamnen normaliserade oavsett källtabell. */
interface CaseDetail {
  caseNumber: string | null
  title: string
  status: string
  serviceType: string | null
  pestType: string | null
  description: string | null
  contactPerson: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: CaseAddress
  technician: string | null
  scheduledStart: string | null
  scheduledEnd: string | null
  completedDate: string | null
  /**
   * Pris finns bara på företagsärenden (business_cases.pris). cases.price är
   * NULL på alla 190 rader, liksom material_cost på båda tabellerna — de
   * fälten visas därför aldrig.
   */
  price: number | null
  workReport: string | null
  recommendations: string | null
}

export interface CaseAddress {
  /** Presentabel adress, aldrig JSON */
  formatted: string | null
  lat: number | null
  lng: number | null
}

/**
 * Adressen kommer i tre former beroende på tabell och ålder:
 *   - äkta objekt med formatted_address + location
 *   - JSON-STRÄNG som innehåller samma objekt (business_cases: 743 av 743 rader
 *     är dubbelkodade — någonstans i skrivvägen körs JSON.stringify en gång för
 *     mycket innan värdet når jsonb-kolumnen)
 *   - ren adresstext
 *
 * Den gamla läsaren returnerade strängen rakt av, så hela JSON-objektet
 * hamnade i gränssnittet. Vi skalar därför upp till tre lager och plockar
 * samtidigt ut koordinaterna, som kartan behöver.
 */
export function parseCaseAddress(raw: unknown): CaseAddress {
  const empty: CaseAddress = { formatted: null, lat: null, lng: null }
  if (raw == null) return empty

  let value: unknown = raw
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth++) {
    const trimmed = value.trim()
    if (!trimmed) return empty
    // Ren adresstext — inte JSON. Använd den som den är.
    if (trimmed[0] !== '{' && trimmed[0] !== '"') return { ...empty, formatted: trimmed }
    try {
      value = JSON.parse(trimmed)
    } catch {
      // Ser ut som JSON men går inte att tolka — visa hellre inget än råtext
      return empty
    }
  }
  if (typeof value === 'string') return { ...empty, formatted: value.trim() || null }
  if (typeof value !== 'object' || value === null) return empty

  const o = value as {
    formatted_address?: unknown
    address?: unknown
    location?: { lat?: unknown; lng?: unknown }
    lat?: unknown
    lng?: unknown
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const text =
    typeof o.formatted_address === 'string'
      ? o.formatted_address
      : typeof o.address === 'string'
        ? o.address
        : null

  return {
    formatted: text?.trim() || null,
    lat: num(o.location?.lat) ?? num(o.lat),
    lng: num(o.location?.lng) ?? num(o.lng),
  }
}

/** Skyddsnät: rå JSON får aldrig nå gränssnittet, hur trasig datan än är. */
function looksLikeJson(s: string): boolean {
  return /^[{[]/.test(s.trim()) || s.includes('"place_id"')
}

function normalize(row: Record<string, unknown>, origin: 'case' | 'business'): CaseDetail {
  const g = <T,>(k: string) => row[k] as T
  if (origin === 'business') {
    return {
      caseNumber: g<string | null>('case_number') ?? null,
      title: g<string | null>('title') ?? 'Företagsärende',
      status: g<string | null>('status') ?? '',
      serviceType: null,
      pestType: g<string | null>('skadedjur') ?? null,
      description: g<string | null>('description') ?? null,
      contactPerson: g<string | null>('kontaktperson') ?? null,
      contactEmail: g<string | null>('e_post_kontaktperson') ?? null,
      contactPhone: g<string | null>('telefon_kontaktperson') ?? null,
      address: parseCaseAddress(row.adress),
      technician: g<string | null>('primary_assignee_name') ?? null,
      scheduledStart: g<string | null>('start_date') ?? null,
      scheduledEnd: g<string | null>('due_date') ?? null,
      completedDate: g<string | null>('completed_date') ?? null,
      price: row.pris != null ? Number(row.pris) : null,
      workReport: g<string | null>('rapport') ?? null,
      recommendations: null,
    }
  }
  return {
    caseNumber: g<string | null>('case_number') ?? null,
    title: g<string | null>('title') ?? 'Ärende',
    status: g<string | null>('status') ?? '',
    serviceType: g<string | null>('service_type') ?? null,
    pestType: g<string | null>('pest_type') ?? null,
    description: g<string | null>('description') ?? null,
    contactPerson: g<string | null>('contact_person') ?? null,
    contactEmail: g<string | null>('contact_email') ?? null,
    contactPhone: g<string | null>('contact_phone') ?? null,
    address: parseCaseAddress(row.address),
    technician: g<string | null>('primary_technician_name') ?? null,
    scheduledStart: g<string | null>('scheduled_start') ?? null,
    scheduledEnd: g<string | null>('scheduled_end') ?? null,
    completedDate: g<string | null>('completed_date') ?? null,
    price: row.price != null ? Number(row.price) : null,
    workReport: g<string | null>('work_report') ?? null,
    recommendations: g<string | null>('recommendations') ?? null,
  }
}

/** Initialer för teknikerns avatar. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Svenska telefonnummer skrivs ofta "070-123 45 67" — det bryter tel:. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/**
 * Kalenderblad — dagen ärendet faktiskt hände (eller ska hända).
 * Perforerad överkant som InvoiceSlip: samma pappersspråk, annat objekt.
 * Tonen bär status: grön = utfört, bärnsten/röd = försenat, slate = bokat.
 */
function CalendarLeaf({ iso, tone = '#20c58f', size = 58 }: { iso: string; tone?: string; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const d = new Date(iso)
  const day = d.toLocaleDateString('sv-SE', { day: 'numeric' })
  const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '').toUpperCase()
  const year = d.toLocaleDateString('sv-SE', { year: 'numeric' })

  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 62 70"
      role="img"
      aria-label={`${day} ${month.toLowerCase()} ${year}`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-rough`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`}>
        <path
          d="M5 8 H57 V62 Q57 65 54 65 H8 Q5 65 5 62 Z"
          fill="#0f172a"
          stroke={tone}
          strokeWidth="1.5"
          strokeOpacity="0.55"
          strokeLinejoin="round"
        />
        <path d="M5 8 H57 V21 H5 Z" fill={tone} fillOpacity="0.16" />
        <path d="M5 21 H57" stroke={tone} strokeWidth="1.2" strokeOpacity="0.5" />
        {/* Perforering: bladet är avrivet från blocket */}
        {[12, 22, 32, 42, 52].map((x) => (
          <circle key={x} cx={x} cy="8" r="1.9" fill="#0f172a" stroke={tone} strokeWidth="0.9" strokeOpacity="0.45" />
        ))}
      </g>
      <text
        x="31"
        y="17.5"
        textAnchor="middle"
        fill={tone}
        fillOpacity="0.95"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="1.6"
        fontFamily="ui-sans-serif, system-ui, Inter, sans-serif"
      >
        {month}
      </text>
      <text
        x="31"
        y="46"
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="25"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, Inter, sans-serif"
      >
        {day}
      </text>
      <text
        x="31"
        y="58.5"
        textAnchor="middle"
        fill="#64748b"
        fontSize="9"
        fontWeight="600"
        letterSpacing="0.6"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {year}
      </text>
    </svg>
  )
}

/**
 * Tidsspann som axel: 07:00 ──── 09:00 · 2 tim.
 * En axel läser som varaktighet; "07:00–09:00" läser som en textsträng.
 */
function TimeSpan({ start, end, tone = '#20c58f' }: { start: string; end?: string | null; tone?: string }) {
  const hhmm = (s: string) =>
    new Date(s).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const minutes = end ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : null
  const duration =
    minutes == null || minutes <= 0
      ? null
      : minutes >= 60
        ? `${Math.floor(minutes / 60)} tim${minutes % 60 ? ` ${minutes % 60} min` : ''}`
        : `${minutes} min`

  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-sm text-slate-200 tabular-nums">{hhmm(start)}</span>
      {end && (
        <>
          <span className="relative flex-1 min-w-[52px] h-px" style={{ background: `${tone}59` }}>
            <span
              className="absolute -left-px -top-[3px] w-[7px] h-[7px] rounded-full"
              style={{ background: tone }}
            />
            <span
              className="absolute -right-px -top-[3px] w-[7px] h-[7px] rounded-full border"
              style={{ borderColor: tone, background: '#0f172a' }}
            />
          </span>
          <span className="font-mono text-sm text-slate-200 tabular-nums">{hhmm(end)}</span>
        </>
      )}
      {duration && <span className="text-[11px] text-slate-500 shrink-0">{duration}</span>}
    </div>
  )
}

/** Klickbar kontaktuppgift med kopieringsknapp som avslöjas vid hover. */
function ContactLink({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string
  label: string
  value: string
  icon: typeof Mail
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group flex items-center gap-2 min-w-0">
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="flex items-center gap-2 min-w-0 rounded-lg -mx-1 px-1 py-0.5 text-slate-200 hover:text-[#20c58f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors"
        aria-label={`${label}: ${value}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-[#20c58f] transition-colors" />
        <span className="text-sm truncate underline decoration-dotted decoration-slate-600 underline-offset-[3px] group-hover:decoration-[#20c58f]/60 transition-colors">
          {value}
        </span>
      </a>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        }}
        className="shrink-0 w-6 h-6 grid place-items-center rounded-md text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-slate-200 hover:bg-slate-700/60 transition-all"
        aria-label={`Kopiera ${label.toLowerCase()}`}
      >
        {copied ? <Check className="w-3 h-3 text-[#20c58f]" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  )
}

interface Props {
  caseRow: RecordCase
  onClose: () => void
}

/** Utplacerad station, som den visas i etableringssammanfattningen. */
interface Placement {
  id: string
  serial_number: string | null
  equipment_type: string | null
  latitude: number | null
  longitude: number | null
  placed_at: string
  comment: string | null
}

export default function CaseDetailPanel({ caseRow, onClose }: Props) {
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [placements, setPlacements] = useState<Placement[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const table = caseRow.origin === 'business' ? 'business_cases' : 'cases'
      const { data, error } = await supabase.from(table).select('*').eq('id', caseRow.id).maybeSingle()
      if (cancelled) return
      setDetail(error || !data ? null : normalize(data as Record<string, unknown>, caseRow.origin))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [caseRow.id, caseRow.origin])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Utrustning placerad i samband med etableringen. equipment_placements har
  // ingen case_id — kopplingen görs på kund + datum inom ±2 dygn, vilket
  // träffar samtliga etableringar i produktion. Formuleras därför i vyn som
  // "placerat kring detta datum", aldrig som en exakt koppling.
  useEffect(() => {
    if (caseCategory(caseRow) !== 'establishment' || !caseRow.customer_id) return
    const anchor = caseRow.completed_date ?? caseRow.scheduled_start
    if (!anchor) return
    const day = anchor.slice(0, 10)
    const from = new Date(Date.parse(`${day}T00:00:00`) - 2 * 86_400_000).toISOString()
    const to = new Date(Date.parse(`${day}T23:59:59`) + 2 * 86_400_000).toISOString()

    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('equipment_placements')
        .select('id, serial_number, equipment_type, latitude, longitude, placed_at, comment')
        .eq('customer_id', caseRow.customer_id)
        .gte('placed_at', from)
        .lte('placed_at', to)
        .order('placed_at', { ascending: true })
      if (!cancelled) setPlacements((data ?? []) as Placement[])
    })()
    return () => {
      cancelled = true
    }
  }, [caseRow])

  const category = caseCategory(caseRow)
  const glyph =
    category === 'recurring' ? (
      <RecurringGlyph size={48} total={4} done={caseRow.completed_date ? 1 : 0} />
    ) : category === 'establishment' ? (
      <EstablishmentGlyph size={48} />
    ) : (
      <ExtraGlyph size={48} />
    )

  // completed_date är NULL på ALLA etableringsärenden, även avslutade —
  // TechnicianEquipment sätter status utan datumstämpel. Statusen måste
  // därför räknas som lika giltig markör för "utfört".
  const done =
    !!detail?.completedDate || ['avslutat', 'stängt'].includes((detail?.status ?? '').toLowerCase())
  const lateness = done ? 'ontime' : sessionLateness(detail?.scheduledStart ?? null, 'scheduled')

  const primaryDate = detail?.completedDate ?? detail?.scheduledStart ?? null
  const dateTone = done
    ? '#20c58f'
    : lateness === 'missed'
      ? '#f87171'
      : lateness !== 'ontime'
        ? '#f59e0b'
        : '#64748b'

  // Hur många dagar utförandet avvek från planen
  const driftDays =
    detail?.completedDate && detail?.scheduledStart
      ? Math.round(
          (Date.parse(detail.completedDate.slice(0, 10)) -
            Date.parse(detail.scheduledStart.slice(0, 10))) /
            86_400_000
        )
      : null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Ärende ${caseRow.case_number ?? caseRow.title}`}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Huvud */}
        <div className="flex items-start gap-3.5 p-4 border-b border-slate-700/70">
          {glyph}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-100 font-mono">
                {detail?.caseNumber ?? caseRow.case_number ?? '—'}
              </h2>
              <span
                className={`text-xs ${done ? 'text-[#20c58f]' : LATENESS_STYLE[lateness].text}`}
              >
                {done ? 'Utfört' : (detail?.status ?? caseRow.status)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {getCaseKindLabel(caseRow.service_type)?.label ??
                (caseRow.origin === 'business' ? 'Engångsjobb Företag' : 'Ärende')}
              {detail?.pestType && ` · ${detail.pestType}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-slate-500">Hämtar ärendet…</p>
        ) : !detail ? (
          <p className="p-4 text-sm text-red-400">Kunde inte hämta ärendet.</p>
        ) : (
          <div className="p-4 space-y-3">
            {/* Försening — bara när den finns, med samma glyf som ärendelistan */}
            {!done && lateness !== 'ontime' && detail.scheduledStart && (
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
                  lateness === 'missed'
                    ? 'bg-red-500/10 border-red-500/30'
                    : lateness === 'late'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <MissedGlyph size={30} tone={lateness === 'missed' ? '#f87171' : '#f59e0b'} />
                <p className={`text-xs ${LATENESS_STYLE[lateness].text}`}>
                  <span className="font-semibold">{LATENESS_STYLE[lateness].label}</span> — skulle ha
                  utförts {formatDateSv(detail.scheduledStart)}
                  {daysSince(detail.scheduledStart) != null &&
                    ` (${daysSince(detail.scheduledStart)} dagar sedan)`}
                </p>
              </div>
            )}

            {/* Tid: kalenderbladet bär dagen, axeln bär varaktigheten */}
            {primaryDate && (
              <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-start gap-3.5">
                  <CalendarLeaf iso={primaryDate} tone={dateTone} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100">
                        {done ? 'Utfört' : 'Planerat besök'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(primaryDate).toLocaleDateString('sv-SE', { weekday: 'long' })}
                      </span>
                    </div>
                    {detail.scheduledStart && (
                      <TimeSpan start={detail.scheduledStart} end={detail.scheduledEnd} tone={dateTone} />
                    )}
                    {done && driftDays !== null && driftDays !== 0 && (
                      <p className="text-xs text-slate-400">
                        Planerat {formatDateSv(detail.scheduledStart)} ·{' '}
                        <span className={driftDays > 0 ? 'text-amber-300' : 'text-slate-400'}>
                          {driftDays > 0
                            ? `utfört ${driftDays} ${driftDays === 1 ? 'dag' : 'dagar'} senare`
                            : `utfört ${Math.abs(driftDays)} ${Math.abs(driftDays) === 1 ? 'dag' : 'dagar'} tidigare`}
                        </span>
                      </p>
                    )}
                    {detail.technician && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="w-5 h-5 rounded-full bg-slate-700 grid place-items-center text-[9px] font-semibold text-slate-300 shrink-0">
                          {initials(detail.technician)}
                        </span>
                        <span className="text-xs text-slate-300">{detail.technician}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Etablering: vad som placerades ut, var */}
            {category === 'establishment' && placements.length > 0 && (
              <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  Utplacerad utrustning
                  <span className="ml-auto font-normal text-slate-500 tabular-nums">
                    {placements.length} st
                  </span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(
                    placements.reduce<Record<string, number>>((acc, p) => {
                      // Legacy: samma typ finns med både versal och gemen
                      const t = (p.equipment_type ?? 'Okänd').toLowerCase()
                      const label = t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')
                      acc[label] = (acc[label] ?? 0) + 1
                      return acc
                    }, {})
                  ).map(([type, count]) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      {type}
                      <span className="font-mono text-slate-400 tabular-nums">{count}</span>
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 mt-2">
                  Kopplat via kund och utplaceringsdatum — utrustning saknar direkt ärendekoppling.
                </p>
              </section>
            )}

            <Section title="Kontakt & plats">
              <Row label="Kontaktperson" value={detail.contactPerson} />
              {detail.contactEmail && (
                <div className="flex gap-3 text-sm">
                  <dt className="w-[104px] shrink-0 text-xs text-slate-500 pt-1">E-post</dt>
                  <dd className="min-w-0">
                    <ContactLink
                      icon={Mail}
                      label="E-post"
                      href={`mailto:${detail.contactEmail}`}
                      value={detail.contactEmail}
                    />
                  </dd>
                </div>
              )}
              {detail.contactPhone && (
                <div className="flex gap-3 text-sm">
                  <dt className="w-[104px] shrink-0 text-xs text-slate-500 pt-1">Telefon</dt>
                  <dd className="min-w-0">
                    <ContactLink
                      icon={Phone}
                      label="Telefon"
                      href={telHref(detail.contactPhone)}
                      value={detail.contactPhone}
                    />
                  </dd>
                </div>
              )}
              {detail.address.formatted && !looksLikeJson(detail.address.formatted) && (
                <div className="flex gap-3 text-sm">
                  <dt className="w-[104px] shrink-0 text-xs text-slate-500 pt-1">Adress</dt>
                  <dd className="min-w-0">
                    <ContactLink
                      icon={MapPin}
                      label="Adress"
                      href={
                        detail.address.lat != null && detail.address.lng != null
                          ? `https://www.google.com/maps/search/?api=1&query=${detail.address.lat},${detail.address.lng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.address.formatted)}`
                      }
                      value={detail.address.formatted}
                    />
                  </dd>
                </div>
              )}
            </Section>

            {(detail.description || detail.workReport || detail.recommendations) && (
              <Section title="Utförande">
                {detail.description && <Prose label="Beskrivning" text={detail.description} />}
                {detail.workReport && <Prose label="Arbetsrapport" text={detail.workReport} />}
                {detail.recommendations && <Prose label="Rekommendationer" text={detail.recommendations} />}
              </Section>
            )}

            {/* Ekonomi visas bara när det FINNS ett pris. cases.price och
                material_cost är NULL på hela databasen — en sektion som alltid
                står tom är precis det som gjorde vyn intetsägande. */}
            {detail.price != null && detail.price > 0 && (
              <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-slate-300">Ekonomi</h3>
                  <span className="ml-auto text-[10px] text-slate-500">Belopp ex moms</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-300">Kunden betalar</span>
                  <span className="flex-1 border-b border-dotted border-slate-700 translate-y-1" />
                  <span className="font-mono text-base font-semibold text-[#20c58f] tabular-nums">
                    {formatKr(detail.price)}
                  </span>
                </div>
              </section>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/70">
          <span className="text-[11px] text-slate-600">Läsvy — ärendet redigeras i ärendevyn</span>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <h3 className="text-xs font-semibold text-slate-300 mb-2">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-[104px] shrink-0 text-xs text-slate-500 pt-px">{label}</dt>
      <dd className="text-slate-200 min-w-0 break-words">{value}</dd>
    </div>
  )
}

function Prose({ label, text }: { label: string; text: string }) {
  return (
    <div className="pt-1">
      <dt className="text-xs text-slate-500 mb-1">{label}</dt>
      <dd className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{text}</dd>
    </div>
  )
}
