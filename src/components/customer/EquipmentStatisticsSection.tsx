// src/components/customer/EquipmentStatisticsSection.tsx
// Statistiksektion för utrustning och mätvärden över tid

import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import {
  Target,
  TreePine,
  Home,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  BarChart3,
  ChevronRight,
  MousePointerClick
} from 'lucide-react'
import {
  getCompletedSessionsWithSummary,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession
} from '../../services/inspectionSessionService'
import { EquipmentService } from '../../services/equipmentService'
import { FloorPlanService } from '../../services/floorPlanService'
import { IndoorStationService } from '../../services/indoorStationService'
import {
  calculateStatusDistributionOverTime,
  calculateAveragesByStationType,
  calculateStationTrends,
  calculateIndoorStationTrends,
  calculateStationKPIs,
  filterSessionsByTimePeriod,
  aggregateStatusByMonth,
  type TimePeriod,
  type StationTrendData
} from '../../utils/equipmentStatisticsUtils'
import { CALCULATED_STATUS_CONFIG } from '../../types/stationTypes'
import { StationHistoryModal } from './StationHistoryModal'

interface EquipmentStatisticsSectionProps {
  customerId: string
  timePeriod: TimePeriod
}

export function EquipmentStatisticsSection({
  customerId,
  timePeriod
}: EquipmentStatisticsSectionProps) {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])
  const [latestOutdoorInspections, setLatestOutdoorInspections] = useState<any[]>([])
  const [previousOutdoorInspections, setPreviousOutdoorInspections] = useState<any[]>([])
  const [latestIndoorInspections, setLatestIndoorInspections] = useState<any[]>([])
  const [outdoorTotal, setOutdoorTotal] = useState(0)
  const [indoorTotal, setIndoorTotal] = useState(0)
  const [outdoorNumberMap, setOutdoorNumberMap] = useState<Map<string, number>>(new Map())
  const [indoorStationTrends, setIndoorStationTrends] = useState<StationTrendData[]>([])

  // Modal state
  const [selectedStation, setSelectedStation] = useState<StationTrendData | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // Hämta data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Hämta sessioner med sammanfattning (100 för att stödja 8+ års historik)
        const sessionsData = await getCompletedSessionsWithSummary(customerId, 100)
        setSessions(sessionsData)

        // Hämta alla outdoor-stationer för nummermappning
        const outdoorStations = await EquipmentService.getEquipmentByCustomer(customerId)
        setOutdoorTotal(outdoorStations.length)

        // Skapa nummermappning baserat på placed_at
        const numberMap = new Map<string, number>()
        const sortedOutdoor = [...outdoorStations].sort((a, b) =>
          new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
        )
        sortedOutdoor.forEach((station, index) => {
          numberMap.set(station.id, index + 1)
        })
        setOutdoorNumberMap(numberMap)

        // Hämta indoor-stationer med inspektioner för trendberäkning
        const floorPlans = await FloorPlanService.getFloorPlansByCustomer(customerId)
        let indoorCount = 0
        const allIndoorTrends: StationTrendData[] = []

        for (const plan of floorPlans) {
          const stations = await IndoorStationService.getStationsByFloorPlan(plan.id)
          indoorCount += stations.length

          // Hämta inspektioner för varje station för trendberäkning
          const inspectionsMap = new Map<string, any[]>()
          for (const station of stations) {
            try {
              const inspections = await IndoorStationService.getInspectionsByStation(station.id, 2)
              inspectionsMap.set(station.id, inspections)
            } catch {
              inspectionsMap.set(station.id, [])
            }
          }

          // Beräkna trends för detta plans stationer
          const planTrends = calculateIndoorStationTrends(
            stations,
            inspectionsMap,
            plan.name || 'Inomhus'
          )
          allIndoorTrends.push(...planTrends)
        }

        setIndoorTotal(indoorCount)
        setIndoorStationTrends(allIndoorTrends)

        // Hämta inspektioner för senaste och näst senaste sessionen
        if (sessionsData.length > 0) {
          const latestOutdoor = await getOutdoorInspectionsForSession(sessionsData[0].id)
          const latestIndoor = await getIndoorInspectionsForSession(sessionsData[0].id)
          setLatestOutdoorInspections(latestOutdoor)
          setLatestIndoorInspections(latestIndoor)

          if (sessionsData.length > 1) {
            const prevOutdoor = await getOutdoorInspectionsForSession(sessionsData[1].id)
            setPreviousOutdoorInspections(prevOutdoor)
          }
        }
      } catch (error) {
        console.error('Error fetching equipment statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [customerId])

  // Filtrera sessioner efter tidsperiod
  const filteredSessions = useMemo(() => {
    return filterSessionsByTimePeriod(sessions, timePeriod)
  }, [sessions, timePeriod])

  // Beräkna status-fördelning över tid
  const statusOverTime = useMemo(() => {
    return calculateStatusDistributionOverTime(filteredSessions)
  }, [filteredSessions])

  // Aggregera per månad om det finns mer än 12 datapunkter (för läsbarhet)
  const chartData = useMemo(() => {
    if (statusOverTime.length > 12) {
      return aggregateStatusByMonth(statusOverTime)
    }
    return statusOverTime
  }, [statusOverTime])

  // Beräkna genomsnitt per stationstyp
  const averagesByType = useMemo(() => {
    return calculateAveragesByStationType(latestOutdoorInspections)
  }, [latestOutdoorInspections])

  // Beräkna trender per outdoor-station
  const outdoorStationTrends = useMemo(() => {
    return calculateStationTrends(
      latestOutdoorInspections,
      previousOutdoorInspections,
      outdoorNumberMap
    )
  }, [latestOutdoorInspections, previousOutdoorInspections, outdoorNumberMap])

  // Kombinera outdoor och indoor trends
  const allStationTrends = useMemo(() => {
    return [...outdoorStationTrends, ...indoorStationTrends]
  }, [outdoorStationTrends, indoorStationTrends])

  // Beräkna KPIs
  const kpis = useMemo(() => {
    return calculateStationKPIs(
      latestOutdoorInspections,
      latestIndoorInspections,
      outdoorTotal,
      indoorTotal
    )
  }, [latestOutdoorInspections, latestIndoorInspections, outdoorTotal, indoorTotal])

  // Öppna stationshistorik-modal
  const openStationHistory = (station: StationTrendData) => {
    setSelectedStation(station)
    setIsHistoryModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* KPI-kort */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Totalt antal stationer */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-slate-400">Totalt stationer</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.totalStations}</p>
        </div>

        {/* Utomhus */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <TreePine className="w-5 h-5 text-teal-400" />
            </div>
            <span className="text-sm text-slate-400">Utomhus</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.outdoorStations}</p>
        </div>

        {/* Inomhus */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-slate-400">Inomhus</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.indoorStations}</p>
        </div>

        {/* Kritiska */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-sm text-slate-400">Kritiska</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{kpis.criticalStations}</p>
          <p className="text-xs text-slate-500 mt-1">
            {kpis.warningStations} varning, {kpis.okStations} OK
          </p>
        </div>
      </div>

      {/* Grafer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statusfördelning över tid */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Statusfördelning över tid
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Antal stationer per status vid varje kontrolltillfälle
          </p>

          {statusOverTime.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorOk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorWarning" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dateFormatted" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ok"
                    stackId="1"
                    stroke="#22c55e"
                    fill="url(#colorOk)"
                    name="OK"
                  />
                  <Area
                    type="monotone"
                    dataKey="warning"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="url(#colorWarning)"
                    name="Varning"
                  />
                  <Area
                    type="monotone"
                    dataKey="critical"
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#colorCritical)"
                    name="Kritisk"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              Ingen data för vald period
            </div>
          )}
        </div>

        {/* Mätvärden per stationstyp */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Genomsnittligt mätvärde per typ
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Genomsnitt vid senaste kontrollen
          </p>

          {averagesByType.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={averagesByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="stationType" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                    formatter={(value: number, name: string, props: any) => {
                      const unit = props.payload.measurementUnit || 'st'
                      return [`${value} ${unit}`, 'Genomsnitt']
                    }}
                  />
                  <Bar
                    dataKey="avgValue"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    name="Genomsnitt"
                  />
                  {/* Visa tröskelvärden som reference lines om de finns */}
                  {averagesByType[0]?.thresholdWarning && (
                    <ReferenceLine
                      y={averagesByType[0].thresholdWarning}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: 'Varning', fill: '#f59e0b', fontSize: 10 }}
                    />
                  )}
                  {averagesByType[0]?.thresholdCritical && (
                    <ReferenceLine
                      y={averagesByType[0].thresholdCritical}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{ value: 'Kritisk', fill: '#ef4444', fontSize: 10 }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              Ingen data tillgänglig
            </div>
          )}
        </div>
      </div>

      {/* Stationstabell med trender */}
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-3">
              <Target className="w-5 h-5 text-teal-400" />
              Stationer med trend
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Förändring jämfört med föregående kontroll
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MousePointerClick className="w-4 h-4" />
            Klicka för historik
          </div>
        </div>

        {allStationTrends.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Nr</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Område</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Senaste</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Trend</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {allStationTrends.map((station, index) => {
                  const statusConfig = CALCULATED_STATUS_CONFIG[station.currentStatus]

                  return (
                    <tr
                      key={station.stationId}
                      className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      onClick={() => openStationHistory(station)}
                    >
                      <td className="px-4 py-3 text-white font-medium">
                        <div className="flex items-center gap-2">
                          {station.locationType === 'indoor' ? (
                            <Home className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <TreePine className="w-3.5 h-3.5 text-teal-400" />
                          )}
                          {station.stationNumber || `#${index + 1}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: station.stationTypeColor }}
                          />
                          <span className="text-slate-300">{station.stationType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{station.area}</td>
                      <td className="px-4 py-3 text-right text-white">
                        {station.latestValue !== null
                          ? `${station.latestValue}${station.measurementUnit === 'gram' ? 'g' : station.measurementUnit === 'st' ? '' : station.measurementUnit}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {station.trend !== null ? (
                          <div className={`flex items-center justify-end gap-1 ${
                            station.trendDirection === 'down' ? 'text-emerald-400' :
                            station.trendDirection === 'up' ? 'text-red-400' :
                            'text-slate-500'
                          }`}>
                            {station.trendDirection === 'down' && <TrendingDown className="w-4 h-4" />}
                            {station.trendDirection === 'up' && <TrendingUp className="w-4 h-4" />}
                            {station.trendDirection === 'stable' && <Minus className="w-4 h-4" />}
                            <span className="font-medium">
                              {station.trend > 0 ? '+' : ''}{station.trend}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: statusConfig.color }}
                            title={statusConfig.label}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">
            Ingen stationsdata tillgänglig
          </div>
        )}
      </div>

      {/* Station History Modal */}
      {selectedStation && (
        <StationHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false)
            setSelectedStation(null)
          }}
          stationId={selectedStation.stationId}
          locationType={selectedStation.locationType}
          stationName={selectedStation.stationNumber || 'Station'}
          stationType={selectedStation.stationType}
          stationTypeColor={selectedStation.stationTypeColor}
          thresholdWarning={selectedStation.thresholdWarning}
          thresholdCritical={selectedStation.thresholdCritical}
          thresholdDirection={selectedStation.thresholdDirection}
          measurementUnit={selectedStation.measurementUnit}
          measurementLabel={selectedStation.measurementLabel}
        />
      )}
    </div>
  )
}

export default EquipmentStatisticsSection
