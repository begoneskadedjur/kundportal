// src/components/shared/equipment/EquipmentMap.tsx - Leaflet-karta för utrustningsvisning
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../../types/database'
import {
  createEquipmentIcon,
  createPlacementPreviewIcon,
  SWEDEN_CENTER,
  DEFAULT_ZOOM,
  DETAIL_ZOOM,
  calculateBounds,
  formatCoordinates,
  openInMapsApp,
  MARKER_CSS
} from '../../../utils/equipmentMapUtils'
import { MapPin, Navigation, ExternalLink, Edit, Trash2 } from 'lucide-react'

// Fix för Leaflet standardikoner
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface EquipmentMapProps {
  equipment: EquipmentPlacementWithRelations[]
  previewPosition?: { lat: number; lng: number } | null
  onEquipmentClick?: (equipment: EquipmentPlacementWithRelations) => void
  onEditEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onDeleteEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onMapClick?: (lat: number, lng: number) => void
  height?: string
  showControls?: boolean
  readOnly?: boolean
}

// Komponent för att hantera kartvy-uppdateringar
function MapViewUpdater({
  equipment,
  previewPosition
}: {
  equipment: EquipmentPlacementWithRelations[]
  previewPosition?: { lat: number; lng: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (previewPosition) {
      // Zooma in på förhandsgranskningsposition
      map.setView([previewPosition.lat, previewPosition.lng], DETAIL_ZOOM)
    } else if (equipment.length > 0) {
      // Anpassa vy till all utrustning
      const bounds = calculateBounds(equipment)
      if (bounds) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [equipment, previewPosition, map])

  return null
}

export function EquipmentMap({
  equipment,
  previewPosition,
  onEquipmentClick,
  onEditEquipment,
  onDeleteEquipment,
  onMapClick,
  height = '400px',
  showControls = true,
  readOnly = false
}: EquipmentMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)

  // Lägg till CSS för markörer
  useEffect(() => {
    const styleId = 'equipment-marker-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = MARKER_CSS
      document.head.appendChild(style)
    }
  }, [])

  // Hantera klick på kartan
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (onMapClick && !readOnly) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }
  }

  // Centrera kartan på användarens position
  const centerOnUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mapRef.current) {
            mapRef.current.setView(
              [position.coords.latitude, position.coords.longitude],
              DETAIL_ZOOM
            )
          }
        },
        (error) => {
          console.error('Kunde inte hämta position:', error)
        }
      )
    }
  }

  // Beräkna initial position
  const getInitialCenter = (): [number, number] => {
    if (previewPosition) {
      return [previewPosition.lat, previewPosition.lng]
    }
    if (equipment.length > 0) {
      const first = equipment[0]
      return [first.latitude, first.longitude]
    }
    return SWEDEN_CENTER
  }

  const getInitialZoom = (): number => {
    if (previewPosition) return DETAIL_ZOOM
    if (equipment.length === 1) return DETAIL_ZOOM
    return DEFAULT_ZOOM
  }

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={getInitialCenter()}
        zoom={getInitialZoom()}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        className="rounded-lg z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewUpdater equipment={equipment} previewPosition={previewPosition} />

        {/* Befintlig utrustning */}
        {equipment.map((item) => (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={createEquipmentIcon(item.equipment_type, item.status)}
            eventHandlers={{
              click: () => {
                setSelectedEquipment(item.id)
                onEquipmentClick?.(item)
              }
            }}
          >
            <Popup>
              <div className="min-w-[200px] p-1">
                {/* Typ och status */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: EQUIPMENT_TYPE_CONFIG[item.equipment_type].color }}
                  />
                  <span className="font-semibold text-slate-800">
                    {getEquipmentTypeLabel(item.equipment_type)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      EQUIPMENT_STATUS_CONFIG[item.status].bgColor
                    } text-${EQUIPMENT_STATUS_CONFIG[item.status].color}`}
                  >
                    {getEquipmentStatusLabel(item.status)}
                  </span>
                </div>

                {/* Serienummer */}
                {item.serial_number && (
                  <p className="text-sm text-slate-600 mb-1">
                    <span className="font-medium">Serienr:</span> {item.serial_number}
                  </p>
                )}

                {/* Koordinater */}
                <p className="text-xs text-slate-500 mb-1">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {formatCoordinates(item.latitude, item.longitude)}
                </p>

                {/* Placerad av */}
                {item.technician?.name && (
                  <p className="text-xs text-slate-500 mb-1">
                    Placerad av: {item.technician.name}
                  </p>
                )}

                {/* Datum */}
                <p className="text-xs text-slate-500 mb-2">
                  {new Date(item.placed_at).toLocaleDateString('sv-SE')}
                </p>

                {/* Kommentar */}
                {item.comment && (
                  <p className="text-xs text-slate-600 italic mb-2 border-t pt-2">
                    "{item.comment}"
                  </p>
                )}

                {/* Åtgärder */}
                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => openInMapsApp(item.latitude, item.longitude)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Öppna i karta
                  </button>

                  {!readOnly && onEditEquipment && (
                    <button
                      onClick={() => onEditEquipment(item)}
                      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800"
                    >
                      <Edit className="w-3 h-3" />
                      Redigera
                    </button>
                  )}

                  {!readOnly && onDeleteEquipment && (
                    <button
                      onClick={() => onDeleteEquipment(item)}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3 h-3" />
                      Ta bort
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Förhandsgranskningsmarkör för ny placering */}
        {previewPosition && (
          <Marker
            position={[previewPosition.lat, previewPosition.lng]}
            icon={createPlacementPreviewIcon()}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-blue-600 mb-1">Ny placering</p>
                <p className="text-xs text-slate-500">
                  {formatCoordinates(previewPosition.lat, previewPosition.lng)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Kontroller */}
      {showControls && (
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <button
            onClick={centerOnUserLocation}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 transition-colors"
            title="Centrera på min position"
          >
            <Navigation className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">Utrustningstyper</p>
        <div className="flex flex-col gap-1">
          {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-xs text-slate-600">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EquipmentMap
