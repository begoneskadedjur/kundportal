// api/_lib/rateLimit.ts - DB-baserad hastighetsbegränsning för publika endpoints
// (docs/sakerhetsplan-api-auth-vag2.md, etapp 6). Vercels serverless-funktioner
// saknar delbart minne, därför räknas fönstren i Supabase (bump_rate_limit är
// atomisk). FAIL-OPEN: vid databasfel släpps anropet igenom — begränsningen är
// ett skydd mot missbruk, inte en tillgänglighetsrisk.
import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const first = Array.isArray(fwd) ? fwd[0] : (fwd || '')
  return first.split(',')[0].trim() || 'unknown'
}

/**
 * Returnerar true om anropet är INOM gränsen (får fortsätta).
 * limit = max antal anrop per fönster, windowSeconds = fönstrets längd.
 */
export async function withinRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds
    })
    if (error || typeof data !== 'number') {
      console.warn('[rate-limit] fail-open:', key, error?.message)
      return true
    }
    return data <= limit
  } catch (e) {
    console.warn('[rate-limit] fail-open:', key, e)
    return true
  }
}
