// src/utils/equipmentMapUtils.ts - Verktyg för kartvisning och utrustningsmarkörer
import {
  EquipmentType,
  EquipmentStatus,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG
} from '../types/database'

// Standardposition för Sverige (Stockholm)
export const SWEDEN_CENTER: [number, number] = [59.3293, 18.0686]
export const DEFAULT_ZOOM = 6
export const DETAIL_ZOOM = 16
export const MAX_ZOOM = 19

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
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  if (isIOS) {
    window.open(getAppleMapsUrl(lat, lng), '_blank')
  } else {
    window.open(getGoogleMapsUrl(lat, lng), '_blank')
  }
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
