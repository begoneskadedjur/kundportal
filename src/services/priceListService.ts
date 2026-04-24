// src/services/priceListService.ts
// Service för hantering av prislistor
//
// Prislistor prissätter TJÄNSTER som kunden köper utöver sitt avtal.
// Artikel-rader i price_list_items finns kvar som historik men skrivs inte längre.
// När kunden saknar fast pris för en tjänst används prisguiden (PriceCalculatorPanel)
// som fallback (markup på interna artiklar).

import { supabase } from '../lib/supabase'
import {
  PriceList,
  CreatePriceListInput,
  UpdatePriceListInput,
  PriceListItem,
  PriceListItemWithService,
  PriceListItemWithArticle,
  UpsertPriceListServiceInput,
  UpsertPriceListItemInput,
  QuantityTier
} from '../types/articles'

export class PriceListService {
  static async getAllPriceLists(): Promise<PriceList[]> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

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

  static async getDefaultPriceList(): Promise<PriceList | null> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .eq('is_default', true)
      .maybeSingle()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  static async getPriceListById(id: string): Promise<PriceList | null> {
    const { data, error } = await supabase
      .from('price_lists')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  static async createPriceList(input: CreatePriceListInput): Promise<PriceList> {
    if (!input.name?.trim()) throw new Error('Namn är obligatoriskt')

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

  static async updatePriceList(id: string, input: UpdatePriceListInput): Promise<PriceList> {
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

  static async deletePriceList(id: string): Promise<void> {
    const priceList = await this.getPriceListById(id)
    if (priceList?.is_default) throw new Error('Kan inte ta bort standardprislistan')

    // Räkna kopplade kunder + avtal för tydligt felmeddelande
    const [{ count: customerCount }, { count: contractCount }] = await Promise.all([
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('price_list_id', id),
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('price_list_id', id)
    ])

    if ((customerCount ?? 0) > 0 || (contractCount ?? 0) > 0) {
      const parts = []
      if ((customerCount ?? 0) > 0) parts.push(`${customerCount} kund(er)`)
      if ((contractCount ?? 0) > 0) parts.push(`${contractCount} avtal`)
      throw new Error(`Prislistan används av ${parts.join(' och ')}. Koppla bort dessa först.`)
    }

    const { error } = await supabase.from('price_list_items').delete().eq('price_list_id', id)
    if (error) throw new Error(`Databasfel vid rensning av poster: ${error.message}`)

    const { error: deleteError } = await supabase.from('price_lists').delete().eq('id', id)
    if (deleteError) throw new Error(`Databasfel: ${deleteError.message}`)
  }

  // ============================================================
  // TJÄNSTE-rader (nytt flöde)
  // ============================================================

  /** Hämta tjänstepriser i en prislista */
  static async getPriceListServiceItems(priceListId: string): Promise<PriceListItemWithService[]> {
    const { data, error } = await supabase
      .from('price_list_items')
      .select(`
        *,
        service:services(id, code, name, base_price, group_id, is_active)
      `)
      .eq('price_list_id', priceListId)
      .not('service_id', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as PriceListItemWithService[]
  }

  /** Skapa/uppdatera en tjänsterad i prislistan */
  static async upsertPriceListServiceItem(input: UpsertPriceListServiceInput): Promise<PriceListItem> {
    const { data: existing } = await supabase
      .from('price_list_items')
      .select('id')
      .eq('price_list_id', input.price_list_id)
      .eq('service_id', input.service_id)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('price_list_items')
        .update({
          custom_price: input.custom_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw new Error(`Databasfel: ${error.message}`)
      return data
    }

    const { data, error } = await supabase
      .from('price_list_items')
      .insert({
        price_list_id: input.price_list_id,
        service_id: input.service_id,
        article_id: null,
        custom_price: input.custom_price
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /** Bulk-upsert tjänsterader (ett DB-anrop) */
  static async bulkUpsertServiceItems(items: UpsertPriceListServiceInput[]): Promise<void> {
    if (items.length === 0) return

    // Hämta befintliga för att skilja insert från update
    const priceListIds = [...new Set(items.map(i => i.price_list_id))]
    const { data: existing } = await supabase
      .from('price_list_items')
      .select('id, price_list_id, service_id')
      .in('price_list_id', priceListIds)
      .not('service_id', 'is', null)

    const existingMap = new Map<string, string>()
    for (const row of existing || []) {
      if (row.service_id) existingMap.set(`${row.price_list_id}:${row.service_id}`, row.id)
    }

    const now = new Date().toISOString()
    const updates: { id: string; custom_price: number }[] = []
    const inserts: {
      price_list_id: string
      service_id: string
      article_id: null
      custom_price: number
    }[] = []

    for (const item of items) {
      const key = `${item.price_list_id}:${item.service_id}`
      const existingId = existingMap.get(key)
      if (existingId) {
        updates.push({ id: existingId, custom_price: item.custom_price })
      } else {
        inserts.push({
          price_list_id: item.price_list_id,
          service_id: item.service_id,
          article_id: null,
          custom_price: item.custom_price
        })
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('price_list_items').insert(inserts)
      if (error) throw new Error(`Databasfel (insert): ${error.message}`)
    }

    for (const upd of updates) {
      const { error } = await supabase
        .from('price_list_items')
        .update({ custom_price: upd.custom_price, updated_at: now })
        .eq('id', upd.id)
      if (error) throw new Error(`Databasfel (update): ${error.message}`)
    }
  }

  /** Ta bort en tjänsterad från prislistan */
  static async removePriceListServiceItem(priceListId: string, serviceId: string): Promise<void> {
    const { error } = await supabase
      .from('price_list_items')
      .delete()
      .eq('price_list_id', priceListId)
      .eq('service_id', serviceId)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Hämta effektivt pris för en TJÄNST för en given kund.
   * Returnerar null om inget fast pris finns → anropare använder prisguide som fallback.
   */
  static async getEffectiveServicePrice(
    serviceId: string,
    customerId?: string | null
  ): Promise<{ price: number; source: 'customer_list' | 'default' } | null> {
    // 1. Kundens prislista
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('price_list_id')
        .eq('id', customerId)
        .maybeSingle()

      if (customer?.price_list_id) {
        const { data: priceItem } = await supabase
          .from('price_list_items')
          .select('custom_price')
          .eq('price_list_id', customer.price_list_id)
          .eq('service_id', serviceId)
          .maybeSingle()

        if (priceItem) return { price: priceItem.custom_price, source: 'customer_list' }
      }
    }

    // 2. Standardprislista
    const defaultList = await this.getDefaultPriceList()
    if (defaultList) {
      const { data: priceItem } = await supabase
        .from('price_list_items')
        .select('custom_price')
        .eq('price_list_id', defaultList.id)
        .eq('service_id', serviceId)
        .maybeSingle()

      if (priceItem) return { price: priceItem.custom_price, source: 'default' }
    }

    return null
  }

  /**
   * Hämta alla fasta tjänstepriser för en kund som map {service_id: price}.
   * Används av konsumenter som laddar flera tjänster samtidigt.
   */
  static async getCustomerServicePrices(customerId: string): Promise<Record<string, number>> {
    const { data: customer } = await supabase
      .from('customers')
      .select('price_list_id')
      .eq('id', customerId)
      .maybeSingle()

    if (!customer?.price_list_id) return {}

    const { data: items } = await supabase
      .from('price_list_items')
      .select('service_id, custom_price')
      .eq('price_list_id', customer.price_list_id)
      .not('service_id', 'is', null)

    const map: Record<string, number> = {}
    for (const item of items || []) {
      if (item.service_id) map[item.service_id] = item.custom_price
    }
    return map
  }

  // ============================================================
  // ARTIKEL-rader (historik — visas i UI men skrivs inte av nya flöden)
  // ============================================================

  /** Hämta artikelpriser i en prislista (historik/legacy) */
  static async getPriceListItems(priceListId: string): Promise<PriceListItemWithArticle[]> {
    const { data, error } = await supabase
      .from('price_list_items')
      .select(`
        *,
        article:articles(*)
      `)
      .eq('price_list_id', priceListId)
      .not('article_id', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return (data || []) as PriceListItemWithArticle[]
  }

  /**
   * Skapa/uppdatera en artikelrad i prislistan.
   *
   * Obs: DB:ns unique-index för (price_list_id, article_id) är partiell
   * (WHERE article_id IS NOT NULL), vilket PostgREST/supabase-js inte kan
   * hantera via onConflict. Därför gör vi en check-then-insert-or-update
   * manuellt (samma mönster som upsertPriceListServiceItem).
   */
  static async upsertPriceListItem(input: UpsertPriceListItemInput): Promise<PriceListItem> {
    const { data: existing } = await supabase
      .from('price_list_items')
      .select('id')
      .eq('price_list_id', input.price_list_id)
      .eq('article_id', input.article_id)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('price_list_items')
        .update({
          custom_price: input.custom_price,
          discount_percent: input.discount_percent ?? 0,
          quantity_tiers: input.quantity_tiers ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw new Error(`Databasfel: ${error.message}`)
      return data
    }

    const { data, error } = await supabase
      .from('price_list_items')
      .insert({
        price_list_id: input.price_list_id,
        article_id: input.article_id,
        service_id: null,
        custom_price: input.custom_price,
        discount_percent: input.discount_percent ?? 0,
        quantity_tiers: input.quantity_tiers ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /** Bulk-upsert artikelrader (check-then-insert-or-update, partiellt unique-index) */
  static async bulkUpsertPriceListItems(items: UpsertPriceListItemInput[]): Promise<void> {
    if (items.length === 0) return

    const priceListIds = [...new Set(items.map(i => i.price_list_id))]
    const { data: existing } = await supabase
      .from('price_list_items')
      .select('id, price_list_id, article_id')
      .in('price_list_id', priceListIds)
      .not('article_id', 'is', null)

    const existingMap = new Map<string, string>()
    for (const row of existing || []) {
      if (row.article_id) existingMap.set(`${row.price_list_id}:${row.article_id}`, row.id)
    }

    const toUpdate: Array<{ id: string; input: UpsertPriceListItemInput }> = []
    const toInsert: UpsertPriceListItemInput[] = []
    for (const item of items) {
      const existingId = existingMap.get(`${item.price_list_id}:${item.article_id}`)
      if (existingId) toUpdate.push({ id: existingId, input: item })
      else toInsert.push(item)
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map(i => ({
        price_list_id: i.price_list_id,
        article_id: i.article_id,
        service_id: null,
        custom_price: i.custom_price,
        discount_percent: i.discount_percent ?? 0,
        quantity_tiers: i.quantity_tiers ?? null,
      }))
      const { error } = await supabase.from('price_list_items').insert(rows)
      if (error) throw new Error(`Databasfel: ${error.message}`)
    }

    for (const { id, input } of toUpdate) {
      const { error } = await supabase
        .from('price_list_items')
        .update({
          custom_price: input.custom_price,
          discount_percent: input.discount_percent ?? 0,
          quantity_tiers: input.quantity_tiers ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(`Databasfel: ${error.message}`)
    }
  }

  /**
   * Hämta alla kundens artikelpriser (för prisguiden).
   * Returnerar en map {article_id: {custom_price, quantity_tiers}}.
   * Tom map om kunden saknar prislista.
   */
  static async getCustomerArticlePrices(customerId: string): Promise<Record<string, { custom_price: number; quantity_tiers: QuantityTier[] | null }>> {
    const { data: customer } = await supabase
      .from('customers')
      .select('price_list_id')
      .eq('id', customerId)
      .single()

    if (!customer?.price_list_id) return {}

    const { data: items, error } = await supabase
      .from('price_list_items')
      .select('article_id, custom_price, quantity_tiers')
      .eq('price_list_id', customer.price_list_id)
      .not('article_id', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)

    const map: Record<string, { custom_price: number; quantity_tiers: QuantityTier[] | null }> = {}
    for (const item of items || []) {
      if (item.article_id) {
        map[item.article_id] = {
          custom_price: item.custom_price,
          quantity_tiers: (item.quantity_tiers as QuantityTier[] | null) ?? null,
        }
      }
    }
    return map
  }

  static async removePriceListItem(priceListId: string, articleId: string): Promise<void> {
    const { error } = await supabase
      .from('price_list_items')
      .delete()
      .eq('price_list_id', priceListId)
      .eq('article_id', articleId)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Kopiera prislista inkl. alla poster (bulk — inget n+1).
   */
  static async copyPriceList(sourceId: string, newName: string): Promise<PriceList> {
    const source = await this.getPriceListById(sourceId)
    if (!source) throw new Error('Källprislistan hittades inte')

    const newPriceList = await this.createPriceList({
      name: newName,
      description: source.description ? `Kopia av ${source.name}: ${source.description}` : `Kopia av ${source.name}`,
      is_default: false,
      is_active: true
    })

    const { data: sourceItems, error: fetchError } = await supabase
      .from('price_list_items')
      .select('article_id, service_id, custom_price, discount_percent, quantity_tiers')
      .eq('price_list_id', sourceId)

    if (fetchError) throw new Error(`Databasfel vid kopiering: ${fetchError.message}`)

    if (sourceItems && sourceItems.length > 0) {
      const rows = sourceItems.map(item => ({
        price_list_id: newPriceList.id,
        article_id: item.article_id,
        service_id: item.service_id,
        custom_price: item.custom_price,
        discount_percent: item.discount_percent ?? 0,
        quantity_tiers: item.quantity_tiers ?? null
      }))

      const { error: insertError } = await supabase.from('price_list_items').insert(rows)
      if (insertError) throw new Error(`Databasfel vid kopiering: ${insertError.message}`)
    }

    return newPriceList
  }

  /** Totalantal poster (alla typer) i prislistan */
  static async getItemCount(priceListId: string): Promise<number> {
    const { count, error } = await supabase
      .from('price_list_items')
      .select('*', { count: 'exact', head: true })
      .eq('price_list_id', priceListId)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return count || 0
  }

  /** Antal tjänstepriser i prislistan */
  static async getServiceItemCount(priceListId: string): Promise<number> {
    const { count, error } = await supabase
      .from('price_list_items')
      .select('*', { count: 'exact', head: true })
      .eq('price_list_id', priceListId)
      .not('service_id', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return count || 0
  }

  /** Antal poster per prislista (alla typer) — för N+1-fix vid listvy */
  static async getItemCountsForLists(priceListIds: string[]): Promise<Record<string, number>> {
    if (priceListIds.length === 0) return {}

    const { data, error } = await supabase
      .from('price_list_items')
      .select('price_list_id')
      .in('price_list_id', priceListIds)

    if (error) throw new Error(`Databasfel: ${error.message}`)

    const counts: Record<string, number> = {}
    for (const id of priceListIds) counts[id] = 0
    for (const row of data || []) {
      counts[row.price_list_id] = (counts[row.price_list_id] || 0) + 1
    }
    return counts
  }

  /** Antal tjänstepriser per prislista */
  static async getServiceItemCountsForLists(priceListIds: string[]): Promise<Record<string, number>> {
    if (priceListIds.length === 0) return {}

    const { data, error } = await supabase
      .from('price_list_items')
      .select('price_list_id')
      .in('price_list_id', priceListIds)
      .not('service_id', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)

    const counts: Record<string, number> = {}
    for (const id of priceListIds) counts[id] = 0
    for (const row of data || []) {
      counts[row.price_list_id] = (counts[row.price_list_id] || 0) + 1
    }
    return counts
  }

  // ============================================================
  // LEGACY — används fortfarande av customerContractArticleService m.fl.
  // Kvarhålls tills Fas 2-konsumenter är uppdaterade.
  // ============================================================

  /**
   * @deprecated Använd getEffectiveServicePrice istället för tjänster.
   * Artiklar prissätts ej längre via prislistor.
   */
  static async getEffectivePrice(
    articleId: string,
    customerId?: string | null
  ): Promise<{ price: number; source: 'customer_list' | 'standard' }> {
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('price_list_id')
        .eq('id', customerId)
        .maybeSingle()

      if (customer?.price_list_id) {
        const { data: priceItem } = await supabase
          .from('price_list_items')
          .select('custom_price')
          .eq('price_list_id', customer.price_list_id)
          .eq('article_id', articleId)
          .maybeSingle()

        if (priceItem) return { price: priceItem.custom_price, source: 'customer_list' }
      }
    }

    const defaultPriceList = await this.getDefaultPriceList()
    if (defaultPriceList) {
      const { data: priceItem } = await supabase
        .from('price_list_items')
        .select('custom_price')
        .eq('price_list_id', defaultPriceList.id)
        .eq('article_id', articleId)
        .maybeSingle()

      if (priceItem) return { price: priceItem.custom_price, source: 'standard' }
    }

    const { data: article } = await supabase
      .from('articles')
      .select('default_price')
      .eq('id', articleId)
      .maybeSingle()

    return { price: article?.default_price || 0, source: 'standard' }
  }

  /**
   * @deprecated Används av PriceListArticleSelector i Oneflow-wizard (historik).
   */
  static async getPriceListsByArticles(): Promise<Record<string, Array<{ priceList: PriceList; customPrice: number | null }>>> {
    const priceLists = await this.getAllPriceLists()
    const priceListMap = new Map(priceLists.map(pl => [pl.id, pl]))

    const { data: items, error } = await supabase
      .from('price_list_items')
      .select('article_id, price_list_id, custom_price')
      .not('article_id', 'is', null)

    if (error) throw new Error(`Databasfel: ${error.message}`)

    const result: Record<string, Array<{ priceList: PriceList; customPrice: number | null }>> = {}

    for (const item of items || []) {
      if (!item.article_id) continue
      const priceList = priceListMap.get(item.price_list_id)
      if (!priceList) continue

      if (!result[item.article_id]) result[item.article_id] = []
      result[item.article_id].push({ priceList, customPrice: item.custom_price })
    }

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
