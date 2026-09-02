// api/cron/generate-continuing-contracts.ts
// Säkerhetsnät för fortlöpande avtal: skapar nästa periods årspremiefaktura
// när avtalets slutdatum passerat (eller närmar sig) utan uppsägning.
// Körs 1:a varje månad 03:00 UTC via Vercel Cron.
//
// Avtalskartan som motor (fas 2): läser AVTALEN (contracts), inte kundraden.
// Samma periodmatematik som webben (src/shared/contractPlanner.ts), samma
// källor (premietrappa, § 4-rader med billing_model = premium, § 6-rader med
// per_year) och samma faktureringsläge (customers.contract_invoice_mode:
// samlad faktura med en rad per avtal, eller en faktura per avtal).
// Cronen SKAPAR bara saknade perioder; den uppdaterar och raderar aldrig.
// Kunder utan avtalsrad (synth) planeras från kundraden som förut, men
// perioder som redan passerat skapas aldrig här.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import {
  computePlannedPeriods,
  parseLocalDate,
  periodDivisor,
  rollingHorizonEnd,
  toLocalIsoDate,
  todayLocal,
  DEFAULT_INVOICE_LEAD_DAYS,
  type EquipmentLine,
  type PlannedPeriod,
  type PlanningContract,
  type PremiumStep,
} from '../../src/shared/contractPlanner'

export const config = { maxDuration: 300 }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const LIVE_STATUSES = ['signed', 'active']

type CustomerRow = {
  id: string
  company_name: string
  organization_number: string | null
  parent_customer_id: string | null
  billing_email: string | null
  billing_address: string | null
  billing_reference: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  annual_value: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  billing_frequency: string | null
  billing_anchor_month: number | null
  billing_active: boolean | null
  notice_period_months: number | null
  contract_invoice_mode: string | null
}

type ContractRow = PlanningContract & {
  id: string
  customer_id: string
  label: string | null
  contract_type: string | null
  invoice_reference: string | null
  diary_number: string | null
  effective_end_date: string | null
  status: string | null
  template_id: string | null
  oneflow_contract_id: string | null
  display_order: number | null
}

type RowSpec = {
  contract_id: string | null
  line_kind: string
  case_billing_item_id?: string | null
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
}

type Sources = {
  steps: PremiumStep[]
  premium: Array<{ id: string; code: string | null; name: string; quantity: number; unit_price: number; total_price: number; vat_rate: number; discount_percent: number }>
  equipment: EquipmentLine[]
}

async function resolveOrgNr(customer: CustomerRow): Promise<string | null> {
  if (customer.organization_number) return customer.organization_number
  if (!customer.parent_customer_id) return null
  const { data: parent } = await supabase.from('customers').select('organization_number').eq('id', customer.parent_customer_id).single()
  return parent?.organization_number ?? null
}

function isLive(c: ContractRow, today: string): boolean {
  if (c.status === 'ended') return false
  if (!c.terminated_at) return true
  const last = c.effective_end_date ?? c.contract_end_date
  return !last || last >= today
}

function isImported(c: ContractRow): boolean {
  return c.template_id === 'imported' || (c.oneflow_contract_id ?? '').startsWith('imported-')
}

async function loadSources(contractId: string): Promise<Sources> {
  const [{ data: steps }, { data: items }] = await Promise.all([
    supabase.from('contract_premium_events').select('effective_from, annual_value').eq('contract_id', contractId),
    supabase
      .from('case_billing_items')
      .select('id, article_code, article_name, service_code, service_name, quantity, unit_price, total_price, vat_rate, discount_percent, billing_model')
      .eq('case_id', contractId)
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .neq('status', 'cancelled'),
  ])
  type Item = {
    id: string
    article_code: string | null
    article_name: string | null
    service_code: string | null
    service_name: string | null
    quantity: number
    unit_price: number
    total_price: number
    vat_rate: number
    discount_percent: number | null
    billing_model: string | null
  }
  const rows = (items ?? []) as Item[]
  return {
    steps: ((steps ?? []) as PremiumStep[]).map((s) => ({ effective_from: s.effective_from, annual_value: Number(s.annual_value) })),
    premium: rows
      .filter((r) => (r.billing_model ?? 'premium') === 'premium')
      .map((r) => ({
        id: r.id,
        code: r.service_code ?? r.article_code ?? null,
        name: r.service_name ?? r.article_name ?? 'Avtalstjänst',
        quantity: Number(r.quantity),
        unit_price: Number(r.unit_price),
        total_price: Number(r.total_price),
        vat_rate: Number(r.vat_rate),
        discount_percent: Number(r.discount_percent ?? 0),
      })),
    equipment: rows
      .filter((r) => r.billing_model === 'per_year')
      .map((r) => ({
        id: r.id,
        contract_id: contractId,
        name: r.service_name ?? r.article_name ?? 'Utrustning',
        code: r.service_code ?? r.article_code ?? null,
        quantity: Number(r.quantity),
        unit_price_annual: Number(r.unit_price),
        vat_rate: Number(r.vat_rate),
      })),
  }
}

function buildRows(contract: ContractRow, sources: Sources, p: PlannedPeriod): RowSpec[] {
  const period = `${p.periodStart} t.o.m. ${p.periodEnd}`
  const diary = contract.diary_number ? ` (${contract.diary_number})` : ''
  const label = contract.label ?? contract.contract_type ?? 'avtal'
  const rows: RowSpec[] = []
  if (sources.premium.length > 0) {
    const divisor = periodDivisor(contract.billing_frequency ?? null)
    const scaled = sources.premium.map((it) => ({ it, total: Math.round((it.total_price * 100) / divisor) / 100 }))
    const sum = scaled.reduce((s, r) => s + r.total, 0)
    const factor = sum > 0 && Math.abs(sum - p.amount) >= 0.5 ? p.amount / sum : 1
    for (const r of scaled) {
      const total = Math.round(r.total * factor * 100) / 100
      rows.push({
        contract_id: contract.id,
        line_kind: 'premium',
        case_billing_item_id: r.it.id,
        article_code: r.it.code,
        article_name: `${r.it.name}, årspremie ${period}${diary}`,
        quantity: r.it.quantity,
        unit_price: r.it.quantity > 0 ? Math.round((total / r.it.quantity) * 100) / 100 : total,
        total_price: total,
        vat_rate: r.it.vat_rate,
        discount_percent: r.it.discount_percent,
      })
    }
  } else if (p.amount > 0) {
    rows.push({
      contract_id: contract.id,
      line_kind: 'premium',
      article_code: null,
      article_name: `Årspremie ${label}, ${period}${diary}`,
      quantity: 1,
      unit_price: p.amount,
      total_price: p.amount,
      vat_rate: 25,
      discount_percent: 0,
    })
  }
  for (const eq of p.equipmentRows) {
    rows.push({
      contract_id: contract.id,
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

/** Perioder som redan har faktura (per avtal, samlat eller Fortnox-import) på kunden. */
async function loadCoveredPeriods(customerId: string): Promise<{
  perContract: Map<string, Set<string>>
  consolidated: Set<string>
  fortnoxRanges: Array<{ start: string; end: string }>
}> {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_type, is_historical, is_consolidated, contract_id, billing_period_start, billing_period_end, invoice_items(contract_id)')
    .eq('customer_id', customerId)
    .in('invoice_type', ['contract', 'adhoc'])
  type Inv = {
    invoice_number: string | null
    invoice_type: string | null
    is_historical: boolean | null
    is_consolidated: boolean | null
    contract_id: string | null
    billing_period_start: string | null
    billing_period_end: string | null
    invoice_items: Array<{ contract_id: string | null }> | null
  }
  const perContract = new Map<string, Set<string>>()
  const consolidated = new Set<string>()
  const fortnoxRanges: Array<{ start: string; end: string }> = []
  for (const inv of (data ?? []) as Inv[]) {
    if (!inv.billing_period_start) continue
    if (inv.is_historical && (inv.invoice_number ?? '').startsWith('F-') && inv.billing_period_end) {
      fortnoxRanges.push({ start: inv.billing_period_start, end: inv.billing_period_end })
      continue
    }
    if (inv.invoice_type !== 'contract') continue
    if (inv.is_consolidated) {
      consolidated.add(inv.billing_period_start)
      for (const it of inv.invoice_items ?? []) {
        if (!it.contract_id) continue
        const set = perContract.get(it.contract_id) ?? new Set<string>()
        set.add(inv.billing_period_start)
        perContract.set(it.contract_id, set)
      }
      continue
    }
    const key = inv.contract_id ?? '__none__'
    const set = perContract.get(key) ?? new Set<string>()
    set.add(inv.billing_period_start)
    perContract.set(key, set)
  }
  return { perContract, consolidated, fortnoxRanges }
}

function coveredByFortnox(p: PlannedPeriod, ranges: Array<{ start: string; end: string }>): boolean {
  return ranges.some((r) => p.periodStart <= r.end && p.periodEnd >= r.start)
}

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  // Högsta befintliga sekvens, inte count(): count kolliderar efter radering.
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  let next = 1
  const match = data?.invoice_number ? /-(\d+)$/.exec(data.invoice_number) : null
  if (match) next = parseInt(match[1], 10) + 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

async function insertInvoice(
  customer: CustomerRow,
  orgNr: string | null,
  p: PlannedPeriod,
  rows: RowSpec[],
  opts: { contractId: string | null; consolidated: boolean; marking: string | null; notes: string }
): Promise<boolean> {
  if (rows.length === 0) return false
  const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
  const vat = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100
  const invNum = await generateInvoiceNumber()
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invNum,
      invoice_type: 'contract',
      customer_id: customer.id,
      contract_id: opts.contractId,
      is_consolidated: opts.consolidated,
      contract_invoice_kind: 'premium',
      case_id: null,
      case_type: null,
      customer_name: customer.company_name,
      customer_email: customer.billing_email ?? customer.contact_email,
      customer_phone: customer.contact_phone,
      customer_address: customer.billing_address ?? customer.contact_address,
      organization_number: orgNr,
      subtotal,
      vat_amount: vat,
      total_amount: Math.round((subtotal + vat) * 100) / 100,
      status: 'pending_approval',
      requires_approval: false,
      billing_period_start: p.periodStart,
      billing_period_end: p.periodEnd,
      due_date: p.dueDate,
      is_historical: false,
      invoice_marking: opts.marking,
      notes: opts.notes,
      created_at: parseLocalDate(p.invoiceDate).toISOString(),
    })
    .select('id')
    .single()
  if (error || !inv) {
    console.error('Kunde inte skapa faktura:', error?.message)
    return false
  }
  await supabase.from('invoice_items').insert(
    rows.map((r) => ({
      invoice_id: inv.id,
      contract_id: r.contract_id,
      line_kind: r.line_kind,
      case_billing_item_id: r.case_billing_item_id ?? null,
      article_id: null,
      article_code: r.article_code,
      article_name: r.article_name,
      quantity: r.quantity,
      unit_price: r.unit_price,
      total_price: r.total_price,
      vat_rate: r.vat_rate,
      discount_percent: r.discount_percent,
    }))
  )
  return true
}

/** Riktiga avtal på en kund: skapa saknade perioder inom horisonten. */
async function generateForCustomerContracts(customer: CustomerRow, contracts: ContractRow[], today: string): Promise<number> {
  const horizonEnd = rollingHorizonEnd()
  const orgNr = await resolveOrgNr(customer)
  const covered = await loadCoveredPeriods(customer.id)
  const consolidatedMode = customer.contract_invoice_mode === 'consolidated' && contracts.length > 1

  type Planned = { contract: ContractRow; sources: Sources; periods: PlannedPeriod[] }
  const planned: Planned[] = []
  for (const contract of contracts) {
    const sources = await loadSources(contract.id)
    // Rullande avtal: planera bortom slutdatumet tills avtalet sägs upp
    const periods = computePlannedPeriods(contract, {
      steps: sources.steps,
      equipment: sources.equipment,
      leadDays: DEFAULT_INVOICE_LEAD_DAYS,
      horizonEnd: contract.terminated_at ? undefined : horizonEnd,
      today,
    })
      // Aldrig passerade perioder från cronen: de importeras från Fortnox
      .filter((p) => !p.isHistorical && !coveredByFortnox(p, covered.fortnoxRanges))
    planned.push({ contract, sources, periods })
  }

  let created = 0

  if (consolidatedMode) {
    // Grupp = alla avtal med samma frekvens och ankarmånad
    const groups = new Map<string, Planned[]>()
    for (const pl of planned) {
      const key = `${pl.contract.billing_frequency ?? ''}|${pl.contract.billing_anchor_month ?? ''}`
      groups.set(key, [...(groups.get(key) ?? []), pl])
    }
    for (const group of groups.values()) {
      if (group.length === 1) {
        created += await createPerContract(customer, orgNr, group[0], covered.perContract)
        continue
      }
      const byPeriod = new Map<string, { p: PlannedPeriod; rows: RowSpec[]; labels: string[] }>()
      for (const pl of group) {
        for (const p of pl.periods) {
          const slot = byPeriod.get(p.periodStart) ?? { p: { ...p }, rows: [], labels: [] }
          slot.rows.push(...buildRows(pl.contract, pl.sources, p))
          if (p.invoiceDate < slot.p.invoiceDate) slot.p.invoiceDate = p.invoiceDate
          if (p.dueDate < slot.p.dueDate) slot.p.dueDate = p.dueDate
          if (p.periodEnd > slot.p.periodEnd) slot.p.periodEnd = p.periodEnd
          slot.labels.push(pl.contract.label ?? pl.contract.contract_type ?? 'Avtal')
          byPeriod.set(p.periodStart, slot)
        }
      }
      for (const [periodStart, slot] of byPeriod) {
        if (covered.consolidated.has(periodStart)) continue
        // Perioden redan fakturerad per avtal (t.ex. innan gemet slogs på): hoppa över
        if (group.some((pl) => covered.perContract.get(pl.contract.id)?.has(periodStart))) continue
        // Skapa bara när fakturadatumet är inne (ledtiden), annars nästa körning
        if (slot.p.invoiceDate > today) continue
        const ok = await insertInvoice(customer, orgNr, slot.p, slot.rows, {
          contractId: null,
          consolidated: true,
          marking: customer.billing_reference,
          notes: `Årspremie · Period ${slot.p.periodStart} t.o.m. ${slot.p.periodEnd} · Avtal: ${slot.labels.join(', ')}`,
        })
        if (ok) created++
      }
    }
    return created
  }

  for (const pl of planned) created += await createPerContract(customer, orgNr, pl, covered.perContract)
  return created
}

async function createPerContract(
  customer: CustomerRow,
  orgNr: string | null,
  pl: { contract: ContractRow; sources: Sources; periods: PlannedPeriod[] },
  perContract: Map<string, Set<string>>,
  today: string = toLocalIsoDate(todayLocal())
): Promise<number> {
  let created = 0
  const own = perContract.get(pl.contract.id) ?? new Set<string>()
  const legacy = perContract.get('__none__') ?? new Set<string>()
  for (const p of pl.periods) {
    if (own.has(p.periodStart) || legacy.has(p.periodStart)) continue
    if (p.invoiceDate > today) continue
    const ok = await insertInvoice(customer, orgNr, p, buildRows(pl.contract, pl.sources, p), {
      contractId: pl.contract.id,
      consolidated: false,
      marking: pl.contract.invoice_reference ?? customer.billing_reference,
      notes: `Årspremie ${pl.contract.label ?? ''} · Betalning ${p.sequenceNumber}/${p.totalSequenceCount} · Period ${p.periodStart} t.o.m. ${p.periodEnd}${
        pl.contract.diary_number ? ` · ${pl.contract.diary_number}` : ''
      }`.replace('  ', ' '),
    })
    if (ok) created++
  }
  return created
}

/** Kund utan avtalsrad: kundradens fält som förut, men aldrig passerade perioder. */
async function generateForSynthCustomer(customer: CustomerRow, today: string): Promise<number> {
  const orgNr = await resolveOrgNr(customer)
  const covered = await loadCoveredPeriods(customer.id)
  const periods = computePlannedPeriods(customer, {
    horizonEnd: customer.terminated_at ? undefined : rollingHorizonEnd(),
    today,
  }).filter((p) => !p.isHistorical && !coveredByFortnox(p, covered.fortnoxRanges))
  const existing = new Set<string>()
  for (const set of covered.perContract.values()) for (const k of set) existing.add(k)
  for (const k of covered.consolidated) existing.add(k)

  let created = 0
  for (const p of periods) {
    if (existing.has(p.periodStart) || p.invoiceDate > today) continue
    const ok = await insertInvoice(
      customer,
      orgNr,
      p,
      [
        {
          contract_id: null,
          line_kind: 'generic',
          article_code: null,
          article_name: `Årspremie, ${p.periodStart} t.o.m. ${p.periodEnd}`,
          quantity: 1,
          unit_price: p.amount,
          total_price: p.amount,
          vat_rate: 25,
          discount_percent: 0,
        },
      ],
      {
        contractId: null,
        consolidated: false,
        marking: customer.billing_reference,
        notes: `Årspremie · Betalning ${p.sequenceNumber}/${p.totalSequenceCount} · Period ${p.periodStart} t.o.m. ${p.periodEnd}`,
      }
    )
    if (ok) created++
  }
  return created
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('generate-continuing-contracts', async () => {
    const today = toLocalIsoDate(todayLocal())
    const horizon = rollingHorizonEnd()

    // 1. Riktiga avtal som är levande, faktureras och vars slut ligger inom horisonten
    const { data: contractRows, error: cErr } = await supabase
      .from('contracts')
      .select(
        'id, customer_id, label, contract_type, invoice_reference, diary_number, annual_value, contract_start_date, contract_end_date, terminated_at, effective_end_date, billing_frequency, billing_anchor_month, billing_active, notice_period_months, status, template_id, oneflow_contract_id, display_order'
      )
      .in('status', LIVE_STATUSES)
      .eq('type', 'contract')
      .not('billing_frequency', 'is', null)
      .lt('contract_end_date', horizon)
    if (cErr) throw cErr

    const byCustomer = new Map<string, ContractRow[]>()
    for (const c of (contractRows ?? []) as ContractRow[]) {
      if (!isLive(c, today) || isImported(c) || c.billing_active === false) continue
      if (!c.customer_id) continue
      byCustomer.set(c.customer_id, [...(byCustomer.get(c.customer_id) ?? []), c])
    }

    // 2. Kunder utan avtalsrad (synth) med passerat slutdatum, som förut
    const { data: synthCustomers, error: sErr } = await supabase
      .from('customers')
      .select('*')
      .lt('contract_end_date', today)
      .is('terminated_at', null)
      .eq('billing_active', true)
    if (sErr) throw sErr

    const results: Array<{ customer_id: string; company_name: string; created: number }> = []
    const errors: Array<{ customer_id: string; message: string }> = []

    for (const [customerId, contracts] of byCustomer) {
      try {
        const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single()
        if (!customer) continue
        const created = await generateForCustomerContracts(customer as CustomerRow, contracts, today)
        if (created > 0) results.push({ customer_id: customerId, company_name: (customer as CustomerRow).company_name, created })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`Fel vid regenerering av ${customerId}:`, message)
        errors.push({ customer_id: customerId, message })
      }
    }

    for (const c of (synthCustomers ?? []) as CustomerRow[]) {
      if (byCustomer.has(c.id)) continue
      // Kunder med någon levande avtalsrad hanteras av avtalsvägen, aldrig ur kundraden
      const { data: anyLive } = await supabase
        .from('contracts')
        .select('id')
        .eq('customer_id', c.id)
        .in('status', LIVE_STATUSES)
        .eq('type', 'contract')
        .limit(1)
      if (anyLive && anyLive.length > 0) continue
      try {
        const created = await generateForSynthCustomer(c, today)
        if (created > 0) results.push({ customer_id: c.id, company_name: c.company_name, created })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`Fel vid regenerering av ${c.id}:`, message)
        errors.push({ customer_id: c.id, message })
      }
    }

    return {
      status: errors.length > 0 ? ('partial' as const) : ('success' as const),
      summary: {
        customers_processed: byCustomer.size + (synthCustomers?.length ?? 0),
        total_invoices_created: results.reduce((sum, r) => sum + r.created, 0),
        details: results,
        errors,
      },
    }
  })

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage, ...result.summary })
  }
  return res.status(200).json({ success: true, ...result.summary })
}
