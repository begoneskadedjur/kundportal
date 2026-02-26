// src/utils/swedishHolidays.ts
// Swedish public holidays (roda dagar) calculator
// Covers all fixed, Easter-dependent, and variable holidays

import { getDay, isWeekend, addDays, subDays, format } from 'date-fns'

// Cache: year -> set of "YYYY-MM-DD" strings
const holidayCache = new Map<number, Set<string>>()

/**
 * Compute Easter Sunday for a given year using the Anonymous Gregorian algorithm (Meeus).
 */
export function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/**
 * Get all Swedish public holidays for a given year.
 */
export function getSwedishHolidays(year: number): Date[] {
  const holidays: Date[] = []

  // Fixed holidays
  holidays.push(new Date(year, 0, 1))   // Nyarsdagen
  holidays.push(new Date(year, 0, 6))   // Trettondedag jul
  holidays.push(new Date(year, 4, 1))   // Forsta maj
  holidays.push(new Date(year, 5, 6))   // Nationaldagen
  holidays.push(new Date(year, 11, 24)) // Julafton
  holidays.push(new Date(year, 11, 25)) // Juldagen
  holidays.push(new Date(year, 11, 26)) // Annandag jul
  holidays.push(new Date(year, 11, 31)) // Nyarsafton

  // Easter-dependent holidays
  const easter = getEasterSunday(year)
  holidays.push(addDays(easter, -2))  // Langfredagen
  holidays.push(easter)                // Paskdagen
  holidays.push(addDays(easter, 1))   // Annandag pask
  holidays.push(addDays(easter, 39))  // Kristi himmelsfardsdag
  holidays.push(addDays(easter, 49))  // Pingstdagen

  // Midsommarafton: Friday between June 19-25
  for (let d = 19; d <= 25; d++) {
    const date = new Date(year, 5, d) // June
    if (getDay(date) === 5) { // Friday
      holidays.push(date) // Midsommarafton
      holidays.push(addDays(date, 1)) // Midsommardagen (Saturday)
      break
    }
  }

  // Alla helgons dag: Saturday between Oct 31 - Nov 6
  for (let d = 31; d <= 37; d++) {
    // d=31 is Oct 31, d=32 is Nov 1, etc.
    const month = d <= 31 ? 9 : 10 // October or November
    const day = d <= 31 ? d : d - 31
    const date = new Date(year, month, day)
    if (getDay(date) === 6) { // Saturday
      holidays.push(date)
      break
    }
  }

  return holidays
}

/**
 * Get the set of holiday date strings for a year (cached).
 */
function getHolidaySet(year: number): Set<string> {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!
  }
  const holidays = getSwedishHolidays(year)
  const set = new Set<string>(holidays.map(d => format(d, 'yyyy-MM-dd')))
  holidayCache.set(year, set)
  return set
}

/**
 * Check if a date is a Swedish public holiday.
 */
export function isSwedishHoliday(date: Date): boolean {
  const year = date.getFullYear()
  const set = getHolidaySet(year)
  return set.has(format(date, 'yyyy-MM-dd'))
}

/**
 * Check if a date is a Swedish workday (not weekend, not holiday).
 */
export function isSwedishWorkday(date: Date): boolean {
  return !isWeekend(date) && !isSwedishHoliday(date)
}

/**
 * Get the next Swedish workday from a given date (inclusive).
 * If the given date is already a workday, returns it.
 */
export function getNextWorkday(date: Date): Date {
  let current = new Date(date)
  // Safety limit to avoid infinite loop
  for (let i = 0; i < 30; i++) {
    if (isSwedishWorkday(current)) {
      return current
    }
    current = addDays(current, 1)
  }
  return current
}

/**
 * Get the previous Swedish workday from a given date (inclusive).
 * If the given date is already a workday, returns it.
 */
export function getPreviousWorkday(date: Date): Date {
  let current = new Date(date)
  for (let i = 0; i < 30; i++) {
    if (isSwedishWorkday(current)) {
      return current
    }
    current = subDays(current, 1)
  }
  return current
}

/**
 * Get the name of a Swedish holiday (for display in adjustment reasons).
 */
export function getSwedishHolidayName(date: Date): string | null {
  if (!isSwedishHoliday(date)) return null

  const year = date.getFullYear()
  const dateStr = format(date, 'yyyy-MM-dd')
  const easter = getEasterSunday(year)

  // Check fixed holidays
  const month = date.getMonth()
  const day = date.getDate()

  if (month === 0 && day === 1) return 'Nyarsdagen'
  if (month === 0 && day === 6) return 'Trettondedag jul'
  if (month === 4 && day === 1) return 'Forsta maj'
  if (month === 5 && day === 6) return 'Nationaldagen'
  if (month === 11 && day === 24) return 'Julafton'
  if (month === 11 && day === 25) return 'Juldagen'
  if (month === 11 && day === 26) return 'Annandag jul'
  if (month === 11 && day === 31) return 'Nyarsafton'

  // Check Easter-dependent
  const easterStr = format(easter, 'yyyy-MM-dd')
  if (dateStr === format(addDays(easter, -2), 'yyyy-MM-dd')) return 'Langfredagen'
  if (dateStr === easterStr) return 'Paskdagen'
  if (dateStr === format(addDays(easter, 1), 'yyyy-MM-dd')) return 'Annandag pask'
  if (dateStr === format(addDays(easter, 39), 'yyyy-MM-dd')) return 'Kristi himmelsfardsdag'
  if (dateStr === format(addDays(easter, 49), 'yyyy-MM-dd')) return 'Pingstdagen'

  // Midsommar
  for (let d = 19; d <= 25; d++) {
    const midsommarEve = new Date(year, 5, d)
    if (getDay(midsommarEve) === 5) {
      if (dateStr === format(midsommarEve, 'yyyy-MM-dd')) return 'Midsommarafton'
      if (dateStr === format(addDays(midsommarEve, 1), 'yyyy-MM-dd')) return 'Midsommardagen'
      break
    }
  }

  // Alla helgons dag
  for (let d = 31; d <= 37; d++) {
    const m = d <= 31 ? 9 : 10
    const dd = d <= 31 ? d : d - 31
    const ahd = new Date(year, m, dd)
    if (getDay(ahd) === 6) {
      if (dateStr === format(ahd, 'yyyy-MM-dd')) return 'Alla helgons dag'
      break
    }
  }

  return 'Rod dag'
}
