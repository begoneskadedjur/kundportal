// src/components/shared/CasePreparationsSection.tsx
// Sektion för preparathantering i ärende-modaler
// Ska INTE visas för service_type === 'inspection' (kontrollrunda)

import { useState } from 'react'
import {
  Beaker,
  Plus,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  Package,
  Loader2
} from 'lucide-react'
import { useCasePreparations } from '../../hooks/useCasePreparations'
import {
  CasePreparationType,
  PREPARATION_UNIT_CONFIG,
  PreparationUnit
} from '../../types/casePreparations'
import { PREPARATION_CATEGORY_CONFIG } from '../../types/preparations'
import Button from '../ui/Button'

interface CasePreparationsSectionProps {
  caseId: string | null
  caseType: CasePreparationType
  pestType: string | null
  technicianId?: string | null
  technicianName?: string | null
  isReadOnly?: boolean
}

export default function CasePreparationsSection({
  caseId,
  caseType,
  pestType,
  technicianId,
  technicianName,
  isReadOnly = false
}: CasePreparationsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPreparationId, setSelectedPreparationId] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [unit, setUnit] = useState<PreparationUnit>('st')
  const [notes, setNotes] = useState('')

  const {
    casePreparations,
    availablePreparations,
    loading,
    savingPreparation,
    addPreparation,
    removePreparation
  } = useCasePreparations({
    caseId,
    caseType,
    pestType,
    technicianId,
    technicianName,
    enabled: !!caseId
  })

  const handleAdd = async () => {
    if (!selectedPreparationId || quantity <= 0) return

    await addPreparation(selectedPreparationId, quantity, unit, notes || undefined)

    // Reset form
    setSelectedPreparationId('')
    setQuantity(1)
    setUnit('st')
    setNotes('')
    setShowAddForm(false)
  }

  const selectedPreparation = availablePreparations.find((p) => p.id === selectedPreparationId)

  if (!caseId) return null

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-500/20 rounded-lg">
            <Beaker className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-medium text-sm">Använda preparat</h3>
            <p className="text-[10px] text-slate-400">
              {casePreparations.length} registrerade
              {pestType && pestType !== 'Övrigt' && ` • ${pestType}`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Lista över använda preparat */}
              {casePreparations.length > 0 ? (
                <div className="space-y-1.5">
                  {casePreparations.map((cp) => {
                    const categoryConfig = PREPARATION_CATEGORY_CONFIG[cp.preparation.category]
                    return (
                      <div
                        key={cp.id}
                        className="flex items-center justify-between py-2 px-2.5 bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white text-sm font-medium truncate">{cp.preparation.name}</span>
                            {categoryConfig && (
                              <span
                                className={`px-1.5 py-0.5 text-[10px] rounded-full ${categoryConfig.bgColor} ${categoryConfig.color}`}
                              >
                                {categoryConfig.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {cp.quantity} {PREPARATION_UNIT_CONFIG[cp.unit]?.label || cp.unit}
                            </span>
                            {cp.dosage_notes && (
                              <span className="text-slate-500 italic truncate">{cp.dosage_notes}</span>
                            )}
                          </div>
                        </div>

                        {!isReadOnly && (
                          <button
                            onClick={() => removePreparation(cp.id)}
                            disabled={savingPreparation}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-xs text-center py-3">
                  Inga preparat registrerade
                </p>
              )}

              {/* Lägg till formulär */}
              {!isReadOnly && (
                <>
                  {showAddForm ? (
                    <div className="p-4 bg-slate-700/30 rounded-lg space-y-3 border border-slate-600">
                      {/* Välj preparat */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Preparat{' '}
                          {pestType && pestType !== 'Övrigt' && `(filtrerat på ${pestType})`}
                        </label>
                        <select
                          value={selectedPreparationId}
                          onChange={(e) => setSelectedPreparationId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                          <option value="">Välj preparat...</option>
                          {availablePreparations.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.registration_number ? `(${p.registration_number})` : ''}
                            </option>
                          ))}
                        </select>
                        {availablePreparations.length === 0 && (
                          <p className="text-xs text-amber-400 mt-1">
                            Inga preparat hittades för{' '}
                            {pestType ? `skadedjurstyp "${pestType}"` : 'denna ärendetyp'}
                          </p>
                        )}
                      </div>

                      {/* Visa detaljer om valt preparat */}
                      {selectedPreparation && (
                        <div className="p-3 bg-slate-800 rounded-lg text-sm">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <div>
                              {selectedPreparation.dosage && (
                                <p className="text-slate-300">
                                  <span className="text-slate-500">Rekommenderad dos:</span>{' '}
                                  {selectedPreparation.dosage}
                                </p>
                              )}
                              {selectedPreparation.active_substances && (
                                <p className="text-slate-400 text-xs mt-1">
                                  Aktiva substanser: {selectedPreparation.active_substances}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mängd och enhet */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Antal/Mängd
                          </label>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Enhet
                          </label>
                          <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as PreparationUnit)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          >
                            {Object.entries(PREPARATION_UNIT_CONFIG).map(([key, config]) => (
                              <option key={key} value={key}>
                                {config.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Anteckningar */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Anteckningar (valfritt)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="T.ex. avvikelse från standarddosering..."
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Knappar */}
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                          Avbryt
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAdd}
                          disabled={!selectedPreparationId || quantity <= 0 || savingPreparation}
                        >
                          {savingPreparation ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              Sparar...
                            </>
                          ) : (
                            'Lägg till'
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowAddForm(true)}
                      className="w-full border-dashed border-slate-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Lägg till preparat
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
