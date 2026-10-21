// src/shared/scheduleHorizon.ts
// Hur långt fram ett återkommande schema får ha kontroller utlagda. Samma
// regel som fakturorna (bindingWindow i contractPlanner), så kontroller och
// premiefakturor alltid följer samma avtalsår:
// - Kontroller läggs ut till nuvarande periodskifte.
// - När sista uppsägningsdag passerat utan uppsägning är nästa avtalsår säkert
//   och läggs ut på en gång (ett år, inte två månader i taget).
// - Option: bara till slutdatumet, förlängs när optionen nyttjas.
// - Tills vidare: uppsägningstiden framåt, fylls på löpande.
// - Uppsagt: till sista giltiga dag.
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
  /** Avtalet löper tills vidare */
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

  const w = bindingWindow(asPlanning(c, start), todayIso)
  if (!w) return EMPTY
  return {
    planEnd: w.planEnd,
    currentEnd: w.currentEnd,
    lastNoticeDay: w.lastNoticeDay,
    renewalDue: w.renewalDue,
    openEnded: w.openEnded,
    terminated: false,
  }
}
