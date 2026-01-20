// src/components/shared/equipment/MapLocationPicker.tsx - Interaktiv kartväljare för GPS-backup
import { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation, Search, Check, X, Crosshair } from 'lucide-react'
import { motion } from 'framer-motion'

// Fix för Leaflet standardikoner
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Skapa draggable markör-ikon
const createDraggableIcon = () => {
  return L.divIcon({
    className: 'custom-draggable-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          transform: rotate(45deg);
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  })
}

// Stockholm som default center
const SWEDEN_CENTER: [number, number] = [59.3293, 18.0686]
const DEFAULT_ZOOM = 13
const DETAIL_ZOOM = 17

interface MapLocationPickerProps {
  initialPosition?: { lat: number; lng: number } | null
  initialAddress?: string | null // Kundens adress för automatisk sökning
  onPositionSelect: (lat: number, lng: number) => void
  onCancel: () => void
  height?: string
}

// Komponent för att hantera kartklick
function MapClickHandler({
  onMapClick
}: {
  onMapClick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// Komponent för att centrera kartan
function MapCenterController({
  center,
  zoom
}: {
  center: [number, number] | null
  zoom: number | null
}) {
  const map = useMap()

  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom)
    }
  }, [center, zoom, map])

  return null
}

// Draggable markör-komponent
function DraggableMarker({
  position,
  onPositionChange
}: {
  position: [number, number]
  onPositionChange: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<L.Marker | null>(null)
  const map = useMap()

  const eventHandlers = {
    dragend: () => {
      const marker = markerRef.current
      if (marker) {
        const newPos = marker.getLatLng()
        onPositionChange(newPos.lat, newPos.lng)
      }
    }
  }

  // Centrera kartan när markören dras
  useEffect(() => {
    if (markerRef.current) {
      map.panTo(position, { animate: true })
    }
  }, [position, map])

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={createDraggableIcon()}
      draggable={true}
      eventHandlers={eventHandlers}
    />
  )
}

export function MapLocationPicker({
  initialPosition,
  initialAddress,
  onPositionSelect,
  onCancel,
  height = '400px'
}: MapLocationPickerProps) {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(
    initialPosition
      ? [initialPosition.lat, initialPosition.lng]
      : SWEDEN_CENTER
  )
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [mapZoom, setMapZoom] = useState<number | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialAddress || '')
  const [isSearching, setIsSearching] = useState(false)
  const [hasAutoSearched, setHasAutoSearched] = useState(false)

  // Sök efter adress med Nominatim (OpenStreetMap) - useCallback för att kunna användas i useEffect
  const searchAddressInternal = useCallback(async (query: string) => {
    if (!query.trim()) return false

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=se&limit=1`,
        {
          headers: {
            'Accept-Language': 'sv'
          }
        }
      )
      const results = await response.json()

      if (results.length > 0) {
        const lat = parseFloat(results[0].lat)
        const lng = parseFloat(results[0].lon)
        setMarkerPosition([lat, lng])
        setMapCenter([lat, lng])
        setMapZoom(DETAIL_ZOOM)
        return true
      }
      return false
    } catch (error) {
      console.error('Sökfel:', error)
      return false
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Automatisk sökning vid mount om initialAddress finns och ingen initialPosition
  useEffect(() => {
    if (initialAddress && !initialPosition && !hasAutoSearched) {
      setHasAutoSearched(true)
      searchAddressInternal(initialAddress)
    }
  }, [initialAddress, initialPosition, hasAutoSearched, searchAddressInternal])

  // Hantera kartklick - flytta markören dit
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setMarkerPosition([lat, lng])
  }, [])

  // Hantera markör-drag
  const handleMarkerDrag = useCallback((lat: number, lng: number) => {
    setMarkerPosition([lat, lng])
  }, [])

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
        setMarkerPosition([lat, lng])
        setMapCenter([lat, lng])
        setMapZoom(DETAIL_ZOOM)
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
  }, [])

  // Sök efter adress - wrapper för användaren
  const searchAddress = useCallback(async () => {
    const found = await searchAddressInternal(searchQuery)
    if (!found && searchQuery.trim()) {
      alert('Kunde inte hitta adressen. Prova en annan sökning.')
    }
  }, [searchQuery, searchAddressInternal])

  // Bekräfta vald position
  const handleConfirm = () => {
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
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Sök adress (t.ex. Kungsgatan 1, Stockholm)"
            className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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

      {/* Karta */}
      <div className="relative rounded-lg overflow-hidden border border-slate-700" style={{ height }}>
        <MapContainer
          center={initialPosition ? [initialPosition.lat, initialPosition.lng] : SWEDEN_CENTER}
          zoom={initialPosition ? DETAIL_ZOOM : DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onMapClick={handleMapClick} />
          <MapCenterController center={mapCenter} zoom={mapZoom} />
          <DraggableMarker
            position={markerPosition}
            onPositionChange={handleMarkerDrag}
          />
        </MapContainer>

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
