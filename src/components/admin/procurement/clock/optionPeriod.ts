// src/components/admin/procurement/clock/optionPeriod.ts
// Förlängningsoptionerna i klartext för den lilla ikonen efter basavtalets
// slutdatum (OptionPeriodHint, sedan 3.66.0). Avtalsklockan, köparprofilens
// avtal och detaljsidans Översikt visar basavtalets slut som slutdatum, eftersom
// bearbetningsfönstret räknas mot det. Optionstiden syns diskret bakom ikonen.

import type { ProcurementAward } from '../../../../types/procurement'
import type { ProcurementGroup } from '../market/marketStats'

export type OptionSource = NonNullable<ProcurementAward['option_source']>

export interface OptionPeriod {
  /** Basavtalets slut */
  baseEnd: string
  /** Sista möjliga slut med alla optioner */
  maxEnd: string
  /** Optionerna i månader, null när bara slutdatumet är känt */
  months: number | null
  /** Antal förlängningar */
  count: number | null
  /** Sant när optionerna kommer ur annonsen, falskt när de är antagna */
  known: boolean
  source: OptionSource | null
  /** Optionstexten ur annonsen */
  text: string | null
}

export const OPTION_SOURCE_LABEL: Record<OptionSource, string> = {
  ted_eforms: 'TED (BT-58)',
  ted_xml: 'TED, äldre annons (RENEWAL_DESCR)',
  text: 'annonstexten',
  manual: 'manuellt inlagd',
}

/**
 * Optionstiden för ett avtal, eller null när avtalet saknar optioner efter
 * basavtalets slut. Ett rättat slut räknas som känt slut utan optioner.
 */
export function optionPeriodOf(input: {
  baseEnd: string | null | undefined
  calcEnd: string | null | undefined
  correctedEnd?: string | null
  months?: number | null
  count?: number | null
  source?: OptionSource | null
  text?: string | null
}): OptionPeriod | null {
  if (input.correctedEnd || !input.baseEnd || !input.calcEnd || input.baseEnd >= input.calcEnd) return null
  return {
    baseEnd: input.baseEnd,
    maxEnd: input.calcEnd,
    months: input.months != null && input.months > 0 ? input.months : null,
    count: input.count != null && input.count > 0 ? input.count : null,
    known: !!input.source,
    source: input.source ?? null,
    text: input.text?.trim() || null,
  }
}

/** Optionstiden ur en tilldelningsrad (procurement_awards) */
export function optionPeriodOfAward(a: Pick<ProcurementAward, 'base_end_date' | 'calc_end_date' | 'corrected_end_date' | 'option_months' | 'option_count' | 'option_source' | 'option_text'>): OptionPeriod | null {
  return optionPeriodOf({
    baseEnd: a.base_end_date,
    calcEnd: a.calc_end_date,
    correctedEnd: a.corrected_end_date,
    months: a.option_months,
    count: a.option_count,
    source: a.option_source,
    text: a.option_text,
  })
}

function lengthText(months: number): string {
  return months % 12 === 0 ? `${months / 12} år` : `${months} månader`
}

/** "1 + 1 år", "2 år" eller "6 månader" */
export function optionLengthText(p: Pick<OptionPeriod, 'months' | 'count'>): string | null {
  if (!p.months) return null
  if (p.count && p.count > 1 && p.months % p.count === 0) {
    const each = p.months / p.count
    const unit = each % 12 === 0 ? 'år' : 'månader'
    const n = each % 12 === 0 ? each / 12 : each
    return `${Array.from({ length: p.count }, () => String(n)).join(' + ')} ${unit}`
  }
  return lengthText(p.months)
}

/** Raderna i popovern */
export function optionPeriodLines(p: OptionPeriod, today: string): string[] {
  const length = optionLengthText(p)
  const lines = [`${p.known ? 'Option' : 'Antagen option'}${length ? ` ${length}` : ''}, längst till ${p.maxEnd}.`]
  lines.push(p.known && p.source ? `Källa: ${OPTION_SOURCE_LABEL[p.source]}` : 'Annonsen anger inte optionerna, ett år per förlängning är antaget.')
  if (today > p.baseEnd && today <= p.maxEnd) lines.push(`Basavtalet löpte ut ${p.baseEnd} utan ny annons, så en option är troligen avropad.`)
  else if (today <= p.baseEnd) lines.push('Ingen option avropad ännu.')
  if (p.known && p.text) lines.push(`"${p.text.length > 140 ? `${p.text.slice(0, 139)}…` : p.text}"`)
  return lines
}

/** Optionstiden för en grupp i avtalsklockan och köparprofilen */
export function optionPeriodOfGroup(
  g: Pick<ProcurementGroup, 'baseEndDate' | 'endDate' | 'correctedEndDate' | 'optionMonths' | 'optionCount' | 'optionSource' | 'optionText'>
): OptionPeriod | null {
  return optionPeriodOf({
    baseEnd: g.baseEndDate,
    calcEnd: g.endDate,
    correctedEnd: g.correctedEndDate,
    months: g.optionMonths,
    count: g.optionCount,
    source: g.optionSource,
    text: g.optionText,
  })
}
