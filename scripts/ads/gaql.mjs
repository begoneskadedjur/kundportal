// Läser från Google Ads med en GAQL-fråga. Bara läsning, ändrar aldrig något.
//
// Kräver i .env.local: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
// GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID
// (annonskontot, utan bindestreck) och GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC-kontot).
// Valfritt: GOOGLE_ADS_API_VERSION (standard v25).
//
// Kör:
//   node --env-file=.env.local scripts/ads/gaql.mjs konton
//   node --env-file=.env.local scripts/ads/gaql.mjs "SELECT campaign.name, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_30_DAYS"
const env = process.env
const version = env.GOOGLE_ADS_API_VERSION || 'v25'
const bas = `https://googleads.googleapis.com/${version}`

async function accessToken() {
  const svar = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await svar.json()
  if (!data.access_token) throw new Error('Inloggningen misslyckades: ' + JSON.stringify(data))
  return data.access_token
}

function headers(token) {
  // Developer token krävs inte längre (åtkomstnivån följer Cloud-projektet),
  // men skickas med om den finns.
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (env.GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) h['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '')
  return h
}

const arg = process.argv.slice(2).join(' ').trim()
if (!arg) { console.error('Ange "konton" eller en GAQL-fråga.'); process.exit(1) }

const token = await accessToken()

if (arg === 'konton') {
  const svar = await fetch(`${bas}/customers:listAccessibleCustomers`, { headers: headers(token) })
  console.log(JSON.stringify(await svar.json(), null, 2))
} else {
  const kund = (env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')
  const svar = await fetch(`${bas}/customers/${kund}/googleAds:searchStream`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ query: arg }),
  })
  const data = await svar.json()
  if (!svar.ok) { console.error(JSON.stringify(data, null, 2)); process.exit(1) }
  const rader = data.flatMap((d) => d.results || [])
  console.log(JSON.stringify(rader, null, 2))
  console.error(`${rader.length} rader`)
}
