// src/components/admin/RonderingRapportView.tsx
// Månadsrapport-vy för Rondering Trafikkontoret — avtalsansvarigs perspektiv

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { RonderingService, ANNOTATION_CATEGORIES } from '../../services/ronderingService'
import type { RonderingAnnotation, RonderingAnnotationCategory } from '../../services/ronderingService'
import { CaseImageService } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import ImageLightbox from '../shared/ImageLightbox'
import { useGoogleMaps } from '../../hooks/useGoogleMaps'
import { X, Map, AlertTriangle, MapPin, Calendar, User, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

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

interface Hotspot {
  station_id: string
  serial_number: string | null
  lat: number
  lng: number
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

const BAIT_VALUE: Record<string, number> = { all: 3, partial: 2, none: 1 }

// Varma toner — röd/orange/gul/amber för högrisk-stationer
const TREND_COLORS = ['#ef4444', '#f97316', '#eab308', '#f59e0b', '#fb923c', '#fca5a5', '#fcd34d', '#fdba74']

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

function BaitTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.dataKey}:</span>
          <span className="font-medium text-white">{p.value === 3 ? 'Allt' : p.value === 2 ? 'Delvis' : p.value === 1 ? 'Inget' : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// Karta för avvikelser och högriskstationer
function AnnotationMap({ annotations, hotspots, isLoaded }: { annotations: RonderingAnnotation[]; hotspots: Hotspot[]; isLoaded: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    const hasContent = annotations.length > 0 || hotspots.length > 0
    if (!isLoaded || !mapRef.current || !hasContent) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const allPoints = [
      ...annotations.map(a => ({ lat: a.latitude, lng: a.longitude })),
      ...hotspots.map(h => ({ lat: h.lat, lng: h.lng })),
    ]
    const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length
    const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length

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
        icon: { path: 'M 0,-12 L 10,8 L -10,8 Z', scale: 1.2, fillColor: '#f97316', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
        title: cat.label, zIndex: 10,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px;max-width:220px"><div style="font-weight:600;font-size:13px;color:#1e293b;margin-bottom:2px">${cat.label}</div>${ann.note ? `<div style="font-size:12px;color:#475569;margin-bottom:4px">${ann.note}</div>` : ''}<div style="font-size:11px;color:#94a3b8">${ann.latitude.toFixed(5)}, ${ann.longitude.toFixed(5)}</div>${ann.technician_name ? `<div style="font-size:11px;color:#94a3b8">${ann.technician_name}</div>` : ''}</div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    hotspots.forEach(h => {
      bounds.extend({ lat: h.lat, lng: h.lng })
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: gMapRef.current!,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#ef4444', fillOpacity: 0.85, strokeColor: '#ffffff', strokeWeight: 2 },
        title: `Station ${h.serial_number ?? h.station_id.slice(0, 8)} — Hög beteåtgång`, zIndex: 5,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px;max-width:200px"><div style="font-weight:600;font-size:13px;color:#ef4444;margin-bottom:2px">Högriskstation</div><div style="font-size:12px;color:#1e293b">Station ${h.serial_number ?? h.station_id.slice(0, 8)}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">Hög beteåtgång vid flera tillfällen</div></div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    if (allPoints.length > 1 && gMapRef.current) gMapRef.current.fitBounds(bounds, 60)
  }, [isLoaded, annotations, hotspots])

  if (!isLoaded) return <div className="h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-sm">Laddar karta...</div>
  return <div ref={mapRef} className="h-64 rounded-xl overflow-hidden" />
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
  const [_serialMap, setSerialMap] = useState<Record<string, string>>({})
  const [stationCoordMap, setStationCoordMap] = useState<Record<string, { lat: number; lng: number }>>({})
  const [annotationImages, setAnnotationImages] = useState<Record<string, CaseImageWithUrl[]>>({})
  const [lightbox, setLightbox] = useState<{ images: { url: string; alt: string }[]; index: number } | null>(null)
  const [tableFilter, setTableFilter] = useState<'all' | 'partial' | 'none' | 'all_bait'>('all_bait')

  useEffect(() => {
    if (mode === 'modal' && !isOpen) return
    if (!organizationId) return

    const load = async () => {
      setLoading(true)
      setAllCases([])
      setHighRiskStations([])
      setSelectedCaseId(null)
      setAnnotationImages({})

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
          .select('id, customer_id, serial_number, latitude, longitude')
          .in('customer_id', siteIds)
          .eq('status', 'active')

        const stationCountMap: Record<string, number> = {}
        const newSerialMap: Record<string, string> = {}
        const newCoordMap: Record<string, { lat: number; lng: number }> = {}
        for (const p of placements || []) {
          stationCountMap[p.customer_id] = (stationCountMap[p.customer_id] || 0) + 1
          if (p.serial_number) newSerialMap[p.id] = p.serial_number
          if (p.latitude && p.longitude) newCoordMap[p.id] = { lat: p.latitude, lng: p.longitude }
        }
        setSerialMap(newSerialMap)
        setStationCoordMap(newCoordMap)

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

        // Bilder för senaste ärendet
        if (enriched[0]) {
          try {
            const allImgs = await CaseImageService.getCaseImages(enriched[0].id, 'contract')
            const byAnnotation: Record<string, CaseImageWithUrl[]> = {}
            for (const ann of enriched[0].annotations) {
              byAnnotation[ann.id] = allImgs.filter(img => img.description === `annotation:${ann.id}`)
            }
            setAnnotationImages(byAnnotation)
          } catch { /* tyst */ }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, organizationId, mode, statusFilter])

  // Ladda bilder när selectedCase ändras (ej vid första laddning — hanteras ovan)
  useEffect(() => {
    if (!selectedCaseId || !allCases.length) return
    const c = allCases.find(x => x.id === selectedCaseId)
    if (!c) return
    CaseImageService.getCaseImages(c.id, 'contract').then(allImgs => {
      const byAnnotation: Record<string, CaseImageWithUrl[]> = {}
      for (const ann of c.annotations) {
        byAnnotation[ann.id] = allImgs.filter(img => img.description === `annotation:${ann.id}`)
      }
      setAnnotationImages(byAnnotation)
    }).catch(() => {})
  }, [selectedCaseId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'modal' && !isOpen) return null

  const selectedCase = allCases.find(c => c.id === selectedCaseId) ?? allCases[0] ?? null
  const selectedIdx = allCases.findIndex(c => c.id === selectedCase?.id)
  const previousCase = selectedIdx >= 0 && selectedIdx + 1 < allCases.length ? allCases[selectedIdx + 1] : null

  const pct = selectedCase && selectedCase.total > 0 ? Math.round((selectedCase.inspected / selectedCase.total) * 100) : 0
  const bait = selectedCase?.baitSummary
  const baitTotal = bait ? bait.all + bait.partial + bait.none : 0

  // ── Trend-data för högriskstationer ──────────────────────────────────────────
  const chronoCases = [...allCases].reverse() // äldst → nyast

  // Stacked bar: en stapel per rondering-tillfälle med Allt/Delvis/Inget per station
  const barData = chronoCases.map(c => ({
    date: formatDateShort(c.scheduled_start),
    Allt: c.logs.filter((l: any) => l.bait_consumed === 'all').length,
    Delvis: c.logs.filter((l: any) => l.bait_consumed === 'partial').length,
    Inget: c.logs.filter((l: any) => l.bait_consumed === 'none').length,
  }))

  // Beräkna konsekutiva 'all' i rad (räknat bakifrån) per station
  const consecutiveAll = (stationId: string): number => {
    let count = 0
    for (let i = chronoCases.length - 1; i >= 0; i--) {
      const log = chronoCases[i].logs.find((l: any) => l.station_id === stationId)
      if (log?.bait_consumed === 'all') count++
      else break
    }
    return count
  }

  // Beräkna senaste beteåtgång per station
  const latestBait = (stationId: string): string | null => {
    const last = chronoCases[chronoCases.length - 1]?.logs.find((l: any) => l.station_id === stationId)
    return last?.bait_consumed ?? null
  }

  // Beräkna trend (senaste vs näst senaste) per station
  const stationTrendDir = (s: HighRiskStation): 'down' | 'flat' | 'up' => {
    if (chronoCases.length < 2) return 'flat'
    const last = chronoCases[chronoCases.length - 1].logs.find((l: any) => l.station_id === s.station_id)
    const prev = chronoCases[chronoCases.length - 2].logs.find((l: any) => l.station_id === s.station_id)
    if (!last || !prev) return 'flat'
    const lv = BAIT_VALUE[last.bait_consumed] ?? 0
    const pv = BAIT_VALUE[prev.bait_consumed] ?? 0
    return lv < pv ? 'down' : lv > pv ? 'up' : 'flat'
  }

  // Kartan visar bara stationer med 3+ månader i rad med Allt förbrukat
  const hotspots: Hotspot[] = highRiskStations.flatMap(s => {
    if (consecutiveAll(s.station_id) < 3) return []
    const coord = stationCoordMap[s.station_id]
    return coord ? [{ station_id: s.station_id, serial_number: s.serial_number, lat: coord.lat, lng: coord.lng }] : []
  })

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

          {/* ══ SEKTION 1: Sammanfattning ══ */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
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

            <div className="grid grid-cols-3 divide-x divide-slate-700">
              <div className="px-5 py-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Stationer kontrollerade</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${pct === 100 ? 'text-emerald-400' : 'text-white'}`}>{selectedCase.inspected}/{selectedCase.total}</span>
                  {previousCase && <Delta current={selectedCase.inspected} previous={previousCase.inspected} />}
                </div>
                <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{pct}% genomfört</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avvikelser</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${selectedCase.annotations.length > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{selectedCase.annotations.length}</span>
                  {previousCase && <Delta current={selectedCase.annotations.length} previous={previousCase.annotations.length} invert />}
                </div>
                {selectedCase.actionRequired > 0 && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{selectedCase.actionRequired} kräver åtgärd</p>
                )}
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Allt bete förbrukat</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${(bait?.all ?? 0) > 20 ? 'text-red-400' : 'text-white'}`}>{bait?.all ?? 0}</span>
                  {previousCase && <Delta current={bait?.all ?? 0} previous={previousCase.baitSummary.all} invert />}
                </div>
                <p className="text-xs text-slate-500 mt-1">stationer</p>
              </div>
            </div>

            {baitTotal > 0 && (
              <div className="px-5 pb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Beteåtgång — fördelning</p>
                <div className="flex items-center gap-3 mb-1.5">
                  {bait!.all > 0 && <span className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 flex-shrink-0" />Allt: <strong className="text-red-300">{bait!.all}</strong></span>}
                  {bait!.partial > 0 && <span className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 flex-shrink-0" />Delvis: <strong className="text-amber-300">{bait!.partial}</strong></span>}
                  {bait!.none > 0 && <span className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 flex-shrink-0" />Inget: <strong className="text-emerald-300">{bait!.none}</strong></span>}
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-700 gap-px">
                  {bait!.all > 0 && <div className="bg-red-500" style={{ width: `${(bait!.all / baitTotal) * 100}%` }} />}
                  {bait!.partial > 0 && <div className="bg-amber-500" style={{ width: `${(bait!.partial / baitTotal) * 100}%` }} />}
                  {bait!.none > 0 && <div className="bg-emerald-500" style={{ width: `${(bait!.none / baitTotal) * 100}%` }} />}
                </div>
              </div>
            )}
          </div>

          {/* ══ SEKTION 2: Karta ══ */}
          {(selectedCase.annotations.length > 0 || hotspots.length > 0) && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-400" />
                  Karta — avvikelser &amp; riskzoner
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {selectedCase.annotations.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[9px] border-l-transparent border-r-transparent border-b-orange-500" />
                      {selectedCase.annotations.length} avvikelse{selectedCase.annotations.length !== 1 ? 'r' : ''}
                    </span>
                  )}
                  {hotspots.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                      {hotspots.length} högriskstation{hotspots.length !== 1 ? 'er' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <AnnotationMap annotations={selectedCase.annotations} hotspots={hotspots} isLoaded={mapsLoaded} />
              </div>
              {selectedCase.annotations.length > 0 && (
                <div className="px-4 pb-4 space-y-2">
                  {selectedCase.annotations.map((ann, i) => {
                    const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
                    const imgs = annotationImages[ann.id] || []
                    return (
                      <div key={ann.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                        <span className="text-xs text-slate-500 font-mono w-4 flex-shrink-0 pt-0.5">{i + 1}</span>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 bg-orange-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">{cat.label}</p>
                          {ann.note && <p className="text-slate-400 text-xs mt-0.5">{ann.note}</p>}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                            <span>{ann.latitude.toFixed(5)}, {ann.longitude.toFixed(5)}</span>
                            {ann.technician_name && <span>{ann.technician_name}</span>}
                            <span>{formatDate(ann.created_at)}</span>
                          </div>
                          {imgs.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {imgs.map((img, idx) => (
                                <img
                                  key={img.id}
                                  src={img.url}
                                  alt={cat.label}
                                  className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-slate-600"
                                  onClick={() => setLightbox({ images: imgs.map(x => ({ url: x.url, alt: cat.label })), index: idx })}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ SEKTION 3: Beteåtgång-trend ══ */}
          {highRiskStations.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Aktivitetsutveckling — beteåtgång över tid
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Minskande röd yta indikerar lyckad bekämpning.</p>
              </div>

              {/* Stacked bar — aggregerad vy per tillfälle */}
              {chronoCases.length >= 2 ? (
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-4 mb-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Allt förbrukat</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />Delvis</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Inget</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                      <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                        itemStyle={{ color: '#cbd5e1' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="Allt" fill="#ef4444" radius={[3,3,0,0]} isAnimationActive={false} />
                      <Bar dataKey="Delvis" fill="#f59e0b" radius={[3,3,0,0]} isAnimationActive={false} />
                      <Bar dataKey="Inget" fill="#22c55e" radius={[3,3,0,0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="px-5 py-4 text-xs text-slate-500">Graf visas när minst 2 ronderingstillfällen finns.</p>
              )}

              {/* Stationstabellen med filter */}
              <div className="px-4 pb-4 pt-2">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stationer med hög aktivitet</p>
                  <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                    {([
                      { key: 'all_bait', label: 'Alla' },
                      { key: 'all', label: 'Allt' },
                      { key: 'partial', label: 'Delvis' },
                      { key: 'none', label: 'Inget' },
                    ] as { key: typeof tableFilter; label: string }[]).map(f => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setTableFilter(f.key)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                          tableFilter === f.key
                            ? 'bg-slate-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden border border-slate-700 text-xs">
                  <div className="grid grid-cols-5 bg-slate-900/60">
                    <div className="px-3 py-2 font-semibold text-slate-400">Station</div>
                    <div className="px-3 py-2 font-semibold text-slate-400 text-center">Totalt</div>
                    <div className="px-3 py-2 font-semibold text-slate-400 text-center">Månader i rad</div>
                    <div className="px-3 py-2 font-semibold text-slate-400 text-center">Senaste</div>
                    <div className="px-3 py-2 font-semibold text-slate-400">Trend</div>
                  </div>
                  {highRiskStations
                    .map(s => ({ s, consec: consecutiveAll(s.station_id), latest: latestBait(s.station_id), dir: stationTrendDir(s) }))
                    .filter(({ latest }) => tableFilter === 'all_bait' || latest === tableFilter)
                    .sort((a, b) => b.consec - a.consec || b.s.allCount - a.s.allCount)
                    .map(({ s, consec, latest, dir }, i) => (
                      <div key={s.station_id} className={`grid grid-cols-5 border-t border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-900/40'}`}>
                        <div className="px-3 py-2 font-mono text-slate-200">{s.serial_number || s.station_id.slice(0, 8)}</div>
                        <div className="px-3 py-2 text-center text-red-300 font-semibold">{s.allCount}×</div>
                        <div className="px-3 py-2 text-center">
                          {consec >= 3
                            ? <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 font-semibold">{consec}×</span>
                            : <span className="text-slate-500">{consec > 0 ? `${consec}×` : '—'}</span>
                          }
                        </div>
                        <div className="px-3 py-2 text-center">
                          {latest === 'all' && <span className="text-red-300 font-medium">Allt</span>}
                          {latest === 'partial' && <span className="text-amber-300">Delvis</span>}
                          {latest === 'none' && <span className="text-emerald-400">Inget</span>}
                          {!latest && <span className="text-slate-500">—</span>}
                        </div>
                        <div className="px-3 py-2">
                          {dir === 'down' && <span className="text-emerald-400 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />Minskar</span>}
                          {dir === 'flat' && <span className="text-slate-400 flex items-center gap-1"><Minus className="w-3.5 h-3.5" />Oförändrad</span>}
                          {dir === 'up' && <span className="text-red-400 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Ökar</span>}
                        </div>
                      </div>
                    ))}
                  {highRiskStations.filter(s => tableFilter === 'all_bait' || latestBait(s.station_id) === tableFilter).length === 0 && (
                    <div className="px-3 py-4 text-center text-slate-500 border-t border-slate-700/50">Inga stationer med valt filter</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ SEKTION 4: Historik ══ */}
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
                        <tr key={c.id} onClick={() => setSelectedCaseId(c.id)} className={`border-b border-slate-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-700/30'}`}>
                          <td className="px-4 py-2.5"><span className={`font-medium ${isSelected ? 'text-sky-300' : 'text-slate-300'}`}>{formatDateShort(c.scheduled_start)}</span></td>
                          <td className="px-4 py-2.5 text-slate-400">{c.primary_technician_name?.split(' ')[0] ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center"><span className={cPct === 100 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>{c.inspected}/{c.total}</span></td>
                          <td className="px-4 py-2.5 text-center"><span className={c.baitSummary.all > 20 ? 'text-red-400 font-semibold' : 'text-slate-400'}>{c.baitSummary.all}</span></td>
                          <td className="px-4 py-2.5 text-center"><span className={c.annotations.length > 0 ? 'text-orange-400 font-semibold' : 'text-slate-500'}>{c.annotations.length}</span></td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${c.status.toLowerCase().includes('avslutat') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-sky-500/20 border-sky-500/30 text-sky-300'}`}>
                              {c.status.toLowerCase().includes('avslutat') ? 'Avslutat' : 'Pågående'}
                            </span>
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
      {lightbox && <ImageLightbox images={lightbox.images} initialIndex={lightbox.index} isOpen onClose={() => setLightbox(null)} />}
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
