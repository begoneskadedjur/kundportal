// src/shared/inspectionStatusLevels.ts
// En regel för stationskontrollernas aktivitetsnivåer, delad av portalen och
// rapporterna (api/). Nivåerna är none, low, medium och high. Äldre statusar
// mappas: ok (snabb-OK, ingen mätning) räknas som none och activity som medium.
// Orden styrs av tabellen inspection_status_labels; orden här är bara reserv.

export type InspectionLevel = 'none' | 'low' | 'medium' | 'high'

export const INSPECTION_LEVELS: InspectionLevel[] = ['none', 'low', 'medium', 'high']

export const DEFAULT_INSPECTION_LEVEL_LABELS: Record<InspectionLevel, string> = {
  none: 'Ingen aktivitet',
  low: 'Låg aktivitet',
  medium: 'Måttlig aktivitet',
  high: 'Hög aktivitet',
}

/** Nivån en status räknas som, eller null om den inte är en aktivitetsnivå. */
export function normalizeInspectionLevel(status: string | null | undefined): InspectionLevel | null {
  if (!status) return null
  if (status === 'ok') return 'none'
  if (status === 'activity') return 'medium'
  return (INSPECTION_LEVELS as string[]).includes(status) ? (status as InspectionLevel) : null
}

/** Antal kontroller per nivå. Statusar utanför nivåerna räknas inte. */
export function countInspectionLevels(
  statuses: Array<string | null | undefined>
): Record<InspectionLevel, number> {
  const counts: Record<InspectionLevel, number> = { none: 0, low: 0, medium: 0, high: 0 }
  for (const s of statuses) {
    const level = normalizeInspectionLevel(s)
    if (level) counts[level]++
  }
  return counts
}

/**
 * Ordet för en status. labels är nivåernas ord från inspection_status_labels
 * (level -> label); saknas ordet där används reservordet. Statusar utanför
 * nivåerna ger null så att anroparen kan välja eget ord.
 */
export function inspectionLevelLabel(
  status: string | null | undefined,
  labels?: Partial<Record<string, string>> | null
): string | null {
  const level = normalizeInspectionLevel(status)
  if (!level) return null
  return labels?.[level] || DEFAULT_INSPECTION_LEVEL_LABELS[level]
}
