// api/cron/send-booking-notifications.ts
// Skickar mailnotiser till tekniker om bokningar/ombokningar/avbokningar.
// Körs var 5:e minut via Vercel Cron.
//
// Kön (technician_booking_notifications) fylls av DB-triggers på
// cases/private_cases/business_cases/station_inspection_sessions — alla
// bokningsvägar fångas oavsett var i systemet bokningen görs.
// Ärenden som hör till ett återkommande schema (via stationskontrollens
// recurring_schedule_id) listas aldrig ett och ett: varje schema blir ETT
// sammanfattande mail med kund, frekvens, dag, klockslag och antal tillfällen.
// Engångsärenden får ett mail per ärende.
// "Settling"-fönstret (2 min) hindrar att en pågående batch splittras i två mail;
// för ett schema räknas fönstret från gruppens SENASTE rad.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { baseTemplate } from '../email-templates'
import { FREQUENCY_CONFIG, DAY_PATTERN_CONFIG } from '../../src/types/recurringSchedule'
import type { RecurringFrequency, RecurringDayPattern, CustomFrequencyConfig } from '../../src/types/recurringSchedule'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SETTLING_MINUTES = 2
const MAX_ATTEMPTS = 5
const BATCH_LIMIT = 500
const APP_URL = process.env.VITE_APP_URL || 'https://kundportal.vercel.app'

type QueueRow = {
  id: string
  technician_id: string
  event_type: 'assigned' | 'unassigned' | 'rescheduled'
  role: string
  case_table: string
  case_id: string | null
  case_number: string | null
  case_title: string | null
  customer_name: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  address: string | null
  attempts: number
  created_at: string
}

type ScheduleInfo = {
  id: string
  customer_id: string
  frequency: RecurringFrequency
  day_pattern: RecurringDayPattern
  preferred_day_of_month: number | null
  preferred_time: string
  estimated_duration_minutes: number
  custom_frequency_config: CustomFrequencyConfig | null
  created_at: string
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

function caseLink(r: QueueRow): string | null {
  // Sessions utan ärende har ingen ärendevy att länka till.
  // comm=0 → schemat öppnar ärendemodalen utan kommunikationsfliken.
  if (!r.case_id || r.case_table === 'station_inspection_sessions') return null
  return `${APP_URL}/technician/schedule?openCase=${r.case_id}&comm=0`
}

function rowHtml(r: QueueRow): string {
  const timespan = r.scheduled_end
    ? `${formatTime(r.scheduled_start)} – ${formatTime(r.scheduled_end, false)}`
    : formatTime(r.scheduled_start)
  const parts = [
    r.case_number ? `<strong>${r.case_number}</strong>` : null,
    r.case_title && r.case_title !== r.case_number ? r.case_title : null,
  ].filter(Boolean).join(' — ')
  const link = caseLink(r)
  const caseLine = link
    ? `<a href="${link}" style="color: #0f766e; text-decoration: underline;">${parts || 'Öppna ärendet'}</a>`
    : (parts || 'Ärende')
  return `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <div style="font-weight: 600;">${timespan}</div>
        <div style="margin-top: 2px;">${caseLine}</div>
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

const PERIOD_LABEL: Record<CustomFrequencyConfig['period_type'], string> = {
  week: 'vecka', month: 'månad', quarter: 'kvartal', year: 'år',
}

function frequencyLabel(s: ScheduleInfo): string {
  if (s.frequency === 'custom' && s.custom_frequency_config) {
    const c = s.custom_frequency_config
    return `${c.visits_per_period} besök per ${PERIOD_LABEL[c.period_type] ?? c.period_type}`
  }
  return FREQUENCY_CONFIG[s.frequency]?.label ?? s.frequency
}

function dayPatternLabel(s: ScheduleInfo): string {
  if (s.day_pattern === 'specific_day' && s.preferred_day_of_month) {
    return `Den ${s.preferred_day_of_month}:e i månaden`
  }
  return DAY_PATTERN_CONFIG[s.day_pattern]?.label ?? s.day_pattern
}

function formatDate(iso: string | null): string {
  if (!iso) return 'datum ej satt'
  return new Date(iso).toLocaleDateString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm'
  })
}

function factRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 140px;">${label}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">${value}</td>
    </tr>`
}

/** Ett mail per återkommande schema: sammanfattning i stället för en rad per tillfälle. */
function buildScheduleEmail(
  technicianName: string,
  schedule: ScheduleInfo,
  rows: QueueRow[]
): { subject: string; html: string } {
  const customer = rows.find(r => r.customer_name)?.customer_name || 'kunden'
  const address = rows.find(r => r.address)?.address || null
  const byEvent = (e: QueueRow['event_type']) => rows
    .filter(r => r.event_type === e)
    .sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''))
  const assigned = byEvent('assigned')
  const rescheduled = byEvent('rescheduled')
  const unassigned = byEvent('unassigned')

  // Nytt schema om schemat skapades samma dygn som tillfällena köades,
  // annars är det en förlängning eller ett teknikerbyte på ett befintligt schema.
  const oldestRow = rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0].created_at)
  const isNewSchedule = Math.abs(new Date(oldestRow).getTime() - new Date(schedule.created_at).getTime()) < 24 * 3600 * 1000

  let subject: string
  let intro: string
  if (assigned.length > 0 && rescheduled.length === 0 && unassigned.length === 0) {
    subject = isNewSchedule
      ? `Nytt återkommande schema: ${customer}`
      : `Fler kontroller i schemat: ${customer}`
    intro = isNewSchedule
      ? `Ett återkommande schema med stationskontroller hos <strong>${customer}</strong> har lagts upp för dig.`
      : `Schemat för stationskontroller hos <strong>${customer}</strong> har fått nya tillfällen.`
  } else if (unassigned.length > 0 && assigned.length === 0 && rescheduled.length === 0) {
    subject = `Borttagen från schemat: ${customer}`
    intro = `Du har tagits bort från kontrolltillfällen i det återkommande schemat hos <strong>${customer}</strong>.`
  } else {
    subject = `Ändringar i återkommande schema: ${customer}`
    intro = `Det återkommande schemat för stationskontroller hos <strong>${customer}</strong> har ändrats.`
  }

  const span = (list: QueueRow[]) => list.length === 1
    ? formatDate(list[0].scheduled_start)
    : `${formatDate(list[0].scheduled_start)} till ${formatDate(list[list.length - 1].scheduled_start)}`

  const facts = [
    factRow('Kund', customer),
    address ? factRow('Adress', address) : '',
    factRow('Frekvens', frequencyLabel(schedule)),
    factRow('Dag', dayPatternLabel(schedule)),
    factRow('Klockslag', `${schedule.preferred_time.slice(0, 5)}, ${schedule.estimated_duration_minutes} min per besök`),
    assigned.length > 0 ? factRow(isNewSchedule ? 'Tillfällen' : 'Nya tillfällen', `${assigned.length} st, ${span(assigned)}`) : '',
    rescheduled.length > 0 ? factRow('Ombokade', `${rescheduled.length} st, ${span(rescheduled)}`) : '',
    unassigned.length > 0 ? factRow('Borttagna', `${unassigned.length} st, ${span(unassigned)}`) : '',
  ].join('')

  const link = `${APP_URL}/technician/equipment/customer/${schedule.customer_id}`
  const content = `
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #1e293b;">Hej ${technicianName}!</h2>
    <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">${intro}</p>
    <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden;">
      ${facts}
    </table>
    <p style="margin: 16px 0 0; font-size: 14px;">
      <a href="${link}" style="color: #0f766e; text-decoration: underline;">Öppna kunden i portalen</a>
    </p>
    <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">
      Alla tillfällen finns i ditt schema. Detta mail skickas enligt dina
      notisinställningar — kontakta koordinatorn om du vill ändra dem.
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

/** Kopplar köraderna till sitt återkommande schema via stationskontrollen. */
async function resolveScheduleLinks(rows: QueueRow[]): Promise<Map<string, string>> {
  const chunks = <T>(list: T[], size = 150): T[][] =>
    Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

  // Schemats ärenden: cases-raden skapas först, sessionen pekar på den via case_id
  const caseIds = [...new Set(rows.filter(r => r.case_table === 'cases' && r.case_id).map(r => r.case_id!))]
  const scheduleByCase = new Map<string, string>()
  for (const ids of chunks(caseIds)) {
    const { data } = await supabase
      .from('station_inspection_sessions')
      .select('case_id, recurring_schedule_id')
      .in('case_id', ids)
      .not('recurring_schedule_id', 'is', null)
    for (const s of data ?? []) {
      if (s.case_id && s.recurring_schedule_id) scheduleByCase.set(s.case_id, s.recurring_schedule_id)
    }
  }

  // Sessioner utan ärende: case_id i kön ÄR sessionens id
  const sessionIds = [...new Set(rows.filter(r => r.case_table === 'station_inspection_sessions' && r.case_id).map(r => r.case_id!))]
  const scheduleBySession = new Map<string, string>()
  for (const ids of chunks(sessionIds)) {
    const { data } = await supabase
      .from('station_inspection_sessions')
      .select('id, recurring_schedule_id')
      .in('id', ids)
      .not('recurring_schedule_id', 'is', null)
    for (const s of data ?? []) {
      if (s.recurring_schedule_id) scheduleBySession.set(s.id, s.recurring_schedule_id)
    }
  }

  const scheduleByRow = new Map<string, string>()
  for (const r of rows) {
    if (!r.case_id) continue
    const scheduleId = r.case_table === 'cases'
      ? scheduleByCase.get(r.case_id)
      : r.case_table === 'station_inspection_sessions'
        ? scheduleBySession.get(r.case_id)
        : undefined
    if (scheduleId) scheduleByRow.set(r.id, scheduleId)
  }
  return scheduleByRow
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('send-booking-notifications', async () => {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY saknas')

    const settledBefore = new Date(Date.now() - SETTLING_MINUTES * 60 * 1000).toISOString()

    // Hämta även färska rader: ett schema skickas först när dess SENASTE rad
    // passerat settling-fönstret, så att en pågående batch inte delas upp.
    const { data: pending, error } = await supabase
      .from('technician_booking_notifications')
      .select('id, technician_id, event_type, role, case_table, case_id, case_number, case_title, customer_name, scheduled_start, scheduled_end, address, attempts, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (error) throw new Error(error.message)

    const emptyResult = {
      status: 'success' as const,
      summary: {
        emails_sent: 0,
        notifications_processed: 0,
        technicians_with_errors: [] as Array<{ technician_id: string; message: string }>,
      },
    }
    const allRows = (pending ?? []) as QueueRow[]
    if (allRows.length === 0) return emptyResult

    const scheduleByRow = await resolveScheduleLinks(allRows)

    const scheduleIds = [...new Set(scheduleByRow.values())]
    const scheduleById = new Map<string, ScheduleInfo>()
    if (scheduleIds.length > 0) {
      const { data: schedules } = await supabase
        .from('recurring_schedules')
        .select('id, customer_id, frequency, day_pattern, preferred_day_of_month, preferred_time, estimated_duration_minutes, custom_frequency_config, created_at')
        .in('id', scheduleIds)
      for (const s of (schedules ?? []) as ScheduleInfo[]) scheduleById.set(s.id, s)
    }

    // Grupper: varje schema per tekniker blir ett eget sammanfattande mail,
    // varje engångsärende ett eget mail (bokning + ombokning av samma ärende
    // i samma körning hamnar i samma mail).
    type Group = { technicianId: string; schedule: ScheduleInfo | null; rows: QueueRow[] }
    const groups = new Map<string, Group>()
    for (const row of allRows) {
      const scheduleId = scheduleByRow.get(row.id)
      const schedule = scheduleId ? scheduleById.get(scheduleId) ?? null : null
      // Engångsärenden väntar ut settling-fönstret rad för rad
      if (!schedule && row.created_at >= settledBefore) continue
      const key = schedule
        ? `${row.technician_id}|schema:${schedule.id}`
        : `${row.technician_id}|arende:${row.case_table}:${row.case_id ?? row.id}`
      const group = groups.get(key) ?? { technicianId: row.technician_id, schedule, rows: [] }
      group.rows.push(row)
      groups.set(key, group)
    }
    for (const [key, group] of groups) {
      if (group.schedule && group.rows.some(r => r.created_at >= settledBefore)) groups.delete(key)
    }
    if (groups.size === 0) return emptyResult

    const technicianIds = [...new Set([...groups.values()].map(g => g.technicianId))]
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, email')
      .in('id', technicianIds)
    const techById = new Map((technicians ?? []).map(t => [t.id, t]))

    let emailsSent = 0
    let processed = 0
    const errors: Array<{ technician_id: string; message: string }> = []

    for (const { technicianId, schedule, rows: techRows } of groups.values()) {
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
        const { subject, html } = schedule
          ? buildScheduleEmail(tech.name, schedule, techRows)
          : buildEmail(tech.name, techRows)
        await sendEmail(tech.email, subject, html)
        await supabase
          .from('technician_booking_notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .in('id', ids)
        emailsSent++
        processed += ids.length
      } catch (e) {
        const err = { message: e instanceof Error ? e.message : String(e) }
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
