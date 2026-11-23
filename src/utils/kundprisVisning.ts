// src/utils/kundprisVisning.ts
// Hur ärendets fakturarader visas för användaren: privatpersoner ser priset
// inklusive moms, företag och avtal exklusive moms. Raderna lagras alltid
// exklusive moms (case_billing_items.total_price). Gäller bara visning, inte
// vad som sparas eller faktureras. Används av Pris och fakturering
// (CaseServiceSelector) och återbesöksrutan (RevisitModal) så att samma rad
// visar samma belopp i båda (3.132.19).

/** Momssatsen som visningen räknar med (tjänsterader har alltid 25 %) */
export const VISNING_MOMSSATS = 0.25

/** Faktor från lagrat belopp (exkl. moms) till visat belopp */
export function kundprisFaktor(caseType: string | null | undefined): number {
  return caseType === 'private' ? 1 + VISNING_MOMSSATS : 1
}

/** Etiketten bredvid beloppen: Inkl. moms för privat, Exkl. moms annars */
export function kundprisEtikett(caseType: string | null | undefined): string {
  return caseType === 'private' ? 'Inkl. moms' : 'Exkl. moms'
}

/** Belopp i hela kronor, samma format som Pris och fakturering */
export const formateraKundpris = (price: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
