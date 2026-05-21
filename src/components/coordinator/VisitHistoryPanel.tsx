// src/components/coordinator/VisitHistoryPanel.tsx
// Slide-in panel som visar per-besökshistorik för ett serviceärende

import React, { useEffect, useRef, useState } from 'react'
import { X, History, Clock, User, FlaskConical, FileText, Package, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import sv from 'date-fns/locale/sv'

interface Visit {
  id: string
  visit_date: string
  visit_number: number | null
  technician_name: string | null
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
  description: string
  quantity: number
  unit_price: number
  total_price: number
  visit_number: number | null
}

interface VisitHistoryPanelProps {
  caseId: string
  caseTitle: string
  onClose: () => void
}

const pestLevelColors: Record<number, string> = {
  0: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  3: 'bg-red-500/20 text-red-400 border-red-500/30',
  4: 'bg-red-700/20 text-red-300 border-red-700/30',
}

const pestLevelLabels: Record<number, string> = {
  0: 'Ingen aktivitet',
  1: 'Låg',
  2: 'Medel',
  3: 'Hög',
  4: 'Kritisk',
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
      const [visitsRes, billingRes] = await Promise.all([
        supabase
          .from('visits')
          .select('id, visit_date, visit_number, technician_name, work_performed, findings, recommendations, time_spent_minutes, materials_used, pest_level, problem_rating, status')
          .eq('case_id', caseId)
          .order('visit_date', { ascending: false }),
        supabase
          .from('case_billing_items')
          .select('id, description, quantity, unit_price, total_price, visit_number')
          .eq('case_id', caseId)
          .not('visit_number', 'is', null),
      ])

      if (visitsRes.data) setVisits(visitsRes.data)
      if (billingRes.data) setBillingItems(billingRes.data)
      setLoading(false)
    }
    load()
  }, [caseId])

  const getBillingForVisit = (visitNumber: number | null) =>
    visitNumber != null ? billingItems.filter(b => b.visit_number === visitNumber) : []

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
              <h2 className="text-sm font-medium text-slate-100">Besökshistorik</h2>
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
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Inga besök registrerade ännu</p>
              <p className="text-xs mt-1 text-slate-600">Historik skapas vid återbokning</p>
            </div>
          ) : (
            visits.map((visit) => {
              const items = getBillingForVisit(visit.visit_number)
              const visitLabel = visit.visit_number ? `Besök #${visit.visit_number}` : 'Besök'
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
                      {visit.technician_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 rounded-full text-xs text-slate-300">
                          <User className="w-3 h-3" />
                          {visit.technician_name}
                        </span>
                      )}
                      {visit.time_spent_minutes != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 rounded-full text-xs text-slate-300">
                          <Clock className="w-3 h-3" />
                          {formatMinutes(visit.time_spent_minutes)}
                        </span>
                      )}
                      {visit.pest_level != null && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${pestLevelColors[visit.pest_level] ?? pestLevelColors[0]}`}>
                          {pestLevelLabels[visit.pest_level] ?? `Nivå ${visit.pest_level}`}
                        </span>
                      )}
                    </div>

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
                                {item.description}
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
            })
          )}
        </div>
      </div>
    </>
  )
}
