// api/cron/reactivate-paused-billing.ts
// Daglig cron: återaktivera kunder vars billing_paused_until har passerat.
// Körs 04:00 UTC via Vercel Cron.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const today = todayLocalIso()

    // Hämta kunder där paus-tiden har gått ut
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, company_name, billing_paused_until')
      .eq('billing_active', false)
      .not('billing_paused_until', 'is', null)
      .lte('billing_paused_until', today)

    if (error) throw error

    const ids = (customers ?? []).map(c => c.id)
    if (ids.length === 0) {
      return res.status(200).json({ success: true, reactivated: 0 })
    }

    const { error: updateErr } = await supabase
      .from('customers')
      .update({
        billing_active: true,
        billing_paused_until: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)

    if (updateErr) throw updateErr

    return res.status(200).json({
      success: true,
      reactivated: customers?.length ?? 0,
      details: (customers ?? []).map(c => ({ id: c.id, company_name: c.company_name })),
    })
  } catch (err: any) {
    console.error('Cron reactivate-paused-billing error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
