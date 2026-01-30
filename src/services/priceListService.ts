// src/services/priceListService.ts
// Service för hantering av prislistor

import { supabase } from '../lib/supabase'
import {
  PriceList,
  CreatePriceListInput,
  UpdatePriceListInput,
  PriceListItem,
  PriceListItemWithArticle,
  UpsertPriceListItemInput
} from '../types/articles'

export class PriceListService {
  /**
   * Hämta alla prislistor
   */
  static async getAllPriceLists(): Promise<PriceList[]> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  /**
   * Hämta aktiva prislistor
   */
  static async getActivePriceLists(): Promise<PriceList[]> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  /**
   * Hämta standardprislistan
   */
  static async getDefaultPriceList(): Promise<PriceList | null> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .eq('is_default', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }

  /**
   * Hämta prislista via ID
   */
  static async getPriceListById(id: string): Promise<PriceList | null> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }

  /**
   * Skapa ny prislista
   */
  static async createPriceList(input: CreatePriceListInput): Promise<PriceList> {
    if (!input.name?.trim()) {
      throw new Error('Namn är obligatoriskt')
    }

    // Om denna ska vara default, ta bort default från andra
    if (input.is_default) {
      await supabase
        .from('price_lists')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('price_lists')
      .insert({
        name: input.name.trim(),
        description: input.description || null,
        is_default: input.is_default ?? false,
        is_active: input.is_active ?? true,
        valid_from: input.valid_from || null,
        valid_to: input.valid_to || null
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Uppdatera prislista
   */
  static async updatePriceList(id: string, input: UpdatePriceListInput): Promise<PriceList> {
    // Om denna ska bli default, ta bort default från andra först
    if (input.is_default === true) {
      await supabase
        .from('price_lists')
        .update({ is_default: false })
        .neq('id', id)
        .eq('is_default', true)
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.description !== undefined) updateData.description = input.description
    if (input.is_default !== undefined) updateData.is_default = input.is_default
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    if (input.valid_from !== undefined) updateData.valid_from = input.valid_from
    if (input.valid_to !== undefined) updateData.valid_to = input.valid_to

    const { data, error } = await supabase
      .from('price_lists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Ta bort prislista
   */
  static async deletePriceList(id: string): Promise<void> {
    // Kontrollera om det är standardprislistan
    const priceList = await this.getPriceListById(id)
    if (priceList?.is_default) {
      throw new Error('Kan inte ta bort standardprislistan')
    }

    const { error } = await supabase
      .from('price_lists')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Hämta alla artikelpriser för en prislista
   */
  static async getPriceListItems(priceListId: string): Promise<PriceListItemWithArticle[]> {
    const { data, error } = await supabase
      .from('price_list_items')
      .select(`
        *,
        article:articles(*)
      `)
      .eq('price_list_id', priceListId)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as PriceListItemWithArticle[]
  }

  /**
   * Uppdatera eller skapa artikelpris i prislista
   */
  static async upsertPriceListItem(input: UpsertPriceListItemInput): Promise<PriceListItem> {
    const { data, error } = await supabase
      .from('price_list_items')
      .upsert({
        price_list_id: input.price_list_id,
        article_id: input.article_id,
        custom_price: input.custom_price,
        discount_percent: input.discount_percent ?? 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'price_list_id,article_id'
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Ta bort artikelpris från prislista
   */
  static async removePriceListItem(priceListId: string, articleId: string): Promise<void> {
    const { error } = await supabase
      .from('price_list_items')
      .delete()
      .eq('price_list_id', priceListId)
      .eq('article_id', articleId)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Kopiera prislista med alla artikelpriser
   */
  static async copyPriceList(sourceId: string, newName: string): Promise<PriceList> {
    // Skapa ny prislista
    const source = await this.getPriceListById(sourceId)
    if (!source) throw new Error('Källprislistan hittades inte')

    const newPriceList = await this.createPriceList({
      name: newName,
      description: source.description ? `Kopia av ${source.name}: ${source.description}` : `Kopia av ${source.name}`,
      is_default: false,
      is_active: true
    })

    // Kopiera alla artikelpriser
    const sourceItems = await this.getPriceListItems(sourceId)
    for (const item of sourceItems) {
      await this.upsertPriceListItem({
        price_list_id: newPriceList.id,
        article_id: item.article_id,
        custom_price: item.custom_price,
        discount_percent: item.discount_percent
      })
    }

    return newPriceList
  }

  /**
   * Räkna antal artiklar i prislistan
   */
  static async getItemCount(priceListId: string): Promise<number> {
    const { count, error } = await supabase
      .from('price_list_items')
      .select('*', { count: 'exact', head: true })
      .eq('price_list_id', priceListId)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return count || 0
  }

  /**
   * Hämta alla prislistor som en artikel finns i
   * Returnerar en map: { articleId: [{ priceList, customPrice }] }
   */
  static async getPriceListsByArticles(): Promise<Record<string, Array<{ priceList: PriceList; customPrice: number | null }>>> {
    // Hämta alla prislistor
    const priceLists = await this.getAllPriceLists()
    const priceListMap = new Map(priceLists.map(pl => [pl.id, pl]))

    // Hämta alla price_list_items
    const { data: items, error } = await supabase
      .from('price_list_items')
      .select('article_id, price_list_id, custom_price')

    if (error) throw new Error(`Databasfel: ${error.message}`)

    // Bygg upp mappningen
    const result: Record<string, Array<{ priceList: PriceList; customPrice: number | null }>> = {}

    for (const item of items || []) {
      const priceList = priceListMap.get(item.price_list_id)
      if (!priceList) continue

      if (!result[item.article_id]) {
        result[item.article_id] = []
      }

      result[item.article_id].push({
        priceList,
        customPrice: item.custom_price
      })
    }

    // Sortera så att standardprislistan kommer först
    for (const articleId in result) {
      result[articleId].sort((a, b) => {
        if (a.priceList.is_default && !b.priceList.is_default) return -1
        if (!a.priceList.is_default && b.priceList.is_default) return 1
        return a.priceList.name.localeCompare(b.priceList.name)
      })
    }

    return result
  }
}
