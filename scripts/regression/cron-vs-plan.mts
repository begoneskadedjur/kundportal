// scripts/regression/cron-vs-plan.mts
// Jämför fakturaraderna som nattjobbet (api/cron/generate-continuing-contracts.ts)
// skulle skapa med raderna som Planera fakturor (ContractInvoiceGenerator,
// planCombinedForCustomer i provläge) ger för samma period. Läser prod med
// service role och skrivspärr: bara GET/HEAD och läsande RPC:er släpps
// igenom. sync_addon_*-RPC:erna (skriver) stoppas, så båda sidor läser
// § 6-raderna som de ligger.
//
// Körning (vite-node behövs för generatorns import.meta.env):
//   VITE_SUPABASE_ANON_KEY=<service role> npx vite-node scripts/regression/cron-vs-plan.mts -- --today=2027-01-15 [--out=fil.json]
// Enklast via cron-vs-plan.sh i samma mapp, som läser nyckeln ur .env.
//
// Exitkod 0 när alla fakturor har identiska rader (text, antal, à-pris,
// summa, moms, rabatt, artikel, radtyp, stationer), märkning och anteckning.

process.env.TZ = 'Europe/Stockholm'

import { writeFileSync } from 'node:fs'

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const FAKE = arg('today')
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
;(globalThis as { window?: unknown }).window ??= { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }

const ALLOWED_RPC = new Set(['contract_addon_ledger', 'invoice_marking_split_ready', 'addon_gap_candidates'])
let blocked = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET').toUpperCase()
  const rpc = /\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(url)?.[1]
  if (method === 'GET' || method === 'HEAD' || (rpc && ALLOWED_RPC.has(rpc))) return realFetch(input, init)
  blocked++
  throw new Error(`skrivspärr: ${method} ${url}`)
}) as typeof fetch
const realWarn = console.warn
console.warn = (...a: unknown[]) => {
  if (String(a[0] ?? '').includes('Antalssynk')) return
  realWarn(...a)
}

const cron = await import('../../api/cron/generate-continuing-contracts.ts')
const { ContractInvoiceGenerator } = await import('../../src/services/contractInvoiceGenerator.ts')

type Row = Record<string, unknown>
type Write = {
  customer_id: string
  company_name: string
  contract_id: string | null
  kind: string
  periodStart: string
  periodEnd: string
  subtotal: number
  action: string
  marking?: string | null
  notes?: string
  rows?: Row[]
}

const FIELDS = [
  'contract_id',
  'line_kind',
  'case_billing_item_id',
  'article_id',
  'article_code',
  'article_name',
  'quantity',
  'unit_price',
  'total_price',
  'vat_rate',
  'discount_percent',
  'rot_rut_type',
  'fastighetsbeteckning',
  'station_ids',
]
const norm = (r: Row) => {
  const o: Row = {}
  for (const f of FIELDS) {
    const v = r[f]
    o[f] = v === undefined ? null : Array.isArray(v) ? [...v].sort() : typeof v === 'number' ? Math.round(v * 100) / 100 : v
  }
  return JSON.stringify(o)
}

// Nattjobbet: båda lägena (skarp och v2), unionen av poster
const writes = new Map<string, Write>()
for (const v2 of [false, true]) {
  const ctx = { dryRun: true, v2, planned: [] as Write[] }
  await cron.runContinuingContracts(ctx)
  for (const w of ctx.planned) writes.set(`${w.action}|${w.customer_id}|${w.contract_id}|${w.kind}|${w.periodStart}|${w.periodEnd}`, w)
}

// Planera fakturor per kund
const plansByCustomer = new Map<string, Awaited<ReturnType<typeof ContractInvoiceGenerator.planCombinedForCustomer>>>()
const results: Array<Record<string, unknown>> = []
let identical = 0
for (const w of writes.values()) {
  if (!plansByCustomer.has(w.customer_id)) plansByCustomer.set(w.customer_id, await ContractInvoiceGenerator.planCombinedForCustomer(w.customer_id))
  const entries = plansByCustomer.get(w.customer_id)!.flatMap((p) =>
    p.entries.map((e) => ({ ...e, contractId: e.contractId ?? p.contractId, consolidated: e.consolidated ?? p.consolidated ?? false }))
  )
  const match = entries.filter(
    (e) =>
      e.planned &&
      e.rows &&
      (e.kind ?? 'premium') === w.kind &&
      e.planned.periodStart === w.periodStart &&
      e.planned.periodEnd === w.periodEnd &&
      (w.contract_id ? e.contractId === w.contract_id && !e.consolidated : e.consolidated)
  )
  const base = {
    action: w.action,
    customer: w.company_name,
    contract_id: w.contract_id,
    kind: w.kind,
    period: `${w.periodStart} t.o.m. ${w.periodEnd}`,
    cron_subtotal: w.subtotal,
  }
  if (match.length === 0) {
    results.push({ ...base, result: 'saknas i Planera fakturor', cron_rows: w.rows })
    continue
  }
  // Flera träffar (v2 per märkning): välj den med samma märkning
  const e = match.find((m) => (m.marking ?? null) === (w.marking ?? null)) ?? match[0]
  const a = (w.rows ?? []).map(norm).sort()
  const b = (e.rows ?? []).map((r) => norm(r as unknown as Row)).sort()
  const rowsSame = a.length === b.length && a.every((x, i) => x === b[i])
  const markingSame = w.action === 'refresh' || (w.marking ?? null) === (e.marking ?? null)
  const notesSame = w.action === 'refresh' || (w.notes ?? null) === (e.notes ?? null)
  if (rowsSame && markingSame && notesSame) {
    identical++
    results.push({ ...base, result: 'identiska', plan_action: e.action, rows: a.length })
  } else {
    results.push({
      ...base,
      result: 'skiljer',
      plan_action: e.action,
      rows_same: rowsSame,
      marking: [w.marking ?? null, e.marking ?? null],
      notes: [w.notes ?? null, e.notes ?? null],
      cron_rows: a.filter((x) => !b.includes(x)).map((x) => JSON.parse(x)),
      plan_rows: b.filter((x) => !a.includes(x)).map((x) => JSON.parse(x)),
    })
  }
}
const contracts = new Set([...writes.values()].map((w) => w.contract_id ?? `samlad:${w.customer_id}`))
const out = { today: FAKE ?? null, invoices: writes.size, identical, contracts: contracts.size, blocked_writes: blocked, results }
const file = arg('out')
if (file) writeFileSync(file, JSON.stringify(out, null, 1))
console.log(`${FAKE ?? 'idag'}: ${identical}/${writes.size} fakturor identiska, ${contracts.size} avtal, skrivförsök stoppade ${blocked}`)
for (const r of results.filter((x) => x.result !== 'identiska')) console.log(JSON.stringify(r))
process.exit(identical === writes.size ? 0 : 1)
