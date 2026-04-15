// src/components/admin/settings/ServiceCatalogEditModal.tsx

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import { ServiceCatalogService } from '../../../services/servicesCatalogService'
import type { Service, ServiceWithGroup, ServiceGroup, CreateServiceInput, UpdateServiceInput } from '../../../types/services'
import { SERVICE_UNITS } from '../../../types/services'

interface ServiceCatalogEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  service: ServiceWithGroup | null   // null = skapa ny
  groups: ServiceGroup[]
}

export default function ServiceCatalogEditModal({
  isOpen,
  onClose,
  onSaved,
  service,
  groups,
}: ServiceCatalogEditModalProps) {
  const isCreating = service === null

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [unit, setUnit] = useState<string>('st')
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [isActive, setIsActive] = useState(true)
  const [showInBooking, setShowInBooking] = useState(true)
  // Prisguide-inställningar
  const [basePrice, setBasePrice] = useState<string>('')
  const [minMarginPercent, setMinMarginPercent] = useState<number>(20)
  const [recommendedMarkupPercent, setRecommendedMarkupPercent] = useState<number>(40)
  const [isAddonService, setIsAddonService] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (service) {
      setCode(service.code)
      setName(service.name)
      setDescription(service.description || '')
      setGroupId(service.group_id || '')
      setUnit(service.unit)
      setSortOrder(service.sort_order)
      setIsActive(service.is_active)
      setShowInBooking(service.show_in_booking)
      setBasePrice(service.base_price != null ? String(service.base_price) : '')
      setMinMarginPercent(service.min_margin_percent ?? 20)
      setRecommendedMarkupPercent(service.recommended_markup_percent ?? 40)
      setIsAddonService(service.is_addon_service ?? false)
    } else {
      setCode('')
      setName('')
      setDescription('')
      setGroupId(groups[0]?.id || '')
      setUnit('st')
      setSortOrder(0)
      setIsActive(true)
      setShowInBooking(true)
      setBasePrice('')
      setMinMarginPercent(20)
      setRecommendedMarkupPercent(40)
      setIsAddonService(false)
    }
  }, [isOpen, service, groups])

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Namn är obligatoriskt'); return }
    if (!code.trim()) { toast.error('Kod är obligatorisk'); return }

    setSaving(true)
    try {
      const basePriceNum = basePrice.trim() ? parseFloat(basePrice.trim()) : null
      if (isCreating) {
        const input: CreateServiceInput = {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          group_id: groupId || null,
          unit,
          sort_order: sortOrder,
          is_active: isActive,
          base_price: basePriceNum,
          min_margin_percent: minMarginPercent,
          recommended_markup_percent: recommendedMarkupPercent,
          is_addon_service: isAddonService,
        }
        await ServiceCatalogService.createService(input)
        toast.success('Tjänst skapad')
      } else {
        const input: UpdateServiceInput = {
          name: name.trim(),
          description: description.trim() || null,
          group_id: groupId || null,
          unit,
          sort_order: sortOrder,
          is_active: isActive,
          show_in_booking: showInBooking,
          base_price: basePriceNum,
          min_margin_percent: minMarginPercent,
          recommended_markup_percent: recommendedMarkupPercent,
          is_addon_service: isAddonService,
        }
        await ServiceCatalogService.updateService(service!.id, input)
        toast.success('Tjänst uppdaterad')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectClass = 'w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="text-base font-semibold text-white">
                {isCreating ? 'Ny tjänst' : 'Redigera tjänst'}
              </h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Art.nr *</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={!isCreating}
                    placeholder="1"
                    className={`${selectClass} ${!isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Enhet</label>
                  <Select
                    value={unit}
                    onChange={setUnit}
                    options={SERVICE_UNITS.map(u => ({ value: u, label: u }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Namn *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="T.ex. Inspektion Fågel"
                  className={selectClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Grupp</label>
                <Select
                  value={groupId}
                  onChange={setGroupId}
                  placeholder="Ingen grupp"
                  options={[
                    { value: '', label: 'Ingen grupp' },
                    ...groups.map(g => ({ value: g.id, label: g.name }))
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Valfri beskrivning..."
                  className={`${selectClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Sorteringsordning</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    className={selectClass}
                  />
                </div>
                <div className="flex flex-col gap-2 justify-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                    />
                    <span className="text-sm text-slate-300">Aktiv</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInBooking}
                      onChange={(e) => setShowInBooking(e.target.checked)}
                      className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                    />
                    <span className="text-sm text-slate-300">Visas vid bokning</span>
                  </label>
                </div>
              </div>

              {/* Prisguide-inställningar */}
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-300">Prisguide</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAddonService}
                      onChange={(e) => setIsAddonService(e.target.checked)}
                      className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                    />
                    <span className="text-xs text-slate-400">Tilläggstjänst</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fast grundpris (kr, exkl. moms)</label>
                  <input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="Lämna tomt för kalkylatorstyrt pris"
                    min={0}
                    className={selectClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min. marginal %</label>
                    <input
                      type="number"
                      value={minMarginPercent}
                      onChange={(e) => setMinMarginPercent(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      className={selectClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Rek. påslag %</label>
                    <input
                      type="number"
                      value={recommendedMarkupPercent}
                      onChange={(e) => setRecommendedMarkupPercent(parseFloat(e.target.value) || 0)}
                      min={0}
                      className={selectClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
              <Button variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {isCreating ? 'Skapa' : 'Spara'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
