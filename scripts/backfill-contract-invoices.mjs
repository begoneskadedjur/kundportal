#!/usr/bin/env node
// scripts/backfill-contract-invoices.mjs
// Engångskörning: generera avtalsfakturor för alla kunder som har annual_value,
// contract_start_date och billing_frequency men saknar invoices i nya modellen.
//
// Kör med: node scripts/backfill-contract-invoices.mjs
// Använder service key för direkt DB-access.

import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
dotenvConfig() // fallback till .env

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Saknar VITE_SUPABASE_URL eller SUPABASE_SERVICE_KEY i .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const LOCKED_STATUSES = new Set(['booked', 'sent', 'paid'])

async function getCustomerServiceItems(customerId, freq) {
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
  return items.map((s) => ({
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

function freqLabel(freq) {
  if (freq === 'monthly') return 'Månadsvis'
  if (freq === 'quarterly') return 'Kvartalsvis'
  if (freq === 'annual') return 'Årsvis'
  return 'Avtal'
}

function toLocalIsoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayLocal() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function amountPerPeriod(annual, freq) {
  if (freq === 'monthly') return Math.round(annual / 12)
  if (freq === 'quarterly') return Math.round(annual / 4)
  if (freq === 'annual') return Math.round(annual)
  return 0
}

function iterPeriods(start, end, freq, anchorMonth) {
  const out = []
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

async function generateInvoiceNumber() {
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

async function processCustomer(customer) {
  const freq = customer.billing_frequency
  const annual = Number(customer.annual_value ?? 0)
  const start = customer.contract_start_date ? new Date(customer.contract_start_date) : null
  const end = customer.contract_end_date ? new Date(customer.contract_end_date) : null

  if (!freq || freq === 'on_demand' || annual <= 0 || !start || !end) {
    return { skipped: true, reason: 'saknar data eller on_demand' }
  }
  if (customer.billing_active === false) return { skipped: true, reason: 'billing_active=false' }

  // Kapning vid uppsägning
  let effectiveEnd = end
  if (customer.terminated_at) {
    const termEnd = new Date(customer.terminated_at)
    termEnd.setMonth(termEnd.getMonth() + (customer.notice_period_months ?? 2))
    if (termEnd < effectiveEnd) effectiveEnd = termEnd
  }

  const perPeriod = amountPerPeriod(annual, freq)
  const intervals = iterPeriods(start, effectiveEnd, freq, customer.billing_anchor_month)

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, status, billing_period_start')
    .eq('customer_id', customer.id)
    .eq('invoice_type', 'contract')

  const existingByKey = new Map(
    (existing ?? []).filter(e => e.billing_period_start).map(e => [e.billing_period_start, e])
  )

  const today = todayLocal()
  let created = 0
  let createdHistorical = 0
  for (const { periodStart, periodEnd } of intervals) {
    const key = toLocalIsoDate(periodStart)
    if (existingByKey.has(key)) continue

    const isHistorical = periodEnd < today
    const vat = Math.round(perPeriod * 0.25)
    const due = new Date(periodStart)
    due.setDate(due.getDate() + 30)
    const dueIso = toLocalIsoDate(due)

    const bookedSentAt = periodStart.toISOString()
    const paidAt = new Date(dueIso).toISOString()

    const invNum = await generateInvoiceNumber()
    const serviceItems = await getCustomerServiceItems(customer.id, freq)
    const periodLabel = periodStart.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
    const notes = isHistorical
      ? `Historisk avtalsfakturering ${periodLabel} – ${freqLabel(freq)}`
      : `Avtalsfakturering ${periodLabel} – ${freqLabel(freq)}`

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
        status: isHistorical ? 'paid' : 'pending_approval',
        requires_approval: !isHistorical,
        billing_period_start: key,
        billing_period_end: toLocalIsoDate(periodEnd),
        due_date: dueIso,
        is_historical: isHistorical,
        booked_at: isHistorical ? bookedSentAt : null,
        sent_at: isHistorical ? bookedSentAt : null,
        paid_at: isHistorical ? paidAt : null,
        notes,
      })
      .select('id')
      .single()

    if (error || !inv) {
      console.error(`  fel för ${customer.company_name}:`, error?.message)
      continue
    }

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
    if (isHistorical) createdHistorical++
    else created++
  }

  return { created, createdHistorical }
}

async function main() {
  const onlyCustomerId = process.argv[2]

  let q = supabase
    .from('customers')
    .select('*')
    .eq('billing_active', true)
    .neq('billing_frequency', 'on_demand')
    .not('annual_value', 'is', null)
    .not('contract_start_date', 'is', null)

  if (onlyCustomerId) {
    q = q.eq('id', onlyCustomerId)
  }

  const { data: customers, error } = await q
  if (error) throw error

  console.log(`Bearbetar ${customers?.length ?? 0} kunder...`)

  let totalCreated = 0
  let totalHistorical = 0
  for (const c of customers ?? []) {
    const result = await processCustomer(c)
    if (result.skipped) {
      console.log(`  SKIP ${c.company_name}: ${result.reason}`)
    } else {
      console.log(`  ${c.company_name}: ${result.created} nya, ${result.createdHistorical} historiska`)
      totalCreated += result.created
      totalHistorical += result.createdHistorical
    }
  }

  console.log(`\nKlart. Totalt ${totalCreated} nya + ${totalHistorical} historiska fakturor.`)
}

main().catch(err => {
  console.error('Fel:', err)
  process.exit(1)
})
