// src/hooks/useAddonPending.ts
// Tilläggsstationer som väntar på beslut om fakturering, per kund. Bara
// faktureringsansvariga (profiles.can_approve_invoices) får något, alla andra
// får en tom lista och siffran 0. Modul-singleton som useIncidentBadge:
// en prenumeration oavsett hur många komponenter som lyssnar, realtid på
// stationstabellerna med intervall-fallback.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface AddonPendingSummary {
  root_customer_id: string
  organization_id: string | null
  company_name: string
  stations: number
  units: number
  contracts: number
  annual_kr: number
  first_marked_at: string | null
}

type Listener = (rows: AddonPendingSummary[]) => void

const store = {
  rows: [] as AddonPendingSummary[],
  listeners: new Set<Listener>(),
  key: null as string | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  interval: null as ReturnType<typeof setInterval> | null,
}

function emit() {
  store.listeners.forEach((l) => l(store.rows))
}

async function refetch() {
  const key = store.key
  if (!key) return
  try {
    const { data, error } = await supabase.rpc('addon_pending_summary')
    if (store.key !== key) return
    if (error) throw error
    const rows = ((data ?? []) as AddonPendingSummary[]).map((r) => ({ ...r, annual_kr: Number(r.annual_kr ?? 0) }))
    store.rows = rows
    emit()
  } catch {
    // Tyst: pluppen är inte kritisk
  }
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
    .channel('addon-pending')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_placements' }, () => void refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'indoor_stations' }, () => void refetch())
    .subscribe()
  store.interval = setInterval(() => void refetch(), 120000)
}

/** Kunder med tillägg att besluta. Tom lista för den som inte är faktureringsansvarig. */
export function useAddonPending(): AddonPendingSummary[] {
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

/** Antal kunder med tillägg att besluta, för sidomenyns plupp */
export function useAddonPendingBadge(): number {
  return useAddonPending().length
}

/** Slå upp en kund i listan: multisite via organization_id, annars kundens id */
export function findAddonPending(
  rows: AddonPendingSummary[],
  org: { id: string; organizationType: 'multisite' | 'single'; organizationId?: string | null }
): AddonPendingSummary | null {
  if (rows.length === 0) return null
  if (org.organizationType === 'multisite') {
    const key = org.organizationId ?? org.id
    return rows.find((r) => r.organization_id === key) ?? null
  }
  return rows.find((r) => r.root_customer_id === org.id) ?? null
}
