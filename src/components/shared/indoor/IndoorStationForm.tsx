// src/components/shared/indoor/IndoorStationForm.tsx
// Formulär för att skapa/redigera inomhusstationer

import { useState, useRef, useEffect } from 'react'
import { X, Camera, MapPin, FileText, Hash, Tag, Crosshair, Box, Target, Circle, Package, Loader2 } from 'lucide-react'
import type {
  IndoorStationType,
  IndoorStationWithRelations,
  CreateIndoorStationInput,
  UpdateIndoorStationInput
} from '../../../types/indoor'
import {
  INDOOR_STATION_TYPE_CONFIG,
  generateStationNumber
} from '../../../types/indoor'
import { MAX_STATION_PHOTO_SIZE, ALLOWED_PHOTO_TYPES } from '../../../services/indoorStationService'
import { StationTypeService } from '../../../services/stationTypeService'
import type { StationType } from '../../../types/stationTypes'

// Ikon-mappning för stationstyper från DB
const STATION_TYPE_ICONS: Record<string, React.ElementType> = {
  target: Target,
  box: Box,
  package: Package,
  crosshair: Crosshair,
  circle: Circle
}

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

  // Dynamiska stationstyper från DB
  const [dynamicStationTypes, setDynamicStationTypes] = useState<StationType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  // Form state
  const [stationType, setStationType] = useState<IndoorStationType>(
    existingStation?.station_type || ''
  )
  const [stationNumber, setStationNumber] = useState(existingStation?.station_number || '')
  const [locationDescription, setLocationDescription] = useState(existingStation?.location_description || '')
  const [comment, setComment] = useState(existingStation?.comment || '')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(existingStation?.photo_url || null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hämta dynamiska stationstyper vid mount
  useEffect(() => {
    const loadStationTypes = async () => {
      try {
        const types = await StationTypeService.getActiveStationTypes()
        setDynamicStationTypes(types)
        // Sätt default-typ till första om ingen är vald och vi skapar ny
        if (!isEditing && !stationType && types.length > 0) {
          setStationType(types[0].code)
        }
      } catch (err) {
        console.error('Fel vid hämtning av stationstyper:', err)
      } finally {
        setLoadingTypes(false)
      }
    }
    loadStationTypes()
  }, [isEditing])

  // Hämta aktuell stationstyp-config (dynamisk eller legacy)
  const getCurrentTypeConfig = (typeCode: string) => {
    const dynamicType = dynamicStationTypes.find(t => t.code === typeCode)
    if (dynamicType) {
      return {
        label: dynamicType.name,
        color: dynamicType.color,
        prefix: dynamicType.prefix,
        requiresSerialNumber: dynamicType.requires_serial_number,
        icon: dynamicType.icon
      }
    }
    // Fallback till legacy-config
    const legacyConfig = INDOOR_STATION_TYPE_CONFIG[typeCode]
    if (legacyConfig) {
      return {
        ...legacyConfig,
        icon: typeCode === 'mechanical_trap' ? 'crosshair' :
              typeCode === 'concrete_station' ? 'box' : 'target'
      }
    }
    return null
  }

  // Auto-generera stationsnummer när typ ändras (bara för nya stationer)
  const handleTypeChange = (type: IndoorStationType) => {
    setStationType(type)
    if (!isEditing) {
      const config = getCurrentTypeConfig(type)
      const suggested = generateStationNumber(type, existingStationNumbers, config?.prefix)
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

    // Validera serienummer
    const config = getCurrentTypeConfig(stationType)
    if (config?.requiresSerialNumber && !stationNumber.trim()) {
      setError(`Serienummer krävs för ${config.label}`)
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

  // Aktuell typ-config för formulärvalidering
  const currentTypeConfig = getCurrentTypeConfig(stationType)

  // Bestäm vilka typer som ska visas (dynamiska om tillgängliga, annars legacy)
  const typesToRender = dynamicStationTypes.length > 0
    ? dynamicStationTypes
    : Object.keys(INDOOR_STATION_TYPE_CONFIG).map(code => ({
        code,
        name: INDOOR_STATION_TYPE_CONFIG[code].label,
        color: INDOOR_STATION_TYPE_CONFIG[code].color,
        prefix: INDOOR_STATION_TYPE_CONFIG[code].prefix,
        requires_serial_number: INDOOR_STATION_TYPE_CONFIG[code].requiresSerialNumber,
        icon: code === 'mechanical_trap' ? 'crosshair' :
              code === 'concrete_station' ? 'box' : 'target'
      }))

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

      {/* Position info - Förenklad visning */}
      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <MapPin className="w-4 h-4 text-emerald-400" />
        <span className="text-sm text-emerald-300">
          Position vald på planritningen
        </span>
      </div>

      {/* Station type (only for new stations) */}
      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Stationstyp *
          </label>
          {loadingTypes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : (
            <div className={`grid gap-2 ${typesToRender.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {typesToRender.map((typeItem) => {
                const typeCode = 'code' in typeItem ? typeItem.code : typeItem
                const typeName = 'name' in typeItem ? typeItem.name : typeItem
                const typeColor = 'color' in typeItem ? typeItem.color : '#6b7280'
                const typeIcon = 'icon' in typeItem ? typeItem.icon : 'box'
                const Icon = STATION_TYPE_ICONS[typeIcon] || Box

                return (
                  <button
                    key={typeCode}
                    type="button"
                    onClick={() => handleTypeChange(typeCode)}
                    className={`
                      p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 min-h-[80px]
                      ${stationType === typeCode
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }
                    `}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: typeColor }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className={`text-xs text-center font-medium ${stationType === typeCode ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {typeName}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Station number */}
      <div>
        <label htmlFor="stationNumber" className="block text-sm font-medium text-slate-300 mb-2">
          Stationsnummer {currentTypeConfig?.requiresSerialNumber ? '*' : '(valfritt)'}
        </label>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="stationNumber"
            type="text"
            value={stationNumber}
            onChange={(e) => setStationNumber(e.target.value)}
            placeholder={`T.ex. ${currentTypeConfig?.prefix || 'ST'}-001`}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required={currentTypeConfig?.requiresSerialNumber}
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
            className="w-full p-4 border-2 border-dashed border-slate-600 hover:border-emerald-500 rounded-lg text-center transition-colors"
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
          className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
// Hämtar stationstyper dynamiskt från databasen
export function StationTypeSelector({
  selectedType,
  onSelect
}: {
  selectedType: IndoorStationType | null
  onSelect: (type: IndoorStationType, typeData?: StationType) => void
}) {
  const [stationTypes, setStationTypes] = useState<StationType[]>([])
  const [loading, setLoading] = useState(true)

  // Hämta aktiva stationstyper från databasen
  useEffect(() => {
    const loadStationTypes = async () => {
      try {
        const types = await StationTypeService.getActiveStationTypes()
        setStationTypes(types)
      } catch (error) {
        console.error('Fel vid hämtning av stationstyper:', error)
        // Fallback till hårdkodade typer om DB-hämtning misslyckas
        setStationTypes([])
      } finally {
        setLoading(false)
      }
    }
    loadStationTypes()
  }, [])

  // Fallback till hårdkodade typer om inga DB-typer finns
  const typesToShow = stationTypes.length > 0 ? stationTypes : null

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  // Om inga DB-typer finns, använd hårdkodade (bakåtkompatibilitet)
  if (!typesToShow) {
    // Lokal ikon-mappning för legacy-typer
    const LEGACY_TYPE_ICONS: Record<string, React.ElementType> = {
      mechanical_trap: Crosshair,
      concrete_station: Box,
      bait_station: Target
    }

    return (
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-semibold text-white">Välj stationstyp</h3>
        <p className="text-sm text-slate-400">Välj vilken typ av station du vill placera</p>
        <div className="flex flex-col gap-2 pt-2">
          {Object.keys(INDOOR_STATION_TYPE_CONFIG).map((type) => {
            const config = INDOOR_STATION_TYPE_CONFIG[type]
            const Icon = LEGACY_TYPE_ICONS[type] || Box
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className={`
                  w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4 text-left min-h-[64px]
                  ${selectedType === type
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500 hover:bg-slate-700'
                  }
                `}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${selectedType === type ? 'text-emerald-400' : 'text-white'}`}>
                    {config.label}
                  </p>
                  {config.requiresSerialNumber && (
                    <p className="text-xs text-slate-400">Kräver serienummer</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Visa stationstyper från databasen
  return (
    <div className="p-4 space-y-3">
      <h3 className="text-lg font-semibold text-white">Välj stationstyp</h3>
      <p className="text-sm text-slate-400">Välj vilken typ av station du vill placera</p>
      <div className="flex flex-col gap-2 pt-2">
        {typesToShow.map((stationType) => {
          const Icon = STATION_TYPE_ICONS[stationType.icon] || Box
          const isSelected = selectedType === stationType.code

          return (
            <button
              key={stationType.id}
              onClick={() => onSelect(stationType.code as IndoorStationType, stationType)}
              className={`
                w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4 text-left min-h-[64px]
                ${isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-600 bg-slate-700/50 hover:border-slate-500 hover:bg-slate-700'
                }
              `}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: stationType.color }}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                  {stationType.name}
                </p>
                {stationType.requires_serial_number && (
                  <p className="text-xs text-slate-400">Kräver serienummer</p>
                )}
                {stationType.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{stationType.description}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
