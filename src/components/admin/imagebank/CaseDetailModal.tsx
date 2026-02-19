import { useState, useEffect, useCallback } from 'react'
import {
  X,
  MapPin,
  User,
  Calendar,
  Bug,
  Image as ImageIcon,
  Package,
  FileText,
  CheckCircle,
  ZoomIn,
  Download,
  Loader2,
  Camera,
  Megaphone,
  GraduationCap
} from 'lucide-react'
import { createPortal } from 'react-dom'
import Button from '../../ui/Button'
import { CaseImageService } from '../../../services/caseImageService'
import type { CaseImageWithUrl } from '../../../services/caseImageService'
import type { CaseImageTag } from '../../../types/database'
import { CASE_IMAGE_TAG_DISPLAY } from '../../../types/database'
import { PEST_TYPES } from '../../../utils/clickupFieldMapper'
import type { GalleryItem } from './GalleryCard'

const PEST_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map(pt => [pt.id, pt.name])
)

const TAG_BADGE_STYLES: Record<CaseImageTag, string> = {
  before: 'bg-orange-500/30 text-orange-300',
  after: 'bg-green-500/30 text-green-300',
  general: 'bg-blue-500/30 text-blue-300',
  pr: 'bg-purple-500/30 text-purple-300',
  education: 'bg-teal-500/30 text-teal-300',
}

function getStatusColor(status: string) {
  const s = status?.toLowerCase() || ''
  if (s.includes('avslut') || s.includes('klar')) return 'bg-green-500/20 text-green-400'
  if (s.includes('pågå') || s.includes('bokad')) return 'bg-blue-500/20 text-blue-400'
  if (s.includes('öppen') || s.includes('ny')) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-slate-500/20 text-slate-400'
}

function getCaseTypeBadge(caseType: string) {
  switch (caseType) {
    case 'private': return { label: 'Privat', color: 'bg-blue-500/20 text-blue-400' }
    case 'business': return { label: 'Företag', color: 'bg-green-500/20 text-green-400' }
    case 'contract': return { label: 'Avtal', color: 'bg-purple-500/20 text-purple-400' }
    default: return { label: caseType, color: 'bg-slate-500/20 text-slate-400' }
  }
}

function getTagIcon(tag: CaseImageTag, size = 'w-3 h-3') {
  switch (tag) {
    case 'before': return <Camera className={size} />
    case 'after': return <CheckCircle className={size} />
    case 'pr': return <Megaphone className={size} />
    case 'education': return <GraduationCap className={size} />
    default: return <ImageIcon className={size} />
  }
}

interface CaseDetailModalProps {
  caseItem: GalleryItem
  onClose: () => void
  onDownloadZip: (item: GalleryItem) => void
  onOpenLightbox: (image: CaseImageWithUrl, allImages: CaseImageWithUrl[]) => void
  isDownloading: boolean
}

export default function CaseDetailModal({
  caseItem,
  onClose,
  onDownloadZip,
  onOpenLightbox,
  isDownloading,
}: CaseDetailModalProps) {
  const [images, setImages] = useState<CaseImageWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [featuredImage, setFeaturedImage] = useState<CaseImageWithUrl | null>(null)

  const caseType = getCaseTypeBadge(caseItem.case_type)
  const pestLabel = caseItem.pest_type ? (PEST_TYPE_DISPLAY[caseItem.pest_type] || caseItem.pest_type) : null

  const formattedDate = caseItem.scheduled_date
    ? new Date(caseItem.scheduled_date).toLocaleDateString('sv-SE', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : null

  // Fetch all images when modal opens
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const imgs = await CaseImageService.getCaseImages(caseItem.case_id, caseItem.case_type)
        if (cancelled) return
        setImages(imgs)
        if (imgs.length > 0) setFeaturedImage(imgs[0])
      } catch {
        // silently fail - images just won't show
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [caseItem.case_id, caseItem.case_type])

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleDownloadImage = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      // silently fail
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto
                   bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg font-semibold text-white truncate">
                  {caseItem.title || 'Utan titel'}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${caseType.color}`}>
                  {caseType.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                  {caseItem.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                {caseItem.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {caseItem.address}
                  </span>
                )}
                {caseItem.technician_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {caseItem.technician_name}
                  </span>
                )}
                {formattedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate}
                  </span>
                )}
                {pestLabel && (
                  <span className="flex items-center gap-1">
                    <Bug className="w-3.5 h-3.5" />
                    {pestLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <Button
                onClick={() => onDownloadZip(caseItem)}
                variant="outline"
                size="sm"
                disabled={isDownloading}
              >
                <Package className="w-4 h-4 mr-2" />
                Ladda ner ZIP
              </Button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content area: featured image + descriptions */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          ) : (
            <>
              {/* Two column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
                {/* Left: Featured image (3/5) */}
                <div className="lg:col-span-3">
                  {featuredImage ? (
                    <div
                      className="relative rounded-xl overflow-hidden bg-slate-800 cursor-pointer group"
                      onClick={() => onOpenLightbox(featuredImage, images)}
                    >
                      <img
                        src={featuredImage.url}
                        alt={featuredImage.file_name}
                        className="w-full max-h-[400px] object-contain bg-black/20"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-slate-800 rounded-xl">
                      <ImageIcon className="w-12 h-12 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Right: Descriptions (2/5) */}
                <div className="lg:col-span-2 space-y-3">
                  {/* Description */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Ärendebeskrivning
                    </h4>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {caseItem.description || 'Ingen beskrivning'}
                    </p>
                  </div>

                  {/* Work description */}
                  <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Utfört arbete
                    </h4>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {caseItem.work_description || 'Ingen rapport'}
                    </p>
                  </div>
                </div>
              </div>

              {/* All images grid */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <ImageIcon className="w-4 h-4 text-teal-400" />
                  Dokumentation ({images.length} bilder)
                </h3>
                {images.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Inga bilder</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className={`relative group aspect-square rounded-lg overflow-hidden bg-slate-800 cursor-pointer
                                    ${featuredImage?.id === image.id ? 'ring-2 ring-[#20c58f]' : ''}`}
                        onClick={() => setFeaturedImage(image)}
                        onDoubleClick={() => onOpenLightbox(image, images)}
                      >
                        <img
                          src={image.url}
                          alt={image.file_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {/* Tag badge */}
                        <div className="absolute top-1 left-1">
                          {(image.tags || ['general']).slice(0, 1).map(tag => {
                            const tagKey = tag as CaseImageTag
                            const style = TAG_BADGE_STYLES[tagKey] || TAG_BADGE_STYLES.general
                            return (
                              <span
                                key={tag}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${style}`}
                              >
                                {getTagIcon(tagKey, 'w-2.5 h-2.5')}
                                <span className="hidden sm:inline">{CASE_IMAGE_TAG_DISPLAY[tagKey]?.label || tag}</span>
                              </span>
                            )
                          })}
                        </div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1">
                          <button
                            className="p-1.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); onOpenLightbox(image, images) }}
                          >
                            <ZoomIn className="w-4 h-4 text-white" />
                          </button>
                          <button
                            className="p-1.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDownloadImage(image.url, image.file_name) }}
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
