// src/utils/billingPrefill.ts
// Delade mappare som omvandlar case_billing_items till wizardens prefill-format.

import type { CaseBillingItemWithRelations } from '../types/caseBilling'
import type { SelectedArticleItem } from '../types/products'

export interface PrefillService {
  id: string
  service_name: string | null
  service_code: string | null
  unit_price: number
  quantity: number
  total_price: number
  vat_rate?: number
  rot_rut_type?: 'ROT' | 'RUT' | null
  service?: {
    rot_rate_percent?: number | null
    rut_rate_percent?: number | null
  } | null
}

export function mapBillingItemsToPrefillServices(
  items: CaseBillingItemWithRelations[]
): PrefillService[] {
  return items
    .filter(item => item.item_type === 'service')
    .map(item => ({
      id: item.id,
      service_name: item.service_name,
      service_code: item.service_code,
      unit_price: item.unit_price,
      quantity: item.quantity,
      total_price: item.total_price,
      vat_rate: item.vat_rate,
      rot_rut_type: item.rot_rut_type,
      service: item.service
        ? {
            rot_rate_percent: (item.service as any).rot_rate_percent ?? null,
            rut_rate_percent: (item.service as any).rut_rate_percent ?? null,
          }
        : null,
    }))
}

export function mapBillingItemsToSelectedArticles(
  items: CaseBillingItemWithRelations[]
): SelectedArticleItem[] {
  return items
    .filter(item => item.article)
    .map(item => ({
      article: item.article!,
      priceListItem: null,
      effectivePrice: item.unit_price,
      quantity: item.quantity,
      notes: item.notes || undefined,
      caseBillingItemId: item.id,
      mapped_service_id: item.mapped_service_id ?? null,
    }))
}
