// 📁 src/types/commission.ts - TypeScript interfaces för provisionsdata
import type { Database } from './database'

// Grundläggande commission interfaces
export interface Commission {
  id: string
  task_id: string
  technician_id: string
  technician_name: string
  technician_email?: string
  amount: number
  case_price: number
  case_type: 'private' | 'business' 
  case_title: string
  case_number?: string
  calculated_at: string
  completed_date: string
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip'
}

// KPI data för dashboard
export interface CommissionKpi {
  total_commission: number
  total_cases: number
  active_technicians: number
  avg_commission_per_case: number
  avg_commission_per_technician: number
  pending_commission: number
  paid_commission: number
}

// Månadsselektor
export interface MonthSelection {
  year: number
  month: number
  display: string // "Juli 2025"
  value: string   // "2025-07"
}

// Tekniker-filter
export interface TechnicianFilter {
  id: string | 'all'
  name: string
  email?: string
}

// Månadsdata för diagram
export interface CommissionMonthlyData {
  month: string // "2025-07"
  month_display: string // "Jul 2025"
  technician_id: string
  technician_name: string
  total_commission: number
  case_count: number
  private_commission: number
  business_commission: number
  avg_commission_per_case: number
}

// Detaljerad ärendedata
export interface CommissionCaseDetail {
  id: string
  clickup_task_id: string
  case_number?: string
  title: string
  type: 'private' | 'business'
  case_price: number
  commission_amount: number
  commission_calculated_at: string
  completed_date: string
  primary_assignee_id?: string
  primary_assignee_name?: string
  primary_assignee_email?: string
  skadedjur?: string
  adress?: any
  kontaktperson?: string
  org_nr?: string
  bestallare?: string
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip'
}

// Grupperad data per tekniker
export interface TechnicianCommissionSummary {
  technician_id: string
  technician_name: string
  technician_email?: string
  total_commission: number
  case_count: number
  private_cases: number
  business_cases: number
  private_commission: number
  business_commission: number
  avg_commission_per_case: number
  latest_case_date: string
  cases: CommissionCaseDetail[]
}

// Dashboard state
export interface CommissionDashboardState {
  selectedMonth: MonthSelection
  selectedTechnician: TechnicianFilter
  data: {
    kpis: CommissionKpi
    monthlyData: CommissionMonthlyData[]
    technicianSummaries: TechnicianCommissionSummary[]
    caseDetails: CommissionCaseDetail[]
  }
  loading: boolean
  error: string | null
}

// Export data
export interface CommissionExportData {
  technician_name: string
  technician_email: string
  case_count: number
  total_commission: number
  private_commission: number
  business_commission: number
  cases: Array<{
    case_number: string
    title: string
    type: string
    case_price: number
    commission_amount: number
    completed_date: string
    customer_info: string
  }>
}

// Filter & sortering
export interface CommissionFilters {
  month: string
  technician_id: string | 'all'
  case_type: 'all' | 'private' | 'business'
  billing_status: 'all' | 'pending' | 'sent' | 'paid' | 'skip'
}

export interface CommissionSort {
  field: 'completed_date' | 'commission_amount' | 'case_price' | 'technician_name' | 'case_type'
  direction: 'asc' | 'desc'
}

// Chart data
export interface CommissionChartData {
  month: string
  month_display: string
  [technician_name: string]: number | string // Dynamic keys för varje tekniker
}

// Utility types för databas-tabeller
export type PrivateCaseCommission = Pick<
  Database['public']['Tables']['private_cases']['Row'],
  'id' | 'clickup_task_id' | 'case_number' | 'title' | 'pris' | 'commission_amount' | 
  'commission_calculated_at' | 'completed_date' | 'primary_assignee_id' | 
  'primary_assignee_name' | 'primary_assignee_email' | 'skadedjur' | 'adress' | 
  'kontaktperson' | 'billing_status'
>

export type BusinessCaseCommission = Pick<
  Database['public']['Tables']['business_cases']['Row'],
  'id' | 'clickup_task_id' | 'case_number' | 'title' | 'pris' | 'commission_amount' | 
  'commission_calculated_at' | 'completed_date' | 'primary_assignee_id' | 
  'primary_assignee_name' | 'primary_assignee_email' | 'skadedjur' | 'adress' | 
  'kontaktperson' | 'org_nr' | 'bestallare' | 'billing_status'
>

// Navigation helpers
export const getMonthOptions = (monthsBack: number = 12): MonthSelection[] => {
  const options: MonthSelection[] = []
  const now = new Date()
  
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    
    const monthNames = [
      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ]
    
    options.push({
      year,
      month,
      display: `${monthNames[month - 1]} ${year}`,
      value: `${year}-${month.toString().padStart(2, '0')}`
    })
  }
  
  return options
}

export const getCurrentMonth = (): MonthSelection => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  const monthNames = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]
  
  return {
    year,
    month,
    display: `${monthNames[month - 1]} ${year}`,
    value: `${year}-${month.toString().padStart(2, '0')}`
  }
}

export const formatSwedishMonth = (monthValue: string): string => {
  const [year, month] = monthValue.split('-')
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ]
  
  return `${monthNames[parseInt(month) - 1]} ${year}`
}