// src/components/admin/customers/record/contractCompleteness.ts
// Vad ett avtal måste ha för att vara komplett, och vad som bara är varningar.
//
// Samma villkor fanns tidigare utspridda som orange texter på pappret ("ej
// satt", "Ange besöksfrekvens", "arbetstid saknas", "faktureringsvillkor
// saknas"). Här samlas de i EN funktion som bär tre ytor: kompletthetsraden
// under stämpeln, statuspunkterna i inställningspanelen och Nästa steg-kortet.
// Plan: docs/varaktig-utrustning-marginal-plan.md och artifacten
// "Avtalskartan i tre lager".

import type { RecordContract, RecordContractSite } from '../../../../hooks/useCustomerRecord'
import type { MarginBreakdown } from '../../../../shared/marginEngine'

/** Grupperna i inställningspanelen, en per §-kluster */
export type SettingsGroup =
  | 'avtalet'
  | 'omfattning'
  | 'prislista'
  | 'uppfoljning'
  | 'innehall'
  | 'fakturering'
  | 'referenser'
  | 'loptid'

export const SETTINGS_GROUP_LABEL: Record<SettingsGroup, string> = {
  avtalet: 'Avtalet',
  omfattning: 'Omfattning',
  prislista: 'Prislista',
  uppfoljning: 'Uppföljning',
  innehall: 'Innehåll och utrustning',
  fakturering: 'Fakturering',
  referenser: 'Referenser',
  loptid: 'Löptid',
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  'avtalet',
  'omfattning',
  'prislista',
  'uppfoljning',
  'innehall',
  'fakturering',
  'referenser',
  'loptid',
]

export interface CompletenessItem {
  key: string
  /** Kort etikett för raden, t.ex. "Besöksfrekvens" */
  label: string
  ok: boolean
  /** Vital = avtalet är inte komplett utan den. Annars en varning. */
  vital: boolean
  group: SettingsGroup
  /** Paragrafen på pappret, t.ex. "§ 3" */
  paragraph: string
  /** En mening om varför, till Nästa steg-kortet */
  hint: string
}

export interface CompletenessInput {
  contract: RecordContract
  scope: RecordContractSite[]
  isAvrop: boolean
  /** Avtalet bor på en enhet (enhetsavtal): omfattningen är given */
  isUnitContract: boolean
  followupUnits: Array<{ serviceMode: 'inspection' | 'on_demand'; frequency: string | null; visitsPerYear: number | null }>
  breakdown: MarginBreakdown | null
  /** Antal brickor med tilläggsstationer som väntar på beslut */
  pendingBricks: number
  /** Passerade fakturaperioder utan faktura i portalen */
  uncoveredPeriods: number
  /** Enheterna i omfattningen, för Er referens-koder */
  coveredUnits: Array<{ billing_reference?: string | null }>
}

export interface CompletenessResult {
  items: CompletenessItem[]
  vital: CompletenessItem[]
  vitalOk: number
  vitalTotal: number
  /** Vitala delar som saknas, i den ordning de bör fyllas i */
  missing: CompletenessItem[]
  /** Icke-vitala saker som ändå bör åtgärdas */
  warnings: CompletenessItem[]
  complete: boolean
  percent: number
  /** Första saknade vitala delen, annars första varningen */
  nextStep: CompletenessItem | null
  /** Statuspunkt per grupp: ok, warn (vital saknas), note (bara varning), none */
  groupStatus: Record<SettingsGroup, 'ok' | 'warn' | 'note' | 'none'>
}

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const { contract: c, scope, isAvrop, isUnitContract, followupUnits, breakdown, pendingBricks, uncoveredPeriods, coveredUnits } = input
  const annual = Number(c.annual_value ?? 0)
  const start = c.contract_start_date ?? c.start_date ?? null
  const hasScope = !!c.covers_all_sites || isUnitContract || scope.length > 0
  const hasFollowup =
    isAvrop ||
    !!c.visits_per_year ||
    !!c.visit_frequency ||
    (followupUnits.length > 0 && followupUnits.every((u) => u.serviceMode === 'on_demand' || !!u.frequency || !!u.visitsPerYear))
  const hasPremium = isAvrop || annual > 0
  const hasBillingTerms = isAvrop || annual <= 0 || (!!c.billing_frequency && (!!c.billing_anchor_month || c.billing_frequency === 'on_demand'))
  const hasTerm = !!start && !!c.notice_period_months && (!!c.contract_end_date || c.renewal_mode === 'rolling' || !c.renewal_mode)
  const hasType = !!(c.label ?? c.contract_type)
  const hasSignature = !!c.signed_at
  const hasPriceList = !!c.price_list_id
  const unitsWithoutCode = coveredUnits.filter((u) => !u.billing_reference).length

  // Ordningen är den ordning en kollega bör fylla i ett nytt avtal
  const items: CompletenessItem[] = [
    { key: 'type', label: 'Avtalstyp', ok: hasType, vital: true, group: 'avtalet', paragraph: 'huvud', hint: 'Avtalstypen styr vad som ingår och hur avtalet namnges.' },
    { key: 'scope', label: 'Omfattning', ok: hasScope, vital: true, group: 'omfattning', paragraph: '§ 1', hint: 'Dra in minst en enhet, eller hela verksamheten, i § 1.' },
    { key: 'premium', label: 'Årspremie', ok: hasPremium, vital: true, group: 'fakturering', paragraph: '§ 7', hint: 'Årspremien är grunden för fakturaplanen och marginalen.' },
    { key: 'billing', label: 'Faktureringsvillkor', ok: hasBillingTerms, vital: true, group: 'fakturering', paragraph: '§ 7', hint: 'Frekvens och ankarmånad avgör när fakturorna skapas.' },
    { key: 'followup', label: 'Besöksfrekvens', ok: hasFollowup, vital: true, group: 'uppfoljning', paragraph: '§ 3', hint: 'Antal besök per år är facit vid schemaläggning och uppföljning.' },
    { key: 'term', label: 'Löptid och uppsägningstid', ok: hasTerm, vital: true, group: 'loptid', paragraph: '§ 9', hint: 'Startdatum och uppsägningstid styr bevakningen och när avtalet kan sägas upp.' },
    { key: 'signature', label: 'Signeringsdatum', ok: hasSignature, vital: true, group: 'avtalet', paragraph: 'fot', hint: 'Ett osignerat avtal är ett utkast och ska inte faktureras.' },
    { key: 'pricelist', label: 'Prislista för avrop', ok: hasPriceList, vital: isAvrop, group: 'prislista', paragraph: '§ 2', hint: 'Utan prislista gäller kundens lista eller prisguiden för avrop.' },
    { key: 'labour', label: 'Arbetstid för marginal', ok: !breakdown?.labour_missing, vital: false, group: 'innehall', paragraph: '§ 4', hint: 'Utan årets arbetstid som intern kostnad säger marginalen ingenting.' },
    { key: 'bricks', label: pendingBricks === 1 ? 'En tilläggsstation väntar på beslut' : `${pendingBricks} tilläggsstationer väntar på beslut`, ok: pendingBricks === 0, vital: false, group: 'innehall', paragraph: '§ 6', hint: 'Bestäm om stationerna bakas in i premien eller faktureras som tillägg.' },
    { key: 'uncovered', label: uncoveredPeriods === 1 ? 'En period saknar faktura' : `${uncoveredPeriods} perioder saknar faktura`, ok: uncoveredPeriods === 0, vital: false, group: 'fakturering', paragraph: '§ 7', hint: 'Koppla Fortnox-fakturan om perioden fakturerats utanför portalen.' },
    { key: 'refs', label: unitsWithoutCode === 1 ? 'Kod saknas på en enhet' : `Kod saknas på ${unitsWithoutCode} enheter`, ok: unitsWithoutCode === 0 || coveredUnits.length === 0, vital: false, group: 'referenser', paragraph: '§ 8', hint: 'Enhetens kod blir Er referens på fakturan. Saknas den anger beställaren kod på ärendet.' },
  ]

  const vital = items.filter((i) => i.vital)
  const missing = vital.filter((i) => !i.ok)
  const warnings = items.filter((i) => !i.vital && !i.ok)
  const vitalOk = vital.length - missing.length
  const groupStatus = Object.fromEntries(
    SETTINGS_GROUPS.map((g) => {
      const mine = items.filter((i) => i.group === g)
      if (mine.some((i) => i.vital && !i.ok)) return [g, 'warn']
      if (mine.some((i) => !i.ok)) return [g, 'note']
      if (mine.some((i) => i.vital)) return [g, 'ok']
      return [g, 'none']
    })
  ) as CompletenessResult['groupStatus']

  return {
    items,
    vital,
    vitalOk,
    vitalTotal: vital.length,
    missing,
    warnings,
    complete: missing.length === 0,
    percent: vital.length > 0 ? Math.round((vitalOk / vital.length) * 100) : 100,
    nextStep: missing[0] ?? warnings[0] ?? null,
    groupStatus,
  }
}

/** Fasen ett avtal befinner sig i, för fasremsan överst på pappret */
export type ContractPhase = 'utkast' | 'signerat' | 'aktivt' | 'uppsagt' | 'arkiverat'

export const CONTRACT_PHASES: ContractPhase[] = ['utkast', 'signerat', 'aktivt', 'uppsagt', 'arkiverat']
export const CONTRACT_PHASE_LABEL: Record<ContractPhase, string> = {
  utkast: 'Utkast',
  signerat: 'Signerat',
  aktivt: 'Aktivt',
  uppsagt: 'Uppsagt',
  arkiverat: 'Arkiverat',
}

export function contractPhase(
  contract: RecordContract,
  state: 'active' | 'terminated-running' | 'archived',
  today: string
): ContractPhase {
  if (state === 'archived') return 'arkiverat'
  if (state === 'terminated-running') return 'uppsagt'
  if (!contract.signed_at) return 'utkast'
  const start = contract.contract_start_date ?? contract.start_date ?? null
  if (start && start > today) return 'signerat'
  return 'aktivt'
}
