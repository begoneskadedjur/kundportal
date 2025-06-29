// src/services/caseService.ts

import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

// Definiera lokala typer för enkelhetens skull, hämtade från din globala Database-typ
type Case = Database['public']['Tables']['cases']['Row']
type CaseInsert = Database['public']['Tables']['cases']['Insert']
type CaseUpdate = Database['public']['Tables']['cases']['Update']

class CaseService {

  /**
   * Hämtar alla ärenden från databasen.
   * @returns En promise som resolverar till en array av ärenden.
   */
  async getCases(): Promise<Case[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false }) // Sortera med de nyaste först

      if (error) {
        console.error('Error fetching cases:', error.message)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('An unexpected error occurred in getCases:', error)
      throw error
    }
  }

  /**
   * Hämtar ett specifikt ärende baserat på dess ID.
   * @param id - ID för ärendet som ska hämtas.
   * @returns En promise som resolverar till ett ärende-objekt, eller null om det inte hittades.
   */
  async getCaseById(id: string): Promise<Case | null> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        // Om Supabase inte hittar en rad med .single() är det ett "fel", men vi vill returnera null
        if (error.code === 'PGRST116') {
          return null
        }
        console.error(`Error fetching case with id ${id}:`, error.message)
        throw error
      }

      return data
    } catch (error) {
      console.error('An unexpected error occurred in getCaseById:', error)
      throw error
    }
  }
  
  /**
   * Hämtar alla ärenden som tillhör en specifik kund.
   * @param customerId - ID för kunden vars ärenden ska hämtas.
   * @returns En promise som resolverar till en array av ärenden.
   */
  async getCasesByCustomerId(customerId: string): Promise<Case[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(`Error fetching cases for customer ${customerId}:`, error.message)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('An unexpected error occurred in getCasesByCustomerId:', error)
      throw error
    }
  }


  /**
   * Skapar ett nytt ärende i databasen.
   * @param caseData - Ett objekt med data för det nya ärendet.
   * @returns En promise som resolverar till det nyskapade ärendet.
   */
  async createCase(caseData: CaseInsert): Promise<Case> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .insert([caseData])
        .select()
        .single() // Returnera det nyskapade objektet

      if (error) {
        console.error('Error creating case:', error.message)
        throw error
      }

      return data
    } catch (error) {
      console.error('An unexpected error occurred in createCase:', error)
      throw error
    }
  }

  /**
   * Uppdaterar ett befintligt ärende i databasen.
   * @param id - ID för ärendet som ska uppdateras.
   * @param caseData - Ett objekt med fälten som ska uppdateras.
   * @returns En promise som resolverar till det uppdaterade ärendet.
   */
  async updateCase(id: string, caseData: CaseUpdate): Promise<Case> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .update(caseData)
        .eq('id', id)
        .select()
        .single() // Returnera det uppdaterade objektet

      if (error) {
        console.error(`Error updating case with id ${id}:`, error.message)
        throw error
      }

      return data
    } catch (error) {
      console.error('An unexpected error occurred in updateCase:', error)
      throw error
    }
  }

  /**
   * Tar bort ett ärende från databasen.
   * @param id - ID för ärendet som ska tas bort.
   */
  async deleteCase(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', id)

      if (error) {
        console.error(`Error deleting case with id ${id}:`, error.message)
        throw error
      }
    } catch (error) {
      console.error('An unexpected error occurred in deleteCase:', error)
      throw error
    }
  }
}

// Exportera en singleton-instans av servicen för att användas i hela applikationen
export const caseService = new CaseService()