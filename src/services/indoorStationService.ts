// src/services/indoorStationService.ts - Service för inomhusstationer
import { supabase } from '../lib/supabase'
import { compressToWebP } from '../utils/imageUtils'
import type {
  IndoorStation,
  IndoorStationWithRelations,
  IndoorStationInspection,
  IndoorStationInspectionWithRelations,
  CreateIndoorStationInput,
  UpdateIndoorStationInput,
  CreateInspectionInput,
  IndoorStationStatus
} from '../types/indoor'
import { generateStationNumber } from '../types/indoor'

export const INDOOR_STATION_PHOTOS_BUCKET = 'indoor-station-photos'
export const MAX_STATION_PHOTO_SIZE = 5 * 1024 * 1024 // 5MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * Service för hantering av inomhusstationer
 * Hanterar CRUD-operationer, bilduppladdning och inspektioner
 */
export class IndoorStationService {
  /**
   * Hämta alla stationer för en planritning
   */
  static async getStationsByFloorPlan(floorPlanId: string): Promise<IndoorStationWithRelations[]> {
    try {
      console.log('Hämtar stationer för planritning:', floorPlanId)

      const { data, error } = await supabase
        .from('indoor_stations')
        .select(`
          *,
          technician:technicians!placed_by_technician_id(id, name),
          station_type_data:station_types!station_type_id(
            id,
            code,
            name,
            color,
            icon,
            prefix,
            measurement_unit,
            measurement_label,
            threshold_warning,
            threshold_critical,
            threshold_direction,
            threshold_source
          )
        `)
        .eq('floor_plan_id', floorPlanId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av stationer:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Hämta alla stationstyper för fallback-lookup (om station_type_id saknas)
      const { data: allStationTypes } = await supabase
        .from('station_types')
        .select('id, code, name, color, icon, prefix, measurement_unit, measurement_label, threshold_warning, threshold_critical, threshold_direction, threshold_source')
        .eq('is_active', true)

      // Skapa map för snabb lookup på code
      const typesByCode = new Map(allStationTypes?.map(t => [t.code, t]) || [])

      // Batcha inspektioner, mätningar och foto-URL:er i ett fåtal frågor
      // i stället för 3-4 frågor PER station (N+1)
      const stationIds = (data || []).map(s => s.id)

      const [inspectionsRes, measurementsRes] = stationIds.length > 0
        ? await Promise.all([
            supabase
              .from('indoor_station_inspections')
              .select('*')
              .in('station_id', stationIds)
              .order('inspected_at', { ascending: false }),
            supabase
              .from('station_measurements')
              .select('id, value, measured_at, indoor_station_id')
              .in('indoor_station_id', stationIds)
              .order('measured_at', { ascending: false })
          ])
        : [{ data: [] }, { data: [] }]

      // Gruppera per station — listorna är sorterade fallande,
      // så första förekomsten per station är den senaste
      const latestInspectionByStation = new Map<string, IndoorStationInspection>()
      const inspectionCountByStation = new Map<string, number>()
      for (const insp of (inspectionsRes.data || []) as IndoorStationInspection[]) {
        if (!latestInspectionByStation.has(insp.station_id)) {
          latestInspectionByStation.set(insp.station_id, insp)
        }
        inspectionCountByStation.set(insp.station_id, (inspectionCountByStation.get(insp.station_id) || 0) + 1)
      }

      type MeasurementRow = { id: string; value: number | null; measured_at: string; indoor_station_id: string }
      const latestMeasurementByStation = new Map<string, MeasurementRow>()
      for (const m of (measurementsRes.data || []) as MeasurementRow[]) {
        if (!latestMeasurementByStation.has(m.indoor_station_id)) {
          latestMeasurementByStation.set(m.indoor_station_id, m)
        }
      }

      // Signerade foto-URL:er i batch, grupperat per bucket (samma
      // bucket-logik som getStationPhotoUrl)
      const photoUrlByPath = new Map<string, string>()
      const photoPaths = (data || []).map(s => s.photo_path).filter(Boolean) as string[]
      if (photoPaths.length > 0) {
        const byBucket = new Map<string, string[]>()
        for (const p of photoPaths) {
          const bucket = (p.startsWith('indoor/') || p.startsWith('outdoor/'))
            ? 'inspection-photos'
            : INDOOR_STATION_PHOTOS_BUCKET
          byBucket.set(bucket, [...(byBucket.get(bucket) || []), p])
        }
        await Promise.all([...byBucket.entries()].map(async ([bucket, paths]) => {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600)
          signed?.forEach(s => {
            if (s.signedUrl && s.path) photoUrlByPath.set(s.path, s.signedUrl)
          })
        }))
      }

      const stationsWithExtras = (data || []).map(station => {
        // Fallback: Om station_type_data saknas, matcha station_type mot station_types.code
        let stationTypeData = station.station_type_data
        if (!stationTypeData && station.station_type) {
          const matchedType = typesByCode.get(station.station_type)
          if (matchedType) {
            stationTypeData = matchedType
          }
        }

        return {
          ...station,
          station_type_data: stationTypeData,
          latest_inspection: latestInspectionByStation.get(station.id) || null,
          inspection_count: inspectionCountByStation.get(station.id) || 0,
          latest_measurement: latestMeasurementByStation.get(station.id) || null,
          photo_url: station.photo_path ? photoUrlByPath.get(station.photo_path) : undefined
        }
      })

      console.log('Stationer hämtade:', stationsWithExtras.length)
      return stationsWithExtras

    } catch (error) {
      console.error('IndoorStationService.getStationsByFloorPlan fel:', error)
      throw error
    }
  }

  /**
   * Hämta en specifik station
   */
  static async getStationById(id: string): Promise<IndoorStationWithRelations | null> {
    try {
      const { data, error } = await supabase
        .from('indoor_stations')
        .select(`
          *,
          floor_plan:floor_plans!floor_plan_id(*),
          technician:technicians!placed_by_technician_id(id, name),
          station_type_data:station_types!station_type_id(
            id,
            code,
            name,
            color,
            icon,
            prefix,
            measurement_unit,
            measurement_label,
            threshold_warning,
            threshold_critical,
            threshold_direction,
            threshold_source
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        console.error('Fel vid hämtning av station:', error)
        return null
      }

      // Hämta inspektioner
      const { data: inspections, count } = await supabase
        .from('indoor_station_inspections')
        .select('*', { count: 'exact' })
        .eq('station_id', id)
        .order('inspected_at', { ascending: false })

      // Hämta senaste mätning
      const { data: measurements } = await supabase
        .from('station_measurements')
        .select('id, value, measured_at')
        .eq('indoor_station_id', id)
        .order('measured_at', { ascending: false })
        .limit(1)

      return {
        ...data,
        latest_inspection: inspections?.[0] || null,
        inspection_count: count || 0,
        latest_measurement: measurements?.[0] || null,
        photo_url: data.photo_path
          ? await this.getStationPhotoUrl(data.photo_path)
          : undefined
      }

    } catch (error) {
      console.error('IndoorStationService.getStationById fel:', error)
      throw error
    }
  }

  /**
   * Skapa ny station
   */
  static async createStation(
    input: CreateIndoorStationInput,
    technicianId?: string
  ): Promise<IndoorStation> {
    try {
      console.log('Skapar station på planritning:', input.floor_plan_id)

      // Generera stationsnummer om inte angivet
      let stationNumber = input.station_number
      if (!stationNumber) {
        // Hämta befintliga nummer för denna planritning
        const { data: existing } = await supabase
          .from('indoor_stations')
          .select('station_number')
          .eq('floor_plan_id', input.floor_plan_id)

        const existingNumbers = (existing || [])
          .map(s => s.station_number)
          .filter(Boolean) as string[]

        stationNumber = generateStationNumber(input.station_type, existingNumbers)
      }

      // Ladda upp foto om det finns
      let photoPath: string | null = null
      if (input.photo) {
        this.validatePhoto(input.photo)
        photoPath = await this.uploadStationPhoto(input.photo)
      }

      // Sätt station_type_id via kodmatchning så nya rader inte förlitar sig
      // på legacy-fallbacken i läsvägarna. Misslyckad matchning är inte fatal.
      let stationTypeId: string | null = null
      try {
        const { data: typeRow } = await supabase
          .from('station_types')
          .select('id')
          .eq('code', input.station_type)
          .maybeSingle()
        stationTypeId = typeRow?.id ?? null
      } catch {
        stationTypeId = null
      }

      // Skapa databaspost
      const { data, error } = await supabase
        .from('indoor_stations')
        .insert({
          floor_plan_id: input.floor_plan_id,
          station_type: input.station_type,
          station_type_id: stationTypeId,
          station_number: stationNumber,
          position_x_percent: input.position_x_percent,
          position_y_percent: input.position_y_percent,
          location_description: input.location_description || null,
          comment: input.comment || null,
          is_addon: input.is_addon === true,
          // Preparat sparas även på stationen — kontrollflödet förväljer det
          preparation_id: input.preparation_id || null,
          preparation_quantity: input.preparation_quantity ?? null,
          preparation_unit: input.preparation_id ? (input.preparation_unit || 'g') : null,
          photo_path: photoPath,
          placed_by_technician_id: technicianId || null,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        // Rensa upp foto om det laddades upp
        if (photoPath) {
          await supabase.storage.from(INDOOR_STATION_PHOTOS_BUCKET).remove([photoPath])
        }
        console.error('Fel vid skapande av station:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Station skapad:', data.id, data.station_number)
      return data

    } catch (error) {
      console.error('IndoorStationService.createStation fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera station
   */
  static async updateStation(
    id: string,
    input: UpdateIndoorStationInput,
    updatedBy?: string
  ): Promise<IndoorStation> {
    try {
      console.log('Uppdaterar station:', id)

      // Hämta befintlig station för foto-hantering
      const { data: existing } = await supabase
        .from('indoor_stations')
        .select('photo_path, status')
        .eq('id', id)
        .single()

      // Ladda upp nytt foto om det finns
      let photoPath = existing?.photo_path
      if (input.photo) {
        this.validatePhoto(input.photo)

        // Ta bort gammalt foto
        if (existing?.photo_path) {
          await supabase.storage.from(INDOOR_STATION_PHOTOS_BUCKET).remove([existing.photo_path])
        }

        photoPath = await this.uploadStationPhoto(input.photo)
      }

      // Förbered uppdatering
      const updateData: any = {
        ...input,
        photo_path: photoPath,
        updated_at: new Date().toISOString()
      }
      delete updateData.photo // Ta bort File-objektet

      // Om status ändras, spåra det
      if (input.status && input.status !== existing?.status) {
        updateData.status_updated_at = new Date().toISOString()
        updateData.status_updated_by = updatedBy || null
      }

      const { data, error } = await supabase
        .from('indoor_stations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av station:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data

    } catch (error) {
      console.error('IndoorStationService.updateStation fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera stationens position
   */
  static async updateStationPosition(
    id: string,
    x: number,
    y: number
  ): Promise<IndoorStation> {
    try {
      console.log('Uppdaterar stationsposition:', id, x, y)

      const { data, error } = await supabase
        .from('indoor_stations')
        .update({
          position_x_percent: x,
          position_y_percent: y,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av position:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data

    } catch (error) {
      console.error('IndoorStationService.updateStationPosition fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera stationens status
   */
  static async updateStationStatus(
    id: string,
    status: IndoorStationStatus,
    updatedBy?: string
  ): Promise<IndoorStation> {
    try {
      console.log('Uppdaterar stationsstatus:', id, status)

      const { data, error } = await supabase
        .from('indoor_stations')
        .update({
          status,
          status_updated_at: new Date().toISOString(),
          status_updated_by: updatedBy || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av status:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data

    } catch (error) {
      console.error('IndoorStationService.updateStationStatus fel:', error)
      throw error
    }
  }

  /**
   * Ta bort station
   */
  static async deleteStation(id: string): Promise<void> {
    try {
      console.log('Tar bort station:', id)

      // Hämta station för att få photo_path
      const { data: station } = await supabase
        .from('indoor_stations')
        .select('photo_path')
        .eq('id', id)
        .single()

      // Ta bort från databas (inspektioner raderas via CASCADE)
      const { error } = await supabase
        .from('indoor_stations')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Fel vid borttagning av station:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Ta bort foto från storage
      if (station?.photo_path) {
        await supabase.storage.from(INDOOR_STATION_PHOTOS_BUCKET).remove([station.photo_path])
      }

      console.log('Station borttagen:', id)

    } catch (error) {
      console.error('IndoorStationService.deleteStation fel:', error)
      throw error
    }
  }

  // ============================================
  // INSPEKTIONER
  // ============================================

  /**
   * Skapa ny inspektion
   */
  static async createInspection(
    input: CreateInspectionInput,
    technicianId?: string
  ): Promise<IndoorStationInspection> {
    try {
      console.log('Skapar inspektion för station:', input.station_id)

      // Ladda upp foto om det finns
      let photoPath: string | null = null
      if (input.photo) {
        this.validatePhoto(input.photo)
        photoPath = await this.uploadInspectionPhoto(input.station_id, input.photo)
      }

      const { data, error } = await supabase
        .from('indoor_station_inspections')
        .insert({
          station_id: input.station_id,
          status: input.status,
          findings: input.findings || null,
          photo_path: photoPath,
          inspected_by: technicianId || null
        })
        .select()
        .single()

      if (error) {
        if (photoPath) {
          await supabase.storage.from(INDOOR_STATION_PHOTOS_BUCKET).remove([photoPath])
        }
        console.error('Fel vid skapande av inspektion:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Inspektion skapad:', data.id)
      return data

    } catch (error) {
      console.error('IndoorStationService.createInspection fel:', error)
      throw error
    }
  }

  /**
   * Hämta inspektionshistorik för en station
   * Inkluderar station_type_data för korrekt measurement_label
   */
  static async getInspectionsByStation(
    stationId: string,
    limit = 10
  ): Promise<IndoorStationInspectionWithRelations[]> {
    try {
      const { data, error } = await supabase
        .from('indoor_station_inspections')
        .select(`
          *,
          station:indoor_stations(
            id,
            station_number,
            station_type_id,
            station_type
          ),
          technician:technicians!inspected_by(id, name),
          preparation:preparations!preparation_id(id, name, registration_number)
        `)
        .eq('station_id', stationId)
        .order('inspected_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Fel vid hämtning av inspektioner:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      if (!data || data.length === 0) {
        return []
      }

      // Hämta alla station_types för att matcha station_type → code
      const { data: stationTypes } = await supabase
        .from('station_types')
        .select('id, code, name, color, measurement_unit, measurement_label')
        .eq('is_active', true)

      // Skapa map för snabb lookup på code
      const typesByCode = new Map(stationTypes?.map(t => [t.code, t]) || [])

      // Lägg till signerade URLs för foton OCH berika med station_type_data
      const inspectionsWithUrls = await Promise.all(
        data.map(async (inspection) => {
          // Berika station med station_type_data baserat på station_type
          const station = inspection.station as any
          if (station && station.station_type) {
            const matchedType = typesByCode.get(station.station_type)
            if (matchedType) {
              station.station_type_data = matchedType
            }
          }

          return {
            ...inspection,
            photo_url: inspection.photo_path
              ? await this.getStationPhotoUrl(inspection.photo_path)
              : undefined
          }
        })
      )

      return inspectionsWithUrls

    } catch (error) {
      console.error('IndoorStationService.getInspectionsByStation fel:', error)
      throw error
    }
  }

  // ============================================
  // FOTO-HANTERING
  // ============================================

  /**
   * Hämta signerad URL för stationsfoto
   * Avgör bucket baserat på path-prefix:
   * - "indoor/" eller "outdoor/" → inspection-photos bucket (från StationInspectionModule)
   * - Annars → indoor-station-photos bucket (äldre stationsfoton)
   */
  static async getStationPhotoUrl(photoPath: string): Promise<string | undefined> {
    try {
      if (!photoPath) return undefined

      // Avgör bucket baserat på path-prefix
      const isInspectionPhoto = photoPath.startsWith('indoor/') || photoPath.startsWith('outdoor/')
      const bucket = isInspectionPhoto ? 'inspection-photos' : INDOOR_STATION_PHOTOS_BUCKET

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(photoPath, 3600) // 1 timme

      if (error) {
        // Tyst fel - bilden kanske inte finns eller har raderats
        return undefined
      }

      return data.signedUrl
    } catch (error) {
      return undefined
    }
  }

  /**
   * Ladda upp stationsfoto
   */
  private static async uploadStationPhoto(file: File): Promise<string> {
    const compressed = await compressToWebP(file)
    const timestamp = Date.now()
    const path = `stations/${timestamp}.webp`

    const { error } = await supabase.storage
      .from(INDOOR_STATION_PHOTOS_BUCKET)
      .upload(path, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp'
      })

    if (error) {
      throw new Error(`Kunde inte ladda upp foto: ${error.message}`)
    }

    return path
  }

  /**
   * Ladda upp inspektionsfoto
   */
  private static async uploadInspectionPhoto(stationId: string, file: File): Promise<string> {
    const compressed = await compressToWebP(file)
    const timestamp = Date.now()
    const path = `inspections/${stationId}/${timestamp}.webp`

    const { error } = await supabase.storage
      .from(INDOOR_STATION_PHOTOS_BUCKET)
      .upload(path, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp'
      })

    if (error) {
      throw new Error(`Kunde inte ladda upp foto: ${error.message}`)
    }

    return path
  }

  /**
   * Validera fotoformat och storlek
   */
  private static validatePhoto(file: File): void {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      throw new Error(
        `Ogiltigt bildformat. Tillåtna format: ${ALLOWED_PHOTO_TYPES.map(t => t.split('/')[1]).join(', ')}`
      )
    }

    if (file.size > MAX_STATION_PHOTO_SIZE) {
      throw new Error(
        `Bilden är för stor. Maxstorlek: ${MAX_STATION_PHOTO_SIZE / 1024 / 1024}MB`
      )
    }
  }
}
