// src/components/admin/procurement/detail/steps.ts
// Detaljsidans fem steg plus Logg (docs/upphandlingsportal-ux-plan.md avsnitt 3)
// och RFI-lägets fyra steg (sedan 3.71.0: Översikt, Underlag, Svar, Uppföljning)
// och stegens statuspunkt, härledd ur data: grå ej påbörjat, gul pågår,
// grön klart. Ren logik, testad i procurementWorkflow-testerna.

import type { ProcurementOurStatus, ProcurementWorkMode } from '../../../../types/procurement'
import type { RfiStepKey } from '../../../../shared/procurementRfi'

export { rfiStepStates, type RfiStepFacts, type RfiStepKey } from '../../../../shared/procurementRfi'

export type StepKey = 'oversikt' | 'underlag' | 'kalkyl' | 'anbud' | 'utfall' | 'svar' | 'uppfoljning' | 'logg'
export type TenderStepKey = 'oversikt' | 'underlag' | 'kalkyl' | 'anbud' | 'utfall'
export type StepState = 'todo' | 'doing' | 'done'

export const STEPS: Array<{ key: TenderStepKey; num: number; label: string }> = [
  { key: 'oversikt', num: 1, label: 'Översikt' },
  { key: 'underlag', num: 2, label: 'Underlag' },
  { key: 'kalkyl', num: 3, label: 'Kalkyl' },
  { key: 'anbud', num: 4, label: 'Anbud' },
  { key: 'utfall', num: 5, label: 'Utfall' },
]

/** RFI-lägets steg: inget pris, inga krav, bara frågor att svara på */
export const RFI_STEPS: Array<{ key: RfiStepKey; num: number; label: string }> = [
  { key: 'oversikt', num: 1, label: 'Översikt' },
  { key: 'underlag', num: 2, label: 'Underlag' },
  { key: 'svar', num: 3, label: 'Svar' },
  { key: 'uppfoljning', num: 4, label: 'Uppföljning' },
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

/**
 * Steget ur adressen; okänt eller saknat steg blir Översikt. Ett steg som
 * inte finns i läget (t.ex. kalkyl i RFI-läget) blir också Översikt.
 */
export function stepOf(param: string | null | undefined, mode: ProcurementWorkMode = 'tender'): StepKey {
  const keys: StepKey[] =
    mode === 'rfi' ? ['oversikt', 'underlag', 'svar', 'uppfoljning', 'logg'] : ['oversikt', 'underlag', 'kalkyl', 'anbud', 'utfall', 'logg']
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

export function stepStates(f: StepFacts): Record<TenderStepKey, StepState> {
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
