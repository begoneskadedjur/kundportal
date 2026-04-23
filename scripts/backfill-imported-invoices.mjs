#!/usr/bin/env node
// scripts/backfill-imported-invoices.mjs
//
// Engångskörning: för kunder som importerats via "Importera via org.nummer" och
// har historiska rader i `contract_billing_items` (source='manual', article_name LIKE 'Historisk%')
// men INGEN motsvarande rad i `invoices` — skapa invoices + invoice_items med
// is_historical=true, status=paid/sent, så att UI-modalerna ("Totalt fakturerat")
// visar rätt siffra.
//
// Idempotent: matchar på invoice_number = `F-${DocumentNumber}` mot invoices.
//
// Kör med:
//   node scripts/backfill-imported-invoices.mjs           (dry-run, default)
//   node scripts/backfill-imported-invoices.mjs --apply   (faktisk körning)

import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
dotenvConfig()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Saknar VITE_SUPABASE_URL eller SUPABASE_SERVICE_KEY i .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const APPLY = process.argv.includes('--apply')

function toIso(d) {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  return date.toISOString()
}

async function main() {
  console.log(APPLY ? '--- APPLY-läge (skrivning sker) ---' : '--- DRY-RUN (ingen skrivning) ---')

  // 1) Hämta alla importerade historiska contract_billing_items
  const { data: cbiItems, error: cbiErr } = await supabase
    .from('contract_billing_items')
    .select('id, customer_id, item_type, invoice_number, total_price, unit_price, billing_period_start, billing_period_end, invoiced_at, paid_at, status, article_name')
    .eq('source', 'manual')
    .like('article_name', 'Historisk%')
    .order('customer_id')

  if (cbiErr) {
    console.error('Kunde inte hämta contract_billing_items:', cbiErr.message)
    process.exit(1)
  }
  if (!cbiItems || cbiItems.length === 0) {
    console.log('Inga historiska importerade rader hittades.')
    return
  }
  console.log(`Hittade ${cbiItems.length} historiska rader i contract_billing_items.`)

  // 2) Gruppera per kund
  const byCustomer = new Map()
  for (const item of cbiItems) {
    if (!item.invoice_number || !item.customer_id) continue
    if (!byCustomer.has(item.customer_id)) byCustomer.set(item.customer_id, [])
    byCustomer.get(item.customer_id).push(item)
  }

  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const [customerId, items] of byCustomer) {
    // Hämta kunddata
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, company_name, organization_number, contact_email, contact_phone, contact_address, billing_email, billing_address')
      .eq('id', customerId)
      .single()

    if (custErr || !customer) {
      console.error(`  [${customerId}] Kunde inte hämta kund: ${custErr?.message || 'inte hittad'}`)
      errorCount++
      continue
    }

    // Kolla vilka invoices som redan finns
    const expectedNumbers = items.map(i => `F-${i.invoice_number}`)
    const { data: existing } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('customer_id', customerId)
      .in('invoice_number', expectedNumbers)
    const existingSet = new Set((existing || []).map(e => e.invoice_number))

    const toCreate = items.filter(i => !existingSet.has(`F-${i.invoice_number}`))
    if (toCreate.length === 0) {
      console.log(`  [${customer.company_name}] Redan synkad (${items.length} rader)`)
      skippedCount += items.length
      continue
    }

    console.log(`  [${customer.company_name}] ${toCreate.length}/${items.length} saknas → skapar...`)

    if (!APPLY) {
      for (const i of toCreate) {
        console.log(`    → F-${i.invoice_number} | ${i.status} | ${i.total_price} kr | ${i.billing_period_start} → ${i.billing_period_end}`)
      }
      createdCount += toCreate.length
      continue
    }

    // Bygg invoice-rader
    const invoiceRows = toCreate.map(i => {
      const isoInvDate = toIso(i.invoiced_at ?? i.billing_period_start)
      const paid = i.status === 'paid' || !!i.paid_at
      const sent = paid || i.status === 'invoiced' || i.status === 'sent'
      const status = paid ? 'paid' : (sent ? 'sent' : 'draft')
      return {
        invoice_number: `F-${i.invoice_number}`,
        invoice_type: i.item_type === 'contract' ? 'contract' : 'adhoc',
        customer_id: customerId,
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: i.total_price,
        vat_amount: 0,
        total_amount: i.total_price,
        status,
        requires_approval: false,
        billing_period_start: i.billing_period_start,
        billing_period_end: i.billing_period_end,
        due_date: i.paid_at ?? i.invoiced_at ?? i.billing_period_end,
        booked_at: isoInvDate,
        sent_at: sent ? isoInvDate : null,
        paid_at: i.paid_at ? toIso(i.paid_at) : null,
        is_historical: true,
        notes: `Importerad historisk faktura från Fortnox (${i.invoice_number}) [backfill]`,
        created_at: isoInvDate,
      }
    })

    const { data: inserted, error: invErr } = await supabase
      .from('invoices')
      .insert(invoiceRows)
      .select('id, invoice_number, subtotal, invoice_type')

    if (invErr) {
      console.error(`    FEL invoices-insert: ${invErr.message}`)
      errorCount += toCreate.length
      continue
    }
    if (!inserted) continue

    const itemRows = inserted.map(row => ({
      invoice_id: row.id,
      article_code: 'HIST',
      article_name: row.invoice_type === 'contract' ? 'Historisk avtalsfaktura (import)' : 'Historisk engångsfaktura (import)',
      quantity: 1,
      unit_price: row.subtotal,
      total_price: row.subtotal,
      vat_rate: 0,
      discount_percent: 0,
    }))

    const { error: itemErr } = await supabase.from('invoice_items').insert(itemRows)
    if (itemErr) {
      console.error(`    FEL invoice_items-insert: ${itemErr.message}`)
      errorCount += toCreate.length
      continue
    }

    console.log(`    ✓ ${inserted.length} invoices + ${itemRows.length} items skapade`)
    createdCount += inserted.length
  }

  console.log('\n--- Sammanfattning ---')
  console.log(`Kunder bearbetade: ${byCustomer.size}`)
  console.log(`Skapade invoices:  ${createdCount}${APPLY ? '' : ' (skulle skapa)'}`)
  console.log(`Redan synkade:     ${skippedCount}`)
  console.log(`Fel:               ${errorCount}`)
  if (!APPLY) console.log('\nKör med --apply för att faktiskt skapa raderna.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
