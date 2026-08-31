// src/hooks/useContractVisitFrequency.ts
// Besöksfrekvensen enligt kundens gällande avtal — underlag för den som lägger
// upp ett ronderingsschema. Avtalet är facit: det säger vad kunden faktiskt
// betalat för, till skillnad från customers.service_frequency som är fritext.
//
// Avtalet löses med samma prioritet som resten av systemet
// (contractResolver: eget avtal → contract_sites-täckning → HK:s covers_all_sites).

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolveContractForCustomer } from '../services/contractResolver'
import type { RecurringFrequency } from '../types/recurringSchedule'

export interface ContractVisitFrequency {
  frequency: RecurringFrequency | null
  visitsPerYear: number | null
  /** Det upplösta avtalets id — satt även när avtalet saknar frekvens, så
   *  wizarden kan berätta att valet kommer att sparas på avtalet. */
  contractId: string | null
}

const EMPTY: ContractVisitFrequency = { frequency: null, visitsPerYear: null, contractId: null }

export function useContractVisitFrequency(
  customerId: string | null | undefined,
  /** Valt avtal när kunden täcks av flera — annars slås det upp automatiskt. */
  preferredContractId?: string | null
) {
  const [data, setData] = useState<ContractVisitFrequency>(EMPTY)

  useEffect(() => {
    if (!customerId) {
      setData(EMPTY)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const contractId =
          preferredContractId ?? (await resolveContractForCustomer(customerId))
        if (cancelled || !contractId) {
          if (!cancelled) setData(EMPTY)
          return
        }
        const { data: contract } = await supabase
          .from('contracts')
          .select('visit_frequency, visits_per_year')
          .eq('id', contractId)
          .maybeSingle()
        if (cancelled) return
        const row = contract as { visit_frequency?: string | null; visits_per_year?: number | null } | null
        setData({
          frequency: (row?.visit_frequency as RecurringFrequency | undefined) ?? null,
          visitsPerYear: row?.visits_per_year ?? null,
          contractId,
        })
      } catch (err) {
        console.error('Kunde inte hämta avtalets besöksfrekvens:', err)
        if (!cancelled) setData(EMPTY)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, preferredContractId])

  return data
}
