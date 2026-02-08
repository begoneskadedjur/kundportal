// src/types/contractBilling.ts
// Typer för avtalsfakturering

export type BillingFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand'
export type ContractBillingItemStatus = 'pending' | 'approved' | 'invoiced' | 'paid' | 'cancelled'
export type ContractBillingBatchStatus = 'draft' | 'generated' | 'approved' | 'completed' | 'cancelled'

/**
 * Typ av faktureringspost
 */
export type ContractBillingItemType = 'contract' | 'ad_hoc'

/**
 * Källa för faktureringspost
 */
export type ContractBillingItemSource = 'price_list' | 'case_completion' | 'manual'

export interface ContractBillingItem {
  id: string
  customer_id: string
  billing_period_start: string
  billing_period_end: string
  article_id: string | null
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  status: ContractBillingItemStatus
  batch_id: string | null
  generated_at: string
  approved_at: string | null
  invoiced_at: string | null
  invoice_number: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Nya fält för ad-hoc och rabatter
  item_type: ContractBillingItemType
  case_id: string | null
  case_type: 'private' | 'business' | 'contract' | null
  source: ContractBillingItemSource
  requires_approval: boolean
  discount_percent: number
  original_price: number | null
}

export interface ContractBillingItemWithRelations extends ContractBillingItem {
  customer?: {
    id: string
    company_name: string
    organization_number: string | null
    billing_email: string | null
    billing_address: string | null
    contact_address: string | null
  }
  article?: {
    id: string
    code: string
    name: string
  }
  // Länkad ärendeinformation för ad-hoc poster
  case_info?: {
    id: string
    title?: string
    case_number?: string
  }
}

export interface ContractBillingBatch {
  id: string
  batch_number: string
  billing_period_start: string
  billing_period_end: string
  status: ContractBillingBatchStatus
  total_customers: number
  total_items: number
  total_amount: number
  generated_at: string
  approved_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

export interface CreateBillingItemInput {
  customer_id: string
  billing_period_start: string
  billing_period_end: string
  article_id?: string | null
  article_code?: string | null
  article_name: string
  quantity?: number
  unit_price: number
  total_price: number
  vat_rate?: number
  batch_id?: string | null
  notes?: string | null
  // Nya fält
  item_type?: ContractBillingItemType
  case_id?: string | null
  case_type?: 'private' | 'business' | 'contract' | null
  source?: ContractBillingItemSource
  requires_approval?: boolean
  discount_percent?: number
  original_price?: number | null
}

/**
 * Filter för att hämta billing items
 */
export interface ContractBillingItemFilters {
  status?: ContractBillingItemStatus | ContractBillingItemStatus[]
  item_type?: ContractBillingItemType | 'all'
  customer_id?: string
  batch_id?: string
  requires_approval?: boolean
  period_start?: string
  period_end?: string
}

// UI-konfiguration för faktureringsfrekvens
export const BILLING_FREQUENCY_CONFIG: Record<BillingFrequency, { label: string; months: number; description: string }> = {
  monthly: { label: 'Månadsvis', months: 1, description: 'Faktureras varje månad' },
  quarterly: { label: 'Kvartalsvis', months: 3, description: 'Faktureras var tredje månad' },
  semi_annual: { label: 'Halvårsvis', months: 6, description: 'Faktureras var sjätte månad' },
  annual: { label: 'Årsvis', months: 12, description: 'Faktureras en gång per år' },
  on_demand: { label: 'Vid behov', months: 0, description: 'Faktureras manuellt vid behov' }
}

// UI-konfiguration för faktureringsstatus
export const BILLING_ITEM_STATUS_CONFIG: Record<ContractBillingItemStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  pending: {
    label: 'Väntar',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30'
  },
  approved: {
    label: 'Godkänd',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  invoiced: {
    label: 'Fakturerad',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  },
  paid: {
    label: 'Betald',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  cancelled: {
    label: 'Avbruten',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30'
  }
}

export const BILLING_BATCH_STATUS_CONFIG: Record<ContractBillingBatchStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  draft: { label: 'Utkast', color: 'text-slate-400', bgColor: 'bg-slate-500/10' },
  generated: { label: 'Genererad', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  approved: { label: 'Godkänd', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  completed: { label: 'Slutförd', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  cancelled: { label: 'Avbruten', color: 'text-red-400', bgColor: 'bg-red-500/10' }
}

// Hjälpfunktion för att beräkna periodgränser
export function calculateBillingPeriod(frequency: BillingFrequency, referenceDate: Date = new Date()): {
  start: string
  end: string
} {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()

  let startMonth: number
  let endMonth: number
  let startYear = year
  let endYear = year

  switch (frequency) {
    case 'monthly':
      startMonth = month
      endMonth = month
      break
    case 'quarterly':
      startMonth = Math.floor(month / 3) * 3
      endMonth = startMonth + 2
      break
    case 'semi_annual':
      startMonth = month < 6 ? 0 : 6
      endMonth = startMonth + 5
      break
    case 'annual':
      startMonth = 0
      endMonth = 11
      break
    case 'on_demand':
    default:
      startMonth = month
      endMonth = month
      break
  }

  const startDate = new Date(startYear, startMonth, 1)
  const endDate = new Date(endYear, endMonth + 1, 0) // Sista dagen i slutmånaden

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  }
}

// Hjälpfunktion för att formatera period
export function formatBillingPeriod(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)

  const startMonth = startDate.toLocaleDateString('sv-SE', { month: 'short' })
  const endMonth = endDate.toLocaleDateString('sv-SE', { month: 'short' })
  const year = startDate.getFullYear()

  if (startMonth === endMonth) {
    return `${startMonth} ${year}`
  }
  return `${startMonth} - ${endMonth} ${year}`
}

// Hjälpfunktion för att formatera belopp
export function formatBillingAmount(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// ===== PIPELINE VIEW TYPES =====

export interface ContractInvoiceCustomer {
  id: string
  company_name: string
  organization_number: string | null
  billing_email: string | null
  billing_address: string | null
  contact_address: string | null
}

/**
 * Grupperad faktura per kund och period.
 * Härledd från contract_billing_items - inte en databasentitet.
 */
export interface ContractInvoice {
  customer_id: string
  period_start: string
  period_end: string
  customer: ContractInvoiceCustomer
  items: ContractBillingItemWithRelations[]
  subtotal: number
  vat_amount: number
  total_amount: number
  item_count: number
  derived_status: ContractBillingItemStatus
  has_items_requiring_approval: boolean
  has_discount: boolean
  batch_id: string | null
}

/**
 * Sammanfattning för en faktureringsperiod.
 */
export interface BillingPeriodSummary {
  period_start: string
  period_end: string
  period_label: string
  customer_count: number
  item_count: number
  total_amount: number
  invoices: ContractInvoice[]
  status_breakdown: Record<ContractBillingItemStatus, number>
}

/**
 * Filter för pipeline-vyn.
 */
export interface ContractBillingPipelineFilters extends ContractBillingItemFilters {
  search?: string
}

/**
 * Härleder den övergripande statusen för en grupperad faktura.
 * Den lägsta statusen bland icke-cancelled items vinner.
 */
export function deriveInvoiceStatus(
  items: ContractBillingItem[]
): ContractBillingItemStatus {
  const statusOrder: ContractBillingItemStatus[] = ['pending', 'approved', 'invoiced', 'paid']
  const nonCancelled = items.filter(i => i.status !== 'cancelled')

  if (nonCancelled.length === 0) return 'cancelled'

  for (const status of statusOrder) {
    if (nonCancelled.some(i => i.status === status)) {
      return status
    }
  }
  return 'pending'
}

// ===== MONTHLY PIPELINE TYPES =====

export type MonthlyCustomerStatus =
  | 'not_billable'
  | 'awaiting_generation'
  | 'pending'
  | 'approved'
  | 'invoiced'
  | 'paid'
  | 'mixed'

export interface PipelineCustomer {
  id: string
  company_name: string
  organization_number: string | null
  billing_email: string | null
  billing_frequency: BillingFrequency | null
  price_list_id: string | null
  price_list_name: string | null
  contract_status: string
  effective_end_date: string | null
  monthly_value: number | null
}

export interface MonthlyCustomerEntry {
  customer: PipelineCustomer
  status: MonthlyCustomerStatus
  items: ContractBillingItemWithRelations[]
  recurring_amount: number
  adhoc_amount: number
  total_amount: number
  item_count: number
  has_items_requiring_approval: boolean
}

export interface MonthlyPipelineSummary {
  month_key: string
  month_label: string
  period_start: string
  period_end: string
  customers: MonthlyCustomerEntry[]
  total_customers: number
  billable_customers: number
  generated_customers: number
  missing_setup_customers: number
  total_amount: number
  projected_amount: number
  status_breakdown: Record<MonthlyCustomerStatus, number>
}

export const PIPELINE_STATUS_CONFIG: Record<MonthlyCustomerStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  not_billable:        { label: 'Saknar prislista', color: 'text-slate-400',   bgColor: 'bg-slate-500/10' },
  awaiting_generation: { label: 'Ej genererad',     color: 'text-amber-400',   bgColor: 'bg-amber-500/10' },
  pending:             { label: 'Väntar',            color: 'text-yellow-400',  bgColor: 'bg-yellow-500/10' },
  approved:            { label: 'Godkänd',           color: 'text-blue-400',    bgColor: 'bg-blue-500/10' },
  invoiced:            { label: 'Fakturerad',        color: 'text-purple-400',  bgColor: 'bg-purple-500/10' },
  paid:                { label: 'Betald',            color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  mixed:               { label: 'Blandad',           color: 'text-orange-400',  bgColor: 'bg-orange-500/10' },
}
