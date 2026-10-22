// src/components/technician/ny/utrustning/usePagaendeEtableringar.ts
// Teknikerns öppna etableringsärenden som har startat (bokade idag eller
// tidigare, eller där arbetet är påbörjat), en rad per kund, med antal
// stationer placerade sedan ärendet öppnades (samma räkning som avslutsspärren).

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import { svenskDag } from '../../../../services/teknikerDagService'

export interface PagaendeEtableringRad {
  caseId: string
  customerId: string
  kund: string
  adress: string | null
  bokad: string | null
  placerade: number | null
}

/**
 * Bokad idag eller tidigare, räknat på svensk kalenderdag. scheduled_start är
 * timestamptz och kommer i UTC, så strängen jämförs aldrig rått (ett besök
 * 00:30 i morgon svensk tid är 22:30 UTC i dag).
 */
function bokadSenastIdag(scheduledStart: string, idag: string): boolean {
  const d = new Date(scheduledStart)
  return !Number.isNaN(d.getTime()) && svenskDag(d) <= idag
}

export function usePagaendeEtableringar(technicianId: string) {
  const [rader, setRader] = useState<PagaendeEtableringRad[]>([])
  const [laddar, setLaddar] = useState(true)

  const ladda = useCallback(async () => {
    if (!technicianId) { setRader([]); setLaddar(false); return }
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, customer_id, created_at, scheduled_start, work_started_at, address, customer:customers(company_name, contact_address)')
        .eq('service_type', 'establishment')
        .not('status', 'ilike', '%avslutat%')
        .neq('status', 'Borttaget')
        .is('deleted_at', null)
        .or(`primary_technician_id.eq.${technicianId},secondary_technician_id.eq.${technicianId},tertiary_technician_id.eq.${technicianId}`)
        .order('scheduled_start', { ascending: false, nullsFirst: false })
        .limit(20)
      if (error) throw error
      const idag = svenskDag()
      type Rad = {
        id: string; customer_id: string | null; created_at: string; scheduled_start: string | null
        work_started_at: string | null; address: string | null
        customer: { company_name: string | null; contact_address: string | null } | { company_name: string | null; contact_address: string | null }[] | null
      }
      const startade = ((data ?? []) as unknown as Rad[]).filter(r =>
        !!r.customer_id && (!!r.work_started_at || (!!r.scheduled_start && bokadSenastIdag(r.scheduled_start, idag)))
      )
      // En rad per kund (avslutet tar kundens senaste öppna ärende, som gamla sidan)
      const perKund = new Map<string, Rad & { customer_id: string }>()
      for (const r of startade) {
        const prev = perKund.get(r.customer_id!)
        if (!prev || r.created_at > prev.created_at) perKund.set(r.customer_id!, r as Rad & { customer_id: string })
      }
      const lista = await Promise.all(Array.from(perKund.values()).map(async r => {
        const kund = Array.isArray(r.customer) ? r.customer[0] : r.customer
        let placerade: number | null = null
        try {
          placerade = await AddonStationBillingService.countStationsPlacedSince(r.customer_id, r.created_at, false)
        } catch { placerade = null }
        return {
          caseId: r.id,
          customerId: r.customer_id,
          kund: kund?.company_name || 'Kund',
          adress: r.address || kund?.contact_address || null,
          bokad: r.scheduled_start,
          placerade,
        }
      }))
      setRader(lista)
    } catch (e) {
      console.error('Kunde inte hämta pågående etableringar:', e)
      setRader([])
    } finally {
      setLaddar(false)
    }
  }, [technicianId])

  useEffect(() => { void ladda() }, [ladda])

  return { rader, laddar, ladda }
}
