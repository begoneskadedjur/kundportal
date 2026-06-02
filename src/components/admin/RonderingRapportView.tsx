// src/components/admin/RonderingRapportView.tsx
// Rapport-vy för Rondering Trafikkontoret — visas under Befintliga kunder för regionalkunder

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RonderingService } from '../../services/ronderingService'
import { X, Map, ChevronRight, ChevronDown, CheckSquare, Square, AlertTriangle, MapPin, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface RonderingRapportViewProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string // organization_id som delas av alla region-kunder
  organizationName: string
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
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy', { locale: sv }) } catch { return iso }
}

export default function RonderingRapportView({
  isOpen,
  onClose,
  organizationId,
  organizationName,
}: RonderingRapportViewProps) {
  const [cases, setCases] = useState<RonderingCase[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (!isOpen || !organizationId) return
    const load = async () => {
      setLoading(true)
      try {
        // Hämta alla region-kunder i organisationen
        const { data: sites } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('organization_id', organizationId)
          .eq('site_type', 'enhet')
          .eq('is_multisite', true)

        const siteIds = (sites || []).map(s => s.id)
        const siteNameMap = Object.fromEntries((sites || []).map(s => [s.id, s.company_name]))

        if (siteIds.length === 0) { setCases([]); return }

        // Hämta rondering-ärenden för alla regioner
        const { data: rawCases } = await supabase
          .from('cases')
          .select('id, case_number, title, customer_id, scheduled_start, status, primary_technician_name')
          .eq('service_type', 'rondering_trafikkontoret')
          .in('customer_id', siteIds)
          .order('scheduled_start', { ascending: false })

        if (!rawCases || rawCases.length === 0) { setCases([]); return }

        // Hämta stationsantal per region
        const { data: stationCounts } = await supabase
          .from('equipment_placements')
          .select('customer_id')
          .in('customer_id', siteIds)
          .eq('status', 'active')

        const stationCountMap: Record<string, number> = {}
        for (const row of stationCounts || []) {
          stationCountMap[row.customer_id] = (stationCountMap[row.customer_id] || 0) + 1
        }

        // Hämta logs per ärende
        const enriched: RonderingCase[] = await Promise.all(
          rawCases.map(async (c) => {
            const logs = await RonderingService.getLogsForCase(c.id)
            const total = stationCountMap[c.customer_id] || 0
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
              total,
              actionRequired: logs.filter(l => l.status === 'action_required').length,
              missing: logs.filter(l => l.status === 'missing').length,
            }
          })
        )

        setCases(enriched)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, organizationId])

  const toggleCase = async (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null)
      return
    }
    setExpandedCase(caseId)
    if (!expandedLogs[caseId]) {
      const logs = await RonderingService.getLogsForCase(caseId)
      setExpandedLogs(prev => ({ ...prev, [caseId]: logs }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Laddar ronderingshistorik...</div>
          ) : cases.length === 0 ? (
            <div className="py-12 text-center">
              <Map className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">Inga rondering-ärenden ännu</p>
              <p className="text-sm text-slate-500 mt-1">Skapa ett nytt ärende av typen "Rondering Trafikkontoret" i koordinatorvyn</p>
            </div>
          ) : (
            cases.map(c => {
              const pct = c.total > 0 ? Math.round((c.inspected / c.total) * 100) : 0
              const isExpanded = expandedCase === c.id
              const logs = expandedLogs[c.id] || []

              return (
                <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCase(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/80 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    }

                    {/* Region + datum */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-sky-300">{c.customer_name}</span>
                        <span className="text-xs text-slate-500 font-mono">{c.case_number || c.title}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(c.scheduled_start)}</span>
                        {c.primary_technician_name && (
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.primary_technician_name}</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          c.status.includes('Avslutat') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                        }`}>{c.status}</span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {c.actionRequired > 0 && (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{c.actionRequired}
                        </span>
                      )}
                      {c.missing > 0 && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{c.missing}
                        </span>
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

                  {/* Detaljer — expanderat */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-slate-700 mt-1">
                      {logs.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-3">Inga avbockade stationer</p>
                      ) : (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {logs.map(log => (
                            <div key={log.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-slate-800/60 text-xs">
                              <CheckSquare className={`w-4 h-4 flex-shrink-0 ${
                                log.status === 'ok' ? 'text-emerald-400' :
                                log.status === 'action_required' ? 'text-amber-400' : 'text-red-400'
                              }`} />
                              <span className="font-mono text-slate-300 w-14">{
                                // Hitta serial_number från logs (vi har bara station_id)
                                log.station_id?.slice(0, 8)
                              }</span>
                              <span className={`px-1.5 py-0.5 rounded border ${
                                log.status === 'ok' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
                                log.status === 'action_required' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                                'bg-red-500/20 border-red-500/30 text-red-300'
                              }`}>
                                {log.status === 'ok' ? 'OK' : log.status === 'action_required' ? 'Åtgärd' : 'Saknas'}
                              </span>
                              {log.note && <span className="text-slate-500 truncate">{log.note}</span>}
                              <span className="ml-auto text-slate-500 whitespace-nowrap">{log.technician_name?.split(' ')[0]} · {formatDate(log.inspected_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
