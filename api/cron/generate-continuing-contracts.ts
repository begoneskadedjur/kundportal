// api/cron/generate-continuing-contracts.ts
// Säkerhetsnät: regenererar fakturaplan för fortlöpande avtal vars
// contract_end_date passerat men terminated_at ej satt.
// Körs 1:a varje månad 03:00 UTC via Vercel Cron.
// Respekterar uppsägnings-cutoff (bindningstid + 60 dagar notice).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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

// TZ-säker YYYY-MM-DD
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayLocal(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

async function getCustomerServiceItems(customerId: string, freq: string): Promise<Array<{
  case_billing_item_id: string
  article_id: string | null
  display_code: string | null
  display_name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  rot_rut_type: string | null
  fastighetsbeteckning: string | null
}>> {
  const { data: contract } = await supabase
    .from('contracts')
    .select('id')
    .eq('customer_id', customerId)
    .eq('oneflow_contract_id', `imported-${customerId}`)
    .maybeSingle()
  if (!contract) return []

  const { data: items } = await supabase
    .from('case_billing_items')
    .select('id, article_id, article_code, article_name, service_id, service_code, service_name, quantity, unit_price, total_price, vat_rate, discount_percent, rot_rut_type, fastighetsbeteckning')
    .eq('case_id', contract.id)
    .eq('case_type', 'contract')
    .eq('item_type', 'service')
  if (!items || items.length === 0) return []

  const divisor = freq === 'monthly' ? 12 : freq === 'quarterly' ? 4 : 1
  return items.map((s: any) => ({
    case_billing_item_id: s.id,
    article_id: s.article_id,
    display_code: s.service_code ?? s.article_code ?? null,
    display_name: s.service_name ?? s.article_name ?? 'Avtalstjänst',
    quantity: s.quantity,
    unit_price: Math.round(Number(s.unit_price) * 100 / divisor) / 100,
    total_price: Math.round(Number(s.total_price) * 100 / divisor) / 100,
    vat_rate: Number(s.vat_rate),
    discount_percent: Number(s.discount_percent ?? 0),
    rot_rut_type: s.rot_rut_type ?? null,
    fastighetsbeteckning: s.fastighetsbeteckning ?? null,
  }))
}

function buildNotes(seqN: number, totalN: number, periodStart: string, periodEnd: string): string {
  return `Betalning ${seqN}/${totalN} – Period ${periodStart} t.o.m. ${periodEnd}`
}

function computeTerminationCutoff(c: CustomerRow): Date | null {
  if (!c.terminated_at) return null
  const notice = c.notice_period_months ?? 2
  const termDate = new Date(c.terminated_at)
  const contractEnd = c.contract_end_date ? new Date(c.contract_end_date) : null
  if (contractEnd && termDate <= contractEnd) return contractEnd
  const cutoff = new Date(termDate)
  cutoff.setMonth(cutoff.getMonth() + notice)
  return cutoff
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
    const startYear = start.getFullYear()
    const startOfStartMonth = new Date(startYear, start.getMonth(), 1)
    let firstStart = new Date(startYear, anchor, 1)
    if (firstStart < startOfStartMonth) firstStart = new Date(startYear + 1, anchor, 1)
    let cur = firstStart
    while (cur <= end) {
      const pe = new Date(cur.getFullYear() + 1, cur.getMonth(), 0)
      const elevenAhead = new Date(cur.getFullYear(), cur.getMonth() + 11, 1)
      if (elevenAhead > end) break
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

  // Fortlöpande-horisont: 12 mån framåt från idag.
  const now = new Date()
  let effectiveEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
  if (end > effectiveEnd) return 0  // inte fortlöpande ännu

  // Respektera cutoff vid uppsägning
  const cutoff = computeTerminationCutoff(customer)
  if (cutoff && cutoff < effectiveEnd) effectiveEnd = cutoff

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
  const totalN = intervals.length
  const today = new Date()
  for (let idx = 0; idx < intervals.length; idx++) {
    const { periodStart, periodEnd } = intervals[idx]
    const key = toLocalIsoDate(periodStart)
    if (existingByKey.has(key)) continue

    const vat = Math.round(perPeriod * 0.25)
    // due_date = 30 dagar från idag när fakturan skapas (ej från periodStart)
    const due = new Date(today)
    due.setDate(due.getDate() + 30)

    const invNum = await generateInvoiceNumber()
    const serviceItems = await getCustomerServiceItems(customer.id, freq)
    const notes = buildNotes(idx + 1, totalN, key, toLocalIsoDate(periodEnd))

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
        requires_approval: false,
        billing_period_start: key,
        billing_period_end: toLocalIsoDate(periodEnd),
        due_date: toLocalIsoDate(due),
        is_historical: false,
        notes,
      })
      .select('id')
      .single()

    if (error || !inv) continue

    const rows = serviceItems.length > 0
      ? serviceItems.map(it => ({
          invoice_id: inv.id,
          case_billing_item_id: it.case_billing_item_id,
          article_id: null,
          article_code: it.display_code,
          article_name: it.display_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          vat_rate: it.vat_rate,
          discount_percent: it.discount_percent,
          rot_rut_type: it.rot_rut_type,
          fastighetsbeteckning: it.fastighetsbeteckning,
        }))
      : [{
          invoice_id: inv.id,
          article_name: `Avtalsfakturering ${key.slice(0, 7)}`,
          quantity: 1,
          unit_price: perPeriod,
          total_price: perPeriod,
          vat_rate: 25,
          discount_percent: 0,
        }]
    await supabase.from('invoice_items').insert(rows)
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

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const today = toLocalIsoDate(todayLocal())
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
