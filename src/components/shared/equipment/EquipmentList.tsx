// src/components/shared/equipment/EquipmentList.tsx - Lista med utrustning
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  EquipmentStatus,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../../types/database'
import { formatCoordinates, openInMapsApp } from '../../../utils/equipmentMapUtils'
import {
  Crosshair,
  Box,
  Target,
  MapPin,
  Calendar,
  User,
  ExternalLink,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  Image as ImageIcon,
  MessageSquare
} from 'lucide-react'

interface EquipmentListProps {
  equipment: EquipmentPlacementWithRelations[]
  onEditEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onDeleteEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  onViewEquipment?: (equipment: EquipmentPlacementWithRelations) => void
  readOnly?: boolean
  showCustomer?: boolean
  showFilters?: boolean
}

const EQUIPMENT_TYPE_ICONS: Record<string, React.ElementType> = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

// Hjälpfunktion för att hämta typkonfiguration med fallback för dynamiska typer
function getTypeConfig(equipmentType: string) {
  const legacyConfig = EQUIPMENT_TYPE_CONFIG[equipmentType]
  if (legacyConfig) {
    return {
      color: legacyConfig.color,
      label: legacyConfig.label
    }
  }
  // Dynamisk typ - använd grå som standardfärg
  return {
    color: '#6b7280',
    label: equipmentType || 'Okänd typ'
  }
}

export function EquipmentList({
  equipment,
  onEditEquipment,
  onDeleteEquipment,
  onViewEquipment,
  readOnly = false,
  showCustomer = false,
  showFilters = true
}: EquipmentListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<EquipmentType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | 'all'>('all')

  // Filtrera utrustning
  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => {
      if (filterType !== 'all' && item.equipment_type !== filterType) return false
      if (filterStatus !== 'all' && item.status !== filterStatus) return false
      return true
    })
  }, [equipment, filterType, filterStatus])

  // Statistik
  const stats = useMemo(() => ({
    total: equipment.length,
    active: equipment.filter(e => e.status === 'active').length,
    byType: {
      mechanical_trap: equipment.filter(e => e.equipment_type === 'mechanical_trap').length,
      concrete_station: equipment.filter(e => e.equipment_type === 'concrete_station').length,
      bait_station: equipment.filter(e => e.equipment_type === 'bait_station').length
    }
  }), [equipment])

  if (equipment.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Ingen utrustning placerad ännu</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter och statistik */}
      {showFilters && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filter</span>
            </div>
            <div className="text-sm text-slate-400">
              {filteredEquipment.length} av {equipment.length} enheter
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Typfilter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EquipmentType | 'all')}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alla typer</option>
              {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => (
                <option key={type} value={type}>
                  {config.label} ({stats.byType[type as EquipmentType]})
                </option>
              ))}
            </select>

            {/* Statusfilter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as EquipmentStatus | 'all')}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alla statusar</option>
              {Object.entries(EQUIPMENT_STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Snabbstatistik */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-slate-700/50">
            {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => {
              const Icon = EQUIPMENT_TYPE_ICONS[type as EquipmentType]
              const count = stats.byType[type as EquipmentType]

              return (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: config.color }}
                  >
                    <Icon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm text-slate-300">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Utrustningslista */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredEquipment.map((item) => {
            const Icon = EQUIPMENT_TYPE_ICONS[item.equipment_type] || Box
            const typeConfig = getTypeConfig(item.equipment_type)
            const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status] || {
              bgColor: 'bg-slate-500/20',
              color: 'slate-400'
            }
            const isExpanded = expandedId === item.id

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
              >
                {/* Huvudrad */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="p-4 cursor-pointer hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Ikon */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: typeConfig.color, opacity: item.status === 'removed' ? 0.5 : 1 }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {getEquipmentTypeLabel(item.equipment_type)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} text-${statusConfig.color}`}
                        >
                          {getEquipmentStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        {item.serial_number && (
                          <span className="font-mono">{item.serial_number}</span>
                        )}
                        {showCustomer && item.customer?.company_name && (
                          <span>{item.customer.company_name}</span>
                        )}
                      </div>
                    </div>

                    {/* Indikatorer */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.photo_path && (
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                      )}
                      {item.comment && (
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanderad information */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-700/50"
                    >
                      <div className="p-4 space-y-4">
                        {/* Koordinater */}
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-slate-400">Koordinater</p>
                            <p className="text-white font-mono text-sm">
                              {formatCoordinates(item.latitude, item.longitude)}
                            </p>
                          </div>
                        </div>

                        {/* Placerad av */}
                        {item.technician?.name && (
                          <div className="flex items-start gap-3">
                            <User className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-slate-400">Placerad av</p>
                              <p className="text-white text-sm">{item.technician.name}</p>
                            </div>
                          </div>
                        )}

                        {/* Datum */}
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-slate-400">Placerad</p>
                            <p className="text-white text-sm">
                              {new Date(item.placed_at).toLocaleDateString('sv-SE', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Kommentar */}
                        {item.comment && (
                          <div className="flex items-start gap-3">
                            <MessageSquare className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-slate-400">Kommentar</p>
                              <p className="text-white text-sm">{item.comment}</p>
                            </div>
                          </div>
                        )}

                        {/* Foto */}
                        {item.photo_url && (
                          <div>
                            <p className="text-sm text-slate-400 mb-2">Foto</p>
                            <img
                              src={item.photo_url}
                              alt="Utrustningsfoto"
                              className="w-full max-w-xs rounded-lg"
                            />
                          </div>
                        )}

                        {/* Åtgärder */}
                        <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                          <button
                            onClick={() => openInMapsApp(item.latitude, item.longitude)}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Öppna i karta
                          </button>

                          {!readOnly && onEditEquipment && (
                            <button
                              onClick={() => onEditEquipment(item)}
                              className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg text-amber-400 hover:bg-amber-500/20 transition-colors text-sm"
                            >
                              <Edit className="w-4 h-4" />
                              Redigera
                            </button>
                          )}

                          {!readOnly && onDeleteEquipment && (
                            <button
                              onClick={() => onDeleteEquipment(item)}
                              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              Ta bort
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default EquipmentList
