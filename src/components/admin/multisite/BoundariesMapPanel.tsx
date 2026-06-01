import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Check, AlertCircle, Pencil, X, Search, Loader2 } from 'lucide-react'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { useGoogleMaps } from '../../../hooks/useGoogleMaps'

interface NominatimResult {
  place_id: number
  display_name: string
  osm_type: string
  osm_id: number
  type: string
  class: string
}

type LatLng = { lat: number; lng: number }

function perpendicularDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const dx = b.lng - a.lng, dy = b.lat - a.lat
  if (dx === 0 && dy === 0) return Math.hypot(p.lng - a.lng, p.lat - a.lat)
  const t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy)
  return Math.hypot(p.lng - (a.lng + t * dx), p.lat - (a.lat + t * dy))
}

function simplifyPolygon(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length <= 4) return points
  let maxDist = 0, maxIdx = 0
  const start = points[0], end = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > tolerance) {
    const left = simplifyPolygon(points.slice(0, maxIdx + 1), tolerance)
    const right = simplifyPolygon(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [start, end]
}

export interface PanelRegion {
  tempId: string
  site_name: string
  region: string
  color: string
  polygon?: Array<{ lat: number; lng: number }> | null
  /** Antal stationer inom polygon (valfritt, visas om skickat) */
  stationCount?: number
}

interface BoundariesMapPanelProps {
  regions: PanelRegion[]
  onPolygonSaved: (tempId: string, path: Array<{ lat: number; lng: number }> | null) => void
  /** Stationer att visa som grå markörer på kartan */
  stations?: Array<{ id: string; latitude: number; longitude: number; assignedRegionTempId?: string | null }>
}

export default function BoundariesMapPanel({
  regions,
  onPolygonSaved,
  stations,
}: BoundariesMapPanelProps) {
  const { isLoaded, error } = useGoogleMaps({ libraries: ['marker', 'geometry'] })
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const drawnPolygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map())
  const stationMarkersRef = useRef<google.maps.Marker[]>([])
  // Manuell ritning
  const drawingPointsRef = useRef<google.maps.Marker[]>([])
  const drawingListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const previewPolylineRef = useRef<google.maps.Polyline | null>(null)
  const rubberBandPosRef = useRef<google.maps.LatLng | null>(null)
  const activeRegionIdRef = useRef<string | null>(null)

  const [activeRegionId, setActiveRegionId] = useState<string | null>(null)
  const [drawingActive, setDrawingActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [noRegionWarning, setNoRegionWarning] = useState(false)

  const activeRegion = regions.find(r => r.tempId === activeRegionId) || null

  useEffect(() => { activeRegionIdRef.current = activeRegionId }, [activeRegionId])

  // Avbryt pågående ritning automatiskt när aktiv region byts
  useEffect(() => {
    if (drawingActive) cancelDrawing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegionId])

  // Nominatim-sökning med 350ms debounce
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); return }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=se&format=json&limit=8&accept-language=sv`
        const res = await fetch(url, { headers: { 'Accept-Language': 'sv' } })
        const data: NominatimResult[] = await res.json()
        setSearchResults(data)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Initialisera karta
  useEffect(() => {
    if (!isLoaded || !mapDivRef.current || mapRef.current) return
    mapRef.current = new google.maps.Map(mapDivRef.current, {
      center: { lat: 59.33, lng: 18.07 },
      zoom: 5,
      mapTypeId: 'roadmap',
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      disableDoubleClickZoom: true,
    })
  }, [isLoaded])

  // Rendera stationsmarkörer
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !stations?.length) return
    stationMarkersRef.current.forEach(m => m.setMap(null))
    stationMarkersRef.current = []

    stations.forEach(s => {
      const assignedRegion = s.assignedRegionTempId
        ? regions.find(r => r.tempId === s.assignedRegionTempId)
        : null
      const color = assignedRegion ? assignedRegion.color : '#64748b'

      const marker = new google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map: mapRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: color,
          fillOpacity: 0.85,
          strokeWeight: 1,
          strokeColor: assignedRegion ? '#fff' : '#94a3b8',
        },
        zIndex: 1,
        clickable: false,
      })
      stationMarkersRef.current.push(marker)
    })
  }, [isLoaded, stations, regions])

  // Uppdatera polygon-opaciteter när aktiv region ändras
  useEffect(() => {
    if (!mapRef.current) return
    regions.forEach(r => {
      const poly = drawnPolygonsRef.current.get(r.tempId)
      if (poly) {
        poly.setOptions({
          strokeColor: r.color,
          fillColor: r.color,
          strokeOpacity: activeRegionId === r.tempId ? 1 : 0.5,
          fillOpacity: activeRegionId === r.tempId ? 0.35 : 0.15,
        })
      }
    })
  }, [activeRegionId, regions])

  const commitPolygon = useCallback((path: Array<{ lat: number; lng: number }>, regionId: string, color: string) => {
    if (!mapRef.current || path.length < 3) return
    const old = drawnPolygonsRef.current.get(regionId)
    if (old) old.setMap(null)

    const polygon = new google.maps.Polygon({
      paths: path,
      strokeColor: color,
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillColor: color,
      fillOpacity: 0.3,
      editable: true,
      zIndex: 2,
      map: mapRef.current,
    })
    drawnPolygonsRef.current.set(regionId, polygon)
    onPolygonSaved(regionId, path)

    const updatePath = () => {
      const newPath = polygon.getPath().getArray().map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }))
      onPolygonSaved(regionId, newPath)
    }
    google.maps.event.addListener(polygon.getPath(), 'set_at', updatePath)
    google.maps.event.addListener(polygon.getPath(), 'insert_at', updatePath)
  }, [onPolygonSaved])

  const applyKommunPolygon = useCallback((geometry: any, regionId: string, color: string) => {
    if (!mapRef.current) return
    const toLatLngs = (ring: number[][]) => ring.map(([lng, lat]) => ({ lat, lng }))
    let paths: Array<{ lat: number; lng: number }>[]
    if (geometry.type === 'Polygon') {
      paths = geometry.coordinates.map(toLatLngs)
    } else if (geometry.type === 'MultiPolygon') {
      paths = geometry.coordinates.flatMap((poly: number[][][]) => poly.map(toLatLngs))
    } else {
      return
    }
    const firstRing = simplifyPolygon(paths[0], 0.0003)
    commitPolygon(firstRing, regionId, color)

    const bounds = new google.maps.LatLngBounds()
    firstRing.forEach(p => bounds.extend(p))
    mapRef.current.fitBounds(bounds)
  }, [commitPolygon])

  const selectNominatimResult = useCallback(async (result: NominatimResult) => {
    let currentId = activeRegionIdRef.current
    // Auto-välj om bara en region finns
    if (!currentId && regions.length === 1) {
      currentId = regions[0].tempId
      setActiveRegionId(currentId)
      activeRegionIdRef.current = currentId
    }
    const region = regions.find(r => r.tempId === currentId)
    setShowDropdown(false)

    if (!region || !currentId) {
      setNoRegionWarning(true)
      setTimeout(() => setNoRegionWarning(false), 3000)
      return
    }

    // Visa kortnamn i sökfältet
    const shortName = result.display_name.split(',')[0].trim()
    setSearchQuery(shortName)
    setNoRegionWarning(false)
    setSearchLoading(true)

    try {
      // Hämta polygon från Nominatim med polygon_geojson=1
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(result.display_name)}&countrycodes=se&format=geojson&polygon_geojson=1&limit=1`
      const res = await fetch(url, { headers: { 'Accept-Language': 'sv' } })
      const data = await res.json()
      const geometry = data?.features?.[0]?.geometry
      if (geometry) {
        applyKommunPolygon(geometry, currentId, region.color)
      }
    } catch {
      // tyst fel — användaren kan rita manuellt
    } finally {
      setSearchLoading(false)
    }
  }, [regions, applyKommunPolygon])

  const cleanupTempDrawing = useCallback(() => {
    drawingPointsRef.current.forEach(m => m.setMap(null))
    drawingPointsRef.current = []
    previewPolylineRef.current?.setMap(null)
    previewPolylineRef.current = null
    rubberBandPosRef.current = null
    drawingListenersRef.current.forEach(l => google.maps.event.removeListener(l))
    drawingListenersRef.current = []
    mapRef.current?.setOptions({ clickableIcons: true })
  }, [])

  const updatePreviewPolyline = useCallback((color: string) => {
    const path = drawingPointsRef.current.map(m => m.getPosition()!)
    if (previewPolylineRef.current) {
      previewPolylineRef.current.setPath(path)
    } else {
      previewPolylineRef.current = new google.maps.Polyline({
        path,
        map: mapRef.current!,
        strokeColor: color,
        strokeWeight: 2,
        strokeOpacity: 0.7,
        strokeDasharray: '4 4',
      } as any)
    }
  }, [])

  const startDrawing = useCallback(() => {
    if (!mapRef.current || !activeRegionId) return
    const region = regions.find(r => r.tempId === activeRegionId)
    const color = region?.color || '#3b82f6'

    const old = drawnPolygonsRef.current.get(activeRegionId)
    if (old) {
      old.setMap(null)
      drawnPolygonsRef.current.delete(activeRegionId)
      onPolygonSaved(activeRegionId, null)
    }
    cleanupTempDrawing()
    setDrawingActive(true)
    mapRef.current.setOptions({ draggableCursor: 'crosshair', clickableIcons: false })

    const setFirstMarkerCloseable = (marker: google.maps.Marker) => {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#ffffff',
        fillOpacity: 0.95,
        strokeWeight: 3,
        strokeColor: color,
      })
      marker.setZIndex(20)
      marker.setOptions({ cursor: 'pointer' })
    }

    const finishDrawing = () => {
      const path = drawingPointsRef.current.map(m => ({
        lat: m.getPosition()!.lat(),
        lng: m.getPosition()!.lng(),
      }))
      cleanupTempDrawing()
      setDrawingActive(false)
      mapRef.current?.setOptions({ draggableCursor: '', clickableIcons: true })
      const id = activeRegionIdRef.current
      if (id && path.length >= 3) {
        const col = regions.find(r => r.tempId === id)?.color || '#3b82f6'
        commitPolygon(path, id, col)
      }
    }

    const clickListener = mapRef.current.addListener('click', (e: any) => {
      if (!e.latLng) return
      const isFirst = drawingPointsRef.current.length === 0
      const marker = new google.maps.Marker({
        position: e.latLng,
        map: mapRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isFirst ? 7 : 5,
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: isFirst ? 2.5 : 1.5,
          strokeColor: '#fff',
        },
        zIndex: isFirst ? 15 : 10,
      })
      drawingPointsRef.current.push(marker)
      updatePreviewPolyline(color)

      // Gör startpunkten klickbar för att stänga när vi har ≥3 punkter
      if (drawingPointsRef.current.length === 3) {
        setFirstMarkerCloseable(drawingPointsRef.current[0])
      }

      // Startpunkts-listener sätts en gång
      if (isFirst) {
        marker.addListener('click', () => {
          if (drawingPointsRef.current.length < 3) return
          finishDrawing()
        })
      }
    })

    const dblClickListener = mapRef.current.addListener('dblclick', (e: any) => {
      if (e.stop) e.stop()
      finishDrawing()
    })

    const mouseMoveListener = mapRef.current.addListener('mousemove', (e: any) => {
      if (!e.latLng || drawingPointsRef.current.length === 0) return
      rubberBandPosRef.current = e.latLng
      const path = [
        ...drawingPointsRef.current.map(m => m.getPosition()!),
        e.latLng,
      ]
      if (previewPolylineRef.current) {
        previewPolylineRef.current.setPath(path)
      }
    })

    drawingListenersRef.current = [clickListener, dblClickListener, mouseMoveListener]
  }, [activeRegionId, regions, onPolygonSaved, cleanupTempDrawing, updatePreviewPolyline, commitPolygon])

  const cancelDrawing = useCallback(() => {
    cleanupTempDrawing()
    setDrawingActive(false)
    mapRef.current?.setOptions({ draggableCursor: '', clickableIcons: true })
  }, [cleanupTempDrawing])

  const clearPolygon = useCallback((tempId: string) => {
    const old = drawnPolygonsRef.current.get(tempId)
    if (old) {
      old.setMap(null)
      drawnPolygonsRef.current.delete(tempId)
    }
    onPolygonSaved(tempId, null)
  }, [onPolygonSaved])

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Områdessökning via Nominatim */}
      <div className="relative">
        {searchLoading
          ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        }
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Sök område, stadsdel eller kommun (t.ex. Farsta, Huddinge)..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
        />
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {searchResults.map((r) => (
              <button
                key={r.place_id}
                onMouseDown={() => selectNominatimResult(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors"
              >
                <span className="text-white">{r.display_name.split(',')[0].trim()}</span>
                <span className="text-slate-500 text-xs ml-1.5 truncate">{r.display_name.split(',').slice(1, 3).join(',').trim()}</span>
              </button>
            ))}
          </div>
        )}
        {noRegionWarning && (
          <div className="absolute top-full mt-1 w-full z-50 flex items-center gap-2 px-3 py-2 bg-amber-900/80 border border-amber-700 rounded-lg shadow-xl">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300">Välj en region i listan nedan innan du väljer kommun</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {/* Regionlista */}
        <div className="w-44 flex-shrink-0 space-y-1.5">
          <p className="text-xs font-medium text-slate-400 mb-2">Välj region att rita:</p>
          {regions.map(r => {
            const hasPolygon = !!r.polygon && r.polygon.length > 0
            const isActive = activeRegionId === r.tempId
            return (
              <button
                key={r.tempId}
                onClick={() => setActiveRegionId(isActive ? null : r.tempId)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all ${
                  isActive ? 'border' : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:border-slate-600'
                }`}
                style={isActive ? { backgroundColor: r.color + '20', borderColor: r.color + '60', color: r.color } : {}}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 truncate">{r.site_name}</span>
                {r.stationCount != null && r.stationCount > 0 && (
                  <span className="text-[10px] opacity-70">{r.stationCount}</span>
                )}
                {hasPolygon && <Check className="w-3 h-3 flex-shrink-0 opacity-80" />}
              </button>
            )
          })}
        </div>

        {/* Karta */}
        <div className="flex-1 flex flex-col gap-2">
          <div ref={mapDivRef} style={{ width: '100%', height: '480px', borderRadius: '12px', overflow: 'hidden' }} />

          {activeRegionId ? (
            <div className="flex items-center gap-2 flex-wrap">
              {!drawingActive && (
                <button
                  onClick={startDrawing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white border border-slate-600 hover:border-[#20c58f] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Rita manuellt
                </button>
              )}
              {activeRegion?.polygon && activeRegion.polygon.length > 0 && (
                <button
                  onClick={() => { if (drawingActive) cancelDrawing(); clearPolygon(activeRegionId) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-red-400 border border-slate-600 hover:border-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Ta bort polygon
                </button>
              )}
              {drawingActive && (
                <>
                  <span className="text-xs text-[#20c58f]">Klicka för att lägga till punkter — klicka på startpunkten eller dubbelklicka för att avsluta</span>
                  <button
                    onClick={cancelDrawing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/60 text-red-200 border border-red-600 hover:bg-red-900 transition-colors ml-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    Avbryt
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Sök en kommun ovan eller välj en region i listan och rita manuellt
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Sök ett område, stadsdel eller kommun för att hämta gränsen automatiskt. Polygonen kan sedan justeras manuellt — dra i punkterna för att anpassa.
      </p>
    </div>
  )
}
