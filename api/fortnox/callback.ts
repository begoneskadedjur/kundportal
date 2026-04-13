import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getFortnoxConfig } from './refresh'

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

  // Validera state mot cookie
  const cookieHeader = req.headers.cookie || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )
  const savedState = cookies['fortnox_oauth_state']

  if (!savedState || savedState !== state) {
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

  // Spara/uppdatera tokens i Supabase (upsert — bara en rad)
  const { error: dbError } = await supabase
    .from(tokenTable)
    .upsert(
      {
        access_token,
        refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (dbError) {
    // Om tabellen är tom: insert istället
    const { error: insertError } = await supabase.from(tokenTable).insert({
      access_token,
      refresh_token,
      expires_at: expiresAt,
    })
    if (insertError) {
      console.error('DB insert error:', insertError)
      return res.redirect(302, `/admin/installningar/fortnox?error=db_error`)
    }
  }

  // Rensa state-cookie
  res.setHeader('Set-Cookie', `fortnox_oauth_state=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`)

  return res.redirect(302, `/admin/installningar/fortnox?success=true`)
}
