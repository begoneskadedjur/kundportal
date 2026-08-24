// api/cron/extend-recurring-schedules.ts
// Daily cron job to extend recurring inspection schedules
// Runs at 04:00 via Vercel Cron - generates new sessions for schedules approaching their generated_until date
//
// Sedan 2026-08-24 delar cronen klientens fullfjädrade datumgenerator
// (src/utils/inspectionDateGenerator, med timeZone='Europe/Stockholm' eftersom
// Vercel kör UTC) och skapar cases + station_inspection_sessions i PAR precis
// som klientflödet (createCaseAndSession i recurringScheduleService) — tidigare
// skapades bara sessions, vilket gjorde cron-förlängda besök osynliga i
// koordinator- och teknikerschemat som läser cases. Därmed respekteras nu även
// day_pattern, custom_frequency_config och svenska röda dagar vid förlängning.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { addMonths, format } from 'date-fns'
import { generateInspectionDates } from '../../src/utils/inspectionDateGenerator'
import type {
  GeneratedInspectionDate,
  RecurringDayPattern,
  RecurringFrequency,
  CustomFrequencyConfig,
} from '../../src/types/recurringSchedule'
import type { WorkSchedule } from '../../src/types/database'

export const config = { maxDuration: 120 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Threshold: extend when generated_until is less than 60 days away
const EXTENSION_THRESHOLD_DAYS = 60
const EXTENSION_MONTHS = 2

// Klockslag i recurring_schedules.preferred_time är svensk väggtid
const TIME_ZONE = 'Europe/Stockholm'

// Samma tjänst som klientens schemaskapade ärenden kopplas till
// (SCHEDULED_CASE_SERVICE_NAME i recurringScheduleService.ts)
const SCHEDULED_CASE_SERVICE_NAME = 'Återbesök / Uppföljning'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

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
        customer:customers(id, contract_status, effective_end_date, contact_person, contact_email, contact_phone, contact_address),
        contract:contracts(id, status, terminated_at, effective_end_date)
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

    // Tjänsten slås upp en gång per körning — sätts som service_id på varje ärende
    const { data: serviceRow } = await supabase
      .from('services')
      .select('id')
      .eq('name', SCHEDULED_CASE_SERVICE_NAME)
      .eq('is_active', true)
      .maybeSingle()
    if (!serviceRow) {
      console.warn(`[extend-schedules] Tjänsten "${SCHEDULED_CASE_SERVICE_NAME}" hittades inte — ärenden skapas utan service_id`)
    }

    let totalCreated = 0
    let totalErrors = 0

    for (const schedule of schedules) {
      try {
        const currentEnd = new Date(schedule.generated_until)
        let newEnd = addMonths(currentEnd, EXTENSION_MONTHS)

        // Avtalet först: ett uppsagt avtal ska inte generera besök efter sin
        // sista giltiga dag, även om KUNDEN fortfarande är aktiv (kunder med
        // flera avtal behåller contract_status 'active' när ett sägs upp).
        const contract = schedule.contract as {
          status?: string | null
          terminated_at?: string | null
          effective_end_date?: string | null
        } | null
        if (contract?.status === 'ended') {
          console.log(`[extend-schedules] Schedule ${schedule.id}: avtalet avslutat, hoppar över`)
          continue
        }
        if (contract?.terminated_at) {
          const contractEnd = contract.effective_end_date
            ? new Date(contract.effective_end_date)
            : null
          if (!contractEnd || currentEnd >= contractEnd) {
            console.log(`[extend-schedules] Schedule ${schedule.id}: avtalet uppsagt, hoppar över`)
            continue
          }
          // Kapa förlängningen vid avtalets slutdatum
          if (newEnd > contractEnd) newEnd = contractEnd
        }

        // is_auto_renewing=false betyder att schemat INTE ska rulla vidare
        // förbi sitt eget avtalsslutdatum (alla scheman i produktion är true,
        // men flaggan finns i modellen och ska respekteras).
        if (schedule.is_auto_renewing === false && schedule.contract_end_date) {
          const hardEnd = new Date(schedule.contract_end_date)
          if (currentEnd >= hardEnd) {
            console.log(`[extend-schedules] Schedule ${schedule.id}: is_auto_renewing=false och avtalstiden slut, hoppar över`)
            continue
          }
          if (newEnd > hardEnd) newEnd = hardEnd
        }

        // Check if customer has been terminated — respect effective_end_date, not binding period
        const customer = schedule.customer as {
          contract_status?: string | null
          effective_end_date?: string | null
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_address?: string | null
        } | null
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
        const workSchedule = (schedule.technician as { work_schedule?: unknown } | null)?.work_schedule ?? null

        // Fetch existing bookings and absences for the extension period
        const bookings = await fetchBookingsForTechnician(technicianId, currentEnd, newEnd)
        const absences = await fetchAbsencesForTechnician(technicianId, currentEnd, newEnd)

        // Samma generator som klientens wizard — dagmönster, anpassad frekvens
        // och röda dagar följer med. timeZone krävs: Vercel kör UTC och
        // preferred_time är svensk väggtid.
        const dates: GeneratedInspectionDate[] = generateInspectionDates({
          frequency: schedule.frequency as RecurringFrequency,
          dayPattern: (schedule.day_pattern ?? 'first_weekday') as RecurringDayPattern,
          preferredDayOfMonth: schedule.preferred_day_of_month ?? undefined,
          preferredTime: String(schedule.preferred_time ?? '09:00').slice(0, 5),
          estimatedDurationMinutes: schedule.estimated_duration_minutes || 60,
          startDate: currentEnd,
          endDate: newEnd,
          technicianWorkSchedule: workSchedule as WorkSchedule | null,
          technicianAbsences: absences,
          existingBookings: bookings,
          customFrequencyConfig: (schedule.custom_frequency_config ?? undefined) as CustomFrequencyConfig | undefined,
          timeZone: TIME_ZONE,
        })

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

        let scheduleErrors = 0
        if (newDates.length > 0) {
          const ctx = await fetchPairCreationContext(schedule, serviceRow?.id ?? null)
          for (const d of newDates) {
            const result = await createCaseAndSessionPair(schedule, ctx, d)
            if (result) {
              totalCreated++
            } else {
              scheduleErrors++
              totalErrors++
            }
          }
          if (scheduleErrors === 0) {
            console.log(`[extend-schedules] Created ${newDates.length} case+session pairs for schedule ${schedule.id}`)
          }
        }

        // Uppdatera generated_until bara när allt gick bra — vid partiella fel
        // försöker nästa nattkörning igen (datumdedupen ovan hindrar dubbletter).
        if (scheduleErrors === 0) {
          await supabase.from('recurring_schedules').update({
            generated_until: format(newEnd, 'yyyy-MM-dd'),
            last_generated_at: new Date().toISOString()
          }).eq('id', schedule.id)
        } else {
          console.warn(`[extend-schedules] Schedule ${schedule.id}: ${scheduleErrors} fel — generated_until lämnas för omkörning i morgon`)
        }

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Okänt fel'
    console.error('[extend-schedules] Fatal error:', error)
    return res.status(500).json({ error: message })
  }
}

// ============================================
// CASE + SESSION PAIR CREATION (speglar createCaseAndSession i recurringScheduleService)
// ============================================

interface PairCreationContext {
  technicianName: string | null
  serviceType: string
  serviceId: string | null
  outdoorCount: number
  indoorCount: number
}

async function fetchPairCreationContext(
  schedule: { id: string; customer_id: string; technician_id: string; technician?: unknown },
  serviceId: string | null
): Promise<PairCreationContext> {
  // service_type ärvs från schemats senaste befintliga ärende (rondering,
  // egenkontroll etc. ska förbli sin typ), fallback 'inspection'.
  const { data: lastSession } = await supabase
    .from('station_inspection_sessions')
    .select('case:cases(service_type)')
    .eq('recurring_schedule_id', schedule.id)
    .not('case_id', 'is', null)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastCase = (lastSession as { case?: { service_type?: string | null } | { service_type?: string | null }[] | null } | null)?.case
  const serviceType =
    (Array.isArray(lastCase) ? lastCase[0]?.service_type : lastCase?.service_type) ?? 'inspection'

  const { data: floorPlans } = await supabase
    .from('floor_plans')
    .select('id')
    .eq('customer_id', schedule.customer_id)
  const floorPlanIds = (floorPlans ?? []).map(fp => fp.id)

  const [outdoorResult, indoorResult] = await Promise.all([
    supabase
      .from('equipment_placements')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', schedule.customer_id)
      .eq('status', 'active'),
    floorPlanIds.length > 0
      ? supabase
          .from('indoor_stations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .in('floor_plan_id', floorPlanIds)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ])

  return {
    technicianName: (schedule.technician as { name?: string | null } | null)?.name ?? null,
    serviceType,
    serviceId,
    outdoorCount: outdoorResult.count || 0,
    indoorCount: indoorResult.count || 0,
  }
}

async function generateUniqueCaseNumber(maxRetries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: caseNumber, error } = await supabase.rpc('generate_universal_case_number')
    if (error || !caseNumber) {
      console.error('[extend-schedules] Kunde inte generera ärendenummer:', error)
      return null
    }
    const [c1, c2, c3] = await Promise.all([
      supabase.from('cases').select('id').eq('case_number', caseNumber).maybeSingle(),
      supabase.from('private_cases').select('id').eq('case_number', caseNumber).maybeSingle(),
      supabase.from('business_cases').select('id').eq('case_number', caseNumber).maybeSingle(),
    ])
    if (!c1.data && !c2.data && !c3.data) return caseNumber as string
  }
  console.error('[extend-schedules] Inget unikt ärendenummer efter flera försök')
  return null
}

/** Skapar cases-rad + session i par — samma ordning som klienten (case först, sessionen behöver case_id). */
async function createCaseAndSessionPair(
  schedule: {
    id: string
    customer_id: string
    contract_id?: string | null
    technician_id: string
    customer?: unknown
  },
  ctx: PairCreationContext,
  d: GeneratedInspectionDate
): Promise<boolean> {
  const caseNumber = await generateUniqueCaseNumber()
  if (!caseNumber) return false

  const customer = schedule.customer as {
    contact_person?: string | null
    contact_email?: string | null
    contact_phone?: string | null
    contact_address?: string | null
  } | null

  const { data: createdCase, error: caseError } = await supabase
    .from('cases')
    .insert([{
      customer_id: schedule.customer_id,
      title: caseNumber,
      description: 'Schemalagd stationskontroll',
      status: 'Bokad',
      priority: 'normal',
      service_type: ctx.serviceType,
      service_id: ctx.serviceId,
      pest_type: null,
      scheduled_start: d.date.toISOString(),
      scheduled_end: d.endDate.toISOString(),
      primary_technician_id: schedule.technician_id,
      primary_technician_name: ctx.technicianName,
      case_number: caseNumber,
      price: null,
      contact_person: customer?.contact_person ?? null,
      contact_email: customer?.contact_email ?? null,
      contact_phone: customer?.contact_phone ?? null,
      address: customer?.contact_address
        ? { formatted_address: customer.contact_address }
        : null,
    }])
    .select('id')
    .single()

  if (caseError || !createdCase) {
    console.error(`[extend-schedules] Kunde inte skapa ärende för schema ${schedule.id}:`, caseError)
    return false
  }

  const { error: sessionError } = await supabase
    .from('station_inspection_sessions')
    .insert([{
      case_id: createdCase.id,
      customer_id: schedule.customer_id,
      contract_id: schedule.contract_id ?? null,
      technician_id: schedule.technician_id,
      scheduled_at: d.date.toISOString(),
      scheduled_end: d.endDate.toISOString(),
      recurring_schedule_id: schedule.id,
      status: 'scheduled' as const,
      total_outdoor_stations: ctx.outdoorCount,
      total_indoor_stations: ctx.indoorCount,
      notes: d.isAdjusted ? d.adjustmentReason ?? null : null,
    }])

  if (sessionError) {
    console.error(`[extend-schedules] Ärende skapat men session misslyckades för schema ${schedule.id}:`, sessionError)
    // Städa det föräldralösa ärendet så nästa körning kan skapa paret rent
    await supabase.from('cases').delete().eq('id', createdCase.id)
    return false
  }

  return true
}

// ============================================
// BOOKINGS & ABSENCES
// ============================================

async function fetchBookingsForTechnician(techId: string, from: Date, to: Date) {
  const bookings: { start: Date; end: Date; title?: string }[] = []
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  // Äkta överlappsfilter (start före fönsterslutet OCH slut efter fönsterstarten)
  // — startfiltrering ensam missar bokningar som börjat före fönstret.
  const [{ data: pc }, { data: bc }, { data: cc }, { data: is }] = await Promise.all([
    supabase.from('private_cases').select('start_date, due_date, title')
      .or(`primary_assignee_id.eq.${techId},secondary_assignee_id.eq.${techId},tertiary_assignee_id.eq.${techId}`)
      .lte('start_date', toISO).gte('due_date', fromISO)
      .not('status', 'in', '(Avslutat,Borttaget)'),
    supabase.from('business_cases').select('start_date, due_date, title')
      .or(`primary_assignee_id.eq.${techId},secondary_assignee_id.eq.${techId},tertiary_assignee_id.eq.${techId}`)
      .lte('start_date', toISO).gte('due_date', fromISO)
      .not('status', 'in', '(Avslutat,Borttaget)'),
    supabase.from('cases').select('scheduled_start, scheduled_end, title')
      .or(`primary_technician_id.eq.${techId},secondary_technician_id.eq.${techId},tertiary_technician_id.eq.${techId}`)
      .lte('scheduled_start', toISO).gte('scheduled_end', fromISO)
      .neq('status', 'Avslutat'),
    supabase.from('station_inspection_sessions').select('scheduled_at, scheduled_end')
      .eq('technician_id', techId)
      .lte('scheduled_at', toISO).gte('scheduled_end', fromISO)
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
    .lte('start_date', to.toISOString())
    .gte('end_date', from.toISOString())

  // Generatorn tar datumsträngar (start_date/end_date) precis som klienten
  return (data || []) as { start_date: string; end_date: string }[]
}
