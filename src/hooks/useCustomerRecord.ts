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
  /** Kundansvarig för avtalet — speglas till kundraderna avtalet omfattar */
  account_manager_name?: string | null
  account_manager_email?: string | null
  /** Er referens på avtalets fakturor (årspremie). Enhetens kod bor på kundraden. */
  invoice_reference?: string | null
  /** Diarie-/upphandlingsnummer, t.ex. GNU 2026/60 */
  diary_number?: string | null
  /** Ankarmånad (1–12) för fakturaperioderna */
  billing_anchor_month?: number | null
  /** § 9: rolling (löper vidare), fixed (fast slut), option (fast period med option). Styr bara bevakningen. */
  renewal_mode?: 'rolling' | 'fixed' | 'option' | null
  option_until?: string | null
  option_decision_deadline?: string | null
  renewal_reminder_days?: number | null
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
  /** § 3 per enhet: 'inspection' (schema förväntas) eller 'on_demand' (avrop) */
  service_mode?: 'inspection' | 'on_demand' | null
  /** Frekvens per enhet; saknas den gäller avtalets */
  visit_frequency?: string | null
  visits_per_year?: number | null
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
/**
 * Faktura — det kanoniska intäktsspåret.
 *
 * `invoice_type` skiljer årspremie från arbete utanför avtalet:
 *   'contract' = avtalsintäkt (premien)
 *   'adhoc' / 'case' / 'private' = merförsäljning
 *
 * `is_historical` skiljer Fortnox-importerad historik (ej klickbar) från
 * fakturor skapade i portalen. Fältet är ifyllt på alla rader.
 *
 * Belopp visas ex moms (`subtotal`) enligt beslut — `total_amount` finns kvar
 * för de fall inkl moms behövs.
 */
export interface RecordInvoice {
  id: string
  customer_id: string
  contract_id: string | null
  case_id: string | null
  invoice_type: string | null
  invoice_number: string | null
  status: string | null
  subtotal: number | null
  total_amount: number | null
  billing_period_start: string | null
  billing_period_end: string | null
  is_historical: boolean | null
  due_date: string | null
  created_at: string
}

/**
 * En rad i arbetsflödet: antingen TJÄNSTEN kunden får eller en ARTIKEL vi
 * använt för att leverera den.
 *
 * item_type='service' → intäkt (vad kunden betalar)
 * item_type='article' → intern kostnad, kopplad till sin tjänst via
 *                       mapped_service_id (pekar på tjänsteradens id)
 *
 * Skillnaden mellan dem är marginalen. Detta är arbetsflödet som genererar
 * fakturor — manuellt upplagda och importerade avtal saknar oftast raderna
 * och har bara en årspremie.
 */
export interface RecordWorkItem {
  id: string
  customer_id: string
  case_id: string
  case_type: string | null
  item_type: 'service' | 'article' | string
  service_id: string | null
  service_name: string | null
  article_id: string | null
  article_name: string | null
  /** På artikelrader: id på TJÄNSTERADEN den hör till (ej services.id) */
  mapped_service_id: string | null
  quantity: number | null
  unit_price: number | null
  total_price: number | null
  status: string | null
  discount_percent: number | null
  created_at: string
  /**
   * Vem intäkten tillhör.
   *
   * ÄRENDEN → teknikern som utfört jobbet (via ärendet, 96 % täckning).
   * AVTALSPREMIE → SÄLJAREN som tecknat avtalet. En premie är inget ärende;
   * den tillhör den som sålt avtalet, tillsammans med sina kostnader och sin
   * marginal.
   */
  technician_name?: string | null
  /** 'contract' = avtalspremie (säljarens), annars utfört arbete (teknikerns) */
  attribution?: 'sales' | 'technician'
  /** Ärendets nummer, för gruppering per ärende */
  case_number?: string | null
  /** Rumsnummer från ärendet ("105, 107") — kunder med Rum nr aktiverat */
  case_room?: string | null
  case_title?: string | null
}

/** Löpande schema — bär besöksfrekvensen för leveransmätningen. */
export interface RecordSchedule {
  id: string
  customer_id: string
  contract_id: string | null
  frequency: string | null
  status: string | null
  schedule_start_date: string | null
  generated_until: string | null
}

export interface RecordInspectionSession {
  id: string
  customer_id: string
  contract_id: string | null
  /** Kontrollärendet sessionen hör till — kopplingen är 1:1 */
  case_id: string | null
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
  case_number: string | null
  title: string
  status: string
  /**
   * Styr ärendekategorin. 'inspection' | 'rondering_trafikkontoret' |
   * 'egenkontroll_trafikkontoret' = återkommande kontroll, 'establishment' =
   * avtalets etablering, allt annat = extraärende. Se utils/caseCategory.ts.
   * Null för företagsärenden, som alltid är engångsjobb.
   */
  service_type: string | null
  pest_type: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  completed_date: string | null
  created_at: string
  price: number | null
  primary_technician_name: string | null
  /** Ärendemärkning: rumsnummer som kommaseparerad sträng ("105, 107") — null för business_cases */
  room_number?: string | null
  /** Teknikerns trafikljus (0=ej ifyllt/okänt, 1=OK, 2=varning, 3=kritisk) — null för business_cases */
  pest_level?: number | null
  /** Tjänsten på ärendet — används för att förifylla grundorsaksbokningen */
  service_id?: string | null
  /** Vilken tabell raden kom från — business_cases saknar service_type */
  origin: 'case' | 'business'
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

/** En månad med minst en inloggning — bygger livstidsbandet i personlistan */
export interface RecordLoginMonth {
  month: string
  count: number
}

/** Inloggningsstatistik ur auth.audit_log_entries via get_customer_login_stats */
export interface RecordLoginStats {
  user_id: string
  login_count: number
  first_login: string | null
  last_login: string | null
  active_months: number
  monthly: RecordLoginMonth[]
}

/** Rad ur customer_account_events — vad som skickats till en person och när */
export interface RecordAccountEvent {
  id: string
  user_id: string
  event_type:
    | 'invited'
    | 'password_sent'
    | 'email_changed'
    | 'role_changed'
    | 'deactivated'
    | 'reactivated'
  target_email: string | null
  target_name: string | null
  actor_id: string | null
  actor_email: string | null
  note: string | null
  created_at: string
}

export interface RecordAccessData {
  /** Kundportal-konton (profiles med role='customer') för familjen */
  profiles: RecordAccessProfile[]
  /** Inbjudningar (user_invitations) för familjen */
  invitations: RecordAccessInvitation[]
  /** Multisite-roller (verksamhetschef/regionchef/platsansvarig) för organisationen */
  multisiteUsers: RecordMultisiteUser[]
  /** Inloggningsstatistik per user_id. Tom map om RPC:n inte gick igenom. */
  loginStats: Map<string, RecordLoginStats>
  /** Kontohändelser för familjens användare, nyast först */
  accountEvents: RecordAccountEvent[]
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
  schedules: RecordSchedule[]
  invoices: RecordInvoice[]
  /** Arbetsflödet: tjänster kunden fått + artiklar vi använt, med marginal */
  workItems: RecordWorkItem[]
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
      schedulesRes,
      invoicesRes,
      workItemsRes,
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
        .select('id, contract_id, customer_id, active_from, active_to, note, service_mode, visit_frequency, visits_per_year, contract:contracts!inner(customer_id)')
        .in('contract.customer_id', familyIds)
        .order('active_from', { ascending: true }),
      supabase
        .from('cases')
        // VARNING: kolumnnamnen måste stämma exakt. Frågan hade tidigare
        // case_type, scheduled_date och assigned_technician_name — inget av
        // dem finns i cases. PostgREST felade då på HELA frågan, och felet
        // sväljs nedan (casesRes.error ? [] : …), så listan var tyst tom.
        .select(
          'id, customer_id, contract_id, case_number, title, status, service_type, ' +
            'pest_type, scheduled_start, scheduled_end, completed_date, created_at, ' +
            'price, primary_technician_name, room_number, pest_level, service_id'
        )
        .in('customer_id', familyIds)
        // Borttagna ärenden ska inte synas — 9 rader i produktion har status
        // 'Borttaget' utan att deleted_at är satt, och räknades därför som
        // aktiva ärenden i vyerna.
        .neq('status', 'Borttaget')
        .is('deleted_at', null)
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
        .select('id, customer_id, contract_id, case_id, scheduled_at, completed_at, status, total_outdoor_stations, total_indoor_stations, inspected_outdoor_stations, inspected_indoor_stations, technician:technicians(name)')
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
      // Löpande scheman — bär besöksfrekvensen. contracts.visit_frequency är
      // satt på bara 2 avtal av 524, så schemats frekvens är den praktiska
      // källan för "hur ofta ska vi vara här".
      supabase
        .from('recurring_schedules')
        .select('id, customer_id, contract_id, frequency, status, schedule_start_date, generated_until')
        .in('customer_id', familyIds),
      // FAKTUROR — sista steget i kedjan.
      //
      // Arbetsflödet är: case_billing_items (tjänst kunden får + artiklar vi
      // använt, med marginal) → contract_billing_items (faktureringsunderlag)
      // → invoices (färdig faktura). Alla tre behövs: manuellt upplagda och
      // importerade avtal har oftast bara en årspremie utan artikeldetaljer.
      supabase
        .from('invoices')
        .select(
          'id, customer_id, contract_id, case_id, invoice_type, invoice_number, status, ' +
            'subtotal, total_amount, billing_period_start, billing_period_end, ' +
            'is_historical, due_date, created_at'
        )
        .in('customer_id', familyIds)
        .order('billing_period_start', { ascending: false }),
      // ARBETSFLÖDET: tjänsten kunden fått (item_type='service') och artiklarna
      // vi använt (item_type='article', kopplade via mapped_service_id).
      // Här bor interna kostnader och marginalen. Hämtas för familjens ärenden
      // OCH avtal — avtalsinnehåll använder samma tabell med case_type='contract'.
      supabase
        .from('case_billing_items')
        .select(
          'id, customer_id, case_id, case_type, item_type, service_id, service_name, ' +
            'article_id, article_name, mapped_service_id, quantity, unit_price, ' +
            'total_price, status, discount_percent, created_at'
        )
        .in('customer_id', familyIds)
        .order('created_at', { ascending: false }),
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

    // Inloggningsstatistik och kontohändelser. Kräver samtliga user_id:n i
    // familjen, därför efter multisite-blocket. Båda är sekundärdata: fel får
    // inte fälla sidan, listan visas då utan rytm och historik.
    const accessUserIds = Array.from(
      new Set([
        ...(profilesRes.error ? [] : (profilesRes.data ?? [])).map((p) => p.user_id),
        ...multisiteUsers.map((u) => u.user_id),
      ])
    ).filter(Boolean)

    let loginStats = new Map<string, RecordLoginStats>()
    let accountEvents: RecordAccountEvent[] = []

    if (accessUserIds.length > 0) {
      const [statsRes, eventsRes] = await Promise.all([
        supabase.rpc('get_customer_login_stats', { p_user_ids: accessUserIds }),
        supabase
          .from('customer_account_events')
          .select(
            'id, user_id, event_type, target_email, target_name, actor_id, actor_email, note, created_at'
          )
          .in('user_id', accessUserIds)
          .order('created_at', { ascending: false }),
      ])

      if (!statsRes.error && statsRes.data) {
        loginStats = new Map(
          (statsRes.data as RecordLoginStats[]).map((s) => [
            s.user_id,
            { ...s, monthly: Array.isArray(s.monthly) ? s.monthly : [] },
          ])
        )
      }
      if (!eventsRes.error) {
        accountEvents = (eventsRes.data ?? []) as RecordAccountEvent[]
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

    // Felet loggas nu i stället för att sväljas tyst — en trasig fråga gjorde
    // tidigare listan tom utan att någonstans säga varför.
    if (casesRes.error) {
      console.error('Kunde inte hämta ärenden:', casesRes.error.message)
    }
    const legacyCases = ((casesRes.error ? [] : (casesRes.data ?? [])) as unknown as Omit<
      RecordCase,
      'origin'
    >[]).map((c) => ({ ...c, origin: 'case' as const }))

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
      case_number: null,
      title: b.title ?? 'Företagsärende',
      status: b.status ?? '',
      // business_cases har ingen service_type — de är per definition
      // engångsjobb och hamnar därför alltid bland extraärendena.
      service_type: null,
      pest_type: b.skadedjur ?? null,
      scheduled_start: b.start_date,
      scheduled_end: null,
      completed_date: b.completed_date,
      created_at: b.created_at,
      price: b.pris != null ? Number(b.pris) : null,
      primary_technician_name: b.primary_assignee_name,
      origin: 'business' as const,
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
    const schedules = (schedulesRes.error ? [] : (schedulesRes.data ?? [])) as unknown as RecordSchedule[]
    const invoices = (invoicesRes.error ? [] : (invoicesRes.data ?? [])) as unknown as RecordInvoice[]
    // Arbetsraderna bär inget teknikerfält — det sitter på ärendet. Ärendena
    // ligger i tre tabeller med olika kolumnnamn: cases.primary_technician_name,
    // business_cases/private_cases.primary_assignee_name. Berikningen ger 96 %
    // täckning på rader som hör till ett verkligt ärende.
    const rawWorkItems = (workItemsRes.error ? [] : (workItemsRes.data ?? [])) as unknown as RecordWorkItem[]
    // ALLA case_id slås upp, även de med case_type='contract'. Anledningen:
    // case_type kan bara vara 'private' | 'business' | 'contract' (CHECK-
    // constraint), så ärenden på AVTALSKUNDER — som ligger i tabellen `cases` —
    // saknar eget värde och märks 'contract' fast case_id pekar på ett ärende.
    // 133 rader hos 31 kunder ser ut så. Träffen nedan avgör vad raden faktiskt
    // är: hittas ett ärende är det utfört arbete (tekniker), annars ett avtal
    // (säljare).
    const workCaseIds = Array.from(new Set(rawWorkItems.map((w) => w.case_id)))
    const techByCase = new Map<string, { name: string | null; number: string | null; title: string | null; room: string | null }>()
    if (workCaseIds.length > 0) {
      const [cRes, bRes, pRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id, case_number, title, primary_technician_name, room_number')
          .in('id', workCaseIds),
        supabase
          .from('business_cases')
          .select('id, case_number, title, primary_assignee_name')
          .in('id', workCaseIds),
        supabase
          .from('private_cases')
          .select('id, case_number, title, primary_assignee_name')
          .in('id', workCaseIds),
      ])
      for (const r of (cRes.data ?? []) as { id: string; case_number: string | null; title: string | null; primary_technician_name: string | null; room_number: string | null }[]) {
        techByCase.set(r.id, { name: r.primary_technician_name, number: r.case_number, title: r.title, room: r.room_number })
      }
      for (const r of [...((bRes.data ?? []) as never[]), ...((pRes.data ?? []) as never[])] as {
        id: string
        case_number: string | null
        title: string | null
        primary_assignee_name: string | null
      }[]) {
        if (!techByCase.has(r.id)) {
          techByCase.set(r.id, { name: r.primary_assignee_name, number: r.case_number, title: r.title, room: null })
        }
      }
    }
    // Avtalsinnehåll (case_type='contract') har case_id = AVTALETS id, inte ett
    // ärende. Premien tillhör SÄLJAREN som tecknat avtalet — inte någon
    // tekniker, eftersom en premie inte är utfört arbete.
    const contractSeller = new Map<string, { name: string | null; label: string | null }>()
    for (const c of contracts) {
      contractSeller.set(c.id, {
        name: c.begone_employee_name ?? root.sales_person ?? null,
        label: contractDisplayName(c),
      })
    }

    // Avtalsinnehåll som ligger kvar på en ERSATT avtalsrad är samma premie en
    // gång till: när avtalet gjordes om i portalen flyttades fakturorna till
    // det nya avtalet, men innehållet lämnades kvar — så tjänsten låg på både
    // det nya och det gamla avtalet och summerades två gånger.
    //
    // Bara ersatta rader filtreras bort. Trashade IMPORTERADE avtal (som redan
    // släpps igenom medvetet ovan) bär sitt innehåll som ENDA kopia och har
    // riktiga fakturor kopplade — de ska räknas, annars försvinner intäkter
    // för ett trettiotal kunder.
    const replacedContractIds = new Set(
      contracts
        .filter((c) => c.termination_reason === 'Ersatt av nytt avtal i portalen')
        .map((c) => c.id)
    )
    const workItems: RecordWorkItem[] = rawWorkItems
      .filter((w) => w.case_type !== 'contract' || !replacedContractIds.has(w.case_id))
      .map((w) => {
      // Ärendeträffen avgör, inte case_type: finns raden i cases/business_cases/
      // private_cases är det UTFÖRT ARBETE och tillhör teknikern som gjorde det.
      // Först när inget ärende hittas är raden avtalsinnehåll, och då tillhör
      // premien SÄLJAREN — en premie är inte utfört arbete.
      const meta = techByCase.get(w.case_id)
      if (meta) {
        return {
          ...w,
          technician_name: meta.name ?? null,
          case_number: meta.number ?? null,
          case_title: meta.title ?? null,
          case_room: meta.room ?? null,
          attribution: 'technician' as const,
        }
      }
      const seller = contractSeller.get(w.case_id)
      return {
        ...w,
        technician_name: seller?.name ?? null,
        case_number: null,
        case_title: seller?.label ?? 'Årspremie',
        attribution: 'sales' as const,
      }
    })
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
      schedules,
      invoices,
      workItems,
      access: {
        profiles: (profilesRes.error ? [] : (profilesRes.data ?? [])) as RecordAccessProfile[],
        invitations: (invitationsRes.error ? [] : (invitationsRes.data ?? [])) as RecordAccessInvitation[],
        multisiteUsers,
        loginStats,
        accountEvents,
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

/** "19 sep" — utan år, för tidslinjen där årsbandet redan bär året. */
export function formatDayMonthSv(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
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
