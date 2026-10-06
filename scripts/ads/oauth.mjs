// Engångsinloggning mot Google Ads API.
// Öppnar Googles inloggning i webbläsaren, tar emot svaret lokalt och sparar
// GOOGLE_ADS_REFRESH_TOKEN i .env.local (som aldrig checkas in).
//
// Kräver i .env.local: GOOGLE_ADS_CLIENT_ID och GOOGLE_ADS_CLIENT_SECRET
// (OAuth-klient av typen "Datorapp" i Google Cloud).
//
// Kör: node --env-file=.env.local scripts/ads/oauth.mjs
import http from 'node:http'
import { exec } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const clientId = process.env.GOOGLE_ADS_CLIENT_ID
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
if (!clientId || !clientSecret) {
  console.error('Saknar GOOGLE_ADS_CLIENT_ID eller GOOGLE_ADS_CLIENT_SECRET i .env.local')
  process.exit(1)
}

const PORT = 8765
const redirectUri = `http://127.0.0.1:${PORT}`
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  // adwords: läsa och ändra kontot. datamanager: offline-konverteringar (api/cron/google-ads-konverteringar).
  scope: 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/datamanager',
  access_type: 'offline',
  prompt: 'consent',
})

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri)
  const code = url.searchParams.get('code')
  const fel = url.searchParams.get('error')
  if (!code) {
    res.end(fel ? `Inloggningen avbröts: ${fel}` : 'Väntar på Google...')
    if (fel) { server.close(); process.exit(1) }
    return
  }
  try {
    const svar = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    })
    const data = await svar.json()
    if (!data.refresh_token) throw new Error(JSON.stringify(data))
    sparaIEnvLocal('GOOGLE_ADS_REFRESH_TOKEN', data.refresh_token)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<p style="font-family:sans-serif">Klart. Nyckeln är sparad, du kan stänga fliken.</p>')
    console.log('Klart: GOOGLE_ADS_REFRESH_TOKEN är sparad i .env.local')
  } catch (e) {
    res.end('Något gick fel, se terminalen.')
    console.error('Kunde inte hämta nyckeln:', e.message)
  } finally {
    server.close()
  }
})

function sparaIEnvLocal(nyckel, varde) {
  const fil = '.env.local'
  const text = existsSync(fil) ? readFileSync(fil, 'utf8') : ''
  const rad = `${nyckel}=${varde}`
  const ny = new RegExp(`^${nyckel}=.*$`, 'm').test(text)
    ? text.replace(new RegExp(`^${nyckel}=.*$`, 'm'), rad)
    : text.replace(/\n?$/, '\n') + rad + '\n'
  writeFileSync(fil, ny)
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('Öppnar Googles inloggning. Logga in med kontot som har åtkomst till Google Ads.')
  console.log('Om inget öppnas, klistra in den här adressen i webbläsaren:\n' + authUrl)
  exec(`start "" "${authUrl}"`)
})
