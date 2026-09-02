// src/services/contractInvoiceGenerator.ts
// Genererar fakturaplan för avtalskunder: beräknar vilka invoices som ska finnas
// baserat på avtalstid, frekvens och årspremie, och applicerar diff mot befintliga.
// Event-driven: anropas från BillingSettingsModal, avtalskartan, uppsägningsflöde
// och cron.
//
// Avtalskartan som motor (fas 2, docs/avtalskarta-motor-plan.md):
//   * Periodmatematiken bor i src/shared/contractPlanner.ts och delas med cronen.
//   * Beloppet per period kommer ur premietrappan (contract_premium_events);
//     annual_value är fallback.
//   * § 4-raderna (billing_model = premium) på avtalets EGET innehåll blir
//     fakturarader, för alla riktiga avtal, inte bara importcontainrar.
//   * § 6-rader "per styck och år" blir egna rader (line_kind equipment_annual).
//   * Samlad faktura (gemet): en faktura per period för kunden, en rad per
//     avtal, invoice_items.contract_id pekar på avtalet, invoices.contract_id
//     är null och is_consolidated = true.
//   * Riktiga avtal får ALDRIG automatisk "betald historik". En period som
//     redan passerat utan faktura visas som 'uncovered' (importera från
//     Fortnox). Synth-avtal (kunder utan avtalsrad) behåller dagens beteende.
//   * Fakturadatum = periodstart minus ledtid (DEFAULT_INVOICE_LEAD_DAYS), så
//     fakturan är betald innan kundens nya avtalsår börjar.

import { supabase } from '../lib/supabase'
import { ImportedCustomerContractService } from './importedCustomerContractService'
import { PaymentTermsService } from './paymentTermsService'
import { InvoiceService } from './invoiceService'
import { ContractService, isSyntheticContract } from './contractService'
import { resolveOrganizationNumber } from '../utils/multisiteHelpers'
import type { ContractWithBilling } from '../types/database'
import {
  computePlannedPeriods,
  computeTerminationCutoff,
  parseLocalDate,
  periodDivisor,
  toLocalIsoDate,
  todayLocal,
  DEFAULT_INVOICE_LEAD_DAYS,
  type BillingFrequency,
  type EquipmentLine,
  type PlannedPeriod,
  type PlanningContract,
  type PremiumStep,
} from '../shared/contractPlanner'

export type { BillingFrequency } from '../shared/contractPlanner'

interface ContractServiceItem {
  case_billing_item_id: string
  article_id: string | null
  display_code: string | null // service_code || article_code (samma fallback som invoiceService)
  display_name: string // service_name || article_name
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  rot_rut_type: string | null
  fastighetsbeteckning: string | null
}

/** En planerad faktura: en period med belopp. Fälten från PlannedPeriod plus etikett. */
export type PlannedInvoice = PlannedPeriod

export type InvoiceLineKind = 'premium' | 'equipment_annual' | 'index_note' | 'addon_round' | 'service' | 'article' | 'generic'

/** Fakturarad som planen bär fram till apply. */
export interface InvoiceRowSpec {
  contract_id: string | null
  line_kind: InvoiceLineKind
  case_billing_item_id?: string | null
  article_id?: string | null
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  rot_rut_type?: string | null
  fastighetsbeteckning?: string | null
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
  /** Passerad period utan faktura på ett riktigt avtal: importera från Fortnox, skapas aldrig här */
  | 'uncovered'
  /** Perioden ligger på kundens samlingsfaktura (per-avtal-planen rör den inte) */
  | 'consolidated'

export interface BillingPlanEntry {
  action: BillingPlanAction
  planned?: PlannedInvoice
  existingId?: string
  existingStatus?: string
  existingAmount?: number
  reason?: string
  /** Avtalet raden gäller (null = synth/kundnivå) */
  contractId?: string | null
  contractLabel?: string | null
  /** Färdiga fakturarader; saknas de byggs generiska rader vid apply (synth) */
  rows?: InvoiceRowSpec[]
  /** Er referens på fakturan */
  marking?: string | null
  /** Fakturans anteckning (Remarks i Fortnox) */
  notes?: string
  /** Raden hör till en samlad faktura (invoices.contract_id null, is_consolidated) */
  consolidated?: boolean
}

export interface BillingPlan {
  customerId: string
  // Multi-kontrakt-refaktor: när planen är scopad till ett specifikt kontrakt
  // sätts contractId. För synth-kontrakt (kunder utan riktig contracts-rad)
  // är contractId null så att invoices.contract_id inte sätts.
  contractId: string | null
  contractLabel?: string | null
  /** Samlad plan för flera avtal (gemet) */
  consolidated?: boolean
  entries: BillingPlanEntry[]
  summary: {
    create: number
    update: number
    delete: number
    locked: number
    keep: number
    historical: number // create-historical + backfill-historical-paid
    uncovered: number
  }
}

export interface ApplyResult {
  createdIds: string[]
  updatedIds: string[]
  deletedIds: string[]
  historicalIds: string[]
  skippedLocked: number
  /** Passerade perioder utan faktura som väntar på Fortnox-import */
  uncovered: number
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
  billing_reference?: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  monthly_value: number | null
  contract_invoice_mode?: string | null
}

type ExistingInvoice = {
  id: string
  invoice_number?: string | null
  status: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  total_amount: number
  subtotal: number
  is_historical: boolean | null
  is_consolidated?: boolean | null
  contract_id?: string | null
  invoice_type?: string | null
  invoice_items?: Array<{ article_name: string | null; line_kind?: string | null; contract_id?: string | null; total_price?: number | null }> | null
  has_generic_items?: boolean
  rowSignature?: string
}

type ContractSources = {
  steps: PremiumStep[]
  premiumItems: ContractServiceItem[]
  equipment: EquipmentLine[]
  label: string | null
  invoiceReference: string | null
  diaryNumber: string | null
}

const LOCKED_STATUSES = new Set(['booked', 'sent', 'paid'])
const EDITABLE_STATUSES = new Set(['draft', 'pending_approval', 'ready'])
const EMPTY_SUMMARY = (): BillingPlan['summary'] => ({
  keep: 0,
  create: 0,
  update: 0,
  delete: 0,
  locked: 0,
  historical: 0,
  uncovered: 0,
})

/**
 * Ren funktion: planerade fakturor från kund- eller avtalsfält, utan trappa och
 * utrustning. Behålls för BillingSettingsModal (fakturaschemat i UI) och
 * contractAdditionService (periodberäkning). Inga DB-anrop.
 */
export function computePlannedInvoicesPure(customer: CustomerForPlanning, paymentTermsDays: number = 30): PlannedInvoice[] {
  return computePlannedPeriods(customer, { paymentTermsDays })
}

function summarize(entries: BillingPlanEntry[]): BillingPlan['summary'] {
  return entries.reduce((acc, e) => {
    if (e.action === 'create-historical' || e.action === 'backfill-historical-paid') acc.historical += 1
    else if (e.action === 'uncovered') acc.uncovered += 1
    else if (e.action === 'consolidated') acc.keep += 1
    else acc[e.action] += 1
    return acc
  }, EMPTY_SUMMARY())
}

function periodLabel(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>): string {
  return `${p.periodStart} t.o.m. ${p.periodEnd}`
}

function rowSignature(rows: Array<{ contract_id?: string | null; line_kind?: string | null; total_price?: number | null }>): string {
  return rows
    .map((r) => `${r.contract_id ?? ''}|${r.line_kind ?? ''}|${Math.round(Number(r.total_price ?? 0) * 100)}`)
    .sort()
    .join(';')
}

export class ContractInvoiceGenerator {
  /**
   * Skapa fakturaplan för en kund. Returnerar diff mot befintliga invoices.
   *
   * Behålls för äldre anropare: returnerar planen för kundens FÖRSTA avtal
   * (display_order). Använd planCombinedForCustomer för alla avtal och för
   * samlad faktura.
   */
  static async planForCustomer(customerId: string): Promise<BillingPlan> {
    const contracts = await ContractService.getActiveContracts(customerId)
    if (contracts.length === 0) {
      return { customerId, contractId: null, entries: [], summary: EMPTY_SUMMARY() }
    }
    return this.planForContract(contracts[0], { customerId })
  }

  /**
   * Fakturaplaner för ALLA aktiva kontrakt på en kund, en plan per avtal.
   */
  static async planAllForCustomer(customerId: string): Promise<BillingPlan[]> {
    const contracts = await ContractService.getActiveContracts(customerId)
    const plans: BillingPlan[] = []
    for (const contract of contracts) {
      plans.push(await this.planForContract(contract, { customerId }))
    }
    return plans
  }

  /**
   * Planer enligt kundens faktureringsläge (gemet): samlad faktura när
   * customers.contract_invoice_mode = 'consolidated' och kunden har flera
   * riktiga avtal som delar frekvens och ankarmånad, annars en plan per avtal.
   */
  static async planCombinedForCustomer(customerId: string): Promise<BillingPlan[]> {
    const { data: customer } = await supabase
      .from('customers')
      .select('contract_invoice_mode')
      .eq('id', customerId)
      .maybeSingle()
    const mode = (customer as { contract_invoice_mode?: string | null } | null)?.contract_invoice_mode ?? 'per_contract'
    if (mode === 'consolidated') return this.planConsolidatedForCustomer(customerId)
    return this.planAllForCustomer(customerId)
  }

  /** Slå ihop flera planer till en för förhandsvisning. Apply klarar den ihopslagna planen. */
  static mergePlans(customerId: string, plans: BillingPlan[]): BillingPlan {
    const entries = plans.flatMap((p) =>
      p.entries.map((e) => ({
        ...e,
        contractId: e.contractId ?? p.contractId,
        contractLabel: e.contractLabel ?? p.contractLabel ?? null,
        consolidated: e.consolidated ?? p.consolidated ?? false,
      }))
    )
    entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))
    return {
      customerId,
      contractId: plans.length === 1 ? plans[0].contractId : null,
      consolidated: plans.some((p) => p.consolidated),
      entries,
      summary: summarize(entries),
    }
  }

  /**
   * Skapa fakturaplan för ett enskilt kontrakt. Diff:fas mot invoices för det
   * specifika contract_id (eller, för synth-kontrakt, alla contract-invoices
   * på kunden, vilket motsvarar dagens beteende).
   */
  static async planForContract(
    contractOrId: string | ContractWithBilling,
    opts?: { customerId?: string }
  ): Promise<BillingPlan> {
    const contract =
      typeof contractOrId === 'string' ? await ContractService.getContractWithBillingById(contractOrId) : contractOrId

    if (!contract) throw new Error('Kontrakt hittades inte')
    if (!contract.customer_id) throw new Error('Kontrakt saknar customer_id')

    const customerId = opts?.customerId ?? contract.customer_id
    const isSynth = isSyntheticContract(contract)
    const paymentTermsDays = await PaymentTermsService.getDays('contract')

    // Synth-avtal: kundradens fält, ingen trappa, generiska rader (eller
    // importcontainerns § 4-rader via legacy-vägen).
    if (isSynth) {
      const planned = computePlannedPeriods(contract as PlanningContract, { paymentTermsDays })
      const existing = await this.loadExisting(customerId, null)
      const entries = this.buildDiff(planned, existing, { real: false })
      return { customerId, contractId: null, entries, summary: summarize(entries) }
    }

    const sources = await this.loadContractSources(contract.id)
    const planned = computePlannedPeriods(contract as PlanningContract, {
      paymentTermsDays,
      steps: sources.steps,
      equipment: sources.equipment,
      leadDays: DEFAULT_INVOICE_LEAD_DAYS,
    })
    const existing = await this.loadExisting(customerId, contract.id)
    const consolidatedPeriods = await this.loadConsolidatedPeriodsForContract(customerId, contract.id)
    const billingCustomer = await this.loadCustomer(customerId)
    const marking = sources.invoiceReference ?? billingCustomer.billing_reference ?? null

    const entries = this.buildDiff(planned, existing, { real: true, consolidatedPeriods }).map((e) => {
      if (!e.planned) return { ...e, contractId: contract.id, contractLabel: sources.label }
      return {
        ...e,
        contractId: contract.id,
        contractLabel: sources.label,
        rows: this.buildRowsForContract(contract.id, sources, e.planned, contract.billing_frequency as BillingFrequency | null),
        marking,
        notes: this.buildNotes(e.planned, sources.label, sources.diaryNumber),
      }
    })

    return { customerId, contractId: contract.id, contractLabel: sources.label, entries, summary: summarize(entries) }
  }

  /**
   * Samlad faktura per kund (gemet): avtal som delar frekvens och ankarmånad
   * hamnar på samma faktura med en rad per avtal. Avtal som avviker faller ut
   * som egna planer. Synth-avtal samfaktureras aldrig (de har inget avtal).
   */
  static async planConsolidatedForCustomer(customerId: string): Promise<BillingPlan[]> {
    const contracts = (await ContractService.getActiveContracts(customerId)).filter((c) => !isSyntheticContract(c))
    if (contracts.length === 0) return this.planAllForCustomer(customerId)

    const groups = new Map<string, ContractWithBilling[]>()
    for (const c of contracts) {
      const key = `${c.billing_frequency ?? ''}|${c.billing_anchor_month ?? ''}`
      groups.set(key, [...(groups.get(key) ?? []), c])
    }

    const plans: BillingPlan[] = []
    const paymentTermsDays = await PaymentTermsService.getDays('contract')
    const billingCustomer = await this.loadCustomer(customerId)

    for (const group of groups.values()) {
      if (group.length === 1) {
        plans.push(await this.planForContract(group[0], { customerId }))
        continue
      }

      // Per avtal: perioder med rader
      type PerContract = { contract: ContractWithBilling; sources: ContractSources; periods: PlannedPeriod[] }
      const perContract: PerContract[] = []
      for (const contract of group) {
        const sources = await this.loadContractSources(contract.id)
        const periods = computePlannedPeriods(contract as PlanningContract, {
          paymentTermsDays,
          steps: sources.steps,
          equipment: sources.equipment,
          leadDays: DEFAULT_INVOICE_LEAD_DAYS,
        })
        perContract.push({ contract, sources, periods })
      }

      // Union av perioder
      const byPeriod = new Map<string, { planned: PlannedPeriod; rows: InvoiceRowSpec[]; labels: string[]; diaries: string[] }>()
      for (const pc of perContract) {
        for (const p of pc.periods) {
          const slot = byPeriod.get(p.periodStart) ?? {
            planned: { ...p, amount: 0, subtotal: 0, vatAmount: 0, totalAmount: 0, equipmentRows: [] },
            rows: [],
            labels: [],
            diaries: [],
          }
          slot.rows.push(
            ...this.buildRowsForContract(pc.contract.id, pc.sources, p, pc.contract.billing_frequency as BillingFrequency | null)
          )
          slot.planned.amount += p.amount
          slot.planned.subtotal = Math.round((slot.planned.subtotal + p.subtotal) * 100) / 100
          slot.planned.vatAmount = Math.round((slot.planned.vatAmount + p.vatAmount) * 100) / 100
          slot.planned.totalAmount = Math.round((slot.planned.subtotal + slot.planned.vatAmount) * 100) / 100
          // Tidigaste fakturadatum och förfallodag vinner
          if (p.invoiceDate < slot.planned.invoiceDate) slot.planned.invoiceDate = p.invoiceDate
          if (p.dueDate < slot.planned.dueDate) slot.planned.dueDate = p.dueDate
          if (p.periodEnd > slot.planned.periodEnd) slot.planned.periodEnd = p.periodEnd
          if (pc.sources.label) slot.labels.push(pc.sources.label)
          if (pc.sources.diaryNumber && !slot.diaries.includes(pc.sources.diaryNumber)) slot.diaries.push(pc.sources.diaryNumber)
          byPeriod.set(p.periodStart, slot)
        }
      }
      const planned = [...byPeriod.values()]
        .map((s) => s.planned)
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
        .map((p, i, arr) => ({ ...p, sequenceNumber: i + 1, totalSequenceCount: arr.length }))

      const existing = await this.loadExisting(customerId, null, { consolidated: true })
      const entries: BillingPlanEntry[] = this.buildDiff(planned, existing, { real: true, compareRows: true }).map((e) => {
        if (!e.planned) return { ...e, contractId: null, consolidated: true }
        const slot = byPeriod.get(e.planned.periodStart)!
        // Beslut 2026-09-02: huvudkundens referens i huvudet, avtalen som rader.
        const allSameRef = perContract.every(
          (pc) => pc.sources.invoiceReference && pc.sources.invoiceReference === perContract[0].sources.invoiceReference
        )
        const marking = billingCustomer.billing_reference ?? (allSameRef ? perContract[0].sources.invoiceReference : null)
        return {
          ...e,
          contractId: null,
          consolidated: true,
          rows: slot.rows,
          marking,
          notes: `Årspremie · Period ${periodLabel(e.planned)} · Avtal: ${slot.labels.join(', ')}${
            slot.diaries.length ? ` · ${slot.diaries.join(', ')}` : ''
          }`,
        }
      })

      // Per-avtal-fakturor för samma perioder ersätts av samlingsfakturan
      const groupIds = new Set(group.map((c) => c.id))
      const perContractExisting = (await this.loadExisting(customerId, null)).filter(
        (e) => e.contract_id && groupIds.has(e.contract_id)
      )
      for (const ex of perContractExisting) {
        if (!ex.billing_period_start || !byPeriod.has(ex.billing_period_start)) continue
        const status = ex.status ?? 'draft'
        if (EDITABLE_STATUSES.has(status)) {
          entries.push({
            action: 'delete',
            existingId: ex.id,
            existingStatus: status,
            existingAmount: ex.total_amount,
            contractId: ex.contract_id ?? null,
            reason: 'Ersätts av samlingsfakturan',
          })
        } else if (LOCKED_STATUSES.has(status)) {
          entries.push({
            action: 'locked',
            existingId: ex.id,
            existingStatus: status,
            existingAmount: ex.total_amount,
            contractId: ex.contract_id ?? null,
            reason: 'Redan skickad per avtal, samlingsfakturan hoppar över perioden',
          })
          // Perioden ska då inte skapas samlat
          const idx = entries.findIndex((en) => en.planned?.periodStart === ex.billing_period_start && en.action === 'create')
          if (idx >= 0) entries.splice(idx, 1)
        }
      }

      entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))
      plans.push({
        customerId,
        contractId: null,
        contractLabel: group
          .map((c) => (c as { label?: string | null }).label ?? c.contract_type ?? 'Avtal')
          .join(' + '),
        consolidated: true,
        entries,
        summary: summarize(entries),
      })
    }

    return plans
  }

  // ------- Källor -------

  private static async loadCustomer(customerId: string): Promise<CustomerRow> {
    const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).single()
    if (error || !data) throw new Error(`Kunde inte hämta kund: ${error?.message ?? 'okänt fel'}`)
    const row = data as CustomerRow
    row.organization_number = await resolveOrganizationNumber(row.id, row.organization_number)
    return row
  }

  /** Premietrappa, § 4-rader (premium) och § 6-rader (per_year) för ett riktigt avtal. */
  private static async loadContractSources(contractId: string): Promise<ContractSources> {
    const [{ data: contract }, { data: steps }, { data: items }] = await Promise.all([
      supabase.from('contracts').select('label, contract_type, invoice_reference, diary_number').eq('id', contractId).maybeSingle(),
      supabase.from('contract_premium_events').select('effective_from, annual_value').eq('contract_id', contractId),
      supabase
        .from('case_billing_items')
        .select(
          'id, article_id, article_code, article_name, service_id, service_code, service_name, quantity, unit_price, total_price, vat_rate, discount_percent, rot_rut_type, fastighetsbeteckning, billing_model, status'
        )
        .eq('case_id', contractId)
        .eq('case_type', 'contract')
        .eq('item_type', 'service')
        .neq('status', 'cancelled'),
    ])
    type Item = {
      id: string
      article_id: string | null
      article_code: string | null
      article_name: string | null
      service_id: string | null
      service_code: string | null
      service_name: string | null
      quantity: number
      unit_price: number
      total_price: number
      vat_rate: number
      discount_percent: number | null
      rot_rut_type: string | null
      fastighetsbeteckning: string | null
      billing_model: string | null
    }
    const rows = (items ?? []) as unknown as Item[]
    const premiumItems: ContractServiceItem[] = rows
      .filter((r) => (r.billing_model ?? 'premium') === 'premium')
      .map((s) => ({
        case_billing_item_id: s.id,
        article_id: s.article_id,
        display_code: s.service_code ?? s.article_code ?? null,
        display_name: s.service_name ?? s.article_name ?? 'Avtalstjänst',
        quantity: Number(s.quantity),
        unit_price: Number(s.unit_price),
        total_price: Number(s.total_price),
        vat_rate: Number(s.vat_rate),
        discount_percent: Number(s.discount_percent ?? 0),
        rot_rut_type: s.rot_rut_type ?? null,
        fastighetsbeteckning: s.fastighetsbeteckning ?? null,
      }))
    const equipment: EquipmentLine[] = rows
      .filter((r) => r.billing_model === 'per_year')
      .map((s) => ({
        id: s.id,
        contract_id: contractId,
        name: s.service_name ?? s.article_name ?? 'Utrustning',
        code: s.service_code ?? s.article_code ?? null,
        quantity: Number(s.quantity),
        unit_price_annual: Number(s.unit_price),
        vat_rate: Number(s.vat_rate),
      }))
    const c = contract as { label?: string | null; contract_type?: string | null; invoice_reference?: string | null; diary_number?: string | null } | null
    return {
      steps: ((steps ?? []) as PremiumStep[]).map((s) => ({ effective_from: s.effective_from, annual_value: Number(s.annual_value) })),
      premiumItems,
      equipment,
      label: c?.label ?? c?.contract_type ?? null,
      invoiceReference: c?.invoice_reference ?? null,
      diaryNumber: c?.diary_number ?? null,
    }
  }

  /**
   * Befintliga avtalsfakturor. contractId = avtalets egna (+ legacy utan
   * contract_id); null = kundens alla per-avtal-fakturor; consolidated =
   * kundens samlingsfakturor. Fortnox-importer (F-) av typ contract och adhoc
   * följer alltid med, eftersom de kan täcka perioder.
   */
  private static async loadExisting(
    customerId: string,
    contractId: string | null,
    opts?: { consolidated?: boolean }
  ): Promise<ExistingInvoice[]> {
    let q = supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, billing_period_start, billing_period_end, total_amount, subtotal, is_historical, is_consolidated, contract_id, invoice_type, invoice_items(article_name, line_kind, contract_id, total_price)'
      )
      .eq('customer_id', customerId)
      .in('invoice_type', ['contract', 'adhoc'])
    if (opts?.consolidated) q = q.eq('is_consolidated', true)
    else if (contractId) q = q.or(`contract_id.eq.${contractId},contract_id.is.null`).eq('is_consolidated', false)
    else q = q.eq('is_consolidated', false)

    const { data, error } = await q
    if (error) throw new Error(`Kunde inte hämta befintliga fakturor: ${error.message}`)
    return ((data ?? []) as unknown as ExistingInvoice[])
      .filter((e) => e.invoice_type === 'contract' || (e.invoice_number ?? '').startsWith('F-'))
      .map((e) => ({
        ...e,
        has_generic_items: (e.invoice_items ?? []).length > 0 && (e.invoice_items ?? []).every((it) => !it.line_kind),
        rowSignature: rowSignature(e.invoice_items ?? []),
      }))
  }

  /** Perioder där avtalet redan ligger på en samlad faktura (rad med contract_id). */
  private static async loadConsolidatedPeriodsForContract(customerId: string, contractId: string): Promise<Map<string, ExistingInvoice>> {
    const rows = await this.loadExisting(customerId, null, { consolidated: true })
    const map = new Map<string, ExistingInvoice>()
    for (const inv of rows) {
      if (!inv.billing_period_start) continue
      if ((inv.invoice_items ?? []).some((it) => it.contract_id === contractId)) map.set(inv.billing_period_start, inv)
    }
    return map
  }

  // ------- Rader -------

  private static buildRowsForContract(
    contractId: string,
    sources: ContractSources,
    planned: PlannedPeriod,
    freq: BillingFrequency | null
  ): InvoiceRowSpec[] {
    const period = periodLabel(planned)
    const diary = sources.diaryNumber ? ` (${sources.diaryNumber})` : ''
    const rows: InvoiceRowSpec[] = []

    if (sources.premiumItems.length > 0) {
      // § 4-raderna speglas, skalade per period. Beloppet i trappan vinner:
      // skiljer sig radsumman från periodens premie (indexering, tillägg
      // utan rad) fördelas skillnaden proportionellt så fakturan stämmer.
      const divisor = periodDivisor(freq)
      const scaled = sources.premiumItems.map((it) => ({
        it,
        unit: Math.round((it.unit_price * 100) / divisor) / 100,
        total: Math.round((it.total_price * 100) / divisor) / 100,
      }))
      const sum = scaled.reduce((s, r) => s + r.total, 0)
      const factor = sum > 0 && Math.abs(sum - planned.amount) >= 0.5 ? planned.amount / sum : 1
      for (const r of scaled) {
        const total = Math.round(r.total * factor * 100) / 100
        const unit = r.it.quantity > 0 ? Math.round((total / r.it.quantity) * 100) / 100 : total
        rows.push({
          contract_id: contractId,
          line_kind: 'premium',
          case_billing_item_id: r.it.case_billing_item_id,
          article_id: null,
          article_code: r.it.display_code,
          article_name: `${r.it.display_name}, årspremie ${period}${diary}`,
          quantity: r.it.quantity,
          unit_price: unit,
          total_price: total,
          vat_rate: r.it.vat_rate,
          discount_percent: r.it.discount_percent,
          rot_rut_type: r.it.rot_rut_type,
          fastighetsbeteckning: r.it.fastighetsbeteckning,
        })
      }
    } else if (planned.amount > 0) {
      rows.push({
        contract_id: contractId,
        line_kind: 'premium',
        article_code: null,
        article_name: `Årspremie ${sources.label ?? 'avtal'}, ${period}${diary}`,
        quantity: 1,
        unit_price: planned.amount,
        total_price: planned.amount,
        vat_rate: 25,
        discount_percent: 0,
      })
    }

    for (const eq of planned.equipmentRows) {
      rows.push({
        contract_id: contractId,
        line_kind: 'equipment_annual',
        case_billing_item_id: eq.source_id,
        article_code: eq.code,
        article_name: `${eq.name}, tillägg utöver avtal, ${period}`,
        quantity: eq.quantity,
        unit_price: eq.unit_price,
        total_price: eq.total_price,
        vat_rate: eq.vat_rate,
        discount_percent: 0,
      })
    }

    return rows
  }

  private static buildNotes(planned: PlannedPeriod, label: string | null, diary: string | null): string {
    return `Årspremie${label ? ` ${label}` : ''} · Betalning ${planned.sequenceNumber}/${planned.totalSequenceCount} · Period ${periodLabel(planned)}${
      diary ? ` · ${diary}` : ''
    }`
  }

  // ------- Diff -------

  /**
   * Bygg diff: planerade vs befintliga. Nyckel = billing_period_start.
   * real = riktigt avtal: passerade perioder utan faktura blir 'uncovered'
   * (aldrig automatisk betald historik). compareRows = jämför radmängden,
   * inte bara beloppet (samlad faktura).
   */
  private static buildDiff(
    planned: PlannedInvoice[],
    existing: ExistingInvoice[],
    opts: { real: boolean; compareRows?: boolean; consolidatedPeriods?: Map<string, ExistingInvoice> }
  ): BillingPlanEntry[] {
    // Perioder täckta av importerade Fortnox-fakturor (F-, is_historical).
    // Period A överlappar B om A.start <= B.end och A.end >= B.start. Även
    // adhoc-typade importer räknas: år 1 kan ha importerats som engångsbelopp.
    const coveredRanges = existing
      .filter(
        (e) =>
          e.is_historical === true &&
          !!e.invoice_number &&
          e.invoice_number.startsWith('F-') &&
          !!e.billing_period_start &&
          !!e.billing_period_end
      )
      .map((e) => ({ start: e.billing_period_start as string, end: e.billing_period_end as string }))

    const filteredPlanned =
      coveredRanges.length === 0
        ? planned
        : planned.filter((p) => !coveredRanges.some((r) => p.periodStart <= r.end && p.periodEnd >= r.start))

    const contractInvoices = existing.filter((e) => e.invoice_type === 'contract' && !(e.invoice_number ?? '').startsWith('F-'))
    const plannedByKey = new Map(filteredPlanned.map((p) => [p.periodStart, p]))
    const existingByKey = new Map(
      contractInvoices.filter((e) => e.billing_period_start).map((e) => [e.billing_period_start as string, e])
    )

    const entries: BillingPlanEntry[] = []

    for (const p of filteredPlanned) {
      const consolidated = opts.consolidatedPeriods?.get(p.periodStart)
      if (consolidated) {
        entries.push({
          action: 'consolidated',
          planned: p,
          existingId: consolidated.id,
          existingStatus: consolidated.status ?? undefined,
          existingAmount: consolidated.total_amount,
          reason: 'Ligger på kundens samlingsfaktura',
        })
        continue
      }

      const ex = existingByKey.get(p.periodStart)

      if (!ex) {
        if (p.isHistorical) {
          entries.push(
            opts.real
              ? { action: 'uncovered', planned: p, reason: 'Passerad period utan faktura i portalen. Importera från Fortnox.' }
              : { action: 'create-historical', planned: p }
          )
        } else {
          entries.push({ action: 'create', planned: p })
        }
        continue
      }

      const status = ex.status ?? 'draft'

      if (p.isHistorical) {
        if (!opts.real && (status !== 'paid' || !ex.is_historical)) {
          entries.push({ action: 'backfill-historical-paid', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount })
        } else {
          entries.push({ action: 'keep', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount })
        }
        continue
      }

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
      const amountMatches = Math.abs(Number(ex.subtotal) - p.subtotal) < 0.5
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
    for (const ex of contractInvoices) {
      if (!ex.billing_period_start) continue
      if (plannedByKey.has(ex.billing_period_start)) continue
      const status = ex.status ?? 'draft'
      if (LOCKED_STATUSES.has(status)) {
        entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
      } else if (EDITABLE_STATUSES.has(status)) {
        entries.push({ action: 'delete', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount })
      } else {
        entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, reason: `Okänd status "${status}" - rör ej` })
      }
    }

    entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))
    return entries
  }

  /** Efterjustering vid radjämförelse (samlad faktura): 'keep' blir 'update' när radmängden ändrats. */
  private static refineWithRows(entries: BillingPlanEntry[], existing: ExistingInvoice[]): BillingPlanEntry[] {
    const byId = new Map(existing.map((e) => [e.id, e]))
    return entries.map((e) => {
      if (e.action !== 'keep' || !e.existingId || !e.rows) return e
      const ex = byId.get(e.existingId)
      if (!ex) return e
      if (ex.rowSignature !== rowSignature(e.rows)) return { ...e, action: 'update' }
      return e
    })
  }

  // ------- Apply -------

  /**
   * Applicera plan: skapa/uppdatera/radera invoices + invoice_items.
   * 'uncovered' och 'consolidated' rörs aldrig.
   */
  static async apply(plan: BillingPlan): Promise<ApplyResult> {
    const customer = await this.loadCustomer(plan.customerId)

    const result: ApplyResult = { createdIds: [], updatedIds: [], deletedIds: [], historicalIds: [], skippedLocked: 0, uncovered: 0 }

    const entries = plan.consolidated
      ? this.refineWithRows(plan.entries, await this.loadExisting(plan.customerId, null, { consolidated: true }))
      : plan.entries

    for (const entry of entries) {
      const contractId = entry.consolidated ? null : (entry.contractId ?? plan.contractId)
      if (entry.action === 'keep' || entry.action === 'consolidated') continue
      if (entry.action === 'uncovered') {
        result.uncovered++
        continue
      }
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
        const id = await this.insertContractInvoice(customer, entry.planned, contractId, entry)
        result.createdIds.push(id)
        continue
      }
      if (entry.action === 'create-historical' && entry.planned) {
        const id = await this.insertHistoricalPaidInvoice(customer, entry.planned, contractId)
        result.historicalIds.push(id)
        continue
      }
      if (entry.action === 'backfill-historical-paid' && entry.existingId && entry.planned) {
        await this.backfillHistoricalPaid(entry.existingId, customer, entry.planned, contractId)
        result.historicalIds.push(entry.existingId)
        continue
      }
      if (entry.action === 'update' && entry.existingId && entry.planned) {
        await this.updateContractInvoice(entry.existingId, customer, entry.planned, contractId, entry)
        result.updatedIds.push(entry.existingId)
      }
    }

    return result
  }

  /**
   * Plan + apply i ett anrop, enligt kundens faktureringsläge (gemet).
   */
  static async regenerateForCustomer(customerId: string): Promise<ApplyResult> {
    const plans = await this.planCombinedForCustomer(customerId)
    const merged: ApplyResult = { createdIds: [], updatedIds: [], deletedIds: [], historicalIds: [], skippedLocked: 0, uncovered: 0 }
    for (const plan of plans) {
      const r = await this.apply(plan)
      merged.createdIds.push(...r.createdIds)
      merged.updatedIds.push(...r.updatedIds)
      merged.deletedIds.push(...r.deletedIds)
      merged.historicalIds.push(...r.historicalIds)
      merged.skippedLocked += r.skippedLocked
      merged.uncovered += r.uncovered
    }
    return merged
  }

  /**
   * När en kund sägs upp: radera framtida icke-låsta fakturor efter cutoff.
   * Bindningstiden respekteras — fakturor inom contract_start→contract_end raderas aldrig.
   */
  static async cancelFutureAfterTermination(customerId: string): Promise<number> {
    const { data: customer, error } = await supabase.from('customers').select('*').eq('id', customerId).single()
    if (error || !customer) return 0

    const cutoff = computeTerminationCutoff(customer as CustomerRow)
    if (!cutoff) return 0

    const { data: toDelete, error: fErr } = await supabase
      .from('invoices')
      .select('id, status, billing_period_start')
      .eq('customer_id', customerId)
      .eq('invoice_type', 'contract')
      // gte: en period som STARTAR exakt på cutoff ligger efter avtalstiden
      .gte('billing_period_start', toLocalIsoDate(cutoff))

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
   * När ETT avtal sägs upp: ta bort framtida icke-låsta avtalsfakturor som hör
   * till just det avtalet, och avtalets rader på kundens samlingsfakturor.
   * Kundens andra avtal rörs aldrig. Rader utan contract_id lämnas orörda.
   *
   * effectiveEndDate = sista giltiga dagen. En period som STARTAR exakt på
   * slutdatumet ligger efter avtalstiden och tas därför bort (gte).
   */
  static async cancelFutureForContract(contractId: string, effectiveEndDate: string): Promise<number> {
    if (!contractId || contractId.startsWith('synth-') || contractId.startsWith('kundrad-')) return 0

    const { data: toDelete, error } = await supabase
      .from('invoices')
      .select('id, status, billing_period_start')
      .eq('contract_id', contractId)
      .eq('invoice_type', 'contract')
      .gte('billing_period_start', effectiveEndDate)
    if (error) throw new Error(`Kunde inte hämta framtida fakturor: ${error.message}`)

    let deleted = 0
    for (const inv of toDelete ?? []) {
      if (LOCKED_STATUSES.has(inv.status ?? '')) continue
      await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
      const { error: dErr } = await supabase.from('invoices').delete().eq('id', inv.id)
      if (!dErr) deleted++
    }

    // Samlade fakturor: ta bort avtalets rader, räkna om, radera tomma
    const { data: consolidatedRows } = await supabase
      .from('invoice_items')
      .select('id, invoice_id, invoice:invoices!inner(id, status, billing_period_start, is_consolidated)')
      .eq('contract_id', contractId)
    type ConsRow = { id: string; invoice_id: string; invoice: { id: string; status: string | null; billing_period_start: string | null; is_consolidated: boolean | null } | null }
    const touched = new Set<string>()
    for (const r of (consolidatedRows ?? []) as unknown as ConsRow[]) {
      const inv = r.invoice
      if (!inv?.is_consolidated || !inv.billing_period_start || inv.billing_period_start < effectiveEndDate) continue
      if (LOCKED_STATUSES.has(inv.status ?? '')) continue
      await supabase.from('invoice_items').delete().eq('id', r.id)
      touched.add(inv.id)
    }
    for (const invoiceId of touched) {
      const { data: left } = await supabase.from('invoice_items').select('id').eq('invoice_id', invoiceId).limit(1)
      if (!left || left.length === 0) {
        const { error: dErr } = await supabase.from('invoices').delete().eq('id', invoiceId)
        if (!dErr) deleted++
      } else {
        await this.recalculateInvoiceTotals(invoiceId)
      }
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

    const customer = await this.loadCustomer(customerId)

    const completedDate = typeof completedAt === 'string' ? new Date(completedAt) : completedAt
    const y = completedDate.getFullYear()
    const m = completedDate.getMonth()
    const monthStart = toLocalIsoDate(new Date(y, m, 1))
    const monthEnd = toLocalIsoDate(new Date(y, m + 1, 0))

    let q = supabase
      .from('contract_billing_items')
      .select('id, total_price, article_name, article_code, quantity, unit_price, vat_rate, discount_percent, case_id, billing_period_start, visit_id, visit_number')
      .eq('customer_id', customerId)
      .eq('item_type', 'ad_hoc')
      .is('invoice_id', null)
      .neq('status', 'cancelled')

    if (grouping === 'per_case') q = q.eq('case_id', caseId)
    else q = q.gte('billing_period_start', monthStart).lte('billing_period_start', monthEnd)

    const { data: items, error: iErr } = await q
    if (iErr) throw new Error(`Kunde inte hämta faktureringsrader: ${iErr.message}`)
    if (!items || items.length === 0) return null

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

    // Fakturamärkning ("Er referens" i Fortnox): ärendets vid per_case, annars
    // enhetens fasta kod (månadsbatchen är per enhet, så koden gäller alla rader).
    let invoiceMarking: string | null = null
    if (grouping === 'per_case') {
      const { data: caseRow } = await supabase.from('cases').select('invoice_marking').eq('id', caseId).maybeSingle()
      invoiceMarking = caseRow?.invoice_marking?.trim() || null
    } else {
      invoiceMarking = customer.billing_reference?.trim() || null
    }

    // Besökskoppling: bara vid per_case OCH när samtliga rader hör till samma besök.
    const invoiceVisitId = grouping === 'per_case' ? InvoiceService.resolveSharedVisitId(items) : null

    let invoiceId: string
    if (existingInvoiceId) {
      invoiceId = existingInvoiceId
      await this.addItemsToAdhocInvoice(invoiceId, items)
      await this.recalculateInvoiceTotals(invoiceId)
    } else {
      const invNum = await this.generateInvoiceNumber()
      const due = new Date()
      const paymentTermsDays = await PaymentTermsService.getDays('contract')
      due.setDate(due.getDate() + paymentTermsDays)
      const { data: inv, error: insErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invNum,
          invoice_type: 'adhoc',
          customer_id: customerId,
          case_id: grouping === 'per_case' ? caseId : null,
          case_type: null,
          visit_id: invoiceVisitId,
          customer_name: customer.company_name,
          customer_email: customer.billing_email ?? customer.contact_email,
          customer_phone: customer.contact_phone,
          customer_address: customer.billing_address ?? customer.contact_address,
          organization_number: customer.organization_number,
          subtotal: Math.round(subtotal),
          vat_amount: Math.round(vatAmount),
          total_amount: Math.round(total),
          status: 'pending_approval',
          requires_approval: true,
          billing_period_start: monthStart,
          billing_period_end: monthEnd,
          due_date: toLocalIsoDate(due),
          invoice_marking: invoiceMarking,
        })
        .select('id')
        .single()
      if (insErr || !inv) return null
      invoiceId = inv.id
      await this.addItemsToAdhocInvoice(invoiceId, items)
    }

    await supabase
      .from('contract_billing_items')
      .update({ invoice_id: invoiceId, status: 'invoiced' })
      .in('id', items.map((i) => i.id))

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
    }>
  ): Promise<void> {
    const rows = items.map((i) => ({
      invoice_id: invoiceId,
      contract_billing_item_id: i.id,
      article_name: i.article_name ?? 'Merförsäljning',
      article_code: i.article_code,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price,
      vat_rate: i.vat_rate,
      discount_percent: i.discount_percent ?? 0,
      line_kind: 'service',
    }))
    await supabase.from('invoice_items').insert(rows)
  }

  private static async recalculateInvoiceTotals(invoiceId: string): Promise<void> {
    const { data: items } = await supabase.from('invoice_items').select('total_price, vat_rate').eq('invoice_id', invoiceId)
    if (!items) return
    const subtotal = items.reduce((s, i) => s + Number(i.total_price), 0)
    const vat = items.reduce((s, i) => s + Number(i.total_price) * (Number(i.vat_rate) / 100), 0)
    await supabase
      .from('invoices')
      .update({ subtotal: Math.round(subtotal), vat_amount: Math.round(vat), total_amount: Math.round(subtotal + vat) })
      .eq('id', invoiceId)
  }

  /**
   * Cron-säkerhetsnät (webbvarianten): kunder vars avtalsslut passerat utan
   * uppsägning planeras om enligt sitt faktureringsläge. Den skarpa cronen
   * ligger i api/cron/generate-continuing-contracts.ts.
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
        if (r.createdIds.length > 0) results.push({ customerId: c.id, created: r.createdIds.length })
      } catch (err) {
        console.error(`Fel vid regenerering av ${c.id}:`, err)
      }
    }
    return results
  }

  /**
   * Legacy: kundens avtalsartiklar via importcontainern (synth-kunder).
   * Riktiga avtal läser sina egna rader i loadContractSources.
   */
  private static async getServiceItemsForCustomer(customerId: string, freq: BillingFrequency): Promise<ContractServiceItem[]> {
    try {
      const contractId = await ImportedCustomerContractService.findContract(customerId)
      if (!contractId) return []
      const { services } = await ImportedCustomerContractService.getItems(contractId)
      if (services.length === 0) return []
      const divisor = periodDivisor(freq)
      return services.map((s) => {
        const anyS = s as unknown as Record<string, unknown>
        return {
          case_billing_item_id: s.id,
          article_id: s.article_id,
          display_code: (anyS.service_code as string | null) ?? s.article_code ?? null,
          display_name: (anyS.service_name as string | null) ?? s.article_name ?? 'Avtalstjänst',
          quantity: s.quantity,
          unit_price: Math.round((Number(s.unit_price) * 100) / divisor) / 100,
          total_price: Math.round((Number(s.total_price) * 100) / divisor) / 100,
          vat_rate: Number(s.vat_rate),
          discount_percent: Number(s.discount_percent ?? 0),
          rot_rut_type: (anyS.rot_rut_type as string | null) ?? null,
          fastighetsbeteckning: (anyS.fastighetsbeteckning as string | null) ?? null,
        }
      })
    } catch (err) {
      console.error('Kunde inte hämta avtalsartiklar:', err)
      return []
    }
  }

  /** Rader för synth-avtal: importcontainerns § 4-rader, annars generisk. */
  private static async buildLegacyRows(customer: CustomerRow, planned: PlannedInvoice): Promise<InvoiceRowSpec[]> {
    const serviceItems = await this.getServiceItemsForCustomer(customer.id, customer.billing_frequency!)
    if (serviceItems.length > 0) {
      return serviceItems.map((it) => ({
        contract_id: null,
        line_kind: 'premium',
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
    return [
      {
        contract_id: null,
        line_kind: 'generic',
        article_code: null,
        article_name: `Årspremie, ${periodLabel(planned)}`,
        quantity: 1,
        unit_price: planned.amount,
        total_price: planned.amount,
        vat_rate: 25,
        discount_percent: 0,
      },
    ]
  }

  private static toItemRows(invoiceId: string, rows: InvoiceRowSpec[]): Array<Record<string, unknown>> {
    return rows.map((r) => ({
      invoice_id: invoiceId,
      contract_id: r.contract_id,
      line_kind: r.line_kind,
      case_billing_item_id: r.case_billing_item_id ?? null,
      article_id: r.article_id ?? null,
      article_code: r.article_code,
      article_name: r.article_name,
      quantity: r.quantity,
      unit_price: r.unit_price,
      total_price: r.total_price,
      vat_rate: r.vat_rate,
      discount_percent: r.discount_percent,
      rot_rut_type: r.rot_rut_type ?? null,
      fastighetsbeteckning: r.fastighetsbeteckning ?? null,
    }))
  }

  private static buildLegacyNotes(planned: PlannedInvoice): string {
    return `Årspremie · Betalning ${planned.sequenceNumber}/${planned.totalSequenceCount} · Period ${periodLabel(planned)}`
  }

  // ------- Privata hjälpare för DB-skrivning -------

  private static async insertContractInvoice(
    customer: CustomerRow,
    planned: PlannedInvoice,
    contractId: string | null,
    entry?: BillingPlanEntry
  ): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber()
    const rows = entry?.rows ?? (await this.buildLegacyRows(customer, planned))
    const notes = entry?.notes ?? this.buildLegacyNotes(planned)
    // Fakturadatum = ledtiden före periodstart (planerarens invoiceDate)
    const createdAt = parseLocalDate(planned.invoiceDate).toISOString()
    const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
    const vat = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        customer_id: customer.id,
        contract_id: contractId,
        is_consolidated: entry?.consolidated ?? false,
        contract_invoice_kind: 'premium',
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal,
        vat_amount: vat,
        total_amount: Math.round((subtotal + vat) * 100) / 100,
        status: 'pending_approval',
        requires_approval: false,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: planned.dueDate,
        is_historical: false,
        invoice_marking: entry?.marking ?? customer.billing_reference ?? null,
        notes,
        created_at: createdAt,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Kunde inte skapa faktura: ${error.message}`)
    if (!inv) throw new Error('Faktura skapades ej')

    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(inv.id, rows))
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)

    return inv.id
  }

  /**
   * Historisk faktura direkt som status=paid, is_historical=true. Bara för
   * synth-avtal (kunder utan avtalsrad); riktiga avtal får 'uncovered'.
   */
  private static async insertHistoricalPaidInvoice(customer: CustomerRow, planned: PlannedInvoice, contractId: string | null): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber()
    const periodStart = parseLocalDate(planned.periodStart)
    const bookedSentAt = periodStart.toISOString()
    const paidAt = parseLocalDate(planned.dueDate).toISOString()
    const rows = await this.buildLegacyRows(customer, planned)
    const notes = `${this.buildLegacyNotes(planned)} · Autogenererad historik utan Fortnox-verifikat`

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        customer_id: customer.id,
        contract_id: contractId,
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

    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(inv.id, rows))
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)

    return inv.id
  }

  private static async backfillHistoricalPaid(invoiceId: string, customer: CustomerRow, planned: PlannedInvoice, contractId: string | null): Promise<void> {
    const periodStart = parseLocalDate(planned.periodStart)
    const bookedSentAt = periodStart.toISOString()
    const paidAt = parseLocalDate(planned.dueDate).toISOString()
    const rows = await this.buildLegacyRows(customer, planned)

    const updatePayload: Record<string, unknown> = {
      status: 'paid',
      requires_approval: false,
      booked_at: bookedSentAt,
      sent_at: bookedSentAt,
      paid_at: paidAt,
      is_historical: true,
      notes: `${this.buildLegacyNotes(planned)} · Autogenererad historik utan Fortnox-verifikat`,
      created_at: bookedSentAt,
    }
    if (contractId) updatePayload.contract_id = contractId

    const { error } = await supabase.from('invoices').update(updatePayload).eq('id', invoiceId)
    if (error) throw new Error(`Kunde inte backfilla historisk: ${error.message}`)

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(invoiceId, rows))
    if (itemErr) throw new Error(`Kunde inte uppdatera fakturarader: ${itemErr.message}`)
  }

  private static async updateContractInvoice(
    invoiceId: string,
    customer: CustomerRow,
    planned: PlannedInvoice,
    contractId: string | null,
    entry?: BillingPlanEntry
  ): Promise<void> {
    const rows = entry?.rows ?? (await this.buildLegacyRows(customer, planned))
    const notes = entry?.notes ?? this.buildLegacyNotes(planned)
    const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
    const vat = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100

    const updatePayload: Record<string, unknown> = {
      customer_name: customer.company_name,
      customer_email: customer.billing_email ?? customer.contact_email,
      customer_phone: customer.contact_phone,
      customer_address: customer.billing_address ?? customer.contact_address,
      organization_number: customer.organization_number,
      subtotal,
      vat_amount: vat,
      total_amount: Math.round((subtotal + vat) * 100) / 100,
      billing_period_start: planned.periodStart,
      billing_period_end: planned.periodEnd,
      due_date: planned.dueDate,
      created_at: parseLocalDate(planned.invoiceDate).toISOString(),
      notes,
      requires_approval: false,
    }
    if (contractId) updatePayload.contract_id = contractId
    if (entry?.marking !== undefined) updatePayload.invoice_marking = entry.marking
    if (entry?.consolidated) updatePayload.is_consolidated = true

    const { error } = await supabase.from('invoices').update(updatePayload).eq('id', invoiceId)
    if (error) throw new Error(`Kunde inte uppdatera faktura: ${error.message}`)

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(invoiceId, rows))
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)
  }

  private static async generateInvoiceNumber(): Promise<string> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `INV-${year}${month}`
    // Högsta befintliga sekvensnummer i stället för count(): count räknar inte
    // raderade rader, vilket kolliderar när rader städats bort.
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
    return `${prefix}-${String(nextSeq).padStart(4, '0')}`
  }
}
