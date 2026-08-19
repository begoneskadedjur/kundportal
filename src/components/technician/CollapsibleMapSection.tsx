// src/components/technician/CollapsibleMapSection.tsx
// Kollapsbar kartsektion med statistik

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Map as MapIcon, ChevronDown, MapPin, Home, Building2, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { EquipmentPlacementWithRelations, EQUIPMENT_TYPE_CONFIG } from '../../types/database'

// Läsbar typetikett för en placering — dynamisk stationstyp först, legacy-fallback sedan
function equipmentTypeLabel(e: EquipmentPlacementWithRelations): string {
  return e.station_type_data?.name
    || EQUIPMENT_TYPE_CONFIG[e.equipment_type as keyof typeof EQUIPMENT_TYPE_CONFIG]?.label
    || e.equipment_type
    || 'Okänd typ'
}

function equipmentTypeColor(e: EquipmentPlacementWithRelations): string {
  return e.station_type_data?.color
    || EQUIPMENT_TYPE_CONFIG[e.equipment_type as keyof typeof EQUIPMENT_TYPE_CONFIG]?.color
    || '#6b7280'
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
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const activeCount = stats.byStatus?.active || 0
  const problematicCount = (stats.byStatus?.damaged || 0) + (stats.byStatus?.missing || 0) + (stats.byStatus?.needs_service || 0)
  const removedCount = stats.byStatus?.removed || 0

  // Stationstyper som förekommer bland placeringarna — för filterchips
  const typeOptions = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>()
    equipment.forEach(e => {
      const label = equipmentTypeLabel(e)
      if (!map.has(label)) map.set(label, { label, color: equipmentTypeColor(e) })
    })
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'))
  }, [equipment])

  const filteredEquipment = useMemo(
    () => typeFilter ? equipment.filter(e => equipmentTypeLabel(e) === typeFilter) : equipment,
    [equipment, typeFilter]
  )

  const filterChips = typeOptions.length > 1 && (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-slate-900/40 border-b border-slate-700/50">
      <button
        onClick={() => setTypeFilter(null)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          typeFilter === null
            ? 'bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/50'
            : 'bg-slate-800/70 text-slate-400 border border-slate-700/50 hover:text-white'
        }`}
      >
        Alla ({equipment.length})
      </button>
      {typeOptions.map(t => (
        <button
          key={t.label}
          onClick={() => setTypeFilter(typeFilter === t.label ? null : t.label)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            typeFilter === t.label
              ? 'bg-[#20c58f]/15 text-[#20c58f] border border-[#20c58f]/50'
              : 'bg-slate-800/70 text-slate-400 border border-slate-700/50 hover:text-white'
          }`}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
          {t.label}
        </button>
      ))}
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
        </div>

        {/* Höger: Karta */}
        <div className="relative flex flex-col">
          {filterChips}
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

              {/* Karta */}
              <div className="border-t border-slate-700/50">
                {filterChips}
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
