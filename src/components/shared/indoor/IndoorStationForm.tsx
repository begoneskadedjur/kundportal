// src/components/shared/indoor/IndoorStationForm.tsx
// Formulär för att skapa/redigera inomhusstationer

import { useState, useRef } from 'react'
import { X, Camera, MapPin, FileText, Hash, Tag } from 'lucide-react'
import {
  IndoorStationType,
  IndoorStationWithRelations,
  INDOOR_STATION_TYPE_CONFIG,
  CreateIndoorStationInput,
  UpdateIndoorStationInput,
  generateStationNumber
} from '../../../types/indoor'
import { MAX_STATION_PHOTO_SIZE, ALLOWED_PHOTO_TYPES } from '../../../services/indoorStationService'

interface IndoorStationFormProps {
  floorPlanId: string
  position: { x: number; y: number }
  existingStation?: IndoorStationWithRelations | null
  existingStationNumbers?: string[]
  onSubmit: (input: CreateIndoorStationInput | UpdateIndoorStationInput) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function IndoorStationForm({
  floorPlanId,
  position,
  existingStation,
  existingStationNumbers = [],
  onSubmit,
  onCancel,
  isSubmitting = false
}: IndoorStationFormProps) {
  const isEditing = !!existingStation

  // Form state
  const [stationType, setStationType] = useState<IndoorStationType>(
    existingStation?.station_type || 'mechanical_trap'
  )
  const [stationNumber, setStationNumber] = useState(existingStation?.station_number || '')
  const [locationDescription, setLocationDescription] = useState(existingStation?.location_description || '')
  const [comment, setComment] = useState(existingStation?.comment || '')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(existingStation?.photo_url || null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-generera stationsnummer när typ ändras (bara för nya stationer)
  const handleTypeChange = (type: IndoorStationType) => {
    setStationType(type)
    if (!isEditing && !stationNumber) {
      const suggested = generateStationNumber(type, existingStationNumbers)
      setStationNumber(suggested)
    }
  }

  // Hantera fotoval
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError('Ogiltigt bildformat. Använd JPG, PNG eller WebP.')
      return
    }

    if (file.size > MAX_STATION_PHOTO_SIZE) {
      setError(`Bilden är för stor. Max ${MAX_STATION_PHOTO_SIZE / 1024 / 1024}MB`)
      return
    }

    setError(null)
    setSelectedPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    if (photoPreview && !existingStation?.photo_url) {
      URL.revokeObjectURL(photoPreview)
    }
    setSelectedPhoto(null)
    setPhotoPreview(existingStation?.photo_url || null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Hantera submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validera serienummer för mekaniska fällor
    const config = INDOOR_STATION_TYPE_CONFIG[stationType]
    if (config.requiresSerialNumber && !stationNumber.trim()) {
      setError('Serienummer krävs för mekaniska fällor')
      return
    }

    try {
      if (isEditing) {
        const updateInput: UpdateIndoorStationInput = {
          station_number: stationNumber.trim() || undefined,
          position_x_percent: position.x,
          position_y_percent: position.y,
          location_description: locationDescription.trim() || undefined,
          comment: comment.trim() || undefined,
          photo: selectedPhoto || undefined
        }
        await onSubmit(updateInput)
      } else {
        const createInput: CreateIndoorStationInput = {
          floor_plan_id: floorPlanId,
          station_type: stationType,
          station_number: stationNumber.trim() || undefined,
          position_x_percent: position.x,
          position_y_percent: position.y,
          location_description: locationDescription.trim() || undefined,
          comment: comment.trim() || undefined,
          photo: selectedPhoto || undefined
        }
        await onSubmit(createInput)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">
          {isEditing ? 'Redigera station' : 'Ny station'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Position info */}
      <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
        <MapPin className="w-4 h-4 text-teal-400" />
        <span className="text-sm text-slate-300">
          Position: {position.x.toFixed(1)}%, {position.y.toFixed(1)}%
        </span>
      </div>

      {/* Station type (only for new stations) */}
      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Stationstyp *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(INDOOR_STATION_TYPE_CONFIG) as IndoorStationType[]).map((type) => {
              const config = INDOOR_STATION_TYPE_CONFIG[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`
                    p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2
                    ${stationType === type
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                    }
                  `}
                >
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white/50"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className={`text-xs text-center ${stationType === type ? 'text-teal-400' : 'text-slate-400'}`}>
                    {config.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Station number */}
      <div>
        <label htmlFor="stationNumber" className="block text-sm font-medium text-slate-300 mb-2">
          Stationsnummer {INDOOR_STATION_TYPE_CONFIG[stationType].requiresSerialNumber ? '*' : '(valfritt)'}
        </label>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="stationNumber"
            type="text"
            value={stationNumber}
            onChange={(e) => setStationNumber(e.target.value)}
            placeholder={`T.ex. ${INDOOR_STATION_TYPE_CONFIG[stationType].prefix}-001`}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required={INDOOR_STATION_TYPE_CONFIG[stationType].requiresSerialNumber}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Auto-genererat förslag. Du kan ändra det.
        </p>
      </div>

      {/* Location description */}
      <div>
        <label htmlFor="locationDescription" className="block text-sm font-medium text-slate-300 mb-2">
          Platsbeskrivning (valfritt)
        </label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="locationDescription"
            type="text"
            value={locationDescription}
            onChange={(e) => setLocationDescription(e.target.value)}
            placeholder="T.ex. Vid diskbänk, Hörn mot fönster"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Comment */}
      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-slate-300 mb-2">
          Kommentar (valfritt)
        </label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Eventuella anteckningar..."
            rows={2}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Foto (valfritt)
        </label>

        {photoPreview ? (
          <div className="relative rounded-lg overflow-hidden bg-slate-800">
            <img
              src={photoPreview}
              alt="Förhandsvisning"
              className="w-full h-32 object-cover"
            />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-4 border-2 border-dashed border-slate-600 hover:border-teal-500 rounded-lg text-center transition-colors"
          >
            <Camera className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Ta eller välj foto</p>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_PHOTO_TYPES.join(',')}
          capture="environment"
          onChange={handlePhotoSelect}
          className="hidden"
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
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sparar...
            </>
          ) : (
            isEditing ? 'Spara ändringar' : 'Lägg till station'
          )}
        </button>
      </div>
    </form>
  )
}

// Kompakt version för typ-val i placeringsläge
export function StationTypeSelector({
  selectedType,
  onSelect
}: {
  selectedType: IndoorStationType | null
  onSelect: (type: IndoorStationType) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400 mb-3">Välj stationstyp:</p>
      <div className="flex flex-col gap-2">
        {(Object.keys(INDOOR_STATION_TYPE_CONFIG) as IndoorStationType[]).map((type) => {
          const config = INDOOR_STATION_TYPE_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={`
                w-full p-3 rounded-lg border transition-all flex items-center gap-3 text-left
                ${selectedType === type
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                }
              `}
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-white/50 flex-shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <div>
                <p className={`font-medium ${selectedType === type ? 'text-teal-400' : 'text-white'}`}>
                  {config.label}
                </p>
                {config.requiresSerialNumber && (
                  <p className="text-xs text-slate-500">Kräver serienummer</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
