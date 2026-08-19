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
  GeneratedInspectionDate,
  CustomerScheduleInfo
} from '../types/recurringSchedule'
import { generateInspectionDates } from '../utils/inspectionDateGenerator'
import { CaseNumberService } from './caseNumberService'

// ============================================
// HELPERS
// ============================================

/**
 * Löser upp avtalsslutdatum för en kund, med arv från huvudkontoret.
 *
 * Multisite-enheter (site_type = 'enhet') har inga egna avtalsdatum – de går
 * inte ens att sätta i "Redigera enhet"-modalen – utan följer huvudkontorets
 * avtal. Denna helper returnerar enhetens eget contract_end_date om det finns,
 * annars huvudkontorets (via parent_customer_id). Returnerar null om varken
 * enheten eller huvudkontoret har ett datum.
 *
 * Använd överallt där ett contract_end_date matas till RecurringScheduleWizard.
 */
export async function resolveContractEndDate(
  customerId: string,
  ownEndDate?: string | null
): Promise<string | null> {
  if (ownEndDate) return ownEndDate

  const { data: customer, error } = await supabase
    .from('customers')
    .select('contract_end_date, parent_customer_id')
    .eq('id', customerId)
    .single()

  if (error || !customer) {
    console.error('resolveContractEndDate: kunde inte hämta kund', customerId, error)
    return ownEndDate ?? null
  }

  if (customer.contract_end_date) return customer.contract_end_date
  if (!customer.parent_customer_id) return null

  const { data: parent, error: parentError } = await supabase
    .from('customers')
    .select('contract_end_date')
    .eq('id', customer.parent_customer_id)
    .single()

  if (parentError || !parent) {
    console.error('resolveContractEndDate: kunde inte hämta huvudkontor', customer.parent_customer_id, parentError)
    return null
  }

  return parent.contract_end_date ?? null
}

/**
 * Rullande schemahorisont. Avtal löper tills de sägs upp och förlängs
 * automatiskt vid periodskifte (generate-continuing-contracts-cronen) — ett
 * passerat contract_end_date betyder alltså inte att schemat ska ta slut,
 * utan att nästa brytpunkt ligger ett helt antal år framåt. Uppsagda avtal
 * rullas aldrig. Saknas slutdatum helt (tillsvidare) används avtalsstartens
 * nästa årsdag som brytpunkt.
 */
export async function resolveScheduleHorizon(
  customerId: string,
  ownEndDate?: string | null
): Promise<{ endDate: string | null; rolled: boolean }> {
  const { data: customer } = await supabase
    .from('customers')
    .select('contract_end_date, contract_start_date, terminated_at, parent_customer_id')
    .eq('id', customerId)
    .single()

  let endDate = ownEndDate ?? customer?.contract_end_date ?? null
  let startDate = customer?.contract_start_date ?? null
  let terminated = !!customer?.terminated_at

  if (customer?.parent_customer_id) {
    const { data: parent } = await supabase
      .from('customers')
      .select('contract_end_date, contract_start_date, terminated_at')
      .eq('id', customer.parent_customer_id)
      .single()
    if (parent) {
      endDate = endDate ?? parent.contract_end_date ?? null
      startDate = startDate ?? parent.contract_start_date ?? null
      terminated = terminated || !!parent.terminated_at
    }
  }

  if (terminated) return { endDate, rolled: false }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const roll = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    let rolled = false
    while (d <= today) {
      d.setFullYear(d.getFullYear() + 1)
      rolled = true
    }
    return { endDate: format(d, 'yyyy-MM-dd'), rolled }
  }

  if (endDate) return roll(endDate)
  if (startDate) return { ...roll(startDate), rolled: true }
  return { endDate: null, rolled: false }
}

// ============================================
// CRUD OPERATIONS
// ============================================

export async function createRecurringSchedule(
  input: CreateRecurringScheduleInput
): Promise<RecurringSchedule | null> {
  // Generera till avtalsslutet om det finns, annars 14 månader framåt som fallback.
  // Cron-jobbet hanterar automatisk förlängning om avtalet förnyas (is_auto_renewing = true).
  const startDate = new Date(input.schedule_start_date)
  if (!input.contract_end_date) {
    console.error('createRecurringSchedule: contract_end_date saknas')
    return null
  }
  const generatedUntil = new Date(input.contract_end_date)

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
      created_by: input.created_by || null,
      custom_frequency_config: input.custom_frequency_config || null
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
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date, contract_status, effective_end_date),
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
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date, contract_status, effective_end_date),
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
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date, contract_status, effective_end_date),
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

  const now = new Date().toISOString()

  // Fetch future scheduled sessions to get their case_ids
  const { data: sessions } = await supabase
    .from('station_inspection_sessions')
    .select('id, case_id')
    .eq('recurring_schedule_id', id)
    .eq('status', 'scheduled')
    .gt('scheduled_at', now)

  // Mark linked cases as 'Borttaget' so they disappear from coordinator/technician schedules
  const caseIds = (sessions || []).map(s => s.case_id).filter(Boolean) as string[]
  if (caseIds.length > 0) {
    await supabase.from('cases').update({ status: 'Borttaget' }).in('id', caseIds)
  }

  // Cancel the sessions themselves
  const { error } = await supabase
    .from('station_inspection_sessions')
    .update({ status: 'cancelled' })
    .eq('recurring_schedule_id', id)
    .eq('status', 'scheduled')
    .gt('scheduled_at', now)

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

// ============================================
// SHARED: Create case + session for a single date
// ============================================

interface SessionCreationContext {
  schedule: RecurringSchedule
  technicianName: string | null
  customerData: {
    contact_person: string | null
    contact_email: string | null
    contact_phone: string | null
    contact_address: string | null
  } | null
  outdoorCount: number
  indoorCount: number
  service_type?: string
  serviceId: string | null
}

// Tjänst som schemaskapade ärenden kopplas till (alla ärendetyper i
// ronderingsschemat). Styr Tjänst-dropdownsen i EditContractCaseModal.
const SCHEDULED_CASE_SERVICE_NAME = 'Återbesök / Uppföljning'

async function fetchSessionCreationContext(
  schedule: RecurringSchedule,
  service_type?: string
): Promise<SessionCreationContext> {
  const { data: techData } = await supabase
    .from('technicians')
    .select('name')
    .eq('id', schedule.technician_id)
    .single()

  // Slå upp tjänsten en gång per schema — sätts som service_id på varje ärende
  const { data: serviceData } = await supabase
    .from('services')
    .select('id')
    .eq('name', SCHEDULED_CASE_SERVICE_NAME)
    .eq('is_active', true)
    .maybeSingle()
  if (!serviceData) {
    console.warn(`fetchSessionCreationContext: tjänsten "${SCHEDULED_CASE_SERVICE_NAME}" hittades inte — ärenden skapas utan service_id`)
  }

  const { data: customerData } = await supabase
    .from('customers')
    .select('contact_person, contact_email, contact_phone, contact_address')
    .eq('id', schedule.customer_id)
    .single()

  const [outdoorResult, indoorResult] = await Promise.all([
    supabase
      .from('equipment_placements')
      .select('id', { count: 'exact' })
      .eq('customer_id', schedule.customer_id)
      .eq('status', 'active'),
    supabase
      .from('indoor_stations')
      .select('id, floor_plan_id', { count: 'exact' })
      .eq('status', 'active')
      .in('floor_plan_id',
        (await supabase
          .from('floor_plans')
          .select('id')
          .eq('customer_id', schedule.customer_id)
        ).data?.map(fp => fp.id) || []
      )
  ])

  return {
    schedule,
    technicianName: techData?.name || null,
    customerData,
    outdoorCount: outdoorResult.count || 0,
    indoorCount: indoorResult.count || 0,
    service_type,
    serviceId: serviceData?.id ?? null
  }
}

async function createCaseAndSession(
  ctx: SessionCreationContext,
  d: GeneratedInspectionDate
): Promise<{ success: boolean; error?: string }> {
  const { schedule, technicianName, customerData, outdoorCount, indoorCount, service_type } = ctx

  const caseNumber = await CaseNumberService.generateUniqueCaseNumber()

  const { data: createdCase, error: caseError } = await supabase
    .from('cases')
    .insert([{
      customer_id: schedule.customer_id,
      title: caseNumber,
      description: 'Schemalagd stationskontroll',
      status: 'Bokad',
      priority: 'normal',
      service_type: ctx.service_type ?? 'inspection',
      service_id: ctx.serviceId,
      pest_type: null,
      scheduled_start: d.date.toISOString(),
      scheduled_end: d.endDate.toISOString(),
      primary_technician_id: schedule.technician_id,
      primary_technician_name: technicianName,
      case_number: caseNumber,
      price: null,
      contact_person: customerData?.contact_person || null,
      contact_email: customerData?.contact_email || null,
      contact_phone: customerData?.contact_phone || null,
      address: customerData?.contact_address
        ? { formatted_address: customerData.contact_address }
        : null
    }])
    .select('id')
    .single()

  if (caseError) {
    console.error('Error creating case for session:', caseError)
    return { success: false, error: `Kunde inte skapa ärende: ${caseError.message}` }
  }

  const { error: sessionError } = await supabase
    .from('station_inspection_sessions')
    .insert([{
      case_id: createdCase.id,
      customer_id: schedule.customer_id,
      technician_id: schedule.technician_id,
      scheduled_at: d.date.toISOString(),
      scheduled_end: d.endDate.toISOString(),
      recurring_schedule_id: schedule.id,
      status: 'scheduled',
      total_outdoor_stations: outdoorCount,
      total_indoor_stations: indoorCount,
      notes: d.isAdjusted ? d.adjustmentReason || null : null
    }])

  if (sessionError) {
    console.error('Error creating session:', sessionError)
    return { success: false, error: `Ärende skapat men session misslyckades: ${sessionError.message}` }
  }

  return { success: true }
}

// ============================================
// CREATE SCHEDULE WITH SESSIONS
// ============================================

/**
 * Create a schedule and immediately generate its sessions.
 * For each session, creates a real `cases` row (so it appears in all schedules)
 * and links the station_inspection_session to the case via case_id.
 */
export async function createScheduleWithSessions(
  input: CreateRecurringScheduleInput,
  generatedDates: GeneratedInspectionDate[]
): Promise<{ schedule: RecurringSchedule | null; sessionsCreated: number; errors: string[] }> {
  const errors: string[] = []

  const schedule = await createRecurringSchedule(input)
  if (!schedule) {
    return { schedule: null, sessionsCreated: 0, errors: ['Kunde inte skapa schemat'] }
  }

  if (generatedDates.length === 0) {
    return { schedule, sessionsCreated: 0, errors: [] }
  }

  const ctx = await fetchSessionCreationContext(schedule, input.service_type)
  let sessionsCreated = 0

  for (const d of generatedDates) {
    try {
      const result = await createCaseAndSession(ctx, d)
      if (result.success) {
        sessionsCreated++
      } else if (result.error) {
        errors.push(result.error)
      }
    } catch (err) {
      console.error('Error in createScheduleWithSessions loop:', err)
      errors.push(`Oväntat fel: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { schedule, sessionsCreated, errors }
}

// ============================================
// RESCHEDULE EXISTING SESSIONS
// ============================================

/**
 * Delete all future scheduled sessions (and their cases), update the schedule,
 * and create new sessions + cases with the updated settings.
 */
export async function rescheduleExistingSessions(
  scheduleId: string,
  updates: UpdateRecurringScheduleInput,
  generatedDates: GeneratedInspectionDate[]
): Promise<{ deleted: number; created: number; errors: string[] }> {
  const errors: string[] = []

  // 1. Fetch future sessions with case_id
  const { data: futureSessions, error: fetchError } = await supabase
    .from('station_inspection_sessions')
    .select('id, case_id')
    .eq('recurring_schedule_id', scheduleId)
    .eq('status', 'scheduled')
    .gt('scheduled_at', new Date().toISOString())

  if (fetchError) {
    console.error('Error fetching future sessions:', fetchError)
    return { deleted: 0, created: 0, errors: [`Kunde inte hämta sessioner: ${fetchError.message}`] }
  }

  const sessionIds = (futureSessions || []).map(s => s.id)
  const caseIds = (futureSessions || []).filter(s => s.case_id).map(s => s.case_id)

  // 2. DELETE sessions
  if (sessionIds.length > 0) {
    const { error: delSessionErr } = await supabase
      .from('station_inspection_sessions')
      .delete()
      .in('id', sessionIds)

    if (delSessionErr) {
      console.error('Error deleting sessions:', delSessionErr)
      return { deleted: 0, created: 0, errors: [`Kunde inte radera sessioner: ${delSessionErr.message}`] }
    }
  }

  // 3. DELETE linked cases
  if (caseIds.length > 0) {
    const { error: delCaseErr } = await supabase
      .from('cases')
      .delete()
      .in('id', caseIds)

    if (delCaseErr) {
      console.error('Error deleting cases:', delCaseErr)
      errors.push(`Sessioner raderade men ärenden kunde inte tas bort: ${delCaseErr.message}`)
    }
  }

  const deleted = sessionIds.length

  // 4. Update the schedule
  const updatedSchedule = await updateRecurringSchedule(scheduleId, updates)
  if (!updatedSchedule) {
    return { deleted, created: 0, errors: [...errors, 'Kunde inte uppdatera schemat'] }
  }

  // 5. Create new sessions + cases
  if (generatedDates.length === 0) {
    return { deleted, created: 0, errors }
  }

  const ctx = await fetchSessionCreationContext(updatedSchedule)
  let created = 0

  for (const d of generatedDates) {
    try {
      const result = await createCaseAndSession(ctx, d)
      if (result.success) {
        created++
      } else if (result.error) {
        errors.push(result.error)
      }
    } catch (err) {
      console.error('Error in rescheduleExistingSessions loop:', err)
      errors.push(`Oväntat fel: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 6. Update generated_until
  const latestDate = generatedDates.length > 0
    ? generatedDates[generatedDates.length - 1].date
    : new Date()
  await supabase
    .from('recurring_schedules')
    .update({
      generated_until: format(latestDate, 'yyyy-MM-dd'),
      last_generated_at: new Date().toISOString()
    })
    .eq('id', scheduleId)

  return { deleted, created, errors }
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
  let newEndDate = addMonths(generatedUntil, 2)

  // Check if customer has been terminated — stop generating past effective_end_date
  if (schedule.customer?.contract_status === 'terminated') {
    const effectiveEnd = schedule.customer.effective_end_date
      ? new Date(schedule.customer.effective_end_date)
      : null
    if (!effectiveEnd || generatedUntil >= effectiveEnd) {
      return { extended: false, created: 0 }
    }
    if (newEndDate > effectiveEnd) {
      newEndDate = effectiveEnd
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
): Promise<{ id: string; scheduled_at: string; scheduled_end: string | null; status: string; notes: string | null; case_id: string | null }[]> {
  const { data, error } = await supabase
    .from('station_inspection_sessions')
    .select('id, scheduled_at, scheduled_end, status, notes, case_id')
    .eq('recurring_schedule_id', scheduleId)
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('Error fetching future sessions:', error)
    return []
  }

  return data || []
}

// ============================================
// ON-DEMAND SCHEDULE INFO
// ============================================

/**
 * Get all recurring schedules, optionally filtered by customer or status.
 */
export async function getAllRecurringSchedules(
  filters?: { customerId?: string; status?: string }
): Promise<RecurringScheduleWithRelations[]> {
  let query = supabase
    .from('recurring_schedules')
    .select(`
      *,
      customer:customers(id, company_name, contact_address, service_frequency, contract_start_date, contract_end_date, contract_status, effective_end_date),
      technician:technicians(id, name, work_schedule)
    `)

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  } else {
    query = query.neq('status', 'cancelled')
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all recurring schedules:', error)
    return []
  }

  return (data || []) as RecurringScheduleWithRelations[]
}

/**
 * Get aggregated schedule info for a customer (on-demand).
 * Returns the first active schedule with future session counts/dates.
 */
export async function getCustomerScheduleInfo(
  customerId: string
): Promise<CustomerScheduleInfo | null> {
  const schedules = await getRecurringSchedulesByCustomer(customerId)
  const activeSchedule = schedules.find(s => s.status === 'active')
  if (!activeSchedule) return null

  const futureSessions = await getFutureSessionsForSchedule(activeSchedule.id)

  return {
    scheduleId: activeSchedule.id,
    customerId: activeSchedule.customer_id,
    customerName: activeSchedule.customer?.company_name || '',
    frequency: activeSchedule.frequency,
    status: activeSchedule.status,
    preferredTime: activeSchedule.preferred_time,
    dayPattern: activeSchedule.day_pattern,
    estimatedDurationMinutes: activeSchedule.estimated_duration_minutes,
    remainingSessions: futureSessions.length,
    nextSessionDate: futureSessions.length > 0 ? futureSessions[0].scheduled_at : null,
    futureSessions: futureSessions.map(s => ({
      scheduled_at: s.scheduled_at,
      scheduled_end: s.scheduled_end || ''
    }))
  }
}

// ============================================
// TEKNIKERBYTE / FÖRDELNING
// ============================================

export interface SwapVisitPreview {
  sessionId: string
  caseId: string | null
  scheduledAt: string
  scheduledEnd: string | null
  /** Beskrivning av krocken — null betyder att besöket kan flyttas fritt */
  conflict: string | null
}

/**
 * Dry-run inför teknikerbyte: kollar varje framtida besök i schemat mot
 * målteknikerns befintliga bokningar (alla fyra källor, alla tre roller),
 * frånvaro och arbetsschema. Skriver ingenting.
 */
export async function previewTechnicianSwap(
  scheduleId: string,
  newTechnicianId: string
): Promise<SwapVisitPreview[]> {
  const sessions = (await getFutureSessionsForSchedule(scheduleId))
    .filter(s => s.status === 'scheduled')
  if (sessions.length === 0) return []

  const from = new Date()
  const lastStart = new Date(sessions[sessions.length - 1].scheduled_at)
  const to = new Date(lastStart.getTime() + 24 * 3_600_000)

  const [bookings, absences, techResult] = await Promise.all([
    fetchTechnicianBookings(newTechnicianId, from, to),
    fetchTechnicianAbsences(newTechnicianId, from, to),
    supabase.from('technicians').select('work_schedule').eq('id', newTechnicianId).single(),
  ])
  const workSchedule = (techResult.data?.work_schedule ?? null) as {
    [day: string]: { active: boolean; start: string; end: string } | undefined
  } | null

  const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

  const withinWorkHours = (start: Date, end: Date): boolean => {
    if (!workSchedule) return true
    const day = workSchedule[WEEK_DAYS[start.getDay()]]
    if (!day?.active) return false
    const [sh, sm] = day.start.split(':').map(Number)
    const [eh, em] = day.end.split(':').map(Number)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    return startMin >= sh * 60 + sm && endMin <= eh * 60 + em
  }

  const fmtClash = (d: Date) =>
    d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

  return sessions.map(s => {
    const start = new Date(s.scheduled_at)
    const end = s.scheduled_end ? new Date(s.scheduled_end) : new Date(start.getTime() + 3_600_000)
    const base = {
      sessionId: s.id,
      caseId: s.case_id,
      scheduledAt: s.scheduled_at,
      scheduledEnd: s.scheduled_end,
    }

    const clash = bookings.find(b => b.start < end && b.end > start)
    if (clash) {
      return { ...base, conflict: `Krockar med ${clash.title || 'annan bokning'} (${fmtClash(clash.start)})` }
    }

    const absent = absences.find(a => {
      const aStart = new Date(a.start_date)
      const aEnd = new Date(a.end_date)
      return aStart < end && aEnd > start
    })
    if (absent) return { ...base, conflict: 'Teknikern är frånvarande' }

    if (!withinWorkHours(start, end)) return { ...base, conflict: 'Utanför teknikerns arbetstid' }

    return { ...base, conflict: null }
  })
}

/**
 * Genomför teknikerbyte för ett schema:
 *  1. recurring_schedules.technician_id — så att all framtida generering
 *     (klientflödet OCH cron-förlängningen) hamnar hos nya teknikern
 *  2. Framtida sessions (status='scheduled') — täcker även cron-genererade
 *     sessions som saknar cases-rad
 *  3. Länkade framtida cases — byter BARA den roll där gamla teknikern står
 *     (medtekniker på ärendet röras aldrig)
 *
 * Besök i skipSessionIds lämnas kvar hos nuvarande tekniker ("lämna kvar"
 * vid krock). Historiska/utförda besök röras aldrig.
 */
export async function executeTechnicianSwap(
  scheduleId: string,
  newTechnicianId: string,
  options: { skipSessionIds?: string[] } = {}
): Promise<boolean> {
  const { data: schedule } = await supabase
    .from('recurring_schedules')
    .select('technician_id')
    .eq('id', scheduleId)
    .single()
  if (!schedule) return false
  const oldTechnicianId = schedule.technician_id

  const { data: newTech } = await supabase
    .from('technicians')
    .select('id, name, email')
    .eq('id', newTechnicianId)
    .single()
  if (!newTech) return false

  // 1. Schemat självt
  const updated = await updateRecurringSchedule(scheduleId, { technician_id: newTechnicianId })
  if (!updated) return false

  const nowISO = new Date().toISOString()
  const skip = new Set(options.skipSessionIds ?? [])

  // 2. Framtida sessions
  const { data: sessions } = await supabase
    .from('station_inspection_sessions')
    .select('id, case_id')
    .eq('recurring_schedule_id', scheduleId)
    .eq('status', 'scheduled')
    .gt('scheduled_at', nowISO)

  const targets = (sessions ?? []).filter(s => !skip.has(s.id))
  const sessionIds = targets.map(s => s.id)
  const caseIds = targets.map(s => s.case_id).filter(Boolean) as string[]

  if (sessionIds.length > 0) {
    const { error } = await supabase
      .from('station_inspection_sessions')
      .update({ technician_id: newTechnicianId, updated_at: nowISO })
      .in('id', sessionIds)
    if (error) {
      console.error('executeTechnicianSwap: kunde inte uppdatera sessions:', error)
      return false
    }
  }

  // 3. Länkade cases — byt rollen där gamla teknikern står
  if (caseIds.length > 0) {
    const { data: caseRows } = await supabase
      .from('cases')
      .select('id, primary_technician_id, secondary_technician_id, tertiary_technician_id')
      .in('id', caseIds)

    for (const c of caseRows ?? []) {
      const patch: Record<string, unknown> = { updated_at: nowISO }
      if (c.primary_technician_id === oldTechnicianId || !c.primary_technician_id) {
        patch.primary_technician_id = newTech.id
        patch.primary_technician_name = newTech.name
        patch.primary_technician_email = newTech.email ?? null
      } else if (c.secondary_technician_id === oldTechnicianId) {
        patch.secondary_technician_id = newTech.id
        patch.secondary_technician_name = newTech.name
        patch.secondary_technician_email = newTech.email ?? null
      } else if (c.tertiary_technician_id === oldTechnicianId) {
        patch.tertiary_technician_id = newTech.id
        patch.tertiary_technician_name = newTech.name
        patch.tertiary_technician_email = newTech.email ?? null
      } else {
        // Ärendet har flyttats manuellt till annan tekniker — rör det inte
        continue
      }
      const { error } = await supabase.from('cases').update(patch).eq('id', c.id)
      if (error) {
        console.error('executeTechnicianSwap: kunde inte uppdatera case', c.id, error)
      }
    }
  }

  return true
}
