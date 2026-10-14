// src/components/shared/specialReports/AreaMiniMap.tsx
// Kartutsnitt: en liten satellitkarta inzoomad på ett eller flera områden,
// varje område i sin dels färg. Ingen interaktion; PDF:en tar sin egen
// skärmdump av samma utsnitt. Används i kartutsnittblocket och i förhandsvisningen.

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { LatLng, SpecialReportMapView } from '../../../types/specialReport'
import { useMapsReady } from './useMapsReady'

const BRAND = '#20c58f'

export interface MiniMapArea {
  area: LatLng[]
  color: string
}

interface AreaMiniMapProps {
  /** Ett område (kartutsnittet för en del) */
  area?: LatLng[]
  color?: string
  /** Flera områden (översikten) */
  areas?: MiniMapArea[]
  /** Utsnitt att visa om inga områden finns */
  view?: SpecialReportMapView | null
  className?: string
}

export default function AreaMiniMap({ area, color = BRAND, areas, view, className = 'h-32 w-60 rounded-xl bg-slate-800' }: AreaMiniMapProps) {
  const { ready } = useMapsReady()
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polyRef = useRef<google.maps.Polygon[]>([])

  const lista: MiniMapArea[] = areas ?? (area ? [{ area, color }] : [])
  // Ny ritning bara när områdena eller färgerna faktiskt ändras
  const nyckel = JSON.stringify([lista, view ?? null])

  useEffect(() => {
    if (!ready || !divRef.current) return
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(divRef.current, {
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
        center: view ? { lat: view.lat, lng: view.lng } : { lat: 62, lng: 15 },
        zoom: view?.zoom ?? 5,
      })
    }
    const map = mapRef.current
    polyRef.current.forEach(p => p.setMap(null))
    const [omraden, utsnitt] = JSON.parse(nyckel) as [MiniMapArea[], SpecialReportMapView | null]
    polyRef.current = omraden
      .filter(o => o.area.length >= 3)
      .map(o => new google.maps.Polygon({
        paths: o.area,
        map,
        strokeColor: o.color,
        strokeWeight: 2,
        fillColor: o.color,
        fillOpacity: 0.25,
        clickable: false,
      }))
    const horn = omraden.flatMap(o => (o.area.length >= 3 ? o.area : []))
    if (horn.length >= 3) {
      const b = new google.maps.LatLngBounds()
      horn.forEach(p => b.extend(p))
      map.fitBounds(b, 16)
    } else if (utsnitt) {
      map.setCenter({ lat: utsnitt.lat, lng: utsnitt.lng })
      map.setZoom(utsnitt.zoom)
    }
    // Allt som ritas finns i nyckeln (områden, färger och utsnitt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, nyckel])

  useEffect(() => () => { polyRef.current.forEach(p => p.setMap(null)) }, [])

  return (
    <div className={`relative isolate flex-shrink-0 overflow-hidden ${className}`}>
      <div ref={divRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Fast färg: kartan visas även på förhandsvisningens vita papper */}
          <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" />
        </div>
      )}
    </div>
  )
}
