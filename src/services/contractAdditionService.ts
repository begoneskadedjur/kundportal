// src/services/contractAdditionService.ts
// Avtalstillägg: en tjänsterad i ett avtalskundärende markeras som
// tillägg till avtalet. Raden faktureras som pro rata (merförsäljning)
// fram till nästa fakturaperiod, och årspremien höjs från den perioden.
//
// Periodberäkningen återanvänder computePlannedInvoicesPure från
// avtalsgeneratorn - ingen egen kopia av periodmatematiken.
// Premiehöjningen går via RPC:n apply_contract_addition (SECURITY
// DEFINER) eftersom tekniker inte får uppdatera customers direkt.

import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  computePlannedInvoicesPure,
  ContractInvoiceGenerator,
  type CustomerForPlanning,
} from './contractInvoiceGenerator'

const LOCKED_INVOICE_STATUSES = ['booked', 'sent', 'paid']

export interface AdditionQuote {
  /** Kunden vars premie höjs (huvudkontoret för multisite-enheter) */
  billingCustomerId: string
  billingCustomerName: string
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

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export class ContractAdditionService {
  /**
   * Beräkna pro rata och ny premie för ett tänkt tillägg.
   * Returnerar fel-orsak (inte exception) när tillägg inte är möjligt,
   * så att UI:t kan förklara varför.
   */
  static async computeQuote(
    customerId: string,
    annualAmount: number
  ): Promise<AdditionQuote | AdditionQuoteError> {
    if (!annualAmount || annualAmount <= 0) {
      return { reason: 'Ange ett årsbelopp större än 0.' }
    }

    // Multisite: premien ligger på huvudkontoret
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, company_name, parent_customer_id, annual_value, contract_start_date, contract_end_date, terminated_at, billing_frequency, billing_anchor_month, billing_active, notice_period_months')
      .eq('id', customerId)
      .single()
    if (error || !customer) return { reason: 'Kunden kunde inte hämtas.' }

    let billing = customer
    if (customer.parent_customer_id) {
      const { data: parent } = await supabase
        .from('customers')
        .select('id, company_name, parent_customer_id, annual_value, contract_start_date, contract_end_date, terminated_at, billing_frequency, billing_anchor_month, billing_active, notice_period_months')
        .eq('id', customer.parent_customer_id)
        .single()
      if (parent) billing = parent
    }

    if (billing.terminated_at) {
      return { reason: 'Avtalet är uppsagt - avtalstillägg kan inte läggas. Kontakta kontoret.' }
    }
    if (!billing.billing_frequency || billing.billing_frequency === 'on_demand') {
      return { reason: 'Kunden saknar faktureringsfrekvens - kontakta kontoret så läggs tillägget manuellt.' }
    }
    if (!billing.contract_start_date || !billing.contract_end_date) {
      return { reason: 'Kundens avtalsdatum är inte kompletta - kontakta kontoret.' }
    }

    const currentAnnual = Number(billing.annual_value ?? 0)
    if (currentAnnual <= 0) {
      return { reason: 'Kunden saknar årspremie - kontakta kontoret så läggs tillägget manuellt.' }
    }

    // Planera perioderna med generatorns rena matematik
    const plan = computePlannedInvoicesPure(billing as CustomerForPlanning)
    const today = new Date()
    const todayIso = toLocalIsoDate(today)
    let futureStarts = plan
      .map(p => p.periodStart)
      .filter(start => start > todayIso)

    // Inga kommande perioder inom avtalstiden (t.ex. ettårsavtal i sin
    // sista period): avtal som inte sagts upp löper vidare, och
    // fortsättningsperioderna genereras av cron-jobbet. Tillägget gäller
    // då från nästa fortsättningsperiod - syntetisera den genom att
    // stega frekvensen från sista planerade periodstarten.
    if (futureStarts.length === 0 && plan.length > 0) {
      const stepMonths = billing.billing_frequency === 'monthly' ? 1
        : billing.billing_frequency === 'quarterly' ? 3
        : billing.billing_frequency === 'semi_annual' ? 6
        : 12
      const lastStart = new Date(plan[plan.length - 1].periodStart)
      const next = new Date(lastStart.getFullYear(), lastStart.getMonth(), 1)
      for (let i = 0; i < 24 && toLocalIsoDate(next) <= todayIso; i++) {
        next.setMonth(next.getMonth() + stepMonths)
      }
      if (toLocalIsoDate(next) > todayIso) {
        futureStarts = [toLocalIsoDate(next)]
      }
    }
    if (futureStarts.length === 0) {
      return { reason: 'Avtalet har ingen kommande fakturaperiod - kontakta kontoret så läggs tillägget manuellt.' }
    }

    // Hoppa över perioder vars faktura redan är låst (bokförd/skickad/betald)
    const { data: lockedInvoices } = await supabase
      .from('invoices')
      .select('billing_period_start')
      .eq('customer_id', billing.id)
      .eq('invoice_type', 'contract')
      .in('status', LOCKED_INVOICE_STATUSES)
      .in('billing_period_start', futureStarts)
    const lockedStarts = new Set((lockedInvoices || []).map(i => i.billing_period_start))
    const effectiveFrom = futureStarts.find(start => !lockedStarts.has(start))
    if (!effectiveFrom) {
      return { reason: 'Alla kommande perioder är redan fakturerade - kontakta kontoret.' }
    }

    const effectiveDate = new Date(effectiveFrom)
    const msPerDay = 86400000
    const daysCovered = Math.max(1, Math.round((effectiveDate.getTime() - today.getTime()) / msPerDay))
    const proratedAmount = Math.round((annualAmount * daysCovered) / 365)

    return {
      billingCustomerId: billing.id,
      billingCustomerName: billing.company_name,
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
  static async applyAdditionsForCase(
    caseId: string,
    createdByName: string | null
  ): Promise<{ applied: number; newAnnualValue: number | null; errors: string[] }> {
    const errors: string[] = []
    let applied = 0
    let newAnnualValue: number | null = null
    let billingCustomerId: string | null = null

    const { data: rows, error } = await supabase
      .from('case_billing_items')
      .select('id, case_id, service_name, quantity, unit_price, total_price, contract_addition_annual')
      .eq('case_id', caseId)
      .not('contract_addition_annual', 'is', null)
    if (error) return { applied: 0, newAnnualValue: null, errors: [error.message] }
    if (!rows || rows.length === 0) return { applied: 0, newAnnualValue: null, errors: [] }

    // Hämta ärendets kund
    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, customer_id')
      .eq('id', caseId)
      .single()
    if (caseError || !caseRow?.customer_id) {
      return { applied: 0, newAnnualValue: null, errors: ['Ärendets kund kunde inte hämtas - avtalstillägget applicerades inte.'] }
    }

    for (const row of rows) {
      const annual = Number(row.contract_addition_annual)
      const quote = await this.computeQuote(caseRow.customer_id, annual)
      if ('reason' in quote) {
        errors.push(`${row.service_name}: ${quote.reason}`)
        continue
      }
      billingCustomerId = quote.billingCustomerId

      const { data, error: rpcError } = await supabase.rpc('apply_contract_addition', {
        p_case_billing_item_id: row.id,
        p_customer_id: quote.billingCustomerId,
        p_case_id: caseId,
        p_description: `Avtalstillägg: ${row.service_name}`,
        p_annual_amount: annual,
        p_prorated_amount: Number(row.total_price ?? row.unit_price ?? 0),
        p_effective_from: quote.effectiveFrom,
        p_created_by_name: createdByName,
      })
      if (rpcError) {
        errors.push(`${row.service_name}: ${rpcError.message}`)
        continue
      }
      const result = data as { already_applied: boolean; new_annual_value: number }
      if (!result.already_applied) applied++
      newAnnualValue = Number(result.new_annual_value)
    }

    // Räkna om kommande avtalsfakturor till nya premien (låsta rörs aldrig)
    if (applied > 0 && billingCustomerId) {
      try {
        await ContractInvoiceGenerator.regenerateForCustomer(billingCustomerId)
      } catch (regenError) {
        console.warn('[ContractAdditionService] Omplanering misslyckades:', regenError)
        errors.push('Premien är höjd men fakturaplanen kunde inte räknas om direkt - den uppdateras när kontoret öppnar kundens fakturering.')
      }
    }

    // Toasts här så att alla tre avslutsvägarna (EditContractCaseModal,
    // RevisitContractModal, RonderingCaseModal) får samma återkoppling
    if (applied > 0 && newAnnualValue !== null) {
      toast.success(
        `Avtalstillägg applicerat - ny årspremie ${newAnnualValue.toLocaleString('sv-SE')} kr/år`,
        { duration: 8000 }
      )
    }
    for (const message of errors) {
      toast.error(`Avtalstillägg: ${message}`, { duration: 10000 })
    }

    return { applied, newAnnualValue, errors }
  }
}
