// src/services/provisionService.ts - Databasoperationer för provisionssystemet
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
    // Hämta inställningar
    const settings = await this.getSettings()

    // Kontrollera tröskelvärde
    const effectiveBase = caseData.is_rot_rut && caseData.rot_rut_original_amount
      ? caseData.rot_rut_original_amount
      : caseData.base_amount

    if (effectiveBase < settings.min_commission_base) {
      throw new Error(`Beloppet ${effectiveBase} kr understiger minsta provisionsgrundande belopp (${settings.min_commission_base} kr exkl moms)`)
    }

    // Kontrollera att poster inte redan finns
    const existing = await this.getPostsByCase(caseData.case_id)
    if (existing.length > 0) {
      throw new Error('Provisionsposter finns redan för detta ärende')
    }

    // Validera att andelar summerar till 100%
    const totalShare = technicianShares.reduce((sum, t) => sum + t.share_percentage, 0)
    if (Math.abs(totalShare - 100) > 0.01) {
      throw new Error(`Teknikerandelar summerar till ${totalShare}%, måste vara 100%`)
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

  // ─── Hämta poster ────────────────────────────────────────

  static async getPostsForMonth(
    month: string,
    filters?: ProvisionFilters
  ): Promise<CommissionPost[]> {
    const monthStart = `${month}-01`
    const [year, m] = month.split('-').map(Number)
    const nextMonth = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`

    let query = supabase
      .from('commission_posts')
      .select('*')
      .gte('created_at', monthStart)
      .lt('created_at', nextMonth)
      .order('created_at', { ascending: false })

    if (filters?.technician_id && filters.technician_id !== 'all') {
      query = query.eq('technician_id', filters.technician_id)
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query
    if (error) throw error
    return data as CommissionPost[]
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

  static async getTechnicianSummaries(
    month: string,
    filters?: ProvisionFilters
  ): Promise<ProvisionTechnicianSummary[]> {
    const posts = await this.getPostsForMonth(month, filters)

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

  static async getKpis(month: string): Promise<ProvisionKpi> {
    const posts = await this.getPostsForMonth(month)

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

  static async updateStatus(
    ids: string[],
    newStatus: CommissionStatus,
    approvedBy?: string
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
    }

    if (newStatus === 'ready_for_payout') {
      // Beräkna payout_month = månaden efter nu
      const now = new Date()
      const payoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      updateData.payout_month = `${payoutDate.getFullYear()}-${String(payoutDate.getMonth() + 1).padStart(2, '0')}`
      updateData.invoice_paid_date = now.toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('commission_posts')
      .update(updateData)
      .in('id', ids)

    if (error) throw error
  }

  static async markInvoicePaid(
    ids: string[],
    paidDate: string
  ): Promise<void> {
    const date = new Date(paidDate)
    const payoutDate = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    const payoutMonth = `${payoutDate.getFullYear()}-${String(payoutDate.getMonth() + 1).padStart(2, '0')}`

    const { error } = await supabase
      .from('commission_posts')
      .update({
        status: 'ready_for_payout',
        invoice_paid_date: paidDate,
        payout_month: payoutMonth,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)

    if (error) throw error
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
