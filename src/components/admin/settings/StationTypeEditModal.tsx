// src/components/admin/settings/StationTypeEditModal.tsx
// Modal för att skapa/redigera stationstyp

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Save,
  Target,
  Box,
  Package,
  Crosshair,
  Circle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { StationTypeService } from '../../../services/stationTypeService'
import {
  StationType,
  CreateStationTypeInput,
  MeasurementUnit,
  ThresholdDirection,
  MEASUREMENT_UNIT_CONFIG,
  CALCULATED_STATUS_CONFIG,
  generateThresholdPreview
} from '../../../types/stationTypes'
import toast from 'react-hot-toast'

// Tillgängliga färger
const COLOR_OPTIONS = [
  { value: '#22c55e', label: 'Grön' },
  { value: '#3b82f6', label: 'Blå' },
  { value: '#6b7280', label: 'Grå' },
  { value: '#1f2937', label: 'Mörkgrå' },
  { value: '#ef4444', label: 'Röd' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#8b5cf6', label: 'Lila' },
  { value: '#06b6d4', label: 'Cyan' }
]

// Tillgängliga ikoner
const ICON_OPTIONS = [
  { value: 'target', label: 'Måltavla', icon: Target },
  { value: 'box', label: 'Låda', icon: Box },
  { value: 'package', label: 'Paket', icon: Package },
  { value: 'crosshair', label: 'Sikte', icon: Crosshair },
  { value: 'circle', label: 'Cirkel', icon: Circle }
]

interface StationTypeEditModalProps {
  stationType: StationType | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function StationTypeEditModal({
  stationType,
  isOpen,
  onClose,
  onSave
}: StationTypeEditModalProps) {
  const isEditing = stationType !== null

  // Form state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [prefix, setPrefix] = useState('')
  const [color, setColor] = useState('#6b7280')
  const [icon, setIcon] = useState('box')
  const [requiresSerialNumber, setRequiresSerialNumber] = useState(false)
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('st')
  const [measurementLabel, setMeasurementLabel] = useState('')
  const [thresholdWarning, setThresholdWarning] = useState<string>('')
  const [thresholdCritical, setThresholdCritical] = useState<string>('')
  const [thresholdDirection, setThresholdDirection] = useState<ThresholdDirection>('above')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fyll i formulär vid redigering
  useEffect(() => {
    if (stationType) {
      setName(stationType.name)
      setCode(stationType.code)
      setDescription(stationType.description || '')
      setPrefix(stationType.prefix)
      setColor(stationType.color)
      setIcon(stationType.icon)
      setRequiresSerialNumber(stationType.requires_serial_number)
      setMeasurementUnit(stationType.measurement_unit)
      setMeasurementLabel(stationType.measurement_label || '')
      setThresholdWarning(stationType.threshold_warning?.toString() || '')
      setThresholdCritical(stationType.threshold_critical?.toString() || '')
      setThresholdDirection(stationType.threshold_direction)
      setIsActive(stationType.is_active)
    } else {
      // Återställ för ny
      setName('')
      setCode('')
      setDescription('')
      setPrefix('')
      setColor('#6b7280')
      setIcon('box')
      setRequiresSerialNumber(false)
      setMeasurementUnit('st')
      setMeasurementLabel('')
      setThresholdWarning('')
      setThresholdCritical('')
      setThresholdDirection('above')
      setIsActive(true)
    }
    setErrors({})
  }, [stationType, isOpen])

  // Auto-generera kod och prefix från namn
  useEffect(() => {
    if (!isEditing && name) {
      const generatedCode = name
        .toLowerCase()
        .replace(/å/g, 'a')
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
      setCode(generatedCode)

      // Generera prefix från första bokstäverna
      const words = name.split(' ')
      const generatedPrefix = words
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() || '')
        .join('')
      setPrefix(generatedPrefix)
    }
  }, [name, isEditing])

  // Validera formulär
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Namn krävs'
    }
    if (!code.trim()) {
      newErrors.code = 'Kod krävs'
    }
    if (!prefix.trim()) {
      newErrors.prefix = 'Prefix krävs'
    } else if (prefix.length > 3) {
      newErrors.prefix = 'Prefix får max vara 3 tecken'
    }

    // Validera tröskelvärden
    const warningVal = thresholdWarning ? parseFloat(thresholdWarning) : null
    const criticalVal = thresholdCritical ? parseFloat(thresholdCritical) : null

    if (warningVal !== null && isNaN(warningVal)) {
      newErrors.thresholdWarning = 'Ogiltigt nummer'
    }
    if (criticalVal !== null && isNaN(criticalVal)) {
      newErrors.thresholdCritical = 'Ogiltigt nummer'
    }

    // Logisk validering av tröskelvärden
    if (warningVal !== null && criticalVal !== null) {
      if (thresholdDirection === 'above' && warningVal >= criticalVal) {
        newErrors.thresholdCritical = 'Kritisk måste vara högre än varning'
      }
      if (thresholdDirection === 'below' && warningVal <= criticalVal) {
        newErrors.thresholdCritical = 'Kritisk måste vara lägre än varning'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Spara
  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      const input: CreateStationTypeInput = {
        code,
        name: name.trim(),
        description: description.trim() || undefined,
        prefix: prefix.toUpperCase(),
        color,
        icon,
        requires_serial_number: requiresSerialNumber,
        measurement_unit: measurementUnit,
        measurement_label: measurementLabel.trim() || undefined,
        threshold_warning: thresholdWarning ? parseFloat(thresholdWarning) : null,
        threshold_critical: thresholdCritical ? parseFloat(thresholdCritical) : null,
        threshold_direction: thresholdDirection,
        is_active: isActive
      }

      if (isEditing && stationType) {
        await StationTypeService.updateStationType(stationType.id, input)
        toast.success('Stationstyp uppdaterad')
      } else {
        await StationTypeService.createStationType(input)
        toast.success('Stationstyp skapad')
      }

      onSave()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  // Förhandsgranskning av tröskelvärden
  const previewThresholds = (thresholdWarning || thresholdCritical)
    ? generateThresholdPreview({
        threshold_warning: thresholdWarning ? parseFloat(thresholdWarning) : null,
        threshold_critical: thresholdCritical ? parseFloat(thresholdCritical) : null,
        threshold_direction: thresholdDirection,
        measurement_unit: measurementUnit
      })
    : []

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? 'Redigera stationstyp' : 'Ny stationstyp'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollbart */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Grundläggande info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Grundläggande
            </h3>

            {/* Namn */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Namn <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Mekanisk fälla"
                className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                  errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-emerald-500'
                }`}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Kod och Prefix */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Kod <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="mechanical_trap"
                  disabled={isEditing}
                  className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 font-mono ${
                    isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  } ${errors.code ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-emerald-500'}`}
                />
                {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Prefix <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="MF"
                  maxLength={3}
                  className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 font-mono uppercase ${
                    errors.prefix ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-emerald-500'
                  }`}
                />
                {errors.prefix && <p className="text-red-400 text-xs mt-1">{errors.prefix}</p>}
              </div>
            </div>

            {/* Beskrivning */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">Beskrivning</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Valfri beskrivning av stationstypen"
                rows={2}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            {/* Färg och Ikon */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Färg</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        color === c.value
                          ? 'border-white scale-110'
                          : 'border-transparent hover:border-slate-500'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Ikon</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((i) => (
                    <button
                      key={i.value}
                      onClick={() => setIcon(i.value)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        icon === i.value
                          ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                          : 'bg-slate-700 border border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                      title={i.label}
                    >
                      <i.icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Kräver serienummer */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresSerialNumber}
                onChange={(e) => setRequiresSerialNumber(e.target.checked)}
                className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white">Kräver serienummer</span>
            </label>
          </div>

          {/* Tröskelvärden */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Tröskelvärden
            </h3>

            {/* Mätenhet */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Mätenhet</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MEASUREMENT_UNIT_CONFIG) as MeasurementUnit[]).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setMeasurementUnit(unit)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      measurementUnit === unit
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {MEASUREMENT_UNIT_CONFIG[unit].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mätetikett */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Etikett för mätning
              </label>
              <input
                type="text"
                value={measurementLabel}
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder={`T.ex. Förbrukning (${MEASUREMENT_UNIT_CONFIG[measurementUnit].shortLabel})`}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Riktning */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Riktning</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    checked={thresholdDirection === 'above'}
                    onChange={() => setThresholdDirection('above')}
                    className="w-4 h-4 bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-white">Över tröskeln är dåligt</span>
                  <span className="text-slate-500 text-sm">(t.ex. förbrukning ökar)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    checked={thresholdDirection === 'below'}
                    onChange={() => setThresholdDirection('below')}
                    className="w-4 h-4 bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-white">Under tröskeln är dåligt</span>
                  <span className="text-slate-500 text-sm">(t.ex. bete minskar)</span>
                </label>
              </div>
            </div>

            {/* Tröskelvärden */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-amber-400 mb-1">
                  Varningströskel (gul)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={thresholdWarning}
                    onChange={(e) => setThresholdWarning(e.target.value)}
                    placeholder="10"
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                      errors.thresholdWarning ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-amber-500'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {MEASUREMENT_UNIT_CONFIG[measurementUnit].shortLabel}
                  </span>
                </div>
                {errors.thresholdWarning && <p className="text-red-400 text-xs mt-1">{errors.thresholdWarning}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-red-400 mb-1">
                  Kritisk tröskel (röd)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={thresholdCritical}
                    onChange={(e) => setThresholdCritical(e.target.value)}
                    placeholder="25"
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                      errors.thresholdCritical ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-red-500'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {MEASUREMENT_UNIT_CONFIG[measurementUnit].shortLabel}
                  </span>
                </div>
                {errors.thresholdCritical && <p className="text-red-400 text-xs mt-1">{errors.thresholdCritical}</p>}
              </div>
            </div>

            {/* Förhandsgranskning */}
            {previewThresholds.length > 0 && (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-sm font-medium text-white mb-2">Förhandsgranskning</p>
                <div className="space-y-1">
                  {previewThresholds.map((item, i) => {
                    const config = CALCULATED_STATUS_CONFIG[item.status]
                    const StatusIcon = item.status === 'ok'
                      ? CheckCircle2
                      : item.status === 'warning'
                        ? AlertTriangle
                        : AlertCircle

                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <StatusIcon className={`w-4 h-4 ${config.color}`} />
                        <span className={config.color}>{item.range}</span>
                        <span className="text-slate-500">→</span>
                        <span className={config.color}>{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Spara ändringar' : 'Skapa stationstyp'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
