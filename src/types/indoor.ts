// src/types/indoor.ts
// TypeScript types for indoor station placement system

// ============================================
// ENUMS & CONSTANTS
// ============================================

// IndoorStationType är nu en dynamisk sträng som matchar 'code' från station_types tabellen
export type IndoorStationType = string;
export type IndoorStationStatus = 'active' | 'removed' | 'missing' | 'damaged';
export type InspectionStatus = 'ok' | 'activity' | 'needs_service' | 'replaced';

// LEGACY: Hårdkodad konfiguration för bakåtkompatibilitet
// OBS: Dessa används endast som fallback om inga dynamiska typer finns i databasen
export const INDOOR_STATION_TYPE_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  requiresSerialNumber: boolean;
  prefix: string;
}> = {
  mechanical_trap: {
    label: 'Mekanisk fälla',
    color: '#22c55e', // green
    bgColor: 'bg-green-500/20',
    requiresSerialNumber: true,
    prefix: 'MF'
  },
  concrete_station: {
    label: 'Betongstation',
    color: '#6b7280', // gray
    bgColor: 'bg-slate-500/20',
    requiresSerialNumber: false,
    prefix: 'BS'
  },
  bait_station: {
    label: 'Betesstation',
    color: '#000000', // black
    bgColor: 'bg-slate-800/40',
    requiresSerialNumber: false,
    prefix: 'BT'
  }
};

// Station status configuration (same as outdoor)
export const INDOOR_STATION_STATUS_CONFIG: Record<IndoorStationStatus, {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  active: {
    label: 'Aktiv',
    color: 'green-500',
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-400'
  },
  removed: {
    label: 'Borttagen',
    color: 'slate-500',
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400'
  },
  missing: {
    label: 'Försvunnen',
    color: 'amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400'
  },
  damaged: {
    label: 'Skadad',
    color: 'red-500',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400'
  }
};

// Inspection status configuration
export const INSPECTION_STATUS_CONFIG: Record<InspectionStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  ok: {
    label: 'OK - Inga fynd',
    color: 'green-500',
    bgColor: 'bg-green-500/20',
    icon: '✓'
  },
  activity: {
    label: 'Aktivitet upptäckt',
    color: 'amber-500',
    bgColor: 'bg-amber-500/20',
    icon: '!'
  },
  needs_service: {
    label: 'Behöver service',
    color: 'orange-500',
    bgColor: 'bg-orange-500/20',
    icon: '⚠'
  },
  replaced: {
    label: 'Utbytt',
    color: 'blue-500',
    bgColor: 'bg-blue-500/20',
    icon: '↻'
  }
};

// ============================================
// DATABASE TYPES
// ============================================

export interface FloorPlan {
  id: string;
  customer_id: string;
  name: string;
  description: string | null;
  building_name: string | null;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface IndoorStation {
  id: string;
  floor_plan_id: string;
  station_type: IndoorStationType;
  station_type_id: string | null; // FK to station_types table
  station_number: string | null;
  position_x_percent: number;
  position_y_percent: number;
  location_description: string | null;
  comment: string | null;
  photo_path: string | null;
  status: IndoorStationStatus;
  calculated_status: 'ok' | 'warning' | 'critical'; // Status baserad på mätningar vs tröskelvärden
  status_updated_at: string | null;
  status_updated_by: string | null;
  placed_at: string;
  placed_by_technician_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IndoorStationInspection {
  id: string;
  station_id: string;
  inspected_at: string;
  inspected_by: string | null;
  status: InspectionStatus;
  findings: string | null;
  photo_path: string | null;
  created_at: string;
}

// ============================================
// EXTENDED TYPES WITH RELATIONS
// ============================================

export interface FloorPlanWithRelations extends FloorPlan {
  customer?: {
    id: string;
    company_name: string;
    contact_address: string | null;
  };
  stations?: IndoorStationWithRelations[];
  station_count?: number;
  image_url?: string; // Signed URL from storage
}

export interface IndoorStationWithRelations extends IndoorStation {
  floor_plan?: FloorPlan;
  technician?: {
    id: string;
    name: string;
  };
  station_type_data?: {
    id: string;
    code: string;
    name: string;
    color: string;
    icon: string;
    prefix: string;
    measurement_unit: string;
    measurement_label: string | null;
    threshold_warning: number | null;
    threshold_critical: number | null;
    threshold_direction: 'above' | 'below';
  };
  latest_inspection?: IndoorStationInspection;
  latest_measurement?: {
    id: string;
    value: number;
    measured_at: string;
  };
  inspection_count?: number;
  photo_url?: string; // Signed URL from storage
}

export interface IndoorStationInspectionWithRelations extends IndoorStationInspection {
  technician?: {
    id: string;
    name: string;
  };
  photo_url?: string; // Signed URL from storage
}

// ============================================
// FORM & INPUT TYPES
// ============================================

export interface CreateFloorPlanInput {
  customer_id: string;
  name: string;
  description?: string;
  building_name?: string;
  image: File;
}

export interface UpdateFloorPlanInput {
  name?: string;
  description?: string;
  building_name?: string;
  sort_order?: number;
}

export interface CreateIndoorStationInput {
  floor_plan_id: string;
  station_type: IndoorStationType;
  station_number?: string;
  position_x_percent: number;
  position_y_percent: number;
  location_description?: string;
  comment?: string;
  photo?: File;
}

export interface UpdateIndoorStationInput {
  station_number?: string;
  position_x_percent?: number;
  position_y_percent?: number;
  location_description?: string;
  comment?: string;
  status?: IndoorStationStatus;
  photo?: File;
}

export interface CreateInspectionInput {
  station_id: string;
  status: InspectionStatus;
  findings?: string;
  photo?: File;
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface FloorPlanStats {
  total_floor_plans: number;
  total_stations: number;
  stations_by_type: Record<IndoorStationType, number>;
  stations_by_status: Record<IndoorStationStatus, number>;
}

export interface CustomerIndoorStats {
  customer_id: string;
  floor_plan_count: number;
  total_stations: number;
  active_stations: number;
  recent_inspections: number; // Last 30 days
}

// ============================================
// UI STATE TYPES
// ============================================

export type PlacementMode = 'view' | 'place' | 'move';

export interface PlacementState {
  mode: PlacementMode;
  selectedType: IndoorStationType | null;
  previewPosition: { x: number; y: number } | null;
  movingStationId: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate next station number for a floor plan
 * Format: {PREFIX}-{NNN} where PREFIX is based on station type
 *
 * @param stationType - Station type code (för legacy-kompatibilitet)
 * @param existingNumbers - Existerande stationsnummer på planritningen
 * @param customPrefix - Anpassat prefix från dynamisk stationstyp (övertrumfar lookup)
 */
export function generateStationNumber(
  stationType: IndoorStationType,
  existingNumbers: string[],
  customPrefix?: string
): string {
  // Använd anpassat prefix om det finns, annars fall tillbaka till legacy-config
  const prefix = customPrefix || INDOOR_STATION_TYPE_CONFIG[stationType]?.prefix || 'ST';

  // Find existing numbers with this prefix
  const existingWithPrefix = existingNumbers
    .filter(n => n?.startsWith(prefix + '-'))
    .map(n => parseInt(n.split('-')[1], 10))
    .filter(n => !isNaN(n));

  // Get next number
  const maxNumber = existingWithPrefix.length > 0 ? Math.max(...existingWithPrefix) : 0;
  const nextNumber = maxNumber + 1;

  return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Get display label for station type
 */
export function getStationTypeLabel(type: IndoorStationType): string {
  return INDOOR_STATION_TYPE_CONFIG[type]?.label || type;
}

/**
 * Get display label for station status
 */
export function getStationStatusLabel(status: IndoorStationStatus): string {
  return INDOOR_STATION_STATUS_CONFIG[status]?.label || status;
}

/**
 * Get display label for inspection status
 */
export function getInspectionStatusLabel(status: InspectionStatus): string {
  return INSPECTION_STATUS_CONFIG[status]?.label || status;
}

/**
 * Format position as human-readable string
 */
export function formatPosition(x: number, y: number): string {
  return `${x.toFixed(1)}%, ${y.toFixed(1)}%`;
}
