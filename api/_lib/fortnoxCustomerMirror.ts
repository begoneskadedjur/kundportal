// api/_lib/fortnoxCustomerMirror.ts
// Spegel av Fortnox kundregister i tabellen fortnox_customer_numbers.
// Tre lager håller den färsk (docs/kundnummer-fortnox-plan.md):
//   1. Fortnox-webhook på customers (api/fortnox/webhook.ts) → upsertMirrorFromFortnoxCustomer
//   2. Inkrementell synk (lastmodified) före varje allokering och från kundgruppssidan
//   3. Nattlig full synk (api/cron/sync-fortnox-customers.ts) som även markerar raderade
//
// Fortnox-fakta: limit max 500 per sida, filter=active|inactive (ett åt gången),
// lastmodified i formatet "YYYY-MM-DD HH:MM" (svensk tid), rate limit 25 anrop/5 s.
// Listan visar inte raderade kunder, och raderade nummer får aldrig återanvändas,
// därför sätts missing_since i stället för att raden tas bort.

import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from '../fortnox/refresh'
import { orgDigits, parseFortnoxCustomerNumber } from '../../src/shared/fortnoxCustomerNumbers'

const FORTNOX_API = 'https://api.fortnox.se/3'
const PAGE_LIMIT = 500
const INCREMENTAL_OVERLAP_MS = 10 * 60 * 1000

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
)

export interface FortnoxCustomerLike {
  CustomerNumber: string
  Name?: string | null
  OrganisationNumber?: string | null
  Email?: string | null
  City?: string | null
  Active?: boolean | null
  Type?: string | null
  CustomerType?: string | null
}

interface FortnoxCustomerListResponse {
  Customers?: FortnoxCustomerLike[]
  MetaInformation?: { '@TotalPages'?: number; '@TotalResources'?: number }
}

export interface MirrorSyncResult {
  mode: 'full' | 'incremental'
  active: number
  inactive: number
  upserted: number
  missing: number
  pages: number
  since: string | null
}

/** Fortnox lastmodified vill ha svensk lokal tid utan sekunder. */
export function formatFortnoxTimestamp(d: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

async function fortnoxGet<T>(token: string, path: string, retried = false): Promise<T> {
  const res = await fetch(`${FORTNOX_API}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429 && !retried) {
    await new Promise(r => setTimeout(r, 5000))
    return fortnoxGet<T>(token, path, true)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Fortnox ${path} svarade ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export function toMirrorRow(c: FortnoxCustomerLike, active: boolean, seenAt: string) {
  return {
    customer_number: String(c.CustomerNumber),
    numeric_value: parseFortnoxCustomerNumber(c.CustomerNumber),
    name: c.Name ?? null,
    organisation_number: c.OrganisationNumber ?? null,
    org_digits: orgDigits(c.OrganisationNumber),
    active,
    customer_type: c.Type ?? c.CustomerType ?? null,
    email: c.Email ?? null,
    city: c.City ?? null,
    seen_at: seenAt,
    missing_since: null as string | null,
  }
}

async function fetchAll(
  token: string,
  filter: 'active' | 'inactive',
  since: Date | undefined,
  counter: { pages: number }
): Promise<FortnoxCustomerLike[]> {
  const out: FortnoxCustomerLike[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const params = new URLSearchParams({ filter, limit: String(PAGE_LIMIT), page: String(page) })
    if (since) params.set('lastmodified', formatFortnoxTimestamp(since))
    const data = await fortnoxGet<FortnoxCustomerListResponse>(token, `customers?${params.toString()}`)
    counter.pages++
    out.push(...(data.Customers ?? []))
    totalPages = data.MetaInformation?.['@TotalPages'] ?? 1
    page++
  }
  return out
}

async function upsertRows(rows: ReturnType<typeof toMirrorRow>[]): Promise<number> {
  let n = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('fortnox_customer_numbers')
      .upsert(chunk, { onConflict: 'customer_number' })
    if (error) throw new Error(`Kunde inte skriva spegeln: ${error.message}`)
    n += chunk.length
  }
  return n
}

/**
 * Full synk hämtar allt (active + inactive) och markerar rader som inte
 * längre finns i Fortnox som missing_since. Inkrementell synk hämtar bara
 * ändrade sedan vattenstämpeln (minus 10 min överlapp); saknas vattenstämpel
 * blir det en full synk.
 */
export async function syncFortnoxCustomerMirror(mode: 'full' | 'incremental'): Promise<MirrorSyncResult> {
  const syncStart = new Date()
  const seenAt = syncStart.toISOString()
  const counter = { pages: 0 }

  const { data: state } = await supabase
    .from('fortnox_customer_mirror_state')
    .select('watermark')
    .eq('id', 1)
    .maybeSingle()

  let effectiveMode = mode
  let since: Date | undefined
  if (mode === 'incremental') {
    if (state?.watermark) {
      since = new Date(new Date(state.watermark).getTime() - INCREMENTAL_OVERLAP_MS)
    } else {
      effectiveMode = 'full'
    }
  }

  try {
    const token = await getValidAccessToken()
    const active = await fetchAll(token, 'active', since, counter)
    const inactive = await fetchAll(token, 'inactive', since, counter)

    // Samma nummer kan dyka upp i båda listorna vid statusbyte inom överlappet:
    // inaktiv-listan skrivs sist och vinner, vilket är det säkra valet
    // (numret räknas upptaget i båda fallen).
    const rows = new Map<string, ReturnType<typeof toMirrorRow>>()
    for (const c of active) rows.set(String(c.CustomerNumber), toMirrorRow(c, true, seenAt))
    for (const c of inactive) rows.set(String(c.CustomerNumber), toMirrorRow(c, false, seenAt))
    const upserted = await upsertRows([...rows.values()])

    let missing = 0
    if (effectiveMode === 'full') {
      const { data: gone, error } = await supabase
        .from('fortnox_customer_numbers')
        .update({ missing_since: seenAt })
        .lt('seen_at', seenAt)
        .is('missing_since', null)
        .select('customer_number')
      if (error) throw new Error(`Kunde inte markera raderade: ${error.message}`)
      missing = gone?.length ?? 0
    }

    const stateUpdate: Record<string, unknown> = {
      watermark: seenAt,
      last_error: null,
      updated_at: seenAt,
      ...(effectiveMode === 'full'
        ? { last_full_sync_at: seenAt, total_active: active.length, total_inactive: inactive.length }
        : { last_incremental_at: seenAt }),
    }
    await supabase.from('fortnox_customer_mirror_state').update(stateUpdate).eq('id', 1)

    return {
      mode: effectiveMode,
      active: active.length,
      inactive: inactive.length,
      upserted,
      missing,
      pages: counter.pages,
      since: since ? since.toISOString() : null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('fortnox_customer_mirror_state')
      .update({ last_error: message, updated_at: new Date().toISOString() })
      .eq('id', 1)
    throw err
  }
}

/** Skriv in ett fullständigt kundkort (webhook, allokering). */
export async function upsertMirrorFromFortnoxCustomer(customer: FortnoxCustomerLike): Promise<void> {
  const row = toMirrorRow(customer, customer.Active !== false, new Date().toISOString())
  const { error } = await supabase
    .from('fortnox_customer_numbers')
    .upsert(row, { onConflict: 'customer_number' })
  if (error) throw new Error(`Kunde inte uppdatera spegeln: ${error.message}`)
}

/** Kunden finns inte längre i Fortnox (raderad). Numret förblir upptaget. */
export async function markMirrorMissing(customerNumber: string): Promise<void> {
  await supabase
    .from('fortnox_customer_numbers')
    .update({ missing_since: new Date().toISOString() })
    .eq('customer_number', customerNumber)
    .is('missing_since', null)
}

/** Ålder på vattenstämpeln i millisekunder, eller null om spegeln aldrig synkats. */
export async function mirrorAgeMs(): Promise<number | null> {
  const { data } = await supabase
    .from('fortnox_customer_mirror_state')
    .select('watermark')
    .eq('id', 1)
    .maybeSingle()
  if (!data?.watermark) return null
  return Date.now() - new Date(data.watermark).getTime()
}
