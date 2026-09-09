// src/hooks/useContractFinancials.ts
// Avtalets ekonomi ur EN anropspunkt: contract_financials() i databasen.
// Premie i kraft (trappan), nästa steg, tillägg ur stationerna, intern
// kostnad, fakturerat och betalt. Pappret, pulsen och ekonomisidan läser
// samma funktion. Marginalprocent räknas i src/shared/marginEngine.ts.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ContractFinancials {
  asof: string
  premium_in_force: number | null
  premium_next: { effective_from: string; annual_value: number; event_type: string } | null
  addon_annual: number
  addon_cost: number
  addon_stations_active: number
  addon_stations_removed: number
  internal_cost_annual: number
  labour_hours: number
  revenue_annual: number
  invoiced: number
  paid: number
  outstanding: number
  invoice_count: number
  last_invoice_period_start: string | null
}

const num = (v: unknown) => (v == null ? 0 : Number(v))

export async function fetchContractFinancials(contractId: string, asof?: string): Promise<ContractFinancials | null> {
  const { data, error } = await supabase.rpc('contract_financials', { p_contract_id: contractId, p_asof: asof ?? new Date().toISOString().slice(0, 10) })
  if (error) {
    console.warn('[contract_financials]', error.message)
    return null
  }
  const d = (data ?? {}) as Record<string, unknown>
  return {
    asof: String(d.asof ?? ''),
    premium_in_force: d.premium_in_force == null ? null : Number(d.premium_in_force),
    premium_next: (d.premium_next as ContractFinancials['premium_next']) ?? null,
    addon_annual: num(d.addon_annual),
    addon_cost: num(d.addon_cost),
    addon_stations_active: num(d.addon_stations_active),
    addon_stations_removed: num(d.addon_stations_removed),
    internal_cost_annual: num(d.internal_cost_annual),
    labour_hours: num(d.labour_hours),
    revenue_annual: num(d.revenue_annual),
    invoiced: num(d.invoiced),
    paid: num(d.paid),
    outstanding: num(d.outstanding),
    invoice_count: num(d.invoice_count),
    last_invoice_period_start: (d.last_invoice_period_start as string | null) ?? null,
  }
}

export function useContractFinancials(contractId: string | null, reloadKey = 0): ContractFinancials | null {
  const [fin, setFin] = useState<ContractFinancials | null>(null)
  useEffect(() => {
    if (!contractId) {
      setFin(null)
      return
    }
    let cancelled = false
    fetchContractFinancials(contractId).then((f) => {
      if (!cancelled) setFin(f)
    })
    return () => {
      cancelled = true
    }
  }, [contractId, reloadKey])
  return fin
}
