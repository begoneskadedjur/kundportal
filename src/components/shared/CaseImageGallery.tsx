// src/components/shared/CaseImageGallery.tsx
// Förbättrad bildgalleri med draft-läge - ändringar sparas först när parent sparar
import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  Image as ImageIcon,
  Camera,
  CheckCircle,
  Check,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  ZoomIn,
  Edit3,
  Plus,
  AlertCircle,
  Megaphone,
  GraduationCap
} from 'lucide-react'
import { CaseImageService, formatFileSize } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import type { CaseImageTag } from '../../types/database'
import { CASE_IMAGE_TAG_DISPLAY } from '../../types/database'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { isValidImageType, isValidImageSize, MAX_IMAGE_SIZE, ALLOWED_MIME_TYPES } from '../../lib/setupCaseImagesStorage'

// Interface för en väntande ny bild (inte uppladdad ännu)
export interface PendingImage {
  id: string // Temporärt ID för tracking
  file: File
  preview: string
  tags: CaseImageTag[]
}

// Interface för pending ändringar
export interface PendingImageChanges {
  toUpload: PendingImage[]
  toDelete: string[] // ID:n på bilder som ska tas bort
  tagChanges: { imageId: string; newTags: CaseImageTag[] }[]
}

// Interface för ref-methods som parent kan anropa
export interface CaseImageGalleryRef {
  getPendingChanges: () => PendingImageChanges
  commitChanges: () => Promise<{ success: boolean; errors: string[] }>
  hasPendingChanges: () => boolean
  resetChanges: () => void
}

interface CaseImageGalleryProps {
  caseId: string
  caseType: 'private' | 'business' | 'contract'
  canDelete?: boolean
  canEdit?: boolean
  onImageDeleted?: () => void
  onImageUpdated?: () => void
  refreshTrigger?: number
  showCategories?: boolean
  compact?: boolean
  // Draft mode props
  draftMode?: boolean
  userId?: string
  onPendingChangesUpdate?: (hasPendingChanges: boolean) => void
}

const CaseImageGallery = forwardRef<CaseImageGalleryRef, CaseImageGalleryProps>(({
  caseId,
  caseType,
  canDelete = false,
  canEdit = false,
  onImageDeleted,
  onImageUpdated,
  refreshTrigger = 0,
  showCategories = true,
  compact = false,
  draftMode = false,
  userId,
  onPendingChangesUpdate
}, ref) => {
  const [images, setImages] = useState<CaseImageWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<CaseImageWithUrl | PendingImage | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<CaseImageTag | 'all'>('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [editingTags, setEditingTags] = useState<string | null>(null)

  // Draft mode state
  const [pendingUploads, setPendingUploads] = useState<PendingImage[]>([])
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([])
  const [pendingTagChanges, setPendingTagChanges] = useState<Map<string, CaseImageTag[]>>(new Map())
  const [isCommitting, setIsCommitting] = useState(false)

  // Notifiera parent om pending changes
  useEffect(() => {
    if (draftMode && onPendingChangesUpdate) {
      const hasPending = pendingUploads.length > 0 ||
                        pendingDeletes.length > 0 ||
                        pendingTagChanges.size > 0
      onPendingChangesUpdate(hasPending)
    }
  }, [draftMode, pendingUploads, pendingDeletes, pendingTagChanges, onPendingChangesUpdate])

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

  // Helper för att kolla om en bild är markerad för borttagning
  const isMarkedForDeletion = (imageId: string) => pendingDeletes.includes(imageId)

  // Helper för att få aktuella taggar (med pending changes)
  const getDisplayTags = (image: CaseImageWithUrl): CaseImageTag[] => {
    if (draftMode && pendingTagChanges.has(image.id)) {
      return pendingTagChanges.get(image.id)!
    }
    return image.tags
  }

  // Kombinera existerande bilder med pending uploads för visning
  const displayImages = [
    ...images.filter(img => !isMarkedForDeletion(img.id)),
    ...pendingUploads.map(p => ({
      ...p,
      file_name: p.file.name,
      file_size: p.file.size,
      uploaded_at: new Date().toISOString(),
      url: p.preview,
      isPending: true
    }))
  ]

  // Filtrera bilder efter tagg
  const filteredImages = activeTag === 'all'
    ? displayImages
    : displayImages.filter(img => {
        if ('isPending' in img && img.isPending) {
          return (img as unknown as PendingImage).tags.includes(activeTag)
        }
        return getDisplayTags(img as CaseImageWithUrl).includes(activeTag)
      })

  // Ta bort bild (draft mode vs direkt)
  const handleDelete = async (imageId: string) => {
    if (!canDelete) return

    if (draftMode) {
      // Kolla om det är en pending upload
      const pendingIndex = pendingUploads.findIndex(p => p.id === imageId)
      if (pendingIndex !== -1) {
        // Ta bort från pending uploads
        setPendingUploads(prev => {
          const newPending = [...prev]
          URL.revokeObjectURL(newPending[pendingIndex].preview)
          newPending.splice(pendingIndex, 1)
          return newPending
        })
        toast.success('Bild borttagen')
        if (selectedImage && 'id' in selectedImage && selectedImage.id === imageId) {
          setSelectedImage(null)
        }
        return
      }

      // Markera för borttagning
      setPendingDeletes(prev => [...prev, imageId])
      toast.success('Bild markerad för borttagning (sparas när du klickar Spara)')
      if (selectedImage && 'id' in selectedImage && selectedImage.id === imageId) {
        setSelectedImage(null)
      }
    } else {
      // Direkt borttagning (legacy behavior)
      setDeletingId(imageId)
      try {
        const result = await CaseImageService.deleteCaseImage(imageId)
        if (result.success) {
          setImages(prev => prev.filter(img => img.id !== imageId))
          toast.success('Bilden togs bort')
          onImageDeleted?.()

          if (selectedImage && 'id' in selectedImage && selectedImage.id === imageId) {
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
        setShowDeleteConfirm(null)
      }
    }
  }

  // Ångra markering för borttagning
  const handleUndoDelete = (imageId: string) => {
    setPendingDeletes(prev => prev.filter(id => id !== imageId))
    toast.success('Ångrat borttagning')
  }

  // Toggle tagg (draft mode vs direkt)
  const handleTagToggle = async (imageId: string, tag: CaseImageTag) => {
    if (draftMode) {
      // Kolla om det är en pending upload
      const pendingIndex = pendingUploads.findIndex(p => p.id === imageId)
      if (pendingIndex !== -1) {
        setPendingUploads(prev => {
          const newPending = [...prev]
          const currentTags = newPending[pendingIndex].tags
          const hasTag = currentTags.includes(tag)
          let newTags: CaseImageTag[]
          if (hasTag) {
            newTags = currentTags.filter(t => t !== tag)
            if (newTags.length === 0) newTags = ['general']
          } else {
            newTags = [...currentTags, tag]
          }
          newPending[pendingIndex] = { ...newPending[pendingIndex], tags: newTags }
          return newPending
        })
      } else {
        // Spara taggändring för existerande bild
        setPendingTagChanges(prev => {
          const newMap = new Map(prev)
          const originalImage = images.find(img => img.id === imageId)
          const currentTags = newMap.get(imageId) || originalImage?.tags || ['general']
          const hasTag = currentTags.includes(tag)
          let newTags: CaseImageTag[]
          if (hasTag) {
            newTags = currentTags.filter(t => t !== tag)
            if (newTags.length === 0) newTags = ['general']
          } else {
            newTags = [...currentTags, tag]
          }

          // Om tillbaka till original, ta bort från pending
          if (originalImage && JSON.stringify(originalImage.tags.sort()) === JSON.stringify(newTags.sort())) {
            newMap.delete(imageId)
          } else {
            newMap.set(imageId, newTags)
          }
          return newMap
        })
      }
      toast.success('Tagg ändrad (sparas när du klickar Spara)')
    } else {
      // Direkt uppdatering
      try {
        const currentImage = images.find(img => img.id === imageId)
        if (!currentImage) return

        const currentTags = currentImage.tags
        const hasTag = currentTags.includes(tag)
        let newTags: CaseImageTag[]
        if (hasTag) {
          newTags = currentTags.filter(t => t !== tag)
          if (newTags.length === 0) newTags = ['general']
        } else {
          newTags = [...currentTags, tag]
        }

        const result = await CaseImageService.updateImageTags(imageId, newTags)
        if (result.success) {
          setImages(prev => prev.map(img =>
            img.id === imageId ? { ...img, tags: newTags } : img
          ))
          toast.success('Taggar uppdaterade')
          onImageUpdated?.()
        } else {
          toast.error(result.error || 'Kunde inte uppdatera taggar')
        }
      } catch (error) {
        console.error('Fel vid uppdatering:', error)
        toast.error('Ett fel uppstod')
      } finally {
        setEditingTags(null)
      }
    }
  }

  // Hantera filval för nya bilder
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0 || !draftMode) return

    const newPendingFiles: PendingImage[] = []

    Array.from(files).forEach(file => {
      if (!isValidImageType(file.type)) {
        toast.error(`${file.name}: Ogiltigt filformat`)
        return
      }

      if (!isValidImageSize(file.size)) {
        toast.error(`${file.name}: För stor fil (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`)
        return
      }

      const preview = URL.createObjectURL(file)
      newPendingFiles.push({
        id: `pending-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        file,
        preview,
        tags: ['general']
      })
    })

    if (newPendingFiles.length > 0) {
      setPendingUploads(prev => [...prev, ...newPendingFiles])
      toast.success(`${newPendingFiles.length} bild${newPendingFiles.length > 1 ? 'er' : ''} tillagd${newPendingFiles.length > 1 ? 'a' : ''} (sparas när du klickar Spara)`)
    }
  }, [draftMode])

  // Commit alla pending changes
  const commitChanges = async (): Promise<{ success: boolean; errors: string[] }> => {
    setIsCommitting(true)
    const errors: string[] = []

    try {
      // 1. Ladda upp nya bilder
      for (const pending of pendingUploads) {
        const result = await CaseImageService.uploadCaseImage(
          caseId,
          caseType,
          pending.file,
          pending.tags,
          undefined,
          userId
        )
        if (!result.success) {
          errors.push(`Kunde inte ladda upp ${pending.file.name}: ${result.error}`)
        }
        URL.revokeObjectURL(pending.preview)
      }

      // 2. Ta bort markerade bilder
      for (const imageId of pendingDeletes) {
        const result = await CaseImageService.deleteCaseImage(imageId)
        if (!result.success) {
          errors.push(`Kunde inte ta bort bild: ${result.error}`)
        }
      }

      // 3. Uppdatera taggar
      for (const [imageId, newTags] of pendingTagChanges) {
        const result = await CaseImageService.updateImageTags(imageId, newTags)
        if (!result.success) {
          errors.push(`Kunde inte uppdatera taggar: ${result.error}`)
        }
      }

      // Rensa pending state
      setPendingUploads([])
      setPendingDeletes([])
      setPendingTagChanges(new Map())

      // Hämta uppdaterade bilder
      await fetchImages()

      if (errors.length > 0) {
        toast.error(`Några bildändringar kunde inte sparas`)
      }

      return { success: errors.length === 0, errors }
    } catch (error) {
      console.error('Fel vid commit:', error)
      errors.push('Ett oväntat fel uppstod')
      return { success: false, errors }
    } finally {
      setIsCommitting(false)
    }
  }

  // Reset changes
  const resetChanges = () => {
    pendingUploads.forEach(p => URL.revokeObjectURL(p.preview))
    setPendingUploads([])
    setPendingDeletes([])
    setPendingTagChanges(new Map())
  }

  // Exponera metoder via ref
  useImperativeHandle(ref, () => ({
    getPendingChanges: () => ({
      toUpload: pendingUploads,
      toDelete: pendingDeletes,
      tagChanges: Array.from(pendingTagChanges).map(([imageId, newTags]) => ({
        imageId,
        newTags
      }))
    }),
    commitChanges,
    hasPendingChanges: () => pendingUploads.length > 0 || pendingDeletes.length > 0 || pendingTagChanges.size > 0,
    resetChanges
  }))

  // Navigera i lightbox
  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    if (!selectedImage) return

    const currentIndex = filteredImages.findIndex(img => {
      if ('isPending' in img && img.isPending) {
        return (img as unknown as PendingImage).id === (selectedImage as PendingImage).id
      }
      return img.id === (selectedImage as CaseImageWithUrl).id
    })

    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1

    if (newIndex < 0) newIndex = filteredImages.length - 1
    if (newIndex >= filteredImages.length) newIndex = 0

    const nextImg = filteredImages[newIndex]
    if ('isPending' in nextImg && nextImg.isPending) {
      setSelectedImage(pendingUploads.find(p => p.id === (nextImg as unknown as PendingImage).id) || null)
    } else {
      setSelectedImage(nextImg as CaseImageWithUrl)
    }
  }, [selectedImage, filteredImages, pendingUploads])

  // Stäng lightbox
  const closeLightbox = useCallback(() => {
    setSelectedImage(null)
    setShowDeleteConfirm(null)
    setEditingTags(null)
  }, [])

  // Tangentbordsnavigering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          closeLightbox()
          break
        case 'ArrowLeft':
          e.preventDefault()
          navigateImage('prev')
          break
        case 'ArrowRight':
          e.preventDefault()
          navigateImage('next')
          break
      }
    }

    if (selectedImage) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [selectedImage, navigateImage, closeLightbox])

  // Tagg-ikon
  const getTagIcon = (tag: CaseImageTag, size: string = 'w-3 h-3') => {
    switch (tag) {
      case 'before':
        return <Camera className={size} />
      case 'after':
        return <CheckCircle className={size} />
      case 'pr':
        return <Megaphone className={size} />
      case 'education':
        return <GraduationCap className={size} />
      default:
        return <ImageIcon className={size} />
    }
  }

  // Räkna bilder per tagg
  const tagCounts: Record<CaseImageTag | 'all', number> = {
    all: displayImages.length,
    before: displayImages.filter(img => {
      if ('isPending' in img && img.isPending) {
        return (img as unknown as PendingImage).tags.includes('before')
      }
      return getDisplayTags(img as CaseImageWithUrl).includes('before')
    }).length,
    after: displayImages.filter(img => {
      if ('isPending' in img && img.isPending) {
        return (img as unknown as PendingImage).tags.includes('after')
      }
      return getDisplayTags(img as CaseImageWithUrl).includes('after')
    }).length,
    general: displayImages.filter(img => {
      if ('isPending' in img && img.isPending) {
        return (img as unknown as PendingImage).tags.includes('general')
      }
      return getDisplayTags(img as CaseImageWithUrl).includes('general')
    }).length,
    pr: displayImages.filter(img => {
      if ('isPending' in img && img.isPending) {
        return (img as unknown as PendingImage).tags.includes('pr')
      }
      return getDisplayTags(img as CaseImageWithUrl).includes('pr')
    }).length,
    education: displayImages.filter(img => {
      if ('isPending' in img && img.isPending) {
        return (img as unknown as PendingImage).tags.includes('education')
      }
      return getDisplayTags(img as CaseImageWithUrl).includes('education')
    }).length
  }

  // Pending changes summary
  const pendingChangesCount = pendingUploads.length + pendingDeletes.length + pendingTagChanges.size

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    )
  }

  // Hantera direkt nedladdning av bild
  const handleDownload = async (url: string, fileName: string) => {
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
      toast.success('Nedladdning startad')
    } catch (error) {
      console.error('Nedladdning misslyckades:', error)
      toast.error('Kunde inte ladda ner bilden')
    }
  }

  // Hämta taggar för vald bild
  const getSelectedImageTags = (): CaseImageTag[] => {
    if (!selectedImage) return ['general']
    if ('tags' in selectedImage) return selectedImage.tags
    return ['general']
  }

  // Lightbox-komponent som renderas i portal
  const lightbox = selectedImage && createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 2147483647, // Max z-index
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        isolation: 'isolate'
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        closeLightbox()
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Stäng-knapp */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          closeLightbox()
        }}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        title="Stäng (Esc)"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Navigeringsknappar */}
      {filteredImages.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              navigateImage('prev')
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
            title="Föregående (←)"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              navigateImage('next')
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
            title="Nästa (→)"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}

      {/* Bild */}
      <div
        className="max-w-[90vw] max-h-[80vh] relative"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <img
          src={'url' in selectedImage ? selectedImage.url : selectedImage.preview}
          alt={'file_name' in selectedImage ? selectedImage.file_name : selectedImage.file.name}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        {'file' in selectedImage ? (
          <div className="absolute top-4 left-4 px-3 py-1 bg-amber-500 text-black text-sm font-medium rounded-full">
            Ej sparad
          </div>
        ) : null}
      </div>

      {/* Bildinfo och knappar */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Taggar */}
              {canEdit && editingTags === ('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id) ? (
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(CASE_IMAGE_TAG_DISPLAY) as CaseImageTag[]).map(tag => {
                    const isSelected = getSelectedImageTags().includes(tag)
                    const tagConfig = CASE_IMAGE_TAG_DISPLAY[tag]
                    // Använd faktiska färgvärden för tydlig visuell feedback
                    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
                      'orange-500': { bg: 'rgba(249, 115, 22, 0.4)', border: 'rgba(249, 115, 22, 0.8)', text: '#fb923c' },
                      'green-500': { bg: 'rgba(34, 197, 94, 0.4)', border: 'rgba(34, 197, 94, 0.8)', text: '#4ade80' },
                      'blue-500': { bg: 'rgba(59, 130, 246, 0.4)', border: 'rgba(59, 130, 246, 0.8)', text: '#60a5fa' },
                      'purple-500': { bg: 'rgba(168, 85, 247, 0.4)', border: 'rgba(168, 85, 247, 0.8)', text: '#c084fc' },
                      'teal-500': { bg: 'rgba(20, 184, 166, 0.4)', border: 'rgba(20, 184, 166, 0.8)', text: '#2dd4bf' }
                    }
                    const colors = colorMap[tagConfig.color] || colorMap['blue-500']
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTagToggle(
                            'id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id,
                            tag
                          )
                        }}
                        style={isSelected ? {
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          color: colors.text
                        } : undefined}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2 ${
                          isSelected
                            ? 'border-current'
                            : 'bg-slate-800/80 text-slate-400 border-transparent hover:bg-slate-700/80 hover:text-slate-300'
                        }`}
                      >
                        {getTagIcon(tag, 'w-3.5 h-3.5')}
                        {tagConfig.label}
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    )
                  })}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingTags(null)
                    }}
                    className="ml-2 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-colors"
                  >
                    Klar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {getSelectedImageTags().map(tag => (
                    <span
                      key={tag}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${CASE_IMAGE_TAG_DISPLAY[tag].color}/20 text-white`}
                    >
                      {getTagIcon(tag, 'w-3 h-3')}
                      {CASE_IMAGE_TAG_DISPLAY[tag].label}
                    </span>
                  ))}
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingTags('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id)
                      }}
                      className="ml-1 p-1 text-white/60 hover:text-white transition-colors"
                      title="Redigera taggar"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              <span className="text-white/70 text-sm">
                {filteredImages.findIndex(img => {
                  if ('isPending' in img && img.isPending) {
                    return (img as unknown as PendingImage).id === (selectedImage as PendingImage).id
                  }
                  return img.id === (selectedImage as CaseImageWithUrl).id
                }) + 1} / {filteredImages.length}
              </span>
            </div>
            <p className="text-white font-medium truncate">
              {'file_name' in selectedImage ? selectedImage.file_name : selectedImage.file.name}
            </p>
            <p className="text-white/60 text-sm">
              {formatFileSize('file_size' in selectedImage ? selectedImage.file_size : selectedImage.file.size)}
              {' | '}
              {'uploaded_at' in selectedImage
                ? new Date(selectedImage.uploaded_at).toLocaleDateString('sv-SE')
                : 'Ej uppladdad'
              }
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {'url' in selectedImage && !('file' in selectedImage) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload(
                    selectedImage.url,
                    'file_name' in selectedImage ? selectedImage.file_name : 'bild.jpg'
                  )
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Ladda ner</span>
              </button>
            )}
            {canDelete && (
              <>
                {showDeleteConfirm === ('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id) ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id)
                      }}
                      disabled={deletingId === ('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === ('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Bekräfta'
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDeleteConfirm(null)
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteConfirm('id' in selectedImage ? selectedImage.id : (selectedImage as PendingImage).id)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Ta bort</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <div className="space-y-4">
      {/* Pending changes indicator */}
      {draftMode && pendingChangesCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>
            {pendingChangesCount} osparad{pendingChangesCount > 1 ? 'e' : ''} ändring{pendingChangesCount > 1 ? 'ar' : ''}
            {' '}- sparas när du klickar "Spara ändringar"
          </span>
        </div>
      )}

      {/* Draft mode upload button */}
      {draftMode && canEdit && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 rounded-lg cursor-pointer transition-colors">
            <Plus className="w-4 h-4" />
            Lägg till bilder
            <input
              type="file"
              accept={ALLOWED_MIME_TYPES.join(',')}
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </label>
          {pendingUploads.length > 0 && (
            <span className="text-sm text-slate-400">
              {pendingUploads.length} ny{pendingUploads.length > 1 ? 'a' : ''} bild{pendingUploads.length > 1 ? 'er' : ''} att ladda upp
            </span>
          )}
        </div>
      )}

      {/* Tagg-filter */}
      {showCategories && displayImages.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setActiveTag('all')
            }}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              activeTag === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            Alla ({tagCounts.all})
          </button>
          {(Object.keys(CASE_IMAGE_TAG_DISPLAY) as CaseImageTag[]).map(tag => (
            tagCounts[tag] > 0 && (
              <button
                type="button"
                key={tag}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActiveTag(tag)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors ${
                  activeTag === tag
                    ? `bg-${CASE_IMAGE_TAG_DISPLAY[tag].color}/20 text-${CASE_IMAGE_TAG_DISPLAY[tag].color}`
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                {getTagIcon(tag)}
                {CASE_IMAGE_TAG_DISPLAY[tag].label} ({tagCounts[tag]})
              </button>
            )
          ))}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              fetchImages()
            }}
            className="ml-auto p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            title="Uppdatera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tomt state */}
      {displayImages.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Inga bilder</p>
        </div>
      )}

      {/* Bildrutnät */}
      {displayImages.length > 0 && (
        <div className={`grid gap-3 ${
          compact
            ? 'grid-cols-4 sm:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        }`}>
          {filteredImages.map((image) => {
            const isPending = 'isPending' in image && image.isPending
            const imageId = isPending ? (image as unknown as PendingImage).id : (image as CaseImageWithUrl).id
            const imageTags = isPending
              ? (image as unknown as PendingImage).tags
              : getDisplayTags(image as CaseImageWithUrl)
            const isDeleted = !isPending && isMarkedForDeletion(imageId)

            return (
              <div
                key={imageId}
                className={`relative group bg-slate-800 rounded-lg overflow-hidden cursor-pointer ${
                  isDeleted ? 'opacity-50' : ''
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isDeleted) {
                    if (isPending) {
                      setSelectedImage(pendingUploads.find(p => p.id === imageId) || null)
                    } else {
                      setSelectedImage(image as CaseImageWithUrl)
                    }
                  }
                }}
              >
                {/* Thumbnail */}
                <div className={compact ? 'aspect-square' : 'aspect-[4/3]'}>
                  <img
                    src={isPending ? (image as unknown as PendingImage).preview : (image as CaseImageWithUrl).url}
                    alt={isPending ? (image as unknown as PendingImage).file.name : (image as CaseImageWithUrl).file_name}
                    className={`w-full h-full object-cover transition-transform ${
                      isDeleted ? '' : 'group-hover:scale-105'
                    }`}
                    loading="lazy"
                  />
                </div>

                {/* Overlay med förstoringsglas-ikon */}
                {!isDeleted && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}

                {/* Deleted overlay */}
                {isDeleted && (
                  <div className="absolute inset-0 bg-red-900/50 flex flex-col items-center justify-center">
                    <Trash2 className="w-8 h-8 text-red-300 mb-2" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleUndoDelete(imageId)
                      }}
                      className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
                    >
                      Ångra
                    </button>
                  </div>
                )}

                {/* Pending badge */}
                {isPending && !isDeleted && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-black text-xs font-medium rounded-full">
                    Ny
                  </div>
                )}

                {/* Tagg-badges */}
                {!compact && !isPending && !isDeleted && (
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-40px)]">
                    {imageTags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white`}
                      >
                        {getTagIcon(tag, 'w-3 h-3')}
                        {CASE_IMAGE_TAG_DISPLAY[tag].label}
                      </span>
                    ))}
                    {imageTags.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white">
                        +{imageTags.length - 3}
                      </span>
                    )}
                    {pendingTagChanges.has(imageId) && (
                      <span className="text-amber-400 text-xs">*</span>
                    )}
                  </div>
                )}

                {/* Ta bort-knapp */}
                {canDelete && !isDeleted && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (showDeleteConfirm === imageId) {
                        handleDelete(imageId)
                      } else {
                        setShowDeleteConfirm(imageId)
                        setTimeout(() => setShowDeleteConfirm(null), 3000)
                      }
                    }}
                    disabled={deletingId === imageId}
                    className={`absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 ${
                      showDeleteConfirm === imageId
                        ? 'bg-red-500 opacity-100'
                        : 'bg-red-500/80 hover:bg-red-500'
                    }`}
                    title={showDeleteConfirm === imageId ? 'Klicka igen för att ta bort' : 'Ta bort bild'}
                  >
                    {deletingId === imageId ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : showDeleteConfirm === imageId ? (
                      <span className="text-white text-xs px-1">?</span>
                    ) : (
                      <Trash2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox renderas via portal */}
      {lightbox}
    </div>
  )
})

CaseImageGallery.displayName = 'CaseImageGallery'

export default CaseImageGallery
