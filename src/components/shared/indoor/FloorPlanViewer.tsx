// src/components/shared/indoor/FloorPlanViewer.tsx
// Bildvisare med zoom/pan för planritningar och stationsmarkörer

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { ZoomIn, ZoomOut, Maximize, Move, Plus, X, Check } from 'lucide-react'
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
  // Cover-dimensioner för att fylla containern kant-till-kant
  const [coverDimensions, setCoverDimensions] = useState<{ width: number; height: number } | null>(null)
  // Tvåstegs-placering: pending position som kan dras till rätt plats
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)

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

  // Hantera bildladdning och beräkna cover-dimensioner för att fylla containern
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const imgWidth = imageRef.current.naturalWidth
      const imgHeight = imageRef.current.naturalHeight

      setImageDimensions({
        width: imgWidth,
        height: imgHeight
      })

      // Beräkna container-dimensioner
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height

      // Beräkna cover-skala (större av de två) för att fylla hela containern
      const scaleX = containerWidth / imgWidth
      const scaleY = containerHeight / imgHeight
      const coverScale = Math.max(scaleX, scaleY)

      // Beräkna dimensioner som fyller containern kant-till-kant
      setCoverDimensions({
        width: imgWidth * coverScale,
        height: imgHeight * coverScale
      })

      setImageLoaded(true)
    }
  }, [])

  // Beräkna klickposition i procent — sätter pendingPosition (steg 1)
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (placementMode !== 'place' && placementMode !== 'move') return
    if (!imageRef.current || !onImageClick) return
    if (isDragging) return

    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      setPendingPosition({ x, y })
    }
  }, [placementMode, onImageClick, isDragging])

  // Hantera touch för mobil — sätter pendingPosition (steg 1)
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (placementMode !== 'place' && placementMode !== 'move') return
    if (!imageRef.current || !onImageClick) return
    if (isDragging) return
    if (e.touches.length > 0) return

    const touch = e.changedTouches[0]
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((touch.clientX - rect.left) / rect.width) * 100
    const y = ((touch.clientY - rect.top) / rect.height) * 100

    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      setPendingPosition({ x, y })
    }
  }, [placementMode, onImageClick, isDragging])

  // Bekräfta pendingPosition → anropa onImageClick (steg 2)
  const handleConfirmPosition = useCallback(() => {
    if (pendingPosition && onImageClick) {
      onImageClick(pendingPosition.x, pendingPosition.y)
      setPendingPosition(null)
    }
  }, [pendingPosition, onImageClick])

  // Avbryt pendingPosition
  const handleCancelPending = useCallback(() => {
    setPendingPosition(null)
  }, [])

  // Drag-hantering för pending-markör via pointer events
  const handleMarkerPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    dragStartRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY }
    setIsDragging(true)
  }, [])

  const handleMarkerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !imageRef.current || !pendingPosition) return
    e.stopPropagation()
    e.preventDefault()

    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // Clampa till 0-100
    setPendingPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    })
  }, [pendingPosition])

  const handleMarkerPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    dragStartRef.current = null
    // Fördröj isDragging=false så att klick inte triggar ny placering
    setTimeout(() => setIsDragging(false), 50)
  }, [])

  // Nollställ pendingPosition när placement-läge ändras
  useEffect(() => {
    setPendingPosition(null)
  }, [placementMode])

  // Återställ zoom till 1x och centrera
  const handleResetZoom = useCallback(() => {
    if (transformRef.current) {
      transformRef.current.resetTransform(200, 'easeOut')
    }
  }, [])

  // Återställ vy när highlighted station ändras (guidat läge)
  // Ingen auto-zoom - låt den pulserande markören visa vägen istället
  useEffect(() => {
    if (!highlightedStationId || !imageLoaded) return

    // Återställ till normalvy så alla stationer syns
    if (transformRef.current) {
      transformRef.current.resetTransform(300, 'easeOut')
    }
  }, [highlightedStationId, imageLoaded])

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
                        {pendingPosition ? 'Dra markören till rätt plats' : 'Tryck på bilden för att välja position'}
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
                      {pendingPosition ? 'Dra markören till rätt plats' : 'Tryck på bilden för att välja ny position'}
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
        panning={{ disabled: isDragging }}
        pinch={{ disabled: isDragging }}
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
            {/* Floor plan image - fyller containern kant-till-kant */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Planritning"
              onLoad={handleImageLoad}
              className="select-none"
              draggable={false}
              style={coverDimensions ? {
                width: coverDimensions.width,
                height: coverDimensions.height,
              } : undefined}
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

            {/* Draggbar pending-markör (tvåstegs-placering) */}
            {imageLoaded && pendingPosition && (
              <div
                className="absolute z-40 touch-none"
                style={{
                  left: `${pendingPosition.x}%`,
                  top: `${pendingPosition.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                onPointerDown={handleMarkerPointerDown}
                onPointerMove={handleMarkerPointerMove}
                onPointerUp={handleMarkerPointerUp}
              >
                <div className="relative">
                  {/* Pulsating ring */}
                  <div className="absolute inset-[-4px] animate-ping rounded-full bg-emerald-400 opacity-50" />

                  {/* Draggbar markör */}
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
                    style={{
                      backgroundColor: getTypeConfig(selectedType, selectedTypeData).color
                    }}
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </div>

                  {/* Instruktionstext under markören */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap pointer-events-none">
                    <span className="text-[10px] bg-slate-900/90 text-white px-2 py-1 rounded-full shadow-lg">
                      Dra för att justera
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Legacy preview marker (för extern previewPosition-prop) */}
            {imageLoaded && previewPosition && !pendingPosition && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${previewPosition.x}%`,
                  top: `${previewPosition.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
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
            {isPlacementActive && !previewPosition && !pendingPosition && (
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

      {/* Bekräfta/avbryt position */}
      {pendingPosition && (
        <div className="absolute bottom-4 left-4 z-20 flex gap-2">
          <button
            onClick={handleConfirmPosition}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#20c58f] hover:bg-[#1ab07f] text-white text-sm font-medium rounded-xl shadow-lg transition-colors min-h-[44px]"
          >
            <Check className="w-4 h-4" />
            Bekräfta position
          </button>
          <button
            onClick={handleCancelPending}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white text-sm rounded-xl shadow-lg transition-colors min-h-[44px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
