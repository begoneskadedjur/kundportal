// src/components/admin/procurement/detail/steps.ts
// Detaljsidans fem steg plus Logg (docs/upphandlingsportal-ux-plan.md avsnitt 3)
// och stegens statuspunkt, härledd ur data: grå ej påbörjat, gul pågår,
// grön klart. Ren logik, testad i procurementWorkflow-testerna.

import type { ProcurementOurStatus } from '../../../../types/procurement'

export type StepKey = 'oversikt' | 'underlag' | 'kalkyl' | 'anbud' | 'utfall' | 'logg'
export type StepState = 'todo' | 'doing' | 'done'

export const STEPS: Array<{ key: Exclude<StepKey, 'logg'>; num: number; label: string }> = [
  { key: 'oversikt', num: 1, label: 'Översikt' },
  { key: 'underlag', num: 2, label: 'Underlag' },
  { key: 'kalkyl', num: 3, label: 'Kalkyl' },
  { key: 'anbud', num: 4, label: 'Anbud' },
  { key: 'utfall', num: 5, label: 'Utfall' },
]

export const STEP_DOT: Record<StepState, string> = {
  todo: 'bg-slate-600',
  doing: 'bg-amber-400',
  done: 'bg-[#20c58f]',
}

export const STEP_STATE_LABEL: Record<StepState, string> = {
  todo: 'ej påbörjat',
  doing: 'pågår',
  done: 'klart',
}

/** Steget ur adressen; okänt eller saknat steg blir Översikt */
export function stepOf(param: string | null | undefined): StepKey {
  const keys: StepKey[] = ['oversikt', 'underlag', 'kalkyl', 'anbud', 'utfall', 'logg']
  return keys.includes(param as StepKey) ? (param as StepKey) : 'oversikt'
}

export interface StepFacts {
  status: ProcurementOurStatus
  documents: number
  documentsRead: number
  requirements: number
  requirementsDone: number
  hasBid: boolean
  priceLines: number
  priceLinesPriced: number
  qualityTotal: number
  qualityDrafted: number
  signed: boolean
  bidOutcomeSet: boolean
  lesson: boolean
  bidders: number
}

const SUBMITTED_OR_LATER: ProcurementOurStatus[] = ['submitted', 'won', 'lost']

export function stepStates(f: StepFacts): Record<Exclude<StepKey, 'logg'>, StepState> {
  const decided = f.status === 'won' || f.status === 'lost'
  const submitted = SUBMITTED_OR_LATER.includes(f.status)
  return {
    oversikt: f.status === 'new' ? 'doing' : 'done',
    underlag:
      f.documentsRead > 0 && f.requirements > 0 && f.requirementsDone === f.requirements
        ? 'done'
        : f.documents > 0 || f.requirements > 0
          ? 'doing'
          : 'todo',
    kalkyl:
      f.hasBid && f.priceLines > 0 && f.priceLinesPriced === f.priceLines
        ? 'done'
        : f.hasBid || f.priceLines > 0
          ? 'doing'
          : 'todo',
    anbud: submitted ? 'done' : f.signed || f.qualityDrafted > 0 ? 'doing' : 'todo',
    utfall: decided && (f.lesson || f.bidOutcomeSet) ? 'done' : decided || f.bidders > 0 || submitted ? 'doing' : 'todo',
  }
}
