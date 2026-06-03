// src/components/admin/RonderingRapportView.tsx
// Månadsrapport-vy för Rondering Trafikkontoret — avtalsansvarigs perspektiv

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { RonderingService, RonderingAnnotation, ANNOTATION_CATEGORIES, RonderingAnnotationCategory } from '../../services/ronderingService'
import { useGoogleMaps } from '../../hooks/useGoogleMaps'
import { X, Map, AlertTriangle, MapPin, Calendar, User, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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

interface BaitSummary { all: number; partial: number; none: number; nullCount: number }

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
  logs: any[]
}

interface HighRiskStation {
  station_id: string
  serial_number: string | null
  allCount: number
  lastInspected: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy', { locale: sv }) } catch { return iso }
}
function formatMonthYear(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'MMMM yyyy', { locale: sv }) } catch { return iso }
}
function formatDateShort(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM', { locale: sv }) } catch { return iso }
}

const BAIT_LABEL: Record<'all' | 'partial' | 'none', string> = { all: 'Allt', partial: 'Delvis', none: 'Inget' }

function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const diff = current - previous
  if (diff === 0) return <span className="text-slate-500 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0</span>
  const positive = invert ? diff < 0 : diff > 0
  return (
    <span className={`text-xs flex items-center gap-0.5 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {diff > 0 ? '+' : ''}{diff}
    </span>
  )
}

// Karta för avvikelser
function AnnotationMap({ annotations, isLoaded }: { annotations: RonderingAnnotation[]; isLoaded: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!isLoaded || !mapRef.current || annotations.length === 0) return

    // Rensa gamla markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    // Beräkna centrum
    const avgLat = annotations.reduce((s, a) => s + a.latitude, 0) / annotations.length
    const avgLng = annotations.reduce((s, a) => s + a.longitude, 0) / annotations.length

    if (!gMapRef.current) {
      gMapRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: avgLat, lng: avgLng },
        zoom: 14,
        mapTypeId: 'roadmap',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      })
    } else {
      gMapRef.current.setCenter({ lat: avgLat, lng: avgLng })
    }

    const bounds = new google.maps.LatLngBounds()

    annotations.forEach(ann => {
      const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
      bounds.extend({ lat: ann.latitude, lng: ann.longitude })

      const marker = new google.maps.Marker({
        position: { lat: ann.latitude, lng: ann.longitude },
        map: gMapRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#f97316',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: cat.label,
      })

      const infoContent = `
        <div style="font-family:sans-serif;padding:4px;max-width:220px">
          <div style="font-weight:600;font-size:13px;color:#1e293b;margin-bottom:2px">${cat.label}</div>
          ${ann.note ? `<div style="font-size:12px;color:#475569;margin-bottom:4px">${ann.note}</div>` : ''}
          <div style="font-size:11px;color:#94a3b8">${ann.latitude.toFixed(5)}, ${ann.longitude.toFixed(5)}</div>
          ${ann.technician_name ? `<div style="font-size:11px;color:#94a3b8">${ann.technician_name}</div>` : ''}
        </div>
      `
      const infoWindow = new google.maps.InfoWindow({ content: infoContent })
      marker.addListener('click', () => infoWindow.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    if (annotations.length > 1 && gMapRef.current) {
      gMapRef.current.fitBounds(bounds, 60)
    }
  }, [isLoaded, annotations])

  if (!isLoaded) return <div className="h-56 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-sm">Laddar karta...</div>
  return <div ref={mapRef} className="h-56 rounded-xl overflow-hidden" />
}

export default function RonderingRapportView({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  mode = 'modal',
  statusFilter = 'all',
}: RonderingRapportViewProps) {
  const { isLoaded: mapsLoaded } = useGoogleMaps({ libraries: ['marker'] })

  const [allCases, setAllCases] = useState<RonderingCase[]>([])
  const [highRiskStations, setHighRiskStations] = useState<HighRiskStation[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [serialMap, setSerialMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mode === 'modal' && !isOpen) return
    if (!organizationId) return

    const load = async () => {
      setLoading(true)
      setAllCases([])
      setHighRiskStations([])
      setSelectedCaseId(null)

      try {
        const { data: sites } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('organization_id', organizationId)
          .eq('site_type', 'enhet')
          .eq('is_multisite', true)

        const siteIds = (sites || []).map(s => s.id)
        const siteNameMap = Object.fromEntries((sites || []).map(s => [s.id, s.company_name]))
        if (siteIds.length === 0) return

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

        const enriched: RonderingCase[] = await Promise.all(
          rawCases.map(async (c) => {
            const [logs, annotations] = await Promise.all([
              RonderingService.getLogsForCase(c.id),
              RonderingService.getAnnotationsForCase(c.id),
            ])
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
              baitSummary: {
                all: logs.filter(l => l.bait_consumed === 'all').length,
                partial: logs.filter(l => l.bait_consumed === 'partial').length,
                none: logs.filter(l => l.bait_consumed === 'none').length,
                nullCount: logs.filter(l => l.bait_consumed === null).length,
              },
              annotations,
              logs,
            }
          })
        )
        setAllCases(enriched)
        setSelectedCaseId(enriched[0]?.id ?? null)

        // Högriskstationer
        const allCaseIds = rawCases.map(c => c.id)
        const { data: allLogs } = await supabase
          .from('rondering_station_logs')
          .select('station_id, bait_consumed, inspected_at')
          .in('case_id', allCaseIds)
          .eq('bait_consumed', 'all')

        const stationAllCount: Record<string, { count: number; lastInspected: string | null }> = {}
        for (const log of allLogs || []) {
          const e = stationAllCount[log.station_id]
          if (!e) stationAllCount[log.station_id] = { count: 1, lastInspected: log.inspected_at }
          else { e.count++; if (log.inspected_at > (e.lastInspected || '')) e.lastInspected = log.inspected_at }
        }
        setHighRiskStations(
          Object.entries(stationAllCount)
            .filter(([, v]) => v.count >= 2)
            .map(([station_id, v]) => ({ station_id, serial_number: newSerialMap[station_id] || null, allCount: v.count, lastInspected: v.lastInspected }))
            .sort((a, b) => b.allCount - a.allCount)
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, organizationId, mode, statusFilter])

  if (mode === 'modal' && !isOpen) return null

  const selectedCase = allCases.find(c => c.id === selectedCaseId) ?? allCases[0] ?? null
  // Föregående = närmast i tid före selected
  const selectedIdx = allCases.findIndex(c => c.id === selectedCase?.id)
  const previousCase = selectedIdx >= 0 && selectedIdx + 1 < allCases.length ? allCases[selectedIdx + 1] : null

  const pct = selectedCase && selectedCase.total > 0 ? Math.round((selectedCase.inspected / selectedCase.total) * 100) : 0
  const bait = selectedCase?.baitSummary
  const baitTotal = bait ? bait.all + bait.partial + bait.none : 0

  const content = (
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="py-16 text-center text-slate-400">Laddar rondering-rapport...</div>
      ) : allCases.length === 0 ? (
        <div className="py-16 text-center">
          <Map className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Inga rondering-ärenden{statusFilter !== 'all' ? ' med valt filter' : ''}</p>
        </div>
      ) : selectedCase ? (
        <div className="p-4 space-y-4">

          {/* ══ SEKTION 1: Sammanfattning för vald rondering ══ */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-0.5">Rondering</p>
                  <h2 className="text-lg font-semibold text-white capitalize">{formatMonthYear(selectedCase.scheduled_start)}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{selectedCase.customer_name} · {selectedCase.case_number}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedCase.primary_technician_name && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <User className="w-3.5 h-3.5" />{selectedCase.primary_technician_name}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                    selectedCase.status.toLowerCase().includes('avslutat')
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                  }`}>{selectedCase.status}</span>
                </div>
              </div>
            </div>

            {/* Nyckeltal */}
            <div className="grid grid-cols-3 divide-x divide-slate-700">
              {/* Stationer */}
              <div className="px-5 py-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Stationer kontrollerade</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${pct === 100 ? 'text-emerald-400' : 'text-white'}`}>
                    {selectedCase.inspected}/{selectedCase.total}
                  </span>
                  {previousCase && <Delta current={selectedCase.inspected} previous={previousCase.inspected} />}
                </div>
                <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{pct}% genomfört</p>
              </div>

              {/* Avvikelser */}
              <div className="px-5 py-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avvikelser</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${selectedCase.annotations.length > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {selectedCase.annotations.length}
                  </span>
                  {previousCase && <Delta current={selectedCase.annotations.length} previous={previousCase.annotations.length} invert />}
                </div>
                {selectedCase.actionRequired > 0 && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{selectedCase.actionRequired} kräver åtgärd
                  </p>
                )}
              </div>

              {/* Bete Allt */}
              <div className="px-5 py-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Allt bete förbrukat</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${(bait?.all ?? 0) > 20 ? 'text-red-400' : 'text-white'}`}>
                    {bait?.all ?? 0}
                  </span>
                  {previousCase && <Delta current={bait?.all ?? 0} previous={previousCase.baitSummary.all} invert />}
                </div>
                <p className="text-xs text-slate-500 mt-1">stationer</p>
              </div>
            </div>

            {/* Beteåtgång-stapel */}
            {baitTotal > 0 && (
              <div className="px-5 pb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Beteåtgång — fördelning</p>
                <div className="flex items-center gap-3 mb-1.5">
                  {bait!.all > 0 && <span className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 flex-shrink-0" />Allt: <strong className="text-red-300">{bait!.all}</strong></span>}
                  {bait!.partial > 0 && <span className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 flex-shrink-0" />Delvis: <strong className="text-amber-300">{bait!.partial}</strong></span>}
                  {bait!.none > 0 && <span className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500 flex-shrink-0" />Inget: <strong className="text-slate-400">{bait!.none}</strong></span>}
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-700 gap-px">
                  {bait!.all > 0 && <div className="bg-red-500" style={{ width: `${(bait!.all / baitTotal) * 100}%` }} />}
                  {bait!.partial > 0 && <div className="bg-amber-500" style={{ width: `${(bait!.partial / baitTotal) * 100}%` }} />}
                  {bait!.none > 0 && <div className="bg-slate-500" style={{ width: `${(bait!.none / baitTotal) * 100}%` }} />}
                </div>
              </div>
            )}
          </div>

          {/* ══ SEKTION 2: Avvikelsekarta ══ */}
          {selectedCase.annotations.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-400" />
                  Avvikelser ({selectedCase.annotations.length})
                </h3>
              </div>

              {/* Karta */}
              <div className="p-3">
                <AnnotationMap annotations={selectedCase.annotations} isLoaded={mapsLoaded} />
              </div>

              {/* Lista utan emojis */}
              <div className="px-4 pb-4 space-y-2">
                {selectedCase.annotations.map((ann, i) => {
                  const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
                  return (
                    <div key={ann.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                      <span className="text-xs text-slate-500 font-mono w-4 flex-shrink-0 pt-0.5">{i + 1}</span>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{cat.label}</p>
                        {ann.note && <p className="text-slate-400 text-xs mt-0.5">{ann.note}</p>}
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                          <span>{ann.latitude.toFixed(5)}, {ann.longitude.toFixed(5)}</span>
                          {ann.technician_name && <span>{ann.technician_name}</span>}
                          <span>{formatDate(ann.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ Högriskstationer ══ */}
          {highRiskStations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Högriskstationer — hög beteåtgång vid flera tillfällen</h3>
              </div>
              <div className="grid grid-cols-3 gap-px bg-amber-500/20 rounded-lg overflow-hidden text-xs">
                <div className="bg-slate-900/60 px-3 py-1.5 font-semibold text-slate-400">Station</div>
                <div className="bg-slate-900/60 px-3 py-1.5 font-semibold text-slate-400">Tillfällen</div>
                <div className="bg-slate-900/60 px-3 py-1.5 font-semibold text-slate-400">Senast</div>
                {highRiskStations.map(s => (
                  <React.Fragment key={s.station_id}>
                    <div className="bg-slate-900/40 px-3 py-2 font-mono text-amber-200">{s.serial_number || s.station_id.slice(0, 8)}</div>
                    <div className="bg-slate-900/40 px-3 py-2 text-red-300 font-semibold">{s.allCount}×</div>
                    <div className="bg-slate-900/40 px-3 py-2 text-slate-400">{formatDate(s.lastInspected)}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ══ SEKTION 3: Historik — alla tillfällen ══ */}
          {allCases.length > 1 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-400" />
                  Historik — alla ronderingstillfällen
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Datum</th>
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Tekniker</th>
                      <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Stationer</th>
                      <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Bete Allt</th>
                      <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Avvikelser</th>
                      <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCases.map(c => {
                      const isSelected = c.id === selectedCase.id
                      const cPct = c.total > 0 ? Math.round((c.inspected / c.total) * 100) : 0
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCaseId(c.id)}
                          className={`border-b border-slate-700/50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-700/30'
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <span className={`font-medium ${isSelected ? 'text-sky-300' : 'text-slate-300'}`}>
                              {formatDateShort(c.scheduled_start)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{c.primary_technician_name?.split(' ')[0] ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={cPct === 100 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                              {c.inspected}/{c.total}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={c.baitSummary.all > 20 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                              {c.baitSummary.all}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={c.annotations.length > 0 ? 'text-orange-400 font-semibold' : 'text-slate-500'}>
                              {c.annotations.length}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${
                              c.status.toLowerCase().includes('avslutat')
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                : 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                            }`}>{c.status.toLowerCase().includes('avslutat') ? 'Avslutat' : 'Pågående'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
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
