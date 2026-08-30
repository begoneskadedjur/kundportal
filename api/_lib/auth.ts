// api/_lib/auth.ts - Delad autentisering för serverless functions
// Verifierar Supabase-JWT från Authorization-headern och kontrollerar roll mot profiles-tabellen.
// Filer med understreck-prefix exponeras inte som endpoints av Vercel.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export type AppRole = 'admin' | 'koordinator' | 'technician' | 'customer' | 'säljare'

/**
 * Report-only-logg för API-auth-utrullningen (docs/sakerhetsplan-api-auth-vag2.md, etapp 0).
 * Loggar anrop utan Authorization-header till auth_rollout_log — blockerar aldrig anropet.
 * Guarden för respektive endpoint slås på först när tabellen varit tom för endpointen
 * under hela observationsfönstret. Fire-and-forget: får aldrig kasta eller fördröja svaret.
 * OPTIONS hoppas över — CORS-preflight bär aldrig Authorization.
 */
export function logMissingAuth(req: VercelRequest, endpoint: string): void {
  if (req.headers.authorization || req.method === 'OPTIONS') return
  try {
    void supabaseAuth
      .from('auth_rollout_log')
      .insert({
        endpoint,
        method: req.method ?? null,
        user_agent: (req.headers['user-agent'] as string | undefined) ?? null
      })
      .then(({ error }) => {
        if (error) console.warn('[auth-rollout] kunde inte logga', endpoint, error.message)
      })
  } catch (e) {
    console.warn('[auth-rollout] loggfel', endpoint, e)
  }
}

export interface AuthContext {
  userId: string
  email: string | undefined
  role: string | null
  isAdmin: boolean
  customerId: string | null
}

/**
 * Verifierar enbart att anropet kommer från en inloggad användare (giltig
 * Supabase-JWT) — ingen rollkontroll och inget krav på profilrad. Används för
 * endpoints där skyddet gäller kostnad/missbruk snarare än databehörighet
 * (t.ex. PDF-generering som bara renderar data anroparen redan har).
 * Vid fel skickas 401-svar och null returneras.
 */
export async function requireAuthenticated(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ userId: string; email: string | undefined } | null> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Ej inloggad' })
    return null
  }

  const token = authHeader.slice('Bearer '.length)
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token)

  if (error || !user) {
    res.status(401).json({ error: 'Ogiltig eller utgången session' })
    return null
  }

  return { userId: user.id, email: user.email }
}

/**
 * Verifierar att anropet kommer från en inloggad användare med någon av de
 * tillåtna rollerna. Vid fel skickas 401/403-svar och null returneras —
 * handlern ska då avbryta direkt:
 *
 *   const auth = await requireAuth(req, res, ['admin', 'koordinator'])
 *   if (!auth) return
 *
 * Dual-role (profiles.is_admin = true) räknas alltid som 'admin',
 * samma logik som AuthContext i frontend.
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  allowedRoles: AppRole[]
): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Ej inloggad' })
    return null
  }

  const token = authHeader.slice('Bearer '.length)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

  if (authError || !user) {
    res.status(401).json({ error: 'Ogiltig eller utgången session' })
    return null
  }

  const { data: profile, error: profileError } = await supabaseAuth
    .from('profiles')
    .select('role, is_admin, customer_id, extra_roles')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'Användarprofil saknas' })
    return null
  }

  const effectiveRoles = new Set<string>()
  if (profile.role) effectiveRoles.add(profile.role)
  if (profile.is_admin) effectiveRoles.add('admin')
  for (const extraRole of (profile.extra_roles as string[] | null) || []) {
    effectiveRoles.add(extraRole)
  }

  if (!allowedRoles.some(role => effectiveRoles.has(role))) {
    res.status(403).json({ error: 'Behörighet saknas' })
    return null
  }

  return {
    userId: user.id,
    email: user.email,
    role: profile.role,
    isAdmin: profile.is_admin === true || profile.role === 'admin',
    customerId: profile.customer_id
  }
}
