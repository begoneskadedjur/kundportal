// src/services/measurementService.ts
// Service för hantering av stationsmätningar

import { supabase } from '../lib/supabase'
import {
  StationMeasurement,
  StationMeasurementWithRelations,
  CreateMeasurementInput,
  CalculatedStatus,
  calculateStationStatus,
  StationType
} from '../types/stationTypes'

/**
 * Service för CRUD-operationer på stationsmätningar
 */
export class MeasurementService {
  /**
   * Hämta mätningar för en inomhusstation
   */
  static async getMeasurementsForIndoorStation(
    stationId: string,
    limit?: number
  ): Promise<StationMeasurementWithRelations[]> {
    try {
      let query = supabase
        .from('station_measurements')
        .select(`
          *,
          technician:technicians!measured_by(id, name)
        `)
        .eq('indoor_station_id', stationId)
        .order('measured_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('Fel vid hämtning av mätningar:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('MeasurementService.getMeasurementsForIndoorStation fel:', error)
      throw error
    }
  }

  /**
   * Hämta mätningar för en utomhusstation
   */
  static async getMeasurementsForOutdoorStation(
    stationId: string,
    limit?: number
  ): Promise<StationMeasurementWithRelations[]> {
    try {
      let query = supabase
        .from('station_measurements')
        .select(`
          *,
          technician:technicians!measured_by(id, name)
        `)
        .eq('outdoor_station_id', stationId)
        .order('measured_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('Fel vid hämtning av mätningar:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('MeasurementService.getMeasurementsForOutdoorStation fel:', error)
      throw error
    }
  }

  /**
   * Hämta senaste mätning för en station
   */
  static async getLatestMeasurement(
    stationId: string,
    stationType: 'indoor' | 'outdoor'
  ): Promise<StationMeasurementWithRelations | null> {
    try {
      const column = stationType === 'indoor' ? 'indoor_station_id' : 'outdoor_station_id'

      const { data, error } = await supabase
        .from('station_measurements')
        .select(`
          *,
          technician:technicians!measured_by(id, name)
        `)
        .eq(column, stationId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Ingen mätning hittad
        console.error('Fel vid hämtning av senaste mätning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('MeasurementService.getLatestMeasurement fel:', error)
      throw error
    }
  }

  /**
   * Hämta mätningar inom tidsintervall
   */
  static async getMeasurementsInRange(
    stationId: string,
    stationType: 'indoor' | 'outdoor',
    startDate: Date,
    endDate: Date
  ): Promise<StationMeasurementWithRelations[]> {
    try {
      const column = stationType === 'indoor' ? 'indoor_station_id' : 'outdoor_station_id'

      const { data, error } = await supabase
        .from('station_measurements')
        .select(`
          *,
          technician:technicians!measured_by(id, name)
        `)
        .eq(column, stationId)
        .gte('measured_at', startDate.toISOString())
        .lte('measured_at', endDate.toISOString())
        .order('measured_at', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av mätningar i intervall:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('MeasurementService.getMeasurementsInRange fel:', error)
      throw error
    }
  }

  /**
   * Skapa ny mätning och uppdatera stationens beräknade status
   */
  static async createMeasurement(
    input: CreateMeasurementInput,
    technicianId?: string
  ): Promise<StationMeasurement> {
    try {
      // Validera att exakt en stationsreferens är satt
      if (!input.indoor_station_id && !input.outdoor_station_id) {
        throw new Error('Antingen indoor_station_id eller outdoor_station_id måste anges')
      }
      if (input.indoor_station_id && input.outdoor_station_id) {
        throw new Error('Endast en av indoor_station_id eller outdoor_station_id kan anges')
      }

      const { data, error } = await supabase
        .from('station_measurements')
        .insert({
          indoor_station_id: input.indoor_station_id || null,
          outdoor_station_id: input.outdoor_station_id || null,
          value: input.value,
          measurement_type: input.measurement_type || null,
          note: input.note || null,
          photo_path: input.photo_path || null,
          measured_by: technicianId || null,
          measured_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Fel vid skapande av mätning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Uppdatera stationens beräknade status
      if (input.indoor_station_id) {
        await this.updateStationCalculatedStatus(input.indoor_station_id, 'indoor')
      } else if (input.outdoor_station_id) {
        await this.updateStationCalculatedStatus(input.outdoor_station_id, 'outdoor')
      }

      console.log('Mätning skapad:', data.id)
      return data
    } catch (error) {
      console.error('MeasurementService.createMeasurement fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera stationens beräknade status baserat på senaste mätning
   */
  static async updateStationCalculatedStatus(
    stationId: string,
    stationType: 'indoor' | 'outdoor'
  ): Promise<CalculatedStatus> {
    try {
      // Hämta stationens stationstyp-information
      const stationTable = stationType === 'indoor' ? 'indoor_stations' : 'equipment_placements'

      const { data: station, error: stationError } = await supabase
        .from(stationTable)
        .select(`
          station_type_id,
          station_types:station_type_id(*)
        `)
        .eq('id', stationId)
        .single()

      if (stationError) {
        console.error('Fel vid hämtning av station:', stationError)
        throw new Error(`Databasfel: ${stationError.message}`)
      }

      // Hämta senaste mätning
      const latestMeasurement = await this.getLatestMeasurement(stationId, stationType)

      // Beräkna ny status
      const stationTypeData = station.station_types as StationType | null
      const newStatus = calculateStationStatus(
        stationTypeData,
        latestMeasurement?.value ?? null
      )

      // Uppdatera stationens calculated_status
      const { error: updateError } = await supabase
        .from(stationTable)
        .update({ calculated_status: newStatus })
        .eq('id', stationId)

      if (updateError) {
        console.error('Fel vid uppdatering av beräknad status:', updateError)
        throw new Error(`Databasfel: ${updateError.message}`)
      }

      console.log(`Station ${stationId} status uppdaterad till: ${newStatus}`)
      return newStatus
    } catch (error) {
      console.error('MeasurementService.updateStationCalculatedStatus fel:', error)
      throw error
    }
  }

  /**
   * Hämta aggregerad statistik för mätningar
   */
  static async getMeasurementStats(
    stationId: string,
    stationType: 'indoor' | 'outdoor',
    months: number = 6
  ): Promise<{
    total: number
    average: number
    min: number
    max: number
    trend: 'up' | 'down' | 'stable'
    byMonth: Array<{ month: string; average: number; count: number }>
  }> {
    try {
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - months)

      const measurements = await this.getMeasurementsInRange(
        stationId,
        stationType,
        startDate,
        new Date()
      )

      if (measurements.length === 0) {
        return {
          total: 0,
          average: 0,
          min: 0,
          max: 0,
          trend: 'stable',
          byMonth: []
        }
      }

      const values = measurements.map(m => m.value)
      const total = measurements.length
      const average = values.reduce((a, b) => a + b, 0) / total
      const min = Math.min(...values)
      const max = Math.max(...values)

      // Beräkna trend (jämför första och sista halvan)
      const midpoint = Math.floor(measurements.length / 2)
      const firstHalf = values.slice(0, midpoint)
      const secondHalf = values.slice(midpoint)
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1)
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1)

      let trend: 'up' | 'down' | 'stable' = 'stable'
      const threshold = 0.1 // 10% skillnad för att räknas som trend
      if (secondAvg > firstAvg * (1 + threshold)) trend = 'up'
      else if (secondAvg < firstAvg * (1 - threshold)) trend = 'down'

      // Gruppera per månad
      const byMonthMap: Record<string, { sum: number; count: number }> = {}
      measurements.forEach(m => {
        const date = new Date(m.measured_at)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!byMonthMap[monthKey]) {
          byMonthMap[monthKey] = { sum: 0, count: 0 }
        }
        byMonthMap[monthKey].sum += m.value
        byMonthMap[monthKey].count++
      })

      const byMonth = Object.entries(byMonthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          average: data.sum / data.count,
          count: data.count
        }))

      return { total, average, min, max, trend, byMonth }
    } catch (error) {
      console.error('MeasurementService.getMeasurementStats fel:', error)
      throw error
    }
  }

  /**
   * Ta bort mätning (endast admin)
   */
  static async deleteMeasurement(measurementId: string): Promise<void> {
    try {
      // Hämta mätningen först för att veta vilken station som ska uppdateras
      const { data: measurement, error: fetchError } = await supabase
        .from('station_measurements')
        .select('indoor_station_id, outdoor_station_id')
        .eq('id', measurementId)
        .single()

      if (fetchError) {
        throw new Error(`Kunde inte hitta mätning: ${fetchError.message}`)
      }

      const { error } = await supabase
        .from('station_measurements')
        .delete()
        .eq('id', measurementId)

      if (error) {
        console.error('Fel vid borttagning av mätning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Uppdatera stationens status efter borttagning
      if (measurement.indoor_station_id) {
        await this.updateStationCalculatedStatus(measurement.indoor_station_id, 'indoor')
      } else if (measurement.outdoor_station_id) {
        await this.updateStationCalculatedStatus(measurement.outdoor_station_id, 'outdoor')
      }

      console.log('Mätning borttagen:', measurementId)
    } catch (error) {
      console.error('MeasurementService.deleteMeasurement fel:', error)
      throw error
    }
  }
}
