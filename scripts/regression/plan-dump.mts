// scripts/regression/plan-dump.mts
// Regressionsskript, steg 1 i docs/planer/avtalsar-exakt-arsdag-teknik.md.
//
// Läser prod med service role (ENDAST SELECT och läsande SQL-funktioner),
// räknar planerade fakturaperioder för alla levande avtal och för de
// synth-kunder som cronen planerar, matchar mot befintliga fakturor och
// skriver en deterministisk JSON-dump plus sha256.
//
// Körning:
//   npx tsx --env-file=.env scripts/regression/plan-dump.mts --today=2026-10-30
//
// Skriptet skriver ALDRIG till databasen. Det anropar inte
// sync_addon_period_lines eller sync_addon_article_lines (de skriver) utan
// läser § 6-raderna som de ligger. Alla RPC-anrop går via rpcRead() som bara
// släpper igenom läsande funktioner.
//
// Matchningen är en trogen kopia av koden i src/ och api/ (den är inte
// exporterad och src/ får inte ändras i steg 1). Varje kopia anger exakt
// vilken funktion och vilka rader den speglar, mot main f19104e1.

process.env.TZ = 'Europe/Stockholm'

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computePlannedEquipmentPeriods,
  computePlannedMonthlyEquipmentPeriods,
  computePlannedPeriods,
  isDueForCreation,
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
} from '../../src/shared/contractPlanner.ts'

// ---------------------------------------------------------------------------
// Argument och miljö
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const TODAY = arg('today') ?? toLocalIsoDate(todayLocal())
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) {
  console.error(`Ogiltigt --today: ${TODAY} (ska vara ÅÅÅÅ-MM-DD)`)
  process.exit(2)
}
const OUT_DIR = arg('out-dir') ?? join(here, 'out')
const GIT_SHA = execSync('git rev-parse --short=8 HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas. Kör med npx tsx --env-file=.env')
  process.exit(2)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Bara läsande SQL-funktioner (STABLE, inga skrivningar, kontrollerat med pg_get_functiondef 2026-10-30)
const READ_ONLY_RPCS = new Set(['contract_addon_ledger'])
async function rpcRead<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  if (!READ_ONLY_RPCS.has(fn)) throw new Error(`RPC ${fn} är inte godkänd som läsande`)
  const { data, error } = await sb.rpc(fn, params)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

/** SELECT med range-paginering (PostgREST klipper tyst vid 1 000 rader). */
async function selectAll<T>(
  table: string,
  columns: string,
  apply: (q: ReturnType<ReturnType<typeof sb.from>['select']>) => ReturnType<ReturnType<typeof sb.from>['select']> = (q) => q
): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const q = apply(sb.from(table).select(columns)).order('id', { ascending: true }).range(from, from + page - 1)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < page) break
  }
  return out
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

type ContractRow = PlanningContract & {
  id: string
  customer_id: string | null
  type: string | null
  label: string | null
  display_name: string | null
  contract_type: string | null
  invoice_reference: string | null
  diary_number: string | null
  effective_end_date: string | null
  status: string | null
  template_id: string | null
  oneflow_contract_id: string | null
  display_order: number | null
  created_at: string | null
}

type CustomerRow = PlanningContract & {
  id: string
  parent_customer_id: string | null
  contract_invoice_mode: string | null
  effective_end_date: string | null
}

type Invoice = {
  id: string
  customer_id: string | null
  invoice_number: string | null
  status: string | null
  invoice_type: string | null
  is_historical: boolean | null
  is_consolidated: boolean | null
  contract_id: string | null
  contract_invoice_kind: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  total_amount: number
  subtotal: number
  fortnox_document_number: string | null
  created_at: string | null
  invoice_items: InvoiceItem[]
}

type InvoiceItem = {
  id: string
  invoice_id: string
  contract_id: string | null
  line_kind: string | null
  total_price: number | null
  quantity: number | null
  article_name: string | null
}

type BillingItem = {
  id: string
  case_id: string
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
  billing_start_date: string | null
  site_customer_id: string | null
  station_type_id: string | null
  is_premium_carrier: boolean | null
  premium_share: number | string | null
}

type StepRow = { contract_id: string; effective_from: string; annual_value: number | string; event_type: string | null; note: string | null }
type LedgerRow = { station_id: string; kind: string; unit_id: string; station_type_id: string | null; removed_at: string | null }

type Sources = {
  steps: PremiumStep[]
  additionNotes: Array<{ effective_from: string; note: string }>
  premium: Array<{ id: string; code: string | null; name: string; quantity: number; unit_price: number; total_price: number; vat_rate: number; discount_percent: number }>
  equipment: EquipmentLine[]
}

// ---------------------------------------------------------------------------
// Läsning
// ---------------------------------------------------------------------------

const CONTRACT_COLS =
  'id, customer_id, type, label, display_name, contract_type, invoice_reference, diary_number, annual_value, contract_start_date, contract_end_date, terminated_at, effective_end_date, billing_frequency, billing_anchor_month, billing_active, notice_period_months, renewal_mode, status, template_id, oneflow_contract_id, display_order, created_at'

console.log(`Läser prod (endast SELECT), idag = ${TODAY}, sha = ${GIT_SHA}`)

const contracts = await selectAll<ContractRow>('contracts', CONTRACT_COLS, (q) =>
  q.eq('type', 'contract').in('status', ['signed', 'active'])
)
const customers = await selectAll<CustomerRow>(
  'customers',
  'id, parent_customer_id, contract_invoice_mode, annual_value, contract_start_date, contract_end_date, terminated_at, effective_end_date, billing_frequency, billing_anchor_month, billing_active, notice_period_months'
)
const customerById = new Map(customers.map((c) => [c.id, c]))
const contractIds = contracts.map((c) => c.id).sort(byStr)

const steps: StepRow[] = []
const items: BillingItem[] = []
for (const ids of chunks(contractIds, 100)) {
  steps.push(
    ...(await selectAll<StepRow>('contract_premium_events', 'id, contract_id, effective_from, annual_value, event_type, note', (q) =>
      q.in('contract_id', ids)
    ))
  )
  items.push(
    ...(await selectAll<BillingItem>(
      'case_billing_items',
      'id, case_id, article_code, article_name, service_code, service_name, quantity, unit_price, total_price, vat_rate, discount_percent, billing_model, billing_start_date, site_customer_id, station_type_id, is_premium_carrier, premium_share',
      (q) => q.in('case_id', ids).eq('case_type', 'contract').eq('item_type', 'service').neq('status', 'cancelled')
    ))
  )
}

const ledgerByContract = new Map<string, LedgerRow[]>()
for (const ids of chunks(contractIds, 8)) {
  await Promise.all(
    ids.map(async (id) => {
      ledgerByContract.set(id, (await rpcRead<LedgerRow[]>('contract_addon_ledger', { p_contract_id: id })) ?? [])
    })
  )
}

const invoicesRaw = await selectAll<Omit<Invoice, 'invoice_items'>>(
  'invoices',
  'id, customer_id, invoice_number, status, invoice_type, is_historical, is_consolidated, contract_id, contract_invoice_kind, billing_period_start, billing_period_end, total_amount, subtotal, fortnox_document_number, created_at'
)
const itemsByInvoice = new Map<string, InvoiceItem[]>()
for (const ids of chunks(invoicesRaw.map((i) => i.id), 100)) {
  const rows = await selectAll<InvoiceItem>('invoice_items', 'id, invoice_id, contract_id, line_kind, total_price, quantity, article_name', (q) =>
    q.in('invoice_id', ids)
  )
  for (const r of rows) itemsByInvoice.set(r.invoice_id, [...(itemsByInvoice.get(r.invoice_id) ?? []), r])
}
// PostgREST lämnar ordningen odefinierad; generatorns Map-uppslag låter den
// sista vinna vid flera fakturor i samma månad. Här fast ordning: created_at, id.
const invoices: Invoice[] = invoicesRaw
  .map((i) => ({
    ...i,
    total_amount: Number(i.total_amount),
    subtotal: Number(i.subtotal),
    invoice_items: (itemsByInvoice.get(i.id) ?? []).sort((a, b) => byStr(a.id, b.id)),
  }))
  .sort((a, b) => byStr(a.created_at ?? '', b.created_at ?? '') || byStr(a.id, b.id))
const invoicesByCustomer = new Map<string, Invoice[]>()
for (const inv of invoices) {
  if (!inv.customer_id) continue
  invoicesByCustomer.set(inv.customer_id, [...(invoicesByCustomer.get(inv.customer_id) ?? []), inv])
}

const { data: ptsRows, error: ptsErr } = await sb.from('payment_terms_settings').select('category, days_until_due')
if (ptsErr) throw new Error(`payment_terms_settings: ${ptsErr.message}`)
// Speglar PaymentTermsService.getDays('contract') (src/services/paymentTermsService.ts rad 24 till 56), fallback 30
const PAYMENT_TERMS_CONTRACT =
  ((ptsRows ?? []) as Array<{ category: string; days_until_due: number }>).find((r) => r.category === 'contract')?.days_until_due ?? 30

// ---------------------------------------------------------------------------
// Källor per avtal
// Speglar contractInvoiceGenerator.loadContractSources (rad 736 till 845) och
// cronens loadSources (rad 131 till 202), UTAN sync-RPC:erna.
// ---------------------------------------------------------------------------

const stepsByContract = new Map<string, StepRow[]>()
for (const s of steps) stepsByContract.set(s.contract_id, [...(stepsByContract.get(s.contract_id) ?? []), s])
const itemsByContract = new Map<string, BillingItem[]>()
for (const it of items) itemsByContract.set(it.case_id, [...(itemsByContract.get(it.case_id) ?? []), it])

function sourcesFor(contractId: string): Sources {
  const st = (stepsByContract.get(contractId) ?? []).slice().sort((a, b) => byStr(a.effective_from, b.effective_from) || byStr(String(a.annual_value), String(b.annual_value)))
  const rows = (itemsByContract.get(contractId) ?? []).slice().sort((a, b) => byStr(a.id, b.id))
  const stationIdsByRow = new Map<string, string[]>()
  for (const l of ledgerByContract.get(contractId) ?? []) {
    if (l.removed_at) continue
    const k = `${l.unit_id}|${l.station_type_id ?? ''}`
    stationIdsByRow.set(k, [...(stationIdsByRow.get(k) ?? []), l.station_id].sort(byStr))
  }
  return {
    steps: st.map((s) => ({ effective_from: s.effective_from, annual_value: Number(s.annual_value) })),
    additionNotes: st.filter((s) => s.event_type === 'addition' && !!s.note).map((s) => ({ effective_from: s.effective_from, note: s.note as string })),
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
      .filter((r) => r.billing_model === 'per_year' || r.billing_model === 'per_month')
      .map((r) => ({
        id: r.id,
        contract_id: contractId,
        name: r.service_name ?? r.article_name ?? 'Utrustning',
        code: r.service_code ?? r.article_code ?? null,
        quantity: Number(r.quantity),
        unit_price_annual: r.billing_model === 'per_month' ? Number(r.unit_price) * 12 : Number(r.unit_price),
        unit_price_month: r.billing_model === 'per_month' ? Number(r.unit_price) : Number(r.unit_price) / 12,
        vat_rate: Number(r.vat_rate),
        billing_model: r.billing_model === 'per_month' ? ('per_month' as const) : ('per_year' as const),
        billing_start_date: r.billing_start_date ?? null,
        station_ids: r.site_customer_id ? (stationIdsByRow.get(`${r.site_customer_id}|${r.station_type_id ?? ''}`) ?? null) : null,
      })),
  }
}

// ---------------------------------------------------------------------------
// Generatorns matchning (Planera fakturor)
// ---------------------------------------------------------------------------

// contractInvoiceGenerator.ts rad 269 till 270
const LOCKED_STATUSES = new Set(['booked', 'sent', 'paid'])
const EDITABLE_STATUSES = new Set(['draft', 'pending_approval', 'ready'])

/** contractInvoiceGenerator.ts monthKey, rad 317 till 319 */
function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

type GenEntry = {
  action: string
  planned?: PlannedPeriod
  existingId?: string
  existingStatus?: string
  existingAmount?: number
  existingSubtotal?: number
  reason?: string
  existingFortnoxNumber?: string | null
  duplicateIds?: string[]
}

type ExistingInvoice = Invoice & { has_generic_items: boolean }

/**
 * contractInvoiceGenerator.loadExisting, rad 853 till 884. Filtren i
 * PostgREST översatta till samma SQL-semantik: eq/neq släpper aldrig igenom
 * NULL (status <> 'cancelled' utesluter NULL, is_consolidated = false
 * utesluter NULL, contract_invoice_kind = kind utesluter NULL).
 */
function loadExisting(customerId: string, contractId: string | null, opts?: { consolidated?: boolean; kind?: string }): ExistingInvoice[] {
  const kind = opts?.kind ?? 'premium'
  return (invoicesByCustomer.get(customerId) ?? [])
    .filter((e) => e.invoice_type === 'contract' || e.invoice_type === 'adhoc')
    .filter((e) => e.contract_invoice_kind === kind)
    .filter((e) => e.status !== null && e.status !== 'cancelled')
    .filter((e) => {
      if (opts?.consolidated) return e.is_consolidated === true
      if (contractId) return (e.contract_id === contractId || e.contract_id === null) && e.is_consolidated === false
      return e.is_consolidated === false
    })
    .filter((e) => e.invoice_type === 'contract' || (e.invoice_number ?? '').startsWith('F-'))
    .map((e) => ({
      ...e,
      has_generic_items: e.invoice_items.length > 0 && e.invoice_items.every((it) => !it.line_kind),
    }))
}

/** contractInvoiceGenerator.loadConsolidatedPeriodsForContract, rad 887 till 895 */
function loadConsolidatedPeriodsForContract(customerId: string, contractId: string): Map<string, ExistingInvoice> {
  const map = new Map<string, ExistingInvoice>()
  for (const inv of loadExisting(customerId, null, { consolidated: true })) {
    if (!inv.billing_period_start) continue
    if (inv.invoice_items.some((it) => it.contract_id === contractId)) map.set(monthKey(inv.billing_period_start), inv)
  }
  return map
}

/** contractInvoiceGenerator.buildDiff, rad 924 till 1093, ordagrant i logiken. */
function buildDiff(
  planned: PlannedPeriod[],
  existing: ExistingInvoice[],
  opts: { real: boolean; compareRows?: boolean; consolidatedPeriods?: Map<string, ExistingInvoice> }
): GenEntry[] {
  const coveredRanges = existing
    .filter((e) => e.is_historical === true && !!e.invoice_number && e.invoice_number.startsWith('F-') && !!e.billing_period_start && !!e.billing_period_end)
    .map((e) => ({ start: e.billing_period_start as string, end: e.billing_period_end as string }))

  const overlapShare = (p: PlannedPeriod, r: { start: string; end: string }): number => {
    const ps = parseLocalDate(p.periodStart).getTime()
    const pe = parseLocalDate(p.periodEnd).getTime()
    const os = Math.max(ps, parseLocalDate(r.start).getTime())
    const oe = Math.min(pe, parseLocalDate(r.end).getTime())
    if (oe < os || pe <= ps) return 0
    return (oe - os) / (pe - ps)
  }
  const filteredPlanned = coveredRanges.length === 0 ? planned : planned.filter((p) => !coveredRanges.some((r) => overlapShare(p, r) >= 0.5))

  const contractInvoices = existing.filter((e) => e.invoice_type === 'contract' && !(e.invoice_number ?? '').startsWith('F-'))
  const plannedByKey = new Map(filteredPlanned.map((p) => [monthKey(p.periodStart), p]))
  const existingByKey = new Map(contractInvoices.filter((e) => e.billing_period_start).map((e) => [monthKey(e.billing_period_start as string), e]))

  const entries: GenEntry[] = []
  for (const p of filteredPlanned) {
    const consolidated = opts.consolidatedPeriods?.get(monthKey(p.periodStart))
    if (consolidated) {
      entries.push({
        action: 'consolidated',
        planned: p,
        existingId: consolidated.id,
        existingStatus: consolidated.status ?? undefined,
        existingAmount: consolidated.total_amount,
        existingSubtotal: consolidated.subtotal,
        reason: 'Ligger på kundens samlingsfaktura',
      })
      continue
    }
    const ex = existingByKey.get(monthKey(p.periodStart))
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
        entries.push({ action: 'backfill-historical-paid', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
      } else {
        entries.push({ action: 'keep', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
      }
      continue
    }
    if (LOCKED_STATUSES.has(status)) {
      entries.push({ action: 'locked', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: 'Faktura redan bokförd/skickad/betald' })
      continue
    }
    const amountMatches = Math.abs(Number(ex.subtotal) - p.subtotal) < 0.5
    const needsItemsRefresh = amountMatches && ex.has_generic_items === true
    entries.push({ action: amountMatches && !needsItemsRefresh ? 'keep' : 'update', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
  }

  const lastPlannedStart = filteredPlanned.reduce((m, p) => (p.periodStart > m ? p.periodStart : m), '')
  for (const ex of contractInvoices) {
    if (!ex.billing_period_start) continue
    if (plannedByKey.has(monthKey(ex.billing_period_start))) continue
    const status = ex.status ?? 'draft'
    if (LOCKED_STATUSES.has(status)) {
      entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
    } else if (EDITABLE_STATUSES.has(status)) {
      const afterPlan = !!lastPlannedStart && monthKey(ex.billing_period_start) > monthKey(lastPlannedStart)
      entries.push({
        action: 'delete',
        existingId: ex.id,
        existingStatus: status,
        existingAmount: ex.total_amount,
        existingSubtotal: ex.subtotal,
        ...(afterPlan ? { reason: 'Efter nuvarande bindningstid: planeras igen dagen efter sista uppsägningsdag om avtalet inte sägs upp' } : {}),
      })
    } else {
      entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: `Okänd status "${status}" - rör ej` })
    }
  }

  const byId = new Map(contractInvoices.map((e) => [e.id, e]))
  return entries.map((e) => {
    if (!e.existingId) return e
    const ex = byId.get(e.existingId)
    if (!ex) return e
    const key = ex.billing_period_start ? monthKey(ex.billing_period_start) : null
    const duplicateIds = key
      ? contractInvoices
          .filter((o) => o.id !== ex.id && !!o.billing_period_start && monthKey(o.billing_period_start) === key && EDITABLE_STATUSES.has(o.status ?? 'draft') && !o.fortnox_document_number)
          .map((o) => o.id)
      : []
    return { ...e, existingFortnoxNumber: ex.fortnox_document_number ?? null, ...(duplicateIds.length ? { duplicateIds } : {}) }
  })
}

// ---------------------------------------------------------------------------
// Dumpens rader
// ---------------------------------------------------------------------------

type OwnerType = 'contract' | 'synth' | 'consolidated'
type GenOut = {
  action: string
  existing_id: string | null
  existing_status: string | null
  existing_subtotal: number | null
  existing_total: number | null
  existing_fortnox_number: string | null
  duplicate_ids: string[]
  reason: string | null
}
type CronOut = { action: string; refresh_invoice_id: string | null }
type Row = {
  key: string
  owner_type: OwnerType
  owner_id: string
  contract_id: string | null
  customer_id: string | null
  kind: string
  periodStart: string
  periodEnd: string | null
  planned: PlannedPeriod | null
  generator: GenOut | null
  cron: CronOut | null
  cron_planned: PlannedPeriod | null
}

const rowsByKey = new Map<string, Row>()

/** Fast fältordning i PlannedPeriod så att JSON blir byte för byte stabil. */
function normPlanned(p: PlannedPeriod | undefined | null): PlannedPeriod | null {
  if (!p) return null
  return {
    kind: p.kind,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    amount: p.amount,
    annualInForce: p.annualInForce,
    equipmentRows: p.equipmentRows.map((r) => ({
      source_id: r.source_id,
      contract_id: r.contract_id,
      name: r.name,
      code: r.code,
      quantity: r.quantity,
      unit_price: r.unit_price,
      total_price: r.total_price,
      vat_rate: r.vat_rate,
    })),
    subtotal: p.subtotal,
    vatAmount: p.vatAmount,
    totalAmount: p.totalAmount,
    invoiceDate: p.invoiceDate,
    dueDate: p.dueDate,
    isHistorical: p.isHistorical,
    sequenceNumber: p.sequenceNumber,
    totalSequenceCount: p.totalSequenceCount,
    renewal: p.renewal ?? false,
  }
}

function rowFor(owner_type: OwnerType, owner_id: string, contract_id: string | null, customer_id: string | null, kind: string, periodStart: string, existingOnlyId?: string): Row {
  const key = existingOnlyId ? `${owner_type}:${owner_id}|E|${kind}|${existingOnlyId}` : `${owner_type}:${owner_id}|P|${kind}|${periodStart}`
  let r = rowsByKey.get(key)
  if (!r) {
    r = { key, owner_type, owner_id, contract_id, customer_id, kind, periodStart, periodEnd: null, planned: null, generator: null, cron: null, cron_planned: null }
    rowsByKey.set(key, r)
  }
  return r
}

function addGenEntry(owner_type: OwnerType, owner_id: string, contract_id: string | null, customer_id: string | null, kind: string, e: GenEntry, existingLookup: Map<string, Invoice>) {
  const ex = e.existingId ? existingLookup.get(e.existingId) : undefined
  const periodStart = e.planned?.periodStart ?? ex?.billing_period_start ?? ''
  const r = rowFor(owner_type, owner_id, contract_id, customer_id, kind, periodStart, e.planned ? undefined : e.existingId)
  if (e.planned) {
    r.planned = normPlanned(e.planned)
    r.periodEnd = e.planned.periodEnd
  } else {
    r.periodEnd = ex?.billing_period_end ?? null
  }
  r.generator = {
    action: e.action,
    existing_id: e.existingId ?? null,
    existing_status: e.existingStatus ?? null,
    existing_subtotal: e.existingSubtotal ?? null,
    existing_total: e.existingAmount ?? null,
    existing_fortnox_number: e.existingFortnoxNumber ?? null,
    duplicate_ids: (e.duplicateIds ?? []).slice().sort(byStr),
    reason: e.reason ?? null,
  }
}

function addPlanned(owner_type: OwnerType, owner_id: string, contract_id: string | null, customer_id: string | null, p: PlannedPeriod) {
  const r = rowFor(owner_type, owner_id, contract_id, customer_id, p.kind ?? 'premium', p.periodStart)
  if (!r.planned) {
    r.planned = normPlanned(p)
    r.periodEnd = p.periodEnd
  }
  return r
}

function setCron(owner_type: OwnerType, owner_id: string, contract_id: string | null, customer_id: string | null, p: PlannedPeriod, action: string) {
  const r = rowFor(owner_type, owner_id, contract_id, customer_id, p.kind ?? 'premium', p.periodStart)
  const np = normPlanned(p)
  if (!r.planned) {
    // Generatorn planerade inte perioden (avtalet ingår inte där): cronens plan är radens plan
    r.planned = np
    r.periodEnd = p.periodEnd
  }
  r.cron = { action, refresh_invoice_id: r.cron?.refresh_invoice_id ?? null }
  r.cron_planned = JSON.stringify(r.planned) === JSON.stringify(np) ? null : np
}

/**
 * Perioder som buildDiff tyst släpper för att en Fortnox-import (F-) täcker
 * minst halva perioden (generatorn rad 955 till 958). Generatorn visar dem
 * inte; dumpen märker dem med pseudoåtgärden 'tackt_av_fortnox' så att de syns.
 */
function recordFortnoxCovered(owner_type: OwnerType, owner_id: string, contract_id: string | null, customer_id: string | null, planned: PlannedPeriod[], entries: GenEntry[]) {
  const seen = new Set(entries.filter((e) => e.planned).map((e) => `${e.planned!.kind}|${e.planned!.periodStart}`))
  for (const p of planned) {
    if (seen.has(`${p.kind}|${p.periodStart}`)) continue
    const r = addPlanned(owner_type, owner_id, contract_id, customer_id, p)
    r.generator = { action: 'tackt_av_fortnox', existing_id: null, existing_status: null, existing_subtotal: null, existing_total: null, existing_fortnox_number: null, duplicate_ids: [], reason: null }
  }
}

const invoiceById = new Map(invoices.map((i) => [i.id, i]))

// ---------------------------------------------------------------------------
// Generatorn: Planera fakturor för varje levande avtal
// Speglar planCombinedForCustomer / planAllForCustomer / planForContract /
// planEquipmentEntries / planConsolidatedForCustomer (rad 347 till 723).
// ---------------------------------------------------------------------------

/** src/utils/contractLifecycle.ts isEndedContract/isLiveContract, rad 60 till 99 */
function genIsLive(c: ContractRow): boolean {
  if ((c.status ?? '') === 'ended') return false
  if (!c.terminated_at) return true
  const end = c.effective_end_date ?? c.contract_end_date ?? null
  if (!end) return false
  return !(end < TODAY)
}

function genPlanOpts(sources: Sources) {
  return {
    paymentTermsDays: PAYMENT_TERMS_CONTRACT,
    steps: sources.steps,
    equipment: sources.equipment,
    leadDays: DEFAULT_INVOICE_LEAD_DAYS,
    window: 'binding' as const,
    today: TODAY,
  }
}

/** planEquipmentEntries, rad 493 till 539 (equipmentInvoiceMode är alltid 'separate', rad 839). */
function genEquipment(contract: ContractRow, sources: Sources, customerId: string) {
  const owner = contract.id
  const eqPlanned = computePlannedEquipmentPeriods(contract, {
    paymentTermsDays: PAYMENT_TERMS_CONTRACT,
    steps: sources.steps,
    equipment: sources.equipment,
    leadDays: DEFAULT_INVOICE_LEAD_DAYS,
    window: 'binding',
    today: TODAY,
  })
  const eqEntries = buildDiff(eqPlanned, loadExisting(customerId, contract.id, { kind: 'equipment' }), { real: true })
  recordFortnoxCovered('contract', owner, contract.id, customerId, eqPlanned, eqEntries)
  for (const e of eqEntries) {
    addGenEntry('contract', owner, contract.id, customerId, 'equipment', e, invoiceById)
  }
  const monthly = computePlannedMonthlyEquipmentPeriods(contract, {
    paymentTermsDays: PAYMENT_TERMS_CONTRACT,
    equipment: sources.equipment,
    window: 'binding',
    today: TODAY,
  })
  const existingMonthly = loadExisting(customerId, contract.id, { kind: 'equipment_monthly' })
  if (monthly.length > 0 || existingMonthly.length > 0) {
    const mEntries = buildDiff(monthly, existingMonthly, { real: true })
    recordFortnoxCovered('contract', owner, contract.id, customerId, monthly, mEntries)
    for (const e of mEntries) {
      addGenEntry('contract', owner, contract.id, customerId, 'equipment_monthly', e, invoiceById)
    }
  }
}

/** planForContract, rad 428 till 486 (riktigt avtal). */
function genPlanForContract(contract: ContractRow, customerId: string) {
  const sources = sourcesFor(contract.id)
  const planned = computePlannedPeriods(contract, { ...genPlanOpts(sources), equipmentMode: 'separate' })
  const existing = loadExisting(customerId, contract.id, { kind: 'premium' })
  const consolidatedPeriods = loadConsolidatedPeriodsForContract(customerId, contract.id)
  const entries = buildDiff(planned, existing, { real: true, consolidatedPeriods })
  recordFortnoxCovered('contract', contract.id, contract.id, customerId, planned, entries)
  for (const e of entries) {
    addGenEntry('contract', contract.id, contract.id, customerId, 'premium', e, invoiceById)
  }
  genEquipment(contract, sources, customerId)
}

/** getActiveContracts (contractService.ts rad 1886 till 1908) utan synth-fallback, sorterad som där. */
function liveContractsOn(customerId: string): ContractRow[] {
  return contracts
    .filter((c) => c.customer_id === customerId && genIsLive(c))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || byStr(a.created_at ?? '', b.created_at ?? '') || byStr(a.id, b.id))
}

/** liveContractsForFamily, rad 363 till 382 (synth-raderna faller bort: bara riktiga avtal räknas här). */
function liveContractsForFamily(customerId: string): ContractRow[] {
  const own = liveContractsOn(customerId)
  const seen = new Set(own.map((c) => c.id))
  const all = [...own]
  for (const unit of customers.filter((u) => u.parent_customer_id === customerId).sort((a, b) => byStr(a.id, b.id))) {
    for (const c of liveContractsOn(unit.id)) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      all.push(c)
    }
  }
  return all
}

const genMode = new Map<string, string>()

/** planConsolidatedForCustomer, rad 581 till 723. */
function genConsolidated(headId: string) {
  const family = liveContractsForFamily(headId)
  const groups = new Map<string, ContractRow[]>()
  for (const c of family) {
    const key = `${c.billing_frequency ?? ''}|${c.billing_anchor_month ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  for (const [gkey, group] of groups) {
    if (group.length === 1) {
      genMode.set(group[0].id, 'per_avtal_via_samlingskund')
      genPlanForContract(group[0], headId)
      continue
    }
    const owner = `${headId}|${gkey}`
    const byPeriod = new Map<string, PlannedPeriod>()
    for (const contract of group) {
      genMode.set(contract.id, `samlad:${owner}`)
      const sources = sourcesFor(contract.id)
      const periods = computePlannedPeriods(contract, { ...genPlanOpts(sources), equipmentMode: 'separate' })
      for (const p of periods) {
        // Avtalets egen period syns i dumpen, men diffen görs på samlingsraden
        const r = addPlanned('contract', contract.id, contract.id, contract.customer_id, p)
        r.generator = { action: 'samlad', existing_id: null, existing_status: null, existing_subtotal: null, existing_total: null, existing_fortnox_number: null, duplicate_ids: [], reason: owner }
        const slot = byPeriod.get(p.periodStart) ?? { ...p, amount: 0, subtotal: 0, vatAmount: 0, totalAmount: 0, equipmentRows: [] }
        slot.amount += p.amount
        slot.subtotal = Math.round((slot.subtotal + p.subtotal) * 100) / 100
        slot.vatAmount = Math.round((slot.vatAmount + p.vatAmount) * 100) / 100
        slot.totalAmount = Math.round((slot.subtotal + slot.vatAmount) * 100) / 100
        if (p.invoiceDate < slot.invoiceDate) slot.invoiceDate = p.invoiceDate
        if (p.dueDate < slot.dueDate) slot.dueDate = p.dueDate
        if (p.periodEnd > slot.periodEnd) slot.periodEnd = p.periodEnd
        byPeriod.set(p.periodStart, slot)
      }
      genEquipment(contract, sources, headId)
    }
    const planned = [...byPeriod.values()]
      .sort((a, b) => byStr(a.periodStart, b.periodStart))
      .map((p, i, arr) => ({ ...p, sequenceNumber: i + 1, totalSequenceCount: arr.length }))
    const entries = buildDiff(planned, loadExisting(headId, null, { consolidated: true }), { real: true, compareRows: true })
    recordFortnoxCovered('consolidated', owner, null, headId, planned, entries)
    const groupIds = new Set(group.map((c) => c.id))
    for (const ex of loadExisting(headId, null).filter((e) => e.contract_id && groupIds.has(e.contract_id))) {
      if (!ex.billing_period_start || !byPeriod.has(ex.billing_period_start)) continue
      const status = ex.status ?? 'draft'
      if (EDITABLE_STATUSES.has(status)) {
        entries.push({ action: 'delete', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: 'Ersätts av samlingsfakturan' })
      } else if (LOCKED_STATUSES.has(status)) {
        entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: 'Redan skickad per avtal, samlingsfakturan hoppar över perioden' })
        const idx = entries.findIndex((en) => en.planned?.periodStart === ex.billing_period_start && en.action === 'create')
        if (idx >= 0) entries.splice(idx, 1)
      }
    }
    for (const e of entries) addGenEntry('consolidated', owner, null, headId, 'premium', e, invoiceById)
  }
}

// planCombinedForCustomer (rad 389 till 398): kundens läge styr. Varje avtal
// planeras från sin egen kundrad (planAllForCustomer rad 353); avtal på en
// kund i samlingsläge planeras via samlingskunden.
const consolidatedHeads = [...new Set(contracts.filter((c) => c.customer_id).map((c) => c.customer_id as string))]
  .filter((id) => customerById.get(id)?.contract_invoice_mode === 'consolidated')
  .sort(byStr)
for (const head of consolidatedHeads) genConsolidated(head)
for (const c of [...contracts].sort((a, b) => byStr(a.id, b.id))) {
  if (genMode.has(c.id)) continue
  if (!c.customer_id) {
    genMode.set(c.id, 'saknar_kund')
    continue
  }
  if (!genIsLive(c)) {
    genMode.set(c.id, 'ej_levande')
    continue
  }
  genMode.set(c.id, 'per_avtal')
  genPlanForContract(c, c.customer_id)
}

// ---------------------------------------------------------------------------
// Cronen: generate-continuing-contracts (api/cron/generate-continuing-contracts.ts)
// ---------------------------------------------------------------------------

/** cronens isLive, rad 120 till 125 (skiljer sig från livscykelns: uppsagt utan slutdatum räknas som levande) */
function cronIsLive(c: ContractRow): boolean {
  if (c.status === 'ended') return false
  if (!c.terminated_at) return true
  const last = c.effective_end_date ?? c.contract_end_date
  return !last || last >= TODAY
}

/** rad 127 till 129 */
function isImported(c: ContractRow): boolean {
  return c.template_id === 'imported' || (c.oneflow_contract_id ?? '').startsWith('imported-')
}

/** periodKey, rad 293 till 296 */
function periodKey(kind: string | null | undefined, periodStart: string): string {
  return `${kind ?? 'premium'}|${periodStart.slice(0, 7)}`
}

/** loadCoveredPeriods, rad 299 till 350 */
function loadCoveredPeriods(customerId: string) {
  const perContract = new Map<string, Set<string>>()
  const consolidated = new Set<string>()
  const fortnoxRanges: Array<{ kind: string; start: string; end: string }> = []
  const rows = (invoicesByCustomer.get(customerId) ?? [])
    .filter((i) => i.invoice_type === 'contract' || i.invoice_type === 'adhoc')
    .filter((i) => i.status !== null && i.status !== 'cancelled')
  for (const inv of rows) {
    if (!inv.billing_period_start) continue
    const kind = inv.contract_invoice_kind ?? 'premium'
    if (inv.is_historical && (inv.invoice_number ?? '').startsWith('F-') && inv.billing_period_end) {
      fortnoxRanges.push({ kind, start: inv.billing_period_start, end: inv.billing_period_end })
      continue
    }
    if (inv.invoice_type !== 'contract') continue
    const key = periodKey(kind, inv.billing_period_start)
    if (inv.is_consolidated) {
      consolidated.add(key)
      for (const it of inv.invoice_items) {
        if (!it.contract_id) continue
        const set = perContract.get(it.contract_id) ?? new Set<string>()
        set.add(key)
        perContract.set(it.contract_id, set)
      }
      continue
    }
    const cKey = inv.contract_id ?? '__none__'
    const set = perContract.get(cKey) ?? new Set<string>()
    set.add(key)
    perContract.set(cKey, set)
  }
  return { perContract, consolidated, fortnoxRanges }
}

/** coveredByFortnox, rad 352 till 354 */
function coveredByFortnox(p: PlannedPeriod, ranges: Array<{ kind: string; start: string; end: string }>): boolean {
  return ranges.some((r) => r.kind === (p.kind ?? 'premium') && p.periodStart <= r.end && p.periodEnd >= r.start)
}

type RowSpec = { line_kind: string; quantity: number; total_price: number }

/** buildRows, rad 204 till 290. Bara fälten som behövs för radantal och signatur. */
function buildRows(contract: ContractRow, sources: Sources, p: PlannedPeriod): RowSpec[] {
  const rows: RowSpec[] = []
  if (p.kind === 'equipment' || p.kind === 'equipment_monthly') {
    for (const eq of p.equipmentRows) {
      rows.push({ line_kind: p.kind === 'equipment_monthly' ? 'equipment_monthly' : 'equipment_annual', quantity: eq.quantity, total_price: eq.total_price })
    }
    return rows
  }
  if (sources.premium.length > 0) {
    const divisor = periodDivisor(contract.billing_frequency ?? null)
    const scaled = sources.premium.map((it) => ({ it, total: Math.round((it.total_price * 100) / divisor) / 100 }))
    const sum = scaled.reduce((s, r) => s + r.total, 0)
    const factor = sum > 0 && Math.abs(sum - p.amount) >= 0.5 ? p.amount / sum : 1
    for (const r of scaled) {
      const total = Math.round(r.total * factor * 100) / 100
      rows.push({ line_kind: 'premium', quantity: r.it.quantity, total_price: total })
    }
  } else if (p.amount > 0) {
    rows.push({ line_kind: 'premium', quantity: 1, total_price: p.amount })
  }
  for (const eq of p.equipmentRows) rows.push({ line_kind: 'equipment_annual', quantity: eq.quantity, total_price: eq.total_price })
  for (const step of sources.additionNotes) {
    if (step.effective_from < p.periodStart || step.effective_from > p.periodEnd) continue
    rows.push({ line_kind: 'index_note', quantity: 0, total_price: 0 })
  }
  return rows
}

type CronPlanned = { contract: ContractRow; sources: Sources; periods: PlannedPeriod[]; equipmentPeriods: PlannedPeriod[] }

/** createPerContract, rad 529 till 559 */
function cronCreatePerContract(pl: { contract: ContractRow; sources: Sources; periods: PlannedPeriod[] }, perContract: Map<string, Set<string>>) {
  const own = perContract.get(pl.contract.id) ?? new Set<string>()
  const legacy = perContract.get('__none__') ?? new Set<string>()
  for (const p of pl.periods) {
    const key = periodKey(p.kind, p.periodStart)
    let action: string
    if (own.has(key) || legacy.has(key)) action = 'finns'
    else if (!isDueForCreation(p, TODAY)) action = 'ej_dags'
    else if (buildRows(pl.contract, pl.sources, p).length === 0) action = 'inga_rader'
    else action = 'skapas'
    setCron('contract', pl.contract.id, pl.contract.id, pl.contract.customer_id, p, action)
  }
}

/** refreshEditableEquipmentInvoices, rad 568 till 634 (bara beslutet, ingen skrivning) */
function cronRefresh(pl: CronPlanned) {
  const isEq = (k: string | null | undefined) => k === 'equipment_annual' || k === 'equipment_monthly'
  const sig = (rows: Array<{ line_kind?: string | null; total_price?: number | null; quantity?: number | null }>) =>
    rows.map((r) => `${r.line_kind ?? ''}|${Math.round(Number(r.total_price ?? 0) * 100)}|${r.quantity ?? ''}`).sort().join(';')
  const editable = invoices.filter(
    (i) => i.contract_id === pl.contract.id && i.invoice_type === 'contract' && ['draft', 'pending_approval', 'ready'].includes(i.status ?? '')
  )
  for (const inv of editable) {
    if (inv.is_consolidated || !inv.billing_period_start) continue
    const kind = inv.contract_invoice_kind ?? 'premium'
    const plannedPeriod = [...pl.periods, ...pl.equipmentPeriods].find((p) => (p.kind ?? 'premium') === kind && p.periodStart === inv.billing_period_start)
    if (!plannedPeriod) continue
    const rows = buildRows(pl.contract, pl.sources, plannedPeriod)
    const existingRows = inv.invoice_items
    if (sig(rows) === sig(existingRows)) continue
    if (sig(rows.filter((r) => !isEq(r.line_kind))) !== sig(existingRows.filter((r) => !isEq(r.line_kind)))) continue
    const r = rowFor('contract', pl.contract.id, pl.contract.id, pl.contract.customer_id, kind, plannedPeriod.periodStart)
    r.cron = { action: r.cron?.action ?? 'okand', refresh_invoice_id: inv.id }
  }
}

/** generateForCustomerContracts, rad 442 till 527 */
function cronForCustomerContracts(customer: CustomerRow, list: ContractRow[]) {
  const covered = loadCoveredPeriods(customer.id)
  const consolidatedMode = customer.contract_invoice_mode === 'consolidated' && list.length > 1
  const planned: CronPlanned[] = []
  for (const contract of list) {
    const sources = sourcesFor(contract.id)
    const planOpts = { steps: sources.steps, equipment: sources.equipment, leadDays: DEFAULT_INVOICE_LEAD_DAYS, window: 'binding' as const, today: TODAY }
    const all = computePlannedPeriods(contract, { ...planOpts, equipmentMode: 'separate' })
    const allEq = [...computePlannedEquipmentPeriods(contract, planOpts), ...computePlannedMonthlyEquipmentPeriods(contract, planOpts)]
    const keep = (p: PlannedPeriod) => {
      if (p.isHistorical) {
        setCron('contract', contract.id, contract.id, contract.customer_id, p, 'historisk')
        return false
      }
      if (coveredByFortnox(p, covered.fortnoxRanges)) {
        setCron('contract', contract.id, contract.id, contract.customer_id, p, 'fortnox')
        return false
      }
      return true
    }
    planned.push({ contract, sources, periods: all.filter(keep), equipmentPeriods: allEq.filter(keep) })
  }
  for (const pl of planned) cronCreatePerContract({ contract: pl.contract, sources: pl.sources, periods: pl.equipmentPeriods }, covered.perContract)
  for (const pl of planned) cronRefresh(pl)

  if (consolidatedMode) {
    const groups = new Map<string, CronPlanned[]>()
    for (const pl of planned) {
      const key = `${pl.contract.billing_frequency ?? ''}|${pl.contract.billing_anchor_month ?? ''}`
      groups.set(key, [...(groups.get(key) ?? []), pl])
    }
    for (const [gkey, group] of groups) {
      if (group.length === 1) {
        // Cronen anropar här createPerContract utan today (rad 490), alltså
        // verklig dag. Skriptet använder --today för att vara deterministiskt.
        cronCreatePerContract(group[0], covered.perContract)
        continue
      }
      const owner = `${customer.id}|${gkey}`
      const byPeriod = new Map<string, { p: PlannedPeriod; rowCount: number }>()
      for (const pl of group) {
        for (const p of pl.periods) {
          setCron('contract', pl.contract.id, pl.contract.id, pl.contract.customer_id, p, 'samlad')
          const slot = byPeriod.get(p.periodStart) ?? { p: { ...p }, rowCount: 0 }
          slot.rowCount += buildRows(pl.contract, pl.sources, p).length
          if (p.renewal) slot.p.renewal = true
          if (p.invoiceDate < slot.p.invoiceDate) slot.p.invoiceDate = p.invoiceDate
          if (p.dueDate < slot.p.dueDate) slot.p.dueDate = p.dueDate
          if (p.periodEnd > slot.p.periodEnd) slot.p.periodEnd = p.periodEnd
          byPeriod.set(p.periodStart, slot)
        }
      }
      for (const [periodStart, slot] of byPeriod) {
        const key = periodKey('premium', periodStart)
        let action: string
        if (covered.consolidated.has(key)) action = 'finns'
        else if (group.some((pl) => covered.perContract.get(pl.contract.id)?.has(key))) action = 'finns_per_avtal'
        else if (!isDueForCreation(slot.p, TODAY)) action = 'ej_dags'
        else if (slot.rowCount === 0) action = 'inga_rader'
        else action = 'skapas'
        setCron('consolidated', owner, null, customer.id, slot.p, action)
      }
    }
    return
  }
  for (const pl of planned) cronCreatePerContract(pl, covered.perContract)
}

/** generateForSynthCustomer, rad 641 till 685 */
function cronForSynth(customer: CustomerRow) {
  const covered = loadCoveredPeriods(customer.id)
  const rolled = !!customer.contract_end_date && customer.contract_end_date < TODAY
  const all = computePlannedPeriods(customer, { window: 'binding', today: TODAY })
  const existing = new Set<string>()
  for (const set of covered.perContract.values()) for (const k of set) existing.add(k)
  for (const k of covered.consolidated) existing.add(k)
  for (const p of all) {
    let action: string
    if (p.isHistorical) action = 'historisk'
    else if (coveredByFortnox(p, covered.fortnoxRanges)) action = 'fortnox'
    else if (!(rolled || !!p.renewal)) action = 'inom_bindning_ej_rullad'
    else if (existing.has(periodKey(p.kind, p.periodStart))) action = 'finns'
    else if (!isDueForCreation(p, TODAY)) action = 'ej_dags'
    else action = 'skapas'
    addPlanned('synth', customer.id, null, customer.id, p)
    setCron('synth', customer.id, null, customer.id, p, action)
  }
  // Matchning med generatorns buildDiff (synth-läget, real = false) på samma
  // binding-plan, så att dumpen visar vilken befintlig faktura varje period
  // paras med. Generatorn själv planerar synth utan bindningsfönster
  // (planForContract rad 444 till 449); här används fönstret enligt steg 1.
  const synthEntries = buildDiff(all, loadExisting(customer.id, null), { real: false })
  recordFortnoxCovered('synth', customer.id, null, customer.id, all, synthEntries)
  for (const e of synthEntries) {
    addGenEntry('synth', customer.id, null, customer.id, 'premium', e, invoiceById)
  }
}

// handler, rad 687 till 770
const HORIZON = rollingHorizonEnd(parseLocalDate(TODAY))
const cronSkip = new Map<string, string | null>()
const cronByCustomer = new Map<string, ContractRow[]>()
for (const c of [...contracts].sort((a, b) => byStr(a.id, b.id))) {
  // DB-urvalet rad 703 till 704
  if (c.billing_frequency === null) cronSkip.set(c.id, 'frekvens_saknas')
  else if (c.contract_end_date !== null && !(c.contract_end_date < HORIZON)) cronSkip.set(c.id, 'slutdatum_minst_ett_ar_fram')
  // rad 709 till 710
  else if (!cronIsLive(c)) cronSkip.set(c.id, 'ej_levande')
  else if (isImported(c)) cronSkip.set(c.id, 'importerat')
  else if (c.billing_active === false) cronSkip.set(c.id, 'fakturering_pausad')
  else if (!c.customer_id) cronSkip.set(c.id, 'saknar_kund')
  else {
    cronSkip.set(c.id, null)
    cronByCustomer.set(c.customer_id, [...(cronByCustomer.get(c.customer_id) ?? []), c])
  }
}
// Cronen hämtar avtalen utan ordning; inom kunden här i id-ordning
for (const [customerId, list] of [...cronByCustomer].sort((a, b) => byStr(a[0], b[0]))) {
  const customer = customerById.get(customerId)
  if (!customer) continue
  cronForCustomerContracts(customer, list.sort((a, b) => byStr(a.id, b.id)))
}

// Synth-urvalet rad 716 till 722 och 740 till 750
const synthCustomers = customers
  .filter((c) => c.contract_end_date !== null && c.contract_end_date < HORIZON && c.terminated_at === null && c.billing_active === true)
  .filter((c) => !cronByCustomer.has(c.id))
  .filter((c) => !contracts.some((k) => k.customer_id === c.id))
  .sort((a, b) => byStr(a.id, b.id))
for (const c of synthCustomers) cronForSynth(c)

// Avtalens egna premieperioder som varken generatorn eller cronen satt (till
// exempel avtal utan kund eller ej levande): planerade perioder ändå, så att
// dumpen omfattar alla levande avtal.
for (const c of contracts) {
  const mode = genMode.get(c.id)
  if (mode !== 'saknar_kund' && mode !== 'ej_levande') continue
  const sources = sourcesFor(c.id)
  const opts = genPlanOpts(sources)
  for (const p of [
    ...computePlannedPeriods(c, { ...opts, equipmentMode: 'separate' }),
    ...computePlannedEquipmentPeriods(c, opts),
    ...computePlannedMonthlyEquipmentPeriods(c, opts),
  ]) {
    addPlanned('contract', c.id, c.id, c.customer_id, p)
  }
}

// ---------------------------------------------------------------------------
// Utskrift
// ---------------------------------------------------------------------------

const rows = [...rowsByKey.values()].sort(
  (a, b) =>
    byStr(a.owner_type === 'synth' ? 'synth' : 'a', b.owner_type === 'synth' ? 'synth' : 'a') ||
    byStr(a.owner_id, b.owner_id) ||
    byStr(a.kind, b.kind) ||
    byStr(a.periodStart, b.periodStart) ||
    byStr(a.key, b.key)
)

const contractSummaries = [...contracts]
  .sort((a, b) => byStr(a.id, b.id))
  .map((c) => {
    const s = sourcesFor(c.id)
    const ledger = (ledgerByContract.get(c.id) ?? []).filter((l) => !l.removed_at)
    return {
      contract_id: c.id,
      customer_id: c.customer_id,
      label: c.display_name?.trim() || c.label || c.contract_type || null,
      status: c.status,
      billing_frequency: c.billing_frequency,
      billing_anchor_month: c.billing_anchor_month,
      contract_start_date: c.contract_start_date,
      contract_end_date: c.contract_end_date,
      terminated_at: c.terminated_at,
      effective_end_date: c.effective_end_date,
      renewal_mode: c.renewal_mode ?? null,
      notice_period_months: c.notice_period_months,
      billing_active: c.billing_active,
      annual_value: c.annual_value === null ? null : Number(c.annual_value),
      customer_invoice_mode: c.customer_id ? (customerById.get(c.customer_id)?.contract_invoice_mode ?? null) : null,
      generator_mode: genMode.get(c.id) ?? null,
      cron_selected: cronSkip.get(c.id) === null,
      cron_skip_reason: cronSkip.get(c.id) ?? null,
      premium_steps: s.steps,
      premium_items: s.premium.map((p) => ({ id: p.id, total_price: p.total_price, quantity: p.quantity })),
      equipment_lines: s.equipment.map((e) => ({
        id: e.id,
        billing_model: e.billing_model,
        quantity: e.quantity,
        unit_price_annual: e.unit_price_annual,
        billing_start_date: e.billing_start_date ?? null,
        station_ids: e.station_ids ?? null,
      })),
      addon_ledger_active: ledger.length,
    }
  })

const synthSummaries = synthCustomers.map((c) => ({
  customer_id: c.id,
  billing_frequency: c.billing_frequency,
  billing_anchor_month: c.billing_anchor_month,
  contract_start_date: c.contract_start_date,
  contract_end_date: c.contract_end_date,
  notice_period_months: c.notice_period_months,
  annual_value: c.annual_value === null ? null : Number(c.annual_value),
}))

function histogram(values: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of [...values].sort(byStr)) out[v] = (out[v] ?? 0) + 1
  return out
}

const dump = {
  meta: {
    kind: 'plan-dump',
    format: 1,
    today: TODAY,
    git_sha: GIT_SHA,
    payment_terms_days_contract: PAYMENT_TERMS_CONTRACT,
    lead_days: DEFAULT_INVOICE_LEAD_DAYS,
    cron_horizon: HORIZON,
    counts: {
      live_contracts: contracts.length,
      cron_selected_contracts: contractSummaries.filter((c) => c.cron_selected).length,
      synth_customers: synthSummaries.length,
      owners: contracts.length + synthSummaries.length,
      rows: rows.length,
      generator_actions: histogram(rows.filter((r) => r.generator).map((r) => r.generator!.action)),
      cron_actions: histogram(rows.filter((r) => r.cron).map((r) => r.cron!.action)),
      cron_refresh: rows.filter((r) => r.cron?.refresh_invoice_id).length,
      generator_modes: histogram(contractSummaries.map((c) => c.generator_mode ?? 'okand')),
      cron_skip_reasons: histogram(contractSummaries.map((c) => c.cron_skip_reason ?? 'valt')),
    },
  },
  contracts: contractSummaries,
  synth_customers: synthSummaries,
  rows,
}

mkdirSync(OUT_DIR, { recursive: true })
const fileName = `plan-${TODAY}-${GIT_SHA}.json`
const filePath = join(OUT_DIR, fileName)
const body = JSON.stringify(dump, null, 1) + '\n'
writeFileSync(filePath, body, 'utf8')
const hash = createHash('sha256').update(body, 'utf8').digest('hex')
writeFileSync(`${filePath}.sha256`, `${hash}  ${fileName}\n`, 'utf8')

console.log(`Skrev ${filePath}`)
console.log(`Avtal: ${contracts.length} (cronen väljer ${dump.meta.counts.cron_selected_contracts}), synth-kunder: ${synthSummaries.length}, rader: ${rows.length}`)
console.log(`Generatorn: ${JSON.stringify(dump.meta.counts.generator_actions)}`)
console.log(`Cronen: ${JSON.stringify(dump.meta.counts.cron_actions)}, byter tilläggsrader: ${dump.meta.counts.cron_refresh}`)
console.log(`sha256 ${hash}`)
