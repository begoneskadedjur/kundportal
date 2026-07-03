// api/_lib/cronAuth.ts - Delad CRON_SECRET-kontroll för alla cron-endpoints.
// FAIL-CLOSED: om CRON_SECRET inte är satt i miljön vägrar jobben köra (503)
// i stället för att släppa igenom oautentiserade anrop. Vercel skickar själv
// "Authorization: Bearer <CRON_SECRET>" på cron-anrop när env-varen är satt i
// projektet; manuell körning görs med samma header (curl -H "Authorization:
// Bearer $CRON_SECRET"). Sätt ALLTID CRON_SECRET i Vercel före deploy av detta.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'node:crypto'

export function requireCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cronAuth] CRON_SECRET saknas i miljön - jobbet vägrar köra (fail-closed)')
    res.status(503).json({ error: 'CRON_SECRET är inte konfigurerad' })
    return false
  }

  const authHeader = req.headers.authorization
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authHeader ?? '')

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }

  return true
}
