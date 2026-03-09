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
   * Hämta antal artiklar i en grupp (via junction-tabell)
   */
  static async getArticleCountByGroup(groupId: string): Promise<number> {
    const { count, error } = await supabase
      .from('article_group_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    if (error) {
      throw new Error(`Kunde inte räkna artiklar: ${error.message}`)
    }

    return count || 0
  }

  /**
   * Hämta antal artiklar per grupp (via junction-tabell)
   */
  static async getArticleCountsByGroup(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('article_group_memberships')
      .select('group_id')

    if (error) {
      throw new Error(`Kunde inte hämta artikelräkning: ${error.message}`)
    }

    const counts: Record<string, number> = {}
    data?.forEach(row => {
      counts[row.group_id] = (counts[row.group_id] || 0) + 1
    })

    return counts
  }

  /**
   * Lägg till artikel i grupp
   */
  static async addArticleToGroup(articleId: string, groupId: string): Promise<void> {
    const { error } = await supabase
      .from('article_group_memberships')
      .upsert({ article_id: articleId, group_id: groupId }, { onConflict: 'article_id,group_id' })

    if (error) {
      throw new Error(`Kunde inte lägga till artikel i grupp: ${error.message}`)
    }
  }

  /**
   * Ta bort artikel från grupp
   */
  static async removeArticleFromGroup(articleId: string, groupId: string): Promise<void> {
    const { error } = await supabase
      .from('article_group_memberships')
      .delete()
      .eq('article_id', articleId)
      .eq('group_id', groupId)

    if (error) {
      throw new Error(`Kunde inte ta bort artikel från grupp: ${error.message}`)
    }
  }

  /**
   * Sätt grupper för en artikel (ersätter alla befintliga)
   */
  static async setArticleGroups(articleId: string, groupIds: string[]): Promise<void> {
    // Ta bort alla befintliga
    const { error: deleteError } = await supabase
      .from('article_group_memberships')
      .delete()
      .eq('article_id', articleId)

    if (deleteError) {
      throw new Error(`Kunde inte uppdatera grupper: ${deleteError.message}`)
    }

    // Lägg till nya
    if (groupIds.length > 0) {
      const rows = groupIds.map(groupId => ({ article_id: articleId, group_id: groupId }))
      const { error: insertError } = await supabase
        .from('article_group_memberships')
        .insert(rows)

      if (insertError) {
        throw new Error(`Kunde inte lägga till grupper: ${insertError.message}`)
      }
    }
  }

  /**
   * Hämta grupp-ID:n för en artikel
   */
  static async getArticleGroupIds(articleId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('article_group_memberships')
      .select('group_id')
      .eq('article_id', articleId)

    if (error) {
      throw new Error(`Kunde inte hämta grupper: ${error.message}`)
    }

    return data?.map(row => row.group_id) || []
  }
}
