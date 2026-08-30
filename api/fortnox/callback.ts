import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getFortnoxConfig } from './refresh'
import { signFortnoxState } from './auth'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(302, `/admin/installningar/fortnox?error=${error}`)
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Saknar code eller state' })
  }

  // Härdad statevalidering (etapp 6, §4.2): HMAC-signatur + TTL bevisar att
  // flödet startades av en inloggad admin via /api/fortnox/auth — en angripare
  // kan inte längre tillverka giltig state med sin egen cookie. Cookie-matchning
  // behålls som extra CSRF-lager (samma webbläsare som startade).
  const stateStr = String(state)
  const stateParts = stateStr.split('.')
  if (stateParts.length !== 3) {
    return res.status(400).json({ error: 'Ogiltig state-parameter (möjlig CSRF)' })
  }
  const [nonce, timestamp, signature] = stateParts
  const expected = signFortnoxState(nonce, timestamp)
  const sigBuf = Buffer.from(signature, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  const signatureValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  const withinTtl = Date.now() - Number(timestamp) < 10 * 60 * 1000
  if (!signatureValid || !withinTtl) {
    return res.status(400).json({ error: 'Ogiltig eller utgången state-parameter (möjlig CSRF)' })
  }

  const cookieHeader = req.headers.cookie || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )
  const savedState = cookies['fortnox_oauth_state']

  if (!savedState || savedState !== stateStr) {
    return res.status(400).json({ error: 'Ogiltig state-parameter (möjlig CSRF)' })
  }

  const { clientId, clientSecret, tokenTable } = getFortnoxConfig()
  const redirectUri = process.env.FORTNOX_REDIRECT_URI!

  // Byt code mot tokens
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const tokenRes = await fetch('https://apps.fortnox.se/oauth-v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error('Fortnox token error:', body)
    return res.redirect(302, `/admin/installningar/fortnox?error=token_exchange_failed`)
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokenData

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  // Kolla om det redan finns en rad i tabellen
  const { data: existing } = await supabase
    .from(tokenTable)
    .select('id')
    .maybeSingle()

  let saveError
  if (existing?.id) {
    // Uppdatera befintlig rad
    const { error } = await supabase
      .from(tokenTable)
      .update({
        access_token,
        refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    saveError = error
  } else {
    // Ingen rad finns — insert
    const { error } = await supabase.from(tokenTable).insert({
      access_token,
      refresh_token,
      expires_at: expiresAt,
    })
    saveError = error
  }

  if (saveError) {
    console.error('DB save error:', saveError)
    return res.redirect(302, `/admin/installningar/fortnox?error=db_error`)
  }

  // Rensa state-cookie
  res.setHeader('Set-Cookie', `fortnox_oauth_state=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`)

  return res.redirect(302, `/admin/installningar/fortnox?success=true`)
}
