// src/types/recurringSchedule.ts
// Types for recurring inspection schedule configuration

import type { WorkSchedule } from './database'

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type RecurringFrequency =
  | 'weekly'
  | 'bi_weekly'
  | 'monthly'
  | 'twice_monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom'

export type RecurringDayPattern =
  | 'first_weekday'
  | 'first_monday'
  | 'first_tuesday'
  | 'first_wednesday'
  | 'first_thursday'
  | 'first_friday'
  | 'second_week_monday'
  | 'second_week_tuesday'
  | 'second_week_wednesday'
  | 'second_week_thursday'
  | 'second_week_friday'
  | 'last_weekday'
  | 'specific_day'

export type RecurringScheduleStatus = 'active' | 'paused' | 'cancelled'

// ============================================
// CUSTOM FREQUENCY
// ============================================

export interface CustomFrequencyConfig {
  visits_per_period: number
  period_type: 'week' | 'month' | 'quarter' | 'year'
  active_months_start?: number  // 1-12
  active_months_end?: number    // 1-12
}

// ============================================
// CONFIG MAPS
// ============================================

export const FREQUENCY_CONFIG: Record<RecurringFrequency, {
  label: string
  monthInterval: number
  description: string
}> = {
  weekly:        { label: 'Varje vecka',        monthInterval: 0.25, description: '4 besök per månad' },
  bi_weekly:     { label: 'Varannan vecka',     monthInterval: 0.5,  description: '2 besök per månad' },
  monthly:       { label: 'Månadsvis',          monthInterval: 1,    description: '1 besök per månad' },
  twice_monthly: { label: '2 gånger/månad',     monthInterval: 1,    description: '2 besök per månad, fördelat' },
  quarterly:     { label: 'Kvartalsvis',        monthInterval: 3,    description: 'Var 3:e månad' },
  semi_annual:   { label: 'Halvårsvis',         monthInterval: 6,    description: 'Var 6:e månad' },
  annual:        { label: 'Årsvis',             monthInterval: 12,   description: '1 besök per år' },
  custom:        { label: 'Anpassat intervall', monthInterval: 1,    description: 'Ange eget schema' },
}

export const STANDARD_FREQUENCIES: RecurringFrequency[] = [
  'weekly', 'bi_weekly', 'monthly', 'twice_monthly', 'quarterly', 'semi_annual', 'annual'
]

export const DAY_PATTERN_CONFIG: Record<RecurringDayPattern, {
  label: string
  description: string
  group: 'recommended' | 'first_week' | 'second_week' | 'other'
}> = {
  first_weekday:         { label: 'Första helgfria vardagen',  description: 'Första vardagen efter periodstart som inte är röd dag', group: 'recommended' },
  first_monday:          { label: 'Första måndagen',           description: 'Första måndagen i varje period', group: 'recommended' },
  first_tuesday:         { label: 'Första tisdagen',           description: 'Första tisdagen i varje period', group: 'first_week' },
  first_wednesday:       { label: 'Första onsdagen',           description: 'Första onsdagen i varje period', group: 'first_week' },
  first_thursday:        { label: 'Första torsdagen',          description: 'Första torsdagen i varje period', group: 'first_week' },
  first_friday:          { label: 'Första fredagen',           description: 'Första fredagen i varje period', group: 'first_week' },
  second_week_monday:    { label: 'Andra veckans måndag',      description: 'Måndagen i periodens andra vecka', group: 'second_week' },
  second_week_tuesday:   { label: 'Andra veckans tisdag',      description: 'Tisdagen i periodens andra vecka', group: 'second_week' },
  second_week_wednesday: { label: 'Andra veckans onsdag',      description: 'Onsdagen i periodens andra vecka', group: 'second_week' },
  second_week_thursday:  { label: 'Andra veckans torsdag',     description: 'Torsdagen i periodens andra vecka', group: 'second_week' },
  second_week_friday:    { label: 'Andra veckans fredag',      description: 'Fredagen i periodens andra vecka', group: 'second_week' },
  last_weekday:          { label: 'Sista helgfria vardagen',   description: 'Sista vardagen i varje period som inte är röd dag', group: 'other' },
  specific_day:          { label: 'Specifik dag i månaden',    description: 'Välj vilken dag (1-28) i månaden', group: 'other' },
}

// Ungefärligt antal besök per år för varje standardfrekvens. Används för att
// översätta avtalets visits_per_year till ett frekvensförval och tvärtom.
export const APPROX_VISITS_PER_YEAR: Record<Exclude<RecurringFrequency, 'custom'>, number> = {
  weekly: 52,
  bi_weekly: 26,
  twice_monthly: 24,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
}

/**
 * Härled schemafrekvens ur avtalets "N besök per år".
 * Exakt träff → standardfrekvensen. Litet udda antal (≤10, t.ex. 6/år) →
 * anpassat intervall med N besök per år (generatorn sprider dem jämnt).
 * Övrigt → närmaste standardfrekvens.
 */
export function frequencyFromVisitsPerYear(
  visitsPerYear: number
): { frequency: RecurringFrequency; customConfig?: CustomFrequencyConfig } | null {
  if (!visitsPerYear || visitsPerYear <= 0) return null
  const exact = (Object.entries(APPROX_VISITS_PER_YEAR) as [RecurringFrequency, number][])
    .find(([, n]) => n === visitsPerYear)
  if (exact) return { frequency: exact[0] }
  if (visitsPerYear <= 10) {
    return {
      frequency: 'custom',
      customConfig: { visits_per_period: visitsPerYear, period_type: 'year' },
    }
  }
  const nearest = (Object.entries(APPROX_VISITS_PER_YEAR) as [RecurringFrequency, number][])
    .sort((a, b) => Math.abs(a[1] - visitsPerYear) - Math.abs(b[1] - visitsPerYear))[0]
  return { frequency: nearest[0] }
}

/**
 * Ungefärligt antal besök per år för ett frekvensval — omvändningen av
 * frequencyFromVisitsPerYear. Används när schemat backfyller avtalets
 * besöksfrekvens. Säsongsbegränsad custom (active_months) skalas ner till
 * säsongens längd så avtalet inte får ett för högt facit.
 */
export function visitsPerYearFromSelection(
  frequency: RecurringFrequency,
  customConfig?: CustomFrequencyConfig | null
): number | null {
  if (frequency !== 'custom') return APPROX_VISITS_PER_YEAR[frequency]
  if (!customConfig) return null
  const { visits_per_period, period_type, active_months_start, active_months_end } = customConfig
  let periodsPerYear = { week: 52, month: 12, quarter: 4, year: 1 }[period_type] ?? 12
  if (
    active_months_start != null && active_months_end != null &&
    (period_type === 'week' || period_type === 'month')
  ) {
    const seasonMonths = active_months_start <= active_months_end
      ? active_months_end - active_months_start + 1
      : 12 - active_months_start + 1 + active_months_end
    periodsPerYear = period_type === 'month' ? seasonMonths : Math.round((seasonMonths * 52) / 12)
  }
  return visits_per_period * periodsPerYear
}

export const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 timme' },
  { value: 90,  label: '1,5 timmar' },
  { value: 120, label: '2 timmar' },
  { value: 180, label: '3 timmar' },
  { value: 240, label: '4 timmar' },
]

export const SWEDISH_MONTH_NAMES = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

// ============================================
// SCHEDULE INFO (for on-demand display)
// ============================================

export interface CustomerScheduleInfo {
  scheduleId: string
  customerId: string
  customerName: string
  frequency: RecurringFrequency
  status: RecurringScheduleStatus
  preferredTime: string
  dayPattern: RecurringDayPattern
  estimatedDurationMinutes: number
  remainingSessions: number
  nextSessionDate: string | null
  futureSessions: { scheduled_at: string; scheduled_end: string }[]
}

// ============================================
// BATCH SCHEDULING
// ============================================

export interface BatchScheduleUnit {
  customerId: string
  customerName: string
  address: string | null
  durationMinutes: number  // default 60, set in wizard step 2
}

// ============================================
// DATABASE TYPES
// ============================================

export interface RecurringSchedule {
  id: string
  customer_id: string
  // Multi-kontrakt-refaktor (Fas 8a): koppling till specifikt avtal. Null för
  // kunder utan riktiga contracts-rader (synth-fallback i runtime).
  contract_id: string | null
  technician_id: string
  frequency: RecurringFrequency
  day_pattern: RecurringDayPattern
  preferred_day_of_month: number | null
  preferred_time: string // "HH:MM"
  estimated_duration_minutes: number
  schedule_start_date: string
  contract_end_date: string | null
  is_auto_renewing: boolean
  generated_until: string
  last_generated_at: string | null
  status: RecurringScheduleStatus
  notes: string | null
  custom_frequency_config: CustomFrequencyConfig | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface RecurringScheduleWithRelations extends RecurringSchedule {
  customer?: {
    id: string
    company_name: string
    contact_address: string | null
    service_frequency: string | null
    contract_start_date: string | null
    contract_end_date: string | null
    contract_status?: 'signed' | 'active' | 'terminated' | 'expired'
    effective_end_date?: string | null
  }
  technician?: {
    id: string
    name: string
    work_schedule: WorkSchedule | null
  }
}

// ============================================
// INPUT TYPES
// ============================================

export interface CreateRecurringScheduleInput {
  customer_id: string
  technician_id: string
  frequency: RecurringFrequency
  day_pattern: RecurringDayPattern
  preferred_day_of_month?: number
  preferred_time: string
  estimated_duration_minutes: number
  schedule_start_date: string
  contract_end_date?: string | null
  /**
   * Avtalet schemat hör till. Anges när kunden täcks av flera gällande avtal
   * och användaren valt ett; utelämnas det slår servicen upp avtalet själv.
   */
  contract_id?: string | null
  is_auto_renewing?: boolean
  notes?: string
  created_by?: string
  custom_frequency_config?: CustomFrequencyConfig
  service_type?: string
}

export interface UpdateRecurringScheduleInput {
  frequency?: RecurringFrequency
  day_pattern?: RecurringDayPattern
  preferred_day_of_month?: number | null
  preferred_time?: string
  estimated_duration_minutes?: number
  is_auto_renewing?: boolean
  status?: RecurringScheduleStatus
  notes?: string | null
  custom_frequency_config?: CustomFrequencyConfig | null
  /** Teknikerbyte — framtida generering (klient + cron) följer nya teknikern */
  technician_id?: string
}

// ============================================
// DATE GENERATION TYPES
// ============================================

export interface DateGenerationParams {
  frequency: RecurringFrequency
  dayPattern: RecurringDayPattern
  preferredDayOfMonth?: number
  preferredTime: string              // "HH:MM"
  estimatedDurationMinutes: number
  startDate: Date
  endDate: Date
  technicianWorkSchedule?: WorkSchedule | null
  technicianAbsences?: { start_date: string; end_date: string }[]
  existingBookings?: { start: Date; end: Date; title?: string }[]
  customFrequencyConfig?: CustomFrequencyConfig
  /**
   * IANA-tidszon som klockslag ("HH:MM") ska tolkas i. Utelämnad = maskinens
   * lokala tidszon (rätt i webbläsaren). Servern (Vercel kör UTC) MÅSTE skicka
   * 'Europe/Stockholm', annars byggs tiderna 1-2 h fel.
   */
  timeZone?: string
}

export interface GeneratedInspectionDate {
  date: Date                    // Selected date+time
  endDate: Date                 // date + estimatedDuration
  periodStart: Date
  periodEnd: Date
  isAdjusted: boolean
  adjustmentReason?: string
  hasConflictWarning?: boolean  // True if no good slot found, forced placement
}
