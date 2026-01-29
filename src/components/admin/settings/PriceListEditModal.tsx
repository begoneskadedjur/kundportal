// src/components/admin/settings/PriceListEditModal.tsx
// Modal för att skapa/redigera prislista

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Save,
  FileText,
  Loader2,
  Star
} from 'lucide-react'
import { PriceListService } from '../../../services/priceListService'
import { PriceList, CreatePriceListInput } from '../../../types/articles'
import toast from 'react-hot-toast'

interface PriceListEditModalProps {
  priceList: PriceList | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function PriceListEditModal({
  priceList,
  isOpen,
  onClose,
  onSave
}: PriceListEditModalProps) {
  const isEditing = priceList !== null

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fyll i formulär vid redigering
  useEffect(() => {
    if (priceList) {
      setName(priceList.name)
      setDescription(priceList.description || '')
      setIsDefault(priceList.is_default)
      setIsActive(priceList.is_active)
      setValidFrom(priceList.valid_from || '')
      setValidTo(priceList.valid_to || '')
    } else {
      // Återställ för ny
      setName('')
      setDescription('')
      setIsDefault(false)
      setIsActive(true)
      setValidFrom('')
      setValidTo('')
    }
    setErrors({})
  }, [priceList, isOpen])

  // Validera formulär
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Namn krävs'
    }

    if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) {
      newErrors.validTo = 'Slutdatum måste vara efter startdatum'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Spara
  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      const input: CreatePriceListInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_default: isDefault,
        is_active: isActive,
        valid_from: validFrom || undefined,
        valid_to: validTo || undefined
      }

      if (isEditing && priceList) {
        await PriceListService.updatePriceList(priceList.id, input)
        toast.success('Prislista uppdaterad')
      } else {
        await PriceListService.createPriceList(input)
        toast.success('Prislista skapad')
      }

      onSave()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

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
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {isEditing ? 'Redigera prislista' : 'Ny prislista'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Namn */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Namn <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Standardprislista 2025"
              className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
              }`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Beskrivning */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Beskrivning
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Valfri beskrivning"
              rows={2}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Giltighetsdatum */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Giltig från
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Giltig till
              </label>
              <input
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className={`w-full px-4 py-2 bg-slate-900 border rounded-lg text-white focus:outline-none focus:ring-2 ${
                  errors.validTo ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                }`}
              />
              {errors.validTo && <p className="text-red-400 text-xs mt-1">{errors.validTo}</p>}
            </div>
          </div>

          {/* Checkboxar */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-purple-500 focus:ring-purple-500"
              />
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-purple-400" />
                <span className="text-white">Standardprislista</span>
              </div>
            </label>
            {isDefault && (
              <p className="text-slate-500 text-xs ml-8">
                Standardprislistan används för kunder utan specifik prislista.
              </p>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-white">Aktiv</span>
              <span className="text-slate-500 text-sm">(kan väljas för kunder)</span>
            </label>
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
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Spara ändringar' : 'Skapa prislista'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
