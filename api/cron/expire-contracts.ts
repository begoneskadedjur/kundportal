// api/cron/expire-contracts.ts
// Nattlig cron: stäng avtal vars uppsägningstid löpt ut.
//
// KRITISKT — bara UPPSAGDA avtal (terminated_at satt) får avslutas. Portalen
// kör en rullande avtalsmodell: ett passerat contract_end_date betyder INTE att
// avtalet är slut, det förlängs automatiskt vid periodskifte (se
// generate-continuing-contracts). Utan terminated_at-filtret skulle det här
// jobbet döda varje löpande avtal vars slutdatum passerat — det var 12 stycken
// när jobbet skrevs.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withCronLog } from '../_lib/cronLogger'
import { requireCronSecret } from '../_lib/cronAuth'

export const config = { maxDuration: 60 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/** Dagens datum i lokal svensk tid (aldrig rå toISOString/UTC) */
function todayLocalIso(): string {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  type ExpiredDetail = {
    id: string
    customer_id: string | null
    name: string | null
    effective_end_date: string
  }
  type Summary = { expired: number; schedules_paused: number; details: ExpiredDetail[] }

  const result = await withCronLog<Summary>('expire-contracts', async () => {
    const today = todayLocalIso()

    const { data: candidates, error } = await supabase
      .from('contracts')
      .select('id, customer_id, company_name, label, effective_end_date, terminated_at')
      // Bara uppsagda avtal. UTAN detta filter träffas alla rullande avtal vars
      // slutdatum passerat — de ska förlängas, inte avslutas.
      .not('terminated_at', 'is', null)
      .not('effective_end_date', 'is', null)
      // lt, inte lte: effective_end_date är sista GILTIGA dagen. Avtalet är slut
      // först dagen efter, annars stängs det en dag för tidigt.
      .lt('effective_end_date', today)
      .in('status', ['signed', 'active'])

    if (error) throw error

    const rows = (candidates ?? []) as {
      id: string
      customer_id: string | null
      company_name: string | null
      label: string | null
      effective_end_date: string
    }[]

    if (rows.length === 0) {
      return {
        status: 'success' as const,
        summary: { expired: 0, schedules_paused: 0, details: [] as ExpiredDetail[] },
      }
    }

    const ids = rows.map((r) => r.id)
    const { error: updateErr } = await supabase
      .from('contracts')
      .update({
        status: 'ended',
        billing_active: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)

    if (updateErr) throw updateErr

    // Pausa scheman som fortfarande ligger aktiva på avtalet. ALDRIG
    // 'cancelled' — den vägen är irreversibel och sätter kopplade ärenden till
    // 'Borttaget'. 'paused' stoppar extend-recurring-schedules (som bara
    // plockar status='active') och går att ångra.
    let pausedSchedules = 0
    const { data: pausedRows, error: schedErr } = await supabase
      .from('recurring_schedules')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .in('contract_id', ids)
      .eq('status', 'active')
      .select('id')
    if (schedErr) {
      console.error('[expire-contracts] Kunde inte pausa scheman:', schedErr.message)
    } else {
      pausedSchedules = (pausedRows ?? []).length
    }

    // Loggen får aldrig fälla jobbet
    for (const r of rows) {
      const { error: logErr } = await supabase.from('contract_events').insert({
        contract_id: r.id,
        event_type: 'other',
        title: 'Avtalet avslutat',
        detail: `Uppsägningstiden löpte ut ${r.effective_end_date}`,
        created_by_name: 'System (expire-contracts)',
      })
      if (logErr) {
        console.error(`[expire-contracts] Kunde inte logga för ${r.id}:`, logErr.message)
      }
    }

    console.log(`[expire-contracts] ${rows.length} avtal avslutade, ${pausedSchedules} schema pausade`)
    return {
      status: 'success' as const,
      summary: {
        expired: rows.length,
        schedules_paused: pausedSchedules,
        details: rows.map((r) => ({
          id: r.id,
          customer_id: r.customer_id,
          name: r.label || r.company_name,
          effective_end_date: r.effective_end_date,
        })),
      },
    }
  })

  if (result.status === 'failed') {
    console.error('[expire-contracts] Körningen misslyckades:', result.errorMessage)
    return res.status(500).json({ success: false, error: result.errorMessage })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
