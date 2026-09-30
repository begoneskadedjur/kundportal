// src/types/addonStations.ts
// Tilläggsstationer: stationer utöver avtalet (is_addon) med tre betalningsmodeller
// och två avtalslägen. Plan: docs/tillaggsstationer-tre-modeller-plan.md.

/** Hur en tilläggsstation betalas, valt av teknikern vid utsättning. */
export type AddonBillingModel = 'per_year' | 'per_month' | 'per_round'

/**
 * Avtalsläge för per år/per månad-stationer, satt från avtalskartan.
 * included = inbakad i årspremien (§ 6), separate = tillägg utöver avtalet
 * på egna fakturor (§ 5). null = ej beslutat (brickan visas i avtalskartan).
 */
export type AddonContractMode = 'included' | 'separate'

export const ADDON_BILLING_MODEL_LABEL: Record<AddonBillingModel, string> = {
  per_year: 'per år',
  per_month: 'per månad',
  per_round: 'per kontroll',
}

export const ADDON_BILLING_MODEL_HELP: Record<AddonBillingModel, string> = {
  per_year: 'Betalas för månaderna kvar till avtalets nästa år, sedan på en egen faktura i samband med årsfakturan. Slutar när avtalet slutar. Ingen etableringsavgift.',
  per_month: 'Faktureras månadsvis, årspriset delat med tolv. Ingen etableringsavgift.',
  per_round: 'Debiteras etablering och varje kontrollrunda stationen kontrolleras i.',
}

/** Priser för tilläggsstationer hos en kund, ur kundens prislista. */
export interface AddonPrices {
  /** Årspris per station för den valda stationstypen (typens annual_service_id) */
  perYear: number | null
  /** Årspris / 12, avrundat till öre */
  perMonth: number | null
  /** Pris per kontrollrunda (tjänsten med used_for_addon_stations) */
  perRound: number | null
  /** Kunden har ett riktigt avtal (per år/månad kräver det) */
  hasContract: boolean
  /**
   * Stationstypen priset gäller. Null = generella årstjänsten användes,
   * alltså innan teknikern valt typ.
   */
  stationTypeId?: string | null
}

/**
 * Stationstyp som saknar pris i kundens prislista. Raden skapas då aldrig
 * (en 0-krona hade filtrerats bort tyst av planeraren och stationen
 * aldrig fakturerats), utan rapporteras hit så UI kan säga ifrån.
 */
export interface AddonPriceMissing {
  station_type_id: string | null
  station_type: string
  site_customer_id?: string | null
  model?: string
  quantity?: number
}

/** Produkt som kan placeras ut för en stationstyp. Intern kostnad. */
export interface StationTypeArticle {
  articleId: string
  code: string | null
  name: string
  /** Inköpspris, visas bara internt */
  cost: number | null
  isDefault: boolean
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
 * ännu inte fått ett avtalsläge (dras till § 6 = inbakat, § 5 = tillägg).
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

/** En stationstyp i teknikerns avslutssteg (RPC addon_completion_summary). */
export interface AddonSummaryType {
  station_type_id: string | null
  station_type_name: string
  model: 'per_year' | 'per_month'
  /** Aktiva tilläggsstationer markerade före ärendet (ej inbakade) */
  before: number
  /** Varav obeslutade ("väntar på beslut") */
  before_pending: number
  /** Nya under ärendet (ej inbakade) */
  new: number
  /** Inbakade i avtalet ("Ingår i avtalet"), påverkar inte arbetstidsfrågan */
  included: number
  /** Utrustningskostnad för de nya (intern) */
  new_cost: number
  /** Årspris per station ur kundens prislista */
  annual_price: number | null
}

/** Underlag för "Färdig med etablering"/kontrollrundans avslut och Ekonomi-fliken. */
export interface AddonCompletionSummary {
  ok: boolean
  reason?: string
  case_id: string
  case_number: string | null
  case_created_at: string
  unit_id: string
  unit_name: string | null
  contract_id: string | null
  contract_name: string | null
  contract_end_date: string | null
  today: string
  next_period_start: string | null
  /** Kundens fasta timpris (tjänst 135 ur prislistan) */
  hourly_price: number | null
  /** Intern timkostnad (Arbetstid Företag) */
  hourly_cost: number | null
  /** Timmar per år som enheten debiteras i dag (§ 6) */
  labour_hours_before: number
  /** Teknikerns förslag (nytt totalt), null = inget förslag */
  proposal_hours: number | null
  proposal_hours_before: number | null
  proposal_status: string | null
  proposal_total: number | null
  new_equipment_cost: number
  new_articles: Array<{ name: string; quantity: number; cost: number }>
  types: AddonSummaryType[]
}

/** Underlag för kontorets beslut per enhet (RPC addon_unit_decision_info). */
export interface AddonUnitDecisionInfo {
  unit_id: string
  unit_name: string | null
  contract_id: string
  today: string
  next_period_start: string | null
  contract_end_date: string | null
  hourly_price: number | null
  hourly_cost: number | null
  /** Timmar per år som debiteras i dag på avtalet */
  labour_hours_now: number
  proposal_case_id: string | null
  proposal_case_number: string | null
  proposal_hours: number | null
  proposal_hours_before: number | null
  proposal_status: string | null
  /** Utrustningskostnad för obeslutade stationer (intern) */
  pending_equipment_cost: number
  pending_articles: Array<{ station_type_id: string | null; name: string; quantity: number; cost: number }>
}

/** Stationstyper med nya tillägg per år/per månad = avslutssteget ska visas. */
export function hasNewAddons(summary: AddonCompletionSummary | null | undefined): boolean {
  return !!summary?.ok && !!summary.contract_id && summary.types.some((t) => t.new > 0)
}
