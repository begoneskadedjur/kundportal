// src/components/admin/leads/statistik/leadsStatistikFormat.ts
// Period, etiketter och format för fliken Statistik i Leads. Rena funktioner.
// Perioden står i adressen (period, pfran, ptill) och ägarfiltret i sagare, så att en länk visar samma urval.

import { KALLA_ETIKETT, URSPRUNG_ETIKETT, type LeadSource, type LeadUrsprungTabell } from '../../../../types/leads'
import { datumNyckel, plusDagar, tal } from '../../marknad/marknadFormat'

const NB = String.fromCharCode(160)

export type LeadPeriod = '30' | '90' | '12m' | 'ar' | 'egen'

export const LEAD_PERIODER: Array<[LeadPeriod, string]> = [
  ['30', '30 dagar'],
  ['90', '90 dagar'],
  ['12m', '12 månader'],
  ['ar', 'I år'],
  ['egen', 'Egen period'],
]

export const STANDARD_PERIOD: Exclude<LeadPeriod, 'egen'> = '12m'

/** Snabbval som slutar i dag. 12 månader = hela månader från elva månader bakåt. */
export function leadPeriodFor(val: Exclude<LeadPeriod, 'egen'>, idag = new Date()): { fran: string; till: string } {
  const till = datumNyckel(idag)
  if (val === '12m') return { fran: datumNyckel(new Date(idag.getFullYear(), idag.getMonth() - 11, 1)), till }
  if (val === 'ar') return { fran: `${idag.getFullYear()}-01-01`, till }
  return { fran: plusDagar(till, -(Number(val) - 1)), till }
}

export type KedjaDimension = 'kalla' | 'ursprung'

const URSPRUNG_EXTRA: Record<string, string> = {
  web_inquiries: 'Webbförfrågan',
  inget: 'Inget ärende',
}

const versal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function kedjaNamn(dim: KedjaDimension, nyckel: string): string {
  if (dim === 'kalla') return KALLA_ETIKETT[nyckel as LeadSource] ?? nyckel
  return URSPRUNG_EXTRA[nyckel] ?? versal(URSPRUNG_ETIKETT[nyckel as LeadUrsprungTabell] ?? nyckel)
}

const MANADER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** '2026-10' till 'okt 2026' (kort) eller 'okt' (utan år). */
export function manadText(manad: string, medAr = true): string {
  const [y, m] = manad.split('-')
  const namn = MANADER[Number(m) - 1] ?? manad
  return medAr ? `${namn} ${y}` : namn
}

/** Dagar med en decimal under tio, annars heltal: 0,4 d, 3,5 d, 42 d. */
export function dagarText(d: number | null | undefined): string {
  if (d == null || !Number.isFinite(d)) return '–'
  return `${tal(d, d < 10 ? 1 : 0)}${NB}d`
}

export const ROLL_ETIKETT: Record<string, string> = {
  admin: 'Admin',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
  'säljare': 'Säljare',
}
