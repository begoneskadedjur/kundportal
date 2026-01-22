// src/components/customer/InspectionSessionsView.tsx
// Genomförda kontroller - Inspektionshistorik för kundportalen
// Omdesignad med kompakt tabellformat och tröskelvärdesbaserade färgindikatorer

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  ClipboardCheck,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  Home,
  Camera,
  Clock,
  TrendingUp,
  ExternalLink,
  X,
  Eye,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { EquipmentService } from '../../services/equipmentService'
import { FloorPlanService } from '../../services/floorPlanService'
import { IndoorStationService } from '../../services/indoorStationService'
import {
  getCompletedSessionsForCustomer,
  getCompletedSessionsWithSummary,
  getOutdoorInspectionsByStation,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession,
} from '../../services/inspectionSessionService'
import { useDebounce } from '../../hooks/useDebounce'
import type { EquipmentPlacementWithRelations } from '../../types/database'
import type { FloorPlanWithRelations } from '../../services/floorPlanService'
import type {
  IndoorStationWithRelations,
  IndoorStationInspectionWithRelations,
  InspectionStatus
} from '../../types/indoor'
import type { OutdoorInspectionWithRelations, InspectionSessionWithRelations } from '../../types/inspectionSession'
import { INSPECTION_STATUS_CONFIG } from '../../types/indoor'
import { calculateStationStatus, CALCULATED_STATUS_CONFIG, MEASUREMENT_UNIT_CONFIG, type CalculatedStatus } from '../../types/stationTypes'
import { InspectionPhotoLightbox } from './InspectionPhotoLightbox'
import { CustomerOutdoorStationDetailSheet } from './CustomerOutdoorStationDetailSheet'
import { CustomerIndoorStationDetailSheet } from './CustomerIndoorStationDetailSheet'
import LoadingSpinner from '../shared/LoadingSpinner'

interface InspectionSessionsViewProps {
  customerId: string
  companyName: string
  onNavigateToStation?: (stationId: string, type: 'outdoor' | 'indoor', floorPlanId?: string) => void
}

// Utökad typ med senaste inspektion och mätvärde
interface StationWithLatestInspection {
  id: string
  stationNumber: string | null
  stationType: string
  typeColor: string
  measurementLabel: string | null
  measurementUnit: string
  thresholdWarning: number | null
  thresholdCritical: number | null
  thresholdDirection: 'above' | 'below'
  latestInspection: {
    id: string
    inspectedAt: string
    status: InspectionStatus
    findings: string | null
    photoUrl: string | null
    measurementValue: number | null
    technicianName: string | null
  } | null
  calculatedStatus: CalculatedStatus
  // Original data för detail sheets
  originalOutdoorStation?: EquipmentPlacementWithRelations
  originalIndoorStation?: IndoorStationWithRelations
  floorPlanId?: string
  floorPlanName?: string
}

// Sektion med stationer
interface StationSection {
  id: string
  name: string
  icon: 'outdoor' | 'indoor'
  buildingName?: string | null
  stations: StationWithLatestInspection[]
}

export function InspectionSessionsView({ customerId, companyName, onNavigateToStation }: InspectionSessionsViewProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sections, setSections] = useState<StationSection[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; caption: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // Detail sheet state
  const [selectedOutdoorStation, setSelectedOutdoorStation] = useState<EquipmentPlacementWithRelations | null>(null)
  const [outdoorInspections, setOutdoorInspections] = useState<OutdoorInspectionWithRelations[]>([])
  const [isOutdoorDetailOpen, setIsOutdoorDetailOpen] = useState(false)

  const [selectedIndoorStation, setSelectedIndoorStation] = useState<IndoorStationWithRelations | null>(null)
  const [indoorInspections, setIndoorInspections] = useState<IndoorStationInspectionWithRelations[]>([])
  const [isIndoorDetailOpen, setIsIndoorDetailOpen] = useState(false)

  // Sammanfattningsstatistik
  const [lastInspectionDate, setLastInspectionDate] = useState<string | null>(null)
  const [lastTechnicianName, setLastTechnicianName] = useState<string | null>(null)
  const [totalStations, setTotalStations] = useState(0)
  const [statusCounts, setStatusCounts] = useState({ ok: 0, warning: 0, critical: 0, noInspection: 0 })

  // Historik-sektion
  const [showHistory, setShowHistory] = useState(false)
  const [historySessions, setHistorySessions] = useState<InspectionSessionWithRelations[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Modal för historik-detaljer
  const [selectedHistorySession, setSelectedHistorySession] = useState<InspectionSessionWithRelations | null>(null)
  const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false)
  const [historyDetailSections, setHistoryDetailSections] = useState<StationSection[]>([])
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // Ladda all data
  const fetchData = useCallback(async () => {
    try {
      // Hämta utomhusstationer och planritningar parallellt
      const [outdoorStations, floorPlanData, sessionsData] = await Promise.all([
        EquipmentService.getEquipmentByCustomer(customerId),
        FloorPlanService.getFloorPlansByCustomer(customerId),
        getCompletedSessionsForCustomer(customerId, 1) // Senaste session för sammanfattning
      ])

      // Sätt senaste session-info
      if (sessionsData.length > 0) {
        setLastInspectionDate(sessionsData[0].completed_at)
        setLastTechnicianName(sessionsData[0].technician?.name || null)
      }

      // Hämta senaste inspektion för varje utomhusstation
      const outdoorWithInspections = await Promise.all(
        outdoorStations.map(async (station) => {
          const inspections = await getOutdoorInspectionsByStation(station.id)
          const latest = inspections.length > 0 ? inspections[0] : null

          // Beräkna status baserat på tröskelvärden
          const stationType = station.station_type_data
          const measurementValue = latest?.measurement_value ?? null
          let calculatedStatus: CalculatedStatus = 'ok'

          if (stationType && measurementValue !== null) {
            calculatedStatus = calculateStationStatus(
              {
                ...stationType,
                description: null,
                requires_serial_number: false,
                is_active: true,
                sort_order: 0,
                created_at: '',
                updated_at: ''
              } as any,
              measurementValue
            )
          }

          return {
            id: station.id,
            stationNumber: station.serial_number,
            stationType: stationType?.name || station.equipment_type || 'Okänd',
            typeColor: stationType?.color || '#6b7280',
            measurementLabel: stationType?.measurement_label || null,
            measurementUnit: stationType?.measurement_unit || 'st',
            thresholdWarning: stationType?.threshold_warning ?? null,
            thresholdCritical: stationType?.threshold_critical ?? null,
            thresholdDirection: (stationType?.threshold_direction || 'above') as 'above' | 'below',
            latestInspection: latest ? {
              id: latest.id,
              inspectedAt: latest.inspected_at,
              status: latest.status as InspectionStatus,
              findings: latest.findings,
              photoUrl: latest.photo_url,
              measurementValue: latest.measurement_value,
              technicianName: latest.technician?.name || null
            } : null,
            calculatedStatus,
            originalOutdoorStation: station
          } as StationWithLatestInspection
        })
      )

      // Hämta inomhusstationer för varje planritning
      const indoorSections: StationSection[] = []
      for (const plan of floorPlanData) {
        const stations = await IndoorStationService.getStationsByFloorPlan(plan.id)

        // Hämta senaste inspektion för varje inomhusstation
        const stationsWithInspections = await Promise.all(
          stations.map(async (station) => {
            const inspections = await IndoorStationService.getInspectionsByStation(station.id)
            const latest = inspections.length > 0 ? inspections[0] : null

            // Beräkna status baserat på tröskelvärden
            const stationType = station.station_type_data
            const measurementValue = latest?.measurement_value ?? null
            let calculatedStatus: CalculatedStatus = 'ok'

            if (stationType && measurementValue !== null) {
              calculatedStatus = calculateStationStatus(
                {
                  ...stationType,
                  description: null,
                  requires_serial_number: false,
                  is_active: true,
                  sort_order: 0,
                  created_at: '',
                  updated_at: ''
                } as any,
                measurementValue
              )
            }

            return {
              id: station.id,
              stationNumber: station.station_number,
              stationType: stationType?.name || station.station_type || 'Okänd',
              typeColor: stationType?.color || '#6b7280',
              measurementLabel: stationType?.measurement_label || null,
              measurementUnit: stationType?.measurement_unit || 'st',
              thresholdWarning: stationType?.threshold_warning ?? null,
              thresholdCritical: stationType?.threshold_critical ?? null,
              thresholdDirection: (stationType?.threshold_direction || 'above') as 'above' | 'below',
              latestInspection: latest ? {
                id: latest.id,
                inspectedAt: latest.inspected_at,
                status: latest.status as InspectionStatus,
                findings: latest.findings,
                photoUrl: latest.photo_url,
                measurementValue: latest.measurement_value ?? null,
                technicianName: latest.technician?.name || null
              } : null,
              calculatedStatus,
              originalIndoorStation: station,
              floorPlanId: plan.id,
              floorPlanName: plan.name
            } as StationWithLatestInspection
          })
        )

        if (stationsWithInspections.length > 0) {
          indoorSections.push({
            id: plan.id,
            name: plan.name,
            icon: 'indoor',
            buildingName: plan.building_name,
            stations: stationsWithInspections
          })
        }
      }

      // Bygg sektioner
      const allSections: StationSection[] = []

      if (outdoorWithInspections.length > 0) {
        allSections.push({
          id: 'outdoor',
          name: 'Utomhus',
          icon: 'outdoor',
          stations: outdoorWithInspections
        })
      }

      allSections.push(...indoorSections)
      setSections(allSections)

      // Räkna statistik
      const allStations = allSections.flatMap(s => s.stations)
      setTotalStations(allStations.length)

      const counts = { ok: 0, warning: 0, critical: 0, noInspection: 0 }
      allStations.forEach(station => {
        if (!station.latestInspection) {
          counts.noInspection++
        } else if (station.calculatedStatus === 'critical') {
          counts.critical++
        } else if (station.calculatedStatus === 'warning') {
          counts.warning++
        } else {
          counts.ok++
        }
      })
      setStatusCounts(counts)

    } catch (error) {
      console.error('Error fetching inspection data:', error)
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

  // Ladda historiska sessioner (on-demand)
  const loadHistorySessions = async () => {
    if (historyLoaded || loadingHistory) return

    setLoadingHistory(true)
    try {
      // Hämta de senaste 10 sessionerna med sammanfattning (exkludera den senaste som redan visas)
      const sessions = await getCompletedSessionsWithSummary(customerId, 11)
      // Skippa första (den visas redan i sammanfattningen)
      setHistorySessions(sessions.slice(1))
      setHistoryLoaded(true)
    } catch (error) {
      console.error('Error loading history sessions:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Toggle historik-sektion
  const handleToggleHistory = () => {
    const newShowHistory = !showHistory
    setShowHistory(newShowHistory)
    if (newShowHistory && !historyLoaded) {
      loadHistorySessions()
    }
  }

  // Öppna historisk session i modal
  const handleOpenHistorySession = async (session: InspectionSessionWithRelations) => {
    setSelectedHistorySession(session)
    setIsHistoryModalOpen(true)
    setLoadingHistoryDetail(true)

    try {
      // Hämta inspektionsdata för denna session
      const [outdoorInspections, indoorInspections] = await Promise.all([
        getOutdoorInspectionsForSession(session.id),
        getIndoorInspectionsForSession(session.id)
      ])

      // Omvandla till StationSection-format
      const detailSections: StationSection[] = []

      // Utomhussektioner
      if (outdoorInspections.length > 0) {
        const outdoorStations: StationWithLatestInspection[] = outdoorInspections.map(insp => {
          const station = insp.station as any
          const stationTypeData = station?.station_type_data
          const measurementValue = insp.measurement_value

          let calculatedStatus: CalculatedStatus = 'ok'
          if (stationTypeData && measurementValue !== null) {
            calculatedStatus = calculateStationStatus(
              {
                ...stationTypeData,
                description: null,
                requires_serial_number: false,
                is_active: true,
                threshold_warning: stationTypeData.threshold_warning ?? null,
                threshold_critical: stationTypeData.threshold_critical ?? null,
                threshold_direction: stationTypeData.threshold_direction ?? 'above'
              },
              measurementValue
            )
          }

          return {
            id: station?.id || insp.id,
            stationNumber: station?.serial_number || 'Okänd',
            stationType: stationTypeData?.name || station?.equipment_type || 'Okänd typ',
            typeColor: stationTypeData?.color || '#6b7280',
            measurementLabel: stationTypeData?.measurement_label || null,
            measurementUnit: stationTypeData?.measurement_unit || 'numeric',
            thresholdWarning: stationTypeData?.threshold_warning ?? null,
            thresholdCritical: stationTypeData?.threshold_critical ?? null,
            thresholdDirection: stationTypeData?.threshold_direction ?? 'above',
            latestInspection: {
              id: insp.id,
              inspectedAt: insp.inspected_at,
              status: insp.status as InspectionStatus,
              findings: insp.findings,
              photoUrl: insp.photo_url,
              measurementValue: insp.measurement_value,
              technicianName: insp.technician?.name || null
            },
            calculatedStatus
          }
        })

        detailSections.push({
          id: 'outdoor',
          name: 'Utomhus',
          icon: 'outdoor',
          stations: outdoorStations
        })
      }

      // Inomhussektioner - gruppera per planritning
      if (indoorInspections.length > 0) {
        const byFloorPlan = new Map<string, typeof indoorInspections>()

        indoorInspections.forEach(insp => {
          const station = insp.station as any
          const floorPlan = station?.floor_plan
          const planId = floorPlan?.id || 'unknown'
          if (!byFloorPlan.has(planId)) {
            byFloorPlan.set(planId, [])
          }
          byFloorPlan.get(planId)!.push(insp)
        })

        byFloorPlan.forEach((planInspections, planId) => {
          const firstInsp = planInspections[0]
          const floorPlan = (firstInsp.station as any)?.floor_plan

          const indoorStations: StationWithLatestInspection[] = planInspections.map(insp => {
            const station = insp.station as any
            const stationTypeData = station?.station_type_data
            const measurementValue = insp.measurement_value

            let calculatedStatus: CalculatedStatus = 'ok'
            if (stationTypeData && measurementValue !== null) {
              calculatedStatus = calculateStationStatus(
                {
                  ...stationTypeData,
                  description: null,
                  requires_serial_number: false,
                  is_active: true,
                  threshold_warning: stationTypeData.threshold_warning ?? null,
                  threshold_critical: stationTypeData.threshold_critical ?? null,
                  threshold_direction: stationTypeData.threshold_direction ?? 'above'
                },
                measurementValue
              )
            }

            return {
              id: station?.id || insp.id,
              stationNumber: station?.station_number?.toString() || 'Okänd',
              stationType: stationTypeData?.name || station?.station_type || 'Okänd typ',
              typeColor: stationTypeData?.color || '#6b7280',
              measurementLabel: stationTypeData?.measurement_label || null,
              measurementUnit: stationTypeData?.measurement_unit || 'numeric',
              thresholdWarning: stationTypeData?.threshold_warning ?? null,
              thresholdCritical: stationTypeData?.threshold_critical ?? null,
              thresholdDirection: stationTypeData?.threshold_direction ?? 'above',
              latestInspection: {
                id: insp.id,
                inspectedAt: insp.inspected_at,
                status: insp.status as InspectionStatus,
                findings: insp.findings,
                photoUrl: insp.photo_url,
                measurementValue: insp.measurement_value ?? null,
                technicianName: insp.technician?.name || null
              },
              calculatedStatus,
              floorPlanId: floorPlan?.id,
              floorPlanName: floorPlan?.name
            }
          })

          detailSections.push({
            id: planId,
            name: floorPlan?.name || 'Okänd planritning',
            icon: 'indoor',
            buildingName: floorPlan?.building_name,
            stations: indoorStations
          })
        })
      }

      setHistoryDetailSections(detailSections)
    } catch (error) {
      console.error('Error loading history session details:', error)
    } finally {
      setLoadingHistoryDetail(false)
    }
  }

  // Stäng historikmodal
  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false)
    setSelectedHistorySession(null)
    setHistoryDetailSections([])
  }

  // Filtrera stationer baserat på sökfråga och filter
  const filteredSections = useMemo(() => {
    return sections.map(section => {
      let filteredStations = section.stations

      // Sök
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase()
        filteredStations = filteredStations.filter(s =>
          s.stationNumber?.toLowerCase().includes(query) ||
          s.stationType.toLowerCase().includes(query) ||
          s.latestInspection?.findings?.toLowerCase().includes(query)
        )
      }

      // Endast avvikelser (warning/critical)
      if (showOnlyIssues) {
        filteredStations = filteredStations.filter(s =>
          s.calculatedStatus === 'warning' || s.calculatedStatus === 'critical'
        )
      }

      return { ...section, stations: filteredStations }
    }).filter(section => section.stations.length > 0)
  }, [sections, debouncedSearchQuery, showOnlyIssues])

  // Öppna lightbox
  const openLightbox = (photoUrl: string, caption: string) => {
    setLightboxPhotos([{ url: photoUrl, caption }])
    setLightboxIndex(0)
    setIsLightboxOpen(true)
  }

  // Öppna station detail sheet
  const handleStationClick = async (station: StationWithLatestInspection) => {
    if (station.originalOutdoorStation) {
      setSelectedOutdoorStation(station.originalOutdoorStation)
      const inspections = await getOutdoorInspectionsByStation(station.id)
      setOutdoorInspections(inspections)
      setIsOutdoorDetailOpen(true)
    } else if (station.originalIndoorStation) {
      setSelectedIndoorStation(station.originalIndoorStation)
      const inspections = await IndoorStationService.getInspectionsByStation(station.id)
      setIndoorInspections(inspections)
      setIsIndoorDetailOpen(true)
    }
  }

  // Stäng outdoor detail sheet
  const handleCloseOutdoorDetail = () => {
    setIsOutdoorDetailOpen(false)
    setTimeout(() => {
      setSelectedOutdoorStation(null)
      setOutdoorInspections([])
    }, 300)
  }

  // Stäng indoor detail sheet
  const handleCloseIndoorDetail = () => {
    setIsIndoorDetailOpen(false)
    setTimeout(() => {
      setSelectedIndoorStation(null)
      setIndoorInspections([])
    }, 300)
  }

  // Navigera till station på karta/planritning
  const handleNavigateToStation = (station: StationWithLatestInspection, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onNavigateToStation) {
      const type = station.originalOutdoorStation ? 'outdoor' : 'indoor'
      onNavigateToStation(station.id, type, station.floorPlanId)
    }
  }

  // Formatera datum
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy", { locale: sv })
  }

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy 'kl' HH:mm", { locale: sv })
  }

  // Få färg baserat på tröskelvärde
  const getThresholdColor = (status: CalculatedStatus): string => {
    switch (status) {
      case 'critical':
        return '#ef4444' // Röd
      case 'warning':
        return '#f59e0b' // Guld/amber
      case 'ok':
      default:
        return '#22c55e' // Grön
    }
  }

  // Få status-ikon
  const getStatusIcon = (status: InspectionStatus) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'activity':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'needs_service':
        return <Wrench className="w-4 h-4 text-orange-400" />
      case 'replaced':
        return <RefreshCw className="w-4 h-4 text-blue-400" />
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-slate-400 mt-4">Laddar inspektionshistorik...</p>
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
            <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Genomförda kontroller</h1>
              <p className="text-sm text-slate-400">
                Senaste inspektionsresultat för {companyName}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg text-slate-300 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 inline mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>

        {/* Sammanfattning av senaste kontroll */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">Senaste servicebesök</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 uppercase">Datum</span>
              </div>
              <p className="text-white font-medium text-sm">
                {lastInspectionDate ? formatDate(lastInspectionDate) : 'Ingen kontroll'}
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 uppercase">Tekniker</span>
              </div>
              <p className="text-white font-medium text-sm">
                {lastTechnicianName || 'Okänd'}
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-500 uppercase">OK</span>
              </div>
              <p className="text-emerald-400 font-bold text-lg">{statusCounts.ok}</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-slate-500 uppercase">Varning</span>
              </div>
              <p className="text-amber-400 font-bold text-lg">{statusCounts.warning}</p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-slate-500 uppercase">Kritisk</span>
              </div>
              <p className="text-red-400 font-bold text-lg">{statusCounts.critical}</p>
            </div>
          </div>
        </div>

        {/* Kontrollhistorik - expanderbar sektion */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 mb-6">
          <button
            onClick={handleToggleHistory}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors rounded-xl"
          >
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">Kontrollhistorik</span>
              {historySessions.length > 0 && (
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                  {historySessions.length} tidigare besök
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {loadingHistory && (
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
              )}
              {showHistory ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {showHistory && (
            <div className="px-4 pb-4 border-t border-slate-700/50">
              {loadingHistory ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Laddar historik...</p>
                </div>
              ) : historySessions.length === 0 ? (
                <div className="py-8 text-center">
                  <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Ingen tidigare historik tillgänglig</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {historySessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleOpenHistorySession(session)}
                      className="w-full text-left bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors cursor-pointer group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                            <Calendar className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium group-hover:text-purple-300 transition-colors">
                              {session.completed_at ? formatDate(session.completed_at) : 'Okänt datum'}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <User className="w-3.5 h-3.5" />
                              <span>{session.technician?.name || 'Okänd tekniker'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          {/* Statistik för sessionen */}
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-slate-300">{session.inspection_summary?.ok || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-slate-300">{session.inspection_summary?.warning || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-slate-300">{session.inspection_summary?.critical || 0}</span>
                          </div>
                          <div className="text-slate-500">
                            {session.inspection_summary?.total || 0} st
                          </div>
                          <Eye className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors ml-2" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter och sök */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Sök station eller anteckning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>

          <button
            onClick={() => setShowOnlyIssues(!showOnlyIssues)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all
              ${showOnlyIssues
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }
            `}
          >
            <Filter className="w-4 h-4" />
            Endast avvikelser
          </button>
        </div>

        {/* Sektioner med tabeller */}
        {filteredSections.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {showOnlyIssues ? 'Inga avvikelser hittades' : 'Inga kontroller registrerade'}
            </h3>
            <p className="text-slate-400">
              {showOnlyIssues
                ? 'Alla stationer har OK-status.'
                : 'Servicebesök och inspektioner kommer att visas här när de utförs.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredSections.map((section) => (
              <section key={section.id}>
                {/* Sektionsrubrik */}
                <div className="flex items-center gap-2 mb-3">
                  {section.icon === 'outdoor' ? (
                    <MapPin className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Home className="w-5 h-5 text-blue-400" />
                  )}
                  <h2 className="text-lg font-semibold text-white">
                    {section.buildingName ? `${section.buildingName} - ` : ''}{section.name}
                  </h2>
                  <span className="text-sm text-slate-400">({section.stations.length} stationer)</span>
                </div>

                {/* Tabell */}
                <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-700/50">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Nr</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Mätvärde avser</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Mätvärde</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Kontrollerad</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Anteckning</th>
                          <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Foto</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {section.stations.map((station, index) => {
                          const inspectionStatusConfig = station.latestInspection
                            ? INSPECTION_STATUS_CONFIG[station.latestInspection.status] || {
                                label: station.latestInspection.status,
                                bgColor: 'bg-slate-500/20'
                              }
                            : { label: 'Ej kontrollerad', bgColor: 'bg-slate-500/20' }

                          // Mätvärde med färgindikator
                          const measurementValue = station.latestInspection?.measurementValue
                          const hasThresholds = station.thresholdWarning !== null || station.thresholdCritical !== null
                          const thresholdColor = getThresholdColor(station.calculatedStatus)

                          return (
                            <tr
                              key={station.id}
                              className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                              onClick={() => handleStationClick(station)}
                            >
                              <td className="px-4 py-2.5 text-white font-medium">
                                {station.stationNumber || `#${index + 1}`}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: station.typeColor }}
                                  />
                                  <span className="text-slate-300">
                                    {station.stationType}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {station.latestInspection ? (
                                  <div className="flex items-center gap-1.5">
                                    {getStatusIcon(station.latestInspection.status)}
                                    <span className={`text-xs px-2 py-0.5 rounded ${inspectionStatusConfig.bgColor}`}>
                                      {inspectionStatusConfig.label}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                                    Ej kontrollerad
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-300">
                                {station.measurementLabel || '-'}
                              </td>
                              <td className="px-4 py-2.5">
                                {measurementValue !== null && measurementValue !== undefined ? (
                                  <div className="flex items-center gap-2">
                                    {/* Färgindikator baserat på tröskelvärde */}
                                    {hasThresholds && (
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: thresholdColor }}
                                        title={CALCULATED_STATUS_CONFIG[station.calculatedStatus].label}
                                      />
                                    )}
                                    <span className="text-white font-medium">
                                      {measurementValue}
                                    </span>
                                    <span className="text-slate-400 text-xs">
                                      {MEASUREMENT_UNIT_CONFIG[station.measurementUnit as keyof typeof MEASUREMENT_UNIT_CONFIG]?.shortLabel || station.measurementUnit}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400">
                                {station.latestInspection
                                  ? formatDate(station.latestInspection.inspectedAt)
                                  : '-'}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate">
                                {station.latestInspection?.findings || '-'}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {station.latestInspection?.photoUrl ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openLightbox(
                                        station.latestInspection!.photoUrl!,
                                        `${station.stationNumber || station.stationType} - ${formatDate(station.latestInspection!.inspectedAt)}`
                                      )
                                    }}
                                    className="w-8 h-8 rounded-lg overflow-hidden bg-slate-700 mx-auto hover:ring-2 hover:ring-teal-500/50 transition-all"
                                  >
                                    <img
                                      src={station.latestInspection.photoUrl}
                                      alt="Inspektionsfoto"
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  {/* Visa på karta/planritning */}
                                  {onNavigateToStation && (
                                    <button
                                      onClick={(e) => handleNavigateToStation(station, e)}
                                      className="p-1.5 text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-all group"
                                      title={station.originalOutdoorStation ? 'Visa på karta' : `Visa på ${station.floorPlanName || 'planritning'}`}
                                    >
                                      {station.originalOutdoorStation ? (
                                        <MapPin className="w-4 h-4 group-hover:animate-pulse" />
                                      ) : (
                                        <Home className="w-4 h-4 group-hover:animate-pulse" />
                                      )}
                                    </button>
                                  )}
                                  {/* Öppna detaljer */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStationClick(station)
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-600/50 rounded-lg transition-all"
                                    title="Visa detaljer"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Legend för tröskelvärden */}
        <div className="mt-6 bg-slate-800/30 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-2">Mätvärdeindikatorer:</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-400">OK - Inom normala värden</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-400">Varning - Överstiger/understiger varningsnivå</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-slate-400">Kritisk - Överstiger/understiger kritisk nivå</span>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      <InspectionPhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
      />

      {/* Outdoor Station Detail Sheet */}
      {selectedOutdoorStation && (
        <CustomerOutdoorStationDetailSheet
          station={selectedOutdoorStation}
          inspections={outdoorInspections}
          isOpen={isOutdoorDetailOpen}
          onClose={handleCloseOutdoorDetail}
        />
      )}

      {/* Indoor Station Detail Sheet */}
      {selectedIndoorStation && (
        <CustomerIndoorStationDetailSheet
          station={selectedIndoorStation}
          inspections={indoorInspections}
          isOpen={isIndoorDetailOpen}
          onClose={handleCloseIndoorDetail}
        />
      )}

      {/* Historik-modal */}
      {isHistoryModalOpen && selectedHistorySession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleCloseHistoryModal}
        >
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">
                    Kontroll {selectedHistorySession.completed_at ? formatDate(selectedHistorySession.completed_at) : 'Okänt datum'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Tekniker: {selectedHistorySession.technician?.name || 'Okänd'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseHistoryModal}
                className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistoryDetail ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-400">Laddar inspektionsdetaljer...</p>
                </div>
              ) : historyDetailSections.length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Inga inspektionsdata hittades</p>
                </div>
              ) : (
                <>
                  {/* Sammanfattning */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-slate-500 uppercase">OK</span>
                      </div>
                      <p className="text-emerald-400 font-bold text-lg">
                        {selectedHistorySession.inspection_summary?.ok || 0}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-500 uppercase">Varning</span>
                      </div>
                      <p className="text-amber-400 font-bold text-lg">
                        {selectedHistorySession.inspection_summary?.warning || 0}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-slate-500 uppercase">Kritisk</span>
                      </div>
                      <p className="text-red-400 font-bold text-lg">
                        {selectedHistorySession.inspection_summary?.critical || 0}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ClipboardCheck className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-500 uppercase">Totalt</span>
                      </div>
                      <p className="text-white font-bold text-lg">
                        {selectedHistorySession.inspection_summary?.total || 0}
                      </p>
                    </div>
                  </div>

                  {/* Sektioner med stationer */}
                  <div className="space-y-4">
                    {historyDetailSections.map((section) => (
                      <div key={section.id} className="bg-slate-900/30 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2 p-3 border-b border-slate-700/50">
                          {section.icon === 'outdoor' ? (
                            <MapPin className="w-4 h-4 text-teal-400" />
                          ) : (
                            <Home className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-white font-medium">{section.name}</span>
                          {section.buildingName && (
                            <span className="text-slate-500">({section.buildingName})</span>
                          )}
                          <span className="text-slate-500 text-sm ml-auto">
                            {section.stations.length} stationer
                          </span>
                        </div>
                        <div className="divide-y divide-slate-700/30">
                          {section.stations.map((station) => {
                            const statusConfig = CALCULATED_STATUS_CONFIG[station.calculatedStatus]
                            return (
                              <div key={station.id} className="flex items-center justify-between p-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: station.typeColor }}
                                  />
                                  <div>
                                    <span className="text-white text-sm">
                                      {station.stationNumber || '-'}
                                    </span>
                                    <span className="text-slate-500 text-sm ml-2">
                                      {station.stationType}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {station.latestInspection?.measurementValue !== null && (
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: statusConfig.color }}
                                      />
                                      <span className="text-white text-sm font-medium">
                                        {station.latestInspection?.measurementValue}
                                      </span>
                                      {station.measurementLabel && (
                                        <span className="text-slate-500 text-xs">
                                          {station.measurementLabel}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {station.latestInspection?.photoUrl && (
                                    <Camera className="w-4 h-4 text-slate-500" />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionSessionsView
