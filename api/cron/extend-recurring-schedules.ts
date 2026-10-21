// api/cron/extend-recurring-schedules.ts
// Daily cron job to extend recurring inspection schedules
// Runs at 04:00 via Vercel Cron - lägger ut kontroller fram till schemats
// horisont (periodskiftet, eller hela nästa avtalsår när sista
// uppsägningsdag passerat)
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
import { format } from 'date-fns'
import { generateInspectionDates } from '../../src/utils/inspectionDateGenerator'
import { scheduleHorizon, type HorizonContract } from '../../src/shared/scheduleHorizon'
import { toLocalIsoDate, todayLocal, addDaysIso } from '../../src/shared/contractPlanner'
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

// Horisonten följer avtalet (scheduleHorizon, samma regel som fakturorna):
// kontroller läggs ut till periodskiftet, och när sista uppsägningsdag passerat
// utan uppsägning läggs hela nästa avtalsår ut på en gång. Förut förlängdes
// alla scheman två månader i taget, och perioderna räknades om från varje
// förlängning, så "6 per år" blev 6 per två månader.
//
// Tidsbudget: ett år per schema kan ge många ärenden första natten. Scheman
// som inte hinns med tas nästa natt (generated_until flyttas bara när ett
// schema är klart).
const TIME_BUDGET_MS = 90_000

// Klockslag i recurring_schedules.preferred_time är svensk väggtid
const TIME_ZONE = 'Europe/Stockholm'

// Samma tjänst som klientens schemaskapade ärenden kopplas till
// (SCHEDULED_CASE_SERVICE_NAME i recurringScheduleService.ts)
const SCHEDULED_CASE_SERVICE_NAME = 'Återbesök / Uppföljning'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  console.log('[extend-schedules] Starting recurring schedule extension check...')

  try {
    const startedAt = Date.now()
    const todayIso = toLocalIsoDate(todayLocal())

    // Alla aktiva scheman: horisonten avgör per schema om något ska läggas ut
    const { data: schedules, error: fetchError } = await supabase
      .from('recurring_schedules')
      .select(`
        *,
        technician:technicians(id, name, work_schedule),
        customer:customers(id, contract_status, effective_end_date, contact_person, contact_email, contact_phone, contact_address, contract_start_date, contract_end_date, terminated_at, notice_period_months, contract_length, parent_customer_id),
        contract:contracts(id, status, terminated_at, effective_end_date, contract_start_date, start_date, contract_end_date, notice_period_months, renewal_mode, contract_length)
      `)
      .eq('status', 'active')

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
    let deferred = 0

    for (const schedule of schedules) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        deferred++
        continue
      }
      try {
        const currentEnd = new Date(schedule.generated_until ?? schedule.schedule_start_date)

        const contract = schedule.contract as {
          status?: string | null
          terminated_at?: string | null
          effective_end_date?: string | null
          contract_start_date?: string | null
          start_date?: string | null
          contract_end_date?: string | null
          notice_period_months?: number | null
          contract_length?: string | null
          renewal_mode?: string | null
        } | null
        if (contract?.status === 'ended') {
          console.log(`[extend-schedules] Schedule ${schedule.id}: avtalet avslutat, hoppar över`)
          continue
        }

        const customer = schedule.customer as {
          contract_status?: string | null
          effective_end_date?: string | null
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_address?: string | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          terminated_at?: string | null
          notice_period_months?: number | null
          contract_length?: string | null
          parent_customer_id?: string | null
        } | null
        if (customer?.contract_status === 'expired') {
          console.log(`[extend-schedules] Schedule ${schedule.id} customer expired, skipping`)
          continue
        }

        // Horisonten ur avtalet, annars kundraden (med arv från huvudkontoret)
        const horizonContract = await horizonContractFor(contract, customer)
        const horizon = horizonContract ? scheduleHorizon(horizonContract, todayIso) : null
        if (!horizon?.planEnd) {
          console.log(`[extend-schedules] Schedule ${schedule.id}: avtalsdatum saknas, ingen horisont`)
          continue
        }
        let newEnd = new Date(horizon.planEnd)
        // Kapat slut (uppsägning, is_auto_renewing=false): inget efter sista dagen
        let hardEnd: Date | null = horizon.terminated ? newEnd : null

        // is_auto_renewing=false betyder att schemat INTE ska rulla vidare
        // förbi sitt eget avtalsslutdatum (alla scheman i produktion är true,
        // men flaggan finns i modellen och ska respekteras).
        if (schedule.is_auto_renewing === false && schedule.contract_end_date) {
          const scheduleEnd = new Date(schedule.contract_end_date)
          if (newEnd > scheduleEnd) { newEnd = scheduleEnd; hardEnd = scheduleEnd }
        }

        // Uppsagd kund: respektera effective_end_date, inte bindningstiden
        if (customer?.contract_status === 'terminated' && customer.effective_end_date) {
          // Sista giltiga dag ingår: gränsen är dagen efter
          const effectiveEnd = new Date(addDaysIso(customer.effective_end_date, 1))
          if (newEnd > effectiveEnd) { newEnd = effectiveEnd; hardEnd = effectiveEnd }
        }

        if (newEnd <= currentEnd) continue

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
          // Perioderna räknas från schemats start, inte från förlängningen
          periodAnchor: new Date(schedule.schedule_start_date),
          hardEndDate: hardEnd,
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

    console.log(`[extend-schedules] Done. Created: ${totalCreated}, Errors: ${totalErrors}, Deferred: ${deferred}`)
    return res.status(200).json({
      message: 'Extension complete',
      schedulesProcessed: schedules.length - deferred,
      schedulesDeferred: deferred,
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
// HORISONTENS AVTALSFÄLT (speglar resolveHorizonContract i recurringScheduleService)
// ============================================

async function horizonContractFor(
  contract: {
    contract_start_date?: string | null
    start_date?: string | null
    contract_end_date?: string | null
    terminated_at?: string | null
    effective_end_date?: string | null
    notice_period_months?: number | null
    contract_length?: string | null
    renewal_mode?: string | null
  } | null,
  customer: {
    contract_start_date?: string | null
    contract_end_date?: string | null
    terminated_at?: string | null
    effective_end_date?: string | null
    notice_period_months?: number | null
    contract_length?: string | null
    parent_customer_id?: string | null
  } | null
): Promise<HorizonContract | null> {
  // Avtalsraden är facit när den har datum
  if (contract && (contract.contract_start_date || contract.start_date || contract.contract_end_date)) {
    return {
      contract_start_date: contract.contract_start_date ?? contract.start_date ?? null,
      contract_end_date: contract.contract_end_date ?? null,
      terminated_at: contract.terminated_at ?? null,
      effective_end_date: contract.effective_end_date ?? null,
      notice_period_months: contract.notice_period_months ?? null,
      contract_length: contract.contract_length ?? null,
      renewal_mode: contract.renewal_mode ?? null,
    }
  }
  if (!customer) return null
  const own: HorizonContract = {
    contract_start_date: customer.contract_start_date ?? null,
    contract_end_date: customer.contract_end_date ?? null,
    terminated_at: customer.terminated_at ?? null,
    effective_end_date: customer.effective_end_date ?? null,
    notice_period_months: customer.notice_period_months ?? null,
    contract_length: customer.contract_length ?? null,
  }
  // Multisite-enheter saknar egna avtalsdatum och följer huvudkontoret
  if (customer.parent_customer_id && (!own.contract_end_date || !own.contract_start_date)) {
    const { data: parent } = await supabase
      .from('customers')
      .select('contract_end_date, contract_start_date, terminated_at, effective_end_date, notice_period_months, contract_length')
      .eq('id', customer.parent_customer_id)
      .maybeSingle()
    if (parent) {
      own.contract_end_date = own.contract_end_date ?? parent.contract_end_date ?? null
      own.contract_start_date = own.contract_start_date ?? parent.contract_start_date ?? null
      own.terminated_at = own.terminated_at ?? parent.terminated_at ?? null
      own.effective_end_date = own.effective_end_date ?? parent.effective_end_date ?? null
      own.notice_period_months = own.notice_period_months ?? parent.notice_period_months ?? null
      own.contract_length = own.contract_length ?? parent.contract_length ?? null
    }
  }
  return own
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
