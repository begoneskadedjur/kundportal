// src/services/casePipelineService.ts — Service för koordinatorns offerthantering (Oneflow-baserad)
import { supabase } from '../lib/supabase'
import type { CoordinatorCaseAction, PipelineOfferRow, PipelineCaseRow, CoordinatorCaseStatus, ContactMethod } from '../types/casePipeline'

const OFFER_COLUMNS = `
  id, oneflow_contract_id, status, company_name, contact_person,
  contact_email, contact_phone, contact_address, total_value,
  template_id, begone_employee_name, source_id, created_at, updated_at
`

export class CasePipelineService {
  // ─── Oneflow-baserade offertmetoder ───

  /** Hämta alla pipeline-offerter (Oneflow) med coordinator actions */
  static async getPipelineOffers(): Promise<PipelineOfferRow[]> {
    const { data: offers, error } = await supabase
      .from('contracts')
      .select(OFFER_COLUMNS)
      .eq('type', 'offer')
      .in('status', ['pending', 'signed', 'overdue', 'declined'])
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!offers || offers.length === 0) return []

    // Hämta coordinator actions för alla offerter
    const offerIds = offers.map(o => o.id)
    const { data: actions } = await supabase
      .from('coordinator_case_actions')
      .select('*')
      .in('contract_id', offerIds)

    const actionMap = new Map<string, CoordinatorCaseAction>()
    for (const a of actions || []) {
      if (a.contract_id) actionMap.set(a.contract_id, a)
    }

    return offers.map(o => ({
      ...o,
      action: actionMap.get(o.id) || null,
    }))
  }

  /** Kvittera offert — markera som mottagen av koordinator */
  static async acknowledgeOffer(
    contractId: string,
    userId: string,
  ): Promise<CoordinatorCaseAction> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          contract_id: contractId,
          coordinator_status: 'acknowledged' as CoordinatorCaseStatus,
          acknowledged_at: now,
          acknowledged_by: userId,
        },
        { onConflict: 'contract_id' },
      )
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** Logga kontaktförsök för offert */
  static async logOfferContactAttempt(
    contractId: string,
    userId: string,
    method: ContactMethod,
    note?: string,
  ): Promise<CoordinatorCaseAction> {
    // Hämta nuvarande antal
    const { data: existing } = await supabase
      .from('coordinator_case_actions')
      .select('contact_attempts')
      .eq('contract_id', contractId)
      .maybeSingle()

    const currentAttempts = existing?.contact_attempts || 0
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          contract_id: contractId,
          coordinator_status: 'contacted' as CoordinatorCaseStatus,
          contact_attempts: currentAttempts + 1,
          last_contact_attempt_at: now,
          last_contact_method: method,
        },
        { onConflict: 'contract_id' },
      )
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** Uppdatera koordinatornotering för offert */
  static async updateOfferNotes(
    contractId: string,
    notes: string,
  ): Promise<CoordinatorCaseAction> {
    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          contract_id: contractId,
          coordinator_notes: notes,
        },
        { onConflict: 'contract_id' },
      )
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** Byt coordinator_status för offert */
  static async updateOfferStatus(
    contractId: string,
    status: CoordinatorCaseStatus,
  ): Promise<CoordinatorCaseAction> {
    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          contract_id: contractId,
          coordinator_status: status,
        },
        { onConflict: 'contract_id' },
      )
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** Dölja/avfärda offert från pipeline */
  static async dismissOffer(
    contractId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('coordinator_case_actions')
      .upsert(
        {
          contract_id: contractId,
          dismissed_at: new Date().toISOString(),
          dismissed_by: userId,
        },
        { onConflict: 'contract_id' },
      )

    if (error) throw error
  }

  /** Återställ dold offert */
  static async undismissOffer(contractId: string): Promise<void> {
    const { error } = await supabase
      .from('coordinator_case_actions')
      .update({ dismissed_at: null, dismissed_by: null })
      .eq('contract_id', contractId)

    if (error) throw error
  }

  // ─── Legacy ClickUp-metoder (behålls för schema-v2 drawern) ───

  /** Hämta coordinator actions för en lista med ärende-IDn (för Schema V2 drawern) */
  static async getActionsForCases(caseIds: string[]): Promise<Record<string, CoordinatorCaseAction>> {
    if (caseIds.length === 0) return {}

    const { data, error } = await supabase
      .from('coordinator_case_actions')
      .select('*')
      .in('case_id', caseIds)

    if (error) throw error

    const map: Record<string, CoordinatorCaseAction> = {}
    for (const a of data || []) {
      if (a.case_id) map[a.case_id] = a
    }
    return map
  }

  /** Kvittera ärende (legacy ClickUp + contract) */
  static async acknowledgeCase(
    caseId: string,
    caseType: 'private' | 'business' | 'contract',
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
    return data
  }

  /** Logga kontaktförsök (legacy ClickUp + contract, används av ActionableCasesDrawer) */
  static async logContactAttempt(
    caseId: string,
    caseType: 'private' | 'business' | 'contract',
    userId: string,
    userName: string,
    method: ContactMethod,
    note?: string,
  ): Promise<CoordinatorCaseAction> {
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
    return data
  }

  /** Uppdatera koordinatornotering (legacy ClickUp + contract, används av ActionableCasesDrawer) */
  static async updateNotes(
    caseId: string,
    caseType: 'private' | 'business' | 'contract',
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
    return data
  }

  /** Byt coordinator_status (legacy ClickUp + contract) */
  static async updateStatus(
    caseId: string,
    caseType: 'private' | 'business' | 'contract',
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
