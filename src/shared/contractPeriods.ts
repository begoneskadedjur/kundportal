// src/shared/contractPeriods.ts
// Periodregeln för avtal med exakt avtalsdag (contracts.billing_anchor_mode
// = 'start_day'), steg 6 i docs/planer/avtalsar-exakt-arsdag-teknik.md.
//
// Regeln (avsnitt 4 i planen):
//   S = contract_start_date, steg = 1, 3, 6 eller 12 månader
//   periodstart(k) = addMonthsClamped(S, k * steg)
//   periodslut(k)  = addMonthsClamped(S, (k + 1) * steg) - 1 dag
// Dagen klampas till målmånadens sista dag (31 jan, 28 feb, 31 mar, 30 apr;
// 29 feb blir 28 feb vanliga år). Räknas alltid från S, aldrig från
// föregående period, så att dagen inte glider.
//
// SQL-tvillingen är public.contract_period_on_pure(date, text, date) och
// public.contract_period_on(uuid, date); scripts/regression/periods-twin.mts
// jämför dem med periodContaining.
//
// Ingen import från planeraren (den importerar den här modulen) och inga
// DB-anrop: modulen körs både i webben och i api-projektet.

export const START_DAY_MODE = 'start_day'

/** Fälten periodregeln behöver från ett avtal (eller kundraden). */
export interface PeriodContract {
  contract_start_date: string | null
  billing_frequency: string | null
  billing_anchor_month?: number | null
  /** NULL = dagens regel (perioden börjar den 1:a), 'start_day' = exakt avtalsdag */
  billing_anchor_mode?: string | null
}

export interface PeriodRangeIso {
  periodStart: string
  periodEnd: string
}

function isoOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateOf(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function addDaysLocal(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setDate(out.getDate() + days)
  return out
}

/** Avtalet räknar perioder från exakta startdagen. Saknas startdatum gäller dagens regel. */
export function isStartDayMode(c: Pick<PeriodContract, 'billing_anchor_mode' | 'contract_start_date'>): boolean {
  return c.billing_anchor_mode === START_DAY_MODE && !!c.contract_start_date
}

/**
 * Periodlängd i månader. NULL och on_demand ger årsperioder: i exakt läge
 * går tilläggen för en kund utan premie årsvis på avtalets årsdag.
 */
export function periodStepMonths(freq: string | null | undefined): number {
  if (freq === 'monthly') return 1
  if (freq === 'quarterly') return 3
  if (freq === 'semi_annual') return 6
  return 12
}

/** Flytta ett datum n månader; dagen blir min(dagen, sista dagen i målmånaden). */
export function addMonthsClampedIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return isoOf(new Date(target.getFullYear(), target.getMonth(), Math.min(d, last)))
}

/** Period k räknat från startdagen. */
export function exactPeriodAt(startIso: string, step: number, k: number): PeriodRangeIso {
  return {
    periodStart: addMonthsClampedIso(startIso, k * step),
    periodEnd: isoOf(addDaysLocal(dateOf(addMonthsClampedIso(startIso, (k + 1) * step)), -1)),
  }
}

/**
 * Index för perioden som innehåller dagen. En dag före startdagen ger
 * första perioden (k = 0), samma som SQL-tvillingen.
 */
export function exactPeriodIndexContaining(startIso: string, step: number, dayIso: string): number {
  const [sy, sm] = startIso.split('-').map(Number)
  const [dy, dm] = dayIso.split('-').map(Number)
  const months = (dy - sy) * 12 + (dm - sm)
  let k = Math.max(Math.floor(months / step) - 1, 0)
  for (let guard = 0; guard < 1200; guard++) {
    if (exactPeriodAt(startIso, step, k).periodEnd >= dayIso) return k
    k++
  }
  return k
}

/**
 * Perioderna från startdagen som börjar före endExclusive.
 * requireFull (halvår och år): perioden ska rymmas inom avtalet med samma
 * marginal som dagens regel, alltså periodens sista månad får inte börja
 * efter endInclusive (dagens kod tittar elva respektive fem månader fram).
 */
export function exactPeriods(
  startIso: string,
  endExclusive: Date,
  endInclusive: Date,
  step: number,
  requireFull: boolean
): Array<{ periodStart: Date; periodEnd: Date }> {
  const out: Array<{ periodStart: Date; periodEnd: Date }> = []
  for (let k = 0; k < 1200; k++) {
    const ps = dateOf(addMonthsClampedIso(startIso, k * step))
    if (ps >= endExclusive) break
    const pe = addDaysLocal(dateOf(addMonthsClampedIso(startIso, (k + 1) * step)), -1)
    if (requireFull && step >= 6 && dateOf(addMonthsClampedIso(startIso, k * step + step - 1)) > endInclusive) break
    out.push({ periodStart: ps, periodEnd: pe })
  }
  return out
}

/** Dagens regel (gamla läget): nästa periodstart efter dagen, som contract_next_period_start(uuid, date). */
function legacyNextPeriodStart(c: PeriodContract, fromIso: string): string | null {
  const freq = c.billing_frequency
  if (!freq || freq === 'on_demand') return null
  const from = dateOf(fromIso)
  if (freq === 'monthly') return isoOf(new Date(from.getFullYear(), from.getMonth() + 1, 1))
  if (freq === 'annual') {
    const base = c.contract_start_date ? dateOf(c.contract_start_date) : from
    const anchor = c.billing_anchor_month ?? base.getMonth() + 1
    let candidate = new Date(from.getFullYear(), anchor - 1, 1)
    if (candidate <= from) candidate = new Date(from.getFullYear() + 1, anchor - 1, 1)
    return isoOf(candidate)
  }
  const step = freq === 'quarterly' ? 3 : 6
  const s = c.contract_start_date ? dateOf(c.contract_start_date) : from
  const months = (from.getFullYear() - s.getFullYear()) * 12 + (from.getMonth() - s.getMonth())
  const k = Math.floor(months / step) + 1
  return isoOf(new Date(s.getFullYear(), s.getMonth() + k * step, 1))
}

/**
 * Perioden som innehåller dagen. Exakt läge: från startdagen med klampning.
 * Gamla läget: dagens regel (perioden börjar den 1:a, årsvis i ankarmånaden);
 * null när avtalet inte har periodisk fakturering.
 */
export function periodContaining(c: PeriodContract, dayIso: string): PeriodRangeIso | null {
  if (isStartDayMode(c)) {
    const step = periodStepMonths(c.billing_frequency)
    const start = c.contract_start_date as string
    return exactPeriodAt(start, step, exactPeriodIndexContaining(start, step, dayIso))
  }
  const next = legacyNextPeriodStart(c, dayIso)
  if (!next) return null
  const step = periodStepMonths(c.billing_frequency)
  const startD = dateOf(next)
  return {
    periodStart: isoOf(new Date(startD.getFullYear(), startD.getMonth() - step, 1)),
    periodEnd: isoOf(addDaysLocal(startD, -1)),
  }
}

/**
 * Nästa periodstart efter dagen. Exakt läge: dagen efter slutet på perioden
 * som innehåller dagen. Gamla läget: samma som SQL-funktionen
 * contract_next_period_start(uuid, date) i dag.
 */
export function nextPeriodStart(c: PeriodContract, fromIso: string): string | null {
  if (isStartDayMode(c)) {
    const p = periodContaining(c, fromIso)
    return p ? isoOf(addDaysLocal(dateOf(p.periodEnd), 1)) : null
  }
  return legacyNextPeriodStart(c, fromIso)
}
