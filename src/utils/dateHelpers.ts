// src/utils/dateHelpers.ts
// Hjälpfunktioner för att hantera datum korrekt i svensk tidszon

import { format, parseISO } from 'date-fns'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

const SWEDEN_TIMEZONE = 'Europe/Stockholm'

/**
 * Konvertera ett JavaScript Date-objekt till ISO-sträng med svensk tidszon
 * Detta behövs eftersom toISOString() alltid ger UTC-tid
 */
export function toSwedishISOString(date: Date): string {
  // Formatera i svensk tidszon utan timezone suffix (samma som API:erna)
  return formatInTimeZone(date, SWEDEN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss")
}

/**
 * Konvertera ett Date-objekt till en ISO-sträng med EXPLICIT tidszon-offset,
 * t.ex. "2026-06-11T09:22:53+02:00".
 *
 * Detta är mönstret som koordinatorschemat använder (CreateCaseModal) och det
 * enda korrekta sättet att spara "den tid som visades för användaren" till en
 * timestamptz-kolumn: databasen körs i UTC, så en sträng UTAN offset tolkas som
 * UTC (fel), medan en sträng MED offset lagras entydigt rätt oavsett serverns tz.
 *
 * Använd detta i stället för `new Date().toISOString()` när tidpunkten motsvarar
 * något som hände i användarens lokala (svenska) tid.
 */
export function toLocalISOStringWithOffset(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  // getTimezoneOffset() är minuter EFTER UTC negerat (UTC+2 ger -120)
  const tzOffset = date.getTimezoneOffset()
  const offsetSign = tzOffset <= 0 ? '+' : '-'
  const offsetHours = pad(Math.floor(Math.abs(tzOffset) / 60))
  const offsetMinutes = pad(Math.abs(tzOffset) % 60)

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`
}

/**
 * Konvertera från databas ISO-sträng till Date-objekt
 * Hanterar både UTC och lokal tid korrekt
 */
export function fromDatabaseDate(isoString: string | null): Date | null {
  if (!isoString) return null
  
  // Om strängen innehåller timezone info (Z eller +/-), parse direkt
  if (isoString.includes('Z') || /[+-]\d{2}:\d{2}$/.test(isoString)) {
    return parseISO(isoString)
  }
  
  // Annars, tolka som svensk lokal tid och konvertera till UTC
  return fromZonedTime(parseISO(isoString), SWEDEN_TIMEZONE)
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