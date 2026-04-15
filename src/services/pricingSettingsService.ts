// src/services/pricingSettingsService.ts
// Singleton-service för globala prissättningsinställningar

import { supabase } from '../lib/supabase'
import type { PricingSettings } from '../types/pricingSettings'
import { DEFAULT_PRICING_SETTINGS } from '../types/pricingSettings'

export class PricingSettingsService {
  /**
   * Hämta globala prissättningsinställningar.
   * Returnerar defaults om tabellen är tom.
   */
  static async get(): Promise<PricingSettings> {
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Databasfel: ${error.message}`)

    if (!data) {
      // Fallback om tabellen mot förmodan är tom
      return {
        id: '',
        ...DEFAULT_PRICING_SETTINGS,
        updated_at: new Date().toISOString(),
      }
    }

    return data
  }

  /**
   * Uppdatera prissättningsinställningar (singleton UPDATE).
   */
  static async update(input: Partial<Omit<PricingSettings, 'id' | 'updated_at'>>): Promise<PricingSettings> {
    // Hämta befintlig rad för att få id
    const current = await this.get()

    if (!current.id) {
      // Ingen rad finns – skapa en
      const { data, error } = await supabase
        .from('pricing_settings')
        .insert({ ...DEFAULT_PRICING_SETTINGS, ...input })
        .select()
        .single()
      if (error) throw new Error(`Databasfel: ${error.message}`)
      return data
    }

    const { data, error } = await supabase
      .from('pricing_settings')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .select()
      .single()

    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }
}
