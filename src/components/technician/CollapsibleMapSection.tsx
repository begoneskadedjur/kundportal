// src/components/technician/CollapsibleMapSection.tsx
// Kollapsbar kartsektion med statistik

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Map as MapIcon, ChevronDown, MapPin, Home, Building2, CheckCircle2, AlertTriangle, AlertCircle, SlidersHorizontal } from 'lucide-react'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { EquipmentPlacementWithRelations, EQUIPMENT_TYPE_CONFIG } from '../../types/database'
import { StationTypeService } from '../../services/stationTypeService'
import type { StationType } from '../../types/stationTypes'

// Normaliserad typinfo för en placering. equipment_type innehåller historiskt
// en blandning av koder ('betesstation', 'mekanisk_falla') och visningsnamn
// ('Betongstation') — matcha mot station_types via både code och name (gemener)
// så samma typ inte dyker upp flera gånger i filtret.
function resolveTypeInfo(
  e: EquipmentPlacementWithRelations,
  lookup: Map<string, { label: string; color: string }>
): { key: string; label: string; color: string } {
  if (e.station_type_data) {
    return {
      key: e.station_type_data.name.toLowerCase(),
      label: e.station_type_data.name,
      color: e.station_type_data.color
    }
  }
  const raw = (e.equipment_type || '').toLowerCase()
  const matched = lookup.get(raw)
  if (matched) {
    return { key: matched.label.toLowerCase(), label: matched.label, color: matched.color }
  }
  const legacy = EQUIPMENT_TYPE_CONFIG[e.equipment_type as keyof typeof EQUIPMENT_TYPE_CONFIG]
  if (legacy) {
    return { key: legacy.label.toLowerCase(), label: legacy.label, color: legacy.color }
  }
  return { key: raw || 'okänd', label: e.equipment_type || 'Okänd typ', color: '#6b7280' }
}

interface CollapsibleMapSectionProps {
  equipment: EquipmentPlacementWithRelations[]
  stats: {
    total: number
    outdoor: number
    indoor: number
    byStatus: Record<string, number>
    customerCount: number
  }
  onEquipmentClick?: (equipment: EquipmentPlacementWithRelations) => void
  defaultExpanded?: boolean
  className?: string
}

export function CollapsibleMapSection({
  equipment,
  stats,
  onEquipmentClick,
  defaultExpanded = true,
  className = ''
}: CollapsibleMapSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  const [stationTypes, setStationTypes] = useState<StationType[]>([])
  const [hiddenTypeKeys, setHiddenTypeKeys] = useState<Set<string>>(new Set())
  const [hiddenCustomerIds, setHiddenCustomerIds] = useState<Set<string>>(new Set())

  const activeCount = stats.byStatus?.active || 0
  const problematicCount = (stats.byStatus?.damaged || 0) + (stats.byStatus?.missing || 0) + (stats.byStatus?.needs_service || 0)
  const removedCount = stats.byStatus?.removed || 0

  // Stationstyper för normalisering av legacy-värden i equipment_type
  useEffect(() => {
    StationTypeService.getActiveStationTypes()
      .then(setStationTypes)
      .catch(err => console.error('Kunde inte hämta stationstyper:', err))
  }, [])

  const typeLookup = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>()
    stationTypes.forEach(t => {
      map.set(t.code.toLowerCase(), { label: t.name, color: t.color })
      map.set(t.name.toLowerCase(), { label: t.name, color: t.color })
    })
    return map
  }, [stationTypes])

  // Typer som förekommer bland placeringarna, normaliserade och med antal
  const typeOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; color: string; count: number }>()
    equipment.forEach(e => {
      const info = resolveTypeInfo(e, typeLookup)
      const existing = map.get(info.key)
      if (existing) existing.count++
      else map.set(info.key, { ...info, count: 1 })
    })
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'))
  }, [equipment, typeLookup])

  // Kunder som förekommer bland placeringarna, med antal
  const customerOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    equipment.forEach(e => {
      if (!e.customer_id) return
      const existing = map.get(e.customer_id)
      if (existing) existing.count++
      else map.set(e.customer_id, { id: e.customer_id, name: e.customer?.company_name || 'Okänd kund', count: 1 })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [equipment])

  const filteredEquipment = useMemo(
    () => equipment.filter(e =>
      !hiddenTypeKeys.has(resolveTypeInfo(e, typeLookup).key) &&
      (!e.customer_id || !hiddenCustomerIds.has(e.customer_id))
    ),
    [equipment, typeLookup, hiddenTypeKeys, hiddenCustomerIds]
  )

  const toggleInSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  const hasActiveFilter = hiddenTypeKeys.size > 0 || hiddenCustomerIds.size > 0
  const showFilterPanel = typeOptions.length > 1 || customerOptions.length > 1

  // Filterpanel med kryssrader — används i statistikkolumnen (desktop)
  // och i den kollapsbara sektionen (mobil)
  const filterPanel = showFilterPanel && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Visa på kartan
        </p>
        {hasActiveFilter && (
          <button
            onClick={() => { setHiddenTypeKeys(new Set()); setHiddenCustomerIds(new Set()) }}
            className="text-xs text-[#20c58f] hover:text-[#1ab07f] transition-colors"
          >
            Visa allt
          </button>
        )}
      </div>

      {typeOptions.length > 1 && (
        <div className="space-y-0.5">
          {typeOptions.map(t => (
            <label
              key={t.key}
              className="flex items-center gap-2.5 px-1.5 py-1 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={!hiddenTypeKeys.has(t.key)}
                onChange={() => setHiddenTypeKeys(prev => toggleInSet(prev, t.key))}
                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0"
              />
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              <span className={`text-sm flex-1 min-w-0 truncate ${hiddenTypeKeys.has(t.key) ? 'text-slate-500' : 'text-slate-300'}`}>
                {t.label}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">{t.count}</span>
            </label>
          ))}
        </div>
      )}

      {customerOptions.length > 1 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1 px-1.5">Kunder</p>
          <div className="space-y-0.5 max-h-44 overflow-y-auto">
            {customerOptions.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!hiddenCustomerIds.has(c.id)}
                  onChange={() => setHiddenCustomerIds(prev => toggleInSet(prev, c.id))}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0"
                />
                <span className={`text-sm flex-1 min-w-0 truncate ${hiddenCustomerIds.has(c.id) ? 'text-slate-500' : 'text-slate-300'}`}>
                  {c.name}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">{c.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={`bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden ${className}`}>
      {/* Desktop: Split layout (50/50) */}
      <div className="hidden md:grid md:grid-cols-2 gap-0">
        {/* Vänster: Statistik */}
        <div className="p-5 border-r border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Utplacerat av mig</h3>
          </div>

          {/* Totalt */}
          <div className="mb-4">
            <p className="text-4xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-slate-400">stationer totalt</p>
          </div>

          {/* Utomhus / Inomhus */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-white font-medium">{stats.outdoor}</span>
              <span className="text-slate-400 text-sm">ute</span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-medium">{stats.indoor}</span>
              <span className="text-slate-400 text-sm">inne</span>
            </div>
          </div>

          {/* Statusfördelning */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-300">Aktiva</span>
              <span className="text-sm font-medium text-emerald-400">{activeCount}</span>
            </div>
            {problematicCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-slate-300">Kräver åtgärd</span>
                <span className="text-sm font-medium text-amber-400">{problematicCount}</span>
              </div>
            )}
            {removedCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Borttagna</span>
                <span className="text-sm font-medium text-slate-400">{removedCount}</span>
              </div>
            )}
          </div>

          {/* Antal kunder */}
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">
                <span className="text-white font-medium">{stats.customerCount}</span> kunder med stationer
              </span>
            </div>
          </div>

          {/* Kartfilter */}
          {filterPanel && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              {filterPanel}
            </div>
          )}
        </div>

        {/* Höger: Karta */}
        <div className="relative">
          {equipment.length > 0 ? (
            <EquipmentMap
              equipment={filteredEquipment}
              onEquipmentClick={onEquipmentClick}
              height="300px"
              showControls={true}
              readOnly={true}
              enableClustering={true}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-slate-900/30">
              <div className="text-center">
                <MapIcon className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Inga utomhusstationer att visa</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Kollapsbar sektion */}
      <div className="md:hidden">
        {/* Header - alltid synlig */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <MapIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-left">
              <span className="font-medium text-white">Kartvy</span>
              <span className="ml-2 text-slate-400 text-sm">({stats.outdoor} stationer)</span>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-slate-400" />
          </motion.div>
        </button>

        {/* Expanderbart innehåll */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Kompakt statistik */}
              <div className="px-4 pb-3 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">{activeCount}</span>
                  <span className="text-slate-500">aktiva</span>
                </div>
                {problematicCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 font-medium">{problematicCount}</span>
                    <span className="text-slate-500">åtgärd</span>
                  </div>
                )}
              </div>

              {/* Kartfilter (mobil) — bakom en toggle för att spara yta */}
              {filterPanel && (
                <div className="border-t border-slate-700/50">
                  <button
                    onClick={() => setShowMobileFilter(!showMobileFilter)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-sm text-slate-300"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                      Filter
                      {hasActiveFilter && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMobileFilter ? 'rotate-180' : ''}`} />
                  </button>
                  {showMobileFilter && (
                    <div className="px-4 pb-3">
                      {filterPanel}
                    </div>
                  )}
                </div>
              )}

              {/* Karta */}
              <div className="border-t border-slate-700/50">
                {equipment.length > 0 ? (
                  <EquipmentMap
                    equipment={filteredEquipment}
                    onEquipmentClick={onEquipmentClick}
                    height="200px"
                    showControls={false}
                    readOnly={true}
                    enableClustering={true}
                  />
                ) : (
                  <div className="h-[200px] flex items-center justify-center bg-slate-900/30">
                    <div className="text-center">
                      <MapIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">Inga stationer att visa</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Enkel statistikkort för att visa i grid
export function StatsCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'emerald'
}: {
  icon: React.ElementType
  label: string
  value: number | string
  subtext?: string
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'slate'
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
    slate: 'bg-slate-500/10 text-slate-400'
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  )
}

export default CollapsibleMapSection
