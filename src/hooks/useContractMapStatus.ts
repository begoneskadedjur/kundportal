// src/hooks/useContractMapStatus.ts
// Avtalskartans status per kund (RPC contract_map_status_summary), för
// markören i Befintliga kunder: saknar karta / N steg kvar / komplett.
// Modul-singleton som useAddonPending: en hämtning oavsett antal lyssnare.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ContractMapState = 'none' | 'incomplete' | 'complete'

export interface ContractMapStatus {
  root_customer_id: string
  organization_id: string | null
  live_contracts: number
  status: ContractMapState
  missing_count: number
  missing: string[]
}

type Listener = (rows: ContractMapStatus[]) => void

const store = {
  rows: [] as ContractMapStatus[],
  listeners: new Set<Listener>(),
  started: false,
  channel: null as ReturnType<typeof supabase.channel> | null,
}

function emit() {
  store.listeners.forEach((l) => l(store.rows))
}

async function refetch() {
  try {
    const { data, error } = await supabase.rpc('contract_map_status_summary')
    if (error) throw error
    store.rows = (data ?? []) as ContractMapStatus[]
    emit()
  } catch {
    // Tyst: markören är inte kritisk
  }
}

function ensureStarted() {
  if (store.started) return
  store.started = true
  void refetch()
  store.channel = supabase
    .channel('contract-map-status')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => void refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_sites' }, () => void refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_schedules' }, () => void refetch())
    .subscribe()
}

function stop() {
  if (store.channel) {
    supabase.removeChannel(store.channel)
    store.channel = null
  }
  store.started = false
}

export function useContractMapStatus(): ContractMapStatus[] {
  const [rows, setRows] = useState(store.rows)
  useEffect(() => {
    const listener: Listener = (r) => setRows(r)
    store.listeners.add(listener)
    ensureStarted()
    setRows(store.rows)
    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) stop()
    }
  }, [])
  return rows
}

/** Slå upp en kund i listan: multisite via organization_id, annars kundens id */
export function findContractMapStatus(
  rows: ContractMapStatus[],
  org: { id: string; organizationType: 'multisite' | 'single'; organizationId?: string | null }
): ContractMapStatus | null {
  if (rows.length === 0) return null
  if (org.organizationType === 'multisite') {
    const key = org.organizationId ?? org.id
    return rows.find((r) => r.organization_id === key) ?? rows.find((r) => r.root_customer_id === org.id) ?? null
  }
  return rows.find((r) => r.root_customer_id === org.id) ?? null
}
