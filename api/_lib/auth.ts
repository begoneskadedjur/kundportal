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

export interface AuthContext {
  userId: string
  email: string | undefined
  role: string | null
  isAdmin: boolean
  customerId: string | null
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
    .select('role, is_admin, customer_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'Användarprofil saknas' })
    return null
  }

  const effectiveRoles = new Set<string>()
  if (profile.role) effectiveRoles.add(profile.role)
  if (profile.is_admin) effectiveRoles.add('admin')

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
