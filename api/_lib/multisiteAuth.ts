// api/_lib/multisiteAuth.ts - Delad behörighetskontroll för multisite-användar-API:erna.
// Samma modell som api/multisite-users.ts: admin, koordinator eller verksamhetschef
// i den organisation anropet gäller. Filer med understreck-prefix exponeras inte
// som endpoints av Vercel.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export interface MultisiteManagerContext {
  userId: string
  isAdmin: boolean
  isKoordinator: boolean
  organizationId: string | null
  multisiteRole: string | null
}

/**
 * Verifierar Supabase-JWT och hämtar anroparens profil. Skickar själv 401/403
 * och returnerar null vid fel — handlern ska då avbryta direkt. Rollkontrollen
 * mot en specifik organisation görs separat med canManageOrganization.
 */
export async function getManagerContext(
  req: VercelRequest,
  res: VercelResponse
): Promise<MultisiteManagerContext | null> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Ej inloggad' })
    return null
  }

  const token = authHeader.slice('Bearer '.length)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    res.status(401).json({ error: 'Ogiltig eller utgången session' })
    return null
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_admin, is_koordinator, organization_id, multisite_role')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'Användarprofil saknas' })
    return null
  }

  return {
    userId: user.id,
    isAdmin: profile.is_admin === true || profile.role === 'admin',
    isKoordinator: profile.is_koordinator === true || profile.role === 'koordinator',
    organizationId: profile.organization_id,
    multisiteRole: profile.multisite_role
  }
}

/**
 * Admin och koordinator får hantera alla organisationer; verksamhetschef bara sin egen.
 */
export function canManageOrganization(
  ctx: MultisiteManagerContext,
  organizationId: string | null | undefined
): boolean {
  if (ctx.isAdmin || ctx.isKoordinator) return true
  return (
    ctx.multisiteRole === 'verksamhetschef' &&
    !!organizationId &&
    ctx.organizationId === organizationId
  )
}

/**
 * Hämtar organisations-UUID:t för en befintlig användare (profiles-spegeln).
 * Returnerar null om användaren saknas eller inte är en multisite-användare —
 * endpoints som ändrar befintliga användare ska då vägra, så att de inte kan
 * användas mot admin-/tekniker-/kundkonton.
 */
export async function getTargetUserOrganization(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, multisite_role')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile || !profile.organization_id || !profile.multisite_role) return null
  return profile.organization_id
}
