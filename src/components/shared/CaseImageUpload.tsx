// src/components/shared/CaseImageUpload.tsx
import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Camera, CheckCircle, Loader2 } from 'lucide-react'
import { CaseImageService } from '../../services/caseImageService'
import { CaseImageCategory, CASE_IMAGE_CATEGORY_DISPLAY } from '../../types/database'
import { isValidImageType, isValidImageSize, MAX_IMAGE_SIZE, ALLOWED_MIME_TYPES } from '../../lib/setupCaseImagesStorage'
import toast from 'react-hot-toast'

interface PendingFile {
  file: File
  preview: string
  category: CaseImageCategory
}

interface CaseImageUploadProps {
  caseId: string
  caseType: 'private' | 'business' | 'contract'
  defaultCategory?: CaseImageCategory
  userId?: string
  onUploadComplete?: () => void
  disabled?: boolean
  maxFiles?: number
  compact?: boolean
}

export default function CaseImageUpload({
  caseId,
  caseType,
  defaultCategory = 'general',
  userId,
  onUploadComplete,
  disabled = false,
  maxFiles = 10,
  compact = false
}: CaseImageUploadProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hantera filval
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const newPendingFiles: PendingFile[] = []

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
      if (pendingFiles.length + newPendingFiles.length >= maxFiles) {
        toast.error(`Max ${maxFiles} bilder åt gången`)
        return
      }

      // Skapa förhandsvisnings-URL
      const preview = URL.createObjectURL(file)
      newPendingFiles.push({
        file,
        preview,
        category: defaultCategory
      })
    })

    setPendingFiles(prev => [...prev, ...newPendingFiles])
  }, [pendingFiles.length, maxFiles, defaultCategory])

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

  // Ta bort väntande fil
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  // Ändra kategori för väntande fil
  const updateFileCategory = (index: number, category: CaseImageCategory) => {
    setPendingFiles(prev => {
      const newFiles = [...prev]
      newFiles[index] = { ...newFiles[index], category }
      return newFiles
    })
  }

  // Ladda upp alla väntande filer
  const uploadAllFiles = async () => {
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const pending of pendingFiles) {
        const result = await CaseImageService.uploadCaseImage(
          caseId,
          caseType,
          pending.file,
          pending.category,
          undefined,
          userId
        )

        if (result.success) {
          successCount++
        } else {
          failCount++
          console.error(`Misslyckades att ladda upp ${pending.file.name}:`, result.error)
        }
      }

      // Rensa förhandsvisnings-URLs
      pendingFiles.forEach(pf => URL.revokeObjectURL(pf.preview))
      setPendingFiles([])

      if (successCount > 0) {
        toast.success(`${successCount} bild${successCount > 1 ? 'er' : ''} uppladdade`)
        onUploadComplete?.()
      }

      if (failCount > 0) {
        toast.error(`${failCount} bild${failCount > 1 ? 'er' : ''} kunde inte laddas upp`)
      }

    } catch (error) {
      console.error('Fel vid uppladdning:', error)
      toast.error('Ett fel uppstod vid uppladdning')
    } finally {
      setIsUploading(false)
    }
  }

  // Kategori-ikon
  const getCategoryIcon = (category: CaseImageCategory) => {
    switch (category) {
      case 'before':
        return <Camera className="w-4 h-4" />
      case 'after':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <ImageIcon className="w-4 h-4" />
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
          disabled={disabled || isUploading}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          Lägg till bilder
        </button>

        {pendingFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              {pendingFiles.length} bild{pendingFiles.length > 1 ? 'er' : ''} vald{pendingFiles.length > 1 ? 'a' : ''}
            </span>
            <button
              type="button"
              onClick={uploadAllFiles}
              disabled={isUploading}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Ladda upp'
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
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
          disabled={disabled || isUploading}
        />

        <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-green-500' : 'text-slate-500'}`} />
        <p className="text-slate-300 font-medium mb-1">
          {isDragging ? 'Släpp bilderna här' : 'Dra bilder hit eller klicka för att välja'}
        </p>
        <p className="text-sm text-slate-500">
          JPEG, PNG, WebP, HEIC (max {MAX_IMAGE_SIZE / 1024 / 1024}MB per bild)
        </p>
      </div>

      {/* Väntande filer */}
      {pendingFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-300">
              Valda bilder ({pendingFiles.length})
            </h4>
            <button
              type="button"
              onClick={() => {
                pendingFiles.forEach(pf => URL.revokeObjectURL(pf.preview))
                setPendingFiles([])
              }}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Rensa alla
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pendingFiles.map((pending, index) => (
              <div
                key={index}
                className="relative group bg-slate-800 rounded-lg overflow-hidden"
              >
                {/* Förhandsvisning */}
                <div className="aspect-square">
                  <img
                    src={pending.preview}
                    alt={`Förhandsvisning ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Kategori-väljare */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <select
                    value={pending.category}
                    onChange={(e) => updateFileCategory(index, e.target.value as CaseImageCategory)}
                    className="w-full text-xs bg-slate-900/80 border border-slate-700 rounded px-2 py-1 text-slate-300"
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
                  onClick={() => removePendingFile(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                {/* Kategori-badge */}
                <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${CASE_IMAGE_CATEGORY_DISPLAY[pending.category].color}/20 text-${CASE_IMAGE_CATEGORY_DISPLAY[pending.category].color}`}>
                  {getCategoryIcon(pending.category)}
                </div>
              </div>
            ))}
          </div>

          {/* Ladda upp-knapp */}
          <button
            type="button"
            onClick={uploadAllFiles}
            disabled={isUploading || pendingFiles.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Laddar upp...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Ladda upp {pendingFiles.length} bild{pendingFiles.length > 1 ? 'er' : ''}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
