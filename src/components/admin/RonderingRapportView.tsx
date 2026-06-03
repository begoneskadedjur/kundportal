// src/components/admin/RonderingRapportView.tsx
// Rik rapport-vy för Rondering Trafikkontoret — avvikelser, beteåtgång-trender, högriskstationer

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RonderingService, RonderingAnnotation, ANNOTATION_CATEGORIES, RonderingAnnotationCategory } from '../../services/ronderingService'
import { X, Map, ChevronRight, ChevronDown, AlertTriangle, MapPin, Calendar, User, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

export type StatusFilter = 'all' | 'active' | 'closed'

interface RonderingRapportViewProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  organizationName: string
  mode?: 'modal' | 'page'
  statusFilter?: StatusFilter
}

interface BaitSummary {
  all: number
  partial: number
  none: number
  nullCount: number
}

interface RonderingCase {
  id: string
  case_number: string | null
  title: string
  customer_id: string
  customer_name: string | null
  scheduled_start: string | null
  status: string
  primary_technician_name: string | null
  inspected: number
  total: number
  actionRequired: number
  missing: number
  baitSummary: BaitSummary
  annotations: RonderingAnnotation[]
}

interface HighRiskStation {
  station_id: string
  serial_number: string | null
  allCount: number
  lastInspected: string | null
}

interface ExpandedDetail {
  logs: any[]
  loaded: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy', { locale: sv }) } catch { return iso }
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM HH:mm', { locale: sv }) } catch { return iso }
}

const BAIT_LABEL: Record<'all' | 'partial' | 'none', string> = {
  all: 'Allt',
  partial: 'Delvis',
  none: 'Inget',
}

export default function RonderingRapportView({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  mode = 'modal',
  statusFilter = 'all',
}: RonderingRapportViewProps) {
  const [cases, setCases] = useState<RonderingCase[]>([])
  const [highRiskStations, setHighRiskStations] = useState<HighRiskStation[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<Record<string, ExpandedDetail>>({})
  // station_id → serial_number lookup
  const [serialMap, setSerialMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mode === 'modal' && !isOpen) return
    if (!organizationId) return

    const load = async () => {
      setLoading(true)
      setCases([])
      setHighRiskStations([])
      setExpandedCase(null)
      setExpandedDetails({})

      try {
        // 1. Hämta region-kunder
        const { data: sites } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('organization_id', organizationId)
          .eq('site_type', 'enhet')
          .eq('is_multisite', true)

        const siteIds = (sites || []).map(s => s.id)
        const siteNameMap = Object.fromEntries((sites || []).map(s => [s.id, s.company_name]))
        if (siteIds.length === 0) return

        // 2. Hämta ärenden med statusfilter
        let query = supabase
          .from('cases')
          .select('id, case_number, title, customer_id, scheduled_start, status, primary_technician_name')
          .eq('service_type', 'rondering_trafikkontoret')
          .in('customer_id', siteIds)
          .order('scheduled_start', { ascending: false })

        if (statusFilter === 'closed') query = query.ilike('status', '%avslutat%')
        else if (statusFilter === 'active') query = query.not('status', 'ilike', '%avslutat%')

        const { data: rawCases } = await query
        if (!rawCases || rawCases.length === 0) return

        // 3. Stationsantal per region
        const { data: placements } = await supabase
          .from('equipment_placements')
          .select('id, customer_id, serial_number')
          .in('customer_id', siteIds)
          .eq('status', 'active')

        const stationCountMap: Record<string, number> = {}
        const newSerialMap: Record<string, string> = {}
        for (const p of placements || []) {
          stationCountMap[p.customer_id] = (stationCountMap[p.customer_id] || 0) + 1
          if (p.serial_number) newSerialMap[p.id] = p.serial_number
        }
        setSerialMap(newSerialMap)

        // 4. Hämta logs + annotationer per ärende
        const enriched: RonderingCase[] = await Promise.all(
          rawCases.map(async (c) => {
            const [logs, annotations] = await Promise.all([
              RonderingService.getLogsForCase(c.id),
              RonderingService.getAnnotationsForCase(c.id),
            ])
            const baitSummary: BaitSummary = {
              all: logs.filter(l => l.bait_consumed === 'all').length,
              partial: logs.filter(l => l.bait_consumed === 'partial').length,
              none: logs.filter(l => l.bait_consumed === 'none').length,
              nullCount: logs.filter(l => l.bait_consumed === null).length,
            }
            return {
              id: c.id,
              case_number: c.case_number,
              title: c.title,
              customer_id: c.customer_id,
              customer_name: siteNameMap[c.customer_id] || null,
              scheduled_start: c.scheduled_start,
              status: c.status,
              primary_technician_name: c.primary_technician_name,
              inspected: logs.length,
              total: stationCountMap[c.customer_id] || 0,
              actionRequired: logs.filter(l => l.status === 'action_required').length,
              missing: logs.filter(l => l.status === 'missing').length,
              baitSummary,
              annotations,
            }
          })
        )
        setCases(enriched)

        // 5. Högriskstationer — stationer med 'all' beteåtgång vid 2+ tillfällen
        const allCaseIds = rawCases.map(c => c.id)
        const { data: allLogs } = await supabase
          .from('rondering_station_logs')
          .select('station_id, bait_consumed, inspected_at')
          .in('case_id', allCaseIds)
          .eq('bait_consumed', 'all')

        const stationAllCount: Record<string, { count: number; lastInspected: string | null }> = {}
        for (const log of allLogs || []) {
          const existing = stationAllCount[log.station_id]
          if (!existing) {
            stationAllCount[log.station_id] = { count: 1, lastInspected: log.inspected_at }
          } else {
            existing.count++
            if (!existing.lastInspected || log.inspected_at > existing.lastInspected) {
              existing.lastInspected = log.inspected_at
            }
          }
        }

        const highRisk: HighRiskStation[] = Object.entries(stationAllCount)
          .filter(([, v]) => v.count >= 2)
          .map(([station_id, v]) => ({
            station_id,
            serial_number: newSerialMap[station_id] || null,
            allCount: v.count,
            lastInspected: v.lastInspected,
          }))
          .sort((a, b) => b.allCount - a.allCount)

        setHighRiskStations(highRisk)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, organizationId, mode, statusFilter])

  const toggleCase = async (caseId: string) => {
    if (expandedCase === caseId) { setExpandedCase(null); return }
    setExpandedCase(caseId)
    if (!expandedDetails[caseId]?.loaded) {
      const logs = await RonderingService.getLogsForCase(caseId)
      setExpandedDetails(prev => ({ ...prev, [caseId]: { logs, loaded: true } }))
    }
  }

  if (mode === 'modal' && !isOpen) return null

  const content = (
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="py-16 text-center text-slate-400">Laddar ronderingshistorik...</div>
      ) : cases.length === 0 ? (
        <div className="py-16 text-center">
          <Map className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Inga rondering-ärenden{statusFilter !== 'all' ? ' med valt filter' : ''}</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">

          {/* ── Högriskstationer ── */}
          {highRiskStations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Högriskstationer — hög beteåtgång vid flera tillfällen</h3>
              </div>
              <div className="space-y-1">
                {highRiskStations.map(s => (
                  <div key={s.station_id} className="flex items-center gap-3 px-3 py-2 bg-amber-500/10 rounded-lg text-xs">
                    <span className="font-mono text-amber-200 w-20 flex-shrink-0">{s.serial_number || s.station_id.slice(0, 8)}</span>
                    <span className="text-amber-300 font-medium">{s.allCount}× Allt förbrukat</span>
                    <span className="ml-auto text-amber-500">{formatDate(s.lastInspected)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ärendelista ── */}
          {cases.map(c => {
            const pct = c.total > 0 ? Math.round((c.inspected / c.total) * 100) : 0
            const isExpanded = expandedCase === c.id
            const logs = expandedDetails[c.id]?.logs || []
            const bait = c.baitSummary
            const baitTotal = bait.all + bait.partial + bait.none

            return (
              <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {/* Kollapsad rad */}
                <button
                  type="button"
                  onClick={() => toggleCase(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/80 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-sky-300">{c.customer_name}</span>
                      <span className="text-xs text-slate-500 font-mono">{c.case_number || c.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(c.scheduled_start)}</span>
                      {c.primary_technician_name && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.primary_technician_name}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        c.status.toLowerCase().includes('avslutat') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                      }`}>{c.status}</span>
                      {c.annotations.length > 0 && (
                        <span className="text-orange-400 text-[10px]">⚠ {c.annotations.length} avvik.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {c.actionRequired > 0 && (
                      <span className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{c.actionRequired}</span>
                    )}
                    {c.missing > 0 && (
                      <span className="text-xs text-red-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.missing}</span>
                    )}
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${pct === 100 ? 'text-emerald-400' : 'text-slate-300'}`}>{pct}%</span>
                      <p className="text-[10px] text-slate-500">{c.inspected}/{c.total}</p>
                    </div>
                  </div>
                </button>

                {/* Progress bar */}
                <div className="h-1 bg-slate-700 mx-4 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.actionRequired > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Expanderat innehåll */}
                {isExpanded && (
                  <div className="border-t border-slate-700 mt-1">

                    {/* Beteåtgång-aggregat */}
                    {baitTotal > 0 && (
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Beteåtgång</p>
                        <div className="flex items-center gap-2 mb-1.5">
                          {bait.all > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-[11px] text-red-300">
                              Allt: {bait.all}
                            </span>
                          )}
                          {bait.partial > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[11px] text-amber-300">
                              Delvis: {bait.partial}
                            </span>
                          )}
                          {bait.none > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/20 border border-slate-500/30 text-[11px] text-slate-400">
                              Inget: {bait.none}
                            </span>
                          )}
                        </div>
                        {/* Stapeldiagram */}
                        <div className="flex h-2 rounded-full overflow-hidden bg-slate-700 gap-px">
                          {bait.all > 0 && <div className="bg-red-500" style={{ width: `${(bait.all / baitTotal) * 100}%` }} />}
                          {bait.partial > 0 && <div className="bg-amber-500" style={{ width: `${(bait.partial / baitTotal) * 100}%` }} />}
                          {bait.none > 0 && <div className="bg-slate-500" style={{ width: `${(bait.none / baitTotal) * 100}%` }} />}
                        </div>
                      </div>
                    )}

                    {/* Stationslista */}
                    <div className="px-4 pb-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">
                        Stationer ({logs.length}/{c.total})
                      </p>
                      {logs.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-2">Inga avbockade stationer</p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {logs.map((log: any) => (
                            <div key={log.id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/60 text-xs">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                log.status === 'ok' ? 'bg-emerald-400' :
                                log.status === 'action_required' ? 'bg-amber-400' : 'bg-red-400'
                              }`} />
                              <span className="font-mono text-slate-300 w-16 flex-shrink-0">
                                {serialMap[log.station_id] || log.station_id?.slice(0, 8)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] flex-shrink-0 ${
                                log.status === 'ok' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
                                log.status === 'action_required' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                                'bg-red-500/20 border-red-500/30 text-red-300'
                              }`}>
                                {log.status === 'ok' ? 'OK' : log.status === 'action_required' ? 'Åtgärd' : 'Saknas'}
                              </span>
                              {log.bait_consumed && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${
                                  log.bait_consumed === 'all' ? 'text-red-300' :
                                  log.bait_consumed === 'partial' ? 'text-amber-300' : 'text-slate-500'
                                }`}>{BAIT_LABEL[log.bait_consumed as 'all' | 'partial' | 'none']}</span>
                              )}
                              {log.note && <span className="text-slate-500 truncate">{log.note}</span>}
                              <span className="ml-auto text-slate-600 whitespace-nowrap text-[10px]">
                                {log.technician_name?.split(' ')[0]} · {formatDate(log.inspected_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Avvikelser */}
                    {c.annotations.length > 0 && (
                      <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Avvikelser ({c.annotations.length})
                        </p>
                        <div className="space-y-2">
                          {c.annotations.map(ann => {
                            const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
                            return (
                              <div key={ann.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs">
                                <span className="text-base leading-none mt-0.5">{cat.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-orange-200">{cat.label}</p>
                                  {ann.note && <p className="text-slate-400 mt-0.5">{ann.note}</p>}
                                  <p className="text-slate-600 text-[10px] mt-0.5">
                                    {ann.technician_name} · {formatDateTime(ann.created_at)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  if (mode === 'page') return content

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-semibold text-white">Rondering Trafikkontoret</h2>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{organizationName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}
