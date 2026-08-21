// src/services/contractScopeService.ts
// Skrivväg för avtalens omfattning (contract_sites) och avtalets prislista.
// Används av Avtalskartan på kundsidan. Historik bevaras alltid: en täckning
// avslutas genom att active_to sätts — rader raderas aldrig.

import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import { isLiveContract, type ContractLifecycleFields } from '../utils/contractLifecycle'
import { resolveContractsForCustomers } from './contractResolver'
import { ContractInvoiceGenerator } from './contractInvoiceGenerator'

export interface ScopeRow {
  id: string
  contract_id: string
  customer_id: string
  active_from: string | null
  active_to: string | null
  note: string | null
}

export type ContractEventType = 'price_list' | 'scope_mode' | 'note' | 'billing' | 'other'

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
   * Sätt (eller rensa) avtalets prislista — styr avrops-/tilläggspriser per
   * ärende. Loggas i contract_events så bytet syns i avtalets tidslinje.
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
      .select('id')
    if (error) throw new Error(`Kunde inte byta prislista: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

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
          'billing_frequency, notice_period_months, agreement_text, price_list_id, billing_email, billing_address'
      )
      .eq('id', customerId)
      .single()
    if (readError || !data) {
      throw new Error(`Kunde inte läsa kunden: ${readError?.message ?? 'okänt fel'}`)
    }
    const customer = data as unknown as CustomerRow

    const annual = Number(customer.annual_value ?? 0)
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
        billing_frequency: customer.billing_frequency ?? null,
        contract_start_date: customer.contract_start_date ?? null,
        contract_end_date: customer.contract_end_date ?? null,
        start_date: customer.contract_start_date ?? null,
        contract_length: customer.contract_length ?? null,
        notice_period_months: customer.notice_period_months ?? null,
        agreement_text: customer.agreement_text ?? null,
        price_list_id: customer.price_list_id ?? null,
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

    const { data, error } = await supabase.from('contracts').delete().eq('id', contractId).select('id')
    if (error) throw new Error(`Kunde inte radera avtalet: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte raderas (0 rader)')
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
      .select('id')
    if (error) throw new Error(`Kunde inte spara säljare: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'other',
      title: clean ? 'Säljare satt' : 'Säljare borttagen',
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

      const resolved = await resolveContractsForCustomers(
        orphanRows.map((r) => r.customer_id)
      )
      const toPause = orphanRows.filter((r) => resolved[r.customer_id] === contractId)
      if (toPause.length === 0) return paused

      const { data: pausedOrphans, error: orphanErr } = await supabase
        .from('recurring_schedules')
        .update({
          status: 'paused',
          // Knyt raden till avtalet nu när vi vet vilket det är, så nästa
          // uppsägning inte behöver gissa om igen.
          contract_id: contractId,
          updated_at: new Date().toISOString(),
        })
        .in('id', toPause.map((r) => r.id))
        .select('id')
      if (orphanErr) console.error('Kunde inte pausa okopplade scheman:', orphanErr.message)
      paused += (pausedOrphans ?? []).length
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
  }

  /** Sätt avtalstyp: namnet blir både label (visningsnamn) och contract_type */
  static async setContractType(contractId: string, typeName: string): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ label: typeName, contract_type: typeName })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte ändra avtalstyp: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')

    await this.logEvent(contractId, {
      event_type: 'other',
      title: 'Avtalstyp ändrad',
      detail: typeName,
    })
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
