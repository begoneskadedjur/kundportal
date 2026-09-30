// src/pages/shared/intranet/interactive/tillagg/tillaggExempel.ts
// Räkneexemplet i guiden Tilläggsstationer: en enhet med 4 mekaniska fällor.
// Alla belopp räknas med samma funktioner som portalen använder
// (src/shared/addonEconomics.ts), så guiden och systemet kan aldrig säga olika.

import { computeAddonCalc, timelineForProposal } from '../../../../../shared/addonEconomics'
import type { AddonCalc, AddonTimeline } from '../../../../../shared/addonEconomics'

export const EXEMPEL = {
  stationType: 'Mekanisk fälla',
  unitName: 'Enhet Norr',
  customerName: 'Exempel AB',
  count: 4,
  /** Kundens pris per station och år (tjänst 144 i kundens prislista) */
  stationPrice: 2348,
  /** Kundens timpris (tjänst 135 i kundens prislista) */
  hourlyPrice: 532,
  /** Intern kostnad per timme (Arbetstid Företag) */
  hourlyCost: 1016,
  hours: 2,
  /** Produkterna som sattes ut, intern kostnad en gång */
  equipmentCost: 14200,
  placedOn: '2026-09-29',
  /** Avtalets nästa periodstart (avtalsåret börjar 1 juli) */
  periodStart: '2027-07-01',
  /** Avtalets årspremie i dag, bara för "Lägg till i avtalet"-bilden */
  premium: 24000,
} as const

export interface ExempelResultat {
  stations: AddonTimeline
  labour: AddonTimeline
  nowTotal: number
  annualTotal: number
  calc: AddonCalc
}

/** Räknar exemplet för ett utsättningsdatum och ett antal timmar per år. */
export function raknaExempel(placedOn: string = EXEMPEL.placedOn, hours: number = EXEMPEL.hours): ExempelResultat {
  const stations = timelineForProposal({
    fromDate: placedOn,
    startDate: EXEMPEL.periodStart,
    perUnitAnnual: EXEMPEL.stationPrice,
    quantityNow: EXEMPEL.count,
    unit: 'station',
  })
  const labour = timelineForProposal({
    fromDate: placedOn,
    startDate: EXEMPEL.periodStart,
    perUnitAnnual: EXEMPEL.hourlyPrice,
    quantityNow: hours,
    quantityAnnual: hours,
    unit: 'timme',
  })
  const nowTotal = stations.totalNow + labour.totalNow
  const annualTotal = stations.totalAnnual + labour.totalAnnual
  const calc = computeAddonCalc({
    equipmentCost: EXEMPEL.equipmentCost,
    annualStationRevenue: stations.totalAnnual,
    labourHours: hours,
    labourRate: EXEMPEL.hourlyPrice,
    labourCostPerHour: EXEMPEL.hourlyCost,
    firstPeriodRevenue: nowTotal,
    firstPeriodFraction: stations.fraction,
    startDate: EXEMPEL.periodStart,
    today: placedOn,
  })
  return { stations, labour, nowTotal, annualTotal, calc }
}
