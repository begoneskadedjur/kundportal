#!/usr/bin/env node
// scripts/recompute-procurement-awards.mjs
// Räknar om avtalsklockan för alla tilldelningar i procurement_awards med
// reglerna från 2026-09-25 (docs/upphandlingsportal-plan.md avsnitt 3):
//
//   - Felträffar flaggas med excluded_reason (vassklippning, lokalvård,
//     hissar ...). Rådatan rörs inte. Ett manuellt beslut i portalen behålls.
//   - Slutdatum: TED slutdatum plus förlängningar, Mercell, avtalsstart plus
//     avtalstid (TED eller annonstexten), annars två plus två år räknat från
//     avtalsstarten (tecknat avtal, tilldelning plus en månad,
//     tilldelningsannonsen, eller UHM-annonsen plus sex månader).
//   - Äldre TED-XML: med --fetch-cn hämtas den ursprungliga annonsen
//     (ted.europa.eu/en/notice/{nr}/xml, högst ett anrop per sekund) och
//     avtalstid, start, slut och förlängningar läses ur den. Svaren cachas i
//     scripts/data/procurement/cn/ (gitignorerad).
//   - Därefter län på köpare (procurement_resolve_buyer_counties) och
//     uppföljningen (procurement_refresh_award_followups): ny annons, ny
//     tilldelning, slut passerat.
//
// Körning:
//   node scripts/recompute-procurement-awards.mjs --dry-run            visar ändringarna, skriver inget
//   node scripts/recompute-procurement-awards.mjs --dry-run --fetch-cn
//   node scripts/recompute-procurement-awards.mjs --fetch-cn           skriver till databasen
// Kräver VITE_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i .env (även vid --dry-run, läsning).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DATA_DIR,
  awardRelevance,
  cleanText,
  computeContractEnd,
  loadEnvFiles,
  parseArgs,
  parseDurationText,
  politeFetch,
  tedDate,
  workWindow,
} from './lib/procurementImportShared.mjs'

const args = parseArgs()
const fetchCn = !!args.rest['fetch-cn']
const verbose = !!args.rest.verbose
const CN_DIR = resolve(DATA_DIR, 'cn')

async function client() {
  loadEnvFiles()
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas i .env')
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function selectAll(sb) {
  const cols =
    'id, award_key, source, source_ref, title, cpv_codes, raw, award_date, contract_signed_date, contract_start, contract_end, renewal_max, ' +
    'calc_end_date, calc_end_source, start_basis_date, duration_months, calc_basis, excluded_reason, excluded_at, window_start, window_end'
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('procurement_awards').select(cols).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Äldre TED: den ursprungliga annonsen

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

function xmlBlock(x, tag) {
  const m = x.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`))
  return m ? m[1] : null
}
const xmlText = (x, tag) => {
  const b = x == null ? null : xmlBlock(x, tag)
  return b == null ? null : cleanText(b.replace(/<[^>]+>/g, ' '))
}

/** Förlängningar i månader ur RENEWAL_DESCR: "1+1 år", "två gånger ett år", "upp till 24 månader" */
function renewalMonthsFromText(text) {
  const t = cleanText(text).toLowerCase()
  if (!t) return null
  const plus = t.match(/(\d{1,2})\s*\+\s*(\d{1,2})(?:\s*\+\s*(\d{1,2}))?\s*(år|månader|mån)/)
  if (plus) {
    const sum = [plus[1], plus[2], plus[3]].filter(Boolean).reduce((s, x) => s + Number(x), 0)
    return /^m/.test(plus[4]) ? sum : sum * 12
  }
  // Återanvänd tolkningen för "avtalstid ... förlängning" genom att ge en syntetisk avtalstid
  const parsed = parseDurationText(`Avtalstid 1 år. ${t}`)
  return parsed && parsed.renewalMonths > 0 ? parsed.renewalMonths : null
}

/** Avtalstid, start, slut och förlängningar ur en kontraktsannons (TED_EXPORT R2.0.8 och R2.0.9) */
export function parseContractNotice(x) {
  const out = { durationMonths: null, start: null, end: null, renewalMonths: null, hasRenewal: null, description: null }
  const d = x.match(/<DURATION TYPE="(MONTH|YEAR|DAY)">\s*(\d+)\s*<\/DURATION>/)
  if (d) {
    const n = Number(d[2])
    out.durationMonths = d[1] === 'YEAR' ? n * 12 : d[1] === 'DAY' ? Math.round(n / 30) : n
  }
  const s = x.match(/<DATE_START>(\d{4}-\d{2}-\d{2})/)
  const e = x.match(/<DATE_END>(\d{4}-\d{2}-\d{2})/)
  if (s) out.start = s[1]
  if (e) out.end = e[1]
  if (/<NO_RENEWAL\/>/.test(x)) out.hasRenewal = false
  if (/<RENEWAL\/>/.test(x)) out.hasRenewal = true
  const renewalDescr = xmlText(x, 'RENEWAL_DESCR')
  if (renewalDescr) out.renewalMonths = renewalMonthsFromText(renewalDescr)
  out.description = xmlText(x, 'SHORT_DESCR')
  // R2.0.8: löptid i OBJECT_CONTRACT_INFORMATION
  if (!out.durationMonths) {
    const m = x.match(/<INTERVAL_TIME>[\s\S]*?<(MONTHS|YEARS)>(\d+)<\/\1>/)
    if (m) out.durationMonths = m[1] === 'YEARS' ? Number(m[2]) * 12 : Number(m[2])
  }
  return out
}

async function loadContractNotice(ref) {
  if (!existsSync(CN_DIR)) mkdirSync(CN_DIR, { recursive: true })
  const file = resolve(CN_DIR, `${ref}.xml`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const res = await politeFetch(`https://ted.europa.eu/en/notice/${ref}/xml`, { headers: { Accept: 'application/xml' } })
  if (!res.ok) {
    if (verbose) console.warn(`  ${ref}: HTTP ${res.status}`)
    return null
  }
  const text = await res.text()
  if (!text.includes('<TED_EXPORT')) return null
  writeFileSync(file, text)
  return text
}

// ---------------------------------------------------------------------------

function eformsDuration(raw) {
  if (!raw) return null
  const v = Number(arr(raw['duration-period-value-lot'])[0])
  if (!Number.isFinite(v) || v <= 0) return null
  const period = arr(raw['contract-duration-period-lot'])[0]
  const unit = String(arr(raw['duration-period-unit-lot'])[0] ?? (period && typeof period === 'object' ? period.unit : '') ?? '').toLowerCase()
  if (unit.startsWith('year') || unit === 'ann') return v * 12
  if (unit.startsWith('month') || unit === 'mon') return v
  if (unit.startsWith('day')) return Math.round(v / 30)
  return null
}

function langFirst(v) {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0] ?? null
  const pick = v.swe ?? v.eng ?? Object.values(v)[0]
  return Array.isArray(pick) ? pick[0] ?? null : pick ?? null
}

async function main() {
  const sb = await client()
  const rows = await selectAll(sb)
  console.log(`Tilldelningar: ${rows.length}${args.dryRun ? ' (torrkörning, inget skrivs)' : ''}${fetchCn ? ', hämtar ursprungliga TED-annonser' : ''}`)

  // Rådata finns bara på första vinnarraden per TED-upphandling: dela den i gruppen
  const rawByRef = new Map()
  for (const r of rows) if (r.raw && r.source_ref) rawByRef.set(`${r.source}:${r.source_ref}`, r.raw)

  const cnByRef = new Map()
  if (fetchCn) {
    const refs = new Set()
    for (const r of rows) {
      if (r.source !== 'ted_xml') continue
      const raw = rawByRef.get(`${r.source}:${r.source_ref}`)
      for (const ref of arr(raw?.ursprunglig_annons)) refs.add(ref)
    }
    console.log(`Ursprungliga annonser att läsa: ${refs.size}`)
    for (const ref of refs) {
      try {
        const x = await loadContractNotice(ref)
        if (x) cnByRef.set(ref, parseContractNotice(x))
      } catch (err) {
        console.warn(`  ${ref}: ${err instanceof Error ? err.message : err}`)
      }
    }
    console.log(`  lästa: ${cnByRef.size}, med avtalstid: ${[...cnByRef.values()].filter((c) => c.durationMonths).length}`)
  }

  const updates = []
  const stats = { excludedNew: 0, excludedCleared: 0, manualKept: 0, endChanged: 0, bySource: {} }
  const today = new Date().toISOString().slice(0, 10)
  for (const r of rows) {
    const raw = rawByRef.get(`${r.source}:${r.source_ref}`) ?? r.raw ?? {}
    const input = {
      tedEnd: r.contract_end,
      renewalMax: r.renewal_max,
      contractStart: r.contract_start,
      contractSignedDate: r.contract_signed_date,
      awardDate: r.award_date,
      awardNoticeDate: null,
      tenderPublishedDate: null,
      durationMonths: null,
      durationFrom: null,
    }
    let durationText = null
    if (r.source === 'ted') {
      input.durationMonths = eformsDuration(raw)
      if (input.durationMonths) input.durationFrom = 'ted'
      durationText = langFirst(raw['description-lot'])
      if (!input.awardDate && !input.contractSignedDate) input.awardNoticeDate = tedDate(arr(raw['publication-date'])[0])
    } else if (r.source === 'ted_xml') {
      input.awardNoticeDate = tedDate(raw.publicerad)
      const cn = arr(raw.ursprunglig_annons).map((ref) => cnByRef.get(ref)).find(Boolean)
      if (cn) {
        if (cn.start && !input.contractStart) input.contractStart = cn.start
        if (cn.end && !input.tedEnd) input.tedEnd = cn.end
        if (cn.durationMonths) {
          input.durationMonths = cn.durationMonths
          input.durationFrom = 'ted'
        }
        if (input.renewalMax == null) {
          if (cn.hasRenewal === false) input.renewalMax = 0
          else if (cn.renewalMonths) input.renewalMax = cn.renewalMonths / 12
        }
        durationText = cn.description
      }
    } else if (r.source === 'uhm') {
      const up = raw.upphandling ?? {}
      const pub = Object.entries(up).find(([k]) => k.trim().toLowerCase() === 'publiceringsdatum')?.[1]
      input.tenderPublishedDate = tedDate(pub)
    } else if (r.source === 'mercell') {
      durationText = raw.description ?? null
      input.mercellExpiry = raw.contractExpiryDate ?? null
    }
    if (!input.durationMonths && durationText) {
      const parsed = parseDurationText(durationText)
      if (parsed) {
        input.durationMonths = parsed.months
        input.durationFrom = 'text'
        if (input.renewalMax == null && parsed.renewalMonths > 0) input.renewalMax = parsed.renewalMonths / 12
      }
    }
    const end = computeContractEnd(input)
    const win = workWindow(end.date)
    const rel = awardRelevance(r.cpv_codes ?? [], r.title)
    const manual = !!r.excluded_at && (!r.excluded_reason || String(r.excluded_reason).startsWith('Manuellt'))

    const patch = {
      calc_end_date: end.date,
      calc_end_source: end.source,
      start_basis_date: end.startBasis,
      duration_months: input.durationMonths,
      calc_basis: end.basis,
      window_start: win.start,
      window_end: win.end,
    }
    if (manual) stats.manualKept++
    else {
      patch.excluded_reason = rel.relevant ? null : rel.reason
      patch.excluded_at = rel.relevant ? null : r.excluded_at ?? new Date().toISOString()
      if (!rel.relevant && !r.excluded_reason) stats.excludedNew++
      if (rel.relevant && r.excluded_reason) stats.excludedCleared++
    }
    const changed = Object.entries(patch).some(([k, v]) => String(r[k] ?? '') !== String(v ?? '') && k !== 'excluded_at')
    if (end.date !== r.calc_end_date) stats.endChanged++
    const key = `${r.source}|${end.source ?? 'inget'}`
    stats.bySource[key] ??= { rows: 0, passed: 0 }
    stats.bySource[key].rows++
    if (end.date && end.date < today) stats.bySource[key].passed++
    if (changed) updates.push({ id: r.id, patch, title: r.title, source: r.source, excluded: patch.excluded_reason, before: r.calc_end_date, after: end.date })
  }

  console.log('\nKälla och slutdatumets källa (rader, varav slut passerat):')
  for (const [k, v] of Object.entries(stats.bySource).sort()) console.log(`  ${k.padEnd(36)} ${String(v.rows).padStart(4)}  ${String(v.passed).padStart(4)}`)
  console.log(`\nNya felträffar: ${stats.excludedNew}, avflaggade: ${stats.excludedCleared}, manuella beslut behållna: ${stats.manualKept}`)
  console.log(`Ändrat slutdatum: ${stats.endChanged}, rader att uppdatera: ${updates.length}`)
  const excluded = updates.filter((u) => u.excluded)
  if (excluded.length) {
    console.log('\nFelträffar (titel, källa, orsak):')
    const seen = new Set()
    for (const u of excluded) {
      const k = `${u.title}|${u.source}`
      if (seen.has(k)) continue
      seen.add(k)
      console.log(`  ${u.source.padEnd(8)} ${String(u.title).slice(0, 70).padEnd(70)} ${u.excluded}`)
    }
  }

  if (args.dryRun) return
  let done = 0
  for (const u of updates) {
    const { error } = await sb.from('procurement_awards').update(u.patch).eq('id', u.id)
    if (error) throw new Error(`${u.id}: ${error.message}`)
    done++
  }
  console.log(`\nUppdaterade: ${done}`)
  const counties = await sb.rpc('procurement_resolve_buyer_counties')
  console.log(`Län satta på köpare: ${counties.error ? `fel: ${counties.error.message}` : counties.data}`)
  const f = await sb.rpc('procurement_refresh_award_followups')
  console.log(`Uppföljning: ${f.error ? `fel: ${f.error.message}` : JSON.stringify(f.data)}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
