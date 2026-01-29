// src/services/articleService.ts
// Service för hantering av artiklar

import { supabase } from '../lib/supabase'
import {
  Article,
  ArticleWithGroup,
  CreateArticleInput,
  UpdateArticleInput
} from '../types/articles'

export class ArticleService {
  /**
   * Hämta alla aktiva artiklar
   */
  static async getActiveArticles(): Promise<Article[]> {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  /**
   * Hämta alla artiklar (inklusive inaktiva)
   */
  static async getAllArticles(): Promise<Article[]> {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  /**
   * Hämta alla artiklar med gruppdata (för tabellvy)
   */
  static async getAllArticlesWithGroups(): Promise<ArticleWithGroup[]> {
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        group:article_groups(*)
      `)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  /**
   * Hämta artikel via ID
   */
  static async getArticleById(id: string): Promise<Article | null> {
    const { data, error } = await supabase
      .from('articles')
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
   * Hämta artikel via kod
   */
  static async getArticleByCode(code: string): Promise<Article | null> {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('code', code)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }

  /**
   * Skapa ny artikel
   */
  static async createArticle(input: CreateArticleInput): Promise<Article> {
    if (!input.code || !input.name) {
      throw new Error('Kod och namn är obligatoriska')
    }

    const existing = await this.getArticleByCode(input.code.toUpperCase())
    if (existing) {
      throw new Error(`En artikel med koden "${input.code}" finns redan`)
    }

    const { data, error } = await supabase
      .from('articles')
      .insert({
        code: input.code.toUpperCase(),
        name: input.name.trim(),
        description: input.description || null,
        unit: input.unit,
        default_price: input.default_price,
        vat_rate: input.vat_rate ?? 25,
        category: input.category,
        group_id: input.group_id || null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
        fortnox_article_id: input.fortnox_article_id || null
      })
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Uppdatera artikel
   */
  static async updateArticle(id: string, input: UpdateArticleInput): Promise<Article> {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.description !== undefined) updateData.description = input.description
    if (input.unit !== undefined) updateData.unit = input.unit
    if (input.default_price !== undefined) updateData.default_price = input.default_price
    if (input.vat_rate !== undefined) updateData.vat_rate = input.vat_rate
    if (input.category !== undefined) updateData.category = input.category
    if (input.group_id !== undefined) updateData.group_id = input.group_id
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order
    if (input.fortnox_article_id !== undefined) updateData.fortnox_article_id = input.fortnox_article_id

    const { data, error } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  /**
   * Aktivera/inaktivera artikel
   */
  static async toggleArticleActive(id: string, isActive: boolean): Promise<Article> {
    return this.updateArticle(id, { is_active: isActive })
  }

  /**
   * Ta bort artikel
   */
  static async deleteArticle(id: string): Promise<void> {
    // Kontrollera om artikeln används i prislistor
    const { count } = await supabase
      .from('price_list_items')
      .select('*', { count: 'exact', head: true })
      .eq('article_id', id)

    if ((count || 0) > 0) {
      throw new Error('Kan inte ta bort artikeln. Den används i prislistor. Inaktivera den istället.')
    }

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  /**
   * Hämta artikelstatistik
   */
  static async getArticleStats(): Promise<{
    total: number
    active: number
    inactive: number
    byCategory: Record<string, number>
  }> {
    const articles = await this.getAllArticles()

    const stats = {
      total: articles.length,
      active: articles.filter(a => a.is_active).length,
      inactive: articles.filter(a => !a.is_active).length,
      byCategory: {} as Record<string, number>
    }

    articles.forEach(article => {
      if (!stats.byCategory[article.category]) {
        stats.byCategory[article.category] = 0
      }
      stats.byCategory[article.category]++
    })

    return stats
  }
}
