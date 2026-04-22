// src/components/admin/settings/PriceListItemsEditor.tsx
// Kompakt tabell-editor för tjänstepriser i en prislista.
// Användare kan sätta ett fast kundpris per tjänst; saknat pris → prisguiden
// (PriceCalculatorPanel) används som fallback vid fakturering.

import { useState, useEffect, useMemo } from 'react'
import {
  Loader2,
  Search,
  Check,
  X,
  RotateCcw,
  Percent
} from 'lucide-react'
import { PriceListService } from '../../../services/priceListService'
import {
  PriceListItemWithService,
  formatArticlePrice
} from '../../../types/articles'
import { ServiceWithGroup } from '../../../types/services'
import toast from 'react-hot-toast'

interface PriceListItemsEditorProps {
  priceListId: string
  services: ServiceWithGroup[]
  onUpdate: () => void
}

type PriceMode = 'guide' | 'fixed'

interface ServicePriceState {
  mode: PriceMode
  customPrice: string
  isSaving: boolean
  savedAt: number | null
  isDirty: boolean
  originalMode: PriceMode
  originalCustomPrice: string
}

export function PriceListItemsEditor({
  priceListId,
  services,
  onUpdate
}: PriceListItemsEditorProps) {
  const [items, setItems] = useState<PriceListItemWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [priceStates, setPriceStates] = useState<Record<string, ServicePriceState>>({})

  // Selection & bulk markup
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [markupPercent, setMarkupPercent] = useState<string>('')
  const [appliedMarkup, setAppliedMarkup] = useState<string | null>(null)
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [bulkMode, setBulkMode] = useState<'percent' | 'fixed'>('percent')
  const [bulkFixedPrice, setBulkFixedPrice] = useState<string>('')

  // Ladda tjänstepriser
  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceListId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await PriceListService.getPriceListServiceItems(priceListId)
      setItems(data)

      const initialStates: Record<string, ServicePriceState> = {}
      data.forEach(item => {
        if (item.service_id && item.custom_price !== null) {
          initialStates[item.service_id] = {
            mode: 'fixed',
            customPrice: item.custom_price.toString(),
            isSaving: false,
            savedAt: null,
            isDirty: false,
            originalMode: 'fixed',
            originalCustomPrice: item.custom_price.toString()
          }
        }
      })
      setPriceStates(initialStates)
    } catch (error) {
      console.error('Fel vid laddning:', error)
      toast.error('Kunde inte ladda tjänstepriser')
    } finally {
      setLoading(false)
    }
  }

  // Unika grupper för filter
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    services.forEach(s => {
      if (s.group) map.set(s.group.id, { id: s.group.id, name: s.group.name })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [services])

  // Filtrera tjänster
  const filteredServices = useMemo(() => {
    let list = services
    if (groupFilter !== 'all') {
      list = list.filter(s => s.group_id === groupFilter)
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      list = list.filter(s =>
        s.code.toLowerCase().includes(search) ||
        s.name.toLowerCase().includes(search) ||
        (s.group?.name.toLowerCase().includes(search) ?? false)
      )
    }
    return list
  }, [services, searchTerm, groupFilter])

  // Selection helpers
  const toggleSelection = (serviceId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(serviceId)) next.delete(serviceId)
      else next.add(serviceId)
      return next
    })
  }

  const isAllSelected = filteredServices.length > 0 && filteredServices.every(s => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredServices.map(s => s.id)))
  }

  const isSomeSelected = selectedIds.size > 0

  // Bulk markup — applicera på tjänstens base_price
  const applyBulkMarkup = () => {
    const markup = parseFloat(markupPercent)
    if (isNaN(markup)) return

    const newStates = { ...priceStates }
    let affected = 0

    for (const serviceId of selectedIds) {
      const service = services.find(s => s.id === serviceId)
      if (!service || service.base_price === null || service.base_price === 0) continue

      const calculatedPrice = Math.round(service.base_price * (1 + markup / 100))
      const currentState = newStates[serviceId]
      const originalMode = currentState?.originalMode || 'guide'
      const originalCustomPrice = currentState?.originalCustomPrice || ''

      newStates[serviceId] = {
        mode: 'fixed',
        customPrice: calculatedPrice.toString(),
        isSaving: false,
        savedAt: null,
        isDirty: true,
        originalMode,
        originalCustomPrice
      }
      affected++
    }

    setPriceStates(newStates)
    setAppliedMarkup(markup.toString())
    if (affected === 0) {
      toast.error('Valda tjänster saknar base_price — inget pris kunde räknas')
    } else {
      toast.success(`Påslag +${markup}% på ${affected} tjänst${affected === 1 ? '' : 'er'}`)
    }
    setSelectedIds(new Set())
    setMarkupPercent('')
  }

  // Bulk fast pris — sätt samma kr-belopp på alla markerade tjänster
  const applyBulkFixedPrice = () => {
    const price = parseFloat(bulkFixedPrice)
    if (isNaN(price) || price < 0) {
      toast.error('Ange ett giltigt pris (0 eller högre)')
      return
    }

    const priceStr = Math.round(price).toString()
    const newStates = { ...priceStates }
    let affected = 0

    for (const serviceId of selectedIds) {
      const currentState = newStates[serviceId]
      const originalMode = currentState?.originalMode || 'guide'
      const originalCustomPrice = currentState?.originalCustomPrice || ''

      newStates[serviceId] = {
        mode: 'fixed',
        customPrice: priceStr,
        isSaving: false,
        savedAt: null,
        isDirty: true,
        originalMode,
        originalCustomPrice
      }
      affected++
    }

    setPriceStates(newStates)
    toast.success(`Fast pris ${priceStr} kr satt på ${affected} tjänst${affected === 1 ? '' : 'er'}`)
    setSelectedIds(new Set())
    setBulkFixedPrice('')
  }

  // Spara pris till databas
  const confirmPrice = async (serviceId: string) => {
    const state = priceStates[serviceId]
    if (!state) return

    setPriceStates(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], isSaving: true }
    }))

    try {
      if (state.mode === 'guide') {
        await PriceListService.removePriceListServiceItem(priceListId, serviceId)
        setPriceStates(prev => {
          const next = { ...prev }
          delete next[serviceId]
          return next
        })
        toast.success('Fast pris borttaget – prisguiden används')
      } else {
        const price = parseFloat(state.customPrice)
        if (isNaN(price) || price < 0) {
          toast.error('Ogiltigt pris')
          setPriceStates(prev => ({
            ...prev,
            [serviceId]: { ...prev[serviceId], isSaving: false }
          }))
          return
        }
        await PriceListService.upsertPriceListServiceItem({
          price_list_id: priceListId,
          service_id: serviceId,
          custom_price: price
        })
        setPriceStates(prev => ({
          ...prev,
          [serviceId]: {
            ...prev[serviceId],
            isSaving: false,
            savedAt: Date.now(),
            isDirty: false,
            originalMode: 'fixed',
            originalCustomPrice: state.customPrice
          }
        }))
        toast.success('Pris sparat')
      }

      setTimeout(() => {
        setPriceStates(prev => ({
          ...prev,
          [serviceId]: prev[serviceId] ? { ...prev[serviceId], savedAt: null } : prev[serviceId]
        }))
      }, 2000)

      loadItems()
      onUpdate()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error('Kunde inte spara priset')
      setPriceStates(prev => ({
        ...prev,
        [serviceId]: { ...prev[serviceId], isSaving: false }
      }))
    }
  }

  // Återställ till senast sparade
  const resetPrice = (serviceId: string) => {
    const state = priceStates[serviceId]
    if (!state) return

    if (state.originalMode === 'guide') {
      setPriceStates(prev => {
        const next = { ...prev }
        delete next[serviceId]
        return next
      })
    } else {
      setPriceStates(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId],
          mode: 'fixed',
          customPrice: state.originalCustomPrice,
          isDirty: false
        }
      }))
    }
  }

  const handleModeChange = (serviceId: string, service: ServiceWithGroup, newMode: PriceMode) => {
    const currentState = priceStates[serviceId]
    const originalMode = currentState?.originalMode || 'guide'
    const originalCustomPrice = currentState?.originalCustomPrice || ''

    let newCustomPrice = currentState?.customPrice || ''
    if (newMode === 'fixed' && !newCustomPrice) {
      newCustomPrice = service.base_price?.toString() || '0'
    }

    const isDirty = newMode !== originalMode ||
      (newMode === 'fixed' && newCustomPrice !== originalCustomPrice)

    setPriceStates(prev => ({
      ...prev,
      [serviceId]: {
        mode: newMode,
        customPrice: newCustomPrice,
        isSaving: false,
        savedAt: null,
        isDirty,
        originalMode,
        originalCustomPrice
      }
    }))
  }

  const handlePriceChange = (serviceId: string, value: string) => {
    const currentState = priceStates[serviceId]
    if (!currentState) return

    const isDirty = value !== currentState.originalCustomPrice ||
                    currentState.mode !== currentState.originalMode

    setPriceStates(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        customPrice: value,
        isDirty
      }
    }))
  }

  // Statistik
  const stats = useMemo(() => {
    let fixedCount = 0
    let dirtyCount = 0
    Object.values(priceStates).forEach(state => {
      if (state.mode === 'fixed' && !state.isDirty) fixedCount++
      if (state.isDirty) dirtyCount++
    })
    return { fixedCount, dirtyCount }
  }, [priceStates])

  // Bulk-spara alla osparade
  const confirmAllDirty = async () => {
    const dirtyEntries = Object.entries(priceStates).filter(([_, s]) => s.isDirty)
    if (dirtyEntries.length === 0) return

    setIsBulkSaving(true)
    try {
      const removals: string[] = []
      const upserts: { price_list_id: string; service_id: string; custom_price: number }[] = []

      for (const [serviceId, state] of dirtyEntries) {
        if (state.mode === 'guide') {
          removals.push(serviceId)
        } else {
          const price = parseFloat(state.customPrice)
          if (isNaN(price) || price < 0) continue
          upserts.push({
            price_list_id: priceListId,
            service_id: serviceId,
            custom_price: price
          })
        }
      }

      for (const serviceId of removals) {
        await PriceListService.removePriceListServiceItem(priceListId, serviceId)
      }
      if (upserts.length > 0) {
        await PriceListService.bulkUpsertServiceItems(upserts)
      }

      setPriceStates(prev => {
        const next = { ...prev }
        for (const [serviceId, state] of dirtyEntries) {
          if (state.mode === 'guide') {
            delete next[serviceId]
          } else {
            next[serviceId] = {
              ...next[serviceId],
              isSaving: false,
              savedAt: Date.now(),
              isDirty: false,
              originalMode: 'fixed',
              originalCustomPrice: state.customPrice
            }
          }
        }
        return next
      })

      const total = removals.length + upserts.length
      toast.success(`${total} pris${total > 1 ? 'er' : ''} sparade`)
      setAppliedMarkup(null)

      setTimeout(() => {
        setPriceStates(prev => {
          const next = { ...prev }
          for (const [serviceId] of dirtyEntries) {
            if (next[serviceId]) {
              next[serviceId] = { ...next[serviceId], savedAt: null }
            }
          }
          return next
        })
      }, 2000)

      loadItems()
      onUpdate()
    } catch (error) {
      console.error('Fel vid batch-sparande:', error)
      toast.error('Kunde inte spara priserna')
    } finally {
      setIsBulkSaving(false)
    }
  }

  const resetAllDirty = () => {
    const dirty = Object.entries(priceStates).filter(([_, s]) => s.isDirty).map(([id]) => id)
    dirty.forEach(id => resetPrice(id))
    setAppliedMarkup(null)
  }

  const getRowClass = (mode: PriceMode, isDirty: boolean) => {
    if (isDirty) return 'border-l-2 border-amber-400 bg-amber-500/10'
    if (mode === 'fixed') return 'border-l-2 border-[#20c58f] bg-[#20c58f]/5'
    return ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#20c58f] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Sök + gruppfilter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Sök tjänst..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        >
          <option value="all">Alla grupper</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Bulk-toolbar */}
      {isSomeSelected && (
        <div className="mb-3 p-3 bg-slate-800/50 border border-[#20c58f]/30 rounded-xl flex flex-wrap items-center gap-2">
          <span className="text-sm text-white font-medium">
            {selectedIds.size} tjänst{selectedIds.size > 1 ? 'er' : ''} markerade
          </span>
          <div className="h-5 w-px bg-slate-700" />
          {/* Mode-toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg p-0.5">
            <button
              onClick={() => setBulkMode('percent')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                bulkMode === 'percent'
                  ? 'bg-[#20c58f] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              % Påslag
            </button>
            <button
              onClick={() => setBulkMode('fixed')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                bulkMode === 'fixed'
                  ? 'bg-[#20c58f] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              kr Fast pris
            </button>
          </div>
          <div className="h-5 w-px bg-slate-700" />

          {bulkMode === 'percent' ? (
            <>
              {[10, 15, 20, 25].map(pct => (
                <button
                  key={pct}
                  onClick={() => setMarkupPercent(pct.toString())}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    markupPercent === pct.toString()
                      ? 'bg-[#20c58f] text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  +{pct}%
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(e.target.value)}
                  placeholder="Annat"
                  min="-50"
                  max="500"
                  step="1"
                  className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
              <button
                onClick={applyBulkMarkup}
                disabled={markupPercent === ''}
                className="px-4 py-1.5 bg-[#20c58f] hover:bg-[#1ab07d] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Percent className="w-3.5 h-3.5" />
                Sätt pris
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={bulkFixedPrice}
                  onChange={(e) => setBulkFixedPrice(e.target.value)}
                  placeholder="Pris i kr"
                  min="0"
                  step="1"
                  className="w-28 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                />
                <span className="text-xs text-slate-500">kr</span>
              </div>
              <button
                onClick={applyBulkFixedPrice}
                disabled={bulkFixedPrice === ''}
                className="px-4 py-1.5 bg-[#20c58f] hover:bg-[#1ab07d] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Sätt pris
              </button>
            </>
          )}

          <button
            onClick={() => { setSelectedIds(new Set()); setMarkupPercent(''); setBulkFixedPrice('') }}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors ml-auto"
          >
            Avmarkera alla
          </button>
        </div>
      )}

      {/* Tabell */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">

          {/* MOBIL */}
          <div className="md:hidden divide-y divide-slate-700/30">
            {filteredServices.length === 0 ? (
              <div className="px-3 py-8 text-center text-slate-500">
                {searchTerm || groupFilter !== 'all' ? 'Inga tjänster matchar filtren' : 'Inga tjänster tillgängliga'}
              </div>
            ) : (
              filteredServices.map(service => {
                const state = priceStates[service.id]
                const mode: PriceMode = state?.mode || 'guide'
                const isDirty = state?.isDirty || false
                const isSaving = state?.isSaving
                const rowClass = getRowClass(mode, isDirty)
                const isSelected = selectedIds.has(service.id)
                const basePrice = service.base_price

                return (
                  <div key={service.id} className={`p-3 ${rowClass}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(service.id)}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-[#20c58f] focus:ring-[#20c58f] flex-shrink-0"
                        />
                        <code className="text-xs font-mono text-slate-400 flex-shrink-0">{service.code}</code>
                        <span className="text-sm text-white truncate">{service.name}</span>
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        Grundpris: {basePrice !== null ? formatArticlePrice(basePrice) : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={mode}
                        onChange={(e) => handleModeChange(service.id, service, e.target.value as PriceMode)}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] min-h-[44px]"
                      >
                        <option value="guide">Prisguide</option>
                        <option value="fixed">Fast pris</option>
                      </select>

                      {mode === 'fixed' && (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number"
                            value={state?.customPrice || ''}
                            onChange={(e) => handlePriceChange(service.id, e.target.value)}
                            min="0" step="1"
                            className="flex-1 min-w-0 px-2 py-1.5 bg-slate-900 border border-[#20c58f]/50 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-[#20c58f] min-h-[44px]"
                          />
                          <span className="text-xs text-slate-500">kr</span>
                        </div>
                      )}

                      {isDirty && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => confirmPrice(service.id)} disabled={isSaving} className="p-2 rounded bg-[#20c58f] hover:bg-[#1ab07d] text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => resetPrice(service.id)} className="p-2 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* DESKTOP */}
          <table className="w-full hidden md:table">
            <thead className="bg-slate-900/80 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Kod</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tjänst</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Grupp</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Grundpris</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Diff</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Läge</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Kundpris</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    {searchTerm || groupFilter !== 'all' ? 'Inga tjänster matchar filtren' : 'Inga tjänster tillgängliga'}
                  </td>
                </tr>
              ) : (
                filteredServices.map(service => {
                  const state = priceStates[service.id]
                  const mode: PriceMode = state?.mode || 'guide'
                  const isDirty = state?.isDirty || false
                  const isSaving = state?.isSaving
                  const justSaved = state?.savedAt && Date.now() - state.savedAt < 2000
                  const isSelected = selectedIds.has(service.id)
                  const basePrice = service.base_price
                  const rowClass = getRowClass(mode, isDirty)

                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-slate-800/30 transition-colors ${rowClass}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(service.id)}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                        />
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <code className="text-xs font-mono text-slate-400">{service.code}</code>
                      </td>

                      <td className="px-3 py-2">
                        <span className="text-sm text-white truncate block max-w-[220px]" title={service.name}>
                          {service.name}
                        </span>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        {service.group ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${service.group.color}20`,
                              color: service.group.color
                            }}
                          >
                            {service.group.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className="text-sm text-slate-500">
                          {basePrice !== null ? formatArticlePrice(basePrice) : '—'}
                        </span>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {(() => {
                          if (mode === 'guide' || basePrice === null || basePrice === 0) {
                            return <span className="text-sm text-slate-500">—</span>
                          }
                          const customerPrice = parseFloat(state?.customPrice || '0')
                          const diff = customerPrice - basePrice
                          const pct = ((customerPrice / basePrice) - 1) * 100
                          const color = diff > 0 ? 'text-[#20c58f]' : diff < 0 ? 'text-amber-400' : 'text-slate-500'
                          const sign = diff > 0 ? '+' : ''
                          return (
                            <span className={`text-sm ${color}`}>
                              {sign}{Math.round(diff)} kr ({sign}{pct.toFixed(1)}%)
                            </span>
                          )
                        })()}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <select
                          value={mode}
                          onChange={(e) => handleModeChange(service.id, service, e.target.value as PriceMode)}
                          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                        >
                          <option value="guide">Prisguide</option>
                          <option value="fixed">Fast pris (kr)</option>
                        </select>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {mode === 'guide' && (
                            <span className="text-sm text-slate-400 italic">Prisguide används</span>
                          )}

                          {mode === 'fixed' && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={state?.customPrice || ''}
                                onChange={(e) => handlePriceChange(service.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && isDirty) confirmPrice(service.id)
                                  else if (e.key === 'Escape') resetPrice(service.id)
                                }}
                                min="0"
                                step="1"
                                className="w-24 px-2 py-1 bg-slate-900 border border-[#20c58f]/50 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                              />
                              <span className="text-xs text-slate-500">kr</span>
                            </div>
                          )}

                          {isDirty && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => confirmPrice(service.id)}
                                disabled={isSaving}
                                className="p-1.5 rounded bg-[#20c58f] hover:bg-[#1ab07d] text-white transition-colors disabled:opacity-50"
                                title="Bekräfta (Enter)"
                              >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => resetPrice(service.id)}
                                className="p-1.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors"
                                title="Ångra (Escape)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {!isDirty && justSaved && !isSaving && (
                            <div className="w-5 ml-2">
                              <Check className="w-4 h-4 text-[#20c58f]" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sammanfattning */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            {services.length} tjänster
            {stats.fixedCount > 0 && (
              <span className="ml-2">
                • <span className="text-[#20c58f]">{stats.fixedCount} med fast pris</span>
              </span>
            )}
          </span>

          {appliedMarkup && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#20c58f]/15 border border-[#20c58f]/30 rounded-lg text-[#20c58f] text-xs font-medium">
              <Percent className="w-3 h-3" />
              Påslag {parseFloat(appliedMarkup) >= 0 ? '+' : ''}{appliedMarkup}% applicerat
            </span>
          )}
        </div>

        {stats.dirtyCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-amber-400">
              {stats.dirtyCount} osparad{stats.dirtyCount > 1 ? 'e' : ''} ändring{stats.dirtyCount > 1 ? 'ar' : ''}
            </span>
            <button
              onClick={confirmAllDirty}
              disabled={isBulkSaving}
              className="px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ab07d] text-white text-sm rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isBulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isBulkSaving ? 'Sparar...' : 'Spara alla'}
            </button>
            <button
              onClick={resetAllDirty}
              disabled={isBulkSaving}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              Ångra alla
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
