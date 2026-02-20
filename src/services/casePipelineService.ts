// src/services/casePipelineService.ts — Service för koordinatorns offerthantering
import { supabase } from '../lib/supabase'
import { createComment } from './communicationService'
import type { CoordinatorCaseAction, PipelineCaseRow, CoordinatorCaseStatus, ContactMethod } from '../types/casePipeline'

const PIPELINE_STATUSES = ['Offert skickad', 'Offert signerad - boka in']

const PIPELINE_COLUMNS = `
  id, case_number, title, status, kontaktperson, telefon_kontaktperson,
  e_post_kontaktperson, adress, skadedjur, pris, primary_assignee_name,
  primary_assignee_id, start_date, due_date, created_at, updated_at
`

export class CasePipelineService {
  /** Hämta alla pipeline-ärenden (Offert skickad + Signerad) med coordinator actions */
  static async getPipelineCases(): Promise<PipelineCaseRow[]> {
    const [privateResult, businessResult] = await Promise.all([
      supabase
        .from('private_cases')
        .select(PIPELINE_COLUMNS)
        .in('status', PIPELINE_STATUSES)
        .order('created_at', { ascending: true }),
      supabase
        .from('business_cases')
        .select(PIPELINE_COLUMNS + ', bestallare')
        .in('status', PIPELINE_STATUSES)
        .order('created_at', { ascending: true }),
    ])

    if (privateResult.error) throw privateResult.error
    if (businessResult.error) throw businessResult.error

    const allCaseIds = [
      ...(privateResult.data || []).map(c => c.id),
      ...(businessResult.data || []).map(c => c.id),
    ]

    // Hämta coordinator actions för alla ärenden
    let actionMap = new Map<string, CoordinatorCaseAction>()
    if (allCaseIds.length > 0) {
      const { data: actions, error: actionsError } = await supabase
        .from('coordinator_case_actions')
        .select('*')
        .in('case_id', allCaseIds)

      if (actionsError) throw actionsError
      for (const a of actions || []) {
        actionMap.set(`${a.case_id}_${a.case_type}`, a)
      }
    }

    return [
      ...(privateResult.data || []).map(c => ({
        ...c,
        case_type: 'private' as const,
        bestallare: null,
        action: actionMap.get(`${c.id}_private`) || null,
      })),
      ...(businessResult.data || []).map(c => ({
        ...c,
        case_type: 'business' as const,
        bestallare: (c as any).bestallare || null,
        action: actionMap.get(`${c.id}_business`) || null,
      })),
    ]
  }

  /** Kvittera ärende — markera som mottaget av koordinator */
  static async acknowledgeCase(
    caseId: string,
    caseType: 'private' | 'business',
    userId: string,
    userName: string,
  ): Promise<CoordinatorCaseAction> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          case_id: caseId,
          case_type: caseType,
          coordinator_status: 'acknowledged' as CoordinatorCaseStatus,
          acknowledged_at: now,
          acknowledged_by: userId,
        },
        { onConflict: 'case_id,case_type' },
      )
      .select()
      .single()

    if (error) throw error

    // Synka till case_comments
    try {
      await createComment({
        case_id: caseId,
        case_type: caseType,
        author_id: userId,
        author_name: userName,
        author_role: 'koordinator',
        content: `${userName} har mottagit och bekräftat ärendet.`,
        is_system_comment: true,
        system_event_type: 'coordinator_acknowledged',
      })
    } catch (e) {
      console.warn('Kunde inte skapa systemkommentar för kvittering:', e)
    }

    return data
  }

  /** Logga kontaktförsök */
  static async logContactAttempt(
    caseId: string,
    caseType: 'private' | 'business',
    userId: string,
    userName: string,
    method: ContactMethod,
    note?: string,
  ): Promise<CoordinatorCaseAction> {
    // Hämta nuvarande antal
    const { data: existing } = await supabase
      .from('coordinator_case_actions')
      .select('contact_attempts')
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .maybeSingle()

    const currentAttempts = existing?.contact_attempts || 0
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          case_id: caseId,
          case_type: caseType,
          coordinator_status: 'contacted' as CoordinatorCaseStatus,
          contact_attempts: currentAttempts + 1,
          last_contact_attempt_at: now,
          last_contact_method: method,
        },
        { onConflict: 'case_id,case_type' },
      )
      .select()
      .single()

    if (error) throw error

    // Synka till case_comments
    try {
      const methodLabel = method === 'phone' ? 'telefon' : method === 'email' ? 'e-post' : 'SMS'
      const content = note
        ? `Kontaktförsök #${currentAttempts + 1} via ${methodLabel}: ${note}`
        : `Kontaktförsök #${currentAttempts + 1} via ${methodLabel}.`

      await createComment({
        case_id: caseId,
        case_type: caseType,
        author_id: userId,
        author_name: userName,
        author_role: 'koordinator',
        content,
        is_system_comment: true,
        system_event_type: 'coordinator_contacted',
      })
    } catch (e) {
      console.warn('Kunde inte skapa systemkommentar för kontaktförsök:', e)
    }

    return data
  }

  /** Uppdatera koordinatornotering */
  static async updateNotes(
    caseId: string,
    caseType: 'private' | 'business',
    notes: string,
    userId: string,
    userName: string,
  ): Promise<CoordinatorCaseAction> {
    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          case_id: caseId,
          case_type: caseType,
          coordinator_notes: notes,
        },
        { onConflict: 'case_id,case_type' },
      )
      .select()
      .single()

    if (error) throw error

    // Synka till case_comments (bara om anteckningen har innehåll)
    if (notes.trim()) {
      try {
        await createComment({
          case_id: caseId,
          case_type: caseType,
          author_id: userId,
          author_name: userName,
          author_role: 'koordinator',
          content: `Koordinatornotering: ${notes}`,
          is_system_comment: true,
          system_event_type: 'coordinator_note_added',
        })
      } catch (e) {
        console.warn('Kunde inte skapa systemkommentar för notering:', e)
      }
    }

    return data
  }

  /** Byt coordinator_status */
  static async updateStatus(
    caseId: string,
    caseType: 'private' | 'business',
    status: CoordinatorCaseStatus,
  ): Promise<CoordinatorCaseAction> {
    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          case_id: caseId,
          case_type: caseType,
          coordinator_status: status,
        },
        { onConflict: 'case_id,case_type' },
      )
      .select()
      .single()

    if (error) throw error
    return data
  }
}
