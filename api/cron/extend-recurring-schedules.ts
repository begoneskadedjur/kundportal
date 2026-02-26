// api/cron/extend-recurring-schedules.ts
// Daily cron job to extend recurring inspection schedules
// Runs at 04:00 via Vercel Cron - generates new sessions for schedules approaching their generated_until date
// Pattern follows api/cron/sync-oneflow.ts

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { addMonths, addMinutes, format } from 'date-fns'

export const config = { maxDuration: 120 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Threshold: extend when generated_until is less than 60 days away
const EXTENSION_THRESHOLD_DAYS = 60
const EXTENSION_MONTHS = 2

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[extend-schedules] Starting recurring schedule extension check...')

  try {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() + EXTENSION_THRESHOLD_DAYS)

    // Find all active schedules that need extension
    const { data: schedules, error: fetchError } = await supabase
      .from('recurring_schedules')
      .select(`
        *,
        technician:technicians(id, name, work_schedule),
        customer:customers(id, contract_status, effective_end_date)
      `)
      .eq('status', 'active')
      .lt('generated_until', format(thresholdDate, 'yyyy-MM-dd'))

    if (fetchError) {
      console.error('[extend-schedules] Error fetching schedules:', fetchError)
      return res.status(500).json({ error: fetchError.message })
    }

    if (!schedules || schedules.length === 0) {
      console.log('[extend-schedules] No schedules need extension.')
      return res.status(200).json({ message: 'No schedules to extend', extended: 0 })
    }

    console.log(`[extend-schedules] Found ${schedules.length} schedules to extend`)

    let totalCreated = 0
    let totalErrors = 0

    for (const schedule of schedules) {
      try {
        const currentEnd = new Date(schedule.generated_until)
        let newEnd = addMonths(currentEnd, EXTENSION_MONTHS)

        // Check if customer has been terminated — respect effective_end_date, not binding period
        const customer = schedule.customer as any
        if (customer?.contract_status === 'terminated') {
          const effectiveEnd = customer.effective_end_date
            ? new Date(customer.effective_end_date)
            : null
          if (!effectiveEnd || currentEnd >= effectiveEnd) {
            console.log(`[extend-schedules] Schedule ${schedule.id} customer terminated, skipping`)
            continue
          }
          if (newEnd > effectiveEnd) newEnd = effectiveEnd
        }
        if (customer?.contract_status === 'expired') {
          console.log(`[extend-schedules] Schedule ${schedule.id} customer expired, skipping`)
          continue
        }

        const technicianId = schedule.technician_id
        const workSchedule = (schedule.technician as any)?.work_schedule || null

        // Fetch existing bookings for the extension period
        const bookings = await fetchBookingsForTechnician(technicianId, currentEnd, newEnd)

        // Fetch absences
        const absences = await fetchAbsencesForTechnician(technicianId, currentEnd, newEnd)

        // Lazy-import the date generation logic (server-side compatible)
        // Since this runs on Vercel serverless, we compute dates inline
        const dates = generateDatesSimple(
          schedule, currentEnd, newEnd, workSchedule, absences, bookings
        )

        if (dates.length === 0) {
          console.log(`[extend-schedules] No new dates for schedule ${schedule.id}`)
          await supabase.from('recurring_schedules').update({
            generated_until: format(newEnd, 'yyyy-MM-dd'),
            last_generated_at: new Date().toISOString()
          }).eq('id', schedule.id)
          continue
        }

        // Check for duplicates
        const { data: existingSessions } = await supabase
          .from('station_inspection_sessions')
          .select('scheduled_at')
          .eq('recurring_schedule_id', schedule.id)
          .in('status', ['scheduled', 'in_progress'])

        const existingDateSet = new Set(
          (existingSessions || []).map(s => s.scheduled_at?.split('T')[0])
        )

        const newDates = dates.filter(d => !existingDateSet.has(d.date.toISOString().split('T')[0]))

        if (newDates.length > 0) {
          const sessionsToCreate = newDates.map(d => ({
            customer_id: schedule.customer_id,
            technician_id: schedule.technician_id,
            scheduled_at: d.date.toISOString(),
            scheduled_end: d.endDate.toISOString(),
            recurring_schedule_id: schedule.id,
            status: 'scheduled' as const,
            notes: d.adjustmentReason || null
          }))

          const { data: created, error: insertError } = await supabase
            .from('station_inspection_sessions')
            .insert(sessionsToCreate)
            .select('id')

          if (insertError) {
            console.error(`[extend-schedules] Error creating sessions for ${schedule.id}:`, insertError)
            totalErrors++
          } else {
            totalCreated += created?.length || 0
            console.log(`[extend-schedules] Created ${created?.length} sessions for schedule ${schedule.id}`)
          }
        }

        // Update generated_until
        await supabase.from('recurring_schedules').update({
          generated_until: format(newEnd, 'yyyy-MM-dd'),
          last_generated_at: new Date().toISOString()
        }).eq('id', schedule.id)

      } catch (err) {
        console.error(`[extend-schedules] Error processing schedule ${schedule.id}:`, err)
        totalErrors++
      }
    }

    console.log(`[extend-schedules] Done. Created: ${totalCreated}, Errors: ${totalErrors}`)
    return res.status(200).json({
      message: 'Extension complete',
      schedulesProcessed: schedules.length,
      sessionsCreated: totalCreated,
      errors: totalErrors
    })
  } catch (error: any) {
    console.error('[extend-schedules] Fatal error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// Simplified date generation for server-side (no client imports)
interface GeneratedDate {
  date: Date
  endDate: Date
  adjustmentReason?: string
}

function generateDatesSimple(
  schedule: any,
  from: Date,
  to: Date,
  workSchedule: any,
  absences: { start: Date; end: Date }[],
  bookings: { start: Date; end: Date; title?: string }[]
): GeneratedDate[] {
  const results: GeneratedDate[] = []
  const monthInterval = getMonthInterval(schedule.frequency)
  const durationMinutes = schedule.estimated_duration_minutes || 60
  const [prefH, prefM] = (schedule.preferred_time || '09:00').split(':').map(Number)

  let periodStart = new Date(from)

  while (periodStart < to) {
    const periodEnd = monthInterval >= 1
      ? addMonths(periodStart, monthInterval)
      : new Date(periodStart.getTime() + monthInterval * 30 * 24 * 60 * 60 * 1000)

    // Find a valid day in this period
    let candidate = new Date(periodStart)
    let found = false

    for (let dayOffset = 0; dayOffset < 28 && candidate < periodEnd && candidate < to; dayOffset++) {
      candidate = new Date(periodStart.getTime() + dayOffset * 86400000)

      const dayOfWeek = candidate.getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) continue // Skip weekends

      // Check work schedule
      if (workSchedule) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const dayKey = dayNames[dayOfWeek]
        const daySched = workSchedule[dayKey]
        if (!daySched || !daySched.active) continue
      }

      // Check absences
      const isAbsent = absences.some(a => candidate >= a.start && candidate <= a.end)
      if (isAbsent) continue

      // Set preferred time
      const slotStart = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate(), prefH, prefM)
      const slotEnd = addMinutes(slotStart, durationMinutes)

      // Check bookings for conflicts
      const hasConflict = bookings.some(b =>
        slotStart < b.end && slotEnd > b.start
      )

      if (!hasConflict) {
        results.push({ date: slotStart, endDate: slotEnd })
        found = true
        break
      }

      // Try later in the day
      let tryStart = new Date(slotEnd)
      while (tryStart.getHours() < 17) {
        const tryEnd = addMinutes(tryStart, durationMinutes)
        const tryConflict = bookings.some(b => tryStart < b.end && tryEnd > b.start)
        if (!tryConflict) {
          results.push({
            date: tryStart,
            endDate: tryEnd,
            adjustmentReason: 'Auto-justerad pga schemakonflikt'
          })
          found = true
          break
        }
        tryStart = addMinutes(tryStart, 30)
      }

      if (found) break
    }

    periodStart = monthInterval >= 1
      ? addMonths(periodStart, monthInterval)
      : new Date(periodStart.getTime() + monthInterval * 30 * 24 * 60 * 60 * 1000)
  }

  return results
}

function getMonthInterval(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 0.25
    case 'bi_weekly': return 0.5
    case 'monthly': return 1
    case 'twice_monthly': return 0.5
    case 'quarterly': return 3
    case 'semi_annual': return 6
    case 'annual': return 12
    default: return 1
  }
}

async function fetchBookingsForTechnician(techId: string, from: Date, to: Date) {
  const bookings: { start: Date; end: Date; title?: string }[] = []
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  const [{ data: pc }, { data: bc }, { data: cc }, { data: is }] = await Promise.all([
    supabase.from('private_cases').select('start_date, due_date, title')
      .or(`primary_assignee_id.eq.${techId},secondary_assignee_id.eq.${techId},tertiary_assignee_id.eq.${techId}`)
      .gte('start_date', fromISO).lte('start_date', toISO)
      .not('status', 'in', '(Avslutat,Stängt - slasklogg)'),
    supabase.from('business_cases').select('start_date, due_date, title')
      .or(`primary_assignee_id.eq.${techId},secondary_assignee_id.eq.${techId},tertiary_assignee_id.eq.${techId}`)
      .gte('start_date', fromISO).lte('start_date', toISO)
      .not('status', 'in', '(Avslutat,Stängt - slasklogg)'),
    supabase.from('cases').select('scheduled_start, scheduled_end, title')
      .or(`primary_technician_id.eq.${techId},secondary_technician_id.eq.${techId},tertiary_technician_id.eq.${techId}`)
      .gte('scheduled_start', fromISO).lte('scheduled_start', toISO)
      .neq('status', 'Avslutat'),
    supabase.from('station_inspection_sessions').select('scheduled_at, scheduled_end')
      .eq('technician_id', techId)
      .gte('scheduled_at', fromISO).lte('scheduled_at', toISO)
      .in('status', ['scheduled', 'in_progress'])
  ])

  pc?.forEach(c => { if (c.start_date && c.due_date) { const s = new Date(c.start_date); const e = new Date(c.due_date); if (e > s) bookings.push({ start: s, end: e, title: c.title }) } })
  bc?.forEach(c => { if (c.start_date && c.due_date) { const s = new Date(c.start_date); const e = new Date(c.due_date); if (e > s) bookings.push({ start: s, end: e, title: c.title }) } })
  cc?.forEach(c => { if (c.scheduled_start && c.scheduled_end) { const s = new Date(c.scheduled_start); const e = new Date(c.scheduled_end); if (e > s) bookings.push({ start: s, end: e, title: c.title }) } })
  is?.forEach(s => { if (s.scheduled_at && s.scheduled_end) { const st = new Date(s.scheduled_at); const en = new Date(s.scheduled_end); if (en > st) bookings.push({ start: st, end: en }) } })

  return bookings.sort((a, b) => a.start.getTime() - b.start.getTime())
}

async function fetchAbsencesForTechnician(techId: string, from: Date, to: Date) {
  const { data } = await supabase.from('technician_absences').select('start_date, end_date')
    .eq('technician_id', techId)
    .or(`start_date.lte.${to.toISOString()},end_date.gte.${from.toISOString()}`)

  return (data || []).map(a => ({ start: new Date(a.start_date), end: new Date(a.end_date) }))
}
