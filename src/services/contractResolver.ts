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

/** Hur ett avtal kom att täcka kundraden. Styr både ordning och UI-text. */
export type ContractMatchMechanism = 'owned' | 'site_scope' | 'covers_all_sites'

/** Ett täckande avtal med det gränssnittet behöver för att visa ett val. */
export interface ContractCandidateInfo {
  id: string
  label: string
  contract_type: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  effective_end_date: string | null
  terminated_at: string | null
  annual_value: number | null
  price_list_id: string | null
  visit_frequency: string | null
  visits_per_year: number | null
  oneflow_contract_id: string | null
  created_at: string
  mechanism: ContractMatchMechanism
}

/** Kolumner kandidatuppslaget behöver utöver livscykelfälten. */
const CANDIDATE_COLUMNS =
  'id, created_at, label, address_label, contract_type, contract_start_date, ' +
  'annual_value, price_list_id, visit_frequency, visits_per_year, ' +
  'oneflow_contract_id, template_id, display_order'

type RawCandidate = ContractCandidate & {
  label?: string | null
  address_label?: string | null
  contract_type?: string | null
  contract_start_date?: string | null
  annual_value?: number | string | null
  price_list_id?: string | null
  visit_frequency?: string | null
  visits_per_year?: number | null
  oneflow_contract_id?: string | null
  template_id?: string | null
  display_order?: number | null
}

function toCandidate(row: RawCandidate, mechanism: ContractMatchMechanism): ContractCandidateInfo {
  return {
    id: row.id,
    label: row.label || row.address_label || row.contract_type || 'Avtal utan namn',
    contract_type: row.contract_type ?? null,
    contract_start_date: row.contract_start_date ?? null,
    contract_end_date: row.contract_end_date ?? null,
    effective_end_date: row.effective_end_date ?? null,
    terminated_at: row.terminated_at ?? null,
    annual_value: row.annual_value == null ? null : Number(row.annual_value),
    price_list_id: row.price_list_id ?? null,
    visit_frequency: row.visit_frequency ?? null,
    visits_per_year: row.visits_per_year ?? null,
    oneflow_contract_id: row.oneflow_contract_id ?? null,
    created_at: row.created_at,
    mechanism,
  }
}

const MECHANISM_ORDER: Record<ContractMatchMechanism, number> = {
  owned: 0,
  site_scope: 1,
  covers_all_sites: 2,
}

/**
 * ALLA avtal som täcker kundraden idag — samma fråga som Avtalskartan ställer.
 *
 * Till skillnad från resolveContractForCustomer stannar den inte vid första
 * träffande mekanismen. En enhet kan ha ett eget avtal OCH omfattas av
 * huvudkontorets, och flera jämbördiga avtal kan täcka samma adress för olika
 * tjänster (betongstation, mekaniska fällor, sanering). Då ska användaren se
 * dem och välja, inte få systemets gissning.
 *
 * Sorteras deterministiskt: mekanism, sedan äldst först. Aldrig created_at
 * ensamt — förvalet ska inte hoppa mellan avtal när ett nytt tecknas.
 */
export async function resolveContractCandidates(
  customerId: string,
  client: AnyClient = defaultClient
): Promise<ContractCandidateInfo[]> {
  if (!customerId) return []
  const today = todayKey()
  const found: ContractCandidateInfo[] = []

  // Primär väg: SECURITY DEFINER-RPC som levererar kandidaterna förbi RLS.
  // Tekniker läser contracts bara där begone_employee_email matchar, så
  // scheman och sessioner de skapade fick contract_id = null. Urvalet
  // (levande, ej importrest, datumtäckning, nyast vinner) görs fortfarande
  // här. Saknas RPC:n (äldre miljö) faller vi tillbaka på direktläsning.
  const viaRpc = await resolveCandidatesViaRpc(customerId, today, client)
  if (viaRpc) return finalizeCandidates(viaRpc)

  // 1. Avtal som bor på kundraden. Importrester (template_id='imported' eller
  //    oneflow_contract_id 'imported-…') räknas inte som riktiga avtal.
  const { data: owned } = await client
    .from('contracts')
    .select(`${CANDIDATE_COLUMNS}, ${LIFECYCLE_COLUMNS}`)
    .eq('customer_id', customerId)
    .in('status', ACTIVE_STATUSES)
  const realOwned = liveOnly(
    ((owned ?? []) as unknown as RawCandidate[]).filter((c) => !isImportedContractRow(c)),
    today
  )
  found.push(...realOwned.map((r) => toCandidate(r, 'owned')))

  // 2. Avtal som täcker kundraden via contract_sites (aktiv täckning idag)
  const { data: covering } = await client
    .from('contract_sites')
    .select(
      `active_from, active_to, contract:contracts!inner(${CANDIDATE_COLUMNS}, ${LIFECYCLE_COLUMNS})`
    )
    .eq('customer_id', customerId)
  type CoveringRow = {
    active_from: string | null
    active_to: string | null
    contract: RawCandidate | null
  }
  const covered = ((covering ?? []) as unknown as CoveringRow[])
    .filter((r) => (!r.active_from || r.active_from <= today) && (!r.active_to || r.active_to >= today))
    .map((r) => r.contract)
    .filter(
      (c): c is RawCandidate => !!c && ACTIVE_STATUSES.includes((c.status ?? '') as (typeof ACTIVE_STATUSES)[number])
    )
  found.push(...liveOnly(covered, today).map((r) => toCandidate(r, 'site_scope')))

  // 3. Huvudkontorets avtal med covers_all_sites
  const { data: customer } = await client
    .from('customers')
    .select('parent_customer_id')
    .eq('id', customerId)
    .maybeSingle()
  const parentId = (customer as { parent_customer_id?: string | null } | null)?.parent_customer_id
  if (parentId) {
    const { data: parentContracts } = await client
      .from('contracts')
      .select(`${CANDIDATE_COLUMNS}, ${LIFECYCLE_COLUMNS}`)
      .eq('customer_id', parentId)
      .eq('covers_all_sites', true)
      .in('status', ACTIVE_STATUSES)
    found.push(
      ...liveOnly((parentContracts ?? []) as unknown as RawCandidate[], today).map((r) =>
        toCandidate(r, 'covers_all_sites')
      )
    )
  }

  return finalizeCandidates(found)
}

/** Samma avtal kan träffa via flera mekanismer — behåll den starkaste, sortera deterministiskt. */
function finalizeCandidates(found: ContractCandidateInfo[]): ContractCandidateInfo[] {
  const byId = new Map<string, ContractCandidateInfo>()
  for (const c of found) {
    const prev = byId.get(c.id)
    if (!prev || MECHANISM_ORDER[c.mechanism] < MECHANISM_ORDER[prev.mechanism]) byId.set(c.id, c)
  }

  return [...byId.values()].sort((a, b) => {
    const m = MECHANISM_ORDER[a.mechanism] - MECHANISM_ORDER[b.mechanism]
    if (m !== 0) return m
    return (a.created_at ?? '').localeCompare(b.created_at ?? '')
  })
}

let rpcWarned = false

type RpcCandidateRow = RawCandidate & {
  mechanism: ContractMatchMechanism
  active_from?: string | null
  active_to?: string | null
}

/**
 * Kandidater via RPC:n get_contract_candidates (migration 20260902).
 * Returnerar null när RPC:n saknas eller felar, så anroparen kan falla
 * tillbaka. Filtren är identiska med direktläsningen ovan.
 */
async function resolveCandidatesViaRpc(
  customerId: string,
  today: string,
  client: AnyClient
): Promise<ContractCandidateInfo[] | null> {
  const { data, error } = await client.rpc('get_contract_candidates', { p_customer_id: customerId })
  if (error) {
    // Migrationen 20260902_contract_candidates_rpc är inte applicerad överallt
    // ännu — varna en gång per session, inte vid varje uppslag.
    if (!rpcWarned) {
      rpcWarned = true
      console.warn('[contractResolver] RPC get_contract_candidates otillgänglig, faller tillbaka på direktläsning:', error.message)
    }
    return null
  }
  const rows = ((data ?? []) as unknown as RpcCandidateRow[]).filter((r) => {
    if (!ACTIVE_STATUSES.includes((r.status ?? '') as (typeof ACTIVE_STATUSES)[number])) return false
    if (!isLiveContract(r, today)) return false
    if (r.mechanism === 'owned' && isImportedContractRow(r)) return false
    if (r.mechanism === 'site_scope') {
      if (r.active_from && r.active_from > today) return false
      if (r.active_to && r.active_to < today) return false
    }
    return true
  })
  return rows.map((r) => toCandidate(r, r.mechanism))
}

/**
 * Väljer ett avtal när ingen människa kan tillfrågas (cron, batch, bakgrund).
 *
 * Replikerar den gamla stegvisa resolvern EXAKT: första mekanismen som har
 * träffar vinner, och inom den tas det nyaste avtalet. Att i stället ta
 * "nyaste av alla kandidater" skulle tyst flytta contract_id för varje enhet
 * som har både eget avtal och huvudkontorstäckning.
 */
export function pickAutomatic(candidates: ContractCandidateInfo[]): string | null {
  if (candidates.length === 0) return null
  const best = candidates.reduce(
    (acc, c) => Math.min(acc, MECHANISM_ORDER[c.mechanism]),
    MECHANISM_ORDER.covers_all_sites
  )
  const sameMechanism = candidates.filter((c) => MECHANISM_ORDER[c.mechanism] === best)
  return newest(sameMechanism)
}

/**
 * Avtalet som gäller för en kundrad idag. Returnerar null när ingen entydig
 * koppling finns (ingen träff — eller kunden saknar riktiga avtal).
 *
 * Behåll för bakgrundsflöden. I gränssnitt där användaren kan tillfrågas: använd
 * resolveContractCandidates och låt hen välja när det finns fler än ett.
 */
export async function resolveContractForCustomer(
  customerId: string,
  client: AnyClient = defaultClient
): Promise<string | null> {
  if (!customerId) return null
  const candidates = await resolveContractCandidates(customerId, client)
  if (candidates.length > 1) {
    console.warn('[contractResolver] Flera gällande avtal — automatiskt val', {
      customerId,
      valt: pickAutomatic(candidates),
      kandidater: candidates.map((c) => ({ id: c.id, label: c.label, mechanism: c.mechanism })),
    })
  }
  return pickAutomatic(candidates)
}

/**
 * Vilka av kundraderna omfattas av ETT visst avtal? Rätt fråga när ett avtal
 * sägs upp: ett schema kan täckas av flera avtal, och "vilket avtal hör kunden
 * till" har då inget entydigt svar.
 */
export async function customersCoveredByContract(
  contractId: string,
  customerIds: string[],
  client: AnyClient = defaultClient
): Promise<Set<string>> {
  const covered = new Set<string>()
  if (!contractId || customerIds.length === 0) return covered
  const today = todayKey()
  const unique = [...new Set(customerIds)]

  // 1. Avtalet bor på kundraden
  const { data: contract } = await client
    .from('contracts')
    .select('customer_id, covers_all_sites')
    .eq('id', contractId)
    .maybeSingle()
  const row = contract as { customer_id?: string | null; covers_all_sites?: boolean | null } | null
  if (row?.customer_id && unique.includes(row.customer_id)) covered.add(row.customer_id)

  // 2. Täckning via contract_sites, aktiv idag
  const { data: scoped } = await client
    .from('contract_sites')
    .select('customer_id, active_from, active_to')
    .eq('contract_id', contractId)
    .in('customer_id', unique)
  for (const s of (scoped ?? []) as { customer_id: string; active_from: string | null; active_to: string | null }[]) {
    if ((!s.active_from || s.active_from <= today) && (!s.active_to || s.active_to >= today)) {
      covered.add(s.customer_id)
    }
  }

  // 3. covers_all_sites når alla enheter under avtalets kund
  if (row?.covers_all_sites && row.customer_id) {
    const { data: children } = await client
      .from('customers')
      .select('id')
      .eq('parent_customer_id', row.customer_id)
      .in('id', unique)
    for (const c of (children ?? []) as { id: string }[]) covered.add(c.id)
  }

  return covered
}

/**
 * Som ovan men för flera kundrader på en gång — en fråga per steg i stället
 * för en per kund. Returnerar en map {customer_id: contract_id}; kunder utan
 * entydig koppling saknas i mappen.
 *
 * Saknar anropare sedan uppsägningen bytte till customersCoveredByContract:
 * "vilket avtal hör kunden till" har inget entydigt svar när flera avtal
 * täcker samma adress. Behåll för batchflöden som verkligen behöver ETT
 * avtal per kund — fråga annars customersCoveredByContract.
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
