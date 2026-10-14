// src/types/textPolish.ts
// Snygga till (3.52.0): AI-genomläsning av texter i specialrapporterna och
// ordlistan med termer som aldrig rättas. Delas mellan klienten och
// api/polish-text.ts (finns därför i tsconfig.node.json).

/** Kategorier för ett förslag. Formulering är avbockad från början i granskningen */
export type PolishKind = 'stavning' | 'versal' | 'skiljetecken' | 'stycke' | 'formulering'

export const POLISH_KINDS: PolishKind[] = ['stavning', 'versal', 'skiljetecken', 'stycke', 'formulering']

export const POLISH_KIND_LABEL: Record<PolishKind, string> = {
  stavning: 'Stavning',
  versal: 'Stor bokstav',
  skiljetecken: 'Skiljetecken',
  stycke: 'Stycken',
  formulering: 'Formulering',
}

/** Gränser per anrop (servern svarar 413 över dem) */
export const POLISH_MAX_FIELDS = 30
export const POLISH_MAX_CHARS = 20000

export interface PolishField {
  /** Klientens nyckel för fältet, kommer tillbaka i varje ändring */
  id: string
  /** Fältets namn, visas som rubrik i granskningen */
  label: string
  text: string
}

export interface PolishContext {
  customerName?: string | null
  address?: string | null
}

export interface PolishRequest {
  fields: PolishField[]
  context?: PolishContext
}

/** Ett godkänt förslag med position i fältets originaltext */
export interface PolishChange {
  id: string
  fieldId: string
  kind: PolishKind
  /** Startposition (inklusive) i originaltexten */
  start: number
  /** Slutposition (exklusive) i originaltexten */
  end: number
  from: string
  to: string
  reason: string
}

/** Ett förslag som servern stoppade, med svensk förklaring */
export interface PolishBlocked {
  fieldId: string
  from: string
  to: string
  reason: string
}

export interface PolishResponse {
  changes: PolishChange[]
  blocked: PolishBlocked[]
  /** Ordlistans termer (och kundens namn och adress) som förekom i texten */
  protectedTerms: string[]
}

// ── Ordlistan ──

export type GlossarySource = 'artikel' | 'tjanst' | 'produkt' | 'preparat' | 'stationstyp' | 'manuell'

export const GLOSSARY_SOURCE_LABEL: Record<GlossarySource, string> = {
  artikel: 'Artikel',
  tjanst: 'Tjänst',
  produkt: 'Produkt',
  preparat: 'Preparat',
  stationstyp: 'Stationstyp',
  manuell: 'Tillagt av er',
}

export interface GlossaryEntry {
  id: string
  term: string
  source: GlossarySource
  source_id: string | null
  active: boolean
  added_by: string | null
  created_at: string
}
