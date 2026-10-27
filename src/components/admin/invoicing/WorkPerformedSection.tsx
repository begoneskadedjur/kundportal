// src/components/admin/invoicing/WorkPerformedSection.tsx
// Rutan "Utfört arbete" i fakturamodalen (ombyggd 2026-10 efter skissen
// utfort-arbete-skiss.html). Samma komponent på dator och i mobilens
// utfällbara "Ärende & Kommunikation".
//
// Innehåll: rutnät med tekniker, utfört, arbetstid och skadedjur; raden
// "Utfört på" som säger om ärendets adress blir leveransadress på fakturan
// (invoiceWorkAddress, samma bedömning som sändningen till Fortnox); nivå och
// problembild som punkt och text; arbetsrapport och specialrapporter som
// klickbara rader som öppnar läspanelen (CaseReportsPanel); preparat och bilder.
//
// visit = besökssnapshotet fakturan avser (useInvoiceVisit). När ett återbesök
// bokats är ärendets egna fält nollställda och scheduled_start flyttad till
// NÄSTA besök, så snapshotet går före caseContext. caseContext är fallback.

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../icons/Icon'
import CaseModalSection from '../../shared/CaseModalSection'
import CaseContextImagePreview from '../../communication/CaseContextImagePreview'
import type { CaseContext } from '../../../hooks/useCaseContext'
import type { VisitSnapshot } from '../../../hooks/useInvoiceVisit'
import type { CaseReports } from '../../../hooks/useCaseReports'
import type { CasePreparationWithDetails } from '../../../types/casePreparations'
import { formatSwedishDateTime } from '../../../types/database'
import { formatVisitTechnicians } from '../../../services/visitService'
import { invoiceWorkAddress, withoutCountry } from '../../../shared/invoiceWorkAddress'
import CaseReportsPanel, { type CaseReportsTab } from './CaseReportsPanel'
import {
  DOT_CLASS,
  firstLine,
  formatTimeSpent,
  pestIcon,
  pestLevelColors,
  pestLevelLabels,
  problemRatingColors,
  problemRatingLabels,
  specialReportStatus,
  type ReportEntry,
} from './workPerformedUtils'

interface WorkPerformedSectionProps {
  /** Fakturans ärende; utan ärende visas inte raden Utfört på */
  caseId: string | null
  /** BE-numret, rubrik i läspanelen */
  caseNumber: string | null
  caseContext: CaseContext | null
  visit?: VisitSnapshot | null
  preparations: CasePreparationWithDetails[]
  reports: CaseReports
  /** Fakturaadressen och kundnamnet, för jämförelsen i Utfört på */
  billingAddress: string | null
  customerName: string | null
  /** Ärendet hämtas: visa laddningsläget */
  loading: boolean
}

export default function WorkPerformedSection(props: WorkPerformedSectionProps) {
  const { visit, reports, loading } = props
  const visitNumber = visit?.visit_number ?? null
  const total = Math.max(reports.visitCount, visitNumber ?? 0)
  const besok = visitNumber != null ? (total > 1 ? `Besök ${visitNumber} av ${total}` : `Besök ${visitNumber}`) : null

  return (
    <CaseModalSection
      iconNode={<Icon name="falt.rapport" size={16} />}
      iconClassName="text-[#20c58f]"
      title="Utfört arbete"
      actions={besok ? <span className="text-xs tabular-nums text-slate-500">{besok}</span> : undefined}
    >
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 py-2.5 text-sm text-slate-500">
          <Icon name="allman.laddar" size={16} className="animate-spin text-[#20c58f]" />
          Hämtar ärendet
        </div>
      ) : (
        <WorkPerformedBody {...props} />
      )}
    </CaseModalSection>
  )
}

function WorkPerformedBody({
  caseId,
  caseNumber,
  caseContext,
  visit,
  preparations,
  reports,
  billingAddress,
  customerName,
}: WorkPerformedSectionProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<CaseReportsTab>('rapport')

  // Rapporten för besöket fakturan avser (som förut: snapshot före ärendet)
  const report = (visit?.work_performed || caseContext?.rapport || '').trim() || null

  // Alla besökens rapporter för läspanelen, nyast först
  const entries: ReportEntry[] = reports.visits
    .filter(v => v.work_performed?.trim())
    .map(v => ({
      key: v.id,
      label: v.visit_number != null ? `Besök ${v.visit_number}` : 'Besök',
      date: v.visit_date,
      technicians: formatVisitTechnicians(v.technicians, v.technician_name),
      text: (v.work_performed ?? '').trim(),
    }))
  // Ärendets egen rapport (inte snapshotad än) läggs först om den saknas i listan
  if (report && !entries.some(e => e.text === report)) {
    entries.unshift({
      key: 'arende',
      label: visit?.visit_number != null ? `Besök ${visit.visit_number}` : 'Aktuell rapport',
      date: visit?.visit_date || caseContext?.startDate || null,
      technicians:
        formatVisitTechnicians(visit?.technicians, visit?.technician_name) || caseContext?.primaryAssigneeName || null,
      text: report,
    })
  }
  const recommendations =
    visit?.recommendations?.trim() ||
    reports.visits.map(v => v.recommendations?.trim()).find(Boolean) ||
    null
  const hasWorkReport = entries.length > 0 || !!recommendations
  const specialReports = reports.specialReports

  const open = (tab: CaseReportsTab) => {
    setPanelTab(tab)
    setPanelOpen(true)
  }

  if (!caseContext && !visit && !hasWorkReport && specialReports.length === 0) {
    return <EmptyRow />
  }

  // Besöket kan ha utförts av flera tekniker: hela laget kommaseparerat.
  // Saknas listan (äldre besök) gäller primärteknikern som förr.
  const technicianName =
    formatVisitTechnicians(visit?.technicians, visit?.technician_name) ||
    caseContext?.primaryAssigneeName ||
    null
  const performedAt = visit?.visit_date || caseContext?.startDate || null
  // Besökets tid vinner, men 0 minuter betyder "inte registrerad": fall då
  // tillbaka på ärendets värde i stället för att dölja en tid som finns
  const timeSpentMinutes = (visit?.time_spent_minutes || null) ?? caseContext?.timeSpentMinutes ?? null
  const timeSpent = formatTimeSpent(timeSpentMinutes)
  const pestType = caseContext?.pestType || null

  const pestLevel = visit?.pest_level ?? null
  const problemRating = visit?.problem_rating ?? null

  const meta: Array<{ icon: IconName; label: string; value: string }> = []
  if (technicianName) meta.push({ icon: 'sok.tekniker', label: 'Tekniker', value: technicianName })
  if (performedAt) meta.push({ icon: 'allman.kalender', label: 'Utfört', value: formatSwedishDateTime(performedAt) })
  if (timeSpent) meta.push({ icon: 'allman.klocka', label: 'Arbetstid', value: timeSpent })
  if (pestType) meta.push({ icon: pestIcon(pestType), label: 'Skadedjur', value: pestType })

  const work = caseId
    ? invoiceWorkAddress({ workAddress: caseContext?.address, billingAddress, name: customerName })
    : null

  const reportExcerpt = firstLine(report) || firstLine(entries[0]?.text) || (recommendations ? 'Rekommendationer från teknikern' : '')

  return (
    <div className="space-y-3">
      {/* Tekniker, utfört, arbetstid, skadedjur */}
      {meta.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-x-4 gap-y-2.5">
          {meta.map(m => (
            <div key={m.label} className="min-w-0 space-y-0.5">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Icon name={m.icon} size={16} className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                {m.label}
              </span>
              <span className="block break-words text-sm tabular-nums text-slate-200">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Utfört på: blir ärendets adress leveransadress på fakturan? */}
      {work && (
        <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2.5">
          <Icon name="rapport.adress" size={16} className="row-span-2 mt-0.5 text-[#20c58f]" />
          <span className="text-[11px] text-slate-500">Utfört på</span>
          <span className="col-start-2 break-words text-sm font-medium text-slate-100">
            {work.text ? withoutCountry(work.text) : 'Ingen adress angiven'}
          </span>
          <div className="col-start-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-400">
            {work.status === 'leverans' && (
              <>
                <StatusDot tone="gron">Blir leveransadress på fakturan</StatusDot>
                {billingAddress && (
                  <span className="text-slate-500">Fakturaadress: {withoutCountry(billingAddress)}</span>
                )}
              </>
            )}
            {work.status === 'samma' && <StatusDot tone="gra">Samma som fakturaadressen</StatusDot>}
            {work.status === 'saknas' && <StatusDot tone="gul">Ingen adress på ärendet</StatusDot>}
          </div>
        </div>
      )}

      {/* Skadedjursnivå och problembild från besöket, punkt och text */}
      {(pestLevel != null || problemRating != null) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
          {pestLevel != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="falt.bedomning" size={16} className="h-3.5 w-3.5 text-slate-400" />
              Skadedjursnivå:
              <span className={`inline-flex items-center gap-1.5 tabular-nums ${pestLevelColors[pestLevel] ?? 'text-slate-300'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="text-slate-200">{pestLevel} · {pestLevelLabels[pestLevel] ?? `Nivå ${pestLevel}`}</span>
              </span>
            </span>
          )}
          {problemRating != null && (
            <span className="inline-flex items-center gap-1.5">
              {pestLevel == null && <Icon name="falt.bedomning" size={16} className="h-3.5 w-3.5 text-slate-400" />}
              Problembild:
              <span className={`inline-flex items-center gap-1.5 tabular-nums ${problemRatingColors[problemRating] ?? 'text-slate-300'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="text-slate-200">{problemRating} · {problemRatingLabels[problemRating] ?? `Nivå ${problemRating}`}</span>
              </span>
            </span>
          )}
        </div>
      )}

      {/* Arbetsrapport och specialrapporter: klick öppnar läspanelen */}
      <div className="divide-y divide-slate-700/50 overflow-hidden rounded-lg border border-slate-700/50">
        {hasWorkReport ? (
          <ReadRow
            icon="falt.rapport"
            title="Arbetsrapport"
            meta={entries.length > 0 ? `${entries.length} besök` : null}
            excerpt={reportExcerpt}
            go="Läs"
            onClick={() => open('rapport')}
          />
        ) : (
          <EmptyRow inGroup />
        )}
        {specialReports.map(r => {
          const status = specialReportStatus(r)
          return (
            <ReadRow
              key={r.id}
              icon="falt.specialrapport"
              accent
              title={`Specialrapport: ${r.title}`}
              excerpt={<StatusDot tone={status.tone}>{status.text}</StatusDot>}
              go="Visa"
              onClick={() => open(r.id)}
            />
          )
        })}
        {reports.specialError && (
          <p className="px-3 py-2 text-xs text-slate-500">{reports.specialError}</p>
        )}
      </div>

      {/* Använda preparat */}
      {preparations.length > 0 && (
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Icon name="falt.preparat" size={16} className="h-3.5 w-3.5 text-slate-400" />
            Använda preparat
          </span>
          <div className="divide-y divide-slate-700/50 border-t border-slate-700/50">
            {preparations.map(p => {
              // Typen finns i preparations-raden men inte i typdefinitionen
              const typ = (p.preparation as { type?: string | null } | undefined)?.type
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 text-slate-200">
                    {p.preparation?.name || 'Okänt preparat'}
                    {typ && <span className="ml-1.5 text-xs text-slate-500">{typ}</span>}
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-slate-400">{p.quantity} {p.unit}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bilder */}
      {caseContext && (
        <CaseContextImagePreview
          caseId={caseContext.id}
          caseType={caseContext.caseType}
          maxThumbnails={4}
        />
      )}

      <CaseReportsPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        tab={panelTab}
        onTabChange={setPanelTab}
        caseNumber={caseNumber}
        entries={entries}
        recommendations={recommendations}
        hasWorkReport={hasWorkReport}
        specialReports={specialReports}
      />
    </div>
  )
}

function StatusDot({ tone, children }: { tone: keyof typeof DOT_CLASS; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASS[tone]}`} />
      <span className="truncate">{children}</span>
    </span>
  )
}

function EmptyRow({ inGroup = false }: { inGroup?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500 ${
        inGroup ? '' : 'rounded-lg border border-dashed border-slate-700'
      }`}
    >
      <Icon name="falt.rapport" size={16} className="text-slate-500" />
      Ingen arbetsrapport ännu
    </div>
  )
}

function ReadRow({
  icon,
  accent = false,
  title,
  meta = null,
  excerpt,
  go,
  onClick,
}: {
  icon: IconName
  accent?: boolean
  title: string
  meta?: string | null
  excerpt: ReactNode
  go: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
    >
      <span
        className={`grid h-[30px] w-[30px] place-items-center rounded-lg ${
          accent ? 'bg-[#20c58f]/10 text-[#20c58f]' : 'bg-slate-900/60 text-slate-400'
        }`}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="grid min-w-0">
        <span className="truncate text-sm font-medium text-slate-100">
          {title}
          {meta && <span className="font-normal text-slate-500"> · {meta}</span>}
        </span>
        <span className="truncate text-xs text-slate-400">{excerpt}</span>
      </span>
      <span className="text-xs font-medium text-[#20c58f]">{go}</span>
    </button>
  )
}
