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

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { formatDateSv, formatKr, type RecordCase } from '../../../../hooks/useCustomerRecord'
import { getCaseKindLabel } from '../../../../constants/caseTypeLabels'
import { caseCategory, sessionLateness, LATENESS_STYLE } from '../../../../utils/caseCategory'
import { RecurringGlyph, ExtraGlyph, EstablishmentGlyph } from './CaseCategoryGlyph'

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
  address: string | null
  technician: string | null
  scheduledStart: string | null
  scheduledEnd: string | null
  completedDate: string | null
  price: number | null
  materialCost: number | null
  workReport: string | null
  recommendations: string | null
}

function readAddress(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  const o = raw as { formatted_address?: string }
  return o.formatted_address ?? null
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
      address: readAddress(row.adress),
      technician: g<string | null>('primary_assignee_name') ?? null,
      scheduledStart: g<string | null>('start_date') ?? null,
      scheduledEnd: g<string | null>('due_date') ?? null,
      completedDate: g<string | null>('completed_date') ?? null,
      price: row.pris != null ? Number(row.pris) : null,
      materialCost: null,
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
    address: readAddress(row.address),
    technician: g<string | null>('primary_technician_name') ?? null,
    scheduledStart: g<string | null>('scheduled_start') ?? null,
    scheduledEnd: g<string | null>('scheduled_end') ?? null,
    completedDate: g<string | null>('completed_date') ?? null,
    price: row.price != null ? Number(row.price) : null,
    materialCost: row.material_cost != null ? Number(row.material_cost) : null,
    workReport: g<string | null>('work_report') ?? null,
    recommendations: g<string | null>('recommendations') ?? null,
  }
}

interface Props {
  caseRow: RecordCase
  onClose: () => void
}

export default function CaseDetailPanel({ caseRow, onClose }: Props) {
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)

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

  const category = caseCategory(caseRow)
  const glyph =
    category === 'recurring' ? (
      <RecurringGlyph size={48} total={4} done={caseRow.completed_date ? 1 : 0} />
    ) : category === 'establishment' ? (
      <EstablishmentGlyph size={48} />
    ) : (
      <ExtraGlyph size={48} />
    )

  const done = !!detail?.completedDate
  const lateness = done ? 'ontime' : sessionLateness(detail?.scheduledStart ?? null, 'scheduled')

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
            <Section title="Tidpunkt">
              <Row label="Planerat" value={detail.scheduledStart ? formatDateSv(detail.scheduledStart) : null} />
              <Row
                label="Tid"
                value={
                  detail.scheduledStart
                    ? `${new Date(detail.scheduledStart).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}${
                        detail.scheduledEnd
                          ? `–${new Date(detail.scheduledEnd).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
                          : ''
                      }`
                    : null
                }
              />
              <Row label="Utfört" value={detail.completedDate ? formatDateSv(detail.completedDate) : null} />
              <Row label="Tekniker" value={detail.technician} />
            </Section>

            <Section title="Kontakt & plats">
              <Row label="Kontaktperson" value={detail.contactPerson} />
              <Row label="E-post" value={detail.contactEmail} />
              <Row label="Telefon" value={detail.contactPhone} />
              <Row label="Adress" value={detail.address} />
            </Section>

            {(detail.description || detail.workReport || detail.recommendations) && (
              <Section title="Utförande">
                {detail.description && <Prose label="Beskrivning" text={detail.description} />}
                {detail.workReport && <Prose label="Arbetsrapport" text={detail.workReport} />}
                {detail.recommendations && <Prose label="Rekommendationer" text={detail.recommendations} />}
              </Section>
            )}

            {(detail.price != null || detail.materialCost != null) && (
              <Section title="Ekonomi">
                <Row
                  label="Pris"
                  value={detail.price != null ? `${formatKr(detail.price)} ex moms` : null}
                />
                <Row
                  label="Materialkostnad"
                  value={detail.materialCost != null ? formatKr(detail.materialCost) : null}
                />
              </Section>
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
