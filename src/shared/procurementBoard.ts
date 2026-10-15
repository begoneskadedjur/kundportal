// src/shared/procurementBoard.ts
// Anbudstavlans kolumner (docs/upphandlingsportal-ux-plan.md avsnitt 2 och 5):
// Bedöms, Anbud pågår, Lämnat och Avgjort, mappade mot our_status med
// statusorden i src/types/procurement.ts. Ren logik, delas av tavlan och tester.

import { OUR_STATUS_LABEL, type ProcurementOurStatus } from '../types/procurement'

export type BoardColumnKey = 'bedoms' | 'pagar' | 'lamnat' | 'avgjort'

export interface BoardColumn {
  key: BoardColumnKey
  label: string
  /** Databasvärden som visas i kolumnen */
  statuses: ProcurementOurStatus[]
  /** Status som sätts när ett kort släpps i kolumnen. Avgjort kräver ett val. */
  dropStatus: ProcurementOurStatus | null
  dot: string
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'bedoms', label: OUR_STATUS_LABEL.analyzing, statuses: ['watching', 'analyzing'], dropStatus: 'analyzing', dot: 'bg-amber-400' },
  { key: 'pagar', label: OUR_STATUS_LABEL.bidding, statuses: ['bidding'], dropStatus: 'bidding', dot: 'bg-[#20c58f]' },
  { key: 'lamnat', label: OUR_STATUS_LABEL.submitted, statuses: ['submitted'], dropStatus: 'submitted', dot: 'bg-emerald-600' },
  { key: 'avgjort', label: 'Avgjort', statuses: ['won', 'lost'], dropStatus: null, dot: 'bg-slate-500' },
]

/** Alla statusar som syns på tavlan */
export const BOARD_STATUSES: ProcurementOurStatus[] = BOARD_COLUMNS.flatMap((c) => c.statuses)

/** Val i kortets statusmeny (mobil och dator), i jobbets ordning */
export const BOARD_MENU_STATUSES: ProcurementOurStatus[] = ['analyzing', 'bidding', 'submitted', 'won', 'lost', 'declined']

export function columnOf(status: ProcurementOurStatus): BoardColumnKey | null {
  return BOARD_COLUMNS.find((c) => c.statuses.includes(status))?.key ?? null
}

/**
 * Statusen ett släpp ger. null = ingen ändring (samma kolumn) eller att ett
 * val krävs (Avgjort: vunnen eller förlorad), se needsOutcomeChoice.
 */
export function statusForDrop(from: ProcurementOurStatus, to: BoardColumnKey): ProcurementOurStatus | null {
  if (columnOf(from) === to) return null
  return BOARD_COLUMNS.find((c) => c.key === to)?.dropStatus ?? null
}

export function needsOutcomeChoice(from: ProcurementOurStatus, to: BoardColumnKey): boolean {
  return to === 'avgjort' && columnOf(from) !== 'avgjort'
}

/** Avgjort visar bara det senaste årets utfall, så att kolumnen inte växer för alltid */
export const DECIDED_DAYS = 365
