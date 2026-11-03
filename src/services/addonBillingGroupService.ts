// src/services/addonBillingGroupService.ts
// Faktureringsgrupper för tilläggsstationer (2026-11-03). Grupperna skrivs
// direkt i contract_addon_billing_groups (RLS: admin och koordinator), byten
// av grupp på § 6-rader och stationer går via SECURITY DEFINER-RPC:erna
// set_addon_line_billing_group och set_addon_station_billing_group, som även
// synkar § 6-raderna. Planeringen läser grupperna i addonV2Loader.ts.

import { supabase } from '../lib/supabase'
import type { AddonBillingGroupCadence, ContractAddonBillingGroup } from '../types/database'

export interface BillingGroupInput {
  name: string
  cadence: AddonBillingGroupCadence
  anchor_date: string | null
  marking: string | null
}

/** En § 6-rad för tillägg med sin grupp. */
export interface AddonLineWithGroup {
  id: string
  name: string
  site_customer_id: string | null
  billing_model: 'per_year' | 'per_month'
  quantity: number
  addon_billing_group_id: string | null
}

const clean = (v: string | null | undefined) => {
  const t = (v ?? '').trim()
  return t ? t : null
}

function friendly(message: string): string {
  if (message.includes('contract_addon_billing_groups_name_key')) return 'Avtalet har redan en grupp med det namnet'
  return message
}

export class AddonBillingGroupService {
  static async list(contractId: string): Promise<ContractAddonBillingGroup[]> {
    const { data, error } = await supabase
      .from('contract_addon_billing_groups')
      .select('*')
      .eq('contract_id', contractId)
      .order('name')
    if (error) throw new Error(error.message)
    return (data ?? []) as ContractAddonBillingGroup[]
  }

  /** Gruppnamn per id, för fakturor och planposter. */
  static async namesByIds(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return out
    const { data } = await supabase.from('contract_addon_billing_groups').select('id, name').in('id', unique)
    for (const r of (data ?? []) as Array<{ id: string; name: string }>) out.set(r.id, r.name)
    return out
  }

  static async create(contractId: string, input: BillingGroupInput): Promise<ContractAddonBillingGroup> {
    const { data, error } = await supabase
      .from('contract_addon_billing_groups')
      .insert({
        contract_id: contractId,
        name: input.name.trim(),
        cadence: input.cadence,
        anchor_date: input.anchor_date || null,
        marking: clean(input.marking),
      })
      .select('*')
      .single()
    if (error) throw new Error(friendly(error.message))
    return data as ContractAddonBillingGroup
  }

  static async update(id: string, input: BillingGroupInput): Promise<void> {
    const { error } = await supabase
      .from('contract_addon_billing_groups')
      .update({ name: input.name.trim(), cadence: input.cadence, anchor_date: input.anchor_date || null, marking: clean(input.marking) })
      .eq('id', id)
    if (error) throw new Error(friendly(error.message))
  }

  /** Raderna och stationerna i gruppen går tillbaka till vanliga regler (on delete set null). */
  static async remove(id: string): Promise<void> {
    const { error } = await supabase.from('contract_addon_billing_groups').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  /** § 6-raderna för tillägg (per år och per månad) på avtalet. */
  static async addonLines(contractId: string): Promise<AddonLineWithGroup[]> {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select('id, service_name, article_name, site_customer_id, billing_model, quantity, addon_billing_group_id, is_addon_labour_line')
      .eq('case_id', contractId)
      .eq('case_type', 'contract')
      .eq('item_type', 'service')
      .in('billing_model', ['per_year', 'per_month'])
      .neq('status', 'cancelled')
    if (error) throw new Error(error.message)
    type Row = {
      id: string
      service_name: string | null
      article_name: string | null
      site_customer_id: string | null
      billing_model: 'per_year' | 'per_month'
      quantity: number | string
      addon_billing_group_id: string | null
      is_addon_labour_line: boolean | null
    }
    return ((data ?? []) as Row[])
      .filter((r) => !r.is_addon_labour_line)
      .map((r) => ({
        id: r.id,
        name: r.service_name ?? r.article_name ?? 'Tillägg',
        site_customer_id: r.site_customer_id,
        billing_model: r.billing_model,
        quantity: Number(r.quantity),
        addon_billing_group_id: r.addon_billing_group_id,
      }))
  }

  /** § 6-raden och stationerna bakom den byter grupp (null = vanliga regler). */
  static async setLineGroup(lineId: string, groupId: string | null): Promise<void> {
    const { error } = await supabase.rpc('set_addon_line_billing_group', { p_line_id: lineId, p_group_id: groupId })
    if (error) throw new Error(error.message)
  }

  /** Stationer byter grupp (utsättningen i Besluta tillägg); § 6-raderna synkas. */
  static async setStationGroup(outdoorIds: string[], indoorIds: string[], groupId: string | null): Promise<void> {
    const { error } = await supabase.rpc('set_addon_station_billing_group', {
      p_outdoor_ids: outdoorIds,
      p_indoor_ids: indoorIds,
      p_group_id: groupId,
    })
    if (error) throw new Error(error.message)
  }
}
