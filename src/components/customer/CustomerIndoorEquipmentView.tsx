// src/components/customer/CustomerIndoorEquipmentView.tsx
// Read-only vy för kundens inomhusplacerade stationer

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Home, Building2, RefreshCw, FileDown, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

import { FloorPlanViewer } from '../shared/indoor/FloorPlanViewer'
import { FloorPlanSelector } from '../shared/indoor/FloorPlanSelector'
import { StationLegend } from '../shared/indoor/IndoorStationMarker'
import { CustomerIndoorStationDetailSheet } from './CustomerIndoorStationDetailSheet'

import { FloorPlanService } from '../../services/floorPlanService'
import { IndoorStationService } from '../../services/indoorStationService'

import type {
  FloorPlanWithRelations,
  IndoorStationWithRelations,
  IndoorStationInspectionWithRelations,
  IndoorStationType,
  IndoorStationStatus
} from '../../types/indoor'
import {
  INDOOR_STATION_TYPE_CONFIG,
  INDOOR_STATION_STATUS_CONFIG
} from '../../types/indoor'

interface CustomerIndoorEquipmentViewProps {
  customerId: string
  companyName: string
}

export function CustomerIndoorEquipmentView({
  customerId,
  companyName
}: CustomerIndoorEquipmentViewProps) {
  // Data state
  const [floorPlans, setFloorPlans] = useState<FloorPlanWithRelations[]>([])
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlanWithRelations | null>(null)
  const [stations, setStations] = useState<IndoorStationWithRelations[]>([])
  const [selectedStation, setSelectedStation] = useState<IndoorStationWithRelations | null>(null)
  const [stationInspections, setStationInspections] = useState<IndoorStationInspectionWithRelations[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [filterType, setFilterType] = useState<IndoorStationType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<IndoorStationStatus | 'all'>('all')

  // Hämta planritningar
  const loadFloorPlans = useCallback(async () => {
    try {
      const plans = await FloorPlanService.getFloorPlansByCustomer(customerId)
      setFloorPlans(plans)
      // Auto-välj första planritningen
      if (plans.length > 0 && !selectedFloorPlan) {
        setSelectedFloorPlan(plans[0])
      }
    } catch (error) {
      console.error('Fel vid laddning av planritningar:', error)
      toast.error('Kunde inte ladda planritningar')
    }
  }, [customerId, selectedFloorPlan])

  // Hämta stationer för vald planritning
  const loadStations = useCallback(async (floorPlanId: string) => {
    try {
      const stationList = await IndoorStationService.getStationsByFloorPlan(floorPlanId)
      setStations(stationList)
    } catch (error) {
      console.error('Fel vid laddning av stationer:', error)
      toast.error('Kunde inte ladda stationer')
    }
  }, [])

  // Hämta inspektioner för vald station
  const loadStationInspections = useCallback(async (stationId: string) => {
    try {
      const inspections = await IndoorStationService.getInspectionsByStation(stationId)
      setStationInspections(inspections)
    } catch (error) {
      console.error('Fel vid laddning av inspektioner:', error)
    }
  }, [])

  // Initial laddning
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadFloorPlans()
      setLoading(false)
    }
    init()
  }, [customerId])

  // Ladda stationer när planritning ändras
  useEffect(() => {
    if (selectedFloorPlan) {
      loadStations(selectedFloorPlan.id)
    } else {
      setStations([])
    }
  }, [selectedFloorPlan?.id, loadStations])

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadFloorPlans()
    if (selectedFloorPlan) {
      await loadStations(selectedFloorPlan.id)
    }
    setRefreshing(false)
  }

  // Hantera stationsklick
  const handleStationClick = (station: IndoorStationWithRelations) => {
    setSelectedStation(station)
    loadStationInspections(station.id)
    setIsDetailSheetOpen(true)
  }

  // Stäng detail sheet
  const handleCloseDetailSheet = () => {
    setIsDetailSheetOpen(false)
    setTimeout(() => setSelectedStation(null), 300)
  }

  // Filtrerade stationer
  const filteredStations = useMemo(() => {
    return stations.filter(station => {
      if (filterType !== 'all' && station.station_type !== filterType) return false
      if (filterStatus !== 'all' && station.status !== filterStatus) return false
      return true
    })
  }, [stations, filterType, filterStatus])

  // Statistik för inomhusstationer
  const stats = useMemo(() => {
    const allStations = stations
    return {
      total: allStations.length,
      active: allStations.filter(s => s.status === 'active').length,
      byType: {
        mechanical_trap: allStations.filter(s => s.station_type === 'mechanical_trap').length,
        concrete_station: allStations.filter(s => s.station_type === 'concrete_station').length,
        bait_station: allStations.filter(s => s.station_type === 'bait_station').length
      }
    }
  }, [stations])

  // Totalt antal stationer på alla planritningar
  const totalStationsAllFloorPlans = useMemo(() => {
    return floorPlans.reduce((sum, fp) => sum + (fp.station_count || 0), 0)
  }, [floorPlans])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Laddar inomhusstationer...</p>
        </div>
      </div>
    )
  }

  // Inga planritningar
  if (floorPlans.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Inga inomhusstationer</h3>
          <p className="text-slate-400 text-sm">
            Inga planritningar eller inomhusplaceringar har registrerats för er anläggning ännu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Floor plan selector och filter */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Planritningsväljare */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Building2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0 max-w-md">
              <FloorPlanSelector
                floorPlans={floorPlans}
                selectedId={selectedFloorPlan?.id}
                onSelect={setSelectedFloorPlan}
                variant="dropdown"
                showStationCount={true}
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
            </div>

            {/* Type filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as IndoorStationType | 'all')}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">Alla typer</option>
              {Object.entries(INDOOR_STATION_TYPE_CONFIG).map(([type, config]) => (
                <option key={type} value={type}>
                  {config.label} ({stats.byType[type as IndoorStationType]})
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as IndoorStationStatus | 'all')}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">Alla statusar</option>
              {Object.entries(INDOOR_STATION_STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              ))}
            </select>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>
        </div>

        {/* Planritningsinfo */}
        {selectedFloorPlan && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-slate-400">
                <span className="text-white font-medium">{selectedFloorPlan.name}</span>
                {selectedFloorPlan.building_name && (
                  <span className="text-slate-500"> - {selectedFloorPlan.building_name}</span>
                )}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-medium">
                {filteredStations.length} stationer
                {filteredStations.length !== stations.length && (
                  <span className="text-slate-500 font-normal"> (av {stations.length})</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Planritningsvy */}
      {selectedFloorPlan?.image_url ? (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
          <FloorPlanViewer
            imageUrl={selectedFloorPlan.image_url}
            imageWidth={selectedFloorPlan.image_width}
            imageHeight={selectedFloorPlan.image_height}
            stations={filteredStations}
            selectedStationId={selectedStation?.id}
            placementMode="view"
            selectedType={null}
            previewPosition={null}
            onStationClick={handleStationClick}
            height="500px"
            showNumbers={true}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center p-12 bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Legend */}
      {stations.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4">
          <StationLegend />
        </div>
      )}

      {/* Tom-state för inga stationer på denna planritning */}
      {selectedFloorPlan && stations.length === 0 && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8 text-center">
          <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Home className="w-6 h-6 text-slate-500" />
          </div>
          <h3 className="text-white font-medium mb-1">Inga stationer på denna planritning</h3>
          <p className="text-slate-400 text-sm">
            Denna planritning har ännu inga registrerade stationer.
          </p>
        </div>
      )}

      {/* Customer-friendly detail sheet */}
      {selectedStation && (
        <CustomerIndoorStationDetailSheet
          station={selectedStation}
          inspections={stationInspections}
          isOpen={isDetailSheetOpen}
          onClose={handleCloseDetailSheet}
        />
      )}
    </div>
  )
}

export default CustomerIndoorEquipmentView
