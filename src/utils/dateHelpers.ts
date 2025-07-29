// src/utils/dateHelpers.ts
// Hjälpfunktioner för att hantera datum korrekt i svensk tidszon

import { format, parseISO } from 'date-fns'
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'

const SWEDEN_TIMEZONE = 'Europe/Stockholm'

/**
 * Konvertera ett JavaScript Date-objekt till ISO-sträng med svensk tidszon
 * Detta behövs eftersom toISOString() alltid ger UTC-tid
 */
export function toSwedishISOString(date: Date): string {
  // Konvertera till svensk tid och formatera som ISO-sträng utan timezone suffix
  const swedishDate = utcToZonedTime(date, SWEDEN_TIMEZONE)
  return format(swedishDate, "yyyy-MM-dd'T'HH:mm:ss")
}

/**
 * Konvertera från databas ISO-sträng till Date-objekt
 * Hanterar både UTC och lokal tid korrekt
 */
export function fromDatabaseDate(isoString: string | null): Date | null {
  if (!isoString) return null
  
  // Om strängen innehåller timezone info (Z eller +/-), parse direkt
  if (isoString.includes('Z') || isoString.includes('+') || isoString.includes('-')) {
    return parseISO(isoString)
  }
  
  // Annars, tolka som svensk lokal tid
  return zonedTimeToUtc(parseISO(isoString), SWEDEN_TIMEZONE)
}

/**
 * Formatera datum för visning
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Få klockslag från Date-objekt
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit'
  })
}