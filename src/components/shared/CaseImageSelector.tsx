// src/components/shared/CaseImageSelector.tsx
// Komponent för att välja bilder före ett ärende skapas (uppladdning sker senare)
import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Camera, CheckCircle } from 'lucide-react'
import { CaseImageCategory, CASE_IMAGE_CATEGORY_DISPLAY } from '../../types/database'
import { isValidImageType, isValidImageSize, MAX_IMAGE_SIZE, ALLOWED_MIME_TYPES } from '../../lib/setupCaseImagesStorage'
import toast from 'react-hot-toast'

export interface SelectedImage {
  file: File
  preview: string
  category: CaseImageCategory
}

interface CaseImageSelectorProps {
  selectedImages: SelectedImage[]
  onImagesChange: (images: SelectedImage[]) => void
  defaultCategory?: CaseImageCategory
  maxFiles?: number
  disabled?: boolean
  compact?: boolean
}

export default function CaseImageSelector({
  selectedImages,
  onImagesChange,
  defaultCategory = 'before',
  maxFiles = 10,
  disabled = false,
  compact = false
}: CaseImageSelectorProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hantera filval
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const newImages: SelectedImage[] = []

    Array.from(files).forEach(file => {
      // Validera filtyp
      if (!isValidImageType(file.type)) {
        toast.error(`${file.name}: Ogiltigt filformat`)
        return
      }

      // Validera storlek
      if (!isValidImageSize(file.size)) {
        toast.error(`${file.name}: För stor fil (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`)
        return
      }

      // Kontrollera att vi inte överskrider max antal
      if (selectedImages.length + newImages.length >= maxFiles) {
        toast.error(`Max ${maxFiles} bilder`)
        return
      }

      // Skapa förhandsvisnings-URL
      const preview = URL.createObjectURL(file)
      newImages.push({
        file,
        preview,
        category: defaultCategory
      })
    })

    onImagesChange([...selectedImages, ...newImages])
  }, [selectedImages, maxFiles, defaultCategory, onImagesChange])

  // Hantera drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (!disabled) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [disabled, handleFileSelect])

  // Ta bort vald bild
  const removeImage = (index: number) => {
    const newImages = [...selectedImages]
    URL.revokeObjectURL(newImages[index].preview)
    newImages.splice(index, 1)
    onImagesChange(newImages)
  }

  // Ändra kategori
  const updateCategory = (index: number, category: CaseImageCategory) => {
    const newImages = [...selectedImages]
    newImages[index] = { ...newImages[index], category }
    onImagesChange(newImages)
  }

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

  if (compact) {
    return (
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            Lägg till bilder
          </button>

          {selectedImages.length > 0 && (
            <span className="text-sm text-slate-400">
              {selectedImages.length} bild{selectedImages.length > 1 ? 'er' : ''} vald{selectedImages.length > 1 ? 'a' : ''}
            </span>
          )}
        </div>

        {/* Kompakt förhandsvisning */}
        {selectedImages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {selectedImages.map((img, index) => (
              <div key={index} className="relative group w-16 h-16 rounded overflow-hidden bg-slate-800">
                <img
                  src={img.preview}
                  alt={`Bild ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className={`absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[10px] font-medium text-center bg-black/60 text-white`}>
                  {CASE_IMAGE_CATEGORY_DISPLAY[img.category].label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-green-500 bg-green-500/10'
            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-green-500' : 'text-slate-500'}`} />
        <p className="text-sm text-slate-300">
          {isDragging ? 'Släpp bilderna här' : 'Dra bilder hit eller klicka'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Max {MAX_IMAGE_SIZE / 1024 / 1024}MB per bild
        </p>
      </div>

      {/* Valda bilder */}
      {selectedImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              {selectedImages.length} bild{selectedImages.length > 1 ? 'er' : ''} vald{selectedImages.length > 1 ? 'a' : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                selectedImages.forEach(img => URL.revokeObjectURL(img.preview))
                onImagesChange([])
              }}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Rensa alla
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {selectedImages.map((img, index) => (
              <div key={index} className="relative group bg-slate-800 rounded overflow-hidden">
                <div className="aspect-square">
                  <img
                    src={img.preview}
                    alt={`Bild ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Kategori-väljare */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                  <select
                    value={img.category}
                    onChange={(e) => updateCategory(index, e.target.value as CaseImageCategory)}
                    className="w-full text-[10px] bg-slate-900/80 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(Object.keys(CASE_IMAGE_CATEGORY_DISPLAY) as CaseImageCategory[]).map(cat => (
                      <option key={cat} value={cat}>
                        {CASE_IMAGE_CATEGORY_DISPLAY[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ta bort-knapp */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImage(index)
                  }}
                  className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Hjälpfunktion för att ladda upp valda bilder efter ärendet skapats
export async function uploadSelectedImages(
  images: SelectedImage[],
  caseId: string,
  caseType: 'private' | 'business' | 'contract',
  userId?: string
): Promise<{ success: number; failed: number }> {
  const { CaseImageService } = await import('../../services/caseImageService')

  let success = 0
  let failed = 0

  for (const img of images) {
    const result = await CaseImageService.uploadCaseImage(
      caseId,
      caseType,
      img.file,
      img.category,
      undefined,
      userId
    )

    if (result.success) {
      success++
    } else {
      failed++
      console.error(`Misslyckades ladda upp ${img.file.name}:`, result.error)
    }

    // Städa upp förhandsvisnings-URL
    URL.revokeObjectURL(img.preview)
  }

  return { success, failed }
}
