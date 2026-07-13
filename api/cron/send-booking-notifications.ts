// api/cron/send-booking-notifications.ts
// Skickar mailnotiser till tekniker om bokningar/ombokningar/avbokningar.
// Körs var 5:e minut via Vercel Cron.
//
// Kön (technician_booking_notifications) fylls av DB-triggers på
// cases/private_cases/business_cases/station_inspection_sessions — alla
// bokningsvägar fångas oavsett var i systemet bokningen görs.
// Grupperingen per tekniker gör att batchar (t.ex. 30-100 ärenden från ett
// återkommande schema) automatiskt blir ETT samlingsmail.
// "Settling"-fönstret (2 min) hindrar att en pågående batch splittras i två mail.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { baseTemplate } from '../email-templates'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SETTLING_MINUTES = 2
const MAX_ATTEMPTS = 5
const BATCH_LIMIT = 500

type QueueRow = {
  id: string
  technician_id: string
  event_type: 'assigned' | 'unassigned' | 'rescheduled'
  role: string
  case_number: string | null
  case_title: string | null
  customer_name: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  address: string | null
  attempts: number
}

const EVENT_SECTIONS: Array<{ event: QueueRow['event_type']; heading: string; color: string }> = [
  { event: 'assigned', heading: 'Nya bokningar', color: '#20c58f' },
  { event: 'rescheduled', heading: 'Ombokningar', color: '#f59e0b' },
  { event: 'unassigned', heading: 'Avbokningar', color: '#ef4444' },
]

function formatTime(iso: string | null, withDate = true): string {
  if (!iso) return 'Tid ej satt'
  const d = new Date(iso)
  const date = d.toLocaleDateString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Europe/Stockholm'
  })
  const time = d.toLocaleTimeString('sv-SE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm'
  })
  return withDate ? `${date} kl ${time}` : time
}

function rowHtml(r: QueueRow): string {
  const timespan = r.scheduled_end
    ? `${formatTime(r.scheduled_start)} – ${formatTime(r.scheduled_end, false)}`
    : formatTime(r.scheduled_start)
  const parts = [
    r.case_number ? `<strong>${r.case_number}</strong>` : null,
    r.case_title && r.case_title !== r.case_number ? r.case_title : null,
  ].filter(Boolean).join(' — ')
  return `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <div style="font-weight: 600;">${timespan}</div>
        <div style="margin-top: 2px;">${parts || 'Ärende'}</div>
        <div style="color: #64748b; font-size: 13px; margin-top: 2px;">
          ${[r.customer_name, r.address].filter(Boolean).join(' · ') || ''}
          ${r.role !== 'Primär' ? ` · Roll: ${r.role}` : ''}
        </div>
      </td>
    </tr>`
}

function buildEmail(technicianName: string, rows: QueueRow[]): { subject: string; html: string } {
  const counts = {
    assigned: rows.filter(r => r.event_type === 'assigned').length,
    rescheduled: rows.filter(r => r.event_type === 'rescheduled').length,
    unassigned: rows.filter(r => r.event_type === 'unassigned').length,
  }

  let subject: string
  if (counts.assigned > 0 && counts.rescheduled === 0 && counts.unassigned === 0) {
    subject = counts.assigned === 1
      ? `Ny bokning: ${rows[0].case_number || rows[0].case_title || 'ärende'} — ${formatTime(rows[0].scheduled_start)}`
      : `${counts.assigned} nya bokningar i ditt schema`
  } else {
    subject = 'Uppdateringar i ditt schema'
  }

  const sections = EVENT_SECTIONS
    .map(({ event, heading, color }) => {
      const sectionRows = rows
        .filter(r => r.event_type === event)
        .sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''))
      if (sectionRows.length === 0) return ''
      return `
        <h3 style="margin: 24px 0 8px; font-size: 15px; color: ${color};">
          ${heading} (${sectionRows.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden;">
          ${sectionRows.map(rowHtml).join('')}
        </table>`
    })
    .join('')

  const content = `
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #1e293b;">Hej ${technicianName}!</h2>
    <p style="margin: 0 0 4px; font-size: 14px; color: #475569;">
      Här är de senaste ändringarna i ditt schema:
    </p>
    ${sections}
    <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">
      Logga in i portalen för fullständiga ärendedetaljer. Detta mail skickas enligt
      dina notisinställningar — kontakta koordinatorn om du vill ändra dem.
    </p>`

  return { subject, html: baseTemplate(content, subject) }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BeGone Kundportal <noreply@begone.se>',
      to: [to],
      subject,
      html,
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend ${response.status}: ${body}`)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('send-booking-notifications', async () => {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY saknas')

    const settledBefore = new Date(Date.now() - SETTLING_MINUTES * 60 * 1000).toISOString()

    const { data: pending, error } = await supabase
      .from('technician_booking_notifications')
      .select('id, technician_id, event_type, role, case_number, case_title, customer_name, scheduled_start, scheduled_end, address, attempts')
      .eq('status', 'pending')
      .lt('created_at', settledBefore)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (error) throw new Error(error.message)

    const rows = (pending ?? []) as QueueRow[]
    if (rows.length === 0) {
      return {
        status: 'success' as const,
        summary: {
          emails_sent: 0,
          notifications_processed: 0,
          technicians_with_errors: [] as Array<{ technician_id: string; message: string }>,
        },
      }
    }

    // Gruppera per tekniker → ett mail per tekniker och körning
    const byTechnician = new Map<string, QueueRow[]>()
    for (const row of rows) {
      const arr = byTechnician.get(row.technician_id) ?? []
      arr.push(row)
      byTechnician.set(row.technician_id, arr)
    }

    const technicianIds = [...byTechnician.keys()]
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, email')
      .in('id', technicianIds)
    const techById = new Map((technicians ?? []).map(t => [t.id, t]))

    let emailsSent = 0
    let processed = 0
    const errors: Array<{ technician_id: string; message: string }> = []

    for (const [technicianId, techRows] of byTechnician.entries()) {
      const tech = techById.get(technicianId)
      const ids = techRows.map(r => r.id)

      if (!tech?.email) {
        await supabase
          .from('technician_booking_notifications')
          .update({ status: 'failed', error_message: 'Tekniker saknar e-postadress' })
          .in('id', ids)
        errors.push({ technician_id: technicianId, message: 'saknar e-post' })
        continue
      }

      try {
        const { subject, html } = buildEmail(tech.name, techRows)
        await sendEmail(tech.email, subject, html)
        await supabase
          .from('technician_booking_notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .in('id', ids)
        emailsSent++
        processed += ids.length
      } catch (err: any) {
        console.error(`[send-booking-notifications] Fel för tekniker ${technicianId}:`, err.message)
        // Låt raderna ligga kvar för retry; ge upp efter MAX_ATTEMPTS
        const maxedOut = techRows.filter(r => r.attempts + 1 >= MAX_ATTEMPTS).map(r => r.id)
        const retryable = ids.filter(id => !maxedOut.includes(id))
        if (retryable.length > 0) {
          for (const r of techRows.filter(x => retryable.includes(x.id))) {
            await supabase
              .from('technician_booking_notifications')
              .update({ attempts: r.attempts + 1, error_message: err.message })
              .eq('id', r.id)
          }
        }
        if (maxedOut.length > 0) {
          await supabase
            .from('technician_booking_notifications')
            .update({ status: 'failed', error_message: err.message })
            .in('id', maxedOut)
        }
        errors.push({ technician_id: technicianId, message: err.message })
      }
    }

    return {
      status: errors.length > 0 ? ('partial' as const) : ('success' as const),
      summary: {
        emails_sent: emailsSent,
        notifications_processed: processed,
        technicians_with_errors: errors,
      },
    }
  })

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage, ...result.summary })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
