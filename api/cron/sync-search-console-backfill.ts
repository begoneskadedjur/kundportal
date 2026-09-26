// api/cron/sync-search-console-backfill.ts
// Självgående backfill av Search Console-historiken. Körs var tionde minut av
// Vercel Cron och fortsätter där förra körningen slutade. När historiken är
// klar svarar den direkt utan att anropa Google eller skriva i cron_runs.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from './sync-search-console'

export const config = { maxDuration: 300 }

export default async function backfillHandler(req: VercelRequest, res: VercelResponse) {
  req.query = { ...req.query, backfill: '1' }
  return handler(req, res)
}
