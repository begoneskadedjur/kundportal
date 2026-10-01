// src/hooks/useInvoiceAddons.ts
// Tilläggsrader på en merförsäljningsfaktura (adhoc) med samma underlag som
// ärendets Ekonomi-flik: tidslinjen per stationstyp och för arbetstiden,
// fakturans pro rata-period, avtalet, utrustningen och "betalt tillbaka".
//
// Kedja: invoice_items.contract_billing_item_id -> contract_billing_items
//   (.case_billing_item_id, äldre rader: case_id + kod) -> case_billing_items
//   med is_addon_prorata_line (årspris + billing_start_date).
// All matte: src/shared/addonEconomics.ts via src/shared/invoiceAddonLines.ts.
// Fel sväljs: blocket visas bara när underlaget går att läsa.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InvoiceWithItems } from '../types/invoice'
import type { AddonCompletionSummary } from '../types/addonStations'
import { AddonStationBillingService } from '../services/addonStationBillingService'
import { computeAddonCalc, type AddonCalc } from '../shared/addonEconomics'
import {
  addonInvoicePeriod,
  matchInvoiceAddonLines,
  type AddonCaseRow,
  type BillingItemLink,
  type InvoiceAddonLine,
} from '../shared/invoiceAddonLines'

export interface InvoiceAddons {
  loading: boolean
  lines: InvoiceAddonLine[]
  /** Fakturans tilläggsperiod och nästa periodstart (nästa tilläggsfaktura) */
  period: { start: string; end: string; nextStart: string } | null
  contractName: string | null
  /** Utrustning för stationerna som sattes ut i ärendet (engångskostnad) */
  equipment: Array<{ name: string; quantity: number; cost: number }>
  equipmentCost: number
  /** Timmar per år och intern timkostnad (Arbetstid Företag) */
  labourHours: number
  hourlyCost: number | null
  /** Enhetens tilläggsstationer utan beslut i avtalskartan */
  pendingStations: number
  calc: AddonCalc | null
}

const EMPTY: InvoiceAddons = {
  loading: false,
  lines: [],
  period: null,
  contractName: null,
  equipment: [],
  equipmentCost: 0,
  labourHours: 0,
  hourlyCost: null,
  pendingStations: 0,
  calc: null,
}

const ROW_COLUMNS =
  'id, case_id, item_type, status, service_id, service_code, article_code, service_name, article_name, ' +
  'quantity, unit_price, total_price, addon_annual_unit_price, billing_start_date, addon_model, ' +
  'is_addon_prorata_line, is_addon_labour_line, addon_labour_hours, addon_labour_hours_before, station_type_id'

async function countPendingStations(unitId: string): Promise<number> {
  const [outdoor, indoor] = await Promise.all([
    supabase
      .from('equipment_placements')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', unitId)
      .eq('is_addon', true)
      .is('addon_contract_id', null)
      .or('status.is.null,status.neq.removed'),
    supabase
      .from('indoor_stations')
      .select('id, floor_plans!inner(customer_id)', { count: 'exact', head: true })
      .eq('floor_plans.customer_id', unitId)
      .eq('is_addon', true)
      .is('addon_contract_id', null)
      .or('status.is.null,status.neq.removed'),
  ])
  return (outdoor.count ?? 0) + (indoor.count ?? 0)
}

export function useInvoiceAddons(invoice: InvoiceWithItems | null): InvoiceAddons {
  const [state, setState] = useState<{
    loading: boolean
    lines: InvoiceAddonLine[]
    summary: AddonCompletionSummary | null
    pendingStations: number
  }>({ loading: false, lines: [], summary: null, pendingStations: 0 })

  const billingIds = (invoice?.items ?? [])
    .map((i) => (i as { contract_billing_item_id?: string | null }).contract_billing_item_id)
    .filter((x): x is string => !!x)
  const key = invoice?.invoice_type === 'adhoc' ? `${invoice.id}:${billingIds.join(',')}:${(invoice.items ?? []).map((i) => `${i.quantity}/${i.unit_price}`).join(',')}` : ''

  useEffect(() => {
    if (!invoice || invoice.invoice_type !== 'adhoc' || billingIds.length === 0) {
      setState({ loading: false, lines: [], summary: null, pendingStations: 0 })
      return
    }
    let cancelled = false
    const load = async () => {
      setState((s) => ({ ...s, loading: true }))
      try {
        const { data: links } = await supabase
          .from('contract_billing_items')
          .select('id, case_id, case_billing_item_id, article_code')
          .in('id', billingIds)
        const billing = (links ?? []) as BillingItemLink[]
        const caseIds = [...new Set(billing.map((b) => b.case_id).filter((x): x is string => !!x))]
        if (caseIds.length === 0) {
          if (!cancelled) setState({ loading: false, lines: [], summary: null, pendingStations: 0 })
          return
        }
        const { data: rows } = await supabase
          .from('case_billing_items')
          .select(ROW_COLUMNS)
          .in('case_id', caseIds)
          .eq('item_type', 'service')
          .eq('is_addon_prorata_line', true)
          .neq('status', 'cancelled')
        const lines = matchInvoiceAddonLines(
          invoice.items.map((i) => ({
            id: i.id,
            article_code: i.article_code,
            contract_billing_item_id: (i as { contract_billing_item_id?: string | null }).contract_billing_item_id ?? null,
          })),
          billing,
          (rows ?? []) as unknown as AddonCaseRow[]
        )
        if (lines.length === 0) {
          if (!cancelled) setState({ loading: false, lines: [], summary: null, pendingStations: 0 })
          return
        }
        // Underlaget för kalkylen: ärendet tilläggen kommer från
        const caseId = lines[0].row.case_id ?? caseIds[0]
        const summary = await AddonStationBillingService.getCompletionSummary(caseId).catch(() => null)
        const unitId = summary?.ok ? summary.unit_id : invoice.customer_id
        const pendingStations = unitId ? await countPendingStations(unitId).catch(() => 0) : 0
        if (!cancelled) {
          setState({ loading: false, lines, summary: summary?.ok ? summary : null, pendingStations })
        }
      } catch (err) {
        console.warn('Kunde inte läsa fakturans tilläggsrader:', err)
        if (!cancelled) setState({ loading: false, lines: [], summary: null, pendingStations: 0 })
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo<InvoiceAddons>(() => {
    if (state.lines.length === 0) return { ...EMPTY, loading: state.loading }
    const { lines, summary } = state
    const period = addonInvoicePeriod(lines)
    const stations = lines.filter((l) => l.kind === 'station')
    const labour = lines.find((l) => l.kind === 'labour') ?? null
    const labourHours = labour ? Number(labour.row.addon_labour_hours ?? 0) : 0
    const labourRate = labour ? Number(labour.row.addon_annual_unit_price ?? 0) : null
    const equipment = summary?.new_articles ?? []
    const equipmentCost = summary?.new_equipment_cost ?? 0
    const hourlyCost = summary?.hourly_cost ?? null
    const first = stations[0]?.timeline ?? labour?.timeline ?? null
    const calc = period
      ? computeAddonCalc({
          equipmentCost,
          annualStationRevenue: stations.reduce((s, l) => s + l.timeline.totalAnnual, 0),
          labourHours,
          labourRate,
          labourCostPerHour: hourlyCost,
          firstPeriodRevenue: lines.reduce((s, l) => s + l.timeline.totalNow, 0),
          firstPeriodFraction: first?.fraction ?? 0,
          startDate: period.nextStart,
          today: period.start,
        })
      : null
    return {
      loading: state.loading,
      lines,
      period,
      contractName: summary?.contract_name ?? null,
      equipment,
      equipmentCost,
      labourHours,
      hourlyCost,
      pendingStations: state.pendingStations,
      calc,
    }
  }, [state])
}
