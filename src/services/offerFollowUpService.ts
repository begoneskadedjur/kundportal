// src/services/offerFollowUpService.ts — Service för offertuppföljning med tekniker-koppling
import { supabase, getAuthHeaders } from '../lib/supabase'
import type { CaseBillingItemWithRelations } from '../types/caseBilling'
import type { CoordinatorCaseAction } from '../types/casePipeline'

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

// === Arbetskön: kategorier sorterade efter väntekostnad ===
// Varje dokument ligger i exakt EN kategori (högsta prioritet vinner).
export type QueueCategory =
  | 'ringlista'    // uppföljningsdatum är idag eller passerat
  | 'boka'         // signerat, ej bokat — kunden väntar på oss
  | 'svar'         // oläst kundkommentar — dialogen är levande
  | 'loper_ut'     // signeringsfristen ≤ 3 dagar (eller ålders-fallback)
  | 'aldrig_fram'  // studsad e-post eller aldrig öppnad
  | 'forfallna'    // förfallet, ej hanterat
  | 'bevakas'      // skickat, inväntar kund — ingen åtgärd
  | 'klart'        // bokat/avfärdat/avskrivet

export const QUEUE_SECTIONS: Array<{
  key: QueueCategory
  label: string
  /** Tailwind-textfärg för räknarbadgen när sektionen har innehåll */
  accent: string
  collapsedByDefault: boolean
}> = [
  { key: 'ringlista', label: 'Ringlista idag', accent: 'text-[#20c58f]', collapsedByDefault: false },
  { key: 'boka', label: 'Signerade — boka in', accent: 'text-[#20c58f]', collapsedByDefault: false },
  { key: 'svar', label: 'Kunden har svarat', accent: 'text-blue-400', collapsedByDefault: false },
  { key: 'loper_ut', label: 'Löper ut snart', accent: 'text-amber-400', collapsedByDefault: false },
  { key: 'aldrig_fram', label: 'Nådde aldrig fram', accent: 'text-red-400', collapsedByDefault: false },
  { key: 'forfallna', label: 'Förfallna', accent: 'text-slate-400', collapsedByDefault: false },
  { key: 'bevakas', label: 'Bevakas', accent: 'text-slate-500', collapsedByDefault: true },
  { key: 'klart', label: 'Klara & avfärdade', accent: 'text-slate-500', collapsedByDefault: true },
]

// Öppnad/ej öppnad-spårningen började när first_visit-webhooken driftsattes —
// äldre dokument utan first_viewed betyder "okänt", inte "aldrig öppnad".
const VIEW_TRACKING_START = '2026-08-18'
const DEADLINE_SOON_DAYS = 3
const NEVER_OPENED_DAYS = 5

function classifyQueueCategory(o: {
  status: string
  age_days: number
  days_until_deadline: number | null
  unread_customer_comments: number
  customer_first_viewed_at: string | null
  email_delivery_failed_at: string | null
  booked_case_id: string | null
  created_at: string
  action: CoordinatorCaseAction | null
}): QueueCategory {
  const coordStatus = o.action?.coordinator_status
  const followUpAt = o.action?.follow_up_at || null
  const today = new Date().toISOString().substring(0, 10)

  // 1. Planerad uppföljning styr över allt utom klart
  if (followUpAt && o.status !== 'signed' && o.status !== 'declined') {
    if (followUpAt <= today) return 'ringlista'
    return 'bevakas' // snoozad till framtida datum
  }

  // 2. Signerade: kunden väntar på bokning
  if (o.status === 'signed') {
    const handled = o.booked_case_id || coordStatus === 'booked' || coordStatus === 'completed'
    return handled ? 'klart' : 'boka'
  }

  if (o.status === 'declined') return 'klart'

  // 3. Oläst kundkommentar — dialogen är öppen NU
  if (o.unread_customer_comments > 0) return 'svar'

  if (o.status === 'overdue') {
    return o.action?.dismissed_at || coordStatus === 'completed' ? 'klart' : 'forfallna'
  }

  // 4. Pågående: frist och leverans
  if (o.days_until_deadline !== null && o.days_until_deadline <= DEADLINE_SOON_DAYS) return 'loper_ut'
  if (o.email_delivery_failed_at) return 'aldrig_fram'
  if (
    !o.customer_first_viewed_at &&
    o.created_at >= VIEW_TRACKING_START &&
    o.age_days >= NEVER_OPENED_DAYS
  ) return 'aldrig_fram'
  // Fallback-heuristik tills dokumentet har en synkad deadline
  if (o.days_until_deadline === null && o.age_days >= THRESHOLDS.APPROACHING_DEADLINE_DAYS) return 'loper_ut'

  return 'bevakas'
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
  // Livscykel & signeringsfrist
  status_updated_at: string | null
  signing_deadline: string | null
  /** Dagar kvar till fristen (negativt = passerad). null = ingen synkad deadline */
  days_until_deadline: number | null
  customer_first_viewed_at: string | null
  email_delivery_failed_at: string | null
  // Identitet & spårning
  quote_reference_number: string | null
  template_id: string | null
  created_by_name: string | null
  created_by_email: string | null
  booked_case_id: string | null
  // Dokumentchatt
  unread_customer_comments: number
  latest_customer_comment: { body: string; at: string } | null
  // Arbetskön
  queue_category: QueueCategory
  // Dölj-funktion
  hidden_by: string[]
  // Koppling till ursprungligt ärende
  source_id: string | null
  source_type: string | null
  // Koppling till registrerad kund (satt när signerat avtal länkats via webhook)
  customer_id: string | null
  // Koordinator-åtgärder (status, kvittering, kontaktförsök, etc.)
  action: CoordinatorCaseAction | null
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

// === Statistikvyn ===
export interface StatsContractRow {
  id: string
  type: 'offer' | 'contract'
  status: string
  total_value: number | null
  begone_employee_email: string | null
  begone_employee_name: string | null
  created_by_email: string | null
  created_by_name: string | null
  created_at: string
  status_updated_at: string | null
  organization_number: string | null
  template_id: string | null
  customer_first_viewed_at: string | null
  booked_case_id: string | null
  source_id: string | null
  source_type: string | null
}

export interface StatsAggregates {
  produkter: Array<{ name: string; antal: number; varde: number }>
  tjanster: Array<{ name: string; dokument: number; varde: number; signerade: number }>
  marginaler: Array<{ tech_email: string | null; marginal_pct: number; intakt: number }>
}

export type FollowUpStatusFilter = 'all' | 'pending' | 'overdue' | 'signed' | 'declined'
export type FollowUpSortBy = 'priority' | 'oldest' | 'newest' | 'value_desc' | 'technician'

const OFFER_COLUMNS = `
  id, oneflow_contract_id, type, status, company_name, contact_person,
  contact_email, contact_phone, total_value, begone_employee_name,
  begone_employee_email, created_at, updated_at, hidden_by, source_id, source_type,
  customer_id, status_updated_at, signing_deadline, customer_first_viewed_at,
  email_delivery_failed_at, quote_reference_number, template_id,
  created_by_name, created_by_email, booked_case_id
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
  static async getDashboardData(technicianEmail?: string, userId?: string): Promise<DashboardData> {
    // 1) Hämta relevanta kontrakt. I teknikerläge filtreras SERVER-SIDE så att
    //    bara egna dokument (avsändare ELLER skapare) lämnar databasen —
    //    KPI:erna räknas sedan på samma filtrerade set.
    let contractsQuery = supabase
      .from('contracts')
      .select(OFFER_COLUMNS)
      .in('status', ['pending', 'overdue', 'signed', 'declined'])
      .order('created_at', { ascending: true })

    if (technicianEmail) {
      contractsQuery = contractsQuery.or(
        `begone_employee_email.eq.${technicianEmail},created_by_email.eq.${technicianEmail}`
      )
    }

    const { data: allContracts, error: contractsError } = await contractsQuery

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

    // 3) Dokumentchatten: kundkommentarer + användarens läskvittenser.
    //    Tabellen innehåller bara våra dokument — hämta kundinläggen rakt av.
    const [{ data: customerComments }, { data: myReads }] = await Promise.all([
      supabase
        .from('oneflow_comments')
        .select('id, oneflow_contract_id, body, commented_at')
        .eq('author_type', 'customer')
        .eq('is_private', false)
        .order('commented_at', { ascending: true }),
      userId
        ? supabase.from('oneflow_comment_reads').select('comment_id').eq('user_id', userId)
        : Promise.resolve({ data: [] as { comment_id: string }[] }),
    ])

    const readSet = new Set((myReads || []).map(r => r.comment_id))
    const unreadByContract = new Map<string, number>()
    const latestByContract = new Map<string, { body: string; at: string }>()
    const hasCommentsSet = new Set<string>()
    for (const c of customerComments || []) {
      hasCommentsSet.add(c.oneflow_contract_id)
      latestByContract.set(c.oneflow_contract_id, { body: c.body, at: c.commented_at })
      if (!readSet.has(c.id)) {
        unreadByContract.set(c.oneflow_contract_id, (unreadByContract.get(c.oneflow_contract_id) || 0) + 1)
      }
    }

    // 4) Hämta coordinator_case_actions för alla kontrakt
    const allContractIds = allContracts.map(c => c.id)
    const { data: actions } = allContractIds.length > 0
      ? await supabase
          .from('coordinator_case_actions')
          .select('*')
          .in('contract_id', allContractIds)
      : { data: [] }

    const actionByContractId = new Map<string, CoordinatorCaseAction>()
    for (const a of actions || []) {
      if (a.contract_id) actionByContractId.set(a.contract_id, a)
    }

    // === Beräkna offers ===
    const now = Date.now()
    const allOffers: FollowUpOffer[] = allContracts.map(o => {
      const email = o.begone_employee_email?.toLowerCase() || ''
      const tech = techByEmail.get(email) || null
      const age_days = Math.floor((now - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
      // "Dagar sedan förfallet" räknas på status_updated_at (exakt statusbyte) —
      // updated_at skrivs om av varje content-webhook och är opålitlig
      const overdueSince = o.status_updated_at || o.updated_at
      const days_since_overdue = o.status === 'overdue'
        ? Math.floor((now - new Date(overdueSince).getTime()) / (1000 * 60 * 60 * 24))
        : null
      const days_until_deadline = o.signing_deadline
        ? Math.ceil((new Date(o.signing_deadline + 'T23:59:59').getTime() - now) / (1000 * 60 * 60 * 24))
        : null
      const unread = unreadByContract.get(o.oneflow_contract_id) || 0
      const action = actionByContractId.get(o.id) || null

      const base = {
        ...o,
        technician_id: tech?.id || null,
        technician_name: tech?.name || o.begone_employee_name,
        age_days,
        has_comments: hasCommentsSet.has(o.oneflow_contract_id),
        days_since_overdue,
        days_until_deadline,
        priority: classifyPriority(o.status, age_days, days_since_overdue),
        is_recently_overdue: o.status === 'overdue' && days_since_overdue !== null && days_since_overdue <= THRESHOLDS.RECENTLY_OVERDUE_DAYS,
        hidden_by: o.hidden_by || [],
        source_id: o.source_id || null,
        source_type: o.source_type || null,
        customer_id: o.customer_id || null,
        booked_case_id: o.booked_case_id || null,
        unread_customer_comments: unread,
        latest_customer_comment: latestByContract.get(o.oneflow_contract_id) || null,
        action,
      }

      return {
        ...base,
        queue_category: classifyQueueCategory(base),
      }
    })

    const offers = allOffers

    // === Beräkna KPIs (på samma dataset som listan — i teknikerläge de egna dokumenten) ===
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
    const response = await fetch(`/api/oneflow/comments?contractId=${contractId}`, {
      headers: await getAuthHeaders(),
    })
    if (!response.ok) throw new Error('Kunde inte hämta kommentarer')
    return response.json()
  }

  /** Radera en offert/avtal från Oneflow + markera som deleted i DB */
  static async deleteOffer(contractId: string): Promise<{ source_id: string | null; source_type: string | null; company_name: string | null }> {
    const response = await fetch('/api/oneflow/delete-offer', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ contractId }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Okänt fel' }))
      throw new Error(err.message || 'Kunde inte radera offert')
    }
    return response.json()
  }

  /** Förläng signeringsperioden för en offert/avtal i Oneflow */
  static async extendSigningPeriod(
    contractId: string,
    expireDate: string
  ): Promise<{ newStatus: string; expireDate: string }> {
    const response = await fetch('/api/oneflow/extend-signing-period', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ contractId, expireDate }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Okänt fel' }))
      throw new Error(err.message || 'Kunde inte förlänga signeringsperioden')
    }
    return response.json()
  }

  /** Hämta tjänster + interna artiklar kopplade till en offert/avtal */
  static async getContractItems(contractId: string): Promise<{
    services: CaseBillingItemWithRelations[]
    articles: CaseBillingItemWithRelations[]
  }> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select('*, article:articles(*), service:services(*)')
      .eq('case_id', contractId)
      .eq('case_type', 'contract')
      .order('created_at', { ascending: true })

    if (error) throw error
    const items = (data || []) as CaseBillingItemWithRelations[]
    return {
      services: items.filter(i => i.item_type === 'service'),
      articles: items.filter(i => i.item_type === 'article'),
    }
  }

  /**
   * Lätta kolumner för statistikvyn — ENBART dokument från nya systemet:
   * created_by sätts automatiskt från sessionen, så datan är enhetlig
   * (avsändare, fakturarader, interna kostnader). Äldre wizard-dokument
   * med fritextavsändare och importer räknas inte.
   */
  static async getStatsContracts(technicianEmail?: string): Promise<StatsContractRow[]> {
    let query = supabase
      .from('contracts')
      .select(`
        id, type, status, total_value, begone_employee_email, begone_employee_name,
        created_by_email, created_by_name, created_at, status_updated_at,
        organization_number, template_id, customer_first_viewed_at, booked_case_id,
        source_id, source_type
      `)
      .in('status', ['pending', 'overdue', 'signed', 'declined'])
      .not('created_by_email', 'is', null)
      .order('created_at', { ascending: true })
    if (technicianEmail) {
      query = query.or(
        `begone_employee_email.eq.${technicianEmail},created_by_email.eq.${technicianEmail}`
      )
    }
    const { data, error } = await query
    if (error) throw error
    return (data || []) as StatsContractRow[]
  }

  /**
   * Aggregat (produkter/tjänster/marginaler) via RPC — jsonb:n stannar i
   * databasen. technicianEmails = ALLA e-postvarianter som mappats till den
   * valda teknikern (fritextfältet i wizarden har historiska stavningsvarianter).
   */
  static async getStatsAggregates(
    fromISO: string,
    toISO: string,
    technicianEmails?: string[] | null
  ): Promise<StatsAggregates> {
    const { data, error } = await supabase.rpc('dokumentsignering_statistik', {
      p_from: fromISO,
      p_to: toISO,
      p_tech_emails: technicianEmails && technicianEmails.length > 0
        ? technicianEmails.map(e => e.toLowerCase())
        : null,
    })
    if (error) throw error
    return (data || { produkter: [], tjanster: [], marginaler: [] }) as StatsAggregates
  }

  /** Hämta persisterad Oneflow-dokumentchatt för ett kontrakt (från DB, inte API) */
  static async getOneflowConversation(oneflowContractId: string): Promise<Array<{
    id: string
    oneflow_comment_id: number
    author_name: string | null
    author_type: 'customer' | 'internal'
    is_private: boolean
    body: string
    commented_at: string
  }>> {
    const { data, error } = await supabase
      .from('oneflow_comments')
      .select('id, oneflow_comment_id, author_name, author_type, is_private, body, commented_at')
      .eq('oneflow_contract_id', oneflowContractId)
      .order('commented_at', { ascending: true })
    if (error) throw error
    return (data || []) as any
  }

  /** Markera kundkommentarer som lästa för en användare */
  static async markCommentsRead(commentIds: string[], userId: string): Promise<void> {
    if (commentIds.length === 0) return
    const rows = commentIds.map(id => ({ comment_id: id, user_id: userId }))
    const { error } = await supabase
      .from('oneflow_comment_reads')
      .upsert(rows, { onConflict: 'comment_id,user_id', ignoreDuplicates: true })
    if (error) console.error('markCommentsRead:', error)
  }

  /** Spegla en nyss skickad Oneflow-kommentar lokalt så den syns direkt */
  static async mirrorPostedComment(
    oneflowContractId: string,
    posted: { id?: number; body: string },
    author: { name: string | null }
  ): Promise<void> {
    const commentId = posted.id ?? (posted as any)?.data?.id
    if (!commentId) return
    const { error } = await supabase.from('oneflow_comments').upsert({
      oneflow_contract_id: oneflowContractId,
      oneflow_comment_id: commentId,
      author_name: author.name,
      author_type: 'internal',
      is_private: false,
      body: posted.body,
      commented_at: new Date().toISOString(),
    }, { onConflict: 'oneflow_comment_id', ignoreDuplicates: true })
    if (error) console.error('mirrorPostedComment:', error)
  }

  /**
   * Synka hela dokumentchatten från Oneflow till DB (insert-only, rör inte
   * befintliga rader). Körs när panelen öppnas — ger retroaktiv historik för
   * äldre dokument och täcker att Oneflow inte skickar webhook för alla inlägg.
   */
  static async syncConversationFromOneflow(oneflowContractId: string): Promise<boolean> {
    try {
      const data = await this.getComments(oneflowContractId)
      const comments: Array<{
        id: number
        body?: string
        created_time?: string
        private?: boolean
        parent_id?: number | null
        participants?: { sender?: { participant_name?: string; party_name?: string } }
      }> = data?.data || []
      if (comments.length === 0) return false

      const rows = comments.map(c => {
        const partyName = c.participants?.sender?.party_name || ''
        return {
          oneflow_contract_id: oneflowContractId,
          oneflow_comment_id: c.id,
          parent_comment_id: c.parent_id ?? null,
          author_name: c.participants?.sender?.participant_name || null,
          author_type: partyName.toLowerCase().includes('begone') ? 'internal' : 'customer',
          is_private: c.private ?? false,
          body: c.body || '',
          commented_at: c.created_time || new Date().toISOString(),
        }
      })
      const { error } = await supabase
        .from('oneflow_comments')
        .upsert(rows, { onConflict: 'oneflow_comment_id', ignoreDuplicates: true })
      if (error) {
        console.error('syncConversationFromOneflow:', error)
        return false
      }
      return true
    } catch (err) {
      console.error('syncConversationFromOneflow:', err)
      return false
    }
  }

  /** Logga ett samtal + ev. planera uppföljning ("ring åter") */
  static async logCall(
    contractId: string,
    input: {
      outcome: 'reached' | 'voicemail' | 'no_answer'
      note?: string | null
      followUpAt?: string | null
      byEmail?: string | null
      byName?: string | null
    }
  ): Promise<void> {
    const { error: logError } = await supabase.from('document_call_logs').insert({
      contract_id: contractId,
      outcome: input.outcome,
      note: input.note || null,
      called_by_email: input.byEmail || null,
      called_by_name: input.byName || null,
    })
    if (logError) throw logError

    // Uppdatera koordinatorns åtgärdsrad: kontakträknare + ev. uppföljning
    const { data: existing } = await supabase
      .from('coordinator_case_actions')
      .select('contact_attempts')
      .eq('contract_id', contractId)
      .maybeSingle()

    const { error: actionError } = await supabase
      .from('coordinator_case_actions')
      .upsert({
        contract_id: contractId,
        contact_attempts: (existing?.contact_attempts || 0) + 1,
        last_contact_attempt_at: new Date().toISOString(),
        last_contact_method: 'phone',
        follow_up_at: input.followUpAt || null,
        follow_up_note: input.followUpAt ? (input.note || null) : null,
      }, { onConflict: 'contract_id' })
    if (actionError) throw actionError
  }

  /** Sätt eller rensa planerad uppföljning utan samtalslogg */
  static async setFollowUp(contractId: string, followUpAt: string | null, note?: string | null): Promise<void> {
    const { error } = await supabase
      .from('coordinator_case_actions')
      .upsert({
        contract_id: contractId,
        follow_up_at: followUpAt,
        follow_up_note: followUpAt ? (note || null) : null,
      }, { onConflict: 'contract_id' })
    if (error) throw error
  }

  /** Hämta samtalsloggen för ett kontrakt */
  static async getCallLogs(contractId: string): Promise<Array<{
    id: string; outcome: string; note: string | null; called_by_name: string | null; created_at: string
  }>> {
    const { data, error } = await supabase
      .from('document_call_logs')
      .select('id, outcome, note, called_by_name, created_at')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }

  /** Skicka kommentar (via API-proxy) */
  static async postComment(
    contractId: string,
    body: string,
    options?: { parentId?: number; isPrivate?: boolean; senderEmail?: string }
  ): Promise<any> {
    const response = await fetch(`/api/oneflow/comments?contractId=${contractId}`, {
      method: 'POST',
      // Avsändaren härleds server-side från sessionen (x-sender-email var spoofbar)
      headers: await getAuthHeaders(),
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
