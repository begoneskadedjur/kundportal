// src/services/incidentRecipientService.ts
// Hanterar mottagare per incidenttyp (tillbud/olycka/avvikelse).
// Mottagare får notiser (in-app + e-post) och full insyn i incidenter av sina typer.

import { supabase } from '../lib/supabase'
import type { IncidentRecipient, IncidentType } from '../types/caseIncidents'

export class IncidentRecipientService {
  /** Alla mottagarrader (för admin-UI:t på Användarkonton Personal) */
  static async getAll(): Promise<IncidentRecipient[]> {
    const { data, error } = await supabase
      .from('incident_recipients')
      .select('id, user_id, incident_type, created_at')

    if (error) throw error
    return (data || []) as IncidentRecipient[]
  }

  /** Vilka incidenttyper en användare är mottagare av */
  static async getRecipientTypes(userId: string): Promise<Set<IncidentType>> {
    const { data, error } = await supabase
      .from('incident_recipients')
      .select('incident_type')
      .eq('user_id', userId)

    if (error) throw error
    return new Set((data || []).map(r => r.incident_type as IncidentType))
  }

  /** Sätter en användares mottagartyper (diffar: tar bort bortvalda, lägger till nya) */
  static async setRecipientTypes(userId: string, types: IncidentType[]): Promise<void> {
    const current = await this.getRecipientTypes(userId)
    const wanted = new Set(types)

    const toRemove = [...current].filter(t => !wanted.has(t))
    const toAdd = [...wanted].filter(t => !current.has(t))

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('incident_recipients')
        .delete()
        .eq('user_id', userId)
        .in('incident_type', toRemove)
      if (error) throw error
    }

    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('incident_recipients')
        .insert(toAdd.map(t => ({ user_id: userId, incident_type: t })))
      if (error) throw error
    }
  }
}
