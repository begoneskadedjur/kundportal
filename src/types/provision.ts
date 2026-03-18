// src/types/provision.ts - Typer för det nya provisionssystemet

export type CommissionStatus = 'pending_invoice' | 'ready_for_payout' | 'approved' | 'paid_out'

export type CommissionType = 'engangsjobb'

export interface CommissionPost {
  id: string
  case_id: string
  case_type: 'private' | 'business' | 'contract'
  case_title: string | null
  case_number: string | null
  technician_id: string
  technician_name: string
  technician_email: string | null
  commission_type: CommissionType
  commission_percentage: number
  share_percentage: number
  base_amount: number
  deductions: number
  commission_amount: number
  invoice_paid_date: string | null
  payout_month: string | null
  status: CommissionStatus
  approved_by: string | null
  approved_at: string | null
  paid_out_at: string | null
  notes: string | null
  is_rot_rut: boolean
  rot_rut_original_amount: number | null
  created_at: string
  updated_at: string
}

export interface CommissionPostInsert {
  case_id: string
  case_type: 'private' | 'business' | 'contract'
  case_title?: string
  case_number?: string
  technician_id: string
  technician_name: string
  technician_email?: string
  commission_type?: CommissionType
  commission_percentage: number
  share_percentage?: number
  base_amount: number
  deductions?: number
  commission_amount: number
  notes?: string
  is_rot_rut?: boolean
  rot_rut_original_amount?: number
}

export interface TechnicianShare {
  technician_id: string
  technician_name: string
  technician_email?: string
  share_percentage: number
}

export interface CommissionSettings {
  engangsjobb_percentage: number
  min_commission_base: number
  payout_cutoff_day: number
}

export interface PayoutTechnicianSummary {
  technician_id: string
  technician_name: string
  post_count: number
  total_commission: number
  payout_month: string | null
  statuses: { pending: number; ready: number; approved: number; paid: number }
}

export interface TechnicianPayoutEntry {
  technician_id: string
  technician_name: string
  posts: CommissionPost[]
  total_commission: number
  post_count: number
  statuses: { pending: number; ready: number; approved: number; paid: number }
}

export interface MonthlyProvisionSummary {
  month_key: string
  month_label: string
  technicians: TechnicianPayoutEntry[]
  total_technicians: number
  total_posts: number
  total_commission: number
  statuses: { pending: number; ready: number; approved: number; paid: number }
}

export interface ProvisionKpi {
  pending_invoice_total: number
  pending_invoice_count: number
  ready_for_payout_total: number
  ready_for_payout_count: number
  approved_total: number
  approved_count: number
  paid_out_total: number
  paid_out_count: number
}

export interface ProvisionTechnicianSummary {
  technician_id: string
  technician_name: string
  technician_email: string | null
  total_commission: number
  post_count: number
  posts: CommissionPost[]
}

export interface ProvisionFilters {
  technician_id?: string | 'all'
  status?: CommissionStatus | 'all'
}

// Statuskonfiguration
export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, {
  label: string
  color: string
  bgClass: string
  textClass: string
  dimmed: boolean
}> = {
  pending_invoice: {
    label: 'Väntar på betalning',
    color: 'yellow',
    bgClass: 'bg-yellow-500/10 border-yellow-500/20',
    textClass: 'text-yellow-400',
    dimmed: true
  },
  ready_for_payout: {
    label: 'Redo för utbetalning',
    color: 'green',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    textClass: 'text-emerald-400',
    dimmed: false
  },
  approved: {
    label: 'Godkänd',
    color: 'blue',
    bgClass: 'bg-blue-500/10 border-blue-500/20',
    textClass: 'text-blue-400',
    dimmed: false
  },
  paid_out: {
    label: 'Utbetald',
    color: 'slate',
    bgClass: 'bg-slate-500/10 border-slate-500/20',
    textClass: 'text-slate-400',
    dimmed: true
  }
}

// Månadshjälpfunktioner (återanvänds från commission.ts mönster)
const SWEDISH_MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

export interface MonthSelection {
  year: number
  month: number
  display: string
  value: string
}

export function getCurrentMonth(): MonthSelection {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    display: `${SWEDISH_MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
}

export function getMonthOptions(monthsBack: number = 12): MonthSelection[] {
  const options: MonthSelection[] = []
  const now = new Date()
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      display: `${SWEDISH_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }
  return options
}

export function formatSwedishMonth(monthValue: string): string {
  const [year, month] = monthValue.split('-').map(Number)
  return `${SWEDISH_MONTHS[month - 1]} ${year}`
}
