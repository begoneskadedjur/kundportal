// src/services/monthlyReportService.ts
// Hämtar månadsrapport: snapshot + förra månaden för diff + cron-körningar i månaden.

import { supabase } from '../lib/supabase'
import type {
  MonthlyCustomerSnapshot,
  CronRun,
  MonthlyReportData,
} from '../types/monthlyReport'

function previousMonthKey(monthKey: string): string {
  const d = new Date(monthKey)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nextMonthKey(monthKey: string): string {
  const d = new Date(monthKey)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export class MonthlyReportService {
  /**
   * Lista alla månader vi har snapshot för (senaste 24).
   */
  static async listAvailableMonths(): Promise<string[]> {
    const { data, error } = await supabase
      .from('monthly_customer_snapshots')
      .select('snapshot_month')
      .order('snapshot_month', { ascending: false })
      .limit(24)

    if (error) throw new Error(error.message)
    return (data ?? []).map((r: { snapshot_month: string }) => r.snapshot_month)
  }

  /**
   * Hämta hela rapporten för en månad (snapshot + diff + cron-körningar).
   */
  static async getReport(monthKey: string): Promise<MonthlyReportData | null> {
    const { data: snapshot, error: snapErr } = await supabase
      .from('monthly_customer_snapshots')
      .select('*')
      .eq('snapshot_month', monthKey)
      .maybeSingle()

    if (snapErr) throw new Error(snapErr.message)
    if (!snapshot) return null

    const prevKey = previousMonthKey(monthKey)
    const { data: previous } = await supabase
      .from('monthly_customer_snapshots')
      .select('*')
      .eq('snapshot_month', prevKey)
      .maybeSingle()

    // Cron-körningar i månaden
    const { data: cronRuns } = await supabase
      .from('cron_runs')
      .select('*')
      .gte('started_at', monthKey)
      .lt('started_at', nextMonthKey(monthKey))
      .order('started_at', { ascending: false })

    return {
      snapshot: snapshot as MonthlyCustomerSnapshot,
      previous: (previous ?? undefined) as MonthlyCustomerSnapshot | undefined,
      cronRuns: (cronRuns ?? []) as CronRun[],
    }
  }
}
