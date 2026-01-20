// src/components/technician/ExpandableCustomerRow.tsx
// Expanderbar kundrad med stationsdetaljer

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Building2,
  MapPin,
  Home,
  ChevronRight,
  Clock,
  Box,
  Target,
  Crosshair,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { StationHealthBadge, HealthStatus } from '../shared/StationHealthBadge'
import { EquipmentService, CustomerStationSummary } from '../../services/equipmentService'
import { EquipmentPlacementWithRelations, EQUIPMENT_TYPE_CONFIG, EQUIPMENT_STATUS_CONFIG } from '../../types/database'
import toast from 'react-hot-toast'

interface ExpandableCustomerRowProps {
  customer: CustomerStationSummary
  onOpenFullDetails: (customer: CustomerStationSummary) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

// Legacy ikonmappning för stationstyper (fallback)
const INDOOR_TYPE_ICONS: Record<string, React.ElementType> = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target,
  // Dynamiska ikoner
  crosshair: Crosshair,
  box: Box,
  target: Target
}

const LEGACY_TYPE_LABELS: Record<string, string> = {
  mechanical_trap: 'Mekanisk fälla',
  concrete_station: 'Betongstation',
  bait_station: 'Betesstation'
}

// Hämta typ-info från station (prioriterar dynamisk data)
function getStationTypeInfo(station: any) {
  if (station.station_type_data) {
    return {
      label: station.station_type_data.name,
      color: station.station_type_data.color,
      icon: INDOOR_TYPE_ICONS[station.station_type_data.icon] || Box
    }
  }
  // Fallback till legacy
  return {
    label: LEGACY_TYPE_LABELS[station.station_type] || station.station_type,
    color: '#06b6d4', // cyan som default
    icon: INDOOR_TYPE_ICONS[station.station_type] || Box
  }
}

// Hämta typ-info för utomhusstation (med fallback för dynamiska typer)
function getOutdoorTypeConfig(equipmentType: string) {
  const legacyConfig = EQUIPMENT_TYPE_CONFIG[equipmentType as keyof typeof EQUIPMENT_TYPE_CONFIG]
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

export function ExpandableCustomerRow({
  customer,
  onOpenFullDetails,
  isExpanded,
  onToggleExpand
}: ExpandableCustomerRowProps) {
  const [loading, setLoading] = useState(false)
  const [outdoorStations, setOutdoorStations] = useState<EquipmentPlacementWithRelations[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])
  const [stationsLoaded, setStationsLoaded] = useState(false)

  const totalStations = customer.outdoor_count + customer.indoor_count
  const hasStations = totalStations > 0

  // Ladda stationer när raden expanderas
  useEffect(() => {
    if (isExpanded && !stationsLoaded && hasStations) {
      loadStations()
    }
  }, [isExpanded, stationsLoaded, hasStations])

  const loadStations = async () => {
    setLoading(true)
    try {
      const { outdoor, indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
      setOutdoorStations(outdoor)
      setIndoorStations(indoor)
      setStationsLoaded(true)
    } catch (error) {
      console.error('Fel vid laddning av stationer:', error)
      toast.error('Kunde inte ladda stationer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-slate-700/30 last:border-b-0">
      {/* Huvudrad - alltid synlig */}
      <div
        className={`
          p-4 transition-all duration-200 cursor-pointer
          hover:bg-slate-800/30
          ${isExpanded ? 'bg-slate-800/20' : ''}
        `}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          {/* Expand/collapse-ikon */}
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </motion.div>

          {/* Kundikon */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
            ${hasStations ? 'bg-emerald-500/10' : 'bg-slate-700/30'}
          `}>
            <Building2 className={`w-5 h-5 ${hasStations ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>

          {/* Kundinfo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-medium truncate ${hasStations ? 'text-white' : 'text-slate-400'}`}>
                {customer.customer_name}
              </h3>
            </div>
            {customer.customer_address && (
              <p className="text-sm text-slate-500 truncate">{customer.customer_address}</p>
            )}
          </div>

          {/* Statistik */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Stationsantal */}
            {hasStations ? (
              <div className="flex items-center gap-3 text-sm">
                {customer.outdoor_count > 0 && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {customer.outdoor_count}
                  </span>
                )}
                {customer.indoor_count > 0 && (
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Home className="w-3.5 h-3.5" />
                    {customer.indoor_count}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500">Inga stationer</span>
            )}

            {/* Hälsostatus */}
            {hasStations && (
              <StationHealthBadge status={customer.health_status} size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Expanderat innehåll */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 ml-7 border-l-2 border-slate-700/50">
              {!hasStations ? (
                // Kund utan stationer
                <div className="py-6 text-center">
                  <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm mb-3">
                    Inga stationer utplacerade hos denna kund
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenFullDetails(customer)
                    }}
                    className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20 transition-colors"
                  >
                    Lägg till station
                  </button>
                </div>
              ) : loading ? (
                // Laddar
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : (
                // Stationslista
                <div className="space-y-4 pt-3">
                  {/* Snabbstatistik */}
                  <div className="flex items-center gap-4 text-xs text-slate-400 pb-2 border-b border-slate-700/30">
                    <span>
                      Totalt: <span className="text-white font-medium">{totalStations}</span> stationer
                    </span>
                    {customer.latest_inspection_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Senast: {format(new Date(customer.latest_inspection_date), 'd MMM yyyy', { locale: sv })}
                      </span>
                    )}
                  </div>

                  {/* Kompakt stationslista */}
                  <div className="space-y-2">
                    {/* Utomhusstationer */}
                    {outdoorStations.map(station => {
                      const typeConfig = getOutdoorTypeConfig(station.equipment_type)
                      const statusConfig = EQUIPMENT_STATUS_CONFIG[station.status] || {
                        bgColor: 'bg-slate-500/20',
                        textColor: 'text-slate-400',
                        label: station.status
                      }
                      return (
                        <div
                          key={station.id}
                          className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg"
                        >
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${typeConfig.color}20` }}
                          >
                            <MapPin className="w-4 h-4" style={{ color: typeConfig.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">
                                {station.serial_number || typeConfig.label}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs ${statusConfig.bgColor} ${statusConfig.textColor}`}
                              >
                                {statusConfig.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{typeConfig.label}</p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {format(new Date(station.placed_at), 'd MMM', { locale: sv })}
                          </span>
                        </div>
                      )
                    })}

                    {/* Inomhusstationer */}
                    {indoorStations.map(station => {
                      const typeInfo = getStationTypeInfo(station)
                      const TypeIcon = typeInfo.icon
                      const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
                        active: { label: 'Aktiv', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
                        removed: { label: 'Borttagen', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
                        damaged: { label: 'Skadad', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
                        missing: { label: 'Saknas', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' },
                        needs_service: { label: 'Service', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400' }
                      }
                      const status = statusConfig[station.status] || statusConfig.active

                      return (
                        <div
                          key={station.id}
                          className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg"
                        >
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: typeInfo.color + '20' }}
                          >
                            <TypeIcon className="w-4 h-4" style={{ color: typeInfo.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">
                                {station.station_number || typeInfo.label || 'Station'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs ${status.bgColor} ${status.textColor}`}
                              >
                                {status.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {typeInfo.label}
                              {station.floor_plan?.name && ` - ${station.floor_plan.name}`}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {format(new Date(station.placed_at), 'd MMM', { locale: sv })}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Se alla detaljer-knapp */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenFullDetails(customer)
                    }}
                    className="w-full py-2.5 mt-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Se alla detaljer och karta
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ExpandableCustomerRow
