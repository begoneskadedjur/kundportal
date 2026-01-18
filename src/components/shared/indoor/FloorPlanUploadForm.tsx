// src/components/shared/indoor/FloorPlanUploadForm.tsx
// Formulär för att ladda upp nya planritningar

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Building2, FileText } from 'lucide-react'
import { CreateFloorPlanInput } from '../../../types/indoor'
import { ALLOWED_FLOOR_PLAN_TYPES, MAX_FLOOR_PLAN_SIZE } from '../../../services/floorPlanService'

interface FloorPlanUploadFormProps {
  customerId: string
  customerName?: string
  existingBuildings?: string[]
  onSubmit: (input: CreateFloorPlanInput) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function FloorPlanUploadForm({
  customerId,
  customerName,
  existingBuildings = [],
  onSubmit,
  onCancel,
  isSubmitting = false
}: FloorPlanUploadFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [buildingName, setBuildingName] = useState('')
  const [showBuildingInput, setShowBuildingInput] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hantera filval
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validera filtyp
    if (!ALLOWED_FLOOR_PLAN_TYPES.includes(file.type)) {
      setError(`Ogiltigt format. Tillåtna: ${ALLOWED_FLOOR_PLAN_TYPES.map(t => t.split('/')[1]).join(', ')}`)
      return
    }

    // Validera storlek
    if (file.size > MAX_FLOOR_PLAN_SIZE) {
      setError(`Filen är för stor. Max ${MAX_FLOOR_PLAN_SIZE / 1024 / 1024}MB`)
      return
    }

    setError(null)
    setSelectedFile(file)

    // Skapa preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  // Rensa vald fil
  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Hantera submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) {
      setError('Välj en bild')
      return
    }

    if (!name.trim()) {
      setError('Ange ett namn för planritningen')
      return
    }

    try {
      await onSubmit({
        customer_id: customerId,
        name: name.trim(),
        description: description.trim() || undefined,
        building_name: buildingName.trim() || undefined,
        image: selectedFile
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-semibold text-white">Ladda upp planritning</h3>
          {customerName && (
            <p className="text-sm text-slate-400">{customerName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Bild *
        </label>

        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 mb-1">
              Klicka för att välja bild
            </p>
            <p className="text-xs text-slate-500">
              JPG, PNG, WebP eller GIF (max 10MB)
            </p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-slate-800">
            <img
              src={previewUrl!}
              alt="Förhandsvisning"
              className="w-full max-h-48 object-contain"
            />
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-900/80 rounded text-xs text-slate-300">
              <ImageIcon className="w-3 h-3 inline mr-1" />
              {selectedFile.name}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FLOOR_PLAN_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
          Namn på planritning *
        </label>
        <div className="relative">
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Våning 1, Kök, Entré"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      {/* Building (optional) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">
            Byggnad (valfritt)
          </label>
          {existingBuildings.length > 0 && !showBuildingInput && (
            <button
              type="button"
              onClick={() => setShowBuildingInput(true)}
              className="text-xs text-teal-400 hover:text-teal-300"
            >
              + Ny byggnad
            </button>
          )}
        </div>

        {existingBuildings.length > 0 && !showBuildingInput ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBuildingName('')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                !buildingName
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Ingen
            </button>
            {existingBuildings.map((building) => (
              <button
                key={building}
                type="button"
                onClick={() => setBuildingName(building)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  buildingName === building
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {building}
              </button>
            ))}
          </div>
        ) : (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="T.ex. Huvudbyggnad, Lager A"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Description (optional) */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
          Beskrivning (valfritt)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Eventuella anteckningar om planritningen..."
          rows={2}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !selectedFile || !name.trim()}
          className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Laddar upp...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Ladda upp
            </>
          )}
        </button>
      </div>
    </form>
  )
}
