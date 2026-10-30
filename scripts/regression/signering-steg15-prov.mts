// scripts/regression/signering-steg15-prov.mts
// Steg 15 (avtalsåret på avtalsdag): provkörning av signeringskedjan för nya
// avtal. Tar avtal som i dag väntar på signering i Oneflow (status pending) och
// låter processSignedContract köra i provläge (dryRun) som om de just
// signerats: avtalsraden läses som den är men med status 'signed' i MINNET.
//
// Inget skrivs: en fetch-spärr släpper bara GET och den läsande RPC:n
// contract_default_addon_rules. Varje annat anrop stoppas och räknas. Inga
// anrop till Oneflow eller Fortnox görs (signeringen anropar dem inte).
//
//   npx tsx --env-file=.env scripts/regression/signering-steg15-prov.mts [--ids=8c494515,4d360d1a]
//
// Skriver out/steg15/signering-prov-<datum>.json och en sammanfattning.

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { processSignedContract } from '../../api/_lib/contractSigning'
import { toLocalIsoDate } from '../../src/shared/contractPlanner'

const here = dirname(fileURLToPath(import.meta.url))
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)!
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!

const blocked: string[] = []
let reads = 0
const ALLOWED_RPC = ['contract_default_addon_rules']
const guardedFetch: typeof fetch = async (input, init) => {
  const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = (init?.method ?? 'GET').toUpperCase()
  const isAllowedRpc = method === 'POST' && ALLOWED_RPC.some((f) => u.includes(`/rest/v1/rpc/${f}`))
  if (method !== 'GET' && method !== 'HEAD' && !isAllowedRpc) {
    blocked.push(`${method} ${u.replace(url, '')}`)
    return new Response(JSON.stringify({ message: 'Spärrad i provet' }), { status: 403, headers: { 'content-type': 'application/json' } })
  }
  reads++
  const res = await fetch(input, init)
  // Avtalsraden: status 'signed' i minnet (avtalet väntar på signering i dag)
  if (method === 'GET' && /\/rest\/v1\/contracts\?select=\*&id=eq\./.test(u)) {
    const body = await res.json()
    const patch = (r: Record<string, unknown>) => ({ ...r, status: 'signed' })
    const patched = Array.isArray(body) ? body.map(patch) : patch(body)
    return new Response(JSON.stringify(patched), { status: res.status, headers: res.headers })
  }
  return res
}

const sb = createClient(url, key, { auth: { persistSession: false }, global: { fetch: guardedFetch } })
const plain = createClient(url, key, { auth: { persistSession: false } })

const prefixes = (arg('ids') ?? '').split(',').filter(Boolean)
const { data: pending, error } = await plain
  .from('contracts')
  .select('id, company_name, customer_id, start_date, contract_start_date, contract_length, billing_frequency, total_value, created_by_email')
  .eq('type', 'contract')
  .eq('status', 'pending')
  .not('created_by_email', 'is', null)
if (error) throw error
const chosen = ((pending ?? []) as Array<Record<string, unknown>>).filter(
  (c) => prefixes.length === 0 || prefixes.some((p) => String(c.id).startsWith(p))
)

const out: Array<Record<string, unknown>> = []
for (const c of chosen) {
  const report = await processSignedContract(sb, { contractId: String(c.id) }, { dryRun: true })
  out.push({
    id: c.id,
    company_name: c.company_name,
    customer_id: c.customer_id,
    start_date: c.contract_start_date ?? c.start_date,
    contract_length: c.contract_length,
    billing_frequency: c.billing_frequency,
    report,
  })
  console.log(`\n${c.company_name} (${String(c.id).slice(0, 8)}), start ${c.contract_start_date ?? c.start_date}`)
  console.log(`  avtalsår: ${report.billingAnchorMode ?? 'den 1:a'} · tilläggsregler: ${report.addonRules ?? 'som tidigare'}`)
  for (const a of report.actions) console.log(`  - ${a}`)
  for (const n of report.notes) console.log(`  ! ${n}`)
}

console.log(`\nSpärrade skrivförsök: ${blocked.length}, läsningar: ${reads}`)
for (const b of blocked) console.log(`  SPÄRRAT ${b}`)

const dir = join(here, 'out', 'steg15')
mkdirSync(dir, { recursive: true })
const file = join(dir, `signering-prov-${toLocalIsoDate(new Date())}.json`)
writeFileSync(file, JSON.stringify({ blocked, reads, contracts: out }, null, 2))
console.log(`\nSkrev ${file}`)
