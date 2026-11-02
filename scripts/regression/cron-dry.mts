// scripts/regression/cron-dry.mts
// Lokal torrkörning av nattjobbet (api/cron/generate-continuing-contracts.ts)
// med skrivspärr: bara GET/HEAD och läsande RPC:er släpps igenom, allt annat
// stoppas och räknas. Inte ens loggraden i cron_runs skrivs.
//
// Körning:
//   npx tsx --env-file=.env scripts/regression/cron-dry.mts [--today=2027-01-15] [--out=fil.json]
//
// --today flyttar klockan (Date) före importen, så att nattjobbet räknar som
// om det vore den dagen. Utan --today gäller dagens datum. Körs med v2 av
// (den skarpa körningen) och v2 på (torrkörningen 03:30). Utdata: per läge
// antal, would_create och would_refresh med summa och rader per faktura.
// CRON_MOD=<sökväg> kör en annan kopia av nattjobbet (t.ex. en worktree).

process.env.TZ = 'Europe/Stockholm'

import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const FAKE = arg('today') ?? process.env.FAKE_TODAY
if (FAKE) {
  const RealDate = Date
  const fakeNow = new RealDate(FAKE + 'T05:00:00').getTime()
  class FakeDate extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(fakeNow)
      else super(...(a as [string]))
    }
    static now() {
      return fakeNow
    }
  }
  ;(globalThis as { Date: DateConstructor }).Date = FakeDate as unknown as DateConstructor
}
if (!process.env.SUPABASE_SERVICE_KEY) process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL

const ALLOWED_RPC = new Set(['contract_addon_ledger', 'invoice_marking_split_ready', 'addon_gap_candidates'])
let blocked = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET').toUpperCase()
  const rpc = /\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(url)?.[1]
  if (method === 'GET' || method === 'HEAD' || (rpc && ALLOWED_RPC.has(rpc))) return realFetch(input, init)
  blocked++
  console.error(`SPÄRR: ${method} ${url}`)
  throw new Error(`skrivspärr: ${method} ${url}`)
}) as typeof fetch

const modPath = process.env.CRON_MOD
  ? pathToFileURL(resolve(process.env.CRON_MOD)).href
  : new URL('../../api/cron/generate-continuing-contracts.ts', import.meta.url).href
const mod = await import(modPath)

const out: Record<string, unknown> = { today: FAKE ?? null }
for (const v2 of [false, true]) {
  const ctx = { dryRun: true, v2, planned: [] as Array<{ action: string }> }
  const r = await mod.runContinuingContracts(ctx)
  const s = r.summary
  out[v2 ? 'v2' : 'skarp'] = {
    contracts_selected: s.contracts_selected,
    customers: s.customers_processed,
    would_create_count: s.would_create_count,
    would_refresh_count: s.would_refresh_count,
    errors: s.errors,
    // Hela listan (summeringen i cron_runs kapas vid 500 och saknar rader)
    would_create: ctx.planned.filter((w) => w.action === 'create'),
    would_refresh: ctx.planned.filter((w) => w.action === 'refresh'),
  }
}
out.blocked = blocked
const json = JSON.stringify(out, null, 1)
const file = arg('out')
if (file) writeFileSync(file, json)
else console.log(json)
console.error(`Skrivförsök stoppade: ${blocked}`)
