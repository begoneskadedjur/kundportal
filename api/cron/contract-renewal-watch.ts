// api/cron/contract-renewal-watch.ts
// Daglig bevakning av avtal som kräver beslut. Inget avtal stoppas här
// (beslut 2026-09-02: avtal löper vidare tills någon aktivt säger upp dem);
// jobbet skriver en händelse på avtalet och mejlar kundansvarig.
//
//   option  : renewal_reminder_days före option_decision_deadline
//   fixed   : renewal_reminder_days före contract_end_date
//   rolling : 30 dagar innan uppsägningsfönstret stänger
//             (contract_end_date minus notice_period_months), bara när
//             avtalet har ett slutdatum inom ett år
//
// Idempotent: en påminnelse per avtal och bevakningsdatum, spårad i
// contract_events (event_type 'renewal', metadata.watch_key).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'

export const config = { maxDuration: 120 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY
const PORTAL_URL = process.env.PORTAL_URL || 'https://kundportal.vercel.app'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

type ContractRow = {
  id: string
  customer_id: string | null
  company_name: string | null
  label: string | null
  contract_type: string | null
  contract_end_date: string | null
  option_until: string | null
  option_decision_deadline: string | null
  renewal_mode: string | null
  renewal_reminder_days: number | null
  notice_period_months: number | null
  terminated_at: string | null
  account_manager_name: string | null
  account_manager_email: string | null
  begone_employee_email: string | null
  annual_value: number | null
}

function todayLocalIso(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(`${toIso}T12:00:00`).getTime() - new Date(`${fromIso}T12:00:00`).getTime()) / 86400000)
}

/** Vad ska bevakas för avtalet, och när? */
function watchFor(c: ContractRow): { decisionDate: string; kind: 'option' | 'fixed' | 'notice'; text: string } | null {
  const mode = c.renewal_mode ?? 'rolling'
  if (mode === 'option') {
    if (!c.option_decision_deadline) return null
    return {
      decisionDate: c.option_decision_deadline,
      kind: 'option',
      text: `Beslut om option senast ${c.option_decision_deadline}${c.option_until ? ` (avtalet kan förlängas till ${c.option_until})` : ''}`,
    }
  }
  if (mode === 'fixed') {
    if (!c.contract_end_date) return null
    return { decisionDate: c.contract_end_date, kind: 'fixed', text: `Avtalet når sitt slutdatum ${c.contract_end_date} och löper sedan vidare tills det sägs upp` }
  }
  // rolling: uppsägningsfönstret
  if (!c.contract_end_date || !c.notice_period_months) return null
  const windowCloses = addMonths(c.contract_end_date, -c.notice_period_months)
  return { decisionDate: windowCloses, kind: 'notice', text: `Sista dag att säga upp inför ${c.contract_end_date} är ${windowCloses}` }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY saknas')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'BeGone Kundportal <noreply@begone.se>', to: [to], subject, html }),
  })
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('contract-renewal-watch', async () => {
    const today = todayLocalIso()
    const horizon = addDays(today, 400)

    const { data, error } = await supabase
      .from('contracts')
      .select(
        'id, customer_id, company_name, label, contract_type, contract_end_date, option_until, option_decision_deadline, renewal_mode, renewal_reminder_days, notice_period_months, terminated_at, account_manager_name, account_manager_email, begone_employee_email, annual_value'
      )
      .in('status', ['signed', 'active'])
      .eq('type', 'contract')
      .is('terminated_at', null)
      .not('contract_end_date', 'is', null)
      .lte('contract_end_date', horizon)
    if (error) throw error

    const reminded: Array<{ contract_id: string; name: string; decision_date: string; email: string | null }> = []
    const errors: Array<{ contract_id: string; message: string }> = []

    for (const c of (data ?? []) as ContractRow[]) {
      try {
        const watch = watchFor(c)
        if (!watch) continue
        const reminderDays = c.renewal_reminder_days ?? (watch.kind === 'notice' ? 30 : 90)
        const remindFrom = addDays(watch.decisionDate, -reminderDays)
        // Påminn från och med bevakningsdatumet tills beslutsdatumet passerat
        if (today < remindFrom || today > watch.decisionDate) continue

        const watchKey = `${watch.kind}:${watch.decisionDate}`
        const { data: already } = await supabase
          .from('contract_events')
          .select('id')
          .eq('contract_id', c.id)
          .eq('event_type', 'renewal')
          .contains('metadata', { watch_key: watchKey })
          .limit(1)
        if (already && already.length > 0) continue

        const name = c.label ?? c.contract_type ?? 'Avtal'
        const daysLeft = daysBetween(today, watch.decisionDate)
        const to = c.account_manager_email ?? c.begone_employee_email ?? null

        let emailed = false
        if (to) {
          const link = c.customer_id ? `${PORTAL_URL}/admin/befintliga-kunder/${c.customer_id}` : PORTAL_URL
          const html = `
            <p>Hej ${c.account_manager_name ?? ''},</p>
            <p><b>${c.company_name ?? 'Kunden'}</b>, avtalet <b>${name}</b>${c.annual_value ? ` (${Number(c.annual_value).toLocaleString('sv-SE')} kr/år)` : ''} kräver ett beslut om <b>${daysLeft} dagar</b>.</p>
            <p>${watch.text}.</p>
            <p>Öppna avtalskartan och välj Nyttja option, Förläng tills vidare eller Säg upp: <a href="${link}">${link}</a></p>
            <p style="color:#6b7280;font-size:12px">Avtalet stoppas inte automatiskt. Det här är en påminnelse från kundportalens avtalsbevakning.</p>`
          try {
            await sendEmail(to, `Avtalsbeslut om ${daysLeft} dagar: ${c.company_name ?? ''} · ${name}`, html)
            emailed = true
          } catch (mailErr) {
            errors.push({ contract_id: c.id, message: `Mejl misslyckades: ${mailErr instanceof Error ? mailErr.message : String(mailErr)}` })
          }
        }

        await supabase.from('contract_events').insert({
          contract_id: c.id,
          event_type: 'renewal',
          title: `Bevakning: beslut senast ${watch.decisionDate}`,
          detail: `${watch.text}. ${emailed ? `Påminnelse skickad till ${to}` : 'Ingen kundansvarig med e-post att påminna'}`,
          metadata: { watch_key: watchKey, kind: watch.kind, emailed, to },
          created_by_name: 'Avtalsbevakning',
        })
        reminded.push({ contract_id: c.id, name: `${c.company_name ?? ''} · ${name}`, decision_date: watch.decisionDate, email: emailed ? to : null })
      } catch (err) {
        errors.push({ contract_id: c.id, message: err instanceof Error ? err.message : String(err) })
      }
    }

    return {
      status: errors.length > 0 ? ('partial' as const) : ('success' as const),
      summary: { contracts_checked: data?.length ?? 0, reminded: reminded.length, details: reminded, errors },
    }
  })

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage, ...result.summary })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
