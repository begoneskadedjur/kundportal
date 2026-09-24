// api/cron/procurement-sync-mercell.ts
// Hämtar nya svenska upphandlingar från Mercells publika sök-API (alla fem
// registrerade svenska annonsdatabaser plus TED). Varje timme 06 till 22 på
// vardagar (vercel.json, UTC).
//
// Flöde per körning:
//   1. Sida för sida, nyast först (API:et sorterar på publiceringstid, verifierat
//      2026-09-24), 100 poster per sida, högst ett anrop per sekund.
//   2. Stoppa när alla poster på sidan är äldre än nyaste posten från förra
//      lyckade körningen (procurement_source_health.cursor), eller när
//      tidsbudgeten tar slut. Första körningen går igenom indexet så långt tidsbudgeten räcker.
//   3. Varje post matchas först i minnet mot bevakningsreglerna. Bara poster
//      med poäng läses in (dedup, köpare, källpost); resten av Sveriges
//      upphandlingar lagras inte.
//   4. Tilldelningar (ContractAward) blir procurement_awards med Mercells
//      contractExpiryDate som avtalsslut. Planerade poster (RFI, PriorInformation,
//      UpcomingTenders) blir signaler.
//   5. Notiser: ny träff från 60 poäng, direktnotis och mejl vid 100.
//
// Verifierat mot API:et 2026-09-24: parametrarna filter=delivery_place_code:SE,
// lng, page, pageSize; svaret { numRes, page, pageSize, results[] }; fälten nedan.
// Mercells TED-poster har sourceId 'TED' och sourceNoticeId som TED-numret med
// inledande nollor (00657962-2026), vilket normaliseras för dedup mot TED-synken.
// Verifierat 2026-09-25: Mercells annonssida är https://app.mercell.com/tender/{id}
// med samma id som sök-API:et (även negativa id). Mallen kan bytas med
// MERCELL_NOTICE_URL_TEMPLATE.
// Kommers-poster har sourceId som börjar på 'Kom' (Kom Traf, Kom Lite ...) och
// sourceNoticeId = Kommers annons-id. De får external_ref kommers:{id} så att
// Kommers-synken (procurement-sync-kommers) dedupar mot dem.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import {
  db,
  ingestNotice,
  loadWatchRules,
  notifyNewMatches,
  notifyAwardOnOurBid,
  politeFetch,
  recordHealth,
  sleep,
  upsertAward,
  refreshAwardDerivedData,
  type IngestResult,
  type NoticeCandidate,
} from '../_lib/procurement'
import {
  cleanText,
  countiesFromNuts,
  countyFromName,
  normalizeTedNumber,
  quarterOf,
  scoreNotice,
  swedishDate,
} from '../../src/shared/procurementRules'
import type { ProcurementNoticeKind } from '../../src/types/procurement'

export const config = { maxDuration: 300 }

const API = 'https://search-service-api.discover.app.mercell.com/public/api/v1/search'
const PAGE_SIZE = 100
const TIME_BUDGET_MS = 240_000
const MAX_PAGES = 80
const URL_TEMPLATE = process.env.MERCELL_NOTICE_URL_TEMPLATE || 'https://app.mercell.com/tender/{id}'

interface MercellItem {
  id: string
  title: string | null
  description: string | null
  authorityTown: string | null
  publicationDate: string | null
  deadline: string | null
  value: number | null
  valueUnit: string | null
  contractExpiryDate: string | null
  awardedSuppliers: string[] | null
  deliveryPlaceCodes: string[] | null
  deliveryPlaceNames: string[] | null
  cpvCodes: string[] | null
  docTypeCode: string | null
  boppCategory: string | null
  tenderStatus: string | null
  sourceId: string | null
  sourceNoticeId: string | null
  frameworkAgreement: boolean | null
  expectedPublicationDate: string | null
}

function kindOf(docType: string | null): ProcurementNoticeKind {
  switch (docType) {
    case 'DirectProcurement':
      return 'direct'
    case 'RequestForInformation':
      return 'rfi'
    case 'PriorInformation':
    case 'PriorInformationCfc':
    case 'PeriodicIndicative':
      return 'prior_information'
    case 'ContractAward':
    case 'VoluntaryExAnteTransparency':
      return 'award'
    case 'ContractModification':
      return 'modification'
    case 'Contract':
    case 'ContractLov':
    case 'ConcessionNotice':
    case 'DesignContest':
    case 'QualificationSystem':
    case 'PurchaseAd':
      return 'tender'
    default:
      return 'other'
  }
}

/** authorityTown är "Köpare, Ort" eller bara köparen */
function buyerFromTown(town: string | null): string | null {
  const t = cleanText(town)
  if (!t) return null
  const idx = t.lastIndexOf(',')
  return idx > 0 ? t.slice(0, idx).trim() : t
}

function toCandidate(it: MercellItem): NoticeCandidate {
  const nuts = (it.deliveryPlaceCodes ?? []).map((c) => String(c).toUpperCase())
  const counties = Array.from(
    new Set([...countiesFromNuts(nuts), ...(it.deliveryPlaceNames ?? []).map(countyFromName).filter((c): c is string => !!c)])
  )
  const isTed = (it.sourceId ?? '').trim().toUpperCase() === 'TED'
  const tedRef = isTed ? normalizeTedNumber(it.sourceNoticeId) : null
  const isKommers = /^kom/i.test((it.sourceId ?? '').trim())
  const kommersRef = isKommers && it.sourceNoticeId ? `kommers:${String(it.sourceNoticeId).trim()}` : null
  return {
    source: 'mercell',
    sourceId: String(it.id),
    sourceSub: it.sourceId?.trim() || null,
    externalRef: tedRef ?? kommersRef,
    url: tedRef ? `https://ted.europa.eu/sv/notice/-/detail/${tedRef}` : URL_TEMPLATE.replace('{id}', encodeURIComponent(String(it.id))),
    raw: it,
    title: cleanText(it.title) || 'Utan titel',
    description: it.description,
    buyerName: buyerFromTown(it.authorityTown),
    buyerOrgNumber: null,
    cpv: (it.cpvCodes ?? []).map(String),
    nuts,
    countyCodes: counties,
    publishedAt: it.publicationDate,
    tenderDeadline: it.deadline,
    estimatedValue: it.value != null && (it.valueUnit ?? 'SEK') === 'SEK' ? Number(it.value) : null,
    currency: it.valueUnit ?? 'SEK',
    isFramework: it.frameworkAgreement ?? null,
    contractEnd: it.contractExpiryDate ? swedishDate(it.contractExpiryDate) : null,
    kind: kindOf(it.docTypeCode),
    sourceStatus: it.tenderStatus,
    platformUrl: tedRef ? `https://ted.europa.eu/sv/notice/-/detail/${tedRef}` : null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('procurement-sync-mercell', async () => {
    const started = Date.now()
    const sb = db()
    const { data: health } = await sb.from('procurement_source_health').select('cursor').eq('source', 'mercell').maybeSingle()
    const cursor = health?.cursor ?? null
    const rules = await loadWatchRules()

    let page = 1
    let scanned = 0
    let newestSeen: string | null = null
    let reachedCursor = false
    const ingested: IngestResult[] = []
    const errors: Array<{ id: string; message: string }> = []
    let signals = 0
    let awards = 0

    try {
      while (page <= MAX_PAGES && Date.now() - started < TIME_BUDGET_MS) {
        const url = `${API}?filter=${encodeURIComponent('delivery_place_code:SE')}&lng=sv&page=${page}&pageSize=${PAGE_SIZE}`
        const resp = await politeFetch(url)
        if (!resp.ok) throw new Error(`Mercell svarade ${resp.status}`)
        const body = (await resp.json()) as { results?: MercellItem[]; numRes?: number }
        const items = body.results ?? []
        if (items.length === 0) break
        scanned += items.length

        for (const it of items) {
          if (it.publicationDate && (!newestSeen || it.publicationDate > newestSeen)) newestSeen = it.publicationDate
          if (cursor && it.publicationDate && it.publicationDate <= cursor) continue
          const cand = toCandidate(it)
          const pre = scoreNotice({ title: cand.title, description: cand.description ?? null, cpv_codes: cand.cpv, county_codes: cand.countyCodes }, rules)
          if (pre.score <= 0) continue
          try {
            const r = await ingestNotice(cand)
            ingested.push(r)

            // Tilldelning: en rad per namngiven leverantör (Mercell saknar orgnr)
            if (cand.kind === 'award' && (it.awardedSuppliers ?? []).length > 0) {
              for (const supplier of it.awardedSuppliers ?? []) {
                await upsertAward({
                  source: 'mercell',
                  sourceRef: String(it.id),
                  noticeId: r.noticeId,
                  buyerName: cand.buyerName,
                  nuts: cand.nuts,
                  title: cand.title,
                  cpv: cand.cpv,
                  countyCode: cand.countyCodes[0] ?? null,
                  winnerName: supplier,
                  value: cand.estimatedValue,
                  valueKind: cand.estimatedValue != null ? 'ceiling' : 'unknown',
                  awardDate: swedishDate(it.publicationDate),
                  mercellExpiry: it.contractExpiryDate,
                  durationText: it.description,
                  raw: it,
                })
                awards++
              }
              await notifyAwardOnOurBid(r.noticeId, (it.awardedSuppliers ?? []).join(', '), null)
            }

            // Planerade poster blir signaler (framförhållning, planens avsnitt 3)
            if (cand.kind === 'rfi' || cand.kind === 'prior_information' || it.boppCategory === 'UpcomingTenders') {
              const expected = it.expectedPublicationDate ?? it.deadline ?? null
              await sb.from('procurement_signals').upsert(
                {
                  signal_key: `mercell:${it.id}`,
                  signal_type: cand.kind === 'rfi' ? 'rfi' : cand.kind === 'prior_information' ? 'prior_information' : 'upcoming',
                  buyer_name: cand.buyerName,
                  text: cand.title,
                  expected_quarter: quarterOf(swedishDate(expected)),
                  reliability: cand.kind === 'prior_information' ? 'high' : 'medium',
                  source: 'mercell',
                  url: cand.url,
                  notice_id: r.noticeId,
                  raw: { docTypeCode: it.docTypeCode, boppCategory: it.boppCategory, deadline: it.deadline },
                },
                { onConflict: 'signal_key', ignoreDuplicates: true }
              )
              signals++
            }
          } catch (err) {
            errors.push({ id: String(it.id), message: err instanceof Error ? err.message : String(err) })
          }
        }

        // Hela sidan äldre än förra körningen: klart
        if (cursor && items.every((it) => !it.publicationDate || it.publicationDate <= cursor)) {
          reachedCursor = true
          break
        }
        if (items.length < PAGE_SIZE) break
        page++
        await sleep(1000)
      }

      const notified = await notifyNewMatches(ingested)
      if (awards > 0) await refreshAwardDerivedData()
      // Cursorn flyttas bara när vi faktiskt nått förra körningens nyaste post
      // (eller det här var första körningen och hela indexet gicks igenom),
      // annars riskerar vi att hoppa över poster efter en avbruten körning.
      const complete = reachedCursor || !cursor
      const newCursor = complete && newestSeen ? newestSeen : cursor
      await recordHealth('mercell', true, { count: scanned, cursor: newCursor })

      return {
        status: errors.length > 0 ? ('partial' as const) : ('success' as const),
        summary: {
          pages: page,
          scanned,
          ingested: ingested.length,
          created: ingested.filter((r) => r.created).length,
          matches: ingested.filter((r) => r.created && r.score >= 60).length,
          awards,
          signals,
          notified,
          reached_cursor: reachedCursor,
          errors: errors.slice(0, 20),
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await recordHealth('mercell', false, { error: message })
      throw err
    }
  })

  if (result.status === 'failed') return res.status(500).json({ success: false, error: result.errorMessage })
  return res.status(200).json({ success: true, ...(result.summary as object) })
}
