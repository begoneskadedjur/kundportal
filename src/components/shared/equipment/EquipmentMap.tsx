// src/components/shared/equipment/EquipmentMap.tsx - Leaflet-karta för utrustningsvisning
// Uppdaterad: Använder EquipmentDetailSheet istället för Leaflet Popup för bättre UX på mobil
import { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, useMapEvents, Circle } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG
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
  MARKER_CSS
} from '../../../utils/equipmentMapUtils'
import { StationTypeService } from '../../../services/stationTypeService'
import type { StationType } from '../../../types/stationTypes'
import { Navigation } from 'lucide-react'
import { EquipmentDetailSheet } from './EquipmentDetailSheet'

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
  showNumbers?: boolean // Visa stationsnummer (1, 2, 3...) baserat på placeringsordning
  inspectedStationIds?: Set<string> // IDs för inspekterade stationer (visas med grön bock)
  highlightedStationId?: string | null // ID för station att highlighta (wizard-läge)
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
        // maxZoom begränsar hur långt in kartan zoomar automatiskt
        // så att tiles alltid laddas korrekt (OSM har problem vid zoom 19+)
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: DETAIL_ZOOM })
      }
    }
  }, [equipment, previewPosition, map])

  return null
}

// Komponent för att centrera kartan på highlighted station (wizard-läge)
function HighlightedStationCenterer({
  equipment,
  highlightedStationId
}: {
  equipment: EquipmentPlacementWithRelations[]
  highlightedStationId?: string | null
}) {
  const map = useMap()

  useEffect(() => {
    if (highlightedStationId) {
      const station = equipment.find(e => e.id === highlightedStationId)
      if (station && station.latitude && station.longitude) {
        // Smooth pan till stationen
        map.flyTo([station.latitude, station.longitude], Math.max(map.getZoom(), 17), {
          duration: 0.5
        })
      }
    }
  }, [highlightedStationId, equipment, map])

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
  enableClustering = true, // Aktiverat som standard
  showNumbers = false, // Visa stationsnummer, default av
  inspectedStationIds, // IDs för inspekterade stationer
  highlightedStationId // ID för station att highlighta (wizard-läge)
}: EquipmentMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  // State for den valda utrustningen som visas i detail-sheeten
  const [selectedEquipmentData, setSelectedEquipmentData] = useState<EquipmentPlacementWithRelations | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)

  // Hämta stationstyper för att kunna matcha equipment_type → färg
  const [stationTypes, setStationTypes] = useState<StationType[]>([])

  useEffect(() => {
    StationTypeService.getActiveStationTypes()
      .then(types => setStationTypes(types))
      .catch(err => console.error('Kunde inte hämta stationstyper:', err))
  }, [])

  // Skapa mappning från equipment_type (code) → färg
  const typeColorMap = useMemo(() => {
    const map = new Map<string, { color: string; name: string }>()
    stationTypes.forEach(type => {
      map.set(type.code, { color: type.color, name: type.name })
    })
    return map
  }, [stationTypes])

  // Hjälpfunktion för att hämta rätt färg för en utrustning
  const getEquipmentColor = (item: EquipmentPlacementWithRelations): string | undefined => {
    // 1. Prioritera station_type_data om det finns (via foreign key)
    if (item.station_type_data?.color) {
      return item.station_type_data.color
    }
    // 2. Matcha equipment_type mot station_types.code
    const typeData = typeColorMap.get(item.equipment_type)
    if (typeData?.color) {
      return typeData.color
    }
    // 3. Fallback till undefined (låt createEquipmentIcon hantera legacy/gray)
    return undefined
  }

  // Skapa mappning från equipment ID till nummer (1, 2, 3...)
  // Baserat på placed_at i stigande ordning (äldsta placering = nummer 1)
  const equipmentNumberMap = useMemo(() => {
    if (!showNumbers) return new Map<string, number>()

    // Sortera efter placed_at ascending (äldsta först)
    const sorted = [...equipment].sort((a, b) => {
      const dateA = new Date(a.placed_at).getTime()
      const dateB = new Date(b.placed_at).getTime()
      return dateA - dateB
    })

    // Skapa mappning: ID → nummer
    const map = new Map<string, number>()
    sorted.forEach((item, index) => {
      map.set(item.id, index + 1)
    })
    return map
  }, [equipment, showNumbers])

  // Hantera klick pa en markör
  // I readOnly-läge med onEquipmentClick: Anropa bara callback (låt parent hantera UI)
  // Annars: Öppna detail sheet
  const handleMarkerClick = (item: EquipmentPlacementWithRelations) => {
    // Om vi har en custom click-handler och är i readOnly-läge, låt parent hantera UI
    if (readOnly && onEquipmentClick) {
      onEquipmentClick(item)
      return
    }
    // Annars öppna vår egen detail sheet
    setSelectedEquipmentData(item)
    setIsDetailSheetOpen(true)
    onEquipmentClick?.(item)
  }

  // Stang detail sheet
  const handleCloseDetailSheet = () => {
    setIsDetailSheetOpen(false)
    // Rensa vald utrustning efter animation
    setTimeout(() => setSelectedEquipmentData(null), 300)
  }

  // Hantera redigering fran sheeten
  const handleEditFromSheet = (item: EquipmentPlacementWithRelations) => {
    handleCloseDetailSheet()
    // Kort delay for att lata sheeten stanga innan modal oppnas
    setTimeout(() => onEditEquipment?.(item), 150)
  }

  // Hantera borttagning fran sheeten
  const handleDeleteFromSheet = (item: EquipmentPlacementWithRelations) => {
    handleCloseDetailSheet()
    setTimeout(() => onDeleteEquipment?.(item), 150)
  }

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
              maxZoom={MAX_ZOOM}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellit">
            <TileLayer
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={MAX_ZOOM}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Hybrid">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={MAX_ZOOM}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapViewUpdater equipment={equipment} previewPosition={previewPosition} />
        <MapClickHandler onMapClick={onMapClick} readOnly={readOnly} />
        <HighlightedStationCenterer equipment={equipment} highlightedStationId={highlightedStationId} />

        {/* Befintlig utrustning - med eller utan klustring */}
        {/* Key tvingar omrendering när equipment ändras (t.ex. efter borttagning) */}
        {/* UPPDATERAT: Använder EquipmentDetailSheet istället för Leaflet Popup för bättre mobil-UX */}
        {enableClustering && equipment.length >= 2 ? (
          <MarkerClusterGroup
            key={clusterKey}
            chunkedLoading
            iconCreateFunction={createClusterIcon}
            maxClusterRadius={80}
            disableClusteringAtZoom={19}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            zoomToBoundsOnClick
            spiderfyDistanceMultiplier={2}
            spiderLegPolylineOptions={{ weight: 2, color: '#3b82f6', opacity: 0.6 }}
          >
            {equipment.map((item) => (
              <Marker
                key={item.id}
                position={[item.latitude, item.longitude]}
                icon={createEquipmentIcon(
                  item.equipment_type,
                  item.status,
                  getEquipmentColor(item),
                  showNumbers ? equipmentNumberMap.get(item.id) : undefined,
                  inspectedStationIds?.has(item.id),
                  item.id === highlightedStationId
                )}
                eventHandlers={{
                  click: () => handleMarkerClick(item)
                }}
              />
            ))}
          </MarkerClusterGroup>
        ) : (
          equipment.map((item) => (
            <Marker
              key={item.id}
              position={[item.latitude, item.longitude]}
              icon={createEquipmentIcon(
                item.equipment_type,
                item.status,
                getEquipmentColor(item),
                showNumbers ? equipmentNumberMap.get(item.id) : undefined,
                inspectedStationIds?.has(item.id),
                item.id === highlightedStationId
              )}
              eventHandlers={{
                click: () => handleMarkerClick(item)
              }}
            />
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

      {/* Kontroller - placerad nere till hoger for att undvika kollision med kartlagerval (uppe till hoger) */}
      {showControls && (
        <div className="absolute bottom-3 right-3 z-40 flex flex-col gap-2">
          <button
            onClick={centerOnUserLocation}
            className="p-2.5 bg-white rounded-lg shadow-md hover:bg-slate-50 active:bg-slate-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Centrera på min position"
          >
            <Navigation className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      )}

      {/* Legend - dynamisk baserat på utrustning som visas på kartan */}
      <div className="absolute bottom-3 left-3 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">Utrustningstyper</p>
        <div className="flex flex-col gap-1">
          {/* Bygg legend dynamiskt från faktisk utrustning på kartan */}
          {(() => {
            // Samla unika typer med deras färger och etiketter
            const legendMap = new Map<string, { color: string; label: string }>()
            equipment.forEach(item => {
              if (!legendMap.has(item.equipment_type)) {
                // Prioritera: station_type_data → typeColorMap (från DB) → legacy-config → fallback
                const dynamicData = item.station_type_data
                const mappedData = typeColorMap.get(item.equipment_type)
                const legacyConfig = EQUIPMENT_TYPE_CONFIG[item.equipment_type as keyof typeof EQUIPMENT_TYPE_CONFIG]
                legendMap.set(item.equipment_type, {
                  color: dynamicData?.color || mappedData?.color || legacyConfig?.color || '#6b7280',
                  label: dynamicData?.name || mappedData?.name || legacyConfig?.label || item.equipment_type
                })
              }
            })
            // Om inga stationer finns, visa legacy-typer som fallback
            if (legendMap.size === 0) {
              return Object.entries(EQUIPMENT_TYPE_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-xs text-slate-600">{config.label}</span>
                </div>
              ))
            }
            // Visa typer som finns på kartan
            return Array.from(legendMap.entries()).map(([key, { color, label }]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-slate-600">{label}</span>
              </div>
            ))
          })()}
        </div>
      </div>

      {/* Equipment Detail Sheet - responsiv bottom-sheet/sidopanel */}
      <EquipmentDetailSheet
        equipment={selectedEquipmentData}
        isOpen={isDetailSheetOpen}
        onClose={handleCloseDetailSheet}
        onEdit={!readOnly && onEditEquipment ? handleEditFromSheet : undefined}
        onDelete={!readOnly && onDeleteEquipment ? handleDeleteFromSheet : undefined}
        readOnly={readOnly}
      />
    </div>
  )
}

export default EquipmentMap
