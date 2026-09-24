#!/usr/bin/env node
// scripts/import-uhm-procurements.mjs
// Import av Upphandlingsmyndighetens statistik över annonserade upphandlingar
// (sex dataset, 2021 till 2025) till upphandlingsportalens tabeller:
// procurement_buyers, procurement_suppliers, procurement_awards och
// procurement_bidders. Plan: docs/upphandlingsportal-plan.md avsnitt 2, 3, 7 och 8.
//
// Dataset (RowStore på catalog.upphandlingsmyndigheten.se/rowstore/dataset/{id}/json):
//   5ad00e4f-0697-4ee5-8dff-1b282a236e64  Antal upphandlingar, 2021 till 2025. En rad per upphandling:
//                                         köpare, förfarande, typ av avtal, överprövad, annonsdatabas.
//   582c2145-af7d-4eb5-a02d-dffd60585ff0  Antal kontrakterade anbud (resurs 243), 2021 till 2024. En rad per
//                                         anbudsområde och vinnande leverantör med orgnr.
//   a616c14a-3068-407f-a591-f1e2f142e1d2  Kontrakterat värde, 2021 till 2024. En rad per upphandling.
//                                         Värdet är avtalets ramtak, inte vinnande pris.
//   14137f50-c74a-4502-8814-75bf1dbe2a04  Antal anbud (resurs 222), 2021 till 2024. En rad per anbudsområde.
//   75ea48bf-7a59-478b-ada2-9226cbd4e008  Antal anbud med leverantörer (resurs 170), bara 2024. En rad per
//                                         anbud med leverantör och "Kontrakterad"/"Inte kontrakterad",
//                                         alltså även förlorarna.
//   d093fe34-54e4-4d25-8f8c-1ab7a160c329  Uppskattat värde (resurs 176), 2021 till 2025.
//
// Urval: CPV som börjar på 9092 i "cpv-kategori", eller huvudsaklig CPV på 9092
// utom den breda 90920000. Huvudsaklig CPV 90920000 (Sanering av anläggningar,
// mest brand-, fukt- och industrisanering) och de närliggande 90900000,
// 90910000, 90911000, 70330000, 50700000 och 77231200 tas bara med när titeln
// innehåller ett skadedjursord och inget negativt ord (asbest, fukt, brand ...).
// Onlineläget hämtar varje dataset med RowStore-filter (regex per kolumn,
// _limit 500, _offset), högst ett anrop per sekund.
//
// Körning:
//   node scripts/import-uhm-procurements.mjs --fixtures --dry-run   lokala fixtures, skriver inget
//   node scripts/import-uhm-procurements.mjs --fixtures             lokala fixtures mot databasen
//   node scripts/import-uhm-procurements.mjs --dry-run --limit 50   hämtar från UHM, skriver inget
//   node scripts/import-uhm-procurements.mjs                        hämtar från UHM och skriver
// Flaggor: --dry-run, --fixtures, --limit N (antal upphandlingar), --verbose.
//
// Idempotent: köpare och leverantörer på orgnr, tilldelningar på award_key
// (uhm:{upphandlings-id}:{orgnr}), anbudsgivare på bidder_key. Nycklarna har
// samma form som upsertAward/upsertBidder i api/_lib/procurement.ts.
//
// Kör gärna import-ted-history.mjs först: köpare som finns i TED får län ur
// NUTS, och den här importen fyller sedan county_code på UHM-raderna ur köparen.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BEGONE_ORG,
  DATA_DIR,
  EntityRegistry,
  NEGATIVE_WORDS,
  PEST_WORDS,
  backfillAwardCounties,
  buildRows,
  cleanText,
  connect,
  fmtKr,
  normalizeName,
  normalizeOrgNumber,
  parseArgs,
  pct,
  politeFetch,
  positiveNumber,
  prettifyUpperName,
  printTableCounts,
  tedDate,
  uniq,
  writeAll,
} from './lib/procurementImportShared.mjs'

const DATASETS = {
  procurements: { id: '5ad00e4f-0697-4ee5-8dff-1b282a236e64', label: 'Antal upphandlingar 2021 till 2025' },
  contracted: { id: '582c2145-af7d-4eb5-a02d-dffd60585ff0', label: 'Kontrakterade anbud 2021 till 2024' },
  value: { id: 'a616c14a-3068-407f-a591-f1e2f142e1d2', label: 'Kontrakterat värde 2021 till 2024' },
  bidCount: { id: '14137f50-c74a-4502-8814-75bf1dbe2a04', label: 'Antal anbud 2021 till 2024' },
  bidders2024: { id: '75ea48bf-7a59-478b-ada2-9226cbd4e008', label: 'Anbud med leverantörer 2024' },
  estimated: { id: 'd093fe34-54e4-4d25-8f8c-1ab7a160c329', label: 'Uppskattat värde 2021 till 2025' },
}

const ROWSTORE = 'https://catalog.upphandlingsmyndigheten.se/rowstore/dataset'
const RELATED_CPV = ['90900000', '90910000', '90911000', '70330000', '50700000', '77231200']

const args = parseArgs()
const verbose = !!args.rest.verbose

// ---------------------------------------------------------------------------
// Fält: UHM har BOM i första kolumnens namn och varierar mellan dataseten

function field(row, name) {
  if (row[name] !== undefined) return row[name]
  const bom = row[String.fromCharCode(0xfeff) + name]
  return bom !== undefined ? bom : undefined
}

function known(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s && s !== 'Uppgift saknas' ? s : null
}

const cpvCode = (v) => (known(v) ?? '').match(/^\d{8}/)?.[0] ?? null

function isRelevant(row) {
  const main = cpvCode(field(row, 'huvudsaklig cpv-kod'))
  const cat = cpvCode(field(row, 'cpv-kategori'))
  if (cat?.startsWith('9092')) return true
  if (main?.startsWith('9092') && main !== '90920000') return true
  const soft = main === '90920000' || RELATED_CPV.includes(main) || RELATED_CPV.includes(cat)
  if (!soft) return false
  const title = String(field(row, 'upphandlingens titel') ?? '')
  return PEST_WORDS.test(title) && !NEGATIVE_WORDS.test(title)
}

// ---------------------------------------------------------------------------
// Inläsning

function readFixture(id) {
  const ua = resolve(DATA_DIR, 'ua')
  const json = resolve(ua, `p_${id}.json`)
  const jsonl = resolve(ua, `p_${id}.jsonl`)
  if (existsSync(json)) return JSON.parse(readFileSync(json, 'utf8')).results ?? []
  if (existsSync(jsonl)) return readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  if (id === DATASETS.procurements.id && existsSync(resolve(DATA_DIR, 'uhm_pest.jsonl'))) {
    return readFileSync(resolve(DATA_DIR, 'uhm_pest.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  }
  console.warn(`Fixture saknas för ${id}`)
  return []
}

async function fetchQuery(id, column, regex) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const url = `${ROWSTORE}/${id}/json?${encodeURIComponent(column)}=${encodeURIComponent(regex)}&_limit=500&_offset=${offset}`
    const res = await politeFetch(url)
    if (!res.ok) throw new Error(`UHM ${id} svarade ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const j = await res.json()
    const got = j.results ?? []
    rows.push(...got)
    if (verbose) console.log(`  ${id.slice(0, 8)} ${column}=${regex} offset ${offset}: ${got.length} av ${j.resultCount}`)
    if (got.length < 500 || rows.length >= (j.resultCount ?? 0)) break
  }
  return rows
}

async function fetchDataset(id) {
  const queries = [
    ['cpv-kategori', '9092.*'],
    ['huvudsaklig cpv-kod', '9092.*'],
    ['huvudsaklig cpv-kod', `(${RELATED_CPV.join('|')}).*`],
  ]
  const seen = new Set()
  const out = []
  for (const [col, re] of queries) {
    for (const r of await fetchQuery(id, col, re)) {
      const k = JSON.stringify(r)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(r)
    }
  }
  return out
}

async function loadAll() {
  const data = {}
  for (const [key, ds] of Object.entries(DATASETS)) {
    const raw = args.fixtures ? readFixture(ds.id) : await fetchDataset(ds.id)
    data[key] = raw.filter(isRelevant)
    console.log(`${ds.label} (${ds.id.slice(0, 8)}): ${raw.length} rader, ${data[key].length} efter urval`)
  }
  return data
}

// ---------------------------------------------------------------------------
// Tolkning

const SECTOR = {
  Kommun: 'kommun',
  'Kommunalt ägd organisation': 'kommunalt bolag',
  Region: 'region',
  'Regionalt ägd organisation': 'regionalt bolag',
  'Statlig myndighet': 'stat',
  'Statligt ägd organisation': 'statligt bolag',
  Annat: 'övrigt',
}

function sectorOf(row) {
  const sub = known(field(row, 'delsektor för köpare'))
  if (sub && SECTOR[sub]) return SECTOR[sub]
  const main = known(field(row, 'sektor för köpare'))
  if (main === 'Kommun') return 'kommun'
  if (main === 'Region') return 'region'
  if (main === 'Stat') return 'stat'
  if (main === 'Annat') return 'övrigt'
  return null
}

// Förfarande som TED:s koder där de motsvarar varandra, annars egna koder
const PROCEDURE = {
  'Öppet förfarande': 'open',
  'Selektivt förfarande': 'restricted',
  'Förhandlat förfarande med föregående annonsering': 'neg-w-call',
  'Förhandlat förfarande utan föregående annonsering': 'neg-wo-call',
  'Konkurrenspräglad dialog': 'comp-dial',
  Innovationspartnerskap: 'innovation',
  'Förenklat förfarande': 'simplified',
  Urvalsförfarande: 'selective',
  'Annat förfarande': 'other',
}

function procedureOf(row) {
  const p = known(field(row, 'förfarande'))
  if (!p) return null
  return PROCEDURE[p] ?? p
}

function yesNo(v, yes, no) {
  const s = known(v)
  if (s === yes) return true
  if (s === no) return false
  return null
}

function buildRecords(data) {
  const byId = new Map()
  const get = (row) => {
    const id = known(field(row, 'upphandlings-id'))
    if (!id) return null
    if (!byId.has(id)) byId.set(id, { id, base: null, winners: new Map(), bidders: new Map(), value: null, estimated: null, bidCounts: [], datasets: new Set() })
    return byId.get(id)
  }
  for (const r of data.procurements) {
    const p = get(r)
    if (p) {
      p.base = r
      p.datasets.add('upphandlingar')
    }
  }
  const addBidder = (p, r, isWinner) => {
    const org = normalizeOrgNumber(field(r, 'organisationsnummer för leverantör'))
    const name = prettifyUpperName(field(r, 'namn för leverantör'))
    if (!org && !name) return
    const key = org ?? normalizeName(name)
    const prev = p.bidders.get(key)
    p.bidders.set(key, { name: prev?.name ?? name, orgNumber: org, isWinner: isWinner || !!prev?.isWinner })
    if (isWinner) p.winners.set(key, { name: p.winners.get(key)?.name ?? name, orgNumber: org })
  }
  for (const r of data.contracted) {
    const p = get(r)
    if (!p) continue
    p.base ??= r
    p.datasets.add('kontrakterade')
    addBidder(p, r, true)
  }
  for (const r of data.bidders2024) {
    const p = get(r)
    if (!p) continue
    p.base ??= r
    p.datasets.add('anbud_2024')
    addBidder(p, r, known(field(r, 'kontrakterad')) === 'Kontrakterad')
  }
  for (const r of data.value) {
    const p = get(r)
    if (!p) continue
    p.base ??= r
    p.datasets.add('kontrakterat_varde')
    const v = positiveNumber(field(r, 'kontrakterat värde'))
    if (v != null) p.value = (p.value ?? 0) + v
  }
  for (const r of data.estimated) {
    const p = get(r)
    if (!p) continue
    p.base ??= r
    p.datasets.add('uppskattat_varde')
    const v = positiveNumber(field(r, 'uppskattat värde'))
    if (v != null) p.estimated = (p.estimated ?? 0) + v
  }
  for (const r of data.bidCount) {
    const p = get(r)
    if (!p) continue
    p.base ??= r
    p.datasets.add('antal_anbud')
    const n = positiveNumber(field(r, 'antal anbud'))
    if (n != null) p.bidCounts.push({ lot: known(field(r, 'anbudsområdes-id')), n })
  }

  const records = []
  for (const p of byId.values()) {
    const b = p.base
    const buyerOrg = normalizeOrgNumber(field(b, 'organisationsnummer för köpare'))
    const buyerName = prettifyUpperName(field(b, 'namn för köpare'))
    const published = tedDate(known(field(b, 'publiceringsdatum')))
    // Antal anbud: största antalet per anbudsområde, annars antal kända anbudsgivare 2024
    const bids = p.bidCounts.length ? Math.max(...p.bidCounts.map((x) => x.n)) : p.datasets.has('anbud_2024') ? p.bidders.size : null
    const value = p.value ?? p.estimated ?? null
    const valueKind = p.value != null ? 'ceiling' : p.estimated != null ? 'estimated' : 'unknown'
    const winners = [...p.winners.values()].map((w) => ({ ...w, value, valueKind }))
    records.push({
      source: 'uhm',
      sourceRef: p.id,
      noticeRefs: [],
      year: known(field(b, 'år')),
      buyer: buyerName ? { orgNumber: buyerOrg, name: buyerName, nuts: [], sector: sectorOf(b) } : null,
      title: cleanText(field(b, 'upphandlingens titel')),
      cpv: uniq([cpvCode(field(b, 'huvudsaklig cpv-kod')), cpvCode(field(b, 'cpv-kategori'))]),
      countyCode: null,
      fields: {
        bidsReceived: bids,
        procedureType: procedureOf(b),
        isFramework: yesNo(field(b, 'typ av avtal'), 'Ramavtal', 'Kontrakt'),
        wasAppealed: yesNo(field(b, 'överprövad'), 'Överprövad', 'Inte överprövad'),
        // UHM saknar avtalsdatum: publiceringsdatum är basen för antagandet två plus två år
        fallbackStart: published,
      },
      winners,
      bidders: [...p.bidders.values()],
      raw: {
        kalla: 'uhm',
        dataset: [...p.datasets],
        upphandling: b,
        kontrakterat_varde: p.value,
        uppskattat_varde: p.estimated,
        antal_anbud_per_omrade: p.bidCounts,
      },
    })
  }
  records.sort((a, b) => String(a.sourceRef).localeCompare(String(b.sourceRef)))
  return records
}

// ---------------------------------------------------------------------------
// Sammanfattning

function summarize(records, rows, buyers, suppliers) {
  const withWinner = records.filter((r) => r.winners.length > 0)
  console.log('')
  console.log(`Upphandlingar efter urval: ${records.length}, med känd vinnare: ${withWinner.length}`)
  const b = buyers.counts()
  const s = suppliers.counts()
  console.log(`Köpare: ${b.total} i registret (${b.created} nya, ${b.patched} kompletterade)`)
  console.log(`Leverantörer: ${s.total} i registret (${s.created} nya, ${s.patched} kompletterade)`)
  console.log(`Tilldelningar: ${rows.awards.length}, anbudsgivare: ${rows.bidders.length} (${rows.bidders.filter((x) => !x.is_winner).length} förlorare)`)
  const begone = rows.bidders.filter((x) => x.org_number === BEGONE_ORG)
  console.log(`BeGone (${BEGONE_ORG}) bland anbudsgivarna: ${begone.length}`)

  // Marknadsandel på kontrakterat värde, samma räkning som planen: hela ramtaket per vinnare
  const byWinner = new Map()
  let total = 0
  const seenRef = new Set()
  for (const a of rows.awards) {
    if (a.value_kind !== 'ceiling' || a.value == null) continue
    const k = a.winner_org_number ?? a.winner_name
    const cur = byWinner.get(k) ?? { name: a.winner_name, value: 0 }
    cur.value += a.value
    byWinner.set(k, cur)
    if (!seenRef.has(a.source_ref)) {
      seenRef.add(a.source_ref)
      total += a.value
    }
  }
  const sumShares = [...byWinner.values()].reduce((x, y) => x + y.value, 0)
  console.log('')
  console.log(`Kontrakterat värde (ramtak) på ${seenRef.size} upphandlingar: ${fmtKr(total)}`)
  console.log('Topp 5 leverantörer på kontrakterat värde (andel av summan per vinnare):')
  const top = [...byWinner.values()].sort((x, y) => y.value - x.value).slice(0, 5)
  for (const t of top) console.log(`  ${t.name.padEnd(28)} ${fmtKr(t.value).padStart(10)}  ${pct(t.value, sumShares)}`)
  const share = (re) => {
    const hit = [...byWinner.values()].find((x) => re.test(x.name))
    return hit ? (100 * hit.value) / sumShares : 0
  }
  const anti = share(/anticimex/i)
  const nomor = share(/nomor/i)
  console.log(
    `Mot planen: Anticimex ${anti.toFixed(1).replace('.', ',')} % (plan cirka 77 %, avvikelse ${(anti - 77).toFixed(1).replace('.', ',')}), ` +
      `Nomor ${nomor.toFixed(1).replace('.', ',')} % (plan cirka 19 %, avvikelse ${(nomor - 19).toFixed(1).replace('.', ',')})`
  )
}

// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now()
  console.log(`UHM-import ${args.fixtures ? 'från fixtures' : 'från Upphandlingsmyndigheten'}${args.dryRun ? ', torrkörning' : ''}${args.limit ? `, högst ${args.limit} upphandlingar` : ''}`)
  const sb = await connect(args.dryRun)
  if (sb) await printTableCounts(sb, 'uhm', 'Före')

  const data = await loadAll()
  let records = buildRecords(data)
  if (args.limit) records = records.slice(0, args.limit)

  const buyers = new EntityRegistry('buyer')
  const suppliers = new EntityRegistry('supplier')
  await buyers.load(sb)
  await suppliers.load(sb)
  const rows = buildRows(records, buyers, suppliers)

  summarize(records, rows, buyers, suppliers)

  if (verbose || args.dryRun) {
    console.log('')
    console.log('Exempel på tilldelningar:')
    for (const a of rows.awards.slice(0, 4)) {
      const { _buyer, _supplier, raw, ...rest } = a
      console.log(JSON.stringify(rest))
    }
    const loser = rows.bidders.find((x) => !x.is_winner)
    if (loser) {
      const { _supplier, raw, ...rest } = loser
      console.log('Exempel på förlorare:', JSON.stringify(rest))
    }
  }

  if (!sb) {
    console.log('')
    console.log('Torrkörning: inget skrivet.')
    return
  }
  const written = await writeAll(sb, buyers, suppliers, rows)
  const counties = await backfillAwardCounties(sb, 'uhm')
  console.log('')
  console.log(`Skrivet: ${written.awardRows.length} tilldelningar och ${written.bidderRows.length} anbudsgivare (upsert), län ifyllt på ${counties} tilldelningar`)
  await printTableCounts(sb, 'uhm', 'Efter')
  console.log(`Klart på ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

main().catch((err) => {
  console.error('Importen avbröts:', err?.message ?? err)
  process.exit(1)
})
