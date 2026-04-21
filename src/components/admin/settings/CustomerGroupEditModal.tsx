import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { CustomerGroup, CreateCustomerGroupInput, UpdateCustomerGroupInput } from '../../../types/customerGroups'
import { CustomerGroupService } from '../../../services/customerGroupService'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import toast from 'react-hot-toast'

interface CustomerGroupEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  group: CustomerGroup | null // null = create mode
  existingGroups: CustomerGroup[]
}

export function CustomerGroupEditModal({ isOpen, onClose, onSave, group, existingGroups }: CustomerGroupEditModalProps) {
  const [name, setName] = useState('')
  const [seriesStart, setSeriesStart] = useState(0)
  const [seriesEnd, setSeriesEnd] = useState(0)
  const [currentCounter, setCurrentCounter] = useState(0)
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isPrivateDefault, setIsPrivateDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)

  useEffect(() => {
    if (group) {
      setName(group.name)
      setSeriesStart(group.series_start)
      setSeriesEnd(group.series_end)
      setCurrentCounter(group.current_counter)
      setDescription(group.description || '')
      setSortOrder(group.sort_order)
      setIsPrivateDefault(group.is_private_default || false)
    } else {
      setName('')
      setSeriesStart(0)
      setSeriesEnd(0)
      setCurrentCounter(0)
      setDescription('')
      setSortOrder(existingGroups.length + 1)
      setIsPrivateDefault(false)
    }
    setOverlapWarning(null)
  }, [group, isOpen, existingGroups.length])

  const currentPrivateDefault = existingGroups.find(g => g.is_private_default && g.id !== group?.id)

  // Check for overlapping series ranges
  useEffect(() => {
    if (seriesStart <= 0 || seriesEnd <= 0) {
      setOverlapWarning(null)
      return
    }

    const otherGroups = existingGroups.filter(g => g.id !== group?.id)
    const overlap = otherGroups.find(g =>
      (seriesStart >= g.series_start && seriesStart <= g.series_end) ||
      (seriesEnd >= g.series_start && seriesEnd <= g.series_end) ||
      (seriesStart <= g.series_start && seriesEnd >= g.series_end)
    )

    if (overlap) {
      setOverlapWarning(`Serie-intervallet överlappar med "${overlap.name}" (${overlap.series_start}-${overlap.series_end})`)
    } else {
      setOverlapWarning(null)
    }
  }, [seriesStart, seriesEnd, group?.id, existingGroups])

  const capacityUsed = seriesEnd > 0 ? ((currentCounter - seriesStart + 1) / (seriesEnd - seriesStart + 1)) * 100 : 0
  const isNearFull = capacityUsed > 90

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Namn krävs')
      return
    }
    if (seriesStart >= seriesEnd) {
      toast.error('Serie-start måste vara mindre än serie-slut')
      return
    }
    if (currentCounter < seriesStart - 1 || currentCounter > seriesEnd) {
      toast.error(`Nuvarande räknare måste vara mellan ${seriesStart - 1} och ${seriesEnd}`)
      return
    }
    if (overlapWarning) {
      toast.error('Kan inte spara med överlappande serie-intervall')
      return
    }

    setSaving(true)
    try {
      if (group) {
        // Om vi aktiverar privat-default och en annan grupp redan har flaggan,
        // måste vi först rensa den andra (unikt index tillåter bara en rad)
        if (isPrivateDefault && currentPrivateDefault) {
          await CustomerGroupService.updateGroup(currentPrivateDefault.id, { is_private_default: false })
        }
        const update: UpdateCustomerGroupInput = {
          name: name.trim(),
          series_start: seriesStart,
          series_end: seriesEnd,
          current_counter: currentCounter,
          description: description.trim() || undefined,
          sort_order: sortOrder,
          is_private_default: isPrivateDefault,
        }
        await CustomerGroupService.updateGroup(group.id, update)
        toast.success('Kundgrupp uppdaterad')
      } else {
        const create: CreateCustomerGroupInput = {
          name: name.trim(),
          series_start: seriesStart,
          series_end: seriesEnd,
          current_counter: currentCounter,
          description: description.trim() || undefined,
          sort_order: sortOrder,
        }
        await CustomerGroupService.createGroup(create)
        toast.success('Kundgrupp skapad')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">
            {group ? 'Redigera kundgrupp' : 'Skapa kundgrupp'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Namn */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Namn</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Fastighetsbolag Bostad Regional"
            />
          </div>

          {/* Serie-intervall */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-white">Serie-intervall</h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Start</label>
                <input
                  type="number"
                  value={seriesStart || ''}
                  onChange={(e) => setSeriesStart(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Slut</label>
                <input
                  type="number"
                  value={seriesEnd || ''}
                  onChange={(e) => setSeriesEnd(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Senaste nummer</label>
                <input
                  type="number"
                  value={currentCounter || ''}
                  onChange={(e) => setCurrentCounter(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                />
              </div>
            </div>

            {/* Kapacitetsindikator */}
            {seriesEnd > seriesStart && currentCounter >= seriesStart && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Kapacitet</span>
                  <span>{Math.max(0, currentCounter - seriesStart + 1)} / {seriesEnd - seriesStart + 1} ({Math.round(Math.max(0, capacityUsed))}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isNearFull ? 'bg-amber-500' : 'bg-[#20c58f]'}`}
                    style={{ width: `${Math.min(100, Math.max(0, capacityUsed))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Överlappningsvarning */}
            {overlapWarning && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{overlapWarning}</span>
              </div>
            )}

            {isNearFull && !overlapWarning && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Serien är snart full ({Math.round(capacityUsed)}% använd)</span>
              </div>
            )}
          </div>

          {/* Sorteringsordning & Beskrivning */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Sorteringsordning</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning (valfritt)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kort beskrivning..."
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
            </div>
          </div>

          {/* Privat-default toggle (bara i redigeringsläge) */}
          {group && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivateDefault}
                  onChange={(e) => setIsPrivateDefault(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-800 border-slate-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Standard för privatpersoner</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Privatärenden som avslutas tilldelas automatiskt ett kundnummer från denna grupp.
                  </div>
                  {isPrivateDefault && currentPrivateDefault && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Flaggan flyttas från <strong>{currentPrivateDefault.name}</strong>. Endast en grupp kan vara standard åt gången.
                      </span>
                    </div>
                  )}
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !!overlapWarning}
          >
            {saving ? 'Sparar...' : group ? 'Uppdatera' : 'Skapa'}
          </Button>
        </div>
      </div>
    </div>
  )
}
