// src/components/shared/indoor/IndoorEquipmentView.tsx
// Huvudvy för inomhusplacering av stationer

import { useState, useEffect, useCallback } from 'react'
import { Plus, Upload, Home, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

import { FloorPlanViewer } from './FloorPlanViewer'
import { FloorPlanSelector, FloorPlanChipSelector } from './FloorPlanSelector'
import { FloorPlanUploadForm } from './FloorPlanUploadForm'
import { IndoorStationForm, StationTypeSelector } from './IndoorStationForm'
import { IndoorStationDetailSheet, IndoorStationCard } from './IndoorStationDetailSheet'
import { StationLegend } from './IndoorStationMarker'

import { FloorPlanService } from '../../../services/floorPlanService'
import { IndoorStationService } from '../../../services/indoorStationService'

import type {
  FloorPlanWithRelations,
  IndoorStationWithRelations,
  IndoorStationInspectionWithRelations,
  PlacementMode,
  IndoorStationType,
  CreateFloorPlanInput,
  CreateIndoorStationInput,
  UpdateIndoorStationInput
} from '../../../types/indoor'
import type { StationType } from '../../../types/stationTypes'

import { useAuth } from '../../../contexts/AuthContext'

interface IndoorEquipmentViewProps {
  customerId: string | null
  customerName?: string
}

type ModalType = 'none' | 'upload' | 'station-type' | 'station-form' | 'station-detail'

export function IndoorEquipmentView({ customerId, customerName }: IndoorEquipmentViewProps) {
  const { profile } = useAuth()

  // Data state
  const [floorPlans, setFloorPlans] = useState<FloorPlanWithRelations[]>([])
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlanWithRelations | null>(null)
  const [stations, setStations] = useState<IndoorStationWithRelations[]>([])
  const [selectedStation, setSelectedStation] = useState<IndoorStationWithRelations | null>(null)
  const [stationInspections, setStationInspections] = useState<IndoorStationInspectionWithRelations[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [modalType, setModalType] = useState<ModalType>('none')
  const [placementMode, setPlacementMode] = useState<PlacementMode>('view')
  const [selectedType, setSelectedType] = useState<IndoorStationType | null>(null)
  const [selectedTypeData, setSelectedTypeData] = useState<StationType | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Hämta planritningar när kund ändras
  useEffect(() => {
    if (customerId) {
      loadFloorPlans(customerId)
    } else {
      setFloorPlans([])
      setSelectedFloorPlan(null)
      setStations([])
    }
  }, [customerId])

  // Hämta stationer när planritning ändras
  useEffect(() => {
    if (selectedFloorPlan) {
      loadStations(selectedFloorPlan.id)
    } else {
      setStations([])
    }
  }, [selectedFloorPlan?.id])

  // Ladda planritningar
  const loadFloorPlans = async (custId: string) => {
    setLoading(true)
    try {
      const plans = await FloorPlanService.getFloorPlansByCustomer(custId)
      setFloorPlans(plans)
      // Auto-välj första planritningen
      if (plans.length > 0 && !selectedFloorPlan) {
        setSelectedFloorPlan(plans[0])
      }
    } catch (error) {
      console.error('Fel vid laddning av planritningar:', error)
      toast.error('Kunde inte ladda planritningar')
    } finally {
      setLoading(false)
    }
  }

  // Ladda stationer
  const loadStations = async (floorPlanId: string) => {
    try {
      const stationList = await IndoorStationService.getStationsByFloorPlan(floorPlanId)
      setStations(stationList)
    } catch (error) {
      console.error('Fel vid laddning av stationer:', error)
      toast.error('Kunde inte ladda stationer')
    }
  }

  // Ladda inspektioner för vald station
  const loadStationInspections = async (stationId: string) => {
    try {
      const inspections = await IndoorStationService.getInspectionsByStation(stationId)
      setStationInspections(inspections)
    } catch (error) {
      console.error('Fel vid laddning av inspektioner:', error)
    }
  }

  // Hantera planritningsuppladdning
  const handleUploadFloorPlan = async (input: CreateFloorPlanInput) => {
    setIsSubmitting(true)
    try {
      const newPlan = await FloorPlanService.createFloorPlan(input, profile?.id)
      toast.success('Planritning uppladdad!')
      setModalType('none')
      if (customerId) {
        await loadFloorPlans(customerId)
        // Välj den nya planritningen
        const updatedPlan = await FloorPlanService.getFloorPlanById(newPlan.id)
        if (updatedPlan) {
          setSelectedFloorPlan(updatedPlan)
        }
      }
    } catch (error) {
      console.error('Fel vid uppladdning:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte ladda upp planritning')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hantera klick på bild (placering)
  const handleImageClick = useCallback((x: number, y: number) => {
    if (placementMode === 'place' && selectedType) {
      setPreviewPosition({ x, y })
      setModalType('station-form')
    } else if (placementMode === 'move' && selectedStation) {
      setPreviewPosition({ x, y })
      // Uppdatera stationens position
      handleMoveStation(x, y)
    }
  }, [placementMode, selectedType, selectedStation])

  // Hantera stationsklick
  const handleStationClick = (station: IndoorStationWithRelations) => {
    if (placementMode !== 'view') return
    setSelectedStation(station)
    loadStationInspections(station.id)
    setModalType('station-detail')
  }

  // Skapa ny station
  const handleCreateStation = async (input: CreateIndoorStationInput) => {
    setIsSubmitting(true)
    try {
      await IndoorStationService.createStation(
        input,
        profile?.technicians?.id
      )
      toast.success('Station placerad!')
      setModalType('none')
      resetPlacementMode()
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

  // Flytta station
  const handleMoveStation = async (x: number, y: number) => {
    if (!selectedStation) return

    setIsSubmitting(true)
    try {
      await IndoorStationService.updateStationPosition(selectedStation.id, x, y)
      toast.success('Station flyttad!')
      resetPlacementMode()
      if (selectedFloorPlan) {
        await loadStations(selectedFloorPlan.id)
      }
    } catch (error) {
      console.error('Fel vid flyttning av station:', error)
      toast.error('Kunde inte flytta station')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Ta bort station
  const handleDeleteStation = async () => {
    if (!selectedStation) return

    if (!confirm('Är du säker på att du vill ta bort denna station?')) return

    setIsSubmitting(true)
    try {
      await IndoorStationService.deleteStation(selectedStation.id)
      toast.success('Station borttagen')
      setModalType('none')
      setSelectedStation(null)
      if (selectedFloorPlan) {
        await loadStations(selectedFloorPlan.id)
        // Uppdatera planritningens stationsantal
        const updatedPlan = await FloorPlanService.getFloorPlanById(selectedFloorPlan.id)
        if (updatedPlan) setSelectedFloorPlan(updatedPlan)
      }
    } catch (error) {
      console.error('Fel vid borttagning av station:', error)
      toast.error('Kunde inte ta bort station')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Starta placeringsläge
  const startPlacementMode = (type: IndoorStationType, typeData?: StationType) => {
    setSelectedType(type)
    setSelectedTypeData(typeData || null)
    setPlacementMode('place')
    setModalType('none')
  }

  // Starta flyttläge
  const startMoveMode = () => {
    setPlacementMode('move')
    setModalType('none')
  }

  // Återställ placeringsläge
  const resetPlacementMode = () => {
    setPlacementMode('view')
    setSelectedType(null)
    setSelectedTypeData(null)
    setPreviewPosition(null)
    setSelectedStation(null)
  }

  // Hämta unika byggnadsnamn
  const existingBuildings = [...new Set(floorPlans.map(p => p.building_name).filter(Boolean))] as string[]

  // Ingen kund vald
  if (!customerId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Home className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Välj en kund</h3>
          <p className="text-slate-400 text-sm">
            Välj en kund för att se eller lägga till inomhusplaceringar
          </p>
        </div>
      </div>
    )
  }

  // Inga planritningar
  if (!loading && floorPlans.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Inga planritningar</h3>
          <p className="text-slate-400 text-sm mb-6">
            Ladda upp en planritning för att börja placera stationer inomhus.
          </p>
          <button
            onClick={() => setModalType('upload')}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Ladda upp planritning
          </button>
        </div>

        {/* Upload modal */}
        {modalType === 'upload' && (
          <Modal onClose={() => setModalType('none')}>
            <FloorPlanUploadForm
              customerId={customerId}
              customerName={customerName}
              existingBuildings={existingBuildings}
              onSubmit={handleUploadFloorPlan}
              onCancel={() => setModalType('none')}
              isSubmitting={isSubmitting}
            />
          </Modal>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Floor plan selector */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <FloorPlanSelector
            floorPlans={floorPlans}
            selectedId={selectedFloorPlan?.id}
            onSelect={setSelectedFloorPlan}
            onAddNew={() => setModalType('upload')}
            variant="dropdown"
          />
        </div>
      </div>

      {/* Main viewer */}
      {selectedFloorPlan?.image_url ? (
        <FloorPlanViewer
          imageUrl={selectedFloorPlan.image_url}
          imageWidth={selectedFloorPlan.image_width}
          imageHeight={selectedFloorPlan.image_height}
          stations={stations}
          selectedStationId={selectedStation?.id}
          placementMode={placementMode}
          selectedType={selectedType}
          selectedTypeData={selectedTypeData}
          previewPosition={previewPosition}
          onStationClick={handleStationClick}
          onImageClick={handleImageClick}
          onCancelPlacement={resetPlacementMode}
          height="calc(100vh - 250px)"
          showNumbers={true}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Legend */}
      {placementMode === 'view' && stations.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/50">
          <StationLegend />
        </div>
      )}

      {/* FAB button */}
      {placementMode === 'view' && selectedFloorPlan && (
        <button
          onClick={() => setModalType('station-type')}
          className="fixed bottom-24 right-4 w-14 h-14 bg-teal-600 hover:bg-teal-500 text-white rounded-full shadow-lg shadow-teal-600/30 flex items-center justify-center transition-all hover:scale-105 z-30"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      {modalType === 'upload' && (
        <Modal onClose={() => setModalType('none')}>
          <FloorPlanUploadForm
            customerId={customerId}
            customerName={customerName}
            existingBuildings={existingBuildings}
            onSubmit={handleUploadFloorPlan}
            onCancel={() => setModalType('none')}
            isSubmitting={isSubmitting}
          />
        </Modal>
      )}

      {modalType === 'station-type' && (
        <BottomSheet onClose={() => setModalType('none')}>
          <div className="p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Ny station</h3>
            <StationTypeSelector
              selectedType={selectedType}
              onSelect={(type, typeData) => startPlacementMode(type, typeData)}
            />
          </div>
        </BottomSheet>
      )}

      {modalType === 'station-form' && previewPosition && selectedFloorPlan && (
        <BottomSheet onClose={() => { setModalType('none'); resetPlacementMode() }}>
          <div className="p-4">
            <IndoorStationForm
              floorPlanId={selectedFloorPlan.id}
              position={previewPosition}
              existingStationNumbers={stations.map(s => s.station_number).filter(Boolean) as string[]}
              onSubmit={handleCreateStation}
              onCancel={() => { setModalType('none'); resetPlacementMode() }}
              isSubmitting={isSubmitting}
            />
          </div>
        </BottomSheet>
      )}

      {modalType === 'station-detail' && selectedStation && (
        <BottomSheet onClose={() => { setModalType('none'); setSelectedStation(null) }}>
          <IndoorStationDetailSheet
            station={selectedStation}
            inspections={stationInspections}
            onClose={() => { setModalType('none'); setSelectedStation(null) }}
            onEdit={() => {
              // TODO: Implement edit
              toast('Redigering kommer snart!')
            }}
            onMove={startMoveMode}
            onDelete={handleDeleteStation}
            onRegisterInspection={() => {
              // TODO: Implement inspection registration
              toast('Kontrollregistrering kommer snart!')
            }}
          />
        </BottomSheet>
      )}
    </div>
  )
}

// Simple Modal component
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Bottom sheet component
function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md md:mx-4 bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Drag handle för mobil */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>
        {children}
      </div>
    </div>
  )
}
