// api/notify-incident.ts - Notifierar mottagare vid ny tillbuds-/olycks-/avvikelserapport
// Skickar in-app-notis (notifications) och e-post (Resend) till alla som är
// mottagare av incidentens typ enligt incident_recipients. Anropas fire-and-forget
// från IncidentsPage direkt efter att rapporten sparats.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { requireAuthenticated } from './_lib/auth'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.VITE_APP_URL || 'https://kundportal.vercel.app'

const TYPE_LABELS: Record<string, { label: string; exclamation: string; color: string }> = {
  tillbud: { label: 'Tillbud', exclamation: 'Oj!', color: '#f59e0b' },
  olycka: { label: 'Olycka', exclamation: 'Aj!', color: '#ef4444' },
  avvikelse: { label: 'Avvikelse', exclamation: 'Avvikelse', color: '#3b82f6' }
}

function incidentPathForRole(role: string | null): string {
  if (role === 'koordinator') return '/koordinator/tillbud-avvikelser'
  if (role === 'technician') return '/technician/tillbud-avvikelser'
  return '/admin/tillbud-avvikelser'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await requireAuthenticated(req, res)
  if (!auth) return

  const { incident_id: incidentId } = req.body || {}
  if (!incidentId || typeof incidentId !== 'string') {
    return res.status(400).json({ error: 'incident_id krävs' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Hämta incidenten
    const { data: incident, error: incidentError } = await supabase
      .from('case_incidents')
      .select('*, incident_employees(technician_name)')
      .eq('id', incidentId)
      .single()

    if (incidentError || !incident) {
      return res.status(404).json({ error: 'Rapporten hittades inte' })
    }

    // Bara rapportören (eller admin/koordinator) får trigga utskicket
    if (incident.reported_by_id !== auth.userId) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('user_id', auth.userId)
        .single()
      const isPrivileged = callerProfile?.is_admin === true ||
        callerProfile?.role === 'admin' || callerProfile?.role === 'koordinator'
      if (!isPrivileged) {
        return res.status(403).json({ error: 'Behörighet saknas' })
      }
    }

    // 2. Hämta mottagare av incidentens typ (exkludera rapportören)
    const { data: recipientRows, error: recipientError } = await supabase
      .from('incident_recipients')
      .select('user_id')
      .eq('incident_type', incident.type)

    if (recipientError) throw recipientError

    const recipientUserIds = (recipientRows || [])
      .map(r => r.user_id)
      .filter(id => id !== incident.reported_by_id)

    if (recipientUserIds.length === 0) {
      return res.status(200).json({ success: true, notified: 0, message: 'Inga mottagare konfigurerade för denna typ' })
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, role')
      .in('user_id', recipientUserIds)

    if (profilesError) throw profilesError

    const typeInfo = TYPE_LABELS[incident.type] || TYPE_LABELS.tillbud
    const employeeNames = (incident.incident_employees || [])
      .map((e: { technician_name: string }) => e.technician_name)
      .join(', ') || incident.technician_name || '-'

    // 3. In-app-notiser
    const notifications = (profiles || []).map(p => ({
      recipient_id: p.user_id,
      case_id: incident.case_id || null,
      case_type: incident.case_type || null,
      title: `Ny ${typeInfo.label.toLowerCase()} att hantera`,
      preview: (incident.description || '').slice(0, 200),
      sender_name: incident.reported_by_name || 'Okänd',
      sender_id: incident.reported_by_id || null,
      is_read: false,
      source_comment_id: null,
      case_title: employeeNames
    }))

    if (notifications.length > 0) {
      const { error: notifError } = await supabase.from('notifications').insert(notifications)
      if (notifError) {
        console.error('Error inserting incident notifications:', notifError)
      }
    }

    // 4. E-post via Resend
    let emailsSent = 0
    if (RESEND_API_KEY) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 587,
        secure: false,
        auth: { user: 'resend', pass: RESEND_API_KEY }
      })

      const occurredAt = new Date(incident.occurred_at).toLocaleString('sv-SE', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })

      for (const p of profiles || []) {
        if (!p.email) continue
        const link = `${APP_URL}${incidentPathForRole(p.role)}`
        const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
  <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px 12px 0 0;">
    <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: bold;">Begone Kundportal</p>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #64748b;">Ny rapport att hantera</p>
    <h2 style="margin: 0 0 16px; font-size: 20px;">
      <span style="color: ${typeInfo.color};">${typeInfo.exclamation}</span> ${typeInfo.label}
    </h2>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${escapeHtml(incident.description || '')}</p>
    </div>
    <table style="font-size: 13px; color: #475569; border-collapse: collapse;">
      <tr><td style="padding: 2px 12px 2px 0;"><strong>Inträffade:</strong></td><td>${occurredAt}</td></tr>
      <tr><td style="padding: 2px 12px 2px 0;"><strong>Rapportör:</strong></td><td>${escapeHtml(incident.reported_by_name || 'Okänd')}</td></tr>
      <tr><td style="padding: 2px 12px 2px 0;"><strong>Berörda:</strong></td><td>${escapeHtml(employeeNames)}</td></tr>
    </table>
    <a href="${link}" style="display: inline-block; margin-top: 20px; background: #20c58f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 10px 20px; border-radius: 8px;">Öppna och hantera</a>
    <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8;">Du får detta mejl för att du är mottagare av ${typeInfo.label.toLowerCase()} i Begone Kundportal.</p>
  </div>
</div>`

        try {
          await transporter.sendMail({
            from: 'Begone Skadedjur & Sanering AB <info@begone.se>',
            to: p.email,
            subject: `${typeInfo.exclamation} Ny ${typeInfo.label.toLowerCase()} rapporterad - ${occurredAt}`,
            html
          })
          emailsSent++
        } catch (emailErr) {
          console.error(`Error sending incident email to ${p.email}:`, emailErr)
        }
      }
    } else {
      console.warn('RESEND_API_KEY not configured - skipping incident emails')
    }

    return res.status(200).json({
      success: true,
      notified: notifications.length,
      emailsSent
    })
  } catch (error) {
    console.error('Error in notify-incident:', error)
    const message = error instanceof Error ? error.message : 'Ett fel uppstod vid notifiering'
    return res.status(500).json({ error: message })
  }
}
