// src/services/contractScopeService.ts
// Skrivväg för avtalens omfattning (contract_sites) och avtalets prislista.
// Används av Avtalskartan på kundsidan. Historik bevaras alltid: en täckning
// avslutas genom att active_to sätts — rader raderas aldrig.

import { supabase } from '../lib/supabase'

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
    const { error } = await supabase.from('contract_sites').insert(
      missing.map((customerId) => ({
        contract_id: contractId,
        customer_id: customerId,
        active_from: activeFrom,
        note: 'Hela verksamheten',
      }))
    )
    if (error) throw new Error(`Kunde inte skriva in enheterna: ${error.message}`)
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
  static async createFromCustomerRow(customerId: string, label?: string): Promise<string> {
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

    // Premietrappans startpunkt så tidslinjen och årsvärdet stämmer direkt
    if (annual > 0 && customer.contract_start_date) {
      await supabase.from('contract_premium_events').insert({
        contract_id: created.id,
        effective_from: customer.contract_start_date,
        annual_value: annual,
        event_type: 'start',
        note: 'Skapat från kundkortets avtalsdata',
      })
    }

    await this.logEvent(created.id, {
      event_type: 'other',
      title: 'Avtalet skapat',
      detail: 'Materialiserat från kundkortets avtalsdata',
    })

    return created.id
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
