import { supabase } from '../lib/supabase'

export interface RonderingStationLog {
  id: string
  case_id: string
  station_id: string
  inspected_at: string
  technician_id: string | null
  technician_name: string | null
  status: 'ok' | 'action_required' | 'missing'
  bait_consumed: 'all' | 'partial' | 'none' | null
  note: string | null
  created_at: string
}

export type RonderingStationStatus = 'ok' | 'action_required' | 'missing'

export type RonderingAnnotationCategory = 'trash_bins' | 'littering' | 'vegetation' | 'rodent_holes' | 'attractants' | 'damage' | 'bird_feeding'

export interface RonderingAnnotation {
  id: string
  case_id: string
  station_id: string | null
  latitude: number
  longitude: number
  category: RonderingAnnotationCategory
  note: string | null
  technician_name: string | null
  address: string | null
  created_at: string
}

export const ANNOTATION_CATEGORIES: Record<RonderingAnnotationCategory, { label: string; color: string; emoji: string }> = {
  trash_bins:   { label: 'Trasiga soptunnor',                       color: '#f97316', emoji: '🗑️' },
  littering:    { label: 'Allmän nedskräpning',                     color: '#eab308', emoji: '🚮' },
  vegetation:   { label: 'Buskar och träd som behöver beskäras',    color: '#22c55e', emoji: '🌿' },
  rodent_holes: { label: 'Håligheter i jord relaterade till gnagare', color: '#ef4444', emoji: '🐀' },
  attractants:  { label: 'Verksamheter som drar till sig gnagare',  color: '#f59e0b', emoji: '🏪' },
  damage:       { label: 'Skador vid elskåp eller i fasader',       color: '#8b5cf6', emoji: '⚡' },
  bird_feeding: { label: 'Fågelmatning',                            color: '#3b82f6', emoji: '🐦' },
}

export class RonderingService {
  static async getLogsForCase(caseId: string): Promise<RonderingStationLog[]> {
    const { data, error } = await supabase
      .from('rondering_station_logs')
      .select('*')
      .eq('case_id', caseId)
      .order('inspected_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  static async logStation(
    caseId: string,
    stationId: string,
    technicianId: string | null,
    technicianName: string | null,
    status: RonderingStationStatus = 'ok',
    baitConsumed?: 'all' | 'partial' | 'none',
    note?: string
  ): Promise<RonderingStationLog> {
    // INSERT utan .single() — hämta sedan raden explicit
    const { error } = await supabase
      .from('rondering_station_logs')
      .insert({
        case_id: caseId,
        station_id: stationId,
        technician_id: technicianId,
        technician_name: technicianName,
        status,
        bait_consumed: baitConsumed ?? null,
        note: note ?? null,
      })

    if (error && error.code !== '23505') {
      throw new Error(error.message)
    }

    // Hämta raden (oavsett om den precis skapades eller redan fanns)
    const { data: existing, error: fetchError } = await supabase
      .from('rondering_station_logs')
      .select('*')
      .eq('case_id', caseId)
      .eq('station_id', stationId)
      .single()
    if (fetchError) throw new Error(fetchError.message)
    return existing
  }

  static async updateLogStatus(
    logId: string,
    status: RonderingStationStatus,
    note?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('rondering_station_logs')
      .update({ status, note: note ?? null })
      .eq('id', logId)
    if (error) throw new Error(error.message)
  }

  static async removeLog(caseId: string, stationId: string): Promise<void> {
    const { error } = await supabase
      .from('rondering_station_logs')
      .delete()
      .eq('case_id', caseId)
      .eq('station_id', stationId)
    if (error) throw new Error(error.message)
  }

  // ── Annotationer ────────────────────────────────────────────────────────────

  static async getAnnotationsForCase(caseId: string): Promise<RonderingAnnotation[]> {
    const { data, error } = await supabase
      .from('rondering_annotations')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  static async addAnnotation(
    caseId: string,
    latitude: number,
    longitude: number,
    category: RonderingAnnotationCategory,
    note: string | null,
    technicianName: string | null,
    stationId?: string,
    address?: string | null
  ): Promise<RonderingAnnotation> {
    const { data, error } = await supabase
      .from('rondering_annotations')
      .insert({ case_id: caseId, latitude, longitude, category, note, technician_name: technicianName, station_id: stationId ?? null, address: address ?? null })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  static async updateAnnotation(id: string, patch: Partial<Pick<RonderingAnnotation, 'note' | 'category'>>): Promise<void> {
    const { error } = await supabase.from('rondering_annotations').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  }

  static async deleteAnnotation(id: string): Promise<void> {
    const { error } = await supabase.from('rondering_annotations').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  // Hämtar summerad status för ett ärende (för regional-portalen och admin-rapporten)
  static async getCaseSummary(caseId: string): Promise<{
    total: number
    inspected: number
    actionRequired: number
    missing: number
  }> {
    const logs = await RonderingService.getLogsForCase(caseId)
    return {
      total: 0, // sätts av anroparen som känner till totalt antal stationer
      inspected: logs.filter(l => l.status === 'ok').length,
      actionRequired: logs.filter(l => l.status === 'action_required').length,
      missing: logs.filter(l => l.status === 'missing').length,
    }
  }

  // Hämtar alla rondering-ärenden för en kunds alla regioner (för admin-rapport)
  static async getRonderingCasesForOrganization(organizationId: string): Promise<{
    id: string
    case_number: string | null
    title: string
    customer_id: string
    customer_name: string | null
    scheduled_start: string | null
    status: string
    primary_technician_name: string | null
  }[]> {
    const { data, error } = await supabase
      .from('cases')
      .select(`
        id, case_number, title, customer_id, scheduled_start, status, primary_technician_name,
        customer:customers!cases_customer_id_fkey(company_name, organization_id)
      `)
      .eq('service_type', 'rondering_trafikkontoret')
      .order('scheduled_start', { ascending: false })
    if (error) throw new Error(error.message)

    return (data ?? [])
      .filter((c: any) => c.customer?.organization_id === organizationId)
      .map((c: any) => ({
        id: c.id,
        case_number: c.case_number,
        title: c.title,
        customer_id: c.customer_id,
        customer_name: c.customer?.company_name ?? null,
        scheduled_start: c.scheduled_start,
        status: c.status,
        primary_technician_name: c.primary_technician_name,
      }))
  }
}
