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
  count: number
  thresholdWarning: number | null
  thresholdCritical: number | null
  measurementUnit: string
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
 * Beräkna genomsnittliga mätvärden per stationstyp
 */
export function calculateAveragesByStationType(
  inspections: OutdoorInspectionWithRelations[]
): StationTypeAverageData[] {
  const typeMap = new Map<string, {
    values: number[]
    color: string
    thresholdWarning: number | null
    thresholdCritical: number | null
    measurementUnit: string
  }>()

  inspections.forEach(insp => {
    const station = insp.station as any
    const stationTypeData = station?.station_type_data
    const typeName = stationTypeData?.name || station?.equipment_type || 'Okänd'

    if (insp.measurement_value !== null) {
      if (!typeMap.has(typeName)) {
        typeMap.set(typeName, {
          values: [],
          color: stationTypeData?.color || '#6b7280',
          thresholdWarning: stationTypeData?.threshold_warning ?? null,
          thresholdCritical: stationTypeData?.threshold_critical ?? null,
          measurementUnit: stationTypeData?.measurement_unit || 'st'
        })
      }
      typeMap.get(typeName)!.values.push(insp.measurement_value)
    }
  })

  return Array.from(typeMap.entries()).map(([stationType, data]) => ({
    stationType,
    stationTypeColor: data.color,
    avgValue: data.values.length > 0
      ? Math.round(data.values.reduce((a, b) => a + b, 0) / data.values.length * 10) / 10
      : 0,
    count: data.values.length,
    thresholdWarning: data.thresholdWarning,
    thresholdCritical: data.thresholdCritical,
    measurementUnit: data.measurementUnit
  }))
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
      measurementUnit: stationTypeData?.measurement_unit || 'st'
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
