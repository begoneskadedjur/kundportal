// api/cron/sync-fortnox-customers-incremental.ts
// Inkrementell synk av Fortnox-spegeln var tionde minut (vercel.json).
// Ersätter "webhook-lagret" i docs/kundnummer-fortnox-plan.md: Fortnox har
// ingen HTTP-webhook för kunder (händelser levereras via websocket
// wss://ws.fortnox.se/topics-v1, som kräver en ständigt uppkopplad process).
// Två Fortnox-anrop per körning (filter=active + filter=inactive med
// lastmodified), långt under rate limit. Full synk nattetid markerar raderade.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { syncFortnoxCustomerMirror } from '../_lib/fortnoxCustomerMirror'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  // Loggas INTE i cron_runs: 144 rader/dygn skulle dränka månadsrapporten.
  // Resultatet syns i fortnox_customer_mirror_state (watermark, last_error).
  try {
    const summary = await syncFortnoxCustomerMirror('incremental')
    if (summary.upserted > 0) {
      console.log(`[sync-fortnox-customers-incremental] ${summary.upserted} ändrade kunder (${summary.pages} anrop)`)
    }
    return res.status(200).json({ status: 'success', summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('[sync-fortnox-customers-incremental] misslyckades:', message)
    return res.status(500).json({ status: 'failed', error: message })
  }
}
