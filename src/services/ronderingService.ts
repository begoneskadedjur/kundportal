import { supabase } from '../lib/supabase'

export interface RonderingStationLog {
  id: string
  case_id: string
  station_id: string
  inspected_at: string
  technician_id: string | null
  technician_name: string | null
  status: 'ok' | 'action_required' | 'missing'
  note: string | null
  created_at: string
}

export type RonderingStationStatus = 'ok' | 'action_required' | 'missing'

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
    note?: string
  ): Promise<RonderingStationLog> {
    const { data, error } = await supabase
      .from('rondering_station_logs')
      .upsert({
        case_id: caseId,
        station_id: stationId,
        technician_id: technicianId,
        technician_name: technicianName,
        status,
        note: note ?? null,
      }, { onConflict: 'case_id,station_id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
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
