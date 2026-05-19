// src/components/admin/settings/PreparationEditModal.tsx
// Modal för att skapa/redigera preparat

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Save, Beaker, Check, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { PreparationService } from '../../../services/preparationService'
import { StationTypeService } from '../../../services/stationTypeService'
import type { StationType } from '../../../types/stationTypes'
import {
  MeasurementUnit,
  ThresholdDirection,
  MEASUREMENT_UNIT_CONFIG,
  CALCULATED_STATUS_CONFIG,
  generateThresholdPreview
} from '../../../types/stationTypes'
import {
  Preparation,
  PreparationCategory,
  PREPARATION_CATEGORY_CONFIG,
  CreatePreparationInput
} from '../../../types/preparations'
import { PEST_TYPES } from '../../../utils/clickupFieldMapper'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import toast from 'react-hot-toast'

interface PreparationEditModalProps {
  preparation: Preparation | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function PreparationEditModal({
  preparation,
  isOpen,
  onClose,
  onSave
}: PreparationEditModalProps) {
  const isEditing = preparation !== null

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState<PreparationCategory>('biocidprodukt')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [pestTypes, setPestTypes] = useState<string[]>([])
  const [activeSubstances, setActiveSubstances] = useState('')
  const [dosage, setDosage] = useState('')
  const [stationTypeIds, setStationTypeIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [showOnWebsite, setShowOnWebsite] = useState(false)
  const [thresholdWarning, setThresholdWarning] = useState<string>('')
  const [thresholdCritical, setThresholdCritical] = useState<string>('')
  const [thresholdDirection, setThresholdDirection] = useState<ThresholdDirection>('above')
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('gram')
  const [measurementLabel, setMeasurementLabel] = useState('')
  const [thresholdErrors, setThresholdErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [stationTypes, setStationTypes] = useState<StationType[]>([])

  // Hämta stationstyper vid mount
  useEffect(() => {
    StationTypeService.getActiveStationTypes()
      .then(setStationTypes)
      .catch(() => setStationTypes([]))
  }, [])

  // Fyll i formulär när preparat ändras
  useEffect(() => {
    if (preparation) {
      setName(preparation.name)
      setCategory(preparation.category)
      setRegistrationNumber(preparation.registration_number || '')
      setPestTypes(preparation.pest_types || [])
      setStationTypeIds(preparation.station_type_ids || [])
      setActiveSubstances(preparation.active_substances || '')
      setDosage(preparation.dosage || '')
      setIsActive(preparation.is_active)
      setShowOnWebsite(preparation.show_on_website)
      setThresholdWarning(preparation.threshold_warning?.toString() || '')
      setThresholdCritical(preparation.threshold_critical?.toString() || '')
      setThresholdDirection(preparation.threshold_direction || 'above')
      setMeasurementUnit(preparation.measurement_unit || 'gram')
      setMeasurementLabel(preparation.measurement_label || '')
    } else {
      // Reset för nytt preparat
      setName('')
      setCategory('biocidprodukt')
      setRegistrationNumber('')
      setPestTypes([])
      setStationTypeIds([])
      setActiveSubstances('')
      setDosage('')
      setIsActive(true)
      setShowOnWebsite(false)
      setThresholdWarning('')
      setThresholdCritical('')
      setThresholdDirection('above')
      setMeasurementUnit('gram')
      setMeasurementLabel('')
    }
    setThresholdErrors({})
  }, [preparation])

  // Toggle skadedjur
  const togglePestType = (pest: string) => {
    if (pestTypes.includes(pest)) {
      setPestTypes(pestTypes.filter(p => p !== pest))
    } else {
      setPestTypes([...pestTypes, pest])
    }
  }

  // Toggle stationstyp
  const toggleStationType = (id: string) => {
    if (stationTypeIds.includes(id)) {
      setStationTypeIds(stationTypeIds.filter(s => s !== id))
    } else {
      setStationTypeIds([...stationTypeIds, id])
    }
  }

  // Validera tröskelvärden
  const validateThresholds = (): boolean => {
    const errors: Record<string, string> = {}
    const warningVal = thresholdWarning ? parseFloat(thresholdWarning) : null
    const criticalVal = thresholdCritical ? parseFloat(thresholdCritical) : null

    if (thresholdWarning && isNaN(warningVal!)) errors.warning = 'Ogiltigt nummer'
    if (thresholdCritical && isNaN(criticalVal!)) errors.critical = 'Ogiltigt nummer'

    if (warningVal !== null && criticalVal !== null) {
      if (thresholdDirection === 'above' && warningVal >= criticalVal) {
        errors.critical = 'Kritisk måste vara högre än varning'
      }
      if (thresholdDirection === 'below' && warningVal <= criticalVal) {
        errors.critical = 'Kritisk måste vara lägre än varning'
      }
    }

    setThresholdErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Spara
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Produktnamn är obligatoriskt')
      return
    }

    if (!validateThresholds()) return

    setSaving(true)

    try {
      const input: CreatePreparationInput = {
        name: name.trim(),
        category,
        registration_number: registrationNumber.trim() || null,
        pest_types: pestTypes,
        station_type_ids: stationTypeIds,
        active_substances: activeSubstances.trim() || null,
        dosage: dosage.trim() || null,
        is_active: isActive,
        show_on_website: showOnWebsite,
        threshold_warning: thresholdWarning ? parseFloat(thresholdWarning) : null,
        threshold_critical: thresholdCritical ? parseFloat(thresholdCritical) : null,
        threshold_direction: thresholdDirection,
        measurement_unit: measurementUnit,
        measurement_label: measurementLabel.trim() || null
      }

      if (isEditing && preparation) {
        await PreparationService.updatePreparation(preparation.id, input)
        toast.success('Preparat uppdaterat')
      } else {
        await PreparationService.createPreparation(input)
        toast.success('Preparat skapat')
      }

      onSave()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara preparat')
    } finally {
      setSaving(false)
    }
  }

  // Förhandsgranskning tröskelvärden
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-xl border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Redigera preparat' : 'Nytt preparat'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Grundläggande info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Produktnamn *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Rozol Block Pro"
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Kategori
              </label>
              <Select
                value={category}
                onChange={(v) => setCategory(v as PreparationCategory)}
                options={Object.entries(PREPARATION_CATEGORY_CONFIG).map(([key, config]) => ({ value: key, label: config.label }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Registreringsnummer
              </label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="T.ex. 5409"
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Verksamma ämnen */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Verksamma ämnen
            </label>
            <input
              type="text"
              value={activeSubstances}
              onChange={(e) => setActiveSubstances(e.target.value)}
              placeholder="T.ex. Klorfacinon 0,005 vikt-%"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Dosering */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Dosering
            </label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="T.ex. 25g/block"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Skadedjur */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Skadedjur som preparatet används mot
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg max-h-48 overflow-y-auto">
              {PEST_TYPES.map((pest) => {
                const isSelected = pestTypes.includes(pest)
                return (
                  <button
                    key={pest}
                    type="button"
                    onClick={() => togglePestType(pest)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {pest}
                  </button>
                )
              })}
            </div>
            {pestTypes.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {pestTypes.length} skadedjur valda
              </p>
            )}
          </div>

          {/* Stationstyper */}
          {stationTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Stationstyper som preparatet används i
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                {stationTypes.map((st) => {
                  const isSelected = stationTypeIds.includes(st.id)
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleStationType(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:border-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: st.color }}
                      />
                      {st.name}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {stationTypeIds.length === 0
                  ? 'Alla stationstyper (lämna tomt för att visa överallt)'
                  : `${stationTypeIds.length} stationstyper valda`}
              </p>
            </div>
          )}

          {/* Tröskelvärden */}
          <div className="space-y-4 pt-2 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider pt-2">
              Tröskelvärden
            </h3>
            <p className="text-xs text-slate-500">
              Preparatets tröskelvärden tar företräde framför stationstypens när detta preparat är i stationen.
            </p>

            {/* Mätenhet */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Mätenhet</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MEASUREMENT_UNIT_CONFIG) as MeasurementUnit[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
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
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Etikett för mätning
              </label>
              <input
                type="text"
                value={measurementLabel}
                onChange={(e) => setMeasurementLabel(e.target.value)}
                placeholder={`T.ex. Förbrukning (${MEASUREMENT_UNIT_CONFIG[measurementUnit].shortLabel})`}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Riktning */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Riktning</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="prep-direction"
                    checked={thresholdDirection === 'above'}
                    onChange={() => setThresholdDirection('above')}
                    className="w-4 h-4 bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-white text-sm">Över tröskeln är dåligt</span>
                  <span className="text-slate-500 text-xs">(t.ex. förbrukning ökar)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="prep-direction"
                    checked={thresholdDirection === 'below'}
                    onChange={() => setThresholdDirection('below')}
                    className="w-4 h-4 bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-white text-sm">Under tröskeln är dåligt</span>
                  <span className="text-slate-500 text-xs">(t.ex. bete minskar)</span>
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
                    className={`w-full px-3 py-2 bg-slate-800/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pr-10 ${
                      thresholdErrors.warning ? 'border-red-500' : 'border-slate-700'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    {MEASUREMENT_UNIT_CONFIG[measurementUnit].shortLabel}
                  </span>
                </div>
                {thresholdErrors.warning && <p className="text-red-400 text-xs mt-1">{thresholdErrors.warning}</p>}
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
                    className={`w-full px-3 py-2 bg-slate-800/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 pr-10 ${
                      thresholdErrors.critical ? 'border-red-500' : 'border-slate-700'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    {MEASUREMENT_UNIT_CONFIG[measurementUnit].shortLabel}
                  </span>
                </div>
                {thresholdErrors.critical && <p className="text-red-400 text-xs mt-1">{thresholdErrors.critical}</p>}
              </div>
            </div>

            {/* Förhandsgranskning */}
            {previewThresholds.length > 0 && (
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs font-medium text-slate-400 mb-2">Förhandsgranskning</p>
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

          {/* Toggles */}
          <div className="flex items-center gap-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <div>
                <p className="text-sm font-medium text-white">Aktivt</p>
                <p className="text-xs text-slate-500">Visas som val i ärenden</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnWebsite}
                onChange={(e) => setShowOnWebsite(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <div>
                <p className="text-sm font-medium text-white">Visa på hemsidan</p>
                <p className="text-xs text-slate-500">Synlig på begone.se</p>
              </div>
            </label>
          </div>

          {/* Knappar */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditing ? 'Spara ändringar' : 'Skapa preparat'}
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
