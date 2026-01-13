// src/components/shared/CaseImageUpload.tsx
import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Camera, CheckCircle, Check, Loader2, Megaphone, GraduationCap } from 'lucide-react'
import { CaseImageService } from '../../services/caseImageService'
import { CaseImageTag, CASE_IMAGE_TAG_DISPLAY } from '../../types/database'
import { isValidImageType, isValidImageSize, MAX_IMAGE_SIZE, ALLOWED_MIME_TYPES } from '../../lib/setupCaseImagesStorage'
import toast from 'react-hot-toast'

interface PendingFile {
  file: File
  preview: string
  tags: CaseImageTag[]
}

interface CaseImageUploadProps {
  caseId: string
  caseType: 'private' | 'business' | 'contract'
  defaultTags?: CaseImageTag[]
  userId?: string
  onUploadComplete?: () => void
  disabled?: boolean
  maxFiles?: number
  compact?: boolean
}

export default function CaseImageUpload({
  caseId,
  caseType,
  defaultTags = ['general'],
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
        tags: [...defaultTags]
      })
    })

    setPendingFiles(prev => [...prev, ...newPendingFiles])
  }, [pendingFiles.length, maxFiles, defaultTags])

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

  // Toggle en tagg för väntande fil
  const toggleFileTag = (index: number, tag: CaseImageTag) => {
    setPendingFiles(prev => {
      const newFiles = [...prev]
      const currentTags = newFiles[index].tags
      const hasTag = currentTags.includes(tag)

      let newTags: CaseImageTag[]
      if (hasTag) {
        // Ta bort taggen om den finns (men behåll minst en)
        newTags = currentTags.filter(t => t !== tag)
        if (newTags.length === 0) {
          newTags = ['general'] // Fallback om inga taggar kvar
        }
      } else {
        // Lägg till taggen
        newTags = [...currentTags, tag]
      }

      newFiles[index] = { ...newFiles[index], tags: newTags }
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
          pending.tags,
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

  // Tagg-ikon
  const getTagIcon = (tag: CaseImageTag, size: string = 'w-4 h-4') => {
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

                {/* Tagg-väljare (multi-select) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(CASE_IMAGE_TAG_DISPLAY) as CaseImageTag[]).map(tag => {
                      const isSelected = pending.tags.includes(tag)
                      const tagConfig = CASE_IMAGE_TAG_DISPLAY[tag]
                      // SOLID färger för valda taggar - mycket tydlig kontrast
                      const colorMap: Record<string, { bg: string; border: string }> = {
                        'orange-500': { bg: '#f97316', border: '#fb923c' },
                        'green-500': { bg: '#22c55e', border: '#4ade80' },
                        'blue-500': { bg: '#3b82f6', border: '#60a5fa' },
                        'purple-500': { bg: '#a855f7', border: '#c084fc' },
                        'teal-500': { bg: '#14b8a6', border: '#2dd4bf' }
                      }
                      const colors = colorMap[tagConfig.color] || colorMap['blue-500']
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFileTag(index, tag)
                          }}
                          style={isSelected ? {
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            color: '#ffffff',
                            boxShadow: `0 0 8px ${colors.bg}80`
                          } : {
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            borderColor: 'transparent',
                            color: 'rgba(148, 163, 184, 0.5)'
                          }}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all border"
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          {getTagIcon(tag, 'w-3 h-3')}
                          {tagConfig.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Ta bort-knapp */}
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                {/* Valda taggar visas som badges längst upp */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-40px)]">
                  {pending.tags.map(tag => {
                    const colorMap: Record<string, { bg: string; text: string }> = {
                      'orange-500': { bg: 'rgba(249, 115, 22, 0.5)', text: '#fb923c' },
                      'green-500': { bg: 'rgba(34, 197, 94, 0.5)', text: '#4ade80' },
                      'blue-500': { bg: 'rgba(59, 130, 246, 0.5)', text: '#60a5fa' },
                      'purple-500': { bg: 'rgba(168, 85, 247, 0.5)', text: '#c084fc' },
                      'teal-500': { bg: 'rgba(20, 184, 166, 0.5)', text: '#2dd4bf' }
                    }
                    const tagConfig = CASE_IMAGE_TAG_DISPLAY[tag]
                    const colors = colorMap[tagConfig.color] || colorMap['blue-500']
                    return (
                      <span
                        key={tag}
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      >
                        {getTagIcon(tag, 'w-3 h-3')}
                      </span>
                    )
                  })}
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
