// src/components/shared/equipment/EquipmentPlacementForm.tsx - Formulär för att skapa/redigera utrustning
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EquipmentType,
  EquipmentStatus,
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  requiresSerialNumber
} from '../../../types/database'
import { useGpsLocation } from '../../../hooks/useGpsLocation'
import { MapLocationPicker } from './MapLocationPicker'
import {
  MapPin,
  Crosshair,
  Box,
  Target,
  Camera,
  Loader2,
  AlertCircle,
  Check,
  X,
  Map
} from 'lucide-react'

interface EquipmentPlacementFormProps {
  customerId: string
  technicianId: string
  existingEquipment?: EquipmentPlacementWithRelations | null
  onSubmit: (data: FormData) => void
  onCancel: () => void
  onLocationCapture?: (lat: number, lng: number) => void
  isSubmitting?: boolean
}

export interface FormData {
  equipment_type: EquipmentType
  serial_number: string
  latitude: number
  longitude: number
  comment: string
  status: EquipmentStatus
  photo?: File | null
}

const EQUIPMENT_TYPE_ICONS = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export function EquipmentPlacementForm({
  customerId,
  technicianId,
  existingEquipment,
  onSubmit,
  onCancel,
  onLocationCapture,
  isSubmitting = false
}: EquipmentPlacementFormProps) {
  const isEditing = !!existingEquipment

  const [formData, setFormData] = useState<FormData>({
    equipment_type: existingEquipment?.equipment_type || 'mechanical_trap',
    serial_number: existingEquipment?.serial_number || '',
    latitude: existingEquipment?.latitude || 0,
    longitude: existingEquipment?.longitude || 0,
    comment: existingEquipment?.comment || '',
    status: existingEquipment?.status || 'active',
    photo: null
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    existingEquipment?.photo_url || null
  )
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [manualLocationSet, setManualLocationSet] = useState(false)

  const {
    latitude: gpsLat,
    longitude: gpsLng,
    loading: gpsLoading,
    error: gpsError,
    warning: gpsWarning,
    accuracy,
    captureLocation,
    hasLocation,
    formattedAccuracy,
    accuracyLevel,
    isHighAccuracy,
    positionType
  } = useGpsLocation()

  // Uppdatera koordinater när GPS fångas
  useEffect(() => {
    if (gpsLat && gpsLng) {
      setFormData(prev => ({
        ...prev,
        latitude: gpsLat,
        longitude: gpsLng
      }))
      onLocationCapture?.(gpsLat, gpsLng)
    }
  }, [gpsLat, gpsLng, onLocationCapture])

  // Validera formulär
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    // Validera serienummer för mekaniska fällor
    if (requiresSerialNumber(formData.equipment_type) && !formData.serial_number.trim()) {
      newErrors.serial_number = 'Serienummer krävs för mekaniska fällor'
    }

    // Validera koordinater
    if (!formData.latitude || !formData.longitude) {
      newErrors.latitude = 'GPS-position krävs. Klicka på "Hämta GPS-position"'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Hantera formulärsubmit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  // Hantera bildval
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validera filtyp och storlek
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, photo: 'Ogiltigt filformat. Tillåtna: JPEG, PNG, WebP, HEIC' }))
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, photo: 'Filen är för stor. Max 5MB.' }))
        return
      }

      setFormData(prev => ({ ...prev, photo: file }))
      setPhotoPreview(URL.createObjectURL(file))
      setErrors(prev => ({ ...prev, photo: undefined }))
    }
  }

  // Hämta GPS-position
  const handleCaptureGps = async () => {
    try {
      await captureLocation()
      setManualLocationSet(false)
    } catch (error) {
      console.error('GPS-fel:', error)
    }
  }

  // Hantera manuell positionsval från kartan
  const handleMapPositionSelect = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }))
    setManualLocationSet(true)
    setShowMapPicker(false)
    onLocationCapture?.(lat, lng)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Utrustningstyp */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Utrustningstyp *
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(EQUIPMENT_TYPE_CONFIG) as [EquipmentType, typeof EQUIPMENT_TYPE_CONFIG[EquipmentType]][]).map(
            ([type, config]) => {
              const Icon = EQUIPMENT_TYPE_ICONS[type]
              const isSelected = formData.equipment_type === type

              return (
                <motion.button
                  key={type}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData(prev => ({ ...prev, equipment_type: type }))}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: config.color }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>
                    {config.label}
                  </p>
                </motion.button>
              )
            }
          )}
        </div>
      </div>

      {/* Serienummer */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Serienummer {requiresSerialNumber(formData.equipment_type) && '*'}
        </label>
        <input
          type="text"
          value={formData.serial_number}
          onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
          placeholder={requiresSerialNumber(formData.equipment_type)
            ? 'Ange serienummer'
            : 'Valfritt serienummer'}
          className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.serial_number ? 'border-red-500' : 'border-slate-700'
          }`}
        />
        {errors.serial_number && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.serial_number}
          </p>
        )}
      </div>

      {/* GPS-position */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          GPS-position *
        </label>

        {/* Kartväljare (visas när aktiverad) */}
        <AnimatePresence>
          {showMapPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4 overflow-hidden"
            >
              <MapLocationPicker
                initialPosition={
                  formData.latitude && formData.longitude
                    ? { lat: formData.latitude, lng: formData.longitude }
                    : null
                }
                onPositionSelect={handleMapPositionSelect}
                onCancel={() => setShowMapPicker(false)}
                height="350px"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* GPS-knappar (visas när kartväljaren är dold) */}
        {!showMapPicker && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* GPS-knapp */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCaptureGps}
                disabled={gpsLoading}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                  hasLocation && !manualLocationSet
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-blue-500'
                }`}
              >
                {gpsLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    <span className="text-blue-400 text-sm">Hämtar...</span>
                  </>
                ) : hasLocation && !manualLocationSet ? (
                  <>
                    <Check className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 text-sm">GPS hämtad</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-6 h-6 text-slate-400" />
                    <span className="text-slate-300 text-sm">Hämta GPS</span>
                  </>
                )}
              </motion.button>

              {/* Kartväljare-knapp */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowMapPicker(true)}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                  manualLocationSet
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-blue-500'
                }`}
              >
                {manualLocationSet ? (
                  <>
                    <Check className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 text-sm">Vald på karta</span>
                  </>
                ) : (
                  <>
                    <Map className="w-6 h-6 text-slate-400" />
                    <span className="text-slate-300 text-sm">Välj på karta</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Visa koordinater */}
            {(formData.latitude !== 0 && formData.longitude !== 0) && (
              <div className={`mt-3 p-3 rounded-lg ${
                manualLocationSet
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : !isHighAccuracy
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-slate-800/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">
                      {manualLocationSet ? 'Manuellt vald position' : 'Koordinater'}
                    </p>
                    <p className="text-white font-mono">
                      {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </p>
                  </div>
                  {!manualLocationSet && formattedAccuracy && (
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Noggrannhet</p>
                      <p className={`font-medium ${
                        accuracyLevel === 'excellent' ? 'text-green-400' :
                        accuracyLevel === 'good' ? 'text-emerald-400' :
                        accuracyLevel === 'acceptable' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {formattedAccuracy}
                        {accuracyLevel === 'excellent' && ' (Utmärkt)'}
                        {accuracyLevel === 'good' && ' (Bra)'}
                        {accuracyLevel === 'acceptable' && ' (OK)'}
                        {accuracyLevel === 'poor' && ' (Dålig!)'}
                      </p>
                      {positionType && (
                        <p className="text-xs text-slate-500">
                          {positionType === 'gps' ? 'GPS' :
                           positionType === 'network' ? 'Nätverksbaserad' :
                           'Okänd källa'}
                        </p>
                      )}
                    </div>
                  )}
                  {manualLocationSet && (
                    <div className="text-right">
                      <p className="text-xs text-blue-400">
                        Markerad manuellt
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GPS-varning (dålig noggrannhet) */}
            {gpsWarning && !manualLocationSet && (
              <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{gpsWarning}</span>
                </p>
                <p className="text-xs text-amber-300/70 mt-2 ml-6">
                  Tips: Gå utomhus, eller använd "Välj på karta" för att markera platsen manuellt.
                </p>
              </div>
            )}

            {/* GPS-fel */}
            {gpsError && !manualLocationSet && (
              <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {gpsError}
                </p>
                <p className="text-xs text-red-300/70 mt-2 ml-5">
                  Alternativ: Använd "Välj på karta" för att markera platsen manuellt.
                </p>
              </div>
            )}

            {errors.latitude && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.latitude}
              </p>
            )}
          </>
        )}
      </div>

      {/* Status (endast vid redigering) */}
      {isEditing && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Status
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(EQUIPMENT_STATUS_CONFIG) as [EquipmentStatus, typeof EQUIPMENT_STATUS_CONFIG[EquipmentStatus]][]).map(
              ([status, config]) => {
                const isSelected = formData.status === status

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status }))}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `${config.borderColor} ${config.bgColor}`
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <p className={`text-sm font-medium ${isSelected ? `text-${config.color}` : 'text-slate-300'}`}>
                      {config.label}
                    </p>
                  </button>
                )
              }
            )}
          </div>
        </div>
      )}

      {/* Kommentar */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Kommentar
        </label>
        <textarea
          value={formData.comment}
          onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
          placeholder="Valfri kommentar om placeringen..."
          rows={3}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Foto
        </label>

        {photoPreview ? (
          <div className="relative">
            <img
              src={photoPreview}
              alt="Förhandsgranskning"
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, photo: null }))
                setPhotoPreview(null)
              }}
              className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <div className="w-full p-8 border-2 border-dashed border-slate-700 rounded-xl hover:border-slate-600 transition-colors flex flex-col items-center gap-3">
              <Camera className="w-8 h-8 text-slate-500" />
              <p className="text-sm text-slate-400">Klicka för att ta foto eller välja från galleri</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handlePhotoChange}
              className="hidden"
              capture="environment"
            />
          </label>
        )}

        {errors.photo && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.photo}
          </p>
        )}
      </div>

      {/* Knappar */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Avbryt
        </button>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sparar...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {isEditing ? 'Spara ändringar' : 'Skapa placering'}
            </>
          )}
        </motion.button>
      </div>
    </form>
  )
}

export default EquipmentPlacementForm
