// src/services/provisionExportService.ts - Exportfunktioner för provision
import type { CommissionPost, ProvisionTechnicianSummary } from '../types/provision'
import { formatSwedishMonth } from '../types/provision'

export class ProvisionExportService {
  static exportPayrollCSV(
    summaries: ProvisionTechnicianSummary[],
    month: string
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
  }

  static exportDetailedCSV(
    posts: CommissionPost[],
    month: string
  ): void {
    const monthDisplay = formatSwedishMonth(month)
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
  }
}
