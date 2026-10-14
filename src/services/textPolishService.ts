// src/services/textPolishService.ts
// Snygga till (3.52.0): AI-genomläsning via api/polish-text.ts och ordlistan
// (tabellen text_glossary) med termer som aldrig rättas. Behörigheten för
// ordlistan sköts av RLS: personal läser och lägger till manuella ord, admin
// och koordinator stänger av och tar bort. Alla metoder kastar Error med
// svensk text vid fel.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import type {
  GlossaryEntry,
  PolishContext,
  PolishField,
  PolishResponse,
} from '../types/textPolish'

// Tabellen finns inte i de genererade typerna; otypad klient för just dessa anrop
const db = supabase as unknown as SupabaseClient

export interface GlossaryEntryWithAuthor extends GlossaryEntry {
  /** Namnet på den som lade till ordet (bara manuella ord) */
  addedByName: string | null
}

export type AddToGlossaryResult = 'tillagd' | 'fanns' | 'aktiverad'

/** Escape för ilike, så att % och _ i ordet matchas som tecken */
const ilikeExakt = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

export class TextPolishService {
  /** Läser igenom fälten och svarar med kontrollerade förslag */
  static async polish(fields: PolishField[], context?: PolishContext): Promise<PolishResponse> {
    const res = await apiFetch('/api/polish-text', {
      method: 'POST',
      body: JSON.stringify({ fields, context }),
    })
    if (!res.ok) {
      let text = 'Genomläsningen misslyckades. Försök igen.'
      try {
        const body = await res.json() as { error?: string }
        if (body?.error) text = body.error
      } catch { /* inget JSON-svar */ }
      throw new Error(text)
    }
    const body = await res.json() as Partial<PolishResponse>
    return {
      changes: Array.isArray(body.changes) ? body.changes : [],
      blocked: Array.isArray(body.blocked) ? body.blocked : [],
      protectedTerms: Array.isArray(body.protectedTerms) ? body.protectedTerms : [],
    }
  }

  /**
   * Lägger till ett ord (source manuell). Finns ordet redan är det klart; är
   * det avstängt slås det på om användaren får (admin, koordinator), annars
   * kastas en förklaring.
   */
  static async addToGlossary(term: string): Promise<AddToGlossaryResult> {
    const ord = term.trim().replace(/\s+/g, ' ')
    if (!ord) throw new Error('Skriv ett ord')
    if (ord.length > 200) throw new Error('Ordet är för långt (högst 200 tecken)')

    const { error } = await db.from('text_glossary').insert({ term: ord, source: 'manuell' })
    if (!error) return 'tillagd'
    if (error.code !== '23505') {
      console.error('Ordlistan: kunde inte lägga till', error)
      throw new Error('Kunde inte lägga till ordet i ordlistan')
    }

    // Ordet finns redan (oavsett versaler)
    const { data: finns, error: lasFel } = await db
      .from('text_glossary')
      .select('id, term, active')
      .ilike('term', ilikeExakt(ord))
      .limit(1)
      .maybeSingle()
    if (lasFel || !finns) throw new Error('Ordet finns redan i ordlistan')
    if (finns.active) return 'fanns'

    const { data: pa } = await db.from('text_glossary').update({ active: true }).eq('id', finns.id).select('id')
    if (pa && pa.length > 0) return 'aktiverad'
    throw new Error(`"${finns.term}" är avstängt i ordlistan. Be en koordinator eller admin slå på det under Ordlistan.`)
  }

  /** Hela ordlistan med namnet på den som lade till manuella ord */
  static async listGlossary(): Promise<GlossaryEntryWithAuthor[]> {
    const rader: GlossaryEntry[] = []
    for (let fran = 0; fran < 50000; fran += 1000) {
      const { data, error } = await db
        .from('text_glossary')
        .select('id, term, source, source_id, active, added_by, created_at')
        .order('term', { ascending: true })
        .range(fran, fran + 999)
      if (error) {
        console.error('Ordlistan: kunde inte hämta', error)
        throw new Error('Kunde inte hämta ordlistan')
      }
      rader.push(...((data ?? []) as GlossaryEntry[]))
      if (!data || data.length < 1000) break
    }

    const anvandare = [...new Set(rader.map(r => r.added_by).filter((x): x is string => !!x))]
    const namn = new Map<string, string>()
    if (anvandare.length > 0) {
      const { data } = await db
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', anvandare)
      for (const p of (data ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
        namn.set(p.user_id, p.display_name?.trim() || p.email || 'Okänd')
      }
    }
    return rader.map(r => ({ ...r, addedByName: r.added_by ? namn.get(r.added_by) ?? null : null }))
  }

  /** Stänger av eller slår på ett ord (admin och koordinator) */
  static async setActive(id: string, active: boolean): Promise<void> {
    const { data, error } = await db.from('text_glossary').update({ active }).eq('id', id).select('id')
    if (error) {
      console.error('Ordlistan: kunde inte ändra', error)
      throw new Error('Kunde inte ändra ordet')
    }
    if (!data || data.length === 0) throw new Error('Bara admin och koordinator kan stänga av ord i ordlistan')
  }

  /** Tar bort ett manuellt ord (admin och koordinator). Automatiska ord stängs av i stället */
  static async deleteTerm(id: string): Promise<void> {
    const { data, error } = await db
      .from('text_glossary')
      .delete()
      .eq('id', id)
      .eq('source', 'manuell')
      .select('id')
    if (error) {
      console.error('Ordlistan: kunde inte ta bort', error)
      throw new Error('Kunde inte ta bort ordet')
    }
    if (!data || data.length === 0) throw new Error('Bara manuella ord kan tas bort, och bara av admin eller koordinator')
  }
}
