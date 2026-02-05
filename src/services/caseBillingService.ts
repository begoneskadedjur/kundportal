// src/services/caseBillingService.ts
// Service för hantering av ärendebaserad fakturering (artiklar tekniker väljer per ärende)

import { supabase } from '../lib/supabase'
import type { Article } from '../types/articles'
import type {
  CaseBillingItem,
  CaseBillingItemWithRelations,
  AddCaseArticleInput,
  UpdateCaseArticleInput,
  ArticleWithEffectivePrice,
  ArticlesByCategory,
  CaseBillingSummary,
  BillableCaseType,
  PriceSource,
  CaseBillingItemStatus
} from '../types/caseBilling'
import {
  calculateDiscountedPrice,
  calculateTotalPrice,
  calculateVatAmount,
  itemRequiresApproval
} from '../types/caseBilling'
import { PriceListService } from './priceListService'

export class CaseBillingService {
  /**
   * Hämta alla aktiva artiklar med effektivt pris för en kund
   * Prisupplösning sker i följande ordning (fallback-kedja):
   * 1. Kundens prislista (om kunden har en och artikeln finns där)
   * 2. Standardprislistan (om artikeln finns där)
   * 3. Artikelns default_price
   */
  static async getArticlesWithPrices(customerId?: string | null): Promise<ArticleWithEffectivePrice[]> {
    // Hämta alla aktiva artiklar
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    if (!articles || articles.length === 0) return []

    // Hämta kundens prislista om customerId anges
    let customerPriceListId: string | null = null
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('price_list_id')
        .eq('id', customerId)
        .single()

      customerPriceListId = customer?.price_list_id || null
    }

    // Hämta standardprislistan
    const defaultPriceList = await PriceListService.getDefaultPriceList()

    // Hämta kundens prislisteposter (om kunden har prislista)
    let customerPriceItems: Record<string, number> = {}
    if (customerPriceListId) {
      const items = await PriceListService.getPriceListItems(customerPriceListId)
      customerPriceItems = items.reduce((acc, item) => {
        acc[item.article_id] = item.custom_price
        return acc
      }, {} as Record<string, number>)
    }

    // Hämta standardprislistans priser (fallback)
    let standardPriceItems: Record<string, number> = {}
    if (defaultPriceList) {
      const items = await PriceListService.getPriceListItems(defaultPriceList.id)
      standardPriceItems = items.reduce((acc, item) => {
        acc[item.article_id] = item.custom_price
        return acc
      }, {} as Record<string, number>)
    }

    // Bygg resultatet med fallback-kedja:
    // 1. Kundpris → 2. Standardpris → 3. Artikelns default_price
    return articles.map((article: Article) => {
      // Kolla om artikeln finns i kundens prislista
      if (customerPriceListId && customerPriceItems[article.id] !== undefined) {
        return {
          article,
          effective_price: customerPriceItems[article.id],
          price_source: 'customer_list' as PriceSource
        }
      }

      // Kolla om artikeln finns i standardprislistan
      if (standardPriceItems[article.id] !== undefined) {
        return {
          article,
          effective_price: standardPriceItems[article.id],
          price_source: 'standard' as PriceSource
        }
      }

      // Fallback till artikelns default_price
      return {
        article,
        effective_price: article.default_price,
        price_source: 'standard' as PriceSource
      }
    })
  }

  /**
   * Hämta artiklar grupperade per kategori
   */
  static async getArticlesByCategory(customerId?: string | null): Promise<ArticlesByCategory[]> {
    const articles = await this.getArticlesWithPrices(customerId)

    // Gruppera per kategori
    const grouped = articles.reduce((acc, item) => {
      const category = item.article.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {} as Record<string, ArticleWithEffectivePrice[]>)

    // Konvertera till array
    return Object.entries(grouped).map(([category, items]) => ({
      category: category as Article['category'],
      articles: items
    }))
  }

  /**
   * Hämta effektivt pris för en artikel baserat på kund
   */
  static async getEffectivePrice(
    articleId: string,
    customerId?: string | null
  ): Promise<{ price: number; source: PriceSource }> {
    // Hämta artikeln
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      throw new Error('Artikel hittades inte')
    }

    // Kolla kundens prislista först
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('price_list_id')
        .eq('id', customerId)
        .single()

      if (customer?.price_list_id) {
        const { data: priceItem } = await supabase
          .from('price_list_items')
          .select('custom_price')
          .eq('price_list_id', customer.price_list_id)
          .eq('article_id', articleId)
          .single()

        if (priceItem) {
          return { price: priceItem.custom_price, source: 'customer_list' }
        }
      }
    }

    // Fallback till standardprislista
    const defaultPriceList = await PriceListService.getDefaultPriceList()
    if (defaultPriceList) {
      const { data: priceItem } = await supabase
        .from('price_list_items')
        .select('custom_price')
        .eq('price_list_id', defaultPriceList.id)
        .eq('article_id', articleId)
        .single()

      if (priceItem) {
        return { price: priceItem.custom_price, source: 'standard' }
      }
    }

    // Fallback till artikelns default_price
    return { price: article.default_price, source: 'standard' }
  }

  /**
   * Lägg till artikel till ärende
   */
  static async addArticleToCase(input: AddCaseArticleInput): Promise<CaseBillingItem> {
    const quantity = input.quantity ?? 1
    const discountPercent = input.discount_percent ?? 0
    const vatRate = input.vat_rate ?? 25

    // Beräkna priser
    const discountedPrice = calculateDiscountedPrice(input.unit_price, discountPercent)
    const totalPrice = calculateTotalPrice(discountedPrice, quantity)

    const { data, error } = await supabase
      .from('case_billing_items')
      .insert({
        case_id: input.case_id,
        case_type: input.case_type,
        customer_id: input.customer_id || null,
        article_id: input.article_id,
        article_code: input.article_code || null,
        article_name: input.article_name,
        quantity,
        unit_price: input.unit_price,
        discount_percent: discountPercent,
        discounted_price: discountedPrice,
        total_price: totalPrice,
        vat_rate: vatRate,
        price_source: input.price_source || 'standard',
        added_by_technician_id: input.added_by_technician_id || null,
        added_by_technician_name: input.added_by_technician_name || null,
        status: 'pending',
        requires_approval: itemRequiresApproval(discountPercent),
        notes: input.notes || null
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Uppdatera case billing item
   */
  static async updateCaseArticle(
    id: string,
    input: UpdateCaseArticleInput
  ): Promise<CaseBillingItem> {
    // Hämta befintlig post först
    const { data: existing, error: fetchError } = await supabase
      .from('case_billing_items')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      throw new Error('Post hittades inte')
    }

    const quantity = input.quantity ?? existing.quantity
    const discountPercent = input.discount_percent ?? existing.discount_percent

    // Beräkna nya priser
    const discountedPrice = calculateDiscountedPrice(existing.unit_price, discountPercent)
    const totalPrice = calculateTotalPrice(discountedPrice, quantity)

    const { data, error } = await supabase
      .from('case_billing_items')
      .update({
        quantity,
        discount_percent: discountPercent,
        discounted_price: discountedPrice,
        total_price: totalPrice,
        requires_approval: itemRequiresApproval(discountPercent),
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Ta bort case billing item
   */
  static async removeCaseArticle(id: string): Promise<void> {
    const { error } = await supabase
      .from('case_billing_items')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Hämta alla billing items för ett ärende
   */
  static async getCaseBillingItems(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<CaseBillingItemWithRelations[]> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select(`
        *,
        article:articles(*)
      `)
      .eq('case_id', caseId)
      .eq('case_type', caseType)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as CaseBillingItemWithRelations[]
  }

  /**
   * Hämta summering för ett ärendes billing items
   */
  static async getCaseBillingSummary(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<CaseBillingSummary> {
    const items = await this.getCaseBillingItems(caseId, caseType)

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const totalDiscount = items.reduce((sum, item) => {
      const fullPrice = item.unit_price * item.quantity
      return sum + (fullPrice - item.total_price)
    }, 0)
    const vatAmount = items.reduce((sum, item) => {
      return sum + calculateVatAmount(item.total_price, item.vat_rate)
    }, 0)
    const requiresApproval = items.some(item => item.requires_approval)

    return {
      item_count: items.length,
      subtotal,
      total_discount: totalDiscount,
      vat_amount: vatAmount,
      total_amount: subtotal + vatAmount,
      requires_approval: requiresApproval
    }
  }

  /**
   * Uppdatera status för alla items i ett ärende
   */
  static async updateCaseItemsStatus(
    caseId: string,
    caseType: BillableCaseType,
    status: CaseBillingItemStatus
  ): Promise<void> {
    const { error } = await supabase
      .from('case_billing_items')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('case_id', caseId)
      .eq('case_type', caseType)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Godkänn rabatt för en item
   */
  static async approveDiscount(id: string): Promise<CaseBillingItem> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .update({
        requires_approval: false,
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Hämta items som kräver godkännande
   */
  static async getItemsRequiringApproval(): Promise<CaseBillingItemWithRelations[]> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select(`
        *,
        article:articles(*)
      `)
      .eq('requires_approval', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as CaseBillingItemWithRelations[]
  }

  /**
   * Kontrollera om ett ärende har billing items
   */
  static async caseHasBillingItems(
    caseId: string,
    caseType: BillableCaseType
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('case_billing_items')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('case_type', caseType)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (count || 0) > 0
  }
}
