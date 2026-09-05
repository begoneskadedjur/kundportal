// src/types/caseBilling.ts
// Typer för ärendebaserad fakturering (artiklar/tjänster tekniker väljer per ärende)

import type { MarginBreakdown } from '../shared/marginEngine'
import type { Article, ArticleCategory } from './articles'
import type { Service } from './services'

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
 * ROT/RUT-typ för skatteavdrag
 */
export type RotRutType = 'ROT' | 'RUT'

/**
 * Item-typ - artikel (intern kalkyl) eller tjänst (fakturarad)
 */
export type CaseBillingItemType = 'article' | 'service'

/**
 * Case billing item från databasen
 */
export interface CaseBillingItem {
  id: string
  case_id: string
  case_type: BillableCaseType
  customer_id: string | null
  // Artikel-fält (intern kalkyl)
  article_id: string | null
  article_code: string | null
  article_name: string
  // Tjänst-fält (fakturarad)
  service_id: string | null
  service_code: string | null
  service_name: string | null
  // Gemensamma fält
  item_type: CaseBillingItemType
  /** Avtalsinnehåll (§ 6): premium = ingår i årspremien, per_year = egen rad på årsfakturan, per_round = tilläggsstation per kontrollrunda */
  billing_model?: 'premium' | 'per_year' | 'per_month' | 'per_round' | null
  /** § 6-rad för tilläggsstationer: enheten raden avser */
  site_customer_id?: string | null
  /** § 6-rad: första periodstart raden faktureras i (pro rata dessförinnan) */
  billing_start_date?: string | null
  /** Pro rata-rad för per år/månad-stationer på etableringsärendet */
  is_addon_prorata_line?: boolean | null
  /** Raden täcks av kundens avtal (§ 4) och faktureras inte som merförsäljning */
  covered_by_contract?: boolean | null
  /** Kundens avtalade pris per enhet från prislistan (ögonblicksbild). unit_price är alltid inköpspris. Null = inget kundpris. */
  customer_unit_price?: number | null
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
  rot_rut_type: RotRutType | null
  fastighetsbeteckning: string | null
  min_quantity: number | null
  /** För artikel-rader: case_billing_items.id för tjänsteraden som artikeln är mappad mot via Prisguiden. */
  mapped_service_id: string | null
  /** Besöket raden hör till (visits.id). Stämplas av create_visit_snapshot. null = rad utan besökskoppling. */
  visit_id?: string | null
  /** Besökets nummer i ärendet (1, 2, 3 ...). null när visit_id är null. */
  visit_number?: number | null
  /**
   * Avtalstillägg: årsbelopp (exkl moms) som läggs på kundens årspremie när
   * ärendet avslutas. Radens eget pris är pro rata-beloppet fram till nästa
   * fakturaperiod. null = vanlig rad.
   */
  contract_addition_annual?: number | null
  /**
   * Teknikerns motivering till rabatten - krävs vid ärendeavslut när
   * discount_percent > 0 (avtalstilläggsrader undantagna). Visas för
   * rabattansvarig vid godkännande.
   */
  discount_motivation?: string | null
  /**
   * Markör: raden är ärendets (enda) tilläggsstationsrad — skapad/synkad av
   * sync_addon_station_line (etablering) eller prefillAddonStationLine (runda).
   * Partiellt unikt index i DB garanterar max en per ärende. Identifiera
   * ALLTID tilläggsraden via denna, aldrig via namn eller service_id.
   */
  is_addon_station_line?: boolean
  created_at: string
  updated_at: string
}

/**
 * Case billing item med relationer
 */
export interface CaseBillingItemWithRelations extends CaseBillingItem {
  article?: Article | null
  service?: Service | null
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
  /** Kundpris från prislistan (avtalat, låst). Skrivs bara när kunden har artikeln i sin prislista. */
  customer_unit_price?: number | null
}

/**
 * Input för att lägga till tjänst till ärende (fakturarad)
 */
export interface AddCaseServiceInput {
  case_id: string
  case_type: BillableCaseType
  customer_id?: string | null
  service_id: string
  service_code?: string
  service_name: string
  quantity?: number
  unit_price: number
  discount_percent?: number
  vat_rate?: number
  added_by_technician_id?: string
  added_by_technician_name?: string
  notes?: string
  /** Tjänsten ingår i kundens avtal (§ 4): pris 0, faktureras aldrig */
  covered_by_contract?: boolean
}

/**
 * Input för att uppdatera case billing item
 */
export interface UpdateCaseArticleInput {
  quantity?: number
  discount_percent?: number
  notes?: string
  rot_rut_type?: RotRutType | null
  fastighetsbeteckning?: string | null
  min_quantity?: number | null
  mapped_service_id?: string | null
  /** Kundpris per enhet (t.ex. omräknat efter mängdrabatt vid nytt antal) */
  customer_unit_price?: number | null
}

/**
 * Artikel med effektivt pris (för UI).
 * `effective_price` är ALLTID inköpspriset (articles.default_price).
 * Om artikeln finns i kundens prislista sätts `price_source = 'customer_list'`,
 * `customer_price` bär kundpriset (custom_price eller lägsta tier) och
 * `quantity_tiers` kan innehålla mängdrabatt-stafflar.
 */
export interface ArticleWithEffectivePrice {
  article: Article
  effective_price: number
  price_source: PriceSource
  /** Kundens avtalade pris per enhet (null/undefined = inget kundpris) */
  customer_price?: number | null
  customer_discount_percent?: number
  quantity_tiers?: import('./articles').QuantityTier[] | null
}

/**
 * Grupperade artiklar per kategori (för UI)
 */
export interface ArticlesByCategory {
  category: ArticleCategory
  articles: ArticleWithEffectivePrice[]
}

/**
 * Override för anpassat pris på ärendenivå
 */
export interface CaseBillingOverride {
  id: string
  case_id: string
  case_type: BillableCaseType
  custom_total_price: number
  created_at: string
  updated_at: string
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
  rot_rut_deduction: number
  subcontractor_total: number
  custom_total_price: number | null
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

/**
 * ROT/RUT-avdragsprocent
 */
export const ROT_RUT_PERCENT: Record<RotRutType, number> = {
  ROT: 30,
  RUT: 50
}

/**
 * Beräkna ROT/RUT-avdrag på arbetskostnad
 */
export const calculateRotRutDeduction = (
  totalPrice: number,
  rotRutType: RotRutType | null
): number => {
  if (!rotRutType) return 0
  return totalPrice * (ROT_RUT_PERCENT[rotRutType] / 100)
}

/**
 * Beräkna marginalprocent: (försäljningspris - inköpspris) / försäljningspris * 100
 */
export const calculateMarginPercent = (
  sellingPrice: number,
  purchaseCost: number
): number => {
  if (sellingPrice <= 0) return 0
  return ((sellingPrice - purchaseCost) / sellingPrice) * 100
}

/**
 * Beräkna föreslagen försäljningspris baserat på påslag
 */
export const calculateSuggestedPrice = (
  purchaseCost: number,
  markupPercent: number
): number => {
  return purchaseCost * (1 + markupPercent / 100)
}

/**
 * Summering av tjänsterader (fakturarader)
 */
export interface ServiceItemsSummary {
  service_count: number
  subtotal: number
  vat_amount: number
  total_amount: number
}

/**
 * Summering av artikelrader (intern kalkyl)
 */
export interface ArticleItemsSummary {
  article_count: number
  total_purchase_cost: number
}

/**
 * Kombinerad summering för CaseServiceSelector
 */
export interface CaseServiceSummary {
  services: ServiceItemsSummary
  articles: ArticleItemsSummary
  /** Marginal år 1, alltså mot hela inköpet. Behålls för bakåtkompatibilitet. */
  margin_percent: number | null   // null om inga tjänster
  /** Mot huvudtalet: löpande på avtal, år 1 på ärenden */
  margin_ok: boolean
  /** Hela uppdelningen från motorn (src/shared/marginEngine.ts) */
  breakdown: MarginBreakdown
}

// ============================================
// ACKUMULERAT UTFALL PER AVTAL (avropsavtal)
// ============================================

/** Intern kostnadsrad, summerad per artikelnamn över flera ärenden */
export interface AccumulatedArticleLine {
  article_name: string
  quantity: number
  cost: number
  /** Varaktig utrustning: engångskostnad, räknas inte i löpande marginal */
  is_durable: boolean
}

/** Tjänst summerad över flera ärenden, med sina interna kostnader */
export interface AccumulatedServiceGroup {
  service_name: string
  /** Summerad kvantitet över alla ärenden (oftast = antal förekomster) */
  occurrences: number
  revenue: number
  articles: AccumulatedArticleLine[]
  cost: number
  margin_percent: number | null
  breakdown: MarginBreakdown
}

/**
 * Ackumulerat utfall från ärendenas faktureringsrader — § 5 på avropsavtal.
 * Källan är enbart case_billing_items (samma rader som ärendemodalerna
 * prissätter med); ärenden utan rader (gamla systemet) bidrar med noll.
 */
export interface AccumulatedCaseSummary {
  /** Antal ärenden som bidrog med minst en rad */
  case_count: number
  groups: AccumulatedServiceGroup[]
  /** Kostnadsrader utan tjänstekoppling, summerade per artikelnamn */
  unmapped_articles: AccumulatedArticleLine[]
  revenue: number
  cost: number
  margin_percent: number | null
  breakdown: MarginBreakdown
}

// ─────────────────────────────────────────────────────────────
// Kundpris på artiklar (avtalade priser, t.ex. LOU-prisbilaga)
// ─────────────────────────────────────────────────────────────

/** Artikelrad med kundpris från prislistan: låser priset på tjänsten den mappas mot */
export function hasCustomerPrice(
  item: Pick<CaseBillingItem, 'item_type' | 'customer_unit_price'>
): boolean {
  return item.item_type === 'article' && item.customer_unit_price != null
}

type SpecItem = Pick<CaseBillingItem, 'id' | 'item_type' | 'customer_unit_price' | 'mapped_service_id' | 'quantity' | 'article_name'> & {
  status?: string | null
  article?: { is_dosage_product?: boolean | null; dosage_unit?: string | null } | null
}

const specNumber = (n: number) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n)

/**
 * Specifikation för fakturaraden: "20 st Myrdosa à 18 kr" av de artiklar med
 * kundpris som är mappade mot tjänsteraden. Artiklar UTAN kundpris nämns
 * aldrig (interna produkter är inte kundens sak). Tom sträng = ingen spec.
 */
export function buildCustomerArticleSpec(serviceItemId: string, items: SpecItem[]): string {
  const parts: string[] = []
  for (const a of items) {
    if (a.item_type !== 'article' || a.customer_unit_price == null) continue
    if (a.mapped_service_id !== serviceItemId) continue
    if (a.status === 'cancelled') continue
    const unit = a.article?.is_dosage_product && a.article?.dosage_unit ? a.article.dosage_unit : null
    if (unit) {
      // Dosering lagras i grundenhet (g/ml/m); visa i kg/l/m när det blir läsbart
      const big = unit === 'g' ? { u: 'kg', f: 1000 } : unit === 'ml' ? { u: 'l', f: 1000 } : { u: unit, f: 1 }
      const qty = a.quantity / big.f
      const price = a.customer_unit_price * big.f
      parts.push(`${specNumber(qty)} ${big.u} ${a.article_name} à ${specNumber(price)} kr/${big.u}`)
    } else {
      parts.push(`${a.quantity} st ${a.article_name} à ${specNumber(a.customer_unit_price)} kr`)
    }
  }
  return parts.join(', ')
}

/** Radtext med specifikation: "Myrbekämpning, 20 st Myrdosa à 18 kr" */
export function appendCustomerArticleSpec(name: string, spec: string): string {
  return spec ? `${name}, ${spec}` : name
}
