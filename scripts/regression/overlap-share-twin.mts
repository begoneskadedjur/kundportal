// scripts/regression/overlap-share-twin.mts
// Steg 7 i docs/planer/avtalsar-exakt-arsdag-teknik.md: överlappsandelen, TS mot SQL.
// Kör public.contract_period_overlap_share(a_start, a_end, b_start, b_end) (ren,
// IMMUTABLE, läser ingen tabell; samma funktion som överlappsvakten
// guard_contract_invoice_overlap anropar) för ett fast urval par och jämför med
// periodOverlapShare i src/shared/contractInvoiceMatch.ts, som matchningen
// använder för avtal med exakt avtalsdag. Jämför både talet och om det når
// gränsen (minst hälften). Krav: noll skillnader.
//
// Körning:
//   npx tsx --env-file=.env scripts/regression/overlap-share-twin.mts
//   (valfritt --pairs=N, standard 400)

process.env.TZ = 'Europe/Stockholm'

import { createClient } from '@supabase/supabase-js'
import { periodOverlapShare, SAME_PERIOD_SHARE } from '../../src/shared/contractInvoiceMatch'
import { addMonthsClampedIso } from '../../src/shared/contractPeriods'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas. Kör med npx tsx --env-file=.env')
  process.exit(2)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const pairsArg = process.argv.find((a) => a.startsWith('--pairs='))
const N_PAIRS = pairsArg ? Number(pairsArg.slice('--pairs='.length)) : 400

// Fast frö (mulberry32), samma generator som periods-twin.mts.
let seed = 20261030
function rnd(): number {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pad = (n: number) => String(n).padStart(2, '0')
const addDaysIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const x = new Date(y, m - 1, d + days)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

type Pair = { a: { start: string; end: string }; b: { start: string; end: string } }
const pairs: Pair[] = [
  // Fasta fall: planens exempel och gränsen kring hälften (också i vitest)
  { a: { start: '2026-11-25', end: '2027-11-24' }, b: { start: '2026-11-01', end: '2027-10-31' } }, // Brynäs P1 mot utkastet
  { a: { start: '2026-06-30', end: '2027-06-29' }, b: { start: '2026-07-01', end: '2027-06-30' } }, // FEV P1 mot låst
  { a: { start: '2027-06-30', end: '2028-06-29' }, b: { start: '2026-07-01', end: '2027-06-30' } }, // FEV P2, en dag
  { a: { start: '2030-01-01', end: '2030-01-10' }, b: { start: '2030-01-06', end: '2030-01-20' } }, // exakt 0,5
  { a: { start: '2030-01-01', end: '2030-01-10' }, b: { start: '2030-01-07', end: '2030-01-20' } }, // 0,4
  { a: { start: '2026-05-01', end: '2026-05-31' }, b: { start: '2026-05-20', end: '2026-06-19' } }, // M1/M2
  { a: { start: '2027-01-01', end: '2027-01-31' }, b: { start: '2027-02-01', end: '2027-02-28' } }, // inget överlapp
  { a: { start: '2028-02-29', end: '2028-02-29' }, b: { start: '2028-02-01', end: '2028-03-31' } }, // en dag, skottdag
]
const LENGTHS = [1, 2, 10, 14, 28, 29, 30, 31, 90, 92, 181, 183, 365, 366, 730]
while (pairs.length < N_PAIRS) {
  const y = 2024 + Math.floor(rnd() * 4)
  const aStart = `${y}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`
  const aEnd = rnd() < 0.5 ? addDaysIso(addMonthsClampedIso(aStart, [1, 3, 6, 12][Math.floor(rnd() * 4)]), -1) : addDaysIso(aStart, LENGTHS[Math.floor(rnd() * LENGTHS.length)] - 1)
  const bStart = addDaysIso(aStart, Math.floor(rnd() * 800) - 400)
  const bEnd = addDaysIso(bStart, LENGTHS[Math.floor(rnd() * LENGTHS.length)] - 1)
  pairs.push({ a: { start: aStart, end: aEnd }, b: { start: bStart, end: bEnd } })
}

const diffs: Array<Pair & { ts: number; sql: number }> = []
let reachHalf = 0
const BATCH = 20
for (let i = 0; i < pairs.length; i += BATCH) {
  const batch = pairs.slice(i, i + BATCH)
  const results = await Promise.all(
    batch.map(async (p) => {
      const { data, error } = await sb.rpc('contract_period_overlap_share', {
        p_a_start: p.a.start,
        p_a_end: p.a.end,
        p_b_start: p.b.start,
        p_b_end: p.b.end,
      })
      if (error) throw new Error(`contract_period_overlap_share: ${error.message}`)
      return Number(data)
    })
  )
  batch.forEach((p, j) => {
    const ts = periodOverlapShare(p.a, p.b)
    const sql = results[j]
    if (ts >= SAME_PERIOD_SHARE) reachHalf++
    // Talet (numeric i SQL, double i TS) och gränsen
    if (Math.abs(ts - sql) > 1e-9 || ts >= SAME_PERIOD_SHARE !== sql >= 0.5) diffs.push({ ...p, ts, sql })
  })
}

console.log(`Par: ${pairs.length}, varav ${reachHalf} med andel minst hälften`)
console.log(`Skillnader TS mot SQL: ${diffs.length}`)
for (const d of diffs.slice(0, 50)) console.log(`  ${d.a.start}..${d.a.end} mot ${d.b.start}..${d.b.end}: TS ${d.ts}, SQL ${d.sql}`)
process.exit(diffs.length === 0 ? 0 : 1)
