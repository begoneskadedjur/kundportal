// src/hooks/useCustomerRecord.ts
// Datahämtning för den kanoniska kundsidan (/admin/befintliga-kunder/:id).
// :id kan vara org-raden ELLER en enhetsrad (customers.parent_customer_id satt) —
// hooken laddar alltid HELA familjen (org + alla enheter) så sidan kan visa
// avtal, fakturering och tidslinje samlat oavsett vilken rad man landar på.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { VISIBLE_CONTRACT_STATUSES } from '../utils/contractLifecycle'
import type { Contract, Customer } from '../types/database'

// customers har kolumner som ännu inte finns i database.ts-typen
// (fortnox_verified_at är ny, notice_period_months finns i DB men saknas i typen)
export type RecordCustomer = Customer & {
  fortnox_verified_at?: string | null
  notice_period_months?: number | null
}

// contracts.label är ny, backfylld kolumn — används som avtalsnamn.
// price_list_id finns i DB men saknas i database.ts-typen (avtalets prislista).
export type RecordContract = Contract & {
  label?: string | null
  fromCustomerRow?: boolean
  price_list_id?: string | null
  /** True = avtalet omfattar alla enheter under HK, även framtida (annars styr contract_sites) */
  covers_all_sites?: boolean | null
  /** Besöksfrekvens enligt avtalet (samma värden som recurring_schedules.frequency) */
  visit_frequency?: string | null
  /** Antal ingående besök per år enligt avtalet */
  visits_per_year?: number | null
  /** Datum då kunden faktiskt signerade (ej samma som created_at) */
  signed_at?: string | null
}

/** Besöksfrekvenser — samma värden som recurring_schedules använder */
export const VISIT_FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'Månadsvis',
  quarterly: 'Kvartalsvis',
  semi_annual: 'Halvårsvis',
  annual: 'Årsvis',
  custom: 'Anpassad',
}

/** Standardantal besök per år för en frekvens (custom har inget) */
export const VISITS_PER_YEAR_BY_FREQUENCY: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
}

export interface RecordBillingItem {
  id: string
  customer_id: string
  /** Etapp 5: koppling till avtalet (null för äldre/ej entydiga rader) */
  contract_id: string | null
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

// Avtalskartan: avtalshändelser utan egen tabell (prislistbyten, omfattningsläge)
export interface RecordContractEvent {
  id: string
  contract_id: string
  event_type: string
  title: string
  detail: string | null
  occurred_at: string
  created_by_name: string | null
}

// Avtalskartan: kontrollbesök (station_inspection_sessions) för § 3 Uppföljning
export interface RecordInspectionSession {
  id: string
  customer_id: string
  contract_id: string | null
  scheduled_at: string | null
  completed_at: string | null
  status: string | null
  total_outdoor_stations: number | null
  total_indoor_stations: number | null
  inspected_outdoor_stations: number | null
  inspected_indoor_stations: number | null
  technician_name: string | null
}

// Avtalskartan: ärenden för familjen (uppföljning + historikmodal)
export interface RecordCase {
  id: string
  customer_id: string | null
  contract_id: string | null
  title: string
  status: string
  case_type: string | null
  scheduled_date: string | null
  completed_date: string | null
  created_at: string
  price: number | null
  assigned_technician_name: string | null
}

// Etapp 6: Åtkomst & konton — portalanvändare, multisite-roller och inbjudningar.
export interface RecordAccessProfile {
  user_id: string
  customer_id: string | null
  display_name: string | null
  email: string | null
  last_login: string | null
  last_sign_in_at?: string | null
  has_ever_signed_in?: boolean | null
}

export interface RecordAccessInvitation {
  id: string
  email: string
  customer_id: string
  accepted_at: string | null
  expires_at: string | null
  created_at: string | null
}

export interface RecordMultisiteUser {
  id: string
  user_id: string
  role_type: string
  site_ids: string[] | null
  display_name: string | null
  email: string | null
  last_login: string | null
  last_sign_in_at?: string | null
  has_ever_signed_in?: boolean | null
}

export interface RecordAccessData {
  /** Kundportal-konton (profiles med role='customer') för familjen */
  profiles: RecordAccessProfile[]
  /** Inbjudningar (user_invitations) för familjen */
  invitations: RecordAccessInvitation[]
  /** Multisite-roller (verksamhetschef/regionchef/platsansvarig) för organisationen */
  multisiteUsers: RecordMultisiteUser[]
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
  /** Familjens ärenden (avtalskartan: uppföljning + historik) */
  cases: RecordCase[]
  /** Avtalshändelser utan egen tabell (prislistbyten m.m.) */
  contractEvents: RecordContractEvent[]
  /** Kontrollbesök för familjen (§ 3 Uppföljning) */
  inspections: RecordInspectionSession[]
  /** Åtkomst & konton (etapp 6) — sekundärdata, tomma listor vid fel */
  access: RecordAccessData
}

const BILLING_ITEM_COLUMNS =
  'id, customer_id, contract_id, billing_period_start, billing_period_end, article_name, total_price, status, invoice_number, invoiced_at, paid_at, due_date, sent_at, fortnox_document_number, notes'

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
    // business_cases kopplas till kunden via org.nr (ingen customer_id finns)
    const orgNumbers = Array.from(
      new Set([root, ...units].map((c) => c.organization_number).filter((n): n is string => !!n))
    )

    // 3-8. Avtal, fakturarader, tillägg, premietrappa, omfattning, ärendeantal
    // samt åtkomstdata (etapp 6) parallellt.
    // Premie/omfattning filtreras på avtalets ägare via inner join mot contracts.
    const [
      contractsRes,
      billingRes,
      additionsRes,
      premiumRes,
      sitesRes,
      casesRes,
      profilesRes,
      invitationsRes,
      contractEventsRes,
      inspectionsRes,
      businessCasesRes,
    ] = await Promise.all([
      supabase
        .from('contracts')
        .select('*')
        .in('customer_id', familyIds)
        // 'ended' måste med: uppsagda avtal ska ligga kvar i vyn för
        // spårbarhet (renderas som arkiverade papper), inte försvinna.
        .in('status', VISIBLE_CONTRACT_STATUSES as unknown as string[])
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
        .select('id, customer_id, contract_id, title, status, case_type, scheduled_date, completed_date, created_at, price, assigned_technician_name')
        .in('customer_id', familyIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('user_id, customer_id, display_name, email, last_login, last_sign_in_at, has_ever_signed_in')
        .in('customer_id', familyIds)
        .eq('role', 'customer'),
      supabase
        .from('user_invitations')
        .select('id, email, customer_id, accepted_at, expires_at, created_at')
        .in('customer_id', familyIds),
      // Avtalshändelser (prislistbyten m.m.) för familjens avtal
      supabase
        .from('contract_events')
        .select('id, contract_id, event_type, title, detail, occurred_at, created_by_name, contract:contracts!inner(customer_id)')
        .in('contract.customer_id', familyIds)
        .order('occurred_at', { ascending: true }),
      // Kontrollbesök (§ 3 Uppföljning). OBS: contract_id är null på alla
      // sessioner i dag — matchning sker på customer_id i konsumenten.
      supabase
        .from('station_inspection_sessions')
        .select('id, customer_id, contract_id, scheduled_at, completed_at, status, total_outdoor_stations, total_indoor_stations, inspected_outdoor_stations, inspected_indoor_stations, technician:technicians(name)')
        .in('customer_id', familyIds)
        .order('scheduled_at', { ascending: false }),
      // Företagsärenden. business_cases saknar customer_id — kopplingen till
      // kunden går via org.nr. Utan detta ser avtalskunder ut att sakna
      // ärenden trots utförda besök (135 ärenden matchar kunder i dag).
      orgNumbers.length > 0
        ? supabase
            .from('business_cases')
            .select('id, title, status, org_nr, start_date, completed_date, created_at, pris, primary_assignee_name, skadedjur')
            .in('org_nr', orgNumbers)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ])

    // Multisite-roller kräver organisationens id — hämtas bara när root är multisite.
    // Sekundärdata: fel får inte fälla sidan.
    let multisiteUsers: RecordMultisiteUser[] = []
    if (root.organization_id) {
      const { data: roleRows } = await supabase
        .from('multisite_user_roles')
        .select('id, user_id, role_type, site_ids')
        .eq('organization_id', root.organization_id)
        .eq('is_active', true)
      const userIds = (roleRows ?? []).map((r) => r.user_id)
      if (userIds.length > 0) {
        const { data: roleProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, last_login, last_sign_in_at, has_ever_signed_in')
          .in('user_id', userIds)
        const profileByUserId = new Map((roleProfiles ?? []).map((p) => [p.user_id, p]))
        multisiteUsers = (roleRows ?? []).map((r) => {
          const p = profileByUserId.get(r.user_id)
          return {
            id: r.id,
            user_id: r.user_id,
            role_type: r.role_type,
            site_ids: r.site_ids ?? null,
            display_name: p?.display_name ?? null,
            email: p?.email ?? null,
            last_login: p?.last_login ?? null,
            last_sign_in_at: p?.last_sign_in_at ?? null,
            has_ever_signed_in: p?.has_ever_signed_in ?? null,
          }
        })
      }
    }

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

    // Fallback: många importerade kunder (bl.a. juli-batchen 2026) har avtalsdata
    // på KUNDRADEN men ingen contracts-rad alls. Syntetisera ett kundrads-avtal
    // för varje familjerad med premie/avtalsdatum som saknar riktigt avtal, så
    // sidan visar enheter, avtal och årspremier tills riktiga rader backfyllts.
    const familyRows = [root, ...units]
    const coveredCustomerIds = new Set(contracts.map((c) => c.customer_id))
    for (const row of familyRows) {
      if (coveredCustomerIds.has(row.id)) continue
      const annual = Number(row.annual_value ?? 0)
      if (!(annual > 0) && !row.contract_start_date) continue
      // HK i multisite utan egen premie bär inget eget avtal (premierna bor på enheterna)
      if (row.site_type === 'huvudkontor' && units.length > 0 && !(annual > 0)) continue
      contracts.push({
        id: `kundrad-${row.id}`,
        customer_id: row.id,
        label: row.contract_type || 'Avtal',
        fromCustomerRow: true,
        contract_type: row.contract_type ?? null,
        status: row.terminated_at ? 'terminated' : 'signed',
        type: 'contract',
        oneflow_contract_id: null,
        template_id: null,
        annual_value: annual > 0 ? annual : null,
        total_value: annual > 0 ? annual : null,
        total_contract_value: annual > 0 ? annual : null,
        billing_frequency: row.billing_frequency ?? null,
        contract_start_date: row.contract_start_date ?? null,
        contract_end_date: row.contract_end_date ?? null,
        start_date: row.contract_start_date ?? null,
        contract_length: row.contract_length ?? null,
        notice_period_months: row.notice_period_months ?? null,
        terminated_at: row.terminated_at ?? null,
        agreement_text: row.agreement_text ?? null,
        selected_products: null,
        address_label: row.site_name ?? null,
        contact_address: row.contact_address ?? null,
        created_at: row.created_at,
      } as unknown as RecordContract)
    }

    const legacyCases = (casesRes.error ? [] : (casesRes.data ?? [])) as unknown as RecordCase[]

    // Företagsärenden mappas till samma form. De hör till org-raden eftersom
    // business_cases bara känner org.nr, inte vilken enhet det gäller.
    type BusinessCaseRow = {
      id: string
      title: string | null
      status: string | null
      org_nr: string | null
      start_date: string | null
      completed_date: string | null
      created_at: string
      pris: number | null
      primary_assignee_name: string | null
      skadedjur: string | null
    }
    const orgToCustomerId = new Map(
      [root, ...units]
        .filter((c) => c.organization_number)
        .map((c) => [c.organization_number as string, c.id])
    )
    const businessCases: RecordCase[] = (
      (businessCasesRes.error ? [] : (businessCasesRes.data ?? [])) as unknown as BusinessCaseRow[]
    ).map((b) => ({
      id: b.id,
      customer_id: orgToCustomerId.get(b.org_nr ?? '') ?? root.id,
      contract_id: null,
      title: b.title ?? 'Företagsärende',
      status: b.status ?? '',
      case_type: b.skadedjur ?? null,
      scheduled_date: b.start_date,
      completed_date: b.completed_date,
      created_at: b.created_at,
      price: b.pris != null ? Number(b.pris) : null,
      assigned_technician_name: b.primary_assignee_name,
    }))

    const familyCases = [...legacyCases, ...businessCases]

    // Sekundärdata: nya tabeller får aldrig fälla sidan om de saknas/blockeras
    const contractEvents = (
      contractEventsRes.error ? [] : (contractEventsRes.data ?? [])
    ) as unknown as RecordContractEvent[]

    type InspectionRow = Omit<RecordInspectionSession, 'technician_name'> & {
      technician?: { name?: string | null } | { name?: string | null }[] | null
    }
    const inspections = ((inspectionsRes.error ? [] : (inspectionsRes.data ?? [])) as unknown as InspectionRow[]).map(
      ({ technician, ...row }) => ({
        ...row,
        technician_name: Array.isArray(technician) ? (technician[0]?.name ?? null) : (technician?.name ?? null),
      })
    ) as RecordInspectionSession[]
    const caseCounts: Record<string, number> = {}
    for (const row of familyCases) {
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
      cases: familyCases,
      contractEvents,
      inspections,
      access: {
        profiles: (profilesRes.error ? [] : (profilesRes.data ?? [])) as RecordAccessProfile[],
        invitations: (invitationsRes.error ? [] : (invitationsRes.data ?? [])) as RecordAccessInvitation[],
        multisiteUsers,
      },
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

  /** Tyst omhämtning efter mutation (avtalskartan) — togglar inte loading */
  const refetch = useCallback(async () => {
    if (!customerId) return
    try {
      const result = await load(customerId)
      setData(result)
    } catch {
      // Behåll gammal data vid refetch-fel — mutationens toast har redan visat resultatet
    }
  }, [customerId, load])

  return { data, loading, error, refetch }
}

// ---------------------------------------------------------------------------
// Delade hjälpare för record-vyn
// ---------------------------------------------------------------------------

export function isImportedContract(c: RecordContract): boolean {
  return c.template_id === 'imported' || (c.oneflow_contract_id ?? '').startsWith('imported-')
}

/** Avtalet är skapat i portalen, inte i Oneflow. */
export function isLocalContract(c: RecordContract): boolean {
  return c.template_id === 'local' || (c.oneflow_contract_id ?? '').startsWith('local-')
}

/**
 * Länk till avtalet i Oneflow, eller null när det inte finns något dokument
 * att länka till.
 *
 * oneflow_contract_id är NOT NULL och alltid ifylld — även för portalskapade
 * avtal, där den bär ett syntetiskt 'local-<uuid>'. Att bygga URL:en rakt av
 * gav därför länkar till app.oneflow.com/contracts/local-83a06968… som alltid
 * är trasiga. Riktiga Oneflow-id:n är numeriska, så det är det vi kräver.
 */
export function oneflowContractUrl(c: RecordContract): string | null {
  const id = c.oneflow_contract_id ?? ''
  if (!/^\d+$/.test(id)) return null
  return `https://app.oneflow.com/contracts/${id}`
}

/** Avtalsnamn: label (backfylld) → contract_type → 'Avtal #<oneflow-id>' */
export function contractDisplayName(c: RecordContract): string {
  if (c.label) return c.label
  if (c.contract_type) return c.contract_type
  if (isImportedContract(c)) return 'Importerat avtal'
  return `Avtal #${c.oneflow_contract_id}`
}

/**
 * Livscykeln bor i src/utils/contractLifecycle.ts — samma definition används av
 * resolvern, prislistorna, faktureringen och cron-jobben. Återexporteras här
 * så befintliga importer från hooken fortsätter fungera.
 *
 * OBS: jämförelsen sker på datumsträng, inte Date. Tidigare jämfördes mot
 * new Date() med klockslag, vilket gjorde att ett avtal räknades som avslutat
 * redan 00:01 på sin sista giltiga dag — en dag före cron-jobbet.
 */
export { isEndedContract, isTerminatedButRunning, contractState } from '../utils/contractLifecycle'
export type { ContractState } from '../utils/contractLifecycle'

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
