// api/oneflow/comments.ts — Proxy för Oneflow Comments API (GET + POST)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, type AuthContext } from '../_lib/auth'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL || 'info@begone.se'

const KONTORSROLLER = ['admin', 'koordinator', 'säljare']

function supabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)
}

/**
 * Kontorsrollerna (admin, koordinator, säljare, även som is_admin eller extra_roles)
 * når alla dokument, precis som förut. Övriga (tekniker) når bara dokument där de
 * själva är ansvariga eller skapare: contracts.oneflow_contract_id = contractId och
 * begone_employee_email eller created_by_email = någon av teknikerns e-postadresser
 * (inloggningen, profilen eller teknikerkortet), skiftlägesokänsligt.
 */
async function harAtkomst(auth: AuthContext, contractId: string): Promise<boolean> {
  if (auth.isAdmin || (auth.role && KONTORSROLLER.includes(auth.role))) return true
  const db = supabaseAdmin()
  const { data: profil, error: profilFel } = await db
    .from('profiles')
    .select('extra_roles, email, technician_id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (profilFel) throw profilFel
  if (((profil?.extra_roles as string[] | null) || []).some(r => KONTORSROLLER.includes(r))) return true

  const epost = new Set<string>()
  const lagg = (e: string | null | undefined) => { const v = (e || '').trim().toLowerCase(); if (v) epost.add(v) }
  lagg(auth.email)
  lagg(profil?.email as string | null | undefined)
  if (profil?.technician_id) {
    const { data: tekniker, error: teknikerFel } = await db
      .from('technicians')
      .select('email')
      .eq('id', profil.technician_id)
      .maybeSingle()
    if (teknikerFel) throw teknikerFel
    lagg(tekniker?.email as string | null | undefined)
  }
  if (epost.size === 0) return false

  const { data: rader, error: raderFel } = await db
    .from('contracts')
    .select('begone_employee_email, created_by_email')
    .eq('oneflow_contract_id', contractId)
  if (raderFel) throw raderFel
  return (rader || []).some(r =>
    [r.begone_employee_email, r.created_by_email].some(e => epost.has(((e as string | null) || '').trim().toLowerCase())),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tekniker släpps in men når bara sina egna dokument (harAtkomst nedan)
  const auth = await requireAuth(req, res, ['admin', 'koordinator', 'säljare', 'technician'])
  if (!auth) return

  const { contractId } = req.query

  if (!contractId || typeof contractId !== 'string') {
    return res.status(400).json({ error: 'contractId krävs' })
  }

  try {
    if (!(await harAtkomst(auth, contractId))) {
      return res.status(403).json({ error: 'Behörighet saknas för dokumentet' })
    }
  } catch (error) {
    console.error('Oneflow comments behörighetskontroll:', error)
    return res.status(500).json({ error: 'Internt serverfel' })
  }

  const baseUrl = `https://api.oneflow.com/v1/contracts/${contractId}/comments`
  // All Oneflow-kommunikation sker som info@begone.se — systemet kör på EN
  // Oneflow-licens (medvetet beslut). Personlig attribution finns i portalens
  // egen kommentarspegel (oneflow_comments.author_name), inte i Oneflow.
  const headers: Record<string, string> = {
    'x-oneflow-api-token': ONEFLOW_API_TOKEN,
    'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch(baseUrl, { headers })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Oneflow comments GET error: ${response.status}`, errorBody)
        return res.status(response.status).json({ error: 'Kunde inte hämta kommentarer', details: errorBody })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const { body, parentId, isPrivate, participants } = req.body

      if (!body || typeof body !== 'string') {
        return res.status(400).json({ error: 'body (kommentarstext) krävs' })
      }

      const payload: Record<string, any> = {
        body,
        private: isPrivate ?? false,
      }

      if (parentId) {
        payload.parent_id = parentId
      }

      if (participants && Array.isArray(participants)) {
        payload.participants = participants.map((pid: number) => ({ participant_id: pid }))
      }

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Oneflow comments POST error: ${response.status}`, errorBody)
        return res.status(response.status).json({ error: 'Kunde inte skapa kommentar', details: errorBody })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Oneflow comments proxy error:', error)
    return res.status(500).json({ error: 'Internt serverfel' })
  }
}
