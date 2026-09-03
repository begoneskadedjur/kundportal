// src/services/fortnoxMirrorService.ts
// Frontendens väg till Fortnox-spegeln (fortnox_customer_numbers) och till
// allokeringen av kundnummer vid "Till Fortnox". Se docs/kundnummer-fortnox-plan.md.

import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import type { FortnoxMirrorHit } from '../shared/fortnoxCustomerNumbers'

export interface CustomerGroupFortnoxStats {
  group_id: string
  fortnox_max: number | null
  fortnox_count: number
  fortnox_active: number
}

export interface FortnoxMirrorState {
  watermark: string | null
  last_full_sync_at: string | null
  last_incremental_at: string | null
  last_error: string | null
  total_active: number | null
  total_inactive: number | null
}

export interface MirrorSyncResult {
  ok: boolean
  mode: 'full' | 'incremental'
  active: number
  inactive: number
  upserted: number
  missing: number
  pages: number
  error?: string
}

export type AllocateCustomerResult =
  | { status: 'existing' | 'created' | 'reused' | 'conflict-adopted'; customerNumber: string; fortnoxName?: string | null; holderCustomerId?: string; outsideGroup?: boolean; groupName?: string; warnings?: string[] }
  | { status: 'candidates'; kind: 'multiple' | 'inactive-only'; candidates: FortnoxMirrorHit[]; warnings?: string[] }

export interface AllocateCustomerParams {
  customerId: string
  invoiceId?: string
  groupId?: string | null
  chosenCustomerNumber?: string
  reactivate?: boolean
  forceNew?: boolean
  ourReference?: string | null
}

export const MIRROR_STALE_MS = 10 * 60 * 1000

export const FortnoxMirrorService = {
  async getGroupStats(): Promise<Record<string, CustomerGroupFortnoxStats>> {
    const { data, error } = await supabase.rpc('customer_group_fortnox_stats')
    if (error) throw new Error(`Kunde inte läsa Fortnox-spegeln: ${error.message}`)
    const out: Record<string, CustomerGroupFortnoxStats> = {}
    for (const row of (data ?? []) as CustomerGroupFortnoxStats[]) out[row.group_id] = row
    return out
  },

  async getState(): Promise<FortnoxMirrorState | null> {
    const { data } = await supabase
      .from('fortnox_customer_mirror_state')
      .select('watermark, last_full_sync_at, last_incremental_at, last_error, total_active, total_inactive')
      .eq('id', 1)
      .maybeSingle()
    return (data as FortnoxMirrorState | null) ?? null
  },

  isStale(state: FortnoxMirrorState | null): boolean {
    if (!state?.watermark) return true
    return Date.now() - new Date(state.watermark).getTime() > MIRROR_STALE_MS
  },

  async sync(mode: 'incremental' | 'full' = 'incremental'): Promise<MirrorSyncResult> {
    const res = await apiFetch('/api/fortnox/sync-customers', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body?.ok === false) {
      throw new Error(body?.error || `Synk misslyckades (${res.status})`)
    }
    return body as MirrorSyncResult
  },

  async allocateCustomer(params: AllocateCustomerParams): Promise<AllocateCustomerResult> {
    const res = await apiFetch('/api/fortnox/allocate-customer', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(body?.error || `Kundnummer kunde inte tilldelas (${res.status})`)
    }
    return body as AllocateCustomerResult
  },
}
