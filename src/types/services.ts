// src/types/services.ts
// Typdefinitioner för Tjänsteutbud (BeGones säljutbud mot kund)

export interface ServiceGroup {
  id: string
  name: string
  slug: string
  description: string | null
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  code: string        // t.ex. SVC-001
  name: string
  description: string | null
  group_id: string | null
  unit: string
  sort_order: number
  is_active: boolean
  show_in_booking: boolean
  // Prisguide-inställningar
  base_price: number | null
  min_margin_percent: number
  recommended_markup_percent: number
  is_addon_service: boolean
  // ROT/RUT-avdrag (endast arbetstidstjänster markeras som eligible)
  rot_eligible: boolean
  rut_eligible: boolean
  rot_rate_percent: number | null  // null = använd global default
  rut_rate_percent: number | null  // null = använd global default
  // Om true: tjänsten kan väljas som Avtalstyp på kund.
  is_contract_service: boolean
  // Om true: tjänsten används för rundfakturering av tilläggsstationer
  // (max EN tjänst åt gången, partiellt unikt index i DB).
  // OBS: skild från is_addon_service ("Tilläggstjänst" i prisguiden).
  used_for_addon_stations: boolean
  /** Bär årspriset för tilläggsstationer (per år, per månad = /12). Max EN tjänst. */
  used_for_addon_stations_annual?: boolean
  created_at: string
  updated_at: string
}

// Automatisk intern kostnad (artikelrad) per enhet av en tjänst,
// t.ex. arbetstid/station vid rundfakturering av tilläggsstationer.
export interface ServiceDefaultArticle {
  id: string
  service_id: string
  article_id: string
  quantity_per_unit: number
  created_at: string
  updated_at: string
  article?: { id: string; name: string; default_price: number | null; unit?: string | null }
}

export interface ServiceWithGroup extends Service {
  group?: ServiceGroup | null
}

export interface CreateServiceGroupInput {
  name: string
  slug?: string
  description?: string
  color?: string
  icon?: string
  sort_order?: number
}

export interface UpdateServiceGroupInput {
  name?: string
  description?: string | null
  color?: string
  icon?: string
  sort_order?: number
  is_active?: boolean
}

export interface CreateServiceInput {
  code: string
  name: string
  description?: string
  group_id?: string | null
  unit?: string
  sort_order?: number
  is_active?: boolean
  base_price?: number | null
  min_margin_percent?: number
  recommended_markup_percent?: number
  is_addon_service?: boolean
  rot_eligible?: boolean
  rut_eligible?: boolean
  rot_rate_percent?: number | null
  rut_rate_percent?: number | null
  is_contract_service?: boolean
  used_for_addon_stations?: boolean
  used_for_addon_stations_annual?: boolean
}

export interface UpdateServiceInput {
  name?: string
  description?: string | null
  group_id?: string | null
  unit?: string
  sort_order?: number
  is_active?: boolean
  show_in_booking?: boolean
  base_price?: number | null
  min_margin_percent?: number
  recommended_markup_percent?: number
  is_addon_service?: boolean
  rot_eligible?: boolean
  rut_eligible?: boolean
  rot_rate_percent?: number | null
  rut_rate_percent?: number | null
  is_contract_service?: boolean
  used_for_addon_stations?: boolean
  used_for_addon_stations_annual?: boolean
}

export const SERVICE_UNITS = ['st', 'timme', 'dag', 'km', 'm2', 'fp'] as const
export type ServiceUnit = typeof SERVICE_UNITS[number]
