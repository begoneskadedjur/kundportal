// src/components/customer/CustomerEquipmentView.tsx - Kompakt kundanpassad utrustningsvy
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  MapPin,
  Shield,
  RefreshCw,
  FileDown,
  Home,
  Camera,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { EquipmentService } from '../../services/equipmentService'
import { FloorPlanService } from '../../services/floorPlanService'
import { IndoorStationService } from '../../services/indoorStationService'
import { getOutdoorInspectionsByStation } from '../../services/inspectionSessionService'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentStatusLabel
} from '../../types/database'
import type { OutdoorInspectionWithRelations } from '../../types/inspectionSession'
import type { IndoorStationWithRelations, IndoorStationInspectionWithRelations } from '../../types/indoor'
import type { FloorPlanWithRelations } from '../../services/floorPlanService'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { FloorPlanViewer } from '../shared/indoor/FloorPlanViewer'
import { CustomerOutdoorStationDetailSheet } from './CustomerOutdoorStationDetailSheet'
import { CustomerIndoorStationDetailSheet } from './CustomerIndoorStationDetailSheet'
import LoadingSpinner from '../shared/LoadingSpinner'
import { generateEquipmentPdf } from '../../utils/equipmentPdfGenerator'
import toast from 'react-hot-toast'

interface CustomerEquipmentViewProps {
  customerId: string
  companyName: string
  // Props för navigering från andra vyer (t.ex. Genomförda kontroller)
  highlightedStationId?: string | null
  highlightedStationType?: 'outdoor' | 'indoor' | null
  highlightedFloorPlanId?: string | null
}

const CustomerEquipmentView: React.FC<CustomerEquipmentViewProps> = ({
  customerId,
  companyName,
  highlightedStationId: externalHighlightedStationId,
  highlightedStationType: externalHighlightedStationType,
  highlightedFloorPlanId: externalHighlightedFloorPlanId
}) => {
  // State
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [floorPlans, setFloorPlans] = useState<FloorPlanWithRelations[]>([])
  const [indoorStationsByPlan, setIndoorStationsByPlan] = useState<Record<string, IndoorStationWithRelations[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Utomhus detail sheet
  const [selectedOutdoorStation, setSelectedOutdoorStation] = useState<EquipmentPlacementWithRelations | null>(null)
  const [outdoorStationInspections, setOutdoorStationInspections] = useState<OutdoorInspectionWithRelations[]>([])
  const [isOutdoorDetailSheetOpen, setIsOutdoorDetailSheetOpen] = useState(false)

  // Inomhus detail sheet
  const [selectedIndoorStation, setSelectedIndoorStation] = useState<IndoorStationWithRelations | null>(null)
  const [indoorStationInspections, setIndoorStationInspections] = useState<IndoorStationInspectionWithRelations[]>([])
  const [isIndoorDetailSheetOpen, setIsIndoorDetailSheetOpen] = useState(false)

  // Highlighted station (pulserar på karta/planritning)
  const [highlightedOutdoorStationId, setHighlightedOutdoorStationId] = useState<string | null>(null)
  const [highlightedIndoorStationId, setHighlightedIndoorStationId] = useState<string | null>(null)

  // Search + filter state (per sektion: outdoor och per planritning med plan.id som nyckel)
  const [outdoorSearch, setOutdoorSearch] = useState('')
  const [outdoorStatusFilter, setOutdoorStatusFilter] = useState('all')
  const [outdoorTypeFilter, setOutdoorTypeFilter] = useState('all')
  const [outdoorShowAll, setOutdoorShowAll] = useState(false)
  const [indoorSearch, setIndoorSearch] = useState<Record<string, string>>({})
  const [indoorStatusFilter, setIndoorStatusFilter] = useState<Record<string, string>>({})
  const [indoorShowAll, setIndoorShowAll] = useState<Record<string, boolean>>({})
  const SECTION_PAGE_SIZE = 50

  // Hämta all data
  const fetchData = useCallback(async () => {
    try {
      setError(null)

      // Hämta utomhusstationer och planritningar parallellt
      const [outdoorData, floorPlanData] = await Promise.all([
        EquipmentService.getEquipmentByCustomer(customerId),
        FloorPlanService.getFloorPlansByCustomer(customerId)
      ])

      setEquipment(outdoorData)
      setFloorPlans(floorPlanData)

      // Hämta inomhusstationer för varje planritning
      const indoorData: Record<string, IndoorStationWithRelations[]> = {}
      for (const plan of floorPlanData) {
        const stations = await IndoorStationService.getStationsByFloorPlan(plan.id)
        indoorData[plan.id] = stations
      }
      setIndoorStationsByPlan(indoorData)

    } catch (err) {
      console.error('Fel vid hämtning av utrustning:', err)
      setError('Kunde inte hämta utrustningsdata. Försök igen senare.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Hantera extern navigering (från Genomförda kontroller)
  useEffect(() => {
    if (externalHighlightedStationId && externalHighlightedStationType) {
      if (externalHighlightedStationType === 'outdoor') {
        setHighlightedOutdoorStationId(externalHighlightedStationId)
        // Scrolla till karta-sektionen
        const mapSection = document.getElementById('outdoor-section')
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } else if (externalHighlightedStationType === 'indoor' && externalHighlightedFloorPlanId) {
        setHighlightedIndoorStationId(externalHighlightedStationId)
        // Scrolla till rätt planritning
        const planSection = document.getElementById(`floor-plan-${externalHighlightedFloorPlanId}`)
        if (planSection) {
          planSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }, [externalHighlightedStationId, externalHighlightedStationType, externalHighlightedFloorPlanId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  // Räkna stationstyper dynamiskt (använd station_type_data)
  const typeStats = useMemo(() => {
    const stats = new Map<string, { label: string; color: string; count: number }>()

    equipment.forEach(item => {
      const typeName = item.station_type_data?.name || item.equipment_type || 'Okänd'
      const typeColor = item.station_type_data?.color || '#6b7280'

      if (stats.has(typeName)) {
        stats.get(typeName)!.count++
      } else {
        stats.set(typeName, { label: typeName, color: typeColor, count: 1 })
      }
    })

    return stats
  }, [equipment])

  // Total inomhusstationer
  const totalIndoorStations = useMemo(() => {
    return Object.values(indoorStationsByPlan).reduce((sum, stations) => sum + stations.length, 0)
  }, [indoorStationsByPlan])

  // Unika utomhustyper för filter-dropdown
  const outdoorTypes = useMemo(() => {
    const types = new Set(equipment.map(e => e.station_type_data?.name || e.equipment_type || 'Okänd'))
    return Array.from(types).sort()
  }, [equipment])

  // Filtrade utomhusstationer
  const filteredOutdoor = useMemo(() => {
    let result = equipment
    if (outdoorSearch) {
      const q = outdoorSearch.toLowerCase()
      result = result.filter(e =>
        (e.station_type_data?.name || e.equipment_type || '').toLowerCase().includes(q) ||
        (e.comment || '').toLowerCase().includes(q) ||
        (e.serial_number || '').toLowerCase().includes(q)
      )
    }
    if (outdoorStatusFilter !== 'all') {
      result = result.filter(e => (e.calculated_status || e.status) === outdoorStatusFilter)
    }
    if (outdoorTypeFilter !== 'all') {
      result = result.filter(e => (e.station_type_data?.name || e.equipment_type || 'Okänd') === outdoorTypeFilter)
    }
    return result
  }, [equipment, outdoorSearch, outdoorStatusFilter, outdoorTypeFilter])

  // Hantera klick på utomhusstation (från tabell eller karta)
  const handleOutdoorStationClick = async (item: EquipmentPlacementWithRelations) => {
    // Sätt highlighted för att visa pulsering på kartan
    setHighlightedOutdoorStationId(item.id)
    setSelectedOutdoorStation(item)
    setIsOutdoorDetailSheetOpen(true)
    const inspections = await getOutdoorInspectionsByStation(item.id)
    setOutdoorStationInspections(inspections)
  }

  const handleCloseOutdoorDetailSheet = () => {
    setIsOutdoorDetailSheetOpen(false)
    setHighlightedOutdoorStationId(null)
    setTimeout(() => {
      setSelectedOutdoorStation(null)
      setOutdoorStationInspections([])
    }, 300)
  }

  // Hantera klick på inomhusstation (från tabell eller planritning)
  const handleIndoorStationClick = async (station: IndoorStationWithRelations) => {
    // Sätt highlighted för att visa pulsering på planritningen
    setHighlightedIndoorStationId(station.id)
    setSelectedIndoorStation(station)
    setIsIndoorDetailSheetOpen(true)
    // Hämta inspektionshistorik för stationen
    const inspections = await IndoorStationService.getInspectionsByStation(station.id)
    setIndoorStationInspections(inspections)
  }

  const handleCloseIndoorDetailSheet = () => {
    setIsIndoorDetailSheetOpen(false)
    setHighlightedIndoorStationId(null)
    setTimeout(() => {
      setSelectedIndoorStation(null)
      setIndoorStationInspections([])
    }, 300)
  }

  // Formatera datum
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy", { locale: sv })
  }

  // PDF-export
  const handleExportPDF = async () => {
    if (equipment.length === 0) {
      toast.error('Ingen utrustning att exportera')
      return
    }

    setExporting(true)
    try {
      await generateEquipmentPdf({
        customerName: companyName,
        equipment
      })
      toast.success('PDF exporterad!')
    } catch (error) {
      console.error('Fel vid PDF-export:', error)
      toast.error('Kunde inte exportera PDF')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar stationsöversikt...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-md text-center">
          <MapPin className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-2">Kunde inte ladda data</h2>
          <p className="text-slate-400 mb-4 text-sm">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-slate-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">Fällor & stationer</h1>
              <p className="text-sm text-slate-500">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || equipment.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-emerald-400 hover:text-emerald-300 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              {exporting ? 'Exporterar...' : 'PDF'}
            </button>
          </div>
        </div>

        {/* KPI-rad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-800/50 border border-slate-700 rounded-xl divide-y divide-slate-700 sm:divide-y-0 sm:divide-x divide-slate-700">
          <div className="px-5 py-3">
            <p className="text-xs text-slate-500 mb-1">Totalt</p>
            <p className="text-2xl font-semibold text-white">{equipment.length + totalIndoorStations}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-slate-500 mb-1">Utomhus</p>
            <p className="text-2xl font-semibold text-white">{equipment.length}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-slate-500 mb-1">Inomhus</p>
            <p className="text-2xl font-semibold text-white">{totalIndoorStations}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-slate-500 mb-1">Planritningar</p>
            <p className="text-2xl font-semibold text-white">{floorPlans.length}</p>
          </div>
        </div>

        {/* Sektion: Utomhus */}
        {equipment.length > 0 && (
          <section id="outdoor-section" className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                Utomhus
                <span className="text-sm font-normal text-slate-400">({equipment.length} stationer)</span>
              </h2>
              {/* Typräkning */}
              <div className="flex items-center gap-3">
                {Array.from(typeStats.entries()).map(([typeName, data]) => (
                  <div key={typeName} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                    <span>{data.label}: {data.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Karta */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden mb-4">
              <EquipmentMap
                equipment={equipment}
                onEquipmentClick={handleOutdoorStationClick}
                height="350px"
                showControls={true}
                readOnly={true}
                enableClustering={equipment.length >= 10}
                showNumbers={true}
                highlightedStationId={highlightedOutdoorStationId}
              />
            </div>

            {/* Sökning + filter för utomhus */}
            <div className="flex flex-wrap gap-2 mb-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Sök station..."
                  value={outdoorSearch}
                  onChange={e => setOutdoorSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={outdoorStatusFilter}
                onChange={e => setOutdoorStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Alla statusar</option>
                <option value="ok">OK</option>
                <option value="warning">Varning</option>
                <option value="critical">Kritisk</option>
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
              {outdoorTypes.length > 1 && (
                <select
                  value={outdoorTypeFilter}
                  onChange={e => setOutdoorTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">Alla typer</option>
                  {outdoorTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>

            {/* Tabell utomhus */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              {filteredOutdoor.length === 0 && outdoorSearch ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  Inga stationer matchar sökningen
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/30 border-b border-slate-700">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Nr</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Typ</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Placerad</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Kommentar</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Foto</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {(outdoorShowAll ? filteredOutdoor : filteredOutdoor.slice(0, SECTION_PAGE_SIZE)).map((item, index) => {
                        const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status] || { bgColor: 'bg-slate-500/20', color: 'slate-400' }
                        return (
                          <tr key={item.id} className="hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => handleOutdoorStationClick(item)}>
                            <td className="px-4 py-2 text-white font-medium text-sm">{index + 1}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.station_type_data?.color || '#6b7280' }} />
                                <span className="text-slate-300 text-sm">{item.station_type_data?.name || item.equipment_type || 'Okänd'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor}`} style={{ color: statusConfig.color }}>
                                {getEquipmentStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-400 text-sm">{formatDate(item.placed_at)}</td>
                            <td className="px-4 py-2 text-slate-400 text-sm max-w-[200px] truncate">{item.comment || '—'}</td>
                            <td className="px-4 py-2 text-center">
                              {item.photo_path ? <Camera className="w-3.5 h-3.5 text-blue-400 mx-auto" /> : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-400" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!outdoorShowAll && filteredOutdoor.length > SECTION_PAGE_SIZE && (
                <div className="px-4 py-2.5 border-t border-slate-700 text-center">
                  <button
                    onClick={() => setOutdoorShowAll(true)}
                    className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Visa alla {filteredOutdoor.length} stationer
                  </button>
                </div>
              )}
              {outdoorShowAll && filteredOutdoor.length > SECTION_PAGE_SIZE && (
                <div className="px-4 py-2.5 border-t border-slate-700 text-center">
                  <button
                    onClick={() => setOutdoorShowAll(false)}
                    className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                    Visa färre
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Sektion: Inomhus - per planritning */}
        {floorPlans.map((plan) => {
          const stations = indoorStationsByPlan[plan.id] || []
          if (stations.length === 0) return null

          // Räkna stationstyper för denna planritning
          const planTypeStats = new Map<string, { label: string; color: string; count: number }>()
          stations.forEach(station => {
            const typeName = station.station_type_data?.name || station.station_type || 'Okänd'
            const typeColor = station.station_type_data?.color || '#6b7280'
            if (planTypeStats.has(typeName)) {
              planTypeStats.get(typeName)!.count++
            } else {
              planTypeStats.set(typeName, { label: typeName, color: typeColor, count: 1 })
            }
          })

          return (
            <section key={plan.id} id={`floor-plan-${plan.id}`} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">
                    {plan.building_name ? `${plan.building_name} - ` : ''}{plan.name}
                  </h2>
                  <span className="text-sm text-slate-400">({stations.length} stationer)</span>
                </div>
                {/* Typräkning för planritningen */}
                <div className="flex items-center gap-3">
                  {Array.from(planTypeStats.entries()).map(([typeName, data]) => (
                    <div key={typeName} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                      <span>{data.label}: {data.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Planritning med stationsmarkörer - fyller hela rutan */}
              {plan.image_url && (
                <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden mb-4">
                  <FloorPlanViewer
                    imageUrl={plan.image_url}
                    imageWidth={plan.image_width}
                    imageHeight={plan.image_height}
                    stations={stations}
                    selectedStationId={selectedIndoorStation?.id}
                    placementMode="view"
                    selectedType={null}
                    previewPosition={null}
                    onStationClick={handleIndoorStationClick}
                    height="450px"
                    showNumbers={true}
                    highlightedStationId={highlightedIndoorStationId}
                  />
                </div>
              )}

              {/* Sökning för inomhussektion */}
              {(() => {
                const planSearch = indoorSearch[plan.id] || ''
                const planStatusFilter = indoorStatusFilter[plan.id] || 'all'
                const showAll = indoorShowAll[plan.id] || false
                const filteredStations = stations.filter(s => {
                  if (planSearch) {
                    const q = planSearch.toLowerCase()
                    if (!(
                      (s.station_type_data?.name || s.station_type || '').toLowerCase().includes(q) ||
                      (s.location_description || '').toLowerCase().includes(q) ||
                      (s.comment || '').toLowerCase().includes(q) ||
                      String(s.station_number || '').includes(q)
                    )) return false
                  }
                  if (planStatusFilter !== 'all' && s.status !== planStatusFilter) return false
                  return true
                })
                const visibleStations = showAll ? filteredStations : filteredStations.slice(0, SECTION_PAGE_SIZE)

                return (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Sök station..."
                          value={planSearch}
                          onChange={e => setIndoorSearch(prev => ({ ...prev, [plan.id]: e.target.value }))}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <select
                        value={planStatusFilter}
                        onChange={e => setIndoorStatusFilter(prev => ({ ...prev, [plan.id]: e.target.value }))}
                        className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none"
                      >
                        <option value="all">Alla statusar</option>
                        <option value="active">Aktiv</option>
                        <option value="inactive">Inaktiv</option>
                        <option value="needs_service">Behöver service</option>
                        <option value="removed">Borttagen</option>
                      </select>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                      {filteredStations.length === 0 && planSearch ? (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">Inga stationer matchar sökningen</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-900/30 border-b border-slate-700">
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Nr</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Typ</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Placerad</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Plats</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Kommentar</th>
                                <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Foto</th>
                                <th className="px-4 py-2.5"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/40">
                              {visibleStations.map(station => {
                                const statusConfig = {
                                  active: { bgColor: 'bg-emerald-500/10', color: '#10b981', label: 'Aktiv' },
                                  inactive: { bgColor: 'bg-slate-500/20', color: '#6b7280', label: 'Inaktiv' },
                                  needs_service: { bgColor: 'bg-amber-500/10', color: '#f59e0b', label: 'Service' },
                                  removed: { bgColor: 'bg-red-500/10', color: '#ef4444', label: 'Borttagen' }
                                }[station.status] || { bgColor: 'bg-slate-500/20', color: '#6b7280', label: station.status }
                                return (
                                  <tr key={station.id} className="hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => handleIndoorStationClick(station)}>
                                    <td className="px-4 py-2 text-white font-medium text-sm">{station.station_number || '—'}</td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: station.station_type_data?.color || '#6b7280' }} />
                                        <span className="text-slate-300 text-sm">{station.station_type_data?.name || station.station_type || 'Okänd'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor}`} style={{ color: statusConfig.color }}>{statusConfig.label}</span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-400 text-sm">{formatDate(station.placed_at)}</td>
                                    <td className="px-4 py-2 text-slate-400 text-sm max-w-[130px] truncate">{station.location_description || '—'}</td>
                                    <td className="px-4 py-2 text-slate-400 text-sm max-w-[130px] truncate">{station.comment || '—'}</td>
                                    <td className="px-4 py-2 text-center">
                                      {station.photo_path ? <Camera className="w-3.5 h-3.5 text-blue-400 mx-auto" /> : <span className="text-slate-600 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400" />
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {!showAll && filteredStations.length > SECTION_PAGE_SIZE && (
                        <div className="px-4 py-2.5 border-t border-slate-700 text-center">
                          <button onClick={() => setIndoorShowAll(prev => ({ ...prev, [plan.id]: true }))} className="flex items-center gap-1.5 mx-auto text-sm text-slate-400 hover:text-white transition-colors">
                            <ChevronDown className="w-4 h-4" />
                            Visa alla {filteredStations.length} stationer
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </section>
          )
        })}

        {/* Tom state */}
        {equipment.length === 0 && floorPlans.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-white mb-1">Ingen utrustning placerad</h3>
            <p className="text-slate-400 text-sm">
              När vår tekniker placerar utrustning hos er kommer den att visas här.
            </p>
          </div>
        )}
      </div>

      {/* Detail Sheets */}
      {selectedOutdoorStation && (
        <CustomerOutdoorStationDetailSheet
          station={selectedOutdoorStation}
          inspections={outdoorStationInspections}
          isOpen={isOutdoorDetailSheetOpen}
          onClose={handleCloseOutdoorDetailSheet}
        />
      )}

      {selectedIndoorStation && (
        <CustomerIndoorStationDetailSheet
          station={selectedIndoorStation}
          inspections={indoorStationInspections}
          isOpen={isIndoorDetailSheetOpen}
          onClose={handleCloseIndoorDetailSheet}
        />
      )}
    </>
  )
}

export default CustomerEquipmentView
