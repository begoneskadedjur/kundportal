// src/components/technician/AddStationWizard.tsx
// 3-stegs wizard för att lägga till station: Kund → Typ → Placera (Inomhus)

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  MapPin,
  Home,
  Check,
  Upload,
  Plus,
  FileImage,
  Crosshair,
  Box,
  Target
} from 'lucide-react'
import { EquipmentService } from '../../services/equipmentService'
import { FloorPlanService } from '../../services/floorPlanService'
import { IndoorStationService } from '../../services/indoorStationService'
import { FloorPlanViewer } from '../shared/indoor/FloorPlanViewer'
import { FloorPlanUploadForm } from '../shared/indoor/FloorPlanUploadForm'
import { IndoorStationForm, StationTypeSelector } from '../shared/indoor/IndoorStationForm'
import { StationLegend } from '../shared/indoor/IndoorStationMarker'
import type {
  FloorPlanWithRelations,
  IndoorStationWithRelations,
  IndoorStationType,
  PlacementMode,
  CreateFloorPlanInput,
  CreateIndoorStationInput
} from '../../types/indoor'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

type WizardStep = 1 | 2 | 3

interface AddStationWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (customerId: string, type: 'outdoor' | 'indoor') => void
  preselectedCustomerId?: string | null
  technicianId?: string
}

interface CustomerOption {
  id: string
  company_name: string
  hasStations?: boolean
}

export function AddStationWizard({
  isOpen,
  onClose,
  onComplete,
  preselectedCustomerId,
  technicianId
}: AddStationWizardProps) {
  const { profile } = useAuth()
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(preselectedCustomerId || null)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  const [stationType, setStationType] = useState<'outdoor' | 'indoor' | null>(null)

  // Kunder
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersWithStations, setCustomersWithStations] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Inomhus-state (steg 3)
  const [floorPlans, setFloorPlans] = useState<FloorPlanWithRelations[]>([])
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlanWithRelations | null>(null)
  const [stations, setStations] = useState<IndoorStationWithRelations[]>([])
  const [loadingFloorPlans, setLoadingFloorPlans] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showStationForm, setShowStationForm] = useState(false)
  const [placementMode, setPlacementMode] = useState<PlacementMode>('view')
  const [selectedStationType, setSelectedStationType] = useState<IndoorStationType | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ladda kunder när wizard öppnas
  useEffect(() => {
    if (isOpen) {
      loadCustomers()
    }
  }, [isOpen])

  // Om förhandsvald kund, hoppa till steg 2
  useEffect(() => {
    if (isOpen && preselectedCustomerId) {
      setSelectedCustomerId(preselectedCustomerId)
      setCurrentStep(2)
    } else if (isOpen) {
      setCurrentStep(1)
      setSelectedCustomerId(null)
      setStationType(null)
    }
  }, [isOpen, preselectedCustomerId])

  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const allCustomers = await EquipmentService.getCustomersForDropdown()
      setCustomers(allCustomers)

      // Om vi har technicianId, hämta vilka kunder som redan har stationer
      if (technicianId) {
        try {
          const summaries = await EquipmentService.getCustomerStationSummaries(technicianId)
          setCustomersWithStations(new Set(summaries.map(s => s.customer_id)))
        } catch (e) {
          console.error('Kunde inte hämta kundsammanfattningar:', e)
        }
      }
    } catch (error) {
      console.error('Kunde inte ladda kunder:', error)
      toast.error('Kunde inte ladda kunder')
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Filtrera och sortera kunder
  const filteredCustomers = useMemo(() => {
    let result = [...customers]

    // Filtrera på sökfråga
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.company_name.toLowerCase().includes(query)
      )
    }

    // Sortera: kunder med stationer först, sedan alfabetiskt
    result.sort((a, b) => {
      const aHas = customersWithStations.has(a.id)
      const bHas = customersWithStations.has(b.id)
      if (aHas && !bHas) return -1
      if (!aHas && bHas) return 1
      return a.company_name.localeCompare(b.company_name, 'sv')
    })

    return result
  }, [customers, searchQuery, customersWithStations])

  // Kunder uppdelade i grupper
  const { yourCustomers, otherCustomers } = useMemo(() => {
    const yours = filteredCustomers.filter(c => customersWithStations.has(c.id))
    const others = filteredCustomers.filter(c => !customersWithStations.has(c.id))
    return { yourCustomers: yours, otherCustomers: others }
  }, [filteredCustomers, customersWithStations])

  // Hantera stegnavigering
  const goToStep = (step: WizardStep) => {
    setCurrentStep(step)
  }

  const goBack = () => {
    if (currentStep === 2) {
      if (preselectedCustomerId) {
        onClose()
      } else {
        goToStep(1)
      }
    } else if (currentStep === 3) {
      goToStep(2)
    }
  }

  const handleCustomerSelect = (customer: CustomerOption) => {
    setSelectedCustomerId(customer.id)
    setSelectedCustomerName(customer.company_name)
    goToStep(2)
  }

  const handleTypeSelect = (type: 'outdoor' | 'indoor') => {
    setStationType(type)
    if (type === 'outdoor') {
      // För utomhus: Direkt slutför och stäng wizard
      onComplete(selectedCustomerId!, type)
      handleClose()
    } else {
      // För inomhus: Gå till steg 3 för planritningshantering
      goToStep(3)
      loadFloorPlans(selectedCustomerId!)
    }
  }

  // Ladda planritningar för kund
  const loadFloorPlans = async (customerId: string) => {
    setLoadingFloorPlans(true)
    try {
      const plans = await FloorPlanService.getFloorPlansByCustomer(customerId)
      setFloorPlans(plans)
      // Auto-välj första planritningen om den finns
      if (plans.length > 0) {
        setSelectedFloorPlan(plans[0])
        loadStations(plans[0].id)
      }
    } catch (error) {
      console.error('Fel vid hämtning av planritningar:', error)
      toast.error('Kunde inte ladda planritningar')
    } finally {
      setLoadingFloorPlans(false)
    }
  }

  // Ladda stationer för planritning
  const loadStations = async (floorPlanId: string) => {
    try {
      const stationList = await IndoorStationService.getStationsByFloorPlan(floorPlanId)
      setStations(stationList)
    } catch (error) {
      console.error('Fel vid hämtning av stationer:', error)
    }
  }

  // Hantera klick på planritningsbild
  const handleImageClick = useCallback((x: number, y: number) => {
    if (placementMode === 'place' && selectedStationType) {
      setPreviewPosition({ x, y })
      setShowStationForm(true)
    }
  }, [placementMode, selectedStationType])

  // Starta placeringsläge
  const startPlacementMode = (type: IndoorStationType) => {
    setSelectedStationType(type)
    setPlacementMode('place')
    setShowTypeSelector(false)
  }

  // Återställ placeringsläge
  const resetPlacementMode = () => {
    setPlacementMode('view')
    setSelectedStationType(null)
    setPreviewPosition(null)
  }

  // Hantera planritningsuppladdning
  const handleUploadFloorPlan = async (input: CreateFloorPlanInput) => {
    setIsSubmitting(true)
    try {
      const newPlan = await FloorPlanService.createFloorPlan(input, profile?.id)
      toast.success('Planritning uppladdad!')
      setShowUploadModal(false)
      // Ladda om planritningar och välj den nya
      await loadFloorPlans(selectedCustomerId!)
      const updatedPlan = await FloorPlanService.getFloorPlanById(newPlan.id)
      if (updatedPlan) {
        setSelectedFloorPlan(updatedPlan)
        setStations([])
      }
    } catch (error) {
      console.error('Fel vid uppladdning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ladda upp planritning')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Skapa ny station
  const handleCreateStation = async (input: CreateIndoorStationInput) => {
    setIsSubmitting(true)
    try {
      await IndoorStationService.createStation(
        input,
        technicianId || profile?.technicians?.id
      )
      toast.success('Station placerad!')
      setShowStationForm(false)
      resetPlacementMode()
      // Ladda om stationer
      if (selectedFloorPlan) {
        await loadStations(selectedFloorPlan.id)
        // Uppdatera planritningens stationsantal
        const updatedPlan = await FloorPlanService.getFloorPlanById(selectedFloorPlan.id)
        if (updatedPlan) setSelectedFloorPlan(updatedPlan)
      }
    } catch (error) {
      console.error('Fel vid skapande av station:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte skapa station')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hantera val av planritning
  const handleSelectFloorPlan = (plan: FloorPlanWithRelations) => {
    setSelectedFloorPlan(plan)
    loadStations(plan.id)
  }

  // Hämta byggnadsnamn för uppladdning
  const existingBuildings = [...new Set(floorPlans.map(p => p.building_name).filter(Boolean))] as string[]

  const handleClose = () => {
    setCurrentStep(1)
    setSelectedCustomerId(null)
    setSelectedCustomerName('')
    setStationType(null)
    setSearchQuery('')
    // Återställ inomhus-state
    setFloorPlans([])
    setSelectedFloorPlan(null)
    setStations([])
    setShowUploadModal(false)
    setShowTypeSelector(false)
    setShowStationForm(false)
    resetPlacementMode()
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`w-full bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
            currentStep === 3
              ? 'md:max-w-4xl max-h-[95vh]'
              : 'md:max-w-lg max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <button
                    onClick={goBack}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {currentStep === 1 && 'Välj kund'}
                    {currentStep === 2 && 'Välj typ'}
                    {currentStep === 3 && 'Inomhusplacering'}
                  </h2>
                  {currentStep === 3 && selectedCustomerName && (
                    <p className="text-sm text-slate-400">{selectedCustomerName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step < currentStep
                        ? 'bg-emerald-500 text-white'
                        : step === currentStep
                        ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {step < currentStep ? <Check className="w-4 h-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-12 h-0.5 mx-1 ${
                        step < currentStep ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-5"
                >
                  {/* Sökfält */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Sök kund..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      autoFocus
                    />
                  </div>

                  {loadingCustomers ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Dina kunder (med stationer) */}
                      {yourCustomers.length > 0 && (
                        <div>
                          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 px-1">
                            Dina kunder
                          </h3>
                          <div className="space-y-2">
                            {yourCustomers.map(customer => (
                              <CustomerButton
                                key={customer.id}
                                customer={customer}
                                onClick={() => handleCustomerSelect(customer)}
                                hasStations
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Övriga kunder */}
                      {otherCustomers.length > 0 && (
                        <div>
                          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 px-1">
                            {yourCustomers.length > 0 ? 'Alla kunder' : 'Kunder'}
                          </h3>
                          <div className="space-y-2">
                            {otherCustomers.slice(0, 20).map(customer => (
                              <CustomerButton
                                key={customer.id}
                                customer={customer}
                                onClick={() => handleCustomerSelect(customer)}
                              />
                            ))}
                            {otherCustomers.length > 20 && (
                              <p className="text-sm text-slate-500 text-center py-2">
                                + {otherCustomers.length - 20} fler kunder (sök för att hitta)
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {filteredCustomers.length === 0 && (
                        <div className="text-center py-8">
                          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                          <p className="text-slate-400">Inga kunder hittades</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-5"
                >
                  {/* Vald kund */}
                  <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Vald kund</p>
                        <p className="font-medium text-white">{selectedCustomerName}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm mb-4">
                    Var ska stationen placeras?
                  </p>

                  {/* Typval */}
                  <div className="space-y-3">
                    <button
                      onClick={() => handleTypeSelect('outdoor')}
                      className="w-full p-5 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                          <MapPin className="w-7 h-7 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg mb-1">Utomhus</h3>
                          <p className="text-sm text-slate-400">
                            Placera på karta med GPS-position
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 ml-auto" />
                      </div>
                    </button>

                    <button
                      onClick={() => handleTypeSelect('indoor')}
                      className="w-full p-5 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                          <Home className="w-7 h-7 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg mb-1">Inomhus</h3>
                          <p className="text-sm text-slate-400">
                            Placera på planritning
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 ml-auto" />
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Steg 3: Inomhusplacering */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col h-full"
                >
                  {loadingFloorPlans ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : floorPlans.length === 0 ? (
                    // Inga planritningar - visa uppladdningsvy
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                      <div className="text-center max-w-sm">
                        <Upload className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">Inga planritningar</h3>
                        <p className="text-slate-400 text-sm mb-6">
                          Ladda upp en planritning för att börja placera inomhusstationer hos {selectedCustomerName}.
                        </p>
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl transition-colors inline-flex items-center gap-2"
                        >
                          <Upload className="w-5 h-5" />
                          Ladda upp planritning
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Visa planritningar med stationsplacering
                    <div className="flex flex-col h-full">
                      {/* Planritningsval */}
                      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 flex-shrink-0">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {floorPlans.map((plan) => (
                            <button
                              key={plan.id}
                              onClick={() => handleSelectFloorPlan(plan)}
                              className={`
                                flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                                ${plan.id === selectedFloorPlan?.id
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                }
                              `}
                            >
                              {plan.name}
                              <span className={`ml-1.5 ${plan.id === selectedFloorPlan?.id ? 'text-cyan-200' : 'text-slate-500'}`}>
                                ({plan.station_count || 0})
                              </span>
                            </button>
                          ))}
                          <button
                            onClick={() => setShowUploadModal(true)}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/30 text-cyan-400 hover:bg-cyan-600/10 border border-dashed border-slate-600 hover:border-cyan-500 transition-all flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Ny
                          </button>
                        </div>
                      </div>

                      {/* Planritningsvisare */}
                      <div className="flex-1 min-h-0 relative">
                        {selectedFloorPlan?.image_url ? (
                          <FloorPlanViewer
                            imageUrl={selectedFloorPlan.image_url}
                            imageWidth={selectedFloorPlan.image_width}
                            imageHeight={selectedFloorPlan.image_height}
                            stations={stations}
                            placementMode={placementMode}
                            selectedType={selectedStationType}
                            previewPosition={previewPosition}
                            onImageClick={handleImageClick}
                            onCancelPlacement={resetPlacementMode}
                            height="calc(100vh - 380px)"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}

                        {/* FAB för att lägga till station */}
                        {placementMode === 'view' && selectedFloorPlan && (
                          <button
                            onClick={() => setShowTypeSelector(true)}
                            className="absolute bottom-4 right-4 w-14 h-14 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg shadow-cyan-600/30 flex items-center justify-center transition-all hover:scale-105 z-20"
                          >
                            <Plus className="w-6 h-6" />
                          </button>
                        )}
                      </div>

                      {/* Legend och info */}
                      {placementMode === 'view' && stations.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/50 flex-shrink-0">
                          <StationLegend />
                        </div>
                      )}

                      {/* Placeringsindikator */}
                      {placementMode === 'place' && (
                        <div className="px-4 py-3 bg-cyan-600/20 border-t border-cyan-500/30 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <p className="text-cyan-300 text-sm">
                              Klicka på planritningen för att placera stationen
                            </p>
                            <button
                              onClick={resetPlacementMode}
                              className="px-3 py-1 text-sm text-cyan-400 hover:text-white transition-colors"
                            >
                              Avbryt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modal: Ladda upp planritning */}
                  {showUploadModal && selectedCustomerId && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
                      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4">
                          <FloorPlanUploadForm
                            customerId={selectedCustomerId}
                            customerName={selectedCustomerName}
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
                            onSelect={(type) => startPlacementMode(type)}
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
                            existingStationNumbers={stations.map(s => s.station_number).filter(Boolean) as string[]}
                            onSubmit={handleCreateStation}
                            onCancel={() => { setShowStationForm(false); resetPlacementMode() }}
                            isSubmitting={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Kundknapp-komponent
function CustomerButton({
  customer,
  onClick,
  hasStations = false
}: {
  customer: CustomerOption
  onClick: () => void
  hasStations?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-slate-600/50 hover:bg-slate-800/50 transition-all text-left group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            hasStations ? 'bg-emerald-500/10' : 'bg-slate-700/50'
          }`}>
            <Building2 className={`w-4 h-4 ${hasStations ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <span className="font-medium text-white">{customer.company_name}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
      </div>
    </button>
  )
}

export default AddStationWizard
