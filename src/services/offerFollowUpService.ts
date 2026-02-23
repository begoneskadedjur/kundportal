// src/services/offerFollowUpService.ts — Service för offertuppföljning med tekniker-koppling
import { supabase } from '../lib/supabase'

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
}

export interface FollowUpKPIs {
  total_pending: number
  total_pending_value: number
  total_overdue: number
  total_overdue_value: number
  sign_rate: number
  avg_days_to_sign: number
}

export type FollowUpStatusFilter = 'all' | 'pending' | 'overdue' | 'signed' | 'declined'
export type FollowUpSortBy = 'oldest' | 'newest' | 'value_desc' | 'technician'

const OFFER_COLUMNS = `
  id, oneflow_contract_id, type, status, company_name, contact_person,
  contact_email, contact_phone, total_value, begone_employee_name,
  begone_employee_email, created_at, updated_at
`

export class OfferFollowUpService {
  /** Hämta alla offerter/avtal för uppföljning, med tekniker-koppling */
  static async getFollowUpOffers(technicianEmail?: string): Promise<FollowUpOffer[]> {
    let query = supabase
      .from('contracts')
      .select(OFFER_COLUMNS)
      .in('status', ['pending', 'overdue', 'signed', 'declined'])
      .order('created_at', { ascending: true })

    if (technicianEmail) {
      query = query.ilike('begone_employee_email', technicianEmail)
    }

    const { data: offers, error } = await query
    if (error) throw error
    if (!offers || offers.length === 0) return []

    // Hämta alla tekniker för att mappa email → tekniker
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, email')
      .eq('is_active', true)

    const techByEmail = new Map<string, { id: string; name: string }>()
    for (const t of technicians || []) {
      if (t.email) techByEmail.set(t.email.toLowerCase(), { id: t.id, name: t.name })
    }

    // Kolla vilka kontrakt som har kommentarer (via oneflow_sync_log)
    const contractIds = offers.map(o => o.oneflow_contract_id).filter(Boolean)
    const { data: commentEvents } = await supabase
      .from('oneflow_sync_log')
      .select('contract_id')
      .in('contract_id', contractIds)
      .ilike('event_type', '%comment%')

    const hasCommentsSet = new Set((commentEvents || []).map(e => e.contract_id))

    const now = Date.now()
    return offers.map(o => {
      const email = o.begone_employee_email?.toLowerCase() || ''
      const tech = techByEmail.get(email) || null

      return {
        ...o,
        technician_id: tech?.id || null,
        technician_name: tech?.name || o.begone_employee_name,
        age_days: Math.floor((now - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        has_comments: hasCommentsSet.has(o.oneflow_contract_id),
      }
    })
  }

  /** Hämta statistik per tekniker */
  static async getTechnicianStats(): Promise<TechnicianOfferStats[]> {
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, email')
      .eq('is_active', true)
      .eq('role', 'Skadedjurstekniker')

    if (!technicians || technicians.length === 0) return []

    const { data: contracts } = await supabase
      .from('contracts')
      .select('begone_employee_email, status, total_value')
      .in('status', ['pending', 'overdue', 'signed', 'declined'])

    if (!contracts) return []

    return technicians.map(t => {
      const email = t.email?.toLowerCase() || ''
      const myContracts = contracts.filter(c =>
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
      }
    }).filter(t => t.pending + t.overdue + t.signed + t.declined > 0)
      .sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue))
  }

  /** Beräkna övergripande KPI:er */
  static async getKPIs(): Promise<FollowUpKPIs> {
    const { data: contracts } = await supabase
      .from('contracts')
      .select('status, total_value, created_at, updated_at')
      .in('status', ['pending', 'overdue', 'signed', 'declined'])

    if (!contracts) return { total_pending: 0, total_pending_value: 0, total_overdue: 0, total_overdue_value: 0, sign_rate: 0, avg_days_to_sign: 0 }

    const pending = contracts.filter(c => c.status === 'pending')
    const overdue = contracts.filter(c => c.status === 'overdue')
    const signed = contracts.filter(c => c.status === 'signed')
    const total = contracts.length

    // Snitt dagar till signering (för signerade kontrakt)
    const signedDays = signed.map(c => {
      const created = new Date(c.created_at).getTime()
      const updated = new Date(c.updated_at).getTime()
      return Math.floor((updated - created) / (1000 * 60 * 60 * 24))
    })
    const avgDays = signedDays.length > 0
      ? Math.round(signedDays.reduce((a, b) => a + b, 0) / signedDays.length)
      : 0

    return {
      total_pending: pending.length,
      total_pending_value: pending.reduce((sum, c) => sum + (Number(c.total_value) || 0), 0),
      total_overdue: overdue.length,
      total_overdue_value: overdue.reduce((sum, c) => sum + (Number(c.total_value) || 0), 0),
      sign_rate: total > 0 ? Math.round((signed.length / total) * 100) : 0,
      avg_days_to_sign: avgDays,
    }
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
