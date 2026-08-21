// src/utils/caseCategory.ts
//
// Delar upp ärenden i de grupper verksamheten faktiskt arbetar i. Predikaten
// är verifierade mot produktionsdata — ingen heuristik, ingen gissning.
//
// Kopplingen är 1:1 och total: varje station_inspection_sessions-rad pekar via
// case_id på ett ärende med service_type='inspection', och varje sådant ärende
// har en session.
//
// OBS: case_billing_items.item_type ('service'/'article') säger INGET om
// kategori — den skiljer tjänsterad från artikelrad på fakturan.

import type { RecordCase } from '../hooks/useCustomerRecord'

export type CaseCategory = 'recurring' | 'establishment' | 'extra'

/** Ärendetyper som utförs enligt ett löpande schema. */
const RECURRING_TYPES = new Set([
  'inspection', // stationskontroll — har alltid en inspektionssession
  'rondering_trafikkontoret',
  'egenkontroll_trafikkontoret',
])

/**
 * Vilken grupp ärendet hör till.
 *
 * 'establishment' är avtalets ETABLERING — utplacering av stationer vid
 * avtalsstart. Den är varken återkommande eller merförsäljning, och får därför
 * en egen grupp: slås den ihop med extraärenden läser en nytecknad kunds enda
 * ärende felaktigt som merförsäljning.
 */
export function caseCategory(c: Pick<RecordCase, 'service_type'>): CaseCategory {
  const t = c.service_type ?? ''
  if (RECURRING_TYPES.has(t)) return 'recurring'
  if (t === 'establishment') return 'establishment'
  // 'routine', företagsärenden och allt okänt = arbete utanför avtalet
  return 'extra'
}

export const CATEGORY_LABEL: Record<CaseCategory, string> = {
  recurring: 'Återkommande & kontroll',
  establishment: 'Etablering',
  extra: 'Extraärenden',
}

/**
 * Hur sent ett planerat besök är. Graderat, inte binärt: två dagar sent är
 * inte samma sak som åttio.
 */
export type Lateness = 'ontime' | 'due' | 'late' | 'missed'

export function sessionLateness(scheduledAt: string | null, status: string): Lateness {
  if (!scheduledAt) return 'ontime'
  if (status !== 'scheduled') return 'ontime'
  const days = Math.floor((Date.now() - Date.parse(scheduledAt)) / 86_400_000)
  if (days <= 0) return 'ontime'
  if (days <= 7) return 'due'
  if (days <= 30) return 'late'
  return 'missed'
}

export const LATENESS_STYLE: Record<Lateness, { text: string; dot: string; label: string }> = {
  ontime: { text: 'text-slate-300', dot: 'border border-slate-600', label: 'Bokat' },
  due: { text: 'text-amber-300', dot: 'bg-amber-400', label: 'Skulle utförts' },
  late: { text: 'text-orange-300', dot: 'bg-orange-400', label: 'Försenat' },
  missed: { text: 'text-red-300', dot: 'bg-red-400', label: 'Missat' },
}

/** Dagar sedan ett datum passerade; negativt tal = i framtiden. */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
}

/**
 * Förväntat antal besök hittills i år, proratat mot hur länge schemat löpt.
 * Utan proratering ser varje kund som startat mitt i året ut att ligga efter.
 */
export function expectedVisitsToDate(
  visitsPerYear: number | null,
  scheduleStart: string | null
): number | null {
  if (!visitsPerYear) return null
  if (!scheduleStart) return visitsPerYear
  const start = Date.parse(scheduleStart)
  if (Number.isNaN(start)) return visitsPerYear
  const monthsRunning = Math.min(
    12,
    Math.max(0, (Date.now() - start) / (30.44 * 86_400_000))
  )
  return Math.floor((visitsPerYear * monthsRunning) / 12)
}
