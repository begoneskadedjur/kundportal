// src/services/addonCoverageService.ts
// Täckning per tilläggsstation (addon_station_coverage), steg 8 i
// docs/planer/avtalsar-exakt-arsdag-teknik.md. Alla anrop går via
// SECURITY DEFINER-RPC:er. Läsning kräver intern personal; registrering,
// efterskänkning och släpp kräver profiles.can_approve_invoices.
//
// Regler som databasen håller:
// - Två aktiva rader för samma station får aldrig dela en dag (felet säger
//   vilken rad som redan täcker).
// - En makulerad faktura släpper aldrig täckningen. Raden markeras och väntar
//   på ett val: Fakturera igen (release) eller Efterskänk (waive).

import { supabase } from '../lib/supabase'
import type { AddonCoverageGap, AddonCoverageListRow } from '../types/addonStations'

export type AddonStationKind = 'outdoor' | 'indoor'

function rpcError(fn: string, error: { message?: string } | null): Error {
  return new Error(error?.message || `${fn} misslyckades`)
}

export class AddonCoverageService {
  /**
   * Registrera en manuell Fortnox-faktura som täckning för stationerna.
   * Datum som ÅÅÅÅ-MM-DD, båda inklusive. Returnerar antal skrivna rader.
   */
  static async registerManual(params: {
    stationIds: string[]
    kind: AddonStationKind
    from: string
    to: string
    fortnoxDocument: string
    note?: string | null
  }): Promise<number> {
    const { data, error } = await supabase.rpc('addon_coverage_register_manual', {
      p_station_ids: params.stationIds,
      p_kind: params.kind,
      p_from: params.from,
      p_to: params.to,
      p_fortnox_document: params.fortnoxDocument,
      p_note: params.note ?? null,
    })
    if (error) throw rpcError('addon_coverage_register_manual', error)
    return Number(data ?? 0)
  }

  /**
   * Efterskänk perioden för stationerna: överlappande rader släpps och en
   * efterskänkt rad skrivs i samma transaktion. Anteckning krävs.
   */
  static async waive(params: {
    stationIds: string[]
    kind: AddonStationKind
    from: string
    to: string
    note: string
  }): Promise<number> {
    const { data, error } = await supabase.rpc('addon_coverage_waive', {
      p_station_ids: params.stationIds,
      p_kind: params.kind,
      p_from: params.from,
      p_to: params.to,
      p_note: params.note,
    })
    if (error) throw rpcError('addon_coverage_waive', error)
    return Number(data ?? 0)
  }

  /**
   * Släpp täckningsrader (Fakturera igen). Dagarna blir ett glapp som nästa
   * planering fakturerar. Orsak krävs.
   */
  static async release(coverageIds: string[], reason: string): Promise<number> {
    const { data, error } = await supabase.rpc('addon_coverage_release', {
      p_coverage_ids: coverageIds,
      p_reason: reason,
    })
    if (error) throw rpcError('addon_coverage_release', error)
    return Number(data ?? 0)
  }

  /** Täckningen för en enhet, eller för en huvudkund med alla dess enheter. */
  static async listForUnit(unitId: string, includeReleased = false): Promise<AddonCoverageListRow[]> {
    const { data, error } = await supabase.rpc('addon_station_coverage_list', {
      p_unit_id: unitId,
      p_include_released: includeReleased,
    })
    if (error) throw rpcError('addon_station_coverage_list', error)
    return (data as AddonCoverageListRow[] | null) ?? []
  }

  /** Dagar i perioden som ingen aktiv täckningsrad tar, som sammanhängande glapp. */
  static async gaps(stationId: string, kind: AddonStationKind, from: string, to: string): Promise<AddonCoverageGap[]> {
    const { data, error } = await supabase.rpc('addon_station_gaps', {
      p_station_id: stationId,
      p_kind: kind,
      p_from: from,
      p_to: to,
    })
    if (error) throw rpcError('addon_station_gaps', error)
    return (data as AddonCoverageGap[] | null) ?? []
  }

  /**
   * Konflikten är hanterad (arbetslistan, steg 10). Raden står kvar med
   * resolved_at och syns inte längre i listan.
   */
  static async resolveConflicts(conflictIds: string[]): Promise<number> {
    const { data, error } = await supabase.rpc('addon_coverage_conflict_resolve', { p_conflict_ids: conflictIds })
    if (error) throw rpcError('addon_coverage_conflict_resolve', error)
    return Number(data ?? 0)
  }

  /**
   * Koppla stationer som sattes ut utan ärende till ett ärende (arbetslistan,
   * steg 10). Bara stationer som saknar ärende ändras. Returnerar antal.
   */
  static async setStationCase(stationIds: string[], kind: AddonStationKind, caseId: string): Promise<number> {
    const { data, error } = await supabase.rpc('addon_station_set_case', {
      p_station_ids: stationIds,
      p_kind: kind,
      p_case_id: caseId,
    })
    if (error) throw rpcError('addon_station_set_case', error)
    return Number(data ?? 0)
  }
}
