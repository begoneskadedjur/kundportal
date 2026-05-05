// src/types/monthlyReport.ts
// Typer för månadsrapport (cron_runs + monthly_customer_snapshots)

export interface CronRun {
  id: string
  job_name: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  summary: any
  error_message: string | null
  created_at: string
}

export interface MonthlyCustomerSnapshot {
  snapshot_month: string // YYYY-MM-01
  total_active_customers: number
  total_paused_customers: number
  total_terminated_customers: number
  total_expired_customers: number
  customers_added: number
  customers_terminated: number
  arr_sek: number
  mrr_sek: number
  invoiced_sek: number
  paid_sek: number
  outstanding_sek: number
  overdue_sek: number
  by_contract_type: Record<string, { count: number; arr: number }> | null
  by_billing_frequency: Record<string, number> | null
  added_customers: Array<{
    id: string
    company_name: string
    contract_type: string | null
    annual_value: number
    source_type?: string | null
  }> | null
  terminated_customers: Array<{
    id: string
    company_name: string
    terminated_at: string | null
    contract_type: string | null
    annual_value: number
  }> | null
  top_customers_by_arr: Array<{
    id: string
    company_name: string
    contract_type: string | null
    annual_value: number
  }> | null
  is_estimated: boolean
  created_at: string
  updated_at: string
}

export interface MonthlyReportData {
  snapshot: MonthlyCustomerSnapshot
  previous?: MonthlyCustomerSnapshot
  cronRuns: CronRun[]
}
