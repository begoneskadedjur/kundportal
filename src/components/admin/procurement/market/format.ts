// src/components/admin/procurement/market/format.ts
// Konstanter och formatfunktioner som delas av Marknad, Avtalsklocka,
// registren och Inställningar. Ligger utanför .tsx-filerna så att de bara
// exporterar komponenter (snabb omladdning i Vite).

import { SE_COUNTIES, SE_REGIONS } from '../../../../shared/procurementRules'
import { CRITERIA_TYPE_LABEL, type ProcurementCriteriaType } from '../../../../types/procurement'

/** Områdesval: Hela Sverige (förvalt), landsdelar, sedan alla län A-Ö (beslut 2026-10-15) */
export const COUNTY_OPTIONS = [
  { value: 'all', label: 'Hela Sverige' },
  ...Object.entries(SE_REGIONS).map(([key, r]) => ({ value: `region:${key}`, label: r.label })),
  ...Object.entries(SE_COUNTIES)
    .sort((a, b) => a[1].localeCompare(b[1], 'sv'))
    .map(([value, label]) => ({ value, label })),
]

/** Områdets namn i löptext: "hela Sverige", "Norrland", "Stockholms län" */
export function areaLabel(filter: string): string {
  if (filter === 'all') return 'hela Sverige'
  if (filter.startsWith('region:')) return SE_REGIONS[filter.slice(7)]?.label ?? 'vald landsdel'
  return SE_COUNTIES[filter] ?? 'valt län'
}

export function countyLabel(code: string | null | undefined): string {
  if (!code) return '–'
  return (SE_COUNTIES[code] ?? code).replace(' län', '')
}

export function criteriaLabel(c: string | null | undefined): string {
  if (!c) return '–'
  return CRITERIA_TYPE_LABEL[c as ProcurementCriteriaType] ?? c
}

/** Recharts: axeltext och rutnät, ljust läge skrivs över i globals.css */
export const AXIS_TICK = { fill: '#64748b', fontSize: 11 }
export const GRID_STROKE = '#1e293b'
