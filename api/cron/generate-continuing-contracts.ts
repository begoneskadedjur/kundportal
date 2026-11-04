// api/cron/generate-continuing-contracts.ts
// Förlängningar av avtal: den ENDA som skapar nästa bindningsperiods fakturor.
// Regeln (beslut 2026-10-15, contractPlanner.bindingWindow): Planera fakturor
// och signeringen planerar bara nuvarande bindningstid. Dagen efter sista
// uppsägningsdag (slutdatum minus uppsägningstid) utan uppsägning skapar
// cronen hela nästa bindningsperiods fakturor direkt, med fakturadatum
// periodstart minus ledtid men aldrig före idag. Saknade perioder inom
// nuvarande bindningstid skapas som förut när fakturadatumet är inne.
// Körs varje natt 03:00 UTC via Vercel Cron, så förlängningen hinner skapas
// före fakturadatumet även vid kort uppsägningstid. Idempotent: bara perioder
// som saknar faktura skapas.
//
// Torrkörning (steg 4 i planen för avtalsåret på exakt avtalsdag): dry=1
// räknar allt men skriver ingenting (inga fakturor, inga radbyten, ingen
// antalssynk av tilläggsstationer). Det som skulle ha skapats eller bytts
// hamnar i summeringen (would_create, would_refresh); bara loggraden i
// cron_runs skrivs. v2=1 eller CONTINUING_CONTRACTS_V2=1 tar med alla levande
// avtal oavsett slutdatum och frekvens. Båda är AV som standard, så den skarpa
// körningen 03:00 UTC går som förut. Torrkörningen 03:30 UTC ligger i
// api/cron/generate-continuing-contracts-dry.ts och kör dry + v2.
//
// Avtalskartan som motor (fas 2): läser AVTALEN (contracts), inte kundraden.
// Samma periodmatematik som webben (src/shared/contractPlanner.ts), samma
// källor (premietrappa, § 4-rader med billing_model = premium, § 6-rader med
// per_year) och samma faktureringsläge (customers.contract_invoice_mode:
// samlad faktura med en rad per avtal, eller en faktura per avtal).
// Cronen SKAPAR bara saknade perioder; den uppdaterar och raderar aldrig.
// Raderna, anteckningen och märkningen byggs med samma kod som Planera
// fakturor (src/shared/contractInvoiceRows.ts): källorna med
// contractSourcesFromRows, raderna med buildContractInvoiceRows. Ingen egen
// radbyggare här (sedan 2026-11-02).
// Kunder utan avtalsrad (synth) planeras från kundraden som förut, men
// perioder som redan passerat skapas aldrig här.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
// Täckningsnyckeln (typ + månad), överlappsmatchningen och Fortnox-täckningen
// delas med generatorn och signeringen: src/shared/contractInvoiceMatch.ts
//
// Steg 7 (avtalsåret på exakt avtalsdag): avtal med billing_anchor_mode =
// 'start_day' matchas på datumöverlapp (isCovered, findPlannedFor) och får
// generatorns Fortnox-regel; övriga avtal matchas på månad som förut. Med v2
// (torrkörningen, CONTINUING_CONTRACTS_V2) får även övriga avtal generatorns
// Fortnox-regel (minst halva perioden) i stället för "varje överlapp". Den
// skarpa körningen utan v2 är oförändrad för alla avtal utan exakt avtalsdag.
import {
  consolidationGroupKey,
  coveredByFortnox,
  cronFortnoxCovers,
  findPlannedFor,
  isCovered,
  matchModeFor,
  periodKey,
  type ExistingRange,
} from '../../src/shared/contractInvoiceMatch'
import {
  computePlannedEquipmentPeriods,
  computePlannedMonthlyEquipmentPeriods,
  computePlannedPeriods,
  type EquipmentInvoiceMode,
  isDueForCreation,
  parseLocalDate,
  rollingHorizonEnd,
  toLocalIsoDate,
  todayLocal,
  DEFAULT_INVOICE_LEAD_DAYS,
  type EquipmentLine,
  type PlannedPeriod,
  type PlanningContract,
  type PremiumStep,
} from '../../src/shared/contractPlanner'

// Steg 11: tilläggsregler version 2 (addon_rules = 'v2') följer premiens takt,
// en tilläggsfaktura per avtal och referenskod, glappfakturor. Gäller bara
// avtal med v2, oavsett ctx.v2; övriga avtal planeras exakt som förut.
import {
  computeAddonPlanV2,
  decorateV2Period,
  isAddonRulesV2,
  planIndexSlots,
  bucketKeyColumn,
  planGapGroups,
  type AddonPlanV2,
} from '../../src/shared/addonPlanV2'
import { markingKey, markingKeyColumn } from '../../src/shared/addonMarking'
import { loadAddonV2Inputs, type AddonV2Inputs } from '../../src/shared/addonV2Loader'
import { blockedGroupSlots, blockedSlotKey } from '../../src/shared/addonBillingGroups'
import {
  buildConsolidatedInvoiceNotes,
  buildContractInvoiceNotes,
  buildContractInvoiceRows,
  consolidatedInvoiceMarking,
  contractSourcesFromRows,
  CONTRACT_SOURCE_ITEM_COLUMNS,
  invoiceTotals,
  premiumLabel,
  toInvoiceItemRows,
  type ContractSourceItemRow,
  type ContractSourceLedgerRow,
  type ContractSourceStepRow,
  type ContractSourcesData,
  type InvoiceRowSpec,
} from '../../src/shared/contractInvoiceRows'

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
  renewal_mode?: string | null
}

type ContractRow = PlanningContract & {
  id: string
  customer_id: string
  label: string | null
  display_name?: string | null
  contract_type: string | null
  invoice_reference: string | null
  diary_number: string | null
  effective_end_date: string | null
  status: string | null
  template_id: string | null
  oneflow_contract_id: string | null
  display_order: number | null
  /** Steg 5: hämtas men läses inte ännu. NULL = dagens regel. */
  billing_anchor_mode?: string | null
  addon_rules?: string | null
}

/** En faktura som skulle ha skapats eller fått nya tilläggsrader. */
export type PlannedWrite = {
  customer_id: string
  company_name: string
  contract_id: string | null
  kind: string
  periodStart: string
  periodEnd: string
  subtotal: number
  action: 'create' | 'refresh'
  /** Fakturans märkning och anteckning (bara i minnet, för jämförelsen med Planera fakturor) */
  marking?: string | null
  notes?: string
  /** Raderna (bara i minnet, loggas inte i cron_runs) */
  rows?: InvoiceRowSpec[]
}

/**
 * Körningens läge. dryRun: inget skrivs, posterna samlas i planned.
 * v2: nytt urval (alla levande avtal oavsett slutdatum och frekvens).
 */
export type RunCtx = { dryRun: boolean; v2: boolean; planned: PlannedWrite[] }

/**
 * Enda vägen till skrivningar i cronen (samma mönster som signeringens
 * ctx.dryRun i api/_lib/contractSigning.ts). I torrkörning läggs posten i
 * ctx.planned, fn körs inte och dryValue returneras.
 */
async function write<T>(ctx: RunCtx, entry: PlannedWrite, dryValue: T, fn: () => Promise<T>): Promise<T> {
  if (ctx.dryRun) {
    ctx.planned.push(entry)
    return dryValue
  }
  return fn()
}

/** Fakturarad: samma typ som Planera fakturor */
type RowSpec = InvoiceRowSpec

/** Avtalets källor: samma som Planera fakturor (contractSourcesFromRows) */
type Sources = ContractSourcesData & {
  /** Var § 6 per år-rader hamnar: premiefakturan eller egna fakturor */
  equipmentInvoiceMode: EquipmentInvoiceMode
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

async function loadSources(ctx: RunCtx, contract: ContractRow): Promise<Sources> {
  const contractId = contract.id
  // Antal tilläggsstationer vid debiteringstillfället: synka § 6-raderna
  // från utplacerade stationer innan planen räknas (service role).
  // Synken skriver, så torrkörningen hoppar över den och läser raderna som de är.
  if (!ctx.dryRun) {
    try {
      await supabase.rpc('sync_addon_period_lines', { p_customer_id: null, p_contract_id: contractId, p_annual_price: null })
      await supabase.rpc('sync_addon_article_lines', { p_contract_id: contractId })
    } catch (err) {
      console.warn('Antalssynk av tilläggsstationer misslyckades:', err)
    }
  }
  const [{ data: steps }, { data: items }, { data: ledger }] = await Promise.all([
    supabase.from('contract_premium_events').select('effective_from, annual_value, event_type, note').eq('contract_id', contract.id),
    supabase
      .from('case_billing_items')
      .select(CONTRACT_SOURCE_ITEM_COLUMNS)
      .eq('case_id', contract.id)
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .neq('status', 'cancelled'),
    supabase.rpc('contract_addon_ledger', { p_contract_id: contract.id }),
  ])
  return {
    ...contractSourcesFromRows(
      contract.id,
      contract,
      (steps ?? []) as ContractSourceStepRow[],
      (items ?? []) as unknown as ContractSourceItemRow[],
      (ledger ?? []) as ContractSourceLedgerRow[]
    ),
    // Tillägg ligger bredvid avtalet och faktureras ALLTID på en egen faktura
    // i samband med årsfakturan (beslut 2026-09-30). customers.addon_invoice_mode
    // läses inte längre, kolumnen finns kvar som historik.
    equipmentInvoiceMode: 'separate',
  }
}

/** Fakturaraderna för en period: samma rader som Planera fakturor (src/shared/contractInvoiceRows.ts). */
function buildRows(contract: ContractRow, sources: Sources, p: PlannedPeriod): RowSpec[] {
  return buildContractInvoiceRows(contract.id, sources, p)
}

/** En befintlig faktura som intervall: ägare = avtalets id, '__none__' (utan avtal) eller '__consolidated__'. */
type CoveredRange = ExistingRange & { owner: string; kind: string; marking_key?: string | null; billing_group_id?: string | null }

type Covered = {
  perContract: Map<string, Set<string>>
  consolidated: Set<string>
  fortnoxRanges: Array<{ kind: string; start: string; end: string }>
  /** Samma fakturor som intervall, för avtal med exakt avtalsdag (steg 7) */
  ranges: CoveredRange[]
}

/** Befintliga fakturor för givna ägare och en fakturatyp, som intervall. */
function rangesFor(covered: Covered, owners: string[], kind: string): CoveredRange[] {
  return covered.ranges.filter((r) => owners.includes(r.owner) && r.kind === kind)
}

/** Perioder som redan har faktura (per avtal, samlat eller Fortnox-import) på kunden, per fakturatyp. */
async function loadCoveredPeriods(customerId: string): Promise<Covered> {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_type, is_historical, is_consolidated, contract_id, contract_invoice_kind, marking_key, addon_billing_group_id, billing_period_start, billing_period_end, status, invoice_items(contract_id)')
    .eq('customer_id', customerId)
    .in('invoice_type', ['contract', 'adhoc'])
    // Makulerade fakturor täcker ingen period (samma regel som planeraren)
    .neq('status', 'cancelled')
  type Inv = {
    id: string
    status: string | null
    invoice_number: string | null
    invoice_type: string | null
    is_historical: boolean | null
    is_consolidated: boolean | null
    contract_id: string | null
    contract_invoice_kind: string | null
    marking_key?: string | null
    addon_billing_group_id?: string | null
    billing_period_start: string | null
    billing_period_end: string | null
    invoice_items: Array<{ contract_id: string | null }> | null
  }
  const perContract = new Map<string, Set<string>>()
  const consolidated = new Set<string>()
  const fortnoxRanges: Array<{ kind: string; start: string; end: string }> = []
  const ranges: CoveredRange[] = []
  for (const inv of (data ?? []) as Inv[]) {
    if (!inv.billing_period_start) continue
    const kind = inv.contract_invoice_kind ?? 'premium'
    if (inv.is_historical && (inv.invoice_number ?? '').startsWith('F-') && inv.billing_period_end) {
      fortnoxRanges.push({ kind, start: inv.billing_period_start, end: inv.billing_period_end })
      continue
    }
    if (inv.invoice_type !== 'contract') continue
    const key = periodKey(kind, inv.billing_period_start)
    const range = {
      id: inv.id,
      status: inv.status,
      invoice_number: inv.invoice_number,
      start: inv.billing_period_start,
      end: inv.billing_period_end ?? inv.billing_period_start,
      kind,
      marking_key: inv.marking_key ?? null,
      billing_group_id: inv.addon_billing_group_id ?? null,
    }
    // Faktureringsgrupp: bara som intervall med grupp, aldrig i månadsnycklarna
    // (de gäller fakturorna utan grupp)
    if (inv.addon_billing_group_id && !inv.is_consolidated) {
      ranges.push({ ...range, owner: inv.contract_id ?? '__none__' })
      continue
    }
    if (inv.is_consolidated) {
      consolidated.add(key)
      ranges.push({ ...range, owner: '__consolidated__' })
      for (const it of inv.invoice_items ?? []) {
        if (!it.contract_id) continue
        const set = perContract.get(it.contract_id) ?? new Set<string>()
        set.add(key)
        perContract.set(it.contract_id, set)
        ranges.push({ ...range, owner: it.contract_id })
      }
      continue
    }
    const cKey = inv.contract_id ?? '__none__'
    const set = perContract.get(cKey) ?? new Set<string>()
    set.add(key)
    perContract.set(cKey, set)
    ranges.push({ ...range, owner: cKey })
  }
  return { perContract, consolidated, fortnoxRanges, ranges }
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
  ctx: RunCtx,
  customer: CustomerRow,
  orgNr: string | null,
  p: PlannedPeriod,
  rows: RowSpec[],
  opts: { contractId: string | null; consolidated: boolean; marking: string | null; notes: string; markingKey?: string | null; billingGroupId?: string | null }
): Promise<boolean> {
  if (rows.length === 0) return false
  const { subtotal } = invoiceTotals(rows)
  const entry: PlannedWrite = {
    customer_id: customer.id,
    company_name: customer.company_name,
    contract_id: opts.contractId,
    kind: p.kind ?? 'premium',
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    subtotal,
    action: 'create',
    marking: opts.marking,
    notes: opts.notes,
    rows,
  }
  return write(ctx, entry, true, () => insertInvoiceNow(customer, orgNr, p, rows, opts, subtotal))
}

async function insertInvoiceNow(
  customer: CustomerRow,
  orgNr: string | null,
  p: PlannedPeriod,
  rows: RowSpec[],
  opts: { contractId: string | null; consolidated: boolean; marking: string | null; notes: string; markingKey?: string | null; billingGroupId?: string | null },
  subtotal: number
): Promise<boolean> {
  const { vat } = invoiceTotals(rows)
  const invNum = await generateInvoiceNumber()
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invNum,
      invoice_type: 'contract',
      customer_id: customer.id,
      contract_id: opts.contractId,
      is_consolidated: opts.consolidated,
      contract_invoice_kind: p.kind ?? 'premium',
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
      // Nya tilläggsregler: märkningsnyckeln (undefined = gamla regler, kolumnen skrivs inte)
      ...(opts.markingKey !== undefined ? { marking_key: opts.markingKey } : {}),
      // Faktureringsgrupp (undefined = kolumnen skrivs inte)
      ...(opts.billingGroupId !== undefined ? { addon_billing_group_id: opts.billingGroupId } : {}),
    })
    .select('id')
    .single()
  if (error || !inv) {
    console.error('Kunde inte skapa faktura:', error?.message)
    return false
  }
  await supabase.from('invoice_items').insert(toInvoiceItemRows(inv.id, rows))
  return true
}

/** Nya tilläggsregler för ett avtal i cronen (steg 11). */
type CronV2 = {
  inputs: AddonV2Inputs
  plan: AddonPlanV2
  /** Märkning per tilläggsperiod: fakturans märkning, gruppnyckel och kolumnvärdet för marking_key */
  meta: Map<PlannedPeriod, { marking: string | null; key: string; keyColumn: string | null; groupId?: string; blocked?: boolean }>
  marking: string | null
}

type Planned = { contract: ContractRow; sources: Sources; periods: PlannedPeriod[]; equipmentPeriods: PlannedPeriod[]; v2?: CronV2 }

/**
 * Avtal med addon_rules = 'v2': premien som förut (med tilläggen på
 * månadsfakturan vid månadspremie), tilläggsfakturor per märkning med
 * premiens perioder eller avtalets årsdag. Stationerna bakom § 6-raderna
 * läses ur contract_addon_ledger (läser bara).
 */
async function planContractV2(
  contract: ContractRow,
  customer: CustomerRow,
  sources: Sources,
  planOpts: { steps: PremiumStep[]; equipment: EquipmentLine[]; leadDays: number; window: 'binding'; today: string },
  covered: Covered,
  fortnoxOpts: { mode: ReturnType<typeof matchModeFor>; v2: boolean }
): Promise<Planned> {
  // § 6-raderna bär redan stationerna ur contract_addon_ledger (loadSources)
  const marking = sources.invoiceReference ?? customer.billing_reference ?? null
  const inputs = await loadAddonV2Inputs(supabase, {
    contractId: contract.id,
    contractCustomerId: contract.customer_id,
    invoiceReference: sources.invoiceReference,
    lines: sources.equipment,
  })
  if (inputs.gapError) console.warn('Glappen kunde inte läsas:', inputs.gapError)
  const plan = computeAddonPlanV2(contract, inputs.lines, {
    ...planOpts,
    split: inputs.split,
    fallbackMarking: marking,
    coverage: inputs.coverage,
    billingGroups: inputs.billingGroups,
  })
  const withPremium = plan.cadence === 'with_premium'
  const periods = computePlannedPeriods(contract, {
    ...planOpts,
    equipment: withPremium ? plan.premiumEquipment : [],
    equipmentMode: withPremium ? 'with_premium' : 'separate',
  })
    .map((p) => (withPremium ? decorateV2Period(p, plan.premiumEquipment, inputs.coverage, marking) : p))
    .filter((p) => !p.isHistorical && !cronFortnoxCovers(p, covered.fortnoxRanges, fortnoxOpts))
  const meta: CronV2['meta'] = new Map()
  const equipmentPeriods: PlannedPeriod[] = []
  for (const g of plan.groups) {
    for (const p of g.periods) {
      if (p.isHistorical || cronFortnoxCovers(p, covered.fortnoxRanges, fortnoxOpts)) continue
      meta.set(p, { marking: g.marking, key: g.markingKey, keyColumn: inputs.split ? markingKeyColumn(g.marking ?? g.markingKey) : null })
      equipmentPeriods.push(p)
    }
  }
  // Tillägg per månad (steg 0): egna månadsfakturor utan märkningsnyckel,
  // samma väg som gamla reglernas equipment_monthly (avtalets märkning)
  for (const p of plan.monthly) {
    if (p.isHistorical || cronFortnoxCovers(p, covered.fortnoxRanges, fortnoxOpts)) continue
    equipmentPeriods.push(p)
  }
  // Faktureringsgrupper: egna fakturor per grupp, typ och märkning (samma
  // hinkar och samma spärr mot gamla unika indexet som Planera fakturor)
  if (plan.groupBuckets.length > 0) {
    const existingSlots = covered.ranges
      .filter((r) => r.owner === contract.id && (r.kind === 'equipment' || r.kind === 'equipment_monthly') && !(r.invoice_number ?? '').startsWith('F-'))
      .map((r) => ({ kind: r.kind, start: r.start, key: r.marking_key ?? '', groupId: r.billing_group_id ?? null }))
    const blocked = blockedGroupSlots(planIndexSlots(plan, inputs.split), existingSlots, inputs.groupSplit)
    for (const b of plan.groupBuckets) {
      const keyColumn = bucketKeyColumn(b, inputs.split)
      for (const p of b.periods) {
        if (p.isHistorical || cronFortnoxCovers(p, covered.fortnoxRanges, fortnoxOpts)) continue
        meta.set(p, {
          marking: b.marking,
          key: b.markingKey,
          keyColumn,
          groupId: b.billingGroupId,
          blocked: blocked.has(blockedSlotKey(b.billingGroupId, b.kind, p.periodStart, keyColumn)),
        })
        equipmentPeriods.push(p)
      }
    }
  }
  return { contract, sources, periods, equipmentPeriods, v2: { inputs, plan, meta, marking } }
}

/**
 * Glappfakturor (nya tilläggsregler): skapas bara när databasen tar typen
 * equipment_gap (drop-raderna från steg 5) och ingen glappfaktura med samma
 * märkning, första och sista dag finns. Skapas direkt, aldrig uppdaterade.
 */
async function createGapInvoices(ctx: RunCtx, customer: CustomerRow, orgNr: string | null, pl: Planned, covered: Covered, today: string): Promise<number> {
  const v2 = pl.v2!
  if (!v2.inputs.split || v2.inputs.gaps.length === 0) return 0
  const markingByKey = new Map<string, string | null>()
  for (const l of v2.inputs.lines) markingByKey.set(markingKey(l.marking ?? null), l.marking ?? null)
  for (const g of v2.inputs.billingGroups) if (g.marking?.trim()) markingByKey.set(markingKey(g.marking), g.marking.trim())
  const groups = planGapGroups(v2.inputs.gaps, {
    today,
    markingFor: (k) => markingByKey.get(k) ?? (k || null),
    codeFor: (unitId, typeId) => v2.inputs.lines.find((l) => l.site_customer_id === unitId && (l.station_type_id ?? null) === typeId)?.code ?? null,
  })
  const existing = rangesFor(covered, [pl.contract.id], 'equipment_gap')
  let created = 0
  for (const g of groups) {
    if (g.period.equipmentRows.length === 0) continue
    const dup = existing.some(
      (r) =>
        r.start === g.period.periodStart &&
        r.end === g.period.periodEnd &&
        markingKey(r.marking_key ?? '') === g.markingKey &&
        (r.billing_group_id ?? null) === (g.billingGroupId ?? null)
    )
    if (dup) continue
    const ok = await insertInvoice(ctx, customer, orgNr, g.period, buildRows(pl.contract, pl.sources, g.period), {
      contractId: pl.contract.id,
      consolidated: false,
      marking: g.marking,
      markingKey: markingKeyColumn(g.markingKey),
      ...(g.billingGroupId ? { billingGroupId: g.billingGroupId } : {}),
      notes: buildContractInvoiceNotes(g.period, pl.sources.label, pl.sources.diaryNumber),
    })
    if (ok) created++
  }
  return created
}

/** Ska perioden skapas i dag? Se contractPlanner.isDueForCreation. */
const dueToday = isDueForCreation

/** Riktiga avtal på en kund: skapa saknade perioder i bindningsfönstret. */
async function generateForCustomerContracts(ctx: RunCtx, customer: CustomerRow, contracts: ContractRow[], today: string): Promise<number> {
  const orgNr = await resolveOrgNr(customer)
  const covered = await loadCoveredPeriods(customer.id)
  const consolidatedMode = customer.contract_invoice_mode === 'consolidated' && contracts.length > 1

  const planned: Planned[] = []
  for (const contract of contracts) {
    const sources = await loadSources(ctx, contract)
    const fortnoxOpts = { mode: matchModeFor(contract), v2: ctx.v2 }
    const planOpts = {
      steps: sources.steps,
      equipment: sources.equipment,
      leadDays: DEFAULT_INVOICE_LEAD_DAYS,
      // Nuvarande bindningstid, plus nästa när sista uppsägningsdag passerat
      window: 'binding' as const,
      today,
    }
    if (isAddonRulesV2(contract)) {
      planned.push(await planContractV2(contract, customer, sources, planOpts, covered, fortnoxOpts))
      continue
    }
    const periods = computePlannedPeriods(contract, { ...planOpts, equipmentMode: sources.equipmentInvoiceMode })
      // Aldrig passerade perioder från cronen: de importeras från Fortnox
      .filter((p) => !p.isHistorical && !cronFortnoxCovers(p, covered.fortnoxRanges, fortnoxOpts))
    // Egna tilläggsfakturor: per år när avtalet fakturerar utrustning separat, per månad alltid
    const equipmentPeriods = [
      ...(sources.equipmentInvoiceMode === 'separate' ? computePlannedEquipmentPeriods(contract, planOpts) : []),
      ...computePlannedMonthlyEquipmentPeriods(contract, planOpts),
    ].filter((p) => !p.isHistorical && !cronFortnoxCovers(p, covered.fortnoxRanges, fortnoxOpts))
    planned.push({ contract, sources, periods, equipmentPeriods })
  }

  let created = 0
  // Tilläggsfakturor samlas aldrig: alltid per avtal
  for (const pl of planned) {
    created += await createPerContract(ctx, customer, orgNr, { contract: pl.contract, sources: pl.sources, periods: pl.equipmentPeriods, v2: pl.v2 }, covered, today)
    if (pl.v2) created += await createGapInvoices(ctx, customer, orgNr, pl, covered, today)
  }
  // Redigerbara fakturor vars utrustningsrader avviker från dagens antal
  for (const pl of planned) {
    created += 0
    await refreshEditableEquipmentInvoices(ctx, customer, orgNr, pl)
  }

  if (consolidatedMode) {
    // Grupp = alla avtal med samma frekvens och ankarmånad (exakt avtalsdag:
    // frekvens och avtalsdag), samma nyckel som generatorn
    const groups = new Map<string, Planned[]>()
    for (const pl of planned) {
      const key = consolidationGroupKey(pl.contract)
      groups.set(key, [...(groups.get(key) ?? []), pl])
    }
    for (const group of groups.values()) {
      if (group.length === 1) {
        created += await createPerContract(ctx, customer, orgNr, group[0], covered)
        continue
      }
      // Alla avtal i gruppen har samma läge (nyckeln skiljer lägena åt)
      const groupMode = matchModeFor(group[0].contract)
      const byPeriod = new Map<string, { p: PlannedPeriod; rows: RowSpec[]; labels: string[]; diaries: string[] }>()
      for (const pl of group) {
        for (const p of pl.periods) {
          const slot = byPeriod.get(p.periodStart) ?? { p: { ...p }, rows: [], labels: [], diaries: [] }
          slot.rows.push(...buildRows(pl.contract, pl.sources, p))
          if (p.renewal) slot.p.renewal = true
          if (p.invoiceDate < slot.p.invoiceDate) slot.p.invoiceDate = p.invoiceDate
          if (p.dueDate < slot.p.dueDate) slot.p.dueDate = p.dueDate
          if (p.periodEnd > slot.p.periodEnd) slot.p.periodEnd = p.periodEnd
          // Samma anteckning som Planera fakturor (planConsolidatedForCustomer)
          if (pl.sources.label) slot.labels.push(pl.sources.label)
          if (pl.sources.diaryNumber && !slot.diaries.includes(pl.sources.diaryNumber)) slot.diaries.push(pl.sources.diaryNumber)
          byPeriod.set(p.periodStart, slot)
        }
      }
      for (const [periodStart, slot] of byPeriod) {
        if (groupMode === 'overlap') {
          const range = { start: periodStart, end: slot.p.periodEnd }
          if (isCovered(range, rangesFor(covered, ['__consolidated__'], 'premium'), 'overlap')) continue
          if (group.some((pl) => isCovered(range, rangesFor(covered, [pl.contract.id], 'premium'), 'overlap'))) continue
        } else {
          const key = periodKey('premium', periodStart)
          if (covered.consolidated.has(key)) continue
          // Perioden redan fakturerad per avtal (t.ex. innan gemet slogs på): hoppa över
          if (group.some((pl) => covered.perContract.get(pl.contract.id)?.has(key))) continue
        }
        // Förlängning: direkt. Annars när fakturadatumet är inne (ledtiden).
        if (!dueToday(slot.p, today)) continue
        const ok = await insertInvoice(ctx, customer, orgNr, slot.p, slot.rows, {
          contractId: null,
          consolidated: true,
          marking: consolidatedInvoiceMarking(
            customer.billing_reference,
            group.map((pl) => pl.sources.invoiceReference)
          ),
          notes: buildConsolidatedInvoiceNotes(slot.p, slot.labels, slot.diaries),
        })
        if (ok) created++
      }
    }
    return created
  }

  for (const pl of planned) created += await createPerContract(ctx, customer, orgNr, pl, covered)
  return created
}

async function createPerContract(
  ctx: RunCtx,
  customer: CustomerRow,
  orgNr: string | null,
  pl: { contract: ContractRow; sources: Sources; periods: PlannedPeriod[]; v2?: CronV2 },
  covered: Covered,
  today: string = toLocalIsoDate(todayLocal())
): Promise<number> {
  let created = 0
  const own = covered.perContract.get(pl.contract.id) ?? new Set<string>()
  const legacy = covered.perContract.get('__none__') ?? new Set<string>()
  // legacy: typ + månad som förut; exakt avtalsdag: datumöverlapp
  const mode = matchModeFor(pl.contract)
  for (const p of pl.periods) {
    // Nya tilläggsregler: tilläggsfaktura per märkning
    const meta = pl.v2?.meta.get(p)
    if (meta) {
      // Fakturor utan märkningsnyckel (en per avtal) täcker alla märkningar
      // Faktureringsgrupp: bara gruppens egna fakturor (utan grupp: bara fakturor utan grupp)
      const existing = rangesFor(covered, [pl.contract.id, '__none__'], p.kind ?? 'premium').filter(
        (r) => (!r.marking_key || markingKey(r.marking_key) === meta.key) && (r.billing_group_id ?? null) === (meta.groupId ?? null)
      )
      if (isCovered({ start: p.periodStart, end: p.periodEnd }, existing, mode)) continue
      if (!dueToday(p, today)) continue
      // Krock med gamla unika indexet: väntar som i Planera fakturor
      if (meta.blocked) continue
      const rows = buildRows(pl.contract, pl.sources, p)
      const ok = await insertInvoice(ctx, customer, orgNr, p, rows, {
        contractId: pl.contract.id,
        consolidated: false,
        marking: meta.marking,
        markingKey: meta.keyColumn,
        ...(meta.groupId ? { billingGroupId: meta.groupId } : {}),
        notes: buildContractInvoiceNotes(p, pl.sources.label, pl.sources.diaryNumber),
      })
      if (ok) created++
      continue
    }
    if (mode === 'overlap') {
      const existing = rangesFor(covered, [pl.contract.id, '__none__'], p.kind ?? 'premium').filter((r) => !r.billing_group_id)
      if (isCovered({ start: p.periodStart, end: p.periodEnd }, existing, 'overlap')) continue
    } else {
      const key = periodKey(p.kind, p.periodStart)
      if (own.has(key) || legacy.has(key)) continue
    }
    if (!dueToday(p, today)) continue
    // Samma rader, märkning och anteckning som Planera fakturor (planForContract)
    const ok = await insertInvoice(ctx, customer, orgNr, p, buildRows(pl.contract, pl.sources, p), {
      contractId: pl.contract.id,
      consolidated: false,
      marking: pl.sources.invoiceReference ?? customer.billing_reference ?? null,
      notes: buildContractInvoiceNotes(p, pl.sources.label, pl.sources.diaryNumber),
    })
    if (ok) created++
  }
  return created
}

/**
 * Debitering mot antal vid debiteringstillfället: redigerbara avtalsfakturor
 * (draft, pending_approval, ready) vars utrustningsrader avviker från dagens
 * antal får raderna utbytta och summorna omräknade. Skickade fakturor rörs
 * aldrig. Rader som inte är utrustning måste vara oförändrade, annars lämnas
 * fakturan (manuellt justerad).
 */
async function refreshEditableEquipmentInvoices(
  ctx: RunCtx,
  customer: CustomerRow,
  orgNr: string | null,
  pl: Planned
): Promise<number> {
  void orgNr
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, status, contract_invoice_kind, marking_key, addon_billing_group_id, billing_period_start, billing_period_end, is_consolidated, invoice_items(id, line_kind, contract_id, total_price, quantity)')
    .eq('contract_id', pl.contract.id)
    .eq('invoice_type', 'contract')
    .in('status', ['draft', 'pending_approval', 'ready'])
  type Inv = {
    id: string
    status: string | null
    contract_invoice_kind: string | null
    marking_key?: string | null
    addon_billing_group_id?: string | null
    billing_period_start: string | null
    billing_period_end: string | null
    is_consolidated: boolean | null
    invoice_items: Array<{ id: string; line_kind: string | null; contract_id: string | null; total_price: number | null; quantity: number | null }> | null
  }
  // legacy: exakt samma periodstart (som förut); exakt avtalsdag: överlapp
  const mode = matchModeFor(pl.contract)
  const isEq = (k: string | null | undefined) => k === 'equipment_annual' || k === 'equipment_monthly'
  const sig = (rows: Array<{ line_kind?: string | null; total_price?: number | null; quantity?: number | null }>) =>
    rows.map((r) => `${r.line_kind ?? ''}|${Math.round(Number(r.total_price ?? 0) * 100)}|${r.quantity ?? ''}`).sort().join(';')
  let updated = 0
  for (const inv of (invoices ?? []) as Inv[]) {
    if (inv.is_consolidated || !inv.billing_period_start) continue
    const kind = inv.contract_invoice_kind ?? 'premium'
    // Nya tilläggsregler: bara perioder med fakturans märkning. Ett gammalt
    // utkast utan märkningsnyckel delas av Planera fakturor, inte här.
    if (pl.v2 && kind === 'equipment' && pl.v2.inputs.split && !inv.marking_key) continue
    const invGroup = inv.addon_billing_group_id ?? null
    const candidates = [...pl.periods, ...pl.equipmentPeriods].filter((p) => {
      if ((p.kind ?? 'premium') !== kind) return false
      const meta = pl.v2?.meta.get(p)
      // Faktureringsgrupp: fakturan och perioden i samma grupp (och märkning)
      if ((meta?.groupId ?? null) !== invGroup) return false
      if (meta?.groupId) return meta.key === markingKey(inv.marking_key ?? '')
      return !pl.v2 || kind !== 'equipment' || (meta?.key ?? '') === markingKey(inv.marking_key ?? '')
    })
    const plannedPeriod = findPlannedFor(candidates, { start: inv.billing_period_start, end: inv.billing_period_end }, mode)
    if (!plannedPeriod) continue
    const rows = buildRows(pl.contract, pl.sources, plannedPeriod)
    const existingRows = inv.invoice_items ?? []
    if (sig(rows) === sig(existingRows)) continue
    // Andra rader än utrustning måste vara oförändrade (annars manuellt justerad faktura)
    if (sig(rows.filter((r) => !isEq(r.line_kind))) !== sig(existingRows.filter((r) => !isEq(r.line_kind)))) continue
    const { subtotal, vat, total } = invoiceTotals(rows)
    const entry: PlannedWrite = {
      customer_id: customer.id,
      company_name: customer.company_name,
      contract_id: pl.contract.id,
      kind,
      periodStart: plannedPeriod.periodStart,
      periodEnd: plannedPeriod.periodEnd,
      subtotal,
      action: 'refresh',
      rows,
    }
    await write(ctx, entry, undefined, async () => {
      await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
      await supabase.from('invoice_items').insert(toInvoiceItemRows(inv.id, rows))
      await supabase
        .from('invoices')
        .update({
          subtotal,
          vat_amount: vat,
          total_amount: total,
          // Godkänd faktura vars rader ändrats ska granskas igen
          ...(inv.status === 'ready' ? { status: 'pending_approval' } : {}),
        })
        .eq('id', inv.id)
    })
    updated++
  }
  return updated
}

/**
 * Kund utan avtalsrad: kundradens fält, samma bindningsregel som avtalen,
 * aldrig passerade perioder. Inom bindningstiden fylls bara kunder vars
 * slutdatum passerat (som förut); förlängningen skapas för alla.
 */
async function generateForSynthCustomer(ctx: RunCtx, customer: CustomerRow, today: string): Promise<number> {
  const orgNr = await resolveOrgNr(customer)
  const covered = await loadCoveredPeriods(customer.id)
  const rolled = !!customer.contract_end_date && customer.contract_end_date < today
  const periods = computePlannedPeriods(customer, {
    window: 'binding',
    today,
  }).filter((p) => !p.isHistorical && !coveredByFortnox(p, covered.fortnoxRanges) && (rolled || !!p.renewal))
  const existing = new Set<string>()
  for (const set of covered.perContract.values()) for (const k of set) existing.add(k)
  for (const k of covered.consolidated) existing.add(k)

  let created = 0
  for (const p of periods) {
    // Nyckeln är typ + månad (periodKey) som i loadCoveredPeriods; en
    // jämförelse mot rå periodStart träffade aldrig.
    if (existing.has(periodKey(p.kind, p.periodStart)) || !dueToday(p, today)) continue
    const ok = await insertInvoice(
      ctx,
      customer,
      orgNr,
      p,
      [
        {
          contract_id: null,
          line_kind: 'generic',
          article_code: null,
          article_name: `${premiumLabel(p)}, ${p.periodStart} t.o.m. ${p.periodEnd}`,
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
        notes: `${premiumLabel(p)} · Period ${p.periodStart} t.o.m. ${p.periodEnd}`,
      }
    )
    if (ok) created++
  }
  return created
}

/** Högst så många poster i would_create och would_refresh i cron_runs. */
const PLANNED_LOG_LIMIT = 500

/** Posten i cron_runs: utan rader och anteckning (de finns bara i minnet) */
function logEntry(w: PlannedWrite): PlannedWrite {
  const { rows, notes, marking, ...rest } = w
  void rows
  void notes
  void marking
  return rest
}

/**
 * Själva körningen, utan loggning. Exporteras för torrkörningsposten och för
 * lokal torrkörning (då skrivs inte ens loggraden i cron_runs).
 */
export async function runContinuingContracts(ctx: RunCtx) {
  const today = toLocalIsoDate(todayLocal())
  const horizon = rollingHorizonEnd()

  // 1. Riktiga avtal som är levande och faktureras: slutdatum inom ett år
  //    (förlängningen kan bli säker) eller inget slutdatum (tills vidare).
  //    v2: alla levande avtal, oavsett slutdatum och frekvens.
  let contractQuery = supabase
    .from('contracts')
    .select(
      'id, customer_id, label, display_name, contract_type, invoice_reference, diary_number, annual_value, contract_start_date, contract_end_date, terminated_at, effective_end_date, billing_frequency, billing_anchor_month, billing_active, notice_period_months, renewal_mode, status, template_id, oneflow_contract_id, display_order, billing_anchor_mode, addon_rules'
    )
    .in('status', LIVE_STATUSES)
    .eq('type', 'contract')
  if (!ctx.v2) {
    contractQuery = contractQuery
      .not('billing_frequency', 'is', null)
      .or(`contract_end_date.is.null,contract_end_date.lt.${horizon}`)
  }
  const { data: contractRows, error: cErr } = await contractQuery
  if (cErr) throw cErr

  const byCustomer = new Map<string, ContractRow[]>()
  for (const c of (contractRows ?? []) as ContractRow[]) {
    if (!isLive(c, today) || isImported(c) || c.billing_active === false) continue
    if (!c.customer_id) continue
    byCustomer.set(c.customer_id, [...(byCustomer.get(c.customer_id) ?? []), c])
  }

  // 2. Kunder utan avtalsrad (synth) med slutdatum inom ett år. Kunder utan
  //    slutdatum och utan avtalsrad planeras inte här (som förut).
  const { data: synthCustomers, error: sErr } = await supabase
    .from('customers')
    .select('*')
    .lt('contract_end_date', horizon)
    .is('terminated_at', null)
    .eq('billing_active', true)
  if (sErr) throw sErr

  const results: Array<{ customer_id: string; company_name: string; created: number }> = []
  const errors: Array<{ customer_id: string; message: string }> = []

  for (const [customerId, contracts] of byCustomer) {
    try {
      const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single()
      if (!customer) continue
      const created = await generateForCustomerContracts(ctx, customer as CustomerRow, contracts, today)
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
      const created = await generateForSynthCustomer(ctx, c, today)
      if (created > 0) results.push({ customer_id: c.id, company_name: c.company_name, created })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Fel vid regenerering av ${c.id}:`, message)
      errors.push({ customer_id: c.id, message })
    }
  }

  const wouldCreate = ctx.planned.filter((w) => w.action === 'create')
  const wouldRefresh = ctx.planned.filter((w) => w.action === 'refresh')
  return {
    status: errors.length > 0 ? ('partial' as const) : ('success' as const),
    summary: {
      dry_run: ctx.dryRun,
      v2: ctx.v2,
      customers_processed: byCustomer.size + (synthCustomers?.length ?? 0),
      contracts_selected: [...byCustomer.values()].reduce((sum, list) => sum + list.length, 0),
      // I torrkörning skapas ingenting; details visar då vad som skulle ha skapats per kund
      total_invoices_created: ctx.dryRun ? 0 : results.reduce((sum, r) => sum + r.created, 0),
      details: results,
      errors,
      ...(ctx.dryRun
        ? {
            would_create_count: wouldCreate.length,
            would_refresh_count: wouldRefresh.length,
            would_create: wouldCreate.slice(0, PLANNED_LOG_LIMIT).map(logEntry),
            would_refresh: wouldRefresh.slice(0, PLANNED_LOG_LIMIT).map(logEntry),
          }
        : {}),
    },
  }
}

/** Gemensam handler: den skarpa posten och torrkörningsposten. */
export async function handleContinuingContracts(
  req: VercelRequest,
  res: VercelResponse,
  force: { dryRun?: boolean; v2?: boolean } = {}
) {
  if (!requireCronSecret(req, res)) return

  const ctx: RunCtx = {
    dryRun: force.dryRun === true || req.query.dry === '1',
    v2: force.v2 === true || req.query.v2 === '1' || process.env.CONTINUING_CONTRACTS_V2 === '1',
    planned: [],
  }
  // Torrkörningen loggas under eget namn så att den inte blandas ihop med den skarpa
  const jobName = ctx.dryRun ? 'generate-continuing-contracts-dry' : 'generate-continuing-contracts'
  const result = await withCronLog(jobName, () => runContinuingContracts(ctx))

  if (result.status === 'failed') {
    return res.status(500).json({ success: false, error: result.errorMessage, ...result.summary })
  }
  return res.status(200).json({ success: true, ...result.summary })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleContinuingContracts(req, res)
}
