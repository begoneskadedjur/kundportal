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

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
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

  /** Sätt (eller rensa) avtalets prislista — styr avrops-/tilläggspriser per ärende */
  static async setPriceList(contractId: string, priceListId: string | null): Promise<void> {
    const { data, error } = await supabase
      .from('contracts')
      .update({ price_list_id: priceListId })
      .eq('id', contractId)
      .select('id')
    if (error) throw new Error(`Kunde inte byta prislista: ${error.message}`)
    if (!data || data.length === 0) throw new Error('Avtalet kunde inte uppdateras (0 rader)')
  }
}
