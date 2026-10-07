// api/cron/google-ads-statistik.ts
// Nattjobb: hämtar Google Ads-statistik till sidan Marknad (/admin/leads-webb/marknad).
// Kampanj per dag, konverteringar per dag och åtgärd, söktermer per vecka. Se api/_lib/googleAdsStatistik.ts.
//
// Fönster: de senaste 30 dagarna till och med i går (svensk tid). Google justerar bakåt och räknar
// konverteringar på klickdagen (samtal, formulär och offline-uppladdningar kan komma dagar senare),
// så hela fönstret skrivs om varje natt. Kostar tre operationer av Explorer-kvoten (2 880 per dygn).
// ?dagar=N (1 till 90) ändrar fönstret vid manuell körning.
//
// Skrivning via google_ads_statistik_spara() (bara service role). Körs 04:30 UTC via Vercel Cron.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withCronLog } from '../_lib/cronLogger'
import { requireCronSecret } from '../_lib/cronAuth'
import { saknadeMiljovariabler } from '../_lib/googleAdsKonverteringar'
import { hamtaAccessToken, hamtaStatistik, idagSverige, plusDagar, sparaParametrar } from '../_lib/googleAdsStatistik'

export const config = { maxDuration: 60 }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface Sammanfattning {
  fran?: string
  till?: string
  operationer: number
  hamtade?: { kampanj_dag: number; konvertering_dag: number; sokterm_vecka: number }
  sparade?: unknown
  meddelande?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const begart = Number(req.query?.dagar)
  const dagar = Number.isInteger(begart) && begart >= 1 && begart <= 90 ? begart : 30

  const result = await withCronLog<Sammanfattning>('google-ads-statistik', async () => {
    const s: Sammanfattning = { operationer: 0 }
    const saknas = saknadeMiljovariabler()
    if (saknas.length) {
      s.meddelande = `Google Ads-variabler saknas i miljön: ${saknas.join(', ')}`
      return { status: 'failed', summary: s, errorMessage: s.meddelande }
    }

    const till = plusDagar(idagSverige(), -1)
    const fran = plusDagar(till, -(dagar - 1))
    s.fran = fran
    s.till = till

    const token = await hamtaAccessToken()
    const st = await hamtaStatistik(token, fran, till)
    s.operationer = st.operationer
    s.hamtade = { kampanj_dag: st.kampanj.length, konvertering_dag: st.konv.length, sokterm_vecka: st.sok.length }

    const { data, error } = await supabase.rpc('google_ads_statistik_spara', sparaParametrar(st))
    if (error) {
      s.meddelande = `Kunde inte spara: ${error.message}`
      return { status: 'failed', summary: s, errorMessage: s.meddelande }
    }
    s.sparade = data
    return { status: 'success', summary: s }
  })

  return res
    .status(result.status === 'failed' ? 500 : 200)
    .json({ success: result.status !== 'failed', ...result.summary, error: result.errorMessage })
}
