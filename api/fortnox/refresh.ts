import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Hämtar en giltig access token — refreshar automatiskt om den gått ut
export async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from('fortnox_tokens')
    .select('*')
    .single()

  if (error || !data) {
    throw new Error('Fortnox ej ansluten — ingen token hittades')
  }

  // Om token fortfarande giltig (med 60s marginal)
  const expiresAt = new Date(data.expires_at).getTime()
  if (Date.now() < expiresAt - 60_000) {
    return data.access_token
  }

  // Token gick ut — refresha
  const clientId = process.env.FORTNOX_CLIENT_ID!
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const tokenRes = await fetch('https://apps.fortnox.se/oauth-v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Fortnox token refresh misslyckades: ${body}`)
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokenData
  const expiresAtNew = new Date(Date.now() + expires_in * 1000).toISOString()

  await supabase
    .from('fortnox_tokens')
    .update({
      access_token,
      refresh_token,
      expires_at: expiresAtNew,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)

  return access_token
}

// HTTP endpoint för att manuellt trigga refresh (används ej av frontend direkt)
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    await getValidAccessToken()
    return res.status(200).json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    return res.status(500).json({ error: message })
  }
}
