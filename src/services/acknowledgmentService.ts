// src/services/acknowledgmentService.ts - Service för läskvitton

import { supabase } from '../lib/supabase'
import { CaseAcknowledgment, CreateAcknowledgmentData } from '../types/acknowledgment'

export class AcknowledgmentService {
  /**
   * Hämta bekräftelse för ett specifikt ärende och användare
   */
  static async getAcknowledgment(caseId: string, userId: string): Promise<CaseAcknowledgment | null> {
    const { data, error } = await supabase
      .from('case_acknowledgments')
      .select('*')
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching acknowledgment:', error)
      throw error
    }

    return data
  }

  /**
   * Kontrollera om användare har bekräftat ett ärende
   */
  static async hasAcknowledged(caseId: string, userId: string): Promise<boolean> {
    const acknowledgment = await this.getAcknowledgment(caseId, userId)
    return acknowledgment !== null
  }

  /**
   * Skapa ny bekräftelse
   */
  static async createAcknowledgment(data: CreateAcknowledgmentData): Promise<CaseAcknowledgment> {
    const { data: acknowledgment, error } = await supabase
      .from('case_acknowledgments')
      .insert({
        case_id: data.case_id,
        user_id: data.user_id,
        user_email: data.user_email,
        user_name: data.user_name || null,
        pest_level_at_acknowledgment: data.pest_level_at_acknowledgment ?? null,
        problem_rating_at_acknowledgment: data.problem_rating_at_acknowledgment ?? null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating acknowledgment:', error)
      throw error
    }

    return acknowledgment
  }

  /**
   * Hämta alla bekräftelser för ett ärende (för admin/koordinator)
   */
  static async getCaseAcknowledgments(caseId: string): Promise<CaseAcknowledgment[]> {
    const { data, error } = await supabase
      .from('case_acknowledgments')
      .select('*')
      .eq('case_id', caseId)
      .order('acknowledged_at', { ascending: false })

    if (error) {
      console.error('Error fetching case acknowledgments:', error)
      throw error
    }

    return data || []
  }
}
