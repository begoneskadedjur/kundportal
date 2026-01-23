// src/components/customer/EquipmentStatisticsSection.tsx
// Statistiksektion för utrustning och mätvärden över tid

import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  Target,
  TreePine,
  Home,
  AlertTriangle,
  RefreshCw,
  Activity
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
  calculateStationKPIs,
  filterSessionsByTimePeriod,
  aggregateStatusByMonth,
  calculateMeasurementTrendsOverTime,
  aggregateMeasurementsByMonth,
  ensureVisibleColor,
  type TimePeriod
} from '../../utils/equipmentStatisticsUtils'

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
  const [latestIndoorInspections, setLatestIndoorInspections] = useState<any[]>([])
  const [outdoorTotal, setOutdoorTotal] = useState(0)
  const [indoorTotal, setIndoorTotal] = useState(0)
  const [allSessionInspections, setAllSessionInspections] = useState<Map<string, any[]>>(new Map())

  // Hämta data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Hämta sessioner med sammanfattning (100 för att stödja 8+ års historik)
        const sessionsData = await getCompletedSessionsWithSummary(customerId, 100)
        setSessions(sessionsData)

        // Hämta alla outdoor-stationer
        const outdoorStations = await EquipmentService.getEquipmentByCustomer(customerId)
        setOutdoorTotal(outdoorStations.length)

        // Hämta indoor-stationer
        const floorPlans = await FloorPlanService.getFloorPlansByCustomer(customerId)
        let indoorCount = 0
        for (const plan of floorPlans) {
          const stations = await IndoorStationService.getStationsByFloorPlan(plan.id)
          indoorCount += stations.length
        }
        setIndoorTotal(indoorCount)

        // Hämta inspektioner för senaste sessionen (för KPI-beräkning)
        if (sessionsData.length > 0) {
          const latestOutdoor = await getOutdoorInspectionsForSession(sessionsData[0].id)
          const latestIndoor = await getIndoorInspectionsForSession(sessionsData[0].id)
          setLatestOutdoorInspections(latestOutdoor)
          setLatestIndoorInspections(latestIndoor)
        }

        // Hämta inspektioner för alla sessioner (för mätvärdes-trendgraf)
        const inspMap = new Map<string, any[]>()
        const sessionsToFetch = sessionsData.slice(0, 20) // Max 20 sessioner för prestanda
        for (const session of sessionsToFetch) {
          try {
            const inspections = await getOutdoorInspectionsForSession(session.id)
            inspMap.set(session.id, inspections)
          } catch {
            inspMap.set(session.id, [])
          }
        }
        setAllSessionInspections(inspMap)
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

  // Beräkna mätvärden per stationstyp över tid
  const measurementTrends = useMemo(() => {
    return calculateMeasurementTrendsOverTime(filteredSessions, allSessionInspections)
  }, [filteredSessions, allSessionInspections])

  // Aggregera mätvärden per månad om det finns mer än 12 datapunkter
  const measurementChartData = useMemo(() => {
    if (measurementTrends.data.length > 12) {
      return aggregateMeasurementsByMonth(measurementTrends.data, measurementTrends.stationTypes)
    }
    return measurementTrends.data
  }, [measurementTrends])

  // Beräkna KPIs
  const kpis = useMemo(() => {
    return calculateStationKPIs(
      latestOutdoorInspections,
      latestIndoorInspections,
      outdoorTotal,
      indoorTotal
    )
  }, [latestOutdoorInspections, latestIndoorInspections, outdoorTotal, indoorTotal])

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

        {/* Mätvärden över tid - LineChart */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            Mätvärden över tid
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Genomsnittligt mätvärde per stationstyp vid varje kontroll
          </p>

          {measurementChartData.length > 0 && measurementTrends.stationTypes.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={measurementChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="dateFormatted"
                    stroke="#9ca3af"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                    formatter={(value: number, name: string) => {
                      const type = measurementTrends.stationTypes.find(t => t.code === name)
                      const unit = type?.measurementUnit === 'gram' ? 'g' : type?.measurementUnit === 'st' ? '' : type?.measurementUnit || ''
                      const label = type?.measurementLabel || type?.name || name
                      return [`${value}${unit}`, label]
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const type = measurementTrends.stationTypes.find(t => t.code === value)
                      return type?.measurementLabel || type?.name || value
                    }}
                  />
                  {measurementTrends.stationTypes.map((type) => {
                    const visibleColor = ensureVisibleColor(type.color)
                    return (
                    <Line
                      key={type.code}
                      type="monotone"
                      dataKey={type.code}
                      stroke={visibleColor}
                      strokeWidth={2}
                      dot={{ fill: visibleColor, strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, stroke: visibleColor, strokeWidth: 2, fill: '#1e293b' }}
                      connectNulls
                    />
                  )})}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              Ingen mätdata tillgänglig för vald period
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EquipmentStatisticsSection
