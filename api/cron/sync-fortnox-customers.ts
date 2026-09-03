// api/cron/sync-fortnox-customers.ts
// Nattlig full synk av Fortnox kundregister till spegeln fortnox_customer_numbers
// (docs/kundnummer-fortnox-plan.md, fas 1). Skyddsnät under webhook och
// inkrementell synk: fångar missade händelser och markerar raderade kunder.
// Schemalagd i vercel.json, kräver CRON_SECRET (fail-closed).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { syncFortnoxCustomerMirror } from '../_lib/fortnoxCustomerMirror'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('sync-fortnox-customers', async () => {
    const summary = await syncFortnoxCustomerMirror('full')
    return { status: 'success' as const, summary }
  })

  return res.status(result.status === 'failed' ? 500 : 200).json(result)
}
