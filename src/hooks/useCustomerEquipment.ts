// src/hooks/useCustomerEquipment.ts
//
// Utrustningsbeståndet för en hel kundfamilj — huvudkontor plus enheter.
//
// Hämtar allt i FEM frågor för hela familjen, inte en runda per enhet som
// kundportalen gör. För Maserfrakt (5 enheter) blir det 5 anrop i stället för
// ~20, och för Stockholms Kommun (8 enheter, 607 stationer) 5 i stället för 30.
//
// Larmen bygger på INSPEKTIONSAKTIVITET, aldrig på equipment_placements.status
// — den kolumnen är 'active' på samtliga 749 rader och säger därför ingenting.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RecordCustomer, RecordInspectionSession } from './useCustomerRecord'

export interface OutdoorStation {
  id: string
  customer_id: string
  serial_number: string | null
  equipment_type: string | null
  latitude: number | null
  longitude: number | null
  placed_at: string | null
  comment: string | null
  photo_path: string | null
  station_type_id: string | null
}

export interface FloorPlan {
  id: string
  customer_id: string
  name: string | null
  building_name: string | null
  image_path: string | null
  image_width: number | null
  image_height: number | null
  sort_order: number | null
}

export interface IndoorStation {
  id: string
  floor_plan_id: string
  station_number: string | null
  station_type: string | null
  position_x_percent: number | null
  position_y_percent: number | null
  location_description: string | null
  comment: string | null
  photo_path: string | null
  status: string | null
}

/** Senaste inspektionen på en station — bär aktivitetsnivån. */
export interface LastInspection {
  station_id: string
  inspected_at: string
  status: string | null
  findings: string | null
  measurement_value: number | null
  measurement_unit: string | null
}

/**
 * Vad koordinatorn ska reagera på, i fallande allvar.
 * 'never' är AVSIKTLIGT neutral — en oinspekterad station är ett tillstånd
 * (arbetet har inte börjat), inte ett fel.
 */
export type EquipmentAlarm =
  | 'overdue_session'
  | 'activity_high'
  | 'stale'
  | 'activity'
  | 'never'
  | 'ok'
  | 'empty'

export const ALARM_RANK: Record<EquipmentAlarm, number> = {
  overdue_session: 5,
  activity_high: 4,
  stale: 3,
  activity: 2,
  never: 1,
  ok: 0,
  empty: -1,
}

export interface UnitEquipment {
  unit: RecordCustomer
  outdoor: OutdoorStation[]
  floorPlans: FloorPlan[]
  indoorByPlan: Record<string, IndoorStation[]>
  indoorCount: number
  total: number
  /** Senaste inspektion per station-id (både ute och inne) */
  lastByStation: Record<string, LastInspection>
  lastInspectedAt: string | null
  daysSince: number | null
  /** Bokad session vars datum passerat men som inte utförts */
  overdueSession: RecordInspectionSession | null
  nextSession: RecordInspectionSession | null
  findings: { none: number; ok: number; low: number; medium: number; high: number }
  alarm: EquipmentAlarm
  /** Vad larmet grundas på, för underrubriken i märket */
  alarmDetail: string | null
  /** Uppskattat intervall mellan kontroller, och varifrån det kommer */
  intervalDays: number | null
  intervalSource: 'schema' | 'observerad' | 'standard' | null
}

export interface CustomerEquipmentData {
  units: UnitEquipment[]
  totalOutdoor: number
  totalIndoor: number
  totalPlans: number
  /** Enheter som har något att visa */
  withEquipment: UnitEquipment[]
  /** Enheter helt utan utrustning — visas hopfällt, inte som tomrum */
  withoutEquipment: UnitEquipment[]
  lastInspectedAt: string | null
  alarmCount: number
}

const DAY = 86_400_000
const FALLBACK_INTERVAL_DAYS = 180

function daysBetween(from: string, to = new Date()): number {
  return Math.floor((to.getTime() - Date.parse(from)) / DAY)
}

/**
 * Hur ofta enheten normalt kontrolleras.
 *
 * contracts.visit_frequency är satt på 4 avtal av 621, så larmen får ALDRIG
 * kräva den. I stället härleds takten ur faktiskt utförda kontroller — den
 * datan finns redan och kräver ingen konfiguration.
 */
function estimateInterval(
  sessions: RecordInspectionSession[]
): { days: number | null; source: UnitEquipment['intervalSource'] } {
  const done = sessions
    .filter((s) => s.completed_at)
    .map((s) => Date.parse(s.completed_at as string))
    .sort((a, b) => a - b)

  if (done.length >= 2) {
    const gaps: number[] = []
    for (let i = 1; i < done.length; i++) gaps.push((done[i] - done[i - 1]) / DAY)
    gaps.sort((a, b) => a - b)
    const median = gaps[Math.floor(gaps.length / 2)]
    if (median > 0) return { days: Math.round(median), source: 'observerad' }
  }
  if (done.length === 1) return { days: FALLBACK_INTERVAL_DAYS, source: 'standard' }
  return { days: null, source: null }
}

export function useCustomerEquipment(
  root: RecordCustomer | null,
  units: RecordCustomer[],
  inspections: RecordInspectionSession[]
) {
  const [data, setData] = useState<CustomerEquipmentData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!root) return
    setLoading(true)

    const family = [root, ...units]
    const familyIds = family.map((c) => c.id)
    const todayIso = new Date().toISOString()

    // 1-2. Utomhusstationer och planritningar för HELA familjen
    const [outdoorRes, plansRes] = await Promise.all([
      supabase
        .from('equipment_placements')
        .select(
          'id, customer_id, serial_number, equipment_type, latitude, longitude, placed_at, comment, photo_path, station_type_id'
        )
        .in('customer_id', familyIds)
        .order('placed_at', { ascending: true }),
      supabase
        .from('floor_plans')
        .select('id, customer_id, name, building_name, image_path, image_width, image_height, sort_order')
        .in('customer_id', familyIds)
        .order('sort_order', { ascending: true }),
    ])

    const outdoor = (outdoorRes.data ?? []) as unknown as OutdoorStation[]
    const plans = (plansRes.data ?? []) as unknown as FloorPlan[]

    // 3. Inomhusstationer — indoor_stations har INGEN customer_id, kopplingen
    //    går via floor_plan_id. Ett anrop för alla planritningar.
    const planIds = plans.map((p) => p.id)
    const indoorRes = planIds.length
      ? await supabase
          .from('indoor_stations')
          .select(
            'id, floor_plan_id, station_number, station_type, position_x_percent, position_y_percent, location_description, comment, photo_path, status'
          )
          .in('floor_plan_id', planIds)
      : { data: [] }
    const indoor = (indoorRes.data ?? []) as unknown as IndoorStation[]

    // 4-5. Inspektioner — bär aktivitetsnivån ('none'|'ok'|'low'|'medium'|'high')
    const outdoorIds = outdoor.map((o) => o.id)
    const indoorIds = indoor.map((i) => i.id)
    const [outInspRes, inInspRes] = await Promise.all([
      outdoorIds.length
        ? supabase
            .from('outdoor_station_inspections')
            .select('station_id, inspected_at, status, findings, measurement_value, measurement_unit')
            .in('station_id', outdoorIds)
            .order('inspected_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      indoorIds.length
        ? supabase
            .from('indoor_station_inspections')
            .select('station_id, inspected_at, status, findings, measurement_value, measurement_unit')
            .in('station_id', indoorIds)
            .order('inspected_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    // Behåll bara SENASTE inspektionen per station (listan är redan fallande)
    const lastByStation: Record<string, LastInspection> = {}
    for (const row of [
      ...((outInspRes.data ?? []) as unknown as LastInspection[]),
      ...((inInspRes.data ?? []) as unknown as LastInspection[]),
    ]) {
      if (!lastByStation[row.station_id]) lastByStation[row.station_id] = row
    }

    // Gruppera per enhet
    const built: UnitEquipment[] = family.map((unit) => {
      const unitOutdoor = outdoor.filter((o) => o.customer_id === unit.id)
      const unitPlans = plans.filter((p) => p.customer_id === unit.id)
      const unitPlanIds = new Set(unitPlans.map((p) => p.id))
      const unitIndoor = indoor.filter((i) => unitPlanIds.has(i.floor_plan_id))

      const indoorByPlan: Record<string, IndoorStation[]> = {}
      for (const s of unitIndoor) {
        ;(indoorByPlan[s.floor_plan_id] ??= []).push(s)
      }

      const stationIds = [...unitOutdoor.map((o) => o.id), ...unitIndoor.map((i) => i.id)]
      const unitLast: Record<string, LastInspection> = {}
      const findings = { none: 0, ok: 0, low: 0, medium: 0, high: 0 }
      let lastInspectedAt: string | null = null
      for (const id of stationIds) {
        const insp = lastByStation[id]
        if (!insp) continue
        unitLast[id] = insp
        const key = (insp.status ?? 'none') as keyof typeof findings
        if (key in findings) findings[key] += 1
        if (!lastInspectedAt || insp.inspected_at > lastInspectedAt) lastInspectedAt = insp.inspected_at
      }

      const unitSessions = inspections.filter((s) => s.customer_id === unit.id)
      const overdueSession =
        unitSessions
          .filter((s) => s.status === 'scheduled' && (s.scheduled_at ?? '') < todayIso)
          .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))[0] ?? null
      const nextSession =
        unitSessions
          .filter((s) => s.status === 'scheduled' && (s.scheduled_at ?? '') >= todayIso)
          .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))[0] ?? null

      const { days: intervalDays, source: intervalSource } = estimateInterval(unitSessions)
      const daysSince = lastInspectedAt ? daysBetween(lastInspectedAt) : null
      const total = unitOutdoor.length + unitIndoor.length

      // Larmet i fallande allvar
      let alarm: EquipmentAlarm = 'ok'
      let alarmDetail: string | null = null
      if (total === 0) {
        alarm = 'empty'
      } else if (overdueSession) {
        alarm = 'overdue_session'
        alarmDetail = overdueSession.scheduled_at
          ? `bokad ${new Date(overdueSession.scheduled_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
          : null
      } else if (findings.high > 0) {
        alarm = 'activity_high'
        alarmDetail = `${findings.high} station${findings.high === 1 ? '' : 'er'}`
      } else if (!lastInspectedAt) {
        alarm = 'never'
        alarmDetail = `${total} station${total === 1 ? '' : 'er'}`
      } else if (intervalDays && daysSince != null && daysSince > intervalDays * 1.5) {
        alarm = 'stale'
        alarmDetail = `${daysSince} dagar sedan`
      } else if (findings.low + findings.medium > 0) {
        alarm = 'activity'
        alarmDetail = `${findings.low + findings.medium} station${findings.low + findings.medium === 1 ? '' : 'er'}`
      }

      return {
        unit,
        outdoor: unitOutdoor,
        floorPlans: unitPlans,
        indoorByPlan,
        indoorCount: unitIndoor.length,
        total,
        lastByStation: unitLast,
        lastInspectedAt,
        daysSince,
        overdueSession,
        nextSession,
        findings,
        alarm,
        alarmDetail,
        intervalDays,
        intervalSource,
      }
    })

    // Det som kräver uppmärksamhet ligger alltid överst
    const sorted = [...built].sort((a, b) => {
      const rank = ALARM_RANK[b.alarm] - ALARM_RANK[a.alarm]
      if (rank !== 0) return rank
      return (b.daysSince ?? -1) - (a.daysSince ?? -1)
    })

    setData({
      units: sorted,
      totalOutdoor: outdoor.length,
      totalIndoor: indoor.length,
      totalPlans: plans.length,
      withEquipment: sorted.filter((u) => u.total > 0),
      withoutEquipment: sorted.filter((u) => u.total === 0),
      lastInspectedAt:
        Object.values(lastByStation)
          .map((i) => i.inspected_at)
          .sort()
          .pop() ?? null,
      alarmCount: sorted.filter((u) => ALARM_RANK[u.alarm] >= ALARM_RANK.stale).length,
    })
    setLoading(false)
  }, [root, units, inspections])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, refetch: load }
}
