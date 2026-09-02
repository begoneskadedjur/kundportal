// api/cron/reactivate-paused-billing.ts
// Daglig cron: återaktivera kunder och avtal vars billing_paused_until har passerat.
// Avtalskartan som motor (fas 5): pausen bor på avtalet när kunden har avtal,
// kundraden bär den bara för synth-kunder utan contracts-rad.
// Körs 04:00 UTC via Vercel Cron.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withCronLog } from '../_lib/cronLogger'
import { requireCronSecret } from '../_lib/cronAuth'

export const config = { maxDuration: 60 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function todayLocalIso(): string {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('reactivate-paused-billing', async () => {
    const today = todayLocalIso()

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, company_name, billing_paused_until')
      .eq('billing_active', false)
      .not('billing_paused_until', 'is', null)
      .lte('billing_paused_until', today)

    if (error) throw error

    const ids = (customers ?? []).map(c => c.id)

    if (ids.length > 0) {
      const { error: updateErr } = await supabase
        .from('customers')
        .update({
          billing_active: true,
          billing_paused_until: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids)
      if (updateErr) throw updateErr
    }

    // Avtal med passerad paus
    const { data: contracts, error: contractsErr } = await supabase
      .from('contracts')
      .select('id, customer_id, label, address_label, billing_paused_until')
      .eq('billing_active', false)
      .not('billing_paused_until', 'is', null)
      .lte('billing_paused_until', today)
    if (contractsErr) throw contractsErr

    const contractIds = (contracts ?? []).map(c => c.id)
    if (contractIds.length > 0) {
      const { error: contractUpdateErr } = await supabase
        .from('contracts')
        .update({
          billing_active: true,
          billing_paused_until: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', contractIds)
      if (contractUpdateErr) throw contractUpdateErr
    }

    return {
      status: 'success' as const,
      summary: {
        reactivated: ids.length,
        reactivatedContracts: contractIds.length,
        details: [
          ...(customers ?? []).map(c => ({ id: c.id, company_name: c.company_name })),
          ...(contracts ?? []).map(c => ({ id: c.id, contract: c.label ?? c.address_label ?? c.id, customer_id: c.customer_id })),
        ],
      },
    }
  })

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
