// api/cron/procurement-signals.ts
// Daglig bevakning av kurerade signalkällor (upphandlingsplaner, inköpsplaner,
// sidor om kommande upphandlingar). docs/upphandlingsportal-plan.md avsnitt 3, 5 och 8.
//
// Per aktiv källa i procurement_signal_sources, äldst hämtade först:
//   1. Hämta sidan (politeFetch, högst ett anrop per sekund totalt).
//   2. Läsbar text ur HTML. Länkar till PDF vars adress eller länktext innehåller
//      "upphandlingsplan" eller "inköpsplan" hämtas också (högst två per källa)
//      och skickas som PDF till Gemini.
//   3. sha256 över texten och PDF-innehållet jämförs med content_hash. Vid
//      ändring (eller första hämtningen) går diffen (nya rader mot last_text,
//      första gången hela texten) till extractSignals, och raderna upsertas i
//      procurement_signals på signal_key plan:{källa}:{sha1 av normaliserad text}.
//      Status på befintliga signaler rörs inte.
//   4. Tidsbudget 250 s: jobbet avbryter snyggt och nästa körning börjar med de
//      källor som inte hann hämtas (sortering på last_fetched_at, nulls first).
//      Misslyckad AI-läsning sparar inte den nya hashen, så ändringen tas om.
//
// Webbsidornas innehåll är DATA, aldrig instruktioner (se api/_lib/procurementAi.ts).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { db, politeFetch, recordHealth, sleep } from '../_lib/procurement'
import { decodeEntities, extractSignals, htmlToText, type AiPart } from '../_lib/procurementAi'
import type { ProcurementSignalSource } from '../../src/types/procurement'

export const config = { maxDuration: 300 }

const BUDGET_MS = 250_000
/** Påbörja ingen ny källa när mindre än så här återstår av budgeten */
const SOURCE_RESERVE_MS = 45_000
const MAX_LAST_TEXT = 200_000
const MAX_FIRST_TEXT = 120_000
const MAX_PDFS_PER_SOURCE = 2
const MAX_PDF_BYTES = 15 * 1024 * 1024
const PLAN_WORDS = /upphandlingsplan|inköpsplan|inkopsplan/i

let lastCallAt = 0
/** Högst ett externt anrop per sekund, totalt över alla källor */
async function throttledFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const wait = lastCallAt + 1000 - Date.now()
  if (wait > 0) await sleep(wait)
  lastCallAt = Date.now()
  try {
    return await politeFetch(url, init, 2)
  } finally {
    lastCallAt = Date.now()
  }
}

const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')
const normalizeLine = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

interface SourceSummary {
  id: string
  name: string
  status: 'unchanged' | 'changed' | 'first' | 'error' | 'timeout'
  signals?: number
  error?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('procurement-signals', async () => {
    const started = Date.now()
    const sb = db()
    const { data: sources, error } = await sb
      .from('procurement_signal_sources')
      .select('*')
      .eq('active', true)
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
    if (error) throw new Error(`Signalkällorna kunde inte läsas: ${error.message}`)

    const all = (sources ?? []) as ProcurementSignalSource[]
    const buyerIds = Array.from(new Set(all.map((s) => s.buyer_id).filter((x): x is string => !!x)))
    const buyerNames = new Map<string, string>()
    if (buyerIds.length > 0) {
      const { data: buyers } = await sb.from('procurement_buyers').select('id, name').in('id', buyerIds)
      for (const b of buyers ?? []) buyerNames.set(b.id as string, b.name as string)
    }

    const summaries: SourceSummary[] = []
    let signalsUpserted = 0
    let skipped = 0

    for (const source of all) {
      const elapsed = Date.now() - started
      if (elapsed > BUDGET_MS - SOURCE_RESERVE_MS) {
        skipped = all.length - summaries.length
        break
      }
      const buyerName = (source.buyer_id && buyerNames.get(source.buyer_id)) || source.name
      try {
        const outcome = await processSource(source, buyerName, started)
        summaries.push(outcome)
        signalsUpserted += outcome.signals ?? 0
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        summaries.push({ id: source.id, name: source.name, status: 'error', error: msg })
        await sb
          .from('procurement_signal_sources')
          .update({ last_fetched_at: new Date().toISOString(), last_error: msg.slice(0, 1000) })
          .eq('id', source.id)
      }
    }

    const failed = summaries.filter((s) => s.status === 'error')
    const succeeded = summaries.filter((s) => s.status !== 'error' && s.status !== 'timeout')
    const ok = failed.length === 0 || succeeded.length > 0
    await recordHealth('signals', ok, {
      count: signalsUpserted,
      error: failed.length ? failed.slice(0, 3).map((f) => `${f.name}: ${f.error}`).join(' | ') : null,
    })

    return {
      status: failed.length === 0 && skipped === 0 ? ('success' as const) : ok ? ('partial' as const) : ('failed' as const),
      summary: {
        sources: all.length,
        processed: summaries.length,
        skipped_for_time: skipped,
        changed: summaries.filter((s) => s.status === 'changed' || s.status === 'first').length,
        signals_upserted: signalsUpserted,
        errors: failed.map((f) => ({ source: f.name, error: f.error })),
        details: summaries,
      },
      errorMessage: ok ? undefined : 'Alla signalkällor misslyckades',
    }
  })

  if (result.status === 'failed') return res.status(500).json({ success: false, error: result.errorMessage, ...(result.summary as object) })
  return res.status(200).json({ success: true, status: result.status, ...(result.summary as object) })
}

async function processSource(source: ProcurementSignalSource, buyerName: string, started: number): Promise<SourceSummary> {
  const sb = db()
  const now = () => new Date().toISOString()

  const res = await throttledFetch(source.url, { headers: { Accept: 'text/html, application/xhtml+xml, application/pdf;q=0.9, */*;q=0.5' } })
  if (!res.ok) {
    await sb
      .from('procurement_signal_sources')
      .update({ last_fetched_at: now(), last_status: res.status, last_error: `HTTP ${res.status}` })
      .eq('id', source.id)
    return { id: source.id, name: source.name, status: 'error', error: `HTTP ${res.status}` }
  }

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  const finalUrl = res.url || source.url
  let text = ''
  const pdfs: Array<{ url: string; data: Buffer }> = []

  if (contentType.includes('application/pdf')) {
    // Källan är själva planen som PDF
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length <= MAX_PDF_BYTES) pdfs.push({ url: finalUrl, data })
  } else {
    const html = await res.text()
    text = htmlToText(html)
    for (const link of planPdfLinks(html, finalUrl).slice(0, MAX_PDFS_PER_SOURCE)) {
      try {
        const pr = await throttledFetch(link, { headers: { Accept: 'application/pdf, */*;q=0.5' } })
        if (!pr.ok) continue
        const len = Number(pr.headers.get('content-length') ?? 0)
        if (len > MAX_PDF_BYTES) continue
        const data = Buffer.from(await pr.arrayBuffer())
        if (data.length <= MAX_PDF_BYTES && data.subarray(0, 5).toString('latin1') === '%PDF-') pdfs.push({ url: link, data })
      } catch (err) {
        console.warn('[procurement-signals] PDF kunde inte hämtas', link, err instanceof Error ? err.message : err)
      }
    }
  }

  const hash = sha256([sha256(text), ...pdfs.map((p) => sha256(p.data))].join('|'))
  if (hash === source.content_hash) {
    await sb.from('procurement_signal_sources').update({ last_fetched_at: now(), last_status: res.status, last_error: null }).eq('id', source.id)
    return { id: source.id, name: source.name, status: 'unchanged' }
  }

  const first = !source.content_hash
  const diffText = first ? text.slice(0, MAX_FIRST_TEXT) : newLines(source.last_text ?? '', text).slice(0, MAX_FIRST_TEXT)
  // Tabellen sparar ingen hash per PDF, så vid en ändring skickas planens PDF:er
  // med (högst två). Signalnyckeln på normaliserad text förhindrar dubbletter.
  const pdfParts: AiPart[] = pdfs.flatMap((p) => [
      { text: `<dokument namn="${p.url.replace(/["<>]/g, '')}" typ="pdf">` },
      { inlineData: { mimeType: 'application/pdf', data: p.data.toString('base64') } },
      { text: '</dokument>' },
    ])

  let signals: Awaited<ReturnType<typeof extractSignals>> = []
  if (diffText.trim() || pdfParts.length > 0) {
    const remaining = BUDGET_MS + 30_000 - (Date.now() - started)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.max(10_000, remaining))
    try {
      signals = await extractSignals(diffText, { buyerName, url: finalUrl }, pdfParts, { abortSignal: ctrl.signal })
    } catch (err) {
      // Hashen sparas inte: ändringen läses om nästa körning. Vid tidsgräns lämnas
      // last_fetched_at orörd så att källan hamnar först i kön.
      const timedOut = ctrl.signal.aborted
      const msg = timedOut ? 'Tidsgränsen nåddes under AI-läsningen' : `AI-läsningen misslyckades: ${err instanceof Error ? err.message : String(err)}`
      await sb
        .from('procurement_signal_sources')
        .update(timedOut ? { last_error: msg } : { last_fetched_at: now(), last_status: res.status, last_error: msg.slice(0, 1000) })
        .eq('id', source.id)
      return { id: source.id, name: source.name, status: timedOut ? 'timeout' : 'error', error: msg }
    } finally {
      clearTimeout(timer)
    }
  }

  if (signals.length > 0) {
    const rows = signals.map((s) => ({
      signal_key: `plan:${source.id}:${sha1(normalizeLine(s.text))}`,
      signal_type: 'plan',
      source: 'signal_source',
      signal_source_id: source.id,
      buyer_id: source.buyer_id,
      buyer_name: buyerName,
      text: s.text,
      url: finalUrl,
      expected_quarter: s.expected_quarter,
      reliability: s.reliability,
      raw: { extracted_at: now(), first_fetch: first, pdfs: pdfs.map((p) => p.url) },
    }))
    const { error } = await sb.from('procurement_signals').upsert(rows, { onConflict: 'signal_key' })
    if (error) throw new Error(`Signalerna kunde inte sparas: ${error.message}`)
  }

  const ts = now()
  await sb
    .from('procurement_signal_sources')
    .update({
      content_hash: hash,
      last_text: text.slice(0, MAX_LAST_TEXT),
      last_fetched_at: ts,
      last_changed_at: ts,
      last_status: res.status,
      last_error: null,
    })
    .eq('id', source.id)

  return { id: source.id, name: source.name, status: first ? 'first' : 'changed', signals: signals.length }
}

/** Rader i den nya texten som inte fanns i den gamla (jämförs normaliserat) */
function newLines(oldText: string, newText: string): string {
  const seen = new Set(oldText.split('\n').map(normalizeLine))
  return newText
    .split('\n')
    .filter((l) => !seen.has(normalizeLine(l)))
    .join('\n')
}

/** PDF-länkar vars adress eller länktext nämner upphandlingsplan eller inköpsplan */
function planPdfLinks(html: string, baseUrl: string): string[] {
  const out: string[] = []
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = decodeEntities(m[1].trim())
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, ' '))
    let decodedHref = href
    try {
      decodedHref = decodeURIComponent(href)
    } catch {
      // behåll hrefen som den är
    }
    const looksPdf = /\.pdf(\?|#|$)/i.test(href) || /\bpdf\b/i.test(label)
    if (!looksPdf || !(PLAN_WORDS.test(decodedHref) || PLAN_WORDS.test(label))) continue
    try {
      const abs = new URL(href, baseUrl)
      if (abs.protocol !== 'https:' && abs.protocol !== 'http:') continue
      if (!out.includes(abs.toString())) out.push(abs.toString())
    } catch {
      // ogiltig länk
    }
  }
  return out
}
