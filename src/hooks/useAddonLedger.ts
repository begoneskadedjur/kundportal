// src/hooks/useAddonLedger.ts
// Tilläggens resultat över tid för ett avtal. Läser stationerna (även
// borttagna) och arbetstiden för att hantera tilläggen via
// contract_addon_ledger() och räknar med addonLedger.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeAddonLedger, type AddonLedger, type LedgerStationInput } from '../shared/addonLedger'

export function useAddonLedger(
  contract: { id: string; contract_end_date?: string | null; option_until?: string | null } | null,
  reloadKey = 0
): { ledger: AddonLedger | null; loading: boolean } {
  const [ledger, setLedger] = useState<AddonLedger | null>(null)
  const [loading, setLoading] = useState(false)
  const contractId = contract?.id ?? null
  const contractEnd = contract?.contract_end_date ?? null
  const optionEnd = contract?.option_until ?? null

  useEffect(() => {
    if (!contractId) {
      setLedger(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      // p_include_labour: arbetstiden för att hantera tilläggen, en rad per enhet
      const { data, error } = await supabase.rpc('contract_addon_ledger', { p_contract_id: contractId, p_include_labour: true })
      if (cancelled) return
      if (error) {
        console.warn('[useAddonLedger]', error.message)
        setLedger(null)
      } else {
        const rows = (data ?? []) as LedgerStationInput[]
        setLedger(rows.length > 0 ? computeAddonLedger(rows, { contractEnd, optionEnd }) : null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [contractId, contractEnd, optionEnd, reloadKey])

  return { ledger, loading }
}
