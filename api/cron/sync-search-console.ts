// api/cron/sync-search-console.ts
// Hämtar Search Console-data (Search Analytics, searchType web, dataState final)
// för begone.se till Supabase. Schema i vercel.json: 04:15 UTC varje dygn.
//
// Två lägen:
//  - Daglig (standard): de senaste 5 dagarna per dag och sida (gsc_sida_dag) och
//    per dag och fråga (gsc_fraga_dag), plus innevarande och föregående månad per
//    sida och fråga (gsc_sida_fraga_manad).
//  - ?backfill=1: 16 månader bakåt, månad för månad. Först sida+fråga per månad,
//    sedan dag+sida och dag+fråga (dimensionen date ger en rad per dag). Jobbet
//    slutar snyggt före Vercels tidsgräns och fortsätter nästa anrop där det
//    slutade (progress i gsc_synk_status, id 'backfill'). Kör om tills svaret
//    säger klar: true. ?backfill=1&omstart=1 börjar om från början.
//
// Hela endpointen kräver CRON_SECRET. Env: GSC_SERVICE_ACCOUNT_JSON och
// GSC_SITE_URL (sc-domain:begone.se eller https://begone.se/). Hemligheter loggas
// ALDRIG; fel från Google loggas med HTTP-status, Googles status och meddelande.
//
// Manuell körning:
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://<domän>/api/cron/sync-search-console?backfill=1"

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { GscAborted, GscError, querySearchAnalytics, type GscDimension, type GscRow } from '../_lib/gsc'

export const config = { maxDuration: 300 }

const LOG = '[sync-search-console]'
const UPSERT_BATCH = 1000
const PAUSE_MS = 1500
// Ny månad påbörjas bara om det finns gott om tid kvar; pågående paginering
// avbryts vid den hårda gränsen och månaden tas om nästa körning.
const SOFT_LIMIT_MS = 200_000
const HARD_LIMIT_MS = 270_000
const DAGLIG_DAGAR = 5
const BACKFILL_MANADER = 16

type Fas = 'manad' | 'sida_dag' | 'fraga_dag' | 'klar'
const FASER: Fas[] = ['manad', 'sida_dag', 'fraga_dag', 'klar']

// ---------- datum (rena kalenderdatum, räknas i UTC utan klockslag) ----------

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function addDays(s: string, n: number): string {
  const d = parseYmd(s)
  d.setUTCDate(d.getUTCDate() + n)
  return ymd(d)
}
function monthStart(s: string): string {
  return `${s.slice(0, 7)}-01`
}
function addMonths(s: string, n: number): string {
  const d = parseYmd(monthStart(s))
  d.setUTCMonth(d.getUTCMonth() + n)
  return ymd(d)
}
function monthEnd(s: string): string {
  return addDays(addMonths(s, 1), -1)
}
function minDate(a: string, b: string): string {
  return a < b ? a : b
}
/** Dagens datum i Sverige som ÅÅÅÅ-MM-DD */
function todaySe(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date())
}

// ---------- normalisering och aggregering ----------

/** Tar bort https://begone.se och www, behåller avslutande snedstreck. */
export function normalizePage(url: string): string {
  const stripped = url.replace(/^https?:\/\/(www\.)?begone\.se(?=[/?#]|$)/i, '')
  if (stripped === url) return url // annat värdnamn: behåll hela adressen
  return stripped === '' ? '/' : stripped
}

interface Agg {
  keys: string[]
  klick: number
  visningar: number
  posSum: number
}

/**
 * Normaliserar och slår ihop rader som krockar efter normaliseringen
 * (t.ex. www och utan www). Position viktas med visningar, ctr räknas om.
 */
function aggregate(rows: GscRow[], dims: GscDimension[]): Agg[] {
  const map = new Map<string, Agg>()
  for (const r of rows) {
    const keys = (r.keys ?? []).map((k, i) => (dims[i] === 'page' ? normalizePage(k) : k))
    if (keys.length !== dims.length) continue
    const id = keys.join('\t')
    const clicks = r.clicks ?? 0
    const impressions = r.impressions ?? 0
    const a = map.get(id)
    if (a) {
      a.klick += clicks
      a.visningar += impressions
      a.posSum += (r.position ?? 0) * impressions
    } else {
      map.set(id, { keys, klick: clicks, visningar: impressions, posSum: (r.position ?? 0) * impressions })
    }
  }
  return [...map.values()]
}

function metrics(a: Agg) {
  return {
    klick: Math.round(a.klick),
    visningar: Math.round(a.visningar),
    ctr: a.visningar > 0 ? Number((a.klick / a.visningar).toFixed(6)) : 0,
    position: a.visningar > 0 ? Number((a.posSum / a.visningar).toFixed(3)) : null,
  }
}

// ---------- Supabase ----------

function sbClient(): SupabaseClient {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
  )
}

async function upsertBatched(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict })
    if (error) throw new Error(`Kunde inte spara ${table}: ${error.message}`)
  }
}

// ---------- steg ----------

interface Ctx {
  sb: SupabaseClient
  siteUrl: string
  startedAt: number
  counts: Record<string, number>
}

const hasTime = (ctx: Ctx) => Date.now() - ctx.startedAt < HARD_LIMIT_MS
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchRows(ctx: Ctx, startDate: string, endDate: string, dims: GscDimension[], steg: string) {
  const rows = await querySearchAnalytics({
    siteUrl: ctx.siteUrl,
    startDate,
    endDate,
    dimensions: dims,
    pauseMs: PAUSE_MS,
    shouldContinue: () => hasTime(ctx),
  })
  console.log(`${LOG} ${steg} ${startDate}..${endDate}: ${rows.length} rader från Google`)
  return rows
}

/** sida+fråga för en månad, fram till slutdatum om månaden inte är slut */
async function syncManad(ctx: Ctx, manad: string, slut: string): Promise<number> {
  const end = minDate(monthEnd(manad), slut)
  const rows = await fetchRows(ctx, manad, end, ['page', 'query'], 'sida+fraga')
  const now = new Date().toISOString()
  const out = aggregate(rows, ['page', 'query']).map((a) => ({
    manad,
    sida: a.keys[0],
    fraga: a.keys[1],
    ...metrics(a),
    hamtad_at: now,
  }))
  await upsertBatched(ctx.sb, 'gsc_sida_fraga_manad', out, 'manad,sida,fraga')
  ctx.counts.gsc_sida_fraga_manad = (ctx.counts.gsc_sida_fraga_manad ?? 0) + out.length
  console.log(`${LOG} gsc_sida_fraga_manad ${manad}: ${out.length} rader sparade`)
  return out.length
}

/** dag+sida eller dag+fråga för ett datumintervall */
async function syncDag(ctx: Ctx, dim: 'page' | 'query', start: string, end: string): Promise<number> {
  const dims: GscDimension[] = ['date', dim]
  const table = dim === 'page' ? 'gsc_sida_dag' : 'gsc_fraga_dag'
  const col = dim === 'page' ? 'sida' : 'fraga'
  const rows = await fetchRows(ctx, start, end, dims, `dag+${col}`)
  const now = new Date().toISOString()
  const out = aggregate(rows, dims).map((a) => ({
    dag: a.keys[0],
    [col]: a.keys[1],
    ...metrics(a),
    hamtad_at: now,
  }))
  await upsertBatched(ctx.sb, table, out, `dag,${col}`)
  ctx.counts[table] = (ctx.counts[table] ?? 0) + out.length
  console.log(`${LOG} ${table} ${start}..${end}: ${out.length} rader sparade`)
  return out.length
}

// ---------- status ----------

interface StatusRow {
  id: 'daglig' | 'backfill'
  fas: Fas | null
  nasta_datum: string | null
  fonster_start: string | null
  fonster_slut: string | null
  klar: boolean
}

async function saveStatus(sb: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await sb
    .from('gsc_synk_status')
    .upsert({ ...row, uppdaterad_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) console.error(`${LOG} Kunde inte spara gsc_synk_status: ${error.message}`)
}

function describeError(err: unknown, siteUrl: string): string {
  if (err instanceof GscError) {
    let hint = ''
    if (err.httpStatus === 403) {
      hint = ` Tjänstekontot saknar behörighet till egendomen "${siteUrl}". Lägg till tjänstekontots client_email som användare i Search Console för exakt den egendomen, eller rätta GSC_SITE_URL (sc-domain:begone.se för domänegendom, https://begone.se/ för URL-prefix).`
    } else if (err.httpStatus === 404 || err.httpStatus === 400) {
      hint = ` Kontrollera GSC_SITE_URL ("${siteUrl}"): den måste stava egendomen exakt som i Search Console.`
    } else if (err.httpStatus === 401 || err.googleStatus === 'invalid_grant') {
      hint = ' Tokenutbytet nekades. Kontrollera att nyckeln i GSC_SERVICE_ACCOUNT_JSON är aktiv och att Search Console API är aktiverat i Google Cloud-projektet.'
    } else if (err.httpStatus === 429) {
      hint = ' Googles kvot är nådd. Vänta och kör igen.'
    }
    return `Google svarade ${err.googleStatus} (${err.httpStatus}): ${err.message}.${hint}`
  }
  return err instanceof Error ? err.message : String(err)
}

// ---------- lägen ----------

async function runDaglig(ctx: Ctx) {
  const today = todaySe()
  const end = addDays(today, -1)
  const start = addDays(today, -DAGLIG_DAGAR)
  await syncDag(ctx, 'page', start, end)
  await sleep(PAUSE_MS)
  await syncDag(ctx, 'query', start, end)
  await sleep(PAUSE_MS)
  const denna = monthStart(end)
  await syncManad(ctx, addMonths(denna, -1), end)
  await sleep(PAUSE_MS)
  await syncManad(ctx, denna, end)
  return { start, end }
}

interface BackfillResult {
  klar: boolean
  fas: Fas
  nasta_datum: string | null
  stoppad_for_tidsgrans: boolean
}

async function runBackfill(ctx: Ctx, omstart: boolean): Promise<BackfillResult> {
  const { data, error } = await ctx.sb.from('gsc_synk_status').select('*').eq('id', 'backfill').maybeSingle()
  if (error) throw new Error(`Kunde inte läsa gsc_synk_status: ${error.message}`)
  let st = data as StatusRow | null

  if (!st || omstart || !st.fas || !st.fonster_start || !st.fonster_slut || (!st.klar && !st.nasta_datum)) {
    const slut = addDays(todaySe(), -1)
    const start = addMonths(slut, -BACKFILL_MANADER)
    st = { id: 'backfill', fas: 'manad', nasta_datum: start, fonster_start: start, fonster_slut: slut, klar: false }
    console.log(`${LOG} Backfill startar: ${start}..${slut}`)
  }
  if (st.klar || st.fas === 'klar') {
    console.log(`${LOG} Backfill redan klar (${st.fonster_start}..${st.fonster_slut}). Lägg till &omstart=1 för att börja om.`)
    return { klar: true, fas: 'klar', nasta_datum: null, stoppad_for_tidsgrans: false }
  }

  const fonsterStart = st.fonster_start as string
  const slut = st.fonster_slut as string
  let fas = st.fas as Fas
  let nasta = st.nasta_datum as string
  let stoppad = false

  await saveStatus(ctx.sb, { ...st, senast_start_at: new Date().toISOString(), senast_fel: null })

  while (fas !== 'klar') {
    if (Date.now() - ctx.startedAt > SOFT_LIMIT_MS) {
      stoppad = true
      break
    }
    try {
      if (fas === 'manad') await syncManad(ctx, nasta, slut)
      else await syncDag(ctx, fas === 'sida_dag' ? 'page' : 'query', nasta, minDate(monthEnd(nasta), slut))
    } catch (err) {
      if (err instanceof GscAborted) {
        console.log(`${LOG} ${fas} ${nasta} avbröts före tidsgränsen och tas om nästa körning`)
        stoppad = true
        break
      }
      throw err
    }
    // Månaden klar: flytta fram och spara progress direkt
    const next = addMonths(nasta, 1)
    if (next > slut) {
      fas = FASER[FASER.indexOf(fas) + 1]
      nasta = fonsterStart
    } else {
      nasta = next
    }
    await saveStatus(ctx.sb, {
      id: 'backfill',
      fas,
      nasta_datum: fas === 'klar' ? null : nasta,
      fonster_start: fonsterStart,
      fonster_slut: slut,
      klar: fas === 'klar',
      rader: ctx.counts,
      ...(fas === 'klar' ? { senast_klar_at: new Date().toISOString() } : {}),
    })
    if (fas !== 'klar') await sleep(PAUSE_MS)
  }

  if (stoppad) console.log(`${LOG} Backfill pausad i fas ${fas}, nästa månad ${nasta}. Kör ?backfill=1 igen.`)
  else console.log(`${LOG} Backfill klar`)
  return { klar: fas === 'klar', fas, nasta_datum: fas === 'klar' ? null : nasta, stoppad_for_tidsgrans: stoppad }
}

// ---------- handler ----------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const siteUrl = (process.env.GSC_SITE_URL ?? '').trim()
  if (!siteUrl || !process.env.GSC_SERVICE_ACCOUNT_JSON) {
    console.error(`${LOG} GSC_SITE_URL eller GSC_SERVICE_ACCOUNT_JSON saknas i miljön`)
    return res.status(503).json({ status: 'failed', error: 'Search Console är inte konfigurerad' })
  }
  const backfill = req.query.backfill === '1'
  const omstart = req.query.omstart === '1'
  const mode: 'daglig' | 'backfill' = backfill ? 'backfill' : 'daglig'

  const sb = sbClient()
  const ctx: Ctx = { sb, siteUrl, startedAt: Date.now(), counts: {} }
  let googleFailed = false

  const result = await withCronLog<Record<string, unknown>>(
    backfill ? 'sync-search-console-backfill' : 'sync-search-console',
    async () => {
      try {
        if (backfill) {
          const r = await runBackfill(ctx, omstart)
          return {
            status: r.klar ? 'success' : 'partial',
            summary: { lage: mode, site: siteUrl, ...r, rader: ctx.counts },
          }
        }
        await saveStatus(sb, { id: 'daglig', senast_start_at: new Date().toISOString() })
        const r = await runDaglig(ctx)
        await saveStatus(sb, {
          id: 'daglig',
          fonster_start: r.start,
          fonster_slut: r.end,
          senast_klar_at: new Date().toISOString(),
          senast_fel: null,
          rader: ctx.counts,
        })
        return { status: 'success', summary: { lage: mode, site: siteUrl, ...r, rader: ctx.counts } }
      } catch (err) {
        if (err instanceof GscError) googleFailed = true
        const msg = describeError(err, siteUrl)
        console.error(`${LOG} ${mode} misslyckades: ${msg}`)
        await saveStatus(sb, { id: mode, senast_fel: msg, rader: ctx.counts })
        return { status: 'failed', summary: { lage: mode, site: siteUrl, rader: ctx.counts }, errorMessage: msg }
      }
    },
  )

  console.log(`${LOG} ${mode} rader per tabell: ${JSON.stringify(ctx.counts)}`)
  if (result.status === 'failed') {
    return res
      .status(googleFailed ? 502 : 500)
      .json({ status: 'failed', error: result.errorMessage, summary: result.summary })
  }
  return res.status(200).json({ status: result.status, summary: result.summary })
}
