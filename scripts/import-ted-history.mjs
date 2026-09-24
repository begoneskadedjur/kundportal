#!/usr/bin/env node
// scripts/import-ted-history.mjs
// Historiska tilldelningar för skadedjursbekämpning (CPV 9092) i Sverige ur TED
// till procurement_buyers, procurement_suppliers, procurement_awards och
// procurement_bidders. Plan: docs/upphandlingsportal-plan.md avsnitt 2, 3, 7 och 8.
//
// Två delar:
//   a) eForms via TED Search API v3, november 2023 och framåt (source 'ted').
//      POST https://api.ted.europa.eu/v3/notices/search, 100 per sida, sidnummer
//      tills en sida har färre än 100. Fixture: scripts/data/procurement/ua/ted_can.json
//      (144 tilldelningar 2016 till 2026, varav de från 2023-11-01 är eForms).
//   b) Äldre TED-XML 2016 till oktober 2023 (source 'ted_xml'). Samma sökning med
//      publiceringsdatum 2016-01-01 till 2023-10-31 ger numren, XML hämtas från
//      https://ted.europa.eu/en/notice/{nummer}/xml. Fixture: ua/lx/*.xml (82 filer).
//      Tolken är strängbaserad och klarar både R2.0.9 (F03/F06) och R2.0.8
//      (CONTRACT_AWARD med AWARD_OF_CONTRACT).
//
// Verifierat 2026-09-24: sökfrågan nedan fungerar som den står, även för
// 2016 till 2023 (API:et svarar med gamla nummer och XML-länkar).
//
// VIKTIG avvikelse från planen: i eForms innehåller winner-identifier ALLA
// anbudsgivares orgnr, inte bara vinnarnas (samma lista som
// organisation-identifier-tenderer). Därför:
//   anbudsgivare = zip(organisation-name-tenderer, organisation-identifier-tenderer)
//   vinnare      = namnen i winner-name som matchar en anbudsgivare efter normalizeName,
//                  med den anbudsgivarens orgnr. Saknas anbudsgivarfälten används
//                  winner-identifier bara när längden är lika med winner-name.
// Orgnr 556526-3976 förekommer både som Nomor AB och Rentokil Sverige AB:
// leverantören är orgnret, det andra namnet blir alias.
//
// Värde per vinnare: tender-value för de vinnande anbuden (BT-3202-Contract
// pekar ut TEN-nummer i samma ordning som winner-name) som 'actual', annars
// summan av result-value-lot eller framework-maximum-value-lot som 'ceiling',
// annars estimated-value-proc som 'estimated'. Flera vinnare i samma upphandling
// får samma ramtak (samma räkning som UHM:s kontrakterade värde). Belopp i annan
// valuta än SEK sparas inte som värde, bara i raw.
// Flera delområden: tidigaste avtalsslutet används, så att bearbetningsfönstret
// öppnar för det första delområdet som går ut.
//
// Körning:
//   node scripts/import-ted-history.mjs --fixtures --dry-run
//   node scripts/import-ted-history.mjs --fixtures
//   node scripts/import-ted-history.mjs --dry-run --limit 50
//   node scripts/import-ted-history.mjs
// Flaggor: --dry-run, --fixtures, --limit N (per del), --mode eforms|xml|all,
//          --xml-dir katalog (standard scripts/data/procurement/ua/lx), --verbose.
//
// Idempotent: award_key ted:{nummer}:{orgnr} och bidder_key på samma form som
// upsertAward/upsertBidder i api/_lib/procurement.ts, så att synken
// (api/cron/procurement-sync-ted) och den här importen skriver samma rader.
// notice_id kopplas när procurement_notice_sources har en rad med
// external_ref = tilldelningens nummer eller (XML) den ursprungliga annonsens nummer.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import {
  BEGONE_ORG,
  DATA_DIR,
  EntityRegistry,
  backfillAwardCounties,
  buildRows,
  cleanText,
  connect,
  countiesFromNuts,
  fmtKr,
  isPestRelevant,
  loadNoticeIds,
  normalizeName,
  normalizeOrgNumber,
  normalizeTedNumber,
  parseArgs,
  politeFetch,
  positiveNumber,
  prettifyUpperName,
  printTableCounts,
  tedDate,
  uniq,
  writeAll,
} from './lib/procurementImportShared.mjs'

const TED_SEARCH = 'https://api.ted.europa.eu/v3/notices/search'
const CPV_QUERY = 'classification-cpv IN (90920000 90921000 90922000 90923000 90924000) AND buyer-country = SWE'
const CAN_TYPES = 'notice-type IN (can-standard can-social can-desg can-tran)'
const EFORMS_QUERY = `${CPV_QUERY} AND ${CAN_TYPES} AND publication-date >= 20231101`
const XML_QUERY = `${CPV_QUERY} AND ${CAN_TYPES} AND publication-date >= 20160101 AND publication-date <= 20231031`
const EFORMS_FROM = '2023-11-01'

// Fältlistan från utredningen (ua/tedq.cjs), verifierad mot ua/tedfields.json
const FIELDS = [
  'publication-number', 'publication-date', 'notice-type', 'notice-title', 'title-proc', 'title-lot', 'buyer-name',
  'organisation-identifier-buyer', 'buyer-legal-type', 'place-of-performance', 'place-of-performance-subdiv-lot',
  'procedure-type', 'contract-nature', 'classification-cpv', 'winner-name', 'winner-identifier',
  'organisation-name-tenderer', 'organisation-identifier-tenderer', 'winner-size', 'winner-decision-date',
  'contract-conclusion-date', 'tender-value', 'tender-value-cur', 'tender-value-lowest', 'tender-value-highest',
  'result-value-lot', 'result-value-notice', 'result-framework-maximum-value-notice', 'framework-maximum-value-lot',
  'framework-estimated-value', 'estimated-value-lot', 'estimated-value-proc', 'received-submissions-type-code',
  'received-submissions-type-val', 'BT-759-LotResult', 'BT-760-LotResult', 'award-criterion-type-lot',
  'award-criterion-name-lot', 'award-criterion-number-weight-lot', 'award-criterion-number-lot',
  'award-criterion-description-lot', 'award-criterion-type-glo', 'contract-duration-period-lot',
  'duration-period-value-lot', 'duration-period-unit-lot', 'contract-duration-start-date-lot',
  'contract-duration-end-date-lot', 'renewal-maximum-lot', 'renewal-description-lot', 'option-description-lot',
  'framework-agreement-lot', 'contract-framework-agreement', 'tender-rank', 'BT-13713-LotResult', 'BT-142-LotResult',
  'BT-144-LotResult', 'BT-3202-Contract', 'BT-145-Contract', 'BT-1451-Contract', 'BT-150-Contract', 'BT-635-LotResult',
  'BT-636-LotResult', 'BT-712(a)-LotResult', 'document-url-lot', 'deadline-receipt-tender-date-lot',
  'deadline-receipt-answers-date-lot', 'public-opening-date-lot', 'links', 'BT-161-NoticeResult', 'BT-709-LotResult',
  'BT-710-LotResult', 'BT-711-LotResult', 'BT-720-Tender', 'BT-536-Lot', 'BT-537-Lot', 'BT-36-Lot', 'BT-36-Lot-Unit',
  'BT-539-Lot', 'BT-540-Lot', 'BT-541-Lot', 'BT-543-Lot', 'BT-5421-Lot', 'BT-5422-Lot', 'BT-5423-Lot', 'BT-54-lot',
  'BT-57-Lot', 'BT-58-Lot', 'BT-27-Lot', 'BT-27-Procedure', 'BT-26(m)-Lot', 'BT-262-Lot', 'BT-765-Lot', 'BT-766-Lot',
  'BT-1375-Procedure', 'BT-137-Lot', 'BT-21-Lot',
]

const args = parseArgs()
const verbose = !!args.rest.verbose
const mode = String(args.rest.mode ?? 'all')
const xmlDir = resolve(String(args.rest['xml-dir'] ?? resolve(DATA_DIR, 'ua', 'lx')))
if (!['eforms', 'xml', 'all'].includes(mode)) throw new Error('--mode ska vara eforms, xml eller all')

// ---------------------------------------------------------------------------
// Små hjälpare för TED-posternas form

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

/** Språkobjekt ({ swe: [...] }) till lista, svenska först, annars första språket */
function lang(v) {
  if (v == null) return []
  if (typeof v === 'string' || Array.isArray(v)) return arr(v)
  const pick = v.swe ?? v.eng ?? Object.values(v)[0]
  return arr(pick)
}

const nums = (v) => arr(v).map((x) => positiveNumber(x)).filter((x) => x != null)
const sum = (list) => (list.length ? list.reduce((a, b) => a + b, 0) : null)
const minDate = (v) => arr(v).map(tedDate).filter(Boolean).sort()[0] ?? null
const noticeTitle = (n) => cleanText(lang(n['title-proc'])[0] ?? lang(n['notice-title'])[0] ?? '')

// ---------------------------------------------------------------------------
// a) eForms

function parseEforms(n) {
  const ref = normalizeTedNumber(n['publication-number'])
  const pubDate = tedDate(n['publication-date'])
  const buyerOrg = arr(n['organisation-identifier-buyer'])[0] ?? null
  const buyerName = cleanText(lang(n['buyer-name'])[0])
  const nuts = uniq([...arr(n['place-of-performance-subdiv-lot']), ...arr(n['place-of-performance'])])
  const county = countiesFromNuts(nuts)[0] ?? null
  const title = cleanText(lang(n['title-proc'])[0] ?? lang(n['BT-21-Lot'])[0] ?? lang(n['notice-title'])[0])
  const cpv = uniq(arr(n['classification-cpv']))

  // Anbudsgivare: namn och orgnr i samma ordning
  const tNames = lang(n['organisation-name-tenderer']).map(cleanText)
  const tIds = arr(n['organisation-identifier-tenderer'])
  const tenderers = tNames.map((name, i) => ({ name, orgNumber: tNames.length === tIds.length ? tIds[i] : null }))
  const tenderByNorm = new Map(tenderers.map((t) => [normalizeName(t.name), t]))

  // Vinnare: winner-name matchat mot anbudsgivarna (winner-identifier är alla anbudsgivare)
  const wNames = lang(n['winner-name']).map(cleanText)
  const wIds = arr(n['winner-identifier'])
  const winnerOf = (name, i) => {
    const hit = tenderByNorm.get(normalizeName(name))
    if (hit) return { name, orgNumber: hit.orgNumber }
    if (tenderers.length === 0 && wNames.length === wIds.length) return { name, orgNumber: wIds[i] }
    return { name, orgNumber: null }
  }
  const winnerPerEntry = wNames.map(winnerOf)
  const winnerKey = (w) => normalizeOrgNumber(w.orgNumber) ?? normalizeName(w.name)
  const winners = new Map()
  for (const w of winnerPerEntry) if (!winners.has(winnerKey(w))) winners.set(winnerKey(w), { ...w, actual: [] })

  // Valuta: bara SEK blir värden
  const currency = arr(n['tender-value-cur'])[0] ?? null
  const sek = !currency || currency === 'SEK'

  // Verkligt pris per vinnare: BT-3202-Contract (TEN-nnnn) i samma ordning som winner-name
  const contracts = arr(n['BT-3202-Contract'])
  const tv = arr(n['tender-value']).map((x) => positiveNumber(x))
  if (sek && contracts.length > 0 && contracts.length === wNames.length && tv.length > 0) {
    contracts.forEach((c, i) => {
      let idx = null
      if (tv.length === contracts.length) idx = i
      else {
        const m = String(c).match(/^TEN-0*(\d+)$/)
        if (m && Number(m[1]) - 1 < tv.length) idx = Number(m[1]) - 1
      }
      const val = idx != null ? tv[idx] : null
      if (val != null) winners.get(winnerKey(winnerPerEntry[i]))?.actual.push(val)
    })
  }
  const ceiling = sek ? sum(nums(n['result-value-lot'])) ?? sum(nums(n['framework-maximum-value-lot'])) ?? sum(nums(n['result-value-notice'])) : null
  const estimated = sek ? positiveNumber(arr(n['estimated-value-proc'])[0]) : null

  // Antal anbud: första värdet för typen 'tenders', annars elektroniska anbud
  const codes = arr(n['received-submissions-type-code']).length ? arr(n['received-submissions-type-code']) : arr(n['BT-760-LotResult'])
  const vals = arr(n['received-submissions-type-val']).length ? arr(n['received-submissions-type-val']) : arr(n['BT-759-LotResult'])
  let bidsIdx = codes.indexOf('tenders')
  if (bidsIdx < 0) bidsIdx = codes.indexOf('t-esubm')
  const bidsReceived = bidsIdx >= 0 && vals[bidsIdx] != null ? Number(vals[bidsIdx]) : null

  const low = nums(n['tender-value-lowest'])
  const high = nums(n['tender-value-highest'])

  const crit = new Set(arr(n['award-criterion-type-lot']))
  let criteriaType = null
  if (crit.size) {
    const q = crit.has('quality')
    const p = crit.has('price') || crit.has('cost')
    criteriaType = q && p ? 'mixed' : q ? 'quality' : crit.has('price') ? 'price' : crit.has('cost') ? 'cost' : null
  }

  const fa = arr(n['framework-agreement-lot'])
  const renewals = arr(n['renewal-maximum-lot']).map(Number).filter((x) => Number.isFinite(x))

  // Pris och placering per anbudsgivare bara när det går att para ihop säkert
  const ranks = arr(n['tender-rank'])
  const lots = arr(n['BT-137-Lot']).length
  const pairPrices = sek && lots <= 1 && tenderers.length > 0 && tv.length === tenderers.length && ranks.length === tenderers.length

  const winnerSet = new Set([...winners.keys()])
  const bidders = (tenderers.length ? tenderers : [...winners.values()]).map((t, i) => ({
    name: t.name,
    orgNumber: t.orgNumber,
    isWinner: winnerSet.has(normalizeOrgNumber(t.orgNumber) ?? normalizeName(t.name)),
    price: pairPrices ? tv[i] : null,
    rank: pairPrices ? Number(ranks[i]) || null : null,
  }))

  const raw = { ...n }
  delete raw.links

  return {
    source: 'ted',
    sourceRef: ref,
    noticeRefs: [ref],
    pubDate,
    buyer: buyerName ? { orgNumber: buyerOrg, name: buyerName, nuts } : null,
    title,
    cpv,
    countyCode: county,
    fields: {
      bidsReceived: Number.isFinite(bidsReceived) ? bidsReceived : null,
      lowestBid: sek && low.length ? Math.min(...low) : null,
      highestBid: sek && high.length ? Math.max(...high) : null,
      criteriaType,
      procedureType: arr(n['procedure-type'])[0] ?? null,
      isFramework: fa.length ? fa.some((x) => x !== 'none') : null,
      awardDate: minDate(n['winner-decision-date']),
      contractSignedDate: minDate(n['contract-conclusion-date']),
      contractStart: minDate(n['contract-duration-start-date-lot']),
      contractEnd: minDate(n['contract-duration-end-date-lot']),
      renewalMax: renewals.length ? Math.max(...renewals) : null,
      durationMonths: eformsDurationMonths(n),
      durationText: lang(n['description-lot'])[0] ?? null,
      fallbackStart: pubDate,
    },
    winners: [...winners.values()].map((w) => {
      const actual = sum(w.actual)
      if (actual != null) return { name: w.name, orgNumber: w.orgNumber, value: actual, valueKind: 'actual' }
      if (ceiling != null) return { name: w.name, orgNumber: w.orgNumber, value: ceiling, valueKind: 'ceiling' }
      if (estimated != null) return { name: w.name, orgNumber: w.orgNumber, value: estimated, valueKind: 'estimated' }
      return { name: w.name, orgNumber: w.orgNumber, value: null, valueKind: 'unknown' }
    }),
    bidders,
    raw,
  }
}

async function tedSearch(query, fields, limit = null) {
  const out = []
  for (let page = 1; ; page++) {
    const res = await politeFetch(TED_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, fields, limit: 100, page, scope: 'ALL' }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok || !j?.notices) throw new Error(`TED svarade ${res.status}: ${JSON.stringify(j).slice(0, 500)}`)
    out.push(...j.notices)
    if (verbose || page === 1) console.log(`  TED sida ${page}: ${j.notices.length} poster, totalt ${j.totalNoticeCount ?? '?'}`)
    if (j.notices.length < 100) break
    if (limit && out.length >= limit) break
  }
  return limit ? out.slice(0, limit) : out
}

/** Avtalstid i månader utan förlängningar (duration-period-value-lot och -unit-lot), samma regel som TED-synken */
function eformsDurationMonths(n) {
  const v = Number(arr(n['duration-period-value-lot'])[0])
  const period = arr(n['contract-duration-period-lot'])[0]
  const unit = String(arr(n['duration-period-unit-lot'])[0] ?? (period && typeof period === 'object' ? period.unit : '') ?? arr(n['BT-36-Lot-Unit'])[0] ?? '').toLowerCase()
  if (!Number.isFinite(v) || v <= 0) return null
  if (unit.startsWith('year') || unit === 'ann') return v * 12
  if (unit.startsWith('month') || unit === 'mon') return v
  if (unit.startsWith('day')) return Math.round(v / 30)
  return null
}

async function loadEforms() {
  let notices
  if (args.fixtures) {
    const all = JSON.parse(readFileSync(resolve(DATA_DIR, 'ua', 'ted_can.json'), 'utf8'))
    notices = all.filter((n) => (tedDate(n['publication-date']) ?? '') >= EFORMS_FROM)
    console.log(`eForms-fixture ted_can.json: ${all.length} poster, ${notices.length} från ${EFORMS_FROM}`)
  } else {
    // Hämtar alla sidor (urvalet görs efteråt), --limit gäller efter urvalet
    notices = await tedSearch(EFORMS_QUERY, FIELDS)
  }
  // Bara 90920000 (bred sanering) kräver skadedjursord i titeln, se isPestRelevant
  const relevant = notices.filter((n) => isPestRelevant(arr(n['classification-cpv']), noticeTitle(n)))
  if (relevant.length !== notices.length) console.log(`  eForms: ${notices.length - relevant.length} av ${notices.length} bortvalda (bara 90920000 utan skadedjursord)`)
  return (args.limit ? relevant.slice(0, args.limit) : relevant).map(parseEforms)
}

// ---------------------------------------------------------------------------
// b) Äldre TED-XML

/** Innehållet i första elementet med namnet (namnrymdsprefix tillåts) */
function xmlBlock(x, tag) {
  const m = x.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`))
  return m ? m[1] : null
}

function xmlBlocks(x, tagPattern) {
  const out = []
  const re = new RegExp(`<((?:\\w+:)?(?:${tagPattern}))\\b[^>]*>([\\s\\S]*?)</\\1>`, 'g')
  for (const m of x.matchAll(re)) out.push(m[2])
  return out
}

function xmlText(x, tag) {
  const b = x == null ? null : xmlBlock(x, tag)
  return b == null ? null : cleanText(b.replace(/<[^>]+>/g, ' '))
}

const hasTag = (x, tag) => new RegExp(`<(?:\\w+:)?${tag}[\\s/>]`).test(x)

function xmlDate(block, tag) {
  const b = xmlBlock(block, tag)
  if (!b) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(b.trim())) return b.trim().slice(0, 10)
  const d = b.match(/<DAY>(\d+)<\/DAY>/)?.[1]
  const mo = b.match(/<MONTH>(\d+)<\/MONTH>/)?.[1]
  const y = b.match(/<YEAR>(\d+)<\/YEAR>/)?.[1]
  return d && mo && y ? `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` : null
}

/** Orgnr ur NATIONALID, även momsnummer som SE212000112401 */
function xmlOrg(raw) {
  if (!raw) return null
  const s = cleanText(raw)
  const vat = s.replace(/\s/g, '').match(/^SE(\d{10})01$/i)
  return vat ? vat[1] : s
}

/** Belopp och valuta ur ett värdeelement, t.ex. <VAL_TOTAL CURRENCY="SEK">4400000</VAL_TOTAL> */
function xmlMoney(block, tag) {
  if (!block) return null
  const m = block.match(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`))
  if (!m) return null
  const cur = m[1].match(/CURRENCY="(\w+)"/)?.[1] ?? m[2].match(/CURRENCY="(\w+)"/)?.[1] ?? null
  const fmt = m[2].match(/FMTVAL="([\d.]+)"/)?.[1]
  const value = positiveNumber(fmt ?? m[2].replace(/<[^>]+>/g, '').replace(/\s/g, ''))
  return value == null ? null : { value, currency: cur }
}

const PROCEDURE_TAGS = [
  ['PT_OPEN', 'open'],
  ['PT_RESTRICTED', 'restricted'],
  ['PT_COMPETITIVE_NEGOTIATION', 'neg-w-call'],
  ['PT_NEGOTIATED_WITH_PRIOR_CALL', 'neg-w-call'],
  ['PT_NEGOTIATED_WITH_COMPETITION', 'neg-w-call'],
  ['PT_COMPETITIVE_DIALOGUE', 'comp-dial'],
  ['PT_INNOVATION_PARTNERSHIP', 'innovation'],
  ['PT_AWARD_CONTRACT_WITHOUT_CALL', 'neg-wo-call'],
  ['PT_NEGOTIATED_WITHOUT_PUBLICATION', 'neg-wo-call'],
]

function parseXml(x, fileRef) {
  const docId = x.match(/DOC_ID="([^"]+)"/)?.[1] ?? fileRef
  const ref = normalizeTedNumber(docId) ?? normalizeTedNumber(fileRef)
  const form = xmlBlock(x, 'FORM_SECTION') ?? x
  const coded = xmlBlock(x, 'CODED_DATA_SECTION') ?? ''

  // Köpare: CONTRACTING_BODY (R2.0.9) eller CONTRACTING_AUTHORITY_INFORMATION_* (R2.0.8)
  const buyerBlock =
    xmlBlock(form, 'CONTRACTING_BODY') ?? xmlBlock(form, 'CONTRACTING_AUTHORITY_INFORMATION\\w*') ?? xmlBlock(form, 'CONTRACTING_ENTITY\\w*') ?? ''
  // Äldre XML har ibland namn i versaler (FORSHAGA KOMMUN)
  const buyerName = prettifyUpperName(xmlText(buyerBlock, 'OFFICIALNAME') ?? xmlText(form, 'OFFICIALNAME'))
  const buyerOrg = xmlOrg(xmlText(buyerBlock, 'NATIONALID'))

  const pubRaw = coded.match(/<DATE_PUB>(\d{8})<\/DATE_PUB>/)?.[1]
  const pubDate = pubRaw ? `${pubRaw.slice(0, 4)}-${pubRaw.slice(4, 6)}-${pubRaw.slice(6, 8)}` : null

  const objectBlock = xmlBlock(form, 'OBJECT_CONTRACT') ?? xmlBlock(form, 'OBJECT_CONTRACT_INFORMATION\\w*') ?? form
  const title = xmlText(objectBlock, 'TITLE') ?? xmlText(objectBlock, 'TITLE_CONTRACT')

  const cpv = uniq([...form.matchAll(/<CPV_CODE CODE="(\d{8})/g)].map((m) => m[1]))
  const perfNuts = [...coded.matchAll(/<(?:\w+:)?PERFORMANCE_NUTS CODE="([^"]+)"/g)].map((m) => m[1])
  const objNuts = [...objectBlock.matchAll(/<(?:\w+:)?NUTS CODE="([^"]+)"/g)].map((m) => m[1])
  const buyerNuts = [...buyerBlock.matchAll(/<(?:\w+:)?NUTS CODE="([^"]+)"/g)].map((m) => m[1])
  const nuts = uniq([...perfNuts, ...objNuts])
  const county = countiesFromNuts(nuts)[0] ?? countiesFromNuts(buyerNuts)[0] ?? null

  const procedureType = PROCEDURE_TAGS.find(([t]) => hasTag(form, t))?.[1] ?? null
  const isFramework = hasTag(form, 'FRAMEWORK') || hasTag(form, 'CONCLUSION_FRAMEWORK_AGREEMENT')

  // Kriterier: AC_PRICE som enda kriterium ger 'price'
  const price = hasTag(form, 'AC_PRICE') || hasTag(form, 'LOWEST_PRICE')
  const quality = hasTag(form, 'AC_QUALITY') || hasTag(form, 'MOST_ECONOMICALLY_ADVANTAGEOUS_TENDER\\w*')
  const cost = hasTag(form, 'AC_COST')
  const criteriaType = quality ? 'mixed' : price && !cost ? 'price' : cost ? (price ? 'price' : 'cost') : null

  // Tilldelningar: AWARD_CONTRACT (R2.0.9) eller AWARD_OF_CONTRACT (R2.0.8)
  const winners = new Map()
  const tenders = []
  const lows = []
  const highs = []
  const conclusions = []
  const otherCurrency = []
  for (const award of xmlBlocks(form, 'AWARD_CONTRACT|AWARD_OF_CONTRACT')) {
    if (hasTag(award, 'NO_AWARDED_CONTRACT')) continue
    const nb = positiveNumber(xmlText(award, 'NB_TENDERS_RECEIVED') ?? xmlText(award, 'OFFERS_RECEIVED_NUMBER'))
    if (nb != null) tenders.push(nb)
    const concluded = xmlDate(award, 'DATE_CONCLUSION_CONTRACT') ?? xmlDate(award, 'CONTRACT_AWARD_DATE')
    if (concluded) conclusions.push(concluded)
    // Värde: slutligt totalvärde, annars uppskattat
    const total =
      xmlMoney(award, 'VAL_TOTAL') ??
      xmlMoney(xmlBlock(award, 'CONTRACT_VALUE_INFORMATION') ?? '', 'COSTS_RANGE_AND_CURRENCY_WITH_VAT_RATE')
    const est = xmlMoney(award, 'VAL_ESTIMATED_TOTAL') ?? xmlMoney(award, 'INITIAL_ESTIMATED_TOTAL_VALUE_CONTRACT')
    const low = xmlMoney(award, 'LOW') ?? xmlMoney(award, 'LOW_VALUE')
    const high = xmlMoney(award, 'HIGH') ?? xmlMoney(award, 'HIGH_VALUE')
    const isSek = (m) => m && (!m.currency || m.currency === 'SEK')
    for (const m of [total, est, low, high]) if (m && !isSek(m)) otherCurrency.push(m)
    if (isSek(low)) lows.push(low.value)
    if (isSek(high)) highs.push(high.value)

    const contractors = xmlBlocks(award, 'CONTRACTOR|ECONOMIC_OPERATOR_NAME_ADDRESS')
    for (const c of contractors) {
      const name = prettifyUpperName(xmlText(c, 'OFFICIALNAME'))
      if (!name) continue
      const org = xmlOrg(xmlText(c, 'NATIONALID'))
      const key = normalizeOrgNumber(org) ?? normalizeName(name)
      const w = winners.get(key) ?? { name, orgNumber: org, actual: 0, estimated: 0 }
      // Delas värdet av en grupp räknas hela beloppet på varje medlem, som i UHM
      if (isSek(total)) w.actual += total.value
      else if (isSek(est)) w.estimated += est.value
      winners.set(key, w)
    }
  }
  const noticeTotal = xmlMoney(objectBlock, 'VAL_TOTAL') ?? xmlMoney(form, 'TOTAL_FINAL_VALUE')
  const noticeCeiling = noticeTotal && (!noticeTotal.currency || noticeTotal.currency === 'SEK') ? noticeTotal.value : null

  // Den ursprungliga annonsen: NOTICE_NUMBER_OJ eller REF_NOTICE, t.ex. 2020/S 190-459134
  const originalRefs = uniq(
    [...x.matchAll(/(?:NOTICE_NUMBER_OJ|NO_DOC_OJS)>(\d{4})\/S \d+-0*(\d+)</g)]
      .map((m) => `${m[2]}-${m[1]}`)
      .filter((r) => r !== ref)
  )

  return {
    source: 'ted_xml',
    sourceRef: ref,
    enrichOrg: true,
    noticeRefs: [ref, ...originalRefs],
    pubDate,
    buyer: buyerName ? { orgNumber: buyerOrg, name: buyerName, nuts: nuts.length ? nuts : buyerNuts } : null,
    title,
    cpv,
    countyCode: county,
    fields: {
      bidsReceived: tenders.length ? Math.max(...tenders) : null,
      lowestBid: lows.length ? Math.min(...lows) : null,
      highestBid: highs.length ? Math.max(...highs) : null,
      criteriaType,
      procedureType,
      isFramework,
      awardDate: null,
      contractSignedDate: conclusions.sort()[0] ?? null,
      contractStart: null,
      contractEnd: null,
      renewalMax: null,
      fallbackStart: pubDate,
    },
    winners: [...winners.values()].map((w) => {
      if (w.actual > 0) return { name: w.name, orgNumber: w.orgNumber, value: w.actual, valueKind: isFramework ? 'ceiling' : 'actual' }
      if (noticeCeiling != null) return { name: w.name, orgNumber: w.orgNumber, value: noticeCeiling, valueKind: 'ceiling' }
      if (w.estimated > 0) return { name: w.name, orgNumber: w.orgNumber, value: w.estimated, valueKind: 'estimated' }
      return { name: w.name, orgNumber: w.orgNumber, value: null, valueKind: 'unknown' }
    }),
    // Äldre XML saknar förlorarna: bara vinnarna blir anbudsgivare
    bidders: [...winners.values()].map((w) => ({ name: w.name, orgNumber: w.orgNumber, isWinner: true })),
    raw: {
      kalla: 'ted_xml',
      dokument: docId,
      publicerad: pubDate,
      ursprunglig_annons: originalRefs,
      antal_anbud_per_kontrakt: tenders,
      annan_valuta: otherCurrency,
      version: x.match(/VERSION="([^"]+)"/)?.[1] ?? null,
    },
  }
}

async function loadXml() {
  const out = []
  if (args.fixtures) {
    if (!existsSync(xmlDir)) throw new Error(`XML-katalogen finns inte: ${xmlDir}`)
    let files = readdirSync(xmlDir).filter((f) => f.endsWith('.xml')).sort()
    console.log(`XML-fixture ${xmlDir}: ${files.length} filer`)
    if (args.limit) files = files.slice(0, args.limit)
    for (const f of files) out.push(parseXml(readFileSync(resolve(xmlDir, f), 'utf8'), basename(f, '.xml')))
    return out.filter((r) => isPestRelevant(r.cpv, r.title))
  }
  const found = await tedSearch(XML_QUERY, ['publication-number', 'publication-date', 'notice-type', 'classification-cpv', 'notice-title', 'title-proc'])
  const relevant = found.filter((n) => isPestRelevant(arr(n['classification-cpv']), noticeTitle(n)))
  const notices = args.limit ? relevant.slice(0, args.limit) : relevant
  console.log(`TED 2016 till 2023-10: ${found.length} tilldelningar, ${relevant.length} efter urval, ${notices.length} hämtas som XML`)
  for (const n of notices) {
    const num = normalizeTedNumber(n['publication-number'])
    const res = await politeFetch(`https://ted.europa.eu/en/notice/${num}/xml`, { headers: { Accept: 'application/xml' } })
    if (!res.ok) {
      console.warn(`  ${num}: HTTP ${res.status}, hoppar över`)
      continue
    }
    const text = await res.text()
    if (!text.includes('<TED_EXPORT')) {
      // eForms-XML (från 2023-10-25) har annan form, de posterna tas av eForms-delen
      if (verbose) console.log(`  ${num}: inte TED_EXPORT, hoppar över`)
      continue
    }
    out.push(parseXml(text, num))
  }
  return out.filter((r) => isPestRelevant(r.cpv, r.title))
}

// ---------------------------------------------------------------------------
// Sammanfattning och kontroller

function show(rows, ref) {
  const awards = rows.awards.filter((a) => a.source_ref === ref)
  const bidders = rows.bidders.filter((b) => b.source_ref === ref)
  if (!awards.length && !bidders.length) return
  console.log(`  ${ref}:`)
  for (const a of awards) console.log(`    vinnare ${a.winner_name} (${a.winner_org_number ?? 'orgnr saknas'}) värde ${fmtKr(a.value)} ${a.value_kind}, anbud ${a.bids_received ?? '-'}, kriterier ${a.criteria_type ?? '-'}, slut ${a.calc_end_date ?? '-'} (${a.calc_end_source ?? '-'})`)
  for (const b of bidders) console.log(`    anbudsgivare ${b.name} (${b.org_number ?? '-'}) ${b.is_winner ? 'VANN' : 'förlorade'}`)
}

function summarize(label, records, rows) {
  const withWinner = records.filter((r) => r.winners.length > 0)
  const winners = rows.awards.length
  const withOrg = rows.awards.filter((a) => a.winner_org_number).length
  console.log('')
  console.log(`${label}: ${records.length} tilldelningsannonser, ${withWinner.length} med vinnare`)
  console.log(`  tilldelningar ${winners} (${withOrg} med orgnr), anbudsgivare ${rows.bidders.length} (${rows.bidders.filter((b) => !b.is_winner).length} förlorare)`)
  const kinds = {}
  for (const a of rows.awards) kinds[a.value_kind] = (kinds[a.value_kind] ?? 0) + 1
  console.log(`  värdets art: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  const ends = {}
  for (const a of rows.awards) ends[a.calc_end_source ?? 'inget'] = (ends[a.calc_end_source ?? 'inget'] ?? 0) + 1
  console.log(`  beräknat slut: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  const begone = rows.bidders.filter((b) => b.org_number === BEGONE_ORG)
  const spellings = uniq(begone.map((b) => b.name))
  console.log(`  BeGone (${BEGONE_ORG}): ${begone.length} anbud, ${begone.filter((b) => b.is_winner).length} vunna, stavningar: ${spellings.join(' | ') || '-'}`)
  const withoutOrg = rows.bidders.filter((b) => !b.org_number)
  if (withoutOrg.length) console.log(`  anbudsgivare utan orgnr: ${withoutOrg.length} (${uniq(withoutOrg.map((b) => b.name)).slice(0, 6).join(', ')})`)
}

function supplierAliases(suppliers) {
  const multi = suppliers.all.filter((s) => s.aliases.length > 0 && (s._new || Object.keys(s._patch).length > 0))
  if (!multi.length) return
  console.log('')
  console.log('Leverantörer med alias (samma orgnr, annan stavning):')
  for (const s of multi.slice(0, 12)) console.log(`  ${s.org_number ?? '-'} ${s.name} | alias: ${s.aliases.join(' | ')}`)
}

// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now()
  console.log(`TED-import (${mode}) ${args.fixtures ? 'från fixtures' : 'från TED'}${args.dryRun ? ', torrkörning' : ''}${args.limit ? `, högst ${args.limit} per del` : ''}`)
  const sb = await connect(args.dryRun)
  if (sb) {
    await printTableCounts(sb, 'ted', 'Före')
    await printTableCounts(sb, 'ted_xml', 'Före')
  }

  const buyers = new EntityRegistry('buyer')
  const suppliers = new EntityRegistry('supplier')
  await buyers.load(sb)
  await suppliers.load(sb)

  const parts = []
  if (mode === 'eforms' || mode === 'all') parts.push(['eForms (ted)', 'ted', await loadEforms()])
  if (mode === 'xml' || mode === 'all') parts.push(['Äldre XML (ted_xml)', 'ted_xml', await loadXml()])

  const noticeIds = await loadNoticeIds(sb, parts.flatMap(([, , recs]) => recs.flatMap((r) => r.noticeRefs)))
  const results = []
  for (const [label, source, records] of parts) {
    const rows = buildRows(records, buyers, suppliers, noticeIds)
    results.push({ label, source, records, rows })
    summarize(label, records, rows)
  }

  const b = buyers.counts()
  const s = suppliers.counts()
  console.log('')
  console.log(`Köpare: ${b.total} i registret (${b.created} nya, ${b.patched} kompletterade)`)
  console.log(`Leverantörer: ${s.total} i registret (${s.created} nya, ${s.patched} kompletterade)`)
  console.log(`Kopplade till annons (notice_id): ${results.reduce((n, r) => n + r.rows.awards.filter((a) => a.notice_id).length, 0)} tilldelningar`)
  supplierAliases(suppliers)

  if (verbose || args.dryRun) {
    console.log('')
    console.log('Kontrollposter:')
    for (const r of results) for (const ref of ['658732-2026', '384599-2026', '335454-2026', '691912-2025', '100217-2021', '190465-2017']) show(r.rows, ref)
  }

  if (!sb) {
    console.log('')
    console.log('Torrkörning: inget skrivet.')
    return
  }
  // Köpare och leverantörer skrivs vid första delen, delarna delar registren
  for (const r of results) {
    const written = await writeAll(sb, buyers, suppliers, r.rows)
    const counties = await backfillAwardCounties(sb, r.source)
    console.log(`${r.label}: skrivet ${written.awardRows.length} tilldelningar och ${written.bidderRows.length} anbudsgivare (upsert), län ifyllt på ${counties}`)
  }
  await printTableCounts(sb, 'ted', 'Efter')
  await printTableCounts(sb, 'ted_xml', 'Efter')
  console.log(`Klart på ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

main().catch((err) => {
  console.error('Importen avbröts:', err?.message ?? err)
  process.exit(1)
})
