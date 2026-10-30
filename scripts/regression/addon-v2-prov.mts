// scripts/regression/addon-v2-prov.mts
// Steg 11 (avtalsåret på avtalsdag): prov i minnet av tilläggsregler version 2.
// FEV (fyra avtal), WBAB (tre avtal) och Falu kommun får i MINNET
// billing_anchor_mode = 'start_day' och addon_rules = 'v2' (Falu dessutom
// målbilden ur datadokumentet: 2026-06-30 t.o.m. 2028-06-29, option, inget
// intervall). Inget skrivs: bara SELECT och läsande SQL-funktioner
// (contract_addon_ledger, invoice_marking_split_ready, addon_gap_candidates).
//
// Samma kod som Planera fakturor: computeAddonPlanV2, existingByMarkingGroup
// och buildContractDiff. Varje avtal körs i två lägen: split = som databasen
// säger i dag (falsk tills drop-raderna från steg 5 körts) och split = sant
// (läget efter drop-raderna). --refs=beslut lägger dessutom referenserna enligt
// beslut 8 i datadokumentet i minnet (FEV-enheternas koder, WBAB-avtalens).
//
//   npx tsx --env-file=.env scripts/regression/addon-v2-prov.mts --today=2026-10-30 [--refs=beslut]
//
// Skriver out/steg11/addon-v2-prov-<today>[-beslut].json och en läsbar
// sammanfattning på skärmen.

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeAddonPlanV2, dedupeLockedWithoutPlan, existingByMarkingGroup, type MarkedInvoice } from '../../src/shared/addonPlanV2'
import { loadAddonV2Inputs } from '../../src/shared/addonV2Loader'
import { markingKey } from '../../src/shared/addonMarking'
import { buildContractDiff, matchModeFor } from '../../src/shared/contractInvoiceMatch'
import { buildContractInvoiceRows } from '../../src/shared/contractInvoiceRows'
import type { EquipmentLine, PlanningContract } from '../../src/shared/contractPlanner'

const here = dirname(fileURLToPath(import.meta.url))
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const TODAY = arg('today') ?? '2026-10-30'
const REFS = arg('refs') ?? 'nu'
const sb = createClient(
  (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { persistSession: false } }
)

const PREFIXES = ['72818957', 'ad96ab94', '7c1f0e59', 'bca4c235', 'c01e3ee6', '5c00b63c', 'd86fbf4e', '23a115e3']
const COLS =
  'id, customer_id, label, display_name, contract_type, invoice_reference, diary_number, annual_value, contract_start_date, contract_end_date, terminated_at, effective_end_date, billing_frequency, billing_anchor_month, billing_active, notice_period_months, renewal_mode, status, billing_anchor_mode, addon_rules'

type C = PlanningContract & { id: string; customer_id: string; label: string | null; display_name: string | null; contract_type: string | null; invoice_reference: string | null; diary_number: string | null; addon_rules?: string | null }

const { data: all, error } = await sb.from('contracts').select(COLS).eq('type', 'contract').in('status', ['signed', 'active'])
if (error) throw error
const contracts = ((all ?? []) as C[]).filter((c) => PREFIXES.some((p) => c.id.startsWith(p)))

// Beslut 8 (datadokumentet): referenser i minnet
const fevUnitCode = (name: string): string | null => {
  const n = name.toLowerCase()
  if (n.includes('återvinning') || n.includes('åvc')) return '4019'
  if (n.includes('huvudkontor')) return '8315'
  if (n.includes('kraftvärme') || n.includes('kvv')) return '5037'
  if (['boda', 'enviken', 'främby', 'linghed', 'vika', 'sågmyra', 'reningsverk'].some((k) => n.includes(k))) return '3099'
  return null
}
const wbabContractRef: Record<string, string | null> = { '5c00b63c': 'YX201', c01e3ee6: 'YX301', d86fbf4e: null }

const out: unknown[] = []
for (const c0 of contracts.sort((a, b) => a.id.localeCompare(b.id))) {
  const c: C = { ...c0, billing_anchor_mode: 'start_day', addon_rules: 'v2' }
  if (c.id.startsWith('23a115e3')) {
    Object.assign(c, { contract_start_date: '2026-06-30', contract_end_date: '2028-06-29', renewal_mode: 'option', billing_frequency: null })
  }
  const isFev = ['72818957', 'ad96ab94', '7c1f0e59', 'bca4c235'].some((p) => c.id.startsWith(p))
  const wbabKey = Object.keys(wbabContractRef).find((p) => c.id.startsWith(p))
  if (REFS === 'beslut') {
    if (isFev) c.invoice_reference = null
    if (wbabKey) c.invoice_reference = wbabContractRef[wbabKey]
  }
  const label = (c.display_name && c.display_name.trim()) || c.label || c.contract_type || null

  const [{ data: steps }, { data: items }, { data: ledger }] = await Promise.all([
    sb.from('contract_premium_events').select('effective_from, annual_value').eq('contract_id', c.id),
    sb
      .from('case_billing_items')
      .select('id, service_code, article_code, service_name, article_name, quantity, unit_price, vat_rate, billing_model, billing_start_date, site_customer_id, station_type_id, status')
      .eq('case_id', c.id)
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .neq('status', 'cancelled'),
    sb.rpc('contract_addon_ledger', { p_contract_id: c.id }),
  ])
  const idsBy = new Map<string, string[]>()
  for (const l of (ledger ?? []) as Array<{ station_id: string; unit_id: string; station_type_id: string | null; removed_at: string | null }>) {
    if (l.removed_at) continue
    const k = `${l.unit_id}|${l.station_type_id ?? ''}`
    idsBy.set(k, [...(idsBy.get(k) ?? []), l.station_id])
  }
  type It = { id: string; service_code: string | null; article_code: string | null; service_name: string | null; article_name: string | null; quantity: number; unit_price: number; vat_rate: number; billing_model: string | null; billing_start_date: string | null; site_customer_id: string | null; station_type_id: string | null }
  const lines: EquipmentLine[] = ((items ?? []) as It[])
    .filter((r) => r.billing_model === 'per_year' || r.billing_model === 'per_month')
    .map((s) => ({
      id: s.id,
      contract_id: c.id,
      name: s.service_name ?? s.article_name ?? 'Utrustning',
      code: s.service_code ?? s.article_code ?? null,
      quantity: Number(s.quantity),
      unit_price_annual: s.billing_model === 'per_month' ? Number(s.unit_price) * 12 : Number(s.unit_price),
      unit_price_month: s.billing_model === 'per_month' ? Number(s.unit_price) : Number(s.unit_price) / 12,
      vat_rate: Number(s.vat_rate),
      billing_model: s.billing_model === 'per_month' ? ('per_month' as const) : ('per_year' as const),
      billing_start_date: s.billing_start_date,
      station_ids: s.site_customer_id ? (idsBy.get(`${s.site_customer_id}|${s.station_type_id ?? ''}`) ?? null) : null,
      site_customer_id: s.site_customer_id,
      station_type_id: s.station_type_id,
    }))

  const inputs = await loadAddonV2Inputs(sb, { contractId: c.id, contractCustomerId: c.customer_id, invoiceReference: c.invoice_reference, lines })
  if (REFS === 'beslut' && isFev) {
    // Enhetens kod enligt beslut 8, i minnet; enheter utan kod får huvudkontorets (tom)
    for (const l of inputs.lines) l.marking = fevUnitCode(l.unit_name ?? '') ?? l.marking ?? null
  }
  const { data: owner } = await sb.from('customers').select('company_name, billing_reference').eq('id', c.customer_id).maybeSingle()
  const fallbackMarking = c.invoice_reference ?? (owner as { billing_reference?: string | null } | null)?.billing_reference ?? null

  const { data: existingRaw } = await sb
    .from('invoices')
    .select('id, invoice_number, status, billing_period_start, billing_period_end, total_amount, subtotal, is_historical, invoice_type, contract_id, marking_key, fortnox_document_number, contract_invoice_kind')
    .eq('customer_id', c.customer_id)
    .in('invoice_type', ['contract', 'adhoc'])
    .eq('contract_invoice_kind', 'equipment')
    .neq('status', 'cancelled')
    .or(`contract_id.eq.${c.id},contract_id.is.null`)
  const existing = ((existingRaw ?? []) as MarkedInvoice[]).filter((e) => e.invoice_type === 'contract' || (e.invoice_number ?? '').startsWith('F-'))

  const modes = [{ split: inputs.split, name: inputs.split ? 'split (databasen tar märkning)' : 'i dag (en faktura per avtal)' }]
  if (!inputs.split) modes.push({ split: true, name: 'efter drop-raderna (en faktura per märkning)' })
  const result: Record<string, unknown> = {
    contract: c.id.slice(0, 8),
    label,
    customer: (owner as { company_name?: string } | null)?.company_name,
    annual_value: c.annual_value,
    frequency: c.billing_frequency,
    start: c.contract_start_date,
    end: c.contract_end_date,
    contract_ref: c.invoice_reference,
    gaps_from_db: inputs.gaps.length,
    modes: [] as unknown[],
  }
  for (const m of modes) {
    const plan = computeAddonPlanV2(c, inputs.lines, {
      window: 'binding',
      today: TODAY,
      leadDays: 40,
      paymentTermsDays: 30,
      steps: ((steps ?? []) as Array<{ effective_from: string; annual_value: number }>).map((s) => ({ effective_from: s.effective_from, annual_value: Number(s.annual_value) })),
      split: m.split,
      fallbackMarking,
      coverage: inputs.coverage,
    })
    const byKey = existingByMarkingGroup(plan.groups.map((g) => g.markingKey), m.split ? existing : existing.map((e) => ({ ...e, marking_key: null })))
    const invoices: unknown[] = []
    for (const [key, list] of byKey) {
      const g = plan.groups.find((x) => x.markingKey === key)
      const diff = dedupeLockedWithoutPlan(buildContractDiff(g?.periods ?? [], list, { real: true, mode: matchModeFor(c) }))
      for (const e of diff) {
        const ex = existing.find((x) => x.id === e.existingId)
        invoices.push({
          marking: g?.marking ?? key,
          marking_key_column: m.split ? (markingKey(g?.marking ?? key) || null) : null,
          action: e.action,
          existing: ex ? `${ex.invoice_number} ${ex.billing_period_start}..${ex.billing_period_end} ${ex.status} ${ex.subtotal}` : null,
          period: e.planned ? `${e.planned.periodStart} t.o.m. ${e.planned.periodEnd}` : null,
          subtotal: e.planned?.subtotal ?? null,
          rows: e.planned
            ? buildContractInvoiceRows(c.id, { premiumItems: [], equipment: inputs.lines, additionNotes: [], label, diaryNumber: c.diary_number }, e.planned).map(
                (r) => `${r.quantity} x ${r.unit_price} = ${r.total_price} | ${r.article_name}${r.station_ids ? ` | ${r.station_ids.length} stationer` : ''}`
              )
            : [],
          snapped: e.planned?.equipmentRows.filter((r) => r.billing_start_snapped).map((r) => r.billing_start_snapped) ?? [],
        })
      }
    }
    ;(result.modes as unknown[]).push({ mode: m.name, cadence: plan.cadence, invoices })
  }
  out.push(result)
}

const dir = join(here, 'out', 'steg11')
mkdirSync(dir, { recursive: true })
const file = join(dir, `addon-v2-prov-${TODAY}${REFS === 'beslut' ? '-beslut' : ''}.json`)
writeFileSync(file, JSON.stringify(out, null, 1) + '\n')
for (const r of out as Array<Record<string, unknown>>) {
  console.log(`\n${r.contract} ${r.customer} · ${r.label} · premie ${r.annual_value} ${r.frequency ?? 'utan intervall'} · ${r.start}..${r.end} · avtalsref ${r.contract_ref ?? '-'}`)
  for (const m of r.modes as Array<{ mode: string; cadence: string; invoices: Array<Record<string, unknown>> }>) {
    console.log(`  [${m.mode}] takt ${m.cadence}`)
    for (const i of m.invoices) {
      console.log(`    ${String(i.action).padEnd(7)} märkning ${i.marking || '(ingen)'} ${i.period ?? ''} ${i.subtotal ?? ''}${i.existing ? ` · befintlig ${i.existing}` : ''}${(i.snapped as string[]).length ? ` · snäppt ${(i.snapped as string[]).join(',')}` : ''}`)
      for (const row of i.rows as string[]) console.log(`        ${row}`)
    }
  }
}
console.log(`\nSkrev ${file}`)
