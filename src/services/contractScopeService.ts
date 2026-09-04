// src/services/contractScopeService.ts
// Skrivväg för avtalens omfattning (contract_sites) och avtalets prislista.
// Används av Avtalskartan på kundsidan. Historik bevaras alltid: en täckning
// avslutas genom att active_to sätts — rader raderas aldrig.

import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import { isLiveContract, isImportedContractRow, type ContractLifecycleFields } from '../utils/contractLifecycle'
import { customersCoveredByContract, resolveContractCandidates } from './contractResolver'
import { ContractInvoiceGenerator } from './contractInvoiceGenerator'

export interface ScopeRow {
  id: string
  contract_id: string
  customer_id: string
  active_from: string | null
  active_to: string | null
  note: string | null
}

/** Avtalsrad med de fält speglingen till kundraden behöver. */
type LiveContractRow = ContractLifecycleFields & {
  id: string
  annual_value: number | string | null
  billing_frequency: string | null
  billing_anchor_month: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  notice_period_months: number | null
  template_id: string | null
  oneflow_contract_id: string | null
  display_order: number | null
  price_list_id?: string | null
}

export type ContractEventType =
  | 'price_list'
  | 'scope_mode'
  | 'note'
  | 'billing'
  | 'indexation'
  | 'renewal'
  | 'other'

export interface ContractEventRow {
  id: string
  contract_id: string
  event_type: ContractEventType
  title: string
  detail: string | null
  occurred_at: string
  created_by_name: string | null
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Namnet på inloggad admin — används som signatur på loggade händelser */
async function currentUserName(): Promise<string | null> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('user_id', auth.user.id)
      .maybeSingle()
    return profile?.display_name || profile?.email || auth.user.email || null
  } catch {
    return null
  }
}

export class ContractScopeService {
  /** Aktiva/framtida täckningsrader för ett avtal (active_to saknas eller framtida) */
  static async getActiveScope(contractId: string): Promise<ScopeRow[]> {
    const { data, error } = await supabase
      .from('contract_sites')
      .select('id, contract_id, customer_id, active_from, active_to, note')
      .eq('contract_id', contractId)
      .order('active_from', { ascending: true })
    if (error) throw new Error(`Kunde inte hämta omfattning: ${error.message}`)
    const key = todayKey()
    return ((data ?? []) as ScopeRow[]).filter((r) => !r.active_to || r.active_to >= key)
  }

  /**
   * Skriv in en enhet i avtalets omfattning.
   * Skyddar mot dubbletter: finns redan en rad utan active_to (eller med
   * framtida active_to) för samma avtal+enhet görs ingenting.
   *
   * VIKTIGT: unique-constraintet contract_sites_contract_id_customer_id_key
   * har INGEN datumdimension — ett avtal+enhet kan bara ha EN rad totalt.
   * En AVSLUTAD täckning (active_to i det förflutna) blockerar därför en ny
   * insert med "duplicate key". Den raden återupplivas i stället: samma rad
   * får nytt active_from och active_to nollställs.
   */
  static async addSite(
    contractId: string,
    customerId: string,
    activeFrom: string,
    note?: string
  ): Promise<ScopeRow> {
    const { data: existing, error: readError } = await supabase
      .from('contract_sites')
      .select('id, active_to')
      .eq('contract_id', contractId)
      .eq('customer_id', customerId)
    if (readError) throw new Error(`Kunde inte kontrollera omfattningen: ${readError.message}`)
    const key = todayKey()
    const active = (existing ?? []).find((r) => !r.active_to || r.active_to >= key)
    if (active) throw new Error('Enheten står redan i avtalets omfattning')

    // Avslutad täckning finns kvar → öppna den igen i stället för att insert:a
    const closed = (existing ?? [])[0]
    if (closed) {
      const { data, error } = await supabase
        .from('contract_sites')
        .update({ active_from: activeFrom, active_to: null, note: note ?? null })
        .eq('id', closed.id)
        .select('id, contract_id, customer_id, active_from, active_to, note')
        .single()
      if (error || !data)
        throw new Error(`Kunde inte öppna täckningen igen: ${error?.message ?? 'okänt fel'}`)
      return data as ScopeRow
    }

    const { data, error } = await supabase
      .from('contract_sites')
      .insert({
        contract_id: contractId,
        customer_id: customerId,
        active_from: activeFrom,
        note: note ?? null,
      })
      .select('id, contract_id, customer_id, active_from, active_to, note')
      .single()
    if (error || !data) throw new Error(`Kunde inte skriva in enheten: ${error?.message ?? 'okänt fel'}`)
    return data as ScopeRow
  }

  /** Avsluta en täckningsrad (active_to sätts — historiken behålls) */
  static async endSite(scopeRowId: string, activeTo: string, note?: string): Promise<void> {
    const update: { active_to: string; note?: string } = { active_to: activeTo }
    if (note) update.note = note
    const { data, error } = await supabase
      .from('contract_sites')
      .update(update)
      .eq('id', scopeRowId)
      .select('id')
    if (error) throw new Error(`Kunde inte avsluta täckningen: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Täckningsraden kunde inte uppdateras (0 rader)')
  }

  /**
   * Flytta en enhet mellan två avtal: gamla raden får active_to = flyttdatumet,
   * nya avtalet får en ny rad med active_from = samma datum.
   */
  static async moveSite(
    fromScopeRowId: string,
    toContractId: string,
    customerId: string,
    effectiveDate: string
  ): Promise<void> {
    // Skriv nya raden först — misslyckas den lämnas gamla täckningen orörd
    await this.addSite(toContractId, customerId, effectiveDate, 'Flyttad från annat avtal')
    await this.endSite(fromScopeRowId, effectiveDate, 'Flyttad till annat avtal')
  }

  /**
   * "Hela verksamheten": skriv in alla angivna enheter som saknar aktiv
   * täckning i avtalet. Returnerar antal tillagda.
   */
  static async coverAll(contractId: string, customerIds: string[], activeFrom: string): Promise<number> {
    if (customerIds.length === 0) return 0
    const scope = await this.getActiveScope(contractId)
    const covered = new Set(scope.map((r) => r.customer_id))
    const missing = customerIds.filter((id) => !covered.has(id))
    if (missing.length === 0) return 0

    // Samma constraint-fälla som i addSite: enheter med en AVSLUTAD täckning
    // har redan en rad och måste uppdateras, inte insert:as.
    const { data: closedRows } = await supabase
      .from('contract_sites')
      .select('id, customer_id')
      .eq('contract_id', contractId)
      .in('customer_id', missing)
    const closedByCustomer = new Map((closedRows ?? []).map((r) => [r.customer_id as string, r.id as string]))

    const toInsert = missing.filter((id) => !closedByCustomer.has(id))
    if (toInsert.length > 0) {
      const { error } = await supabase.from('contract_sites').insert(
        toInsert.map((customerId) => ({
          contract_id: contractId,
          customer_id: customerId,
          active_from: activeFrom,
          note: 'Hela verksamheten',
        }))
      )
      if (error) throw new Error(`Kunde inte skriva in enheterna: ${error.message}`)
    }
    for (const rowId of closedByCustomer.values()) {
      const { error } = await supabase
        .from('contract_sites')
        .update({ active_from: activeFrom, active_to: null, note: 'Hela verksamheten' })
        .eq('id', rowId)
      if (error) throw new Error(`Kunde inte öppna täckningen igen: ${error.message}`)
    }
    return missing.length
  }

  /**
   * Spegla avtalsfält till kundraden avtalet bor på, så att avtalskartan och
   * kundens inställningar (t.ex. BillingSettingsModal) visar samma sak.
   * Bara levande avtal speglar — historiska avtal får inte skriva över
   * kundens inställningar. Fel sväljs: speglingen får aldrig fälla
   * avtalsändringen den hänger på.
   */
  private static async mirrorToCustomerRow(
    contract: { customer_id: string | null; status: string | null },
    patch: Record<string, string | null>
  ): Promise<void> {
    try {
      if (!contract.customer_id) return
      if (contract.status !== 'active' && contract.status !== 'signed') return
      const { error } = await supabase
        .from('customers')
        .update(patch)
        .eq('id', contract.customer_id)
      if (error) console.error('Kunde inte spegla avtalsfält till kundraden:', error.message)
    } catch (err) {
      console.error('Kunde inte spegla avtalsfält till kundraden:', err)
    }
  }

  /**
   * Sätt (eller rensa) avtalets prislista — styr avrops-/tilläggspriser per
   * ärende. Loggas i contract_events så bytet syns i avtalets tidslinje.
   * Kundradens price_list_id speglas från avtalen (mirrorSharedFields), även
   * vid borttagning: avtalskartan är enda vägen att sätta kundens prislista.
   */
  static async setPriceList(
    contractId: string,
    priceListId: string | null,
    names?: { from: string | null; to: string | null }
  ): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ price_list_id: priceListId })
      .eq('id', contractId)
      .select('id, customer_id, status')
    if (error) throw new Error(`Kunde inte byta prislista: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    if (data[0].customer_id) await this.mirrorSharedFields(data[0].customer_id)

    const to = names?.to
    const from = names?.from
    await this.logEvent(contractId, {
      event_type: 'price_list',
      title: priceListId ? 'Prislista ändrad' : 'Prislista borttagen',
      detail: priceListId
        ? from
          ? `${from} → ${to ?? 'ny prislista'}`
          : `${to ?? 'Ny prislista'} vald`
        : `${from ?? 'Prislistan'} togs bort — kundens prislista gäller`,
      metadata: { from_price_list_id: null, to_price_list_id: priceListId },
    })
  }

  /**
   * Omfattningsläge: true = avtalet täcker alla enheter under huvudkontoret,
   * även enheter som skapas senare. Loggas i tidslinjen.
   */
  static async setCoversAllSites(contractId: string, coversAll: boolean): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ covers_all_sites: coversAll })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte ändra omfattningsläget: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'scope_mode',
      title: coversAll ? 'Omfattar hela verksamheten' : 'Omfattning styrs per enhet',
      detail: coversAll
        ? 'Avtalet täcker alla nuvarande enheter och enheter som tillkommer senare'
        : 'Avtalet täcker bara de enheter som står i § 1 Omfattning',
    })
  }

  /**
   * Materialisera kundradens avtalsdata till en riktig contracts-rad.
   *
   * ~95 importerade kunder har premie, datum och uppsägningstid direkt på
   * customers-raden men ingen contracts-rad alls. Kundsidan visar dem via en
   * syntetisk "kundrads"-fallback, men den kan inte bära omfattning, prislista
   * eller avtalsinnehåll. Detta skapar det riktiga avtalet med kundradens data
   * som utgångspunkt.
   *
   * Till skillnad från ImportedCustomerContractService.getOrCreateContract
   * sätts INTE template_id='imported' — raden ska räknas som ett fullvärdigt
   * avtal i Avtalskartan, inte som importrest.
   */
  static async createFromCustomerRow(
    customerId: string,
    label?: string,
    /**
     * Importrest/kundkortsavtal som det nya avtalet ersätter. Historiken
     * (fakturarader, ärenden, avtalsinnehåll, besök) flyttas över och den
     * gamla raden markeras som ersatt — annars ligger två avtal kvar och
     * dubbelräknas, och historiken blir kvar på en rad ingen ser.
     */
    replacesContractId?: string | null
  ): Promise<string> {
    // Explicit typ: den konkatenerade select-strängen bryter Supabase-klientens
    // typinferens, så raden kommer tillbaka otypad.
    type CustomerRow = {
      company_name: string | null
      organization_number: string | null
      contact_email: string | null
      contact_person: string | null
      contact_address: string | null
      annual_value: number | null
      contract_type: string | null
      contract_start_date: string | null
      contract_end_date: string | null
      contract_length: string | null
      billing_frequency: string | null
      billing_anchor_month: number | null
      notice_period_months: number | null
      agreement_text: string | null
      price_list_id: string | null
      billing_email: string | null
      billing_address: string | null
    }

    const { data, error: readError } = await supabase
      .from('customers')
      .select(
        'company_name, organization_number, contact_email, contact_person, contact_address, ' +
          'annual_value, contract_type, contract_start_date, contract_end_date, contract_length, ' +
          'billing_frequency, billing_anchor_month, notice_period_months, agreement_text, price_list_id, billing_email, billing_address'
      )
      .eq('id', customerId)
      .single()
    if (readError || !data) {
      throw new Error(`Kunde inte läsa kunden: ${readError?.message ?? 'okänt fel'}`)
    }
    const customer = data as unknown as CustomerRow

    // Kundradens avtalsfält beskriver kundens FÖRSTA avtal. Har kunden redan
    // levande avtal är raden en spegling av dem (annual_value = summan), och
    // ett andra avtal ska då börja tomt i stället för att ärva fel belopp,
    // fel slutdatum och fel uppsägningstid.
    const hasOtherLive = (await this.liveContractsOnCustomer(customerId)).length > 0
    const annual = hasOtherLive ? 0 : Number(customer.annual_value ?? 0)
    const nextOrder = await this.nextDisplayOrder(customerId)
    const { data: created, error } = await supabase
      .from('contracts')
      .insert({
        customer_id: customerId,
        // oneflow_contract_id är NOT NULL + unikt. Avtalet kommer inte från
        // Oneflow, så vi sätter ett spårbart eget id. Prefixet får INTE vara
        // 'imported-' — då skulle Avtalskartan filtrera bort raden som importrest.
        oneflow_contract_id: `local-${crypto.randomUUID()}`,
        // NOT NULL. Annars Oneflow-mallens id — 'local' markerar avtal skapade
        // i portalen. INTE 'imported' (filtreras bort som importrest).
        template_id: 'local',
        source_type: 'manual',
        type: 'contract',
        status: 'active',
        label: label || customer.contract_type || 'Avtal',
        contract_type: customer.contract_type ?? null,
        company_name: customer.company_name ?? null,
        organization_number: customer.organization_number ?? null,
        contact_email: customer.contact_email ?? null,
        contact_person: customer.contact_person ?? null,
        contact_address: customer.contact_address ?? null,
        billing_email: customer.billing_email ?? null,
        billing_address: customer.billing_address ?? null,
        annual_value: annual > 0 ? annual : null,
        total_value: annual > 0 ? annual : null,
        billing_frequency: hasOtherLive ? null : (customer.billing_frequency ?? null),
        billing_anchor_month: hasOtherLive ? null : (customer.billing_anchor_month ?? null),
        contract_start_date: hasOtherLive ? null : (customer.contract_start_date ?? null),
        contract_end_date: hasOtherLive ? null : (customer.contract_end_date ?? null),
        start_date: hasOtherLive ? null : (customer.contract_start_date ?? null),
        contract_length: hasOtherLive ? null : (customer.contract_length ?? null),
        notice_period_months: hasOtherLive ? null : (customer.notice_period_months ?? null),
        agreement_text: hasOtherLive ? null : (customer.agreement_text ?? null),
        price_list_id: customer.price_list_id ?? null,
        display_order: nextOrder,
      })
      .select('id')
      .single()
    if (error || !created) throw new Error(`Kunde inte skapa avtalet: ${error?.message ?? 'okänt fel'}`)

    // Ärv historiken FÖRST från avtalet som ersätts (importrest med riktig
    // data). Skapas premiestartpunkten före arvet kan avtalet få två identiska
    // startpunkter — den vi skriver och den som följer med raden vi ersätter.
    let inherited = 0
    if (replacesContractId && !replacesContractId.startsWith('kundrad-')) {
      inherited = await this.inheritHistory(replacesContractId, created.id)
    }

    // Premietrappans startpunkt så tidslinjen och årsvärdet stämmer direkt —
    // bara om arvet inte redan gav avtalet en.
    if (annual > 0 && customer.contract_start_date) {
      const { data: existingStart } = await supabase
        .from('contract_premium_events')
        .select('id')
        .eq('contract_id', created.id)
        .eq('event_type', 'start')
        .limit(1)
      if (!existingStart || existingStart.length === 0) {
        await supabase.from('contract_premium_events').insert({
          contract_id: created.id,
          effective_from: customer.contract_start_date,
          annual_value: annual,
          event_type: 'start',
          note: 'Skapat från kundkortets avtalsdata',
        })
      }
    }

    await this.logEvent(created.id, {
      event_type: 'other',
      title: 'Avtalet skapat',
      detail:
        inherited > 0
          ? `Materialiserat från kundkortet · ${inherited} historikrader överförda från tidigare avtalsrad`
          : 'Materialiserat från kundkortets avtalsdata',
    })

    return created.id
  }

  /**
   * Skapa ett riktigt avtal från en IMPORTREST, med importrestens egen data
   * (belopp, datum, avtalstext) i stället för kundkortets.
   *
   * Kunder med flera avtal över tid har en importrest per avtal — kundkortet
   * bär bara ett av dem. Utan detta går det inte att bygga upp historiken rätt.
   */
  static async createFromImportedContract(importedContractId: string, label?: string): Promise<string> {
    type ImportedRow = {
      customer_id: string
      label: string | null
      contract_type: string | null
      company_name: string | null
      organization_number: string | null
      contact_person: string | null
      contact_email: string | null
      contact_phone: string | null
      contact_address: string | null
      billing_email: string | null
      billing_address: string | null
      annual_value: number | null
      total_value: number | null
      billing_frequency: string | null
      contract_start_date: string | null
      contract_end_date: string | null
      start_date: string | null
      contract_length: string | null
      notice_period_months: number | null
      agreement_text: string | null
      price_list_id: string | null
      begone_employee_name: string | null
      begone_employee_email: string | null
      signed_at: string | null
      visit_frequency: string | null
      visits_per_year: number | null
    }

    const { data: src, error: readError } = await supabase
      .from('contracts')
      .select(
        'customer_id, label, contract_type, company_name, organization_number, contact_person, ' +
          'contact_email, contact_phone, contact_address, billing_email, billing_address, ' +
          'annual_value, total_value, billing_frequency, contract_start_date, contract_end_date, ' +
          'start_date, contract_length, notice_period_months, agreement_text, price_list_id, ' +
          'begone_employee_name, begone_employee_email, signed_at, visit_frequency, visits_per_year'
      )
      .eq('id', importedContractId)
      .single()
    if (readError || !src) {
      throw new Error(`Kunde inte läsa avtalsraden: ${readError?.message ?? 'okänt fel'}`)
    }
    const row = src as unknown as ImportedRow

    const { data: created, error } = await supabase
      .from('contracts')
      .insert({
        customer_id: row.customer_id,
        oneflow_contract_id: `local-${crypto.randomUUID()}`,
        template_id: 'local',
        source_type: 'manual',
        type: 'contract',
        status: 'active',
        label: label || row.label || row.contract_type || 'Avtal',
        contract_type: row.contract_type,
        company_name: row.company_name,
        organization_number: row.organization_number,
        contact_person: row.contact_person,
        contact_email: row.contact_email,
        contact_phone: row.contact_phone,
        contact_address: row.contact_address,
        billing_email: row.billing_email,
        billing_address: row.billing_address,
        annual_value: row.annual_value,
        total_value: row.total_value ?? row.annual_value,
        billing_frequency: row.billing_frequency,
        contract_start_date: row.contract_start_date ?? row.start_date,
        contract_end_date: row.contract_end_date,
        start_date: row.start_date ?? row.contract_start_date,
        contract_length: row.contract_length,
        notice_period_months: row.notice_period_months,
        agreement_text: row.agreement_text,
        price_list_id: row.price_list_id,
        begone_employee_name: row.begone_employee_name,
        begone_employee_email: row.begone_employee_email,
        signed_at: row.signed_at,
        visit_frequency: row.visit_frequency,
        visits_per_year: row.visits_per_year,
      })
      .select('id')
      .single()
    if (error || !created) throw new Error(`Kunde inte skapa avtalet: ${error?.message ?? 'okänt fel'}`)

    // Arvet FÖRST: importresten kan redan bära en premiestartpunkt (t.ex. från
    // backfyllningen av signerade Oneflow-avtal). Skapades vår egen dessförinnan
    // fick avtalet två identiska startpunkter och premietrappan visade varje
    // steg dubbelt.
    const inherited = await this.inheritHistory(importedContractId, created.id)

    const annual = Number(row.annual_value ?? 0)
    const startDate = row.contract_start_date ?? row.start_date
    if (annual > 0 && startDate) {
      const { data: existing } = await supabase
        .from('contract_premium_events')
        .select('id')
        .eq('contract_id', created.id)
        .eq('event_type', 'start')
        .limit(1)
      if (!existing || existing.length === 0) {
        await supabase.from('contract_premium_events').insert({
          contract_id: created.id,
          effective_from: startDate,
          annual_value: annual,
          event_type: 'start',
          note: 'Skapat från importerat avtal',
        })
      }
    }
    await this.logEvent(created.id, {
      event_type: 'other',
      title: 'Avtalet skapat',
      detail: `Från importerad avtalsrad${inherited > 0 ? ` · ${inherited} historikrader överförda` : ''}`,
    })

    return created.id
  }

  /**
   * Flytta historik från en gammal avtalsrad (importrest) till det nya avtalet
   * och markera den gamla som ersatt.
   *
   * Fakturarader, ärenden, avtalsinnehåll och kontrollbesök pekas om så att
   * allt hänger på det avtal som faktiskt visas. Den gamla raden raderas inte
   * — den behålls som spår med status 'ended' och en notering.
   *
   * Returnerar antalet överförda rader.
   */
  static async inheritHistory(fromContractId: string, toContractId: string): Promise<number> {
    let moved = 0
    const move = async (table: string, column: string) => {
      const { data, error } = await supabase
        .from(table)
        .update({ [column]: toContractId })
        .eq(column, fromContractId)
        .select('id')
      if (error) {
        console.error(`Kunde inte flytta ${table}:`, error.message)
        return
      }
      moved += data?.length ?? 0
    }

    await move('contract_billing_items', 'contract_id')
    await move('cases', 'contract_id')
    await move('contract_premium_events', 'contract_id')
    await move('contract_sites', 'contract_id')
    await move('station_inspection_sessions', 'contract_id')
    await move('recurring_schedules', 'contract_id')
    // Avtalsinnehåll: case_billing_items använder avtalets id som case_id
    const { data: items } = await supabase
      .from('case_billing_items')
      .update({ case_id: toContractId })
      .eq('case_id', fromContractId)
      .eq('case_type', 'contract')
      .select('id')
    moved += items?.length ?? 0

    // Markera den gamla raden som ersatt så den försvinner ur aktiva vyer
    await supabase
      .from('contracts')
      .update({
        status: 'ended',
        termination_reason: 'Ersatt av nytt avtal i portalen',
      })
      .eq('id', fromContractId)

    return moved
  }

  /**
   * Radera ett avtal som skapats i portalen.
   *
   * Skyddar historiken: avtal med fakturerade rader, ärenden eller
   * kontrollbesök raderas ALDRIG — de måste sägas upp i stället. Endast
   * avtalets eget innehåll (tjänster/artiklar), omfattning, premietrappa och
   * händelselogg städas bort tillsammans med raden.
   */
  static async deleteContract(contractId: string): Promise<void> {
    // Blockera om avtalet bär historik som skulle gå förlorad
    const [billing, cases, sessions] = await Promise.all([
      supabase.from('contract_billing_items').select('id').eq('contract_id', contractId).limit(1),
      supabase.from('cases').select('id').eq('contract_id', contractId).limit(1),
      supabase.from('station_inspection_sessions').select('id').eq('contract_id', contractId).limit(1),
    ])
    if ((billing.data?.length ?? 0) > 0) {
      throw new Error('Avtalet har fakturarader och kan inte raderas — säg upp det i stället.')
    }
    if ((cases.data?.length ?? 0) > 0) {
      throw new Error('Avtalet har kopplade ärenden och kan inte raderas — säg upp det i stället.')
    }
    if ((sessions.data?.length ?? 0) > 0) {
      throw new Error('Avtalet har kontrollbesök och kan inte raderas — säg upp det i stället.')
    }

    // Städa beroenden i ordning (inga kaskader på dessa)
    await supabase.from('case_billing_items').delete().eq('case_id', contractId).eq('case_type', 'contract')
    await supabase.from('contract_sites').delete().eq('contract_id', contractId)
    await supabase.from('contract_premium_events').delete().eq('contract_id', contractId)
    await supabase.from('recurring_schedules').update({ contract_id: null }).eq('contract_id', contractId)

    const { data, error } = await supabase.from('contracts').delete().eq('id', contractId).select('id, customer_id')
    if (error) throw new Error(`Kunde inte radera avtalet: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte raderas (0 rader)')

    // Kundradens årsvärde = summan av levande avtal; räkna om utan det raderade
    const customerId = (data[0] as { customer_id?: string | null }).customer_id
    if (customerId) await this.mirrorSharedFields(customerId)
  }

  /**
   * Besöksfrekvens enligt avtalet. Styr vad schemaläggaren föreslår och är
   * facit i uppföljningen. Avropsavtal har ingen frekvens → skicka null.
   */
  static async setVisitFrequency(
    contractId: string,
    frequency: string | null,
    visitsPerYear: number | null
  ): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ visit_frequency: frequency, visits_per_year: visitsPerYear })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara besöksfrekvensen: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'other',
      title: frequency ? 'Besöksfrekvens satt' : 'Besöksfrekvens borttagen',
      detail: frequency
        ? `${visitsPerYear ? `${visitsPerYear} besök/år` : frequency}`
        : 'Avtalet har ingen fast besöksfrekvens',
    })
  }

  /**
   * Avtalsobjektet: fritext som beskriver vad som ingår — antal stationer per
   * anläggning, besöksintervall, vad som täcks. Kommer från Oneflow-mallen vid
   * signering, men måste kunna fyllas i för hand på äldre och manuella avtal.
   */
  static async setAgreementText(contractId: string, text: string | null): Promise<void> {
    const value = text?.trim() ? text.trim() : null
    const { data, error } = await supabase
      .from('contracts')
      .update({ agreement_text: value })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara avtalsobjektet: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'note',
      title: value ? 'Avtalsobjekt uppdaterat' : 'Avtalsobjekt borttaget',
    })
  }

  /**
   * Datum då kunden faktiskt signerade. Sätts av Oneflow vid signering, men
   * måste kunna fyllas i för avtal som lagts upp i efterhand — annars visar
   * tidslinjen dagen raden skapades i portalen som signeringsdatum.
   */
  /**
   * Sätt avtalets säljare — den som skrivit under för BeGone.
   *
   * Wizarden fyller alltid i fältet, men manuellt upplagda och importerade
   * avtal saknar det (0 av 5 portalskapade, 1 av 17 importerade). Signaturen
   * på avtalskortet faller då tillbaka på kundkortets säljare, vilket kan vara
   * fel person för just det avtalet.
   */
  static async setSalesPerson(contractId: string, name: string | null): Promise<void> {
    const clean = name?.trim() || null
    const { data, error } = await supabase
      .from('contracts')
      .update({ begone_employee_name: clean })
      .eq('id', contractId)
      .select('id, customer_id, status')
    if (error) throw new Error(`Kunde inte spara säljare: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    if (clean) await this.mirrorToCustomerRow(data[0], { sales_person: clean })

    await this.logEvent(contractId, {
      event_type: 'other',
      title: clean ? 'Säljare satt' : 'Säljare borttagen',
      detail: clean ?? undefined,
    })
  }

  /**
   * Kundansvarig för AVTALET. Speglas till kundraderna avtalet OMFATTAR
   * (raden det bor på + § 1-enheterna) — aldrig hela familjen: kunden kan ha
   * två avtal med olika kundansvariga för olika enheter. Omfattningen
   * beräknas av avtalskartan (covers_all_sites/contract_sites/enkelkundens
   * egen rad) och skickas in som coveredCustomerIds. Borttagning speglas
   * inte — ett annat avtal kan äga kundradens värde.
   */
  static async setAccountManager(
    contractId: string,
    name: string | null,
    email: string | null,
    coveredCustomerIds: string[]
  ): Promise<void> {
    const clean = name?.trim() || null
    const cleanEmail = clean ? email?.trim() || null : null
    const { data, error } = await supabase
      .from('contracts')
      .update({ account_manager_name: clean, account_manager_email: cleanEmail })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara kundansvarig: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    if (clean && coveredCustomerIds.length > 0) {
      const { error: mirrorError } = await supabase
        .from('customers')
        .update({ assigned_account_manager: clean, account_manager_email: cleanEmail })
        .in('id', coveredCustomerIds)
      if (mirrorError) {
        console.error('Kunde inte spegla kundansvarig till kundraderna:', mirrorError.message)
      }
    }

    await this.logEvent(contractId, {
      event_type: 'other',
      title: clean ? 'Kundansvarig satt' : 'Kundansvarig borttagen',
      detail: clean ?? undefined,
    })
  }

  static async setSignedAt(contractId: string, signedAt: string | null): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ signed_at: signedAt })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara signeringsdatum: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'other',
      title: signedAt ? 'Signeringsdatum satt' : 'Signeringsdatum borttaget',
      detail: signedAt ?? undefined,
    })
  }

  /**
   * Finns det något ANNAT avtal kvar som lever på kunden?
   *
   * Styr om kundraden ska nollas vid uppsägning. Säkerhetsdefault vid fel är
   * true = "rör inte kundfälten": att felaktigt tro att avtalet var det sista
   * skulle nolla kundens annual_value och slå ut faktureringen för avtal som
   * fortfarande gäller.
   */
  static async hasRemainingActiveContract(
    customerId: string,
    excludeContractId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, status, terminated_at, effective_end_date, contract_end_date')
        .eq('customer_id', customerId)
        .in('status', ['signed', 'active'])
        .neq('id', excludeContractId)
      if (error) {
        console.error('Kunde inte kontrollera kvarvarande avtal:', error.message)
        return true
      }
      return (data ?? []).some((c) => isLiveContract(c as ContractLifecycleFields))
    } catch (err) {
      console.error('Kunde inte kontrollera kvarvarande avtal:', err)
      return true
    }
  }

  /**
   * Pausa löpande scheman som hör till avtalet.
   *
   * TVÅSTEGSREGEL, därför att långt ifrån alla avtal finns som rader: hälften
   * av beståndet är PDF-avtal som aldrig funnits i något system, och de kunder
   * som saknar avtalsrad har scheman utan contract_id.
   *   1. Scheman med contract_id = avtalet → pausas direkt.
   *   2. Scheman UTAN contract_id på kundens rader → resolvern får avgöra om
   *      avtalet ändå gäller dem (via omfattning eller HK:s heltäckande avtal).
   * Träffar ingetdera lämnas schemat i fred — det tillhör en kund utan
   * registrerat avtal och ska fortsätta löpa.
   *
   * ALDRIG 'cancelled': den vägen är irreversibel och sätter kopplade ärenden
   * till 'Borttaget' (se recurringScheduleService.cancelRecurringSchedule).
   * 'paused' stoppar extend-recurring-schedules-cronen, som bara plockar
   * status='active', och går att ångra.
   */
  private static async pauseSchedulesForContract(
    contractId: string,
    customerId: string | null
  ): Promise<number> {
    let paused = 0
    try {
      // Steg 1: direkt kopplade scheman
      const { data: direct, error } = await supabase
        .from('recurring_schedules')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('contract_id', contractId)
        .eq('status', 'active')
        .select('id')
      if (error) console.error('Kunde inte pausa avtalets scheman:', error.message)
      paused += (direct ?? []).length

      if (!customerId) return paused

      // Steg 2: okopplade scheman på kundens familj — fråga resolvern
      const { data: family } = await supabase
        .from('customers')
        .select('id')
        .or(`id.eq.${customerId},parent_customer_id.eq.${customerId}`)
      const familyIds = ((family ?? []) as { id: string }[]).map((r) => r.id)
      if (familyIds.length === 0) return paused

      const { data: orphans } = await supabase
        .from('recurring_schedules')
        .select('id, customer_id')
        .in('customer_id', familyIds)
        .is('contract_id', null)
        .eq('status', 'active')
      const orphanRows = (orphans ?? []) as { id: string; customer_id: string }[]
      if (orphanRows.length === 0) return paused

      // Frågan är "omfattas schemat av DET HÄR avtalet?", inte "vilket avtal
      // hör kunden till?". En kund med flera avtal har inget entydigt svar på
      // den andra frågan, och då pausades bara det nyaste avtalets scheman.
      const covered = await customersCoveredByContract(
        contractId,
        orphanRows.map((r) => r.customer_id)
      )
      const toPause = orphanRows.filter((r) => covered.has(r.customer_id))
      if (toPause.length === 0) return paused

      // Binder bara raden till avtalet när det är kundens enda. Täcks kunden av
      // flera avtal vore kopplingen en gissning som överlever uppsägningen.
      const candidateCounts = await Promise.all(
        [...new Set(toPause.map((r) => r.customer_id))].map(async (id) => ({
          id,
          antal: (await resolveContractCandidates(id)).length,
        }))
      )
      const unambiguous = new Set(candidateCounts.filter((c) => c.antal === 1).map((c) => c.id))

      const bindIds = toPause.filter((r) => unambiguous.has(r.customer_id)).map((r) => r.id)
      const pauseOnlyIds = toPause.filter((r) => !unambiguous.has(r.customer_id)).map((r) => r.id)

      for (const [ids, extra] of [
        [bindIds, { contract_id: contractId }],
        [pauseOnlyIds, {}],
      ] as const) {
        if (ids.length === 0) continue
        const { data: pausedOrphans, error: orphanErr } = await supabase
          .from('recurring_schedules')
          .update({ status: 'paused', ...extra, updated_at: new Date().toISOString() })
          .in('id', ids)
          .select('id')
        if (orphanErr) console.error('Kunde inte pausa okopplade scheman:', orphanErr.message)
        paused += (pausedOrphans ?? []).length
      }
    } catch (err) {
      console.error('Kunde inte pausa scheman:', err)
    }
    return paused
  }

  /**
   * Säg upp ETT avtal. Till skillnad från TerminateContractModal, som säger upp
   * alla kundens avtal samtidigt, träffar detta bara den valda raden — kunder
   * med flera avtal ska kunna avsluta ett och behålla resten.
   *
   * effectiveEndDate = sista dag avtalet gäller. Har den redan passerat blir
   * avtalet direkt avslutat (status 'ended'); annars löper det vidare som
   * uppsagt fram till dess, och expire-contracts-cronen stänger det på natten.
   *
   * Avtalet ligger kvar VISUELLT för spårbarhet men blir funktionellt dött:
   * scheman pausas, framtida besök avbokas och planerade fakturor tas bort.
   */
  static async terminateContract(
    contractId: string,
    effectiveEndDate: string,
    reason?: string | null
  ): Promise<void> {
    const alreadyPassed = effectiveEndDate < todayKey()

    // 1. Avtalsraden — sanningskällan
    const { data, error } = await supabase
      .from('contracts')
      .update({
        terminated_at: toLocalISOStringWithOffset(new Date()),
        effective_end_date: effectiveEndDate,
        termination_reason: reason ?? null,
        billing_active: false,
        // Passerat slutdatum → avtalet är slut nu. Annars behålls statusen så
        // det syns som "uppsagt, löper till <datum>".
        ...(alreadyPassed ? { status: 'ended' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .select('id, customer_id')
    if (error) throw new Error(`Kunde inte säga upp avtalet: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')
    const customerId = (data[0] as { customer_id: string | null }).customer_id

    // 2. Stäng avtalets omfattning på sista giltiga dagen. Utan detta står
    //    lokalen kvar som "täckt" av ett avtal som tagit slut, och en enhet
    //    kan se ut att omfattas av två avtal samtidigt. Rader raderas aldrig —
    //    active_to bevarar historiken.
    const { error: scopeErr } = await supabase
      .from('contract_sites')
      .update({ active_to: effectiveEndDate })
      .eq('contract_id', contractId)
      .is('active_to', null)
    if (scopeErr) console.error('Kunde inte stänga avtalets omfattning:', scopeErr.message)

    // 3. Pausa löpande scheman (tvåstegsregeln ovan)
    const pausedSchedules = await this.pauseSchedulesForContract(contractId, customerId)

    // 4. Avboka inbokade besök EFTER sista giltiga dagen.
    //    TIDSZONSFÄLLA: scheduled_at är timestamptz. Utan T23:59:59 jämförs
    //    datumsträngen mot midnatt, och besök PÅ sista giltiga dagen avbokas
    //    felaktigt — de ska ju genomföras.
    const { error: sessErr } = await supabase
      .from('station_inspection_sessions')
      .update({ status: 'cancelled' })
      .eq('contract_id', contractId)
      .eq('status', 'scheduled')
      .gt('scheduled_at', `${effectiveEndDate}T23:59:59`)
    if (sessErr) console.error('Kunde inte avboka framtida kontrollbesök:', sessErr.message)

    // 5. Ta bort framtida icke-låsta avtalsfakturor för DETTA avtal
    let deletedInvoices = 0
    try {
      deletedInvoices = await ContractInvoiceGenerator.cancelFutureForContract(
        contractId,
        effectiveEndDate
      )
    } catch (err) {
      console.error('Kunde inte ta bort framtida fakturor:', err)
    }

    // 6. Kundfälten synkas BARA när detta var kundens sista levande avtal.
    //    Kontrollen måste ske EFTER steg 1, annars räknas avtalet vi just sagt
    //    upp som kvarvarande. Utan synken återuppstår faktureringen via
    //    buildSyntheticContract, som läser customers.annual_value när inga
    //    aktiva avtalsrader finns.
    if (customerId) {
      const stillActive = await this.hasRemainingActiveContract(customerId, contractId)
      if (!stillActive) {
        const { error: custErr } = await supabase
          .from('customers')
          .update({
            terminated_at: toLocalISOStringWithOffset(new Date()),
            effective_end_date: effectiveEndDate,
            termination_reason: reason ?? null,
            billing_active: false,
            contract_status: 'terminated',
          })
          .eq('id', customerId)
        if (custErr) console.error('Kunde inte synka kundfälten:', custErr.message)
      }
    }

    await this.logEvent(contractId, {
      event_type: 'other',
      title: alreadyPassed ? 'Avtalet avslutat' : 'Avtalet uppsagt',
      detail: [
        reason,
        `Gäller t.o.m. ${effectiveEndDate}`,
        pausedSchedules > 0 ? `${pausedSchedules} schema pausade` : null,
        deletedInvoices > 0 ? `${deletedInvoices} planerade fakturor borttagna` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })

    // Kundradens årsvärde är summan av levande avtal — räkna om när ett
    // avtal lämnar (annars ligger beloppet kvar tills nästa spegling).
    if (customerId && alreadyPassed) await this.mirrorSharedFields(customerId)
  }

  /**
   * Ångra uppsägning — avtalet blir aktivt igen och allt uppsägningen stängde
   * av öppnas: scheman återupptas och avbokade framtida besök bokas om.
   *
   * Fakturaplanen återskapas INTE automatiskt. Kör om fakturagenereringen från
   * faktureringsvyn i stället, så inga oväntade fakturor dyker upp i tysthet.
   */
  static async reactivateContract(contractId: string): Promise<void> {
    // Läs sista giltiga dagen INNAN den nollas — den behövs för att veta vilka
    // besök uppsägningen avbokade.
    const { data: before } = await supabase
      .from('contracts')
      .select('customer_id, effective_end_date')
      .eq('id', contractId)
      .maybeSingle()
    const prevEnd = (before as { effective_end_date: string | null } | null)?.effective_end_date ?? null
    const customerId = (before as { customer_id: string | null } | null)?.customer_id ?? null

    const { data, error } = await supabase
      .from('contracts')
      .update({
        terminated_at: null,
        effective_end_date: null,
        termination_reason: null,
        billing_active: true,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte återaktivera avtalet: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    // Öppna omfattningen igen — uppsägningen stängde den på slutdatumet
    if (prevEnd) {
      const { error: scopeErr } = await supabase
        .from('contract_sites')
        .update({ active_to: null })
        .eq('contract_id', contractId)
        .eq('active_to', prevEnd)
      if (scopeErr) console.error('Kunde inte öppna avtalets omfattning:', scopeErr.message)
    }

    // Återuppta scheman som uppsägningen pausade
    const { error: schedErr } = await supabase
      .from('recurring_schedules')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('contract_id', contractId)
      .eq('status', 'paused')
    if (schedErr) console.error('Kunde inte återuppta avtalets scheman:', schedErr.message)

    // Boka om besök som avbokades efter det gamla slutdatumet. Samma
    // T23:59:59-gräns som vid uppsägningen, annars träffas fel rader.
    if (prevEnd) {
      const { error: sessErr } = await supabase
        .from('station_inspection_sessions')
        .update({ status: 'scheduled' })
        .eq('contract_id', contractId)
        .eq('status', 'cancelled')
        .gt('scheduled_at', `${prevEnd}T23:59:59`)
      if (sessErr) console.error('Kunde inte återställa avbokade besök:', sessErr.message)
    }

    // Kundfälten återställs bara om uppsägningen faktiskt nollade dem
    if (customerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('terminated_at')
        .eq('id', customerId)
        .maybeSingle()
      if ((cust as { terminated_at: string | null } | null)?.terminated_at) {
        const { error: custErr } = await supabase
          .from('customers')
          .update({
            terminated_at: null,
            effective_end_date: null,
            termination_reason: null,
            billing_active: true,
            contract_status: 'active',
          })
          .eq('id', customerId)
        if (custErr) console.error('Kunde inte återställa kundfälten:', custErr.message)
      }
    }

    await this.logEvent(contractId, {
      event_type: 'other',
      title: 'Uppsägning ångrad',
      detail: 'Scheman återupptagna och avbokade besök återställda. Kör om fakturagenereringen vid behov.',
    })

    // Avtalet räknas som levande igen — kundradens summa ska ha med det
    if (customerId) await this.mirrorSharedFields(customerId)
  }

  /** Sätt avtalstyp: namnet blir både label (visningsnamn) och contract_type */
  static async setContractType(contractId: string, typeName: string): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ label: typeName, contract_type: typeName })
      .eq('id', contractId)
      .select('id, customer_id, status')
    if (error) throw new Error(`Kunde inte ändra avtalstyp: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.mirrorToCustomerRow(data[0], { contract_type: typeName })

    await this.logEvent(contractId, {
      event_type: 'other',
      title: 'Avtalstyp ändrad',
      detail: typeName,
    })
  }

  // ---------------------------------------------------------------------------
  // Avtalskartan som motor (fas 1): tomt avtalsblad, § 7 Premie, § 8 Referenser,
  // § 9 Löptid. Se docs/avtalskarta-motor-plan.md.
  // ---------------------------------------------------------------------------

  /** Levande, riktiga avtal (ej importrester) på en kundrad. */
  private static async liveContractsOnCustomer(customerId: string): Promise<LiveContractRow[]> {
    const { data } = await supabase
      .from('contracts')
      .select(
        'id, annual_value, billing_frequency, billing_anchor_month, contract_start_date, contract_end_date, ' +
          'notice_period_months, status, terminated_at, effective_end_date, template_id, oneflow_contract_id, display_order, price_list_id'
      )
      .eq('customer_id', customerId)
      .in('status', ['signed', 'active'])
    const today = todayKey()
    return ((data ?? []) as unknown as LiveContractRow[]).filter(
      (c) => isLiveContract(c, today) && !isImportedContractRow(c)
    )
  }

  /** Nästa visningsordning på kundraden (papprens ordning i avtalskartan). */
  private static async nextDisplayOrder(customerId: string): Promise<number> {
    const { data } = await supabase
      .from('contracts')
      .select('display_order')
      .eq('customer_id', customerId)
    const max = ((data ?? []) as { display_order: number | null }[]).reduce(
      (m, r) => Math.max(m, Number(r.display_order ?? 0)),
      0
    )
    return max + 1
  }

  /**
   * Spegla avtalens fält till kundraden när avtalen är källan.
   *
   * annual_value på kundraden = SUMMAN av kundens levande avtal, så att
   * synth-fallbacken, dashboards och gamla listor visar rätt tal även för
   * kunder med flera avtal (FEV: fyra prisposter). Frekvens, ankarmånad,
   * datum och uppsägningstid speglas bara när ALLA levande avtal delar
   * värdet — annars finns inget entydigt kundvärde och raden lämnas orörd.
   * Fel sväljs: speglingen får aldrig fälla avtalsändringen.
   */
  private static async mirrorSharedFields(customerId: string): Promise<void> {
    try {
      const live = await this.liveContractsOnCustomer(customerId)
      if (live.length === 0) return
      const sum = live.reduce((s, c) => s + Number(c.annual_value ?? 0), 0)
      const patch: Record<string, unknown> = { annual_value: sum > 0 ? sum : null }
      const shared = <T>(pick: (c: LiveContractRow) => T): T | undefined => {
        const first = pick(live[0])
        return live.every((c) => pick(c) === first) ? first : undefined
      }
      const freq = shared((c) => c.billing_frequency ?? null)
      if (freq) patch.billing_frequency = freq
      const anchor = shared((c) => c.billing_anchor_month ?? null)
      if (anchor) patch.billing_anchor_month = anchor
      const start = shared((c) => c.contract_start_date ?? null)
      if (start) patch.contract_start_date = start
      const end = shared((c) => c.contract_end_date ?? null)
      if (end !== undefined) patch.contract_end_date = end
      const notice = shared((c) => c.notice_period_months ?? null)
      if (notice) patch.notice_period_months = notice
      // Kundradens prislista styrs av avtalskartan: delad lista, annars första pappret i ordningen
      const sharedList = shared((c) => c.price_list_id ?? null)
      const primary = [...live].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]
      patch.price_list_id = sharedList !== undefined ? sharedList : (primary.price_list_id ?? null)
      const { error } = await supabase.from('customers').update(patch).eq('id', customerId)
      if (error) console.error('Kunde inte spegla avtalsfält till kundraden:', error.message)
    } catch (err) {
      console.error('Kunde inte spegla avtalsfält till kundraden:', err)
    }
  }

  /**
   * Tomt avtal på en kundrad (tomt avtalsblad i avtalskartan). Bär bara
   * parter och typ; premie, löptid och omfattning fylls i på pappret.
   * Till skillnad från createFromCustomerRow ärvs INGET från kundradens
   * avtalsfält — det här är ett nytt avtal, inte en materialisering.
   */
  static async createBlankContract(
    customerId: string,
    input: { label?: string | null; contractType?: string | null }
  ): Promise<string> {
    const { data: customer, error: readError } = await supabase
      .from('customers')
      .select('company_name, organization_number, contact_email, contact_person, contact_address, billing_email, billing_address, price_list_id')
      .eq('id', customerId)
      .single()
    if (readError || !customer) throw new Error(`Kunde inte läsa kunden: ${readError?.message ?? 'okänt fel'}`)

    const nextOrder = await this.nextDisplayOrder(customerId)
    const typeName = input.contractType ?? input.label ?? null
    const { data: created, error } = await supabase
      .from('contracts')
      .insert({
        customer_id: customerId,
        oneflow_contract_id: `local-${crypto.randomUUID()}`,
        template_id: 'local',
        source_type: 'manual',
        type: 'contract',
        status: 'active',
        label: input.label ?? typeName ?? 'Avtal',
        contract_type: typeName,
        company_name: customer.company_name ?? null,
        organization_number: customer.organization_number ?? null,
        contact_email: customer.contact_email ?? null,
        contact_person: customer.contact_person ?? null,
        contact_address: customer.contact_address ?? null,
        billing_email: customer.billing_email ?? null,
        billing_address: customer.billing_address ?? null,
        price_list_id: customer.price_list_id ?? null,
        billing_active: true,
        display_order: nextOrder,
      })
      .select('id')
      .single()
    if (error || !created) throw new Error(`Kunde inte skapa avtalet: ${error?.message ?? 'okänt fel'}`)

    await this.logEvent(created.id, {
      event_type: 'other',
      title: 'Avtalet skapat',
      detail: 'Skapat i avtalskartan (tomt avtalsblad)',
    })
    return created.id
  }

  /**
   * § 7 Premie och fakturering: årspremie, frekvens och ankarmånad.
   * Premietrappan får en startpunkt om den saknas (annars uppdateras det
   * enda steget); har trappan flera steg lämnas den åt användaren.
   */
  static async setPremium(
    contractId: string,
    input: { annualValue: number | null; billingFrequency: string | null; billingAnchorMonth: number | null }
  ): Promise<void> {
    const { data: current, error: readError } = await supabase
      .from('contracts')
      .select('customer_id, annual_value, billing_frequency, billing_anchor_month, contract_start_date')
      .eq('id', contractId)
      .single()
    if (readError || !current) throw new Error(`Kunde inte läsa avtalet: ${readError?.message ?? 'okänt fel'}`)

    const annual = input.annualValue && input.annualValue > 0 ? Math.round(input.annualValue) : null
    const { error } = await supabase
      .from('contracts')
      .update({
        annual_value: annual,
        total_value: annual,
        billing_frequency: input.billingFrequency ?? null,
        billing_anchor_month: input.billingAnchorMonth ?? null,
        billing_active: true,
      })
      .eq('id', contractId)
    if (error) throw new Error(`Kunde inte spara premien: ${error.message}`)

    if (annual) {
      const { data: events } = await supabase
        .from('contract_premium_events')
        .select('id, event_type, effective_from')
        .eq('contract_id', contractId)
        .order('effective_from', { ascending: true })
      const list = (events ?? []) as { id: string; event_type: string; effective_from: string }[]
      if (list.length === 0) {
        await supabase.from('contract_premium_events').insert({
          contract_id: contractId,
          effective_from: current.contract_start_date ?? todayKey(),
          annual_value: annual,
          event_type: 'start',
          note: 'Satt i avtalskartan',
        })
      } else if (list.length === 1) {
        await supabase.from('contract_premium_events').update({ annual_value: annual }).eq('id', list[0].id)
      }
    }

    const prevAnnual = current.annual_value == null ? null : Number(current.annual_value)
    await this.logEvent(contractId, {
      event_type: 'billing',
      title: 'Premie och fakturering ändrad',
      detail: [
        annual !== prevAnnual
          ? `Årspremie ${prevAnnual != null ? `${prevAnnual.toLocaleString('sv-SE')} → ` : ''}${annual != null ? `${annual.toLocaleString('sv-SE')} kr` : 'borttagen'}`
          : null,
        input.billingFrequency && input.billingFrequency !== current.billing_frequency
          ? `Frekvens ${input.billingFrequency}`
          : null,
        input.billingAnchorMonth && input.billingAnchorMonth !== current.billing_anchor_month
          ? `Ankarmånad ${input.billingAnchorMonth}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Inga ändrade värden',
    })
    if (current.customer_id) await this.mirrorSharedFields(current.customer_id)
  }

  /**
   * Nytt steg i premietrappan (upptrappning, indexjustering, justering).
   * Träder steget i kraft idag eller tidigare uppdateras avtalets årsvärde
   * direkt; framtida steg ligger kvar i trappan tills datumet passerar.
   */
  static async addPremiumEvent(
    contractId: string,
    input: {
      eventType: 'step_up' | 'indexation' | 'adjustment' | 'addition'
      effectiveFrom: string
      annualValue: number
      note?: string | null
    }
  ): Promise<void> {
    const annual = Math.round(input.annualValue)
    if (!(annual > 0)) throw new Error('Årspremien måste vara större än noll')
    const { data: current, error: readError } = await supabase
      .from('contracts')
      .select('customer_id, annual_value')
      .eq('id', contractId)
      .single()
    if (readError || !current) throw new Error(`Kunde inte läsa avtalet: ${readError?.message ?? 'okänt fel'}`)

    const { error } = await supabase.from('contract_premium_events').insert({
      contract_id: contractId,
      effective_from: input.effectiveFrom,
      annual_value: annual,
      event_type: input.eventType,
      note: input.note ?? null,
    })
    if (error) throw new Error(`Kunde inte spara steget: ${error.message}`)

    const inForce = input.effectiveFrom <= todayKey()
    if (inForce) {
      await supabase.from('contracts').update({ annual_value: annual, total_value: annual }).eq('id', contractId)
    }
    const labels: Record<typeof input.eventType, string> = {
      step_up: 'Upptrappning',
      indexation: 'Indexjustering',
      adjustment: 'Justering',
      addition: 'Tillägg',
    }
    const prev = current.annual_value == null ? null : Number(current.annual_value)
    await this.logEvent(contractId, {
      event_type: input.eventType === 'indexation' ? 'indexation' : 'billing',
      title: `${labels[input.eventType]} ${inForce ? 'gäller' : 'planerad'} från ${input.effectiveFrom}`,
      detail: `${prev != null ? `${prev.toLocaleString('sv-SE')} → ` : ''}${annual.toLocaleString('sv-SE')} kr/år${input.note ? ` · ${input.note}` : ''}`,
    })
    if (inForce && current.customer_id) await this.mirrorSharedFields(current.customer_id)
  }

  /**
   * Tilläggsstationer inbakade i årspremien (släpp av brickan på § 7):
   * ett steg i premietrappan från valt datum med text om antal och datum,
   * stationerna märks included, eventuell § 6-rad för dem avslutas.
   * Samma dag och typ: steget summeras och texten byggs på (unik nyckel).
   */
  static async addAddonStationsToPremium(
    contractId: string,
    input: {
      unitId: string
      unitName: string
      stationTypeId: string | null
      stationTypeName: string
      model: 'per_year' | 'per_month'
      count: number
      outdoorIds: string[]
      indoorIds: string[]
      unitPriceAnnual: number
      effectiveFrom: string
    }
  ): Promise<{ newAnnual: number; note: string }> {
    const add = Math.round(input.unitPriceAnnual * input.count * 100) / 100
    if (!(add > 0)) throw new Error('Årspriset måste vara större än noll')
    const { data: contract, error: cErr } = await supabase
      .from('contracts')
      .select('customer_id, annual_value')
      .eq('id', contractId)
      .single()
    if (cErr || !contract) throw new Error(`Kunde inte läsa avtalet: ${cErr?.message ?? 'okänt fel'}`)
    const { data: steps } = await supabase
      .from('contract_premium_events')
      .select('id, effective_from, annual_value, event_type, note')
      .eq('contract_id', contractId)
    type Step = { id: string; effective_from: string; annual_value: number | string; event_type: string; note: string | null }
    const all = ((steps ?? []) as Step[]).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    // Årsvärdet som gäller vid datumet (trappan, annars avtalets annual_value)
    const applicable = all.filter((s) => s.effective_from <= input.effectiveFrom)
    const inForce = applicable.length > 0
      ? Number(applicable[applicable.length - 1].annual_value)
      : all.length > 0
        ? Number(all[0].annual_value)
        : Number(contract.annual_value ?? 0)
    const note = `Tilläggsstationer adderade till avtalet, ${input.count} st ${input.stationTypeName} på ${input.unitName}, ${input.effectiveFrom}`

    const same = all.find((s) => s.effective_from === input.effectiveFrom && s.event_type === 'addition')
    let newAnnual: number
    if (same) {
      newAnnual = Math.round((Number(same.annual_value) + add) * 100) / 100
      const { error } = await supabase
        .from('contract_premium_events')
        .update({ annual_value: newAnnual, note: `${same.note ?? ''}${same.note ? ' · ' : ''}${note}` })
        .eq('id', same.id)
      if (error) throw new Error(`Kunde inte uppdatera steget: ${error.message}`)
    } else {
      newAnnual = Math.round((inForce + add) * 100) / 100
      const { error } = await supabase.from('contract_premium_events').insert({
        contract_id: contractId,
        effective_from: input.effectiveFrom,
        annual_value: newAnnual,
        event_type: 'addition',
        note,
      })
      if (error) throw new Error(`Kunde inte spara steget: ${error.message}`)
    }
    // Senare steg i trappan bär vidare höjningen
    for (const later of all.filter((s) => s.effective_from > input.effectiveFrom)) {
      await supabase
        .from('contract_premium_events')
        .update({ annual_value: Math.round((Number(later.annual_value) + add) * 100) / 100 })
        .eq('id', later.id)
    }
    if (input.effectiveFrom <= todayKey()) {
      const latestInForce = Math.max(newAnnual, ...all.filter((s) => s.effective_from <= todayKey() && s.effective_from > input.effectiveFrom).map((s) => Number(s.annual_value) + add))
      await supabase.from('contracts').update({ annual_value: latestInForce, total_value: latestInForce }).eq('id', contractId)
    }

    // Stationerna: inbakade, kopplade till avtalet
    if (input.outdoorIds.length > 0) {
      await supabase.from('equipment_placements').update({ addon_contract_mode: 'included', addon_contract_id: contractId }).in('id', input.outdoorIds)
    }
    if (input.indoorIds.length > 0) {
      await supabase.from('indoor_stations').update({ addon_contract_mode: 'included', addon_contract_id: contractId }).in('id', input.indoorIds)
    }
    // Eventuell § 6-rad för samma enhet/typ/modell avslutas (historiken kvar)
    let q = supabase
      .from('case_billing_items')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('case_id', contractId)
      .eq('site_customer_id', input.unitId)
      .eq('billing_model', input.model)
      .eq('status', 'pending')
    q = input.stationTypeId ? q.eq('station_type_id', input.stationTypeId) : q.is('station_type_id', null)
    await q

    await this.logEvent(contractId, {
      event_type: 'billing',
      title: `Tilläggsstationer inbakade i premien från ${input.effectiveFrom}`,
      detail: `${note} · +${add.toLocaleString('sv-SE')} kr/år → ${newAnnual.toLocaleString('sv-SE')} kr/år`,
    })
    if (contract.customer_id) await this.mirrorSharedFields(contract.customer_id)
    return { newAnnual, note }
  }

  /**
   * Tilläggsstationer som tillägg utöver avtalet (släpp av brickan på § 6):
   * stationerna märks separate och kopplas till avtalet, § 6-raden synkas
   * via RPC (antal, pris, startdatum = nästa periodstart).
   */
  static async addAddonStationsSeparate(
    contractId: string,
    input: {
      unitId: string
      unitName: string
      stationTypeName: string
      model: 'per_year' | 'per_month'
      count: number
      outdoorIds: string[]
      indoorIds: string[]
      unitPriceAnnual: number
    }
  ): Promise<void> {
    if (input.outdoorIds.length > 0) {
      await supabase.from('equipment_placements').update({ addon_contract_mode: 'separate', addon_contract_id: contractId }).in('id', input.outdoorIds)
    }
    if (input.indoorIds.length > 0) {
      await supabase.from('indoor_stations').update({ addon_contract_mode: 'separate', addon_contract_id: contractId }).in('id', input.indoorIds)
    }
    const { error } = await supabase.rpc('sync_addon_period_lines', {
      p_customer_id: input.unitId,
      p_contract_id: contractId,
      p_annual_price: input.unitPriceAnnual,
    })
    if (error) throw new Error(`Kunde inte synka § 6-raden: ${error.message}`)
    await this.logEvent(contractId, {
      event_type: 'billing',
      title: `Tilläggsstationer utöver avtalet: ${input.count} st ${input.stationTypeName} på ${input.unitName}`,
      detail: `${input.model === 'per_month' ? 'Per månad' : 'Per år'} · ${input.unitPriceAnnual.toLocaleString('sv-SE')} kr/år per station · egna fakturor, antal vid varje debitering`,
    })
  }

  /** § 6: var per år-rader faktureras, på premiefakturan eller på egna fakturor. */
  static async setEquipmentInvoiceMode(contractId: string, mode: 'with_premium' | 'separate'): Promise<void> {
    const { error } = await supabase.from('contracts').update({ equipment_invoice_mode: mode }).eq('id', contractId)
    if (error) throw new Error(`Kunde inte ändra faktureringsläge: ${error.message}`)
    await this.logEvent(contractId, {
      event_type: 'billing',
      title: mode === 'separate' ? 'Utrustning faktureras på egna fakturor' : 'Utrustning faktureras på premiefakturan',
      detail: mode === 'separate' ? 'Per år-rader i § 6 får egna fakturor parallellt med årspremien' : 'Per år-rader i § 6 ligger som rader på årspremiefakturan',
    })
  }

  /** § 9 Löptid: start, slut och uppsägningstid. */
  static async setTerm(
    contractId: string,
    input: { startDate: string | null; endDate: string | null; noticePeriodMonths: number | null }
  ): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({
        contract_start_date: input.startDate,
        start_date: input.startDate,
        contract_end_date: input.endDate,
        notice_period_months: input.noticePeriodMonths,
      })
      .eq('id', contractId)
      .select('id, customer_id')
    if (error) throw new Error(`Kunde inte spara löptiden: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'other',
      title: 'Löptid ändrad',
      detail: `${input.startDate ?? '?'} till ${input.endDate ?? 'tills vidare'}${
        input.noticePeriodMonths ? ` · uppsägningstid ${input.noticePeriodMonths} mån` : ''
      }`,
    })
    if (data[0].customer_id) await this.mirrorSharedFields(data[0].customer_id)
  }

  /** § 8 Referenser: avtalets Er referens och diarienummer (skrivs på årspremiefakturan). */
  static async setInvoiceReference(
    contractId: string,
    input: { invoiceReference: string | null; diaryNumber: string | null }
  ): Promise<void> {
    const ref = input.invoiceReference?.trim() || null
    const diary = input.diaryNumber?.trim() || null
    const { data, error } = await supabase
      .from('contracts')
      .update({ invoice_reference: ref, diary_number: diary })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara referensen: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')
    await this.logEvent(contractId, {
      event_type: 'billing',
      title: 'Avtalets referens ändrad',
      detail: [ref ? `Er referens ${ref}` : 'Ingen Er referens', diary ? `diarienummer ${diary}` : null]
        .filter(Boolean)
        .join(' · '),
    })
  }

  /**
   * § 8 Referenser per enhet: skriver enhetens fält "Märkning faktura"
   * (customers.billing_reference), samma fält som Redigera enhet. Koden
   * förifylls sedan som Er referens på alla ärenden och fakturor för enheten,
   * oavsett avtal. Loggas på avtalet den sattes ifrån.
   */
  static async setUnitBillingReference(
    customerId: string,
    code: string | null,
    context?: { contractId: string; unitName: string }
  ): Promise<void> {
    const value = code?.trim() || null
    const { data, error } = await supabase
      .from('customers')
      .update({ billing_reference: value })
      .eq('id', customerId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara referenskoden: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Enheten kunde inte uppdateras (0 rader)')
    if (context) {
      await this.logEvent(context.contractId, {
        event_type: 'billing',
        title: value ? `Er referens satt för ${context.unitName}` : `Er referens borttagen för ${context.unitName}`,
        detail: value ? `${value} · skrivs på enhetens ärenden och fakturor` : 'Beställaren anger kod på ärendet',
      })
    }
  }

  /**
   * § 6 Utrustning: faktureringsläge på en tjänsterad i avtalsinnehållet.
   *   premium   = ingår i årspremien (§ 4)
   *   per_year  = debiteras utöver premien, antal x pris per år, rad på årsfakturan
   *   per_round = tilläggsstation per kontrollrunda (tjänst 43), aldrig från avtalet
   */
  static async setLineBillingModel(
    contractId: string,
    itemId: string,
    model: 'premium' | 'per_year' | 'per_month' | 'per_round',
    label?: string | null
  ): Promise<void> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .update({ billing_model: model })
      .eq('id', itemId)
      .eq('case_id', contractId)
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .select('id')
    if (error) throw new Error(`Kunde inte ändra faktureringsläge: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Raden kunde inte uppdateras (0 rader)')
    const labels = { premium: 'ingår i premien', per_year: 'per styck och år', per_month: 'per styck och månad', per_round: 'per kontrollrunda' }
    await this.logEvent(contractId, {
      event_type: 'billing',
      title: `${label ?? 'Rad'}: ${labels[model]}`,
      detail:
        model === 'per_year'
          ? 'Egen rad på årspremiefakturan'
          : model === 'per_month'
            ? 'Egen månadsfaktura'
          : model === 'per_round'
            ? 'Debiteras när kontrollrundan avslutas'
            : 'Ingår i årspremien',
    })
  }

  /**
   * § 3 per enhet: driftläge och besökstakt för en enhet i avtalets omfattning.
   * inspection = schema förväntas, on_demand = avrop (schemalöshet är rätt).
   * Frekvens null = avtalets förval gäller.
   */
  static async setSiteVisitPlan(
    contractId: string,
    contractSiteId: string,
    input: { serviceMode: 'inspection' | 'on_demand'; frequency: string | null; visitsPerYear: number | null },
    unitName?: string | null
  ): Promise<void> {
    const { data, error } = await supabase
      .from('contract_sites')
      .update({
        service_mode: input.serviceMode,
        visit_frequency: input.serviceMode === 'on_demand' ? null : input.frequency,
        visits_per_year: input.serviceMode === 'on_demand' ? null : input.visitsPerYear,
      })
      .eq('id', contractSiteId)
      .eq('contract_id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara enhetens besöksplan: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Omfattningsraden kunde inte uppdateras (0 rader)')
    await this.logEvent(contractId, {
      event_type: 'scope_mode',
      title: `${unitName ?? 'Enhet'}: ${input.serviceMode === 'on_demand' ? 'avrop' : 'stationskontroll'}`,
      detail:
        input.serviceMode === 'on_demand'
          ? 'Ärendestyrd, inget schema förväntas'
          : input.visitsPerYear
            ? `${input.visitsPerYear} besök per år${input.frequency ? ` (${input.frequency})` : ''}`
            : 'Avtalets förval gäller',
    })
  }

  /**
   * § 9 Förlängning: läge och optionsfält. Styr bara bevakningen: inget
   * avtal stoppas automatiskt (beslut 2026-09-02).
   */
  static async setRenewal(
    contractId: string,
    input: {
      renewalMode: 'rolling' | 'fixed' | 'option'
      optionUntil: string | null
      optionDecisionDeadline: string | null
      reminderDays: number | null
    }
  ): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({
        renewal_mode: input.renewalMode,
        option_until: input.renewalMode === 'option' ? input.optionUntil : null,
        option_decision_deadline: input.renewalMode === 'option' ? input.optionDecisionDeadline : null,
        renewal_reminder_days: input.reminderDays ?? 90,
      })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte spara förlängningsläget: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')
    const labels = { rolling: 'Löper vidare tills uppsägning', fixed: 'Fast slutdatum', option: 'Option på förlängning' }
    await this.logEvent(contractId, {
      event_type: 'renewal',
      title: labels[input.renewalMode],
      detail:
        input.renewalMode === 'option'
          ? `Längst till ${input.optionUntil ?? '?'} · beslut senast ${input.optionDecisionDeadline ?? '?'} · påminnelse ${input.reminderDays ?? 90} dagar före`
          : input.renewalMode === 'fixed'
            ? `Påminnelse ${input.reminderDays ?? 90} dagar före slutdatumet`
            : 'Ingen bevakning utöver uppsägningstiden',
    })
  }

  /**
   * Nyttja option: flytta slutdatumet framåt (12 månader, aldrig förbi
   * option_until) på SAMMA papper och logga händelsen. Nästa beslutsdatum
   * sätts med samma uppsägningstid som avtalet har.
   */
  static async exerciseOption(contractId: string, input?: { newEndDate?: string | null; note?: string | null }): Promise<string> {
    const { data: c, error: readError } = await supabase
      .from('contracts')
      .select('contract_end_date, option_until, option_decision_deadline, notice_period_months, customer_id')
      .eq('id', contractId)
      .single()
    if (readError || !c) throw new Error(`Kunde inte läsa avtalet: ${readError?.message ?? 'okänt fel'}`)
    if (!c.contract_end_date) throw new Error('Avtalet saknar slutdatum')

    let newEnd: string
    if (input?.newEndDate) {
      newEnd = input.newEndDate
    } else {
      const d = new Date(`${c.contract_end_date}T12:00:00`)
      d.setFullYear(d.getFullYear() + 1)
      newEnd = d.toISOString().slice(0, 10)
    }
    if (c.option_until && newEnd > c.option_until) newEnd = c.option_until
    if (newEnd <= c.contract_end_date) throw new Error('Optionen är redan fullt nyttjad')

    // Nästa beslutsdatum: nya slutdatumet minus uppsägningstiden, om fler optioner finns
    let nextDeadline: string | null = null
    if (c.option_until && newEnd < c.option_until) {
      const d = new Date(`${newEnd}T12:00:00`)
      d.setMonth(d.getMonth() - (c.notice_period_months ?? 6))
      nextDeadline = d.toISOString().slice(0, 10)
    }

    const { error } = await supabase
      .from('contracts')
      .update({ contract_end_date: newEnd, option_decision_deadline: nextDeadline })
      .eq('id', contractId)
    if (error) throw new Error(`Kunde inte nyttja optionen: ${error.message}`)

    await this.logEvent(contractId, {
      event_type: 'renewal',
      title: `Option nyttjad, avtalet gäller till ${newEnd}`,
      detail: [
        `Tidigare slutdatum ${c.contract_end_date}`,
        nextDeadline ? `Nästa beslut senast ${nextDeadline}` : 'Sista optionen nyttjad',
        input?.note?.trim() || null,
      ]
        .filter(Boolean)
        .join(' · '),
    })
    if (c.customer_id) await this.mirrorSharedFields(c.customer_id)
    return newEnd
  }

  /**
   * Ångra "dra in i § 1": raden raderas bara om den är färsk (under tio
   * minuter) och inget pekar på avtalet för enheten; annars avslutas
   * täckningen med samma datum som den började (historiken bevaras).
   */
  static async removeSiteIfFresh(scopeRowId: string): Promise<'deleted' | 'ended'> {
    const { data: row, error } = await supabase
      .from('contract_sites')
      .select('id, contract_id, customer_id, active_from, created_at')
      .eq('id', scopeRowId)
      .single()
    if (error || !row) throw new Error('Omfattningsraden hittades inte')
    const ageMs = Date.now() - new Date(row.created_at).getTime()
    const [{ data: sessions }, { data: cases }] = await Promise.all([
      supabase.from('station_inspection_sessions').select('id').eq('contract_id', row.contract_id).eq('customer_id', row.customer_id).limit(1),
      supabase.from('cases').select('id').eq('contract_id', row.contract_id).eq('customer_id', row.customer_id).limit(1),
    ])
    const hasDeps = (sessions?.length ?? 0) > 0 || (cases?.length ?? 0) > 0
    if (ageMs < 10 * 60 * 1000 && !hasDeps) {
      const { error: delErr } = await supabase.from('contract_sites').delete().eq('id', scopeRowId)
      if (delErr) throw new Error(`Kunde inte ångra: ${delErr.message}`)
      await this.logEvent(row.contract_id, { event_type: 'note', title: 'Omfattning ångrad', detail: 'Enheten togs bort ur § 1 direkt efter att den dragits in' })
      return 'deleted'
    }
    await this.endSite(scopeRowId, row.active_from ?? todayKey())
    return 'ended'
  }

  /** Ångra "avsluta täckning": öppna raden igen. */
  static async reopenSite(scopeRowId: string): Promise<void> {
    const { data, error } = await supabase
      .from('contract_sites')
      .update({ active_to: null })
      .eq('id', scopeRowId)
      .select('contract_id')
    if (error) throw new Error(`Kunde inte återöppna täckningen: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Omfattningsraden hittades inte')
    await this.logEvent(data[0].contract_id, { event_type: 'note', title: 'Avslutad täckning ångrad', detail: 'Enheten står åter i § 1 Omfattning' })
  }

  /** Byt visningsordning mellan två papper (drag papper över papper). */
  static async swapDisplayOrder(a: { id: string; order: number }, b: { id: string; order: number }): Promise<void> {
    const orderA = a.order === b.order ? b.order + 1 : b.order
    const orderB = a.order === b.order ? a.order : a.order
    const [r1, r2] = await Promise.all([
      supabase.from('contracts').update({ display_order: orderA }).eq('id', a.id),
      supabase.from('contracts').update({ display_order: orderB }).eq('id', b.id),
    ])
    if (r1.error || r2.error) throw new Error(`Kunde inte byta ordning: ${r1.error?.message ?? r2.error?.message}`)
  }

  /**
   * Katalogen: lägg en tjänst eller utrustning på avtalet som rad i
   * avtalsinnehållet. premium = ingår i premien (§ 4), per_year = utöver
   * premien (§ 6), per_round = tilläggsstation per kontrollrunda (§ 6).
   */
  static async addContentServiceRow(
    contractId: string,
    customerId: string,
    input: {
      serviceId: string
      serviceCode: string | null
      serviceName: string
      unitPrice: number
      quantity?: number
      vatRate?: number
      billingModel: 'premium' | 'per_year' | 'per_month' | 'per_round'
      stationTypeId?: string | null
      note?: string | null
    }
  ): Promise<string> {
    const qty = input.quantity ?? 1
    const total = Math.round(input.unitPrice * qty * 100) / 100
    const { data, error } = await supabase
      .from('case_billing_items')
      .insert({
        case_id: contractId,
        case_type: 'contract',
        customer_id: customerId,
        item_type: 'service',
        service_id: input.serviceId,
        service_code: input.serviceCode,
        service_name: input.serviceName,
        article_name: input.serviceName,
        quantity: qty,
        unit_price: input.unitPrice,
        discount_percent: 0,
        discounted_price: input.unitPrice,
        total_price: total,
        vat_rate: input.vatRate ?? 25,
        price_source: 'standard',
        status: 'pending',
        requires_approval: false,
        billing_model: input.billingModel,
        station_type_id: input.stationTypeId ?? null,
        notes: input.note ?? null,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Kunde inte lägga till raden: ${error?.message ?? 'okänt fel'}`)
    await this.logEvent(contractId, {
      event_type: input.billingModel === 'premium' ? 'other' : 'billing',
      title: `${input.serviceName} tillagd i ${input.billingModel === 'premium' ? '§ 4' : '§ 6'}`,
      detail:
        input.billingModel === 'premium'
          ? `Ingår i premien${input.unitPrice ? ` · ${input.unitPrice.toLocaleString('sv-SE')} kr/år` : ''}`
          : input.billingModel === 'per_year'
            ? `${qty} st à ${input.unitPrice.toLocaleString('sv-SE')} kr per år, utöver premien`
            : 'Per kontrollrunda (tilläggsstation)',
    })
    return data.id
  }

  /** Ångra en katalograd: raderas bara om den inte hunnit faktureras. */
  static async removeContentRow(contractId: string, itemId: string): Promise<void> {
    const { error } = await supabase
      .from('case_billing_items')
      .delete()
      .eq('id', itemId)
      .eq('case_id', contractId)
      .eq('case_type', 'contract')
      .eq('status', 'pending')
    if (error) throw new Error(`Kunde inte ångra: ${error.message}`)
  }

  /** Räkna om kundradens speglade avtalsfält (summa av levande avtal). */
  static async resyncCustomerRow(customerId: string): Promise<void> {
    await this.mirrorSharedFields(customerId)
  }

  /**
   * Gemet: hur kundens årspremier faktureras. 'consolidated' = en faktura
   * per period med en rad per avtal, 'per_contract' = en faktura per avtal.
   * Läses på huvudkontorsraden. Loggas på varje levande avtal.
   */
  static async setContractInvoiceMode(customerId: string, mode: 'per_contract' | 'consolidated'): Promise<void> {
    const { data, error } = await supabase
      .from('customers')
      .update({ contract_invoice_mode: mode })
      .eq('id', customerId)
      .select('id')
    if (error) throw new Error(`Kunde inte ändra faktureringsläge: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Kundraden kunde inte uppdateras (0 rader)')
    const live = await this.liveContractsOnCustomer(customerId)
    for (const c of live) {
      await this.logEvent(c.id, {
        event_type: 'billing',
        title: mode === 'consolidated' ? 'Faktureras på kundens samlingsfaktura' : 'Faktureras på egen faktura',
        detail: mode === 'consolidated' ? 'En faktura per period, en rad per avtal' : 'Varje avtal faktureras för sig',
      })
    }
  }

  /**
   * Indexera alla levande avtal på en kund i ett steg (gemet). Samma
   * procent och datum på alla; utrustningsrader "per styck och år" räknas
   * upp med samma procent när includeEquipment är satt.
   */
  static async indexAllContracts(
    customerId: string,
    input: { effectiveFrom: string; percent: number; note?: string | null; includeEquipment?: boolean }
  ): Promise<{ indexed: number; skipped: number }> {
    if (!Number.isFinite(input.percent) || input.percent === 0) throw new Error('Ange en procentsats')
    const live = await this.liveContractsOnCustomer(customerId)
    let indexed = 0
    let skipped = 0
    for (const c of live) {
      const current = Number(c.annual_value ?? 0)
      if (!(current > 0)) {
        skipped += 1
        continue
      }
      const next = Math.round(current * (1 + input.percent / 100))
      await this.addPremiumEvent(c.id, {
        eventType: 'indexation',
        effectiveFrom: input.effectiveFrom,
        annualValue: next,
        note: `${input.note?.trim() ? `${input.note.trim()} ` : ''}${input.percent.toLocaleString('sv-SE')} %`.trim(),
      })
      if (input.includeEquipment) {
        const { data: rows } = await supabase
          .from('case_billing_items')
          .select('id, unit_price, quantity')
          .eq('case_id', c.id)
          .eq('case_type', 'contract')
          .eq('item_type', 'service')
          .eq('billing_model', 'per_year')
          .neq('status', 'cancelled')
        for (const r of (rows ?? []) as { id: string; unit_price: number; quantity: number }[]) {
          const unit = Math.round(Number(r.unit_price) * (1 + input.percent / 100) * 100) / 100
          await supabase
            .from('case_billing_items')
            .update({ unit_price: unit, total_price: Math.round(unit * Number(r.quantity) * 100) / 100 })
            .eq('id', r.id)
        }
      }
      indexed += 1
    }
    return { indexed, skipped }
  }

  /**
   * Nolla kundradens egna avtalsfält när raden täcks av ett riktigt avtal.
   * Avtalsdatum på en kundrad utan egen contracts-rad ger ett "kundkortsavtal"
   * i avtalskartan; när enheten i stället står i ett avtals § 1 är datumen
   * bara rester som ska bort. contract_status lämnas (kundportalen läser den).
   */
  static async clearCustomerRowContractFields(customerId: string): Promise<void> {
    const { data, error } = await supabase
      .from('customers')
      .update({ contract_start_date: null, contract_end_date: null })
      .eq('id', customerId)
      .select('id')
    if (error) throw new Error(`Kunde inte nolla kundradens avtalsfält: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Kundraden kunde inte uppdateras (0 rader)')
  }

  /** Skriv en händelse i avtalets logg (tidslinjen). Fel sväljs — loggen får aldrig fälla mutationen. */
  static async logEvent(
    contractId: string,
    event: { event_type: ContractEventType; title: string; detail?: string | null; metadata?: Record<string, unknown> }
  ): Promise<void> {
    try {
      const createdByName = await currentUserName()
      await supabase.from('contract_events').insert({
        contract_id: contractId,
        event_type: event.event_type,
        title: event.title,
        detail: event.detail ?? null,
        metadata: event.metadata ?? null,
        created_by_name: createdByName,
      })
    } catch (err) {
      console.error('Kunde inte logga avtalshändelse:', err)
    }
  }
}
