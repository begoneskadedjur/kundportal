// src/utils/egenkontrollMonth.ts
// Månadsnycklar ('YYYY-MM') för egenkontrollvyn, alltid i svensk tid.

import { formatInTimeZone } from 'date-fns-tz'

const SWEDEN_TIMEZONE = 'Europe/Stockholm'

/** Månadsnyckel 'YYYY-MM' för en tidpunkt, räknat i svensk tid. */
export function swedishMonthKey(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (isNaN(date.getTime())) return typeof input === 'string' ? input.slice(0, 7) : ''
  return formatInTimeZone(date, SWEDEN_TIMEZONE, 'yyyy-MM')
}

/**
 * Standardmånad för vyn:
 * 1. innevarande månad (svensk tid) om den har data,
 * 2. annars senaste månaden med data som inte ligger i framtiden,
 * 3. annars innevarande månad.
 * Returnerar aldrig tom sträng, så vyn kan inte visa ett påhittat datum.
 */
export function pickDefaultMonthKey(monthKeys: string[], now: Date = new Date()): string {
  const current = swedishMonthKey(now)
  if (monthKeys.includes(current)) return current
  const past = monthKeys.filter(mk => mk < current).sort((a, b) => b.localeCompare(a))
  return past[0] ?? current
}
