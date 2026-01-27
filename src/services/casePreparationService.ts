// src/services/casePreparationService.ts
// Service för hantering av preparatanvändning i ärenden

import { supabase } from '../lib/supabase'
import {
  CasePreparation,
  CasePreparationWithDetails,
  CreateCasePreparationInput,
  UpdateCasePreparationInput,
  CasePreparationType
} from '../types/casePreparations'
import { Preparation } from '../types/preparations'

/**
 * Service för CRUD-operationer på preparatanvändning i ärenden
 */
export class CasePreparationService {
  /**
   * Hämta alla preparat för ett specifikt ärende
   */
  static async getCasePreparations(
    caseId: string,
    caseType: CasePreparationType
  ): Promise<CasePreparationWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('case_preparations')
        .select(`
          *,
          preparation:preparations(*)
        `)
        .eq('case_id', caseId)
        .eq('case_type', caseType)
        .order('applied_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av preparatanvändning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('CasePreparationService.getCasePreparations fel:', error)
      throw error
    }
  }

  /**
   * Lägg till preparat till ärende
   */
  static async addPreparation(
    input: CreateCasePreparationInput
  ): Promise<CasePreparation> {
    try {
      const { data, error } = await supabase
        .from('case_preparations')
        .insert({
          case_id: input.case_id,
          case_type: input.case_type,
          preparation_id: input.preparation_id,
          quantity: input.quantity,
          unit: input.unit || 'st',
          dosage_notes: input.dosage_notes || null,
          applied_by_technician_id: input.applied_by_technician_id || null,
          applied_by_technician_name: input.applied_by_technician_name || null
        })
        .select()
        .single()

      if (error) {
        console.error('Fel vid tillägg av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Preparat tillagt till ärende:', data.id)
      return data
    } catch (error) {
      console.error('CasePreparationService.addPreparation fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera preparatanvändning
   */
  static async updatePreparation(
    id: string,
    input: UpdateCasePreparationInput
  ): Promise<CasePreparation> {
    try {
      const updateData: Record<string, unknown> = {}

      if (input.quantity !== undefined) updateData.quantity = input.quantity
      if (input.unit !== undefined) updateData.unit = input.unit
      if (input.dosage_notes !== undefined) updateData.dosage_notes = input.dosage_notes

      const { data, error } = await supabase
        .from('case_preparations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Preparatanvändning uppdaterad:', id)
      return data
    } catch (error) {
      console.error('CasePreparationService.updatePreparation fel:', error)
      throw error
    }
  }

  /**
   * Ta bort preparatanvändning
   */
  static async removePreparation(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('case_preparations')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Fel vid borttagning av preparat:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Preparatanvändning borttagen:', id)
    } catch (error) {
      console.error('CasePreparationService.removePreparation fel:', error)
      throw error
    }
  }

  /**
   * Hämta preparat filtrerade på skadedjurstyp
   */
  static async getPreparationsForPestType(pestType: string): Promise<Preparation[]> {
    try {
      const { data, error } = await supabase
        .from('preparations')
        .select('*')
        .contains('pest_types', [pestType])
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av preparat för skadedjur:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('CasePreparationService.getPreparationsForPestType fel:', error)
      throw error
    }
  }

  /**
   * Hämta alla aktiva preparat (när ingen pest_type är vald)
   */
  static async getAllActivePreparations(): Promise<Preparation[]> {
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
      console.error('CasePreparationService.getAllActivePreparations fel:', error)
      throw error
    }
  }
}
