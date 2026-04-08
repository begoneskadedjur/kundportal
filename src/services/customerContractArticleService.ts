// src/services/customerContractArticleService.ts
// Hanterar avtalsartiklar per kund – vilka artiklar som faktiskt ingår i kundens avtal

import { supabase } from '../lib/supabase'
import type {
  CustomerContractArticle,
  CustomerContractArticleWithArticle,
} from '../types/articles'

export class CustomerContractArticleService {
  /**
   * Hämta kundens avtalsartiklar med artikeldetaljer och listpris från kundens prislista
   */
  static async getArticles(customerId: string): Promise<CustomerContractArticleWithArticle[]> {
    // 1. Hämta avtalsartiklar med artikeldata
    const { data: rows, error } = await supabase
      .from('customer_contract_articles')
      .select(`
        *,
        article:articles(*)
      `)
      .eq('customer_id', customerId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Kunde inte hämta avtalsartiklar: ${error.message}`)
    if (!rows || rows.length === 0) return []

    // 2. Hämta kundens prislista för att slå upp listpriser
    const { data: customer } = await supabase
      .from('customers')
      .select('price_list_id')
      .eq('id', customerId)
      .single()

    let listPriceMap: Record<string, number> = {}

    if (customer?.price_list_id) {
      const { data: priceItems } = await supabase
        .from('price_list_items')
        .select('article_id, custom_price')
        .eq('price_list_id', customer.price_list_id)

      if (priceItems) {
        for (const item of priceItems) {
          listPriceMap[item.article_id] = item.custom_price
        }
      }
    }

    // 3. Injicera list_price
    return rows.map((row: any) => ({
      ...row,
      list_price: listPriceMap[row.article_id] ?? row.article?.default_price ?? 0,
    })) as CustomerContractArticleWithArticle[]
  }

  /**
   * Spara kundens avtalsartiklar (bulk upsert + ta bort borttagna)
   */
  static async saveArticles(
    customerId: string,
    articles: Array<{
      article_id: string
      quantity: number
      fixed_price: number | null
      sort_order: number
    }>
  ): Promise<void> {
    // Ta bort alla befintliga och ersätt med nya (enklast för bulk-uppdatering)
    const { error: deleteError } = await supabase
      .from('customer_contract_articles')
      .delete()
      .eq('customer_id', customerId)

    if (deleteError) throw new Error(`Kunde inte rensa avtalsartiklar: ${deleteError.message}`)

    if (articles.length === 0) return

    const rows = articles.map(a => ({
      customer_id: customerId,
      article_id: a.article_id,
      quantity: a.quantity,
      fixed_price: a.fixed_price,
      sort_order: a.sort_order,
    }))

    const { error: insertError } = await supabase
      .from('customer_contract_articles')
      .insert(rows)

    if (insertError) throw new Error(`Kunde inte spara avtalsartiklar: ${insertError.message}`)
  }

  /**
   * Beräkna årsbelopp från avtalsartiklar
   * Rad-total = (fixed_price ?? list_price) × quantity
   * Applicera ev. premiejustering
   */
  static calculateAnnualValue(
    articles: CustomerContractArticleWithArticle[],
    adjustmentPercent = 0
  ): number {
    const base = articles.reduce((sum, ca) => {
      const unitPrice = ca.fixed_price != null ? ca.fixed_price : ca.list_price
      return sum + unitPrice * ca.quantity
    }, 0)

    if (adjustmentPercent === 0) return Math.round(base)
    return Math.round(base * (1 + adjustmentPercent / 100))
  }

  /**
   * Beräkna radtotal för en enskild rad
   */
  static calcLineTotal(
    listPrice: number,
    quantity: number,
    fixedPrice: number | null
  ): number {
    if (fixedPrice != null) return fixedPrice
    return listPrice * quantity
  }
}
