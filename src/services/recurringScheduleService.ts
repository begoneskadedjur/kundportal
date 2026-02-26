// src/services/recurringScheduleService.ts
// Service for managing recurring inspection schedules

import { supabase } from '../lib/supabase'
import { addMonths, format } from 'date-fns'
import type {
  RecurringSchedule,
  RecurringScheduleWithRelations,
  CreateRecurringScheduleInput,
  UpdateRecurringScheduleInput,
  DateGenerationParams,
  GeneratedInspectionDate
} from '../types/recurringSchedule'
import { generateInspectionDates } from '../utils/inspectionDateGenerator'

// ============================================
// CRUD OPERATIONS
// ============================================

export async function createRecurringSchedule(
  input: CreateRecurringScheduleInput
): Promise<RecurringSchedule | null> {
  // Calculate initial generated_until: contract_end_date or start + 2 months
  const startDate = new Date(input.schedule_start_date)
  let generatedUntil: Date

  if (input.contract_end_date) {
    const contractEnd = new Date(input.contract_end_date)
    // Generate for contract period + 2 months (for auto-renewing)
    generatedUntil = input.is_auto_renewing !== false
      ? addMonths(contractEnd, 2)
      : contractEnd
    // But cap at 14 months from start for initial generation
    const maxInitial = addMonths(startDate, 14)
    if (generatedUntil > maxInitial) generatedUntil = maxInitial
  } else {
    // No end date: generate 14 months ahead
    generatedUntil = addMonths(startDate, 14)
  }

  const { data, error } = await supabase
    .from('recurring_schedules')
    .insert([{
      customer_id: input.customer_id,
      technician_id: input.technician_id,
      frequency: input.frequency,
      day_pattern: input.day_pattern,
      preferred_day_of_month: input.preferred_day_of_month || null,
      preferred_time: input.preferred_time,
      estimated_duration_minutes: input.estimated_duration_minutes,
      schedule_start_date: input.schedule_start_date,
      contract_end_date: input.contract_end_date || null,
      is_auto_renewing: input.is_auto_renewing ?? true,
      generated_until: format(generatedUntil, 'yyyy-MM-dd'),
      status: 'active',
      notes: input.notes || null,
      created_by: input.created_by || null
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating recurring schedule:', error)
    return null
  }

  return data as RecurringSchedule
}

export async function getRecurringSchedule(
  id: string
): Promise<RecurringScheduleWithRelations | null> {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select(`
      *,
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date),
      technician:technicians(id, name, work_schedule)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching recurring schedule:', error)
    return null
  }

  return data as RecurringScheduleWithRelations
}

export async function getRecurringSchedulesByCustomer(
  customerId: string
): Promise<RecurringScheduleWithRelations[]> {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select(`
      *,
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date),
      technician:technicians(id, name, work_schedule)
    `)
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching recurring schedules:', error)
    return []
  }

  return (data || []) as RecurringScheduleWithRelations[]
}

export async function getRecurringSchedulesByTechnician(
  technicianId: string
): Promise<RecurringScheduleWithRelations[]> {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select(`
      *,
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date),
      technician:technicians(id, name, work_schedule)
    `)
    .eq('technician_id', technicianId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching recurring schedules:', error)
    return []
  }

  return (data || []) as RecurringScheduleWithRelations[]
}

export async function updateRecurringSchedule(
  id: string,
  input: UpdateRecurringScheduleInput
): Promise<RecurringSchedule | null> {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating recurring schedule:', error)
    return null
  }

  return data as RecurringSchedule
}

export async function pauseRecurringSchedule(id: string): Promise<boolean> {
  const result = await updateRecurringSchedule(id, { status: 'paused' })
  return result !== null
}

export async function resumeRecurringSchedule(id: string): Promise<boolean> {
  const result = await updateRecurringSchedule(id, { status: 'active' })
  return result !== null
}

export async function cancelRecurringSchedule(id: string): Promise<boolean> {
  const result = await updateRecurringSchedule(id, { status: 'cancelled' })
  if (!result) return false

  // Also cancel all future scheduled sessions for this schedule
  const { error } = await supabase
    .from('station_inspection_sessions')
    .update({ status: 'cancelled' })
    .eq('recurring_schedule_id', id)
    .eq('status', 'scheduled')
    .gt('scheduled_at', new Date().toISOString())

  if (error) {
    console.error('Error cancelling future sessions:', error)
  }

  return true
}

// ============================================
// FETCH TECHNICIAN BOOKINGS (conflict source)
// ============================================

export interface BookingSlot {
  start: Date
  end: Date
  title?: string
}

/**
 * Fetch all existing bookings for a technician in a date range.
 * Queries private_cases, business_cases, cases, and station_inspection_sessions.
 */
export async function fetchTechnicianBookings(
  technicianId: string,
  from: Date,
  to: Date
): Promise<BookingSlot[]> {
  const bookings: BookingSlot[] = []
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  // 1. Private cases
  const { data: privateCases } = await supabase
    .from('private_cases')
    .select('start_date, due_date, title')
    .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
    .gte('start_date', fromISO)
    .lte('start_date', toISO)
    .not('status', 'in', '(Avslutat,Stängt - slasklogg)')

  privateCases?.forEach(c => {
    if (c.start_date && c.due_date) {
      const start = new Date(c.start_date)
      const end = new Date(c.due_date)
      if (end.getTime() - start.getTime() > 0) {
        bookings.push({ start, end, title: c.title || 'Privatarende' })
      }
    }
  })

  // 2. Business cases
  const { data: businessCases } = await supabase
    .from('business_cases')
    .select('start_date, due_date, title')
    .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
    .gte('start_date', fromISO)
    .lte('start_date', toISO)
    .not('status', 'in', '(Avslutat,Stängt - slasklogg)')

  businessCases?.forEach(c => {
    if (c.start_date && c.due_date) {
      const start = new Date(c.start_date)
      const end = new Date(c.due_date)
      if (end.getTime() - start.getTime() > 0) {
        bookings.push({ start, end, title: c.title || 'Foretagsarende' })
      }
    }
  })

  // 3. Contract cases
  const { data: contractCases } = await supabase
    .from('cases')
    .select('scheduled_start, scheduled_end, title')
    .or(`primary_technician_id.eq.${technicianId},secondary_technician_id.eq.${technicianId},tertiary_technician_id.eq.${technicianId}`)
    .gte('scheduled_start', fromISO)
    .lte('scheduled_start', toISO)
    .neq('status', 'Avslutat')

  contractCases?.forEach(c => {
    if (c.scheduled_start && c.scheduled_end) {
      const start = new Date(c.scheduled_start)
      const end = new Date(c.scheduled_end)
      if (end.getTime() - start.getTime() > 0) {
        bookings.push({ start, end, title: c.title || 'Avtalsarende' })
      }
    }
  })

  // 4. Existing inspection sessions
  const { data: inspectionSessions } = await supabase
    .from('station_inspection_sessions')
    .select('scheduled_at, scheduled_end, customer:customers(company_name)')
    .eq('technician_id', technicianId)
    .gte('scheduled_at', fromISO)
    .lte('scheduled_at', toISO)
    .in('status', ['scheduled', 'in_progress'])

  inspectionSessions?.forEach(s => {
    if (s.scheduled_at && s.scheduled_end) {
      const start = new Date(s.scheduled_at)
      const end = new Date(s.scheduled_end)
      if (end.getTime() - start.getTime() > 0) {
        const customerName = (s.customer as any)?.company_name || ''
        bookings.push({ start, end, title: `Stationskontroll - ${customerName}` })
      }
    }
  })

  return bookings.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Fetch technician absences for a date range.
 */
export async function fetchTechnicianAbsences(
  technicianId: string,
  from: Date,
  to: Date
): Promise<{ start_date: string; end_date: string }[]> {
  const { data, error } = await supabase
    .from('technician_absences')
    .select('start_date, end_date')
    .eq('technician_id', technicianId)
    .or(`start_date.lte.${to.toISOString()},end_date.gte.${from.toISOString()}`)

  if (error) {
    console.error('Error fetching absences:', error)
    return []
  }

  return data || []
}

// ============================================
// PREVIEW & GENERATION
// ============================================

/**
 * Preview schedule dates without writing to the database.
 * Fetches all current bookings and generates conflict-aware dates.
 */
export async function previewScheduleDates(
  params: Omit<DateGenerationParams, 'existingBookings' | 'technicianAbsences'> & {
    technicianId: string
  }
): Promise<GeneratedInspectionDate[]> {
  const { technicianId, startDate, endDate, ...rest } = params

  // Fetch existing bookings and absences
  const [bookings, absences] = await Promise.all([
    fetchTechnicianBookings(technicianId, startDate, endDate),
    fetchTechnicianAbsences(technicianId, startDate, endDate)
  ])

  return generateInspectionDates({
    ...rest,
    startDate,
    endDate,
    existingBookings: bookings,
    technicianAbsences: absences
  })
}

/**
 * Generate inspection sessions and save them to the database.
 * Returns the number of sessions created.
 */
export async function generateAndCreateSessions(
  schedule: RecurringSchedule,
  generateUntil: Date,
  technicianWorkSchedule?: import('../types/database').WorkSchedule | null
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = []
  const startDate = new Date(schedule.schedule_start_date)
  const endDate = generateUntil

  // Fetch bookings and absences
  const [bookings, absences] = await Promise.all([
    fetchTechnicianBookings(schedule.technician_id, startDate, endDate),
    fetchTechnicianAbsences(schedule.technician_id, startDate, endDate)
  ])

  // Generate dates
  const dates = generateInspectionDates({
    frequency: schedule.frequency,
    dayPattern: schedule.day_pattern,
    preferredDayOfMonth: schedule.preferred_day_of_month ?? undefined,
    preferredTime: schedule.preferred_time,
    estimatedDurationMinutes: schedule.estimated_duration_minutes,
    startDate,
    endDate,
    technicianWorkSchedule: technicianWorkSchedule || null,
    technicianAbsences: absences,
    existingBookings: bookings
  })

  if (dates.length === 0) {
    return { created: 0, errors: [] }
  }

  // Check for existing sessions to avoid duplicates
  const { data: existingSessions } = await supabase
    .from('station_inspection_sessions')
    .select('scheduled_at')
    .eq('recurring_schedule_id', schedule.id)
    .in('status', ['scheduled', 'in_progress'])

  const existingDates = new Set(
    (existingSessions || []).map(s => s.scheduled_at?.split('T')[0])
  )

  // Filter out dates that already have sessions
  const newDates = dates.filter(d => {
    const dateStr = format(d.date, 'yyyy-MM-dd')
    return !existingDates.has(dateStr)
  })

  if (newDates.length === 0) {
    return { created: 0, errors: [] }
  }

  // Bulk create sessions
  const sessionsToCreate = newDates.map(d => ({
    customer_id: schedule.customer_id,
    technician_id: schedule.technician_id,
    scheduled_at: d.date.toISOString(),
    scheduled_end: d.endDate.toISOString(),
    recurring_schedule_id: schedule.id,
    status: 'scheduled' as const,
    notes: d.isAdjusted ? d.adjustmentReason || null : null
  }))

  const { data: created, error } = await supabase
    .from('station_inspection_sessions')
    .insert(sessionsToCreate)
    .select('id')

  if (error) {
    console.error('Error bulk creating sessions:', error)
    errors.push(`Databasfel vid skapande: ${error.message}`)
    return { created: 0, errors }
  }

  // Update the schedule's generated_until and last_generated_at
  await supabase
    .from('recurring_schedules')
    .update({
      generated_until: format(generateUntil, 'yyyy-MM-dd'),
      last_generated_at: new Date().toISOString()
    })
    .eq('id', schedule.id)

  return { created: created?.length || 0, errors }
}

/**
 * Create a schedule and immediately generate its sessions.
 */
export async function createScheduleWithSessions(
  input: CreateRecurringScheduleInput,
  generatedDates: GeneratedInspectionDate[]
): Promise<{ schedule: RecurringSchedule | null; sessionsCreated: number; errors: string[] }> {
  const errors: string[] = []

  // Create the schedule record
  const schedule = await createRecurringSchedule(input)
  if (!schedule) {
    return { schedule: null, sessionsCreated: 0, errors: ['Kunde inte skapa schemat'] }
  }

  if (generatedDates.length === 0) {
    return { schedule, sessionsCreated: 0, errors: [] }
  }

  // Create sessions from the pre-generated (and user-reviewed) dates
  const sessionsToCreate = generatedDates.map(d => ({
    customer_id: schedule.customer_id,
    technician_id: schedule.technician_id,
    scheduled_at: d.date.toISOString(),
    scheduled_end: d.endDate.toISOString(),
    recurring_schedule_id: schedule.id,
    status: 'scheduled' as const,
    notes: d.isAdjusted ? d.adjustmentReason || null : null
  }))

  const { data: created, error } = await supabase
    .from('station_inspection_sessions')
    .insert(sessionsToCreate)
    .select('id')

  if (error) {
    console.error('Error creating sessions:', error)
    errors.push(`Skapade schemat men kunde inte skapa sessioner: ${error.message}`)
    return { schedule, sessionsCreated: 0, errors }
  }

  return { schedule, sessionsCreated: created?.length || 0, errors }
}

// ============================================
// EXTENSION CHECK
// ============================================

/**
 * Check if a schedule needs extension and extend if necessary.
 * Called from equipment page load or cron job.
 */
export async function extendScheduleIfNeeded(
  scheduleId: string
): Promise<{ extended: boolean; created: number }> {
  const schedule = await getRecurringSchedule(scheduleId)
  if (!schedule || schedule.status !== 'active') {
    return { extended: false, created: 0 }
  }

  const generatedUntil = new Date(schedule.generated_until)
  const threshold = addMonths(new Date(), 2) // 2 months ahead

  if (generatedUntil > threshold) {
    return { extended: false, created: 0 }
  }

  // Extend by 2 months
  const newEndDate = addMonths(generatedUntil, 2)

  // If not auto-renewing and past contract end, don't extend
  if (!schedule.is_auto_renewing && schedule.contract_end_date) {
    const contractEnd = new Date(schedule.contract_end_date)
    if (generatedUntil >= contractEnd) {
      return { extended: false, created: 0 }
    }
  }

  const techWorkSchedule = schedule.technician?.work_schedule || null

  const result = await generateAndCreateSessions(
    schedule,
    newEndDate,
    techWorkSchedule
  )

  return { extended: true, created: result.created }
}

/**
 * Get the next upcoming session for a schedule.
 */
export async function getNextScheduledSession(
  scheduleId: string
): Promise<{ scheduled_at: string; scheduled_end: string } | null> {
  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .select('scheduled_at, scheduled_end')
    .eq('recurring_schedule_id', scheduleId)
    .eq('status', 'scheduled')
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data
}

/**
 * Get future sessions for a schedule.
 */
export async function getFutureSessionsForSchedule(
  scheduleId: string
): Promise<{ id: string; scheduled_at: string; scheduled_end: string | null; status: string; notes: string | null }[]> {
  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .select('id, scheduled_at, scheduled_end, status, notes')
    .eq('recurring_schedule_id', scheduleId)
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('Error fetching future sessions:', error)
    return []
  }

  return data || []
}
