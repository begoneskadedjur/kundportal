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
  MessageSquare,
  ExternalLink
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
import type { IndoorStationWithRelations } from '../../types/indoor'
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
}

const CustomerEquipmentView: React.FC<CustomerEquipmentViewProps> = ({
  customerId,
  companyName
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
  const [isIndoorDetailSheetOpen, setIsIndoorDetailSheetOpen] = useState(false)

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

  // Hantera klick på utomhusstation
  const handleOutdoorStationClick = async (item: EquipmentPlacementWithRelations) => {
    setSelectedOutdoorStation(item)
    setIsOutdoorDetailSheetOpen(true)
    const inspections = await getOutdoorInspectionsByStation(item.id)
    setOutdoorStationInspections(inspections)
  }

  const handleCloseOutdoorDetailSheet = () => {
    setIsOutdoorDetailSheetOpen(false)
    setTimeout(() => {
      setSelectedOutdoorStation(null)
      setOutdoorStationInspections([])
    }, 300)
  }

  // Hantera klick på inomhusstation
  const handleIndoorStationClick = (station: IndoorStationWithRelations) => {
    setSelectedIndoorStation(station)
    setIsIndoorDetailSheetOpen(true)
  }

  const handleCloseIndoorDetailSheet = () => {
    setIsIndoorDetailSheetOpen(false)
    setTimeout(() => {
      setSelectedIndoorStation(null)
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar stationsöversikt...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-6 max-w-md text-center">
          <MapPin className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-white mb-2">Kunde inte ladda data</h2>
          <p className="text-slate-400 mb-4 text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Kompakt Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fällor & stationer</h1>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>{companyName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg text-slate-300 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 inline mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || equipment.length === 0}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <FileDown className="w-4 h-4 inline mr-1.5" />
              {exporting ? 'Exporterar...' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Kompakta sammanfattningskort */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700/50 p-3">
            <p className="text-xs text-slate-500 uppercase">Totalt</p>
            <p className="text-xl font-bold text-white">{equipment.length + totalIndoorStations}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700/50 p-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <p className="text-xs text-slate-500 uppercase">Utomhus</p>
            </div>
            <p className="text-xl font-bold text-white">{equipment.length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700/50 p-3">
            <div className="flex items-center gap-1.5">
              <Home className="w-3 h-3 text-blue-400" />
              <p className="text-xs text-slate-500 uppercase">Inomhus</p>
            </div>
            <p className="text-xl font-bold text-white">{totalIndoorStations}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700/50 p-3">
            <p className="text-xs text-slate-500 uppercase">Planritningar</p>
            <p className="text-xl font-bold text-white">{floorPlans.length}</p>
          </div>
        </div>

        {/* Sektion: Utomhus */}
        {equipment.length > 0 && (
          <section className="mb-8">
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
              />
            </div>

            {/* Tabell utomhus */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Nr</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Placerad</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Kommentar</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Foto</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {equipment.map((item, index) => {
                      const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status] || {
                        bgColor: 'bg-slate-500/20',
                        color: 'slate-400'
                      }
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                          onClick={() => handleOutdoorStationClick(item)}
                        >
                          <td className="px-4 py-2.5 text-white font-medium">{index + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: item.station_type_data?.color || '#6b7280' }}
                              />
                              <span className="text-slate-300">
                                {item.station_type_data?.name || item.equipment_type || 'Okänd'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor}`} style={{ color: statusConfig.color }}>
                              {getEquipmentStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{formatDate(item.placed_at)}</td>
                          <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate">
                            {item.comment || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {item.photo_url ? (
                              <Camera className="w-4 h-4 text-blue-400 mx-auto" />
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <ExternalLink className="w-4 h-4 text-slate-500 hover:text-emerald-400" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Sektion: Inomhus - per planritning */}
        {floorPlans.map((plan) => {
          const stations = indoorStationsByPlan[plan.id] || []
          if (stations.length === 0) return null

          return (
            <section key={plan.id} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">
                  {plan.building_name ? `${plan.building_name} - ` : ''}{plan.name}
                </h2>
                <span className="text-sm text-slate-400">({stations.length} stationer)</span>
              </div>

              {/* Planritning med stationsmarkörer */}
              {plan.image_url && (
                <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden mb-4">
                  <FloorPlanViewer
                    imageUrl={plan.image_url}
                    imageWidth={plan.image_width}
                    imageHeight={plan.image_height}
                    stations={stations}
                    selectedStationId={null}
                    placementMode="view"
                    selectedType={null}
                    previewPosition={null}
                    onStationClick={handleIndoorStationClick}
                    height="350px"
                    showNumbers={true}
                  />
                </div>
              )}

              {/* Tabell för planritning */}
              <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-700/50">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Nr</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Placerad</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Plats</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Kommentar</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Foto</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {stations.map((station) => {
                        const statusConfig = {
                          active: { bgColor: 'bg-emerald-500/20', color: '#10b981', label: 'Aktiv' },
                          inactive: { bgColor: 'bg-slate-500/20', color: '#6b7280', label: 'Inaktiv' },
                          needs_service: { bgColor: 'bg-amber-500/20', color: '#f59e0b', label: 'Behöver service' },
                          removed: { bgColor: 'bg-red-500/20', color: '#ef4444', label: 'Borttagen' }
                        }[station.status] || { bgColor: 'bg-slate-500/20', color: '#6b7280', label: station.status }

                        return (
                          <tr
                            key={station.id}
                            className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                            onClick={() => handleIndoorStationClick(station)}
                          >
                            <td className="px-4 py-2.5 text-white font-medium">{station.station_number || '-'}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: station.station_type_data?.color || '#6b7280' }}
                                />
                                <span className="text-slate-300">
                                  {station.station_type_data?.name || station.station_type || 'Okänd'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor}`} style={{ color: statusConfig.color }}>
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{formatDate(station.placed_at)}</td>
                            <td className="px-4 py-2.5 text-slate-400 max-w-[150px] truncate">
                              {station.location_description || '-'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 max-w-[150px] truncate">
                              {station.comment || '-'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {station.photo_url ? (
                                <Camera className="w-4 h-4 text-blue-400 mx-auto" />
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <ExternalLink className="w-4 h-4 text-slate-500 hover:text-blue-400" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )
        })}

        {/* Tom state */}
        {equipment.length === 0 && floorPlans.length === 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Ingen utrustning placerad</h3>
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
          inspections={[]}
          isOpen={isIndoorDetailSheetOpen}
          onClose={handleCloseIndoorDetailSheet}
        />
      )}
    </div>
  )
}

export default CustomerEquipmentView
