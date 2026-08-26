// src/services/provisionService.ts - Databasoperationer för provisionssystemet
//
// Provisioner 2.0: utbetalningsmånaden ÄGS AV DATABASEN
// (commission_posts.payout_month, satt av compute_payout_month() via
// trg_invoice_paid). Servicen räknar ALDRIG ut månaden själv — behövs en
// preliminär månad för en ännu obetald post importeras den från
// utils/provisionPayout (getPostPayoutMonth).
import { supabase } from '../lib/supabase'
import type {
  CommissionPost,
  CommissionPostInsert,
  CommissionSettings,
  CommissionStatus,
  ProvisionKpi,
  ProvisionTechnicianSummary,
  ProvisionFilters,
  TechnicianShare
} from '../types/provision'

export class ProvisionService {
  // ─── Inställningar ───────────────────────────────────────

  static async getSettings(): Promise<CommissionSettings> {
    const { data, error } = await supabase
      .from('commission_settings')
      .select('setting_key, setting_value')

    if (error) throw error

    const settings: CommissionSettings = {
      engangsjobb_percentage: 6,
      min_commission_base: 4000,
      payout_cutoff_day: 20
    }

    for (const row of data || []) {
      if (row.setting_key === 'engangsjobb_percentage') {
        settings.engangsjobb_percentage = Number(row.setting_value)
      } else if (row.setting_key === 'min_commission_base') {
        settings.min_commission_base = Number(row.setting_value)
      } else if (row.setting_key === 'payout_cutoff_day') {
        settings.payout_cutoff_day = Number(row.setting_value)
      }
    }

    return settings
  }

  static async updateSetting(
    key: string,
    value: number,
    updatedBy: string
  ): Promise<void> {
    const { error } = await supabase
      .from('commission_settings')
      .update({
        setting_value: value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', key)

    if (error) throw error
  }

  // ─── Hämta poster för enskild tekniker ──────────────────

  static async getPostsForTechnician(
    technicianId: string,
    fromDate?: string
  ): Promise<CommissionPost[]> {
    const from = fromDate || `${new Date().getFullYear()}-01-01`

    const { data, error } = await supabase
      .from('commission_posts')
      .select('*')
      .eq('technician_id', technicianId)
      .gte('created_at', from)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as CommissionPost[]
  }

  // ─── Beräkning ───────────────────────────────────────────

  static calculateCommission(
    baseAmount: number,
    percentage: number,
    sharePercentage: number,
    deductions: number = 0
  ): number {
    const netBase = baseAmount - deductions
    if (netBase <= 0) return 0
    return Math.round(netBase * (percentage / 100) * (sharePercentage / 100) * 100) / 100
  }

  // ─── Validering av provisionsunderlag (inga sidoeffekter) ─
  //
  // Körs i upsertPostsForCase INNAN befintliga poster raderas - körs den
  // efteråt blir en valideringsmiss (t.ex. pris sänkt under tröskeln)
  // permanent förlust av intjänad provision.

  private static async validatePostInput(
    caseData: {
      base_amount: number
      is_rot_rut?: boolean
      rot_rut_original_amount?: number
    },
    technicianShares: TechnicianShare[]
  ): Promise<void> {
    const settings = await this.getSettings()

    const effectiveBase = caseData.is_rot_rut && caseData.rot_rut_original_amount
      ? caseData.rot_rut_original_amount
      : caseData.base_amount

    if (effectiveBase < settings.min_commission_base) {
      throw new Error(`Beloppet ${effectiveBase} kr understiger minsta provisionsgrundande belopp (${settings.min_commission_base} kr exkl moms)`)
    }

    const totalShare = technicianShares.reduce((sum, t) => sum + t.share_percentage, 0)
    if (Math.abs(totalShare - 100) > 0.01) {
      throw new Error(`Teknikerandelar summerar till ${totalShare}%, måste vara 100%`)
    }
  }

  // ─── Skapa poster vid ärendeavslut ───────────────────────

  static async createPostsForCase(
    caseData: {
      case_id: string
      case_type: 'private' | 'business' | 'contract'
      case_title?: string
      case_number?: string
      base_amount: number
      is_rot_rut?: boolean
      rot_rut_original_amount?: number
    },
    technicianShares: TechnicianShare[],
    deductions: number = 0,
    notes?: string
  ): Promise<CommissionPost[]> {
    // Validering (tröskel + andelar) delas med upsertPostsForCase
    await this.validatePostInput(caseData, technicianShares)

    const settings = await this.getSettings()

    const effectiveBase = caseData.is_rot_rut && caseData.rot_rut_original_amount
      ? caseData.rot_rut_original_amount
      : caseData.base_amount

    // Kontrollera att poster inte redan finns (använd upsertPostsForCase för re-create-flödet)
    const existing = await this.getPostsByCase(caseData.case_id)
    if (existing.length > 0) {
      throw new Error('Provisionsposter finns redan för detta ärende')
    }

    const percentage = settings.engangsjobb_percentage
    const posts: CommissionPostInsert[] = technicianShares.map(tech => ({
      case_id: caseData.case_id,
      case_type: caseData.case_type,
      case_title: caseData.case_title,
      case_number: caseData.case_number,
      technician_id: tech.technician_id,
      technician_name: tech.technician_name,
      technician_email: tech.technician_email,
      commission_type: 'engangsjobb' as const,
      commission_percentage: percentage,
      share_percentage: tech.share_percentage,
      base_amount: effectiveBase,
      deductions,
      commission_amount: this.calculateCommission(
        effectiveBase,
        percentage,
        tech.share_percentage,
        deductions
      ),
      notes,
      is_rot_rut: caseData.is_rot_rut || false,
      rot_rut_original_amount: caseData.rot_rut_original_amount
    }))

    const { data, error } = await supabase
      .from('commission_posts')
      .insert(posts)
      .select()

    if (error) throw error
    return data as CommissionPost[]
  }

  // ─── Upsert: ersätt befintliga poster om de fortfarande är "pending_invoice" ─
  //
  // Används när ett avslutat ärende sparas igen med ändrat pris. Om provisionsposter
  // redan finns för ärendet:
  //   - Alla i status 'pending_invoice' (default) → radera och skapa nya med nytt belopp.
  //   - Någon har "låst" status (ready_for_payout/approved/paid_out) → kasta fel,
  //     eftersom provisionen är på väg till eller redan utbetald.

  static async upsertPostsForCase(
    caseData: Parameters<typeof ProvisionService.createPostsForCase>[0],
    technicianShares: TechnicianShare[],
    deductions: number = 0,
    notes?: string
  ): Promise<CommissionPost[]> {
    // Validera FÖRE raderingen - kastar valideringen efter delete är
    // intjänad provision borta (t.ex. pris sänkt under tröskeln).
    await this.validatePostInput(caseData, technicianShares)

    const existing = await this.getPostsByCase(caseData.case_id)

    if (existing.length > 0) {
      const locked = existing.filter(p => p.status !== 'pending_invoice')
      if (locked.length > 0) {
        throw new Error(
          `Provisionen för ärendet är redan på väg till utbetalning (status: ${locked[0].status}) och kan inte räknas om.`
        )
      }
      const { error: deleteError } = await supabase
        .from('commission_posts')
        .delete()
        .in('id', existing.map(p => p.id))
      if (deleteError) throw deleteError
    }

    return this.createPostsForCase(caseData, technicianShares, deductions, notes)
  }

  // ─── Hämta poster ────────────────────────────────────────

  /**
   * Poster som tillhör en UTBETALNINGSMÅNAD ('YYYY-MM'), enligt DB-kolumnen
   * payout_month.
   *
   * Poster utan payout_month (pending_invoice / obetald kundfaktura) har ingen
   * bestämd månad ännu. Med `includePending` (default) hämtas de i en separat
   * fråga och läggs sist i resultatet — UI:t placerar dem preliminärt via
   * provisionPayout.getPostPayoutMonth / groupPostsByPayoutMonth. De filtreras
   * alltså INTE bort här, annars försvinner obetald provision ur vyn.
   */
  static async getPostsForPayoutMonth(
    monthKey: string,
    filters?: ProvisionFilters,
    options?: { includePending?: boolean }
  ): Promise<CommissionPost[]> {
    const includePending = options?.includePending !== false

    const applyFilters = <T extends { eq: (col: string, val: string) => T }>(q: T): T => {
      let out = q
      if (filters?.technician_id && filters.technician_id !== 'all') {
        out = out.eq('technician_id', filters.technician_id)
      }
      if (filters?.status && filters.status !== 'all') {
        out = out.eq('status', filters.status)
      }
      return out
    }

    const monthQuery = applyFilters(
      supabase
        .from('commission_posts')
        .select('*')
        .eq('payout_month', monthKey)
        .order('created_at', { ascending: false })
    )

    const pendingQuery = includePending
      ? applyFilters(
          supabase
            .from('commission_posts')
            .select('*')
            .is('payout_month', null)
            .order('created_at', { ascending: false })
        )
      : null

    const [monthRes, pendingRes] = await Promise.all([
      monthQuery,
      pendingQuery ?? Promise.resolve({ data: [], error: null })
    ])

    if (monthRes.error) throw monthRes.error
    if (pendingRes.error) throw pendingRes.error

    return [
      ...((monthRes.data || []) as CommissionPost[]),
      ...((pendingRes.data || []) as CommissionPost[])
    ]
  }

  /**
   * Alla poster som kan höra hemma i ett år: allt med payout_month inom året
   * PLUS poster utan payout_month (preliminära) PLUS poster skapade under året.
   * Underlag för KPI:er ("intjänat i år" / "utbetalt i år") och sparklines —
   * anroparen filtrerar/grupperar själv via utils/provisionPayout.
   */
  static async getAllPostsForYear(year: number): Promise<CommissionPost[]> {
    const [byPayoutMonth, byCreated] = await Promise.all([
      supabase
        .from('commission_posts')
        .select('*')
        .or(`payout_month.gte.${year}-01,payout_month.is.null`)
        .lte('payout_month', `${year}-12`)
        .order('created_at', { ascending: false }),
      supabase
        .from('commission_posts')
        .select('*')
        .gte('created_at', `${year}-01-01`)
        .lt('created_at', `${year + 1}-01-01`)
        .order('created_at', { ascending: false })
    ])

    if (byPayoutMonth.error) throw byPayoutMonth.error
    if (byCreated.error) throw byCreated.error

    return this.dedupePosts([
      ...((byPayoutMonth.data || []) as CommissionPost[]),
      ...((byCreated.data || []) as CommissionPost[])
    ])
  }

  /**
   * Rullande fönster: innevarande månad + de föregående `months` månaderna.
   * Räcker för 6/12-månaders sparklines utan att hämta hela ledgern.
   */
  static async getPostsForRecentMonths(months: number = 12, now: Date = new Date()): Promise<CommissionPost[]> {
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1)
    const startMonthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    const startDate = `${startMonthKey}-01`

    const [byPayoutMonth, byCreated] = await Promise.all([
      supabase
        .from('commission_posts')
        .select('*')
        .or(`payout_month.gte.${startMonthKey},payout_month.is.null`)
        .order('created_at', { ascending: false }),
      supabase
        .from('commission_posts')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
    ])

    if (byPayoutMonth.error) throw byPayoutMonth.error
    if (byCreated.error) throw byCreated.error

    return this.dedupePosts([
      ...((byPayoutMonth.data || []) as CommissionPost[]),
      ...((byCreated.data || []) as CommissionPost[])
    ])
  }

  private static dedupePosts(posts: CommissionPost[]): CommissionPost[] {
    const byId = new Map<string, CommissionPost>()
    for (const p of posts) if (!byId.has(p.id)) byId.set(p.id, p)
    return Array.from(byId.values())
  }

  static async getPostsByCase(caseId: string): Promise<CommissionPost[]> {
    const { data, error } = await supabase
      .from('commission_posts')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as CommissionPost[]
  }

  // ─── Aggregerad data ─────────────────────────────────────

  /** Summering per tekniker för en UTBETALNINGSMÅNAD (inkl. preliminära poster). */
  static async getTechnicianSummaries(
    month: string,
    filters?: ProvisionFilters
  ): Promise<ProvisionTechnicianSummary[]> {
    const posts = await this.getPostsForPayoutMonth(month, filters)

    const map = new Map<string, ProvisionTechnicianSummary>()

    for (const post of posts) {
      const existing = map.get(post.technician_id)
      if (existing) {
        existing.total_commission += post.commission_amount
        existing.post_count += 1
        existing.posts.push(post)
      } else {
        map.set(post.technician_id, {
          technician_id: post.technician_id,
          technician_name: post.technician_name,
          technician_email: post.technician_email,
          total_commission: post.commission_amount,
          post_count: 1,
          posts: [post]
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total_commission - a.total_commission)
  }

  /** KPI:er för en UTBETALNINGSMÅNAD (inkl. preliminära poster). */
  static async getKpis(month: string): Promise<ProvisionKpi> {
    const posts = await this.getPostsForPayoutMonth(month)

    const kpi: ProvisionKpi = {
      pending_invoice_total: 0,
      pending_invoice_count: 0,
      ready_for_payout_total: 0,
      ready_for_payout_count: 0,
      approved_total: 0,
      approved_count: 0,
      paid_out_total: 0,
      paid_out_count: 0
    }

    for (const post of posts) {
      switch (post.status) {
        case 'pending_invoice':
          kpi.pending_invoice_total += post.commission_amount
          kpi.pending_invoice_count++
          break
        case 'ready_for_payout':
          kpi.ready_for_payout_total += post.commission_amount
          kpi.ready_for_payout_count++
          break
        case 'approved':
          kpi.approved_total += post.commission_amount
          kpi.approved_count++
          break
        case 'paid_out':
          kpi.paid_out_total += post.commission_amount
          kpi.paid_out_count++
          break
      }
    }

    return kpi
  }

  // ─── Statusändringar ─────────────────────────────────────

  /**
   * Statusbyte i det normala batch-flödet (ready_for_payout → approved → paid_out).
   *
   * Sätter ALDRIG payout_month eller invoice_paid_date — de ägs av DB-triggern
   * trg_invoice_paid / compute_payout_month. Vill du undantagsvis flytta en post
   * till ready_for_payout utan betald kundfaktura, använd
   * markReadyForPayoutManually.
   */
  static async updateStatus(
    ids: string[],
    newStatus: CommissionStatus,
    approvedBy?: string,
    paidOutBy?: { userId: string | null; name: string | null }
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    if (newStatus === 'approved') {
      updateData.approved_by = approvedBy || null
      updateData.approved_at = new Date().toISOString()
    }

    if (newStatus === 'paid_out') {
      updateData.paid_out_at = new Date().toISOString()
      updateData.paid_out_by = paidOutBy?.userId ?? null
      updateData.paid_out_by_name = paidOutBy?.name ?? null
    }

    const { error } = await supabase
      .from('commission_posts')
      .update(updateData)
      .in('id', ids)

    if (error) throw error
  }

  /**
   * Markerar poster som utbetalda och sparar VEM som gjorde det (spårbarhet
   * mot löneunderlaget).
   */
  static async markAsPaidOut(
    ids: string[],
    paidOutBy: { userId: string | null; name: string | null }
  ): Promise<void> {
    return this.updateStatus(ids, 'paid_out', undefined, paidOutBy)
  }

  /**
   * ⚠️ UNDANTAGSVÄG — KRINGGÅR REGELN "provision betalas först när kundfakturan
   * är betald".
   *
   * Normalvägen är DB-triggern trg_invoice_paid: när kundfakturan får status
   * 'paid' flyttas posten till ready_for_payout och payout_month sätts av
   * compute_payout_month(). Den här metoden flyttar posten manuellt, t.ex. vid
   * en betalning som aldrig registrerades i Fortnox.
   *
   * Därför:
   *  - invoice_paid_date sätts INTE (lämnas null) — vi fejkar aldrig ett
   *    betaldatum som inte finns.
   *  - payout_month sätts INTE — posten saknar månad och UI:t placerar den
   *    preliminärt tills en riktig betalning kommer in.
   *  - notes får en spårbar rad om att statusen satts manuellt.
   *
   * Använd bara efter medvetet beslut, inte som del av batch-flödet.
   */
  static async markReadyForPayoutManually(
    postIds: string[],
    opts: { reason?: string; byName?: string } = {}
  ): Promise<void> {
    if (postIds.length === 0) return

    const { data: existing, error: readError } = await supabase
      .from('commission_posts')
      .select('id, notes')
      .in('id', postIds)

    if (readError) throw readError

    const stamp = new Date().toISOString().split('T')[0]
    const who = opts.byName ? ` av ${opts.byName}` : ''
    const why = opts.reason ? ` Orsak: ${opts.reason}` : ''
    const note = `[${stamp}] Manuellt satt till redo för utbetalning${who} utan registrerad fakturabetalning.${why}`

    for (const row of (existing || []) as Array<{ id: string; notes: string | null }>) {
      const { error } = await supabase
        .from('commission_posts')
        .update({
          status: 'ready_for_payout',
          notes: row.notes ? `${row.notes}\n${note}` : note,
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)

      if (error) throw error
    }
  }

  // ─── Radera ──────────────────────────────────────────────

  static async deletePost(id: string): Promise<void> {
    const { error } = await supabase
      .from('commission_posts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // ─── Hämta unika tekniker ────────────────────────────────

  static async getAvailableTechnicians(): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await supabase
      .from('commission_posts')
      .select('technician_id, technician_name')

    if (error) throw error

    const map = new Map<string, string>()
    for (const row of data || []) {
      if (!map.has(row.technician_id)) {
        map.set(row.technician_id, row.technician_name)
      }
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }
}
