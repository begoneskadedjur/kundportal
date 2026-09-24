// api/cron/procurement-sync-kommers.ts
// Reservkälla för upphandlingsbevakningen: Kommers annonsportal
// (www.kommersannons.se). Dagligen (vercel.json, läggs av huvudagenten).
// TED plus Kommers bär bevakningen om Mercell faller bort (planens avsnitt 6).
//
// Flöde per körning:
//   1. GET /Notices/TenderNotices: __RequestVerificationToken, antiforgery-kakan
//      och formulärets CPV-namn.
//   2. POST-sökningar: de bevakade CPV-koderna i ETT anrop (SelectedCpvCode tar
//      Kommers svenska CPV-namn, flera värden), sedan fritext "skadedjur" och
//      "sanering". Alla sidor (40 per sida) inom tidsbudgeten.
//   3. GET /Notices/PriorInfoNotices: förhandsannonser (få, ingen sökning).
//   4. Varje post poängsätts först på listans uppgifter. Bara poster med poäng
//      hämtar detaljsidan (/Notice/{typ}/{id}), poängsätts igen med fullständiga
//      uppgifter och läses in. Poäng 0 hoppas över, som Mercell-synken.
//   5. notifyNewMatches, recordHealth('kommers').
//
// Manuell körning: ?since=ÅÅÅÅ-MM-DD (bara poster publicerade det datumet eller
// senare) och ?old=1 (SearchOldNotices=true, tar med utgångna annonser).
//
// Verifierat mot kommersannons.se 2026-09-25, detaljer i
// api/_lib/procurementKommers.ts. Viktigast:
//   - Detaljsidan finns bara för eForms-annonser. Nationella annonser har bara
//     listans uppgifter: ingen köpare, ingen exakt sista anbudsdag (bara "N dagar
//     kvar", som sparas i raw men INTE som tender_deadline).
//   - Dedup mot Mercell: Mercell sätter external_ref kommers:{sourceNoticeId}
//     där sourceNoticeId är instansens ProcurementId, inte portalens löpnummer.
//     Här blir external_ref kommers:{ProcurementId} från detaljsidan. Utan
//     detaljsida letas en Mercell-post med samma normaliserade titel och
//     publiceringsdatum inom två dagar, och dess external_ref lånas.
//   - ProcurementId är unikt bara per Kommers-instans. Om kommers:{id} redan
//     finns på en upphandling med annan titel används kommers:{instans}:{id}
//     så att två olika upphandlingar aldrig slås ihop.
//
// TODO: Mercell-synken borde bära instansen i nyckeln (kommers:{instans}:{id}),
// men Mercell ger bara förkortningar (Kom Traf, Kom Lite, Kom Sto ...) och
// översättningen till instans är inte verifierad för alla.
// TODO: Nationella annonser saknar köpare. Loggans filnamn sparas i raw som
// ledtråd men används inte som köparnamn.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import {
  db,
  ingestNotice,
  loadWatchRules,
  notifyNewMatches,
  politeFetch,
  recordHealth,
  sleep,
  type IngestResult,
  type NoticeCandidate,
} from '../_lib/procurement'
import {
  KOMMERS_BASE,
  KOMMERS_KEYWORDS,
  KOMMERS_PEST_CPV,
  KOMMERS_PRIOR_LIST_PATH,
  KOMMERS_TENDER_LIST_PATH,
  buildSearchBody,
  kommersDetailUrl,
  kommersKind,
  parseDetailPage,
  parseFormState,
  parseListPage,
  setCookiesOf,
  swedishMidnight,
  titleOverlap,
  type KommersDetail,
  type KommersFormState,
  type KommersListItem,
  type KommersSearch,
} from '../_lib/procurementKommers'
import {
  addDaysIso,
  cleanText,
  countiesFromNuts,
  countyFromName,
  daysBetweenIso,
  normalizeTitle,
  scoreNotice,
  swedishDate,
  todaySwedish,
} from '../../src/shared/procurementRules'
import type { ProcurementWatchRule } from '../../src/types/procurement'

export const config = { maxDuration: 300 }

const TIME_BUDGET_MS = 240_000
const MAX_PAGES_PER_SEARCH = 30
const MIN_INTERVAL_MS = 1000

// ---------------------------------------------------------------------------
// Högst ett anrop per sekund mot Kommers

let lastCall = 0
async function kommersFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  try {
    return await politeFetch(url, { ...init, headers: { Accept: 'text/html', 'Accept-Language': 'sv-SE,sv;q=0.9', ...(init.headers ?? {}) } })
  } finally {
    lastCall = Date.now()
  }
}

async function loadForm(): Promise<KommersFormState> {
  const resp = await kommersFetch(`${KOMMERS_BASE}${KOMMERS_TENDER_LIST_PATH}`)
  if (!resp.ok) throw new Error(`Kommers sökformulär svarade ${resp.status}`)
  const state = parseFormState(await resp.text(), setCookiesOf(resp.headers))
  if (!state.token) throw new Error('Kommers: __RequestVerificationToken saknas i sökformuläret')
  if (!state.cookie) throw new Error('Kommers: antiforgery-kakan saknas i svaret')
  return state
}

async function search(state: KommersFormState, s: KommersSearch): Promise<ReturnType<typeof parseListPage>> {
  const resp = await kommersFetch(`${KOMMERS_BASE}${KOMMERS_TENDER_LIST_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: state.cookie },
    body: buildSearchBody(s, state.token!).toString(),
  })
  if (!resp.ok) throw new Error(`Kommers sökning svarade ${resp.status}`)
  return parseListPage(await resp.text())
}

// ---------------------------------------------------------------------------
// Post till kandidat

function countiesOf(item: KommersListItem, detail: KommersDetail | null): string[] {
  const nuts = [...(detail?.nutsCodes ?? []), ...item.nutsCodes]
  const byName = (item.nutsText ?? '')
    .split(',')
    .map((part) => countyFromName(part.replace(/^SE[0-9A-Z]+\s*-\s*/, '').trim()))
    .filter((c): c is string => !!c)
  return Array.from(new Set([...countiesFromNuts(nuts), ...byName]))
}

function preScore(item: KommersListItem, rules: ProcurementWatchRule[]): number {
  return scoreNotice(
    { title: item.title, description: item.description, cpv_codes: item.cpvCodes, county_codes: countiesOf(item, null) },
    rules
  ).score
}

function toCandidate(item: KommersListItem, detail: KommersDetail | null, externalRef: string | null): NoticeCandidate {
  const title = cleanText(detail?.title || item.title) || 'Utan titel'
  const listDesc = item.description ?? ''
  const detailDesc = detail?.description ?? ''
  const description = (detailDesc.length >= listDesc.length ? detailDesc : listDesc) || null
  // Ungefärlig sista dag ur "N dagar kvar" sparas bara som ledtråd
  const approxDeadline = item.daysLeft != null && item.daysLeft >= 0 ? addDaysIso(todaySwedish(), item.daysLeft) : null
  return {
    source: 'kommers',
    sourceId: item.sourceId,
    sourceSub: detail?.instanceHost ?? null,
    externalRef,
    url: kommersDetailUrl(item.type, item.id),
    raw: { list: item, detail, approxDeadlineDate: detail?.tenderDeadline ? null : approxDeadline },
    title,
    description,
    buyerName: detail?.buyerName ?? null,
    buyerOrgNumber: detail?.buyerOrgNumber ?? null,
    cpv: Array.from(new Set([...(detail?.cpvCodes ?? []), ...item.cpvCodes])),
    nuts: Array.from(new Set([...(detail?.nutsCodes ?? []), ...item.nutsCodes])),
    countyCodes: countiesOf(item, detail),
    publishedAt: detail?.dispatchedAt ?? swedishMidnight(item.publishedDate),
    tenderDeadline: detail?.tenderDeadline ?? null,
    estimatedValue: detail?.estimatedValue != null && (detail.currency ?? 'SEK') === 'SEK' ? detail.estimatedValue : null,
    currency: detail?.currency ?? 'SEK',
    procedureType: detail?.procedureType ?? null,
    isFramework: detail?.isFramework ?? null,
    contractStart: detail?.contractStart ?? null,
    contractEnd: detail?.contractEnd ?? null,
    criteriaType: detail?.criteriaType ?? null,
    kind: kommersKind(item, detail),
    platformUrl: detail?.platformUrl ?? null,
    documentUrl: detail?.documentUrl ?? null,
  }
}

// ---------------------------------------------------------------------------
// Dedup-nyckel mot Mercell (external_ref)

async function resolveExternalRef(item: KommersListItem, detail: KommersDetail | null, title: string): Promise<string | null> {
  const sb = db()
  if (detail?.procurementId) {
    const ref = `kommers:${detail.procurementId}`
    const { data } = await sb
      .from('procurement_notice_sources')
      .select('source, source_id, notice:procurement_notices(title)')
      .eq('external_ref', ref)
      .limit(5)
    const rows = (data ?? []) as Array<{ source: string; source_id: string; notice: { title: string | null } | { title: string | null }[] | null }>
    const clash = rows.some((r) => {
      if (r.source === 'kommers') return r.source_id !== item.sourceId
      const n = Array.isArray(r.notice) ? r.notice[0] : r.notice
      return titleOverlap(n?.title ?? '', title) < 0.5
    })
    // Samma ProcurementId i en annan Kommers-instans: nyckeln får bära instansen
    return clash ? `kommers:${detail.instanceHost ?? 'okand'}:${detail.procurementId}` : ref
  }

  // Ingen detaljsida: låna Mercells nyckel om exakt en Kom-post har samma titel
  if (!item.publishedDate) return null
  const { data } = await sb
    .from('procurement_notices')
    .select('id, published_at, procurement_notice_sources(source, external_ref)')
    .eq('normalized_title', normalizeTitle(title))
    .limit(5)
  const refs = new Set<string>()
  for (const n of (data ?? []) as Array<{ published_at: string | null; procurement_notice_sources: Array<{ source: string; external_ref: string | null }> | null }>) {
    const pub = swedishDate(n.published_at)
    if (!pub || Math.abs(daysBetweenIso(pub, item.publishedDate)) > 2) continue
    for (const s of n.procurement_notice_sources ?? []) {
      if (s.source === 'mercell' && s.external_ref?.startsWith('kommers:')) refs.add(s.external_ref)
    }
  }
  return refs.size === 1 ? [...refs][0] : null
}

// ---------------------------------------------------------------------------

function paramOf(req: VercelRequest, name: string): string | null {
  const v = req.query?.[name]
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? null : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const sinceParam = paramOf(req, 'since')
  const since = sinceParam && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam) ? sinceParam : null
  const old = paramOf(req, 'old') === '1'

  const result = await withCronLog('procurement-sync-kommers', async () => {
    const started = Date.now()
    const outOfTime = () => Date.now() - started > TIME_BUDGET_MS
    const rules = await loadWatchRules()

    const found = new Map<string, KommersListItem>()
    const searches: Array<{ label: string; hits: number; pages: number; error?: string }> = []
    const errors: Array<{ id: string; message: string }> = []
    const ingested: IngestResult[] = []
    let preScored = 0
    let detailsFetched = 0
    let detailsMissing = 0
    let skippedSince = 0
    let skippedZero = 0
    let budgetHit = false

    try {
      // 1. Formulär, token och kaka
      const state = await loadForm()
      const cpvNames = Object.values(KOMMERS_PEST_CPV).filter((n) => state.cpvOptions.includes(n))
      const missingCpv = Object.entries(KOMMERS_PEST_CPV)
        .filter(([, n]) => !state.cpvOptions.includes(n))
        .map(([c]) => c)

      // 2. Sökningar
      const plan: Array<{ label: string; s: KommersSearch }> = []
      if (cpvNames.length > 0) plan.push({ label: `cpv:${cpvNames.length}`, s: { cpvNames, old } })
      for (const kw of KOMMERS_KEYWORDS) plan.push({ label: `ord:${kw}`, s: { searchString: kw, old } })

      for (const p of plan) {
        const stat: { label: string; hits: number; pages: number; error?: string } = { label: p.label, hits: 0, pages: 0 }
        searches.push(stat)
        try {
          let page = 1
          while (page <= MAX_PAGES_PER_SEARCH) {
            if (outOfTime()) {
              budgetHit = true
              break
            }
            const list = await search(state, { ...p.s, page })
            stat.pages = page
            for (const it of list.items) {
              stat.hits++
              if (!found.has(it.sourceId)) found.set(it.sourceId, it)
            }
            if (list.items.length === 0 || page >= list.pageCount) break
            page++
          }
        } catch (err) {
          stat.error = err instanceof Error ? err.message : String(err)
        }
      }
      if (searches.length > 0 && searches.every((s) => s.error)) throw new Error(`Alla Kommers-sökningar fallerade: ${searches[0].error}`)

      // 3. Förhandsannonser
      if (!outOfTime()) {
        try {
          const resp = await kommersFetch(`${KOMMERS_BASE}${KOMMERS_PRIOR_LIST_PATH}`)
          if (!resp.ok) throw new Error(`Kommers förhandsannonser svarade ${resp.status}`)
          const list = parseListPage(await resp.text())
          // TODO: sidbläddring om listan någon gång får fler sidor (6 poster, ingen bläddring 2026-09-25)
          for (const it of list.items) if (!found.has(it.sourceId)) found.set(it.sourceId, it)
          searches.push({ label: 'förhandsannonser', hits: list.items.length, pages: 1 })
        } catch (err) {
          searches.push({ label: 'förhandsannonser', hits: 0, pages: 0, error: err instanceof Error ? err.message : String(err) })
        }
      }

      // 4. Poängsätt, hämta detaljer för träffar, läs in
      for (const item of found.values()) {
        if (since && item.publishedDate && item.publishedDate < since) {
          skippedSince++
          continue
        }
        if (preScore(item, rules) <= 0) {
          skippedZero++
          continue
        }
        preScored++
        if (outOfTime()) {
          budgetHit = true
          break
        }
        try {
          const resp = await kommersFetch(kommersDetailUrl(item.type, item.id))
          const detail = resp.ok ? parseDetailPage(await resp.text()) : null
          if (detail) detailsFetched++
          else detailsMissing++

          const provisional = toCandidate(item, detail, null)
          const full = scoreNotice(
            { title: provisional.title, description: provisional.description ?? null, cpv_codes: provisional.cpv, county_codes: provisional.countyCodes },
            rules
          )
          if (full.score <= 0) {
            skippedZero++
            continue
          }
          const externalRef = await resolveExternalRef(item, detail, provisional.title)
          ingested.push(await ingestNotice({ ...provisional, externalRef }))
        } catch (err) {
          errors.push({ id: item.sourceId, message: err instanceof Error ? err.message : String(err) })
        }
      }

      const notified = await notifyNewMatches(ingested)
      await recordHealth('kommers', true, { count: found.size })

      const searchErrors = searches.filter((s) => s.error).length
      return {
        status: errors.length > 0 || searchErrors > 0 || budgetHit ? ('partial' as const) : ('success' as const),
        summary: {
          since,
          old,
          searches,
          missing_cpv_options: missingCpv,
          listed: found.size,
          skipped_since: skippedSince,
          skipped_zero: skippedZero,
          scored: preScored,
          details_fetched: detailsFetched,
          details_missing: detailsMissing,
          ingested: ingested.length,
          created: ingested.filter((r) => r.created).length,
          matches: ingested.filter((r) => r.created && r.score >= 60).length,
          notified,
          budget_hit: budgetHit,
          errors: errors.slice(0, 20),
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await recordHealth('kommers', false, { error: message })
      throw err
    }
  })

  if (result.status === 'failed') return res.status(500).json({ success: false, error: result.errorMessage })
  return res.status(200).json({ success: true, ...(result.summary as object) })
}
