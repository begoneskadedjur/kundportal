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
// CONFIG MAPS
// ============================================

export const FREQUENCY_CONFIG: Record<RecurringFrequency, {
  label: string
  monthInterval: number
  description: string
}> = {
  weekly:      { label: 'Varje vecka',              monthInterval: 0.25, description: '4 besok per manad' },
  bi_weekly:   { label: 'Varannan vecka',           monthInterval: 0.5,  description: '2 besok per manad' },
  monthly:     { label: 'Manadsvis',                monthInterval: 1,    description: '1 besok per manad' },
  twice_monthly: { label: '2 ganger/manad',         monthInterval: 1,    description: '2 besok per manad, fordelat' },
  quarterly:   { label: 'Kvartalsvis',              monthInterval: 3,    description: 'Var 3:e manad' },
  semi_annual: { label: 'Halvarsvis',               monthInterval: 6,    description: 'Var 6:e manad' },
  annual:      { label: 'Arsvis',                   monthInterval: 12,   description: '1 besok per ar' },
}

export const DAY_PATTERN_CONFIG: Record<RecurringDayPattern, {
  label: string
  description: string
  group: 'recommended' | 'first_week' | 'second_week' | 'other'
}> = {
  first_weekday:         { label: 'Forsta helgfria vardagen',  description: 'Forsta vardagen efter periodstart som inte ar rod dag', group: 'recommended' },
  first_monday:          { label: 'Forsta mandagen',           description: 'Forsta mandagen i varje period', group: 'recommended' },
  first_tuesday:         { label: 'Forsta tisdagen',           description: 'Forsta tisdagen i varje period', group: 'first_week' },
  first_wednesday:       { label: 'Forsta onsdagen',           description: 'Forsta onsdagen i varje period', group: 'first_week' },
  first_thursday:        { label: 'Forsta torsdagen',          description: 'Forsta torsdagen i varje period', group: 'first_week' },
  first_friday:          { label: 'Forsta fredagen',           description: 'Forsta fredagen i varje period', group: 'first_week' },
  second_week_monday:    { label: 'Andra veckans mandag',      description: 'Mandagen i periodens andra vecka', group: 'second_week' },
  second_week_tuesday:   { label: 'Andra veckans tisdag',      description: 'Tisdagen i periodens andra vecka', group: 'second_week' },
  second_week_wednesday: { label: 'Andra veckans onsdag',      description: 'Onsdagen i periodens andra vecka', group: 'second_week' },
  second_week_thursday:  { label: 'Andra veckans torsdag',     description: 'Torsdagen i periodens andra vecka', group: 'second_week' },
  second_week_friday:    { label: 'Andra veckans fredag',      description: 'Fredagen i periodens andra vecka', group: 'second_week' },
  last_weekday:          { label: 'Sista helgfria vardagen',   description: 'Sista vardagen i varje period som inte ar rod dag', group: 'other' },
  specific_day:          { label: 'Specifik dag i manaden',    description: 'Valj vilken dag (1-28) i manaden', group: 'other' },
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

// ============================================
// DATABASE TYPES
// ============================================

export interface RecurringSchedule {
  id: string
  customer_id: string
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
  is_auto_renewing?: boolean
  notes?: string
  created_by?: string
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
