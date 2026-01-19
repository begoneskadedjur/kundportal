// src/services/indoorStationService.ts - Service för inomhusstationer
import { supabase } from '../lib/supabase'
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
            threshold_direction
          )
        `)
        .eq('floor_plan_id', floorPlanId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av stationer:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Lägg till signerade URLs, senaste inspektion och mätning
      const stationsWithExtras = await Promise.all(
        (data || []).map(async (station) => {
          // Hämta senaste inspektion
          const { data: inspections } = await supabase
            .from('indoor_station_inspections')
            .select('*')
            .eq('station_id', station.id)
            .order('inspected_at', { ascending: false })
            .limit(1)

          // Räkna antal inspektioner
          const { count } = await supabase
            .from('indoor_station_inspections')
            .select('*', { count: 'exact', head: true })
            .eq('station_id', station.id)

          // Hämta senaste mätning
          const { data: measurements } = await supabase
            .from('station_measurements')
            .select('id, value, measured_at')
            .eq('indoor_station_id', station.id)
            .order('measured_at', { ascending: false })
            .limit(1)

          return {
            ...station,
            latest_inspection: inspections?.[0] || null,
            inspection_count: count || 0,
            latest_measurement: measurements?.[0] || null,
            photo_url: station.photo_path
              ? await this.getStationPhotoUrl(station.photo_path)
              : undefined
          }
        })
      )

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
            threshold_direction
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

      // Skapa databaspost
      const { data, error } = await supabase
        .from('indoor_stations')
        .insert({
          floor_plan_id: input.floor_plan_id,
          station_type: input.station_type,
          station_number: stationNumber,
          position_x_percent: input.position_x_percent,
          position_y_percent: input.position_y_percent,
          location_description: input.location_description || null,
          comment: input.comment || null,
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
          technician:technicians!inspected_by(id, name)
        `)
        .eq('station_id', stationId)
        .order('inspected_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Fel vid hämtning av inspektioner:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Lägg till signerade URLs för foton
      const inspectionsWithUrls = await Promise.all(
        (data || []).map(async (inspection) => ({
          ...inspection,
          photo_url: inspection.photo_path
            ? await this.getStationPhotoUrl(inspection.photo_path)
            : undefined
        }))
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
   */
  static async getStationPhotoUrl(photoPath: string): Promise<string | undefined> {
    try {
      if (!photoPath) return undefined

      const { data, error } = await supabase.storage
        .from(INDOOR_STATION_PHOTOS_BUCKET)
        .createSignedUrl(photoPath, 3600) // 1 timme

      if (error) {
        console.error('Fel vid skapande av signerad URL:', error)
        return undefined
      }

      return data.signedUrl
    } catch (error) {
      console.error('IndoorStationService.getStationPhotoUrl fel:', error)
      return undefined
    }
  }

  /**
   * Ladda upp stationsfoto
   */
  private static async uploadStationPhoto(file: File): Promise<string> {
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `stations/${timestamp}_${sanitizedName}`

    const { error } = await supabase.storage
      .from(INDOOR_STATION_PHOTOS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
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
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `inspections/${stationId}/${timestamp}_${sanitizedName}`

    const { error } = await supabase.storage
      .from(INDOOR_STATION_PHOTOS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
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
