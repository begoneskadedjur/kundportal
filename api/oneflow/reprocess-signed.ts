// api/oneflow/reprocess-signed.ts - Kör signeringsbehandlingen om för ett avtal
//
// POST { contractId: uuid, dryRun?: boolean }   (endast admin)
//
// dryRun är förvalt: utan uttryckligt dryRun: false skrivs ingenting.
//
// Samma behandling som webhooken gör vid contract:sign (api/_lib/contractSigning.ts):
// avtalsfält och premie, kund (skapas eller kopplas), avtalskarta, fakturaplan,
// källärendet och notis. Varje steg är idempotent, så en omkörning på ett redan
// behandlat avtal gör ingenting. dryRun = true skriver ingenting och svarar med
// vad som skulle göras.
//
// Används för avtal som signerades innan behandlingen klarade status 'active'
// (triggern contract_signed_becomes_active), t.ex. Oneflow 16463726.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../_lib/auth'
import { processSignedContract } from '../_lib/contractSigning'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  const { contractId, dryRun } = (req.body ?? {}) as { contractId?: string; dryRun?: boolean }
  if (!contractId || !UUID.test(contractId)) return res.status(400).json({ error: 'contractId (uuid) krävs' })

  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  try {
    const report = await processSignedContract(supabase, { contractId }, { dryRun: dryRun !== false })
    return res.status(200).json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Omkörning av signeringsbehandlingen misslyckades:', message)
    return res.status(500).json({ error: message })
  }
}
