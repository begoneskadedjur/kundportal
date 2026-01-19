// src/services/inspectionSessionService.ts
// Service för att hantera stationsinspektionssessioner (Fas 5)

import { supabase } from '../lib/supabase'
import {
  StationInspectionSession,
  InspectionSessionWithRelations,
  OutdoorStationInspection,
  OutdoorInspectionWithRelations,
  CreateInspectionSessionInput,
  UpdateInspectionSessionInput,
  CreateOutdoorInspectionInput,
  CreateIndoorInspectionInput,
  InspectionSessionStatus,
  SessionProgress,
  InspectionSummary
} from '../types/inspectionSession'
import { IndoorStationWithRelations, IndoorStationInspectionWithRelations } from '../types/indoor'
import { InspectionStatus } from '../types/indoor'

// ============================================
// SESSION FUNCTIONS
// ============================================

/**
 * Hämta inspektionssession med ID
 */
export async function getInspectionSession(
  sessionId: string
): Promise<InspectionSessionWithRelations | null> {
  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .select(`
      *,
      customer:customers(id, company_name, contact_address),
      technician:technicians(id, name)
    `)
    .eq('id', sessionId)
    .single()

  if (error) {
    console.error('Error fetching inspection session:', error)
    return null
  }

  return data as InspectionSessionWithRelations
}

/**
 * Hämta inspektionssession via case_id
 */
export async function getInspectionSessionByCaseId(
  caseId: string
): Promise<InspectionSessionWithRelations | null> {
  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .select(`
      *,
      customer:customers(id, company_name, contact_address),
      technician:technicians(id, name)
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching inspection session by case_id:', error)
    return null
  }

  return data as InspectionSessionWithRelations | null
}

/**
 * Skapa ny inspektionssession
 */
export async function createInspectionSession(
  input: CreateInspectionSessionInput
): Promise<StationInspectionSession | null> {
  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .insert([{
      case_id: input.case_id || null,
      customer_id: input.customer_id,
      technician_id: input.technician_id || null,
      scheduled_at: input.scheduled_at || null,
      status: 'scheduled',
      notes: input.notes || null
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating inspection session:', error)
    return null
  }

  return data as StationInspectionSession
}

/**
 * Uppdatera inspektionssession
 */
export async function updateInspectionSession(
  sessionId: string,
  input: UpdateInspectionSessionInput
): Promise<StationInspectionSession | null> {
  const updateData: Record<string, any> = { ...input }

  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating inspection session:', error)
    return null
  }

  return data as StationInspectionSession
}

/**
 * Starta inspektionssession
 */
export async function startInspectionSession(
  sessionId: string
): Promise<StationInspectionSession | null> {
  return updateInspectionSession(sessionId, {
    status: 'in_progress',
    started_at: new Date().toISOString()
  })
}

/**
 * Avsluta inspektionssession
 */
export async function completeInspectionSession(
  sessionId: string,
  notes?: string
): Promise<StationInspectionSession | null> {
  const updateData: UpdateInspectionSessionInput = {
    status: 'completed',
    completed_at: new Date().toISOString()
  }

  if (notes) {
    updateData.notes = notes
  }

  return updateInspectionSession(sessionId, updateData)
}

// ============================================
// OUTDOOR INSPECTION FUNCTIONS
// ============================================

/**
 * Hämta utomhusinspektioner för en session
 */
export async function getOutdoorInspectionsForSession(
  sessionId: string
): Promise<OutdoorInspectionWithRelations[]> {
  const { data, error } = await supabase
    .from('outdoor_station_inspections')
    .select(`
      *,
      station:equipment_placements(id, station_number, station_type, equipment_type_code),
      technician:technicians(id, name)
    `)
    .eq('session_id', sessionId)
    .order('inspected_at', { ascending: false })

  if (error) {
    console.error('Error fetching outdoor inspections:', error)
    return []
  }

  return data as OutdoorInspectionWithRelations[]
}

/**
 * Skapa utomhusinspektion
 */
export async function createOutdoorInspection(
  input: CreateOutdoorInspectionInput,
  technicianId?: string
): Promise<OutdoorStationInspection | null> {
  const { data, error } = await supabase
    .from('outdoor_station_inspections')
    .insert([{
      station_id: input.station_id,
      session_id: input.session_id || null,
      status: input.status,
      findings: input.findings || null,
      photo_path: input.photo_path || null,
      measurement_value: input.measurement_value || null,
      measurement_unit: input.measurement_unit || null,
      inspected_by: technicianId || null
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating outdoor inspection:', error)
    return null
  }

  return data as OutdoorStationInspection
}

/**
 * Hämta senaste utomhusinspektion för en station
 */
export async function getLatestOutdoorInspection(
  stationId: string
): Promise<OutdoorInspectionWithRelations | null> {
  const { data, error } = await supabase
    .from('outdoor_station_inspections')
    .select(`
      *,
      technician:technicians(id, name)
    `)
    .eq('station_id', stationId)
    .order('inspected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching latest outdoor inspection:', error)
    return null
  }

  return data as OutdoorInspectionWithRelations | null
}

// ============================================
// INDOOR INSPECTION FUNCTIONS
// ============================================

/**
 * Hämta inomhusinspektioner för en session
 */
export async function getIndoorInspectionsForSession(
  sessionId: string
): Promise<IndoorStationInspectionWithRelations[]> {
  const { data, error } = await supabase
    .from('indoor_station_inspections')
    .select(`
      *,
      technician:technicians(id, name)
    `)
    .eq('session_id', sessionId)
    .order('inspected_at', { ascending: false })

  if (error) {
    console.error('Error fetching indoor inspections:', error)
    return []
  }

  return data as IndoorStationInspectionWithRelations[]
}

/**
 * Skapa inomhusinspektion
 */
export async function createIndoorInspection(
  input: CreateIndoorInspectionInput,
  technicianId?: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('indoor_station_inspections')
    .insert([{
      station_id: input.station_id,
      session_id: input.session_id || null,
      status: input.status,
      findings: input.findings || null,
      photo_path: input.photo_path || null,
      measurement_value: input.measurement_value || null,
      measurement_unit: input.measurement_unit || null,
      inspected_by: technicianId || null
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating indoor inspection:', error)
    return null
  }

  return data
}

// ============================================
// STATION DATA FUNCTIONS
// ============================================

/**
 * Hämta alla utomhusstationer för en kund
 */
export async function getOutdoorStationsForCustomer(
  customerId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('equipment_placements')
    .select(`
      *,
      technician:technicians!equipment_placements_placed_by_technician_id_fkey(id, name),
      station_type_data:station_types(*)
    `)
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .order('station_number', { ascending: true })

  if (error) {
    console.error('Error fetching outdoor stations:', error)
    return []
  }

  return data || []
}

/**
 * Hämta alla inomhusstationer för en kund (via floor_plans)
 */
export async function getIndoorStationsForCustomer(
  customerId: string
): Promise<IndoorStationWithRelations[]> {
  // Först hämta alla floor_plans för kunden
  const { data: floorPlans, error: fpError } = await supabase
    .from('floor_plans')
    .select('id')
    .eq('customer_id', customerId)

  if (fpError || !floorPlans?.length) {
    if (fpError) console.error('Error fetching floor plans:', fpError)
    return []
  }

  const floorPlanIds = floorPlans.map(fp => fp.id)

  // Hämta stationer för dessa planritningar
  const { data, error } = await supabase
    .from('indoor_stations')
    .select(`
      *,
      floor_plan:floor_plans(id, name, building_name, image_path, customer_id),
      technician:technicians(id, name),
      station_type_data:station_types(*)
    `)
    .in('floor_plan_id', floorPlanIds)
    .eq('status', 'active')
    .order('station_number', { ascending: true })

  if (error) {
    console.error('Error fetching indoor stations:', error)
    return []
  }

  return data as IndoorStationWithRelations[]
}

/**
 * Hämta floor plans för en kund
 */
export async function getFloorPlansForCustomer(
  customerId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('floor_plans')
    .select('*')
    .eq('customer_id', customerId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching floor plans:', error)
    return []
  }

  return data || []
}

// ============================================
// SUMMARY & STATS FUNCTIONS
// ============================================

/**
 * Beräkna sessionens progress
 */
export async function calculateSessionProgress(
  sessionId: string
): Promise<SessionProgress> {
  // Hämta sessionen
  const session = await getInspectionSession(sessionId)

  if (!session) {
    return {
      totalStations: 0,
      inspectedStations: 0,
      percentComplete: 0,
      outdoorProgress: { total: 0, inspected: 0 },
      indoorProgress: { total: 0, inspected: 0 }
    }
  }

  const totalStations = session.total_outdoor_stations + session.total_indoor_stations
  const inspectedStations = session.inspected_outdoor_stations + session.inspected_indoor_stations

  return {
    totalStations,
    inspectedStations,
    percentComplete: totalStations > 0 ? Math.round((inspectedStations / totalStations) * 100) : 0,
    outdoorProgress: {
      total: session.total_outdoor_stations,
      inspected: session.inspected_outdoor_stations
    },
    indoorProgress: {
      total: session.total_indoor_stations,
      inspected: session.inspected_indoor_stations
    }
  }
}

/**
 * Generera inspektionssammanfattning
 */
export async function generateInspectionSummary(
  sessionId: string
): Promise<InspectionSummary | null> {
  const session = await getInspectionSession(sessionId)
  if (!session) return null

  // Hämta alla inspektioner
  const [outdoorInspections, indoorInspections] = await Promise.all([
    getOutdoorInspectionsForSession(sessionId),
    getIndoorInspectionsForSession(sessionId)
  ])

  // Räkna statusar
  const countByStatus = (inspections: { status: InspectionStatus }[]) => {
    return {
      ok: inspections.filter(i => i.status === 'ok').length,
      activity: inspections.filter(i => i.status === 'activity').length,
      needsService: inspections.filter(i => i.status === 'needs_service').length,
      replaced: inspections.filter(i => i.status === 'replaced').length
    }
  }

  const outdoorStats = countByStatus(outdoorInspections)
  const indoorStats = countByStatus(indoorInspections)

  // Beräkna varaktighet
  let duration: number | null = null
  if (session.started_at && session.completed_at) {
    const start = new Date(session.started_at).getTime()
    const end = new Date(session.completed_at).getTime()
    duration = Math.round((end - start) / 60000) // minuter
  }

  return {
    sessionId: session.id,
    customerId: session.customer_id,
    scheduledAt: session.scheduled_at,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    duration,
    totalStations: session.total_outdoor_stations + session.total_indoor_stations,
    inspectedStations: session.inspected_outdoor_stations + session.inspected_indoor_stations,
    outdoorStats: {
      total: session.total_outdoor_stations,
      ...outdoorStats
    },
    indoorStats: {
      total: session.total_indoor_stations,
      ...indoorStats
    },
    notes: session.notes
  }
}

// ============================================
// PHOTO UPLOAD FUNCTIONS
// ============================================

/**
 * Ladda upp inspektionsfoto
 */
export async function uploadInspectionPhoto(
  file: File,
  stationId: string,
  stationType: 'indoor' | 'outdoor'
): Promise<string | null> {
  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  const fileName = `${stationType}/${stationId}/${timestamp}.${fileExt}`

  const { error } = await supabase.storage
    .from('inspection-photos')
    .upload(fileName, file)

  if (error) {
    console.error('Error uploading inspection photo:', error)
    return null
  }

  return fileName
}

/**
 * Hämta signerad URL för inspektionsfoto
 */
export async function getInspectionPhotoUrl(
  photoPath: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from('inspection-photos')
    .createSignedUrl(photoPath, 3600)

  return data?.signedUrl || null
}

// ============================================
// CASE STATUS UPDATE
// ============================================

/**
 * Uppdatera ärendestatus när inspektionen är klar
 */
export async function updateCaseStatusToCompleted(
  caseId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('cases')
    .update({ status: 'Avslutat' })
    .eq('id', caseId)

  if (error) {
    console.error('Error updating case status:', error)
    return false
  }

  return true
}
