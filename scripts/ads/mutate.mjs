// Ändrar i Google Ads. Provkör ALLTID först (validateOnly), genomför bara med --genomfor.
//
// Indata: en JSON-fil med { "beskrivning": "...", "godkand_av": "Christian 2026-10-07",
//   "operationer": [ <MutateOperation>, ... ] }
// där varje operation följer Google Ads API:s googleAds:mutate, till exempel
//   { "campaignBudgetOperation": { "update": { "resourceName": "customers/9407604856/campaignBudgets/123",
//       "amountMicros": "800000000" }, "updateMask": "amountMicros" } }
//
// Kör:
//   node --env-file=.env.local scripts/ads/mutate.mjs fil.json             (provkörning, ändrar inget)
//   node --env-file=.env.local scripts/ads/mutate.mjs fil.json --genomfor  (genomför, kräver godkand_av)
//
// Genomförda ändringar loggas i docs/begone-se/ads/andringslogg.jsonl.
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs'

const env = process.env
const version = env.GOOGLE_ADS_API_VERSION || 'v25'
const kund = (env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')
const fil = process.argv[2]
const genomfor = process.argv.includes('--genomfor')

if (!fil) { console.error('Ange en JSON-fil med operationer.'); process.exit(1) }
const plan = JSON.parse(readFileSync(fil, 'utf8'))
if (!Array.isArray(plan.operationer) || plan.operationer.length === 0) {
  console.error('Filen saknar "operationer".'); process.exit(1)
}
if (genomfor && !plan.godkand_av) {
  console.error('Genomförande kräver "godkand_av" i filen (vem som godkände och när).'); process.exit(1)
}

const tokenSvar = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
})
const token = (await tokenSvar.json()).access_token
if (!token) { console.error('Inloggningen misslyckades. Kör scripts/ads/oauth.mjs igen.'); process.exit(1) }

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
if (env.GOOGLE_ADS_DEVELOPER_TOKEN) headers['developer-token'] = env.GOOGLE_ADS_DEVELOPER_TOKEN
if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '')

const svar = await fetch(`https://googleads.googleapis.com/${version}/customers/${kund}/googleAds:mutate`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ mutateOperations: plan.operationer, validateOnly: !genomfor, partialFailure: false }),
})
const data = await svar.json()

if (!svar.ok) {
  console.error(genomfor ? 'GENOMFÖRANDET MISSLYCKADES, inget ändrades:' : 'Provkörningen hittade fel:')
  console.error(JSON.stringify(data, null, 2))
  process.exit(1)
}

if (!genomfor) {
  console.log(`Provkörning OK: ${plan.operationer.length} operationer godtas av Google. Inget är ändrat.`)
  console.log('Genomför med --genomfor när ändringen är godkänd.')
} else {
  mkdirSync('docs/begone-se/ads', { recursive: true })
  appendFileSync('docs/begone-se/ads/andringslogg.jsonl', JSON.stringify({
    tid: new Date().toISOString(),
    beskrivning: plan.beskrivning,
    godkand_av: plan.godkand_av,
    antal: plan.operationer.length,
    operationer: plan.operationer,
    resultat: data.mutateOperationResponses,
  }) + '\n')
  console.log(`Genomfört: ${plan.operationer.length} operationer. Loggat i docs/begone-se/ads/andringslogg.jsonl.`)
}
