// src/components/shared/equipment/EquipmentMap.tsx - Google Maps-karta för utrustningsvisning
// Omskriven från Leaflet till Google Maps API
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG
} from '../../../types/database'
import {
  SWEDEN_CENTER,
  DEFAULT_ZOOM,
  DETAIL_ZOOM,
  MAX_ZOOM,
  calculateCenter
} from '../../../utils/equipmentMapUtils'
import { useGoogleMaps } from '../../../hooks/useGoogleMaps'
import { StationTypeService } from '../../../services/stationTypeService'
import type { StationType } from '../../../types/stationTypes'
import { Navigation } from 'lucide-react'
import { EquipmentDetailSheet } from './EquipmentDetailSheet'

interface EquipmentMapProps {
  equipment: EquipmentPlacementWithRelations[]
  previewPosition?: { lat: number; lng: number } | null
  gpsAccuracy?: number | null
  onEquipmentClick?: (equipment: EquipmentPlacementWithRelations) => void
  onEditEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onDeleteEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onMapClick?: (lat: number, lng: number) => void
  onRelocateClick?: (lat: number, lng: number) => void // Anropas vid bekräftelse av ny position
  relocatingStationId?: string | null // ID för station som ska vara draggbar
  relocatingStationName?: string | null
  onCancelRelocate?: () => void
  height?: string
  showControls?: boolean
  readOnly?: boolean
  enableClustering?: boolean
  showNumbers?: boolean
  inspectedStationIds?: Set<string>
  highlightedStationId?: string | null
  newStationIds?: Set<string>
  regionPolygons?: Array<{
    id: string
    paths: Array<{ lat: number; lng: number }>
    color: string
    opacity?: number
    label?: string
    stationCount?: number
  }>
  onRegionClick?: (id: string, bounds: google.maps.LatLngBounds) => void
  defaultMapType?: 'roadmap' | 'satellite' | 'hybrid'
}

// CSS för pulsering av highlighted marker
const PULSE_CSS = `
  @keyframes equipment-pulse-highlight {
    0%, 100% {
      box-shadow: 0 0 0 4px #3b82f6, 0 0 12px 4px rgba(59, 130, 246, 0.5);
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      box-shadow: 0 0 0 6px #3b82f6, 0 0 20px 8px rgba(59, 130, 246, 0.7);
      transform: translate(-50%, -50%) scale(1.15);
    }
  }
`

export function EquipmentMap({
  equipment,
  previewPosition,
  gpsAccuracy,
  onEquipmentClick,
  onEditEquipment,
  onDeleteEquipment,
  onMapClick,
  onRelocateClick,
  relocatingStationId,
  relocatingStationName,
  onCancelRelocate,
  height = '400px',
  showControls = true,
  readOnly = false,
  showNumbers = false,
  inspectedStationIds,
  highlightedStationId,
  newStationIds,
  regionPolygons,
  onRegionClick,
  enableClustering = false,
  defaultMapType = 'satellite',
}: EquipmentMapProps) {
  const { isLoaded, error: mapError } = useGoogleMaps({ libraries: ['marker', 'drawing', 'places'] })

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const previewMarkerRef = useRef<google.maps.Marker | null>(null)
  const previewCircleRef = useRef<google.maps.Circle | null>(null)
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const pulseOverlayRef = useRef<google.maps.Marker | null>(null)
  const newStationOverlaysRef = useRef<google.maps.Marker[]>([])
  const regionPolygonsRef = useRef<google.maps.Polygon[]>([])
  const regionLabelsRef = useRef<google.maps.Marker[]>([])
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const hasAutoZoomedRef = useRef(false)

  // State
  const [selectedEquipmentData, setSelectedEquipmentData] = useState<EquipmentPlacementWithRelations | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [stationTypes, setStationTypes] = useState<StationType[]>([])
  const [pendingRelocatePos, setPendingRelocatePos] = useState<{ lat: number; lng: number } | null>(null)

  // Hämta stationstyper
  useEffect(() => {
    StationTypeService.getActiveStationTypes()
      .then(types => setStationTypes(types))
      .catch(err => console.error('Kunde inte hämta stationstyper:', err))
  }, [])

  // Mappning equipment_type code → färg/namn
  const typeColorMap = useMemo(() => {
    const map = new Map<string, { color: string; name: string }>()
    stationTypes.forEach(type => {
      map.set(type.code, { color: type.color, name: type.name })
    })
    return map
  }, [stationTypes])

  // Hjälpfunktion: hämta rätt färg
  const getEquipmentColor = useCallback((item: EquipmentPlacementWithRelations): string => {
    if (item.station_type_data?.color) return item.station_type_data.color
    const typeData = typeColorMap.get(item.equipment_type)
    if (typeData?.color) return typeData.color
    return '#6b7280'
  }, [typeColorMap])

  // Nummermappning (sorterat på placed_at)
  const equipmentNumberMap = useMemo(() => {
    if (!showNumbers) return new Map<string, number>()
    const sorted = [...equipment].sort((a, b) => {
      const dateA = new Date(a.placed_at).getTime()
      const dateB = new Date(b.placed_at).getTime()
      return dateA - dateB
    })
    const map = new Map<string, number>()
    sorted.forEach((item, index) => {
      map.set(item.id, index + 1)
    })
    return map
  }, [equipment, showNumbers])

  // Hantera klick på markör
  const handleMarkerClick = useCallback((item: EquipmentPlacementWithRelations) => {
    if (readOnly && onEquipmentClick) {
      onEquipmentClick(item)
      return
    }
    setSelectedEquipmentData(item)
    setIsDetailSheetOpen(true)
    onEquipmentClick?.(item)
  }, [readOnly, onEquipmentClick])

  // Stäng detail sheet
  const handleCloseDetailSheet = useCallback(() => {
    setIsDetailSheetOpen(false)
    setTimeout(() => setSelectedEquipmentData(null), 300)
  }, [])

  const handleEditFromSheet = useCallback((item: EquipmentPlacementWithRelations) => {
    handleCloseDetailSheet()
    setTimeout(() => onEditEquipment?.(item), 150)
  }, [handleCloseDetailSheet, onEditEquipment])

  const handleDeleteFromSheet = useCallback((item: EquipmentPlacementWithRelations) => {
    handleCloseDetailSheet()
    setTimeout(() => onDeleteEquipment?.(item), 150)
  }, [handleCloseDetailSheet, onDeleteEquipment])

  // Centrera på användarens position
  const centerOnUserLocation = useCallback(() => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapRef.current?.panTo({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
          mapRef.current?.setZoom(DETAIL_ZOOM)
        },
        (error) => console.error('Kunde inte hämta position:', error)
      )
    }
  }, [])

  // Injicera CSS
  useEffect(() => {
    const styleId = 'equipment-map-pulse-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = PULSE_CSS
      document.head.appendChild(style)
    }
  }, [])

  // Initiera Google Maps
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current) return

    // Om redan initierad, hoppa över
    if (mapRef.current) return

    const center = equipment.length > 0
      ? calculateCenter(equipment)
      : { lat: SWEDEN_CENTER[0], lng: SWEDEN_CENTER[1] }

    const zoom = equipment.length === 1 ? DETAIL_ZOOM : DEFAULT_ZOOM

    const mapTypeId = defaultMapType === 'roadmap' ? google.maps.MapTypeId.ROADMAP
      : defaultMapType === 'hybrid' ? google.maps.MapTypeId.HYBRID
      : google.maps.MapTypeId.SATELLITE

    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom,
      mapTypeId,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT,
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        mapTypeIds: [
          google.maps.MapTypeId.ROADMAP,
          google.maps.MapTypeId.SATELLITE,
          google.maps.MapTypeId.HYBRID
        ]
      },
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      scaleControl: true,
      maxZoom: MAX_ZOOM
    })

    mapRef.current = map

    // Auto-zoom till alla stationer
    if (equipment.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      equipment.forEach(item => {
        bounds.extend({ lat: item.latitude, lng: item.longitude })
      })
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
    }
  }, [isLoaded])

  // Auto-zoom: täck alla polygoner + stationer när data laddas in
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    if (hasAutoZoomedRef.current) return

    const hasPolygons = regionPolygons && regionPolygons.length > 0
    const hasEquipment = equipment.length > 0

    if (!hasPolygons && !hasEquipment) return

    const bounds = new google.maps.LatLngBounds()

    if (hasPolygons) {
      regionPolygons!.forEach(poly => {
        poly.paths.forEach(point => bounds.extend(point))
      })
    }

    if (hasEquipment) {
      equipment.forEach(item => {
        bounds.extend({ lat: item.latitude, lng: item.longitude })
      })
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
      hasAutoZoomedRef.current = true
    }
  }, [isLoaded, regionPolygons, equipment])

  // Hantera kartklick
  useEffect(() => {
    if (!mapRef.current) return

    // Ta bort gammal listener
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current)
    }

    if (onMapClick && !readOnly) {
      clickListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          onMapClick(e.latLng.lat(), e.latLng.lng())
        }
      })
    }

    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current)
      }
    }
  }, [onMapClick, readOnly])

  // Uppdatera markörer när equipment ändras
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    // Rensa gamla markörer och clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current.setMap(null)
      clustererRef.current = null
    }
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const map = mapRef.current
    const newMarkers: google.maps.Marker[] = []

    equipment.forEach(item => {
      const color = getEquipmentColor(item)
      const isInspected = inspectedStationIds?.has(item.id) || false
      const isHighlighted = item.id === highlightedStationId
      const number = equipmentNumberMap.get(item.id)

      // Bestäm markörens visuella egenskaper
      const bgColor = isInspected ? '#22c55e' : color
      let opacity = 1
      let strokeColor = '#ffffff'
      let strokeWeight = 2

      if (item.status === 'removed') {
        opacity = 0.5
        strokeColor = '#64748b'
      }
      if (item.status === 'missing') {
        opacity = 0.85
        strokeColor = '#f59e0b'
      }
      if (item.status === 'damaged') {
        opacity = 0.85
        strokeColor = '#ef4444'
      }

      if (isHighlighted) {
        strokeColor = '#3b82f6'
        strokeWeight = 3
      } else if (isInspected) {
        strokeColor = '#16a34a'
        strokeWeight = 3
      }

      // Bestäm label-text
      let labelText = ''
      if (isInspected) {
        labelText = '✓'
      } else if (item.status === 'missing') {
        labelText = '?'
      } else if (item.status === 'removed') {
        labelText = '✕'
      } else if (item.status === 'damaged') {
        labelText = '!'
      } else if (number !== undefined) {
        labelText = number.toString()
      }

      const isRelocating = item.id === relocatingStationId

      const marker = new google.maps.Marker({
        position: { lat: item.latitude, lng: item.longitude },
        map: enableClustering ? null : map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isRelocating ? 18 : isHighlighted ? 16 : 14,
          fillColor: isRelocating ? '#f59e0b' : bgColor,
          fillOpacity: opacity,
          strokeColor: isRelocating ? '#ffffff' : strokeColor,
          strokeWeight: isRelocating ? 3 : strokeWeight
        },
        label: labelText ? {
          text: isRelocating ? '✥' : labelText,
          color: '#ffffff',
          fontSize: number && number >= 100 ? '9px' : isHighlighted ? '13px' : '11px',
          fontWeight: 'bold'
        } : (isRelocating ? { text: '✥', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' } : undefined),
        zIndex: isRelocating ? 2000 : isHighlighted ? 1000 : isInspected ? 500 : 100,
        clickable: true,
        draggable: isRelocating,
        cursor: isRelocating ? 'grab' : 'pointer'
      })

      if (isRelocating) {
        marker.addListener('dragstart', () => {
          setPendingRelocatePos(null)
        })
        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (pos) {
            setPendingRelocatePos({ lat: pos.lat(), lng: pos.lng() })
          }
        })
      } else {
        marker.addListener('click', () => handleMarkerClick(item))
      }
      newMarkers.push(marker)
    })

    markersRef.current = newMarkers

    // Sätt upp clusterer om enableClustering, annars sätt map direkt
    if (enableClustering && newMarkers.length > 0) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: newMarkers,
        renderer: {
          render: ({ count, position }) =>
            new google.maps.Marker({
              position,
              label: { text: String(count), color: '#fff', fontSize: '12px', fontWeight: 'bold' },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: count > 100 ? 28 : count > 50 ? 24 : count > 10 ? 20 : 16,
                fillColor: '#475569',
                fillOpacity: 0.92,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
              zIndex: 1000 + count,
            }),
        },
      })
    }

    // Auto-bounds vid equipment-ändring
    if (equipment.length > 1 && !highlightedStationId) {
      const bounds = new google.maps.LatLngBounds()
      equipment.forEach(item => {
        bounds.extend({ lat: item.latitude, lng: item.longitude })
      })
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
    } else if (equipment.length === 1) {
      map.setCenter({ lat: equipment[0].latitude, lng: equipment[0].longitude })
      map.setZoom(DETAIL_ZOOM)
    }
  }, [equipment, isLoaded, getEquipmentColor, inspectedStationIds, highlightedStationId, equipmentNumberMap, handleMarkerClick, relocatingStationId, enableClustering])

  // Panorera till highlighted station (wizard-läge)
  useEffect(() => {
    if (!mapRef.current || !highlightedStationId) return

    const station = equipment.find(e => e.id === highlightedStationId)
    if (station) {
      mapRef.current.panTo({ lat: station.latitude, lng: station.longitude })
      const currentZoom = mapRef.current.getZoom() || DEFAULT_ZOOM
      if (currentZoom < 17) {
        mapRef.current.setZoom(17)
      }
    }
  }, [highlightedStationId, equipment])

  // Puls-markör för highlighted station i wizard-läge
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    if (pulseOverlayRef.current) {
      pulseOverlayRef.current.setMap(null)
      pulseOverlayRef.current = null
    }

    if (!highlightedStationId) return

    const station = equipment.find(e => e.id === highlightedStationId)
    if (!station) return

    const pulseSize = 80
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="${pulseSize}" height="${pulseSize}" viewBox="0 0 ${pulseSize} ${pulseSize}">
      <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="28" fill="#3b82f6" fill-opacity="0.15" stroke="none">
        <animate attributeName="r" values="18;36;18" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="fill-opacity" values="0.3;0;0.3" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="22" fill="none" stroke="#60a5fa" stroke-width="4" opacity="1">
        <animate attributeName="r" values="16;26;16" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.1;1" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="4;1;4" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="16" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.9"/>
    </svg>`

    const pulseMarker = new google.maps.Marker({
      position: { lat: station.latitude, lng: station.longitude },
      map: mapRef.current,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
        scaledSize: new google.maps.Size(pulseSize, pulseSize),
        anchor: new google.maps.Point(pulseSize / 2, pulseSize / 2),
      },
      zIndex: 999,
      clickable: false,
    })

    pulseOverlayRef.current = pulseMarker
  }, [highlightedStationId, equipment, isLoaded])

  // Gröna puls-markörer för nya stationer (etablering)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    newStationOverlaysRef.current.forEach(m => m.setMap(null))
    newStationOverlaysRef.current = []

    if (!newStationIds || newStationIds.size === 0) return

    const pulseSize = 80
    newStationIds.forEach(id => {
      const station = equipment.find(e => e.id === id)
      if (!station) return

      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="${pulseSize}" height="${pulseSize}" viewBox="0 0 ${pulseSize} ${pulseSize}">
        <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="28" fill="#20c58f" fill-opacity="0.15" stroke="none">
          <animate attributeName="r" values="18;36;18" dur="1.6s" repeatCount="indefinite"/>
          <animate attributeName="fill-opacity" values="0.3;0;0.3" dur="1.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="22" fill="none" stroke="#20c58f" stroke-width="4" opacity="1">
          <animate attributeName="r" values="16;26;16" dur="1.6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="1;0.1;1" dur="1.6s" repeatCount="indefinite"/>
          <animate attributeName="stroke-width" values="4;1;4" dur="1.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="16" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.9"/>
      </svg>`

      const marker = new google.maps.Marker({
        position: { lat: station.latitude, lng: station.longitude },
        map: mapRef.current!,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
          scaledSize: new google.maps.Size(pulseSize, pulseSize),
          anchor: new google.maps.Point(pulseSize / 2, pulseSize / 2),
        },
        zIndex: 998,
        clickable: false,
      })
      newStationOverlaysRef.current.push(marker)
    })
  }, [newStationIds, equipment, isLoaded])

  // Regionpolygoner
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    // Rensa gamla polygoner och labels
    regionPolygonsRef.current.forEach(p => p.setMap(null))
    regionPolygonsRef.current = []
    regionLabelsRef.current.forEach(m => m.setMap(null))
    regionLabelsRef.current = []

    if (!regionPolygons || regionPolygons.length === 0) return

    regionPolygons.forEach(region => {
      if (!region.paths || region.paths.length < 3) return

      const bounds = new google.maps.LatLngBounds()
      region.paths.forEach(p => bounds.extend(p))

      const polygon = new google.maps.Polygon({
        paths: region.paths,
        strokeColor: region.color,
        strokeWeight: 2,
        strokeOpacity: 0.8,
        fillColor: region.color,
        fillOpacity: region.opacity ?? 0.2,
        map: mapRef.current!,
        zIndex: 1,
        ...(onRegionClick ? { cursor: 'pointer' } : {}),
      })

      if (onRegionClick) {
        polygon.addListener('click', () => {
          mapRef.current?.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
          onRegionClick(region.id, bounds)
        })
      }

      regionPolygonsRef.current.push(polygon)

      // Centroid-label med regionnamn + stationsantal
      if (region.label) {
        const center = bounds.getCenter()
        const countText = region.stationCount != null ? ` (${region.stationCount})` : ''
        const label = new google.maps.Marker({
          position: center,
          map: mapRef.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: `${region.label}${countText}`,
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '600',
          },
          zIndex: 2,
          clickable: !!onRegionClick,
        })
        if (onRegionClick) {
          label.addListener('click', () => {
            mapRef.current?.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
            onRegionClick(region.id, bounds)
          })
        }
        regionLabelsRef.current.push(label)
      }
    })
  }, [regionPolygons, isLoaded, onRegionClick])

  // Preview-markör och GPS-cirkel
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const map = mapRef.current

    // Rensa gamla
    if (previewMarkerRef.current) {
      previewMarkerRef.current.setMap(null)
      previewMarkerRef.current = null
    }
    if (previewCircleRef.current) {
      previewCircleRef.current.setMap(null)
      previewCircleRef.current = null
    }

    if (previewPosition) {
      // GPS-noggrannhetscirkel
      if (gpsAccuracy && gpsAccuracy > 0) {
        const circleColor = gpsAccuracy <= 30 ? '#22c55e' : gpsAccuracy <= 100 ? '#eab308' : '#ef4444'
        previewCircleRef.current = new google.maps.Circle({
          center: previewPosition,
          radius: gpsAccuracy,
          map,
          fillColor: circleColor,
          fillOpacity: 0.15,
          strokeColor: circleColor,
          strokeWeight: 2,
          strokeOpacity: 0.6
        })
      }

      // Preview-markör
      previewMarkerRef.current = new google.maps.Marker({
        position: previewPosition,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 20,
          fillColor: '#3b82f6',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 4
        },
        zIndex: 2000
      })

      // Panorera till preview
      map.panTo(previewPosition)
      map.setZoom(DETAIL_ZOOM)
    }
  }, [previewPosition, gpsAccuracy, isLoaded])

  // Legend-data
  const legendItems = useMemo(() => {
    const legendMap = new Map<string, { color: string; label: string }>()
    equipment.forEach(item => {
      if (!legendMap.has(item.equipment_type)) {
        const dynamicData = item.station_type_data
        const mappedData = typeColorMap.get(item.equipment_type)
        const legacyConfig = EQUIPMENT_TYPE_CONFIG[item.equipment_type as keyof typeof EQUIPMENT_TYPE_CONFIG]
        legendMap.set(item.equipment_type, {
          color: dynamicData?.color || mappedData?.color || legacyConfig?.color || '#6b7280',
          label: dynamicData?.name || mappedData?.name || legacyConfig?.label || item.equipment_type
        })
      }
    })
    if (legendMap.size === 0) {
      return Object.entries(EQUIPMENT_TYPE_CONFIG).map(([key, config]) => ({
        key,
        color: config.color,
        label: config.label
      }))
    }
    return Array.from(legendMap.entries()).map(([key, { color, label }]) => ({
      key, color, label
    }))
  }, [equipment, typeColorMap])

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-slate-800/50 rounded-lg">
        <div className="text-slate-400 text-sm">
          {mapError || 'Laddar karta...'}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} className="rounded-lg" />

      {/* Flytta-station-banner */}
      {relocatingStationId && (
        <div className="absolute top-0 left-0 right-0 z-40 bg-amber-600/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-medium text-sm">
                {pendingRelocatePos ? 'Ny position vald' : `Dra ${relocatingStationName || 'stationen'} till ny plats`}
              </p>
              <p className="text-amber-100 text-xs">
                {pendingRelocatePos ? 'Bekräfta för att spara' : 'Håll och dra den gula markören'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingRelocatePos && (
              <button
                onClick={() => {
                  onRelocateClick?.(pendingRelocatePos.lat, pendingRelocatePos.lng)
                  setPendingRelocatePos(null)
                }}
                className="px-3 py-1.5 bg-white text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors"
              >
                Bekräfta
              </button>
            )}
            <button
              onClick={() => {
                setPendingRelocatePos(null)
                onCancelRelocate?.()
              }}
              className="px-3 py-1.5 text-white hover:bg-white/20 text-sm rounded-lg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Kontroller */}
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

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">Utrustningstyper</p>
        <div className="flex flex-col gap-1">
          {legendItems.map(({ key, color, label }) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment Detail Sheet */}
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
