// src/services/contractAdditionService.ts
// Avtalstillägg: en tjänsterad i ett avtalskundärende markeras som
// tillägg till avtalet. Raden faktureras som pro rata (merförsäljning)
// fram till nästa fakturaperiod, och årspremien höjs från den perioden.
//
// Avtalskartan som motor (fas 2): tillägget skrivs på AVTALET, inte
// kundraden. RPC:n apply_contract_addition (SECURITY DEFINER) höjer
// contracts.annual_value, lägger ett 'addition'-steg i premietrappan och
// en § 6-rad (billing_model per_year) på avtalsinnehållet, så utrustningen
// följer med nästa årspremiefaktura. Avtalet löses via ärendets
// cases.contract_id, annars via resolvern (eget avtal, omfattning,
// täcker-alla). Kunder utan avtalsrad (synth) faller tillbaka på kundraden.
//
// Periodberäkningen återanvänder computePlannedInvoicesPure från
// avtalsgeneratorn, ingen egen kopia av periodmatematiken.

import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { computePlannedInvoicesPure, ContractInvoiceGenerator, type CustomerForPlanning } from './contractInvoiceGenerator'
import { resolveContractForCustomer } from './contractResolver'

const LOCKED_INVOICE_STATUSES = ['booked', 'sent', 'paid']

export interface AdditionQuote {
  /** Kunden vars premie höjs (huvudkontoret för multisite-enheter) */
  billingCustomerId: string
  billingCustomerName: string
  /** Avtalet tillägget skrivs på (null = kund utan avtalsrad) */
  contractId: string | null
  contractLabel: string | null
  /** Datum då nya premien börjar gälla (nästa olåsta periodstart) */
  effectiveFrom: string
  /** Pro rata-belopp (exkl moms) som faktureras nu */
  proratedAmount: number
  /** Antal dagar som proratan täcker */
  daysCovered: number
  currentAnnualValue: number
  newAnnualValue: number
}

export interface AdditionQuoteError {
  reason: string
}

type PlanningRow = CustomerForPlanning & { id: string; company_name: string; label?: string | null }

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export class ContractAdditionService {
  /**
   * Avtalet som bär tillägget: ärendets contract_id, annars resolvern på
   * ärendets kundrad. Returnerar avtalsraden med fakturerings- och avtalsfält.
   */
  private static async resolveContract(customerId: string, caseId?: string | null) {
    let contractId: string | null = null
    if (caseId) {
      const { data: caseRow } = await supabase.from('cases').select('contract_id').eq('id', caseId).maybeSingle()
      contractId = (caseRow as { contract_id?: string | null } | null)?.contract_id ?? null
    }
    if (!contractId) contractId = await resolveContractForCustomer(customerId)
    if (!contractId) return null
    const { data } = await supabase
      .from('contracts')
      .select(
        'id, customer_id, label, contract_type, annual_value, contract_start_date, contract_end_date, terminated_at, billing_frequency, billing_anchor_month, billing_active, notice_period_months'
      )
      .eq('id', contractId)
      .maybeSingle()
    return (data as (PlanningRow & { customer_id: string; contract_type: string | null }) | null) ?? null
  }

  /**
   * Beräkna pro rata och ny premie för ett tänkt tillägg.
   * Returnerar fel-orsak (inte exception) när tillägg inte är möjligt,
   * så att UI:t kan förklara varför.
   */
  static async computeQuote(customerId: string, annualAmount: number, caseId?: string | null): Promise<AdditionQuote | AdditionQuoteError> {
    if (!annualAmount || annualAmount <= 0) {
      return { reason: 'Ange ett årsbelopp större än 0.' }
    }

    // Kundraden (huvudkontoret för enheter) bär fakturamottagaren
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, company_name, parent_customer_id, annual_value, contract_start_date, contract_end_date, terminated_at, billing_frequency, billing_anchor_month, billing_active, notice_period_months')
      .eq('id', customerId)
      .single()
    if (error || !customer) return { reason: 'Kunden kunde inte hämtas.' }

    let billingCustomer = customer
    if (customer.parent_customer_id) {
      const { data: parent } = await supabase
        .from('customers')
        .select('id, company_name, parent_customer_id, annual_value, contract_start_date, contract_end_date, terminated_at, billing_frequency, billing_anchor_month, billing_active, notice_period_months')
        .eq('id', customer.parent_customer_id)
        .single()
      if (parent) billingCustomer = parent
    }

    // Avtalet är källan när det finns; annars kundraden (synth)
    const contract = await this.resolveContract(customerId, caseId)
    const billing: PlanningRow = contract
      ? { ...contract, id: contract.id, company_name: billingCustomer.company_name, label: contract.label ?? contract.contract_type }
      : (billingCustomer as PlanningRow)
    const billingCustomerId = contract?.customer_id ?? billingCustomer.id

    if (billing.terminated_at) {
      return { reason: 'Avtalet är uppsagt - avtalstillägg kan inte läggas. Kontakta kontoret.' }
    }
    if (!billing.billing_frequency || billing.billing_frequency === 'on_demand') {
      return { reason: 'Avtalet saknar faktureringsfrekvens - sätt den i § 7 på avtalskartan eller kontakta kontoret.' }
    }
    if (!billing.contract_start_date || !billing.contract_end_date) {
      return { reason: 'Avtalets datum är inte kompletta - sätt löptiden i § 9 på avtalskartan eller kontakta kontoret.' }
    }

    const currentAnnual = Number(billing.annual_value ?? 0)
    if (currentAnnual <= 0) {
      return { reason: 'Avtalet saknar årspremie - sätt den i § 7 på avtalskartan eller kontakta kontoret.' }
    }

    // Planera perioderna med generatorns rena matematik
    const plan = computePlannedInvoicesPure(billing)
    const today = new Date()
    const todayIso = toLocalIsoDate(today)
    let futureStarts = plan.map((p) => p.periodStart).filter((start) => start > todayIso)

    // Inga kommande perioder inom avtalstiden (t.ex. ettårsavtal i sin
    // sista period): avtal som inte sagts upp löper vidare och
    // fortsättningsperioderna genereras av cron-jobbet. Syntetisera nästa
    // periodstart genom att stega frekvensen från sista planerade.
    if (futureStarts.length === 0 && plan.length > 0) {
      const stepMonths =
        billing.billing_frequency === 'monthly' ? 1 : billing.billing_frequency === 'quarterly' ? 3 : billing.billing_frequency === 'semi_annual' ? 6 : 12
      const lastStart = new Date(plan[plan.length - 1].periodStart)
      const next = new Date(lastStart.getFullYear(), lastStart.getMonth(), 1)
      for (let i = 0; i < 24 && toLocalIsoDate(next) <= todayIso; i++) {
        next.setMonth(next.getMonth() + stepMonths)
      }
      if (toLocalIsoDate(next) > todayIso) futureStarts = [toLocalIsoDate(next)]
    }
    if (futureStarts.length === 0) {
      return { reason: 'Avtalet har ingen kommande fakturaperiod - kontakta kontoret så läggs tillägget manuellt.' }
    }

    // Hoppa över perioder vars faktura redan är låst (bokförd/skickad/betald)
    let lockedQuery = supabase
      .from('invoices')
      .select('billing_period_start')
      .eq('customer_id', billingCustomerId)
      .eq('invoice_type', 'contract')
      .in('status', LOCKED_INVOICE_STATUSES)
      .in('billing_period_start', futureStarts)
    if (contract) lockedQuery = lockedQuery.or(`contract_id.eq.${contract.id},is_consolidated.eq.true`)
    const { data: lockedInvoices } = await lockedQuery
    const lockedStarts = new Set((lockedInvoices || []).map((i) => i.billing_period_start))
    const effectiveFrom = futureStarts.find((start) => !lockedStarts.has(start))
    if (!effectiveFrom) {
      return { reason: 'Alla kommande perioder är redan fakturerade - kontakta kontoret.' }
    }

    const effectiveDate = new Date(effectiveFrom)
    const msPerDay = 86400000
    const daysCovered = Math.max(1, Math.round((effectiveDate.getTime() - today.getTime()) / msPerDay))
    const proratedAmount = Math.round((annualAmount * daysCovered) / 365)

    return {
      billingCustomerId,
      billingCustomerName: billingCustomer.company_name,
      contractId: contract?.id ?? null,
      contractLabel: contract ? (contract.label ?? contract.contract_type ?? null) : null,
      effectiveFrom,
      proratedAmount,
      daysCovered,
      currentAnnualValue: currentAnnual,
      newAnnualValue: currentAnnual + annualAmount,
    }
  }

  /**
   * Appliceras vid ärendeavslut: höjer premien via RPC (idempotent per
   * fakturarad) och räknar om kundens kommande avtalsfakturor.
   * Returnerar antal applicerade tillägg + ny premie för toasts.
   */
  /**
   * Varaktig utrustning (articles.is_durable) som mappats mot tilläggsraden
   * kopieras till avtalet som intern kostnadsrad, så § 5 ser fällan bredvid
   * den höjda premien. Aldrig fatalt: tillägget är redan applicerat.
   */
  private static async copyDurableArticlesToContract(
    serviceRowId: string,
    caseId: string,
    contractId: string | null | undefined,
    billingCustomerId: string | null | undefined
  ): Promise<void> {
    if (!contractId || !billingCustomerId) return
    try {
      const { data: articles } = await supabase
        .from('case_billing_items')
        .select('article_id, article_name, article_code, quantity, unit_price, total_price, vat_rate, article:articles(is_durable)')
        .eq('case_id', caseId)
        .eq('item_type', 'article')
        .eq('mapped_service_id', serviceRowId)
        .neq('status', 'cancelled')
      type Row = {
        article_id: string | null; article_name: string | null; article_code: string | null
        quantity: number | null; unit_price: number | null; total_price: number | null; vat_rate: number | null
        article: { is_durable: boolean | null } | null
      }
      const durable = ((articles ?? []) as unknown as Row[]).filter((a) => a.article?.is_durable === true && a.article_id)
      if (durable.length === 0) return
      const { error } = await supabase.from('case_billing_items').insert(
        durable.map((a) => ({
          case_id: contractId,
          case_type: 'contract',
          customer_id: billingCustomerId,
          item_type: 'article',
          article_id: a.article_id,
          article_code: a.article_code,
          article_name: a.article_name,
          quantity: Number(a.quantity ?? 1),
          unit_price: Number(a.unit_price ?? 0),
          discount_percent: 0,
          discounted_price: Number(a.unit_price ?? 0),
          total_price: Number(a.total_price ?? 0),
          vat_rate: Number(a.vat_rate ?? 25),
          price_source: 'standard',
          status: 'pending',
          requires_approval: false,
          billing_model: 'premium',
          notes: `Varaktig utrustning från avtalstillägg, ärende ${caseId}`,
        }))
      )
      if (error) console.warn('[ContractAdditionService] Kunde inte kopiera utrustning till avtalet:', error.message)
    } catch (err) {
      console.warn('[ContractAdditionService] Kunde inte kopiera utrustning till avtalet:', err)
    }
  }

  static async applyAdditionsForCase(caseId: string, createdByName: string | null): Promise<{ applied: number; newAnnualValue: number | null; errors: string[] }> {
    const errors: string[] = []
    let applied = 0
    let newAnnualValue: number | null = null
    let billingCustomerId: string | null = null

    const { data: rows, error } = await supabase
      .from('case_billing_items')
      .select('id, case_id, service_id, service_code, service_name, quantity, unit_price, total_price, vat_rate, contract_addition_annual')
      .eq('case_id', caseId)
      .not('contract_addition_annual', 'is', null)
    if (error) return { applied: 0, newAnnualValue: null, errors: [error.message] }
    if (!rows || rows.length === 0) return { applied: 0, newAnnualValue: null, errors: [] }

    // Tillägget beskrivs med PRODUKTEN som adderats till avtalet (artikelrader
    // mappade mot tjänsteraden), inte tjänsten teknikern utförde.
    const { data: articleRows } = await supabase
      .from('case_billing_items')
      .select('article_name, quantity, mapped_service_id')
      .eq('case_id', caseId)
      .not('mapped_service_id', 'is', null)
    const productsByServiceRow = new Map<string, string[]>()
    for (const a of articleRows || []) {
      if (!a.article_name || !a.mapped_service_id) continue
      const label = (a.quantity ?? 1) > 1 ? `${a.quantity}× ${a.article_name}` : a.article_name
      const list = productsByServiceRow.get(a.mapped_service_id) || []
      list.push(label)
      productsByServiceRow.set(a.mapped_service_id, list)
    }

    const { data: caseRow, error: caseError } = await supabase.from('cases').select('id, customer_id').eq('id', caseId).single()
    if (caseError || !caseRow?.customer_id) {
      return { applied: 0, newAnnualValue: null, errors: ['Ärendets kund kunde inte hämtas - avtalstillägget applicerades inte.'] }
    }

    for (const row of rows) {
      const annual = Number(row.contract_addition_annual)
      const quote = await this.computeQuote(caseRow.customer_id, annual, caseId)
      if ('reason' in quote) {
        errors.push(`${row.service_name}: ${quote.reason}`)
        continue
      }
      billingCustomerId = quote.billingCustomerId

      const products = productsByServiceRow.get(row.id)
      const additionLabel = products && products.length > 0 ? products.join(', ') : row.service_name

      const { data, error: rpcError } = await supabase.rpc('apply_contract_addition', {
        p_case_billing_item_id: row.id,
        p_customer_id: quote.billingCustomerId,
        p_case_id: caseId,
        p_description: `Avtalstillägg: ${additionLabel}`,
        p_annual_amount: annual,
        p_prorated_amount: Number(row.total_price ?? row.unit_price ?? 0),
        p_effective_from: quote.effectiveFrom,
        p_created_by_name: createdByName,
        p_contract_id: quote.contractId,
        p_service_id: row.service_id ?? null,
        p_service_code: row.service_code ?? null,
        p_service_name: additionLabel ?? row.service_name ?? null,
        p_quantity: Number(row.quantity ?? 1),
        p_vat_rate: Number(row.vat_rate ?? 25),
      })
      if (rpcError) {
        errors.push(`${row.service_name}: ${rpcError.message}`)
        continue
      }
      const result = data as { already_applied: boolean; new_annual_value: number }
      if (!result.already_applied) {
        applied++
        // Utrustningen bokförs på ärendet men intäkten höjs på avtalet, så
        // avtalets löpande marginal skulle stiga utan att fällan syns där.
        // Varaktiga artiklar kopieras därför till avtalets § 6 som intern kostnad.
        await this.copyDurableArticlesToContract(row.id, caseId, quote.contractId, quote.billingCustomerId)
      }
      newAnnualValue = Number(result.new_annual_value)
    }

    // Räkna om kommande avtalsfakturor enligt kundens faktureringsläge (låsta rörs aldrig)
    if (applied > 0 && billingCustomerId) {
      try {
        await ContractInvoiceGenerator.regenerateForCustomer(billingCustomerId)
      } catch (regenError) {
        console.warn('[ContractAdditionService] Omplanering misslyckades:', regenError)
        errors.push('Premien är höjd men fakturaplanen kunde inte räknas om direkt - den uppdateras när kontoret öppnar kundens fakturering.')
      }
    }

    // Toasts här så att alla avslutsvägar får samma återkoppling
    if (applied > 0 && newAnnualValue !== null) {
      toast.success(`Avtalstillägg applicerat - ny årspremie ${newAnnualValue.toLocaleString('sv-SE')} kr/år`, { duration: 8000 })
    }
    for (const message of errors) {
      toast.error(`Avtalstillägg: ${message}`, { duration: 10000 })
    }

    return { applied, newAnnualValue, errors }
  }
}
