// src/pages/shared/intranet/interactive/leads/leadsVariant.ts
// Variant per roll för leadsguiderna och de understrukna valen (inga piller).

/** tekniker = guide-leads-tekniker, saljare = guide-leads-saljare, kontor = admin och koordinator */
export type LeadsVariant = 'tekniker' | 'saljare' | 'kontor'

export function lasVariant(v?: string): LeadsVariant {
  return v === 'tekniker' || v === 'saljare' ? v : 'kontor'
}

/** Understrukna val, samma som segmenten i leaden. */
export function segment(aktiv: boolean): string {
  return `px-2.5 py-1 text-sm -mb-px border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
    aktiv ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
  }`
}
