// src/types/inspectionSession.ts
// TypeScript-typer för stationskontroll-sessioner (Fas 5)

import type { InspectionStatus } from './indoor'
import type { MeasurementUnit } from './stationTypes'

// ============================================
// SESSION STATUS
// ============================================

export type InspectionSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export const INSPECTION_SESSION_STATUS_CONFIG: Record<InspectionSessionStatus, {
  label: string
  color: string
  bgColor: string
  textColor: string
  icon: string
}> = {
  scheduled: {
    label: 'Inbokad',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    icon: '📅'
  },
  in_progress: {
    label: 'Pågår',
    color: '#f59e0b',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    icon: '🔄'
  },
  completed: {
    label: 'Avslutad',
    color: '#10b981',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    icon: '✓'
  },
  cancelled: {
    label: 'Avbokad',
    color: '#64748b',
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400',
    icon: '✕'
  }
}

// ============================================
// DATABASE TYPES
// ============================================

/**
 * Inspektionssession från databasen
 */
export interface StationInspectionSession {
  id: string
  case_id: string | null
  customer_id: string
  technician_id: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_outdoor_stations: number
  total_indoor_stations: number
  inspected_outdoor_stations: number
  inspected_indoor_stations: number
  status: InspectionSessionStatus
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

/**
 * Utomhusstation inspektion
 */
export interface OutdoorStationInspection {
  id: string
  station_id: string
  session_id: string | null
  inspected_at: string
  inspected_by: string | null
  status: InspectionStatus
  findings: string | null
  photo_path: string | null
  measurement_value: number | null
  measurement_unit: string | null
  preparation_id: string | null
  created_at: string
}

// ============================================
// EXTENDED TYPES WITH RELATIONS
// ============================================

/**
 * Session med alla relationer
 */
export interface InspectionSessionWithRelations extends StationInspectionSession {
  customer?: {
    id: string
    company_name: string
    contact_address: string | null
    contact_person: string | null
    contact_phone: string | null
    contact_email: string | null
    // GPS-koordinater för navigation
    address_lat?: number | null
    address_lng?: number | null
  }
  technician?: {
    id: string
    name: string
  }
  case?: {
    id: string
    title: string
    case_number: string | null
  }
  // Senaste inspektionsdata
  lastInspection?: {
    completed_at: string | null
    technician_name: string | null
    total_inspected: number
    stations_with_activity: number
  } | null
  // Sammanfattning av statusar (för historikvisning)
  inspection_summary?: {
    ok: number
    warning: number
    critical: number
    total: number
  } | null
}

/**
 * Utomhusinspektion med relationer
 */
export interface OutdoorInspectionWithRelations extends OutdoorStationInspection {
  station?: {
    id: string
    serial_number: string | null
    station_type_id: string | null
    equipment_type: string | null
    station_type_data?: {
      id: string
      code: string
      name: string
      color: string
      measurement_unit: string
      measurement_label: string | null
    }
  }
  technician?: {
    id: string
    name: string
  }
  preparation?: {
    id: string
    name: string
    registration_number: string | null
  } | null
  photo_url?: string
}

// ============================================
// FORM & INPUT TYPES
// ============================================

/**
 * Input för att skapa ny inspektionssession
 */
export interface CreateInspectionSessionInput {
  case_id?: string
  customer_id: string
  technician_id?: string
  scheduled_at?: string
  notes?: string
}

/**
 * Input för att uppdatera session
 */
export interface UpdateInspectionSessionInput {
  status?: InspectionSessionStatus
  started_at?: string
  completed_at?: string | null
  notes?: string
  total_outdoor_stations?: number
  total_indoor_stations?: number
  inspected_outdoor_stations?: number
  inspected_indoor_stations?: number
}

/**
 * Input för att skapa utomhusinspektion
 */
export interface CreateOutdoorInspectionInput {
  station_id: string
  session_id?: string
  status: InspectionStatus
  findings?: string
  photo_path?: string
  measurement_value?: number
  measurement_unit?: MeasurementUnit
  preparation_id?: string
}

/**
 * Input för att skapa inomhusinspektion (utökad version)
 */
export interface CreateIndoorInspectionInput {
  station_id: string
  session_id?: string
  status: InspectionStatus
  findings?: string
  photo_path?: string
  measurement_value?: number
  measurement_unit?: MeasurementUnit
  preparation_id?: string
}

// ============================================
// PROGRESS & STATS TYPES
// ============================================

/**
 * Progress för en session
 */
export interface SessionProgress {
  totalStations: number
  inspectedStations: number
  percentComplete: number
  outdoorProgress: {
    total: number
    inspected: number
  }
  indoorProgress: {
    total: number
    inspected: number
  }
}

/**
 * Sammanfattning av inspektionsstatus
 */
export interface InspectionSummary {
  sessionId: string
  customerId: string
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null // minuter
  totalStations: number
  inspectedStations: number
  outdoorStats: {
    total: number
    ok: number
    activity: number
    needsService: number
    replaced: number
  }
  indoorStats: {
    total: number
    ok: number
    activity: number
    needsService: number
    replaced: number
  }
  notes: string | null
}

// ============================================
// UI STATE TYPES
// ============================================

/**
 * Aktiv flik i inspektionsmodulen
 */
export type InspectionTab = 'outdoor' | 'indoor'

/**
 * State för inspektionsmodulen
 */
export interface InspectionModuleState {
  activeTab: InspectionTab
  selectedStationId: string | null
  isFormOpen: boolean
  isConfirmDialogOpen: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Beräkna progress från session
 */
export function calculateSessionProgress(session: StationInspectionSession): SessionProgress {
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
 * Kontrollera om session kan avslutas
 */
export function canCompleteSession(session: StationInspectionSession): boolean {
  const progress = calculateSessionProgress(session)
  // Kan avslutas om minst en station är kontrollerad
  return progress.inspectedStations > 0
}

/**
 * Formatera sessionens varaktighet
 */
export function formatSessionDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-'

  const start = new Date(startedAt)
  const end = completedAt ? new Date(completedAt) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes < 60) {
    return `${diffMinutes} min`
  }

  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60

  if (minutes === 0) {
    return `${hours} tim`
  }

  return `${hours} tim ${minutes} min`
}

/**
 * Hämta statuslabel för session
 */
export function getSessionStatusLabel(status: InspectionSessionStatus): string {
  return INSPECTION_SESSION_STATUS_CONFIG[status]?.label || status
}
