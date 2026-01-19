// src/types/stationTypes.ts
// TypeScript-typer för dynamiska stationstyper och mätningar

/**
 * Tillgängliga mätenheter
 */
export type MeasurementUnit = 'gram' | 'st' | 'ml' | 'procent' | 'kg'

/**
 * Riktning för tröskelvärden
 * - 'above': Värde ÖVER tröskeln är dåligt (t.ex. förbrukning ökar)
 * - 'below': Värde UNDER tröskeln är dåligt (t.ex. bete minskar)
 */
export type ThresholdDirection = 'above' | 'below'

/**
 * Beräknad status baserat på mätning vs tröskelvärden
 */
export type CalculatedStatus = 'ok' | 'warning' | 'critical'

/**
 * Stationstyp från databasen
 */
export interface StationType {
  id: string
  code: string
  name: string
  description: string | null
  prefix: string
  color: string
  icon: string
  requires_serial_number: boolean
  measurement_unit: MeasurementUnit
  measurement_label: string | null
  threshold_warning: number | null
  threshold_critical: number | null
  threshold_direction: ThresholdDirection
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * Input för att skapa ny stationstyp
 */
export interface CreateStationTypeInput {
  code: string
  name: string
  description?: string
  prefix: string
  color: string
  icon?: string
  requires_serial_number?: boolean
  measurement_unit: MeasurementUnit
  measurement_label?: string
  threshold_warning?: number | null
  threshold_critical?: number | null
  threshold_direction?: ThresholdDirection
  is_active?: boolean
  sort_order?: number
}

/**
 * Input för att uppdatera stationstyp
 */
export interface UpdateStationTypeInput {
  name?: string
  description?: string | null
  prefix?: string
  color?: string
  icon?: string
  requires_serial_number?: boolean
  measurement_unit?: MeasurementUnit
  measurement_label?: string | null
  threshold_warning?: number | null
  threshold_critical?: number | null
  threshold_direction?: ThresholdDirection
  is_active?: boolean
  sort_order?: number
}

/**
 * Stationsmätning från databasen
 */
export interface StationMeasurement {
  id: string
  indoor_station_id: string | null
  outdoor_station_id: string | null
  value: number
  measurement_type: string | null
  measured_at: string
  measured_by: string | null
  note: string | null
  photo_path: string | null
  created_at: string
}

/**
 * Mätning med tekniker-relation
 */
export interface StationMeasurementWithRelations extends StationMeasurement {
  technician?: {
    id: string
    name: string
  } | null
}

/**
 * Input för att skapa ny mätning
 */
export interface CreateMeasurementInput {
  indoor_station_id?: string
  outdoor_station_id?: string
  value: number
  measurement_type?: string
  note?: string
  photo_path?: string
}

/**
 * Konfiguration för visning av mätenheter
 */
export const MEASUREMENT_UNIT_CONFIG: Record<MeasurementUnit, {
  label: string
  shortLabel: string
  format: (value: number) => string
}> = {
  gram: {
    label: 'Gram',
    shortLabel: 'g',
    format: (v) => `${v}g`
  },
  st: {
    label: 'Stycken',
    shortLabel: 'st',
    format: (v) => `${v} st`
  },
  ml: {
    label: 'Milliliter',
    shortLabel: 'ml',
    format: (v) => `${v}ml`
  },
  procent: {
    label: 'Procent',
    shortLabel: '%',
    format: (v) => `${v}%`
  },
  kg: {
    label: 'Kilogram',
    shortLabel: 'kg',
    format: (v) => `${v}kg`
  }
}

/**
 * Konfiguration för beräknad status
 */
export const CALCULATED_STATUS_CONFIG: Record<CalculatedStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  ok: {
    label: 'OK',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  warning: {
    label: 'Varning',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  critical: {
    label: 'Kritisk',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  }
}

/**
 * Beräkna status baserat på stationstyp och senaste mätning
 */
export function calculateStationStatus(
  stationType: StationType | null,
  latestMeasurement: number | null
): CalculatedStatus {
  // Ingen mätning = OK
  if (latestMeasurement === null || latestMeasurement === undefined) {
    return 'ok'
  }

  // Ingen stationstyp = OK
  if (!stationType) {
    return 'ok'
  }

  // Inga tröskelvärden konfigurerade = OK
  if (stationType.threshold_warning === null && stationType.threshold_critical === null) {
    return 'ok'
  }

  const { threshold_warning, threshold_critical, threshold_direction } = stationType

  if (threshold_direction === 'above') {
    // Värde ÖVERSTIGER tröskeln är dåligt (t.ex. förbrukning)
    if (threshold_critical !== null && latestMeasurement >= threshold_critical) {
      return 'critical'
    }
    if (threshold_warning !== null && latestMeasurement >= threshold_warning) {
      return 'warning'
    }
  } else {
    // Värde UNDERSTIGER tröskeln är dåligt (t.ex. vikt kvar)
    if (threshold_critical !== null && latestMeasurement <= threshold_critical) {
      return 'critical'
    }
    if (threshold_warning !== null && latestMeasurement <= threshold_warning) {
      return 'warning'
    }
  }

  return 'ok'
}

/**
 * Formatera tröskelvärde för visning
 */
export function formatThreshold(
  value: number | null,
  unit: MeasurementUnit,
  direction: ThresholdDirection
): string {
  if (value === null) return '-'

  const unitConfig = MEASUREMENT_UNIT_CONFIG[unit]
  const prefix = direction === 'above' ? '>' : '<'
  return `${prefix}${unitConfig.format(value)}`
}

/**
 * Generera förhandsgranskning av tröskelvärden
 */
export function generateThresholdPreview(
  stationType: Pick<StationType, 'threshold_warning' | 'threshold_critical' | 'threshold_direction' | 'measurement_unit'>
): Array<{ range: string; status: CalculatedStatus; label: string }> {
  const { threshold_warning, threshold_critical, threshold_direction, measurement_unit } = stationType
  const unit = MEASUREMENT_UNIT_CONFIG[measurement_unit]
  const preview: Array<{ range: string; status: CalculatedStatus; label: string }> = []

  if (threshold_direction === 'above') {
    // OK: 0 till varning-1
    if (threshold_warning !== null) {
      preview.push({
        range: `0-${threshold_warning - 1}${unit.shortLabel}`,
        status: 'ok',
        label: 'OK'
      })
      // Varning: varning till kritisk-1
      if (threshold_critical !== null) {
        preview.push({
          range: `${threshold_warning}-${threshold_critical - 1}${unit.shortLabel}`,
          status: 'warning',
          label: 'Varning'
        })
        preview.push({
          range: `${threshold_critical}${unit.shortLabel}+`,
          status: 'critical',
          label: 'Kritisk'
        })
      } else {
        preview.push({
          range: `${threshold_warning}${unit.shortLabel}+`,
          status: 'warning',
          label: 'Varning'
        })
      }
    } else if (threshold_critical !== null) {
      preview.push({
        range: `0-${threshold_critical - 1}${unit.shortLabel}`,
        status: 'ok',
        label: 'OK'
      })
      preview.push({
        range: `${threshold_critical}${unit.shortLabel}+`,
        status: 'critical',
        label: 'Kritisk'
      })
    }
  } else {
    // below: Värde under tröskeln är dåligt
    if (threshold_critical !== null) {
      preview.push({
        range: `0-${threshold_critical}${unit.shortLabel}`,
        status: 'critical',
        label: 'Kritisk'
      })
      if (threshold_warning !== null) {
        preview.push({
          range: `${threshold_critical + 1}-${threshold_warning}${unit.shortLabel}`,
          status: 'warning',
          label: 'Varning'
        })
        preview.push({
          range: `${threshold_warning + 1}${unit.shortLabel}+`,
          status: 'ok',
          label: 'OK'
        })
      } else {
        preview.push({
          range: `${threshold_critical + 1}${unit.shortLabel}+`,
          status: 'ok',
          label: 'OK'
        })
      }
    } else if (threshold_warning !== null) {
      preview.push({
        range: `0-${threshold_warning}${unit.shortLabel}`,
        status: 'warning',
        label: 'Varning'
      })
      preview.push({
        range: `${threshold_warning + 1}${unit.shortLabel}+`,
        status: 'ok',
        label: 'OK'
      })
    }
  }

  return preview
}
