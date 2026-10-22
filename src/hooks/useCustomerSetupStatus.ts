// src/hooks/useCustomerSetupStatus.ts
// Uppläggningens status per kund i Befintliga kunder (src/shared/customerSetupStatus.ts).
// Hämtar det listan inte redan har: aktiva återkommande scheman med avtalets
// datum (för avtalsårets slut) och avtalsomfattningens läge (vid behov).
// Avtalskartans status kommer från useContractMapStatus, kunderna från
// useConsolidatedCustomers.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ConsolidatedCustomer, CustomerSite } from './useConsolidatedCustomers'
import type { ContractMapStatus } from './useContractMapStatus'
import {
  computeSetupStatus,
  type SetupCustomerRow,
  type SetupInput,
  type SetupSchedule,
  type SetupSummary,
} from '../shared/customerSetupStatus'

export interface SetupExtras {
  schedules: SetupSchedule[]
  onDemandCustomerIds: Set<string>
  loaded: boolean
}

const EMPTY: SetupExtras = { schedules: [], onDemandCustomerIds: new Set(), loaded: false }

export function useCustomerSetupExtras(refreshKey: unknown = null): SetupExtras {
  const [extras, setExtras] = useState<SetupExtras>(EMPTY)

  const load = useCallback(async () => {
    const [schedRes, sitesRes] = await Promise.all([
      supabase
        .from('recurring_schedules')
        .select(
          `id, customer_id, technician_id, frequency, generated_until,
           technician:technicians(name),
           contract:contracts(contract_start_date, start_date, contract_end_date, terminated_at,
             effective_end_date, notice_period_months, contract_length, renewal_mode)`
        )
        .eq('status', 'active'),
      supabase.from('contract_sites').select('customer_id, service_mode, active_to'),
    ])

    type RawSchedule = Omit<SetupSchedule, 'technician_name' | 'contract'> & {
      technician: { name: string | null } | { name: string | null }[] | null
      contract: SetupSchedule['contract'] | NonNullable<SetupSchedule['contract']>[]
    }
    const schedules: SetupSchedule[] = ((schedRes.data ?? []) as unknown as RawSchedule[]).map((s) => {
      const tech = Array.isArray(s.technician) ? s.technician[0] : s.technician
      const contract = Array.isArray(s.contract) ? s.contract[0] : s.contract
      return {
        id: s.id,
        customer_id: s.customer_id,
        technician_id: s.technician_id ?? null,
        technician_name: tech?.name ?? null,
        frequency: s.frequency ?? null,
        generated_until: s.generated_until ?? null,
        contract: contract ?? null,
      }
    })

    // Kundrader där all gällande omfattning är "vid behov": schemalöshet är korrekt
    const today = new Date().toISOString().slice(0, 10)
    const modes = new Map<string, Set<string>>()
    for (const r of (sitesRes.data ?? []) as Array<{ customer_id: string; service_mode: string | null; active_to: string | null }>) {
      if (r.active_to && r.active_to < today) continue
      const set = modes.get(r.customer_id) ?? new Set<string>()
      set.add(r.service_mode ?? 'inspection')
      modes.set(r.customer_id, set)
    }
    const onDemandCustomerIds = new Set<string>()
    modes.forEach((set, id) => {
      if (set.size === 1 && set.has('on_demand')) onDemandCustomerIds.add(id)
    })

    setExtras({ schedules, onDemandCustomerIds, loaded: true })
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return extras
}

function toRow(c: CustomerSite | ConsolidatedCustomer['headquarterCustomer']): SetupCustomerRow {
  const r = c as CustomerSite
  return {
    id: r.id,
    company_name: r.company_name,
    site_name: r.site_name ?? null,
    customer_number: r.customer_number ?? null,
    fortnox_verified_at: r.fortnox_verified_at ?? null,
    organization_number: r.organization_number ?? null,
    parent_customer_id: r.parent_customer_id ?? null,
    is_active: r.is_active,
    business_type: r.business_type ?? null,
    contract_type: r.contract_type ?? null,
    invoice_delivery_method: r.invoice_delivery_method ?? null,
    invoice_delivery_source: r.invoice_delivery_source ?? null,
    invoice_delivery_confirmed_by_name: r.invoice_delivery_confirmed_by_name ?? null,
    billing_email: r.billing_email ?? null,
    billing_address: r.billing_address ?? null,
    contact_email: r.contact_email ?? null,
    contract_start_date: r.contract_start_date ?? null,
    contract_end_date: r.contract_end_date ?? null,
    terminated_at: r.terminated_at ?? null,
    effective_end_date: r.effective_end_date ?? null,
    notice_period_months: r.notice_period_months ?? null,
    contract_length: r.contract_length ?? null,
  }
}

/** Indata för en rad i listan. */
export function setupInputFor(
  org: ConsolidatedCustomer,
  map: ContractMapStatus | null,
  extras: SetupExtras
): SetupInput | null {
  const isMulti = org.organizationType === 'multisite'
  const rootSrc = isMulti ? (org.headquarterCustomer ?? org.sites[0]) : org.sites[0]
  if (!rootSrc) return null
  const root = toRow(rootSrc)
  const units = isMulti ? org.sites.filter((s) => s.id !== root.id).map(toRow) : []
  const familyIds = new Set([root.id, ...units.map((u) => u.id)])
  const hq = isMulti && org.headquarterCustomer ? (org.headquarterCustomer as CustomerSite) : null
  const siteRows: CustomerSite[] = hq && !org.sites.some((s) => s.id === hq.id) ? [hq, ...org.sites] : org.sites
  return {
    kind: isMulti ? 'multisite' : 'single',
    root,
    units,
    terminated: org.isTerminated,
    map: map ? { root_customer_id: map.root_customer_id, status: map.status, missing: map.missing ?? [] } : null,
    schedules: extras.schedules.filter((s) => familyIds.has(s.customer_id)),
    contractTypes: siteRows.flatMap((s) =>
      (s.contracts ?? []).map((c) => ({ customer_id: s.id, contract_type: c.contract_type ?? null }))
    ),
    onDemandCustomerIds: extras.onDemandCustomerIds,
    portal: {
      active: org.activeUsersCount > 0,
      invited: org.activeUsersCount > 0 || org.pendingInvitationsCount > 0 || org.portalAccessStatus !== 'none',
    },
  }
}

/** Status för en rad, eller null medan avtalskartan och schemana hämtas. */
export function setupStatusFor(
  org: ConsolidatedCustomer,
  map: ContractMapStatus | null,
  extras: SetupExtras,
  mapLoaded: boolean
): SetupSummary | null {
  if (org.isTerminated) return { terminated: true, items: [], remaining: 0, next: null, complete: false }
  if (!extras.loaded || !mapLoaded) return null
  const input = setupInputFor(org, map, extras)
  return input ? computeSetupStatus(input) : null
}
