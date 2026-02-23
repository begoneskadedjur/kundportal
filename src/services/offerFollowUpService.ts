// src/services/offerFollowUpService.ts — Service för offertuppföljning med tekniker-koppling
import { supabase } from '../lib/supabase'

// === Prioritetskonstanter ===
export const THRESHOLDS = {
  RECENTLY_OVERDUE_DAYS: 7,
  APPROACHING_DEADLINE_DAYS: 10,
  ARCHIVE_CUTOFF_DAYS: 90,
} as const

export type OfferPriority = 'critical' | 'warning' | 'normal' | 'archived'

function classifyPriority(
  status: string,
  age_days: number,
  days_since_overdue: number | null
): OfferPriority {
  // Arkiverade: alla statusar, 90+ dagar gamla
  if (age_days >= THRESHOLDS.ARCHIVE_CUTOFF_DAYS) return 'archived'
  // Kritiska: alla överförfallna (inte arkiverade)
  if (status === 'overdue') return 'critical'
  // Varning: pågående > 10 dagar
  if (status === 'pending' && age_days >= THRESHOLDS.APPROACHING_DEADLINE_DAYS) return 'warning'
  return 'normal'
}

export interface FollowUpOffer {
  id: string
  oneflow_contract_id: string
  type: 'offer' | 'contract'
  status: string
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  total_value: number | null
  begone_employee_name: string | null
  begone_employee_email: string | null
  created_at: string
  updated_at: string
  // Tekniker-koppling (resolvad via email)
  technician_id: string | null
  technician_name: string | null
  // Beräknade fält
  age_days: number
  has_comments: boolean
  // Prioritetsfält
  priority: OfferPriority
  is_recently_overdue: boolean
  days_since_overdue: number | null
  // Dölj-funktion
  hidden_by: string[]
}

export interface TechnicianOfferStats {
  technician_id: string
  technician_name: string
  technician_email: string
  pending: number
  overdue: number
  signed: number
  declined: number
  total_pipeline_value: number
  sign_rate: number
  at_risk: number
}

export interface FollowUpKPIs {
  total_pending: number
  total_pending_value: number
  total_overdue: number
  total_overdue_value: number
  sign_rate: number
  avg_days_to_sign: number
  recently_overdue: number
  at_risk_pending: number
}

export interface DashboardData {
  offers: FollowUpOffer[]
  kpis: FollowUpKPIs
  techStats: TechnicianOfferStats[]
}

export type FollowUpStatusFilter = 'all' | 'pending' | 'overdue' | 'signed' | 'declined'
export type FollowUpSortBy = 'priority' | 'oldest' | 'newest' | 'value_desc' | 'technician'

const OFFER_COLUMNS = `
  id, oneflow_contract_id, type, status, company_name, contact_person,
  contact_email, contact_phone, total_value, begone_employee_name,
  begone_employee_email, created_at, updated_at, hidden_by
`

const EMPTY_KPIS: FollowUpKPIs = {
  total_pending: 0, total_pending_value: 0,
  total_overdue: 0, total_overdue_value: 0,
  sign_rate: 0, avg_days_to_sign: 0,
  recently_overdue: 0, at_risk_pending: 0,
}

export class OfferFollowUpService {
  /**
   * Hämta all dashboard-data i EN runda (1 contracts-query, 1 tekniker-query, 1 kommentar-query).
   * Beräknar offers, KPIs och techStats lokalt.
   */
  static async getDashboardData(technicianEmail?: string): Promise<DashboardData> {
    // 1) Hämta alla relevanta kontrakt
    const { data: allContracts, error: contractsError } = await supabase
      .from('contracts')
      .select(OFFER_COLUMNS)
      .in('status', ['pending', 'overdue', 'signed', 'declined'])
      .order('created_at', { ascending: true })

    if (contractsError) throw contractsError
    if (!allContracts || allContracts.length === 0) {
      return { offers: [], kpis: EMPTY_KPIS, techStats: [] }
    }

    // 2) Hämta tekniker (en query)
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, email, role')
      .eq('is_active', true)

    const techByEmail = new Map<string, { id: string; name: string; role: string }>()
    for (const t of technicians || []) {
      if (t.email) techByEmail.set(t.email.toLowerCase(), { id: t.id, name: t.name, role: t.role || '' })
    }

    // 3) Kolla vilka kontrakt som har kommentarer
    const contractIds = allContracts.map(o => o.oneflow_contract_id).filter(Boolean)
    const { data: commentEvents } = contractIds.length > 0
      ? await supabase
          .from('oneflow_sync_log')
          .select('oneflow_contract_id')
          .in('oneflow_contract_id', contractIds)
          .like('event_type', '%comment%')
      : { data: [] }

    const hasCommentsSet = new Set((commentEvents || []).map(e => e.oneflow_contract_id))

    // === Beräkna offers ===
    const now = Date.now()
    const allOffers: FollowUpOffer[] = allContracts.map(o => {
      const email = o.begone_employee_email?.toLowerCase() || ''
      const tech = techByEmail.get(email) || null
      const age_days = Math.floor((now - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
      const days_since_overdue = o.status === 'overdue'
        ? Math.floor((now - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        ...o,
        technician_id: tech?.id || null,
        technician_name: tech?.name || o.begone_employee_name,
        age_days,
        has_comments: hasCommentsSet.has(o.oneflow_contract_id),
        days_since_overdue,
        priority: classifyPriority(o.status, age_days, days_since_overdue),
        is_recently_overdue: o.status === 'overdue' && days_since_overdue !== null && days_since_overdue <= THRESHOLDS.RECENTLY_OVERDUE_DAYS,
        hidden_by: o.hidden_by || [],
      }
    })

    // Filtrera per tekniker om det behövs
    const offers = technicianEmail
      ? allOffers.filter(o => o.begone_employee_email?.toLowerCase() === technicianEmail.toLowerCase())
      : allOffers

    // === Beräkna KPIs (alltid på alla kontrakt, inte filtrerade) ===
    const pendingContracts = allContracts.filter(c => c.status === 'pending')
    const overdueContracts = allContracts.filter(c => c.status === 'overdue')
    const signedContracts = allContracts.filter(c => c.status === 'signed')
    const totalCount = allContracts.length

    const signedDays = signedContracts.map(c => {
      const created = new Date(c.created_at).getTime()
      const updated = new Date(c.updated_at).getTime()
      return Math.floor((updated - created) / (1000 * 60 * 60 * 24))
    })
    const avgDays = signedDays.length > 0
      ? Math.round(signedDays.reduce((a, b) => a + b, 0) / signedDays.length)
      : 0

    const kpis: FollowUpKPIs = {
      total_pending: pendingContracts.length,
      total_pending_value: pendingContracts.reduce((sum, c) => sum + (Number(c.total_value) || 0), 0),
      total_overdue: overdueContracts.length,
      total_overdue_value: overdueContracts.reduce((sum, c) => sum + (Number(c.total_value) || 0), 0),
      sign_rate: totalCount > 0 ? Math.round((signedContracts.length / totalCount) * 100) : 0,
      avg_days_to_sign: avgDays,
      recently_overdue: allOffers.filter(o => o.is_recently_overdue).length,
      at_risk_pending: allOffers.filter(o => o.status === 'pending' && o.age_days >= THRESHOLDS.APPROACHING_DEADLINE_DAYS).length,
    }

    // === Beräkna techStats (alla anställda med kontrakt) ===
    const techStats: TechnicianOfferStats[] = (technicians || [])
      .map(t => {
        const email = t.email?.toLowerCase() || ''
        const myContracts = allContracts.filter(c =>
          c.begone_employee_email?.toLowerCase() === email
        )

        const pending = myContracts.filter(c => c.status === 'pending').length
        const overdue = myContracts.filter(c => c.status === 'overdue').length
        const signed = myContracts.filter(c => c.status === 'signed').length
        const declined = myContracts.filter(c => c.status === 'declined').length
        const total = pending + overdue + signed + declined
        const pipelineValue = myContracts
          .filter(c => c.status === 'pending' || c.status === 'overdue')
          .reduce((sum, c) => sum + (Number(c.total_value) || 0), 0)

        // At-risk: pending offerter äldre än 10 dagar
        const at_risk = myContracts.filter(c => {
          if (c.status !== 'pending') return false
          const age = Math.floor((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
          return age >= THRESHOLDS.APPROACHING_DEADLINE_DAYS
        }).length

        return {
          technician_id: t.id,
          technician_name: t.name,
          technician_email: email,
          pending,
          overdue,
          signed,
          declined,
          total_pipeline_value: pipelineValue,
          sign_rate: total > 0 ? Math.round((signed / total) * 100) : 0,
          at_risk,
        }
      })
      .filter(t => t.pending + t.overdue + t.signed + t.declined > 0)
      .sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue))

    return { offers, kpis, techStats }
  }

  /** Dölj en offert för en specifik användare */
  static async hideOffer(contractId: string, userId: string): Promise<void> {
    const { data, error: fetchError } = await supabase
      .from('contracts')
      .select('hidden_by')
      .eq('id', contractId)
      .single()

    if (fetchError) throw fetchError

    const currentHidden: string[] = data?.hidden_by || []
    if (currentHidden.includes(userId)) return

    const { error } = await supabase
      .from('contracts')
      .update({ hidden_by: [...currentHidden, userId] })
      .eq('id', contractId)

    if (error) throw error
  }

  /** Visa en offert igen för en specifik användare */
  static async unhideOffer(contractId: string, userId: string): Promise<void> {
    const { data, error: fetchError } = await supabase
      .from('contracts')
      .select('hidden_by')
      .eq('id', contractId)
      .single()

    if (fetchError) throw fetchError

    const currentHidden: string[] = data?.hidden_by || []
    const { error } = await supabase
      .from('contracts')
      .update({ hidden_by: currentHidden.filter(id => id !== userId) })
      .eq('id', contractId)

    if (error) throw error
  }

  /** Hämta kommentarer för ett kontrakt (via API-proxy) */
  static async getComments(contractId: string): Promise<any> {
    const response = await fetch(`/api/oneflow/comments?contractId=${contractId}`)
    if (!response.ok) throw new Error('Kunde inte hämta kommentarer')
    return response.json()
  }

  /** Skicka kommentar (via API-proxy) */
  static async postComment(
    contractId: string,
    body: string,
    options?: { parentId?: number; isPrivate?: boolean; senderEmail?: string }
  ): Promise<any> {
    const response = await fetch(`/api/oneflow/comments?contractId=${contractId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.senderEmail ? { 'x-sender-email': options.senderEmail } : {}),
      },
      body: JSON.stringify({
        body,
        parentId: options?.parentId || null,
        isPrivate: options?.isPrivate ?? false,
      }),
    })
    if (!response.ok) throw new Error('Kunde inte skicka kommentar')
    return response.json()
  }
}
