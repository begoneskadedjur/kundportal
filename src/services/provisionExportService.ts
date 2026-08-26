// src/services/provisionExportService.ts - Exportfunktioner för provision
import { supabase } from '../lib/supabase'
import type { CommissionPost, ProvisionTechnicianSummary } from '../types/provision'
import { formatSwedishMonth } from '../types/provision'

/** Vem som kör exporten - loggas i commission_export_log för spårbarhet. */
export interface ProvisionExporter {
  userId: string | null
  name: string | null
}

export class ProvisionExportService {
  /**
   * Loggar en genomförd export i commission_export_log.
   * Ett loggfel får ALDRIG blockera nedladdningen - CSV:n är redan hos
   * användaren när detta körs, så vi loggar bara till konsolen.
   */
  private static async logExport(params: {
    exporter?: ProvisionExporter
    payoutMonth: string
    postIds: string[]
    totalAmount: number
  }): Promise<void> {
    try {
      const { error } = await supabase.from('commission_export_log').insert({
        exported_by: params.exporter?.userId ?? null,
        exported_by_name: params.exporter?.name ?? null,
        payout_month: params.payoutMonth,
        post_ids: params.postIds,
        post_count: params.postIds.length,
        total_amount: Math.round(params.totalAmount * 100) / 100
      })
      if (error) throw error
    } catch (err) {
      console.error('Kunde inte logga provisionsexport (nedladdningen påverkas ej):', err)
    }
  }

  static exportPayrollCSV(
    summaries: ProvisionTechnicianSummary[],
    month: string,
    exporter?: ProvisionExporter
  ): void {
    const monthDisplay = formatSwedishMonth(month)
    const headers = [
      'Anställningsnr',
      'Namn',
      'E-post',
      'Antal poster',
      'Provisionsbelopp',
      'Period',
      'Kommentar'
    ]

    const rows = summaries.map(s => [
      '',
      s.technician_name,
      s.technician_email || '',
      String(s.post_count),
      s.total_commission.toFixed(2).replace('.', ','),
      monthDisplay,
      `Provision ${monthDisplay}`
    ])

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `provision_loneunderlag_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)

    // Fire-and-forget: loggen får inte hålla upp eller fälla nedladdningen
    void this.logExport({
      exporter,
      payoutMonth: month,
      postIds: summaries.flatMap(s => s.posts.map(p => p.id)),
      totalAmount: summaries.reduce((sum, s) => sum + s.total_commission, 0)
    })
  }

  static exportDetailedCSV(
    posts: CommissionPost[],
    month: string,
    exporter?: ProvisionExporter
  ): void {
    const headers = [
      'Ärendenr',
      'Titel',
      'Ärendetyp',
      'Tekniker',
      'Grundbelopp',
      'Avdrag',
      'Procent',
      'Andel',
      'Provision',
      'Status',
      'Skapad',
      'ROT/RUT',
      'Anteckningar'
    ]

    const typeLabels: Record<string, string> = {
      private: 'Privat',
      business: 'Företag',
      contract: 'Avtal'
    }

    const statusLabels: Record<string, string> = {
      pending_invoice: 'Väntar på betalning',
      ready_for_payout: 'Redo för utbetalning',
      approved: 'Godkänd',
      paid_out: 'Utbetald'
    }

    const rows = posts.map(p => [
      p.case_number || '',
      p.case_title || '',
      typeLabels[p.case_type] || p.case_type,
      p.technician_name,
      p.base_amount.toFixed(2).replace('.', ','),
      (p.deductions || 0).toFixed(2).replace('.', ','),
      `${p.commission_percentage}%`,
      `${p.share_percentage}%`,
      p.commission_amount.toFixed(2).replace('.', ','),
      statusLabels[p.status] || p.status,
      new Date(p.created_at).toLocaleDateString('sv-SE'),
      p.is_rot_rut ? 'Ja' : 'Nej',
      p.notes || ''
    ])

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `provision_detaljer_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)

    void this.logExport({
      exporter,
      payoutMonth: month,
      postIds: posts.map(p => p.id),
      totalAmount: posts.reduce((sum, p) => sum + p.commission_amount, 0)
    })
  }

  /** Historik: senaste löneunderlagsexporterna (för admin-vyns spårbarhet). */
  static async getExportHistory(payoutMonth?: string, limit = 20) {
    let query = supabase
      .from('commission_export_log')
      .select('*')
      .order('exported_at', { ascending: false })
      .limit(limit)

    if (payoutMonth) query = query.eq('payout_month', payoutMonth)

    const { data, error } = await query
    if (error) throw error
    return data || []
  }
}
