// api/cron/generate-continuing-contracts-dry.ts
// Torrkörning av avtalscronen med nytt urval (steg 4 i planen för avtalsåret
// på exakt avtalsdag). Körs 03:30 UTC, efter den skarpa körningen 03:00.
// Skriver ingenting utom loggraden i cron_runs (job_name
// generate-continuing-contracts-dry): summeringen visar would_create och
// would_refresh, alltså vad cronen skulle göra om alla levande avtal togs med
// oavsett slutdatum och frekvens. Egen fil i stället för querysträng i
// vercel.json, eftersom Vercels dokumentation inte nämner querysträngar i
// cron-sökvägen. Tas bort en vecka efter att v2 slagits på skarpt (steg 14).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleContinuingContracts } from './generate-continuing-contracts'

export const config = { maxDuration: 300 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleContinuingContracts(req, res, { dryRun: true, v2: true })
}
