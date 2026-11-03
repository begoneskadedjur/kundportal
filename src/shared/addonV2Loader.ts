// src/shared/addonV2Loader.ts
// Läser underlaget för nya tilläggsregler (addon_rules = 'v2', steg 11) med
// den Supabase-klient anroparen har: webbens (Planera fakturor), cronens och
// provskriptets (service role). Bara läsning: kundrader, täckning och två
// läsande SQL-funktioner (invoice_marking_split_ready, addon_gap_candidates).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EquipmentLine } from './contractPlanner'
import type { CoverageRange, GapCandidate } from './addonPlanV2'
import { addonMarkingFor, unitDisplayName } from './addonMarking'
import type { AddonBillingGroup } from './addonBillingGroups'

export interface AddonV2Inputs {
  /** Databasen tar en tilläggsfaktura per märkning och typen equipment_gap */
  split: boolean
  /** § 6-raderna med enhetens namn och märkning */
  lines: EquipmentLine[]
  coverage: CoverageRange[]
  gaps: GapCandidate[]
  /** Fel vid läsning av glappen (planen fortsätter utan glappfakturor) */
  gapError: string | null
  /** Avtalets faktureringsgrupper (tom utan grupper) */
  billingGroups: AddonBillingGroup[]
  /** Gamla unika indexet borta: två grupper kan ha samma typ, periodstart och märkning */
  groupSplit: boolean
}

type Cust = { id: string; company_name: string | null; site_name: string | null; billing_reference: string | null; parent_customer_id: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export async function loadAddonV2Inputs(
  sb: AnyClient,
  args: { contractId: string; contractCustomerId: string; invoiceReference: string | null; lines: EquipmentLine[] }
): Promise<AddonV2Inputs> {
  const { data: ready } = await sb.rpc('invoice_marking_split_ready')
  const split = ready === true

  const ids = new Set<string>([args.contractCustomerId])
  for (const l of args.lines) if (l.site_customer_id) ids.add(l.site_customer_id)
  const cols = 'id, company_name, site_name, billing_reference, parent_customer_id'
  const { data: custRows } = await sb.from('customers').select(cols).in('id', [...ids])
  const custs = new Map(((custRows ?? []) as Cust[]).map((c) => [c.id, c]))
  const parentIds = [...custs.values()].map((c) => c.parent_customer_id).filter((x): x is string => !!x && !custs.has(x))
  if (parentIds.length) {
    const { data: parents } = await sb.from('customers').select(cols).in('id', parentIds)
    for (const p of (parents ?? []) as Cust[]) custs.set(p.id, p)
  }
  const owner = custs.get(args.contractCustomerId) ?? null
  // Faktureringsgrupper (2026-11-03): läses bara när avtalet har några
  const { data: groupRows } = await sb
    .from('contract_addon_billing_groups')
    .select('id, contract_id, name, cadence, anchor_date, marking, created_at')
    .eq('contract_id', args.contractId)
  const billingGroups = ((groupRows ?? []) as AddonBillingGroup[]).slice().sort((a, b) => a.id.localeCompare(b.id))
  const groupIds = new Set(billingGroups.map((g) => g.id))
  // Stationernas grupp (bara giltiga grupper på avtalet)
  const stationGroup = new Map<string, string>()
  let groupSplit = false
  if (billingGroups.length > 0) {
    const [{ data: outRows }, { data: inRows }, { data: ready }] = await Promise.all([
      sb.from('equipment_placements').select('id, addon_billing_group_id').eq('addon_contract_id', args.contractId).not('addon_billing_group_id', 'is', null),
      sb.from('indoor_stations').select('id, addon_billing_group_id').eq('addon_contract_id', args.contractId).not('addon_billing_group_id', 'is', null),
      sb.rpc('invoice_group_split_ready'),
    ])
    for (const r of [...((outRows ?? []) as Array<{ id: string; addon_billing_group_id: string }>), ...((inRows ?? []) as Array<{ id: string; addon_billing_group_id: string }>)]) {
      if (groupIds.has(r.addon_billing_group_id)) stationGroup.set(r.id, r.addon_billing_group_id)
    }
    groupSplit = ready === true
  }

  const lines: EquipmentLine[] = args.lines.map((l) => {
    const unit = l.site_customer_id ? (custs.get(l.site_customer_id) ?? null) : null
    // Huvudkontoret: enhetens förälder, annars avtalskundens förälder, annars avtalskunden
    const root = custs.get(unit?.parent_customer_id ?? owner?.parent_customer_id ?? args.contractCustomerId) ?? null
    // Grupp på raden bara om den hör till avtalet. En station utan egen grupp
    // ärver radens (SQL: addon_station_billing_group); en station med egen
    // grupp hör bara till rader i den gruppen.
    const gid = l.billing_group_id && groupIds.has(l.billing_group_id) ? l.billing_group_id : null
    const { billing_group_id: _drop, ...rest } = l
    void _drop
    const stationIds =
      billingGroups.length > 0 && l.station_ids ? l.station_ids.filter((sid) => !stationGroup.has(sid) || stationGroup.get(sid) === gid) : l.station_ids
    return {
      ...rest,
      ...(gid ? { billing_group_id: gid } : {}),
      ...(stationIds !== l.station_ids ? { station_ids: stationIds } : {}),
      unit_name: unitDisplayName(unit),
      marking: addonMarkingFor(unit, { invoice_reference: args.invoiceReference }, root),
    }
  })

  const stationIds = [...new Set(lines.flatMap((l) => l.station_ids ?? []))]
  let coverage: CoverageRange[] = []
  if (stationIds.length) {
    const { data: cov } = await sb
      .from('addon_station_coverage')
      .select('station_id, covered_from, covered_to')
      .in('station_id', stationIds)
      .is('released_at', null)
    coverage = ((cov ?? []) as Array<{ station_id: string; covered_from: string; covered_to: string }>).map((c) => ({
      station_id: c.station_id,
      from: c.covered_from,
      to: c.covered_to,
    }))
  }

  const { data: gaps, error: gapErr } = await sb.rpc('addon_gap_candidates', { p_contract_id: args.contractId })
  const gapRows = ((gaps ?? []) as GapCandidate[]).map((g) => (stationGroup.has(g.station_id) ? { ...g, billing_group_id: stationGroup.get(g.station_id) } : g))
  return { split, lines, coverage, gaps: gapRows, gapError: gapErr ? gapErr.message : null, billingGroups, groupSplit }
}
