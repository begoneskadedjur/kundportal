// src/utils/inspectionDateGenerator.ts
// Core algorithm for generating conflict-aware recurring inspection dates

import {
  addMonths, addWeeks, addDays, addMinutes,
  startOfMonth, endOfMonth, getDay, setHours, setMinutes,
  isWithinInterval, areIntervalsOverlapping, format, subDays
} from 'date-fns'
import type { WorkSchedule } from '../types/database'
import type {
  DateGenerationParams,
  GeneratedInspectionDate,
  RecurringFrequency,
  RecurringDayPattern,
  CustomFrequencyConfig
} from '../types/recurringSchedule'
import { isSwedishWorkday, getNextWorkday, getPreviousWorkday, getSwedishHolidayName } from './swedishHolidays'

// ============================================
// MAIN GENERATOR
// ============================================

/**
 * Generate inspection dates for a recurring schedule.
 * Handles holidays, work schedules, absences, and conflicts with existing bookings.
 */
export function generateInspectionDates(params: DateGenerationParams): GeneratedInspectionDate[] {
  const {
    frequency,
    dayPattern,
    preferredDayOfMonth,
    preferredTime,
    estimatedDurationMinutes,
    startDate,
    endDate,
    technicianWorkSchedule,
    technicianAbsences = [],
    existingBookings = [],
    customFrequencyConfig
  } = params

  const results: GeneratedInspectionDate[] = []

  // Calculate all period boundaries
  const periods = calculatePeriods(frequency, startDate, endDate, customFrequencyConfig)

  // Determine how many visits per period
  const visitsPerPeriod = frequency === 'twice_monthly' ? 2
    : (frequency === 'custom' && customFrequencyConfig?.visits_per_period)
      ? customFrequencyConfig.visits_per_period
      : 1

  for (const period of periods) {
    // Season filter: skip periods outside active months (custom frequency only)
    if (frequency === 'custom' && customFrequencyConfig?.active_months_start != null && customFrequencyConfig?.active_months_end != null) {
      const periodMonth = period.start.getMonth() + 1 // 1-12
      const mStart = customFrequencyConfig.active_months_start
      const mEnd = customFrequencyConfig.active_months_end

      let inSeason: boolean
      if (mStart <= mEnd) {
        // Normal range, e.g. mars(3)–november(11)
        inSeason = periodMonth >= mStart && periodMonth <= mEnd
      } else {
        // Wrap-around range, e.g. november(11)–februari(2)
        inSeason = periodMonth >= mStart || periodMonth <= mEnd
      }
      if (!inSeason) continue
    }

    if (visitsPerPeriod > 1) {
      // Multi-visit: split the period into equal segments
      const totalDays = Math.max(1, Math.round(
        (period.end.getTime() - period.start.getTime()) / 86400000
      ))
      const segmentDays = Math.floor(totalDays / visitsPerPeriod)

      for (let v = 0; v < visitsPerPeriod; v++) {
        const segStart = addDays(period.start, v * segmentDays)
        const segEnd = v < visitsPerPeriod - 1
          ? subDays(addDays(period.start, (v + 1) * segmentDays), 1)
          : period.end

        const date = findBestDate(dayPattern, preferredDayOfMonth, preferredTime,
          estimatedDurationMinutes, { start: segStart, end: segEnd }, period, technicianWorkSchedule,
          technicianAbsences, [...existingBookings, ...results.map(r => ({ start: r.date, end: r.endDate }))])
        if (date) results.push(date)
      }
    } else {
      const date = findBestDate(dayPattern, preferredDayOfMonth, preferredTime,
        estimatedDurationMinutes, period, period, technicianWorkSchedule,
        technicianAbsences, [...existingBookings, ...results.map(r => ({ start: r.date, end: r.endDate }))])
      if (date) results.push(date)
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ============================================
// PERIOD CALCULATION
// ============================================

interface Period {
  start: Date
  end: Date
}

function calculatePeriods(
  frequency: RecurringFrequency,
  startDate: Date,
  endDate: Date,
  customFrequencyConfig?: CustomFrequencyConfig
): Period[] {
  const periods: Period[] = []
  let current = new Date(startDate)

  while (current < endDate) {
    let periodEnd: Date

    switch (frequency) {
      case 'weekly':
        periodEnd = addWeeks(current, 1)
        break
      case 'bi_weekly':
        periodEnd = addWeeks(current, 2)
        break
      case 'monthly':
      case 'twice_monthly':
        periodEnd = addMonths(current, 1)
        break
      case 'quarterly':
        periodEnd = addMonths(current, 3)
        break
      case 'semi_annual':
        periodEnd = addMonths(current, 6)
        break
      case 'annual':
        periodEnd = addMonths(current, 12)
        break
      case 'custom': {
        const periodType = customFrequencyConfig?.period_type || 'month'
        switch (periodType) {
          case 'week':    periodEnd = addWeeks(current, 1); break
          case 'month':   periodEnd = addMonths(current, 1); break
          case 'quarter': periodEnd = addMonths(current, 3); break
          case 'year':    periodEnd = addMonths(current, 12); break
          default:        periodEnd = addMonths(current, 1)
        }
        break
      }
      default:
        periodEnd = addMonths(current, 1)
    }

    // Clamp to endDate
    const clampedEnd = periodEnd > endDate ? endDate : periodEnd

    periods.push({
      start: new Date(current),
      end: subDays(clampedEnd, 1) // End of period is day before next period starts
    })

    current = periodEnd
  }

  return periods
}

// ============================================
// FIND BEST DATE FOR A PERIOD
// ============================================

function findBestDate(
  dayPattern: RecurringDayPattern,
  preferredDayOfMonth: number | undefined,
  preferredTime: string,
  durationMinutes: number,
  searchWindow: Period,
  fullPeriod: Period,
  workSchedule: WorkSchedule | null | undefined,
  absences: { start_date: string; end_date: string }[],
  existingBookings: { start: Date; end: Date; title?: string }[]
): GeneratedInspectionDate | null {
  // Step 1: Find ideal date based on pattern
  const idealDate = findIdealDate(dayPattern, preferredDayOfMonth, searchWindow)
  if (!idealDate) return null

  // Step 2: Try to place at ideal date+time, adjusting for conflicts
  const result = tryPlaceInspection(
    idealDate, preferredTime, durationMinutes,
    searchWindow, fullPeriod,
    workSchedule, absences, existingBookings
  )

  return result
}

// ============================================
// IDEAL DATE FINDER (pattern-based)
// ============================================

const WEEKDAY_MAP: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5
}

function findIdealDate(
  dayPattern: RecurringDayPattern,
  preferredDayOfMonth: number | undefined,
  window: Period
): Date | null {
  const start = window.start
  const end = window.end

  if (dayPattern === 'first_weekday') {
    return getNextWorkday(start)
  }

  if (dayPattern === 'last_weekday') {
    return getPreviousWorkday(end)
  }

  if (dayPattern === 'specific_day' && preferredDayOfMonth) {
    const year = start.getFullYear()
    const month = start.getMonth()
    let targetDate = new Date(year, month, preferredDayOfMonth)
    // If before window start, try next month
    if (targetDate < start) {
      const nextMonth = addMonths(start, 1)
      targetDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), preferredDayOfMonth)
    }
    if (targetDate > end) return getNextWorkday(start)
    return isSwedishWorkday(targetDate) ? targetDate : getNextWorkday(targetDate)
  }

  // Handle first_monday .. first_friday and second_week_monday .. second_week_friday
  const isSecondWeek = dayPattern.startsWith('second_week_')
  const dayName = dayPattern.replace('first_', '').replace('second_week_', '')
  const targetDayOfWeek = WEEKDAY_MAP[dayName]

  if (targetDayOfWeek === undefined) return getNextWorkday(start)

  // Find first occurrence of target weekday from window start
  let date = new Date(start)
  for (let i = 0; i < 14; i++) {
    if (getDay(date) === targetDayOfWeek) {
      if (isSecondWeek) {
        // Advance to second week occurrence
        date = addDays(date, 7)
      }
      // If it's a holiday, advance to next occurrence of same weekday
      if (!isSwedishWorkday(date)) {
        const holidayName = getSwedishHolidayName(date)
        // Try next week same day
        const nextWeek = addDays(date, 7)
        if (nextWeek <= end && isSwedishWorkday(nextWeek)) {
          return nextWeek
        }
        // Fallback to next workday
        return getNextWorkday(addDays(date, 1))
      }
      return date <= end ? date : null
    }
    date = addDays(date, 1)
  }

  return getNextWorkday(start)
}

// ============================================
// CONFLICT-AWARE PLACEMENT
// ============================================

const DAY_NAMES: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function getDayKey(date: Date): keyof WorkSchedule {
  return DAY_NAMES[getDay(date)]
}

function tryPlaceInspection(
  idealDate: Date,
  preferredTime: string,
  durationMinutes: number,
  searchWindow: Period,
  fullPeriod: Period,
  workSchedule: WorkSchedule | null | undefined,
  absences: { start_date: string; end_date: string }[],
  existingBookings: { start: Date; end: Date; title?: string }[]
): GeneratedInspectionDate | null {
  // Try ideal date first, then scan forward within the period
  const maxDaysToTry = 14

  for (let dayOffset = 0; dayOffset < maxDaysToTry; dayOffset++) {
    const candidateDate = addDays(idealDate, dayOffset)

    // Don't go beyond the search window
    if (candidateDate > searchWindow.end) break

    // Check: is it a workday?
    if (!isSwedishWorkday(candidateDate)) continue

    // Check: is the technician working this day?
    if (workSchedule) {
      const dayKey = getDayKey(candidateDate)
      const daySchedule = workSchedule[dayKey]
      if (!daySchedule || !daySchedule.active) continue
    }

    // Check: is the technician absent?
    const isAbsent = absences.some(a => {
      const absStart = new Date(a.start_date)
      const absEnd = new Date(a.end_date)
      return candidateDate >= absStart && candidateDate <= absEnd
    })
    if (isAbsent) continue

    // Try to find a free slot on this day
    const slot = findFreeSlotOnDay(
      candidateDate, preferredTime, durationMinutes,
      workSchedule, existingBookings
    )

    if (slot) {
      const isAdjusted = dayOffset > 0 || slot.timeAdjusted
      let adjustmentReason: string | undefined

      if (dayOffset > 0) {
        const holidayName = getSwedishHolidayName(idealDate)
        if (holidayName) {
          adjustmentReason = `Röd dag: ${holidayName} (${format(idealDate, 'yyyy-MM-dd')})`
        } else {
          adjustmentReason = `Flyttad från ${format(idealDate, 'yyyy-MM-dd')} (${slot.conflictReason || 'upptagen dag'})`
        }
      } else if (slot.timeAdjusted) {
        adjustmentReason = slot.conflictReason
      }

      return {
        date: slot.start,
        endDate: slot.end,
        periodStart: fullPeriod.start,
        periodEnd: fullPeriod.end,
        isAdjusted,
        adjustmentReason,
        hasConflictWarning: false
      }
    }
  }

  // If we couldn't find any slot in the period, force place with warning
  const forcedDate = setTimeOnDate(idealDate, preferredTime)
  return {
    date: forcedDate,
    endDate: addMinutes(forcedDate, durationMinutes),
    periodStart: fullPeriod.start,
    periodEnd: fullPeriod.end,
    isAdjusted: true,
    adjustmentReason: 'Ingen ledig tid hittades i perioden — manuell justering krävs',
    hasConflictWarning: true
  }
}

// ============================================
// SLOT FINDER (gap-finding on a specific day)
// ============================================

interface FoundSlot {
  start: Date
  end: Date
  timeAdjusted: boolean
  conflictReason?: string
}

function findFreeSlotOnDay(
  date: Date,
  preferredTime: string,
  durationMinutes: number,
  workSchedule: WorkSchedule | null | undefined,
  existingBookings: { start: Date; end: Date; title?: string }[]
): FoundSlot | null {
  // Determine work hours for this day
  let workStart: Date
  let workEnd: Date

  if (workSchedule) {
    const dayKey = getDayKey(date)
    const daySchedule = workSchedule[dayKey]
    if (!daySchedule || !daySchedule.active) return null

    const [startH, startM] = daySchedule.start.split(':').map(Number)
    const [endH, endM] = daySchedule.end.split(':').map(Number)
    workStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startH, startM)
    workEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endH, endM)
  } else {
    // Default work hours 07:00 - 17:00
    workStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0)
    workEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0)
  }

  // Get preferred start time
  const preferredStart = setTimeOnDate(date, preferredTime)
  const preferredEnd = addMinutes(preferredStart, durationMinutes)

  // Constrain to work hours
  const constrainedStart = preferredStart < workStart ? workStart : preferredStart

  // Get all bookings on this day, sorted by start time
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0)
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

  const dayBookings = existingBookings
    .filter(b => {
      return areIntervalsOverlapping(
        { start: b.start, end: b.end },
        { start: dayStart, end: dayEnd }
      )
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  // Try preferred time first
  if (constrainedStart >= workStart && preferredEnd <= workEnd) {
    const hasConflict = dayBookings.some(b =>
      areIntervalsOverlapping(
        { start: constrainedStart, end: preferredEnd },
        { start: b.start, end: b.end }
      )
    )
    if (!hasConflict) {
      return { start: constrainedStart, end: preferredEnd, timeAdjusted: false }
    }
  }

  // Preferred time has conflict - scan for gaps
  // Build list of occupied intervals (work boundary + bookings)
  const occupiedSlots = dayBookings.map(b => ({
    start: b.start < workStart ? workStart : b.start,
    end: b.end > workEnd ? workEnd : b.end,
    title: b.title
  }))

  // Find gaps between occupied slots
  let gapStart = workStart
  let conflictingTitle: string | undefined

  for (const slot of occupiedSlots) {
    const gapEnd = slot.start
    if (gapEnd > gapStart) {
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / 60000
      if (gapDuration >= durationMinutes) {
        // Found a gap! Use the earliest possible start in this gap
        const slotStart = gapStart < constrainedStart && addMinutes(constrainedStart, durationMinutes) <= gapEnd
          ? constrainedStart
          : gapStart
        const slotEnd = addMinutes(slotStart, durationMinutes)

        if (slotEnd <= gapEnd && slotEnd <= workEnd) {
          const conflictBooking = dayBookings.find(b =>
            areIntervalsOverlapping(
              { start: preferredStart, end: preferredEnd },
              { start: b.start, end: b.end }
            )
          )
          conflictingTitle = conflictBooking?.title

          return {
            start: slotStart,
            end: slotEnd,
            timeAdjusted: true,
            conflictReason: conflictingTitle
              ? `Flyttad från ${preferredTime} pga krock med '${conflictingTitle}' kl ${format(conflictBooking!.start, 'HH:mm')}-${format(conflictBooking!.end, 'HH:mm')}`
              : `Flyttad från ${preferredTime} pga schemakonflikt`
          }
        }
      }
    }
    gapStart = slot.end > gapStart ? slot.end : gapStart
  }

  // Check gap after last booking
  if (gapStart < workEnd) {
    const remainingMinutes = (workEnd.getTime() - gapStart.getTime()) / 60000
    if (remainingMinutes >= durationMinutes) {
      const slotStart = gapStart
      const slotEnd = addMinutes(slotStart, durationMinutes)

      const conflictBooking = dayBookings.find(b =>
        areIntervalsOverlapping(
          { start: preferredStart, end: preferredEnd },
          { start: b.start, end: b.end }
        )
      )

      return {
        start: slotStart,
        end: slotEnd,
        timeAdjusted: true,
        conflictReason: conflictBooking?.title
          ? `Flyttad från ${preferredTime} pga krock med '${conflictBooking.title}' kl ${format(conflictBooking.start, 'HH:mm')}-${format(conflictBooking.end, 'HH:mm')}`
          : `Flyttad från ${preferredTime} pga schemakonflikt`
      }
    }
  }

  // No gap found on this day
  return null
}

// ============================================
// HELPERS
// ============================================

function setTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
  return result
}
