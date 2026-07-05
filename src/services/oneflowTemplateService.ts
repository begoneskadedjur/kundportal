// src/services/oneflowTemplateService.ts
// Läsning + CRUD för dynamiska Oneflow-mallar (tabellen oneflow_templates).
// Wizard-läsning faller tillbaka på den hårdkodade listan vid DATABASFEL -
// aldrig vid tomt resultat, eftersom ett tomt resultat kan vara ett medvetet
// adminval. Semantik: is_active styr bara wizard-synlighet; webhook/sync
// känner igen alla mallar oavsett is_active (trashing-skyddet).

import { supabase } from '../lib/supabase'
import { getTemplatesByType, ALLOWED_TEMPLATE_IDS, type OneflowTemplate } from '../constants/oneflowTemplates'

export interface OneflowTemplateRow {
  id: string
  oneflow_template_id: string
  name: string
  type: 'contract' | 'offer'
  category: 'company' | 'individual' | null
  popular: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OneflowTemplateInput {
  oneflow_template_id: string
  name: string
  type: 'contract' | 'offer'
  category?: 'company' | 'individual' | null
  popular?: boolean
}

function rowToLegacyShape(row: OneflowTemplateRow): OneflowTemplate {
  return {
    id: row.oneflow_template_id,
    name: row.name,
    type: row.type,
    category: row.category ?? undefined,
    popular: row.popular || undefined
  }
}

export class OneflowTemplateService {
  /** Alla mallar (aktiva + inaktiva) för admin-sidan. Kastar vid fel. */
  static async getAll(): Promise<OneflowTemplateRow[]> {
    const { data, error } = await supabase
      .from('oneflow_templates')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true })
    if (error) throw error
    return (data ?? []) as OneflowTemplateRow[]
  }

  /** Aktiva mallar för wizarden, i legacy-format. Fallback till hårdkodad lista vid DB-fel. */
  static async getActiveByType(type: 'contract' | 'offer'): Promise<OneflowTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('oneflow_templates')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('popular', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw error
      return ((data ?? []) as OneflowTemplateRow[]).map(rowToLegacyShape)
    } catch (err) {
      console.error('[OneflowTemplateService] DB-läsning misslyckades, använder hårdkodad fallback:', err)
      return getTemplatesByType(type)
    }
  }

  /**
   * ALLA mall-ID:n (även avaktiverade) - för igenkänning/filtrering av
   * BEFINTLIGA avtal (contractService, statistik). Avaktiverad mall ska
   * fortfarande kännas igen, annars försvinner historiska avtal ur vyerna.
   * Fallback till hårdkodade listan vid DB-fel.
   */
  static async getAllTemplateIds(): Promise<Set<string>> {
    try {
      const { data, error } = await supabase
        .from('oneflow_templates')
        .select('oneflow_template_id')
      if (error) throw error
      const ids = new Set((data ?? []).map(r => (r as { oneflow_template_id: string }).oneflow_template_id))
      // Tom tabell = trasigt tillstånd (seedad med 9) - behandla som fel
      if (ids.size === 0) throw new Error('oneflow_templates är tom')
      return ids
    } catch (err) {
      console.error('[OneflowTemplateService] DB-läsning misslyckades, använder hårdkodad fallback:', err)
      return new Set(ALLOWED_TEMPLATE_IDS)
    }
  }

  /** ALLA mall-ID:n av en typ (även avaktiverade) - för statistikfiltrering. */
  static async getAllIdsByType(type: 'contract' | 'offer'): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('oneflow_templates')
        .select('oneflow_template_id')
        .eq('type', type)
      if (error) throw error
      const ids = ((data ?? []) as { oneflow_template_id: string }[]).map(r => r.oneflow_template_id)
      if (ids.length === 0) throw new Error('oneflow_templates saknar rader för typen')
      return ids
    } catch (err) {
      console.error('[OneflowTemplateService] DB-läsning misslyckades, använder hårdkodad fallback:', err)
      return getTemplatesByType(type).map(t => t.id)
    }
  }

  static async create(input: OneflowTemplateInput): Promise<OneflowTemplateRow> {
    const { data, error } = await supabase
      .from('oneflow_templates')
      .insert({
        oneflow_template_id: input.oneflow_template_id.trim(),
        name: input.name.trim(),
        type: input.type,
        category: input.type === 'offer' ? (input.category ?? null) : null,
        popular: input.popular ?? false
      })
      .select()
      .single()
    if (error) throw error
    return data as OneflowTemplateRow
  }

  static async update(id: string, patch: Partial<OneflowTemplateInput> & { is_active?: boolean }): Promise<OneflowTemplateRow> {
    const { data, error } = await supabase
      .from('oneflow_templates')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as OneflowTemplateRow
  }

  /** Hård radering - anropa bara när mallen saknar kopplade avtal (UI spärrar). */
  static async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('oneflow_templates')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  /** Antal avtal/offerter i contracts per Oneflow-mall-ID (för raderingsspärren). */
  static async getContractCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('contracts')
      .select('template_id')
      .not('template_id', 'is', null)
    if (error) throw error
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const key = String((row as { template_id: string }).template_id)
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }
}
