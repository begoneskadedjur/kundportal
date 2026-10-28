// src/shared/premiumReview.ts
// Premie att bekräfta (beslut 2026-10-28).
//
// Avtal som gjorts direkt i Oneflow (inte i portalens Skapa avtal) får sin
// årspremie uträknad ur Oneflows produkttabell vid signeringen. Mallarna skiljer
// sig åt, så premien kan bli fel. Sådana avtal flaggas med
// contracts.premium_needs_review och deras avtalsfakturor får inte godkännas
// eller skickas till Fortnox förrän premien bekräftats i avtalskartan.
// Delas av api/_lib/contractSigning.ts och webben.

// Notistexten bor i contractSigning.ts, som servern (tsconfig.node.json) redan tar med
export { PREMIUM_REVIEW_NOTE } from './contractSigning'

export const PREMIUM_REVIEW_BLOCK_MESSAGE =
  'Premien för avtalet är inte bekräftad. Stäm av den mot avtalet och bekräfta den i avtalskartan.'

/** Avtalen en faktura hör till: fakturans contract_id och radernas (samlad faktura). */
export function invoiceContractIds(
  invoice: { contract_id?: string | null } | null | undefined,
  items: ReadonlyArray<{ contract_id?: string | null }> | null | undefined
): string[] {
  const ids = new Set<string>()
  if (invoice?.contract_id) ids.add(invoice.contract_id)
  for (const it of items ?? []) {
    if (it?.contract_id) ids.add(it.contract_id)
  }
  return [...ids]
}

/** Avtalen bland contractIds vars premie väntar på bekräftelse. */
export function unconfirmedPremiumContractIds(
  contractIds: ReadonlyArray<string>,
  contracts: ReadonlyArray<{ id: string; premium_needs_review?: boolean | null }>
): string[] {
  const flagged = new Set(contracts.filter((c) => c.premium_needs_review === true).map((c) => c.id))
  return contractIds.filter((id) => flagged.has(id))
}

/** Spärras fakturan? Bara avtalsfakturor berörs; alla berörda avtal ska vara bekräftade. */
export function isInvoiceBlockedByPremiumReview(
  invoiceType: string | null | undefined,
  contractIds: ReadonlyArray<string>,
  contracts: ReadonlyArray<{ id: string; premium_needs_review?: boolean | null }>
): boolean {
  if (invoiceType !== 'contract') return false
  return unconfirmedPremiumContractIds(contractIds, contracts).length > 0
}
