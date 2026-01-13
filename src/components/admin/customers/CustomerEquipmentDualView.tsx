// src/components/admin/customers/CustomerEquipmentDualView.tsx
// 50/50 dual-view for equipment: Map (left) + List (right) on desktop, stacked on mobile
// Uppdaterad: Klick på kartmarkör highlightar och expanderar rad i listan istället för EquipmentDetailSheet
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { EquipmentService } from '../../../services/equipmentService'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../../types/database'
import { formatCoordinates, openInMapsApp } from '../../../utils/equipmentMapUtils'
import { Loader2, MapPin, Crosshair, Box, Target, AlertCircle, Calendar, User, ExternalLink, MessageSquare, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Import EquipmentMap direkt för att kunna skicka onEquipmentClick
import { EquipmentMap } from '../../shared/equipment'

interface CustomerEquipmentDualViewProps {
  customerId: string
  customerName: string
}

// Icons for equipment types
const EQUIPMENT_TYPE_ICONS = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export default function CustomerEquipmentDualView({
  customerId,
  customerName
}: CustomerEquipmentDualViewProps) {
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State för vald/expanderad utrustning (synkroniserad mellan karta och lista)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Fetch equipment on mount
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await EquipmentService.getEquipmentByCustomer(customerId)
        setEquipment(data)
      } catch (err) {
        console.error('Error fetching equipment:', err)
        setError('Kunde inte ladda utrustning. Försök igen.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEquipment()
  }, [customerId])

  // Calculate stats per type
  const stats = useMemo(() => {
    const byType = {
      mechanical_trap: 0,
      concrete_station: 0,
      bait_station: 0
    }
    const byStatus = {
      active: 0,
      removed: 0,
      missing: 0
    }

    equipment.forEach(item => {
      if (item.equipment_type in byType) {
        byType[item.equipment_type as keyof typeof byType]++
      }
      if (item.status in byStatus) {
        byStatus[item.status as keyof typeof byStatus]++
      }
    })

    return { total: equipment.length, byType, byStatus }
  }, [equipment])

  // Hantera klick på kartmarkör - scrolla till och highlighta motsvarande rad i listan
  const handleEquipmentClick = useCallback((item: EquipmentPlacementWithRelations) => {
    setSelectedEquipmentId(item.id)

    // Scrolla till elementet i listan med en liten fördröjning så att DOM hinner uppdateras
    setTimeout(() => {
      const element = itemRefs.current.get(item.id)
      if (element && listContainerRef.current) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }, 100)
  }, [])

  // Sätt ref för ett list-item
  const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(id, el)
    } else {
      itemRefs.current.delete(id)
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-slate-400 text-sm">Laddar utrustning...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-16 bg-red-500/10 rounded-xl border border-red-500/30">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
          >
            Ladda om sidan
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (equipment.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <MapPin className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400 text-lg mb-2">Ingen utrustning placerad</p>
        <p className="text-slate-500 text-sm text-center max-w-md">
          Det finns ingen registrerad utrustning hos {customerName} ännu.
          Utrustning registreras av tekniker vid servicebesök.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Totalt</span>
          </div>
          <div className="text-xl font-semibold text-white">{stats.total}</div>
          <div className="text-xs text-slate-500">
            {stats.byStatus.active} aktiva
          </div>
        </div>

        {/* Per type */}
        {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => {
          const Icon = EQUIPMENT_TYPE_ICONS[type as keyof typeof EQUIPMENT_TYPE_ICONS]
          const count = stats.byType[type as keyof typeof stats.byType]

          return (
            <div
              key={type}
              className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: config.color }}
                >
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-slate-400 truncate">{config.label}</span>
              </div>
              <div className="text-xl font-semibold text-white">{count}</div>
            </div>
          )
        })}
      </div>

      {/* Dual View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Map (Left on Desktop, Top on Mobile) */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-3 border-b border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Kartvy
            </h4>
          </div>
          {/* Kart-container med korrekt border-radius och overflow för att fylla hela boxen */}
          <div className="h-[300px] lg:h-[400px] overflow-hidden">
            <EquipmentMap
              equipment={equipment}
              height="100%"
              readOnly={true}
              enableClustering={false}
              showControls={true}
              onEquipmentClick={handleEquipmentClick}
            />
          </div>
        </div>

        {/* List (Right on Desktop, Bottom on Mobile) */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-700/50 flex-shrink-0">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Utrustningslista
              <span className="ml-auto text-xs text-slate-500 font-normal">
                {equipment.length} enheter
              </span>
            </h4>
          </div>
          {/* Inline utrustningslista med klickbar expandering */}
          <div
            ref={listContainerRef}
            className="h-[300px] lg:h-[400px] overflow-y-auto p-3 space-y-2"
          >
            {equipment.map((item) => {
              const Icon = EQUIPMENT_TYPE_ICONS[item.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS]
              const typeConfig = EQUIPMENT_TYPE_CONFIG[item.equipment_type]
              const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status]
              const isSelected = selectedEquipmentId === item.id

              return (
                <div
                  key={item.id}
                  ref={(el) => setItemRef(item.id, el)}
                  className={`
                    rounded-lg border transition-all duration-200 overflow-hidden
                    ${isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80'
                    }
                  `}
                >
                  {/* Huvudrad - klickbar */}
                  <div
                    onClick={() => setSelectedEquipmentId(isSelected ? null : item.id)}
                    className="p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {/* Ikon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: typeConfig.color, opacity: item.status === 'removed' ? 0.5 : 1 }}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-white text-sm">
                            {getEquipmentTypeLabel(item.equipment_type)}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${statusConfig.bgColor}`}
                            style={{ color: statusConfig.color }}
                          >
                            {getEquipmentStatusLabel(item.status)}
                          </span>
                        </div>
                        {item.serial_number && (
                          <span className="text-xs text-slate-400 font-mono">
                            #{item.serial_number}
                          </span>
                        )}
                      </div>

                      {/* Indikatorer */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.photo_path && (
                          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {item.comment && (
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {isSelected ? (
                          <ChevronUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanderad information */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-700/50"
                      >
                        <div className="p-3 space-y-3 text-sm">
                          {/* Koordinater */}
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-slate-500">Koordinater</p>
                              <p className="text-white font-mono text-xs">
                                {formatCoordinates(item.latitude, item.longitude)}
                              </p>
                            </div>
                          </div>

                          {/* Placerad av */}
                          {item.technician?.name && (
                            <div className="flex items-start gap-2">
                              <User className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs text-slate-500">Placerad av</p>
                                <p className="text-white text-xs">{item.technician.name}</p>
                              </div>
                            </div>
                          )}

                          {/* Datum */}
                          <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-slate-500">Placerad</p>
                              <p className="text-white text-xs">
                                {new Date(item.placed_at).toLocaleDateString('sv-SE', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Kommentar */}
                          {item.comment && (
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs text-slate-500">Kommentar</p>
                                <p className="text-slate-300 text-xs">{item.comment}</p>
                              </div>
                            </div>
                          )}

                          {/* Foto */}
                          {item.photo_url && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1.5">Foto</p>
                              <img
                                src={item.photo_url}
                                alt="Utrustningsfoto"
                                className="w-full max-w-[200px] rounded-lg"
                              />
                            </div>
                          )}

                          {/* Öppna i karta-knapp */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openInMapsApp(item.latitude, item.longitude)
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/50 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Öppna i karta
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
