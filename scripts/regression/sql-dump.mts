// scripts/regression/sql-dump.mts
// Kör scripts/regression/sql-dump.sql:s innehåll via service role och skriver
// deterministisk JSON till scripts/regression/out/. PostgREST kan inte köra
// fri SQL, så samma två funktioner anropas som RPC (båda läser bara, STABLE,
// kontrollerat med pg_get_functiondef 2026-10-30) och next_invoice_replik
// räknas med samma uttryck som i .sql-filen.
//
// Körning:
//   npx tsx --env-file=.env scripts/regression/sql-dump.mts
//
// meta.md5 är samma kontrollsumma som frågan längst ned i sql-dump.sql ger,
// så resultatet kan stämmas av mot en körning i SQL-editorn eller via MCP.

process.env.TZ = 'Europe/Stockholm'

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outArg = process.argv.find((a) => a.startsWith('--out-dir='))
const OUT_DIR = outArg ? outArg.slice('--out-dir='.length) : join(here, 'out')
const GIT_SHA = execSync('git rev-parse --short=8 HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()

const DAYS = ['2026-10-30', '2026-12-31', '2027-01-01', '2027-02-28', '2027-06-30', '2027-07-01', '2028-02-29']

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas. Kör med npx tsx --env-file=.env')
  process.exit(2)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const READ_ONLY_RPCS = new Set(['contract_next_period_start', 'contract_next_unplanned_period'])
async function rpcRead(fn: string, params: Record<string, unknown>): Promise<string | null> {
  if (!READ_ONLY_RPCS.has(fn)) throw new Error(`RPC ${fn} är inte godkänd som läsande`)
  const { data, error } = await sb.rpc(fn, params)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return (data as string | null) ?? null
}

const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Samma uttryck som next_invoice_replik i sql-dump.sql (contract_customer_view med current_date = d). */
function nextInvoiceReplik(anchor: number | null, day: string): string | null {
  if (anchor === null) return null
  const year = Number(day.slice(0, 4))
  const candidate = `${year}-${String(anchor).padStart(2, '0')}-01`
  return candidate <= day ? `${year + 1}-${String(anchor).padStart(2, '0')}-01` : candidate
}

const { data: contracts, error } = await sb
  .from('contracts')
  .select('id, billing_anchor_month')
  .eq('type', 'contract')
  .in('status', ['signed', 'active'])
  .order('id', { ascending: true })
  .range(0, 9999)
if (error) throw new Error(`contracts: ${error.message}`)
const live = ((contracts ?? []) as Array<{ id: string; billing_anchor_month: number | null }>).sort((a, b) => byStr(a.id, b.id))

type Row = { contract_id: string; day: string; next_period_start: string | null; next_unplanned_period: string | null; next_invoice_replik: string | null }
const tasks: Array<() => Promise<Row>> = []
for (const c of live) {
  for (const day of DAYS) {
    tasks.push(async () => ({
      contract_id: c.id,
      day,
      next_period_start: await rpcRead('contract_next_period_start', { p_contract_id: c.id, p_from: day }),
      next_unplanned_period: await rpcRead('contract_next_unplanned_period', { p_contract_id: c.id, p_today: day }),
      next_invoice_replik: nextInvoiceReplik(c.billing_anchor_month, day),
    }))
  }
}
const rows: Row[] = []
for (let i = 0; i < tasks.length; i += 10) {
  rows.push(...(await Promise.all(tasks.slice(i, i + 10).map((t) => t()))))
}
rows.sort((a, b) => byStr(a.contract_id, b.contract_id) || byStr(a.day, b.day))

const md5 = createHash('md5')
  .update(
    rows
      .map((r) => `${r.contract_id}|${r.day}|${r.next_period_start ?? ''}|${r.next_unplanned_period ?? ''}|${r.next_invoice_replik ?? ''}`)
      .join('\n'),
    'utf8'
  )
  .digest('hex')

const dump = {
  meta: {
    kind: 'sql-dump',
    format: 1,
    git_sha: GIT_SHA,
    days: DAYS,
    counts: { live_contracts: live.length, rows: rows.length },
    md5,
    skipped: ["contract_customer_view(id)->>'next_invoice' (kräver auth-kontext, läser current_date); ersatt av next_invoice_replik"],
  },
  rows,
}

// Datumet i filnamnet är körningsdagen: contract_next_unplanned_period läser
// befintliga fakturor, så resultatet följer databasens läge den dagen.
const runDay = new Date()
const runIso = `${runDay.getFullYear()}-${String(runDay.getMonth() + 1).padStart(2, '0')}-${String(runDay.getDate()).padStart(2, '0')}`
mkdirSync(OUT_DIR, { recursive: true })
const fileName = `sql-${runIso}-${GIT_SHA}.json`
const filePath = join(OUT_DIR, fileName)
const body = JSON.stringify(dump, null, 1) + '\n'
writeFileSync(filePath, body, 'utf8')
const hash = createHash('sha256').update(body, 'utf8').digest('hex')
writeFileSync(`${filePath}.sha256`, `${hash}  ${fileName}\n`, 'utf8')

console.log(`Skrev ${filePath}`)
console.log(`Avtal: ${live.length}, datum: ${DAYS.length}, rader: ${rows.length}, md5 ${md5}`)
console.log(`sha256 ${hash}`)
