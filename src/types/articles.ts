// src/types/articles.ts
// TypeScript-typer för artikelhantering och prislistor

/**
 * Tillgängliga enheter för artiklar
 */
export type ArticleUnit = 'st' | 'timme' | 'm2' | 'kg' | 'l' | 'dag' | 'månad'

/**
 * Artikelkategorier
 */
export type ArticleCategory = 'Inspektion' | 'Bekämpning' | 'Tillbehör' | 'Övrigt'

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
  vat_rate: number
  category: ArticleCategory
  is_active: boolean
  sort_order: number
  fortnox_article_id: string | null
  created_at: string
  updated_at: string
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
  is_active?: boolean
  sort_order?: number
  fortnox_article_id?: string
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
  is_active?: boolean
  sort_order?: number
  fortnox_article_id?: string | null
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
  månad: { label: 'Månad', shortLabel: 'mån' }
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
export const ARTICLE_UNITS: ArticleUnit[] = ['st', 'timme', 'm2', 'kg', 'l', 'dag', 'månad']

/**
 * Alla tillgängliga kategorier som array
 */
export const ARTICLE_CATEGORIES: ArticleCategory[] = ['Inspektion', 'Bekämpning', 'Tillbehör', 'Övrigt']

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
export const generateArticleCode = (name: string, category: ArticleCategory): string => {
  const prefix = {
    Inspektion: 'INS',
    Bekämpning: 'BEK',
    Tillbehör: 'TIL',
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
