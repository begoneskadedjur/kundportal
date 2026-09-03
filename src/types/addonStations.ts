// src/types/addonStations.ts
// Tilläggsstationer: stationer utöver avtalet (is_addon) med tre betalningsmodeller
// och två avtalslägen. Plan: docs/tillaggsstationer-tre-modeller-plan.md.

/** Hur en tilläggsstation betalas, valt av teknikern vid utsättning. */
export type AddonBillingModel = 'per_year' | 'per_month' | 'per_round'

/**
 * Avtalsläge för per år/per månad-stationer, satt från avtalskartan.
 * included = inbakad i årspremien (§ 7), separate = tillägg utöver avtalet
 * på egna fakturor (§ 6). null = ej beslutat (brickan visas i avtalskartan).
 */
export type AddonContractMode = 'included' | 'separate'

export const ADDON_BILLING_MODEL_LABEL: Record<AddonBillingModel, string> = {
  per_year: 'per år',
  per_month: 'per månad',
  per_round: 'per kontroll',
}

export const ADDON_BILLING_MODEL_HELP: Record<AddonBillingModel, string> = {
  per_year: 'Faktureras fram till nästa årspremie, därefter årsvis tillsammans med avtalet. Ingen etableringsavgift.',
  per_month: 'Faktureras månadsvis, årspriset delat med tolv. Ingen etableringsavgift.',
  per_round: 'Debiteras etablering och varje kontrollrunda stationen kontrolleras i.',
}

/** Priser för tilläggsstationer hos en kund, ur kundens prislista. */
export interface AddonPrices {
  /** Årspris per station (tjänsten med used_for_addon_stations_annual) */
  perYear: number | null
  /** Årspris / 12, avrundat till öre */
  perMonth: number | null
  /** Pris per kontrollrunda (tjänsten med used_for_addon_stations) */
  perRound: number | null
  /** Kunden har ett riktigt avtal (per år/månad kräver det) */
  hasContract: boolean
}

export function addonBillingModelLabel(model: AddonBillingModel | null | undefined): string {
  return model ? ADDON_BILLING_MODEL_LABEL[model] : ''
}

/** Förvald modell: per år när ett årspris finns och kunden har avtal, annars per kontroll. */
export function defaultAddonBillingModel(prices: AddonPrices | null | undefined): AddonBillingModel {
  if (prices && prices.hasContract && prices.perYear != null && prices.perYear > 0) return 'per_year'
  return 'per_round'
}

/**
 * Bricka i avtalskartan: tilläggsstationer per enhet och stationstyp som
 * ännu inte fått ett avtalsläge (dras till § 7 = inbakat, § 6 = tillägg).
 */
export interface AddonBrick {
  unitId: string
  stationTypeId: string | null
  stationTypeName: string
  model: 'per_year' | 'per_month'
  count: number
  outdoorIds: string[]
  indoorIds: string[]
}
