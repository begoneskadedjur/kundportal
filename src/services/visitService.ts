// src/services/visitService.ts - Besöket som förstklassig entitet
//
// Ett besök (visits) är den odelbara enheten i ärendeflödet: ett ärende kan ha
// flera besök, och fakturarader, provisionsposter och rapporter hänger på
// BESÖKET, inte bara på ärendet.
//
// All skrivning går via RPC:n create_visit_snapshot, som äger:
//   - numreringen (visit_number, räknas i DB under advisory lock)
//   - idempotensen (ett slutbesök per ärende, ett ombokningsbesök per dygn+källa)
//   - stämplingen av case_billing_items utan visit_id
// Servicen räknar ALDRIG visit_number själv — då uppstår kapplöpning mellan
// två samtidiga avslut/ombokningar.
//
// VIKTIGT: createVisitSnapshot kastar ALDRIG. Ett besökssnapshot får aldrig
// blockera ett ärendeavslut eller en ombokning — men den returnerar null vid
// fel så anroparen kan varna användaren.

import { supabase } from '../lib/supabase'

export type VisitSource = 'completion' | 'revisit'
export type VisitCaseType = 'private' | 'business' | 'contract'

export interface Visit {
  id: string
  case_id: string
  case_type: VisitCaseType
  customer_id: string | null
  visit_number: number
  visit_date: string
  completed_date: string | null
  technician_id: string | null
  technician_name: string | null
  work_performed: string | null
  findings: string | null
  recommendations: string | null
  materials_used: string | null
  time_spent_minutes: number | null
  pest_level: number | null
  problem_rating: number | null
  revenue: number | null
  cost: number | null
  is_final: boolean
  source: string
  status: string | null
  created_at: string
  updated_at: string
}

export interface CreateVisitSnapshotParams {
  caseId: string
  caseType: VisitCaseType
  source: VisitSource
  isFinal: boolean
  technicianId?: string | null
  technicianName?: string | null
  /** Besökets datum. Utelämnad = DB:ns now(). */
  visitDate?: string | null
  workPerformed?: string | null
  findings?: string | null
  recommendations?: string | null
  materialsUsed?: string | null
  timeSpentMinutes?: number | null
  pestLevel?: number | null
  problemRating?: number | null
  customerId?: string | null
}

/** Tom sträng är inte data — spara null så historiken inte fylls med blanksteg. */
const nullIfBlank = (v: string | null | undefined): string | null => {
  const t = typeof v === 'string' ? v.trim() : ''
  return t.length > 0 ? t : null
}

export class VisitService {
  /**
   * Skapar (eller återanvänder, RPC:n är idempotent) besökssnapshotet för ett
   * ärende och stämplar ärendets ostämplade fakturarader med besöket.
   *
   * Returnerar null om något gick fel — anroparen ska varna men fortsätta.
   */
  static async createVisitSnapshot(
    params: CreateVisitSnapshotParams
  ): Promise<Visit | null> {
    try {
      const { data, error } = await supabase.rpc('create_visit_snapshot', {
        p_case_id: params.caseId,
        p_case_type: params.caseType,
        p_source: params.source,
        p_is_final: params.isFinal,
        p_technician_id: params.technicianId ?? null,
        p_technician_name: nullIfBlank(params.technicianName),
        p_visit_date: params.visitDate ?? new Date().toISOString(),
        p_work_performed: nullIfBlank(params.workPerformed),
        p_findings: nullIfBlank(params.findings),
        p_recommendations: nullIfBlank(params.recommendations),
        p_materials_used: nullIfBlank(params.materialsUsed),
        p_time_spent_minutes: params.timeSpentMinutes ?? null,
        p_pest_level: params.pestLevel ?? null,
        p_problem_rating: params.problemRating ?? null,
        p_customer_id: params.customerId ?? null,
      })

      if (error) {
        console.error('[VisitService] create_visit_snapshot misslyckades:', error)
        return null
      }

      // RPC:n returnerar en visits-rad; PostgREST kan leverera den som objekt
      // eller som en array med ett element beroende på anropsform.
      const visit = Array.isArray(data) ? data[0] : data
      return (visit as Visit) ?? null
    } catch (err) {
      console.error('[VisitService] create_visit_snapshot kastade:', err)
      return null
    }
  }

  /** Ärendets besök i kronologisk ordning (besök 1 först). */
  static async getVisitsForCase(caseId: string): Promise<Visit[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .eq('case_id', caseId)
      .order('visit_number', { ascending: true })

    if (error) {
      console.error('[VisitService] getVisitsForCase misslyckades:', error)
      return []
    }
    return (data as unknown as Visit[]) || []
  }
}

export const createVisitSnapshot = VisitService.createVisitSnapshot.bind(VisitService)
export const getVisitsForCase = VisitService.getVisitsForCase.bind(VisitService)
