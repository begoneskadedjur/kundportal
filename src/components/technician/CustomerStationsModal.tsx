// src/components/technician/CustomerStationsModal.tsx
// Fullstandig kunddetaljmodal med karta, stationslista och planritningar

import { useState, useEffect, useMemo } from 'react'
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
  Map,
  FileImage,
  Phone,
  Mail,
  Navigation,
  ExternalLink
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

type ViewType = 'overview' | 'map' | 'floorplans'

// Ikonmappning for stationstyper
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
  const [activeView, setActiveView] = useState<ViewType>('overview')
  const [loading, setLoading] = useState(false)
  const [outdoorStations, setOutdoorStations] = useState<EquipmentPlacementWithRelations[]>([])
  const [indoorStations, setIndoorStations] = useState<any[]>([])
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null)
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])

  // Ladda data nar modal oppnas
  useEffect(() => {
    if (isOpen && customer) {
      loadAllData()
    }
  }, [isOpen, customer?.customer_id])

  const loadAllData = async () => {
    if (!customer) return

    setLoading(true)
    try {
      // Hamta stationer
      const { outdoor, indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
      setOutdoorStations(outdoor)
      setIndoorStations(indoor)

      // Hamta kunddetaljer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, company_name, contact_person, contact_email, contact_phone, contact_address, billing_address')
        .eq('id', customer.customer_id)
        .single()

      if (!customerError && customerData) {
        setCustomerDetails(customerData)
      }

      // Hamta planritningar
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

  // Berakna halsostatus
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

          {/* Modal - storre for att rymma mer innehall */}
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
                      {/* Kontaktinfo-snabblank */}
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
                          {customer.customer_address && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Oppna i kartor
                                if (outdoorStations.length > 0) {
                                  openInMapsApp(outdoorStations[0].latitude, outdoorStations[0].longitude)
                                }
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

                {/* Navigeringsflikar */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setActiveView('overview')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      activeView === 'overview'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Oversikt
                  </button>
                  {outdoorStations.length > 0 && (
                    <button
                      onClick={() => setActiveView('map')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === 'map'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Map className="w-4 h-4" />
                      Karta
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        activeView === 'map' ? 'bg-emerald-600' : 'bg-slate-600'
                      }`}>
                        {outdoorStations.length}
                      </span>
                    </button>
                  )}
                  {floorPlans.length > 0 && (
                    <button
                      onClick={() => setActiveView('floorplans')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === 'floorplans'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <FileImage className="w-4 h-4" />
                      Planritningar
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        activeView === 'floorplans' ? 'bg-emerald-600' : 'bg-slate-600'
                      }`}>
                        {floorPlans.length}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Innehall */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Oversikt */}
                    {activeView === 'overview' && (
                      <div className="p-5 space-y-6">
                        {/* Halsostatus */}
                        {totalStations > 0 && (
                          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <StationHealthDetail
                              status={healthInfo.status}
                              percentage={healthInfo.percentage}
                              problematicCount={healthInfo.problematicCount}
                              totalCount={totalStations}
                            />
                          </div>
                        )}

                        {/* Kundinformation */}
                        {customerDetails && (
                          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-blue-400" />
                              Kundinformation
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {customerDetails.contact_person && (
                                <div>
                                  <span className="text-slate-500">Kontaktperson:</span>
                                  <span className="ml-2 text-white">{customerDetails.contact_person}</span>
                                </div>
                              )}
                              {customerDetails.contact_phone && (
                                <div>
                                  <span className="text-slate-500">Telefon:</span>
                                  <a href={`tel:${customerDetails.contact_phone}`} className="ml-2 text-blue-400 hover:text-blue-300">
                                    {customerDetails.contact_phone}
                                  </a>
                                </div>
                              )}
                              {customerDetails.contact_email && (
                                <div>
                                  <span className="text-slate-500">E-post:</span>
                                  <a href={`mailto:${customerDetails.contact_email}`} className="ml-2 text-blue-400 hover:text-blue-300">
                                    {customerDetails.contact_email}
                                  </a>
                                </div>
                              )}
                              {customerDetails.contact_address && (
                                <div className="md:col-span-2">
                                  <span className="text-slate-500">Adress:</span>
                                  <span className="ml-2 text-white">{customerDetails.contact_address}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stationslista */}
                        <div>
                          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            Alla stationer ({totalStations})
                          </h3>

                          {totalStations > 0 ? (
                            <div className="space-y-2">
                              {/* Utomhusstationer */}
                              {outdoorStations.map(station => (
                                <OutdoorStationCard
                                  key={station.id}
                                  station={station}
                                  onClick={() => onStationClick?.(station, 'outdoor')}
                                />
                              ))}

                              {/* Inomhusstationer */}
                              {indoorStations.map(station => (
                                <IndoorStationCard
                                  key={station.id}
                                  station={station}
                                  onClick={() => onStationClick?.(station, 'indoor')}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                <MapPin className="w-6 h-6 text-slate-500" />
                              </div>
                              <p className="text-slate-400 text-sm">
                                Inga stationer utplacerade hos denna kund
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Kartvy */}
                    {activeView === 'map' && outdoorStations.length > 0 && (
                      <div className="h-full min-h-[400px]">
                        <EquipmentMap
                          equipment={outdoorStations}
                          onEquipmentClick={(eq) => onStationClick?.(eq, 'outdoor')}
                          height="100%"
                          showControls={true}
                          readOnly={true}
                          enableClustering={false}
                        />
                      </div>
                    )}

                    {/* Planritningar */}
                    {activeView === 'floorplans' && (
                      <div className="p-5">
                        {floorPlans.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {floorPlans.map(plan => (
                              <div
                                key={plan.id}
                                className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
                              >
                                {plan.image_url ? (
                                  <img
                                    src={plan.image_url}
                                    alt={plan.name}
                                    className="w-full h-48 object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-48 bg-slate-800 flex items-center justify-center">
                                    <FileImage className="w-12 h-12 text-slate-600" />
                                  </div>
                                )}
                                <div className="p-3">
                                  <h4 className="font-medium text-white">{plan.name}</h4>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {indoorStations.filter(s => s.floor_plan_id === plan.id).length} stationer
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <FileImage className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">Inga planritningar uppladdade</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer med lagg till-knapp */}
              {onAddStation && (
                <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/50 flex gap-3">
                  <button
                    onClick={() => onAddStation(customer.customer_id, 'outdoor')}
                    className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <MapPin className="w-4 h-4" />
                    Utomhusstation
                  </button>
                  <button
                    onClick={() => onAddStation(customer.customer_id, 'indoor')}
                    className="flex-1 py-3 px-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <Home className="w-4 h-4" />
                    Inomhusstation
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
            <span>-</span>
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
    mechanical_trap: 'Mekanisk falla',
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
            <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/10 text-cyan-400">
              Inomhus
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span>{typeLabels[station.station_type] || station.station_type}</span>
            {station.floor_plan?.name && (
              <>
                <span>-</span>
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
