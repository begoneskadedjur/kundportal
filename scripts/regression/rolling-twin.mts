// scripts/regression/rolling-twin.mts
// Datasteg 18, STRUL 1 (2026-10-31): TS mot SQL för periodregeln på riktiga
// avtal, båda lägena, med fokus på löpande avtal efter bindningstidens slut.
//
// Jämför för varje levande avtal och varje frågedatum:
//   1. contract_next_period_start(uuid, date) mot nextPeriodStart (contractPeriods.ts)
//   2. contract_period_on(uuid, date) mot periodContaining (bara avtal i exakt läge)
//   3. contract_next_unplanned_period(uuid, date) mot planerarens bindningsfönster
//      (computePlannedPeriods, window 'binding'): första planerade periodstart
//      efter dagen utan överlappande avtalsfaktura. Funktionen räknar fönstret
//      med en egen regel (perioden ska rymmas, v_full) och inte med
//      mittpunkten; skillnaderna skrivs ut som information och räknas per läge.
// Krav: 1 och 2 noll skillnader. 3 får inte ha fler skillnader i exakt läge
// än i gamla läget för samma avtalstyp (skrivs ut, styr inte exitkoden).
//
// Körning:
//   npx tsx --env-file=.env scripts/regression/rolling-twin.mts
// Läser bara (SELECT och tre läsande SQL-funktioner).

process.env.TZ = 'Europe/Stockholm'

import { createClient } from '@supabase/supabase-js'
import { nextPeriodStart, periodContaining, isStartDayMode } from '../../src/shared/contractPeriods'
import { computePlannedPeriods, type PlanningContract } from '../../src/shared/contractPlanner'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas. Kör med npx tsx --env-file=.env')
  process.exit(2)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const DAYS = ['2026-10-31', '2026-12-31', '2027-01-01', '2027-02-04', '2027-02-28', '2027-06-30', '2027-07-01', '2028-02-29']
const READ_ONLY = new Set(['contract_next_period_start', 'contract_period_on', 'contract_next_unplanned_period'])

async function rpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  if (!READ_ONLY.has(fn)) throw new Error(`RPC ${fn} är inte godkänd som läsande`)
  const { data, error } = await sb.rpc(fn, params)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

type C = PlanningContract & { id: string; start_date: string | null }
const { data, error } = await sb
  .from('contracts')
  .select(
    'id, contract_start_date, start_date, contract_end_date, terminated_at, effective_end_date, billing_frequency, billing_anchor_month, billing_anchor_mode, billing_active, notice_period_months, renewal_mode, annual_value'
  )
  .eq('type', 'contract')
  .in('status', ['signed', 'active'])
  .order('id', { ascending: true })
  .range(0, 9999)
if (error) throw new Error(`contracts: ${error.message}`)
const contracts = (data ?? []) as C[]

const { data: invData, error: invErr } = await sb
  .from('invoices')
  .select('contract_id, billing_period_start, billing_period_end, status, invoice_type')
  .eq('invoice_type', 'contract')
  .neq('status', 'cancelled')
  .not('contract_id', 'is', null)
  .order('id', { ascending: true })
  .range(0, 9999)
if (invErr) throw new Error(`invoices: ${invErr.message}`)
const invByContract = new Map<string, Array<{ s: string; e: string }>>()
for (const i of (invData ?? []) as Array<{ contract_id: string; billing_period_start: string | null; billing_period_end: string | null }>) {
  if (!i.billing_period_start) continue
  const list = invByContract.get(i.contract_id) ?? []
  list.push({ s: i.billing_period_start, e: i.billing_period_end ?? i.billing_period_start })
  invByContract.set(i.contract_id, list)
}

const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(y, m - 1 + n, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  const out = new Date(t.getFullYear(), t.getMonth(), Math.min(d, last))
  return `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, '0')}-${String(out.getDate()).padStart(2, '0')}`
}

/** Planerarens svar på samma fråga som contract_next_unplanned_period. */
function tsNextUnplanned(c: C, day: string): string | null {
  if (!c.billing_frequency || c.billing_frequency === 'on_demand') return null
  const planned = computePlannedPeriods({ ...c, annual_value: 1, billing_active: true }, { window: 'binding', today: day })
  const step = c.billing_frequency === 'monthly' ? 1 : c.billing_frequency === 'quarterly' ? 3 : c.billing_frequency === 'semi_annual' ? 6 : 12
  const next = planned.find((p) => p.periodStart > day)
  if (!next) return null
  const end = addMonths(next.periodStart, step)
  const covered = (invByContract.get(c.id) ?? []).some((i) => i.s < end && i.e >= next.periodStart)
  return covered ? null : next.periodStart
}

let d1 = 0
let d2 = 0
const d3 = { legacy: 0, exact: 0 }
const d3List: string[] = []
const checked = { all: 0, exact: 0 }
for (const c of contracts) {
  const exact = isStartDayMode(c)
  if (exact) checked.exact++
  checked.all++
  for (const day of DAYS) {
    const [sqlNext, sqlOn, sqlUnplanned] = await Promise.all([
      rpc<string | null>('contract_next_period_start', { p_contract_id: c.id, p_from: day }),
      exact ? rpc<Array<{ period_start: string; period_end: string }>>('contract_period_on', { p_contract_id: c.id, p_day: day }) : Promise.resolve([]),
      rpc<string | null>('contract_next_unplanned_period', { p_contract_id: c.id, p_today: day }),
    ])
    const tsNext = nextPeriodStart(c, day)
    if ((sqlNext ?? null) !== (tsNext ?? null)) {
      d1++
      if (d1 <= 30) console.log(`next_period_start ${c.id.slice(0, 8)} ${day}: SQL ${sqlNext} TS ${tsNext}`)
    }
    if (exact) {
      const p = periodContaining(c, day)
      const ts = p ? `${p.periodStart}..${p.periodEnd}` : 'tomt'
      const sql = sqlOn[0] ? `${sqlOn[0].period_start}..${sqlOn[0].period_end}` : 'tomt'
      if (ts !== sql) {
        d2++
        if (d2 <= 30) console.log(`period_on ${c.id.slice(0, 8)} ${day}: SQL ${sql} TS ${ts}`)
      }
    }
    const tsU = tsNextUnplanned(c, day)
    if ((sqlUnplanned ?? null) !== tsU) {
      d3[exact ? 'exact' : 'legacy']++
      d3List.push(`${exact ? 'exakt' : 'gamla'} ${c.id.slice(0, 8)} ${day}: SQL ${sqlUnplanned} TS ${tsU} (slut ${c.contract_end_date}, ${c.billing_frequency})`)
    }
  }
}

console.log(`Avtal: ${checked.all} (exakt läge ${checked.exact}), datum: ${DAYS.length}`)
console.log(`1. contract_next_period_start mot nextPeriodStart: ${d1} skillnader`)
console.log(`2. contract_period_on mot periodContaining (exakt läge): ${d2} skillnader`)
console.log(`3. contract_next_unplanned_period mot planerarens fönster (information): gamla läget ${d3.legacy}, exakt läge ${d3.exact}`)
for (const l of d3List.slice(0, 60)) console.log(`   ${l}`)
process.exit(d1 === 0 && d2 === 0 ? 0 : 1)
