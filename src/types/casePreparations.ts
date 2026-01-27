// src/types/casePreparations.ts
// TypeScript-typer för preparatanvändning i ärenden

import { Preparation } from './preparations'

/**
 * Enhet för preparatmängd
 */
export type PreparationUnit = 'st' | 'ml' | 'l' | 'g' | 'kg'

export const PREPARATION_UNIT_CONFIG: Record<PreparationUnit, {
  label: string
  labelPlural: string
}> = {
  st: { label: 'styck', labelPlural: 'stycken' },
  ml: { label: 'milliliter', labelPlural: 'milliliter' },
  l: { label: 'liter', labelPlural: 'liter' },
  g: { label: 'gram', labelPlural: 'gram' },
  kg: { label: 'kilogram', labelPlural: 'kilogram' }
}

/**
 * Ärendetyp för case_preparations
 */
export type CasePreparationType = 'private' | 'business' | 'contract'

/**
 * Preparatanvändning kopplad till ärende
 */
export interface CasePreparation {
  id: string
  case_id: string
  case_type: CasePreparationType
  preparation_id: string
  quantity: number
  unit: PreparationUnit
  dosage_notes: string | null
  applied_by_technician_id: string | null
  applied_by_technician_name: string | null
  applied_at: string
  created_at: string
  updated_at: string
}

/**
 * CasePreparation med inladdat preparat-objekt
 */
export interface CasePreparationWithDetails extends CasePreparation {
  preparation: Preparation
}

/**
 * Input för att lägga till preparat till ärende
 */
export interface CreateCasePreparationInput {
  case_id: string
  case_type: CasePreparationType
  preparation_id: string
  quantity: number
  unit?: PreparationUnit
  dosage_notes?: string
  applied_by_technician_id?: string
  applied_by_technician_name?: string
}

/**
 * Input för att uppdatera preparatanvändning
 */
export interface UpdateCasePreparationInput {
  quantity?: number
  unit?: PreparationUnit
  dosage_notes?: string
}
