// scripts/lib/procurementImportShared.mjs
// Delad kod för importskripten scripts/import-uhm-procurements.mjs och
// scripts/import-ted-history.mjs.
//
// VIKTIGT: avsnittet "Regler" nedan speglar src/shared/procurementRules.ts
// (normalizeOrgNumber, cleanText, normalizeName, normalizeTitle,
// normalizeTedNumber, tedDate, addMonthsIso, swedishDate, computeContractEnd,
// workWindow, SE_COUNTIES, countiesFromNuts) och guessSector ur
// api/_lib/procurement.ts. Skripten är ren .mjs utan ts-loader och kan inte
// importera .ts-filerna. Ändras originalen måste kopiorna här ändras på samma
// sätt, annars får importen andra award_key/bidder_key än synken och raderna
// dedupas inte mot varandra.
//
// Resten av modulen är infrastruktur: miljövariabler, flaggor, artig hämtning
// och ett register för köpare och leverantörer som gör samma sak som
// upsertBuyer/upsertSupplier/upsertAward/upsertBidder i api/_lib/procurement.ts
// men i satser om 200 rader.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DATA_DIR = resolve(REPO_ROOT, 'scripts', 'data', 'procurement')
export const USER_AGENT = 'BeGoneUpphandlingsbevakning/1.0 (+https://begone.se; upphandling@begone.se)'
export const BEGONE_ORG = '5593789208'
export const BATCH = 200

// ===========================================================================
// Regler (spegel av src/shared/procurementRules.ts, håll i synk)

/** Tio siffror utan bindestreck. 12-siffriga (16 + orgnr) kortas. Null om det inte ser ut som ett orgnr. */
export function normalizeOrgNumber(raw) {
  if (!raw) return null
  let d = String(raw).replace(/\D/g, '')
  if (d.length === 12 && (d.startsWith('16') || d.startsWith('19') || d.startsWith('20'))) d = d.slice(2)
  return d.length === 10 ? d : null
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<\/?em[^>]*>/gi, '')
}

/** Rensar HTML-entiteter och Mercells markering, trimmar. För visning. */
export function cleanText(s) {
  return decodeEntities(String(s ?? '')).replace(/\s+/g, ' ').trim()
}

const COMPANY_NOISE = /\b(aktiebolag|ab|publ|hb|kb|ek för|ekonomisk förening|i likvidation)\b/g

/** Företagsnamn för jämförelse: gemener, utan bolagsform, skiljetecken och "och"/"&". */
export function normalizeName(name) {
  return decodeEntities(String(name ?? ''))
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[&+]/g, ' ')
    .replace(/\boch\b/g, ' ')
    .replace(/[^a-z0-9åäöéü ]+/g, ' ')
    .replace(COMPANY_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Titel för dedup och trigramlikhet: gemener, bara bokstäver och siffror. */
export function normalizeTitle(title) {
  return decodeEntities(String(title ?? ''))
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/[^a-z0-9åäöéü ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** TED-publiceringsnummer utan inledande nollor: 00657962-2026 -> 657962-2026 */
export function normalizeTedNumber(raw) {
  if (!raw) return null
  const m = String(raw).trim().match(/^0*(\d+)-(\d{4})$/)
  return m ? `${m[1]}-${m[2]}` : null
}

const SE_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' })

/** ÅÅÅÅ-MM-DD för ett ögonblick, räknat i svensk tid */
export function swedishDate(value) {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return SE_DATE.format(d)
}

/** Lägg till månader på ett ÅÅÅÅ-MM-DD, sista dagen i månaden om dagen saknas */
export function addMonthsIso(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** TED skriver datum som 2026-09-09Z eller 2026-06-18+02:00. Plockar ut kalenderdatumet. */
export function tedDate(raw) {
  if (!raw) return null
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

export const SE_COUNTIES = {
  SE110: 'Stockholms län',
  SE121: 'Uppsala län',
  SE122: 'Södermanlands län',
  SE123: 'Östergötlands län',
  SE124: 'Örebro län',
  SE125: 'Västmanlands län',
  SE211: 'Jönköpings län',
  SE212: 'Kronobergs län',
  SE213: 'Kalmar län',
  SE214: 'Gotlands län',
  SE221: 'Blekinge län',
  SE224: 'Skåne län',
  SE231: 'Hallands län',
  SE232: 'Västra Götalands län',
  SE311: 'Värmlands län',
  SE312: 'Dalarnas län',
  SE313: 'Gävleborgs län',
  SE321: 'Västernorrlands län',
  SE322: 'Jämtlands län',
  SE331: 'Västerbottens län',
  SE332: 'Norrbottens län',
}

/** Unika NUTS3-koder för Sverige ur en blandad lista (SE110, SWE, SE1 ...) */
export function countiesFromNuts(codes) {
  const out = new Set()
  for (const c of codes) {
    const code = String(c ?? '').toUpperCase().trim()
    if (SE_COUNTIES[code]) out.add(code)
  }
  return [...out]
}

export const RENEWAL_YEARS_EACH = 1

/** Beräknat avtalsslut i planens ordning: TED + förlängningar, Mercell, två plus två år. */
export function computeContractEnd(input) {
  const ted = tedDate(input.tedEnd)
  if (ted) {
    const renewals = Math.max(0, Number(input.renewalMax ?? 0) || 0)
    if (renewals > 0) return { date: addMonthsIso(ted, renewals * 12 * RENEWAL_YEARS_EACH), source: 'ted_end_plus_renewals' }
    return { date: ted, source: 'ted_end' }
  }
  const mercell = input.mercellExpiry ? swedishDate(input.mercellExpiry) : null
  if (mercell) return { date: mercell, source: 'mercell_expiry' }
  const base = tedDate(input.startOrAwardDate)
  if (base) return { date: addMonthsIso(base, 48), source: 'assumption_2_2' }
  return { date: null, source: null }
}

/** Bearbetningsfönstret: 18 till 12 månader före slutdatum */
export function workWindow(endDate) {
  if (!endDate) return { start: null, end: null }
  return { start: addMonthsIso(endDate, -18), end: addMonthsIso(endDate, -12) }
}

/** Grov sektor ur orgnr (212 = kommun, 232 = region) och namn. Spegel av guessSector i api/_lib/procurement.ts */
export function guessSector(name, org) {
  if (org?.startsWith('212')) return 'kommun'
  if (org?.startsWith('232')) return 'region'
  if (org?.startsWith('202')) return 'stat'
  const n = name.toLowerCase()
  if (n.includes('kommun')) return 'kommun'
  if (n.startsWith('region ') || n.includes('regionen')) return 'region'
  if (/(bostäder|bostad|hem\b|hus\b|fastighet|byggen)/.test(n)) return 'kommunalt bolag'
  return null
}

// ===========================================================================
// Nycklar, samma form som upsertAward och upsertBidder

export function awardKey(source, sourceRef, winnerOrg, winnerName) {
  const winnerKey = normalizeOrgNumber(winnerOrg) ?? normalizeName(winnerName) ?? 'okand'
  return `${source}:${sourceRef}:${winnerKey || 'okand'}`
}

export function bidderKey(source, sourceRef, org, name) {
  const who = normalizeOrgNumber(org) ?? normalizeName(name)
  return `${source}:${sourceRef}:${who}`
}

// ===========================================================================
// Urval: skadedjur och inte annan sanering

/** Ord som gör en post på bred eller närliggande CPV (90920000, 909 ...) relevant */
export const PEST_WORDS =
  /skadedjur|skadeinsekt|råtta|råttor|råttbekämp|gnagare|möss|kackerlack|vägglöss|insektsbekämp|fågelsäkr|fågelskydd|duvor|getingar|myror|mygg|pest control|pest-control|rodent/i
/** Ord som gör den ointressant trots allt (brand-, fukt-, mark- och industrisanering) */
export const NEGATIVE_WORDS = /asbest|pcb|marksaner|radon|rivning|fukt|mögel|klotter|brandsaner|industrisaner|avfukt|förorenad|efterbehandling/i

/**
 * TED: specifik skadedjurs-CPV (90921000 till 90924000) räcker. Bara den breda
 * 90920000 (Sanering av anläggningar) kräver ett skadedjursord i titeln och
 * inget negativt ord, annars följer mark-, brand- och fuktsanering med.
 */
export function isPestRelevant(cpvCodes, title) {
  const codes = (cpvCodes ?? []).map((c) => String(c).replace(/\D/g, ''))
  if (codes.some((c) => /^9092[1-9]/.test(c))) return true
  const t = String(title ?? '')
  return PEST_WORDS.test(t) && !NEGATIVE_WORDS.test(t)
}

// ===========================================================================
// Små hjälpare

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function uniq(list) {
  return [...new Set(list.filter((x) => x != null && x !== ''))]
}

export function chunk(list, size = BATCH) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Tal ur text, null för tomt, noll och "Uppgift saknas" */
export function positiveNumber(raw) {
  if (raw == null || raw === '') return null
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function fmtKr(n) {
  if (n == null) return '-'
  return `${(n / 1e6).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mkr`
}

export function pct(part, total) {
  if (!total) return '-'
  return `${((100 * part) / total).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

/**
 * Namn i versaler (UHM skriver "NJUDUNG ENERGI VETLANDA AB") blir läsbara:
 * "Njudung Energi Vetlanda AB". Påverkar inte dedup, som går på orgnr och
 * normaliserat namn i gemener.
 */
export function prettifyUpperName(raw) {
  const name = cleanText(raw)
  if (!name || /[a-zåäöéü]/.test(name)) return name
  const keepUpper = new Set(['AB', 'HB', 'KB', 'AB)', '(PUBL)', 'VA', 'IT', 'SKB', 'SLL'])
  const lower = new Set(['kommun', 'stad', 'län', 'och', 'i', 'på', 'för', 'av', 'med', 'till'])
  return name
    .split(' ')
    .map((w, i) => {
      if (keepUpper.has(w)) return w
      const lw = w.toLowerCase()
      if (i > 0 && lower.has(lw)) return lw
      return lw.replace(/(^|[-/(])([a-zåäöéü])/g, (_m, p, c) => p + c.toUpperCase())
    })
    .join(' ')
}

// ===========================================================================
// Flaggor och miljö

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { dryRun: false, fixtures: false, limit: null, rest: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--fixtures') out.fixtures = true
    else if (a === '--limit') out.limit = Number(argv[++i])
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice(8))
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) out.rest[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out.rest[k] = argv[++i]
      else out.rest[k] = true
    }
  }
  if (out.limit != null && !(out.limit > 0)) throw new Error('--limit kräver ett positivt tal')
  return out
}

/** Läser .env och .env.local i repots rot utan att skriva över redan satta variabler */
export function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const p = resolve(REPO_ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (process.env[m[1]] === undefined) process.env[m[1]] = v
    }
  }
}

/** Supabase-klient med service role. Null i torrkörning. */
export async function connect(dryRun) {
  if (dryRun) return null
  loadEnvFiles()
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL och SUPABASE_SERVICE_KEY (eller SUPABASE_SERVICE_ROLE_KEY) saknas. Kör med --dry-run eller lägg nyckeln i .env.')
  }
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ===========================================================================
// Artig hämtning: egen user agent, högst ett anrop per sekund, backoff

let lastCallAt = 0

export async function politeFetch(url, init = {}, attempts = 4) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    const wait = lastCallAt + 1000 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCallAt = Date.now()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 120000)
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/xml;q=0.9, */*;q=0.5', ...(init.headers ?? {}) },
      })
      clearTimeout(timer)
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} från ${url}`)
        await sleep(2000 * 2 ** i)
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      await sleep(2000 * 2 ** i)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

// ===========================================================================
// Register för köpare och leverantörer (samma logik som upsertBuyer och
// upsertSupplier, men allt i minnet och skrivet i satser)

async function selectAll(sb, table, columns) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

export class EntityRegistry {
  /** kind: 'buyer' eller 'supplier' */
  constructor(kind) {
    this.kind = kind
    this.table = kind === 'buyer' ? 'procurement_buyers' : 'procurement_suppliers'
    this.all = []
    this.byOrg = new Map()
    this.byNorm = new Map()
    this.byAlias = new Map()
  }

  index(e) {
    if (e.org_number) this.byOrg.set(e.org_number, e)
    if (e.normalized_name && !this.byNorm.has(e.normalized_name)) this.byNorm.set(e.normalized_name, e)
    for (const a of e.aliases ?? []) if (!this.byAlias.has(a)) this.byAlias.set(a, e)
  }

  async load(sb) {
    if (!sb) return
    const cols =
      this.kind === 'buyer'
        ? 'id, org_number, name, normalized_name, aliases, county_code, county_name, sector'
        : 'id, org_number, name, normalized_name, aliases, is_begone'
    for (const row of await selectAll(sb, this.table, cols)) {
      const e = { ...row, aliases: row.aliases ?? [], _new: false, _patch: {} }
      this.all.push(e)
      this.index(e)
    }
  }

  /** Köpare: { orgNumber, name, nuts, sector }. Leverantör: { orgNumber, name }. */
  resolve(input) {
    const name = cleanText(input.name)
    if (!name) return null
    const org = normalizeOrgNumber(input.orgNumber)
    const norm = normalizeName(name)
    let row = org ? this.byOrg.get(org) ?? null : null
    if (!row && norm) {
      // Köpare: normaliserat namn eller alias. Leverantör: bara normaliserat namn.
      const hit = this.byNorm.get(norm) ?? (this.kind === 'buyer' ? this.byAlias.get(name) : null) ?? null
      if (hit && (!org || !hit.org_number || hit.org_number === org)) row = hit
    }
    const county = this.kind === 'buyer' ? (input.nuts ?? []).find((c) => SE_COUNTIES[c]) ?? null : null

    if (row) {
      if (org && !row.org_number) {
        row.org_number = org
        row._patch.org_number = org
        this.byOrg.set(org, row)
      }
      if (name !== row.name && !row.aliases.includes(name)) {
        row.aliases = [...row.aliases, name].slice(-20)
        row._patch.aliases = row.aliases
        if (!this.byAlias.has(name)) this.byAlias.set(name, row)
      }
      if (this.kind === 'buyer') {
        if (!row.county_code && county) {
          row.county_code = county
          row.county_name = SE_COUNTIES[county]
          row._patch.county_code = county
          row._patch.county_name = SE_COUNTIES[county]
        }
        // Tillägg mot upsertBuyer: UHM:s sektor fyller en tom sektor
        if (!row.sector && input.sector) {
          row.sector = input.sector
          row._patch.sector = input.sector
        }
      }
      return row
    }

    const e =
      this.kind === 'buyer'
        ? {
            id: null,
            org_number: org,
            name,
            normalized_name: norm,
            aliases: [],
            sector: input.sector ?? guessSector(name, org),
            county_code: county,
            county_name: county ? SE_COUNTIES[county] : null,
            nuts_codes: input.nuts ?? [],
            _new: true,
            _patch: {},
          }
        : {
            id: null,
            org_number: org,
            name,
            normalized_name: norm,
            aliases: [],
            is_begone: org === BEGONE_ORG,
            _new: true,
            _patch: {},
          }
    this.all.push(e)
    this.index(e)
    return e
  }

  counts() {
    const created = this.all.filter((e) => e._new).length
    const patched = this.all.filter((e) => !e._new && Object.keys(e._patch).length > 0).length
    return { created, patched, total: this.all.length }
  }

  /** Skriver nya rader och ändringar. Returnerar antal skrivna. */
  async flush(sb) {
    const fresh = this.all.filter((e) => e._new && !e.id)
    const insertRow = (e) => {
      const base = { org_number: e.org_number, name: e.name, normalized_name: e.normalized_name }
      if (this.kind === 'buyer') {
        return { ...base, sector: e.sector, county_code: e.county_code, county_name: e.county_name, nuts_codes: e.nuts_codes, aliases: e.aliases }
      }
      // Samma nycklar på alla rader i en sats (PostgREST sätter saknade kolumner till null)
      return { ...base, aliases: e.aliases, is_begone: !!e.is_begone }
    }
    if (sb) {
      // Med orgnr: upsert på org_number (idempotent även vid parallell körning)
      for (const part of chunk(fresh.filter((e) => e.org_number))) {
        const { data, error } = await sb.from(this.table).upsert(part.map(insertRow), { onConflict: 'org_number', ignoreDuplicates: false }).select('id, org_number')
        if (error) throw new Error(`${this.table}: ${error.message}`)
        const map = new Map((data ?? []).map((r) => [r.org_number, r.id]))
        for (const e of part) e.id = map.get(e.org_number) ?? null
      }
      // Utan orgnr: vanlig insert, raderna kommer tillbaka i samma ordning
      for (const part of chunk(fresh.filter((e) => !e.org_number))) {
        const { data, error } = await sb.from(this.table).insert(part.map(insertRow)).select('id, normalized_name')
        if (error) throw new Error(`${this.table}: ${error.message}`)
        part.forEach((e, i) => (e.id = data?.[i]?.id ?? null))
      }
      for (const e of this.all.filter((x) => !x._new && Object.keys(x._patch).length > 0)) {
        const { error } = await sb.from(this.table).update(e._patch).eq('id', e.id)
        if (error) throw new Error(`${this.table} ${e.id}: ${error.message}`)
        e._patch = {}
      }
    }
    return fresh.length
  }
}

// ===========================================================================
// Gemensam skrivning: en post per upphandling blir tilldelningar och anbudsgivare
//
// Post:
// {
//   source, sourceRef, noticeRefs: [TED-nummer att koppla notice_id på],
//   buyer: { orgNumber, name, nuts, sector }, title, cpv, countyCode,
//   fields: { bidsReceived, lowestBid, highestBid, criteriaType, procedureType,
//             isFramework, awardDate, contractSignedDate, contractStart,
//             contractEnd, renewalMax, wasAppealed, fallbackStart },
//   winners: [{ name, orgNumber, value, valueKind }],
//   bidders: [{ name, orgNumber, isWinner, price, rank, raw }],
//   enrichOrg: true om orgnr-kolumnerna får fyllas ur leverantörsregistret (inte för källor som synken också skriver),
//   raw
// }

export function buildRows(records, buyers, suppliers, noticeIdByRef = new Map()) {
  const awards = new Map()
  const bidders = new Map()
  for (const rec of records) {
    const buyer = rec.buyer?.name ? buyers.resolve(rec.buyer) : null
    const noticeId = (rec.noticeRefs ?? []).map((r) => noticeIdByRef.get(r)).find(Boolean) ?? null
    const f = rec.fields ?? {}
    // Samma bas som upsertAward, med publiceringsdatum som sista reserv
    const end = computeContractEnd({
      tedEnd: f.contractEnd,
      renewalMax: f.renewalMax,
      startOrAwardDate: f.contractStart ?? f.contractSignedDate ?? f.awardDate ?? f.fallbackStart ?? null,
    })
    const win = workWindow(end.date)
    const firstKeys = []
    for (const w of rec.winners) {
      const supplier = w.name ? suppliers.resolve({ orgNumber: w.orgNumber, name: w.name }) : null
      const key = awardKey(rec.source, rec.sourceRef, w.orgNumber, w.name)
      firstKeys.push(key)
      awards.set(key, {
        _buyer: buyer,
        _supplier: supplier,
        award_key: key,
        notice_id: noticeId,
        buyer_name: rec.buyer?.name ? cleanText(rec.buyer.name) : null,
        title: rec.title ? cleanText(rec.title) : null,
        cpv_codes: rec.cpv ?? [],
        // Län ur NUTS, annars köparens län (kända köpare från TED eller synken)
        county_code: rec.countyCode ?? buyer?.county_code ?? null,
        source: rec.source,
        source_ref: rec.sourceRef,
        // Nyckeln följer upsertAward (orgnr ur källan), kolumnen får leverantörens orgnr när källan saknar det och rec.enrichOrg är satt
        winner_org_number: normalizeOrgNumber(w.orgNumber) ?? (rec.enrichOrg ? supplier?.org_number ?? null : null),
        winner_name: w.name ? cleanText(w.name) : null,
        value: w.value ?? null,
        value_kind: w.valueKind ?? 'unknown',
        bids_received: f.bidsReceived ?? null,
        lowest_bid: f.lowestBid ?? null,
        highest_bid: f.highestBid ?? null,
        criteria_type: f.criteriaType ?? null,
        procedure_type: f.procedureType ?? null,
        is_framework: f.isFramework ?? null,
        award_date: f.awardDate ?? null,
        contract_signed_date: f.contractSignedDate ?? null,
        contract_start: f.contractStart ?? null,
        contract_end: f.contractEnd ?? null,
        renewal_max: f.renewalMax ?? null,
        calc_end_date: end.date,
        calc_end_source: end.source,
        window_start: win.start,
        window_end: win.end,
        was_appealed: f.wasAppealed ?? null,
        raw: rec.raw ?? null,
      })
    }
    for (const b of rec.bidders) {
      const supplier = suppliers.resolve({ orgNumber: b.orgNumber, name: b.name })
      const key = bidderKey(rec.source, rec.sourceRef, b.orgNumber, b.name)
      const ownAward = b.isWinner ? awardKey(rec.source, rec.sourceRef, b.orgNumber, b.name) : null
      const prev = bidders.get(key)
      bidders.set(key, {
        _supplier: supplier,
        _awardKey: ownAward && awards.has(ownAward) ? ownAward : firstKeys[0] ?? null,
        bidder_key: key,
        notice_id: noticeId,
        source_ref: rec.sourceRef,
        org_number: normalizeOrgNumber(b.orgNumber) ?? (rec.enrichOrg ? supplier?.org_number ?? null : null),
        name: cleanText(b.name),
        price: b.price ?? prev?.price ?? null,
        score: null,
        rank: b.rank ?? prev?.rank ?? null,
        is_winner: !!b.isWinner || !!prev?.is_winner,
        is_begone: false,
        source: rec.source,
        raw: b.raw ?? null,
      })
    }
  }
  return { awards: [...awards.values()], bidders: [...bidders.values()] }
}

/** Kopplar notice_id via procurement_notice_sources.external_ref */
export async function loadNoticeIds(sb, refs) {
  const map = new Map()
  if (!sb) return map
  for (const part of chunk(uniq(refs))) {
    const { data, error } = await sb.from('procurement_notice_sources').select('external_ref, notice_id').in('external_ref', part)
    if (error) throw error
    for (const r of data ?? []) if (r.external_ref && !map.has(r.external_ref)) map.set(r.external_ref, r.notice_id)
  }
  return map
}

function stripPrivate(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('_')) out[k] = v
  return out
}

/** Skriver köpare, leverantörer, tilldelningar och anbudsgivare. Returnerar antal. */
export async function writeAll(sb, buyers, suppliers, rows) {
  await buyers.flush(sb)
  await suppliers.flush(sb)
  const awardIds = new Map()
  const awardRows = rows.awards.map((a) => ({
    ...stripPrivate(a),
    buyer_id: a._buyer?.id ?? null,
    supplier_id: a._supplier?.id ?? null,
  }))
  const bidderRows = rows.bidders.map((b) => ({
    ...stripPrivate(b),
    supplier_id: b._supplier?.id ?? null,
    // Samma regel som upsertBidder: flaggan följer leverantörsraden, orgnr som reserv
    is_begone: !!b._supplier?.is_begone || b.org_number === BEGONE_ORG,
  }))
  if (sb) {
    for (const part of chunk(awardRows)) {
      const { data, error } = await sb.from('procurement_awards').upsert(part, { onConflict: 'award_key' }).select('id, award_key')
      if (error) throw new Error(`procurement_awards: ${error.message}`)
      for (const r of data ?? []) awardIds.set(r.award_key, r.id)
    }
  }
  rows.bidders.forEach((b, i) => (bidderRows[i].award_id = b._awardKey ? awardIds.get(b._awardKey) ?? null : null))
  if (sb) {
    for (const part of chunk(bidderRows)) {
      const { error } = await sb.from('procurement_bidders').upsert(part, { onConflict: 'bidder_key' })
      if (error) throw new Error(`procurement_bidders: ${error.message}`)
    }
  }
  return { awardRows, bidderRows }
}

/** Fyller county_code på tilldelningar som saknar län men vars köpare har ett */
export async function backfillAwardCounties(sb, source) {
  if (!sb) return 0
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('procurement_awards')
      .select('id, buyer_id')
      .eq('source', source)
      .is('county_code', null)
      .not('buyer_id', 'is', null)
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  if (rows.length === 0) return 0
  const county = new Map()
  for (const part of chunk(uniq(rows.map((r) => r.buyer_id)))) {
    const { data, error } = await sb.from('procurement_buyers').select('id, county_code').in('id', part).not('county_code', 'is', null)
    if (error) throw error
    for (const b of data ?? []) county.set(b.id, b.county_code)
  }
  const byCounty = new Map()
  for (const r of rows) {
    const c = county.get(r.buyer_id)
    if (!c) continue
    if (!byCounty.has(c)) byCounty.set(c, [])
    byCounty.get(c).push(r.id)
  }
  let n = 0
  for (const [c, ids] of byCounty) {
    for (const part of chunk(ids)) {
      const { error } = await sb.from('procurement_awards').update({ county_code: c }).in('id', part)
      if (error) throw error
      n += part.length
    }
  }
  return n
}

export async function countRows(sb, table, filter) {
  let q = sb.from(table).select('id', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export async function printTableCounts(sb, source, label) {
  if (!sb) return
  const buyers = await countRows(sb, 'procurement_buyers')
  const suppliers = await countRows(sb, 'procurement_suppliers')
  const awards = await countRows(sb, 'procurement_awards', (q) => q.eq('source', source))
  const bidders = await countRows(sb, 'procurement_bidders', (q) => q.eq('source', source))
  console.log(`${label}: köpare ${buyers}, leverantörer ${suppliers}, tilldelningar (${source}) ${awards}, anbudsgivare (${source}) ${bidders}`)
}
