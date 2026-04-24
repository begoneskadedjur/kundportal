// src/services/contractInvoiceGenerator.ts
// Genererar fakturaplan för avtalskunder: beräknar vilka invoices som ska finnas
// baserat på avtalstid, frekvens och årspremie, och applicerar diff mot befintliga.
// Event-driven: anropas från BillingSettingsModal, uppsägningsflöde och cron.

import { supabase } from '../lib/supabase'
import { ImportedCustomerContractService } from './importedCustomerContractService'

interface ContractServiceItem {
  case_billing_item_id: string
  article_id: string | null
  display_code: string | null   // service_code || article_code (samma fallback som invoiceService)
  display_name: string           // service_name || article_name
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  rot_rut_type: string | null
  fastighetsbeteckning: string | null
}

export type BillingFrequency = 'monthly' | 'quarterly' | 'annual' | 'on_demand'

export interface PlannedInvoice {
  periodStart: string  // ISO date (lokal)
  periodEnd: string
  amount: number
  vatAmount: number
  totalAmount: number
  dueDate: string
  isHistorical: boolean  // true om hela perioden redan passerat (antas betald)
  sequenceNumber: number     // 1-indexerad position i avtalets hela plan
  totalSequenceCount: number // totalt antal planerade fakturor
}

// Publika actions visas i preview, _historical-actions filtreras bort där
// men räknas i summary.
export type BillingPlanAction =
  | 'keep'
  | 'create'
  | 'update'
  | 'delete'
  | 'locked'
  | 'create-historical'
  | 'backfill-historical-paid'

export interface BillingPlanEntry {
  action: BillingPlanAction
  planned?: PlannedInvoice
  existingId?: string
  existingStatus?: string
  existingAmount?: number
  reason?: string
}

export interface BillingPlan {
  customerId: string
  entries: BillingPlanEntry[]
  summary: {
    create: number
    update: number
    delete: number
    locked: number
    keep: number
    historical: number  // create-historical + backfill-historical-paid
  }
}

export interface ApplyResult {
  createdIds: string[]
  updatedIds: string[]
  deletedIds: string[]
  historicalIds: string[]
  skippedLocked: number
}

/**
 * Minimalt subset av customer-fält som krävs för att räkna fakturaplan.
 * Används av både ContractInvoiceGenerator och BillingSettingsModal
 * (UI:t har inga kund-id-fält när man redigerar nya inställningar).
 */
export interface CustomerForPlanning {
  annual_value: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  billing_frequency: BillingFrequency | null
  billing_anchor_month: number | null
  billing_active: boolean | null
  notice_period_months: number | null
}

type CustomerRow = CustomerForPlanning & {
  id: string
  company_name: string
  organization_number: string | null
  billing_email: string | null
  billing_address: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  monthly_value: number | null
}

const LOCKED_STATUSES = new Set(['booked', 'sent', 'paid'])
const EDITABLE_STATUSES = new Set(['draft', 'pending_approval', 'ready'])

// TZ-säker YYYY-MM-DD (svensk lokal tid, inte UTC).
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parse YYYY-MM-DD som lokal midnatt (undviker UTC-hopp).
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function todayLocal(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/**
 * Kapningsdatum vid uppsägning:
 * - Inom bindningstid (terminated_at <= contract_end_date): avtalet löper till contract_end_date (inga framtida rader raderas).
 * - Fortlöpande (terminated_at > contract_end_date): terminated_at + notice_period_months.
 * Returnerar null om kunden ej är uppsagd.
 */
function computeTerminationCutoff(customer: CustomerForPlanning): Date | null {
  if (!customer.terminated_at) return null
  const notice = customer.notice_period_months ?? 2
  const termDate = new Date(customer.terminated_at)
  const contractEnd = customer.contract_end_date ? new Date(customer.contract_end_date) : null

  if (contractEnd && termDate <= contractEnd) return contractEnd

  const cutoff = new Date(termDate)
  cutoff.setMonth(cutoff.getMonth() + notice)
  return cutoff
}

function amountPerPeriodPure(annual: number, freq: BillingFrequency): number {
  if (freq === 'monthly') return Math.round(annual / 12)
  if (freq === 'quarterly') return Math.round(annual / 4)
  if (freq === 'annual') return Math.round(annual)
  return 0
}

function iterPeriodsPure(
  start: Date,
  end: Date,
  freq: BillingFrequency,
  anchorMonth: number | null,
): Array<{ periodStart: Date; periodEnd: Date }> {
  const out: Array<{ periodStart: Date; periodEnd: Date }> = []

  if (freq === 'monthly') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const periodEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
      out.push({ periodStart: new Date(cur), periodEnd })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else if (freq === 'quarterly') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const periodEnd = new Date(cur.getFullYear(), cur.getMonth() + 3, 0)
      out.push({ periodStart: new Date(cur), periodEnd })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1)
    }
  } else if (freq === 'annual') {
    const anchor = anchorMonth && anchorMonth >= 1 && anchorMonth <= 12
      ? anchorMonth - 1
      : start.getMonth()
    const startYear = start.getFullYear()
    const startOfStartMonth = new Date(startYear, start.getMonth(), 1)
    let firstStart = new Date(startYear, anchor, 1)
    if (firstStart < startOfStartMonth) {
      firstStart = new Date(startYear + 1, anchor, 1)
    }
    let cur = firstStart
    while (cur <= end) {
      const periodEnd = new Date(cur.getFullYear() + 1, cur.getMonth(), 0)
      // För annual: hela fakturaperioden måste rymmas inom avtalet (ingen partiell).
      const elevenMonthsForward = new Date(cur.getFullYear(), cur.getMonth() + 11, 1)
      if (elevenMonthsForward > end) break
      out.push({ periodStart: new Date(cur), periodEnd })
      cur = new Date(cur.getFullYear() + 1, cur.getMonth(), 1)
    }
  }

  return out
}

/**
 * Ren funktion: räkna ut planerade fakturor från kundens avtalsdata.
 * Används av både ContractInvoiceGenerator (för DB-apply) och BillingSettingsModal
 * (för preview/fakturaschemat i UI). Inga DB-anrop.
 */
export function computePlannedInvoicesPure(customer: CustomerForPlanning): PlannedInvoice[] {
  const freq = customer.billing_frequency
  const annual = Number(customer.annual_value ?? 0)
  const start = customer.contract_start_date ? new Date(customer.contract_start_date) : null
  const end = customer.contract_end_date ? new Date(customer.contract_end_date) : null

  if (!freq || freq === 'on_demand') return []
  if (annual <= 0) return []
  if (!start || !end) return []
  if (customer.billing_active === false) return []

  let effectiveEnd = end
  const cutoff = computeTerminationCutoff(customer)
  if (cutoff && cutoff < effectiveEnd) {
    effectiveEnd = cutoff
  }

  const perPeriod = amountPerPeriodPure(annual, freq)
  const intervals = iterPeriodsPure(start, effectiveEnd, freq, customer.billing_anchor_month)
  const today = todayLocal()

  // Första dag i innevarande månad — en period räknas som "redan fakturerad"
  // (isHistorical) om periodStart ligger i en månad före denna.
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  return intervals.map(({ periodStart, periodEnd }, idx) => {
    const vatAmount = Math.round(perPeriod * 0.25)
    const isHistorical = periodStart < startOfCurrentMonth
    const due = isHistorical
      ? new Date(periodStart.getTime())
      : new Date(today.getTime())
    due.setDate(due.getDate() + 30)
    return {
      periodStart: toLocalIsoDate(periodStart),
      periodEnd: toLocalIsoDate(periodEnd),
      amount: perPeriod,
      vatAmount,
      totalAmount: perPeriod + vatAmount,
      dueDate: toLocalIsoDate(due),
      isHistorical,
      sequenceNumber: idx + 1,
      totalSequenceCount: intervals.length,
    }
  })
}

export class ContractInvoiceGenerator {
  /**
   * Skapa fakturaplan för en kund. Returnerar diff mot befintliga invoices.
   */
  static async planForCustomer(customerId: string): Promise<BillingPlan> {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (error) throw new Error(`Kunde inte hämta kund: ${error.message}`)
    if (!customer) throw new Error('Kund hittades inte')

    const planned = this.computePlannedInvoices(customer as CustomerRow)

    const { data: existing, error: exErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, billing_period_start, billing_period_end, total_amount, subtotal, is_historical, invoice_items(article_name)')
      .eq('customer_id', customerId)
      .eq('invoice_type', 'contract')

    if (exErr) throw new Error(`Kunde inte hämta befintliga fakturor: ${exErr.message}`)

    // Anrik med has_generic_items-flag för att kunna trigga update av
    // gamla fakturor som har fallback-artikeln "Avtalsfakturering YYYY-MM".
    const existingWithFlag = (existing ?? []).map(e => ({
      ...e,
      has_generic_items: (e.invoice_items ?? []).every((it: any) =>
        typeof it.article_name === 'string' && it.article_name.startsWith('Avtalsfakturering ')
      ),
    }))

    const entries = this.buildDiff(planned, existingWithFlag)
    const summary = entries.reduce(
      (acc, e) => {
        if (e.action === 'create-historical' || e.action === 'backfill-historical-paid') {
          acc.historical += 1
        } else {
          ;(acc as any)[e.action] = ((acc as any)[e.action] ?? 0) + 1
        }
        return acc
      },
      { keep: 0, create: 0, update: 0, delete: 0, locked: 0, historical: 0 } as BillingPlan['summary']
    )

    return { customerId, entries, summary }
  }

  /**
   * Delegerar till module-level pure function. Behålls för bakåtkompatibilitet
   * med existerande anropare i klassen.
   */
  private static computePlannedInvoices(customer: CustomerRow): PlannedInvoice[] {
    return computePlannedInvoicesPure(customer)
  }

  /**
   * Bygg diff: planerade vs befintliga. Nyckel = billing_period_start (YYYY-MM-DD).
   * Historiska perioder får separata actions för att filtreras ut ur preview.
   */
  private static buildDiff(
    planned: PlannedInvoice[],
    existing: Array<{
      id: string
      status: string | null
      billing_period_start: string | null
      billing_period_end: string | null
      total_amount: number
      subtotal: number
      is_historical: boolean | null
      has_generic_items?: boolean
      invoice_number?: string | null
    }>,
  ): BillingPlanEntry[] {
    // Filtrera bort planerade perioder som redan täcks av importerade Fortnox-fakturor
    // (invoice_number LIKE 'F-%', is_historical = true). En importerad faktura med
    // billing_period_start/end täcker alla planerade vars periodStart ligger i intervallet.
    const coveredRanges = existing
      .filter(e =>
        e.is_historical === true
        && !!e.invoice_number
        && e.invoice_number.startsWith('F-')
        && !!e.billing_period_start
        && !!e.billing_period_end
      )
      .map(e => ({ start: e.billing_period_start as string, end: e.billing_period_end as string }))

    const filteredPlanned = coveredRanges.length === 0
      ? planned
      : planned.filter(p => !coveredRanges.some(r => p.periodStart >= r.start && p.periodStart <= r.end))

    const plannedByKey = new Map(filteredPlanned.map(p => [p.periodStart, p]))
    const existingByKey = new Map(
      existing
        .filter(e => e.billing_period_start)
        .map(e => [e.billing_period_start as string, e])
    )

    const entries: BillingPlanEntry[] = []

    for (const p of filteredPlanned) {
      const ex = existingByKey.get(p.periodStart)

      if (!ex) {
        entries.push({
          action: p.isHistorical ? 'create-historical' : 'create',
          planned: p,
        })
        continue
      }

      const status = ex.status ?? 'draft'

      // Historisk period + befintlig rad med fel status → backfill till paid.
      if (p.isHistorical) {
        if (status !== 'paid' || !ex.is_historical) {
          entries.push({
            action: 'backfill-historical-paid',
            planned: p,
            existingId: ex.id,
            existingStatus: status,
            existingAmount: ex.total_amount,
          })
        } else {
          entries.push({
            action: 'keep',
            planned: p,
            existingId: ex.id,
            existingStatus: status,
            existingAmount: ex.total_amount,
          })
        }
        continue
      }

      // Aktuell/framtida period
      if (LOCKED_STATUSES.has(status)) {
        entries.push({
          action: 'locked',
          planned: p,
          existingId: ex.id,
          existingStatus: status,
          existingAmount: ex.total_amount,
          reason: 'Faktura redan bokförd/skickad/betald',
        })
        continue
      }
      const amountMatches = Math.abs(Number(ex.subtotal) - p.amount) < 0.5
      // Trigga update även om belopp matchar men items är gamla generiska fallback-rader.
      const needsItemsRefresh = amountMatches && ex.has_generic_items === true
      entries.push({
        action: amountMatches && !needsItemsRefresh ? 'keep' : 'update',
        planned: p,
        existingId: ex.id,
        existingStatus: status,
        existingAmount: ex.total_amount,
      })
    }

    // Befintliga utan motsvarande plan
    for (const ex of existing) {
      if (!ex.billing_period_start) continue
      if (plannedByKey.has(ex.billing_period_start)) continue
      const status = ex.status ?? 'draft'
      if (LOCKED_STATUSES.has(status)) {
        entries.push({
          action: 'locked',
          existingId: ex.id,
          existingStatus: status,
          existingAmount: ex.total_amount,
          reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald',
        })
      } else if (EDITABLE_STATUSES.has(status)) {
        entries.push({
          action: 'delete',
          existingId: ex.id,
          existingStatus: status,
          existingAmount: ex.total_amount,
        })
      } else {
        entries.push({
          action: 'locked',
          existingId: ex.id,
          existingStatus: status,
          existingAmount: ex.total_amount,
          reason: `Okänd status "${status}" - rör ej`,
        })
      }
    }

    entries.sort((a, b) => {
      const ak = a.planned?.periodStart ?? ''
      const bk = b.planned?.periodStart ?? ''
      return ak.localeCompare(bk)
    })

    return entries
  }

  /**
   * Applicera plan: skapa/uppdatera/radera invoices + invoice_items.
   */
  static async apply(plan: BillingPlan): Promise<ApplyResult> {
    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', plan.customerId)
      .single()
    if (cErr || !customer) throw new Error(`Kunde inte hämta kund: ${cErr?.message}`)

    const result: ApplyResult = {
      createdIds: [], updatedIds: [], deletedIds: [], historicalIds: [], skippedLocked: 0,
    }

    for (const entry of plan.entries) {
      if (entry.action === 'keep') continue
      if (entry.action === 'locked') {
        result.skippedLocked++
        continue
      }
      if (entry.action === 'delete' && entry.existingId) {
        await supabase.from('invoice_items').delete().eq('invoice_id', entry.existingId)
        const { error } = await supabase.from('invoices').delete().eq('id', entry.existingId)
        if (error) throw new Error(`Kunde inte radera faktura: ${error.message}`)
        result.deletedIds.push(entry.existingId)
        continue
      }
      if (entry.action === 'create' && entry.planned) {
        const id = await this.insertContractInvoice(customer as CustomerRow, entry.planned)
        result.createdIds.push(id)
        continue
      }
      if (entry.action === 'create-historical' && entry.planned) {
        const id = await this.insertHistoricalPaidInvoice(customer as CustomerRow, entry.planned)
        result.historicalIds.push(id)
        continue
      }
      if (entry.action === 'backfill-historical-paid' && entry.existingId && entry.planned) {
        await this.backfillHistoricalPaid(entry.existingId, customer as CustomerRow, entry.planned)
        result.historicalIds.push(entry.existingId)
        continue
      }
      if (entry.action === 'update' && entry.existingId && entry.planned) {
        await this.updateContractInvoice(entry.existingId, customer as CustomerRow, entry.planned)
        result.updatedIds.push(entry.existingId)
      }
    }

    return result
  }

  /**
   * Convenience: plan + apply i ett anrop.
   */
  static async regenerateForCustomer(customerId: string): Promise<ApplyResult> {
    const plan = await this.planForCustomer(customerId)
    return this.apply(plan)
  }

  /**
   * När en kund sägs upp: radera framtida icke-låsta fakturor efter cutoff.
   * Bindningstiden respekteras — fakturor inom contract_start→contract_end raderas aldrig.
   */
  static async cancelFutureAfterTermination(customerId: string): Promise<number> {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()
    if (error || !customer) return 0

    const cutoff = computeTerminationCutoff(customer as CustomerRow)
    if (!cutoff) return 0

    const { data: toDelete, error: fErr } = await supabase
      .from('invoices')
      .select('id, status, billing_period_start')
      .eq('customer_id', customerId)
      .eq('invoice_type', 'contract')
      .gt('billing_period_start', toLocalIsoDate(cutoff))

    if (fErr) throw new Error(fErr.message)

    let deleted = 0
    for (const inv of toDelete ?? []) {
      if (LOCKED_STATUSES.has(inv.status ?? '')) continue
      await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
      const { error: dErr } = await supabase.from('invoices').delete().eq('id', inv.id)
      if (!dErr) deleted++
    }
    return deleted
  }

  /**
   * Skapa/uppdatera en adhoc-faktura för contract_billing_items (item_type=ad_hoc).
   */
  static async generateAdhocInvoiceForCase(params: {
    customerId: string
    caseId: string
    completedAt: Date | string
    grouping: 'per_case' | 'monthly_batch'
  }): Promise<string | null> {
    const { customerId, caseId, completedAt, grouping } = params

    const { data: customer, error: cErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()
    if (cErr || !customer) return null

    const completedDate = typeof completedAt === 'string' ? new Date(completedAt) : completedAt
    const y = completedDate.getFullYear()
    const m = completedDate.getMonth()
    const monthStart = toLocalIsoDate(new Date(y, m, 1))
    const monthEnd = toLocalIsoDate(new Date(y, m + 1, 0))

    let q = supabase
      .from('contract_billing_items')
      .select('id, total_price, article_name, article_code, quantity, unit_price, vat_rate, discount_percent, case_id, billing_period_start')
      .eq('customer_id', customerId)
      .eq('item_type', 'ad_hoc')
      .is('invoice_id', null)
      .neq('status', 'cancelled')

    if (grouping === 'per_case') {
      q = q.eq('case_id', caseId)
    } else {
      q = q.gte('billing_period_start', monthStart).lte('billing_period_start', monthEnd)
    }

    const { data: items, error: iErr } = await q
    if (iErr || !items || items.length === 0) return null

    const subtotal = items.reduce((sum, i) => sum + Number(i.total_price), 0)
    const vatAmount = items.reduce((sum, i) => sum + Number(i.total_price) * (Number(i.vat_rate) / 100), 0)
    const total = subtotal + vatAmount

    let existingInvoiceId: string | null = null
    if (grouping === 'monthly_batch') {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('customer_id', customerId)
        .eq('invoice_type', 'adhoc')
        .eq('billing_period_start', monthStart)
        .in('status', ['draft', 'pending_approval', 'ready'])
        .maybeSingle()
      if (existing) existingInvoiceId = existing.id
    }

    let invoiceId: string
    if (existingInvoiceId) {
      invoiceId = existingInvoiceId
      await this.addItemsToAdhocInvoice(invoiceId, items)
      await this.recalculateInvoiceTotals(invoiceId)
    } else {
      const invNum = await this.generateInvoiceNumber()
      const due = parseLocalDate(monthStart)
      due.setDate(due.getDate() + 30)
      const c = customer as CustomerRow
      const { data: inv, error: insErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invNum,
          invoice_type: 'adhoc',
          customer_id: customerId,
          case_id: grouping === 'per_case' ? caseId : null,
          case_type: null,
          customer_name: c.company_name,
          customer_email: c.billing_email ?? c.contact_email,
          customer_phone: c.contact_phone,
          customer_address: c.billing_address ?? c.contact_address,
          organization_number: c.organization_number,
          subtotal: Math.round(subtotal),
          vat_amount: Math.round(vatAmount),
          total_amount: Math.round(total),
          status: 'pending_approval',
          requires_approval: true,
          billing_period_start: monthStart,
          billing_period_end: monthEnd,
          due_date: toLocalIsoDate(due),
        })
        .select('id')
        .single()
      if (insErr || !inv) return null
      invoiceId = inv.id
      await this.addItemsToAdhocInvoice(invoiceId, items)
    }

    const itemIds = items.map(i => i.id)
    await supabase
      .from('contract_billing_items')
      .update({ invoice_id: invoiceId, status: 'invoiced' })
      .in('id', itemIds)

    return invoiceId
  }

  private static async addItemsToAdhocInvoice(
    invoiceId: string,
    items: Array<{
      id: string
      article_name: string | null
      article_code: string | null
      quantity: number
      unit_price: number
      total_price: number
      vat_rate: number
      discount_percent: number | null
    }>,
  ): Promise<void> {
    const rows = items.map(i => ({
      invoice_id: invoiceId,
      contract_billing_item_id: i.id,
      article_name: i.article_name ?? 'Merförsäljning',
      article_code: i.article_code,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price,
      vat_rate: i.vat_rate,
      discount_percent: i.discount_percent ?? 0,
    }))
    await supabase.from('invoice_items').insert(rows)
  }

  private static async recalculateInvoiceTotals(invoiceId: string): Promise<void> {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('total_price, vat_rate')
      .eq('invoice_id', invoiceId)
    if (!items) return
    const subtotal = items.reduce((s, i) => s + Number(i.total_price), 0)
    const vat = items.reduce((s, i) => s + Number(i.total_price) * (Number(i.vat_rate) / 100), 0)
    await supabase
      .from('invoices')
      .update({
        subtotal: Math.round(subtotal),
        vat_amount: Math.round(vat),
        total_amount: Math.round(subtotal + vat),
      })
      .eq('id', invoiceId)
  }

  /**
   * Cron-säkerhetsnät: för fortlöpande avtal där contract_end_date passerat
   * men terminated_at ej satt, regenerera plan så nästa period kommer in.
   */
  static async generateContinuingContracts(): Promise<{ customerId: string; created: number }[]> {
    const today = toLocalIsoDate(todayLocal())
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id')
      .lt('contract_end_date', today)
      .is('terminated_at', null)
      .eq('billing_active', true)

    if (error) throw new Error(error.message)

    const results: { customerId: string; created: number }[] = []
    for (const c of customers ?? []) {
      try {
        const r = await this.regenerateForCustomer(c.id)
        if (r.createdIds.length > 0) {
          results.push({ customerId: c.id, created: r.createdIds.length })
        }
      } catch (err) {
        console.error(`Fel vid regenerering av ${c.id}:`, err)
      }
    }
    return results
  }

  /**
   * Hämta kundens avtalsartiklar (service-items) skalade per period.
   * Returnerar [] om inga service-items finns eller kontrakt saknas.
   *
   * Skalning per period:
   * - annual: items används som de är (totalen per år).
   * - quarterly: items.total_price / 4
   * - monthly: items.total_price / 12
   *
   * Items article_name = service_name (om satt) annars article_name.
   */
  private static async getServiceItemsForCustomer(
    customerId: string,
    freq: BillingFrequency,
  ): Promise<ContractServiceItem[]> {
    try {
      const contractId = await ImportedCustomerContractService.findContract(customerId)
      if (!contractId) return []
      const { services } = await ImportedCustomerContractService.getItems(contractId)
      if (services.length === 0) return []

      const divisor = freq === 'monthly' ? 12 : freq === 'quarterly' ? 4 : 1

      return services.map(s => {
        const anyS = s as any
        const scaledUnit = Math.round(Number(s.unit_price) * 100 / divisor) / 100
        const scaledTotal = Math.round(Number(s.total_price) * 100 / divisor) / 100
        // Samma fallback-kedja som invoiceService.createInvoiceFromCase (rad 187-192)
        const displayName = anyS.service_name ?? s.article_name ?? 'Avtalstjänst'
        const displayCode = anyS.service_code ?? s.article_code ?? null
        return {
          case_billing_item_id: s.id,
          article_id: s.article_id,
          display_code: displayCode,
          display_name: displayName,
          quantity: s.quantity,
          unit_price: scaledUnit,
          total_price: scaledTotal,
          vat_rate: Number(s.vat_rate),
          discount_percent: Number(s.discount_percent ?? 0),
          rot_rut_type: (s as any).rot_rut_type ?? null,
          fastighetsbeteckning: (s as any).fastighetsbeteckning ?? null,
        }
      })
    } catch (err) {
      console.error('Kunde inte hämta avtalsartiklar:', err)
      return []
    }
  }

  /**
   * Bygg invoice_items-rader för en faktura. Om items finns: spegla dem. Annars: generisk.
   */
  private static buildInvoiceItemRows(
    invoiceId: string,
    planned: PlannedInvoice,
    serviceItems: ContractServiceItem[],
  ): Array<Record<string, any>> {
    if (serviceItems.length > 0) {
      // Spegla invoiceService.createInvoiceFromCase (rad 194-208): tjänstrader sätter
      // article_id=null (eftersom vi renderar service-koden på article_code-fältet)
      // men behåller display_code som article_code för Fortnox-matchning.
      return serviceItems.map(it => ({
        invoice_id: invoiceId,
        case_billing_item_id: it.case_billing_item_id,
        article_id: null,
        article_code: it.display_code,
        article_name: it.display_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
        vat_rate: it.vat_rate,
        discount_percent: it.discount_percent,
        rot_rut_type: it.rot_rut_type,
        fastighetsbeteckning: it.fastighetsbeteckning,
      }))
    }
    return [{
      invoice_id: invoiceId,
      article_name: `Avtalsfakturering ${planned.periodStart.slice(0, 7)}`,
      quantity: 1,
      unit_price: planned.amount,
      total_price: planned.amount,
      vat_rate: 25,
      discount_percent: 0,
    }]
  }

  /**
   * Generera faktura-anteckning som skickas till Fortnox.
   * T.ex. "Betalning 2/3 – Period 2026-04-01 t.o.m. 2027-03-31"
   */
  private static buildInvoiceNotes(planned: PlannedInvoice): string {
    return `Betalning ${planned.sequenceNumber}/${planned.totalSequenceCount} – Period ${planned.periodStart} t.o.m. ${planned.periodEnd}`
  }

  // ------- Privata hjälpare för DB-skrivning -------

  private static async insertContractInvoice(
    customer: CustomerRow,
    planned: PlannedInvoice,
  ): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber()
    const serviceItems = await this.getServiceItemsForCustomer(customer.id, customer.billing_frequency!)
    const notes = this.buildInvoiceNotes(planned)
    // Fakturadatum = periodens startdatum (matchar hur fakturan visas i Fortnox)
    const createdAt = parseLocalDate(planned.periodStart).toISOString()

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        customer_id: customer.id,
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: planned.amount,
        vat_amount: planned.vatAmount,
        total_amount: planned.totalAmount,
        status: 'pending_approval',
        requires_approval: false,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: planned.dueDate,
        is_historical: false,
        notes,
        created_at: createdAt,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Kunde inte skapa faktura: ${error.message}`)
    if (!inv) throw new Error('Faktura skapades ej')

    const rows = this.buildInvoiceItemRows(inv.id, planned, serviceItems)
    const { error: itemErr } = await supabase.from('invoice_items').insert(rows)
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)

    return inv.id
  }

  /**
   * Skapar en historisk faktura direkt som status=paid, is_historical=true.
   * Datum sätts som om Fortnox-webhook registrerat den.
   */
  private static async insertHistoricalPaidInvoice(
    customer: CustomerRow,
    planned: PlannedInvoice,
  ): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber()
    const periodStart = parseLocalDate(planned.periodStart)
    const bookedSentAt = periodStart.toISOString()
    const paidAt = parseLocalDate(planned.dueDate).toISOString()
    const serviceItems = await this.getServiceItemsForCustomer(customer.id, customer.billing_frequency!)
    const notes = this.buildInvoiceNotes(planned)

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        customer_id: customer.id,
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: planned.amount,
        vat_amount: planned.vatAmount,
        total_amount: planned.totalAmount,
        status: 'paid',
        requires_approval: false,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: planned.dueDate,
        booked_at: bookedSentAt,
        sent_at: bookedSentAt,
        paid_at: paidAt,
        is_historical: true,
        notes,
        created_at: bookedSentAt,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Kunde inte skapa historisk faktura: ${error.message}`)
    if (!inv) throw new Error('Historisk faktura skapades ej')

    const rows = this.buildInvoiceItemRows(inv.id, planned, serviceItems)
    const { error: itemErr } = await supabase.from('invoice_items').insert(rows)
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)

    return inv.id
  }

  /**
   * Uppdaterar en befintlig faktura till status=paid + is_historical=true.
   * Används för redan-skapade backfill-rader som ligger som pending_approval.
   */
  private static async backfillHistoricalPaid(
    invoiceId: string,
    customer: CustomerRow,
    planned: PlannedInvoice,
  ): Promise<void> {
    const periodStart = parseLocalDate(planned.periodStart)
    const bookedSentAt = periodStart.toISOString()
    const paidAt = parseLocalDate(planned.dueDate).toISOString()
    const serviceItems = await this.getServiceItemsForCustomer(customer.id, customer.billing_frequency!)
    const notes = this.buildInvoiceNotes(planned)

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        requires_approval: false,
        booked_at: bookedSentAt,
        sent_at: bookedSentAt,
        paid_at: paidAt,
        is_historical: true,
        notes,
        created_at: bookedSentAt,
      })
      .eq('id', invoiceId)
    if (error) throw new Error(`Kunde inte backfilla historisk: ${error.message}`)

    // Byt ut items mot rätt artiklar
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const rows = this.buildInvoiceItemRows(invoiceId, planned, serviceItems)
    const { error: itemErr } = await supabase.from('invoice_items').insert(rows)
    if (itemErr) throw new Error(`Kunde inte uppdatera fakturarader: ${itemErr.message}`)
  }

  private static async updateContractInvoice(
    invoiceId: string,
    customer: CustomerRow,
    planned: PlannedInvoice,
  ): Promise<void> {
    const serviceItems = await this.getServiceItemsForCustomer(customer.id, customer.billing_frequency!)
    const notes = this.buildInvoiceNotes(planned)

    const { error } = await supabase
      .from('invoices')
      .update({
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: planned.amount,
        vat_amount: planned.vatAmount,
        total_amount: planned.totalAmount,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: planned.dueDate,
        notes,
        requires_approval: false,
      })
      .eq('id', invoiceId)
    if (error) throw new Error(`Kunde inte uppdatera faktura: ${error.message}`)

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const rows = this.buildInvoiceItemRows(invoiceId, planned, serviceItems)
    const { error: itemErr } = await supabase.from('invoice_items').insert(rows)
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)
  }

  private static async generateInvoiceNumber(): Promise<string> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `INV-${year}${month}`
    // Hämta högsta befintliga sekvensnummer istället för count() — count räknar
    // inte raderade rader, vilket orsakar kollision när rader städats bort.
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextSeq = 1
    if (data?.invoice_number) {
      const match = /-(\d+)$/.exec(data.invoice_number)
      if (match) nextSeq = parseInt(match[1], 10) + 1
    }
    const seq = String(nextSeq).padStart(4, '0')
    return `${prefix}-${seq}`
  }
}
