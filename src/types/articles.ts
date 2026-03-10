// src/types/articles.ts
// TypeScript-typer för artikelhantering och prislistor

/**
 * Tillgängliga enheter för artiklar
 */
export type ArticleUnit = 'st' | 'timme' | 'm2' | 'kg' | 'l' | 'dag' | 'månad' | 'fp' | 'm'

/**
 * Doseringsenhet för produkter som doseras i gram eller ml
 */
export type DosageUnit = 'g' | 'ml' | 'm'

/**
 * Artikelkategorier
 */
export type ArticleCategory = 'Inspektion' | 'Bekämpning' | 'Tillbehör' | 'Arbetstid' | 'Övrigt'

/**
 * Artikelgrupp från databasen
 */
export interface ArticleGroup {
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

/**
 * Input för att skapa ny artikelgrupp
 */
export interface CreateArticleGroupInput {
  name: string
  slug?: string
  description?: string
  color?: string
  icon?: string
  sort_order?: number
}

/**
 * Input för att uppdatera artikelgrupp
 */
export interface UpdateArticleGroupInput {
  name?: string
  description?: string | null
  color?: string
  icon?: string
  sort_order?: number
  is_active?: boolean
}

/**
 * Artikel från databasen
 */
export interface Article {
  id: string
  code: string
  name: string
  description: string | null
  unit: ArticleUnit
  default_price: number
  recommended_price: number | null
  vat_rate: number
  category: ArticleCategory
  group_id: string | null
  is_active: boolean
  sort_order: number
  fortnox_article_id: string | null
  rot_eligible: boolean
  rut_eligible: boolean
  pack_size: number | null
  pack_price: number | null
  is_dosage_product: boolean
  dosage_unit: DosageUnit | null
  total_content: number | null
  created_at: string
  updated_at: string
}

/**
 * Artikel med grupper (many-to-many via junction-tabell)
 */
export interface ArticleWithGroup extends Article {
  group?: ArticleGroup | null
  groups?: Array<{ group: ArticleGroup }> | null
}

/**
 * Membership i junction-tabellen article_group_memberships
 */
export interface ArticleGroupMembership {
  id: string
  article_id: string
  group_id: string
  created_at: string
}

/**
 * Hjälpfunktion: hämta platta grupper från ArticleWithGroup
 */
export const getArticleGroups = (article: ArticleWithGroup): ArticleGroup[] => {
  if (article.groups && article.groups.length > 0) {
    return article.groups.map(m => m.group).filter(Boolean)
  }
  if (article.group) {
    return [article.group]
  }
  return []
}

/**
 * Input för att skapa ny artikel
 */
export interface CreateArticleInput {
  code: string
  name: string
  description?: string
  unit: ArticleUnit
  default_price: number
  vat_rate?: number
  category: ArticleCategory
  group_id?: string | null
  is_active?: boolean
  sort_order?: number
  fortnox_article_id?: string
  rot_eligible?: boolean
  rut_eligible?: boolean
  pack_size?: number | null
  pack_price?: number | null
  is_dosage_product?: boolean
  dosage_unit?: DosageUnit | null
  total_content?: number | null
}

/**
 * Input för att uppdatera artikel
 */
export interface UpdateArticleInput {
  name?: string
  description?: string | null
  unit?: ArticleUnit
  default_price?: number
  vat_rate?: number
  category?: ArticleCategory
  group_id?: string | null
  is_active?: boolean
  sort_order?: number
  fortnox_article_id?: string | null
  recommended_price?: number | null
  rot_eligible?: boolean
  rut_eligible?: boolean
  pack_size?: number | null
  pack_price?: number | null
  is_dosage_product?: boolean
  dosage_unit?: DosageUnit | null
  total_content?: number | null
}

/**
 * Prislista från databasen
 */
export interface PriceList {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  created_at: string
  updated_at: string
}

/**
 * Input för att skapa ny prislista
 */
export interface CreatePriceListInput {
  name: string
  description?: string
  is_default?: boolean
  is_active?: boolean
  valid_from?: string
  valid_to?: string
}

/**
 * Input för att uppdatera prislista
 */
export interface UpdatePriceListInput {
  name?: string
  description?: string | null
  is_default?: boolean
  is_active?: boolean
  valid_from?: string | null
  valid_to?: string | null
}

/**
 * Prislistepost från databasen
 */
export interface PriceListItem {
  id: string
  price_list_id: string
  article_id: string
  custom_price: number
  discount_percent: number
  created_at: string
  updated_at: string
}

/**
 * Prislistepost med artikeldata
 */
export interface PriceListItemWithArticle extends PriceListItem {
  article: Article
}

/**
 * Input för att skapa/uppdatera prislistepost
 */
export interface UpsertPriceListItemInput {
  price_list_id: string
  article_id: string
  custom_price: number
  discount_percent?: number
}

/**
 * Konfiguration för artikelenheter
 */
export const ARTICLE_UNIT_CONFIG: Record<ArticleUnit, {
  label: string
  shortLabel: string
}> = {
  st: { label: 'Styck', shortLabel: 'st' },
  timme: { label: 'Timme', shortLabel: 'tim' },
  m2: { label: 'Kvadratmeter', shortLabel: 'm²' },
  kg: { label: 'Kilogram', shortLabel: 'kg' },
  l: { label: 'Liter', shortLabel: 'l' },
  dag: { label: 'Dag', shortLabel: 'dag' },
  månad: { label: 'Månad', shortLabel: 'mån' },
  fp: { label: 'Förpackning', shortLabel: 'fp' },
  m: { label: 'Meter', shortLabel: 'm' }
}

/**
 * Konfiguration för artikelkategorier
 */
export const ARTICLE_CATEGORY_CONFIG: Record<ArticleCategory, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  Inspektion: {
    label: 'Inspektion',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50'
  },
  Bekämpning: {
    label: 'Bekämpning',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50'
  },
  Tillbehör: {
    label: 'Tillbehör',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50'
  },
  Arbetstid: {
    label: 'Arbetstid',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/50'
  },
  Övrigt: {
    label: 'Övrigt',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/50'
  }
}

/**
 * Alla tillgängliga enheter som array
 */
export const ARTICLE_UNITS: ArticleUnit[] = ['st', 'timme', 'm2', 'kg', 'l', 'dag', 'månad', 'fp', 'm']

/**
 * Alla tillgängliga kategorier som array
 */
export const ARTICLE_CATEGORIES: ArticleCategory[] = ['Inspektion', 'Bekämpning', 'Tillbehör', 'Arbetstid', 'Övrigt']

/**
 * Beräkna pris med moms
 */
export const calculatePriceWithVat = (price: number, vatRate: number): number => {
  return price * (1 + vatRate / 100)
}

/**
 * Formatera pris för visning
 */
export const formatArticlePrice = (price: number, includeVat: boolean = false, vatRate: number = 25): string => {
  const finalPrice = includeVat ? calculatePriceWithVat(price, vatRate) : price
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(finalPrice)
}

/**
 * Hämta effektivt pris för en artikel givet en prislista
 */
export const getEffectivePrice = (
  article: Article,
  priceListItem?: PriceListItem | null
): number => {
  if (priceListItem) {
    return priceListItem.custom_price
  }
  return article.default_price
}

/**
 * Generera artikelkod från namn
 */
/**
 * Konfiguration för doseringsenheter
 */
export const DOSAGE_UNIT_CONFIG: Record<DosageUnit, {
  label: string
  shortLabel: string
}> = {
  g: { label: 'Gram', shortLabel: 'g' },
  ml: { label: 'Milliliter', shortLabel: 'ml' },
  m: { label: 'Meter', shortLabel: 'm' }
}

/**
 * Beräkna doseringspris (pris per doseringsenhet × mängd)
 */
export const calculateDosagePrice = (
  effectivePrice: number,
  totalContent: number,
  dosageAmount: number
): number => {
  if (totalContent <= 0) return 0
  return (effectivePrice / totalContent) * dosageAmount
}

/**
 * Beräkna pris per doseringsenhet
 */
export const calculatePricePerDosageUnit = (
  effectivePrice: number,
  totalContent: number
): number => {
  if (totalContent <= 0) return 0
  return effectivePrice / totalContent
}

export const generateArticleCode = (name: string, category: ArticleCategory): string => {
  const prefix = {
    Inspektion: 'INS',
    Bekämpning: 'BEK',
    Tillbehör: 'TIL',
    Arbetstid: 'ARB',
    Övrigt: 'OVR'
  }[category]

  // Ta första 3 bokstäver från namnet (versaler, utan specialtecken)
  const namePart = name
    .toUpperCase()
    .replace(/[^A-ZÅÄÖ]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X')

  return `${prefix}-${namePart}`
}
