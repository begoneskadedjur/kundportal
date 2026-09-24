// src/components/admin/procurement/market/format.ts
// Konstanter och formatfunktioner som delas av Marknad, Avtalsklocka,
// registren och Inställningar. Ligger utanför .tsx-filerna så att de bara
// exporterar komponenter (snabb omladdning i Vite).

import { BEGONE_COUNTIES, SE_COUNTIES } from '../../../../shared/procurementRules'
import { CRITERIA_TYPE_LABEL, type ProcurementCriteriaType } from '../../../../types/procurement'

/** Länval med BeGones län först */
export const COUNTY_OPTIONS = [
  { value: 'begone', label: 'BeGones län' },
  { value: 'all', label: 'Alla län' },
  ...BEGONE_COUNTIES.map((c) => ({ value: c, label: SE_COUNTIES[c] })),
  ...Object.entries(SE_COUNTIES)
    .filter(([c]) => !BEGONE_COUNTIES.includes(c))
    .sort((a, b) => a[1].localeCompare(b[1], 'sv'))
    .map(([value, label]) => ({ value, label })),
]

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
