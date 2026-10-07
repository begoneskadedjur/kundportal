// Engångs-backfill av Google Ads-statistik till sidan Marknad. Samma kod som nattjobbet
// (api/_lib/googleAdsStatistik.ts, laddas med jiti). Tre GAQL-anrop oavsett längd på perioden.
//
// Kör:
//   node --env-file=.env.local scripts/ads/backfill-statistik.mjs [--fran ÅÅÅÅ-MM-DD] [--till ÅÅÅÅ-MM-DD] [--ut fil.json]
//
// Standard: 90 dagar till och med i går. Med SUPABASE_SERVICE_ROLE_KEY (eller SUPABASE_SERVICE_KEY)
// i miljön sparas raderna direkt via google_ads_statistik_spara(). Annars skrivs parametrarna till
// --ut (standard backfill-statistik.json i systemets temp-mapp, aldrig i repot) och
// laddas in med SQL: select public.google_ads_statistik_spara(...).
//
// Avbryter om skriptet skulle använda fler än 600 operationer (det använder tre).
import { createJiti } from 'jiti'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MAX_OPERATIONER = 600
const jiti = createJiti(import.meta.url)
const lib = await jiti.import('../../api/_lib/googleAdsStatistik.ts')

const arg = (namn) => {
  const i = process.argv.indexOf(`--${namn}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

const till = arg('till') ?? lib.plusDagar(lib.idagSverige(), -1)
const fran = arg('fran') ?? lib.plusDagar(till, -89)
const ut = arg('ut') ?? join(tmpdir(), 'backfill-statistik.json')

const planerade = 3
if (planerade > MAX_OPERATIONER) {
  console.error(`Avbryter: ${planerade} operationer överstiger gränsen ${MAX_OPERATIONER}.`)
  process.exit(1)
}

console.log(`Hämtar ${fran} till ${till} för konto ${lib.kundId()} ...`)
const token = await lib.hamtaAccessToken()
const st = await lib.hamtaStatistik(token, fran, till)
console.log(`Operationer: ${st.operationer}`)
console.log(`Rader: kampanj_dag ${st.kampanj.length}, konvertering_dag ${st.konv.length}, sokterm_vecka ${st.sok.length}`)
const atgarder = [...new Set(st.konv.map((k) => `${k.konverteringsatgard} (${k.kategori})`))]
console.log('Konverteringsåtgärder:', atgarder.join('; '))

const nyckel = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const url = process.env.VITE_SUPABASE_URL
const params = lib.sparaParametrar(st)

if (nyckel && url) {
  const svar = await fetch(`${url}/rest/v1/rpc/google_ads_statistik_spara`, {
    method: 'POST',
    headers: { apikey: nyckel, Authorization: `Bearer ${nyckel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await svar.json().catch(() => null)
  if (!svar.ok) {
    console.error('Kunde inte spara:', data)
    process.exit(1)
  }
  console.log('Sparat:', data)
} else {
  writeFileSync(ut, JSON.stringify(params))
  console.log(`Ingen service-nyckel i miljön. Parametrarna skrevs till ${ut}.`)
}
