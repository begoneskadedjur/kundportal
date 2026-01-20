// src/utils/equipmentMapUtils.ts - Verktyg för Leaflet-kartor och utrustningsmarkörer
import L from 'leaflet'
import {
  EquipmentType,
  EquipmentStatus,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG
} from '../types/database'

// Standardposition för Sverige (Stockholm)
export const SWEDEN_CENTER: [number, number] = [59.3293, 18.0686]
export const DEFAULT_ZOOM = 6
export const DETAIL_ZOOM = 16 // Zoom-nivå när man fokuserar på en position (visar kvarter/hus utan tile-problem)
export const MAX_ZOOM = 20 // Maximal zoom-nivå för detaljerat arbete

/**
 * Skapa anpassad ikon för utrustningsmarkör
 * Färg baseras på utrustningstyp, styling på status
 * Storlek: 28px för finare visning, men touch-target är 44px via padding
 * Stödjer både legacy-typer och dynamiska typer från station_types-tabellen
 *
 * @param type - Utrustningstyp (legacy eller dynamisk)
 * @param status - Utrustningsstatus
 * @param customColor - Valfri färg från station_types-tabellen (prioriteras över legacy-config)
 */
export const createEquipmentIcon = (
  type: string, // Ändrat från EquipmentType till string för dynamiska typer
  status: EquipmentStatus,
  customColor?: string // Ny parameter för dynamisk färg från station_types
): L.DivIcon => {
  // Prioritera customColor (från station_types), sedan legacy-config, sist fallback till slate-500
  const typeConfig = EQUIPMENT_TYPE_CONFIG[type as EquipmentType]
  const color = customColor || typeConfig?.color || '#6b7280'

  // Opacity och kantfärg baserat på status
  let opacity = 1
  let borderColor = 'white'
  let borderStyle = 'solid'

  if (status === 'removed') {
    opacity = 0.5
    borderColor = '#64748b' // slate-500
  }
  if (status === 'missing') {
    opacity = 0.85
    borderColor = '#f59e0b' // amber-500
    borderStyle = 'dashed'
  }
  if (status === 'damaged') {
    opacity = 0.85
    borderColor = '#ef4444' // red-500
  }

  // Ikon-symbol baserat på status
  let symbol = ''
  if (status === 'missing') symbol = '?'
  if (status === 'removed') symbol = '✕'
  if (status === 'damaged') symbol = '!'

  // Visuell storlek: 28px, Touch-target: 44px (via osynlig padding)
  const visualSize = 28
  const touchSize = 44
  const padding = (touchSize - visualSize) / 2

  return L.divIcon({
    className: 'equipment-marker',
    html: `
      <div style="
        width: ${touchSize}px;
        height: ${touchSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background-color: ${color};
          opacity: ${opacity};
          width: ${visualSize}px;
          height: ${visualSize}px;
          border-radius: 50%;
          border: 2px ${borderStyle} ${borderColor};
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        ">
          ${symbol}
        </div>
      </div>
    `,
    iconSize: [touchSize, touchSize],
    iconAnchor: [touchSize / 2, touchSize / 2],
    popupAnchor: [0, -(visualSize / 2)]
  })
}

/**
 * Skapa markör för ny placering (förhandsgranskning)
 */
export const createPlacementPreviewIcon = (): L.DivIcon => {
  return L.divIcon({
    className: 'placement-preview-marker',
    html: `
      <div style="
        background-color: #3b82f6;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 3px 10px rgba(59, 130, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: pulse 2s infinite;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  })
}

/**
 * Skapa kluster-ikon för grupperade markörer
 */
export const createClusterIcon = (cluster: L.MarkerCluster): L.DivIcon => {
  const count = cluster.getChildCount()

  let size = 'small'
  let dimensions = 30
  if (count >= 10) {
    size = 'medium'
    dimensions = 40
  }
  if (count >= 50) {
    size = 'large'
    dimensions = 50
  }

  return L.divIcon({
    html: `
      <div style="
        background-color: #1e293b;
        width: ${dimensions}px;
        height: ${dimensions}px;
        border-radius: 50%;
        border: 3px solid #3b82f6;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${size === 'large' ? 16 : 14}px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        ${count}
      </div>
    `,
    className: `equipment-cluster equipment-cluster-${size}`,
    iconSize: [dimensions, dimensions],
    iconAnchor: [dimensions / 2, dimensions / 2]
  })
}

/**
 * Formatera koordinater för visning
 */
export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/**
 * Formatera koordinater för kortare visning
 */
export const formatCoordinatesShort = (lat: number, lng: number): string => {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

/**
 * Generera Google Maps-länk för koordinater
 */
export const getGoogleMapsUrl = (lat: number, lng: number): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/**
 * Generera Apple Maps-länk för koordinater
 */
export const getAppleMapsUrl = (lat: number, lng: number): string => {
  return `https://maps.apple.com/?ll=${lat},${lng}`
}

/**
 * Öppna position i kartapp (väljer baserat på enhet)
 */
export const openInMapsApp = (lat: number, lng: number): void => {
  // Försök detektera iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  if (isIOS) {
    window.open(getAppleMapsUrl(lat, lng), '_blank')
  } else {
    window.open(getGoogleMapsUrl(lat, lng), '_blank')
  }
}

/**
 * Beräkna bounds för en lista av koordinater
 */
export const calculateBounds = (
  coordinates: Array<{ latitude: number; longitude: number }>
): L.LatLngBounds | null => {
  if (coordinates.length === 0) return null

  const latLngs = coordinates.map(c => L.latLng(c.latitude, c.longitude))
  return L.latLngBounds(latLngs)
}

/**
 * Beräkna mittpunkt för en lista av koordinater
 */
export const calculateCenter = (
  coordinates: Array<{ latitude: number; longitude: number }>
): { lat: number; lng: number } => {
  if (coordinates.length === 0) {
    return { lat: SWEDEN_CENTER[0], lng: SWEDEN_CENTER[1] }
  }

  const sum = coordinates.reduce(
    (acc, c) => ({
      lat: acc.lat + c.latitude,
      lng: acc.lng + c.longitude
    }),
    { lat: 0, lng: 0 }
  )

  return {
    lat: sum.lat / coordinates.length,
    lng: sum.lng / coordinates.length
  }
}

/**
 * Hämta statusfärg för CSS
 */
export const getStatusCssColor = (status: EquipmentStatus): string => {
  const config = EQUIPMENT_STATUS_CONFIG[status]
  const colorMap: Record<string, string> = {
    'green-500': '#22c55e',
    'yellow-500': '#eab308',
    'red-500': '#ef4444'
  }
  return colorMap[config?.color] || '#6b7280'
}

/**
 * Hämta typfärg för CSS
 */
export const getTypeCssColor = (type: EquipmentType): string => {
  return EQUIPMENT_TYPE_CONFIG[type]?.color || '#6b7280'
}

/**
 * CSS-animationer för markörer (lägg till i stylesheet)
 * Inkluderar z-index-överskridningar för Leaflet-kontroller
 * så att modaler och bottom-sheets visas ovanför kartan
 */
export const MARKER_CSS = `
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
    }
    70% {
      box-shadow: 0 0 0 15px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }

  .equipment-marker {
    background: transparent !important;
    border: none !important;
  }

  .placement-preview-marker {
    background: transparent !important;
    border: none !important;
  }

  .equipment-cluster {
    background: transparent !important;
    border: none !important;
  }

  /* Sänk z-index på alla Leaflet-kontroller och popups
   * så att modaler (z-50 = 50) visas ovanför kartan
   * Leaflets standard är 400-1000, vi sänker till 40
   */
  .leaflet-control-container {
    z-index: 40 !important;
  }

  .leaflet-control {
    z-index: 40 !important;
  }

  .leaflet-top,
  .leaflet-bottom {
    z-index: 40 !important;
  }

  .leaflet-pane {
    z-index: 30 !important;
  }

  .leaflet-tile-pane {
    z-index: 20 !important;
  }

  .leaflet-overlay-pane {
    z-index: 25 !important;
  }

  .leaflet-shadow-pane {
    z-index: 26 !important;
  }

  .leaflet-marker-pane {
    z-index: 27 !important;
  }

  .leaflet-tooltip-pane {
    z-index: 35 !important;
  }

  .leaflet-popup-pane {
    z-index: 38 !important;
  }

  /* Behåll popups synliga men under modaler */
  .leaflet-popup {
    z-index: 38 !important;
  }
`

/**
 * Validera koordinater
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

/**
 * Kontrollera om koordinater är inom Sverige (ungefärligt)
 */
export const isWithinSweden = (lat: number, lng: number): boolean => {
  return lat >= 55.0 && lat <= 69.5 && lng >= 10.5 && lng <= 24.5
}
