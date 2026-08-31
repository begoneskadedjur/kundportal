// src/components/admin/settings/ServiceCatalogEditModal.tsx

import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import { ServiceCatalogService } from '../../../services/servicesCatalogService'
import { AddonStationBillingService } from '../../../services/addonStationBillingService'
import { ArticleService } from '../../../services/articleService'
import type { Article } from '../../../types/articles'
import type { Service, ServiceWithGroup, ServiceGroup, CreateServiceInput, UpdateServiceInput } from '../../../types/services'
import { SERVICE_UNITS } from '../../../types/services'
import { DEFAULT_ROT_PERCENT, DEFAULT_RUT_PERCENT } from '../../../utils/rotRutConstants'

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
  // ROT/RUT-inställningar
  const [rotEligible, setRotEligible] = useState(false)
  const [rutEligible, setRutEligible] = useState(false)
  const [rotRatePercent, setRotRatePercent] = useState<string>('')
  const [rutRatePercent, setRutRatePercent] = useState<string>('')
  // Avtalstyp-flagga — om true visas tjänsten som val i kundens Avtalstyp
  const [isContractService, setIsContractService] = useState(false)
  // Tilläggsstationer: EN tjänst åt gången kan vara rundfaktureringstjänsten.
  // OBS: skild från is_addon_service ("Tilläggstjänst" i prisguiden ovan).
  const [usedForAddonStations, setUsedForAddonStations] = useState(false)
  // Automatiska interna kostnader (artikelrader) per station
  const [defaultArticles, setDefaultArticles] = useState<{ article_id: string; quantity_per_unit: number }[]>([])
  const [allArticles, setAllArticles] = useState<Article[]>([])
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
      setRotEligible(service.rot_eligible ?? false)
      setRutEligible(service.rut_eligible ?? false)
      setRotRatePercent(service.rot_rate_percent != null ? String(service.rot_rate_percent) : '')
      setRutRatePercent(service.rut_rate_percent != null ? String(service.rut_rate_percent) : '')
      setIsContractService(service.is_contract_service ?? false)
      setUsedForAddonStations(service.used_for_addon_stations ?? false)
      setDefaultArticles([])
      if (service.used_for_addon_stations) {
        AddonStationBillingService.getDefaultArticles(service.id)
          .then(rows => setDefaultArticles(rows.map(r => ({ article_id: r.article_id, quantity_per_unit: r.quantity_per_unit }))))
          .catch(() => {})
      }
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
      setRotEligible(false)
      setRutEligible(false)
      setRotRatePercent('')
      setRutRatePercent('')
      setIsContractService(false)
      setUsedForAddonStations(false)
      setDefaultArticles([])
    }
  }, [isOpen, service, groups])

  // Ladda artikellistan när tilläggsstations-sektionen öppnas
  useEffect(() => {
    if (!isOpen || !usedForAddonStations || allArticles.length > 0) return
    ArticleService.getAllArticles()
      .then(setAllArticles)
      .catch(() => toast.error('Kunde inte ladda artiklar'))
  }, [isOpen, usedForAddonStations, allArticles.length])

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Namn är obligatoriskt'); return }
    if (!code.trim()) { toast.error('Kod är obligatorisk'); return }

    setSaving(true)
    try {
      const basePriceNum = basePrice.trim() ? parseFloat(basePrice.trim()) : null
      const rotRateNum = rotEligible && rotRatePercent.trim() ? parseFloat(rotRatePercent.trim()) : null
      const rutRateNum = rutEligible && rutRatePercent.trim() ? parseFloat(rutRatePercent.trim()) : null
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
          rot_eligible: rotEligible,
          rut_eligible: rutEligible,
          rot_rate_percent: rotRateNum,
          rut_rate_percent: rutRateNum,
          is_contract_service: isContractService,
          used_for_addon_stations: usedForAddonStations,
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
          rot_eligible: rotEligible,
          rut_eligible: rutEligible,
          rot_rate_percent: rotRateNum,
          rut_rate_percent: rutRateNum,
          is_contract_service: isContractService,
          used_for_addon_stations: usedForAddonStations,
        }
        await ServiceCatalogService.updateService(service!.id, input)
        // Spara automatiska interna kostnader (rensas när flaggan stängs av)
        await AddonStationBillingService.setDefaultArticles(
          service!.id,
          usedForAddonStations ? defaultArticles.filter(r => r.article_id) : []
        )
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
            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isContractService}
                      onChange={(e) => setIsContractService(e.target.checked)}
                      className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                    />
                    <span className="text-sm text-slate-300">Använd som avtalstyp</span>
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

              {/* ROT/RUT-inställningar */}
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                <div>
                  <span className="text-sm font-semibold text-slate-300">ROT/RUT-avdrag</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Endast arbetstidstjänster bör markeras. Avdraget gäller enligt Skatteverket.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-1">
                      <input
                        type="checkbox"
                        checked={rotEligible}
                        onChange={(e) => setRotEligible(e.target.checked)}
                        className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">ROT-kapabel</span>
                    </label>
                    {rotEligible && (
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">ROT-% (tomt = {DEFAULT_ROT_PERCENT})</label>
                        <input
                          type="number"
                          value={rotRatePercent}
                          onChange={(e) => setRotRatePercent(e.target.value)}
                          placeholder={String(DEFAULT_ROT_PERCENT)}
                          min={0}
                          max={100}
                          step="0.01"
                          className={selectClass}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-1">
                      <input
                        type="checkbox"
                        checked={rutEligible}
                        onChange={(e) => setRutEligible(e.target.checked)}
                        className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">RUT-kapabel</span>
                    </label>
                    {rutEligible && (
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">RUT-% (tomt = {DEFAULT_RUT_PERCENT})</label>
                        <input
                          type="number"
                          value={rutRatePercent}
                          onChange={(e) => setRutRatePercent(e.target.value)}
                          placeholder={String(DEFAULT_RUT_PERCENT)}
                          min={0}
                          max={100}
                          step="0.01"
                          className={selectClass}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Tilläggsstationer */}
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usedForAddonStations}
                      onChange={(e) => setUsedForAddonStations(e.target.checked)}
                      className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-700 border-slate-600"
                    />
                    <span className="text-sm font-semibold text-slate-300">Används för tilläggsstationer</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tjänsten förifylls automatiskt vid kontrollrundeavslut med antal kontrollerade
                    tilläggsstationer. Endast en tjänst åt gången kan ha denna inställning.
                  </p>
                </div>

                {usedForAddonStations && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400">
                      Automatiska interna kostnader per station (artikelrader, påverkar marginal — fakturaraden påverkas ej)
                    </p>
                    {isCreating ? (
                      <p className="text-xs text-slate-500">Spara tjänsten först, öppna sedan igen för att koppla artiklar.</p>
                    ) : (
                      <>
                        {defaultArticles.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={row.article_id}
                              onChange={(e) => setDefaultArticles(prev =>
                                prev.map((r, i) => i === idx ? { ...r, article_id: e.target.value } : r))}
                              className={`${selectClass} flex-1`}
                            >
                              <option value="">Välj artikel...</option>
                              {allArticles.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={row.quantity_per_unit}
                              onChange={(e) => setDefaultArticles(prev =>
                                prev.map((r, i) => i === idx ? { ...r, quantity_per_unit: parseFloat(e.target.value) || 1 } : r))}
                              className={`${selectClass} w-20 text-center`}
                              title="Antal per station"
                            />
                            <button
                              type="button"
                              onClick={() => setDefaultArticles(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDefaultArticles(prev => [...prev, { article_id: '', quantity_per_unit: 1 }])}
                          className="flex items-center gap-1.5 text-xs text-[#20c58f] hover:text-[#1ab07f] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Lägg till artikel
                        </button>
                      </>
                    )}
                  </div>
                )}
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
