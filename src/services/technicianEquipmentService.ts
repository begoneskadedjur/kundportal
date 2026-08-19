// src/services/technicianEquipmentService.ts
// Datalager för teknikerns utrustningssida (Kontroller-tabben).
// Visar ENDAST inbokade besök (station_inspection_sessions) — återkommande
// scheman genererar alltid bokningar via cron, så "förfallen utan bokning"
// ska inte finnas som tillstånd. En bokad kontroll som inte utförts i tid
// flaggas som passerad och ska hanteras skyndsamt.

import { supabase } from '../lib/supabase'

export interface BookedInspection {
  id: string
  customer_id: string
  customer_name: string
  site_name: string | null
  customer_address: string | null
  scheduled_at: string
  scheduled_end: string | null
  status: string
  total_stations: number
  frequency: string | null
  isOverdue: boolean
}

export interface InspectionOverview {
  open: BookedInspection[]
  completedThisMonth: number
}

// Formen på raderna från Supabase-selecten nedan (embeddade relationer)
interface SessionRow {
  id: string
  customer_id: string
  scheduled_at: string
  scheduled_end: string | null
  status: string
  total_outdoor_stations: number | null
  total_indoor_stations: number | null
  customer: { company_name: string; site_name: string | null; contact_address: string | null } | null
  recurring_schedule: { frequency: string | null } | null
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Varje månad',
  quarterly: 'Kvartalsvis',
  semi_annual: 'Halvårsvis',
  annual: 'Årsvis',
  custom: 'Anpassat schema'
}

export function frequencyLabel(frequency: string | null): string | null {
  if (!frequency) return null
  return FREQUENCY_LABELS[frequency] || frequency
}

export class TechnicianEquipmentService {
  /**
   * Hämta teknikerns inbokade stationskontroller fram till `horizon`
   * (inklusive passerade som fortfarande står som scheduled = ej utförda)
   * samt antal utförda kontroller innevarande månad.
   */
  static async getInspectionOverview(
    technicianId: string,
    horizon: Date
  ): Promise<InspectionOverview> {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [openRes, completedRes] = await Promise.all([
      supabase
        .from('station_inspection_sessions')
        .select(`
          id,
          customer_id,
          scheduled_at,
          scheduled_end,
          status,
          total_outdoor_stations,
          total_indoor_stations,
          customer:customers!customer_id(company_name, site_name, contact_address),
          recurring_schedule:recurring_schedules!recurring_schedule_id(frequency)
        `)
        .eq('technician_id', technicianId)
        .in('status', ['scheduled', 'in_progress'])
        .not('scheduled_at', 'is', null)
        .lte('scheduled_at', horizon.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('station_inspection_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', technicianId)
        .eq('status', 'completed')
        .gte('completed_at', monthStart.toISOString())
    ])

    if (openRes.error) {
      console.error('Fel vid hämtning av inbokade kontroller:', openRes.error)
      throw openRes.error
    }
    if (completedRes.error) {
      console.error('Fel vid räkning av utförda kontroller:', completedRes.error)
    }

    const nowMs = now.getTime()
    const rows = (openRes.data || []) as unknown as SessionRow[]
    const open: BookedInspection[] = rows.map(row => {
      const deadline = row.scheduled_end || row.scheduled_at
      return {
        id: row.id,
        customer_id: row.customer_id,
        customer_name: row.customer?.company_name || 'Okänd kund',
        site_name: row.customer?.site_name || null,
        customer_address: row.customer?.contact_address || null,
        scheduled_at: row.scheduled_at,
        scheduled_end: row.scheduled_end,
        status: row.status,
        total_stations:
          (row.total_outdoor_stations || 0) + (row.total_indoor_stations || 0),
        frequency: row.recurring_schedule?.frequency || null,
        isOverdue:
          row.status === 'scheduled' && new Date(deadline).getTime() < nowMs
      }
    })

    return { open, completedThisMonth: completedRes.count || 0 }
  }

  /**
   * Vilka av kunderna har ett aktivt återkommande schema?
   * Används för "saknar kontrollschema"-notisen i Kontroller-tabben.
   */
  static async getActiveScheduleCustomerIds(
    customerIds: string[]
  ): Promise<Set<string>> {
    if (customerIds.length === 0) return new Set()

    const { data, error } = await supabase
      .from('recurring_schedules')
      .select('customer_id')
      .eq('status', 'active')
      .in('customer_id', customerIds)

    if (error) {
      console.error('Fel vid hämtning av aktiva scheman:', error)
      return new Set()
    }

    return new Set((data || []).map(r => r.customer_id))
  }
}
