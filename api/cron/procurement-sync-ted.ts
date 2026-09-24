// api/cron/procurement-sync-ted.ts
// Daglig synk mot TED Search API v3 (eForms): annonser, tilldelningar och
// förhandsannonser för svenska köpare inom skadedjur och närliggande CPV.
// Dagligen 07:15 svensk tid (vercel.json, UTC).
//
//   - Annonser (cn-*) och direktupphandlingsliknande poster läses in som
//     upphandlingar med dedup mot Mercell (TED-numret) och matchning.
//   - Tilldelningar (can-*) blir procurement_awards (en rad per vinnare) och
//     procurement_bidders (alla anbudsgivare, även förlorare).
//   - Förhandsannonser (pin-*) blir signaler.
//
// Verifierat mot API:et 2026-09-24: query-syntaxen nedan, publication-date i
// formatet ÅÅÅÅMMDD, svaret { notices, totalNoticeCount }. Namnfält är objekt
// per språk ({ swe: [...] }) och kan innehålla &amp;.
//
// AVVIKELSE från planen: winner-identifier innehåller ALLA anbudsgivares orgnr,
// inte bara vinnarnas (samma lista som organisation-identifier-tenderer).
// Exempel 658732-2026: vinnare BeGone, men winner-identifier listar Anticimex,
// BeGone, Ocab och Rentokil. Därför paras organisation-name-tenderer ihop med
// organisation-identifier-tenderer i ordning, och vinnarna är de namn i
// winner-name som återfinns bland anbudsgivarna.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import {
  db,
  ingestNotice,
  notifyAwardOnOurBid,
  notifyNewMatches,
  politeFetch,
  recordHealth,
  sleep,
  upsertAward,
  upsertBidder,
  refreshAwardDerivedData,
  type IngestResult,
} from '../_lib/procurement'
import {
  addDaysIso,
  cleanText,
  countiesFromNuts,
  normalizeName,
  normalizeTedNumber,
  quarterOf,
  tedDate,
  todaySwedish,
} from '../../src/shared/procurementRules'
import type { ProcurementCriteriaType, ProcurementNoticeKind } from '../../src/types/procurement'

export const config = { maxDuration: 300 }

const API = 'https://api.ted.europa.eu/v3/notices/search'
const CPV = '90920000 90921000 90922000 90923000 90924000 90900000 90910000 70330000 50700000'
const TIME_BUDGET_MS = 240_000

export const TED_FIELDS = [
  'notice-type', 'publication-number', 'publication-date', 'notice-title', 'title-lot', 'title-proc', 'description-lot',
  'organisation-identifier-buyer', 'buyer-name', 'place-of-performance', 'classification-cpv',
  'deadline-receipt-tender-date-lot', 'deadline-receipt-answers-date-lot', 'public-opening-date-lot',
  'estimated-value-proc', 'estimated-value-lot', 'procedure-type', 'framework-agreement-lot',
  'award-criterion-type-lot', 'award-criterion-description-lot', 'award-criterion-name-lot', 'award-criterion-number-weight-lot',
  'contract-duration-start-date-lot', 'contract-duration-end-date-lot', 'duration-period-value-lot', 'duration-period-unit-lot',
  'renewal-maximum-lot', 'winner-name', 'winner-identifier', 'organisation-name-tenderer', 'organisation-identifier-tenderer',
  'received-submissions-type-val', 'received-submissions-type-code', 'tender-value-lowest', 'tender-value-highest', 'tender-value',
  'tender-rank', 'winner-decision-date', 'contract-conclusion-date', 'document-url-lot', 'result-value-lot',
  'framework-maximum-value-lot', 'links',
]

type Multi = Record<string, string[] | string> | undefined
type TedNotice = Record<string, unknown> & {
  'publication-number': string
  'notice-type'?: string
  links?: { html?: Record<string, string> }
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)])
const first = (v: unknown): string | null => arr(v)[0] ?? null
const num = (v: unknown): number | null => {
  const s = first(v)
  const n = s == null ? NaN : Number(s)
  return Number.isFinite(n) ? n : null
}
/** Språkobjekt: svenska först, annars engelska, annars första språket */
function lang(v: unknown): string[] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return arr(v)
  const o = v as Multi & object
  const pick = (o as Record<string, unknown>).swe ?? (o as Record<string, unknown>).eng ?? Object.values(o)[0]
  return arr(pick).map((s) => cleanText(s))
}

function kindOf(noticeType: string | undefined): ProcurementNoticeKind | 'can' | 'pin' {
  const t = noticeType ?? ''
  if (t.startsWith('can-') || t === 'veat') return 'can'
  if (t.startsWith('pin-')) return 'pin'
  if (t.startsWith('cn-')) return 'tender'
  if (t.startsWith('corr') || t.startsWith('mod')) return 'modification'
  return 'other'
}

function criteriaOf(types: string[]): ProcurementCriteriaType | null {
  const set = new Set(types.map((t) => t.toLowerCase()))
  if (set.size === 0) return null
  if (set.size === 1 && set.has('price')) return 'price'
  if (set.size === 1 && set.has('cost')) return 'cost'
  if (!set.has('price') && !set.has('cost')) return 'quality'
  return 'mixed'
}

function durationMonths(n: TedNotice): number | null {
  const v = num(n['duration-period-value-lot'])
  const periods = n['contract-duration-period-lot']
  const period: unknown = Array.isArray(periods) ? periods[0] : periods
  const periodUnit = period && typeof period === 'object' ? String((period as { unit?: unknown }).unit ?? '') || null : null
  const unit = (first(n['duration-period-unit-lot']) ?? periodUnit ?? '').toLowerCase()
  if (v != null) {
    if (unit.startsWith('year') || unit === 'ann') return v * 12
    if (unit.startsWith('month') || unit === 'mon') return v
    if (unit.startsWith('day')) return Math.round(v / 30)
  }
  const s = tedDate(first(n['contract-duration-start-date-lot']))
  const e = tedDate(first(n['contract-duration-end-date-lot']))
  if (s && e) {
    const [ys, ms] = s.split('-').map(Number)
    const [ye, me] = e.split('-').map(Number)
    return (ye - ys) * 12 + (me - ms)
  }
  return null
}

/** Anbudsgivare med orgnr i ordning, vinnare markerade (se avvikelsen i filhuvudet) */
export function tendererList(n: TedNotice): Array<{ name: string; org: string | null; isWinner: boolean }> {
  const names = lang(n['organisation-name-tenderer'])
  const ids = arr(n['organisation-identifier-tenderer'])
  const winners = lang(n['winner-name'])
  const winnerIds = arr(n['winner-identifier'])
  const winnerNorm = new Set(winners.map(normalizeName))
  if (names.length > 0) {
    const seen = new Set<string>()
    const out: Array<{ name: string; org: string | null; isWinner: boolean }> = []
    names.forEach((name, i) => {
      const org = names.length === ids.length ? ids[i] : null
      const key = org ?? normalizeName(name)
      if (seen.has(key)) return
      seen.add(key)
      out.push({ name, org, isWinner: winnerNorm.has(normalizeName(name)) })
    })
    return out
  }
  // Utan anbudsgivarfält: bara vinnarna, orgnr när listorna är lika långa
  const uniq = Array.from(new Set(winners))
  return uniq.map((name, i) => ({ name, org: uniq.length === winnerIds.length ? winnerIds[i] : null, isWinner: true }))
}

async function search(query: string, page: number): Promise<{ notices: TedNotice[]; total: number }> {
  const resp = await politeFetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, fields: TED_FIELDS, limit: 100, page, scope: 'ALL' }),
  })
  if (!resp.ok) throw new Error(`TED svarade ${resp.status}: ${(await resp.text()).slice(0, 300)}`)
  const body = (await resp.json()) as { notices?: TedNotice[]; totalNoticeCount?: number }
  return { notices: body.notices ?? [], total: body.totalNoticeCount ?? 0 }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('procurement-sync-ted', async () => {
    const started = Date.now()
    // Från och med i går i svensk tid; ?since=ÅÅÅÅ-MM-DD för manuell omkörning
    const sinceParam = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.since) ? req.query.since : null
    const since = (sinceParam ?? addDaysIso(todaySwedish(), -1)).replace(/-/g, '')
    const query = `classification-cpv IN (${CPV}) AND buyer-country = SWE AND publication-date >= ${since}`

    const ingested: IngestResult[] = []
    const errors: Array<{ ref: string; message: string }> = []
    let fetched = 0
    let awards = 0
    let bidders = 0
    let signals = 0

    try {
      for (let page = 1; page <= 20 && Date.now() - started < TIME_BUDGET_MS; page++) {
        const { notices } = await search(query, page)
        fetched += notices.length
        for (const n of notices) {
          const ref = normalizeTedNumber(n['publication-number']) ?? String(n['publication-number'])
          try {
            await handleNotice(n, ref, ingested, (a, b) => {
              awards += a
              bidders += b
            }, () => {
              signals++
            })
          } catch (err) {
            errors.push({ ref, message: err instanceof Error ? err.message : String(err) })
          }
        }
        if (notices.length < 100) break
        await sleep(1000)
      }

      const notified = await notifyNewMatches(ingested)
      const derived = await refreshAwardDerivedData()
      await recordHealth('ted', true, { count: fetched })
      return {
        status: errors.length > 0 ? ('partial' as const) : ('success' as const),
        summary: {
          since,
          fetched,
          ingested: ingested.length,
          created: ingested.filter((r) => r.created).length,
          awards,
          bidders,
          signals,
          notified,
          followups: derived.followups,
          errors: errors.slice(0, 20),
        },
      }
    } catch (err) {
      await recordHealth('ted', false, { error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  })

  if (result.status === 'failed') return res.status(500).json({ success: false, error: result.errorMessage })
  return res.status(200).json({ success: true, ...(result.summary as object) })
}

async function handleNotice(
  n: TedNotice,
  ref: string,
  ingested: IngestResult[],
  countAward: (awards: number, bidders: number) => void,
  countSignal: () => void
): Promise<void> {
  const kind = kindOf(n['notice-type'])
  // Delområdets titel är ofta bara "Del 1": då vinner upphandlingens titel
  const lotTitle = lang(n['title-lot'])[0] ?? null
  const procTitle = lang(n['title-proc'])[0] ?? null
  const genericLot = !!lotTitle && /^(del|delområde|anbudsområde|lot|område)\s*\d+\s*$/i.test(lotTitle)
  const title = (genericLot ? procTitle : null) ?? lotTitle ?? procTitle ?? lang(n['notice-title'])[0] ?? 'Utan titel'
  const buyerName = lang(n['buyer-name'])[0] ?? null
  const buyerOrg = first(n['organisation-identifier-buyer'])
  const nuts = arr(n['place-of-performance']).map((c) => c.toUpperCase())
  const counties = countiesFromNuts(nuts)
  const cpv = Array.from(new Set(arr(n['classification-cpv'])))
  const link = n.links?.html?.SWE ?? `https://ted.europa.eu/sv/notice/-/detail/${ref}`
  const criteria = criteriaOf(arr(n['award-criterion-type-lot']))
  const framework = first(n['framework-agreement-lot'])
  const renewalMax = num(n['renewal-maximum-lot'])
  const contractStart = tedDate(first(n['contract-duration-start-date-lot']))
  const contractEnd = tedDate(first(n['contract-duration-end-date-lot']))
  const raw = { ...n }
  delete (raw as Record<string, unknown>).links

  if (kind === 'pin') {
    const db0 = db()
    await db0.from('procurement_signals').upsert(
      {
        signal_key: `ted:${ref}`,
        signal_type: 'prior_information',
        buyer_name: buyerName,
        text: title,
        expected_quarter: quarterOf(contractStart ?? tedDate(first(n['publication-date']))),
        reliability: 'high',
        source: 'ted',
        url: link,
        raw,
      },
      { onConflict: 'signal_key', ignoreDuplicates: true }
    )
    countSignal()
    return
  }

  // Annonsen (eller tilldelningen) som upphandling i bevakningen
  const r = await ingestNotice({
    source: 'ted',
    sourceId: ref,
    externalRef: ref,
    url: link,
    raw,
    title,
    description: lang(n['description-lot'])[0] ?? null,
    buyerName,
    buyerOrgNumber: buyerOrg,
    cpv,
    nuts,
    countyCodes: counties,
    publishedAt: tedDate(first(n['publication-date'])),
    tenderDeadline: first(n['deadline-receipt-tender-date-lot']),
    openingAt: first(n['public-opening-date-lot']),
    estimatedValue: num(n['estimated-value-proc']) ?? num(n['estimated-value-lot']),
    procedureType: typeof n['procedure-type'] === 'string' ? (n['procedure-type'] as string) : first(n['procedure-type']),
    isFramework: framework ? framework !== 'none' : null,
    contractStart,
    contractEnd,
    renewalMax,
    durationMonths: durationMonths(n),
    criteriaType: criteria,
    kind: kind === 'can' ? 'award' : (kind as ProcurementNoticeKind),
    platformUrl: first(n['document-url-lot']) ?? link,
    documentUrl: first(n['document-url-lot']),
  })
  // Frågor senast: bara om fältet är tomt (användaren kan ha rättat)
  const answers = first(n['deadline-receipt-answers-date-lot'])
  if (answers) {
    await db().from('procurement_notices').update({ questions_deadline: answers }).eq('id', r.noticeId).is('questions_deadline', null)
  }
  ingested.push(r)

  if (kind !== 'can') return

  // Tilldelning: en rad per vinnare, alla anbudsgivare som bidders
  const tenderers = tendererList(n)
  const winners = tenderers.filter((t) => t.isWinner)
  const bidsReceived = num(n['received-submissions-type-val'])
  const lowest = num(n['tender-value-lowest'])
  const highest = num(n['tender-value-highest'])
  const tenderValues = arr(n['tender-value']).map(Number).filter(Number.isFinite)
  const ceiling = num(n['framework-maximum-value-lot']) ?? num(n['result-value-lot'])
  const awardDate = tedDate(first(n['winner-decision-date']))
  const signed = tedDate(first(n['contract-conclusion-date']))
  let awardCount = 0
  let bidderCount = 0

  const winnerRows = winners.length > 0 ? winners : [{ name: lang(n['winner-name'])[0] ?? '', org: null, isWinner: true }]
  for (const [i, w] of winnerRows.entries()) {
    if (!w.name) continue
    // Verkligt pris bara när en ensam vinnare och ett ensamt anbudsvärde går att para ihop
    const actual = winnerRows.length === 1 && tenderValues.length === 1 ? tenderValues[0] : null
    const awardId = await upsertAward({
      source: 'ted',
      sourceRef: ref,
      noticeId: r.noticeId,
      buyerName,
      buyerOrgNumber: buyerOrg,
      nuts,
      title,
      cpv,
      countyCode: counties[0] ?? null,
      winnerName: w.name,
      winnerOrgNumber: w.org,
      value: actual ?? ceiling ?? num(n['estimated-value-proc']),
      valueKind: actual != null ? 'actual' : ceiling != null ? 'ceiling' : num(n['estimated-value-proc']) != null ? 'estimated' : 'unknown',
      bidsReceived,
      lowestBid: lowest,
      highestBid: highest,
      criteriaType: criteria,
      procedureType: first(n['procedure-type']),
      isFramework: framework ? framework !== 'none' : null,
      awardDate,
      contractSignedDate: signed,
      contractStart,
      contractEnd,
      renewalMax,
      durationMonths: durationMonths(n),
      durationText: lang(n['description-lot'])[0] ?? null,
      raw: i === 0 ? raw : null,
    })
    awardCount++
    if (i === 0) {
      for (const t of tenderers) {
        await upsertBidder({
          source: 'ted',
          sourceRef: ref,
          noticeId: r.noticeId,
          awardId: t.isWinner ? awardId : null,
          name: t.name,
          orgNumber: t.org,
          isWinner: t.isWinner,
          price: t.isWinner && actual != null ? actual : null,
        })
        bidderCount++
      }
    }
  }
  countAward(awardCount, bidderCount)
  await notifyAwardOnOurBid(r.noticeId, winnerRows.map((w) => w.name).filter(Boolean).join(', '), bidsReceived)
}
