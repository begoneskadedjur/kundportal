// src/shared/addonBillingGroups.ts
// Faktureringsgrupper för tilläggsstationer (alternativ B, 2026-11-03).
// Gäller BARA avtal med nya tilläggsregler (contracts.addon_rules = 'v2').
//
// En grupp hör till ett avtal och har ett intervall (följer premien, månad,
// kvartal, halvår, år), en startdag och en märkning. § 6-rader och stationer
// som pekar på gruppen faktureras med gruppens takt på egna fakturor
// (invoices.addon_billing_group_id). Rader utan grupp följer dagens regler
// (addonPlanV2.ts, steg 11 och steg 0) oförändrat.
//
// SQL-tvillingar: contract_addon_billing_group_anchor och
// contract_addon_next_period_start(avtal, från, modell, grupp) i
// supabase/migrations/20261103_faktureringsgrupper.sql.
//
// Ren modul utan databas.

import { addMonthsClampedIso, exactPeriodIndexContaining, periodStepMonths } from './contractPeriods'
import type { PlanningContract } from './contractPlanner'

export type BillingGroupCadence = 'follows_premium' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual'

export const BILLING_GROUP_CADENCES: BillingGroupCadence[] = ['follows_premium', 'monthly', 'quarterly', 'semi_annual', 'annual']

export const BILLING_GROUP_CADENCE_LABEL: Record<BillingGroupCadence, string> = {
  follows_premium: 'Följer premien',
  monthly: 'Varje månad',
  quarterly: 'Varje kvartal',
  semi_annual: 'Varje halvår',
  annual: 'Varje år',
}

/** En rad ur contract_addon_billing_groups. */
export interface AddonBillingGroup {
  id: string
  contract_id?: string | null
  name: string
  cadence: BillingGroupCadence | string
  /** null = avtalsdagen (gamla läget: premiens månadsankare) */
  anchor_date: string | null
  /** null = dagens märkningsregel (enhetens kod, avtalets referens, huvudkontorets) */
  marking: string | null
  /** Gruppen fakturerar perioder som börjar från och med den dag den skapades */
  created_at?: string | null
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim()
  return t ? t : null
}

/** Gruppens märkning, eller null när dagens regel gäller. */
export function groupMarking(g: Pick<AddonBillingGroup, 'marking'> | null | undefined): string | null {
  return clean(g?.marking)
}

/**
 * Gruppens startdag: anchor_date, annars avtalsdagen (exakt läge), annars
 * premiens månadsankare i gamla läget (årsvis ankarmånaden, annars
 * startmånadens första dag). null utan startdatum på avtalet.
 */
export function billingGroupAnchor(
  g: Pick<AddonBillingGroup, 'anchor_date' | 'cadence'>,
  contract: Pick<PlanningContract, 'contract_start_date' | 'billing_anchor_mode' | 'billing_anchor_month'>
): string | null {
  if (g.anchor_date) return g.anchor_date
  const start = contract.contract_start_date
  if (!start) return null
  if (contract.billing_anchor_mode === 'start_day') return start
  const year = start.slice(0, 4)
  const m = contract.billing_anchor_month
  if (g.cadence === 'annual' && m != null && m >= 1 && m <= 12) return `${year}-${String(m).padStart(2, '0')}-01`
  return `${start.slice(0, 7)}-01`
}

/** Stegen i månader för gruppens takt (följer premien har inget eget steg). */
export function groupStepMonths(cadence: string): number | null {
  if (cadence === 'follows_premium') return null
  return periodStepMonths(cadence)
}

/**
 * Nästa periodstart efter dagen `from` med gruppens takt och startdag (SQL:
 * contract_addon_next_period_start med grupp). null när gruppen följer
 * premien eller saknar startdag (då gäller avtalets regel).
 */
export function groupNextPeriodStart(
  g: Pick<AddonBillingGroup, 'anchor_date' | 'cadence'>,
  contract: Pick<PlanningContract, 'contract_start_date' | 'billing_anchor_mode' | 'billing_anchor_month'>,
  from: string
): string | null {
  const step = groupStepMonths(g.cadence)
  const anchor = billingGroupAnchor(g, contract)
  if (step == null || !anchor) return null
  if (from < anchor) return anchor
  const k = exactPeriodIndexContaining(anchor, step, from)
  return addMonthsClampedIso(anchor, (k + 1) * step)
}

/** Datumet (Europe/Stockholm) en tidpunkt avser, ÅÅÅÅ-MM-DD. */
export function stockholmDate(ts: string | null | undefined): string | null {
  if (!ts) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Kort beskrivning av gruppen för listor och fakturor: "Månadsvis, ref ABC". */
export function describeBillingGroup(g: Pick<AddonBillingGroup, 'cadence' | 'anchor_date' | 'marking'>): string {
  const parts = [BILLING_GROUP_CADENCE_LABEL[g.cadence as BillingGroupCadence] ?? g.cadence]
  if (g.anchor_date) parts.push(`från ${g.anchor_date}`)
  const m = groupMarking(g)
  if (m) parts.push(`märkning ${m}`)
  return parts.join(', ')
}

// ─── Gamla unika indexet ────────────────────────────────────────────────────

/** En faktura eller planerad faktura sedd av unika indexet. */
export interface IndexSlot {
  kind: string
  start: string
  /** Värdet i invoices.marking_key ('' = NULL) */
  key: string
  groupId: string | null
}

const slotKey = (s: Pick<IndexSlot, 'kind' | 'start' | 'key'>) => `${s.kind}|${s.start}|${s.key}`

/**
 * Så länge invoices_contract_period_marking_key finns (drop-raden inte körd)
 * kan bara EN tilläggsfaktura per avtal, typ, periodstart och märkning finnas,
 * oavsett grupp. En grupps planerade faktura som krockar med en annan grupps
 * (eller en faktura utan grupp), befintlig eller planerad, hålls då tillbaka.
 * Fakturor utan grupp hålls aldrig tillbaka (dagens beteende).
 * Returnerar nycklarna `${groupId}|${kind}|${start}|${key}` som ska vänta.
 */
export function blockedGroupSlots(planned: IndexSlot[], existing: IndexSlot[], groupSplitReady: boolean): Set<string> {
  const out = new Set<string>()
  if (groupSplitReady) return out
  const owners = new Map<string, Set<string>>()
  for (const s of [...existing, ...planned]) {
    const k = slotKey(s)
    if (!owners.has(k)) owners.set(k, new Set())
    owners.get(k)!.add(s.groupId ?? '')
  }
  for (const s of planned) {
    if (!s.groupId) continue
    const set = owners.get(slotKey(s))
    if (set && set.size > 1) out.add(`${s.groupId}|${slotKey(s)}`)
  }
  return out
}

export function blockedSlotKey(groupId: string, kind: string, start: string, key: string | null | undefined): string {
  return `${groupId}|${kind}|${start}|${key ?? ''}`
}

export const GROUP_BLOCKED_REASON =
  'Krockar med en annan tilläggsfaktura för samma period och märkning. Skapas när databasändringen för faktureringsgrupper (drop av invoices_contract_period_marking_key) är körd, eller ge gruppen en egen märkning eller startdag.'
