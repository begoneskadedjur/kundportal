// src/utils/equipmentStatisticsUtils.ts
// Hjälpfunktioner för utrustningsstatistik i kundportalen

import { calculateStationStatus, type CalculatedStatus } from '../types/stationTypes'
import type { OutdoorInspectionWithRelations, InspectionSessionWithRelations } from '../types/inspectionSession'

/**
 * Status-fördelning per datum
 */
export interface StatusDistributionData {
  date: string
  dateFormatted: string
  ok: number
  warning: number
  critical: number
  total: number
}

/**
 * Genomsnitt per stationstyp
 */
export interface StationTypeAverageData {
  stationType: string
  stationTypeColor: string
  avgValue: number
  previousAvgValue: number | null
  change: number | null
  changeDirection: 'up' | 'down' | 'stable'
  count: number
  thresholdWarning: number | null
  thresholdCritical: number | null
  thresholdDirection: 'above' | 'below'
  measurementUnit: string
  measurementLabel: string | null
  status: 'ok' | 'warning' | 'critical'
  previousStatus: 'ok' | 'warning' | 'critical' | null
  statusColor: string
}

/**
 * Trend-data för enskild station
 */
export interface StationTrendData {
  stationId: string
  stationNumber: string | null
  stationType: string
  stationTypeColor: string
  area: string
  latestValue: number | null
  previousValue: number | null
  trend: number | null
  trendDirection: 'up' | 'down' | 'stable'
  currentStatus: CalculatedStatus
  measurementUnit: string
  measurementLabel: string | null
  locationType: 'indoor' | 'outdoor'
  floorPlanName?: string
  thresholdWarning: number | null
  thresholdCritical: number | null
  thresholdDirection: 'above' | 'below'
}

/**
 * Beräkna status baserat på mätvärde och tröskelvärden
 */
export function calculateStatus(
  measurementValue: number | null,
  thresholdWarning: number | null,
  thresholdCritical: number | null,
  thresholdDirection: 'above' | 'below' = 'above'
): CalculatedStatus {
  if (measurementValue === null) return 'ok'

  if (thresholdDirection === 'above') {
    if (thresholdCritical !== null && measurementValue >= thresholdCritical) return 'critical'
    if (thresholdWarning !== null && measurementValue >= thresholdWarning) return 'warning'
    return 'ok'
  } else {
    // below: lägre värden är dåliga
    if (thresholdCritical !== null && measurementValue <= thresholdCritical) return 'critical'
    if (thresholdWarning !== null && measurementValue <= thresholdWarning) return 'warning'
    return 'ok'
  }
}

/**
 * Beräkna status-fördelning över tid baserat på inspektionssessioner
 */
export function calculateStatusDistributionOverTime(
  sessions: InspectionSessionWithRelations[]
): StatusDistributionData[] {
  return sessions
    .filter(s => s.completed_at)
    .map(session => {
      const summary = session.inspection_summary || { ok: 0, warning: 0, critical: 0, total: 0 }
      const date = new Date(session.completed_at!)

      return {
        date: session.completed_at!,
        dateFormatted: date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
        ok: summary.ok,
        warning: summary.warning,
        critical: summary.critical,
        total: summary.total
      }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Beräkna genomsnittliga mätvärden per stationstyp med jämförelse mot föregående period
 */
export function calculateAveragesByStationType(
  currentInspections: OutdoorInspectionWithRelations[],
  previousInspections: OutdoorInspectionWithRelations[] = []
): StationTypeAverageData[] {
  // Bygg map för nuvarande period
  const currentTypeMap = new Map<string, {
    values: number[]
    color: string
    thresholdWarning: number | null
    thresholdCritical: number | null
    thresholdDirection: 'above' | 'below'
    measurementUnit: string
    measurementLabel: string | null
  }>()

  currentInspections.forEach(insp => {
    const station = insp.station as any
    const stationTypeData = station?.station_type_data
    const typeName = stationTypeData?.name || station?.equipment_type || 'Okänd'

    if (insp.measurement_value !== null) {
      if (!currentTypeMap.has(typeName)) {
        currentTypeMap.set(typeName, {
          values: [],
          color: stationTypeData?.color || '#6b7280',
          thresholdWarning: stationTypeData?.threshold_warning ?? null,
          thresholdCritical: stationTypeData?.threshold_critical ?? null,
          thresholdDirection: stationTypeData?.threshold_direction ?? 'above',
          measurementUnit: stationTypeData?.measurement_unit || 'st',
          measurementLabel: stationTypeData?.measurement_label ?? null
        })
      }
      currentTypeMap.get(typeName)!.values.push(insp.measurement_value)
    }
  })

  // Bygg map för föregående period
  const previousTypeMap = new Map<string, number[]>()
  previousInspections.forEach(insp => {
    const station = insp.station as any
    const stationTypeData = station?.station_type_data
    const typeName = stationTypeData?.name || station?.equipment_type || 'Okänd'

    if (insp.measurement_value !== null) {
      if (!previousTypeMap.has(typeName)) {
        previousTypeMap.set(typeName, [])
      }
      previousTypeMap.get(typeName)!.push(insp.measurement_value)
    }
  })

  return Array.from(currentTypeMap.entries()).map(([stationType, data]) => {
    const avgValue = data.values.length > 0
      ? Math.round(data.values.reduce((a, b) => a + b, 0) / data.values.length * 10) / 10
      : 0

    // Beräkna föregående periods genomsnitt
    const previousValues = previousTypeMap.get(stationType) || []
    const previousAvgValue = previousValues.length > 0
      ? Math.round(previousValues.reduce((a, b) => a + b, 0) / previousValues.length * 10) / 10
      : null

    // Beräkna förändring
    let change: number | null = null
    let changeDirection: 'up' | 'down' | 'stable' = 'stable'
    if (previousAvgValue !== null) {
      change = Math.round((avgValue - previousAvgValue) * 10) / 10
      if (change > 0) changeDirection = 'up'
      else if (change < 0) changeDirection = 'down'
    }

    // Beräkna status baserat på genomsnitt och tröskelvärden
    const status = calculateStatus(avgValue, data.thresholdWarning, data.thresholdCritical, data.thresholdDirection)
    const previousStatus = previousAvgValue !== null
      ? calculateStatus(previousAvgValue, data.thresholdWarning, data.thresholdCritical, data.thresholdDirection)
      : null
    const statusColor = status === 'ok' ? '#22c55e' : status === 'warning' ? '#f59e0b' : '#ef4444'

    return {
      stationType,
      stationTypeColor: data.color,
      avgValue,
      previousAvgValue,
      change,
      changeDirection,
      count: data.values.length,
      thresholdWarning: data.thresholdWarning,
      thresholdCritical: data.thresholdCritical,
      thresholdDirection: data.thresholdDirection,
      measurementUnit: data.measurementUnit,
      measurementLabel: data.measurementLabel,
      status,
      previousStatus,
      statusColor
    }
  })
}

/**
 * Beräkna trend för stationer baserat på inspektioner
 */
export function calculateStationTrends(
  currentInspections: OutdoorInspectionWithRelations[],
  previousInspections: OutdoorInspectionWithRelations[],
  stationNumberMap: Map<string, number>
): StationTrendData[] {
  // Skapa en map för tidigare inspektioner per station
  const previousMap = new Map<string, number>()
  previousInspections.forEach(insp => {
    const station = insp.station as any
    const stationId = station?.id || insp.id
    if (insp.measurement_value !== null) {
      previousMap.set(stationId, insp.measurement_value)
    }
  })

  return currentInspections.map(insp => {
    const station = insp.station as any
    const stationTypeData = station?.station_type_data
    const stationId = station?.id || insp.id
    const latestValue = insp.measurement_value
    const previousValue = previousMap.get(stationId) ?? null

    let trend: number | null = null
    let trendDirection: 'up' | 'down' | 'stable' = 'stable'

    if (latestValue !== null && previousValue !== null) {
      trend = latestValue - previousValue
      if (trend > 0) trendDirection = 'up'
      else if (trend < 0) trendDirection = 'down'
    }

    // Beräkna status
    const currentStatus = calculateStatus(
      latestValue,
      stationTypeData?.threshold_warning ?? null,
      stationTypeData?.threshold_critical ?? null,
      stationTypeData?.threshold_direction ?? 'above'
    )

    return {
      stationId,
      stationNumber: stationNumberMap.get(stationId)?.toString() || null,
      stationType: stationTypeData?.name || station?.equipment_type || 'Okänd',
      stationTypeColor: stationTypeData?.color || '#6b7280',
      area: 'Utomhus',
      latestValue,
      previousValue,
      trend,
      trendDirection,
      currentStatus,
      measurementUnit: stationTypeData?.measurement_unit || 'st',
      measurementLabel: stationTypeData?.measurement_label ?? null,
      locationType: 'outdoor' as const,
      thresholdWarning: stationTypeData?.threshold_warning ?? null,
      thresholdCritical: stationTypeData?.threshold_critical ?? null,
      thresholdDirection: stationTypeData?.threshold_direction ?? 'above'
    }
  })
}

/**
 * Beräkna trend för indoor-stationer baserat på inspektioner
 */
export function calculateIndoorStationTrends(
  stations: any[],
  inspectionsMap: Map<string, any[]>,
  floorPlanName: string
): StationTrendData[] {
  return stations.map((station, index) => {
    const stationTypeData = station.station_type_data
    const inspections = inspectionsMap.get(station.id) || []

    // Sortera inspektioner efter datum (nyast först)
    const sortedInspections = [...inspections].sort(
      (a, b) => new Date(b.inspected_at || b.created_at).getTime() - new Date(a.inspected_at || a.created_at).getTime()
    )

    const latestInsp = sortedInspections[0]
    const previousInsp = sortedInspections[1]

    const latestValue = latestInsp?.measurement_value ?? null
    const previousValue = previousInsp?.measurement_value ?? null

    let trend: number | null = null
    let trendDirection: 'up' | 'down' | 'stable' = 'stable'

    if (latestValue !== null && previousValue !== null) {
      trend = latestValue - previousValue
      if (trend > 0) trendDirection = 'up'
      else if (trend < 0) trendDirection = 'down'
    }

    const currentStatus = calculateStatus(
      latestValue,
      stationTypeData?.threshold_warning ?? null,
      stationTypeData?.threshold_critical ?? null,
      stationTypeData?.threshold_direction ?? 'above'
    )

    return {
      stationId: station.id,
      stationNumber: station.station_number?.toString() || `I${index + 1}`,
      stationType: stationTypeData?.name || 'Okänd',
      stationTypeColor: stationTypeData?.color || '#6b7280',
      area: floorPlanName,
      latestValue,
      previousValue,
      trend,
      trendDirection,
      currentStatus,
      measurementUnit: stationTypeData?.measurement_unit || 'st',
      measurementLabel: stationTypeData?.measurement_label ?? null,
      locationType: 'indoor' as const,
      floorPlanName,
      thresholdWarning: stationTypeData?.threshold_warning ?? null,
      thresholdCritical: stationTypeData?.threshold_critical ?? null,
      thresholdDirection: stationTypeData?.threshold_direction ?? 'above'
    }
  })
}

/**
 * Beräkna KPI-statistik för stationer
 */
export interface StationKPIStats {
  totalStations: number
  outdoorStations: number
  indoorStations: number
  okStations: number
  warningStations: number
  criticalStations: number
}

export function calculateStationKPIs(
  outdoorInspections: OutdoorInspectionWithRelations[],
  indoorInspections: any[], // IndoorInspectionWithRelations
  outdoorTotal: number,
  indoorTotal: number
): StationKPIStats {
  let okStations = 0
  let warningStations = 0
  let criticalStations = 0

  // Outdoor
  outdoorInspections.forEach(insp => {
    const station = insp.station as any
    const stationTypeData = station?.station_type_data
    const status = calculateStatus(
      insp.measurement_value,
      stationTypeData?.threshold_warning ?? null,
      stationTypeData?.threshold_critical ?? null,
      stationTypeData?.threshold_direction ?? 'above'
    )
    if (status === 'ok') okStations++
    else if (status === 'warning') warningStations++
    else if (status === 'critical') criticalStations++
  })

  // Indoor
  indoorInspections.forEach(insp => {
    const station = insp.station as any
    const stationTypeData = station?.station_type_data
    const status = calculateStatus(
      insp.measurement_value,
      stationTypeData?.threshold_warning ?? null,
      stationTypeData?.threshold_critical ?? null,
      stationTypeData?.threshold_direction ?? 'above'
    )
    if (status === 'ok') okStations++
    else if (status === 'warning') warningStations++
    else if (status === 'critical') criticalStations++
  })

  return {
    totalStations: outdoorTotal + indoorTotal,
    outdoorStations: outdoorTotal,
    indoorStations: indoorTotal,
    okStations,
    warningStations,
    criticalStations
  }
}

/**
 * Filtrera sessioner efter tidsperiod
 */
export type TimePeriod = '30d' | '3m' | '6m' | '1y' | 'all'

export function filterSessionsByTimePeriod(
  sessions: InspectionSessionWithRelations[],
  period: TimePeriod
): InspectionSessionWithRelations[] {
  if (period === 'all') return sessions

  const now = new Date()
  const periodMap = {
    '30d': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365
  }

  const daysBack = periodMap[period]
  const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))

  return sessions.filter(session => {
    const sessionDate = new Date(session.completed_at || session.started_at || '')
    return sessionDate >= cutoffDate
  })
}

/**
 * Aggregera statusfördelning per månad (för långsiktig data med 12+ datapunkter)
 * Returnerar månadsgenomsnitt istället för individuella sessioner
 */
export function aggregateStatusByMonth(
  data: StatusDistributionData[]
): StatusDistributionData[] {
  if (data.length === 0) return []

  const monthlyMap = new Map<string, {
    ok: number
    warning: number
    critical: number
    total: number
    count: number
  }>()

  data.forEach(d => {
    const date = new Date(d.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { ok: 0, warning: 0, critical: 0, total: 0, count: 0 })
    }
    const current = monthlyMap.get(monthKey)!
    current.ok += d.ok
    current.warning += d.warning
    current.critical += d.critical
    current.total += d.total
    current.count++
  })

  // Returnera månadsgenomsnitt, sorterat kronologiskt
  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, values]) => ({
      date: monthKey + '-01',
      dateFormatted: new Date(monthKey + '-01').toLocaleDateString('sv-SE', {
        month: 'short',
        year: '2-digit'
      }),
      ok: Math.round(values.ok / values.count),
      warning: Math.round(values.warning / values.count),
      critical: Math.round(values.critical / values.count),
      total: Math.round(values.total / values.count)
    }))
}

/**
 * Metadata för stationstyper i trendgrafen
 */
export interface StationTypeInfo {
  code: string
  name: string
  color: string
  measurementUnit: string
  measurementLabel: string | null
}

/**
 * Datapunkt för mätvärden över tid
 */
export interface MeasurementTrendDataPoint {
  date: string
  dateFormatted: string
  [stationTypeCode: string]: number | string | null
}

/**
 * Beräkna mätvärden per stationstyp över tid
 * Returnerar data i format lämpligt för Recharts LineChart
 */
export function calculateMeasurementTrendsOverTime(
  sessions: InspectionSessionWithRelations[],
  inspectionsMap: Map<string, OutdoorInspectionWithRelations[]>
): { data: MeasurementTrendDataPoint[], stationTypes: StationTypeInfo[] } {
  // Samla alla unika stationstyper
  const stationTypeMap = new Map<string, StationTypeInfo>()

  // Bygg datapunkter per session
  const dataPoints: MeasurementTrendDataPoint[] = []

  const completedSessions = sessions
    .filter(s => s.completed_at)
    .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())

  for (const session of completedSessions) {
    const inspections = inspectionsMap.get(session.id) || []
    if (inspections.length === 0) continue

    const date = new Date(session.completed_at!)
    const dataPoint: MeasurementTrendDataPoint = {
      date: session.completed_at!,
      dateFormatted: date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    }

    // Gruppera inspektioner per stationstyp och beräkna genomsnitt
    const typeValues = new Map<string, number[]>()

    for (const insp of inspections) {
      if (insp.measurement_value === null) continue

      const station = insp.station as any
      const stationTypeData = station?.station_type_data
      const typeCode = stationTypeData?.code || station?.equipment_type || 'unknown'

      // Registrera stationstyp om den inte finns
      if (!stationTypeMap.has(typeCode)) {
        stationTypeMap.set(typeCode, {
          code: typeCode,
          name: stationTypeData?.name || typeCode,
          color: stationTypeData?.color || '#6b7280',
          measurementUnit: stationTypeData?.measurement_unit || 'st',
          measurementLabel: stationTypeData?.measurement_label ?? null
        })
      }

      // Samla värden per typ
      if (!typeValues.has(typeCode)) {
        typeValues.set(typeCode, [])
      }
      typeValues.get(typeCode)!.push(insp.measurement_value)
    }

    // Beräkna genomsnitt för varje stationstyp
    for (const [typeCode, values] of typeValues) {
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10
      dataPoint[typeCode] = avg
    }

    // Bara lägg till om det finns minst ett mätvärde
    if (Object.keys(dataPoint).length > 2) {
      dataPoints.push(dataPoint)
    }
  }

  return {
    data: dataPoints,
    stationTypes: Array.from(stationTypeMap.values())
  }
}

/**
 * Aggregera mätvärden per månad (för långsiktig data)
 */
export function aggregateMeasurementsByMonth(
  data: MeasurementTrendDataPoint[],
  stationTypes: StationTypeInfo[]
): MeasurementTrendDataPoint[] {
  if (data.length === 0) return []

  const monthlyMap = new Map<string, { values: Map<string, number[]> }>()

  data.forEach(d => {
    const date = new Date(d.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { values: new Map() })
    }

    const current = monthlyMap.get(monthKey)!

    // Samla värden per stationstyp
    for (const type of stationTypes) {
      const value = d[type.code]
      if (typeof value === 'number') {
        if (!current.values.has(type.code)) {
          current.values.set(type.code, [])
        }
        current.values.get(type.code)!.push(value)
      }
    }
  })

  // Returnera månadsgenomsnitt
  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, { values }]) => {
      const point: MeasurementTrendDataPoint = {
        date: monthKey + '-01',
        dateFormatted: new Date(monthKey + '-01').toLocaleDateString('sv-SE', {
          month: 'short',
          year: '2-digit'
        })
      }

      for (const [typeCode, typeValues] of values) {
        point[typeCode] = Math.round(typeValues.reduce((a, b) => a + b, 0) / typeValues.length * 10) / 10
      }

      return point
    })
}
