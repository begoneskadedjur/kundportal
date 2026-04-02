import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.FORTNOX_CLIENT_ID
  if (!clientId) {
    return res.status(500).json({ error: 'FORTNOX_CLIENT_ID saknas' })
  }

  const redirectUri = process.env.FORTNOX_REDIRECT_URI
  if (!redirectUri) {
    return res.status(500).json({ error: 'FORTNOX_REDIRECT_URI saknas' })
  }

  const state = crypto.randomBytes(16).toString('hex')

  const scopes = [
    'article',
    'companyinformation',
    'customer',
    'invoice',
    'payment',
    'price',
    'costcenter',
    'salary',
    'developer',
  ].join('%20')

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
      'salary',
      'developer',
    ].join(' '),
    state,
    access_type: 'offline',
    account_type: 'service',
  })

  const authUrl = `https://apps.fortnox.se/oauth-v1/auth?${params.toString()}`

  // Skicka state som cookie så callback kan validera det
  res.setHeader('Set-Cookie', `fortnox_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`)

  return res.redirect(302, authUrl)
}
