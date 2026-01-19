// src/components/technician/CustomerStationsModal.tsx
// Fullständig kunddetaljmodal med tabbar: Utomhus (karta) och Inomhus (planritningar)

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
  Clock,
  ChevronRight,
  Phone,
  Mail,
  Navigation,
  FileImage
} from 'lucide-react'
import { CustomerStationSummary } from '../../services/equipmentService'
import { StationHealthBadge, StationHealthDetail, calculateHealthStatusWithPercentage } from '../shared/StationHealthBadge'
import { EquipmentService } from '../../services/equipmentService'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { EquipmentPlacementWithRelations, EQUIPMENT_TYPE_CONFIG, EQUIPMENT_STATUS_CONFIG } from '../../types/database'
import { openInMapsApp } from '../../utils/equipmentMapUtils'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface CustomerStationsModalProps {
  customer: CustomerStationSummary | null
  isOpen: boolean
  onClose: () => void
  onAddStation?: (customerId: string, type: 'outdoor' | 'indoor') => void
  onStationClick?: (station: any, type: 'outdoor' | 'indoor') => void
}

type ViewType = 'outdoor' | 'indoor'

// Ikonmappning för stationstyper
const INDOOR_TYPE_ICONS: Record<string, React.ElementType> = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target
}

interface CustomerDetails {
  id: string
  company_name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  billing_address: string | null
}

interface FloorPlan {
  id: string
  name: string
  image_url: string | null
}

export function CustomerStationsModal({
  customer,
  isOpen,
  onClose,
  onAddStation,
  onStationClick
}: CustomerStationsModalProps) {
  const [activeView, setActiveView] = useState<ViewType>('outdoor')
  const [loading, setLoading] = useState(false)
  const [outdoorStations, setOutdoorStations] = useState<EquipmentPlacementWithRelations[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null)
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])

  // Ladda data när modal öppnas
  useEffect(() => {
    if (isOpen && customer) {
      loadAllData()
    }
  }, [isOpen, customer?.customer_id])

  const loadAllData = async () => {
    if (!customer) return

    setLoading(true)
    try {
      // Hämta stationer
      const { outdoor, indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
      setOutdoorStations(outdoor)
      setIndoorStations(indoor)

      // Hämta kunddetaljer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, company_name, contact_person, contact_email, contact_phone, contact_address, billing_address')
        .eq('id', customer.customer_id)
        .single()

      if (!customerError && customerData) {
        setCustomerDetails(customerData)
      }

      // Hämta planritningar
      const { data: floorPlanData, error: floorPlanError } = await supabase
        .from('floor_plans')
        .select('id, name, image_url')
        .eq('customer_id', customer.customer_id)

      if (!floorPlanError && floorPlanData) {
        setFloorPlans(floorPlanData)
      }

    } catch (error) {
      console.error('Fel vid laddning av kunddata:', error)
      toast.error('Kunde inte ladda kunddata')
    } finally {
      setLoading(false)
    }
  }

  // Beräkna hälsostatus
  const allStations = [...outdoorStations, ...indoorStations.map(s => ({ status: s.status }))]
  const healthInfo = calculateHealthStatusWithPercentage(allStations)

  // Total statistik
  const totalStations = outdoorStations.length + indoorStations.length

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

          {/* Modal - större för att rymma mer innehåll */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-2 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] z-50"
          >
            <div className="h-full bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-700 flex-shrink-0 bg-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-white truncate">
                        {customer.customer_name}
                      </h2>
                      {customer.customer_address && (
                        <p className="text-sm text-slate-400 truncate">
                          {customer.customer_address}
                        </p>
                      )}
                      {/* Kontaktinfo-snabblänkar */}
                      {customerDetails && (
                        <div className="flex items-center gap-3 mt-2">
                          {customerDetails.contact_phone && (
                            <a
                              href={`tel:${customerDetails.contact_phone}`}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3 h-3" />
                              Ring
                            </a>
                          )}
                          {customerDetails.contact_email && (
                            <a
                              href={`mailto:${customerDetails.contact_email}`}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="w-3 h-3" />
                              Mejla
                            </a>
                          )}
                          {customer.customer_address && outdoorStations.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openInMapsApp(outdoorStations[0].latitude, outdoorStations[0].longitude)
                              }}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <Navigation className="w-3 h-3" />
                              Navigera
                            </button>
                          )}
                        </div>
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

                {/* Hälsostatus */}
                {totalStations > 0 && (
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-xl">
                    <StationHealthDetail
                      status={healthInfo.status}
                      percentage={healthInfo.percentage}
                      problematicCount={healthInfo.problematicCount}
                      totalCount={totalStations}
                    />
                  </div>
                )}

                {/* Navigeringsflikar - Utomhus / Inomhus */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setActiveView('outdoor')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      activeView === 'outdoor'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    Utomhus
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      activeView === 'outdoor' ? 'bg-blue-600' : 'bg-slate-600'
                    }`}>
                      {outdoorStations.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveView('indoor')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      activeView === 'indoor'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    Inomhus
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      activeView === 'indoor' ? 'bg-cyan-600' : 'bg-slate-600'
                    }`}>
                      {indoorStations.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Innehåll */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Utomhus - Karta + stationslista */}
                    {activeView === 'outdoor' && (
                      <div className="flex flex-col h-full">
                        {outdoorStations.length > 0 ? (
                          <>
                            {/* Karta - fixad höjd */}
                            <div className="h-[300px] md:h-[350px] flex-shrink-0">
                              <EquipmentMap
                                equipment={outdoorStations}
                                onEquipmentClick={(eq) => onStationClick?.(eq, 'outdoor')}
                                height="100%"
                                showControls={true}
                                readOnly={true}
                                enableClustering={false}
                              />
                            </div>

                            {/* Stationslista under kartan */}
                            <div className="p-4 space-y-3">
                              <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                Utomhusstationer ({outdoorStations.length})
                              </h3>
                              <div className="space-y-2">
                                {outdoorStations.map(station => (
                                  <OutdoorStationCard
                                    key={station.id}
                                    station={station}
                                    onClick={() => onStationClick?.(station, 'outdoor')}
                                  />
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                              <MapPin className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">
                              Inga utomhusstationer
                            </h3>
                            <p className="text-slate-400 text-sm max-w-xs">
                              Det finns inga utomhusstationer placerade hos denna kund ännu.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inomhus - Planritningar + stationslista */}
                    {activeView === 'indoor' && (
                      <div className="p-5 space-y-6">
                        {/* Planritningar */}
                        {floorPlans.length > 0 ? (
                          <div>
                            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                              <FileImage className="w-4 h-4" />
                              Planritningar ({floorPlans.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {floorPlans.map(plan => {
                                const stationsOnPlan = indoorStations.filter(s => s.floor_plan_id === plan.id)
                                return (
                                  <div
                                    key={plan.id}
                                    className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-colors"
                                  >
                                    {plan.image_url ? (
                                      <img
                                        src={plan.image_url}
                                        alt={plan.name}
                                        className="w-full h-40 object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-40 bg-slate-800 flex items-center justify-center">
                                        <FileImage className="w-12 h-12 text-slate-600" />
                                      </div>
                                    )}
                                    <div className="p-3">
                                      <h4 className="font-medium text-white">{plan.name}</h4>
                                      <p className="text-xs text-slate-400 mt-1">
                                        {stationsOnPlan.length} stationer
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileImage className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">Inga planritningar uppladdade</p>
                          </div>
                        )}

                        {/* Inomhusstationslista */}
                        {indoorStations.length > 0 ? (
                          <div>
                            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                              <Home className="w-4 h-4" />
                              Inomhusstationer ({indoorStations.length})
                            </h3>
                            <div className="space-y-2">
                              {indoorStations.map(station => (
                                <IndoorStationCard
                                  key={station.id}
                                  station={station}
                                  onClick={() => onStationClick?.(station, 'indoor')}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Home className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">Inga inomhusstationer utplacerade</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer med lägg till-knapp */}
              {onAddStation && (
                <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/50">
                  <button
                    onClick={() => onAddStation(customer.customer_id, activeView)}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeView === 'outdoor'
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    {activeView === 'outdoor' ? (
                      <>
                        <MapPin className="w-4 h-4" />
                        Lägg till utomhusstation
                      </>
                    ) : (
                      <>
                        <Home className="w-4 h-4" />
                        Lägg till inomhusstation
                      </>
                    )}
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
      className="w-full text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/70 transition-all group"
    >
      <div className="flex items-center gap-3">
        {/* Typikon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: typeConfig.color + '20' }}
        >
          <MapPin className="w-5 h-5" style={{ color: typeConfig.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">
              {station.serial_number || typeConfig.label}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
            >
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span>{typeConfig.label}</span>
            <span>•</span>
            <Clock className="w-3 h-3" />
            <span>{format(new Date(station.placed_at), "d MMM yyyy", { locale: sv })}</span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
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

  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
    active: { label: 'Aktiv', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
    removed: { label: 'Borttagen', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
    damaged: { label: 'Skadad', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
    missing: { label: 'Saknas', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' },
    needs_service: { label: 'Service', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400' }
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
      className="w-full text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/70 transition-all group"
    >
      <div className="flex items-center gap-3">
        {/* Typikon */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-cyan-500/20">
          <TypeIcon className="w-5 h-5 text-cyan-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">
              {station.station_number || typeLabels[station.station_type] || 'Station'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span>{typeLabels[station.station_type] || station.station_type}</span>
            {station.floor_plan?.name && (
              <>
                <span>•</span>
                <span>{station.floor_plan.name}</span>
              </>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
      </div>
    </button>
  )
}

export default CustomerStationsModal
