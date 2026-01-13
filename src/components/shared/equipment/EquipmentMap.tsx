// src/components/shared/equipment/EquipmentMap.tsx - Leaflet-karta för utrustningsvisning
import { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, useMapEvents, Circle } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
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
  createClusterIcon,
  SWEDEN_CENTER,
  DEFAULT_ZOOM,
  DETAIL_ZOOM,
  MAX_ZOOM,
  calculateBounds,
  formatCoordinates,
  openInMapsApp,
  MARKER_CSS
} from '../../../utils/equipmentMapUtils'
import { MapPin, Navigation, ExternalLink, Edit, Trash2, Image as ImageIcon, Building } from 'lucide-react'

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
  gpsAccuracy?: number | null // GPS-noggrannhet i meter för att visa cirkel
  onEquipmentClick?: (equipment: EquipmentPlacementWithRelations) => void
  onEditEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onDeleteEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onMapClick?: (lat: number, lng: number) => void
  height?: string
  showControls?: boolean
  readOnly?: boolean
  enableClustering?: boolean // Aktivera klustervisning för många markörer
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

// Komponent för att hantera kartklick
function MapClickHandler({
  onMapClick,
  readOnly
}: {
  onMapClick?: (lat: number, lng: number) => void
  readOnly: boolean
}) {
  useMapEvents({
    click: (e) => {
      if (onMapClick && !readOnly) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    }
  })

  return null
}

// Extraherad popup-komponent för återanvändning
function EquipmentPopupContent({
  item,
  readOnly,
  onEditEquipment,
  onDeleteEquipment
}: {
  item: EquipmentPlacementWithRelations
  readOnly: boolean
  onEditEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onDeleteEquipment?: (equipment: EquipmentPlacementWithRelations) => void
}) {
  return (
    <div className="min-w-[220px] p-1">
      {/* Foto om finns */}
      {item.photo_url && (
        <div className="mb-2 -mx-1 -mt-1">
          <img
            src={item.photo_url}
            alt="Utrustningsfoto"
            className="w-full h-32 object-cover rounded-t-lg"
            loading="lazy"
          />
        </div>
      )}

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

      {/* Kund */}
      {(item.customer as { company_name?: string } | undefined)?.company_name && (
        <p className="text-sm text-slate-700 mb-2 flex items-center gap-1.5 font-medium">
          <Building className="w-3.5 h-3.5 text-slate-500" />
          {(item.customer as { company_name: string }).company_name}
        </p>
      )}

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

      {/* Foto-indikator om saknas */}
      {!item.photo_url && (
        <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          Inget foto
        </p>
      )}

      {/* Åtgärder */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <button
          onClick={() => openInMapsApp(item.latitude, item.longitude)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 min-h-[44px] px-2"
        >
          <ExternalLink className="w-4 h-4" />
          Öppna i karta
        </button>

        {!readOnly && onEditEquipment && (
          <button
            onClick={() => onEditEquipment(item)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 min-h-[44px] px-2"
          >
            <Edit className="w-4 h-4" />
            Redigera
          </button>
        )}

        {!readOnly && onDeleteEquipment && (
          <button
            onClick={() => onDeleteEquipment(item)}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 min-h-[44px] px-2"
          >
            <Trash2 className="w-4 h-4" />
            Ta bort
          </button>
        )}
      </div>
    </div>
  )
}

export function EquipmentMap({
  equipment,
  previewPosition,
  gpsAccuracy,
  onEquipmentClick,
  onEditEquipment,
  onDeleteEquipment,
  onMapClick,
  height = '400px',
  showControls = true,
  readOnly = false,
  enableClustering = true // Aktiverat som standard
}: EquipmentMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)

  // Skapa en unik key för MarkerClusterGroup baserat på alla equipment IDs
  // Detta tvingar React att återskapa komponenten när equipment ändras
  const clusterKey = useMemo(() => {
    const ids = equipment.map(e => e.id).sort().join(',')
    // Enkel hash för att hålla key kort
    let hash = 0
    for (let i = 0; i < ids.length; i++) {
      const char = ids.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `cluster-${equipment.length}-${hash}`
  }, [equipment])

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
        maxZoom={MAX_ZOOM}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Gatukarta">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellit">
            <TileLayer
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Hybrid">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapViewUpdater equipment={equipment} previewPosition={previewPosition} />
        <MapClickHandler onMapClick={onMapClick} readOnly={readOnly} />

        {/* Befintlig utrustning - med eller utan klustring */}
        {/* Key tvingar omrendering när equipment ändras (t.ex. efter borttagning) */}
        {enableClustering && equipment.length > 5 ? (
          <MarkerClusterGroup
            key={clusterKey}
            chunkedLoading
            iconCreateFunction={createClusterIcon}
            maxClusterRadius={60}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            zoomToBoundsOnClick
          >
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
                  <EquipmentPopupContent
                    item={item}
                    readOnly={readOnly}
                    onEditEquipment={onEditEquipment}
                    onDeleteEquipment={onDeleteEquipment}
                  />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        ) : (
          equipment.map((item) => (
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
                <EquipmentPopupContent
                  item={item}
                  readOnly={readOnly}
                  onEditEquipment={onEditEquipment}
                  onDeleteEquipment={onDeleteEquipment}
                />
              </Popup>
            </Marker>
          ))
        )}

        {/* Förhandsgranskningsmarkör för ny placering */}
        {previewPosition && (
          <>
            {/* GPS-noggrannhetscirkel */}
            {gpsAccuracy && gpsAccuracy > 0 && (
              <Circle
                center={[previewPosition.lat, previewPosition.lng]}
                radius={gpsAccuracy}
                pathOptions={{
                  color: gpsAccuracy <= 30 ? '#22c55e' : gpsAccuracy <= 100 ? '#eab308' : '#ef4444',
                  fillColor: gpsAccuracy <= 30 ? '#22c55e' : gpsAccuracy <= 100 ? '#eab308' : '#ef4444',
                  fillOpacity: 0.15,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            )}
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
                  {gpsAccuracy && (
                    <p className={`text-xs mt-1 ${
                      gpsAccuracy <= 30 ? 'text-green-600' :
                      gpsAccuracy <= 100 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      Noggrannhet: ±{Math.round(gpsAccuracy)}m
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* Kontroller - z-index under modaler (z-50) */}
      {showControls && (
        <div className="absolute top-3 right-3 z-40 flex flex-col gap-2">
          <button
            onClick={centerOnUserLocation}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 transition-colors"
            title="Centrera på min position"
          >
            <Navigation className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      )}

      {/* Legend - z-index under modaler (z-50) */}
      <div className="absolute bottom-3 left-3 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-3">
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
