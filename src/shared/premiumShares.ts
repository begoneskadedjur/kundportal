// src/shared/premiumShares.ts
// Andelar av årspremien på § 4-raderna. Delas av avtalskartan (pappret och
// panelen) och fakturaplaneraren, så att § 4 och fakturan alltid säger samma.
//
// Regler (docs/paragraf-4-7-2-rollfordelning.md):
//   - Bärande raden (is_premium_carrier) är restposten: 1 minus övriga andelar.
//   - Övriga rader: premium_share, null = 0 (ingår utan debitering).
//   - Utan bärande rad (gamla avtal utan typ): uttalade andelar om några finns,
//     annars proportionellt mot radpriserna som förr. Är även det noll får
//     ingen rad andel; planeraren skriver då en vanlig premierad.

export interface ShareInput {
  id: string
  is_premium_carrier?: boolean | null
  premium_share?: number | null
  quantity?: number | null
  unit_price?: number | null
  total_price?: number | null
}

export interface ShareResult {
  /** Andel per rad-id, 0..1 */
  shares: Map<string, number>
  carrierId: string | null
  /** Summan av uttalade andelar på icke-bärande rader */
  othersSum: number
  /** Bärande radens andel blev negativ eller orimligt liten */
  overAllocated: boolean
  carrierBelowTenPercent: boolean
}

export function resolvePremiumShares(rows: ShareInput[]): ShareResult {
  const shares = new Map<string, number>()
  const carrier = rows.find((r) => r.is_premium_carrier) ?? null
  const others = rows.filter((r) => !r.is_premium_carrier)
  const othersSum = others.reduce((s, r) => s + Math.max(0, Number(r.premium_share ?? 0)), 0)

  if (carrier) {
    for (const r of others) shares.set(r.id, Math.max(0, Number(r.premium_share ?? 0)))
    const rest = Math.max(0, 1 - othersSum)
    shares.set(carrier.id, rest)
    return {
      shares,
      carrierId: carrier.id,
      othersSum,
      overAllocated: othersSum > 1 + 1e-9,
      carrierBelowTenPercent: rest > 0 && rest < 0.1,
    }
  }

  // Ingen bärande rad: uttalade andelar, annars gammal proportionell fördelning
  if (othersSum > 0) {
    for (const r of others) shares.set(r.id, Math.max(0, Number(r.premium_share ?? 0)))
    return { shares, carrierId: null, othersSum, overAllocated: othersSum > 1 + 1e-9, carrierBelowTenPercent: false }
  }
  const total = others.reduce((s, r) => s + Number(r.total_price ?? Number(r.unit_price ?? 0) * Number(r.quantity ?? 1)), 0)
  if (total > 0) {
    for (const r of others) shares.set(r.id, Number(r.total_price ?? Number(r.unit_price ?? 0) * Number(r.quantity ?? 1)) / total)
  } else {
    for (const r of others) shares.set(r.id, 0)
  }
  return { shares, carrierId: null, othersSum: 0, overAllocated: false, carrierBelowTenPercent: false }
}

/** Fördela ett belopp efter andelar med öresavrundning mot totalen, inte per rad */
export function allocateByShares(amount: number, order: string[], shares: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  let allocated = 0
  const withShare = order.filter((id) => (shares.get(id) ?? 0) > 0)
  withShare.forEach((id, i) => {
    const isLast = i === withShare.length - 1
    const v = isLast ? Math.round((amount - allocated) * 100) / 100 : Math.round(amount * (shares.get(id) ?? 0) * 100) / 100
    out.set(id, v)
    allocated += v
  })
  return out
}
