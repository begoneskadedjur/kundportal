// src/services/contractResolver.ts
// Hittar vilket AVTAL som gäller för en kundrad. Delas av schemaläggning,
// stationskontroller och prisupplösning så alla svarar likadant på frågan
// "vilket avtal hör det här besöket/ärendet till?".
//
// Prioritetsordning (samma som Avtalskartan visar):
//   1. Avtal som BOR på kundraden (enhetsavtal eller kundens eget avtal)
//   2. Avtal som TÄCKER raden via contract_sites (aktiv täckning idag)
//   3. Huvudkontorets avtal med covers_all_sites (täcker alla enheter)
//
// Vid flera träffar inom ett steg vinner det nyaste avtalet. Null betyder att
// ingen entydig koppling finns — anroparen ska då lämna contract_id tomt
// hellre än att gissa.

import { supabase as defaultClient } from '../lib/supabase'
import {
  LIVE_CONTRACT_STATUSES,
  isLiveContract,
  isImportedContractRow,
  todayKey,
} from '../utils/contractLifecycle'

// Grovfilter mot DB. Ett uppsagt avtal ligger kvar på 'signed' fram till sitt
// slutdatum, så statusen ensam räcker inte — varje kandidat körs dessutom
// genom isLiveContract() nedan.
const ACTIVE_STATUSES = [...LIVE_CONTRACT_STATUSES]

/** Fälten varje kandidat måste bära för att livscykeln ska gå att bedöma. */
const LIFECYCLE_COLUMNS = 'status, terminated_at, effective_end_date, contract_end_date'

/**
 * Resolvern körs både mot browser-klienten och (potentiellt) en
 * service-role-klient i api/. Typen tas från den klient vi faktiskt
 * importerar så att anrop mot fel tabellnamn fortfarande fångas.
 */
type AnyClient = typeof defaultClient

interface ContractCandidate {
  id: string
  created_at: string
  status?: string | null
  terminated_at?: string | null
  effective_end_date?: string | null
  contract_end_date?: string | null
}

/**
 * Avslutade avtal får aldrig plockas upp av resolvern — de ska inte kunna
 * kopplas till nya besök, ärenden eller priser. Uppsagt-men-löpande behålls:
 * det fungerar till och med sista giltiga dagen.
 */
function liveOnly<T extends ContractCandidate>(rows: T[], today: string): T[] {
  return rows.filter((r) => isLiveContract(r, today))
}

function newest(rows: ContractCandidate[]): string | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0].id
}

/**
 * Avtalet som gäller för en kundrad idag. Returnerar null när ingen entydig
 * koppling finns (ingen träff — eller kunden saknar riktiga avtal).
 */
export async function resolveContractForCustomer(
  customerId: string,
  client: AnyClient = defaultClient
): Promise<string | null> {
  if (!customerId) return null
  const today = todayKey()

  // 1. Avtal som bor på kundraden. Importrester (template_id='imported' eller
  //    oneflow_contract_id 'imported-…') räknas inte som riktiga avtal.
  const { data: owned } = await client
    .from('contracts')
    .select(`id, created_at, template_id, oneflow_contract_id, ${LIFECYCLE_COLUMNS}`)
    .eq('customer_id', customerId)
    .in('status', ACTIVE_STATUSES)
  const realOwned = liveOnly(
    ((owned ?? []) as unknown as (ContractCandidate & {
      template_id?: string | null
      oneflow_contract_id?: string | null
    })[]).filter((c) => !isImportedContractRow(c)),
    today
  )
  const ownedId = newest(realOwned)
  if (ownedId) return ownedId

  // 2. Avtal som täcker kundraden via contract_sites (aktiv täckning idag)
  const { data: covering } = await client
    .from('contract_sites')
    .select(
      `active_from, active_to, contract:contracts!inner(id, created_at, ${LIFECYCLE_COLUMNS})`
    )
    .eq('customer_id', customerId)
  type CoveringRow = {
    active_from: string | null
    active_to: string | null
    contract: ContractCandidate | null
  }
  const covered = ((covering ?? []) as unknown as CoveringRow[])
    .filter((r) => (!r.active_from || r.active_from <= today) && (!r.active_to || r.active_to >= today))
    .map((r) => r.contract)
    .filter(
      (c): c is ContractCandidate => !!c && ACTIVE_STATUSES.includes((c.status ?? '') as (typeof ACTIVE_STATUSES)[number])
    )
  const coveredId = newest(liveOnly(covered, today))
  if (coveredId) return coveredId

  // 3. Huvudkontorets avtal med covers_all_sites
  const { data: customer } = await client
    .from('customers')
    .select('parent_customer_id')
    .eq('id', customerId)
    .maybeSingle()
  const parentId = (customer as { parent_customer_id?: string | null } | null)?.parent_customer_id
  if (!parentId) return null

  const { data: parentContracts } = await client
    .from('contracts')
    .select(`id, created_at, ${LIFECYCLE_COLUMNS}`)
    .eq('customer_id', parentId)
    .eq('covers_all_sites', true)
    .in('status', ACTIVE_STATUSES)
  return newest(liveOnly((parentContracts ?? []) as unknown as ContractCandidate[], today))
}

/**
 * Som ovan men för flera kundrader på en gång — en fråga per steg i stället
 * för en per kund. Returnerar en map {customer_id: contract_id}; kunder utan
 * entydig koppling saknas i mappen.
 */
export async function resolveContractsForCustomers(
  customerIds: string[],
  client: AnyClient = defaultClient
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(customerIds.filter(Boolean)))
  if (unique.length === 0) return {}
  const today = todayKey()
  const result: Record<string, string> = {}

  // 1. Egna avtal
  const { data: owned } = await client
    .from('contracts')
    .select(`id, customer_id, created_at, template_id, oneflow_contract_id, ${LIFECYCLE_COLUMNS}`)
    .in('customer_id', unique)
    .in('status', ACTIVE_STATUSES)
  const ownedByCustomer = new Map<string, ContractCandidate[]>()
  for (const row of (owned ?? []) as unknown as (ContractCandidate & {
    customer_id: string
    template_id?: string | null
    oneflow_contract_id?: string | null
  })[]) {
    if (isImportedContractRow(row)) continue
    if (!isLiveContract(row, today)) continue
    const list = ownedByCustomer.get(row.customer_id) ?? []
    list.push(row)
    ownedByCustomer.set(row.customer_id, list)
  }
  for (const [customerId, rows] of ownedByCustomer) {
    const id = newest(rows)
    if (id) result[customerId] = id
  }

  // 2. Täckning via contract_sites
  const remaining = unique.filter((id) => !result[id])
  if (remaining.length > 0) {
    const { data: covering } = await client
      .from('contract_sites')
      .select(
        `customer_id, active_from, active_to, contract:contracts!inner(id, created_at, ${LIFECYCLE_COLUMNS})`
      )
      .in('customer_id', remaining)
    type CoveringRow = {
      customer_id: string
      active_from: string | null
      active_to: string | null
      contract: ContractCandidate | null
    }
    const byCustomer = new Map<string, ContractCandidate[]>()
    for (const r of (covering ?? []) as unknown as CoveringRow[]) {
      if (r.active_from && r.active_from > today) continue
      if (r.active_to && r.active_to < today) continue
      if (
        !r.contract ||
        !ACTIVE_STATUSES.includes((r.contract.status ?? '') as (typeof ACTIVE_STATUSES)[number])
      ) {
        continue
      }
      if (!isLiveContract(r.contract, today)) continue
      const list = byCustomer.get(r.customer_id) ?? []
      list.push(r.contract)
      byCustomer.set(r.customer_id, list)
    }
    for (const [customerId, rows] of byCustomer) {
      const id = newest(rows)
      if (id) result[customerId] = id
    }
  }

  // 3. Huvudkontorets covers_all_sites-avtal
  const stillMissing = unique.filter((id) => !result[id])
  if (stillMissing.length > 0) {
    const { data: customers } = await client
      .from('customers')
      .select('id, parent_customer_id')
      .in('id', stillMissing)
    const parentByCustomer = new Map<string, string>()
    for (const c of (customers ?? []) as { id: string; parent_customer_id: string | null }[]) {
      if (c.parent_customer_id) parentByCustomer.set(c.id, c.parent_customer_id)
    }
    const parentIds = Array.from(new Set(parentByCustomer.values()))
    if (parentIds.length > 0) {
      const { data: parentContracts } = await client
        .from('contracts')
        .select(`id, customer_id, created_at, ${LIFECYCLE_COLUMNS}`)
        .in('customer_id', parentIds)
        .eq('covers_all_sites', true)
        .in('status', ACTIVE_STATUSES)
      const byParent = new Map<string, ContractCandidate[]>()
      for (const row of (parentContracts ?? []) as unknown as (ContractCandidate & {
        customer_id: string
      })[]) {
        if (!isLiveContract(row, today)) continue
        const list = byParent.get(row.customer_id) ?? []
        list.push(row)
        byParent.set(row.customer_id, list)
      }
      for (const [customerId, parentId] of parentByCustomer) {
        const id = newest(byParent.get(parentId) ?? [])
        if (id) result[customerId] = id
      }
    }
  }

  return result
}
