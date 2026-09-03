// api/fortnox/allocate-customer.ts
// Ger en portalkund (engångskund) sitt Fortnox-kundnummer vid "Till Fortnox"
// (docs/kundnummer-fortnox-plan.md, fas 4).
//
// Ordning:
//  1. Kundraden har redan nummer → klart (sätt bara invoices.customer_id).
//  2. Inkrementell synk av spegeln om vattenstämpeln är äldre än 10 min.
//  3. Sök spegeln på org-/personnummer. Exakt en aktiv träff → adoptera numret.
//     Flera aktiva, eller bara inaktiva → returnera kandidater, koordinatorn
//     väljer i modalen (beslut 2026-09-03: aldrig auto-val).
//  4. Ingen träff → nästa lediga nummer i gruppens intervall (max i spegel +
//     portal + räknare, plus ett) och POST till Fortnox. Dubblettkod 2000637
//     ("används redan / raderat") → nästa nummer, max 5 försök.
//  5. Skriv tillbaka: customers.customer_number, customer_group_id,
//     invoices.customer_id, spegeln och gruppens räknare.
//
// POST body: {
//   customerId: string            portalens customers.id
//   invoiceId?: string            sätter invoices.customer_id
//   groupId?: string              kundgrupp (annars kundradens, annars privatgruppen)
//   chosenCustomerNumber?: string kandidat koordinatorn valde
//   reactivate?: boolean          vald kandidat är inaktiv → PUT Active=true
//   forceNew?: boolean            hoppa över adoption, skapa ny kund
//   ourReference?: string         teknikerns namn på kundkortet
// }

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../_lib/auth'
import { getValidAccessToken } from './refresh'
import {
  mirrorAgeMs,
  syncFortnoxCustomerMirror,
  upsertMirrorFromFortnoxCustomer,
  type FortnoxCustomerLike,
} from '../_lib/fortnoxCustomerMirror'
import {
  buildFortnoxCustomerCard,
  decideCandidate,
  fortnoxErrorMessage,
  isFortnoxDuplicateCustomerError,
  isPersonnummer,
  nextFreeNumber,
  orgDigits,
  parseFortnoxCustomerNumber,
  type FortnoxMirrorHit,
} from '../../src/shared/fortnoxCustomerNumbers'

const FORTNOX_API = 'https://api.fortnox.se/3'
const MIRROR_MAX_AGE_MS = 10 * 60 * 1000
const MAX_CREATE_ATTEMPTS = 5

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!
)

interface CustomerRow {
  id: string
  customer_number: number | null
  company_name: string
  organization_number: string | null
  billing_email: string | null
  contact_email: string | null
  billing_address: string | null
  contact_address: string | null
  contact_phone: string | null
  customer_group_id: string | null
  parent_customer_id: string | null
}

interface GroupRow {
  id: string
  name: string
  series_start: number
  series_end: number
  current_counter: number
  is_private_default: boolean
}

async function fortnoxCall<T>(
  token: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${FORTNOX_API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => null)) as T | null
  return { ok: res.ok, status: res.status, data }
}

async function resolveGroup(customer: CustomerRow, groupId: string | undefined): Promise<GroupRow | null> {
  const select = 'id, name, series_start, series_end, current_counter, is_private_default'
  const byId = groupId || customer.customer_group_id
  if (byId) {
    const { data } = await supabase.from('customer_groups').select(select).eq('id', byId).maybeSingle()
    if (data) return data as GroupRow
  }
  if (isPersonnummer(customer.organization_number)) {
    const { data } = await supabase
      .from('customer_groups')
      .select(select)
      .eq('is_private_default', true)
      .eq('is_active', true)
      .maybeSingle()
    if (data) return data as GroupRow
  }
  return null
}

/** Skriv tillbaka numret till portalen. Hanterar unik-krock (23505). */
async function writeBack(params: {
  customer: CustomerRow
  group: GroupRow | null
  invoiceId?: string
  customerNumber: number
}): Promise<{ holderCustomerId: string; conflict: boolean }> {
  const { customer, group, invoiceId, customerNumber } = params
  const update: Record<string, unknown> = { customer_number: customerNumber }
  if (!customer.customer_group_id && group) update.customer_group_id = group.id
  const { error } = await supabase.from('customers').update(update).eq('id', customer.id)

  let holderCustomerId = customer.id
  let conflict = false
  if (error) {
    if (error.code !== '23505') throw new Error(`Kunde inte spara kundnumret: ${error.message}`)
    // En annan portalrad bär redan numret (t.ex. samma bolag som avtalskund).
    // Fakturan pekas om till den raden; engångsraden lämnas utan nummer.
    const { data: holder } = await supabase
      .from('customers')
      .select('id')
      .eq('customer_number', customerNumber)
      .maybeSingle()
    if (!holder) throw new Error(`Kundnummer ${customerNumber} är upptaget i portalen av en okänd rad`)
    holderCustomerId = holder.id
    conflict = true
    console.warn(`[allocate-customer] 23505: nummer ${customerNumber} bärs av ${holder.id}, fakturan pekas dit`)
  }

  if (invoiceId) {
    await supabase.from('invoices').update({ customer_id: holderCustomerId }).eq('id', invoiceId)
  }
  return { holderCustomerId, conflict }
}

async function bumpGroupCounter(group: GroupRow | null, customerNumber: number): Promise<void> {
  if (!group) return
  if (customerNumber < group.series_start || customerNumber > group.series_end) return
  if (group.current_counter >= customerNumber) return
  await supabase
    .from('customer_groups')
    .update({ current_counter: customerNumber, updated_at: new Date().toISOString() })
    .eq('id', group.id)
    .lt('current_counter', customerNumber)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = await requireAuth(req, res, ['admin', 'koordinator'])
  if (!auth) return

  const {
    customerId,
    invoiceId,
    groupId,
    chosenCustomerNumber,
    reactivate,
    forceNew,
    ourReference,
  } = (req.body ?? {}) as {
    customerId?: string
    invoiceId?: string
    groupId?: string
    chosenCustomerNumber?: string
    reactivate?: boolean
    forceNew?: boolean
    ourReference?: string
  }
  if (!customerId) return res.status(400).json({ error: 'customerId saknas' })

  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('id, customer_number, company_name, organization_number, billing_email, contact_email, billing_address, contact_address, contact_phone, customer_group_id, parent_customer_id')
    .eq('id', customerId)
    .maybeSingle()
  if (customerError || !customerData) {
    return res.status(404).json({ error: 'Kundraden hittades inte' })
  }
  const customer = customerData as CustomerRow

  // 1. Redan numrerad
  if (customer.customer_number) {
    if (invoiceId) await supabase.from('invoices').update({ customer_id: customer.id }).eq('id', invoiceId)
    return res.status(200).json({ status: 'existing', customerNumber: String(customer.customer_number) })
  }

  const group = await resolveGroup(customer, groupId)
  const isPrivate = isPersonnummer(customer.organization_number)
  if (!group && !isPrivate) {
    return res.status(400).json({ error: 'Kundgrupp saknas. Sätt kundgrupp på ärendet eller kundkortet innan fakturan skickas till Fortnox.' })
  }
  if (!isPrivate && !customer.organization_number) {
    return res.status(400).json({ error: 'Organisationsnummer saknas på kunden. Krävs för att lägga upp kunden i Fortnox.' })
  }

  // 2. Färsk spegel
  const warnings: string[] = []
  try {
    const age = await mirrorAgeMs()
    if (age == null || age > MIRROR_MAX_AGE_MS) await syncFortnoxCustomerMirror('incremental')
  } catch (err) {
    warnings.push(`Spegeln kunde inte uppdateras: ${err instanceof Error ? err.message : 'okänt fel'}`)
  }

  let token: string
  try {
    token = await getValidAccessToken()
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Fortnox ej ansluten' })
  }

  const range = group ? { start: group.series_start, end: group.series_end } : null

  // 3. Identitet: finns kunden redan i Fortnox?
  const digits = orgDigits(customer.organization_number)
  let hits: FortnoxMirrorHit[] = []
  if (digits) {
    const { data } = await supabase
      .from('fortnox_customer_numbers')
      .select('customer_number, numeric_value, name, organisation_number, active, missing_since')
      .eq('org_digits', digits)
    hits = (data ?? []) as FortnoxMirrorHit[]
  }

  if (!forceNew) {
    let adopt: FortnoxMirrorHit | null = null
    if (chosenCustomerNumber) {
      adopt = hits.find(h => h.customer_number === String(chosenCustomerNumber) && !h.missing_since) ?? null
      if (!adopt) return res.status(400).json({ error: 'Valt kundnummer matchar inte kundens org.nr i Fortnox-spegeln' })
    } else {
      const decision = decideCandidate(hits, range)
      if (decision.kind === 'single') adopt = decision.hit
      if (decision.kind === 'multiple' || decision.kind === 'inactive-only') {
        return res.status(200).json({
          status: 'candidates',
          kind: decision.kind,
          candidates: decision.candidates,
          warnings,
        })
      }
    }

    if (adopt) {
      const numeric = parseFortnoxCustomerNumber(adopt.customer_number)
      if (numeric == null) {
        return res.status(409).json({
          error: `Fortnox-kunden ${adopt.name ?? ''} har kundnummer "${adopt.customer_number}" som inte är numeriskt. Koppla kunden manuellt på kundkortet.`,
        })
      }
      if (!adopt.active) {
        if (!reactivate) {
          return res.status(200).json({
            status: 'candidates',
            kind: 'inactive-only',
            candidates: [adopt],
            warnings,
          })
        }
        const put = await fortnoxCall<{ Customer: FortnoxCustomerLike }>(token, 'PUT', `customers/${encodeURIComponent(adopt.customer_number)}`, {
          Customer: { Active: true },
        })
        if (!put.ok) {
          return res.status(502).json({ error: `Kunde inte återaktivera Fortnox-kund ${adopt.customer_number}: ${fortnoxErrorMessage(put.data)}` })
        }
        if (put.data?.Customer) await upsertMirrorFromFortnoxCustomer(put.data.Customer)
      }
      const wb = await writeBack({ customer, group, invoiceId, customerNumber: numeric })
      await bumpGroupCounter(group, numeric)
      return res.status(200).json({
        status: wb.conflict ? 'conflict-adopted' : 'reused',
        customerNumber: adopt.customer_number,
        fortnoxName: adopt.name,
        holderCustomerId: wb.holderCustomerId,
        outsideGroup: !!range && (numeric < range.start || numeric > range.end),
        warnings,
      })
    }
  }

  // 4. Skapa ny kund med nästa lediga nummer i intervallet
  if (!group) {
    return res.status(400).json({ error: 'Ingen privatkundsgrupp (is_private_default) är konfigurerad' })
  }
  const [{ data: mirrorRows }, { data: portalRows }] = await Promise.all([
    supabase
      .from('fortnox_customer_numbers')
      .select('numeric_value')
      .gte('numeric_value', group.series_start)
      .lte('numeric_value', group.series_end),
    supabase
      .from('customers')
      .select('customer_number')
      .gte('customer_number', group.series_start)
      .lte('customer_number', group.series_end),
  ])
  const taken = [
    ...((mirrorRows ?? []) as { numeric_value: number | null }[]).map(r => r.numeric_value),
    ...((portalRows ?? []) as { customer_number: number | null }[]).map(r => r.customer_number),
  ]

  const { card, orgNrSkipped } = buildFortnoxCustomerCard({
    name: customer.company_name,
    organization_number: customer.organization_number,
    billing_email: customer.billing_email || customer.contact_email || null,
    billing_address: customer.billing_address || customer.contact_address || null,
    phone: customer.contact_phone,
    customer_type: isPrivate ? 'PRIVATE' : 'COMPANY',
    terms_of_payment: isPrivate ? '10' : null,
    show_price_vat_included: isPrivate ? true : undefined,
    our_reference: ourReference || null,
  })
  if (orgNrSkipped) warnings.push('Org-/personnumret validerar inte (Luhn) och utelämnades på Fortnox-kortet. Komplettera i Fortnox.')

  let candidate = nextFreeNumber({
    seriesStart: group.series_start,
    seriesEnd: group.series_end,
    taken,
    floor: group.current_counter,
  })
  let created: FortnoxCustomerLike | null = null
  let lastError = ''
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS && candidate != null; attempt++) {
    const post = await fortnoxCall<{ Customer: FortnoxCustomerLike }>(token, 'POST', 'customers', {
      Customer: { CustomerNumber: String(candidate), ...card },
    })
    if (post.ok && post.data?.Customer) {
      created = post.data.Customer
      break
    }
    if (post.status === 429) {
      await new Promise(r => setTimeout(r, 5000))
      continue
    }
    if (isFortnoxDuplicateCustomerError(post.data)) {
      // Numret är taget (eller raderat) i Fortnox utan att spegeln visste: nästa
      candidate = candidate + 1 > group.series_end ? null : candidate + 1
      continue
    }
    lastError = fortnoxErrorMessage(post.data, `HTTP ${post.status}`)
    break
  }

  if (!created) {
    if (candidate == null) {
      return res.status(409).json({ error: `Serien ${group.series_start}-${group.series_end} (${group.name}) är full i Fortnox` })
    }
    return res.status(502).json({
      error: lastError || 'Fortnox-serien har hoppat flera steg. Synka spegeln (Kundgrupper → Uppdatera nu) och försök igen.',
    })
  }

  const numeric = parseFortnoxCustomerNumber(created.CustomerNumber)
  if (numeric == null) {
    return res.status(502).json({ error: `Fortnox gav kundnummer "${created.CustomerNumber}" som inte är numeriskt` })
  }
  await upsertMirrorFromFortnoxCustomer(created)
  const wb = await writeBack({ customer, group, invoiceId, customerNumber: numeric })
  await bumpGroupCounter(group, numeric)

  return res.status(200).json({
    status: wb.conflict ? 'conflict-adopted' : 'created',
    customerNumber: created.CustomerNumber,
    fortnoxName: created.Name ?? customer.company_name,
    holderCustomerId: wb.holderCustomerId,
    groupName: group.name,
    warnings,
  })
}
