// src/shared/customerMirrorPatch.ts
// Vad speglingen från avtalen (contracts) får skriva på kundraden (customers).
//
// Regel: speglingen skriver aldrig NULL över ett befintligt värde på
// kundraden. Ett fält speglas bara när alla levande avtal delar ett värde som
// inte är tomt; saknar avtalen värdet står kundradens kvar. Prislistan töms
// bara när någon uttryckligen tar bort den i avtalskartan (allowClearPriceList),
// aldrig av en ändring av löptid, premie eller annat. Bakgrund: 2026-11-03
// tömde en löptidsändring prislistan och slutdatumet på tre kundrader.

export interface MirrorContractFields {
  billing_frequency: string | null
  billing_anchor_month: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  notice_period_months: number | null
  display_order: number | null
  price_list_id?: string | null
}

export interface CustomerMirrorPatch {
  billing_frequency?: string
  billing_anchor_month?: number
  contract_start_date?: string
  contract_end_date?: string
  notice_period_months?: number
  price_list_id?: string | null
}

export function buildCustomerMirrorPatch(
  live: MirrorContractFields[],
  opts: { allowClearPriceList?: boolean } = {}
): CustomerMirrorPatch {
  const patch: CustomerMirrorPatch = {}
  if (live.length === 0) return patch

  /** Värdet om alla avtal delar det, annars undefined (inget entydigt kundvärde). */
  const shared = <T>(pick: (c: MirrorContractFields) => T | null | undefined): T | null | undefined => {
    const first = pick(live[0]) ?? null
    return live.every((c) => (pick(c) ?? null) === first) ? first : undefined
  }

  const freq = shared((c) => c.billing_frequency)
  if (freq) patch.billing_frequency = freq
  const anchor = shared((c) => c.billing_anchor_month)
  if (anchor != null) patch.billing_anchor_month = anchor
  const start = shared((c) => c.contract_start_date)
  if (start) patch.contract_start_date = start
  const end = shared((c) => c.contract_end_date)
  if (end) patch.contract_end_date = end
  const notice = shared((c) => c.notice_period_months)
  if (notice != null && notice > 0) patch.notice_period_months = notice

  // Kundradens prislista: delad lista, annars första pappret i ordningen.
  const sharedList = shared((c) => c.price_list_id)
  const primary = [...live].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]
  const list = sharedList !== undefined ? sharedList : (primary.price_list_id ?? null)
  if (list) patch.price_list_id = list
  else if (opts.allowClearPriceList) patch.price_list_id = null

  return patch
}
