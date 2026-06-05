// src/pages/admin/RonderingPage.tsx
// Egenkontroll-översikt — månadsvy över alla regioner för en organisation

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useGoogleMaps } from '../../hooks/useGoogleMaps'
import { RonderingService } from '../../services/ronderingService'
import type { RonderingAnnotation, RonderingAnnotationCategory } from '../../services/ronderingService'
import { ANNOTATION_CATEGORIES } from '../../services/ronderingService'
import {
  Map, Building2, FileDown, ChevronLeft, ChevronRight,
  AlertCircle, TrendingDown, CheckCircle, X, User, Calendar,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { generateRonderingPdf } from '../../utils/ronderingPdfGenerator'
import toast from 'react-hot-toast'

// ── Typer ────────────────────────────────────────────────────────────────────

interface RegionalOrg {
  organization_id: string
  name: string
}

interface RegionMonthData {
  caseId: string
  caseNumber: string | null
  regionId: string
  regionName: string
  scheduledStart: string | null
  status: string
  technicianName: string | null
  inspected: number
  total: number
  baitAll: number
  baitPartial: number
  baitNone: number
  annotations: RonderingAnnotation[]
  logs: any[]
}

interface StationCoord {
  stationId: string
  serialNumber: string | null
  lat: number
  lng: number
  customerId: string
}

interface HotspotStation {
  stationId: string
  serialNumber: string | null
  lat: number
  lng: number
  consecutiveMonths: number
  improved: boolean
}

interface GeoCluster {
  center: { lat: number; lng: number }
  stations: StationCoord[]
}

// ── Hjälpfunktioner ───────────────────────────────────────────────────────────

function fmtMonthYear(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'MMM yyyy', { locale: sv }) } catch { return iso }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM', { locale: sv }) } catch { return iso }
}

function toMonthKey(iso: string): string {
  return iso.slice(0, 7) // 'YYYY-MM'
}

// Deduplicera: ett ärende per region per månad — senast genomförda vinner
// (allCases är sorterat desc på scheduledStart, så första träff = senast)
function latestPerRegionPerMonth(cases: RegionMonthData[]): RegionMonthData[] {
  const seen = new Map<string, RegionMonthData>()
  for (const c of cases) {
    if (!c.scheduledStart) continue
    const key = `${c.regionId}__${toMonthKey(c.scheduledStart)}`
    if (!seen.has(key)) seen.set(key, c)
  }
  return Array.from(seen.values())
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function clusterStations(stations: StationCoord[], maxDist = 300, minSize = 3): GeoCluster[] {
  const visited = new Set<number>()
  const clusters: GeoCluster[] = []
  for (let i = 0; i < stations.length; i++) {
    if (visited.has(i)) continue
    const neighbors: number[] = [i]
    for (let j = 0; j < stations.length; j++) {
      if (i === j) continue
      if (haversineMeters(stations[i].lat, stations[i].lng, stations[j].lat, stations[j].lng) <= maxDist) {
        neighbors.push(j)
      }
    }
    if (neighbors.length >= minSize) {
      neighbors.forEach(n => visited.add(n))
      const clusterStations = neighbors.map(n => stations[n])
      const centerLat = clusterStations.reduce((s, c) => s + c.lat, 0) / clusterStations.length
      const centerLng = clusterStations.reduce((s, c) => s + c.lng, 0) / clusterStations.length
      clusters.push({ center: { lat: centerLat, lng: centerLng }, stations: clusterStations })
    }
  }
  return clusters
}

// ── Kartan ────────────────────────────────────────────────────────────────────

interface OverviewMapProps {
  hotspots: HotspotStation[]
  geoClusters: GeoCluster[]
  annotations: RonderingAnnotation[]
  isLoaded: boolean
  highlightRegionId: string | null
}

function OverviewMap({ hotspots, geoClusters, annotations, isLoaded, highlightRegionId }: OverviewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    if (!gMapRef.current) {
      gMapRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: 59.33, lng: 18.07 },
        zoom: 11,
        mapTypeId: 'roadmap',
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      })
    }

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let hasPoints = false

    hotspots.filter(h => !h.improved).forEach(h => {
      bounds.extend({ lat: h.lat, lng: h.lng }); hasPoints = true
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: gMapRef.current!,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#ef4444', fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 1.5 },
        title: `Station ${h.serialNumber ?? '?'} — ${h.consecutiveMonths} månader i rad`,
        zIndex: 10,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px"><b style="color:#ef4444">Hotspot</b><br><span style="font-size:12px">Station ${h.serialNumber ?? h.stationId.slice(0,8)}</span><br><span style="font-size:11px;color:#64748b">${h.consecutiveMonths} månader i rad</span></div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    hotspots.filter(h => h.improved).forEach(h => {
      bounds.extend({ lat: h.lat, lng: h.lng }); hasPoints = true
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: gMapRef.current!,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#22c55e', fillOpacity: 0.85, strokeColor: '#fff', strokeWeight: 1.5 },
        title: `Station ${h.serialNumber ?? '?'} — förbättrad`,
        zIndex: 8,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px"><b style="color:#22c55e">Förbättrad</b><br><span style="font-size:12px">Station ${h.serialNumber ?? h.stationId.slice(0,8)}</span></div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    geoClusters.forEach(cluster => {
      bounds.extend(cluster.center); hasPoints = true
      const marker = new google.maps.Marker({
        position: cluster.center,
        map: gMapRef.current!,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: '#ef4444', fillOpacity: 0.25, strokeColor: '#ef4444', strokeWeight: 2.5 },
        title: `Kluster — ${cluster.stations.length} stationer`,
        zIndex: 5,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px"><b style="color:#ef4444">Geografiskt kluster</b><br><span style="font-size:12px">${cluster.stations.length} stationer med hög aktivitet</span></div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    annotations.forEach(ann => {
      const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
      bounds.extend({ lat: ann.latitude, lng: ann.longitude }); hasPoints = true
      const marker = new google.maps.Marker({
        position: { lat: ann.latitude, lng: ann.longitude },
        map: gMapRef.current!,
        icon: { path: 'M 0,-12 L 10,8 L -10,8 Z', scale: 1.1, fillColor: '#f97316', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5 },
        title: cat.label, zIndex: 15,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px"><b>${cat.label}</b>${ann.note ? `<br><span style="font-size:12px">${ann.note}</span>` : ''}</div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    if (hasPoints && gMapRef.current) gMapRef.current.fitBounds(bounds, 60)
  }, [isLoaded, hotspots, geoClusters, annotations])

  if (!isLoaded) return <div className="h-80 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-sm">Laddar karta...</div>
  return <div ref={mapRef} className="h-80 rounded-xl overflow-hidden" />
}

// ── Huvudkomponent ────────────────────────────────────────────────────────────

export default function RonderingPage() {
  const { isLoaded: mapsLoaded } = useGoogleMaps({ libraries: ['marker', 'geometry'] })

  const [orgs, setOrgs] = useState<RegionalOrg[]>([])
  const [selectedOrg, setSelectedOrg] = useState<RegionalOrg | null>(null)
  const [loadingOrgs, setLoadingOrgs] = useState(true)

  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [allEnriched, setAllEnriched] = useState<RegionMonthData[]>([])
  const [monthData, setMonthData] = useState<RegionMonthData[]>([])
  const [allMonthsAggregated, setAllMonthsAggregated] = useState<{ month: string; all: number; partial: number; none: number }[]>([])
  const [stationCoords, setStationCoords] = useState<StationCoord[]>([])
  const [loading, setLoading] = useState(false)

  const [hotspots, setHotspots] = useState<HotspotStation[]>([])
  const [geoClusters, setGeoClusters] = useState<GeoCluster[]>([])

  const [selectedRegion, setSelectedRegion] = useState<RegionMonthData | null>(null)

  const [exportingPdf, setExportingPdf] = useState(false)

  // ── Ladda organisationer ──────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoadingOrgs(true)
      const { data } = await supabase
        .from('customers')
        .select('organization_id, company_name')
        .eq('is_multisite', true)
        .eq('site_type', 'enhet')
        .not('organization_id', 'is', null)

      const seen = new Set<string>()
      const unique: RegionalOrg[] = []
      for (const row of data || []) {
        if (row.organization_id && !seen.has(row.organization_id)) {
          seen.add(row.organization_id)
          unique.push({ organization_id: row.organization_id, name: row.company_name || row.organization_id })
        }
      }
      setOrgs(unique)
      if (unique.length > 0) setSelectedOrg(unique[0])
      setLoadingOrgs(false)
    }
    load()
  }, [])

  // ── Ladda data när organisation väljs ────────────────────────────────────

  useEffect(() => {
    if (!selectedOrg) return
    const load = async () => {
      setLoading(true)
      setMonthData([])
      setAllEnriched([])
      setAllMonthsAggregated([])
      setHotspots([])
      setGeoClusters([])
      setSelectedRegion(null)

      try {
        const { data: sites } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('organization_id', selectedOrg.organization_id)
          .eq('site_type', 'enhet')
          .eq('is_multisite', true)

        const siteIds = (sites || []).map(s => s.id)
        const siteNameMap = Object.fromEntries((sites || []).map(s => [s.id, s.company_name]))
        if (siteIds.length === 0) { setLoading(false); return }

        const { data: allCases } = await supabase
          .from('cases')
          .select('id, case_number, title, customer_id, scheduled_start, status, primary_technician_name')
          .eq('service_type', 'rondering_trafikkontoret')
          .in('customer_id', siteIds)
          .order('scheduled_start', { ascending: false })

        if (!allCases || allCases.length === 0) { setLoading(false); return }

        const { data: placements } = await supabase
          .from('equipment_placements')
          .select('id, customer_id, serial_number, latitude, longitude')
          .in('customer_id', siteIds)
          .eq('status', 'active')

        const stationCountMap: Record<string, number> = {}
        const coords: StationCoord[] = []
        for (const p of placements || []) {
          stationCountMap[p.customer_id] = (stationCountMap[p.customer_id] || 0) + 1
          if (p.latitude && p.longitude) {
            coords.push({ stationId: p.id, serialNumber: p.serial_number, lat: p.latitude, lng: p.longitude, customerId: p.customer_id })
          }
        }
        setStationCoords(coords)

        const enriched: RegionMonthData[] = await Promise.all(
          allCases.map(async (c) => {
            const [logs, annotations] = await Promise.all([
              RonderingService.getLogsForCase(c.id),
              RonderingService.getAnnotationsForCase(c.id),
            ])
            return {
              caseId: c.id,
              caseNumber: c.case_number,
              regionId: c.customer_id,
              regionName: siteNameMap[c.customer_id] || c.customer_id,
              scheduledStart: c.scheduled_start,
              status: c.status,
              technicianName: c.primary_technician_name,
              inspected: logs.length,
              total: stationCountMap[c.customer_id] || 0,
              baitAll: logs.filter((l: any) => l.bait_consumed === 'all').length,
              baitPartial: logs.filter((l: any) => l.bait_consumed === 'partial').length,
              baitNone: logs.filter((l: any) => l.bait_consumed === 'none').length,
              annotations,
              logs,
            }
          })
        )

        const monthKeys = [...new Set(enriched.map(c => c.scheduledStart ? toMonthKey(c.scheduledStart) : null).filter(Boolean) as string[])]
          .sort((a, b) => b.localeCompare(a))
        setAvailableMonths(monthKeys)

        const latestMonth = monthKeys[0] || ''
        setSelectedMonth(latestMonth)

        // Spara alla enriched ärenden — monthData räknas om via useEffect nedan
        setAllEnriched(enriched)

        // Aggregerad trenddata per månad — deduplicerat
        const aggByMonth: Record<string, { all: number; partial: number; none: number }> = {}
        const monthsSorted = [...monthKeys].reverse()
        for (const mk of monthsSorted) {
          const casesForMonth = latestPerRegionPerMonth(
            enriched.filter(c => c.scheduledStart && toMonthKey(c.scheduledStart) === mk)
          )
          aggByMonth[mk] = casesForMonth.reduce(
            (acc, c) => ({ all: acc.all + c.baitAll, partial: acc.partial + c.baitPartial, none: acc.none + c.baitNone }),
            { all: 0, partial: 0, none: 0 }
          )
        }
        const aggregated = monthsSorted.map(mk => ({ month: fmtMonthYear(mk + '-01'), ...aggByMonth[mk] }))
        setAllMonthsAggregated(aggregated)

        // Hotspot-beräkning — deduplicerat per månad
        const stationHistory: Record<string, (string | null)[]> = {}
        for (const mk of monthsSorted) {
          const casesForMonth = latestPerRegionPerMonth(
            enriched.filter(c => c.scheduledStart && toMonthKey(c.scheduledStart) === mk)
          )
          for (const c of casesForMonth) {
            for (const log of c.logs) {
              if (!stationHistory[log.station_id]) stationHistory[log.station_id] = []
              stationHistory[log.station_id].push(log.bait_consumed)
            }
          }
        }

        const hotspotList: HotspotStation[] = []
        const highActivityStations: StationCoord[] = []

        for (const [stationId, history] of Object.entries(stationHistory)) {
          let consec = 0
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i] === 'all') consec++
            else break
          }
          const allCount = history.filter(v => v === 'all').length
          const latest = history[history.length - 1]
          const improved = allCount >= 2 && (latest === 'partial' || latest === 'none')

          if (consec >= 3 || improved) {
            const coord = coords.find(c => c.stationId === stationId)
            if (coord) {
              hotspotList.push({ stationId, serialNumber: coord.serialNumber, lat: coord.lat, lng: coord.lng, consecutiveMonths: consec, improved })
            }
          }

          if (latest === 'all') {
            const coord = coords.find(c => c.stationId === stationId)
            if (coord) highActivityStations.push(coord)
          }
        }

        setHotspots(hotspotList)
        setGeoClusters(clusterStations(highActivityStations, 300, 3))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedOrg])

  // Räkna om monthData när vald månad ändras
  useEffect(() => {
    if (!selectedMonth || allEnriched.length === 0) return
    const forMonth = allEnriched.filter(c => c.scheduledStart && toMonthKey(c.scheduledStart) === selectedMonth)
    setMonthData(latestPerRegionPerMonth(forMonth))
  }, [allEnriched, selectedMonth])

  const handleMonthChange = useCallback((mk: string) => {
    setSelectedMonth(mk)
    setSelectedRegion(null)
  }, [])

  const monthIdx = availableMonths.indexOf(selectedMonth)
  const canPrev = monthIdx < availableMonths.length - 1
  const canNext = monthIdx > 0

  const monthTotalAll = monthData.reduce((s, c) => s + c.baitAll, 0)
  const monthTotalPartial = monthData.reduce((s, c) => s + c.baitPartial, 0)
  const monthTotalNone = monthData.reduce((s, c) => s + c.baitNone, 0)
  const monthTotalInspected = monthData.reduce((s, c) => s + c.inspected, 0)
  const monthTotalStations = monthData.reduce((s, c) => s + c.total, 0)
  const monthTotalAnnotations = monthData.reduce((s, c) => s + c.annotations.length, 0)
  const allAnnotations = monthData.flatMap(c => c.annotations)
  const activeHotspots = hotspots.filter(h => !h.improved)

  // Bygg map caseId → regionName för avvikelsesektionen
  const caseRegionMap = Object.fromEntries(monthData.map(c => [c.caseId, c.regionName]))

  // Hotspot-regioner för denna månad (regionId-set)
  const hotspotRegionIds = new Set(
    hotspots.filter(h => !h.improved).map(h => {
      const coord = stationCoords.find(s => s.stationId === h.stationId)
      return coord?.customerId
    }).filter(Boolean) as string[]
  )

  const handleExportPdf = async () => {
    if (!selectedOrg) return
    setExportingPdf(true)
    try {
      const pdfCases = monthData.map(c => ({
        case_number: c.caseNumber,
        title: c.regionName,
        customer_name: c.regionName,
        scheduled_start: c.scheduledStart,
        status: c.status,
        primary_technician_name: c.technicianName,
        inspected: c.inspected,
        total: c.total,
        actionRequired: 0,
        missing: 0,
        baitSummary: { all: c.baitAll, partial: c.baitPartial, none: c.baitNone },
        annotations: c.annotations.map(a => ({ category: a.category, note: a.note, technician_name: a.technician_name, created_at: a.created_at })),
      }))
      const highRisk = hotspots.filter(h => !h.improved).map(h => ({
        station_id: h.stationId, serial_number: h.serialNumber, allCount: h.consecutiveMonths, lastInspected: null,
      }))
      generateRonderingPdf(selectedOrg.name, pdfCases, highRisk, fmtMonthYear(selectedMonth + '-01'))
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte generera PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Vänster kolumn — kundlista */}
      <div className="w-56 flex-shrink-0 border-r border-slate-700 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Regionalkunder</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loadingOrgs ? (
            <div className="px-4 py-4 text-xs text-slate-500 text-center">Laddar...</div>
          ) : orgs.map(org => (
            <button
              key={org.organization_id}
              type="button"
              onClick={() => { setSelectedOrg(org); setSelectedRegion(null) }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                selectedOrg?.organization_id === org.organization_id
                  ? 'bg-sky-500/10 border-r-2 border-sky-400 text-white'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span className="text-xs truncate">{org.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Höger kolumn — innehåll */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedOrg ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center"><Map className="w-10 h-10 mx-auto mb-2 text-slate-600" /><p>Välj en kund</p></div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">Laddar ronderingsdata...</div>
        ) : (
          <div className="p-5 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Egenkontroll</p>
                <h1 className="text-xl font-semibold text-white">{selectedOrg.name}</h1>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-1 py-1">
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => handleMonthChange(availableMonths[monthIdx + 1])}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  ><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-medium text-white px-2 min-w-[100px] text-center capitalize">
                    {fmtMonthYear(selectedMonth + '-01')}
                  </span>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => handleMonthChange(availableMonths[monthIdx - 1])}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  ><ChevronRight className="w-4 h-4" /></button>
                </div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf || monthData.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20c58f]/10 border border-[#20c58f]/30 text-[#20c58f] text-xs font-medium hover:bg-[#20c58f]/20 transition-colors disabled:opacity-40"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {exportingPdf ? 'Genererar...' : 'Exportera PDF'}
                </button>
              </div>
            </div>

            {/* ── KPI-rad ── */}
            {monthData.length > 0 && (
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Stationer kontrollerade</p>
                  <p className={`text-2xl font-bold ${monthTotalInspected === monthTotalStations ? 'text-emerald-400' : 'text-white'}`}>
                    {monthTotalInspected}/{monthTotalStations}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{monthTotalStations > 0 ? Math.round(monthTotalInspected / monthTotalStations * 100) : 0}% av totalt</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Allt bete förbrukat</p>
                  <p className="text-2xl font-bold text-red-400">{monthTotalAll}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {monthTotalPartial > 0 ? `+ ${monthTotalPartial} delvis` : 'stationer'}
                  </p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avvikelser</p>
                  <p className={`text-2xl font-bold ${monthTotalAnnotations > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{monthTotalAnnotations}</p>
                  <p className="text-xs text-slate-500 mt-0.5">registrerade</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Regioner genomförda</p>
                  <p className="text-2xl font-bold text-white">{monthData.filter(c => c.inspected === c.total && c.total > 0).length}/{monthData.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">av {monthData.length} regioner</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Aktiva hotspots</p>
                  <p className={`text-2xl font-bold ${activeHotspots.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {activeHotspots.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hotspots.filter(h => h.improved).length > 0 ? `${hotspots.filter(h => h.improved).length} förbättrade` : '3+ månader i rad'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Region-cards ── */}
            {monthData.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Regioner — {fmtMonthYear(selectedMonth + '-01')}</p>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {monthData.map(c => {
                    const pct = c.total > 0 ? Math.round(c.inspected / c.total * 100) : 0
                    const baitTotal = c.baitAll + c.baitPartial + c.baitNone
                    const isSelected = selectedRegion?.caseId === c.caseId
                    const hasHotspot = hotspotRegionIds.has(c.regionId)
                    return (
                      <button
                        key={c.caseId}
                        type="button"
                        onClick={() => setSelectedRegion(isSelected ? null : c)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-sky-500/10 border-sky-500/40'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {hasHotspot && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-0.5" title="Aktiv hotspot" />}
                            <p className="text-sm font-semibold text-white leading-tight truncate">{c.regionName}</p>
                          </div>
                          <span className={`text-xs font-bold ml-2 flex-shrink-0 ${pct === 100 ? 'text-emerald-400' : 'text-slate-400'}`}>{pct}%</span>
                        </div>
                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{c.inspected}/{c.total} stationer</p>
                        {baitTotal > 0 && (
                          <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700 gap-px mb-2">
                            {c.baitAll > 0 && <div className="bg-red-500" style={{ width: `${c.baitAll / baitTotal * 100}%` }} />}
                            {c.baitPartial > 0 && <div className="bg-amber-500" style={{ width: `${c.baitPartial / baitTotal * 100}%` }} />}
                            {c.baitNone > 0 && <div className="bg-emerald-500" style={{ width: `${c.baitNone / baitTotal * 100}%` }} />}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          {c.baitAll > 0 && <span className="text-red-400">Allt: {c.baitAll}</span>}
                          {c.baitPartial > 0 && <span className="text-amber-400">Delvis: {c.baitPartial}</span>}
                          {c.annotations.length > 0 && <span className="text-orange-400">⚠ {c.annotations.length}</span>}
                          {c.scheduledStart && (
                            <span className="ml-auto flex items-center gap-1 text-slate-600">
                              <Calendar className="w-3 h-3" />{fmtDate(c.scheduledStart)}
                            </span>
                          )}
                        </div>
                        {c.technicianName && (
                          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-600">
                            <User className="w-3 h-3" />{c.technicianName}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Detaljvy för vald region ── */}
            {selectedRegion && (
              <div className="bg-slate-800/50 border border-sky-500/30 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{selectedRegion.regionName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedRegion.inspected}/{selectedRegion.total} stationer kontrollerade
                      {selectedRegion.scheduledStart && ` · ${fmtDate(selectedRegion.scheduledStart)}`}
                      {selectedRegion.technicianName && ` · ${selectedRegion.technicianName}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedRegion(null)} className="p-1 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  {/* Beteåtgång */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Beteåtgång</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                        <p className="text-lg font-bold text-red-400">{selectedRegion.baitAll}</p>
                        <p className="text-[11px] text-slate-500">Allt förbrukat</p>
                      </div>
                      <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                        <p className="text-lg font-bold text-amber-400">{selectedRegion.baitPartial}</p>
                        <p className="text-[11px] text-slate-500">Delvis förbrukat</p>
                      </div>
                      <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                        <p className="text-lg font-bold text-emerald-400">{selectedRegion.baitNone}</p>
                        <p className="text-[11px] text-slate-500">Inget förbrukat</p>
                      </div>
                    </div>
                  </div>

                  {/* Avvikelser för regionen */}
                  {selectedRegion.annotations.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Avvikelser ({selectedRegion.annotations.length})</p>
                      <div className="space-y-2">
                        {selectedRegion.annotations.map(ann => {
                          const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
                          return (
                            <div key={ann.id} className="flex items-start gap-3 px-3 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs">
                              <span className="text-base leading-none mt-0.5">{cat.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-orange-300">{cat.label}</p>
                                {ann.note && <p className="text-slate-400 mt-0.5">{ann.note}</p>}
                                <p className="text-slate-600 mt-1">
                                  {ann.technician_name && `${ann.technician_name} · `}
                                  {ann.created_at ? fmtDate(ann.created_at) : ''}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-600">
                      <CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                      Inga avvikelser registrerade
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Trendgraf ── */}
            {allMonthsAggregated.length >= 2 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-sm font-semibold text-white mb-0.5">Aktivitetsutveckling — alla regioner</p>
                <p className="text-xs text-slate-500 mb-4">Aggregerat beteåtgång per månad. Minskande rött = lyckad bekämpning.</p>
                <div className="flex items-center gap-4 mb-3 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Allt förbrukat</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />Delvis</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Inget</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={allMonthsAggregated} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                    <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                      itemStyle={{ color: '#cbd5e1' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="all" name="Allt" fill="#ef4444" radius={[3,3,0,0]} isAnimationActive={false} />
                    <Bar dataKey="partial" name="Delvis" fill="#f59e0b" radius={[3,3,0,0]} isAnimationActive={false} />
                    <Bar dataKey="none" name="Inget" fill="#22c55e" radius={[3,3,0,0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Avvikelse-sektion ── */}
            {allAnnotations.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    Avvikelser — {fmtMonthYear(selectedMonth + '-01')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{allAnnotations.length} avvikelse{allAnnotations.length !== 1 ? 'r' : ''} registrerade under månaden</p>
                </div>
                <div className="p-4">
                  {/* Gruppera per kategori */}
                  {(Object.keys(ANNOTATION_CATEGORIES) as RonderingAnnotationCategory[]).map(catKey => {
                    const catAnnotations = allAnnotations.filter(a => a.category === catKey)
                    if (catAnnotations.length === 0) return null
                    const cat = ANNOTATION_CATEGORIES[catKey]
                    return (
                      <div key={catKey} className="mb-4 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">{cat.emoji}</span>
                          <p className="text-xs font-semibold text-slate-300">{cat.label}</p>
                          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400">{catAnnotations.length}</span>
                        </div>
                        <div className="space-y-1.5 ml-6">
                          {catAnnotations.map(ann => {
                            const regionName = monthData.find(c => c.caseId === ann.case_id)?.regionName ?? caseRegionMap[ann.case_id] ?? '—'
                            return (
                              <div key={ann.id} className="flex items-start gap-3 px-3 py-2 bg-slate-900/40 border border-slate-700/50 rounded-lg text-xs">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-slate-200">{regionName}</span>
                                    {ann.note && <span className="text-slate-400">— {ann.note}</span>}
                                  </div>
                                  <p className="text-slate-600 mt-0.5">
                                    {ann.technician_name && `${ann.technician_name} · `}
                                    {ann.created_at ? fmtDate(ann.created_at) : ''}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Hotspot-karta ── */}
            {(hotspots.length > 0 || allAnnotations.length > 0 || geoClusters.length > 0) && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Map className="w-4 h-4 text-orange-400" />
                      Hotspot-karta — alla regioner
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Avvikelser från {fmtMonthYear(selectedMonth + '-01')} + stationer med långvarig hög aktivitet</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    {hotspots.filter(h => !h.improved).length > 0 && (
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{hotspots.filter(h => !h.improved).length} hotspot{hotspots.filter(h => !h.improved).length !== 1 ? 's' : ''}</span>
                    )}
                    {hotspots.filter(h => h.improved).length > 0 && (
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />{hotspots.filter(h => h.improved).length} förbättrade</span>
                    )}
                    {geoClusters.length > 0 && (
                      <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full border-2 border-red-500 inline-block opacity-60" />{geoClusters.length} kluster</span>
                    )}
                    {allAnnotations.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[9px] border-l-transparent border-r-transparent border-b-orange-500" />
                        {allAnnotations.length} avvikelse{allAnnotations.length !== 1 ? 'r' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <OverviewMap
                    hotspots={hotspots}
                    geoClusters={geoClusters}
                    annotations={allAnnotations}
                    isLoaded={mapsLoaded}
                    highlightRegionId={selectedRegion?.regionId ?? null}
                  />
                </div>
              </div>
            )}

            {/* ── Hotspot-lista ── */}
            {(hotspots.length > 0 || geoClusters.length > 0) && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Hotspots &amp; förbättrade stationer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Stationer med 3+ månader konsekutiv hög aktivitet, geografiska kluster, och stationer som förbättrats</p>
                </div>
                <div className="p-4 space-y-3">
                  {geoClusters.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Geografiska kluster (300m-radie, 3+ stationer)</p>
                      <div className="space-y-2">
                        {geoClusters.map((cluster, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
                            <span className="w-3 h-3 rounded-full border-2 border-red-400 opacity-80 flex-shrink-0" />
                            <span className="text-red-300 font-semibold">Kluster {i + 1}</span>
                            <span className="text-slate-400">{cluster.stations.length} stationer med hög aktivitet inom 300m</span>
                            <span className="ml-auto text-slate-500">{cluster.center.lat.toFixed(4)}, {cluster.center.lng.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hotspots.filter(h => !h.improved).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ihållande hotspots (3+ månader i rad)</p>
                      <div className="rounded-lg overflow-hidden border border-slate-700 text-xs">
                        <div className="grid grid-cols-3 bg-slate-900/60">
                          <div className="px-3 py-2 font-semibold text-slate-400">Station</div>
                          <div className="px-3 py-2 font-semibold text-slate-400 text-center">Månader i rad</div>
                          <div className="px-3 py-2 font-semibold text-slate-400">Status</div>
                        </div>
                        {hotspots.filter(h => !h.improved).sort((a,b) => b.consecutiveMonths - a.consecutiveMonths).map((h, i) => (
                          <div key={h.stationId} className={`grid grid-cols-3 border-t border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-900/40'}`}>
                            <div className="px-3 py-2 font-mono text-slate-200">{h.serialNumber || h.stationId.slice(0, 8)}</div>
                            <div className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 font-semibold">{h.consecutiveMonths}×</span></div>
                            <div className="px-3 py-2 text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Kräver åtgärd</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hotspots.filter(h => h.improved).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Förbättrade stationer</p>
                      <div className="rounded-lg overflow-hidden border border-slate-700 text-xs">
                        <div className="grid grid-cols-3 bg-slate-900/60">
                          <div className="px-3 py-2 font-semibold text-slate-400">Station</div>
                          <div className="px-3 py-2 font-semibold text-slate-400 text-center">Historik (allt förbrukat)</div>
                          <div className="px-3 py-2 font-semibold text-slate-400">Status</div>
                        </div>
                        {hotspots.filter(h => h.improved).map((h, i) => (
                          <div key={h.stationId} className={`grid grid-cols-3 border-t border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-900/40'}`}>
                            <div className="px-3 py-2 font-mono text-slate-200">{h.serialNumber || h.stationId.slice(0, 8)}</div>
                            <div className="px-3 py-2 text-center text-slate-400">2+ månader</div>
                            <div className="px-3 py-2 text-emerald-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Förbättrad</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {monthData.length === 0 && !loading && (
              <div className="py-16 text-center">
                <Map className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">Inga ronderingsärenden för {fmtMonthYear(selectedMonth + '-01')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
