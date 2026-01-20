// src/components/customer/InspectionPhotoLightbox.tsx
// Fullskärms foto-lightbox för inspektionsbilder i kundportalen

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react'

interface Photo {
  url: string
  stationNumber: string
  stationType: 'outdoor' | 'indoor'
  status: string
  inspectedAt: string
  findings?: string
}

interface InspectionPhotoLightboxProps {
  photos: Photo[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
}

export function InspectionPhotoLightbox({
  photos,
  initialIndex,
  isOpen,
  onClose
}: InspectionPhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setZoom(1)
      setIsLoading(true)
    }
  }, [isOpen, initialIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowLeft':
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))
        setZoom(1)
        setIsLoading(true)
        break
      case 'ArrowRight':
        setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))
        setZoom(1)
        setIsLoading(true)
        break
      case '+':
      case '=':
        setZoom(prev => Math.min(prev + 0.25, 3))
        break
      case '-':
        setZoom(prev => Math.max(prev - 0.25, 0.5))
        break
    }
  }, [isOpen, photos.length, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentIndex]

  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))
    setZoom(1)
    setIsLoading(true)
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))
    setZoom(1)
    setIsLoading(true)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(currentPhoto.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `station-${currentPhoto.stationNumber}-${new Date(currentPhoto.inspectedAt).toISOString().split('T')[0]}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-500'
      case 'activity':
        return 'bg-amber-500'
      case 'needs_service':
        return 'bg-blue-500'
      case 'replaced':
        return 'bg-purple-500'
      default:
        return 'bg-slate-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok':
        return 'OK'
      case 'activity':
        return 'Aktivitet'
      case 'needs_service':
        return 'Behöver service'
      case 'replaced':
        return 'Utbytt'
      default:
        return status
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(currentPhoto.status)}`} />
            <span className="text-white font-medium">
              Station {currentPhoto.stationNumber}
            </span>
            <span className="text-slate-400 text-sm">
              ({currentPhoto.stationType === 'outdoor' ? 'Utomhus' : 'Inomhus'})
            </span>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 text-sm">
            {formatDate(currentPhoto.inspectedAt)}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            currentPhoto.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
            currentPhoto.status === 'activity' ? 'bg-amber-500/20 text-amber-400' :
            currentPhoto.status === 'needs_service' ? 'bg-blue-500/20 text-blue-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {getStatusLabel(currentPhoto.status)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Photo counter */}
          <span className="text-slate-400 text-sm mr-4">
            {currentIndex + 1} / {photos.length}
          </span>

          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zooma ut (−)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-medium min-w-[60px]"
            title="Återställ zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zooma in (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-slate-700 mx-2" />

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="Ladda ner"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="Stäng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors z-10"
              title="Föregående (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors z-10"
              title="Nästa (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Image */}
        <img
          src={currentPhoto.url}
          alt={`Station ${currentPhoto.stationNumber}`}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          draggable={false}
        />
      </div>

      {/* Footer with findings */}
      {currentPhoto.findings && (
        <div
          className="px-4 py-3 bg-slate-900/80 border-t border-slate-700/50"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Teknikerns notering</p>
          <p className="text-slate-300 text-sm">{currentPhoto.findings}</p>
        </div>
      )}

      {/* Thumbnail strip for multiple photos */}
      {photos.length > 1 && (
        <div
          className="px-4 py-3 bg-slate-900/80 border-t border-slate-700/50 overflow-x-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex gap-2 justify-center">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index)
                  setZoom(1)
                  setIsLoading(true)
                }}
                className={`relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                  index === currentIndex
                    ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-900'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.url}
                  alt={`Station ${photo.stationNumber}`}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${getStatusColor(photo.status)}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionPhotoLightbox
