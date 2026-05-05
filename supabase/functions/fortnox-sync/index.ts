// supabase/functions/fortnox-sync/index.ts
// Edge Function som synkar fakturastatus från Fortnox till vår DB.
//
// Två lägen:
//   - Cron-läge (POST utan body): pollar alla draft/sent-fakturor som inte uppdaterats senaste 30 min
//   - Manuellt läge (POST med {invoice_number}): synkar bara den fakturan
//
// Triggas av:
//   - pg_cron varje minut via net.http_post
//   - Manuellt från InvoiceDetailModal "Synka från Fortnox"-knapp

// @ts-ignore Deno-import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('FORTNOX_SYNC_CRON_SECRET') ?? ''
const FORTNOX_USE_TEST = Deno.env.get('FORTNOX_USE_TEST') === 'true'
const FORTNOX_CLIENT_ID = FORTNOX_USE_TEST
  ? Deno.env.get('FORTNOX_TEST_CLIENT_ID')!
  : Deno.env.get('FORTNOX_CLIENT_ID')!
const FORTNOX_CLIENT_SECRET = FORTNOX_USE_TEST
  ? Deno.env.get('FORTNOX_TEST_CLIENT_SECRET')!
  : Deno.env.get('FORTNOX_CLIENT_SECRET')!
const TOKEN_TABLE = FORTNOX_USE_TEST ? 'fortnox_test_tokens' : 'fortnox_tokens'

const FORTNOX_API = 'https://api.fortnox.se/3'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─────────────────────────────────────────────────────────────────────
// Token-hantering — porterad från api/fortnox/refresh.ts
// ─────────────────────────────────────────────────────────────────────

async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from(TOKEN_TABLE)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`DB-fel: ${error.message}`)
  if (!data) throw new Error('Fortnox ej ansluten — ingen token hittades')

  const expiresAt = new Date(data.expires_at).getTime()
  if (Date.now() < expiresAt - 60_000) {
    return data.access_token
  }

  const credentials = btoa(`${FORTNOX_CLIENT_ID}:${FORTNOX_CLIENT_SECRET}`)

  const tokenRes = await fetch('https://apps.fortnox.se/oauth-v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    }).toString(),
  })

  if (!tokenRes.ok) {
    throw new Error(`Token-refresh misslyckades: ${await tokenRes.text()}`)
  }

  const tokenData = await tokenRes.json()
  const expiresAtNew = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

  await supabase.from(TOKEN_TABLE).update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAtNew,
    updated_at: new Date().toISOString(),
  }).eq('id', data.id)

  return tokenData.access_token
}

// ─────────────────────────────────────────────────────────────────────
// Sync-logik — porterad från api/fortnox/webhook.ts
// ─────────────────────────────────────────────────────────────────────

type TargetStatus = 'paid' | 'overdue' | 'sent' | 'booked'

interface FortnoxInvoice {
  Sent?: boolean
  Booked?: boolean
  Balance?: number
  FinalPayDate?: string | null
  DueDate?: string | null
}

function mapFortnoxStatus(invoice: FortnoxInvoice): { status: TargetStatus | null; timestamp: string } {
  const now = new Date().toISOString()
  const isPaid = invoice.Balance === 0 && invoice.FinalPayDate != null
  const isSent = invoice.Sent === true
  const isBooked = invoice.Booked === true
  const dueDate = invoice.DueDate ? new Date(invoice.DueDate) : null
  const isOverdue = isSent && !isPaid && dueDate != null && dueDate < new Date()

  if (isPaid) return { status: 'paid', timestamp: new Date(invoice.FinalPayDate as string).toISOString() }
  if (isOverdue) return { status: 'overdue', timestamp: now }
  if (isSent) return { status: 'sent', timestamp: now }
  if (isBooked) return { status: 'booked', timestamp: now }
  return { status: null, timestamp: now }
}

const PROTECTED_BY_TARGET: Record<TargetStatus, string[]> = {
  paid: ['paid', 'cancelled'],
  overdue: ['paid', 'cancelled', 'overdue'],
  sent: ['paid', 'cancelled', 'overdue', 'sent'],
  booked: ['paid', 'cancelled', 'overdue', 'sent', 'booked', 'invoiced'],
}

interface SyncResult {
  documentNumber: string
  fortnoxStatus: TargetStatus | null
  invoicesUpdated: number
  contractItemsUpdated: number
  skipped?: string
}

async function syncFortnoxInvoice(documentNumber: string, accessToken: string): Promise<SyncResult> {
  const res = await fetch(`${FORTNOX_API}/invoices/${documentNumber}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    return { documentNumber, fortnoxStatus: null, invoicesUpdated: 0, contractItemsUpdated: 0, skipped: `Fortnox returnerade ${res.status}` }
  }

  const data = await res.json()
  const invoice = data.Invoice as FortnoxInvoice | undefined
  if (!invoice) {
    return { documentNumber, fortnoxStatus: null, invoicesUpdated: 0, contractItemsUpdated: 0, skipped: 'Inget Invoice-objekt' }
  }

  const { status: targetStatus, timestamp } = mapFortnoxStatus(invoice)
  if (!targetStatus) {
    return { documentNumber, fortnoxStatus: null, invoicesUpdated: 0, contractItemsUpdated: 0, skipped: 'draft i Fortnox' }
  }

  const protectedStatuses = PROTECTED_BY_TARGET[targetStatus]
  const protectedList = `(${protectedStatuses.map((s) => `"${s}"`).join(',')})`

  // contract_billing_items
  const contractUpdate: Record<string, unknown> = { status: targetStatus, updated_at: new Date().toISOString() }
  if (targetStatus === 'paid') contractUpdate.paid_at = timestamp
  else if (targetStatus === 'overdue') contractUpdate.overdue_at = timestamp
  else if (targetStatus === 'sent') contractUpdate.fortnox_sent_at = timestamp
  else if (targetStatus === 'booked') contractUpdate.booked_at = timestamp

  const { data: contractItems } = await supabase
    .from('contract_billing_items')
    .select('id')
    .eq('fortnox_document_number', documentNumber)
    .not('status', 'in', protectedList)

  let contractItemsUpdated = 0
  if (contractItems && contractItems.length > 0) {
    const ids = contractItems.map((i: { id: string }) => i.id)
    await supabase.from('contract_billing_items').update(contractUpdate).in('id', ids)
    contractItemsUpdated = ids.length
  }

  // invoices (privat/företag) — stödjer alla statusar inkl. overdue
  let invoicesUpdated = 0
  {
    const invoiceUpdate: Record<string, unknown> = { status: targetStatus }
    if (targetStatus === 'paid') invoiceUpdate.paid_at = timestamp
    else if (targetStatus === 'sent') invoiceUpdate.sent_at = timestamp
    else if (targetStatus === 'booked') invoiceUpdate.booked_at = timestamp
    else if (targetStatus === 'overdue') invoiceUpdate.overdue_at = timestamp

    const { data: invoiceRows } = await supabase
      .from('invoices')
      .select('id')
      .eq('fortnox_document_number', documentNumber)
      .not('status', 'in', protectedList)

    if (invoiceRows && invoiceRows.length > 0) {
      const ids = invoiceRows.map((i: { id: string }) => i.id)
      await supabase.from('invoices').update(invoiceUpdate).in('id', ids)
      invoicesUpdated = ids.length
    }
  }

  return { documentNumber, fortnoxStatus: targetStatus, invoicesUpdated, contractItemsUpdated }
}

// ─────────────────────────────────────────────────────────────────────
// Polling: hitta fakturor som behöver kollas
// ─────────────────────────────────────────────────────────────────────

interface PendingInvoice {
  fortnox_document_number: string
}

async function findStaleInvoices(): Promise<string[]> {
  // Hämta alla fakturor med Fortnox-koppling som ligger i draft/sent och inte
  // har uppdaterats senaste 30 min. created_at fungerar som approximation
  // eftersom invoices saknar updated_at.
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const docs = new Set<string>()

  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select('fortnox_document_number, created_at')
    .in('status', ['draft', 'sent', 'booked', 'overdue'])
    .not('fortnox_document_number', 'is', null)
    .lt('created_at', cutoff)

  for (const r of (invoiceRows ?? []) as PendingInvoice[]) {
    if (r.fortnox_document_number) docs.add(r.fortnox_document_number)
  }

  // contract_billing_items har updated_at — använd det istället
  const { data: contractRows } = await supabase
    .from('contract_billing_items')
    .select('fortnox_document_number')
    .in('status', ['draft', 'sent', 'booked', 'overdue'])
    .not('fortnox_document_number', 'is', null)
    .lt('updated_at', cutoff)

  for (const r of (contractRows ?? []) as PendingInvoice[]) {
    if (r.fortnox_document_number) docs.add(r.fortnox_document_number)
  }

  return Array.from(docs)
}

// ─────────────────────────────────────────────────────────────────────
// Auth: två vägar — Supabase user-JWT (manuell knapp) eller HMAC (cron)
// ─────────────────────────────────────────────────────────────────────

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Returnera 'cron' om HMAC-signaturen är giltig,
 * 'user' om Supabase user-JWT är giltigt, annars null.
 */
async function authenticate(req: Request, body: string): Promise<'cron' | 'user' | null> {
  // 1. HMAC-cron-auth
  const sig = req.headers.get('X-Cron-Signature')
  const ts = req.headers.get('X-Cron-Timestamp')
  if (sig && ts && CRON_SECRET) {
    const tsNum = Number(ts)
    if (!Number.isFinite(tsNum)) return null
    // Replay-skydd: kräv timestamp inom ±5 min
    const drift = Math.abs(Date.now() - tsNum)
    if (drift > 5 * 60 * 1000) return null
    const expected = await hmacSha256Hex(CRON_SECRET, `${ts}.${body}`)
    if (timingSafeEqual(sig, expected)) return 'cron'
    return null
  }

  // 2. User-JWT-auth
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token) {
    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data.user) return 'user'
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────
// HTTP-handler
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const rawBody = await req.text()
    const authResult = await authenticate(req, rawBody)
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = rawBody ? JSON.parse(rawBody) : {}
    const specificInvoice: string | undefined = body?.invoice_number

    const accessToken = await getValidAccessToken()

    let documentNumbers: string[] = []
    if (specificInvoice) {
      documentNumbers = [String(specificInvoice)]
    } else {
      documentNumbers = await findStaleInvoices()
    }

    const results: SyncResult[] = []
    for (const doc of documentNumbers) {
      try {
        const r = await syncFortnoxInvoice(doc, accessToken)
        results.push(r)
      } catch (err) {
        results.push({
          documentNumber: doc,
          fortnoxStatus: null,
          invoicesUpdated: 0,
          contractItemsUpdated: 0,
          skipped: err instanceof Error ? err.message : 'Okänt fel',
        })
      }
    }

    const summary = {
      mode: specificInvoice ? 'manual' : 'cron',
      auth: authResult,
      checked: results.length,
      updated: results.filter((r) => r.invoicesUpdated + r.contractItemsUpdated > 0).length,
      results,
    }

    console.log(`fortnox-sync: ${summary.mode} (${summary.auth}), checked ${summary.checked}, updated ${summary.updated}`)

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('fortnox-sync error:', message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
