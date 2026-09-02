// src/components/admin/customers/record/paperInk.ts
// Färgerna på avtalspappret, som en strukturell typ så att sektionsfilerna
// (§ 7 Premie, § 8 Referenser, § 9 Löptid) kan ta emot PAPER_INK från
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
