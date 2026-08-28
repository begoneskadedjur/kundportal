// src/components/coordinator/VisitHistoryPanel.tsx
// Slide-in panel med ärendehistorik för serviceärenden: besök, fakturor med
// betalstatus (synkad från Fortnox) och bokningshändelser (återbesök/delfaktura)

import React, { useEffect, useRef, useState } from 'react'
import { X, History, Clock, User, FlaskConical, FileText, Receipt, CalendarClock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import sv from 'date-fns/locale/sv'
import { INVOICE_STATUS_CONFIG } from '../../types/invoice'
import type { InvoiceStatus } from '../../types/invoice'
import CaseContextImagePreview from '../communication/CaseContextImagePreview'
import { formatVisitTechnicians } from '../../services/visitService'

interface CaseInvoice {
  id: string
  invoice_number: string | null
  invoice_type: string | null
  status: string
  total_amount: number
  fortnox_document_number: string | null
  created_at: string
  paid_at: string | null
  /** null = månadsbatchad samlingsfaktura utan direkt ärendekoppling */
  case_id: string | null
}

interface HistoryEvent {
  id: string
  update_type: string
  new_value: string | null
  updated_by_name: string | null
  created_at: string
}

interface Visit {
  id: string
  visit_date: string
  visit_number: number | null
  technician_name: string | null
  /** Besökets samtliga tekniker i rollordning. Tom lista på äldre besök. */
  technicians?: Array<{ id: string | null; name: string; role?: string }> | null
  work_performed: string | null
  findings: string | null
  recommendations: string | null
  time_spent_minutes: number | null
  materials_used: string | null
  pest_level: number | null
  problem_rating: number | null
  status: string | null
}

interface BillingItem {
  id: string
  service_name: string | null
  article_name: string | null
  quantity: number
  unit_price: number
  total_price: number
  visit_number: number | null
  status: string | null
}

interface VisitHistoryPanelProps {
  caseId: string
  caseTitle: string
  onClose: () => void
}

// Färgad text med punkt (inga piller) — samma färgskala som tidigare
const pestLevelColors: Record<number, string> = {
  0: 'text-emerald-400',
  1: 'text-yellow-400',
  2: 'text-orange-400',
  3: 'text-red-400',
  4: 'text-red-300',
}

const pestLevelLabels: Record<number, string> = {
  0: 'Ingen aktivitet',
  1: 'Låg',
  2: 'Medel',
  3: 'Hög',
  4: 'Kritisk',
}

// Problembild 1-5 — samma värdemängd och toner som EditContractCaseModal
// (1-2 grönt, 3 amber, 4-5 rött)
const problemRatingColors: Record<number, string> = {
  1: 'text-emerald-400',
  2: 'text-emerald-400',
  3: 'text-amber-400',
  4: 'text-red-400',
  5: 'text-red-300',
}

const problemRatingLabels: Record<number, string> = {
  1: 'Utmärkt',
  2: 'Bra',
  3: 'OK',
  4: 'Allvarligt',
  5: 'Kritiskt',
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export default function VisitHistoryPanel({ caseId, caseTitle, onClose }: VisitHistoryPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [billingItems, setBillingItems] = useState<BillingItem[]>([])
  const [invoices, setInvoices] = useState<CaseInvoice[]>([])
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [visitsRes, billingRes, invoicesRes, eventsRes, cbItemsRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, visit_date, visit_number, technician_name, technicians, work_performed, findings, recommendations, time_spent_minutes, materials_used, pest_level, problem_rating, status')
          .eq('case_id', caseId)
          .order('visit_date', { ascending: false }),
        // Alla rader hämtas — rader med visit_number visas per besök, fakturerade
        // rader UTAN visit_number visas i gruppen "Fakturerat (ej besökskopplat)"
        supabase
          .from('case_billing_items')
          .select('id, service_name, article_name, quantity, unit_price, total_price, visit_number, status')
          .eq('case_id', caseId),
        supabase
          .from('invoices')
          .select('id, invoice_number, invoice_type, status, total_amount, fortnox_document_number, created_at, paid_at, case_id')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false }),
        supabase
          .from('case_updates_log')
          .select('id, update_type, new_value, updated_by_name, created_at')
          .eq('case_id', caseId)
          .in('update_type', ['revisit_scheduled', 'partial_invoice_created'])
          .order('created_at', { ascending: false }),
        // Underlag för samlingsfaktura-bakvägen nedan
        supabase
          .from('contract_billing_items')
          .select('id')
          .eq('case_id', caseId),
      ])

      if (visitsRes.error) console.error('[VisitHistoryPanel] visits:', visitsRes.error)
      if (billingRes.error) console.error('[VisitHistoryPanel] billing:', billingRes.error)
      if (invoicesRes.error) console.error('[VisitHistoryPanel] invoices:', invoicesRes.error)
      if (eventsRes.error) console.error('[VisitHistoryPanel] events:', eventsRes.error)

      // Månadsbatchade samlingsfakturor saknar case_id och missas av queryn
      // ovan. Bakvägen: contract_billing_items på ärendet → invoice_items
      // (contract_billing_item_id) → distinkta fakturor.
      let allInvoices: CaseInvoice[] = (invoicesRes.data as CaseInvoice[] | null) || []
      const cbIds = ((cbItemsRes.data as { id: string }[] | null) || []).map(r => r.id)
      if (cbIds.length > 0) {
        const { data: invItems } = await supabase
          .from('invoice_items')
          .select('invoice_id')
          .in('contract_billing_item_id', cbIds)
        const known = new Set(allInvoices.map(i => i.id))
        const extraIds = [...new Set(((invItems as { invoice_id: string }[] | null) || []).map(r => r.invoice_id))]
          .filter(id => !known.has(id))
        if (extraIds.length > 0) {
          const { data: extra } = await supabase
            .from('invoices')
            .select('id, invoice_number, invoice_type, status, total_amount, fortnox_document_number, created_at, paid_at, case_id')
            .in('id', extraIds)
          allInvoices = [...allInvoices, ...((extra as CaseInvoice[] | null) || [])]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
        }
      }

      if (visitsRes.data) setVisits(visitsRes.data)
      if (billingRes.data) setBillingItems(billingRes.data)
      setInvoices(allInvoices)
      if (eventsRes.data) setEvents(eventsRes.data)
      setLoading(false)
    }
    load()
  }, [caseId])

  const getBillingForVisit = (visitNumber: number | null) =>
    visitNumber != null ? billingItems.filter(b => b.visit_number === visitNumber) : []

  // Fakturerade rader utan besöksstämpel — får inte försvinna ur historiken.
  // Bara billed/invoiced visas här; pending ska inte se fakturerat ut.
  const unlinkedBilledItems = billingItems.filter(
    b => b.visit_number == null && (b.status === 'billed' || b.status === 'invoiced')
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[100]"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed z-[101] bg-slate-900 shadow-2xl flex flex-col sm:top-0 sm:right-0 sm:h-full sm:w-[420px] sm:border-l sm:border-slate-800 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[85vh] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-slate-700"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-teal-500/15 rounded-md">
              <History className="w-4 h-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-slate-100">Ärendehistorik</h2>
              <p className="text-xs text-slate-500 truncate max-w-[260px]">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-600 border-t-teal-400 rounded-full animate-spin mr-2" />
              <span className="text-sm">Hämtar historik...</span>
            </div>
          ) : visits.length === 0 && invoices.length === 0 && events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Ingen historik ännu</p>
              <p className="text-xs mt-1 text-slate-600">Besök, fakturor och bokningar samlas här</p>
            </div>
          ) : (
            <>
            {/* Fakturor på ärendet — vem/när/vad + betalstatus (synkas från Fortnox) */}
            {invoices.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-[#20c58f]" />
                  <span className="text-sm font-medium text-white">Fakturor ({invoices.length})</span>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {invoices.map(inv => {
                    const cfg = INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus]
                    const isPartial = inv.invoice_type === 'partial' || inv.invoice_type === 'adhoc'
                    return (
                      <div key={inv.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                            {inv.invoice_number || 'Faktura'}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg?.color ?? 'text-slate-400'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {cfg?.label ?? inv.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5 text-xs text-slate-500">
                          <span>
                            {format(new Date(inv.created_at), 'yyyy-MM-dd', { locale: sv })}
                            {inv.case_id == null && ' · samlingsfaktura'}
                            {isPartial && ' · delfaktura'}
                            {inv.fortnox_document_number && ` · Fortnox ${inv.fortnox_document_number}`}
                            {inv.paid_at && ` · betald ${format(new Date(inv.paid_at), 'yyyy-MM-dd', { locale: sv })}`}
                          </span>
                          <span className="text-slate-300 font-medium whitespace-nowrap">
                            {Number(inv.total_amount).toLocaleString('sv-SE')} kr
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Bokningshändelser — återbesök och delfakturor med vem/när */}
            {events.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-sm font-medium text-white">Händelser ({events.length})</span>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {events.map(ev => {
                    let parsed: { scheduled_start?: string; start_date?: string; note?: string; invoice_number?: string; amount?: number } = {}
                    try { parsed = JSON.parse(ev.new_value || '{}') } catch { /* råtext */ }
                    const isPartialEvent = ev.update_type === 'partial_invoice_created'
                    const bookedTo = parsed.scheduled_start || parsed.start_date
                    return (
                      <div key={ev.id} className="px-4 py-2.5 text-xs">
                        <div className="text-slate-200">
                          {isPartialEvent ? (
                            <>Delfaktura {parsed.invoice_number ? <span className="font-mono">{parsed.invoice_number}</span> : ''} skapad
                            {parsed.amount != null && <> · {Number(parsed.amount).toLocaleString('sv-SE')} kr</>}</>
                          ) : (
                            <>Återbesök bokat{bookedTo && <> till {format(new Date(bookedTo), 'd MMM yyyy HH:mm', { locale: sv })}</>}</>
                          )}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {format(new Date(ev.created_at), 'yyyy-MM-dd HH:mm', { locale: sv })}
                          {ev.updated_by_name && ` · av ${ev.updated_by_name}`}
                          {!isPartialEvent && parsed.note && ` · "${parsed.note}"`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {visits.map((visit) => {
              const items = getBillingForVisit(visit.visit_number)
              const visitLabel = visit.visit_number ? `Besök #${visit.visit_number}` : 'Besök'
              // Alla tekniker som var på besöket, inte bara primärteknikern
              const technicianLabel = formatVisitTechnicians(visit.technicians, visit.technician_name)
              return (
                <div
                  key={visit.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden"
                >
                  {/* Visit header */}
                  <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{visitLabel}</span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(visit.visit_date), 'd MMM yyyy HH:mm', { locale: sv })}
                    </span>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Meta row */}
                    <div className="flex flex-wrap gap-2">
                      {technicianLabel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 rounded-full text-xs text-slate-300">
                          <User className="w-3 h-3" />
                          {technicianLabel}
                        </span>
                      )}
                      {visit.time_spent_minutes != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 rounded-full text-xs text-slate-300">
                          <Clock className="w-3 h-3" />
                          {formatMinutes(visit.time_spent_minutes)}
                        </span>
                      )}
                    </div>

                    {/* Trafikljus: skadedjursnivå + problembild med label */}
                    {(visit.pest_level != null || visit.problem_rating != null) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {visit.pest_level != null && (
                          <span>
                            <span className="text-slate-500">Skadedjursnivå: </span>
                            <span className={`inline-flex items-center gap-1.5 font-medium ${pestLevelColors[visit.pest_level] ?? 'text-slate-300'}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {visit.pest_level} · {pestLevelLabels[visit.pest_level] ?? `Nivå ${visit.pest_level}`}
                            </span>
                          </span>
                        )}
                        {visit.problem_rating != null && (
                          <span>
                            <span className="text-slate-500">Problembild: </span>
                            <span className={`inline-flex items-center gap-1.5 font-medium ${problemRatingColors[visit.problem_rating] ?? 'text-slate-300'}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {visit.problem_rating} · {problemRatingLabels[visit.problem_rating] ?? `Nivå ${visit.problem_rating}`}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Work report */}
                    {visit.work_performed && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Arbetsrapport
                        </p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{visit.work_performed}</p>
                      </div>
                    )}

                    {/* Findings */}
                    {visit.findings && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Iakttagelser</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{visit.findings}</p>
                      </div>
                    )}

                    {/* Recommendations */}
                    {visit.recommendations && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rekommendationer</p>
                        <p className="text-sm text-amber-300/80 whitespace-pre-wrap leading-relaxed">{visit.recommendations}</p>
                      </div>
                    )}

                    {/* Materials */}
                    {visit.materials_used && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <FlaskConical className="w-3 h-3" />
                          Preparat
                        </p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{visit.materials_used}</p>
                      </div>
                    )}

                    {/* Billing items */}
                    {items.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Receipt className="w-3 h-3" />
                          Fakturerade artiklar
                        </p>
                        <div className="space-y-1.5">
                          {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 truncate mr-2">
                                {item.service_name || item.article_name}
                                {item.quantity !== 1 && <span className="text-slate-500 ml-1">× {item.quantity}</span>}
                              </span>
                              <span className="text-slate-400 flex-shrink-0">
                                {item.total_price.toLocaleString('sv-SE')} kr
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Förklaring när besökssnapshot saknas trots aktivitet på ärendet */}
            {visits.length === 0 && (invoices.length > 0 || events.length > 0) && (
              <p className="text-xs text-slate-500">
                Besöksdata saknas för tidigare besök — teknikern fyllde inte i rapport innan återbesöket bokades
              </p>
            )}

            {/* Fakturerade rader utan besökskoppling */}
            {invoices.length > 0 && unlinkedBilledItems.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-white">Fakturerat (ej besökskopplat)</span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {unlinkedBilledItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate mr-2">
                        {item.service_name || item.article_name}
                        {item.quantity !== 1 && <span className="text-slate-500 ml-1">× {item.quantity}</span>}
                      </span>
                      <span className="text-slate-400 flex-shrink-0">
                        {item.total_price.toLocaleString('sv-SE')} kr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bilder från ärendet — komponenten döljer sig själv om inga finns */}
            <CaseContextImagePreview caseId={caseId} caseType="contract" compact />
            </>
          )}
        </div>
      </div>
    </>
  )
}
