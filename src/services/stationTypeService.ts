// src/services/stationTypeService.ts
// Service för hantering av dynamiska stationstyper

import { supabase } from '../lib/supabase'
import {
  StationType,
  CreateStationTypeInput,
  UpdateStationTypeInput
} from '../types/stationTypes'

/**
 * Service för CRUD-operationer på stationstyper
 */
export class StationTypeService {
  /**
   * Hämta alla aktiva stationstyper
   * Används av tekniker för att välja stationstyp vid placering
   */
  static async getActiveStationTypes(): Promise<StationType[]> {
    try {
      const { data, error } = await supabase
        .from('station_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av aktiva stationstyper:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('StationTypeService.getActiveStationTypes fel:', error)
      throw error
    }
  }

  /**
   * Hämta alla stationstyper (inklusive inaktiva)
   * Används i admin-vyn för hantering
   */
  static async getAllStationTypes(): Promise<StationType[]> {
    try {
      const { data, error } = await supabase
        .from('station_types')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av alla stationstyper:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('StationTypeService.getAllStationTypes fel:', error)
      throw error
    }
  }

  /**
   * Hämta en specifik stationstyp via ID
   */
  static async getStationTypeById(id: string): Promise<StationType | null> {
    try {
      const { data, error } = await supabase
        .from('station_types')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        console.error('Fel vid hämtning av stationstyp:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('StationTypeService.getStationTypeById fel:', error)
      throw error
    }
  }

  /**
   * Hämta en stationstyp via kod
   */
  static async getStationTypeByCode(code: string): Promise<StationType | null> {
    try {
      const { data, error } = await supabase
        .from('station_types')
        .select('*')
        .eq('code', code)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        console.error('Fel vid hämtning av stationstyp via kod:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('StationTypeService.getStationTypeByCode fel:', error)
      throw error
    }
  }

  /**
   * Skapa ny stationstyp
   * Endast admins har behörighet (kontrolleras via RLS)
   */
  static async createStationType(input: CreateStationTypeInput): Promise<StationType> {
    try {
      // Validera input
      if (!input.code || !input.name || !input.prefix) {
        throw new Error('Kod, namn och prefix är obligatoriska')
      }

      // Kontrollera att koden är unik
      const existing = await this.getStationTypeByCode(input.code)
      if (existing) {
        throw new Error(`En stationstyp med koden "${input.code}" finns redan`)
      }

      const { data, error } = await supabase
        .from('station_types')
        .insert({
          code: input.code.toLowerCase().replace(/\s+/g, '_'),
          name: input.name,
          description: input.description || null,
          prefix: input.prefix.toUpperCase(),
          color: input.color || '#6b7280',
          icon: input.icon || 'box',
          requires_serial_number: input.requires_serial_number || false,
          measurement_unit: input.measurement_unit,
          measurement_label: input.measurement_label || null,
          threshold_warning: input.threshold_warning ?? null,
          threshold_critical: input.threshold_critical ?? null,
          threshold_direction: input.threshold_direction || 'above',
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? 0
        })
        .select()
        .single()

      if (error) {
        console.error('Fel vid skapande av stationstyp:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Stationstyp skapad:', data.id)
      return data
    } catch (error) {
      console.error('StationTypeService.createStationType fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera stationstyp
   * Endast admins har behörighet (kontrolleras via RLS)
   */
  static async updateStationType(id: string, input: UpdateStationTypeInput): Promise<StationType> {
    try {
      const updateData: Record<string, unknown> = {}

      // Bygg uppdateringsdata endast för fält som skickas med
      if (input.name !== undefined) updateData.name = input.name
      if (input.description !== undefined) updateData.description = input.description
      if (input.prefix !== undefined) updateData.prefix = input.prefix.toUpperCase()
      if (input.color !== undefined) updateData.color = input.color
      if (input.icon !== undefined) updateData.icon = input.icon
      if (input.requires_serial_number !== undefined) updateData.requires_serial_number = input.requires_serial_number
      if (input.measurement_unit !== undefined) updateData.measurement_unit = input.measurement_unit
      if (input.measurement_label !== undefined) updateData.measurement_label = input.measurement_label
      if (input.threshold_warning !== undefined) updateData.threshold_warning = input.threshold_warning
      if (input.threshold_critical !== undefined) updateData.threshold_critical = input.threshold_critical
      if (input.threshold_direction !== undefined) updateData.threshold_direction = input.threshold_direction
      if (input.is_active !== undefined) updateData.is_active = input.is_active
      if (input.sort_order !== undefined) updateData.sort_order = input.sort_order

      const { data, error } = await supabase
        .from('station_types')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av stationstyp:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Stationstyp uppdaterad:', id)
      return data
    } catch (error) {
      console.error('StationTypeService.updateStationType fel:', error)
      throw error
    }
  }

  /**
   * Aktivera/inaktivera stationstyp (soft delete)
   */
  static async toggleStationTypeActive(id: string, isActive: boolean): Promise<StationType> {
    return this.updateStationType(id, { is_active: isActive })
  }

  /**
   * Ta bort stationstyp permanent
   * OBS: Kräver att inga stationer använder denna typ
   */
  static async deleteStationType(id: string): Promise<void> {
    try {
      // Kontrollera om några stationer använder denna typ
      const { count: indoorCount } = await supabase
        .from('indoor_stations')
        .select('*', { count: 'exact', head: true })
        .eq('station_type_id', id)

      const { count: outdoorCount } = await supabase
        .from('equipment_placements')
        .select('*', { count: 'exact', head: true })
        .eq('station_type_id', id)

      if ((indoorCount || 0) > 0 || (outdoorCount || 0) > 0) {
        throw new Error(
          `Kan inte ta bort stationstypen. Den används av ${(indoorCount || 0) + (outdoorCount || 0)} stationer. Inaktivera den istället.`
        )
      }

      const { error } = await supabase
        .from('station_types')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Fel vid borttagning av stationstyp:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Stationstyp borttagen:', id)
    } catch (error) {
      console.error('StationTypeService.deleteStationType fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera sorteringsordning för flera stationstyper
   */
  static async updateSortOrder(items: Array<{ id: string; sort_order: number }>): Promise<void> {
    try {
      // Uppdatera varje stationstyp med ny sorteringsordning
      const updates = items.map(item =>
        supabase
          .from('station_types')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
      )

      await Promise.all(updates)
      console.log('Sorteringsordning uppdaterad för', items.length, 'stationstyper')
    } catch (error) {
      console.error('StationTypeService.updateSortOrder fel:', error)
      throw error
    }
  }

  /**
   * Hämta antal stationer per stationstyp
   */
  static async getStationCountsByType(): Promise<Record<string, { indoor: number; outdoor: number }>> {
    try {
      // Hämta alla stationstyper
      const { data: types } = await supabase
        .from('station_types')
        .select('id, code')

      if (!types) return {}

      const counts: Record<string, { indoor: number; outdoor: number }> = {}

      // Hämta antal för varje typ
      await Promise.all(
        types.map(async (type) => {
          const [{ count: indoorCount }, { count: outdoorCount }] = await Promise.all([
            supabase
              .from('indoor_stations')
              .select('*', { count: 'exact', head: true })
              .eq('station_type_id', type.id),
            supabase
              .from('equipment_placements')
              .select('*', { count: 'exact', head: true })
              .eq('station_type_id', type.id)
          ])

          counts[type.code] = {
            indoor: indoorCount || 0,
            outdoor: outdoorCount || 0
          }
        })
      )

      return counts
    } catch (error) {
      console.error('StationTypeService.getStationCountsByType fel:', error)
      throw error
    }
  }
}
