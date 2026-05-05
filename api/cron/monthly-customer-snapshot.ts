// api/cron/monthly-customer-snapshot.ts
// Månadsvis snapshot av kundbas + ekonomimått. Körs 1:a varje månad 02:00 UTC.
// Skapar en rad i monthly_customer_snapshots för föregående månad.
//
// Aggregat:
//   - status-fördelning (aktiv/pausad/uppsagd/utgången) vid månadsskiftet
//   - tillkommit/försvunnit under månaden
//   - ARR/MRR
//   - fakturerat/betalt under månaden
//   - portföljmix (avtalstyp, frekvens, top 10)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withCronLog } from '../_lib/cronLogger'

export const config = { maxDuration: 60 }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
)

interface CustomerRow {
  id: string
  company_name: string
  contract_type: string | null
  billing_frequency: string | null
  billing_active: boolean | null
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  annual_value: number | null
  source_type: string | null
  created_at: string | null
}

function previousMonthBoundaries(): { start: Date; end: Date; key: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1) // exklusivt
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  return { start, end, key }
}

function isActive(c: CustomerRow, atDate: Date): boolean {
  if (c.billing_active === false) return false
  if (c.terminated_at && new Date(c.terminated_at) <= atDate) return false
  if (c.contract_end_date && new Date(c.contract_end_date) < atDate) return false
  return true
}

function isPaused(c: CustomerRow, atDate: Date): boolean {
  return c.billing_active === false && (!c.terminated_at || new Date(c.terminated_at) > atDate)
}

function isTerminated(c: CustomerRow, atDate: Date): boolean {
  return !!c.terminated_at && new Date(c.terminated_at) <= atDate
}

function isExpired(c: CustomerRow, atDate: Date): boolean {
  return !!c.contract_end_date && new Date(c.contract_end_date) < atDate && !c.terminated_at
}

export async function buildSnapshot(snapshotMonth: Date): Promise<Record<string, any>> {
  const monthKey = `${snapshotMonth.getFullYear()}-${String(snapshotMonth.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(snapshotMonth.getFullYear(), snapshotMonth.getMonth() + 1, 1)
  const monthEndIso = monthEnd.toISOString()
  const monthStartIso = snapshotMonth.toISOString()

  // 1. Hämta alla avtalskunder (exkludera engångskunder)
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, company_name, contract_type, billing_frequency, billing_active, contract_start_date, contract_end_date, terminated_at, annual_value, source_type, created_at')
    .or('source_type.neq.manual,contract_start_date.not.is.null')
  if (error) throw error
  const all: CustomerRow[] = (customers ?? []) as CustomerRow[]

  // Vid månadens slut (sista sekund i månaden)
  const eom = new Date(monthEnd.getTime() - 1)

  const active = all.filter(c => isActive(c, eom))
  const paused = all.filter(c => isPaused(c, eom))
  const terminated = all.filter(c => isTerminated(c, eom))
  const expired = all.filter(c => isExpired(c, eom))

  // Tillkommit / försvunnit under månaden
  const added = all.filter(c => {
    if (!c.created_at) return false
    const d = new Date(c.created_at)
    return d >= snapshotMonth && d < monthEnd
  })
  const terminatedThisMonth = all.filter(c => {
    if (!c.terminated_at) return false
    const d = new Date(c.terminated_at)
    return d >= snapshotMonth && d < monthEnd
  })

  // ARR (sum av annual_value på aktiva)
  const arr = active.reduce((sum, c) => sum + Number(c.annual_value ?? 0), 0)
  const mrr = Math.round(arr / 12)

  // Fördelning per contract_type
  const byContractType: Record<string, { count: number; arr: number }> = {}
  for (const c of active) {
    const key = c.contract_type ?? 'Ej angivet'
    byContractType[key] ??= { count: 0, arr: 0 }
    byContractType[key].count++
    byContractType[key].arr += Number(c.annual_value ?? 0)
  }

  // Fördelning per billing_frequency
  const byFreq: Record<string, number> = {}
  for (const c of active) {
    const key = c.billing_frequency ?? 'okänt'
    byFreq[key] = (byFreq[key] ?? 0) + 1
  }

  // Top 10 efter ARR
  const top10 = [...active]
    .sort((a, b) => Number(b.annual_value ?? 0) - Number(a.annual_value ?? 0))
    .slice(0, 10)
    .map(c => ({
      id: c.id,
      company_name: c.company_name,
      contract_type: c.contract_type,
      annual_value: Number(c.annual_value ?? 0),
    }))

  // 2. Fakturerat under månaden
  const { data: invoiced } = await supabase
    .from('invoices')
    .select('total_amount')
    .gte('created_at', monthStartIso)
    .lt('created_at', monthEndIso)
    .neq('status', 'cancelled')

  const invoicedSek = (invoiced ?? []).reduce((s, i: any) => s + Number(i.total_amount ?? 0), 0)

  // 3. Betalt under månaden
  const { data: paid } = await supabase
    .from('invoices')
    .select('total_amount')
    .gte('paid_at', monthStartIso)
    .lt('paid_at', monthEndIso)
    .eq('status', 'paid')

  const paidSek = (paid ?? []).reduce((s, i: any) => s + Number(i.total_amount ?? 0), 0)

  // 4. Utestående vid månadsslut (skickade/bokförda men ej betalda)
  const { data: outstanding } = await supabase
    .from('invoices')
    .select('total_amount, status')
    .in('status', ['sent', 'booked', 'overdue'])
    .lt('created_at', monthEndIso)

  const outstandingSek = (outstanding ?? []).reduce((s, i: any) => s + Number(i.total_amount ?? 0), 0)
  const overdueSek = (outstanding ?? [])
    .filter((i: any) => i.status === 'overdue')
    .reduce((s, i: any) => s + Number(i.total_amount ?? 0), 0)

  return {
    snapshot_month: monthKey,
    total_active_customers: active.length,
    total_paused_customers: paused.length,
    total_terminated_customers: terminated.length,
    total_expired_customers: expired.length,
    customers_added: added.length,
    customers_terminated: terminatedThisMonth.length,
    arr_sek: Math.round(arr),
    mrr_sek: mrr,
    invoiced_sek: Math.round(invoicedSek),
    paid_sek: Math.round(paidSek),
    outstanding_sek: Math.round(outstandingSek),
    overdue_sek: Math.round(overdueSek),
    by_contract_type: byContractType,
    by_billing_frequency: byFreq,
    added_customers: added.map(c => ({
      id: c.id,
      company_name: c.company_name,
      contract_type: c.contract_type,
      annual_value: Number(c.annual_value ?? 0),
      source_type: c.source_type,
    })),
    terminated_customers: terminatedThisMonth.map(c => ({
      id: c.id,
      company_name: c.company_name,
      terminated_at: c.terminated_at,
      contract_type: c.contract_type,
      annual_value: Number(c.annual_value ?? 0),
    })),
    top_customers_by_arr: top10,
    is_estimated: false,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await withCronLog('monthly-customer-snapshot', async () => {
    // Stöd för manuell trigger via ?month=YYYY-MM-01 (för backfill)
    const monthParam = req.query?.month as string | undefined
    let snapshotMonth: Date
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      snapshotMonth = new Date(y, (m ?? 1) - 1, 1)
    } else {
      snapshotMonth = previousMonthBoundaries().start
    }

    const data = await buildSnapshot(snapshotMonth)

    const { error } = await supabase
      .from('monthly_customer_snapshots')
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'snapshot_month' })

    if (error) throw error

    return {
      status: 'success' as const,
      summary: {
        snapshot_month: data.snapshot_month,
        active: data.total_active_customers,
        added: data.customers_added,
        terminated: data.customers_terminated,
        arr: data.arr_sek,
        invoiced: data.invoiced_sek,
        paid: data.paid_sek,
      },
    }
  })

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
