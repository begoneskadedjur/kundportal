import { useEffect, useCallback } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Camera,
  CheckCircle,
  Megaphone,
  GraduationCap
} from 'lucide-react'
import { createPortal } from 'react-dom'
import type { CaseImageWithUrl } from '../../../services/caseImageService'
import { formatFileSize } from '../../../services/caseImageService'
import type { CaseImageTag } from '../../../types/database'
import { CASE_IMAGE_TAG_DISPLAY } from '../../../types/database'

function getTagIcon(tag: CaseImageTag, size = 'w-3 h-3') {
  switch (tag) {
    case 'before': return <Camera className={size} />
    case 'after': return <CheckCircle className={size} />
    case 'pr': return <Megaphone className={size} />
    case 'education': return <GraduationCap className={size} />
    default: return <ImageIcon className={size} />
  }
}

interface ImageBankLightboxProps {
  image: CaseImageWithUrl
  images: CaseImageWithUrl[]
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
  onDownload: (url: string, fileName: string) => void
}

export default function ImageBankLightbox({
  image,
  images,
  onClose,
  onNavigate,
  onDownload,
}: ImageBankLightboxProps) {
  const currentIndex = images.findIndex(img => img.id === image.id)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') onNavigate('prev')
    if (e.key === 'ArrowRight') onNavigate('next')
  }, [onClose, onNavigate])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 2147483647, backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={() => onNavigate('prev')}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={() => onNavigate('next')}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Image */}
      <img
        src={image.url}
        alt={image.file_name}
        className="max-w-[90vw] max-h-[85vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Tags */}
            <div className="flex items-center gap-1.5">
              {(image.tags || ['general']).map(tag => {
                const tagKey = tag as CaseImageTag
                const tagConfig = CASE_IMAGE_TAG_DISPLAY[tagKey]
                return (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-white/15 text-white"
                  >
                    {getTagIcon(tagKey, 'w-3 h-3')}
                    {tagConfig?.label || tag}
                  </span>
                )
              })}
            </div>
            {/* File info */}
            <span className="text-sm text-white/60">{image.file_name}</span>
            {image.file_size && (
              <span className="text-sm text-white/40">{formatFileSize(image.file_size)}</span>
            )}
            {/* Counter */}
            {images.length > 1 && (
              <span className="text-sm text-white/60">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>

          {/* Download button */}
          <button
            onClick={() => onDownload(image.url, image.file_name)}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Ladda ner
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
