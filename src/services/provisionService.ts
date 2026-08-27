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
    technicianShares: TechnicianShare[],
    options: { skipThreshold?: boolean } = {}
  ): Promise<void> {
    // Tröskeln prövas på ÄRENDETS totalbas, inte per besök — fyra besök à
    // 3 000 kr är ett ärende på 12 000 kr och ska ge provision. I
    // upsertPostsForVisits prövas tröskeln en gång på totalbasen och sedan
    // hoppas den över per besök (skipThreshold).
    if (!options.skipThreshold) {
      await this.assertAboveThreshold(this.effectiveBaseOf(caseData))
    }

    const totalShare = technicianShares.reduce((sum, t) => sum + t.share_percentage, 0)
    if (Math.abs(totalShare - 100) > 0.01) {
      throw new Error(`Teknikerandelar summerar till ${totalShare}%, måste vara 100%`)
    }
  }

  /** ROT/RUT: provision räknas på beloppet före avdrag. */
  private static effectiveBaseOf(caseData: {
    base_amount: number
    is_rot_rut?: boolean
    rot_rut_original_amount?: number
  }): number {
    return caseData.is_rot_rut && caseData.rot_rut_original_amount
      ? caseData.rot_rut_original_amount
      : caseData.base_amount
  }

  private static async assertAboveThreshold(effectiveBase: number): Promise<void> {
    const settings = await this.getSettings()
    if (effectiveBase < settings.min_commission_base) {
      throw new Error(`Beloppet ${effectiveBase} kr understiger minsta provisionsgrundande belopp (${settings.min_commission_base} kr exkl moms)`)
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
    notes?: string,
    /** Besökskoppling: posterna hör till ett specifikt besök i ärendet. */
    visit?: { visit_id: string; visit_number: number } | null,
    /** Sätts av upsertPostsForVisits — tröskeln har redan prövats på ärendets totalbas. */
    options: { skipThreshold?: boolean } = {}
  ): Promise<CommissionPost[]> {
    // Validering (tröskel + andelar) delas med upsertPostsForCase
    await this.validatePostInput(caseData, technicianShares, options)

    const settings = await this.getSettings()

    const effectiveBase = this.effectiveBaseOf(caseData)

    // Kontrollera att poster inte redan finns (använd upsertPostsForCase för re-create-flödet).
    // Vakten är per (ärende, besök) — annars skulle besök 1 blockera besök 2.
    const existing = await this.getPostsByCase(caseData.case_id)
    const clash = visit
      ? existing.filter(p => (p as { visit_id?: string | null }).visit_id === visit.visit_id)
      : existing
    if (clash.length > 0) {
      throw new Error(
        visit
          ? `Provisionsposter finns redan för besök ${visit.visit_number} i detta ärende`
          : 'Provisionsposter finns redan för detta ärende'
      )
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
      rot_rut_original_amount: caseData.rot_rut_original_amount,
      visit_id: visit?.visit_id ?? null,
      visit_number: visit?.visit_number ?? null
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

  // ─── Upsert per besök: en post per besök och tekniker ────
  //
  // Ett ärende med flera besök ska ge provision PER BESÖK, inte en klump på
  // ärendet. Mekaniken är medvetet enkel (ingen justeringspost, inga negativa
  // belopp) — poster som redan lämnat 'pending_invoice' rörs aldrig, då kastas
  // samma fel som upsertPostsForCase gör.
  //
  //   1. Tröskeln (min_commission_base) prövas på ÄRENDETS totalbas. Fyra besök
  //      à 3 000 kr är ett ärende på 12 000 kr och ska ge provision.
  //   2. Basen fördelas proportionellt mot varje besöks nettointäkt
  //      (visits.revenue, annars summan av besökets tjänsterader).
  //   3. Residualen (avrundningsrester) läggs på SISTA besöket så summan av
  //      besökens baser blir exakt lika med ärendets bas.
  //   4. Saknas besök helt (t.ex. rondering) faller vi tillbaka på dagens
  //      beteende: en post per tekniker på ärendet, visit_id null.

  static async upsertPostsForVisits(
    caseData: Parameters<typeof ProvisionService.createPostsForCase>[0],
    technicianShares: TechnicianShare[],
    visits: Array<{ id: string; visit_number: number; revenue?: number | null }>,
    opts: { deductions?: number; notes?: string } = {}
  ): Promise<CommissionPost[]> {
    const deductions = opts.deductions ?? 0
    const notes = opts.notes

    // Inga besök → dagens beteende (en post per ärende)
    if (visits.length === 0) {
      return this.upsertPostsForCase(caseData, technicianShares, deductions, notes)
    }

    // Validera FÖRE raderingen — kastar valideringen efter delete är intjänad
    // provision borta. Tröskeln prövas här, på ärendets totalbas.
    await this.validatePostInput(caseData, technicianShares)

    const existing = await this.getPostsByCase(caseData.case_id)
    const locked = existing.filter(p => p.status !== 'pending_invoice')
    if (locked.length > 0) {
      throw new Error(
        `Provisionen för ärendet är redan på väg till utbetalning (status: ${locked[0].status}) och kan inte räknas om.`
      )
    }

    const weights = await this.getVisitRevenueWeights(caseData.case_id, visits)
    const totalBase = this.effectiveBaseOf(caseData)
    const shares = this.splitBaseAcrossVisits(totalBase, weights)

    // Radera ärendets pending-poster och återskapa från besöken
    if (existing.length > 0) {
      const { error: deleteError } = await supabase
        .from('commission_posts')
        .delete()
        .in('id', existing.map(p => p.id))
      if (deleteError) throw deleteError
    }

    const created: CommissionPost[] = []
    for (let i = 0; i < visits.length; i++) {
      const visit = visits[i]
      const visitBase = shares[i]
      // Besök utan intäkt ger ingen post — en 0-kr-post är brus i löneunderlaget
      if (visitBase <= 0) continue

      const posts = await this.createPostsForCase(
        {
          ...caseData,
          base_amount: visitBase,
          // ROT/RUT-basen är redan fördelad — skicka det fördelade beloppet som
          // originalbelopp så effectiveBaseOf inte återgår till ärendets totalbas
          rot_rut_original_amount: caseData.is_rot_rut ? visitBase : undefined
        },
        technicianShares,
        // Underleverantörsavdraget hör till ärendet, inte till ett enskilt
        // besök — det dras på det första besöket som har utrymme för det
        i === 0 ? deductions : 0,
        notes,
        { visit_id: visit.id, visit_number: visit.visit_number },
        { skipThreshold: true }
      )
      created.push(...posts)
    }

    return created
  }

  /**
   * Nettointäkt per besök: visits.revenue när den är satt, annars summan av
   * besökets tjänsterader i case_billing_items. Saknas underlag helt får alla
   * besök samma vikt — hellre jämn fördelning än att provisionen försvinner.
   */
  private static async getVisitRevenueWeights(
    caseId: string,
    visits: Array<{ id: string; visit_number: number; revenue?: number | null }>
  ): Promise<number[]> {
    const needsLookup = visits.some(v => v.revenue == null)

    let byVisitId = new Map<string, number>()
    if (needsLookup) {
      const { data, error } = await supabase
        .from('case_billing_items')
        .select('visit_id, total_price, item_type, status')
        .eq('case_id', caseId)
        .eq('item_type', 'service')
        .neq('status', 'cancelled')

      if (error) {
        console.warn('[ProvisionService] Kunde inte läsa besökens fakturarader:', error)
      } else {
        byVisitId = new Map<string, number>()
        for (const row of (data || []) as Array<{ visit_id: string | null; total_price: number | null }>) {
          if (!row.visit_id) continue
          byVisitId.set(row.visit_id, (byVisitId.get(row.visit_id) || 0) + Number(row.total_price || 0))
        }
      }
    }

    const weights = visits.map(v =>
      v.revenue != null ? Number(v.revenue) : (byVisitId.get(v.id) ?? 0)
    )

    // Inget underlag alls → jämn fördelning
    if (weights.every(w => w <= 0)) return visits.map(() => 1)
    return weights.map(w => (w > 0 ? w : 0))
  }

  /**
   * Fördelar `totalBase` proportionellt mot vikterna, avrundat till ören.
   * Residualen läggs på SISTA besöket med vikt > 0 så summan blir exakt.
   */
  private static splitBaseAcrossVisits(totalBase: number, weights: number[]): number[] {
    const weightSum = weights.reduce((s, w) => s + w, 0)
    if (weightSum <= 0) return weights.map(() => 0)

    const shares = weights.map(w =>
      w > 0 ? Math.round((totalBase * w / weightSum) * 100) / 100 : 0
    )

    let lastIdx = -1
    for (let i = shares.length - 1; i >= 0; i--) {
      if (weights[i] > 0) { lastIdx = i; break }
    }
    if (lastIdx >= 0) {
      const allocated = shares.reduce((s, v) => s + v, 0)
      shares[lastIdx] = Math.round((shares[lastIdx] + (totalBase - allocated)) * 100) / 100
    }
    return shares
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
