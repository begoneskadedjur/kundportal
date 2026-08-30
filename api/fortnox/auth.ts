// api/fortnox/auth.ts - Start på Fortnox OAuth-anslutningen
// Härdad etapp 6 (docs/sakerhetsplan-api-auth-vag2.md §4.2): tidigare kunde vem
// som helst starta flödet och slutföra det med EGET Fortnox-konto, varvid
// faktureringsintegrationen kapas (fortnox_tokens skrivs över). Nu:
//  - requireAuth(['admin']) — endast inloggad admin kan starta
//  - JSON-svar med authorize-URL (FortnoxPage hämtar via apiFetch och navigerar
//    själv) i stället för öppen redirect — navigering kan inte bära JWT
//  - state = nonce.timestamp.HMAC — callback verifierar signatur + TTL + cookie
import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { getFortnoxConfig } from './refresh'
import { requireAuth } from '../_lib/auth'

// HMAC-nyckeln härleds ur service-nyckeln (hög entropi, finns redan i miljön)
// så ingen ny env-var behöver läggas till i Vercel.
export function fortnoxStateKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return crypto.createHash('sha256').update('fortnox-oauth-state:' + secret).digest()
}

export function signFortnoxState(nonce: string, timestamp: string): string {
  return crypto.createHmac('sha256', fortnoxStateKey()).update(`${nonce}.${timestamp}`).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  const { clientId } = getFortnoxConfig()
  if (!clientId) {
    return res.status(500).json({ error: 'FORTNOX_CLIENT_ID saknas' })
  }

  const redirectUri = process.env.FORTNOX_REDIRECT_URI
  if (!redirectUri) {
    return res.status(500).json({ error: 'FORTNOX_REDIRECT_URI saknas' })
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now().toString()
  const state = `${nonce}.${timestamp}.${signFortnoxState(nonce, timestamp)}`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: [
      'article',
      'companyinformation',
      'customer',
      'invoice',
      'payment',
      'price',
      'costcenter',
    ].join(' '),
    state,
    access_type: 'offline',
    account_type: 'service',
  })

  const authUrl = `https://apps.fortnox.se/oauth-v1/auth?${params.toString()}`

  // Cookie-matchning behålls som extra CSRF-lager utöver HMAC+TTL
  res.setHeader('Set-Cookie', `fortnox_oauth_state=${state}; HttpOnly; Secure; SameSite=None; Max-Age=600; Path=/`)

  return res.status(200).json({ authUrl })
}
