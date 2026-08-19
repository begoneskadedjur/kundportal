// src/hooks/useCustomerRecord.ts
// Datahämtning för den kanoniska kundsidan (/admin/befintliga-kunder/:id).
// :id kan vara org-raden ELLER en enhetsrad (customers.parent_customer_id satt) —
// hooken laddar alltid HELA familjen (org + alla enheter) så sidan kan visa
// avtal, fakturering och tidslinje samlat oavsett vilken rad man landar på.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Contract, Customer } from '../types/database'

// customers har kolumner som ännu inte finns i database.ts-typen
// (fortnox_verified_at är ny, notice_period_months finns i DB men saknas i typen)
export type RecordCustomer = Customer & {
  fortnox_verified_at?: string | null
  notice_period_months?: number | null
}

// contracts.label är ny, backfylld kolumn — används som avtalsnamn
export type RecordContract = Contract & { label?: string | null }

export interface RecordBillingItem {
  id: string
  customer_id: string
  billing_period_start: string
  billing_period_end: string
  article_name: string
  total_price: number
  status: string
  invoice_number: string | null
  invoiced_at: string | null
  paid_at: string | null
  due_date: string | null
  sent_at: string | null
  fortnox_document_number: string | null
  notes: string | null
}

export interface RecordAddition {
  id: string
  customer_id: string
  description: string | null
  annual_amount: number | null
  prorated_amount: number | null
  effective_from: string | null
  previous_annual_value: number | null
  new_annual_value: number | null
  created_by_name: string | null
  applied_at: string | null
  kind: string | null
}

// Etapp 4: avtalets premie över tid. Aktuellt värde = senaste raden
// med effective_from <= idag; framtida rader är kommande trappsteg.
export type PremiumEventType = 'start' | 'step_up' | 'indexation' | 'addition' | 'adjustment' | 'termination'

export interface RecordPremiumEvent {
  id: string
  contract_id: string
  effective_from: string
  annual_value: number
  event_type: PremiumEventType
  note: string | null
}

// Etapp 4: enheter som ett avtal OMFATTAR (avtalet bor på contracts.customer_id).
export interface RecordContractSite {
  id: string
  contract_id: string
  customer_id: string
  active_from: string | null
  active_to: string | null
  note: string | null
}

export interface CustomerRecordData {
  /** Raden för :id (kan vara org eller enhet) */
  customer: RecordCustomer
  /** Org-raden — samma som customer när parent_customer_id saknas */
  root: RecordCustomer
  /** Alla enheter under root (kan innehålla customer om den är en enhet) */
  units: RecordCustomer[]
  /** Familjens avtal (signed/active + importerade trashed-rader) */
  contracts: RecordContract[]
  billingItems: RecordBillingItem[]
  additions: RecordAddition[]
  /** Premietrappa: alla contract_premium_events för familjens avtal */
  premiumEvents: RecordPremiumEvent[]
  /** Omfattning: contract_sites-rader för familjens avtal */
  contractSites: RecordContractSite[]
  /** Antal ärenden (cases) per customer_id i familjen */
  caseCounts: Record<string, number>
}

const BILLING_ITEM_COLUMNS =
  'id, customer_id, billing_period_start, billing_period_end, article_name, total_price, status, invoice_number, invoiced_at, paid_at, due_date, sent_at, fortnox_document_number, notes'

const ADDITION_COLUMNS =
  'id, customer_id, description, annual_amount, prorated_amount, effective_from, previous_annual_value, new_annual_value, created_by_name, applied_at, kind'

export function useCustomerRecord(customerId: string | undefined) {
  const [data, setData] = useState<CustomerRecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string): Promise<CustomerRecordData> => {
    // 1. Kundraden för :id
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    if (custError || !customer) {
      throw new Error(custError?.message || 'Kunden hittades inte')
    }
    const viewed = customer as RecordCustomer

    // 2. Familjekontext: förälder (om enhet) + alla enheter under org-raden
    let root: RecordCustomer = viewed
    if (viewed.parent_customer_id) {
      const { data: parent, error: parentError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', viewed.parent_customer_id)
        .single()
      if (parentError || !parent) {
        throw new Error(parentError?.message || 'Kunde inte hämta huvudkontoret')
      }
      root = parent as RecordCustomer
    }

    const { data: unitRows, error: unitsError } = await supabase
      .from('customers')
      .select('*')
      .eq('parent_customer_id', root.id)
      .order('site_name', { ascending: true })
    if (unitsError) throw new Error(unitsError.message)
    const units = (unitRows ?? []) as RecordCustomer[]

    const familyIds = [root.id, ...units.map((u) => u.id)]

    // 3-8. Avtal, fakturarader, tillägg, premietrappa, omfattning och ärendeantal parallellt.
    // Premie/omfattning filtreras på avtalets ägare via inner join mot contracts.
    const [contractsRes, billingRes, additionsRes, premiumRes, sitesRes, casesRes] = await Promise.all([
      supabase
        .from('contracts')
        .select('*')
        .in('customer_id', familyIds)
        .in('status', ['signed', 'active', 'trashed'])
        .order('created_at', { ascending: true }),
      supabase
        .from('contract_billing_items')
        .select(BILLING_ITEM_COLUMNS)
        .in('customer_id', familyIds)
        .order('billing_period_start', { ascending: false }),
      supabase
        .from('contract_additions')
        .select(ADDITION_COLUMNS)
        .in('customer_id', familyIds)
        .order('applied_at', { ascending: true }),
      supabase
        .from('contract_premium_events')
        .select('id, contract_id, effective_from, annual_value, event_type, note, contract:contracts!inner(customer_id)')
        .in('contract.customer_id', familyIds)
        .order('effective_from', { ascending: true }),
      supabase
        .from('contract_sites')
        .select('id, contract_id, customer_id, active_from, active_to, note, contract:contracts!inner(customer_id)')
        .in('contract.customer_id', familyIds)
        .order('active_from', { ascending: true }),
      supabase
        .from('cases')
        .select('id, status, customer_id')
        .in('customer_id', familyIds),
    ])

    if (contractsRes.error) throw new Error(`Kunde inte hämta avtal: ${contractsRes.error.message}`)
    if (billingRes.error) throw new Error(`Kunde inte hämta fakturarader: ${billingRes.error.message}`)
    // contract_additions/premie/omfattning/cases är sekundärdata — får inte fälla sidan
    const additions = (additionsRes.error ? [] : (additionsRes.data ?? [])) as RecordAddition[]
    const premiumEvents = (premiumRes.error ? [] : (premiumRes.data ?? [])) as unknown as RecordPremiumEvent[]
    const contractSites = (sitesRes.error ? [] : (sitesRes.data ?? [])) as unknown as RecordContractSite[]

    // Trashed-rader är bara relevanta för importmönstret (template_id='imported'
    // eller oneflow_contract_id 'imported-…') — övriga trashed filtreras bort.
    const contracts = ((contractsRes.data ?? []) as RecordContract[]).filter(
      (c) => c.status !== 'trashed' || isImportedContract(c)
    )

    const caseCounts: Record<string, number> = {}
    for (const row of (casesRes.error ? [] : (casesRes.data ?? [])) as { customer_id: string | null }[]) {
      if (!row.customer_id) continue
      caseCounts[row.customer_id] = (caseCounts[row.customer_id] ?? 0) + 1
    }

    return {
      customer: viewed,
      root,
      units,
      contracts,
      billingItems: (billingRes.data ?? []) as unknown as RecordBillingItem[],
      additions,
      premiumEvents,
      contractSites,
      caseCounts,
    }
  }, [])

  useEffect(() => {
    if (!customerId) {
      setError('Kund-id saknas')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    load(customerId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(err instanceof Error ? err.message : 'Kunde inte hämta kunden')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId, load])

  return { data, loading, error }
}

// ---------------------------------------------------------------------------
// Delade hjälpare för record-vyn
// ---------------------------------------------------------------------------

export function isImportedContract(c: RecordContract): boolean {
  return c.template_id === 'imported' || (c.oneflow_contract_id ?? '').startsWith('imported-')
}

/** Avtalsnamn: label (backfylld) → contract_type → 'Avtal #<oneflow-id>' */
export function contractDisplayName(c: RecordContract): string {
  if (c.label) return c.label
  if (c.contract_type) return c.contract_type
  if (isImportedContract(c)) return 'Importerat avtal'
  return `Avtal #${c.oneflow_contract_id}`
}

/** Avtalet har passerat sitt slut (effective_end_date/contract_end_date) eller status 'ended' */
export function isEndedContract(c: RecordContract, today = new Date()): boolean {
  if ((c.status as string) === 'ended') return true
  const end = c.effective_end_date ?? c.contract_end_date
  if (!end) return false
  return new Date(end).getTime() < today.getTime()
}

/** Uppsagt men löper fortfarande till slutdatum */
export function isTerminatedButRunning(c: RecordContract, today = new Date()): boolean {
  return !!c.terminated_at && !isEndedContract(c, today)
}

/** annual_value är redan normaliserat årsvärde oavsett billing_frequency */
export function contractAnnualValue(c: RecordContract): number {
  return Number(c.annual_value ?? 0)
}

// ---------------------------------------------------------------------------
// Premietrappa (etapp 4)
// ---------------------------------------------------------------------------

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Aktuellt trappsteg: senaste eventet med effective_from <= idag */
export function currentPremiumEvent(events: RecordPremiumEvent[]): RecordPremiumEvent | null {
  const key = todayKey()
  const past = events
    .filter((e) => e.effective_from <= key)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  return past[past.length - 1] ?? null
}

/** Nästa framtida trappsteg (step_up/indexation/…) */
export function nextPremiumEvent(events: RecordPremiumEvent[]): RecordPremiumEvent | null {
  const key = todayKey()
  const future = events
    .filter((e) => e.effective_from > key)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  return future[0] ?? null
}

/** Avtalets AKTUELLA årsvärde: premietrappan om den finns, annars annual_value */
export function contractEffectiveAnnualValue(c: RecordContract, events: RecordPremiumEvent[]): number {
  const current = currentPremiumEvent(events)
  if (current) return Number(current.annual_value ?? 0)
  return contractAnnualValue(c)
}

export const PREMIUM_EVENT_LABEL: Record<PremiumEventType, string> = {
  start: 'Start',
  step_up: 'Upptrappning',
  indexation: 'Indexering',
  addition: 'Avtalstillägg',
  adjustment: 'Justering',
  termination: 'Avslut',
}

export function formatKr(n: number): string {
  return `${Math.round(n).toLocaleString('sv-SE')} kr`
}

export function formatDateSv(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatMonthSv(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
}

/** Sista uppsägningsdag: contract_end_date − notice_period_months */
export function lastNoticeDate(c: RecordContract): Date | null {
  if (!c.contract_end_date || !c.notice_period_months) return null
  const d = new Date(c.contract_end_date)
  d.setMonth(d.getMonth() - c.notice_period_months)
  return d
}

export const BILLING_FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'månadsvis',
  quarterly: 'kvartalsvis',
  semi_annual: 'halvårsvis',
  annual: 'årsvis',
  on_demand: 'vid avrop',
}

/** Visningsnamn för en kundrad i familjen */
export function customerRowName(c: RecordCustomer): string {
  return c.site_name || c.company_name
}
