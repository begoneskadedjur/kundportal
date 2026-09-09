// src/components/admin/customers/record/paperInk.ts
// Färgerna på avtalspappret, som en strukturell typ så att sektionsfilerna
// (§ 6 Premie, § 7 Referenser, § 8 Löptid) kan ta emot PAPER_INK från
// ContractMapSection utan att importera hela kartan.

export interface PaperInk {
  sheet: string
  primary: string
  secondary: string
  muted: string
  rule: string
  positive: string
  warn: string
  danger: string
}

/** Radnummer, namn, punktledare och värde — samma rytm som § 1 Omfattning. */
export const PAPER_ROW_CLASS = 'flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]'

/** Inline-inmatning på pappret: samma vita fält som § 1:s datumval. */
export const PAPER_INPUT_CLASS =
  'font-sans text-[12px] bg-[#fff]/70 border border-[#d9d3c2] rounded px-2 py-1 text-[#262e38] focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]'

/** Dämpad textknapp med prickad underlinje — papprets sätt att säga "klicka". */
export const PAPER_LINK_CLASS =
  'font-sans text-[10.5px] underline decoration-dotted transition-colors hover:text-[#262e38] disabled:opacity-50'

/**
 * Inställningspanelen är verktygets yta, inte dokumentets: mörkt slate-tema.
 * Sektionerna (§ 6, § 7, § 8) renderar sina formulär där med de här tonerna
 * i stället för papprets, så samma komponent fungerar på båda ytorna.
 */
export const PANEL_INK: PaperInk = {
  sheet: '#111a2b',
  primary: '#e6eaf2',
  secondary: '#9aa6bb',
  muted: '#64718a',
  rule: '#26324a',
  positive: '#20c58f',
  warn: '#f59e0b',
  danger: '#f87171',
}

/** Inmatning i inställningspanelen: samma fält som portalens modaler. */
export const PANEL_INPUT_CLASS =
  'font-sans text-[12.5px] w-full bg-slate-800/70 border border-slate-700 rounded-md px-2.5 py-1.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]'

/** Läge för sektionerna: pappret läser, panelen redigerar. */
export type SectionMode = 'paper' | 'settings'

/**
 * Kugghjulet i en §-rubrik: nästan osynligt i vila, tydligt när musen är över
 * paragrafen (wrap paragrafen i group/para). Enda vägen från pappret till
 * inställningarna, så pappret slipper knappar, selects och ändra-länkar.
 */
export const PAPER_GEAR_CLASS =
  'inline-grid place-items-center w-4 h-4 rounded border text-[10px] leading-none opacity-30 group-hover/para:opacity-100 hover:!opacity-100 hover:text-[#20c58f] hover:border-[#20c58f] transition-opacity cursor-pointer'
