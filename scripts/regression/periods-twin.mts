// scripts/regression/periods-twin.mts
// Steg 6 i docs/planer/avtalsar-exakt-arsdag-teknik.md: SQL-tvillingen mot TS.
// Kör public.contract_period_on_pure(p_start, p_freq, p_day) (ren, IMMUTABLE,
// läser ingen tabell) för ett fast urval kombinationer och jämför med
// periodContaining i src/shared/contractPeriods.ts i exakt läge.
// Krav: noll skillnader.
//
// Körning:
//   npx tsx --env-file=.env scripts/regression/periods-twin.mts
//   (valfritt --starts=N, standard 20 startdagar × 4 frekvenser × 5 frågedatum = 400)
//
// Urvalet är deterministiskt (fast frö): startdagar 1 till 31 i månader
// 2023 till 2026 (ogiltiga dagar hoppas över), med månadsslut och 29 februari
// alltid med, och frågedatum från 60 dagar före start till sex år efter,
// där varje start får en dag precis på och en precis före en periodgräns.

process.env.TZ = 'Europe/Stockholm'

import { createClient } from '@supabase/supabase-js'
import { addMonthsClampedIso, periodContaining, periodStepMonths } from '../../src/shared/contractPeriods'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas. Kör med npx tsx --env-file=.env')
  process.exit(2)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const startsArg = process.argv.find((a) => a.startsWith('--starts='))
const N_STARTS = startsArg ? Number(startsArg.slice('--starts='.length)) : 20
const FREQS = ['monthly', 'quarterly', 'semi_annual', 'annual'] as const

// Fast frö (mulberry32) så att två körningar provar samma kombinationer.
let seed = 20261030
function rnd(): number {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDaysIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return isoOf(new Date(y, m - 1, d + days))
}
function validDay(y: number, m: number, d: number): boolean {
  return d <= new Date(y, m, 0).getDate()
}

const fixedStarts = ['2024-02-29', '2023-01-31', '2026-01-31', '2025-08-31', '2023-05-31', '2024-03-30']
const starts: string[] = fixedStarts.slice(0, N_STARTS)
while (starts.length < N_STARTS) {
  const y = 2023 + Math.floor(rnd() * 4)
  const m = 1 + Math.floor(rnd() * 12)
  const d = 1 + Math.floor(rnd() * 31)
  if (!validDay(y, m, d)) continue
  const iso = `${y}-${pad(m)}-${pad(d)}`
  if (!starts.includes(iso)) starts.push(iso)
}

type Combo = { start: string; freq: string; day: string }
const combos: Combo[] = []
for (const start of starts) {
  for (const freq of FREQS) {
    const step = periodStepMonths(freq)
    const k = 1 + Math.floor(rnd() * 8)
    const boundary = addMonthsClampedIso(start, k * step)
    const days = [
      boundary,
      addDaysIso(boundary, -1),
      addDaysIso(start, -1 - Math.floor(rnd() * 60)),
      addDaysIso(start, Math.floor(rnd() * 365 * 6)),
      addDaysIso(start, Math.floor(rnd() * 365 * 6)),
    ]
    for (const day of days) combos.push({ start, freq, day })
  }
}

const diffs: Array<Combo & { ts: string; sql: string }> = []
const BATCH = 20
for (let i = 0; i < combos.length; i += BATCH) {
  const batch = combos.slice(i, i + BATCH)
  const results = await Promise.all(
    batch.map(async (c) => {
      const { data, error } = await sb.rpc('contract_period_on_pure', { p_start: c.start, p_freq: c.freq, p_day: c.day })
      if (error) throw new Error(`contract_period_on_pure(${c.start}, ${c.freq}, ${c.day}): ${error.message}`)
      const row = (data as Array<{ period_start: string; period_end: string }>)[0]
      return row ? `${row.period_start}..${row.period_end}` : 'tomt'
    })
  )
  batch.forEach((c, j) => {
    const p = periodContaining({ contract_start_date: c.start, billing_frequency: c.freq, billing_anchor_mode: 'start_day' }, c.day)
    const ts = p ? `${p.periodStart}..${p.periodEnd}` : 'tomt'
    if (ts !== results[j]) diffs.push({ ...c, ts, sql: results[j] })
  })
}

console.log(`Kombinationer: ${combos.length} (${starts.length} startdagar × ${FREQS.length} frekvenser × 5 frågedatum)`)
console.log(`Skillnader TS mot SQL: ${diffs.length}`)
for (const d of diffs.slice(0, 50)) console.log(`  ${d.start} ${d.freq} ${d.day}: TS ${d.ts}, SQL ${d.sql}`)
process.exit(diffs.length === 0 ? 0 : 1)
