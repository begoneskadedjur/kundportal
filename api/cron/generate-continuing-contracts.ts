// api/cron/generate-continuing-contracts.ts
// Säkerhetsnät: regenererar fakturaplan för fortlöpande avtal vars
// contract_end_date passerat men terminated_at ej satt.
// Körs 1:a varje månad 03:00 UTC via Vercel Cron.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const LOCKED_STATUSES = new Set(['booked', 'sent', 'paid'])

type CustomerRow = {
  id: string
  company_name: string
  organization_number: string | null
  billing_email: string | null
  billing_address: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  annual_value: number | null
  monthly_value: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  billing_frequency: string | null
  billing_anchor_month: number | null
  billing_active: boolean | null
  notice_period_months: number | null
}

function amountPerPeriod(annual: number, freq: string): number {
  if (freq === 'monthly') return Math.round(annual / 12)
  if (freq === 'quarterly') return Math.round(annual / 4)
  if (freq === 'annual') return Math.round(annual)
  return 0
}

function iterPeriods(
  start: Date,
  end: Date,
  freq: string,
  anchorMonth: number | null,
): Array<{ periodStart: Date; periodEnd: Date }> {
  const out: Array<{ periodStart: Date; periodEnd: Date }> = []
  if (freq === 'monthly') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const pe = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
      out.push({ periodStart: new Date(cur), periodEnd: pe })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else if (freq === 'quarterly') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const pe = new Date(cur.getFullYear(), cur.getMonth() + 3, 0)
      out.push({ periodStart: new Date(cur), periodEnd: pe })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1)
    }
  } else if (freq === 'annual') {
    const anchor = anchorMonth && anchorMonth >= 1 && anchorMonth <= 12 ? anchorMonth - 1 : start.getMonth()
    let firstStart = new Date(start.getFullYear(), anchor, 1)
    if (firstStart < start) firstStart = new Date(start.getFullYear() + 1, anchor, 1)
    let cur = firstStart
    while (cur <= end) {
      const pe = new Date(cur.getFullYear() + 1, cur.getMonth(), 0)
      out.push({ periodStart: new Date(cur), periodEnd: pe })
      cur = new Date(cur.getFullYear() + 1, cur.getMonth(), 1)
    }
  }
  return out
}

async function regenerateForCustomer(customer: CustomerRow): Promise<number> {
  const freq = customer.billing_frequency
  const annual = Number(customer.annual_value ?? 0)
  const start = customer.contract_start_date ? new Date(customer.contract_start_date) : null
  const end = customer.contract_end_date ? new Date(customer.contract_end_date) : null

  if (!freq || freq === 'on_demand' || annual <= 0 || !start || !end) return 0
  if (customer.billing_active === false) return 0

  // Fortlöpande: förläng end 12 månader framåt från idag
  const now = new Date()
  const effectiveEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
  if (end > effectiveEnd) return 0  // inte fortlöpande

  const perPeriod = amountPerPeriod(annual, freq)
  const intervals = iterPeriods(start, effectiveEnd, freq, customer.billing_anchor_month)

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, status, billing_period_start')
    .eq('customer_id', customer.id)
    .eq('invoice_type', 'contract')

  const existingByKey = new Map(
    (existing ?? []).filter(e => e.billing_period_start).map(e => [e.billing_period_start as string, e])
  )

  let created = 0
  for (const { periodStart, periodEnd } of intervals) {
    const key = periodStart.toISOString().slice(0, 10)
    if (existingByKey.has(key)) continue

    const vat = Math.round(perPeriod * 0.25)
    const due = new Date(periodStart)
    due.setDate(due.getDate() + 30)

    const invNum = await generateInvoiceNumber()
    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invNum,
        invoice_type: 'contract',
        customer_id: customer.id,
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: perPeriod,
        vat_amount: vat,
        total_amount: perPeriod + vat,
        status: 'pending_approval',
        requires_approval: true,
        billing_period_start: key,
        billing_period_end: periodEnd.toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
      })
      .select('id')
      .single()

    if (error || !inv) continue

    await supabase.from('invoice_items').insert({
      invoice_id: inv.id,
      article_name: `Avtalsfakturering ${key.slice(0, 7)}`,
      quantity: 1,
      unit_price: perPeriod,
      total_price: perPeriod,
      vat_rate: 25,
      discount_percent: 0,
    })
    created++
  }

  return created
}

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `INV-${year}${month}`
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .like('invoice_number', `${prefix}%`)
  const seq = String((count || 0) + 1).padStart(4, '0')
  return `${prefix}-${seq}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .lt('contract_end_date', today)
      .is('terminated_at', null)
      .eq('billing_active', true)

    if (error) throw error

    const results: Array<{ customer_id: string; company_name: string; created: number }> = []
    for (const c of customers ?? []) {
      try {
        const created = await regenerateForCustomer(c as CustomerRow)
        if (created > 0) {
          results.push({ customer_id: c.id, company_name: c.company_name, created })
        }
      } catch (err: any) {
        console.error(`Fel vid regenerering av ${c.id}:`, err.message)
      }
    }

    return res.status(200).json({
      success: true,
      customers_processed: customers?.length ?? 0,
      total_invoices_created: results.reduce((sum, r) => sum + r.created, 0),
      details: results,
    })
  } catch (err: any) {
    console.error('Cron error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
