// src/types/pricingSettings.ts

export interface PricingSettings {
  id: string
  min_margin_percent: number      // Hård gräns – röd varning om man går under
  target_margin_percent: number   // Önskat mål – gul om under target men över min
  recommended_markup_percent: number // Startvärde för prisguide-slidern
  min_charge_amount: number       // Minsta debitering i kr (prisguiden föreslår aldrig under detta)
  max_payback_years: number       // Varning på avtal när varaktig utrustning tar längre än så att återbetala
  updated_at: string
}

export const DEFAULT_PRICING_SETTINGS: Omit<PricingSettings, 'id' | 'updated_at'> = {
  min_margin_percent: 20,
  target_margin_percent: 35,
  recommended_markup_percent: 40,
  min_charge_amount: 3490,
  max_payback_years: 2,
}
