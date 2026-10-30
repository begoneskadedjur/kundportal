// src/hooks/useContractWorkItems.ts
// Arbetslistan på avtalskartan (contract_work_items, steg 10), för alla kunder.
// Bara faktureringsansvariga (profiles.can_approve_invoices) får något, alla
// andra får en tom lista. Modul-singleton som useAddonPending: en hämtning
// oavsett antal lyssnare, realtid på stationstabellerna med intervall-fallback.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { buildWorkItemLink, firstWorkItemFor, type ContractWorkItem } from '../shared/contractWorkItems'

type Listener = (rows: ContractWorkItem[]) => void

const store = {
  rows: [] as ContractWorkItem[],
  listeners: new Set<Listener>(),
  key: null as string | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  interval: null as ReturnType<typeof setInterval> | null,
}

function emit() {
  store.listeners.forEach((l) => l(store.rows))
}

/** Normaliserar en rad ur RPC:n (numeric kommer som text) */
export function normalizeWorkItem(r: ContractWorkItem): ContractWorkItem {
  return {
    ...r,
    station_count: Number(r.station_count ?? 0),
    annual_kr: r.annual_kr == null ? null : Number(r.annual_kr),
    sort_order: Number(r.sort_order ?? 0),
  }
}

async function refetch() {
  const key = store.key
  if (!key) return
  try {
    const { data, error } = await supabase.rpc('contract_work_items', { p_root_customer_id: null })
    if (store.key !== key) return
    if (error) throw error
    store.rows = ((data ?? []) as ContractWorkItem[]).map(normalizeWorkItem)
    emit()
  } catch {
    // Tyst: listan och pluppen är inte kritiska
  }
}

/** Läs om listan direkt (efter ett beslut i kartan) */
export function refreshContractWorkItems(): void {
  void refetch()
}

/** Arbetslistan för en kund, direkt ur databasen (notisklick, kartan) */
export async function fetchContractWorkItems(rootId: string): Promise<ContractWorkItem[]> {
  const { data, error } = await supabase.rpc('contract_work_items', { p_root_customer_id: rootId })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ContractWorkItem[]).map(normalizeWorkItem)
}

/**
 * Länken för en kundnotis: kartan på kundens första uppgift. Utan uppgift
 * (eller om listan inte går att läsa) blir det dagens länk till Innehåll.
 */
export async function workItemLinkForCustomer(base: string, rootId: string): Promise<string> {
  try {
    const first = firstWorkItemFor(await fetchContractWorkItems(rootId), rootId)
    if (first) {
      return buildWorkItemLink(base, first.kind, { rootId, contractId: first.contract_id, unitId: first.unit_id })
    }
  } catch {
    // dagens länk
  }
  return buildWorkItemLink(base, null, { rootId })
}

function stop() {
  if (store.channel) {
    supabase.removeChannel(store.channel)
    store.channel = null
  }
  if (store.interval) {
    clearInterval(store.interval)
    store.interval = null
  }
  store.key = null
  store.rows = []
}

function ensureStarted(key: string) {
  if (store.key === key) return
  stop()
  store.key = key
  void refetch()
  store.channel = supabase
    .channel('contract-work-items')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_placements' }, () => void refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'indoor_stations' }, () => void refetch())
    .subscribe()
  store.interval = setInterval(() => void refetch(), 120000)
}

/** Alla uppgifter på avtalskartorna. Tom lista för den som inte är faktureringsansvarig. */
export function useContractWorkItems(): ContractWorkItem[] {
  const { user, profile } = useAuth()
  const allowed = !!profile?.can_approve_invoices
  const [rows, setRows] = useState(store.rows)

  useEffect(() => {
    const listener: Listener = (r) => setRows(r)
    store.listeners.add(listener)
    if (user?.id && allowed) {
      ensureStarted(user.id)
    } else {
      stop()
      setRows([])
    }
    setRows(store.rows)
    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) stop()
    }
  }, [user?.id, allowed])

  return allowed ? rows : []
}

/** Antal kunder med något att göra på avtalskartan, för sidomenyns plupp */
export function useContractWorkItemsBadge(): number {
  const rows = useContractWorkItems()
  return new Set(rows.map((r) => r.root_customer_id)).size
}

/** Kundens uppgifter: multisite via organization_id ger huvudkundens id, annars kundens id */
export function findWorkItems(rows: ContractWorkItem[], rootIds: string[]): ContractWorkItem[] {
  if (rows.length === 0 || rootIds.length === 0) return []
  const set = new Set(rootIds)
  return rows.filter((r) => set.has(r.root_customer_id))
}
