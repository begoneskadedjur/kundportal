// src/shared/importBillingPreview.ts
// "Kommande faktureringar" i importens förhandsvisning (orgnr och PDF).
// Steg 12 i docs/planer/avtalsar-exakt-arsdag-teknik.md: samma periodregel som
// fakturaplaneringen (computePlannedPeriods) i stället för en egen räkning från
// ankarmånaden. Importen sätter aldrig exakt avtalsdag, så det gamla läget
// gäller alltid här (perioden börjar den 1:a i ankarmånaden).

import { computePlannedPeriods, type PlanningContract } from './contractPlanner'

export interface ImportPreviewBilling {
  contract_start_date: string | null
  contract_end_date: string | null
  annual_value: number | null
  billing_frequency: string | null
  billing_anchor_month: number | null
}

export interface ImportPreviewPeriod {
  periodStart: string
  periodEnd: string
  amount: number
}

function plusYearsIso(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * De närmaste perioderna som börjar i dag eller senare. Utan slutdatum
 * planeras tre år fram (som förut), utan startdatum eller frekvens blir listan tom.
 */
export function upcomingImportPeriods(preview: ImportPreviewBilling, todayIso: string, count = 4): ImportPreviewPeriod[] {
  if (!preview.contract_start_date || !preview.billing_frequency || preview.billing_frequency === 'on_demand') return []
  const contract: PlanningContract = {
    annual_value: preview.annual_value ?? 0,
    contract_start_date: preview.contract_start_date,
    contract_end_date: preview.contract_end_date,
    terminated_at: null,
    billing_frequency: preview.billing_frequency,
    billing_anchor_month: preview.billing_anchor_month,
    billing_active: true,
    notice_period_months: null,
    billing_anchor_mode: null,
  }
  const periods = computePlannedPeriods(contract, { today: todayIso, horizonEnd: plusYearsIso(todayIso, 3) })
  return periods
    .filter((p) => p.periodStart >= todayIso)
    .slice(0, count)
    .map((p) => ({ periodStart: p.periodStart, periodEnd: p.periodEnd, amount: p.amount }))
}
