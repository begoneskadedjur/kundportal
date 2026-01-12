// src/components/shared/CaseImageGallery.tsx
import { useState, useEffect, useCallback } from 'react'
import {
  Image as ImageIcon,
  Camera,
  CheckCircle,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { CaseImageService, CaseImageWithUrl, formatFileSize } from '../../services/caseImageService'
import { CaseImageCategory, CASE_IMAGE_CATEGORY_DISPLAY } from '../../types/database'
import toast from 'react-hot-toast'

interface CaseImageGalleryProps {
  caseId: string
  caseType: 'private' | 'business' | 'contract'
  canDelete?: boolean
  onImageDeleted?: () => void
  refreshTrigger?: number
  showCategories?: boolean
  compact?: boolean
}

export default function CaseImageGallery({
  caseId,
  caseType,
  canDelete = false,
  onImageDeleted,
  refreshTrigger = 0,
  showCategories = true,
  compact = false
}: CaseImageGalleryProps) {
  const [images, setImages] = useState<CaseImageWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<CaseImageWithUrl | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<CaseImageCategory | 'all'>('all')

  // Hämta bilder
  const fetchImages = useCallback(async () => {
    setLoading(true)
    try {
      const fetchedImages = await CaseImageService.getCaseImages(caseId, caseType)
      setImages(fetchedImages)
    } catch (error) {
      console.error('Fel vid hämtning av bilder:', error)
      toast.error('Kunde inte hämta bilder')
    } finally {
      setLoading(false)
    }
  }, [caseId, caseType])

  useEffect(() => {
    fetchImages()
  }, [fetchImages, refreshTrigger])

  // Filtrera bilder efter kategori
  const filteredImages = activeCategory === 'all'
    ? images
    : images.filter(img => img.category === activeCategory)

  // Ta bort bild
  const handleDelete = async (imageId: string) => {
    if (!canDelete) return

    setDeletingId(imageId)
    try {
      const result = await CaseImageService.deleteCaseImage(imageId)
      if (result.success) {
        setImages(prev => prev.filter(img => img.id !== imageId))
        toast.success('Bilden togs bort')
        onImageDeleted?.()

        // Stäng lightbox om den borttagna bilden visas
        if (selectedImage?.id === imageId) {
          setSelectedImage(null)
        }
      } else {
        toast.error(result.error || 'Kunde inte ta bort bilden')
      }
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setDeletingId(null)
    }
  }

  // Navigera i lightbox
  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return

    const currentIndex = filteredImages.findIndex(img => img.id === selectedImage.id)
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1

    if (newIndex < 0) newIndex = filteredImages.length - 1
    if (newIndex >= filteredImages.length) newIndex = 0

    setSelectedImage(filteredImages[newIndex])
  }

  // Tangentbordsnavigering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return

      switch (e.key) {
        case 'Escape':
          setSelectedImage(null)
          break
        case 'ArrowLeft':
          navigateImage('prev')
          break
        case 'ArrowRight':
          navigateImage('next')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, filteredImages])

  // Kategori-ikon
  const getCategoryIcon = (category: CaseImageCategory) => {
    switch (category) {
      case 'before':
        return <Camera className="w-3 h-3" />
      case 'after':
        return <CheckCircle className="w-3 h-3" />
      default:
        return <ImageIcon className="w-3 h-3" />
    }
  }

  // Räkna bilder per kategori
  const categoryCounts = {
    all: images.length,
    before: images.filter(img => img.category === 'before').length,
    after: images.filter(img => img.category === 'after').length,
    general: images.filter(img => img.category === 'general').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Inga bilder</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Kategori-filter */}
      {showCategories && images.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              activeCategory === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            Alla ({categoryCounts.all})
          </button>
          {(Object.keys(CASE_IMAGE_CATEGORY_DISPLAY) as CaseImageCategory[]).map(cat => (
            categoryCounts[cat] > 0 && (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors ${
                  activeCategory === cat
                    ? `bg-${CASE_IMAGE_CATEGORY_DISPLAY[cat].color}/20 text-${CASE_IMAGE_CATEGORY_DISPLAY[cat].color}`
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                {getCategoryIcon(cat)}
                {CASE_IMAGE_CATEGORY_DISPLAY[cat].label} ({categoryCounts[cat]})
              </button>
            )
          ))}

          <button
            onClick={fetchImages}
            className="ml-auto p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            title="Uppdatera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bildrutnät */}
      <div className={`grid gap-3 ${
        compact
          ? 'grid-cols-4 sm:grid-cols-6'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
      }`}>
        {filteredImages.map((image) => (
          <div
            key={image.id}
            className="relative group bg-slate-800 rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            {/* Thumbnail */}
            <div className={compact ? 'aspect-square' : 'aspect-[4/3]'}>
              <img
                src={image.url}
                alt={image.file_name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

            {/* Kategori-badge */}
            {!compact && (
              <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-black/50 text-white`}>
                {getCategoryIcon(image.category)}
                <span>{CASE_IMAGE_CATEGORY_DISPLAY[image.category].label}</span>
              </div>
            )}

            {/* Ta bort-knapp */}
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(image.id)
                }}
                disabled={deletingId === image.id}
                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                {deletingId === image.id ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          {/* Stäng-knapp */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Navigeringsknappar */}
          {filteredImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigateImage('prev')
                }}
                className="absolute left-4 p-3 text-white/70 hover:text-white transition-colors z-10"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigateImage('next')
                }}
                className="absolute right-4 p-3 text-white/70 hover:text-white transition-colors z-10"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            </>
          )}

          {/* Bild */}
          <div
            className="max-w-[90vw] max-h-[85vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.file_name}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>

          {/* Bildinfo */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="max-w-4xl mx-auto flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${CASE_IMAGE_CATEGORY_DISPLAY[selectedImage.category].color}/20 text-${CASE_IMAGE_CATEGORY_DISPLAY[selectedImage.category].color}`}>
                    {getCategoryIcon(selectedImage.category)}
                    {CASE_IMAGE_CATEGORY_DISPLAY[selectedImage.category].label}
                  </span>
                  <span className="text-white/70 text-sm">
                    {filteredImages.findIndex(img => img.id === selectedImage.id) + 1} / {filteredImages.length}
                  </span>
                </div>
                <p className="text-white font-medium">{selectedImage.file_name}</p>
                <p className="text-white/60 text-sm">
                  {formatFileSize(selectedImage.file_size)} | {new Date(selectedImage.uploaded_at).toLocaleDateString('sv-SE')}
                </p>
                {selectedImage.description && (
                  <p className="text-white/80 text-sm mt-1">{selectedImage.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedImage.url}
                  download={selectedImage.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                  Ladda ner
                </a>
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(selectedImage.id)
                    }}
                    disabled={deletingId === selectedImage.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === selectedImage.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Ta bort
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
