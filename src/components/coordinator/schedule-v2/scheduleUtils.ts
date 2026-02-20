// scheduleUtils.ts — Positionsberäkning och formatering för schemagrid

import { HOUR_WIDTH, DAY_START_HOUR, GRID_WIDTH } from './scheduleConstants'

/** Tid → horisontell pixel-offset relativt gridens vänsterkant */
export function timeToX(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60
  return (hours - DAY_START_HOUR) * HOUR_WIDTH
}

/** Tidsspann → pixel-bredd */
export function durationToWidth(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return (ms / 3_600_000) * HOUR_WIDTH
}

/** Clamp event inom synligt gridområde */
export function clampToGrid(x: number, width: number): { x: number; width: number } {
  let cx = x
  let cw = width
  if (cx < 0) { cw += cx; cx = 0 }
  if (cx + cw > GRID_WIDTH) cw = GRID_WIDTH - cx
  return { x: cx, width: Math.max(cw, 0) }
}

/** Formatera timme:minut som "HH:mm" */
export function formatTime(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

/** Formatera adress från JSON/string till läsbar sträng */
export function formatAddress(address: unknown): string {
  if (!address) return ''
  if (typeof address === 'string') {
    try { return JSON.parse(address).formatted_address || address } catch { return address }
  }
  if (typeof address === 'object' && address !== null) {
    const a = address as Record<string, unknown>
    if (a.formatted_address) return String(a.formatted_address)
    if (a.street && a.city) return `${a.street}, ${a.postal_code || ''} ${a.city}`.trim()
  }
  return ''
}

/** Kort adress — bara gata + postnummer */
export function shortAddress(address: unknown): string {
  const full = formatAddress(address)
  if (!full) return ''
  // Ta bara gatuadress (före kommat) eller de första 30 tecknen
  const parts = full.split(',')
  return parts[0].trim().slice(0, 30)
}

/** Beräkna kapacitet i timmar baserat på work_schedule */
export function getTechWorkHours(
  workSchedule: Record<string, { start: string; end: string; active: boolean }> | null,
  date: Date
): number {
  if (!workSchedule) return 8 // fallback
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayKey = days[date.getDay()]
  const day = workSchedule[dayKey]
  if (!day?.active) return 0
  const [sh, sm] = day.start.split(':').map(Number)
  const [eh, em] = day.end.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

/** Veckonummer (ISO 8601) */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** Startdag (måndag) för en vecka som innehåller givet datum */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() || 7 // söndag = 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Array av 7 datum (mån-sön) från ett startdatum */
export function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}
