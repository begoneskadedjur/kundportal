// src/components/shared/equipment/MapLocationPicker.tsx - Interaktiv kartväljare med Google Maps
import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Navigation, Search, Check, X, Crosshair, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { searchAddresses, type GeocodeResult } from '../../../services/geocoding'
import { useGoogleMaps } from '../../../hooks/useGoogleMaps'

// Stockholm som default center
const SWEDEN_CENTER = { lat: 59.3293, lng: 18.0686 }
const DEFAULT_ZOOM = 13
const DETAIL_ZOOM = 17

export interface ExistingStation {
  id: string
  latitude: number
  longitude: number
  number: number
  equipment_type: string
  color?: string
}

interface MapLocationPickerProps {
  initialPosition?: { lat: number; lng: number } | null
  initialAddress?: string | null // Kundens adress för automatisk sökning
  onPositionSelect: (lat: number, lng: number) => void
  onCancel: () => void
  height?: string
  existingStations?: ExistingStation[]
}

export function MapLocationPicker({
  initialPosition,
  initialAddress,
  onPositionSelect,
  onCancel,
  height = '400px',
  existingStations
}: MapLocationPickerProps) {
  const { isLoaded } = useGoogleMaps({ libraries: ['marker'] })

  const [markerPosition, setMarkerPosition] = useState<[number, number]>(
    initialPosition
      ? [initialPosition.lat, initialPosition.lng]
      : [SWEDEN_CENTER.lat, SWEDEN_CENTER.lng]
  )
  const [isLocating, setIsLocating] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialAddress || '')
  const [isSearching, setIsSearching] = useState(false)
  const [hasAutoSearched, setHasAutoSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Google Maps refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const existingMarkersRef = useRef<google.maps.Marker[]>([])

  // Uppdatera markörposition (state + Google Maps marker)
  const updateMarkerPosition = useCallback((lat: number, lng: number) => {
    setMarkerPosition([lat, lng])
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng })
    }
  }, [])

  // Centrera karta
  const panTo = useCallback((lat: number, lng: number, zoom?: number) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng })
      if (zoom) mapRef.current.setZoom(zoom)
    }
  }, [])

  // Initiera Google Maps
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return

    const center = initialPosition || SWEDEN_CENTER
    const zoom = initialPosition ? DETAIL_ZOOM : DEFAULT_ZOOM

    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT,
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
      },
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      scaleControl: true
    })
    mapRef.current = map

    // Klick → flytta markör
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()
        setMarkerPosition([lat, lng])
        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng })
        }
      }
    })

    // Skapa draggable markör
    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: true,
      title: 'Dra till rätt position'
    })

    marker.addListener('dragend', () => {
      const pos = marker.getPosition()
      if (pos) {
        setMarkerPosition([pos.lat(), pos.lng()])
      }
    })

    markerRef.current = marker

    // Anpassa kartvy till befintliga stationer om det finns
    if (!initialPosition && existingStations?.length) {
      const bounds = new google.maps.LatLngBounds()
      existingStations.forEach(s => bounds.extend({ lat: s.latitude, lng: s.longitude }))
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
    }
  }, [isLoaded, initialPosition])

  // Rendera befintliga stationer som numrerade markörer
  useEffect(() => {
    if (!mapRef.current || !existingStations?.length) return

    // Rensa gamla markörer
    existingMarkersRef.current.forEach(m => m.setMap(null))
    existingMarkersRef.current = []

    existingStations.forEach(station => {
      const marker = new google.maps.Marker({
        position: { lat: station.latitude, lng: station.longitude },
        map: mapRef.current!,
        draggable: false,
        clickable: false,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: station.color || '#6b7280',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        label: {
          text: String(station.number),
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 'bold'
        },
        zIndex: 1
      })
      existingMarkersRef.current.push(marker)
    })

    return () => {
      existingMarkersRef.current.forEach(m => m.setMap(null))
      existingMarkersRef.current = []
    }
  }, [existingStations, isLoaded])

  // Stäng dropdown vid klick utanför
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Välj ett sökresultat
  const selectResult = useCallback((result: GeocodeResult) => {
    updateMarkerPosition(result.location.lat, result.location.lng)
    panTo(result.location.lat, result.location.lng, DETAIL_ZOOM)
    setSearchQuery(result.formatted_address)
    setShowResults(false)
    setSearchError(null)
  }, [updateMarkerPosition, panTo])

  // Sök adress med Google Geocoding
  const searchAddressInternal = useCallback(async (query: string) => {
    if (!query.trim()) return false

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    setShowResults(false)

    try {
      const response = await searchAddresses(query)

      if (!response.success || response.results.length === 0) {
        setSearchError(response.error || 'Ingen adress hittades')
        return false
      }

      if (response.results.length === 1) {
        selectResult(response.results[0])
        return true
      }

      // Flera resultat - visa dropdown
      setSearchResults(response.results)
      setShowResults(true)
      return true
    } catch (error) {
      console.error('Sökfel:', error)
      setSearchError('Ett fel uppstod vid sökning')
      return false
    } finally {
      setIsSearching(false)
    }
  }, [selectResult])

  // Automatisk sökning vid mount om initialAddress finns och ingen initialPosition
  useEffect(() => {
    if (initialAddress && !initialPosition && !hasAutoSearched && isLoaded) {
      setHasAutoSearched(true)
      searchAddressInternal(initialAddress)
    }
  }, [initialAddress, initialPosition, hasAutoSearched, searchAddressInternal, isLoaded])

  // Centrera på användarens position
  const centerOnUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation stöds inte i denna webbläsare')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        updateMarkerPosition(lat, lng)
        panTo(lat, lng, DETAIL_ZOOM)
        setIsLocating(false)
      },
      (error) => {
        console.error('Kunde inte hämta position:', error)
        setIsLocating(false)
        alert('Kunde inte hämta din position. Kontrollera att GPS är aktiverat.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }, [updateMarkerPosition, panTo])

  // Sök efter adress - wrapper för användaren
  const searchAddress = useCallback(async () => {
    await searchAddressInternal(searchQuery)
  }, [searchQuery, searchAddressInternal])

  // Bekräfta vald position
  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onPositionSelect(markerPosition[0], markerPosition[1])
  }

  // Hantera enter-tangent i sökfältet
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      searchAddress()
    }
  }

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Instruktioner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p className="text-sm text-blue-400 flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Välj position på kartan:</strong> Klicka på kartan eller dra markören till rätt plats.
            Du kan också söka efter en adress eller använda din nuvarande GPS-position.
          </span>
        </p>
      </div>

      {/* Sökfält */}
      <div className="flex gap-2" ref={searchContainerRef}>
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null) }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Sök adress eller platsnamn (t.ex. Kungsgatan 1, Stockholm)"
            className={`w-full px-4 py-2 pl-10 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${searchError ? 'border-red-500/50' : 'border-slate-700'}`}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

          {/* Dropdown med sökresultat */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              <p className="px-3 py-1.5 text-xs text-slate-500 border-b border-slate-700/50">
                {searchResults.length} resultat — välj rätt adress:
              </p>
              {searchResults.map((result, i) => (
                <button
                  key={result.place_id || i}
                  type="button"
                  onClick={() => selectResult(result)}
                  className="w-full px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors border-b border-slate-700/30 last:border-b-0"
                >
                  {result.formatted_address}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={searchAddress}
          disabled={isSearching || !searchQuery.trim()}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? 'Söker...' : 'Sök'}
        </button>
        <button
          onClick={centerOnUserLocation}
          disabled={isLocating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          title="Min position"
        >
          {isLocating ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Crosshair className="w-5 h-5" />
            </motion.div>
          ) : (
            <Navigation className="w-5 h-5" />
          )}
        </button>
      </div>
      {/* Inline felmeddelande */}
      {searchError && (
        <p className="text-xs text-red-400 -mt-2">{searchError}</p>
      )}

      {/* Karta */}
      <div className="relative rounded-lg overflow-hidden border border-slate-700" style={{ height }}>
        {!isLoaded ? (
          <div className="flex items-center justify-center bg-slate-800 h-full">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        )}

        {/* Koordinatvisning överlagd på kartan */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2">
          <p className="text-xs text-slate-400">Vald position</p>
          <p className="text-white font-mono text-sm">
            {markerPosition[0].toFixed(6)}, {markerPosition[1].toFixed(6)}
          </p>
        </div>
      </div>

      {/* Knappar */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-5 h-5" />
          Avbryt
        </button>
        <motion.button
          onClick={handleConfirm}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 px-4 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Använd denna position
        </motion.button>
      </div>
    </div>
  )
}

export default MapLocationPicker
