// src/shared/scheduleHorizon.ts
// Hur långt fram ett återkommande schema får ha kontroller utlagda. Samma
// regel som fakturorna (bindingWindow i contractPlanner), så kontroller och
// premiefakturor alltid följer samma avtalsår:
// - Avtalsperioden (bindningstiden, 1, 3 eller fler år) läggs ut i sin helhet:
//   kunden är kund minst så länge.
// - När avtalsperioden passerats utan uppsägning förlängs avtalet ett år i
//   taget, och nästa år läggs ut dagen efter sista uppsägningsdag (samma dag
//   som årets premie blir säker).
// - Option: bara till slutdatumet, förlängs när optionen nyttjas.
// - Inget slutdatum: avtalsperioden = start + avtalstiden (contract_length,
//   t.ex. "3 år"), annars ett år. Därefter ett år i taget som ovan.
// - Uppsagt: till sista giltiga dag.
// Beslut Christian 2026-10-21.
// Inga DB-anrop: körs både i webben och i cron-jobbet.

import {
  bindingWindow,
  computeTerminationCutoff,
  addMonthsIso,
  toLocalIsoDate,
  todayLocal,
  type PlanningContract,
} from './contractPlanner'

/** Avtalsfälten horisonten behöver (avtalsraden, eller kundraden för kunder utan avtalsrad). */
export interface HorizonContract {
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  effective_end_date?: string | null
  notice_period_months: number | null
  renewal_mode?: string | null
  /** Avtalstid i fritext ("3 år", "36 månader", "2 år, därefter rullande", "3"). Används när slutdatum saknas. */
  contract_length?: string | null
}

/**
 * Avtalstiden i månader ur fritexten. "3 år" = 36, "36 månader" = 36, en
 * ensam siffra räknas som år. null för tills vidare, rullande eller okänt.
 */
export function contractLengthMonths(text: string | null | undefined): number | null {
  if (!text) return null
  const t = text.toLowerCase()
  const manad = t.match(/(\d+)\s*(månad|manad|mån)/)
  const ar = t.match(/(\d+)\s*år/)
  let months = 0
  if (ar) months += Number(ar[1]) * 12
  if (manad) months += Number(manad[1])
  if (!ar && !manad) {
    const bare = t.trim().match(/^(\d+)$/)
    if (bare) months = Number(bare[1]) * 12
  }
  return months > 0 ? months : null
}

export interface ScheduleHorizon {
  /** Kontroller läggs ut till (exklusive) detta datum. null = horisont saknas */
  planEnd: string | null
  /** Nuvarande periodskifte (null för tills vidare) */
  currentEnd: string | null
  /** Sista uppsägningsdag inför currentEnd */
  lastNoticeDay: string | null
  /** Sista uppsägningsdag har passerat: nästa avtalsår ingår i planEnd */
  renewalDue: boolean
  /** Avtalet saknar slutdatum (tills vidare, räknas i avtalsår från starten) */
  openEnded: boolean
  /** Avtalet är uppsagt: planEnd är dagen efter sista giltiga dag */
  terminated: boolean
}

const EMPTY: ScheduleHorizon = {
  planEnd: null,
  currentEnd: null,
  lastNoticeDay: null,
  renewalDue: false,
  openEnded: false,
  terminated: false,
}

function asPlanning(c: HorizonContract, start: string | null): PlanningContract {
  return {
    annual_value: null,
    billing_frequency: null,
    billing_anchor_month: null,
    billing_active: null,
    contract_start_date: start,
    contract_end_date: c.contract_end_date,
    terminated_at: c.terminated_at,
    notice_period_months: c.notice_period_months,
    renewal_mode: c.renewal_mode ?? null,
  }
}

export function scheduleHorizon(
  c: HorizonContract,
  todayIso: string = toLocalIsoDate(todayLocal())
): ScheduleHorizon {
  if (c.terminated_at) {
    const cutoff = c.effective_end_date ?? (() => {
      const d = computeTerminationCutoff(asPlanning(c, c.contract_start_date))
      return d ? toLocalIsoDate(d) : null
    })()
    return { ...EMPTY, planEnd: cutoff, currentEnd: cutoff, terminated: true }
  }

  // bindingWindow kräver ett startdatum. Saknas det men slutdatum finns
  // räcker ett år före slutet: det påverkar inte periodskiftet.
  const start = c.contract_start_date ?? (c.contract_end_date ? addMonthsIso(c.contract_end_date, -12) : null)
  if (!start) return EMPTY

  // Inget slutdatum: avtalsperioden är start plus avtalstiden, annars ett år.
  // Efter den rullar avtalet ett år i taget precis som ett avtal med
  // slutdatum, eftersom premien debiteras ett år i taget.
  const openEnded = !c.contract_end_date
  const planning = asPlanning(c, start)
  if (openEnded) planning.contract_end_date = addMonthsIso(start, contractLengthMonths(c.contract_length) ?? 12)

  const w = bindingWindow(planning, todayIso)
  if (!w) return EMPTY
  return {
    planEnd: w.planEnd,
    currentEnd: w.currentEnd,
    lastNoticeDay: w.lastNoticeDay,
    renewalDue: w.renewalDue,
    openEnded,
    terminated: false,
  }
}
