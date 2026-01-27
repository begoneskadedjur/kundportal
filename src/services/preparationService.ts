// src/services/preparationService.ts
// Service för hantering av preparat/bekämpningsmedel

import { supabase } from '../lib/supabase'
import {
  Preparation,
  CreatePreparationInput,
  UpdatePreparationInput
} from '../types/preparations'

/**
 * Service för CRUD-operationer på preparat
 */
export class PreparationService {
  /**
   * Hämta alla aktiva preparat
   * Används i formulär för att välja preparat
   */
  static async getActivePreparations(): Promise<Preparation[]> {
    try {
      const { data, error } = await supabase
        .from('preparations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av aktiva preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('PreparationService.getActivePreparations fel:', error)
      throw error
    }
  }

  /**
   * Hämta alla preparat (inklusive inaktiva)
   * Används i admin-vyn för hantering
   */
  static async getAllPreparations(): Promise<Preparation[]> {
    try {
      const { data, error } = await supabase
        .from('preparations')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av alla preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('PreparationService.getAllPreparations fel:', error)
      throw error
    }
  }

  /**
   * Hämta ett specifikt preparat via ID
   */
  static async getPreparationById(id: string): Promise<Preparation | null> {
    try {
      const { data, error } = await supabase
        .from('preparations')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        console.error('Fel vid hämtning av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('PreparationService.getPreparationById fel:', error)
      throw error
    }
  }

  /**
   * Hämta preparat för ett specifikt skadedjur
   */
  static async getPreparationsByPestType(pestType: string): Promise<Preparation[]> {
    try {
      const { data, error } = await supabase
        .from('preparations')
        .select('*')
        .contains('pest_types', [pestType])
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av preparat för skadedjur:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('PreparationService.getPreparationsByPestType fel:', error)
      throw error
    }
  }

  /**
   * Skapa nytt preparat
   * Endast admins har behörighet (kontrolleras via RLS)
   */
  static async createPreparation(input: CreatePreparationInput): Promise<Preparation> {
    try {
      // Validera input
      if (!input.name) {
        throw new Error('Produktnamn är obligatoriskt')
      }

      const { data, error } = await supabase
        .from('preparations')
        .insert({
          name: input.name,
          category: input.category || 'biocidprodukt',
          registration_number: input.registration_number || null,
          pest_types: input.pest_types || [],
          active_substances: input.active_substances || null,
          dosage: input.dosage || null,
          is_active: input.is_active ?? true,
          show_on_website: input.show_on_website ?? false,
          sort_order: input.sort_order ?? 0
        })
        .select()
        .single()

      if (error) {
        console.error('Fel vid skapande av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Preparat skapat:', data.id)
      return data
    } catch (error) {
      console.error('PreparationService.createPreparation fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera preparat
   * Endast admins har behörighet (kontrolleras via RLS)
   */
  static async updatePreparation(id: string, input: UpdatePreparationInput): Promise<Preparation> {
    try {
      const updateData: Record<string, unknown> = {}

      // Bygg uppdateringsdata endast för fält som skickas med
      if (input.name !== undefined) updateData.name = input.name
      if (input.category !== undefined) updateData.category = input.category
      if (input.registration_number !== undefined) updateData.registration_number = input.registration_number
      if (input.pest_types !== undefined) updateData.pest_types = input.pest_types
      if (input.active_substances !== undefined) updateData.active_substances = input.active_substances
      if (input.dosage !== undefined) updateData.dosage = input.dosage
      if (input.is_active !== undefined) updateData.is_active = input.is_active
      if (input.show_on_website !== undefined) updateData.show_on_website = input.show_on_website
      if (input.sort_order !== undefined) updateData.sort_order = input.sort_order

      const { data, error } = await supabase
        .from('preparations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Preparat uppdaterat:', id)
      return data
    } catch (error) {
      console.error('PreparationService.updatePreparation fel:', error)
      throw error
    }
  }

  /**
   * Aktivera/inaktivera preparat (soft delete)
   */
  static async togglePreparationActive(id: string, isActive: boolean): Promise<Preparation> {
    return this.updatePreparation(id, { is_active: isActive })
  }

  /**
   * Ta bort preparat permanent
   */
  static async deletePreparation(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('preparations')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Fel vid borttagning av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Preparat borttaget:', id)
    } catch (error) {
      console.error('PreparationService.deletePreparation fel:', error)
      throw error
    }
  }

  /**
   * Sök preparat på namn
   */
  static async searchPreparations(query: string): Promise<Preparation[]> {
    try {
      const { data, error } = await supabase
        .from('preparations')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid sökning av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('PreparationService.searchPreparations fel:', error)
      throw error
    }
  }
}
