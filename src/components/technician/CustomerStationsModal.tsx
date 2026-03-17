// src/components/technician/CustomerStationsModal.tsx
// Fullständig kunddetaljmodal med tabbar: Utomhus (karta) och Inomhus (planritningar)
// Med inline inomhusplacering för att lägga till stationer direkt på planritningar

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  FileImage,
  Upload,
  MoreVertical,
  ImagePlus,
  Trash2,
  Repeat
} from 'lucide-react'
import { CustomerStationSummary } from '../../services/equipmentService'
import { StationHealthBadge, StationHealthDetail, calculateHealthStatusWithPercentage } from '../shared/StationHealthBadge'
import { EquipmentService } from '../../services/equipmentService'
import { FloorPlanService, ALLOWED_FLOOR_PLAN_TYPES } from '../../services/floorPlanService'
import { IndoorStationService } from '../../services/indoorStationService'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { FloorPlanViewer } from '../shared/indoor/FloorPlanViewer'
import { FloorPlanUploadForm } from '../shared/indoor/FloorPlanUploadForm'
import { IndoorStationForm, StationTypeSelector } from '../shared/indoor/IndoorStationForm'
import { EquipmentPlacementForm, type FormData as EquipmentFormData } from '../shared/equipment/EquipmentPlacementForm'
import { StationLegend } from '../shared/indoor/IndoorStationMarker'
import { EquipmentPlacementWithRelations, EQUIPMENT_TYPE_CONFIG, EQUIPMENT_STATUS_CONFIG } from '../../types/database'
import type {
  FloorPlanWithRelations,
  IndoorStationWithRelations,
  IndoorStationInspectionWithRelations,
  IndoorStationType,
  PlacementMode,
  CreateFloorPlanInput,
  CreateIndoorStationInput,
  UpdateIndoorStationInput
} from '../../types/indoor'
import type { StationType } from '../../types/stationTypes'
import { getOutdoorInspectionsByStation } from '../../services/inspectionSessionService'
import type { OutdoorInspectionWithRelations } from '../../types/inspectionSession'
import { openInMapsApp } from '../../utils/equipmentMapUtils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { IndoorStationDetailSheet } from '../shared/indoor/IndoorStationDetailSheet'
import { EquipmentDetailSheet } from '../shared/equipment/EquipmentDetailSheet'
import { RecurringScheduleManagement } from './RecurringScheduleManagement'
import { RecurringScheduleWizard } from './RecurringScheduleWizard'
import toast from 'react-hot-toast'

interface CustomerStationsModalProps {
  customer: CustomerStationSummary | null
  isOpen: boolean
  onClose: () => void
  onAddStation?: (customerId: string, type: 'outdoor' | 'indoor') => void
  onStationClick?: (station: any, type: 'outdoor' | 'indoor') => void
}

type ViewType = 'outdoor' | 'indoor' | 'schedule'

// Ikonmappning för stationstyper (legacy + dynamiska)
const INDOOR_TYPE_ICONS: Record<string, React.ElementType> = {
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target,
  // Dynamiska ikoner från station_types
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

interface CustomerDetails {
  id: string
  company_name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  billing_address: string | null
}


export function CustomerStationsModal({
  customer,
  isOpen,
  onClose,
  onAddStation,
  onStationClick
}: CustomerStationsModalProps) {
  const { profile } = useAuth()
  const [activeView, setActiveView] = useState<ViewType>('outdoor')
  const [loading, setLoading] = useState(false)
  const [outdoorStations, setOutdoorStations] = useState<EquipmentPlacementWithRelations[]>([])
  const [indoorStations, setIndoorStations] = useState<IndoorStationWithRelations[]>([])
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null)
  const [floorPlans, setFloorPlans] = useState<FloorPlanWithRelations[]>([])
  const [showScheduleWizard, setShowScheduleWizard] = useState(false)

  // Inomhusplacering state
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlanWithRelations | null>(null)
  const [floorPlanStations, setFloorPlanStations] = useState<IndoorStationWithRelations[]>([])
  const [placementMode, setPlacementMode] = useState<PlacementMode>('view')
  const [selectedStationType, setSelectedStationType] = useState<IndoorStationType | null>(null)
  const [selectedTypeData, setSelectedTypeData] = useState<StationType | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showStationForm, setShowStationForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingIndoor, setIsAddingIndoor] = useState(false)
  const [menuOpenForPlan, setMenuOpenForPlan] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [replacingImage, setReplacingImage] = useState(false)
  const replaceImageInputRef = useRef<HTMLInputElement>(null)
  const replacePlanIdRef = useRef<string | null>(null)

  // Inomhus stationsdetalj
  const [selectedIndoorStation, setSelectedIndoorStation] = useState<IndoorStationWithRelations | null>(null)
  const [indoorInspections, setIndoorInspections] = useState<IndoorStationInspectionWithRelations[]>([])

  // Utomhus stationsdetalj
  const [selectedOutdoorStation, setSelectedOutdoorStation] = useState<EquipmentPlacementWithRelations | null>(null)
  const [outdoorInspections, setOutdoorInspections] = useState<OutdoorInspectionWithRelations[]>([])

  // Edit-mode states (visa detaljvy först, sedan formulär vid klick på redigera)
  const [editingIndoorStation, setEditingIndoorStation] = useState(false)
  const [editingOutdoorStation, setEditingOutdoorStation] = useState(false)

  // Ladda data när modal öppnas
  useEffect(() => {
    if (isOpen && customer) {
      loadAllData()
    }
  }, [isOpen, customer?.customer_id])

  // Blockera scroll på body när modal är öppen
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // Rensa inomhusdetalj vid stängning
      setSelectedIndoorStation(null)
      setIndoorInspections([])
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Öppna inomhusstation med inspektionshistorik
  const handleIndoorStationClick = async (station: IndoorStationWithRelations) => {
    setSelectedIndoorStation(station)
    setIndoorInspections([])
    try {
      const inspections = await IndoorStationService.getInspectionsByStation(station.id)
      setIndoorInspections(inspections)
    } catch (error) {
      console.error('Fel vid laddning av inspektioner:', error)
    }
  }

  const closeIndoorDetail = () => {
    setSelectedIndoorStation(null)
    setIndoorInspections([])
    setEditingIndoorStation(false)
  }

  // Öppna utomhusstation med inspektionshistorik
  const handleOutdoorStationClick = async (station: EquipmentPlacementWithRelations) => {
    setSelectedOutdoorStation(station)
    setOutdoorInspections([])
    try {
      const inspections = await getOutdoorInspectionsByStation(station.id)
      setOutdoorInspections(inspections)
    } catch (error) {
      console.error('Fel vid laddning av inspektioner:', error)
    }
  }

  const closeOutdoorDetail = () => {
    setSelectedOutdoorStation(null)
    setOutdoorInspections([])
    setEditingOutdoorStation(false)
  }

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

      // Hämta planritningar med signerade URLs
      try {
        const floorPlanData = await FloorPlanService.getFloorPlansByCustomer(customer.customer_id)
        setFloorPlans(floorPlanData)
      } catch (floorPlanError) {
        console.error('Fel vid hämtning av planritningar:', floorPlanError)
      }

    } catch (error) {
      console.error('Fel vid laddning av kunddata:', error)
      toast.error('Kunde inte ladda kunddata')
    } finally {
      setLoading(false)
    }
  }

  // Ladda stationer för vald planritning
  const loadStationsForFloorPlan = async (floorPlanId: string) => {
    try {
      const stationList = await IndoorStationService.getStationsByFloorPlan(floorPlanId)
      setFloorPlanStations(stationList)
    } catch (error) {
      console.error('Fel vid hämtning av stationer för planritning:', error)
    }
  }

  // Byt ut planritningsbild
  const handleReplaceFloorPlanImage = async (planId: string, file: File) => {
    setReplacingImage(true)
    try {
      await FloorPlanService.replaceFloorPlanImage(planId, file)
      toast.success('Bilden har bytts ut!')
      await loadAllData()
    } catch (error) {
      console.error('Fel vid byte av bild:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte byta bild')
    } finally {
      setReplacingImage(false)
      if (replaceImageInputRef.current) replaceImageInputRef.current.value = ''
      replacePlanIdRef.current = null
    }
  }

  // Ta bort planritning
  const handleDeleteFloorPlan = async (planId: string, planName: string, stationCount: number) => {
    const msg = stationCount > 0
      ? `Är du säker? Planritningen "${planName}" och ${stationCount} station${stationCount === 1 ? '' : 'er'} kommer att raderas permanent.`
      : `Är du säker på att du vill ta bort planritningen "${planName}"?`
    if (!confirm(msg)) return

    try {
      await FloorPlanService.deleteFloorPlan(planId)
      toast.success('Planritning borttagen')
      setMenuOpenForPlan(null)
      await loadAllData()
    } catch (error) {
      console.error('Fel vid borttagning av planritning:', error)
      toast.error('Kunde inte ta bort planritning')
    }
  }

  // Hantera val av planritning
  const handleSelectFloorPlan = (plan: FloorPlanWithRelations) => {
    setSelectedFloorPlan(plan)
    loadStationsForFloorPlan(plan.id)
  }

  // Hantera klick på planritningsbild för placering
  const handleImageClick = useCallback((x: number, y: number) => {
    if (placementMode === 'place' && selectedStationType) {
      setPreviewPosition({ x, y })
      setShowStationForm(true)
    }
  }, [placementMode, selectedStationType])

  // Starta placeringsläge med vald stationstyp
  const startPlacementMode = (type: IndoorStationType, typeData?: StationType) => {
    setSelectedStationType(type)
    setSelectedTypeData(typeData || null)
    setPlacementMode('place')
    setShowTypeSelector(false)
  }

  // Återställ placeringsläge
  const resetPlacementMode = () => {
    setPlacementMode('view')
    setSelectedStationType(null)
    setSelectedTypeData(null)
    setPreviewPosition(null)
  }

  // Hantera uppladdning av planritning
  const handleUploadFloorPlan = async (input: CreateFloorPlanInput) => {
    setIsSubmitting(true)
    try {
      const newPlan = await FloorPlanService.createFloorPlan(input, profile?.id)
      toast.success('Planritning uppladdad!')
      setShowUploadModal(false)
      // Ladda om planritningar och välj den nya
      if (customer) {
        const updatedPlans = await FloorPlanService.getFloorPlansByCustomer(customer.customer_id)
        setFloorPlans(updatedPlans)
        const createdPlan = await FloorPlanService.getFloorPlanById(newPlan.id)
        if (createdPlan) {
          setSelectedFloorPlan(createdPlan)
          setFloorPlanStations([])
        }
      }
    } catch (error) {
      console.error('Fel vid uppladdning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ladda upp planritning')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Skapa ny inomhusstation
  const handleCreateStation = async (input: CreateIndoorStationInput) => {
    setIsSubmitting(true)
    try {
      const technicianId = profile?.technician_id || profile?.technicians?.id
      await IndoorStationService.createStation(input, technicianId)
      toast.success('Station placerad!')
      setShowStationForm(false)
      resetPlacementMode()

      // Ladda om stationer och uppdatera räknare
      if (selectedFloorPlan) {
        await loadStationsForFloorPlan(selectedFloorPlan.id)
        // Uppdatera planritningens stationsantal
        const updatedPlan = await FloorPlanService.getFloorPlanById(selectedFloorPlan.id)
        if (updatedPlan) setSelectedFloorPlan(updatedPlan)
      }

      // Uppdatera total inomhusstationslista
      if (customer) {
        const { indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
        setIndoorStations(indoor)
        // Uppdatera planritningar med nya antal
        const updatedPlans = await FloorPlanService.getFloorPlansByCustomer(customer.customer_id)
        setFloorPlans(updatedPlans)
      }
    } catch (error) {
      console.error('Fel vid skapande av station:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte skapa station')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hantera "Lägg till station"-knappen
  const handleAddStationClick = () => {
    if (activeView === 'indoor') {
      // Inomhus: Aktivera inomhusplaceringsläge
      if (floorPlans.length === 0) {
        // Inga planritningar - visa uppladdningsmodal
        setShowUploadModal(true)
      } else {
        // Välj första planritningen om ingen är vald
        if (!selectedFloorPlan && floorPlans.length > 0) {
          handleSelectFloorPlan(floorPlans[0])
        }
        setIsAddingIndoor(true)
      }
    } else {
      // Utomhus: Anropa original callback
      onAddStation?.(customer!.customer_id, 'outdoor')
    }
  }

  // Avbryt inomhusplacering
  const cancelIndoorPlacement = () => {
    setIsAddingIndoor(false)
    resetPlacementMode()
    setShowTypeSelector(false)
    setShowStationForm(false)
  }

  // Hämta byggnadsnamn för uppladdning
  const existingBuildings = [...new Set(floorPlans.map(p => p.building_name).filter(Boolean))] as string[]

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
            className="fixed inset-2 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:h-auto md:max-h-[90vh] z-50 flex flex-col"
          >
            <div className="flex-1 min-h-0 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
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
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
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
                        ? 'bg-[#20c58f] text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    Utomhus
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      activeView === 'outdoor' ? 'bg-[#20c58f]/80' : 'bg-slate-600'
                    }`}>
                      {outdoorStations.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveView('indoor')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      activeView === 'indoor'
                        ? 'bg-[#20c58f] text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    Inomhus
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      activeView === 'indoor' ? 'bg-[#20c58f]/80' : 'bg-slate-600'
                    }`}>
                      {indoorStations.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveView('schedule')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      activeView === 'schedule'
                        ? 'bg-[#20c58f] text-white'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                    Schema
                  </button>
                </div>
              </div>

              {/* Innehåll - scrollbart */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Utomhus - Karta + stationslista */}
                    {activeView === 'outdoor' && (
                      <div className="flex flex-col">
                        {outdoorStations.length > 0 ? (
                          <>
                            {/* Karta - fixad höjd */}
                            <div className="h-[250px] md:h-[350px] flex-shrink-0" style={{ visibility: selectedOutdoorStation ? 'hidden' : 'visible' }}>
                              <EquipmentMap
                                equipment={outdoorStations}
                                onEquipmentClick={(eq) => handleOutdoorStationClick(eq)}
                                height="100%"
                                showControls={true}
                                readOnly={true}
                                enableClustering={false}
                                showNumbers={true}
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
                                    onClick={() => handleOutdoorStationClick(station)}
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
                      <>
                        {/* PLACERINGSLÄGE - Visa FloorPlanViewer med interaktivt placeringsläge */}
                        {isAddingIndoor ? (
                          <div className="flex flex-col h-full">
                            {/* Planritningsval i placeringsläge */}
                            <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 flex-shrink-0">
                              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                {floorPlans.map((plan) => (
                                  <button
                                    key={plan.id}
                                    onClick={() => handleSelectFloorPlan(plan)}
                                    className={`
                                      flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                                      ${plan.id === selectedFloorPlan?.id
                                        ? 'bg-[#20c58f] text-white'
                                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                      }
                                    `}
                                  >
                                    {plan.name}
                                    <span className={`ml-1.5 ${plan.id === selectedFloorPlan?.id ? 'text-white/70' : 'text-slate-500'}`}>
                                      ({plan.station_count || 0})
                                    </span>
                                  </button>
                                ))}
                                <button
                                  onClick={() => setShowUploadModal(true)}
                                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/30 text-[#20c58f] hover:bg-[#20c58f]/10 border border-dashed border-slate-600 hover:border-[#20c58f] transition-all flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Ny
                                </button>
                              </div>
                            </div>

                            {/* Planritningsvisare med placeringsläge */}
                            <div className="flex-1 min-h-0 relative">
                              {selectedFloorPlan?.image_url ? (
                                <FloorPlanViewer
                                  imageUrl={selectedFloorPlan.image_url}
                                  imageWidth={selectedFloorPlan.image_width}
                                  imageHeight={selectedFloorPlan.image_height}
                                  stations={floorPlanStations}
                                  placementMode={placementMode}
                                  selectedType={selectedStationType}
                                  selectedTypeData={selectedTypeData}
                                  previewPosition={previewPosition}
                                  onImageClick={handleImageClick}
                                  onCancelPlacement={resetPlacementMode}
                                  onStationClick={(station) => handleIndoorStationClick(station)}
                                  height="350px"
                                  showNumbers={true}
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full min-h-[300px]">
                                  <div className="w-8 h-8 border-2 border-[#20c58f] border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}

                              {/* FAB för att välja stationstyp (endast i visningsläge) */}
                              {placementMode === 'view' && selectedFloorPlan && (
                                <button
                                  onClick={() => setShowTypeSelector(true)}
                                  className="absolute bottom-4 right-4 w-14 h-14 bg-[#20c58f] hover:bg-[#1ab07f] text-white rounded-full shadow-lg shadow-[#20c58f]/30 flex items-center justify-center transition-all hover:scale-105 z-20"
                                >
                                  <Plus className="w-6 h-6" />
                                </button>
                              )}
                            </div>

                            {/* Legend och klar/avbryt-knapp */}
                            <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-900/50 flex-shrink-0">
                              <div className="flex items-center justify-between">
                                {floorPlanStations.length > 0 ? (
                                  <StationLegend />
                                ) : (
                                  <p className="text-sm text-slate-400">Klicka + för att välja stationstyp och placera</p>
                                )}
                                <div className="flex items-center gap-2">
                                  {floorPlanStations.length > 0 && placementMode === 'view' && (
                                    <button
                                      onClick={() => setShowTypeSelector(true)}
                                      className="px-4 py-2 text-sm text-[#20c58f] hover:text-white bg-[#20c58f]/20 hover:bg-[#20c58f]/30 border border-[#20c58f]/30 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Placera fler
                                    </button>
                                  )}
                                  <button
                                    onClick={cancelIndoorPlacement}
                                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                                      floorPlanStations.length > 0
                                        ? 'text-white bg-[#20c58f] hover:bg-[#1ab07f] font-medium'
                                        : 'text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600'
                                    }`}
                                  >
                                    {floorPlanStations.length > 0 ? 'Klar' : 'Avbryt'}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Placeringsindikator */}
                            {placementMode === 'place' && (
                              <div className="px-4 py-3 bg-[#20c58f]/20 border-t border-[#20c58f]/30 flex-shrink-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-[#20c58f] text-sm">
                                    Klicka på planritningen för att placera stationen
                                  </p>
                                  <button
                                    onClick={resetPlacementMode}
                                    className="px-3 py-1 text-sm text-slate-400 hover:text-white transition-colors"
                                  >
                                    Avbryt
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* VISNINGSLÄGE - Visa planritningar och stationslista */
                          <div className="p-5 space-y-6">
                            {/* Planritningar med stationsmarkörer */}
                            {floorPlans.length > 0 ? (
                              <div>
                                <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                  <FileImage className="w-4 h-4" />
                                  Planritningar ({floorPlans.length})
                                </h3>
                                <div className="space-y-4">
                                  {floorPlans.map(plan => {
                                    const stationsOnPlan = indoorStations.filter(s => s.floor_plan_id === plan.id)
                                    return (
                                      <div
                                        key={plan.id}
                                        className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
                                      >
                                        {/* Planritningsbild med markörer */}
                                        {plan.image_url ? (
                                          <div className="relative bg-slate-900 overflow-hidden">
                                            {/* Container som matchar bildens aspektratio */}
                                            <div className="relative w-full" style={{ paddingBottom: plan.image_height && plan.image_width ? `${(plan.image_height / plan.image_width) * 100}%` : '66.67%' }}>
                                              <img
                                                src={plan.image_url}
                                                alt={plan.name}
                                                className="absolute inset-0 w-full h-full object-contain"
                                              />
                                              {/* Stationsmarkörer - med numrering baserat på placeringsordning */}
                                              {(() => {
                                                // Sortera stationer efter placed_at (äldsta först = nummer 1)
                                                const sortedStations = [...stationsOnPlan].sort((a, b) =>
                                                  new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
                                                )
                                                // Skapa mappning för nummer
                                                const numberMap = new Map<string, number>()
                                                sortedStations.forEach((s, idx) => numberMap.set(s.id, idx + 1))

                                                return stationsOnPlan.map(station => {
                                                  const typeInfo = getStationTypeInfo(station)
                                                  const stationNumber = numberMap.get(station.id)
                                                  return (
                                                    <button
                                                      key={station.id}
                                                      onClick={() => handleIndoorStationClick(station)}
                                                      className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer z-10"
                                                      style={{
                                                        left: `${station.position_x_percent}%`,
                                                        top: `${station.position_y_percent}%`,
                                                        backgroundColor: typeInfo.color
                                                      }}
                                                      title={`#${stationNumber} - ${station.station_number || typeInfo.label}`}
                                                    >
                                                      <span className="text-white font-bold text-xs">{stationNumber}</span>
                                                    </button>
                                                  )
                                                })
                                              })()}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="w-full h-40 bg-slate-800 flex items-center justify-center">
                                            <FileImage className="w-12 h-12 text-slate-600" />
                                          </div>
                                        )}
                                        <div className="p-3 border-t border-slate-700/50 flex items-start justify-between">
                                          <div>
                                            <h4 className="font-medium text-white">{plan.name}</h4>
                                            <p className="text-xs text-slate-400 mt-1">
                                              {stationsOnPlan.length} {stationsOnPlan.length === 1 ? 'station' : 'stationer'}
                                            </p>
                                          </div>
                                          <div className="relative">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (menuOpenForPlan === plan.id) {
                                                  setMenuOpenForPlan(null)
                                                  setMenuPosition(null)
                                                } else {
                                                  const rect = e.currentTarget.getBoundingClientRect()
                                                  setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                                  setMenuOpenForPlan(plan.id)
                                                }
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                              <MoreVertical className="w-4 h-4" />
                                            </button>
                                            {menuOpenForPlan === plan.id && menuPosition && createPortal(
                                              <>
                                                <div className="fixed inset-0 z-[9998]" onClick={() => { setMenuOpenForPlan(null); setMenuPosition(null) }} />
                                                <div
                                                  className="fixed w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-[9999] overflow-hidden"
                                                  style={{ top: menuPosition.top, right: menuPosition.right }}
                                                >
                                                  <button
                                                    onClick={() => {
                                                      setMenuOpenForPlan(null)
                                                      replacePlanIdRef.current = plan.id
                                                      replaceImageInputRef.current?.click()
                                                    }}
                                                    disabled={replacingImage}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2.5 disabled:opacity-50"
                                                  >
                                                    <ImagePlus className="w-4 h-4" />
                                                    {replacingImage ? 'Byter bild...' : 'Byt bild'}
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setMenuOpenForPlan(null)
                                                      handleDeleteFloorPlan(plan.id, plan.name, stationsOnPlan.length)
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2.5"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                    Ta bort planritning
                                                  </button>
                                                </div>
                                              </>,
                                              document.body
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                {/* Dold filinput för bildutbyte */}
                                <input
                                  ref={replaceImageInputRef}
                                  type="file"
                                  accept={ALLOWED_FLOOR_PLAN_TYPES.join(',')}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file && replacePlanIdRef.current) {
                                      handleReplaceFloorPlanImage(replacePlanIdRef.current, file)
                                    }
                                  }}
                                  className="hidden"
                                />
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <FileImage className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 mb-4">Inga planritningar uppladdade</p>
                                <button
                                  onClick={() => setShowUploadModal(true)}
                                  className="px-4 py-2 bg-[#20c58f] hover:bg-[#1ab07f] text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                                >
                                  <Upload className="w-4 h-4" />
                                  Ladda upp planritning
                                </button>
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
                                      onClick={() => handleIndoorStationClick(station)}
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

                    {/* Kontrollschema tab */}
                    {activeView === 'schedule' && customer && (
                      <div className="p-4">
                        <RecurringScheduleManagement
                          customerId={customer.customer_id}
                          technicianId={profile?.technician_id || ''}
                          onCreateNew={() => setShowScheduleWizard(true)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer med lägg till-knapp - döljs i inomhusplaceringsläge och schema-vy */}
              {!isAddingIndoor && activeView !== 'schedule' && (
                <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/50">
                  <button
                    onClick={handleAddStationClick}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeView === 'outdoor'
                        ? 'bg-[#20c58f] hover:bg-[#1ab07f] text-white'
                        : 'bg-[#20c58f] hover:bg-[#1ab07f] text-white'
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
              {/* Inomhus stationsdetalj / redigering overlay */}
              <AnimatePresence>
                {selectedIndoorStation && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-end rounded-2xl overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={closeIndoorDetail}
                    />
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="relative w-full max-h-[85%] overflow-y-auto"
                    >
                      {editingIndoorStation ? (
                        <div className="bg-slate-800 rounded-t-2xl shadow-2xl">
                          <IndoorStationForm
                            floorPlanId={selectedIndoorStation.floor_plan_id}
                            position={{ x: selectedIndoorStation.position_x_percent, y: selectedIndoorStation.position_y_percent }}
                            existingStation={selectedIndoorStation}
                            inspections={indoorInspections}
                            onSubmit={async (input) => {
                              try {
                                await IndoorStationService.updateStation(
                                  selectedIndoorStation.id,
                                  input as UpdateIndoorStationInput,
                                  profile?.technician_id || undefined
                                )
                                toast.success('Station uppdaterad')
                                closeIndoorDetail()
                                if (customer) {
                                  const { indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
                                  setIndoorStations(indoor)
                                }
                              } catch (error) {
                                toast.error('Kunde inte uppdatera station')
                              }
                            }}
                            onCancel={() => setEditingIndoorStation(false)}
                            onDelete={async () => {
                              if (!confirm('Är du säker på att du vill ta bort denna station?')) return
                              try {
                                await IndoorStationService.deleteStation(selectedIndoorStation.id)
                                toast.success('Station borttagen')
                                closeIndoorDetail()
                                if (customer) {
                                  const { indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
                                  setIndoorStations(indoor)
                                }
                              } catch (error) {
                                toast.error('Kunde inte ta bort station')
                              }
                            }}
                            isSubmitting={isSubmitting}
                          />
                        </div>
                      ) : (
                        <IndoorStationDetailSheet
                          station={selectedIndoorStation}
                          inspections={indoorInspections}
                          onClose={closeIndoorDetail}
                          onEdit={() => setEditingIndoorStation(true)}
                          onDelete={async () => {
                            if (!confirm('Är du säker på att du vill ta bort denna station?')) return
                            try {
                              await IndoorStationService.deleteStation(selectedIndoorStation.id)
                              toast.success('Station borttagen')
                              closeIndoorDetail()
                              if (customer) {
                                const { indoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
                                setIndoorStations(indoor)
                              }
                            } catch (error) {
                              toast.error('Kunde inte ta bort station')
                            }
                          }}
                        />
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Utomhus stationsdetalj / redigering overlay */}
              <AnimatePresence>
                {selectedOutdoorStation && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-end rounded-2xl overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={closeOutdoorDetail}
                    />
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="relative w-full max-h-[85%] overflow-y-auto"
                    >
                      {editingOutdoorStation ? (
                        <div className="bg-slate-800 rounded-t-2xl shadow-2xl">
                          <EquipmentPlacementForm
                            customerId={customer?.customer_id || ''}
                            technicianId={profile?.technician_id || ''}
                            existingEquipment={selectedOutdoorStation}
                            inspections={outdoorInspections}
                            onSubmit={async (formData: EquipmentFormData) => {
                              try {
                                setIsSubmitting(true)
                                const result = await EquipmentService.updateEquipment(selectedOutdoorStation.id, {
                                  equipment_type: formData.equipment_type,
                                  serial_number: formData.serial_number || null,
                                  latitude: formData.latitude,
                                  longitude: formData.longitude,
                                  comment: formData.comment || null,
                                  status: formData.status
                                })
                                if (!result.success) throw new Error(result.error)
                                if (formData.photo) {
                                  await EquipmentService.uploadEquipmentPhoto(selectedOutdoorStation.id, formData.photo)
                                }
                                toast.success('Utrustning uppdaterad')
                                closeOutdoorDetail()
                                if (customer) {
                                  const { outdoor } = await EquipmentService.getStationsByCustomer(customer.customer_id)
                                  setOutdoorStations(outdoor)
                                }
                              } catch (error) {
                                toast.error('Kunde inte uppdatera utrustning')
                              } finally {
                                setIsSubmitting(false)
                              }
                            }}
                            onCancel={() => setEditingOutdoorStation(false)}
                            isSubmitting={isSubmitting}
                            showCustomerPicker={false}
                          />
                        </div>
                      ) : (
                        <EquipmentDetailSheet
                          equipment={selectedOutdoorStation}
                          isOpen={true}
                          onClose={closeOutdoorDetail}
                          onEdit={() => setEditingOutdoorStation(true)}
                          onDelete={(eq) => {
                            // Trigger delete via parent - handled by TechnicianEquipment
                            closeOutdoorDetail()
                          }}
                          inspections={outdoorInspections}
                          embedded
                        />
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Modal: Ladda upp planritning */}
          {showUploadModal && customer && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
              <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-4">
                  <FloorPlanUploadForm
                    customerId={customer.customer_id}
                    customerName={customer.customer_name}
                    existingBuildings={existingBuildings}
                    onSubmit={handleUploadFloorPlan}
                    onCancel={() => setShowUploadModal(false)}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Sheet: Välj stationstyp */}
          {showTypeSelector && (
            <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTypeSelector(false)} />
              <div className="relative w-full md:max-w-md md:mx-4 bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1 bg-slate-600 rounded-full" />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Ny station</h3>
                  <StationTypeSelector
                    selectedType={selectedStationType}
                    onSelect={(type, typeData) => startPlacementMode(type, typeData)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Sheet: Stationsformulär */}
          {showStationForm && previewPosition && selectedFloorPlan && (
            <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowStationForm(false); resetPlacementMode() }} />
              <div className="relative w-full md:max-w-md md:mx-4 bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1 bg-slate-600 rounded-full" />
                </div>
                <div className="p-4">
                  <IndoorStationForm
                    floorPlanId={selectedFloorPlan.id}
                    position={previewPosition}
                    existingStationNumbers={floorPlanStations.map(s => s.station_number).filter(Boolean) as string[]}
                    initialStationType={selectedStationType || undefined}
                    onSubmit={handleCreateStation}
                    onCancel={() => { setShowStationForm(false); resetPlacementMode() }}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            </div>
          )}
          {/* Recurring Schedule Wizard */}
          {showScheduleWizard && customer && (
            <RecurringScheduleWizard
              isOpen={showScheduleWizard}
              onClose={() => setShowScheduleWizard(false)}
              onComplete={() => {
                setShowScheduleWizard(false)
                // Refresh schedule view if on schedule tab
                if (activeView === 'schedule') {
                  setActiveView('outdoor')
                  setTimeout(() => setActiveView('schedule'), 100)
                }
              }}
              customerId={customer.customer_id}
              customerName={customer.customer_name}
              technicianId={profile?.technician_id || ''}
            />
          )}
        </>
      )}
    </AnimatePresence>
  )
}

// Hjälpfunktion för utomhusstationstyp - använder station_type_data om tillgänglig
function getOutdoorTypeConfig(station: EquipmentPlacementWithRelations) {
  // Prioritera dynamisk data från station_type_data
  if (station.station_type_data) {
    return {
      color: station.station_type_data.color,
      label: station.station_type_data.name
    }
  }
  // Fallback till legacy-config
  const legacyConfig = EQUIPMENT_TYPE_CONFIG[station.equipment_type as keyof typeof EQUIPMENT_TYPE_CONFIG]
  if (legacyConfig) {
    return {
      color: legacyConfig.color,
      label: legacyConfig.label
    }
  }
  // Sista fallback - grå
  return {
    color: '#6b7280',
    label: station.equipment_type || 'Okänd typ'
  }
}

// Utomhusstationskort
function OutdoorStationCard({
  station,
  onClick
}: {
  station: EquipmentPlacementWithRelations
  onClick?: () => void
}) {
  const typeConfig = getOutdoorTypeConfig(station)
  const statusConfig = EQUIPMENT_STATUS_CONFIG[station.status] || {
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400',
    label: station.status
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/70 transition-all group"
    >
      <div className="flex items-center gap-3">
        {/* Typikon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${typeConfig.color}20` }}
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
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/70 transition-all group"
    >
      <div className="flex items-center gap-3">
        {/* Typikon med dynamisk färg */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: typeInfo.color + '20' }}
        >
          <TypeIcon className="w-5 h-5" style={{ color: typeInfo.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">
              {station.station_number || typeInfo.label || 'Station'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span>{typeInfo.label}</span>
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
