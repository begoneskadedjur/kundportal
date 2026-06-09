// src/pages/admin/RonderingPage.tsx
// Egenkontroll-översikt — månadsvy över alla regioner för en organisation

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useGoogleMaps } from '../../hooks/useGoogleMaps'
import { RonderingService } from '../../services/ronderingService'
import type { RonderingAnnotation, RonderingAnnotationCategory } from '../../services/ronderingService'
import { ANNOTATION_CATEGORIES } from '../../services/ronderingService'
import {
  Map as MapIcon, Building2, FileDown, ChevronLeft, ChevronRight,
  AlertCircle, TrendingDown, CheckCircle, X, User, Calendar, ClipboardCheck,
  ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { EgenkontrollService, EGENKONTROLL_ITEMS } from '../../services/egenkontrollService'
import type { EgenkontrollStationReview } from '../../services/egenkontrollService'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { generateRonderingPdf } from '../../utils/ronderingPdfGenerator'
import { CaseImageService } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import ImageLightbox from '../../components/shared/ImageLightbox'
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
  address?: string
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

// DBSCAN: korrekt täthetbaserad klustring — expanderar rekursivt från kärnpunkter
// Undviker "pärlbandskluster" som uppstår när man bara kollar avstånd från ursprungsstationen
function dbscanCluster(stations: StationCoord[], eps = 400, minPts = 4): GeoCluster[] {
  const n = stations.length
  const labels = new Array<number>(n).fill(-2)  // -2 = ej besökt, -1 = noise
  let clusterId = 0

  const getNeighbors = (idx: number): number[] =>
    stations.reduce<number[]>((acc, _, j) => {
      if (idx !== j && haversineMeters(stations[idx].lat, stations[idx].lng, stations[j].lat, stations[j].lng) <= eps)
        acc.push(j)
      return acc
    }, [])

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue
    const nb = getNeighbors(i)
    if (nb.length < minPts - 1) { labels[i] = -1; continue }
    labels[i] = clusterId
    const queue = [...nb]
    while (queue.length) {
      const q = queue.shift()!
      if (labels[q] === -1) labels[q] = clusterId
      if (labels[q] !== -2) continue
      labels[q] = clusterId
      const qnb = getNeighbors(q)
      if (qnb.length >= minPts - 1) queue.push(...qnb)
    }
    clusterId++
  }

  const result: GeoCluster[] = []
  for (let c = 0; c < clusterId; c++) {
    const members = stations.filter((_, i) => labels[i] === c)
    if (members.length === 0) continue
    const centerLat = members.reduce((s, m) => s + m.lat, 0) / members.length
    const centerLng = members.reduce((s, m) => s + m.lng, 0) / members.length
    result.push({ center: { lat: centerLat, lng: centerLng }, stations: members })
  }
  return result.sort((a, b) => b.stations.length - a.stations.length)
}

// ── Kartan ────────────────────────────────────────────────────────────────────

interface OverviewMapProps {
  hotspots: HotspotStation[]
  geoClusters: GeoCluster[]
  annotations: RonderingAnnotation[]
  isLoaded: boolean
  highlightRegionId: string | null
  highlightStationId: string | null
  highlightClusterIdx: number | null
  highlightAnnotationId: string | null
  onClusterClick?: (center: { lat: number; lng: number }) => void
}

function OverviewMap({ hotspots, geoClusters, annotations, isLoaded, highlightRegionId, highlightStationId, highlightClusterIdx, highlightAnnotationId, onClusterClick }: OverviewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const circlesRef = useRef<google.maps.Circle[]>([])
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseMarkerRef = useRef<google.maps.Marker | null>(null)
  const pulseCircleRef = useRef<google.maps.Circle | null>(null)

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
    circlesRef.current.forEach(c => c.setMap(null))
    circlesRef.current = []

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

    // Kluster: täckningscirkel + individuella stationspunkter
    geoClusters.forEach(cluster => {
      bounds.extend(cluster.center); hasPoints = true

      // Beräkna dynamisk radie = max avstånd från center till någon station
      const radius = Math.max(
        200,
        ...cluster.stations.map(s => haversineMeters(cluster.center.lat, cluster.center.lng, s.lat, s.lng))
      )

      // Täckningscirkel för klustrets utbredning
      const circle = new google.maps.Circle({
        center: cluster.center,
        radius,
        map: gMapRef.current!,
        fillColor: '#ef4444',
        fillOpacity: 0.10,
        strokeColor: '#ef4444',
        strokeWeight: 1.5,
        strokeOpacity: 0.6,
        zIndex: 3,
        clickable: true,
      })
      const clusterInfo = new google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;padding:4px"><b style="color:#ef4444">Riskzon</b><br><span style="font-size:12px">${cluster.stations.length} stationer med hög aktivitet senaste månaden</span>${cluster.address ? `<br><span style="font-size:11px;color:#64748b">${cluster.address}</span>` : ''}</div>`
      })
      circle.addListener('click', () => {
        clusterInfo.setPosition(cluster.center)
        clusterInfo.open(gMapRef.current!)
        onClusterClick?.(cluster.center)
      })
      circlesRef.current.push(circle)
      // Stationspunkter inuti riskzoner visas inte — zonen som helhet är det viktiga
    })

    annotations.forEach(ann => {
      const cat = ANNOTATION_CATEGORIES[ann.category as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
      bounds.extend({ lat: ann.latitude, lng: ann.longitude }); hasPoints = true
      // Avvikelse-ikon: fylld cirkel med vit ring — tydligare än triangel
      const marker = new google.maps.Marker({
        position: { lat: ann.latitude, lng: ann.longitude },
        map: gMapRef.current!,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#f97316', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
        label: { text: '!', color: '#fff', fontSize: '11px', fontWeight: 'bold' },
        title: cat.label, zIndex: 15,
      })
      const info = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;padding:4px"><b style="color:#f97316">${cat.label}</b>${ann.note ? `<br><span style="font-size:12px">${ann.note}</span>` : ''}${ann.technician_name ? `<br><span style="font-size:11px;color:#64748b">${ann.technician_name}</span>` : ''}</div>` })
      marker.addListener('click', () => info.open(gMapRef.current!, marker))
      markersRef.current.push(marker)
    })

    if (hasPoints && gMapRef.current) gMapRef.current.fitBounds(bounds, 60)
  }, [isLoaded, hotspots, geoClusters, annotations])

  // Pulserande markör när en riskstation klickas
  useEffect(() => {
    if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null }
    if (pulseMarkerRef.current) { pulseMarkerRef.current.setMap(null); pulseMarkerRef.current = null }
    if (!highlightStationId || !isLoaded || !gMapRef.current) return

    const h = hotspots.find(s => s.stationId === highlightStationId)
    if (!h) return

    gMapRef.current.panTo({ lat: h.lat, lng: h.lng })
    gMapRef.current.setZoom(16)

    const pulse = new google.maps.Marker({
      position: { lat: h.lat, lng: h.lng },
      map: gMapRef.current,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#ef4444', fillOpacity: 0.4, strokeColor: '#ef4444', strokeWeight: 2 },
      zIndex: 20,
    })
    pulseMarkerRef.current = pulse

    let big = true
    pulseRef.current = setInterval(() => {
      big = !big
      pulse.setIcon({ path: google.maps.SymbolPath.CIRCLE, scale: big ? 14 : 9, fillColor: '#ef4444', fillOpacity: big ? 0.4 : 0.8, strokeColor: '#ef4444', strokeWeight: 2 })
    }, 500)

    return () => {
      if (pulseRef.current) clearInterval(pulseRef.current)
      pulse.setMap(null)
    }
  }, [highlightStationId, isLoaded, hotspots])

  // Pulserande cirkel när en riskzon klickas
  useEffect(() => {
    if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null }
    if (pulseCircleRef.current) { pulseCircleRef.current.setMap(null); pulseCircleRef.current = null }
    if (highlightClusterIdx === null || !isLoaded || !gMapRef.current) return
    const cluster = geoClusters[highlightClusterIdx]
    if (!cluster) return

    gMapRef.current.panTo(cluster.center)
    gMapRef.current.setZoom(14)

    const radius = Math.max(200, ...cluster.stations.map(s => haversineMeters(cluster.center.lat, cluster.center.lng, s.lat, s.lng)))
    const ring = new google.maps.Circle({
      center: cluster.center, radius: radius * 1.3,
      map: gMapRef.current,
      fillColor: '#ef4444', fillOpacity: 0.15,
      strokeColor: '#ef4444', strokeWeight: 3, strokeOpacity: 1,
      zIndex: 20,
    })
    pulseCircleRef.current = ring

    let thick = true
    pulseRef.current = setInterval(() => {
      thick = !thick
      ring.setOptions({ strokeWeight: thick ? 3 : 1.5, fillOpacity: thick ? 0.15 : 0.05 })
    }, 600)

    return () => {
      if (pulseRef.current) clearInterval(pulseRef.current)
      ring.setMap(null)
    }
  }, [highlightClusterIdx, isLoaded, geoClusters])

  // Pulserande markör när en avvikelse klickas
  useEffect(() => {
    if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null }
    if (pulseMarkerRef.current) { pulseMarkerRef.current.setMap(null); pulseMarkerRef.current = null }
    if (!highlightAnnotationId || !isLoaded || !gMapRef.current) return
    const ann = annotations.find(a => a.id === highlightAnnotationId)
    if (!ann) return

    gMapRef.current.panTo({ lat: ann.latitude, lng: ann.longitude })
    gMapRef.current.setZoom(17)

    const pulse = new google.maps.Marker({
      position: { lat: ann.latitude, lng: ann.longitude },
      map: gMapRef.current,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: '#f97316', fillOpacity: 0.3, strokeColor: '#f97316', strokeWeight: 2.5 },
      zIndex: 25,
    })
    pulseMarkerRef.current = pulse

    let big = true
    pulseRef.current = setInterval(() => {
      big = !big
      pulse.setIcon({ path: google.maps.SymbolPath.CIRCLE, scale: big ? 16 : 10, fillColor: '#f97316', fillOpacity: big ? 0.3 : 0.6, strokeColor: '#f97316', strokeWeight: 2.5 })
    }, 500)

    return () => {
      if (pulseRef.current) clearInterval(pulseRef.current)
      pulse.setMap(null)
    }
  }, [highlightAnnotationId, isLoaded, annotations])

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

  const [annotationImages, setAnnotationImages] = useState<Record<string, CaseImageWithUrl[]>>({})
  const [annotationAddresses, setAnnotationAddresses] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ images: { url: string; alt?: string }[]; index: number } | null>(null)
  const [highlightStationId, setHighlightStationId] = useState<string | null>(null)
  const [highlightClusterIdx, setHighlightClusterIdx] = useState<number | null>(null)
  const [highlightAnnotationId, setHighlightAnnotationId] = useState<string | null>(null)

  const [exportingPdf, setExportingPdf] = useState(false)

  // Egenkontroll
  const [egenkontrollCases, setEgenkontrollCases] = useState<Array<{
    id: string; caseNumber: string | null; regionId: string; regionName: string
    scheduledStart: string | null; status: string; technicianName: string | null
    reviews: EgenkontrollStationReview[]
  }>>([])
  const [expandedEgenkontroll, setExpandedEgenkontroll] = useState<string | null>(null)
  const [expandedEgenkontrollStation, setExpandedEgenkontrollStation] = useState<string | null>(null)

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
      setAnnotationImages({})
      setAnnotationAddresses({})

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

          if (consec >= 2 || improved) {
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
        setGeoClusters(dbscanCluster(highActivityStations, 250, 4))

        // Ladda egenkontrollärenden för samma organisation parallellt
        const { data: ekCases } = await supabase
          .from('cases')
          .select('id, case_number, customer_id, scheduled_start, status, primary_technician_name')
          .eq('service_type', 'egenkontroll_trafikkontoret')
          .in('customer_id', siteIds)
          .order('scheduled_start', { ascending: false })

        if (ekCases && ekCases.length > 0) {
          const ekEnriched = await Promise.all(
            ekCases.map(async (c) => {
              const reviews = await EgenkontrollService.getReviews(c.id)
              return {
                id: c.id,
                caseNumber: c.case_number,
                regionId: c.customer_id,
                regionName: siteNameMap[c.customer_id] || c.customer_id,
                scheduledStart: c.scheduled_start,
                status: c.status,
                technicianName: c.primary_technician_name,
                reviews,
              }
            })
          )
          setEgenkontrollCases(ekEnriched)
        } else {
          setEgenkontrollCases([])
        }
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
    const deduped = latestPerRegionPerMonth(forMonth)
    setMonthData(deduped)

    // Hämta bilder för alla avvikelser i denna månad
    const allAnns = deduped.flatMap(c => c.annotations)
    if (allAnns.length === 0) return
    const uniqueCaseIds = [...new Set(allAnns.map(a => a.case_id))]
    Promise.all(
      uniqueCaseIds.map(caseId => CaseImageService.getCaseImages(caseId, 'contract'))
    ).then(results => {
      const allImgs = results.flat()
      const byAnnotation: Record<string, CaseImageWithUrl[]> = {}
      for (const ann of allAnns) {
        byAnnotation[ann.id] = allImgs.filter(img => img.description === `annotation:${ann.id}`)
      }
      setAnnotationImages(byAnnotation)
    }).catch(() => {/* bilder är inte kritiska */})

    // Reverse geocoding för avvikelse-koordinater
    if (typeof google !== 'undefined' && google.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder()
      const addresses: Record<string, string> = {}
      Promise.allSettled(
        allAnns.map(ann =>
          new Promise<void>(resolve => {
            geocoder.geocode({ location: { lat: ann.latitude, lng: ann.longitude } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                addresses[ann.id] = results[0].formatted_address
              }
              resolve()
            })
          })
        )
      ).then(() => setAnnotationAddresses(addresses))
    }
  }, [allEnriched, selectedMonth])

  // Geocoda klustercentra → adress för listan
  useEffect(() => {
    if (geoClusters.length === 0) return
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return
    const geocoder = new google.maps.Geocoder()
    Promise.allSettled(
      geoClusters.map((cluster, i) =>
        new Promise<{ i: number; address: string }>(resolve => {
          geocoder.geocode({ location: cluster.center }, (results, status) => {
            const address = status === 'OK' && results?.[0] ? results[0].formatted_address : ''
            resolve({ i, address })
          })
        })
      )
    ).then(settled => {
      setGeoClusters(prev => prev.map((c, i) => {
        const result = settled.find(s => s.status === 'fulfilled' && (s as any).value.i === i)
        return result && result.status === 'fulfilled' ? { ...c, address: (result as any).value.address } : c
      }))
    })
  }, [geoClusters.length, mapsLoaded])

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
            <div className="text-center"><MapIcon className="w-10 h-10 mx-auto mb-2 text-slate-600" /><p>Välj en kund</p></div>
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
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riskstationer</p>
                  <p className={`text-2xl font-bold ${activeHotspots.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {activeHotspots.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hotspots.filter(h => h.improved).length > 0 ? `${hotspots.filter(h => h.improved).length} förbättrade` : '2 månader i rad med hög beteåtgång'}
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
                          const imgs = annotationImages[ann.id] ?? []
                          const address = annotationAddresses[ann.id]
                          return (
                            <div key={ann.id} className="px-3 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs space-y-1.5">
                              <p className="font-semibold text-orange-300">{cat.label}</p>
                              {address && <p className="text-slate-400 text-[11px]">{address}</p>}
                              <p className="text-slate-600 font-mono text-[11px]">
                                {ann.latitude.toFixed(5)}, {ann.longitude.toFixed(5)}
                              </p>
                              {ann.note && <p className="text-slate-400">{ann.note}</p>}
                              <p className="text-slate-600">
                                {ann.technician_name && `${ann.technician_name} · `}
                                {ann.created_at ? fmtDate(ann.created_at) : ''}
                              </p>
                              {imgs.length > 0 && (
                                <div className="flex gap-2 flex-wrap pt-1">
                                  {imgs.map((img, idx) => (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={() => setLightbox({ images: imgs.map(i => ({ url: i.url, alt: i.file_name || '' })), index: idx })}
                                      className="w-16 h-16 rounded-lg overflow-hidden border border-orange-500/30 hover:border-orange-400/60 flex-shrink-0 transition-colors"
                                    >
                                      <img src={img.url} alt={img.file_name || ''} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
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
                  <LineChart data={allMonthsAggregated} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                    <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                      itemStyle={{ color: '#cbd5e1' }}
                      cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <Line type="monotone" dataKey="all" name="Allt" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="partial" name="Delvis" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="none" name="Inget" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: '#22c55e' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  </LineChart>
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
                  {(Object.keys(ANNOTATION_CATEGORIES) as RonderingAnnotationCategory[]).map(catKey => {
                    const catAnnotations = allAnnotations.filter(a => a.category === catKey)
                    if (catAnnotations.length === 0) return null
                    const cat = ANNOTATION_CATEGORIES[catKey]
                    return (
                      <div key={catKey} className="mb-4 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-semibold text-slate-300">{cat.label}</p>
                          {catAnnotations.length > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400">{catAnnotations.length}</span>
                          )}
                        </div>
                        <div className="space-y-2 ml-2">
                          {catAnnotations.map(ann => {
                            const regionName = monthData.find(c => c.caseId === ann.case_id)?.regionName ?? caseRegionMap[ann.case_id] ?? '—'
                            const imgs = annotationImages[ann.id] ?? []
                            const address = annotationAddresses[ann.id]
                            const isActive = highlightAnnotationId === ann.id
                            return (
                              <div key={ann.id} className={`px-3 py-2.5 rounded-lg border text-xs space-y-1.5 transition-all ${isActive ? 'bg-orange-500/15 border-orange-400/50' : 'bg-slate-900/40 border-slate-700/50'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="font-medium text-slate-200">{regionName}</span>
                                    {ann.note && <span className="text-slate-400">— {ann.note}</span>}
                                  </div>
                                  <button
                                    type="button"
                                    title="Visa på karta"
                                    onClick={() => {
                                      setHighlightAnnotationId(isActive ? null : ann.id)
                                      setHighlightStationId(null)
                                      setHighlightClusterIdx(null)
                                      if (!isActive) document.getElementById('hotspot-map-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                    }}
                                    className={`flex-shrink-0 p-1 rounded transition-colors ${isActive ? 'text-orange-400' : 'text-slate-600 hover:text-orange-400'}`}
                                  >
                                    <MapIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {address && <p className="text-slate-400 text-[11px]">{address}</p>}
                                <p className="text-slate-600 font-mono text-[11px]">
                                  {ann.latitude.toFixed(5)}, {ann.longitude.toFixed(5)}
                                </p>
                                <p className="text-slate-600">
                                  {ann.technician_name && `${ann.technician_name} · `}
                                  {ann.created_at ? fmtDate(ann.created_at) : ''}
                                </p>
                                {imgs.length > 0 && (
                                  <div className="flex gap-2 flex-wrap pt-1">
                                    {imgs.map((img, idx) => (
                                      <button
                                        key={img.id}
                                        type="button"
                                        onClick={() => setLightbox({ images: imgs.map(i => ({ url: i.url, alt: i.file_name || '' })), index: idx })}
                                        className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-500 flex-shrink-0 transition-colors"
                                      >
                                        <img src={img.url} alt={img.file_name || ''} className="w-full h-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                )}
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
              <div id="hotspot-map-section" className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <MapIcon className="w-4 h-4 text-orange-400" />
                      Hotspot-karta — alla regioner
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Riskstationer, riskzoner och avvikelser — {fmtMonthYear(selectedMonth + '-01')}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    {hotspots.filter(h => !h.improved).length > 0 && (
                      <span title="Enskilda stationer där allt bete förbrukats 2 månader i rad. Indikerar ett ihållande gnagarproblem på just den platsen." className="flex items-center gap-1.5 cursor-help">
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                        {hotspots.filter(h => !h.improved).length} riskstation{hotspots.filter(h => !h.improved).length !== 1 ? 'er' : ''}
                      </span>
                    )}
                    {hotspots.filter(h => h.improved).length > 0 && (
                      <span title="Stationer som tidigare haft hög beteåtgång 2+ månader men där senaste ronderingen visar lägre förbrukning — en positiv trend." className="flex items-center gap-1.5 cursor-help">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                        {hotspots.filter(h => h.improved).length} förbättrade
                      </span>
                    )}
                    {geoClusters.length > 0 && (
                      <span title="Geografiska områden där många stationer haft hög beteåtgång senaste månaden. Visar var gnagarnärvaron är koncentrerad — inget historikkrav." className="flex items-center gap-1.5 cursor-help">
                        <span className="w-4 h-4 rounded-full border-2 border-red-500 inline-block opacity-60" />
                        {geoClusters.length} riskzon{geoClusters.length !== 1 ? 'er' : ''}
                      </span>
                    )}
                    {allAnnotations.length > 0 && (
                      <span title="Platsspecifika observationer registrerade av tekniker under ronderingen — t.ex. nedskräpning, vegetation, skador eller verksamheter som drar till sig gnagare." className="flex items-center gap-1.5 cursor-help">
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
                    highlightStationId={highlightStationId}
                    highlightClusterIdx={highlightClusterIdx}
                    highlightAnnotationId={highlightAnnotationId}
                    onClusterClick={_center => {/* kartan hanterar zoom internt via circle click */}}
                  />
                  <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-x-5 gap-y-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span><span className="text-slate-400 font-medium">Riskstation</span> — hög beteåtgång 2 månader i rad</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="w-3 h-3 rounded-full border border-red-500 opacity-70 flex-shrink-0" />
                      <span><span className="text-slate-400 font-medium">Riskzon</span> — geografisk koncentration av hög aktivitet senaste månaden, förhöjd gnagarnärvaro i området</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-orange-500 flex-shrink-0" />
                      <span><span className="text-slate-400 font-medium">Avvikelse</span> — registrerad avvikelse av tekniker under ronderingen</span>
                    </span>
                    {hotspots.filter(h => h.improved).length > 0 && (
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span><span className="text-slate-400 font-medium">Förbättrad station</span> — tidigare hög aktivitet, senaste rondering visar lägre beteåtgång</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Hotspot-lista ── */}
            {(hotspots.length > 0 || geoClusters.length > 0) && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Riskstationer &amp; geografiska riskzoner
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Stationer med hög beteåtgång 2 månader i rad · Riskzoner: 4+ stationer inom 250m med hög aktivitet senaste månaden · Förbättrade stationer</p>
                </div>
                <div className="p-4 space-y-3">
                  {geoClusters.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Geografiska riskzoner — {geoClusters.length} kluster
                      </p>
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                        {geoClusters.slice().sort((a, b) => b.stations.length - a.stations.length).map((cluster, sortedIdx) => {
                          const origIdx = geoClusters.indexOf(cluster)
                          const isActive = highlightClusterIdx === origIdx
                          return (
                            <button
                              key={origIdx}
                              type="button"
                              title="Klicka för att visa på kartan"
                              onClick={() => {
                                setHighlightClusterIdx(isActive ? null : origIdx)
                                setHighlightStationId(null)
                                setHighlightAnnotationId(null)
                                if (!isActive) document.getElementById('hotspot-map-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }}
                              className={`text-left px-3 py-3 rounded-xl border text-xs space-y-1 transition-all ${
                                isActive
                                  ? 'bg-red-500/20 border-red-400/60'
                                  : 'bg-red-500/10 border-red-500/20 hover:border-red-400/40 hover:bg-red-500/15'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-red-400 animate-pulse' : 'bg-red-500'}`} />
                                <span className="font-semibold text-red-300">{cluster.stations.length} stationer</span>
                              </div>
                              {cluster.address
                                ? <p className={`leading-snug line-clamp-2 ${isActive ? 'text-white' : 'text-slate-300'}`}>{cluster.address}</p>
                                : <p className="text-slate-500 font-mono">{cluster.center.lat.toFixed(4)}, {cluster.center.lng.toFixed(4)}</p>
                              }
                              <p className="text-slate-600 font-mono text-[10px]">{cluster.center.lat.toFixed(4)}, {cluster.center.lng.toFixed(4)}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {hotspots.filter(h => !h.improved).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Riskstationer — hög aktivitet 2 månader i rad ({hotspots.filter(h => !h.improved).length} st)
                      </p>
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-1.5">
                        {hotspots.filter(h => !h.improved).sort((a, b) => b.consecutiveMonths - a.consecutiveMonths).map(h => {
                          const isActive = highlightStationId === h.stationId
                          return (
                            <button
                              key={h.stationId}
                              type="button"
                              title="Klicka för att visa på kartan"
                              onClick={() => {
                                setHighlightStationId(isActive ? null : h.stationId)
                                if (!isActive) document.getElementById('hotspot-map-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all text-left ${
                                isActive
                                  ? 'bg-red-500/15 border-red-400/60 text-white'
                                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                              }`}
                            >
                              <span className="font-mono">{h.serialNumber || h.stationId.slice(0, 8)}</span>
                              <span className={`text-[11px] ${isActive ? 'text-red-300' : 'text-slate-500'}`}>{h.consecutiveMonths}×</span>
                            </button>
                          )
                        })}
                      </div>
                      {highlightStationId && hotspots.find(h => h.stationId === highlightStationId && !h.improved) && (
                        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                          Visar station {hotspots.find(h => h.stationId === highlightStationId)?.serialNumber ?? ''} på kartan — klicka igen för att avmarkera
                        </p>
                      )}
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
                <MapIcon className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">Inga ronderingsärenden för {fmtMonthYear(selectedMonth + '-01')}</p>
              </div>
            )}

            {/* ── Egenkontroller ──────────────────────────────────────── */}
            {(() => {
              const monthEk = egenkontrollCases.filter(ek =>
                ek.scheduledStart && toMonthKey(ek.scheduledStart) === selectedMonth
              )
              if (monthEk.length === 0) return null
              return (
                <div className="mt-4 p-4 bg-slate-800/20 border border-emerald-500/20 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                    Egenkontrollen {fmtMonthYear(selectedMonth + '-01')}
                    <span className="text-xs text-slate-400 font-normal">({monthEk.length} besök)</span>
                  </h3>
                  <div className="space-y-2">
                    {monthEk.map(ek => {
                      const isExp = expandedEgenkontroll === ek.id
                      const totalReviews = ek.reviews.length
                      const fullyReviewed = ek.reviews.filter(r => EgenkontrollService.countChecked(r) === EGENKONTROLL_ITEMS.length).length
                      const partialReviewed = ek.reviews.filter(r => EgenkontrollService.countChecked(r) > 0 && EgenkontrollService.countChecked(r) < EGENKONTROLL_ITEMS.length).length
                      return (
                        <div key={ek.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedEgenkontroll(isExp ? null : ek.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700/30 transition-colors text-left"
                          >
                            {isExp
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            }
                            <span className="text-sm font-medium text-white">{ek.regionName}</span>
                            {ek.scheduledStart && (
                              <span className="text-xs text-slate-400">{fmtDate(ek.scheduledStart)}</span>
                            )}
                            {ek.technicianName && (
                              <span className="text-xs text-slate-400">{ek.technicianName}</span>
                            )}
                            <div className="ml-auto flex items-center gap-2 text-xs">
                              {totalReviews > 0 ? (
                                <>
                                  <span className="text-emerald-400">{fullyReviewed} godkända</span>
                                  {partialReviewed > 0 && <span className="text-amber-400">{partialReviewed} delvis</span>}
                                  <span className="text-slate-400">{totalReviews} stationer</span>
                                </>
                              ) : (
                                <span className="text-slate-500">Inga stationer valda</span>
                              )}
                            </div>
                          </button>
                          {isExp && ek.reviews.length > 0 && (
                            <div className="border-t border-slate-700/50 divide-y divide-slate-700/30">
                              {ek.reviews.map(rev => {
                                const checkedCount = EgenkontrollService.countChecked(rev)
                                const isStationExp = expandedEgenkontrollStation === rev.station_id
                                return (
                                  <div key={rev.station_id}>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedEgenkontrollStation(isStationExp ? null : rev.station_id)}
                                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-700/20 transition-colors text-left"
                                    >
                                      {isStationExp
                                        ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                        : <ChevronRightIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                      }
                                      <span className="text-xs text-slate-200 font-mono">Station {rev.station_id.slice(0, 8)}</span>
                                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                                        checkedCount === EGENKONTROLL_ITEMS.length
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : checkedCount > 0
                                          ? 'bg-amber-500/20 text-amber-300'
                                          : 'bg-slate-700/50 text-slate-400'
                                      }`}>
                                        {checkedCount}/{EGENKONTROLL_ITEMS.length}
                                      </span>
                                    </button>
                                    {isStationExp && (
                                      <div className="px-5 pb-3 pt-1 space-y-1">
                                        {EGENKONTROLL_ITEMS.map(item => (
                                          <div key={item.key} className="flex items-start gap-2 text-xs">
                                            {rev[item.key] ? (
                                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                            ) : (
                                              <AlertCircle className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
                                            )}
                                            <span className={rev[item.key] ? 'text-slate-300' : 'text-slate-500'}>{item.label}</span>
                                          </div>
                                        ))}
                                        {rev.note && (
                                          <p className="text-xs text-amber-300 italic mt-2 pl-5">"{rev.note}"</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {isExp && ek.reviews.length === 0 && (
                            <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-700/50">
                              Inga stationer valda för detta kontrollbesök ännu.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          isOpen={true}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
