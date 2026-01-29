// src/services/articleGroupService.ts
// Service för hantering av artikelgrupper

import { supabase } from '../lib/supabase'
import {
  ArticleGroup,
  CreateArticleGroupInput,
  UpdateArticleGroupInput
} from '../types/articles'

/**
 * Generera slug från namn
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export class ArticleGroupService {
  /**
   * Hämta alla artikelgrupper
   */
  static async getAllGroups(): Promise<ArticleGroup[]> {
    const { data, error } = await supabase
      .from('article_groups')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Kunde inte hämta artikelgrupper: ${error.message}`)
    }

    return data || []
  }

  /**
   * Hämta endast aktiva artikelgrupper
   */
  static async getActiveGroups(): Promise<ArticleGroup[]> {
    const { data, error } = await supabase
      .from('article_groups')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Kunde inte hämta aktiva artikelgrupper: ${error.message}`)
    }

    return data || []
  }

  /**
   * Hämta en artikelgrupp via ID
   */
  static async getGroupById(id: string): Promise<ArticleGroup | null> {
    const { data, error } = await supabase
      .from('article_groups')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Kunde inte hämta artikelgrupp: ${error.message}`)
    }

    return data
  }

  /**
   * Hämta en artikelgrupp via slug
   */
  static async getGroupBySlug(slug: string): Promise<ArticleGroup | null> {
    const { data, error } = await supabase
      .from('article_groups')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Kunde inte hämta artikelgrupp: ${error.message}`)
    }

    return data
  }

  /**
   * Skapa ny artikelgrupp
   */
  static async createGroup(input: CreateArticleGroupInput): Promise<ArticleGroup> {
    const slug = input.slug || generateSlug(input.name)

    const { data, error } = await supabase
      .from('article_groups')
      .insert({
        name: input.name,
        slug,
        description: input.description || null,
        color: input.color || '#6b7280',
        icon: input.icon || 'Package',
        sort_order: input.sort_order ?? 0
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('En artikelgrupp med detta namn finns redan')
      }
      throw new Error(`Kunde inte skapa artikelgrupp: ${error.message}`)
    }

    return data
  }

  /**
   * Uppdatera en artikelgrupp
   */
  static async updateGroup(id: string, input: UpdateArticleGroupInput): Promise<ArticleGroup> {
    const { data, error } = await supabase
      .from('article_groups')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('En artikelgrupp med detta namn finns redan')
      }
      throw new Error(`Kunde inte uppdatera artikelgrupp: ${error.message}`)
    }

    return data
  }

  /**
   * Ta bort en artikelgrupp
   * Kan endast tas bort om inga artiklar är kopplade
   */
  static async deleteGroup(id: string): Promise<void> {
    // Kontrollera om det finns artiklar kopplade
    const articleCount = await this.getArticleCountByGroup(id)
    if (articleCount > 0) {
      throw new Error(`Kan inte ta bort gruppen. ${articleCount} artikel${articleCount === 1 ? '' : 'er'} är kopplade till denna grupp.`)
    }

    const { error } = await supabase
      .from('article_groups')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Kunde inte ta bort artikelgrupp: ${error.message}`)
    }
  }

  /**
   * Hämta antal artiklar i en grupp
   */
  static async getArticleCountByGroup(groupId: string): Promise<number> {
    const { count, error } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    if (error) {
      throw new Error(`Kunde inte räkna artiklar: ${error.message}`)
    }

    return count || 0
  }

  /**
   * Hämta antal artiklar per grupp (för statistik)
   */
  static async getArticleCountsByGroup(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('articles')
      .select('group_id')

    if (error) {
      throw new Error(`Kunde inte hämta artikelräkning: ${error.message}`)
    }

    const counts: Record<string, number> = {}
    data?.forEach(article => {
      if (article.group_id) {
        counts[article.group_id] = (counts[article.group_id] || 0) + 1
      }
    })

    return counts
  }
}
