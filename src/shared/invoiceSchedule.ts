// src/shared/invoiceSchedule.ts
// Faktureringsschemat i /admin/fakturering (3.121.0): när en ej skickad
// avtalsfaktura ska skickas, när perioden börjar, när den förfaller om den
// skickas idag och vilket läge den står i. Ren modul utan DB-anrop, delas av
// fliken Avtalskunder och fakturamodalen.
//
// Skickdatum = fakturans created_at som svensk dag. Planeraren sätter det till
// periodstart minus 40 dagar för års-, halvårs- och kvartalsfakturor och till
// periodstart för månadsfakturor (contractPlanner, 3.120.0). Fortnox får
// alltid dagens datum som fakturadatum när fakturan skickas, och förfallodagen
// blir idag plus betalningsvillkoret (PaymentTermsService, kategori contract).

export type ScheduleStatus = 'started' | 'late' | 'this_week' | 'upcoming'

export interface ScheduleInput {
  created_at: string
  billing_period_start: string | null
}

export interface InvoiceSchedule {
  /** Dagen fakturan ska skickas (svensk dag, ÅÅÅÅ-MM-DD) */
  sendDate: string
  /** Periodens första dag, null om fakturan saknar period */
  periodStart: string | null
  /** Förfallodag om fakturan skickas idag */
  dueIfSentToday: string
  status: ScheduleStatus
  /** Dagar sedan skickdatum (late), sedan periodstart (started) eller kvar till skickdatum */
  days: number
  /** Förfallodagen (om skickad idag) ligger efter periodstart */
  paysAfterPeriodStart: boolean
  /** Antal dagar förfallodagen ligger efter periodstart (0 om före) */
  dueAfterStartDays: number
}

/** Fakturor som ska skickas inom så många dagar räknas till "Skicka denna vecka". */
export const THIS_WEEK_DAYS = 7

const DAY_MS = 86_400_000

/** Svensk kalenderdag för en tidsstämpel eller ett datum (aldrig rå toISOString). */
export function swedishDay(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = typeof value === 'string' ? new Date(value) : value
  // en-CA ger ÅÅÅÅ-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

/** ÅÅÅÅ-MM-DD plus n dagar. */
export function addDaysIso(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Antal dagar från a till b (b minus a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS)
}

export function invoiceSchedule(inv: ScheduleInput, todayIso: string, termsDays: number): InvoiceSchedule {
  const sendDate = swedishDay(inv.created_at)
  const periodStart = inv.billing_period_start ? inv.billing_period_start.slice(0, 10) : null
  const dueIfSentToday = addDaysIso(todayIso, termsDays)
  const dueAfterStartDays = periodStart ? Math.max(0, daysBetween(periodStart, dueIfSentToday)) : 0

  let status: ScheduleStatus
  let days: number
  if (periodStart && periodStart <= todayIso) {
    status = 'started'
    days = daysBetween(periodStart, todayIso)
  } else if (sendDate < todayIso) {
    status = 'late'
    days = daysBetween(sendDate, todayIso)
  } else {
    days = daysBetween(todayIso, sendDate)
    status = days <= THIS_WEEK_DAYS ? 'this_week' : 'upcoming'
  }

  return {
    sendDate,
    periodStart,
    dueIfSentToday,
    status,
    days,
    paysAfterPeriodStart: dueAfterStartDays > 0,
    dueAfterStartDays,
  }
}

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** "1 nov" */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[(m ?? 1) - 1]}`
}

const dagar = (n: number) => `${n} ${n === 1 ? 'dag' : 'dagar'}`

/** Statustexten på raden. */
export function scheduleStatusText(s: InvoiceSchedule): string {
  switch (s.status) {
    case 'started':
      return s.periodStart ? `Perioden började ${shortDay(s.periodStart)}` : 'Perioden har börjat'
    case 'late':
      return `Försenad ${dagar(s.days)}`
    case 'this_week':
    case 'upcoming':
      return s.days === 0 ? 'Skicka idag' : `Om ${dagar(s.days)}`
  }
}

/** Texten under "Förfaller om skickad idag". */
export function dueNoteText(s: InvoiceSchedule): string {
  if (!s.periodStart) return ''
  if (!s.paysAfterPeriodStart) return 'Före periodstart'
  return 'Betalas efter periodstart'
}

/**
 * Frekvens ur periodens längd, för fakturor utan avtal (samlingsfakturor)
 * eller avtal som saknar frekvens.
 */
export function frequencyFromPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const len = daysBetween(start.slice(0, 10), end.slice(0, 10)) + 1
  if (len <= 31) return 'monthly'
  if (len <= 92) return 'quarterly'
  if (len <= 184) return 'semi_annual'
  return 'annual'
}

export const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'Månadsvis',
  quarterly: 'Kvartalsvis',
  semi_annual: 'Halvårsvis',
  annual: 'Årsvis',
}
