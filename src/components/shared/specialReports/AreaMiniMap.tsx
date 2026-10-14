// src/components/shared/specialReports/AreaMiniMap.tsx
// Kartutsnittblocket: en liten satellitkarta inzoomad på sektionens område.
// Ingen interaktion; PDF:en tar sin egen skärmdump av samma utsnitt.

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { LatLng } from '../../../types/specialReport'
import { useMapsReady } from './useMapsReady'

export default function AreaMiniMap({ area, className = 'h-32 w-60' }: { area: LatLng[]; className?: string }) {
  const { ready } = useMapsReady()
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polyRef = useRef<google.maps.Polygon | null>(null)

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
      })
    }
    const map = mapRef.current
    polyRef.current?.setMap(null)
    polyRef.current = new google.maps.Polygon({
      paths: area,
      map,
      strokeColor: '#20c58f',
      strokeWeight: 2,
      fillColor: '#20c58f',
      fillOpacity: 0.2,
      clickable: false,
    })
    const b = new google.maps.LatLngBounds()
    area.forEach(p => b.extend(p))
    map.fitBounds(b, 16)
  }, [ready, area])

  useEffect(() => () => { polyRef.current?.setMap(null) }, [])

  return (
    <div className={`relative isolate flex-shrink-0 overflow-hidden rounded-xl bg-slate-800 ${className}`}>
      <div ref={divRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      )}
    </div>
  )
}
