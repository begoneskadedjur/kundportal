// src/types/preparations.ts
// TypeScript-typer för preparathantering

/**
 * Kategorier av preparat
 */
export type PreparationCategory = 'biocidprodukt' | 'giftfritt' | 'desinfektionsmedel'

/**
 * Konfiguration för kategori-visning
 */
export const PREPARATION_CATEGORY_CONFIG: Record<PreparationCategory, {
  label: string
  color: string
  bgColor: string
}> = {
  biocidprodukt: {
    label: 'Biocidprodukt',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20'
  },
  giftfritt: {
    label: 'Giftfritt',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20'
  },
  desinfektionsmedel: {
    label: 'Desinfektionsmedel',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20'
  }
}

/**
 * Preparat från databasen
 */
export interface Preparation {
  id: string
  name: string
  category: PreparationCategory
  registration_number: string | null
  pest_types: string[]
  active_substances: string | null
  dosage: string | null
  is_active: boolean
  show_on_website: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * Input för att skapa nytt preparat
 */
export interface CreatePreparationInput {
  name: string
  category: PreparationCategory
  registration_number?: string | null
  pest_types?: string[]
  active_substances?: string | null
  dosage?: string | null
  is_active?: boolean
  show_on_website?: boolean
  sort_order?: number
}

/**
 * Input för att uppdatera preparat
 */
export interface UpdatePreparationInput {
  name?: string
  category?: PreparationCategory
  registration_number?: string | null
  pest_types?: string[]
  active_substances?: string | null
  dosage?: string | null
  is_active?: boolean
  show_on_website?: boolean
  sort_order?: number
}
