// src/components/shared/indoor/FloorPlanViewer.tsx
// Bildvisare med zoom/pan för planritningar och stationsmarkörer

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { ZoomIn, ZoomOut, Maximize, Move, Plus, X } from 'lucide-react'
import type { IndoorStationWithRelations, PlacementMode, IndoorStationType } from '../../../types/indoor'
import { INDOOR_STATION_TYPE_CONFIG } from '../../../types/indoor'
import { IndoorStationMarker } from './IndoorStationMarker'
import type { StationType } from '../../../types/stationTypes'

interface FloorPlanViewerProps {
  imageUrl: string
  imageWidth?: number | null
  imageHeight?: number | null
  stations: IndoorStationWithRelations[]
  selectedStationId?: string | null
  placementMode: PlacementMode
  selectedType?: IndoorStationType | null
  selectedTypeData?: StationType | null  // Dynamisk stationstypsdata från DB
  previewPosition?: { x: number; y: number } | null
  onStationClick?: (station: IndoorStationWithRelations) => void
  onImageClick?: (x: number, y: number) => void
  onCancelPlacement?: () => void
  height?: string
  showNumbers?: boolean // Visa stationsnummer (1, 2, 3...) baserat på placeringsordning
  inspectedStationIds?: Set<string> // IDs för inspekterade stationer (visas med grön bock)
  highlightedStationId?: string | null // ID för station att highlighta (wizard-läge)
}

// Hämta typkonfiguration - prioriterar dynamisk data
function getTypeConfig(selectedType: IndoorStationType | null | undefined, selectedTypeData: StationType | null | undefined) {
  // Prioritera dynamisk data från databasen
  if (selectedTypeData) {
    return {
      label: selectedTypeData.name,
      color: selectedTypeData.color
    }
  }
  // Fallback till legacy-config
  if (selectedType && INDOOR_STATION_TYPE_CONFIG[selectedType]) {
    return {
      label: INDOOR_STATION_TYPE_CONFIG[selectedType].label,
      color: INDOOR_STATION_TYPE_CONFIG[selectedType].color
    }
  }
  // Default
  return {
    label: selectedType || 'Station',
    color: '#10b981'
  }
}

export function FloorPlanViewer({
  imageUrl,
  stations,
  selectedStationId,
  placementMode,
  selectedType,
  selectedTypeData,
  previewPosition,
  onStationClick,
  onImageClick,
  onCancelPlacement,
  height = 'calc(100vh - 200px)',
  showNumbers = false,
  inspectedStationIds,
  highlightedStationId
}: FloorPlanViewerProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [initialScale, setInitialScale] = useState(1)

  // Skapa mappning från station ID till nummer (1, 2, 3...)
  // Baserat på placed_at i stigande ordning (äldsta placering = nummer 1)
  const stationNumberMap = useMemo(() => {
    if (!showNumbers) return new Map<string, number>()

    // Sortera efter placed_at ascending (äldsta först)
    const sorted = [...stations].sort((a, b) => {
      const dateA = new Date(a.placed_at).getTime()
      const dateB = new Date(b.placed_at).getTime()
      return dateA - dateB
    })

    // Skapa mappning: ID → nummer
    const map = new Map<string, number>()
    sorted.forEach((station, index) => {
      map.set(station.id, index + 1)
    })
    return map
  }, [stations, showNumbers])

  // Hantera bildladdning och beräkna optimal zoom
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const imgWidth = imageRef.current.naturalWidth
      const imgHeight = imageRef.current.naturalHeight

      setImageDimensions({
        width: imgWidth,
        height: imgHeight
      })

      // Beräkna optimal initial scale för att fylla containern bättre
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height

      // Beräkna hur mycket bilden måste skalas för att fylla containern
      // Vi vill att bilden ska fylla så mycket som möjligt utan att bli för stor
      const scaleX = containerWidth / imgWidth
      const scaleY = containerHeight / imgHeight

      // Använd den större skalan (cover-liknande) men begränsa till max 1.5
      // Detta gör att bilden fyller containern bättre utan att bli för uppskalad
      const coverScale = Math.max(scaleX, scaleY)
      const optimalScale = Math.min(Math.max(coverScale, 1), 1.5)

      setInitialScale(optimalScale)
      setImageLoaded(true)
    }
  }, [])

  // Beräkna klickposition i procent
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (placementMode !== 'place' && placementMode !== 'move') return
    if (!imageRef.current || !onImageClick) return

    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // Validera att klicket är inom bilden
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      onImageClick(x, y)
    }
  }, [placementMode, onImageClick])

  // Hantera touch för mobil
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (placementMode !== 'place' && placementMode !== 'move') return
    if (!imageRef.current || !onImageClick) return
    if (e.touches.length > 0) return // Ignorera om fler fingrar finns (pinch)

    const touch = e.changedTouches[0]
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((touch.clientX - rect.left) / rect.width) * 100
    const y = ((touch.clientY - rect.top) / rect.height) * 100

    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      onImageClick(x, y)
    }
  }, [placementMode, onImageClick])

  // Applicera initial zoom vid bildändring
  useEffect(() => {
    if (imageLoaded && transformRef.current && initialScale > 1) {
      // Använd setTimeout för att ge TransformWrapper tid att rendera
      setTimeout(() => {
        transformRef.current?.setTransform(0, 0, initialScale, 200, 'easeOut')
      }, 100)
    }
  }, [imageUrl, imageLoaded, initialScale])

  // Återställ till optimal zoom (inte 1, utan initialScale)
  const handleResetZoom = useCallback(() => {
    if (transformRef.current) {
      transformRef.current.setTransform(0, 0, initialScale, 200, 'easeOut')
    }
  }, [initialScale])

  const isPlacementActive = placementMode === 'place' || placementMode === 'move'

  return (
    <div className="relative w-full" style={{ height }} ref={containerRef}>
      {/* Placement mode header */}
      {isPlacementActive && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-emerald-600/95 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {placementMode === 'place' && selectedType && (() => {
                const typeConfig = getTypeConfig(selectedType, selectedTypeData)
                return (
                  <>
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white"
                      style={{ backgroundColor: typeConfig.color }}
                    />
                    <div>
                      <p className="text-white font-medium text-sm">
                        Placera {typeConfig.label}
                      </p>
                      <p className="text-emerald-100 text-xs">
                        Tryck på bilden för att välja position
                      </p>
                    </div>
                  </>
                )
              })()}
              {placementMode === 'move' && (
                <div className="flex items-center gap-2">
                  <Move className="w-5 h-5 text-white" />
                  <div>
                    <p className="text-white font-medium text-sm">Flytta station</p>
                    <p className="text-emerald-100 text-xs">
                      Tryck på bilden för att välja ny position
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onCancelPlacement}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => transformRef.current?.zoomIn()}
          className="p-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg shadow-lg backdrop-blur-sm transition-colors"
          title="Zooma in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => transformRef.current?.zoomOut()}
          className="p-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg shadow-lg backdrop-blur-sm transition-colors"
          title="Zooma ut"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg shadow-lg backdrop-blur-sm transition-colors"
          title="Återställ zoom"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      {/* Main viewer */}
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.3}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        disabled={isPlacementActive} // Disable pan/zoom in placement mode
        panning={{ disabled: isPlacementActive }}
        pinch={{ disabled: isPlacementActive }}
        doubleClick={{ disabled: isPlacementActive }}
      >
        <TransformComponent
          wrapperStyle={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1e293b'
          }}
          contentStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className={`relative ${isPlacementActive ? 'cursor-crosshair' : 'cursor-grab'}`}
            onClick={handleImageClick}
            onTouchEnd={handleTouchEnd}
          >
            {/* Floor plan image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Planritning"
              onLoad={handleImageLoad}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
              style={{ maxHeight: height }}
            />

            {/* Station markers */}
            {imageLoaded && stations.map((station) => (
              <IndoorStationMarker
                key={station.id}
                station={station}
                isSelected={station.id === selectedStationId}
                onClick={() => onStationClick?.(station)}
                displayNumber={showNumbers ? stationNumberMap.get(station.id) : undefined}
                isInspected={inspectedStationIds?.has(station.id)}
                isHighlighted={station.id === highlightedStationId}
              />
            ))}

            {/* Preview marker for new placement */}
            {imageLoaded && previewPosition && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${previewPosition.x}%`,
                  top: `${previewPosition.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="relative">
                  {/* Pulsating ring */}
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />

                  {/* Main marker */}
                  <div
                    className="w-8 h-8 rounded-full border-3 border-white shadow-lg flex items-center justify-center"
                    style={{
                      backgroundColor: getTypeConfig(selectedType, selectedTypeData).color
                    }}
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Crosshair overlay in placement mode */}
            {isPlacementActive && !previewPosition && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative">
                  <div className="absolute w-px h-8 bg-emerald-400/50 -translate-x-1/2 -translate-y-full" />
                  <div className="absolute w-px h-8 bg-emerald-400/50 -translate-x-1/2" />
                  <div className="absolute w-8 h-px bg-emerald-400/50 -translate-y-1/2 -translate-x-full" />
                  <div className="absolute w-8 h-px bg-emerald-400/50 -translate-y-1/2" />
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-400 bg-emerald-400/20" />
                </div>
              </div>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Loading state */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Laddar planritning...</p>
          </div>
        </div>
      )}
    </div>
  )
}
