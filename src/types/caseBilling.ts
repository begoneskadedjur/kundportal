// src/types/caseBilling.ts
// Typer för ärendebaserad fakturering (artiklar tekniker väljer per ärende)

import type { Article, ArticleCategory } from './articles'

/**
 * Ärendetyper som kan faktureras
 */
export type BillableCaseType = 'private' | 'business' | 'contract'

/**
 * Priskälla - varifrån priset kommer
 */
export type PriceSource = 'standard' | 'customer_list'

/**
 * Status för case billing item
 */
export type CaseBillingItemStatus = 'pending' | 'approved' | 'billed' | 'cancelled'

/**
 * Case billing item från databasen
 */
export interface CaseBillingItem {
  id: string
  case_id: string
  case_type: BillableCaseType
  customer_id: string | null
  article_id: string | null
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  discount_percent: number
  discounted_price: number
  total_price: number
  vat_rate: number
  price_source: PriceSource
  added_by_technician_id: string | null
  added_by_technician_name: string | null
  status: CaseBillingItemStatus
  requires_approval: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Case billing item med relationer
 */
export interface CaseBillingItemWithRelations extends CaseBillingItem {
  article?: Article | null
  technician?: {
    id: string
    name: string
  } | null
}

/**
 * Input för att lägga till artikel till ärende
 */
export interface AddCaseArticleInput {
  case_id: string
  case_type: BillableCaseType
  customer_id?: string | null
  article_id: string
  article_code?: string
  article_name: string
  quantity?: number
  unit_price: number
  discount_percent?: number
  vat_rate?: number
  price_source?: PriceSource
  added_by_technician_id?: string
  added_by_technician_name?: string
  notes?: string
}

/**
 * Input för att uppdatera case billing item
 */
export interface UpdateCaseArticleInput {
  quantity?: number
  discount_percent?: number
  notes?: string
}

/**
 * Artikel med effektivt pris (för UI)
 */
export interface ArticleWithEffectivePrice {
  article: Article
  effective_price: number
  price_source: PriceSource
  customer_discount_percent?: number
}

/**
 * Grupperade artiklar per kategori (för UI)
 */
export interface ArticlesByCategory {
  category: ArticleCategory
  articles: ArticleWithEffectivePrice[]
}

/**
 * Summering av case billing items
 */
export interface CaseBillingSummary {
  item_count: number
  subtotal: number
  total_discount: number
  vat_amount: number
  total_amount: number
  requires_approval: boolean
}

/**
 * UI-konfiguration för case billing item status
 */
export const CASE_BILLING_ITEM_STATUS_CONFIG: Record<CaseBillingItemStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  pending: {
    label: 'Väntar',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30'
  },
  approved: {
    label: 'Godkänd',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  billed: {
    label: 'Fakturerad',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  cancelled: {
    label: 'Avbruten',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30'
  }
}

/**
 * Beräkna rabatterat pris
 */
export const calculateDiscountedPrice = (
  unitPrice: number,
  discountPercent: number
): number => {
  return unitPrice * (1 - discountPercent / 100)
}

/**
 * Beräkna totalpris inkl. moms
 */
export const calculateTotalPrice = (
  discountedPrice: number,
  quantity: number
): number => {
  return discountedPrice * quantity
}

/**
 * Beräkna momsbelopp
 */
export const calculateVatAmount = (
  totalPrice: number,
  vatRate: number
): number => {
  return totalPrice * (vatRate / 100)
}

/**
 * Formatera priskälla för visning
 */
export const formatPriceSource = (source: PriceSource): string => {
  return source === 'customer_list' ? 'Kundpris' : 'Standardpris'
}

/**
 * Avgör om en item kräver godkännande
 */
export const itemRequiresApproval = (discountPercent: number): boolean => {
  return discountPercent > 0
}
