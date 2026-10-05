// api/cron/web-inquiries-utfall.ts
// Daglig cron för Leads (Webb): bokade förfrågningar får utfallet Vunnen när det kopplade ärendet
// fakturerats inom fristen (30 dagar från bokningen, 90 dagar om förfrågan haft status Offert),
// annars Förlorad när fristen gått. Logiken bor i databasfunktionen web_inquiries_berakna_utfall()
// (migrationen 20261005_web_inquiries_bokad_utfall.sql), som bara service role får köra.
// Körs 05:30 UTC via Vercel Cron.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withCronLog } from '../_lib/cronLogger'
import { requireCronSecret } from '../_lib/cronAuth'

export const config = { maxDuration: 60 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface Utfall {
  vunna: number
  forlorade: number
  kvar: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('web-inquiries-utfall', async () => {
    const { data, error } = await supabase.rpc('web_inquiries_berakna_utfall')
    if (error) throw error
    const rad = (Array.isArray(data) ? data[0] : data) as Utfall | null
    return {
      status: 'success' as const,
      summary: {
        vunna: rad?.vunna ?? 0,
        forlorade: rad?.forlorade ?? 0,
        kvar: rad?.kvar ?? 0,
      },
    }
  })

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
