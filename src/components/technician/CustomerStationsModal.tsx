// src/components/technician/CustomerStationsModal.tsx
// Modal som visar alla stationer för en kund med tabbar för utomhus/inomhus

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  X,
  Building2,
  MapPin,
  Home,
  Plus,
  Crosshair,
  Box,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight
} from 'lucide-react'
import { CustomerStationSummary } from './CustomerStationCard'
import { StationHealthBadge, StationHealthDetail, calculateHealthStatusWithPercentage } from '../shared/StationHealthBadge'
import { EquipmentService } from '../../services/equipmentService'
import { EquipmentPlacementWithRelations, EQUIPMENT_TYPE_CONFIG, EQUIPMENT_STATUS_CONFIG } from '../../types/database'
import toast from 'react-hot-toast'

interface CustomerStationsModalProps {
  customer: CustomerStationSummary | null
  isOpen: boolean
  onClose: () => void
  onAddStation?: (customerId: string, type: 'outdoor' | 'indoor') => void
  onStationClick?: (station: any, type: 'outdoor' | 'indoor') => void
}

type TabType = 'outdoor' | 'indoor'

// Ikonmappning för stationstyper
const INDOOR_TYPE_ICONS: Record<string, React.ElementType> = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

export function CustomerStationsModal({
  customer,
  isOpen,
  onClose,
  onAddStation,
  onStationClick
}: CustomerStationsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('outdoor')
  const [loading, setLoading] = useState(false)
  const [outdoorStations, setOutdoorStations] = useState<EquipmentPlacementWithRelations[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])

  // Ladda stationer när modal öppnas
  useEffect(() => {
    if (isOpen && customer) {
      loadStations()
    }
  }, [isOpen, customer?.customer_id])

  // Sätt aktiv tab baserat på var det finns stationer
  useEffect(() => {
    if (customer) {
      if (customer.outdoor_count > 0) {
        setActiveTab('outdoor')
      } else if (customer.indoor_count > 0) {
        setActiveTab('indoor')
      }
    }
  }, [customer])

  const loadStations = async () => {
    if (!customer) return

    setLoading(true)
    try {
      const { outdoor, indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
      setOutdoorStations(outdoor)
      setIndoorStations(indoor)
    } catch (error) {
      console.error('Fel vid laddning av stationer:', error)
      toast.error('Kunde inte ladda stationer')
    } finally {
      setLoading(false)
    }
  }

  // Beräkna hälsostatus för aktuell tab
  const currentStations = activeTab === 'outdoor' ? outdoorStations : indoorStations
  const healthInfo = calculateHealthStatusWithPercentage(
    currentStations.map(s => ({ status: s.status }))
  )

  if (!customer) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[85vh] z-50"
          >
            <div className="h-full bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white truncate">
                        {customer.customer_name}
                      </h2>
                      {customer.customer_address && (
                        <p className="text-sm text-slate-400 truncate">
                          {customer.customer_address}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabbar */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setActiveTab('outdoor')}
                    className={`flex-1 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                      activeTab === 'outdoor'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    Utomhus
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                      activeTab === 'outdoor' ? 'bg-emerald-600' : 'bg-slate-600'
                    }`}>
                      {customer.outdoor_count}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('indoor')}
                    className={`flex-1 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                      activeTab === 'indoor'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    Inomhus
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                      activeTab === 'indoor' ? 'bg-emerald-600' : 'bg-slate-600'
                    }`}>
                      {customer.indoor_count}
                    </span>
                  </button>
                </div>
              </div>

              {/* Hälsostatus */}
              {currentStations.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-700/50 bg-slate-900/30">
                  <StationHealthDetail
                    status={healthInfo.status}
                    percentage={healthInfo.percentage}
                    problematicCount={healthInfo.problematicCount}
                    totalCount={currentStations.length}
                  />
                </div>
              )}

              {/* Innehåll */}
              <div className="flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : currentStations.length > 0 ? (
                  <div className="space-y-3">
                    {activeTab === 'outdoor' ? (
                      // Utomhusstationer
                      outdoorStations.map(station => (
                        <OutdoorStationCard
                          key={station.id}
                          station={station}
                          onClick={() => onStationClick?.(station, 'outdoor')}
                        />
                      ))
                    ) : (
                      // Inomhusstationer
                      indoorStations.map(station => (
                        <IndoorStationCard
                          key={station.id}
                          station={station}
                          onClick={() => onStationClick?.(station, 'indoor')}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
                      {activeTab === 'outdoor' ? (
                        <MapPin className="w-7 h-7 text-slate-500" />
                      ) : (
                        <Home className="w-7 h-7 text-slate-500" />
                      )}
                    </div>
                    <h3 className="text-white font-medium mb-1">
                      Inga {activeTab === 'outdoor' ? 'utomhus' : 'inomhus'}stationer
                    </h3>
                    <p className="text-slate-400 text-sm max-w-xs">
                      {activeTab === 'outdoor'
                        ? 'Det finns inga utomhusplacerade stationer för denna kund.'
                        : 'Det finns inga inomhusplacerade stationer för denna kund.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer med lägg till-knapp */}
              {onAddStation && (
                <div className="px-5 py-4 border-t border-slate-700 bg-slate-900/50">
                  <button
                    onClick={() => onAddStation(customer.customer_id, activeTab)}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Lägg till {activeTab === 'outdoor' ? 'utomhus' : 'inomhus'}station
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Utomhusstationskort
function OutdoorStationCard({
  station,
  onClick
}: {
  station: EquipmentPlacementWithRelations
  onClick?: () => void
}) {
  const typeConfig = EQUIPMENT_TYPE_CONFIG[station.equipment_type]
  const statusConfig = EQUIPMENT_STATUS_CONFIG[station.status]

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Typikon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: typeConfig.color + '20' }}
          >
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: typeConfig.color }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {station.serial_number || typeConfig.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{typeConfig.label}</p>
            {station.comment && (
              <p className="text-xs text-slate-500 mt-1 truncate">{station.comment}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>
                {format(new Date(station.placed_at), "d MMM yyyy", { locale: sv })}
              </span>
              {station.technician && (
                <span>• {station.technician.name}</span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0 mt-2" />
      </div>
    </button>
  )
}

// Inomhusstationskort
function IndoorStationCard({
  station,
  onClick
}: {
  station: any
  onClick?: () => void
}) {
  const TypeIcon = INDOOR_TYPE_ICONS[station.station_type] || Box

  // Inline status config för inomhus
  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
    active: { label: 'Aktiv', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
    removed: { label: 'Borttagen', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
    damaged: { label: 'Skadad', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
    missing: { label: 'Saknas', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' },
    needs_service: { label: 'Behöver service', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400' }
  }

  const typeLabels: Record<string, string> = {
    mechanical_trap: 'Mekanisk fälla',
    concrete_station: 'Betongstation',
    bait_station: 'Betesstation'
  }

  const status = statusConfig[station.status] || statusConfig.active

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Typikon */}
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-cyan-500/20">
            <TypeIcon className="w-5 h-5 text-cyan-400" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {station.station_number || typeLabels[station.station_type] || 'Station'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}
              >
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {typeLabels[station.station_type] || station.station_type}
            </p>
            {station.location_description && (
              <p className="text-xs text-slate-500 mt-1 truncate">{station.location_description}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>
                {format(new Date(station.placed_at), "d MMM yyyy", { locale: sv })}
              </span>
              {station.floor_plan?.name && (
                <span>• {station.floor_plan.name}</span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0 mt-2" />
      </div>
    </button>
  )
}

export default CustomerStationsModal
