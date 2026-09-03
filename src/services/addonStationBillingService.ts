// src/services/addonStationBillingService.ts
// Tilläggsstationer (Tillägg utöver avtal): räkning, förifylld tjänsterad per
// kontrollrunda och delad avslutskedja för fakturering av kontroll- och
// etableringsärenden. Se docs/tillaggsstationer-plan.md.
//
// Viktiga regler (beslutade 2026-08-31):
// - Antal på rundraden = tilläggsstationer som KONTROLLERADES i sessionen
//   (inspektionsrader), inte aktiva-vid-avslut. Robust mot upphämtning mitt i rundan.
// - Idempotensvakt läser ALLA statusar ('all') — default pending-filter missar
//   billade rader och skulle dubbelfakturera vid återöppnad session.
// - Vid 0-pris skapas raden som synligt underlag men INGEN faktura genereras
//   (fakturering hoppar över när fakturerbar total är 0).
// - Fakturering får ALDRIG blockera statusövergången — anroparen kör kedjan i
//   try/catch efter att status satts.
// - Provision skapas ALDRIG automatiskt här.

import { supabase } from '../lib/supabase'
import { CaseBillingService } from './caseBillingService'
import { ContractBillingService } from './contractBillingService'
import { PriceListService } from './priceListService'
import { VisitService } from './visitService'
import type { Service, ServiceDefaultArticle } from '../types/services'
import type { CaseBillingItemWithRelations } from '../types/caseBilling'
import type { AddonBillingModel, AddonPrices } from '../types/addonStations'

export interface PrefillResult {
  outcome: 'created' | 'updated' | 'already_billed' | 'no_stations' | 'no_service'
  quantity: number
  unitPrice: number
  priceMissing: boolean
  /** Satt när raden redan är fakturerad men antalet har ändrats */
  billedQuantityMismatch?: { billed: number; current: number }
}

export interface CompleteBillingResult {
  itemsCreated: number
  totalAmount: number
  invoiceError?: string | null
  skippedZeroTotal: boolean
}

export class AddonStationBillingService {
  /**
   * Tjänsten som bär ÅRSPRISET för tilläggsstationer (per år, per månad = /12).
   * Tjänst 43 (used_for_addon_stations) fortsätter betyda pris per kontroll.
   */
  static async getAddonAnnualService(): Promise<Service | null> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('used_for_addon_stations_annual', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[AddonStationBilling] Kunde inte läsa årstjänsten:', error)
      return null
    }
    return (data as Service | null) ?? null
  }

  /**
   * Priser för tilläggsstationer hos en kund: per år (årstjänsten), per månad
   * (årspris/12) och per kontroll (tjänst 43), ur avtalets/kundens prislista.
   * hasContract via RPC (tekniker kan inte läsa contracts direkt).
   */
  static async getAddonPrices(customerId: string): Promise<AddonPrices> {
    const [annualService, roundService, candidates] = await Promise.all([
      this.getAddonAnnualService(),
      this.getAddonStationService(),
      supabase.rpc('get_contract_candidates', { p_customer_id: customerId }),
    ])
    const [annual, round] = await Promise.all([
      annualService ? PriceListService.getEffectiveServicePrice(annualService.id, customerId) : Promise.resolve(null),
      roundService ? PriceListService.getEffectiveServicePrice(roundService.id, customerId) : Promise.resolve(null),
    ])
    const perYear = annual?.price ?? annualService?.base_price ?? null
    const perRound = round?.price ?? roundService?.base_price ?? null
    const hasContract = !candidates.error && Array.isArray(candidates.data) && candidates.data.length > 0
    return {
      perYear: perYear != null && perYear > 0 ? Number(perYear) : null,
      perMonth: perYear != null && perYear > 0 ? Math.round((Number(perYear) / 12) * 100) / 100 : null,
      perRound: perRound != null && perRound > 0 ? Number(perRound) : null,
      hasContract,
    }
  }

  /**
   * § 6-rader för per år/per månad-stationer: antal synkas från enhetens
   * aktiva stationer (SECURITY DEFINER-RPC, vikarie-säker). Sväljer fel.
   */
  static async syncAddonPeriodLines(customerId: string): Promise<{ ok: boolean; contractId?: string | null; reason?: string } | null> {
    try {
      const annual = await this.getAddonAnnualService()
      let annualPrice: number | null = null
      if (annual) {
        const eff = await PriceListService.getEffectiveServicePrice(annual.id, customerId)
        annualPrice = eff?.price ?? annual.base_price ?? null
      }
      const { data, error } = await supabase.rpc('sync_addon_period_lines', {
        p_customer_id: customerId,
        p_contract_id: null,
        p_annual_price: annualPrice,
      })
      if (error) {
        console.warn('[AddonStationBilling] sync_addon_period_lines fel:', error)
        return null
      }
      const d = data as { ok?: boolean; contract_id?: string | null; reason?: string } | null
      return { ok: !!d?.ok, contractId: d?.contract_id ?? null, reason: d?.reason }
    } catch (err) {
      console.warn('[AddonStationBilling] Periodsynk misslyckades:', err)
      return null
    }
  }

  /**
   * Pro rata-rad på öppet etableringsärende för per år/per månad-stationer:
   * årspris × dagar till nästa periodstart / 365 per station. Sväljer fel.
   */
  static async syncAddonProrataLine(
    customerId: string,
    technicianId?: string | null,
    technicianName?: string | null
  ): Promise<{ found: boolean; count?: number; total?: number; row_id?: string | null; covered_by_open_invoice?: string | null; no_contract?: boolean } | null> {
    try {
      const annual = await this.getAddonAnnualService()
      let annualPrice: number | null = null
      if (annual) {
        const eff = await PriceListService.getEffectiveServicePrice(annual.id, customerId)
        annualPrice = eff?.price ?? annual.base_price ?? null
      }
      const { data, error } = await supabase.rpc('sync_addon_prorata_line', {
        p_customer_id: customerId,
        p_annual_price: annualPrice,
        p_technician_id: technicianId ?? null,
        p_technician_name: technicianName ?? null,
      })
      if (error) {
        console.warn('[AddonStationBilling] sync_addon_prorata_line fel:', error)
        return null
      }
      return data as { found: boolean; count?: number; total?: number; row_id?: string | null; covered_by_open_invoice?: string | null; no_contract?: boolean }
    } catch (err) {
      console.warn('[AddonStationBilling] Pro rata-synk misslyckades:', err)
      return null
    }
  }

  /** Synk efter utsättning/borttag beroende på stationens modell. */
  static async syncAfterStationChange(
    customerId: string,
    model: AddonBillingModel | null | undefined,
    technicianId?: string | null,
    technicianName?: string | null
  ): Promise<void> {
    if (!model || model === 'per_round') {
      await this.syncAddonEstablishmentLine(customerId, technicianId ?? null, technicianName ?? null)
      return
    }
    await this.syncAddonPeriodLines(customerId)
    await this.syncAddonProrataLine(customerId, technicianId ?? null, technicianName ?? null)
  }

  /**
   * Tjänsten som används för rundfakturering av tilläggsstationer.
   * Slås upp dynamiskt via services.used_for_addon_stations (max en åt gången).
   */
  static async getAddonStationService(): Promise<Service | null> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('used_for_addon_stations', true)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[AddonStationBilling] Kunde inte hämta tilläggsstations-tjänst:', error)
      return null
    }
    return data
  }

  /**
   * Automatiska interna kostnader (artikelrader) per enhet av en tjänst.
   */
  static async getDefaultArticles(serviceId: string): Promise<ServiceDefaultArticle[]> {
    const { data, error } = await supabase
      .from('service_default_articles')
      .select('*, article:articles(id, name, default_price, unit)')
      .eq('service_id', serviceId)

    if (error) {
      console.error('[AddonStationBilling] Kunde inte hämta tjänsteartiklar:', error)
      return []
    }
    return (data || []) as ServiceDefaultArticle[]
  }

  /**
   * Ersätt tjänstens automatiska interna kostnader (admin-UI).
   */
  static async setDefaultArticles(
    serviceId: string,
    rows: { article_id: string; quantity_per_unit: number }[]
  ): Promise<void> {
    const { error: delError } = await supabase
      .from('service_default_articles')
      .delete()
      .eq('service_id', serviceId)
    if (delError) throw new Error(`Databasfel: ${delError.message}`)

    if (rows.length > 0) {
      const { error: insError } = await supabase
        .from('service_default_articles')
        .insert(rows.map(r => ({
          service_id: serviceId,
          article_id: r.article_id,
          quantity_per_unit: r.quantity_per_unit
        })))
      if (insError) throw new Error(`Databasfel: ${insError.message}`)
    }
  }

  /**
   * Räkna tilläggsstationer som KONTROLLERADES i en session
   * (inspektionsrader i sessionen, joinade mot is_addon).
   * Fallback: aktiva tilläggsstationer per kund om sessionen saknar rader helt.
   */
  static async countInspectedAddonStations(
    sessionId: string,
    customerId: string
  ): Promise<number> {
    const [outdoorRes, indoorRes] = await Promise.all([
      supabase
        .from('outdoor_station_inspections')
        .select('station_id, station:equipment_placements!station_id(is_addon, addon_billing_model)')
        .eq('session_id', sessionId),
      supabase
        .from('indoor_station_inspections')
        .select('station_id, station:indoor_stations!station_id(is_addon, addon_billing_model)')
        .eq('session_id', sessionId)
    ])

    if (outdoorRes.error) console.error('[AddonStationBilling] Utomhusräkning fel:', outdoorRes.error)
    if (indoorRes.error) console.error('[AddonStationBilling] Inomhusräkning fel:', indoorRes.error)
    const queriesFailed = !!outdoorRes.error || !!indoorRes.error

    const outdoorRows = outdoorRes.data || []
    const indoorRows = indoorRes.data || []

    // PostgREST kan returnera joinen som objekt eller en-elements-array.
    // Bara per kontroll-stationer debiteras i rundan; per år/månad har egna flöden.
    const rowIsAddon = (station: unknown): boolean => {
      const s = Array.isArray(station) ? station[0] : station
      const st = s as { is_addon?: boolean; addon_billing_model?: string | null } | null
      return st?.is_addon === true && (st.addon_billing_model ?? 'per_round') === 'per_round'
    }

    // Dubbletter kan förekomma (känd brist: ingen DB-unik på station+session) —
    // räkna unika station_id så en dubbelsparad kontroll inte dubbelfakturerar
    const addonIds = new Set<string>()
    for (const row of outdoorRows) {
      if (rowIsAddon(row.station)) addonIds.add(row.station_id)
    }
    for (const row of indoorRows) {
      if (rowIsAddon(row.station)) addonIds.add(row.station_id)
    }

    if (outdoorRows.length === 0 && indoorRows.length === 0 && !queriesFailed) {
      // Sessionen saknar inspektionsrader helt — fall tillbaka på aktiva
      // tilläggsstationer. GÄLLER BARA när frågorna lyckades: vid fel (RLS/nät)
      // ska vi hellre räkna 0 än fakturera stationer som aldrig kontrollerades.
      return this.countActiveAddonStations(customerId)
    }

    return addonIds.size
  }

  /**
   * Aktiva tilläggsstationer PER KONTROLL hos en kund (utomhus + inomhus via
   * planritningar). Per år/månad räknas aldrig här.
   */
  static async countActiveAddonStations(customerId: string): Promise<number> {
    const [outdoorRes, indoorRes] = await Promise.all([
      supabase
        .from('equipment_placements')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .eq('is_addon', true)
        .eq('addon_billing_model', 'per_round'),
      supabase
        .from('indoor_stations')
        .select('id, floor_plan:floor_plans!inner(customer_id)', { count: 'exact', head: true })
        .eq('floor_plan.customer_id', customerId)
        .eq('status', 'active')
        .eq('is_addon', true)
        .eq('addon_billing_model', 'per_round')
    ])

    return (outdoorRes.count || 0) + (indoorRes.count || 0)
  }

  /**
   * Stationer placerade hos en kund sedan ett givet datum.
   * onlyAddon=true → bara tilläggsstationer (förifyllnad av etableringsraden);
   * onlyAddon=false → alla stationer (avslutsspärr: har etableringen ens börjat?).
   */
  static async countStationsPlacedSince(
    customerId: string,
    sinceIso: string,
    onlyAddon: boolean
  ): Promise<number> {
    // Endast aktiva stationer räknas — placerad-och-borttagen ska inte
    // blåsa upp antal (specialistkrav: faktureringsrisk annars)
    let outdoorQuery = supabase
      .from('equipment_placements')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .gte('placed_at', sinceIso)
    let indoorQuery = supabase
      .from('indoor_stations')
      .select('id, floor_plan:floor_plans!inner(customer_id)', { count: 'exact', head: true })
      .eq('floor_plan.customer_id', customerId)
      .eq('status', 'active')
      .gte('placed_at', sinceIso)

    if (onlyAddon) {
      outdoorQuery = outdoorQuery.eq('is_addon', true)
      indoorQuery = indoorQuery.eq('is_addon', true)
    }

    const [outdoorRes, indoorRes] = await Promise.all([outdoorQuery, indoorQuery])
    return (outdoorRes.count || 0) + (indoorRes.count || 0)
  }

  /**
   * Tilläggsstationer placerade hos en kund sedan ett givet datum
   * (används för att förifylla antal på etableringsraden).
   */
  static async countAddonStationsPlacedSince(
    customerId: string,
    sinceIso: string
  ): Promise<number> {
    return this.countStationsPlacedSince(customerId, sinceIso, true)
  }

  /**
   * Förifyll tjänsterad för tilläggsstationer på ett kontrollärende.
   * Idempotent: uppdaterar pending-rad, hoppar över billed-rad (med varning
   * om antalet ändrats). Skapar även tjänstens automatiska interna
   * kostnader (artikelrader) vid nyskapande.
   */
  static async prefillAddonStationLine(params: {
    caseId: string
    customerId: string
    sessionId: string
    technicianId?: string | null
    technicianName?: string | null
  }): Promise<PrefillResult> {
    const { caseId, customerId, sessionId, technicianId, technicianName } = params

    const quantity = await this.countInspectedAddonStations(sessionId, customerId)
    if (quantity === 0) {
      return { outcome: 'no_stations', quantity: 0, unitPrice: 0, priceMissing: false }
    }

    const service = await this.getAddonStationService()
    if (!service) {
      console.warn('[AddonStationBilling] Ingen tjänst har flaggan "Används för tilläggsstationer" — ingen rad skapas')
      return { outcome: 'no_service', quantity, unitPrice: 0, priceMissing: false }
    }

    // Pris: avtalets/kundens/standardprislistan → base_price → 0
    const effectivePrice = await PriceListService.getEffectiveServicePrice(service.id, customerId)
    const unitPrice = effectivePrice?.price ?? service.base_price ?? 0

    // Idempotensvakt — läs ALLA statusar (default pending-filter missar billade
    // rader → dubbelfaktura vid återöppnad session)
    const existingItems: CaseBillingItemWithRelations[] =
      await CaseBillingService.getCaseBillingItems(caseId, 'contract', 'all')
    // Markören är primär identifiering; service_id som fallback för rader
    // skapade innan markörkolumnen fanns
    const existing = existingItems.find(
      i => i.is_addon_station_line === true ||
        (i.item_type === 'service' && i.service_id === service.id)
    )

    if (existing && existing.status !== 'pending') {
      // Redan fakturerad — skapa inget, men flagga om antalet ändrats
      return {
        outcome: 'already_billed',
        quantity,
        unitPrice,
        priceMissing: unitPrice === 0,
        billedQuantityMismatch: existing.quantity !== quantity
          ? { billed: existing.quantity, current: quantity }
          : undefined
      }
    }

    if (existing) {
      // Pending-rad finns (t.ex. återöppnad session) — uppdatera antal + pris
      const { error } = await supabase
        .from('case_billing_items')
        .update({
          quantity,
          unit_price: unitPrice,
          discounted_price: unitPrice,
          total_price: unitPrice * quantity
        })
        .eq('id', existing.id)
      if (error) throw new Error(`Databasfel: ${error.message}`)
      return { outcome: 'updated', quantity, unitPrice, priceMissing: unitPrice === 0 }
    }

    // Radtext särskiljer rundan från etableringen på kundens faktura
    // (specialistkrav: annars läser det som dubbeldebitering). Idempotens-
    // vakterna matchar på service_id/markör, aldrig namn — suffixet är säkert.
    const rundDatum = new Date().toLocaleDateString('sv-SE')
    const created = await CaseBillingService.addServiceToCase({
      case_id: caseId,
      case_type: 'contract',
      customer_id: customerId,
      service_id: service.id,
      service_code: service.code,
      service_name: `${service.name} – Kontrollrunda ${rundDatum}`,
      quantity,
      unit_price: unitPrice,
      added_by_technician_id: technicianId || undefined,
      added_by_technician_name: technicianName || undefined,
      notes: 'Tilläggsstationer kontrollerade i rundan'
    })
    // Markera raden som ärendets tilläggsstationsrad (partiellt unikt index
    // i DB stoppar dubbletter om två avslut skulle racea)
    const { error: markError } = await supabase
      .from('case_billing_items')
      .update({ is_addon_station_line: true })
      .eq('id', created.id)
    if (markError) console.warn('[AddonStationBilling] Kunde inte sätta tilläggsradsmarkör:', markError)

    // Automatiska interna kostnader (artikelrader) — bara vid nyskapande
    const defaultArticles = await this.getDefaultArticles(service.id)
    for (const da of defaultArticles) {
      try {
        await CaseBillingService.addArticleToCase({
          case_id: caseId,
          case_type: 'contract',
          customer_id: customerId,
          article_id: da.article_id,
          article_name: da.article?.name || 'Artikel',
          quantity: quantity * da.quantity_per_unit,
          unit_price: da.article?.default_price ?? 0,
          added_by_technician_id: technicianId || undefined,
          added_by_technician_name: technicianName || undefined,
          notes: 'Automatisk intern kostnad (tilläggsstationer)'
        })
      } catch (err) {
        console.error('[AddonStationBilling] Kunde inte skapa intern kostnadsrad:', err)
      }
    }

    return { outcome: 'created', quantity, unitPrice, priceMissing: unitPrice === 0 }
  }

  /**
   * Bakgrundssynk av tilläggsstationsraden på öppet etableringsärende.
   * Hela synken (ärendeuppslag + räkning + upsert) körs i SECURITY DEFINER-
   * RPC:n sync_addon_station_line:
   * - fungerar även för vikarier som inte kan läsa ärendet (cases-RLS)
   * - kan inte skapa dubbelrader (partiellt unikt index + ON CONFLICT)
   * - synkar antal även NER (0-total ⇒ ingen faktura)
   * - rör ALDRIG Etableringskostnad-raden (egen rad med markörkolumn)
   * Klienten bidrar bara med prisuppslaget (fungerar för alla roller via
   * prislist-RPC:n). Får aldrig störa placeringsflödet — sväljer fel.
   */
  static async syncAddonEstablishmentLine(
    customerId: string,
    technicianId?: string | null,
    technicianName?: string | null
  ): Promise<{ found: boolean; count?: number; row_id?: string | null; open_count?: number; already_billed?: boolean } | null> {
    try {
      const service = await this.getAddonStationService()
      let unitPrice: number | null = null
      if (service) {
        const effective = await PriceListService.getEffectiveServicePrice(service.id, customerId)
        unitPrice = effective?.price ?? service.base_price ?? null
      }

      const { data, error } = await supabase.rpc('sync_addon_station_line', {
        p_customer_id: customerId,
        p_unit_price: unitPrice,
        p_technician_id: technicianId ?? null,
        p_technician_name: technicianName ?? null
      })
      if (error) {
        console.warn('[AddonStationBilling] sync_addon_station_line fel:', error)
        return null
      }
      return data as { found: boolean; count?: number; row_id?: string | null; open_count?: number; already_billed?: boolean }
    } catch (err) {
      console.warn('[AddonStationBilling] Bakgrundssynk av tilläggsrad misslyckades:', err)
      return null
    }
  }

  /**
   * Vikarie-skydd: tekniker-RLS kräver att teknikern är tilldelad ärendet för
   * att kunna LÄSA tillbaka contract_billing_items (technician_owns_case).
   * Sätter teknikern som sekundär/tertiär om hen inte redan är tilldelad.
   */
  static async ensureTechnicianOnCase(
    caseId: string,
    technicianId: string,
    technicianName?: string | null
  ): Promise<void> {
    const { data: caseRow, error } = await supabase
      .from('cases')
      .select('id, primary_technician_id, secondary_technician_id, tertiary_technician_id')
      .eq('id', caseId)
      .maybeSingle()

    if (error || !caseRow) return

    const assigned = [
      caseRow.primary_technician_id,
      caseRow.secondary_technician_id,
      caseRow.tertiary_technician_id
    ].filter(Boolean)

    if (assigned.includes(technicianId)) return

    const update: Record<string, unknown> = {}
    if (!caseRow.secondary_technician_id) {
      update.secondary_technician_id = technicianId
      if (technicianName) update.secondary_technician_name = technicianName
    } else if (!caseRow.tertiary_technician_id) {
      update.tertiary_technician_id = technicianId
      if (technicianName) update.tertiary_technician_name = technicianName
    } else {
      return // Alla platser upptagna — läs-tillbakafallet fångas av felhanteringen
    }

    // OBS: cases-RLS (cases_update_scoped) kräver att teknikern redan är
    // tilldelad för att få uppdatera — en otilldelad vikarie får tyst
    // 0-radersvar här. Då felar fakturagenereringen senare med tydlig toast
    // (raderna ligger kvar ofakturerade, inget tyst intäktstapp). Riktig
    // lösning kräver SECURITY DEFINER-RPC — se docs/tillaggsstationer-plan.md.
    const { data: updatedRows, error: updError } = await supabase
      .from('cases')
      .update(update)
      .eq('id', caseId)
      .select('id')
    if (updError || !updatedRows || updatedRows.length === 0) {
      console.warn('[AddonStationBilling] Kunde inte tilldela tekniker på ärendet (RLS eller fel):', updError)
    }
  }

  /**
   * Delad avslutskedja för avtalsärendens fakturering utanför EditContractCaseModal:
   * besökssnapshot → ad-hoc-fakturarader → faktura. Används av kontrollrundeavslut
   * (StationInspectionModule) och etableringsavslut (TechnicianEquipment).
   *
   * - Skapar INGEN provision (beslut: provision kryssas alltid i manuellt).
   * - Hoppar över fakturagenerering när fakturerbar total är 0 (beslut:
   *   0-rader är synligt underlag, inte faktura).
   * - Anroparen ansvarar för att status/completed_date redan är satta och för
   *   att köra denna i try/catch — fel här får aldrig blockera avslutet.
   */
  static async completeContractCaseBilling(params: {
    caseId: string
    customerId: string
    technicianId?: string | null
    technicianName?: string | null
    workPerformed?: string | null
  }): Promise<CompleteBillingResult> {
    const { caseId, customerId, technicianId, technicianName, workPerformed } = params

    // Vikarie-skydd före allt annat (påverkar RLS-läsbarhet i kedjan)
    if (technicianId) {
      await this.ensureTechnicianOnCase(caseId, technicianId, technicianName)
    }

    // Finns något att fakturera? Rader med total 0 räknas som underlag, inte faktura.
    const pendingItems = await CaseBillingService.getCaseBillingItems(caseId, 'contract')
    const serviceItems = pendingItems.filter(i => i.item_type === 'service')
    const billableTotal = serviceItems.reduce((sum, i) => sum + (i.total_price || 0), 0)

    if (serviceItems.length === 0 || billableTotal <= 0) {
      return { itemsCreated: 0, totalAmount: 0, skippedZeroTotal: billableTotal <= 0 && serviceItems.length > 0 }
    }

    // Besökssnapshot måste finnas INNAN fakturering (stämplar visit_id på raderna).
    // RPC:n är idempotent (ett slutbesök per ärende).
    const visit = await VisitService.createVisitSnapshot({
      caseId,
      caseType: 'contract',
      source: 'completion',
      isFinal: true,
      customerId,
      visitDate: new Date().toISOString(),
      technicianId: technicianId ?? null,
      technicianName: technicianName ?? undefined,
      technicians: technicianId || technicianName
        ? [{ id: technicianId ?? null, name: technicianName || '', role: 'primary' as const }]
        : undefined,
      workPerformed: workPerformed ?? undefined
    })
    if (!visit) {
      console.warn('[AddonStationBilling] Besökssnapshot kunde inte skapas — fakturering fortsätter utan besökskoppling')
    }

    const result = await ContractBillingService.createAdHocItemsFromCase(
      caseId,
      customerId,
      new Date()
    )

    return {
      itemsCreated: result.created,
      totalAmount: result.totalAmount,
      invoiceError: result.invoiceError ?? null,
      skippedZeroTotal: false
    }
  }
}
