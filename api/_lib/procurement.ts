// api/_lib/procurement.ts
// Delad serverlogik för upphandlingsportalen: köpare och leverantörer på
// orgnr, inläsning av annonser med dedup och matchning, tilldelningar,
// källhälsa, notiser och e-post. Används av cron-jobben under
// api/cron/procurement-* och endpoints under api/procurement/.
// Underscore-prefix: exponeras inte som endpoint.
//
// Plan: docs/upphandlingsportal-plan.md (avsnitt 6, 7, 8 och 10)

import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  DEFAULT_WATCH_RULES,
  DIRECT_NOTIFY_SCORE,
  NOTIFY_SCORE,
  SE_COUNTIES,
  annualValueOf,
  awardRelevance,
  buildDedupKey,
  canonicalOrgNumber,
  cleanText,
  computeContractEnd,
  parseDurationText,
  estimateWinProbability,
  normalizeName,
  normalizeOrgNumber,
  normalizeTitle,
  scoreNotice,
  workWindow,
} from '../../src/shared/procurementRules'
import type {
  ProcurementAwardSource,
  ProcurementCriteriaType,
  ProcurementNoticeKind,
  ProcurementSource,
  ProcurementValueKind,
  ProcurementWatchRule,
} from '../../src/types/procurement'
import { requireAuth, type AuthContext } from './auth'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

export const PORTAL_URL = process.env.PORTAL_URL || 'https://kundportal.vercel.app'
/** Den fristående upphandlingsportalen. Alla länkar i procurement-mejl, notiser och sammandrag går hit. */
export const PROCUREMENT_PORTAL_URL = (process.env.PROCUREMENT_PORTAL_URL || 'https://upphandling.begone.se').replace(/\/+$/, '')
/** Avsändare för upphandlingsposten. Domänen måste vara verifierad i Resend. */
export const PROCUREMENT_FROM_EMAIL = process.env.PROCUREMENT_FROM_EMAIL || 'BeGone Upphandling <upphandling@begone.se>'
/** Lokal del och domän för svarsadresser upphandling+bgu-{nr}@{domän} */
export const PROCUREMENT_REPLY_LOCAL = process.env.PROCUREMENT_REPLY_LOCAL || 'upphandling'
export const PROCUREMENT_REPLY_DOMAIN = process.env.PROCUREMENT_REPLY_DOMAIN || 'begone.se'
/** Egen user agent med kontaktadress mot alla externa källor */
export const PROCUREMENT_USER_AGENT =
  process.env.PROCUREMENT_USER_AGENT || 'BeGoneUpphandlingsbevakning/1.0 (+https://begone.se; upphandling@begone.se)'

let client: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  return client
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** fetch med user agent, timeout och exponentiell backoff vid 429/5xx och nätverksfel */
export async function politeFetch(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastErr: unknown = null
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { 'User-Agent': PROCUREMENT_USER_AGENT, Accept: 'application/json, text/html;q=0.9, */*;q=0.5', ...(init.headers ?? {}) },
      })
      clearTimeout(timer)
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`)
        await sleep(1000 * 2 ** i)
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      await sleep(1000 * 2 ** i)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

// ---------------------------------------------------------------------------
// Åtkomst för manuella endpoints: inloggad plus admin eller upphandlingsansvarig

export async function requireProcurementAccess(req: VercelRequest, res: VercelResponse): Promise<AuthContext | null> {
  const auth = await requireAuth(req, res, ['admin', 'koordinator', 'technician', 'säljare', 'customer'])
  if (!auth) return null
  if (auth.isAdmin) return auth
  const { data } = await db().from('profiles').select('is_procurement_manager, is_active').eq('user_id', auth.userId).maybeSingle()
  if (!data?.is_procurement_manager || data.is_active === false) {
    res.status(403).json({ error: 'Upphandlingsportalen kräver att du är upphandlingsansvarig' })
    return null
  }
  return auth
}

// ---------------------------------------------------------------------------
// Köpare och leverantörer

type IdCache = Map<string, string>
const buyerCache: IdCache = new Map()
const supplierCache: IdCache = new Map()

export interface BuyerInput {
  orgNumber?: string | null
  name: string
  nuts?: string[]
  sector?: string | null
}

/** Hittar eller skapar köparen. Orgnr först, annars namn eller alias. Fyller på orgnr och alias. */
export async function upsertBuyer(input: BuyerInput): Promise<string | null> {
  const name = cleanText(input.name)
  if (!name) return null
  const org = normalizeOrgNumber(input.orgNumber)
  const norm = normalizeName(name)
  const cacheKey = org ? `o:${org}` : `n:${norm}`
  const cached = buyerCache.get(cacheKey)
  if (cached) return cached
  const sb = db()

  let row: { id: string; org_number: string | null; name: string; aliases: string[]; county_code: string | null } | null = null
  if (org) {
    const { data } = await sb.from('procurement_buyers').select('id, org_number, name, aliases, county_code').eq('org_number', org).maybeSingle()
    row = data
  }
  if (!row && norm) {
    const { data } = await sb
      .from('procurement_buyers')
      .select('id, org_number, name, aliases, county_code')
      .or(`normalized_name.eq.${JSON.stringify(norm)},aliases.cs.{${JSON.stringify(name)}}`)
      .limit(1)
    // Namnträff med ett annat orgnr är en annan köpare (t.ex. två bolag med samma namn)
    const hit = (data ?? [])[0] ?? null
    if (hit && (!org || !hit.org_number || hit.org_number === org)) row = hit
  }

  const county = (input.nuts ?? []).find((c) => SE_COUNTIES[c]) ?? null
  if (row) {
    const patch: Record<string, unknown> = {}
    if (org && !row.org_number) patch.org_number = org
    if (name !== row.name && !row.aliases.includes(name)) patch.aliases = [...row.aliases, name].slice(-20)
    if (!row.county_code && county) {
      patch.county_code = county
      patch.county_name = SE_COUNTIES[county]
    }
    if (Object.keys(patch).length > 0) await sb.from('procurement_buyers').update(patch).eq('id', row.id)
    buyerCache.set(cacheKey, row.id)
    return row.id
  }

  const { data: created, error } = await sb
    .from('procurement_buyers')
    .insert({
      org_number: org,
      name,
      normalized_name: norm,
      sector: input.sector ?? guessSector(name, org),
      county_code: county,
      county_name: county ? SE_COUNTIES[county] : null,
      nuts_codes: input.nuts ?? [],
    })
    .select('id')
    .single()
  if (error) {
    // Krock på orgnr vid parallell körning: läs om
    if (org) {
      const { data } = await sb.from('procurement_buyers').select('id').eq('org_number', org).maybeSingle()
      if (data) return data.id
    }
    throw error
  }
  buyerCache.set(cacheKey, created.id)
  return created.id
}

/** Grov sektor ur orgnr (212 = kommun, 232 = region) och namn */
export function guessSector(name: string, org: string | null): string | null {
  if (org?.startsWith('212')) return 'kommun'
  if (org?.startsWith('232')) return 'region'
  if (org?.startsWith('202')) return 'stat'
  const n = name.toLowerCase()
  if (n.includes('kommun')) return 'kommun'
  if (n.startsWith('region ') || n.includes('regionen')) return 'region'
  if (/(bostäder|bostad|hem\b|hus\b|fastighet|byggen)/.test(n)) return 'kommunalt bolag'
  return null
}

export interface SupplierInput {
  orgNumber?: string | null
  name: string
}

const orgAliasCache = new Map<string, string>()

/**
 * Leverantörens rätta orgnr: kända felskrivningar i ORG_ALIASES och alias som
 * registrerats i procurement_suppliers.org_aliases slås ihop med leverantören.
 */
export async function resolveSupplierOrg(raw: string | null | undefined): Promise<string | null> {
  const org = canonicalOrgNumber(raw)
  if (!org) return null
  const cached = orgAliasCache.get(org)
  if (cached) return cached
  const { data } = await db().from('procurement_suppliers').select('org_number').contains('org_aliases', [org]).limit(1)
  const target = ((data ?? [])[0]?.org_number as string | undefined) ?? org
  orgAliasCache.set(org, target)
  return target
}

/** Leverantör på orgnr, med namnet som alias när stavningen skiljer. Utan orgnr: namn. */
export async function upsertSupplier(input: SupplierInput): Promise<{ id: string; isBegone: boolean } | null> {
  const name = cleanText(input.name)
  if (!name) return null
  const org = await resolveSupplierOrg(input.orgNumber)
  const norm = normalizeName(name)
  const key = org ? `o:${org}` : `n:${norm}`
  const cached = supplierCache.get(key)
  const sb = db()
  if (cached) {
    const [id, flag] = cached.split('|')
    return { id, isBegone: flag === '1' }
  }
  let row: { id: string; org_number: string | null; name: string; aliases: string[]; is_begone: boolean } | null = null
  if (org) {
    const { data } = await sb.from('procurement_suppliers').select('id, org_number, name, aliases, is_begone').eq('org_number', org).maybeSingle()
    row = data
  }
  if (!row) {
    const { data } = await sb
      .from('procurement_suppliers')
      .select('id, org_number, name, aliases, is_begone')
      .eq('normalized_name', norm)
      .limit(1)
    const hit = (data ?? [])[0] ?? null
    if (hit && (!org || !hit.org_number || hit.org_number === org)) row = hit
  }
  if (row) {
    const patch: Record<string, unknown> = {}
    if (org && !row.org_number) patch.org_number = org
    if (name !== row.name && !row.aliases.includes(name)) patch.aliases = [...row.aliases, name].slice(-20)
    if (Object.keys(patch).length > 0) await sb.from('procurement_suppliers').update(patch).eq('id', row.id)
    supplierCache.set(key, `${row.id}|${row.is_begone ? 1 : 0}`)
    return { id: row.id, isBegone: row.is_begone }
  }
  const { data: created, error } = await sb
    .from('procurement_suppliers')
    .insert({ org_number: org, name, normalized_name: norm })
    .select('id, is_begone')
    .single()
  if (error) {
    if (org) {
      const { data } = await sb.from('procurement_suppliers').select('id, is_begone').eq('org_number', org).maybeSingle()
      if (data) return { id: data.id, isBegone: data.is_begone }
    }
    throw error
  }
  supplierCache.set(key, `${created.id}|0`)
  return { id: created.id, isBegone: false }
}

// ---------------------------------------------------------------------------
// Bevakningsregler

let rulesCache: ProcurementWatchRule[] | null = null
export async function loadWatchRules(): Promise<ProcurementWatchRule[]> {
  if (rulesCache) return rulesCache
  const { data } = await db().from('procurement_watch_rules').select('*').eq('active', true)
  const saved = (data ?? []) as ProcurementWatchRule[]
  // Tom regeltabell: planens standardregler, så att bevakningen aldrig tystnar
  rulesCache = saved.length > 0 ? saved : (DEFAULT_WATCH_RULES as unknown as ProcurementWatchRule[])
  return rulesCache
}

// ---------------------------------------------------------------------------
// Annonser: dedup, matchning, källposter

export interface NoticeCandidate {
  source: ProcurementSource
  sourceId: string
  sourceSub?: string | null
  /** TED-nummer utan nollor, även när posten kommer via Mercell */
  externalRef?: string | null
  url?: string | null
  raw?: unknown
  title: string
  description?: string | null
  buyerName?: string | null
  buyerOrgNumber?: string | null
  cpv: string[]
  nuts: string[]
  countyCodes: string[]
  publishedAt?: string | null
  tenderDeadline?: string | null
  openingAt?: string | null
  estimatedValue?: number | null
  currency?: string | null
  procedureType?: string | null
  isFramework?: boolean | null
  contractStart?: string | null
  contractEnd?: string | null
  renewalMax?: number | null
  durationMonths?: number | null
  criteriaType?: ProcurementCriteriaType | null
  kind: ProcurementNoticeKind
  sourceStatus?: string | null
  platformUrl?: string | null
  documentUrl?: string | null
}

export interface IngestResult {
  noticeId: string
  created: boolean
  score: number
  hard: boolean
  title: string
  buyerName: string | null
}

/**
 * Läser in en källpost: hittar befintlig upphandling i dedupens ordning
 * (källa + käll-id, TED-numret mellan källor, dedup-nyckeln, trigramlikhet),
 * fyller tomma fält utan att skriva över manuella rättningar och sparar
 * källposten. Nya upphandlingar matchas och får en händelse.
 */
export async function ingestNotice(c: NoticeCandidate): Promise<IngestResult> {
  const sb = db()
  const title = cleanText(c.title) || 'Utan titel'
  const buyerName = c.buyerName ? cleanText(c.buyerName) : null
  const buyerId = buyerName ? await upsertBuyer({ orgNumber: c.buyerOrgNumber, name: buyerName, nuts: c.nuts }) : null
  const normalized_title = normalizeTitle(title)
  const dedup_key = buildDedupKey({ buyerOrgNumber: c.buyerOrgNumber, buyerName, title, deadline: c.tenderDeadline })

  let noticeId: string | null = null
  // 1. Samma källpost
  {
    const { data } = await sb.from('procurement_notice_sources').select('notice_id').eq('source', c.source).eq('source_id', c.sourceId).maybeSingle()
    if (data) noticeId = data.notice_id
  }
  // 2. TED-numret, som Mercell bär på sina TED-poster
  if (!noticeId && c.externalRef) {
    const { data } = await sb.from('procurement_notice_sources').select('notice_id').eq('external_ref', c.externalRef).limit(1)
    if (data && data[0]) noticeId = data[0].notice_id
  }
  // 3. Orgnr (eller namn) + titel + sista dag
  if (!noticeId) {
    const { data } = await sb.from('procurement_notices').select('id').eq('dedup_key', dedup_key).limit(1)
    if (data && data[0]) noticeId = data[0].id
  }
  // 4. Reserv: trigram på titel, samma köpare, sista dag inom en dag
  if (!noticeId && buyerId) {
    const { data } = await sb.rpc('procurement_find_similar_notice', {
      p_normalized_title: normalized_title,
      p_buyer_id: buyerId,
      p_deadline: c.tenderDeadline ?? null,
      p_threshold: 0.6,
    })
    const hit = Array.isArray(data) ? data[0] : null
    if (hit?.id) noticeId = hit.id as string
  }
  // 5. Tilldelning utan sista dag: den ursprungliga annonsen hos samma köpare
  if (!noticeId && buyerId && c.kind === 'award') {
    const { data } = await sb.rpc('procurement_find_similar_notice_any', {
      p_normalized_title: normalized_title,
      p_buyer_id: buyerId,
      p_threshold: 0.6,
    })
    const hit = Array.isArray(data) ? data[0] : null
    if (hit?.id) noticeId = hit.id as string
  }

  const rules = await loadWatchRules()
  let created = false
  let score = 0
  let hard = false

  if (noticeId) {
    const { data: cur } = await sb.from('procurement_notices').select('*').eq('id', noticeId).single()
    // Fyll bara tomma fält. Status, ansvarig och rättade fält rörs aldrig.
    const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() }
    const fill = (col: string, val: unknown) => {
      if (val == null || (Array.isArray(val) && val.length === 0)) return
      if (cur[col] == null || (Array.isArray(cur[col]) && cur[col].length === 0)) patch[col] = val
    }
    fill('description', c.description ? cleanText(c.description) : null)
    fill('buyer_id', buyerId)
    fill('buyer_org_number', normalizeOrgNumber(c.buyerOrgNumber))
    fill('published_at', c.publishedAt)
    fill('tender_deadline', c.tenderDeadline)
    fill('opening_at', c.openingAt)
    fill('estimated_value', c.estimatedValue)
    fill('procedure_type', c.procedureType)
    fill('is_framework', c.isFramework)
    fill('contract_start', c.contractStart)
    fill('contract_end', c.contractEnd)
    fill('renewal_max', c.renewalMax)
    fill('duration_months', c.durationMonths)
    fill('criteria_type', c.criteriaType)
    fill('platform_url', c.platformUrl)
    fill('document_url', c.documentUrl)
    // CPV och län slås ihop: källorna kompletterar varandra
    const cpv = Array.from(new Set([...(cur.cpv_codes ?? []), ...c.cpv]))
    const counties = Array.from(new Set([...(cur.county_codes ?? []), ...c.countyCodes]))
    if (cpv.length !== (cur.cpv_codes ?? []).length) patch.cpv_codes = cpv
    if (counties.length !== (cur.county_codes ?? []).length) {
      patch.county_codes = counties
      patch.county_names = counties.map((k) => SE_COUNTIES[k] ?? k)
    }
    // Avbruten eller tilldelad hos källan: följ med
    if (c.sourceStatus && c.sourceStatus !== cur.source_status) patch.source_status = c.sourceStatus
    if (c.sourceStatus === 'Cancelled' && cur.our_status === 'new') patch.our_status = 'cancelled'
    const m = scoreNotice({ title: cur.title, description: (patch.description as string) ?? cur.description, cpv_codes: cpv, county_codes: counties }, rules)
    score = Math.max(m.score, cur.match_score ?? 0)
    hard = m.hard
    if (m.score > (cur.match_score ?? 0)) {
      patch.match_score = m.score
      patch.match_reasons = m.reasons
    }
    await sb.from('procurement_notices').update(patch).eq('id', noticeId)
  } else {
    const counties = c.countyCodes
    const m = scoreNotice({ title, description: c.description ?? null, cpv_codes: c.cpv, county_codes: counties }, rules)
    score = m.score
    hard = m.hard
    const expected = await expectedOtherBids(buyerId)
    const prob = estimateWinProbability({ expectedOtherBids: expected, criteriaType: c.criteriaType ?? null })
    const annual = annualValueOf(c.estimatedValue ?? null, c.durationMonths ?? null)
    const { data: ins, error } = await sb
      .from('procurement_notices')
      .insert({
        title,
        normalized_title,
        description: c.description ? cleanText(c.description) : null,
        buyer_id: buyerId,
        buyer_name: buyerName,
        buyer_org_number: normalizeOrgNumber(c.buyerOrgNumber),
        cpv_codes: c.cpv,
        nuts_codes: c.nuts,
        county_codes: counties,
        county_names: counties.map((k) => SE_COUNTIES[k] ?? k),
        published_at: c.publishedAt ?? null,
        tender_deadline: c.tenderDeadline ?? null,
        opening_at: c.openingAt ?? null,
        estimated_value: c.estimatedValue ?? null,
        value_currency: c.currency ?? 'SEK',
        procedure_type: c.procedureType ?? null,
        is_framework: c.isFramework ?? null,
        contract_start: c.contractStart ?? null,
        contract_end: c.contractEnd ?? null,
        renewal_max: c.renewalMax ?? null,
        duration_months: c.durationMonths ?? null,
        criteria_type: c.criteriaType ?? null,
        notice_kind: c.kind,
        source_status: c.sourceStatus ?? null,
        our_status: c.sourceStatus === 'Cancelled' ? 'cancelled' : 'new',
        platform_url: c.platformUrl ?? null,
        document_url: c.documentUrl ?? null,
        match_score: m.score,
        match_reasons: m.reasons,
        expected_bids: prob.expectedBids,
        win_probability: prob.probability,
        annual_value: annual,
        dedup_key,
      })
      .select('id')
      .single()
    if (error) throw error
    noticeId = ins.id as string
    created = true
    if (m.score >= NOTIFY_SCORE) {
      await sb.from('procurement_events').insert({
        notice_id: noticeId,
        event_type: 'matched',
        title: `Ny träff med ${m.score} poäng`,
        detail: m.reasons.map((r) => r.label).join(' · '),
        metadata: { score: m.score, source: c.source },
        actor_name: 'Bevakningen',
      })
    }
  }

  await sb.from('procurement_notice_sources').upsert(
    {
      notice_id: noticeId,
      source: c.source,
      source_id: c.sourceId,
      source_sub: c.sourceSub ?? null,
      external_ref: c.externalRef ?? null,
      url: c.url ?? null,
      raw: c.raw ?? null,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'source,source_id' }
  )

  return { noticeId: noticeId!, created, score, hard, title, buyerName }
}

/** Genomsnittligt antal anbud hos köparen (alla källor), minus inget: det är ANDRA anbud om vi går in */
export async function expectedOtherBids(buyerId: string | null): Promise<number | null> {
  if (!buyerId) return null
  const { data } = await db().from('procurement_awards').select('bids_received, source_ref').eq('buyer_id', buyerId).not('bids_received', 'is', null)
  const seen = new Map<string, number>()
  for (const r of data ?? []) seen.set(String(r.source_ref ?? Math.random()), Number(r.bids_received))
  const vals = [...seen.values()].filter((n) => n > 0)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ---------------------------------------------------------------------------
// Tilldelningar och anbudsgivare

export interface AwardCandidate {
  source: ProcurementAwardSource
  sourceRef: string
  noticeId?: string | null
  buyerName?: string | null
  buyerOrgNumber?: string | null
  nuts?: string[]
  title?: string | null
  cpv?: string[]
  countyCode?: string | null
  winnerName?: string | null
  winnerOrgNumber?: string | null
  value?: number | null
  valueKind?: ProcurementValueKind
  bidsReceived?: number | null
  lowestBid?: number | null
  highestBid?: number | null
  criteriaType?: string | null
  procedureType?: string | null
  isFramework?: boolean | null
  awardDate?: string | null
  contractSignedDate?: string | null
  contractStart?: string | null
  contractEnd?: string | null
  renewalMax?: number | null
  mercellExpiry?: string | null
  /** Avtalstid i månader utan förlängningar (TED duration-period-value-lot) */
  durationMonths?: number | null
  /** Fritext där avtalstiden kan stå (TED description-lot, Mercell description) */
  durationText?: string | null
  /** Publicering av upphandlingsannonsen, bas när inga avtalsdatum finns */
  tenderPublishedDate?: string | null
  wasAppealed?: boolean | null
  raw?: unknown
}

/** Sparar en tilldelning (en rad per vinnare) med beräknat slut och bearbetningsfönster. Returnerar award-id. */
export async function upsertAward(a: AwardCandidate): Promise<string> {
  const sb = db()
  const buyerId = a.buyerName ? await upsertBuyer({ orgNumber: a.buyerOrgNumber, name: a.buyerName, nuts: a.nuts }) : null
  const supplier = a.winnerName ? await upsertSupplier({ orgNumber: a.winnerOrgNumber, name: a.winnerName }) : null
  const winnerOrg = await resolveSupplierOrg(a.winnerOrgNumber)
  const winnerKey = winnerOrg ?? normalizeName(a.winnerName) ?? 'okand'
  const award_key = `${a.source}:${a.sourceRef}:${winnerKey || 'okand'}`
  const textDuration = a.durationMonths ? null : parseDurationText(a.durationText)
  const end = computeContractEnd({
    tedEnd: a.contractEnd,
    renewalMax: a.renewalMax ?? (textDuration && textDuration.renewalMonths > 0 ? textDuration.renewalMonths / 12 : null),
    mercellExpiry: a.mercellExpiry,
    contractStart: a.contractStart,
    contractSignedDate: a.contractSignedDate,
    awardDate: a.awardDate,
    tenderPublishedDate: a.tenderPublishedDate,
    durationMonths: a.durationMonths ?? textDuration?.months ?? null,
    durationFrom: a.durationMonths ? 'ted' : textDuration ? 'text' : null,
  })
  const win = workWindow(end.date)
  const relevance = awardRelevance(a.cpv ?? [], a.title)

  // Felträffsflaggan sätts automatiskt, utom när en människa har tagit
  // ställning (excluded_at satt utan automatisk orsak): då behålls beslutet.
  const sb0 = db()
  const { data: existing } = await sb0.from('procurement_awards').select('excluded_reason, excluded_at').eq('award_key', award_key).maybeSingle()
  const manual = !!existing?.excluded_at && (!existing.excluded_reason || String(existing.excluded_reason).startsWith('Manuellt'))
  const exclusion = manual
    ? {}
    : { excluded_reason: relevance.relevant ? null : relevance.reason, excluded_at: relevance.relevant ? null : new Date().toISOString() }
  const row = {
    award_key,
    notice_id: a.noticeId ?? null,
    buyer_id: buyerId,
    buyer_name: a.buyerName ? cleanText(a.buyerName) : null,
    title: a.title ? cleanText(a.title) : null,
    cpv_codes: a.cpv ?? [],
    county_code: a.countyCode ?? null,
    source: a.source,
    source_ref: a.sourceRef,
    supplier_id: supplier?.id ?? null,
    winner_org_number: winnerOrg,
    winner_name: a.winnerName ? cleanText(a.winnerName) : null,
    value: a.value ?? null,
    value_kind: a.valueKind ?? 'unknown',
    bids_received: a.bidsReceived ?? null,
    lowest_bid: a.lowestBid ?? null,
    highest_bid: a.highestBid ?? null,
    criteria_type: a.criteriaType ?? null,
    procedure_type: a.procedureType ?? null,
    is_framework: a.isFramework ?? null,
    award_date: a.awardDate ?? null,
    contract_signed_date: a.contractSignedDate ?? null,
    contract_start: a.contractStart ?? null,
    contract_end: a.contractEnd ?? null,
    renewal_max: a.renewalMax ?? null,
    calc_end_date: end.date,
    calc_end_source: end.source,
    start_basis_date: end.startBasis,
    duration_months: a.durationMonths ?? textDuration?.months ?? null,
    calc_basis: end.basis,
    window_start: win.start,
    window_end: win.end,
    was_appealed: a.wasAppealed ?? null,
    raw: a.raw ?? null,
    ...exclusion,
  }
  const { data, error } = await sb.from('procurement_awards').upsert(row, { onConflict: 'award_key' }).select('id').single()
  if (error) throw error
  return data.id as string
}

export interface BidderCandidate {
  source: 'ted' | 'ted_xml' | 'uhm' | 'email' | 'document' | 'manual'
  sourceRef: string
  noticeId?: string | null
  awardId?: string | null
  name: string
  orgNumber?: string | null
  price?: number | null
  score?: number | null
  rank?: number | null
  isWinner: boolean
  documentId?: string | null
  raw?: unknown
}

export async function upsertBidder(b: BidderCandidate): Promise<void> {
  const supplier = await upsertSupplier({ orgNumber: b.orgNumber, name: b.name })
  const org = await resolveSupplierOrg(b.orgNumber)
  const who = org ?? normalizeName(b.name)
  // Handlingar (e-post och uppladdning) om samma upphandling ger samma
  // anbudsgivare: nyckeln är upphandlingen plus orgnr (eller namn), inte
  // dokumentet eller vägen in, så en omkörning uppdaterar raden i stället för
  // att skapa en dubblett. Källorna ted, ted_xml och uhm behåller sin nyckel.
  const isDocument = b.source === 'email' || b.source === 'document'
  const bidder_key = isDocument && b.noticeId ? `handling:${b.noticeId}:${who}` : `${b.source}:${b.sourceRef}:${who}`
  await db()
    .from('procurement_bidders')
    .upsert(
      {
        bidder_key,
        notice_id: b.noticeId ?? null,
        award_id: b.awardId ?? null,
        source_ref: b.sourceRef,
        supplier_id: supplier?.id ?? null,
        org_number: org,
        name: cleanText(b.name),
        price: b.price ?? null,
        score: b.score ?? null,
        rank: b.rank ?? null,
        is_winner: b.isWinner,
        is_begone: supplier?.isBegone ?? false,
        source: b.source,
        document_id: b.documentId ?? null,
        raw: b.raw ?? null,
      },
      { onConflict: 'bidder_key' }
    )
}

/**
 * Efter en synk: län på nya köpare (kommunlistan, regioner, NUTS) och
 * avtalsklockans uppföljning (ny annons, ny tilldelning, slut passerat).
 * Fel loggas men stoppar aldrig synken.
 */
export async function refreshAwardDerivedData(): Promise<{ counties: number | null; followups: unknown }> {
  const sb = db()
  const counties = await sb.rpc('procurement_resolve_buyer_counties')
  if (counties.error) console.warn('[procurement] län på köpare misslyckades', counties.error.message)
  const followups = await sb.rpc('procurement_refresh_award_followups')
  if (followups.error) console.warn('[procurement] avtalsklockans uppföljning misslyckades', followups.error.message)
  return { counties: (counties.data as number | null) ?? null, followups: followups.data ?? null }
}

// ---------------------------------------------------------------------------
// Källhälsa

export async function recordHealth(
  source: string,
  ok: boolean,
  opts: { count?: number; error?: string | null; cursor?: string | null } = {}
): Promise<{ consecutiveFailures: number }> {
  const sb = db()
  const now = new Date().toISOString()
  const { data: cur } = await sb.from('procurement_source_health').select('*').eq('source', source).maybeSingle()
  const failures = ok ? 0 : (cur?.consecutive_failures ?? 0) + 1
  await sb.from('procurement_source_health').upsert(
    {
      source,
      last_run_at: now,
      last_success_at: ok ? now : cur?.last_success_at ?? null,
      last_count: opts.count ?? (ok ? 0 : cur?.last_count ?? null),
      consecutive_failures: failures,
      last_error: ok ? null : opts.error ?? 'Okänt fel',
      cursor: opts.cursor !== undefined ? opts.cursor : cur?.cursor ?? null,
      updated_at: now,
    },
    { onConflict: 'source' }
  )
  // Tre fel i rad: notis till admin (planens avsnitt 6), en gång per felserie
  if (!ok && failures === 3) {
    const { data: admins } = await sb.from('profiles').select('user_id').eq('is_admin', true).eq('is_active', true)
    await insertNotifications(
      (admins ?? []).map((a) => a.user_id as string).filter(Boolean),
      null,
      `Upphandlingskällan ${source} har fallerat tre gånger i rad`,
      opts.error ?? 'Se källhälsan under Upphandlingar, Inställningar.',
      'Källhälsa'
    )
  }
  return { consecutiveFailures: failures }
}

// ---------------------------------------------------------------------------
// Mottagare, notiser och e-post

export interface Manager {
  user_id: string
  email: string
  display_name: string | null
  digest_enabled: boolean
}

/** Alla aktiva upphandlingsansvariga med e-post och sammandragsval */
export async function getManagers(): Promise<Manager[]> {
  const sb = db()
  const { data } = await sb
    .from('profiles')
    .select('user_id, email, display_name')
    .eq('is_procurement_manager', true)
    .eq('is_active', true)
  const users = (data ?? []).filter((p) => p.user_id && p.email)
  if (users.length === 0) return []
  const { data: settings } = await sb.from('procurement_user_settings').select('user_id, digest_enabled').in('user_id', users.map((u) => u.user_id))
  const off = new Set((settings ?? []).filter((s) => s.digest_enabled === false).map((s) => s.user_id))
  return users.map((u) => ({ user_id: u.user_id, email: u.email, display_name: u.display_name, digest_enabled: !off.has(u.user_id) }))
}

/**
 * Notis i notifications. case_type 'procurement': klick öppnar
 * {PROCUREMENT_PORTAL_URL}/{case_id} (adminportalen: /admin/upphandlingar/{case_id}), eller startsidan när case_id saknas.
 */
export async function insertNotifications(
  recipients: string[],
  noticeId: string | null,
  title: string,
  preview: string,
  caseTitle: string
): Promise<number> {
  const unique = Array.from(new Set(recipients.filter(Boolean)))
  if (unique.length === 0) return 0
  const rows = unique.map((id) => ({
    recipient_id: id,
    case_id: noticeId,
    case_type: 'procurement',
    title: title.slice(0, 200),
    preview: preview.slice(0, 500),
    case_title: caseTitle.slice(0, 200),
    sender_id: id,
    sender_name: 'Upphandlingsbevakningen',
    is_read: false,
  }))
  const { error } = await db().from('notifications').insert(rows)
  if (error) throw error
  return rows.length
}

export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

export interface SendEmailInput {
  to: string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string | null
  headers?: Record<string, string>
}

/** Resend. Kastar vid fel. Returnerar Resends meddelande-id. */
export async function sendEmail(input: SendEmailInput): Promise<string | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY saknas')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: input.from ?? PROCUREMENT_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ?? undefined,
      headers: input.headers,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  const json = (await res.json().catch(() => ({}))) as { id?: string }
  return json.id ?? null
}

/** Enkel e-postmall i portalens stil */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:640px;margin:0 auto;padding:24px">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:8px">BeGone Upphandling</div>
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="color:#94a3b8;font-size:11px;margin-top:24px">Skickat från kundportalens upphandlingsbevakning.</p>
</div></body></html>`
}

export function noticeLink(noticeId: string): string {
  return `${PROCUREMENT_PORTAL_URL}/${noticeId}`
}

/**
 * Notiser efter en synk. Nya träffar från 60 poäng blir notis i portalen till
 * alla upphandlingsansvariga; hårda träffar (100) blir dessutom direkt e-post.
 */
export async function notifyNewMatches(results: IngestResult[]): Promise<{ notified: number; emailed: number }> {
  const fresh = results.filter((r) => r.created && r.score >= NOTIFY_SCORE)
  if (fresh.length === 0) return { notified: 0, emailed: 0 }
  const managers = await getManagers()
  if (managers.length === 0) return { notified: 0, emailed: 0 }
  let notified = 0
  let emailed = 0
  for (const r of fresh) {
    const direct = r.score >= DIRECT_NOTIFY_SCORE || r.hard
    notified += await insertNotifications(
      managers.map((m) => m.user_id),
      r.noticeId,
      `${direct ? 'Direktträff' : 'Ny träff'}: ${r.title}`,
      `${r.buyerName ?? 'Okänd köpare'} · ${r.score} poäng`,
      r.buyerName ?? r.title
    )
    if (direct) {
      try {
        await sendEmail({
          to: managers.map((m) => m.email),
          subject: `Ny upphandling: ${r.title}`,
          html: emailLayout(
            r.title,
            `<p style="font-size:14px">${escapeHtml(r.buyerName ?? 'Okänd köpare')} har annonserat en upphandling som träffar skadedjursbekämpning (${r.score} poäng).</p>
             <p><a href="${noticeLink(r.noticeId)}" style="color:#0f766e">Öppna upphandlingen i portalen</a></p>`
          ),
        })
        emailed++
      } catch (err) {
        console.warn('[procurement] direktmejl misslyckades', err)
      }
    }
  }
  return { notified, emailed }
}

/** Svarsadressen för en upphandling: upphandling+bgu-{nr}@domän */
export function replyAddressFor(bguNumber: number | string): string {
  return `${PROCUREMENT_REPLY_LOCAL}+bgu-${bguNumber}@${PROCUREMENT_REPLY_DOMAIN}`
}

// ---------------------------------------------------------------------------
// Webhook-signatur (Resend signerar med Svix)

/**
 * Verifierar en Svix-signerad webhook (Resend). Hemligheten har prefixet
 * whsec_ och resten är base64. Signerat innehåll är `${id}.${timestamp}.${rawBody}`
 * med HMAC-SHA256; headern svix-signature kan bära flera `v1,<base64>` separerade
 * med mellanslag. Tidsstämplar äldre (eller nyare) än toleransen avvisas.
 */
export function verifySvixSignature(
  rawBody: string | Buffer,
  headers: { id: string | undefined; timestamp: string | undefined; signature: string | undefined },
  secret: string,
  opts: { toleranceSec?: number; nowSec?: number } = {}
): { ok: true } | { ok: false; reason: string } {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return { ok: false, reason: 'Signaturheaders saknas' }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Ogiltig tidsstämpel' }
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000)
  const tolerance = opts.toleranceSec ?? 300
  if (Math.abs(now - ts) > tolerance) return { ok: false, reason: 'Tidsstämpeln ligger utanför toleransen' }
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  if (key.length === 0) return { ok: false, reason: 'Ogiltig hemlighet' }
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  for (const entry of signature.split(' ')) {
    const [version, sig] = entry.split(',', 2)
    if (version !== 'v1' || !sig) continue
    const got = Buffer.from(sig, 'base64')
    if (got.length === expected.length && timingSafeEqual(got, expected)) return { ok: true }
  }
  return { ok: false, reason: 'Signaturen stämmer inte' }
}

/**
 * Notis när en tilldelning kommer in på en upphandling vi lämnat anbud på
 * (planens avsnitt 10), med vinnare och antal anbud. En gång per upphandling.
 */
export async function notifyAwardOnOurBid(noticeId: string, winners: string, bidsReceived: number | null): Promise<boolean> {
  const sb = db()
  const { data: notice } = await sb.from('procurement_notices').select('id, title, buyer_name, our_status, owner_id').eq('id', noticeId).maybeSingle()
  if (!notice) return false
  const { data: bids } = await sb.from('procurement_bids').select('id').eq('notice_id', noticeId).not('submitted_price', 'is', null).limit(1)
  const weBid = ['submitted', 'won', 'lost'].includes(notice.our_status) || (bids ?? []).length > 0
  if (!weBid) return false
  const { data: already } = await sb.from('procurement_events').select('id').eq('notice_id', noticeId).eq('event_type', 'award_notified').limit(1)
  if ((already ?? []).length > 0) return false

  const recipients = notice.owner_id ? [notice.owner_id as string] : (await getManagers()).map((m) => m.user_id)
  const detail = `Vinnare: ${winners || 'okänd'}${bidsReceived != null ? ` · ${bidsReceived} anbud` : ''}`
  await insertNotifications(recipients, noticeId, `Tilldelning: ${notice.title}`, detail, notice.buyer_name ?? notice.title)
  await sb.from('procurement_events').insert({
    notice_id: noticeId,
    event_type: 'award_notified',
    title: 'Tilldelning inkommen',
    detail,
    metadata: { winners, bids_received: bidsReceived },
    actor_name: 'Bevakningen',
  })
  return true
}

/** Timmen just nu i svensk tid (0 till 23). Vercel-cron går i UTC. */
export function swedishHour(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', hour12: false }).format(date))
}

/** Veckodag i svensk tid, 1 = måndag ... 7 = söndag */
export function swedishWeekday(date = new Date()): number {
  const w = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(date)
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[w] ?? 1
}

/** Mottagare för en upphandling: ansvarig om satt, annars alla upphandlingsansvariga */
export async function recipientsFor(ownerId: string | null): Promise<Manager[]> {
  const managers = await getManagers()
  if (ownerId) {
    const owner = managers.find((m) => m.user_id === ownerId)
    if (owner) return [owner]
    const { data } = await db().from('profiles').select('user_id, email, display_name').eq('user_id', ownerId).maybeSingle()
    if (data?.email) return [{ user_id: data.user_id, email: data.email, display_name: data.display_name, digest_enabled: true }]
  }
  return managers
}
