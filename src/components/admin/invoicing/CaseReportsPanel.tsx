// src/components/admin/invoicing/CaseReportsPanel.tsx
// Läspanelen för ärendets rapporter i fakturamodalen (2026-10). Glider in från
// höger över fakturamodalen, egen portal till document.body. Flikar:
// Arbetsrapport (alla besök, nyast först, därefter Rekommendationer) och en
// flik per specialrapport (sidorna som kunden ser dem, read-only, med
// helskärm och nedladdning). Escape och klick utanför stänger.
// Inga kort, inga piller, bara portalens egna ikoner.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Icon } from '../../icons/Icon'
import { supabase } from '../../../lib/supabase'
import { SpecialReportService } from '../../../services/specialReportService'
import type { SpecialReportFull, SpecialReportListItem } from '../../../types/specialReport'
import { formatSwedishDateTime } from '../../../types/database'
import { RapportSida, SIDA_B, SkaladSida, useRapportSidor } from '../../shared/specialReports/rapportSidor'
import HelaPdfModal from '../../shared/specialReports/HelaPdfModal'
import { laddaNed, rapportStatus } from '../../shared/specialReports/specialReportUtils'
import { DOT_CLASS, specialReportFilename, specialReportStatus, type ReportEntry } from './workPerformedUtils'

/** 'rapport' eller en specialrapports id */
export type CaseReportsTab = string

interface CaseReportsPanelProps {
  isOpen: boolean
  onClose: () => void
  tab: CaseReportsTab
  onTabChange: (tab: CaseReportsTab) => void
  caseNumber: string | null
  entries: ReportEntry[]
  recommendations: string | null
  /** Arbetsrapportfliken visas bara när det finns något att läsa */
  hasWorkReport: boolean
  specialReports: SpecialReportListItem[]
}

export default function CaseReportsPanel(props: CaseReportsPanelProps) {
  if (!props.isOpen) return null
  return createPortal(<Panel {...props} />, document.body)
}

function Panel({
  onClose,
  tab,
  onTabChange,
  caseNumber,
  entries,
  recommendations,
  hasWorkReport,
  specialReports,
}: CaseReportsPanelProps) {
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLElement>(null)
  const stangRef = useRef<HTMLButtonElement>(null)
  // Helskärmen hanterar själv Escape; då ska panelen inte stängas samtidigt
  const [helaOpen, setHelaOpen] = useState(false)

  const tabs: Array<{ id: string; label: string }> = [
    ...(hasWorkReport ? [{ id: 'rapport', label: 'Arbetsrapport' }] : []),
    ...specialReports.map((r, i) => ({
      id: r.id,
      label: specialReports.length > 1 ? `Specialrapport ${i + 1}` : 'Specialrapport',
    })),
  ]
  const activeTab = tabs.some(t => t.id === tab) ? tab : tabs[0]?.id ?? 'rapport'
  const activeSpecial = specialReports.find(r => r.id === activeTab) ?? null

  // Fokus på Stäng när panelen öppnas, tillbaka till knappen som öppnade den
  useEffect(() => {
    const tidigare = document.activeElement as HTMLElement | null
    stangRef.current?.focus()
    return () => {
      if (tidigare?.isConnected) tidigare.focus()
    }
  }, [])

  // Escape stänger, Tab stannar i panelen
  useEffect(() => {
    const tangent = (e: KeyboardEvent) => {
      if (helaOpen) return
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key === 'Tab') {
        const fokuserbara = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
          .filter(el => el.offsetParent !== null)
        if (fokuserbara.length === 0) return
        const forsta = fokuserbara[0]
        const sista = fokuserbara[fokuserbara.length - 1]
        const aktiv = document.activeElement as HTMLElement | null
        const inne = !!aktiv && !!panelRef.current?.contains(aktiv)
        if (e.shiftKey && (!inne || aktiv === forsta)) { e.preventDefault(); sista.focus() }
        else if (!e.shiftKey && (!inne || aktiv === sista)) { e.preventDefault(); forsta.focus() }
      }
    }
    document.addEventListener('keydown', tangent)
    return () => document.removeEventListener('keydown', tangent)
  }, [onClose, helaOpen])

  const titel = `${caseNumber ?? 'Ärendet'} · Rapporter`

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-slate-950/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        initial={reduceMotion ? false : { x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
        className="flex h-full w-full max-w-[560px] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Huvud */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
            <Icon name="falt.rapport" size={20} className="flex-shrink-0 text-[#20c58f]" />
            <span className="truncate">{titel}</span>
          </h2>
          <button
            ref={stangRef}
            type="button"
            aria-label="Stäng"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
          >
            <Icon name="allman.stang" size={20} />
          </button>
        </div>

        {/* Flikar */}
        {tabs.length > 1 && (
          <div role="tablist" className="flex flex-shrink-0 gap-5 overflow-x-auto border-b border-slate-700 px-4">
            {tabs.map(t => {
              const vald = t.id === activeTab
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={vald}
                  onClick={() => onTabChange(t.id)}
                  className={`whitespace-nowrap border-b-2 py-2.5 text-[13px] focus:outline-none focus-visible:text-white ${
                    vald ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        )}

        {activeSpecial ? (
          <SpecialReportTab
            key={activeSpecial.id}
            item={activeSpecial}
            helaOpen={helaOpen}
            onHelaOpenChange={setHelaOpen}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {entries.length === 0 && !recommendations && (
              <p className="text-sm text-slate-500">Ingen arbetsrapport ännu</p>
            )}
            {entries.map(e => (
              <section key={e.key} className="space-y-1.5">
                <h3 className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs font-medium text-slate-500">
                  <span className="font-semibold text-slate-100">{e.label}</span>
                  {e.date && <span className="tabular-nums">{formatSwedishDateTime(e.date)}</span>}
                  {e.technicians && <span>{e.technicians}</span>}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{e.text}</p>
              </section>
            ))}
            {recommendations && (
              <section className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                  <Icon name="lead.tips" size={16} className="h-3.5 w-3.5 text-slate-400" />
                  Rekommendationer
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{recommendations}</p>
              </section>
            )}
          </div>
        )}
      </motion.aside>
    </div>
  )
}

// ── Specialrapport ──

function SpecialReportTab({
  item,
  helaOpen,
  onHelaOpenChange,
}: {
  item: SpecialReportListItem
  helaOpen: boolean
  onHelaOpenChange: (open: boolean) => void
}) {
  const [report, setReport] = useState<SpecialReportFull | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [author, setAuthor] = useState<string | null>(null)
  const [hamtarPdf, setHamtarPdf] = useState(false)
  const status = specialReportStatus(item)

  useEffect(() => {
    let cancelled = false
    setReport(null)
    setError(null)
    setAuthor(null)
    SpecialReportService.get(item.id)
      .then(async full => {
        if (cancelled) return
        setReport(full)
        if (!full.created_by) return
        const { data } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('user_id', full.created_by)
          .maybeSingle()
        const p = data as { display_name: string | null; email: string | null } | null
        const namn = p?.display_name?.trim() || p?.email?.trim() || null
        if (!cancelled) setAuthor(namn)
      })
      .catch(err => {
        console.error('[CaseReportsPanel] Specialrapporten kunde inte hämtas:', err)
        if (!cancelled) setError('Specialrapporten kunde inte visas. Du kanske saknar behörighet, eller så gick hämtningen inte fram. Försök igen om en stund.')
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  // Skickad och oförändrad: den låsta PDF:en kunden fick. Annars en ny förhandsversion.
  const laddaNerPdf = async () => {
    if (hamtarPdf) return
    setHamtarPdf(true)
    const t = toast.loading('Tar fram PDF:en…')
    try {
      if (rapportStatus(item) === 'skickad' && item.last_sent_version_id) {
        const url = await SpecialReportService.getVersionPdfUrl(item.last_sent_version_id)
        await laddaNed(url, specialReportFilename(item.title, item.last_sent_version))
      } else {
        const { url, filename } = await SpecialReportService.downloadPdf(item.id)
        await laddaNed(url, filename)
      }
      toast.success('PDF:en är nedladdad', { id: t })
    } catch (e) {
      const text = e instanceof Error && e.message && !/fetch|network/i.test(e.message) ? e.message : null
      toast.error(text ?? 'PDF:en kunde inte tas fram. Försök igen om en stund.', { id: t })
    } finally {
      setHamtarPdf(false)
    }
  }

  const ikonKnapp = 'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-40'

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1 px-4 py-3">
          <p className="text-sm font-medium text-slate-100">{item.title}</p>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASS[status.tone]}`} />
              {status.text}
            </span>
            {author && <span className="text-slate-500">Skriven av {author}</span>}
          </div>
        </div>

        {error ? (
          <p className="mx-4 mb-4 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2.5 text-sm text-slate-400">{error}</p>
        ) : !report ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
            <Icon name="allman.laddar" size={16} className="animate-spin text-slate-400" />
            Hämtar rapporten
          </div>
        ) : (
          <ReportPages report={report} />
        )}
      </div>

      {/* Helskärm och nedladdning */}
      <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-700 px-4 py-2.5">
        <button
          type="button"
          aria-label="Visa i helskärm"
          title="Visa i helskärm"
          disabled={!report}
          onClick={() => onHelaOpenChange(true)}
          className={ikonKnapp}
        >
          <Icon name="allman.helskarm" size={20} />
        </button>
        <button
          type="button"
          aria-label="Ladda ner PDF"
          title="Ladda ner PDF"
          disabled={hamtarPdf || !!error}
          onClick={laddaNerPdf}
          className={ikonKnapp}
        >
          <Icon name={hamtarPdf ? 'allman.laddar' : 'allman.ladda-ner'} size={20} className={hamtarPdf ? 'animate-spin' : undefined} />
        </button>
      </div>

      {report && (
        <HelaPdfModal
          isOpen={helaOpen}
          onClose={() => onHelaOpenChange(false)}
          report={report}
          vy=""
          hamtarPdf={hamtarPdf}
          onLaddaNer={laddaNerPdf}
        />
      )}
    </>
  )
}

/** Rapportens sidor under varandra, som kunden ser dem. Inga klickval. */
function ReportPages({ report }: { report: SpecialReportFull }) {
  const { sidor, logiska, matning } = useRapportSidor(report)
  const rotRef = useRef<HTMLDivElement>(null)
  const [bredd, setBredd] = useState(0)

  useEffect(() => {
    const el = rotRef.current
    if (!el) return
    const satt = () => setBredd(Math.round(el.getBoundingClientRect().width))
    satt()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(satt)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const sidBredd = Math.max(160, Math.min(SIDA_B * 1.25, (bredd || SIDA_B + 32) - 32))

  return (
    <div ref={rotRef} className="relative flex flex-col items-center gap-3.5 bg-slate-950/60 px-4 py-4">
      {matning}
      {sidor.map(s => {
        const logisk = logiska.get(s.logisk)
        if (!logisk) return null
        return (
          <SkaladSida key={s.key} bredd={sidBredd} hojd={s.hojd} style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.22)', borderRadius: 2 }}>
            <RapportSida report={report} sida={s} logisk={logisk} antal={sidor.length} />
          </SkaladSida>
        )
      })}
    </div>
  )
}
