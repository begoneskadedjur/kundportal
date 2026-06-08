import { supabase } from '../lib/supabase'

export interface EgenkontrollStationReview {
  id: string
  case_id: string
  station_id: string
  varningsanslag: boolean
  markning_tydlig: boolean
  rodenticid_loggad: boolean
  atgard_loggad_isyroad: boolean
  bedomning_loggad: boolean
  sarskilda_risker: boolean
  dokumenterat_isyroad: boolean
  station_vilande: boolean
  antal_avklarmarkat: boolean
  note: string | null
  reviewed_at: string | null
  created_at: string
}

export type EgenkontrollChecklistKey =
  | 'varningsanslag'
  | 'markning_tydlig'
  | 'rodenticid_loggad'
  | 'atgard_loggad_isyroad'
  | 'bedomning_loggad'
  | 'sarskilda_risker'
  | 'dokumenterat_isyroad'
  | 'station_vilande'
  | 'antal_avklarmarkat'

export const EGENKONTROLL_ITEMS: { key: EgenkontrollChecklistKey; label: string }[] = [
  { key: 'varningsanslag',        label: 'Varningsanslag — helt, tydligt och uppdaterat med senaste datum' },
  { key: 'markning_tydlig',       label: 'Märkning hel och tydlig, stationsnummer syns tydligt' },
  { key: 'rodenticid_loggad',     label: 'Rodenticid loggad (50%+ förbrukat → påfyllt)' },
  { key: 'atgard_loggad_isyroad', label: 'Åtgången loggad i ISY-ROAD under ronderingen' },
  { key: 'bedomning_loggad',      label: 'Bedömning loggad i fältet "Bete uppätet till"' },
  { key: 'sarskilda_risker',      label: 'Särskilda risker i närområdet loggade' },
  { key: 'dokumenterat_isyroad',  label: 'Allt dokumenterat i ISY-ROAD inom 4 timmar' },
  { key: 'station_vilande',       label: 'Stationsstatus kontrollerad (ej "Vilande" utan skäl)' },
  { key: 'antal_avklarmarkat',    label: 'Antal stationer klarmarkerat och avvikelser registrerade' },
]

type ReviewPatch = Partial<Pick<EgenkontrollStationReview,
  'varningsanslag' | 'markning_tydlig' | 'rodenticid_loggad' | 'atgard_loggad_isyroad' |
  'bedomning_loggad' | 'sarskilda_risker' | 'dokumenterat_isyroad' | 'station_vilande' |
  'antal_avklarmarkat' | 'note' | 'reviewed_at'
>>

export class EgenkontrollService {
  static async getReviews(caseId: string): Promise<EgenkontrollStationReview[]> {
    const { data, error } = await supabase
      .from('egenkontroll_station_reviews')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  static async addStation(caseId: string, stationId: string): Promise<EgenkontrollStationReview> {
    const { data, error } = await supabase
      .from('egenkontroll_station_reviews')
      .insert({ case_id: caseId, station_id: stationId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  static async removeStation(caseId: string, stationId: string): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_station_reviews')
      .delete()
      .eq('case_id', caseId)
      .eq('station_id', stationId)
    if (error) throw new Error(error.message)
  }

  static async upsertReview(
    caseId: string,
    stationId: string,
    patch: ReviewPatch
  ): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_station_reviews')
      .upsert(
        { case_id: caseId, station_id: stationId, ...patch, reviewed_at: new Date().toISOString() },
        { onConflict: 'case_id,station_id' }
      )
    if (error) throw new Error(error.message)
  }

  static countChecked(review: EgenkontrollStationReview): number {
    return EGENKONTROLL_ITEMS.filter(item => review[item.key]).length
  }
}
