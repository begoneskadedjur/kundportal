// api/fortnox/sync-customers.ts
// Manuell synk av Fortnox-spegeln från portalen ("Uppdatera nu" på kundgruppssidan
// och automatisk inkrementell synk när sidan öppnas med gammal vattenstämpel).
// POST { mode?: 'incremental' | 'full' }. Standard: inkrementell.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../_lib/auth'
import { syncFortnoxCustomerMirror } from '../_lib/fortnoxCustomerMirror'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const auth = await requireAuth(req, res, ['admin', 'koordinator'])
  if (!auth) return

  const mode = req.body?.mode === 'full' ? 'full' : 'incremental'
  try {
    const result = await syncFortnoxCustomerMirror(mode)
    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('[sync-customers] misslyckades:', message)
    return res.status(502).json({ ok: false, error: message })
  }
}
