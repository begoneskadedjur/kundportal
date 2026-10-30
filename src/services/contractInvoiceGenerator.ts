// src/services/contractInvoiceGenerator.ts
// Genererar fakturaplan för avtalskunder: beräknar vilka invoices som ska finnas
// baserat på avtalstid, frekvens och årspremie, och applicerar diff mot befintliga.
// Event-driven: anropas från BillingSettingsModal, avtalskartan, uppsägningsflöde
// och cron.
//
// Avtalskartan som motor (fas 2, docs/avtalskarta-motor-plan.md):
//   * Periodmatematiken bor i src/shared/contractPlanner.ts och delas med cronen.
//   * Beloppet per period kommer ur premietrappan (contract_premium_events);
//     annual_value är fallback.
//   * § 4-raderna (billing_model = premium) på avtalets EGET innehåll blir
//     fakturarader, för alla riktiga avtal, inte bara importcontainrar.
//   * § 5-rader "per styck och år" blir egna rader (line_kind equipment_annual).
//   * Samlad faktura (gemet): en faktura per period för kunden, en rad per
//     avtal, invoice_items.contract_id pekar på avtalet, invoices.contract_id
//     är null och is_consolidated = true.
//   * Riktiga avtal får ALDRIG automatisk "betald historik". En period som
//     redan passerat utan faktura visas som 'uncovered' (importera från
//     Fortnox). Synth-avtal (kunder utan avtalsrad) behåller dagens beteende.
//   * Fakturadatum = periodstart minus ledtid (DEFAULT_INVOICE_LEAD_DAYS), så
//     fakturan är betald innan kundens nya avtalsår börjar.

import { supabase } from '../lib/supabase'
import { ImportedCustomerContractService } from './importedCustomerContractService'
import { PaymentTermsService } from './paymentTermsService'
import { InvoiceService } from './invoiceService'
import { ContractInvoiceImportService } from './contractInvoiceImportService'
import { ContractScopeService } from './contractScopeService'
import { ContractService, isSyntheticContract } from './contractService'
import { resolveOrganizationNumber } from '../utils/multisiteHelpers'
import {
  buildContractInvoiceNotes,
  buildContractInvoiceRows,
  periodLabel,
  toInvoiceItemRows,
  type ContractServiceItem,
  type InvoiceRowSpec,
} from '../shared/contractInvoiceRows'
import { addonInvoicePeriod, matchInvoiceAddonLines, type AddonCaseRow } from '../shared/invoiceAddonLines'
import type { ContractWithBilling } from '../types/database'
import {
  buildGapDiff,
  computeAddonPlanV2,
  decorateV2Period,
  dedupeLockedWithoutPlan,
  existingByMarkingGroup,
  isAddonRulesV2,
  planGapGroups,
  type AddonPlanV2,
  type CoverageRange,
  type GapCandidate,
} from '../shared/addonPlanV2'
import { markingKey, markingKeyColumn } from '../shared/addonMarking'
import { loadAddonV2Inputs } from '../shared/addonV2Loader'
import {
  buildContractDiff,
  consolidationGroupKey,
  EDITABLE_STATUSES,
  LOCKED_STATUSES,
  matchModeFor,
  periodOverlapShare,
  SAME_PERIOD_SHARE,
  type MatchMode,
} from '../shared/contractInvoiceMatch'
import {
  computePlannedEquipmentPeriods,
  computePlannedMonthlyEquipmentPeriods,
  computePlannedPeriods,
  computeTerminationCutoff,
  type ContractInvoiceKind,
  type EquipmentInvoiceMode,
  parseLocalDate,
  periodDivisor,
  toLocalIsoDate,
  todayLocal,
  DEFAULT_INVOICE_LEAD_DAYS,
  type BillingFrequency,
  type EquipmentLine,
  type PlannedPeriod,
  type PlanningContract,
  type PremiumStep,
} from '../shared/contractPlanner'

export type { BillingFrequency } from '../shared/contractPlanner'
// Radtyperna bor i src/shared/contractInvoiceRows.ts (delas med signeringen server-side)
export type { InvoiceLineKind, InvoiceRowSpec } from '../shared/contractInvoiceRows'

/** En planerad faktura: en period med belopp. Fälten från PlannedPeriod plus etikett. */
export type PlannedInvoice = PlannedPeriod

// Publika actions visas i preview, _historical-actions filtreras bort där
// men räknas i summary.
export type BillingPlanAction =
  | 'keep'
  | 'create'
  | 'update'
  | 'delete'
  | 'locked'
  | 'create-historical'
  | 'backfill-historical-paid'
  /** Passerad period utan faktura på ett riktigt avtal: importera från Fortnox, skapas aldrig här */
  | 'uncovered'
  /** Perioden ligger på kundens samlingsfaktura (per-avtal-planen rör den inte) */
  | 'consolidated'
  /**
   * Används inte längre (sedan 2026-10-15): förlängningsperioder kommer med i
   * planen först när sista uppsägningsdag passerat och skapas då direkt
   * (contractPlanner.bindingWindow). Kvar i typen för äldre vyer.
   */
  | 'later'
  /**
   * Fortnox-kontrollen (fortnoxPlanCheck.ts) hittade fakturan för en passerad
   * period i Fortnox med samma belopp: utkastet görs om till F-{nr}.
   */
  | 'link-fortnox'
  /** Som link-fortnox men beloppet är indexerat (0 till 8 % över planen): kopplas + indexsteg i trappan */
  | 'link-fortnox-indexed'
  /** Perioden har börjat, utkastet ligger kvar och fakturan finns inte i Fortnox: godkänn och skicka */
  | 'overdue-send'

/** En Fortnox-faktura som kan vara periodens faktura. */
export interface FortnoxCandidate {
  documentNumber: string
  invoiceDate: string
  dueDate: string | null
  finalPayDate: string | null
  /** Inkl. moms, ur fakturalistan */
  total: number
  /** Exkl. moms, uppskattad ur Total och planens momssats (listan saknar Net) */
  net: number
  balance: number
  sent: boolean
  booked: boolean
  match: 'exact' | 'indexed'
}

/** Resultatet av Fortnox-kontrollen på en planpost. */
export interface FortnoxCheckInfo {
  /** match = en träff, choose = flera träffar (användaren väljer), missing = ingen träff */
  status: 'match' | 'choose' | 'missing'
  candidates: FortnoxCandidate[]
  /** Valt Fortnox-nummer; null tills användaren valt vid flera träffar */
  chosen: string | null
  /** Åtgärden planen hade före kontrollen (återställs om användaren väljer bort alla) */
  originalAction: BillingPlanAction
  /** Beloppet träffarna jämfördes mot, exkl. moms */
  baseSubtotal: number
}

export interface BillingPlanEntry {
  action: BillingPlanAction
  /** Fakturatyp (premium om inget annat sägs) */
  kind?: ContractInvoiceKind
  planned?: PlannedInvoice
  existingId?: string
  existingStatus?: string
  existingAmount?: number
  /** Exkl. moms, samma tal som pappret visar */
  existingSubtotal?: number
  reason?: string
  /** Avtalet raden gäller (null = synth/kundnivå) */
  contractId?: string | null
  contractLabel?: string | null
  /** Färdiga fakturarader; saknas de byggs generiska rader vid apply (synth) */
  rows?: InvoiceRowSpec[]
  /** Er referens på fakturan */
  marking?: string | null
  /** Fakturans anteckning (Remarks i Fortnox) */
  notes?: string
  /** Raden hör till en samlad faktura (invoices.contract_id null, is_consolidated) */
  consolidated?: boolean
  /** Kundraden fakturan hör till: enhetens vid enhetsavtal, annars planens */
  customerId?: string
  /** Befintliga fakturans Fortnox-nummer (null = aldrig skickad till Fortnox) */
  existingFortnoxNumber?: string | null
  /** Andra redigerbara utkast för samma period (dubbletter), utan Fortnox-nummer */
  duplicateIds?: string[]
  /** Fortnox-kontrollen för passerade perioder (sätts efter grundplanen) */
  fortnox?: FortnoxCheckInfo
  /**
   * Nya tilläggsregler (steg 11): värdet som skrivs i invoices.marking_key
   * (null = ingen märkningsnyckel). undefined = gamla regler, kolumnen rörs inte.
   */
  markingKey?: string | null
  /** Posten hör till nya tilläggsregler: apply raderar sådana utkast först */
  addonRulesV2?: boolean
}

export interface BillingPlan {
  customerId: string
  // Multi-kontrakt-refaktor: när planen är scopad till ett specifikt kontrakt
  // sätts contractId. För synth-kontrakt (kunder utan riktig contracts-rad)
  // är contractId null så att invoices.contract_id inte sätts.
  contractId: string | null
  contractLabel?: string | null
  /** Samlad plan för flera avtal (gemet) */
  consolidated?: boolean
  entries: BillingPlanEntry[]
  summary: {
    create: number
    update: number
    delete: number
    locked: number
    keep: number
    historical: number // create-historical + backfill-historical-paid
    uncovered: number
    /** Förlängningsperioder som väntar på sitt fakturadatum */
    later: number
    /** Passerade perioder som finns i Fortnox och kopplas (link-fortnox + indexerade) */
    linkFortnox: number
    /** Passerade perioder med flera möjliga Fortnox-fakturor: användaren väljer */
    fortnoxChoose: number
    /** Passerade perioder som inte finns i Fortnox: godkänn och skicka */
    overdueSend: number
  }
}

export interface ApplyResult {
  createdIds: string[]
  updatedIds: string[]
  deletedIds: string[]
  historicalIds: string[]
  skippedLocked: number
  /** Passerade perioder utan faktura som väntar på Fortnox-import */
  uncovered: number
  /** Utkast/perioder som kopplats till sin Fortnox-faktura */
  linkedIds?: string[]
  /** Indexsteg som lagts i premietrappan vid indexerad koppling */
  indexedSteps?: number
  /** Kopplingar som väntar på att användaren väljer Fortnox-faktura, eller som hoppades över */
  fortnoxSkipped?: number
  /** Indexsteg som inte kunde läggas (kopplingen är ändå gjord) */
  indexErrors?: string[]
}

/**
 * Minimalt subset av customer-fält som krävs för att räkna fakturaplan.
 * Används av både ContractInvoiceGenerator och BillingSettingsModal
 * (UI:t har inga kund-id-fält när man redigerar nya inställningar).
 */
export interface CustomerForPlanning {
  annual_value: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  billing_frequency: BillingFrequency | null
  billing_anchor_month: number | null
  billing_active: boolean | null
  notice_period_months: number | null
  /** Uppsägningens sista giltiga dag: kunden betalar till och med den */
  effective_end_date?: string | null
}

type CustomerRow = CustomerForPlanning & {
  id: string
  company_name: string
  organization_number: string | null
  billing_email: string | null
  billing_address: string | null
  billing_reference?: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  monthly_value: number | null
  contract_invoice_mode?: string | null
}

type ExistingInvoice = {
  id: string
  invoice_number?: string | null
  status: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  total_amount: number
  subtotal: number
  is_historical: boolean | null
  is_consolidated?: boolean | null
  contract_id?: string | null
  invoice_type?: string | null
  contract_invoice_kind?: string | null
  marking_key?: string | null
  invoice_items?: Array<{ article_name: string | null; line_kind?: string | null; contract_id?: string | null; total_price?: number | null }> | null
  fortnox_document_number?: string | null
  has_generic_items?: boolean
  rowSignature?: string
}

type ContractSources = {
  steps: PremiumStep[]
  /** Tilläggssteg i trappan med text ("Tilläggsstationer adderade …"): textrad på periodens premiefaktura */
  additionNotes: Array<{ effective_from: string; note: string }>
  premiumItems: ContractServiceItem[]
  /** § 5-rader per år och per månad (billing_model på raden) */
  equipment: EquipmentLine[]
  equipmentInvoiceMode: EquipmentInvoiceMode
  label: string | null
  invoiceReference: string | null
  diaryNumber: string | null
}

/** Underlaget för nya tilläggsregler (addon_rules = 'v2'), se loadAddonV2. */
type AddonV2Context = {
  /** invoice_marking_split_ready: en tilläggsfaktura per märkning och glappfakturor */
  split: boolean
  lines: EquipmentLine[]
  coverage: CoverageRange[]
  fallbackMarking: string | null
  plan: AddonPlanV2
  gaps: GapCandidate[]
}

const EMPTY_SUMMARY = (): BillingPlan['summary'] => ({
  keep: 0,
  create: 0,
  update: 0,
  delete: 0,
  locked: 0,
  historical: 0,
  uncovered: 0,
  later: 0,
  linkFortnox: 0,
  fortnoxChoose: 0,
  overdueSend: 0,
})

/**
 * Ren funktion: planerade fakturor från kund- eller avtalsfält, utan trappa och
 * utrustning. Behålls för BillingSettingsModal (fakturaschemat i UI) och
 * contractAdditionService (periodberäkning). Inga DB-anrop.
 */
export function computePlannedInvoicesPure(customer: CustomerForPlanning, paymentTermsDays: number = 30): PlannedInvoice[] {
  return computePlannedPeriods(customer, { paymentTermsDays })
}

export function summarize(entries: BillingPlanEntry[]): BillingPlan['summary'] {
  return entries.reduce((acc, e) => {
    // Fortnox-kontrollen: kopplingar och perioder som saknas i Fortnox
    if (e.action === 'link-fortnox' || e.action === 'link-fortnox-indexed') {
      if (e.fortnox?.chosen) acc.linkFortnox += 1
      else acc.fortnoxChoose += 1
      return acc
    }
    if (e.action === 'overdue-send') {
      acc.overdueSend += 1
      return acc
    }
    if (e.fortnox?.status === 'missing') acc.overdueSend += 1
    if (e.action === 'create-historical' || e.action === 'backfill-historical-paid') acc.historical += 1
    else if (e.action === 'uncovered') acc.uncovered += 1
    else if (e.action === 'later') acc.later += 1
    else if (e.action === 'consolidated') acc.keep += 1
    else acc[e.action] += 1
    return acc
  }, EMPTY_SUMMARY())
}

function rowSignature(rows: Array<{ contract_id?: string | null; line_kind?: string | null; total_price?: number | null }>): string {
  return rows
    .map((r) => `${r.contract_id ?? ''}|${r.line_kind ?? ''}|${Math.round(Number(r.total_price ?? 0) * 100)}`)
    .sort()
    .join(';')
}

export class ContractInvoiceGenerator {
  /**
   * Skapa fakturaplan för en kund. Returnerar diff mot befintliga invoices.
   *
   * Behålls för äldre anropare: returnerar planen för kundens FÖRSTA avtal
   * (display_order). Använd planCombinedForCustomer för alla avtal och för
   * samlad faktura.
   */
  static async planForCustomer(customerId: string): Promise<BillingPlan> {
    const contracts = await ContractService.getActiveContracts(customerId)
    if (contracts.length === 0) {
      return { customerId, contractId: null, entries: [], summary: EMPTY_SUMMARY() }
    }
    return this.planForContract(contracts[0], { customerId })
  }

  /**
   * Fakturaplaner för ALLA aktiva kontrakt på en kund, en plan per avtal.
   */
  static async planAllForCustomer(customerId: string): Promise<BillingPlan[]> {
    const contracts = await this.liveContractsForFamily(customerId)
    const plans: BillingPlan[] = []
    for (const contract of contracts) {
      // Enhetsavtal faktureras på sin egen kundrad: planen (och fakturan)
      // hör till enheten, inte till huvudkontoret.
      plans.push(await this.planForContract(contract, { customerId: contract.customer_id ?? customerId }))
    }
    return plans
  }

  /**
   * Levande avtal för kunden OCH dess enheter. Huddinge Pastorat har sina tre
   * avtal på enheterna (enhetsavtal), så en sökning enbart på huvudkontorets
   * customer_id gav noll avtal och "Fakturorna stämmer redan med avtalen".
   */
  private static async liveContractsForFamily(customerId: string): Promise<ContractWithBilling[]> {
    const own = await ContractService.getActiveContracts(customerId)
    const { data: unitRows } = await supabase.from('customers').select('id').eq('parent_customer_id', customerId)
    const unitIds = (unitRows ?? []).map((u) => (u as { id: string }).id)
    if (unitIds.length === 0) return own

    const seen = new Set(own.map((c) => c.id))
    const all = [...own]
    for (const unitId of unitIds) {
      for (const c of await ContractService.getActiveContracts(unitId)) {
        // Synth-avtal från en enhets kundrad är inte ett eget avtal att
        // fakturera när huvudkontoret redan har riktiga avtal.
        if (isSyntheticContract(c) && own.some((o) => !isSyntheticContract(o))) continue
        if (seen.has(c.id)) continue
        seen.add(c.id)
        all.push(c)
      }
    }
    return all
  }

  /**
   * Planer enligt kundens faktureringsläge (gemet): samlad faktura när
   * customers.contract_invoice_mode = 'consolidated' och kunden har flera
   * riktiga avtal som delar frekvens och ankarmånad, annars en plan per avtal.
   */
  static async planCombinedForCustomer(customerId: string): Promise<BillingPlan[]> {
    const { data: customer } = await supabase
      .from('customers')
      .select('contract_invoice_mode')
      .eq('id', customerId)
      .maybeSingle()
    const mode = (customer as { contract_invoice_mode?: string | null } | null)?.contract_invoice_mode ?? 'per_contract'
    if (mode === 'consolidated') return this.planConsolidatedForCustomer(customerId)
    return this.planAllForCustomer(customerId)
  }

  /** Slå ihop flera planer till en för förhandsvisning. Apply klarar den ihopslagna planen. */
  static mergePlans(customerId: string, plans: BillingPlan[]): BillingPlan {
    const entries = plans.flatMap((p) =>
      p.entries.map((e) => ({
        ...e,
        contractId: e.contractId ?? p.contractId,
        contractLabel: e.contractLabel ?? p.contractLabel ?? null,
        consolidated: e.consolidated ?? p.consolidated ?? false,
        // Enhetsavtalets faktura hör till enheten: den ihopslagna planen bär
        // huvudkundens id, så varje post måste minnas sin egen kundrad.
        customerId: e.customerId ?? p.customerId,
      }))
    )
    entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))
    return {
      customerId,
      contractId: plans.length === 1 ? plans[0].contractId : null,
      consolidated: plans.some((p) => p.consolidated),
      entries,
      summary: summarize(entries),
    }
  }

  /**
   * Skapa fakturaplan för ett enskilt kontrakt. Diff:fas mot invoices för det
   * specifika contract_id (eller, för synth-kontrakt, alla contract-invoices
   * på kunden, vilket motsvarar dagens beteende).
   */
  static async planForContract(
    contractOrId: string | ContractWithBilling,
    opts?: { customerId?: string }
  ): Promise<BillingPlan> {
    const contract =
      typeof contractOrId === 'string' ? await ContractService.getContractWithBillingById(contractOrId) : contractOrId

    if (!contract) throw new Error('Kontrakt hittades inte')
    if (!contract.customer_id) throw new Error('Kontrakt saknar customer_id')

    const customerId = opts?.customerId ?? contract.customer_id
    const isSynth = isSyntheticContract(contract)
    const paymentTermsDays = await PaymentTermsService.getDays('contract')

    // Synth-avtal: kundradens fält, ingen trappa, generiska rader (eller
    // importcontainerns § 4-rader via legacy-vägen).
    if (isSynth) {
      const planned = computePlannedPeriods(contract as PlanningContract, { paymentTermsDays })
      const existing = await this.loadExisting(customerId, null)
      const entries = this.buildDiff(planned, existing, { real: false })
      return { customerId, contractId: null, entries, summary: summarize(entries) }
    }

    const sources = await this.loadContractSources(contract.id)
    const billingCustomer = await this.loadCustomer(customerId)
    const marking = sources.invoiceReference ?? billingCustomer.billing_reference ?? null
    // Nya tilläggsregler (steg 11) bara när avtalet har addon_rules = 'v2'
    const v2 = isAddonRulesV2(contract) ? await this.loadAddonV2(contract, sources, paymentTermsDays, marking) : null
    const planned = this.premiumPeriodsFor(contract, sources, paymentTermsDays, v2)
    const existing = await this.loadExisting(customerId, contract.id, { kind: 'premium' })
    const consolidatedInvoices = await this.loadConsolidatedPeriodsForContract(customerId, contract.id)
    // Exakt avtalsdag matchar på datumöverlapp, övriga på månad (steg 7)
    const mode = matchModeFor(contract)

    const entries: BillingPlanEntry[] = this.buildDiff(planned, existing, { real: true, consolidatedInvoices, mode }).map((e) => {
      if (!e.planned) return { ...e, kind: 'premium' as const, contractId: contract.id, contractLabel: sources.label }
      return {
        ...e,
        kind: 'premium' as const,
        contractId: contract.id,
        contractLabel: sources.label,
        rows: this.buildRowsForContract(contract.id, sources, e.planned, contract.billing_frequency as BillingFrequency | null),
        marking,
        notes: this.buildNotes(e.planned, sources.label, sources.diaryNumber),
      }
    })

    // Egna fakturor för tillägg: per år (när avtalet fakturerar utrustning
    // separat) och per månad (alltid egna månadsfakturor). Diffen görs per typ.
    entries.push(
      ...(v2
        ? await this.planEquipmentEntriesV2(contract, sources, customerId, marking, v2)
        : await this.planEquipmentEntries(contract, sources, customerId, paymentTermsDays, marking))
    )
    entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))

    return { customerId, contractId: contract.id, contractLabel: sources.label, entries, summary: summarize(entries) }
  }

  /**
   * Planposter för egna tilläggsfakturor (kind equipment / equipment_monthly)
   * på ett riktigt avtal. Tom lista när avtalet varken fakturerar utrustning
   * separat eller har per månad-rader.
   */
  private static async planEquipmentEntries(
    contract: ContractWithBilling,
    sources: ContractSources,
    customerId: string,
    paymentTermsDays: number,
    marking: string | null
  ): Promise<BillingPlanEntry[]> {
    const out: BillingPlanEntry[] = []
    const freq = contract.billing_frequency as BillingFrequency | null
    const mode = matchModeFor(contract)
    // Tilläggsfakturor är alltid en per avtal. consolidated sätts uttryckligen
    // till false: mergePlans ärver annars gruppens samlingsflagga, och då
    // sparas fakturan utan contract_id och krockar på invoices_consolidated_period_key.
    const decorate = (e: BillingPlanEntry, kind: ContractInvoiceKind): BillingPlanEntry => {
      if (!e.planned) return { ...e, kind, contractId: contract.id, contractLabel: sources.label, consolidated: false }
      return {
        ...e,
        kind,
        contractId: contract.id,
        contractLabel: sources.label,
        consolidated: false,
        rows: this.buildRowsForContract(contract.id, sources, e.planned, freq),
        marking,
        notes: this.buildNotes(e.planned, sources.label, sources.diaryNumber),
      }
    }
    if (sources.equipmentInvoiceMode === 'separate') {
      const planned = computePlannedEquipmentPeriods(contract as PlanningContract, {
        paymentTermsDays,
        steps: sources.steps,
        equipment: sources.equipment,
        leadDays: DEFAULT_INVOICE_LEAD_DAYS,
        window: 'binding',
      })
      const existing = await this.loadExisting(customerId, contract.id, { kind: 'equipment' })
      out.push(...this.buildDiff(planned, existing, { real: true, mode }).map((e) => decorate(e, 'equipment')))
    }
    const monthly = computePlannedMonthlyEquipmentPeriods(contract as PlanningContract, {
      paymentTermsDays,
      equipment: sources.equipment,
      window: 'binding',
    })
    const existingMonthly = await this.loadExisting(customerId, contract.id, { kind: 'equipment_monthly' })
    if (monthly.length > 0 || existingMonthly.length > 0) {
      out.push(...this.buildDiff(monthly, existingMonthly, { real: true, mode }).map((e) => decorate(e, 'equipment_monthly')))
    }
    return out
  }

  /**
   * Premieperioderna för ett avtal. Gamla tilläggsregler: som förut (§ 6 per
   * år på egna fakturor). Nya tilläggsregler med månadspremie: tilläggen
   * ligger på månadsfakturan med enhetens namn och periodens stationer.
   */
  private static premiumPeriodsFor(
    contract: ContractWithBilling,
    sources: ContractSources,
    paymentTermsDays: number,
    v2: AddonV2Context | null
  ): PlannedPeriod[] {
    const withPremium = v2?.plan.cadence === 'with_premium'
    const planned = computePlannedPeriods(contract as PlanningContract, {
      paymentTermsDays,
      steps: sources.steps,
      equipment: withPremium ? v2!.plan.premiumEquipment : v2 ? [] : sources.equipment,
      leadDays: DEFAULT_INVOICE_LEAD_DAYS,
      equipmentMode: withPremium ? 'with_premium' : v2 ? 'separate' : sources.equipmentInvoiceMode,
      // Nuvarande bindningstid; nästa bindningsperiod först när sista
      // uppsägningsdag passerat (samma regel som signeringen och cronen).
      window: 'binding',
    })
    if (!withPremium) return planned
    return planned.map((p) => decorateV2Period(p, v2!.plan.premiumEquipment, v2!.coverage, v2!.fallbackMarking))
  }

  /**
   * Underlaget för nya tilläggsregler (steg 11): enheternas namn och
   * referenskoder på § 6-raderna, stationernas täckning, glappen (SQL
   * addon_gap_candidates) och om databasen tar tilläggsfakturor per märkning
   * (invoice_marking_split_ready, falsk tills drop-raderna från steg 5 körts).
   */
  private static async loadAddonV2(
    contract: ContractWithBilling,
    sources: ContractSources,
    paymentTermsDays: number,
    fallbackMarking: string | null
  ): Promise<AddonV2Context> {
    const inputs = await loadAddonV2Inputs(supabase, {
      contractId: contract.id,
      contractCustomerId: contract.customer_id as string,
      invoiceReference: sources.invoiceReference,
      lines: sources.equipment,
    })
    if (inputs.gapError) console.warn('[ContractInvoiceGenerator] Glappen kunde inte läsas:', inputs.gapError)
    const plan = computeAddonPlanV2(contract as PlanningContract, inputs.lines, {
      paymentTermsDays,
      steps: sources.steps,
      leadDays: DEFAULT_INVOICE_LEAD_DAYS,
      window: 'binding',
      split: inputs.split,
      fallbackMarking,
      coverage: inputs.coverage,
    })
    return { split: inputs.split, lines: inputs.lines, coverage: inputs.coverage, fallbackMarking, plan, gaps: inputs.gaps }
  }

  /**
   * Tilläggsfakturor med nya tilläggsregler: en per märkning och period
   * (eller en per period med märkning per rad så länge databasen inte tar
   * flera), plus glappfakturor. Utkast i gamla månadsfakturor (kind
   * equipment_monthly) raderas: tilläggen följer premien.
   */
  private static async planEquipmentEntriesV2(
    contract: ContractWithBilling,
    sources: ContractSources,
    customerId: string,
    marking: string | null,
    v2: AddonV2Context
  ): Promise<BillingPlanEntry[]> {
    const mode = matchModeFor(contract)
    const out: BillingPlanEntry[] = []
    const namesOf = (rows: Array<{ article_name: string | null }>) => rows.map((r) => r.article_name ?? '').sort().join('|')
    const decorate = (
      e: BillingPlanEntry,
      kind: ContractInvoiceKind,
      groupMarking: string | null,
      key: string | null,
      existingById: Map<string, ExistingInvoice>
    ): BillingPlanEntry => {
      const base = { ...e, kind, contractId: contract.id, contractLabel: sources.label, consolidated: false, addonRulesV2: true }
      if (!e.planned) return base
      const rows = this.buildRowsForContract(contract.id, sources, e.planned, contract.billing_frequency as BillingFrequency | null)
      const snapped = e.planned.equipmentRows.filter((r) => r.billing_start_snapped)
      let action = e.action
      // Samma belopp men nya rader (enhetens namn, andra stationer): uppdatera
      if (action === 'keep' && e.existingId) {
        const ex = existingById.get(e.existingId)
        if (ex && namesOf(ex.invoice_items ?? []) !== namesOf(rows)) action = 'update'
      }
      return {
        ...base,
        action,
        rows,
        marking: groupMarking,
        markingKey: key,
        notes: this.buildNotes(e.planned, sources.label, sources.diaryNumber),
        ...(snapped.length && !e.reason
          ? { reason: `§ 6-raden börjar ${snapped[0].billing_start_snapped}, tas med från periodstart ${e.planned.periodStart}` }
          : {}),
      }
    }

    // Egna tilläggsfakturor per märkning
    if (v2.plan.cadence !== 'with_premium' || v2.plan.groups.length > 0) {
      const existing = await this.loadExisting(customerId, contract.id, { kind: 'equipment' })
      const existingById = new Map(existing.map((e) => [e.id, e]))
      const byKey = existingByMarkingGroup(
        v2.plan.groups.map((g) => g.markingKey),
        v2.split ? existing : existing.map((e) => ({ ...e, marking_key: null }))
      )
      const groupEntries: BillingPlanEntry[] = []
      for (const [key, list] of byKey) {
        const g = v2.plan.groups.find((x) => x.markingKey === key)
        const groupMarking = g ? g.marking : (list.find((x) => x.marking_key)?.marking_key ?? marking)
        const keyColumn = v2.split ? markingKeyColumn(groupMarking ?? key) : null
        groupEntries.push(
          ...this.buildDiff(g?.periods ?? [], list as ExistingInvoice[], { real: true, mode }).map((e) =>
            decorate(e, 'equipment', groupMarking, keyColumn, existingById)
          )
        )
      }
      out.push(...dedupeLockedWithoutPlan(groupEntries))
    }

    // Gamla månadsfakturor för tillägg: tilläggen följer premien i v2
    const existingMonthly = await this.loadExisting(customerId, contract.id, { kind: 'equipment_monthly' })
    if (existingMonthly.length > 0) {
      const byId = new Map(existingMonthly.map((e) => [e.id, e]))
      out.push(...this.buildDiff([], existingMonthly, { real: true, mode }).map((e) => decorate(e, 'equipment_monthly', marking, null, byId)))
    }

    // Glappfakturor
    if (v2.gaps.length > 0) {
      const markingByKey = new Map<string, string | null>()
      for (const l of v2.lines) markingByKey.set(markingKey(l.marking ?? null), l.marking ?? null)
      const codeFor = (unitId: string, typeId: string | null) =>
        v2.lines.find((l) => l.site_customer_id === unitId && (l.station_type_id ?? null) === typeId)?.code ?? null
      const groups = planGapGroups(
        v2.gaps.map((g) => (v2.split ? g : { ...g, marking_key: '' })),
        {
          today: toLocalIsoDate(todayLocal()),
          paymentTermsDays: await PaymentTermsService.getDays('contract'),
          markingFor: (k) => (v2.split ? (markingByKey.get(k) ?? (k || null)) : marking),
          codeFor,
        }
      )
      if (!v2.split) {
        for (const g of groups) {
          out.push({
            action: 'later',
            kind: 'equipment_gap',
            planned: g.period,
            contractId: contract.id,
            contractLabel: sources.label,
            consolidated: false,
            addonRulesV2: true,
            reason:
              'Glappfaktura för tilläggsstationer. Skapas först när databasändringen för fakturatypen (steg 5) är körd.',
          })
        }
      } else {
        const existingGap = await this.loadExisting(customerId, contract.id, { kind: 'equipment_gap' })
        const byId = new Map(existingGap.map((e) => [e.id, e]))
        for (const e of buildGapDiff(groups, existingGap)) {
          const groupMarking = e.gap ? e.gap.marking : marking
          const entry = decorate(e, 'equipment_gap', groupMarking, e.gap ? markingKeyColumn(e.gap.markingKey) : null, byId)
          if (e.gap?.missingPrice.length) entry.reason = `${e.gap.missingPrice.length} stationer saknar årspris och är inte med`
          out.push(entry)
        }
      }
    }
    return out
  }

  /**
   * Planera om en enskild avtalsfaktura före sändning till Fortnox:
   * debiteringstillfället är sändningen, så antalet tilläggsstationer och
   * utrustningsraderna ska spegla läget just då. Rör bara redigerbara
   * fakturor och bara den här fakturan. Returnerar de aktuella raderna.
   */
  static async refreshContractInvoiceBeforeSend(
    invoiceId: string
  ): Promise<{ changed: boolean; items: Array<Record<string, unknown>>; splitAddonRows?: boolean }> {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_type, contract_id, customer_id, status, is_consolidated')
      .eq('id', invoiceId)
      .maybeSingle()
    const loadItems = async () => {
      const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('created_at')
      return (data ?? []) as Array<Record<string, unknown>>
    }
    if (!inv || inv.invoice_type !== 'contract' || !inv.contract_id || inv.is_consolidated) {
      return { changed: false, items: await loadItems() }
    }
    if (!EDITABLE_STATUSES.has(inv.status ?? '')) return { changed: false, items: await loadItems() }
    try {
      const plan = await this.planForContract(inv.contract_id, { customerId: inv.customer_id ?? undefined })
      // Nya tilläggsregler: tilläggsraderna delas till högst 50 tecken i Fortnox
      const splitAddonRows = plan.entries.some((e) => e.addonRulesV2) || undefined
      const entry = plan.entries.find((e) => e.existingId === invoiceId && e.action === 'update' && e.planned)
      if (!entry) return { changed: false, items: await loadItems(), splitAddonRows }
      const customer = await this.loadCustomer(plan.customerId)
      await this.updateContractInvoice(invoiceId, customer, entry.planned!, entry.contractId ?? plan.contractId, entry)
      return { changed: true, items: await loadItems(), splitAddonRows }
    } catch (err) {
      console.warn('[ContractInvoiceGenerator] Omplanering före sändning misslyckades:', err)
      return { changed: false, items: await loadItems() }
    }
  }

  /**
   * Samlad faktura per kund (gemet): avtal som delar frekvens och ankarmånad
   * (exakt avtalsdag: frekvens och avtalsdag, consolidationGroupKey)
   * hamnar på samma faktura med en rad per avtal. Avtal som avviker faller ut
   * som egna planer. Synth-avtal samfaktureras aldrig (de har inget avtal).
   */
  static async planConsolidatedForCustomer(customerId: string): Promise<BillingPlan[]> {
    // Enhetsavtal räknas med: en samlad faktura kan bära flera enheters avtal.
    const contracts = (await this.liveContractsForFamily(customerId)).filter((c) => !isSyntheticContract(c))
    if (contracts.length === 0) return this.planAllForCustomer(customerId)

    const groups = new Map<string, ContractWithBilling[]>()
    for (const c of contracts) {
      const key = consolidationGroupKey(c)
      groups.set(key, [...(groups.get(key) ?? []), c])
    }

    const plans: BillingPlan[] = []
    const paymentTermsDays = await PaymentTermsService.getDays('contract')
    const billingCustomer = await this.loadCustomer(customerId)

    for (const group of groups.values()) {
      if (group.length === 1) {
        plans.push(await this.planForContract(group[0], { customerId }))
        continue
      }

      // Per avtal: perioder med rader
      type PerContract = { contract: ContractWithBilling; sources: ContractSources; periods: PlannedPeriod[] }
      const perContract: PerContract[] = []
      const equipmentEntries: BillingPlanEntry[] = []
      for (const contract of group) {
        const sources = await this.loadContractSources(contract.id)
        const contractMarking = sources.invoiceReference ?? billingCustomer.billing_reference ?? null
        const v2 = isAddonRulesV2(contract) ? await this.loadAddonV2(contract, sources, paymentTermsDays, contractMarking) : null
        const periods = this.premiumPeriodsFor(contract, sources, paymentTermsDays, v2)
        perContract.push({ contract, sources, periods })
        // Tillägg på egna fakturor samlas aldrig: de planeras per avtal
        equipmentEntries.push(
          ...(v2
            ? await this.planEquipmentEntriesV2(contract, sources, customerId, contractMarking, v2)
            : await this.planEquipmentEntries(contract, sources, customerId, paymentTermsDays, contractMarking))
        )
      }

      // Union av perioder
      const byPeriod = new Map<string, { planned: PlannedPeriod; rows: InvoiceRowSpec[]; labels: string[]; diaries: string[] }>()
      for (const pc of perContract) {
        for (const p of pc.periods) {
          const slot = byPeriod.get(p.periodStart) ?? {
            planned: { ...p, amount: 0, subtotal: 0, vatAmount: 0, totalAmount: 0, equipmentRows: [] },
            rows: [],
            labels: [],
            diaries: [],
          }
          slot.rows.push(
            ...this.buildRowsForContract(pc.contract.id, pc.sources, p, pc.contract.billing_frequency as BillingFrequency | null)
          )
          slot.planned.amount += p.amount
          slot.planned.subtotal = Math.round((slot.planned.subtotal + p.subtotal) * 100) / 100
          slot.planned.vatAmount = Math.round((slot.planned.vatAmount + p.vatAmount) * 100) / 100
          slot.planned.totalAmount = Math.round((slot.planned.subtotal + slot.planned.vatAmount) * 100) / 100
          // Tidigaste fakturadatum och förfallodag vinner
          if (p.invoiceDate < slot.planned.invoiceDate) slot.planned.invoiceDate = p.invoiceDate
          if (p.dueDate < slot.planned.dueDate) slot.planned.dueDate = p.dueDate
          if (p.periodEnd > slot.planned.periodEnd) slot.planned.periodEnd = p.periodEnd
          if (pc.sources.label) slot.labels.push(pc.sources.label)
          if (pc.sources.diaryNumber && !slot.diaries.includes(pc.sources.diaryNumber)) slot.diaries.push(pc.sources.diaryNumber)
          byPeriod.set(p.periodStart, slot)
        }
      }
      const planned = [...byPeriod.values()]
        .map((s) => s.planned)
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
        .map((p, i, arr) => ({ ...p, sequenceNumber: i + 1, totalSequenceCount: arr.length }))

      const existing = await this.loadExisting(customerId, null, { consolidated: true })
      // Alla avtal i gruppen har samma läge (nyckeln skiljer exakt avtalsdag från den 1:a)
      const mode: MatchMode = matchModeFor(group[0])
      const entries: BillingPlanEntry[] = this.buildDiff(planned, existing, { real: true, compareRows: true, mode }).map((e) => {
        if (!e.planned) return { ...e, kind: 'premium' as const, contractId: null, consolidated: true }
        const slot = byPeriod.get(e.planned.periodStart)!
        // Beslut 2026-09-02: huvudkundens referens i huvudet, avtalen som rader.
        const allSameRef = perContract.every(
          (pc) => pc.sources.invoiceReference && pc.sources.invoiceReference === perContract[0].sources.invoiceReference
        )
        const marking = billingCustomer.billing_reference ?? (allSameRef ? perContract[0].sources.invoiceReference : null)
        return {
          ...e,
          kind: 'premium' as const,
          contractId: null,
          consolidated: true,
          rows: slot.rows,
          marking,
          notes: `Årspremie · Period ${periodLabel(e.planned)} · Avtal: ${slot.labels.join(', ')}${
            slot.diaries.length ? ` · ${slot.diaries.join(', ')}` : ''
          }`,
        }
      })

      // Per-avtal-fakturor för samma perioder ersätts av samlingsfakturan
      const groupIds = new Set(group.map((c) => c.id))
      const perContractExisting = (await this.loadExisting(customerId, null)).filter(
        (e) => e.contract_id && groupIds.has(e.contract_id)
      )
      // Samma period: legacy exakt samma startdag (som förut), exakt avtalsdag
      // minst hälften överlapp mot någon av gruppens perioder.
      const coversSlot = (ex: ExistingInvoice): string | null => {
        if (!ex.billing_period_start) return null
        if (mode === 'legacy') return byPeriod.has(ex.billing_period_start) ? ex.billing_period_start : null
        const exRange = { start: ex.billing_period_start, end: ex.billing_period_end ?? ex.billing_period_start }
        for (const [start, slot] of byPeriod) {
          if (periodOverlapShare({ start, end: slot.planned.periodEnd }, exRange) >= SAME_PERIOD_SHARE) return start
        }
        return null
      }
      for (const ex of perContractExisting) {
        const slotStart = coversSlot(ex)
        if (!slotStart) continue
        const status = ex.status ?? 'draft'
        if (EDITABLE_STATUSES.has(status)) {
          entries.push({
            action: 'delete',
            existingId: ex.id,
            existingStatus: status,
            existingAmount: ex.total_amount, existingSubtotal: ex.subtotal,
            contractId: ex.contract_id ?? null,
            reason: 'Ersätts av samlingsfakturan',
          })
        } else if (LOCKED_STATUSES.has(status)) {
          entries.push({
            action: 'locked',
            existingId: ex.id,
            existingStatus: status,
            existingAmount: ex.total_amount, existingSubtotal: ex.subtotal,
            contractId: ex.contract_id ?? null,
            reason: 'Redan skickad per avtal, samlingsfakturan hoppar över perioden',
          })
          // Perioden ska då inte skapas samlat
          const idx = entries.findIndex((en) => en.planned?.periodStart === slotStart && en.action === 'create')
          if (idx >= 0) entries.splice(idx, 1)
        }
      }

      entries.push(...equipmentEntries)
      entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))
      plans.push({
        customerId,
        contractId: null,
        contractLabel: group
          .map((c) => (c as { label?: string | null }).label ?? c.contract_type ?? 'Avtal')
          .join(' + '),
        consolidated: true,
        entries,
        summary: summarize(entries),
      })
    }

    return plans
  }

  // ------- Källor -------

  private static async loadCustomer(customerId: string): Promise<CustomerRow> {
    const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).single()
    if (error || !data) throw new Error(`Kunde inte hämta kund: ${error?.message ?? 'okänt fel'}`)
    const row = data as CustomerRow
    row.organization_number = await resolveOrganizationNumber(row.id, row.organization_number)
    return row
  }

  /** Premietrappa, § 4-rader (premium) och § 5-rader (per_year, per_month) för ett riktigt avtal. */
  private static async loadContractSources(contractId: string): Promise<ContractSources> {
    // Antal tilläggsstationer vid debiteringstillfället: § 5-raderna synkas
    // från utplacerade stationer innan planen räknas (SECURITY DEFINER-RPC).
    try {
      await supabase.rpc('sync_addon_period_lines', { p_customer_id: null, p_contract_id: contractId, p_annual_price: null })
      await supabase.rpc('sync_addon_article_lines', { p_contract_id: contractId })
    } catch (err) {
      console.warn('[ContractInvoiceGenerator] Antalssynk av tilläggsstationer misslyckades:', err)
    }
    const [{ data: contract }, { data: steps }, { data: items }, { data: ledgerRows }] = await Promise.all([
      supabase.from('contracts').select('label, contract_type, display_name, invoice_reference, diary_number, customer_id').eq('id', contractId).maybeSingle(),
      supabase.from('contract_premium_events').select('effective_from, annual_value, event_type, note').eq('contract_id', contractId),
      supabase
        .from('case_billing_items')
        .select(
          'id, article_id, article_code, article_name, service_id, service_code, service_name, quantity, unit_price, total_price, vat_rate, discount_percent, rot_rut_type, fastighetsbeteckning, billing_model, billing_start_date, site_customer_id, station_type_id, status, is_premium_carrier, premium_share'
        )
        .eq('case_id', contractId)
        .eq('case_type', 'contract')
        .eq('item_type', 'service')
        .neq('status', 'cancelled'),
      supabase.rpc('contract_addon_ledger', { p_contract_id: contractId }),
    ])
    type Item = {
      id: string
      article_id: string | null
      article_code: string | null
      article_name: string | null
      service_id: string | null
      service_code: string | null
      service_name: string | null
      quantity: number
      unit_price: number
      total_price: number
      vat_rate: number
      discount_percent: number | null
      rot_rut_type: string | null
      fastighetsbeteckning: string | null
      billing_model: string | null
      billing_start_date?: string | null
      site_customer_id?: string | null
      station_type_id?: string | null
      is_premium_carrier?: boolean | null
      premium_share?: number | string | null
    }
    const rows = (items ?? []) as unknown as Item[]
    // Stationerna bakom varje § 5-rad (enhet + stationstyp), fryses på fakturaraden
    const stationIdsByRow = new Map<string, string[]>()
    for (const l of (ledgerRows ?? []) as Array<{ station_id: string; unit_id: string; station_type_id: string | null; removed_at: string | null }>) {
      if (l.removed_at) continue
      const k = `${l.unit_id}|${l.station_type_id ?? ''}`
      stationIdsByRow.set(k, [...(stationIdsByRow.get(k) ?? []), l.station_id])
    }
    const premiumItems: ContractServiceItem[] = rows
      .filter((r) => (r.billing_model ?? 'premium') === 'premium')
      .map((s) => ({
        case_billing_item_id: s.id,
        article_id: s.article_id,
        display_code: s.service_code ?? s.article_code ?? null,
        display_name: s.service_name ?? s.article_name ?? 'Avtalstjänst',
        quantity: Number(s.quantity),
        unit_price: Number(s.unit_price),
        total_price: Number(s.total_price),
        vat_rate: Number(s.vat_rate),
        discount_percent: Number(s.discount_percent ?? 0),
        rot_rut_type: s.rot_rut_type ?? null,
        fastighetsbeteckning: s.fastighetsbeteckning ?? null,
        is_premium_carrier: !!s.is_premium_carrier,
        premium_share: s.premium_share == null ? null : Number(s.premium_share),
      }))
    const equipment: EquipmentLine[] = rows
      .filter((r) => r.billing_model === 'per_year' || r.billing_model === 'per_month')
      .map((s) => ({
        id: s.id,
        contract_id: contractId,
        name: s.service_name ?? s.article_name ?? 'Utrustning',
        code: s.service_code ?? s.article_code ?? null,
        quantity: Number(s.quantity),
        unit_price_annual: s.billing_model === 'per_month' ? Number(s.unit_price) * 12 : Number(s.unit_price),
        unit_price_month: s.billing_model === 'per_month' ? Number(s.unit_price) : Number(s.unit_price) / 12,
        vat_rate: Number(s.vat_rate),
        billing_model: s.billing_model === 'per_month' ? ('per_month' as const) : ('per_year' as const),
        billing_start_date: s.billing_start_date ?? null,
        station_ids: s.site_customer_id ? (stationIdsByRow.get(`${s.site_customer_id}|${s.station_type_id ?? ''}`) ?? null) : null,
        site_customer_id: s.site_customer_id ?? null,
        station_type_id: s.station_type_id ?? null,
      }))
    const c = contract as {
      label?: string | null
      contract_type?: string | null
      display_name?: string | null
      invoice_reference?: string | null
      diary_number?: string | null
    } | null
    type StepRow = { effective_from: string; annual_value: number | string; event_type?: string | null; note?: string | null }
    return {
      steps: ((steps ?? []) as StepRow[]).map((s) => ({ effective_from: s.effective_from, annual_value: Number(s.annual_value), event_type: s.event_type ?? null })),
      additionNotes: ((steps ?? []) as StepRow[])
        .filter((s) => s.event_type === 'addition' && !!s.note)
        .map((s) => ({ effective_from: s.effective_from, note: s.note as string })),
      premiumItems,
      equipment,
      // Tillägg ligger bredvid avtalet och faktureras ALLTID på en egen faktura
      // i samband med årsfakturan (beslut 2026-09-30). customers.addon_invoice_mode
      // ('with_contract') läses inte längre, kolumnen finns kvar som historik.
      equipmentInvoiceMode: 'separate',
      // Avtalets namn på fakturaraden: användarsatt namn → label → typ
      label: (c?.display_name && c.display_name.trim()) || c?.label || c?.contract_type || null,
      invoiceReference: c?.invoice_reference ?? null,
      diaryNumber: c?.diary_number ?? null,
    }
  }

  /**
   * Befintliga avtalsfakturor. contractId = avtalets egna (+ legacy utan
   * contract_id); null = kundens alla per-avtal-fakturor; consolidated =
   * kundens samlingsfakturor. Fortnox-importer (F-) av typ contract och adhoc
   * följer alltid med, eftersom de kan täcka perioder.
   */
  private static async loadExisting(
    customerId: string,
    contractId: string | null,
    opts?: { consolidated?: boolean; kind?: ContractInvoiceKind }
  ): Promise<ExistingInvoice[]> {
    // Diffen är alltid per fakturatyp: premie, tillägg per år, tillägg per månad
    const kind: ContractInvoiceKind = opts?.kind ?? 'premium'
    let q = supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, billing_period_start, billing_period_end, total_amount, subtotal, is_historical, is_consolidated, contract_id, invoice_type, contract_invoice_kind, marking_key, fortnox_document_number, invoice_items(article_name, line_kind, contract_id, total_price)'
      )
      .eq('customer_id', customerId)
      .in('invoice_type', ['contract', 'adhoc'])
      .eq('contract_invoice_kind', kind)
      // Makulerade fakturor täcker ingen period: de unika indexen släpper
      // igenom en ny faktura för perioden, och planen ska göra detsamma.
      .neq('status', 'cancelled')
    if (opts?.consolidated) q = q.eq('is_consolidated', true)
    else if (contractId) q = q.or(`contract_id.eq.${contractId},contract_id.is.null`).eq('is_consolidated', false)
    else q = q.eq('is_consolidated', false)

    const { data, error } = await q
    if (error) throw new Error(`Kunde inte hämta befintliga fakturor: ${error.message}`)
    return ((data ?? []) as unknown as ExistingInvoice[])
      .filter((e) => e.invoice_type === 'contract' || (e.invoice_number ?? '').startsWith('F-'))
      .map((e) => ({
        ...e,
        has_generic_items: (e.invoice_items ?? []).length > 0 && (e.invoice_items ?? []).every((it) => !it.line_kind),
        rowSignature: rowSignature(e.invoice_items ?? []),
      }))
  }

  /**
   * Samlade fakturor där avtalet redan ligger (rad med contract_id), i
   * hämtordning. Matchningen mot perioderna görs i buildContractDiff (legacy:
   * samma månad, sista vinner som förut; exakt avtalsdag: överlapp).
   */
  private static async loadConsolidatedPeriodsForContract(customerId: string, contractId: string): Promise<ExistingInvoice[]> {
    const rows = await this.loadExisting(customerId, null, { consolidated: true })
    return rows.filter(
      (inv) => !!inv.billing_period_start && (inv.invoice_items ?? []).some((it) => it.contract_id === contractId)
    )
  }

  // ------- Rader -------

  /** Fakturaraderna för en period: src/shared/contractInvoiceRows.ts (samma rader server-side vid signering). */
  private static buildRowsForContract(
    contractId: string,
    sources: ContractSources,
    planned: PlannedPeriod,
    freq: BillingFrequency | null
  ): InvoiceRowSpec[] {
    // Frekvensen behövs inte längre för premieraderna: beloppet är periodens
    // premie ur trappan och fördelas efter andelar, inte skalat radpris.
    void freq
    return buildContractInvoiceRows(contractId, sources, planned)
  }

  private static buildNotes(planned: PlannedPeriod, label: string | null, diary: string | null): string {
    return buildContractInvoiceNotes(planned, label, diary)
  }

  // ------- Diff -------

  /**
   * Bygg diff: planerade vs befintliga. Matchningen bor i
   * src/shared/contractInvoiceMatch.ts (buildContractDiff), samma kod som
   * cronen, signeringen och regressionsskriptet använder.
   * real = riktigt avtal: passerade perioder utan faktura blir 'uncovered'
   * (aldrig automatisk betald historik). compareRows = jämför radmängden,
   * inte bara beloppet (samlad faktura, görs i refineWithRows).
   */
  private static buildDiff(
    planned: PlannedInvoice[],
    existing: ExistingInvoice[],
    opts: { real: boolean; compareRows?: boolean; consolidatedInvoices?: ExistingInvoice[]; mode?: MatchMode }
  ): BillingPlanEntry[] {
    return buildContractDiff(planned, existing, opts)
  }

  /** Efterjustering vid radjämförelse (samlad faktura): 'keep' blir 'update' när radmängden ändrats. */
  private static refineWithRows(entries: BillingPlanEntry[], existing: ExistingInvoice[]): BillingPlanEntry[] {
    const byId = new Map(existing.map((e) => [e.id, e]))
    return entries.map((e) => {
      if (e.action !== 'keep' || !e.existingId || !e.rows) return e
      const ex = byId.get(e.existingId)
      if (!ex) return e
      if (ex.rowSignature !== rowSignature(e.rows)) return { ...e, action: 'update' }
      return e
    })
  }

  // ------- Apply -------

  /**
   * Applicera plan: skapa/uppdatera/radera invoices + invoice_items.
   * 'uncovered' och 'consolidated' rörs aldrig.
   */
  static async apply(plan: BillingPlan): Promise<ApplyResult> {
    const customer = await this.loadCustomer(plan.customerId)

    const result: ApplyResult = { createdIds: [], updatedIds: [], deletedIds: [], historicalIds: [], skippedLocked: 0, uncovered: 0 }

    const entries = plan.consolidated
      ? this.refineWithRows(plan.entries, await this.loadExisting(plan.customerId, null, { consolidated: true }))
      : plan.entries

    // Kundraden per post: enhetsavtalets faktura skrivs på enheten.
    const customerCache = new Map<string, CustomerRow>([[plan.customerId, customer]])
    const customerFor = async (entry: BillingPlanEntry): Promise<CustomerRow> => {
      const id = entry.consolidated ? plan.customerId : (entry.customerId ?? plan.customerId)
      const cached = customerCache.get(id)
      if (cached) return cached
      const loaded = await this.loadCustomer(id)
      customerCache.set(id, loaded)
      return loaded
    }

    // Nya tilläggsregler: utkast som ska bort raderas före allt annat, så att
    // en ny faktura för en annan märkning inte krockar med det gamla utkastet
    // för samma period (gamla unika indexet, överlappsvakten).
    const v2Deletes = entries.filter((e) => e.addonRulesV2 && e.action === 'delete' && e.existingId)
    for (const entry of v2Deletes) {
      await supabase.from('invoice_items').delete().eq('invoice_id', entry.existingId!)
      const { error } = await supabase.from('invoices').delete().eq('id', entry.existingId!)
      if (error) throw new Error(`Kunde inte radera faktura: ${error.message}`)
      result.deletedIds.push(entry.existingId!)
    }

    for (const entry of entries) {
      const contractId = entry.consolidated ? null : (entry.contractId ?? plan.contractId)
      if (v2Deletes.includes(entry)) continue
      if (entry.action === 'keep' || entry.action === 'consolidated' || entry.action === 'later') continue
      // Perioden har börjat och fakturan saknas i Fortnox: utkastet står kvar
      // för godkännande, planen ändrar ingenting automatiskt.
      if (entry.action === 'overdue-send') continue
      if (entry.action === 'link-fortnox' || entry.action === 'link-fortnox-indexed') {
        const chosen = entry.fortnox?.candidates.find((c) => c.documentNumber === entry.fortnox?.chosen)
        if (!chosen || !entry.planned) {
          result.fortnoxSkipped = (result.fortnoxSkipped ?? 0) + 1
          continue
        }
        const linked = await this.linkFortnoxInvoice(plan, entry, chosen, contractId)
        if (!linked) {
          result.fortnoxSkipped = (result.fortnoxSkipped ?? 0) + 1
          continue
        }
        result.linkedIds = [...(result.linkedIds ?? []), linked.invoiceId]
        if (linked.indexed) result.indexedSteps = (result.indexedSteps ?? 0) + 1
        if (linked.indexError) result.indexErrors = [...(result.indexErrors ?? []), linked.indexError]
        continue
      }
      if (entry.action === 'uncovered') {
        result.uncovered++
        continue
      }
      if (entry.action === 'locked') {
        result.skippedLocked++
        continue
      }
      if (entry.action === 'delete' && entry.existingId) {
        await supabase.from('invoice_items').delete().eq('invoice_id', entry.existingId)
        const { error } = await supabase.from('invoices').delete().eq('id', entry.existingId)
        if (error) throw new Error(`Kunde inte radera faktura: ${error.message}`)
        result.deletedIds.push(entry.existingId)
        continue
      }
      if (entry.action === 'create' && entry.planned) {
        const id = await this.insertContractInvoice(await customerFor(entry), entry.planned, contractId, entry)
        result.createdIds.push(id)
        continue
      }
      if (entry.action === 'create-historical' && entry.planned) {
        const id = await this.insertHistoricalPaidInvoice(await customerFor(entry), entry.planned, contractId)
        result.historicalIds.push(id)
        continue
      }
      if (entry.action === 'backfill-historical-paid' && entry.existingId && entry.planned) {
        await this.backfillHistoricalPaid(entry.existingId, await customerFor(entry), entry.planned, contractId)
        result.historicalIds.push(entry.existingId)
        continue
      }
      if (entry.action === 'update' && entry.existingId && entry.planned) {
        await this.updateContractInvoice(entry.existingId, await customerFor(entry), entry.planned, contractId, entry)
        result.updatedIds.push(entry.existingId)
      }
    }

    return result
  }

  /**
   * Plan + apply i ett anrop, enligt kundens faktureringsläge (gemet).
   */
  static async regenerateForCustomer(customerId: string): Promise<ApplyResult> {
    const plans = await this.planCombinedForCustomer(customerId)
    const merged: ApplyResult = { createdIds: [], updatedIds: [], deletedIds: [], historicalIds: [], skippedLocked: 0, uncovered: 0 }
    for (const plan of plans) {
      const r = await this.apply(plan)
      merged.createdIds.push(...r.createdIds)
      merged.updatedIds.push(...r.updatedIds)
      merged.deletedIds.push(...r.deletedIds)
      merged.historicalIds.push(...r.historicalIds)
      merged.skippedLocked += r.skippedLocked
      merged.uncovered += r.uncovered
    }
    return merged
  }

  /**
   * När en kund sägs upp: radera framtida icke-låsta fakturor efter cutoff.
   * Bindningstiden respekteras — fakturor inom contract_start→contract_end raderas aldrig.
   */
  static async cancelFutureAfterTermination(customerId: string): Promise<number> {
    const { data: customer, error } = await supabase.from('customers').select('*').eq('id', customerId).single()
    if (error || !customer) return 0

    const cutoff = computeTerminationCutoff(customer as CustomerRow)
    if (!cutoff) return 0

    // Satt slutdatum (effective_end_date) är sista giltiga dag och betalas:
    // bara perioder som börjar EFTER det tas bort. Utan slutdatum är cutoff
    // dagen då avtalet upphör, och en period som startar där tas bort.
    const lastDayKnown = !!(customer as CustomerRow).effective_end_date
    const base = supabase
      .from('invoices')
      .select('id, status, billing_period_start')
      .eq('customer_id', customerId)
      .eq('invoice_type', 'contract')
    const { data: toDelete, error: fErr } = lastDayKnown
      ? await base.gt('billing_period_start', toLocalIsoDate(cutoff))
      : await base.gte('billing_period_start', toLocalIsoDate(cutoff))

    if (fErr) throw new Error(fErr.message)

    let deleted = 0
    for (const inv of toDelete ?? []) {
      if (LOCKED_STATUSES.has(inv.status ?? '')) continue
      await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
      const { error: dErr } = await supabase.from('invoices').delete().eq('id', inv.id)
      if (!dErr) deleted++
    }
    return deleted
  }

  /**
   * När ETT avtal sägs upp: ta bort framtida icke-låsta avtalsfakturor som hör
   * till just det avtalet, och avtalets rader på kundens samlingsfakturor.
   * Kundens andra avtal rörs aldrig. Rader utan contract_id lämnas orörda.
   *
   * effectiveEndDate = sista giltiga dagen, och kunden betalar till och med
   * den. Bara perioder som STARTAR efter slutdatumet tas bort (gt).
   */
  static async cancelFutureForContract(contractId: string, effectiveEndDate: string): Promise<number> {
    if (!contractId || contractId.startsWith('synth-') || contractId.startsWith('kundrad-')) return 0

    const { data: toDelete, error } = await supabase
      .from('invoices')
      .select('id, status, billing_period_start')
      .eq('contract_id', contractId)
      .eq('invoice_type', 'contract')
      .gt('billing_period_start', effectiveEndDate)
    if (error) throw new Error(`Kunde inte hämta framtida fakturor: ${error.message}`)

    let deleted = 0
    for (const inv of toDelete ?? []) {
      if (LOCKED_STATUSES.has(inv.status ?? '')) continue
      await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
      const { error: dErr } = await supabase.from('invoices').delete().eq('id', inv.id)
      if (!dErr) deleted++
    }

    // Samlade fakturor: ta bort avtalets rader, räkna om, radera tomma
    const { data: consolidatedRows } = await supabase
      .from('invoice_items')
      .select('id, invoice_id, invoice:invoices!inner(id, status, billing_period_start, is_consolidated)')
      .eq('contract_id', contractId)
    type ConsRow = { id: string; invoice_id: string; invoice: { id: string; status: string | null; billing_period_start: string | null; is_consolidated: boolean | null } | null }
    const touched = new Set<string>()
    for (const r of (consolidatedRows ?? []) as unknown as ConsRow[]) {
      const inv = r.invoice
      if (!inv?.is_consolidated || !inv.billing_period_start || inv.billing_period_start <= effectiveEndDate) continue
      if (LOCKED_STATUSES.has(inv.status ?? '')) continue
      await supabase.from('invoice_items').delete().eq('id', r.id)
      touched.add(inv.id)
    }
    for (const invoiceId of touched) {
      const { data: left } = await supabase.from('invoice_items').select('id').eq('invoice_id', invoiceId).limit(1)
      if (!left || left.length === 0) {
        const { error: dErr } = await supabase.from('invoices').delete().eq('id', invoiceId)
        if (!dErr) deleted++
      } else {
        await this.recalculateInvoiceTotals(invoiceId)
      }
    }
    return deleted
  }

  /**
   * Skapa/uppdatera en adhoc-faktura för contract_billing_items (item_type=ad_hoc).
   */
  static async generateAdhocInvoiceForCase(params: {
    customerId: string
    caseId: string
    completedAt: Date | string
    grouping: 'per_case' | 'monthly_batch'
  }): Promise<string | null> {
    const { customerId, caseId, completedAt, grouping } = params

    const customer = await this.loadCustomer(customerId)

    const completedDate = typeof completedAt === 'string' ? new Date(completedAt) : completedAt
    const y = completedDate.getFullYear()
    const m = completedDate.getMonth()
    const monthStart = toLocalIsoDate(new Date(y, m, 1))
    const monthEnd = toLocalIsoDate(new Date(y, m + 1, 0))

    let q = supabase
      .from('contract_billing_items')
      .select('id, total_price, article_name, article_code, quantity, unit_price, vat_rate, discount_percent, case_id, billing_period_start, visit_id, visit_number, case_billing_item_id')
      .eq('customer_id', customerId)
      .eq('item_type', 'ad_hoc')
      .is('invoice_id', null)
      .neq('status', 'cancelled')

    if (grouping === 'per_case') q = q.eq('case_id', caseId)
    else q = q.gte('billing_period_start', monthStart).lte('billing_period_start', monthEnd)

    const { data: items, error: iErr } = await q
    if (iErr) throw new Error(`Kunde inte hämta faktureringsrader: ${iErr.message}`)
    if (!items || items.length === 0) return null

    const subtotal = items.reduce((sum, i) => sum + Number(i.total_price), 0)
    const vatAmount = items.reduce((sum, i) => sum + Number(i.total_price) * (Number(i.vat_rate) / 100), 0)
    const total = subtotal + vatAmount

    let existingInvoiceId: string | null = null
    if (grouping === 'monthly_batch') {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('customer_id', customerId)
        .eq('invoice_type', 'adhoc')
        .eq('billing_period_start', monthStart)
        .in('status', ['draft', 'pending_approval', 'ready'])
        .maybeSingle()
      if (existing) existingInvoiceId = existing.id
    }

    // 0 kr-regeln: en ny merförsäljningsfaktura skapas aldrig på 0 kr.
    // createAdHocItemsFromCase stoppar redan 0 kr-ärenden innan raderna skapas;
    // det här skyddar återkörningen från Merförsäljning-fliken och månadsbatchen.
    // En befintlig öppen batchfaktura fylls på som förut.
    if (!existingInvoiceId && Math.abs(subtotal) < 0.005) return null

    // Fakturamärkning ("Er referens" i Fortnox): ärendets vid per_case, annars
    // enhetens fasta kod (månadsbatchen är per enhet, så koden gäller alla rader).
    let invoiceMarking: string | null = null
    if (grouping === 'per_case') {
      const { data: caseRow } = await supabase.from('cases').select('invoice_marking').eq('id', caseId).maybeSingle()
      invoiceMarking = caseRow?.invoice_marking?.trim() || null
    } else {
      invoiceMarking = customer.billing_reference?.trim() || null
    }

    // Besökskoppling: bara vid per_case OCH när samtliga rader hör till samma besök.
    const invoiceVisitId = grouping === 'per_case' ? InvoiceService.resolveSharedVisitId(items) : null

    // Tilläggsfaktura (per ärende): perioden är pro rata-perioden, från första
    // dagen som betalas till dagen före avtalets nästa periodstart, inte
    // avslutsmånaden. Månadsbatchen behåller månaden (den identifierar batchen).
    let invoicePeriod = { start: monthStart, end: monthEnd }
    if (grouping === 'per_case') {
      const addonPeriod = await this.addonPeriodForBillingItems(items)
      if (addonPeriod) invoicePeriod = { start: addonPeriod.start, end: addonPeriod.end }
    }

    let invoiceId: string
    if (existingInvoiceId) {
      invoiceId = existingInvoiceId
      await this.addItemsToAdhocInvoice(invoiceId, items)
      await this.recalculateInvoiceTotals(invoiceId)
    } else {
      const invNum = await this.generateInvoiceNumber()
      const due = new Date()
      const paymentTermsDays = await PaymentTermsService.getDays('contract')
      due.setDate(due.getDate() + paymentTermsDays)
      const { data: inv, error: insErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invNum,
          invoice_type: 'adhoc',
          customer_id: customerId,
          case_id: grouping === 'per_case' ? caseId : null,
          case_type: null,
          visit_id: invoiceVisitId,
          customer_name: customer.company_name,
          customer_email: customer.billing_email ?? customer.contact_email,
          customer_phone: customer.contact_phone,
          customer_address: customer.billing_address ?? customer.contact_address,
          organization_number: customer.organization_number,
          subtotal: Math.round(subtotal),
          vat_amount: Math.round(vatAmount),
          total_amount: Math.round(total),
          status: 'pending_approval',
          requires_approval: true,
          billing_period_start: invoicePeriod.start,
          billing_period_end: invoicePeriod.end,
          due_date: toLocalIsoDate(due),
          invoice_marking: invoiceMarking,
        })
        .select('id')
        .single()
      if (insErr || !inv) return null
      invoiceId = inv.id
      await this.addItemsToAdhocInvoice(invoiceId, items)
    }

    // Raderna får fakturans period när den är tilläggsperioden, så att
    // kundkortets dubblettkontroll (kund + periodstart) matchar fakturan
    const periodUpdate = invoicePeriod.start !== monthStart
      ? { billing_period_start: invoicePeriod.start, billing_period_end: invoicePeriod.end }
      : {}
    await supabase
      .from('contract_billing_items')
      .update({ invoice_id: invoiceId, status: 'invoiced', ...periodUpdate })
      .in('id', items.map((i) => i.id))

    return invoiceId
  }

  /**
   * Pro rata-perioden för merförsäljningsrader som kommer från ärendets
   * tilläggsrader (case_billing_items.is_addon_prorata_line). Null när inga
   * rader är tillägg. Matten är tidslinjens (addonEconomics).
   */
  private static async addonPeriodForBillingItems(
    items: Array<{ id: string; case_id: string | null; article_code: string | null; case_billing_item_id?: string | null }>
  ): Promise<{ start: string; end: string; nextStart: string } | null> {
    const rowIds = items.map((i) => i.case_billing_item_id).filter((x): x is string => !!x)
    if (rowIds.length === 0) return null
    const { data: rows } = await supabase
      .from('case_billing_items')
      .select('id, case_id, item_type, status, service_code, article_code, quantity, unit_price, total_price, addon_annual_unit_price, billing_start_date, addon_model, is_addon_prorata_line, is_addon_labour_line, addon_labour_hours, addon_labour_hours_before')
      .in('id', rowIds)
    if (!rows || rows.length === 0) return null
    const lines = matchInvoiceAddonLines(
      items.map((i) => ({ id: i.id, article_code: i.article_code, contract_billing_item_id: i.id })),
      items.map((i) => ({ id: i.id, case_id: i.case_id, case_billing_item_id: i.case_billing_item_id ?? null, article_code: i.article_code })),
      rows as unknown as AddonCaseRow[]
    )
    return addonInvoicePeriod(lines)
  }

  private static async addItemsToAdhocInvoice(
    invoiceId: string,
    items: Array<{
      id: string
      article_name: string | null
      article_code: string | null
      quantity: number
      unit_price: number
      total_price: number
      vat_rate: number
      discount_percent: number | null
    }>
  ): Promise<void> {
    const rows = items.map((i) => ({
      invoice_id: invoiceId,
      contract_billing_item_id: i.id,
      article_name: i.article_name ?? 'Merförsäljning',
      article_code: i.article_code,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price,
      vat_rate: i.vat_rate,
      discount_percent: i.discount_percent ?? 0,
      line_kind: 'service',
    }))
    await supabase.from('invoice_items').insert(rows)
  }

  private static async recalculateInvoiceTotals(invoiceId: string): Promise<void> {
    const { data: items } = await supabase.from('invoice_items').select('total_price, vat_rate').eq('invoice_id', invoiceId)
    if (!items) return
    const subtotal = items.reduce((s, i) => s + Number(i.total_price), 0)
    const vat = items.reduce((s, i) => s + Number(i.total_price) * (Number(i.vat_rate) / 100), 0)
    await supabase
      .from('invoices')
      .update({ subtotal: Math.round(subtotal), vat_amount: Math.round(vat), total_amount: Math.round(subtotal + vat) })
      .eq('id', invoiceId)
  }

  /**
   * Cron-säkerhetsnät (webbvarianten): kunder vars avtalsslut passerat utan
   * uppsägning planeras om enligt sitt faktureringsläge. Den skarpa cronen
   * ligger i api/cron/generate-continuing-contracts.ts.
   */
  static async generateContinuingContracts(): Promise<{ customerId: string; created: number }[]> {
    const today = toLocalIsoDate(todayLocal())
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id')
      .lt('contract_end_date', today)
      .is('terminated_at', null)
      .eq('billing_active', true)
    if (error) throw new Error(error.message)

    const results: { customerId: string; created: number }[] = []
    for (const c of customers ?? []) {
      try {
        const r = await this.regenerateForCustomer(c.id)
        if (r.createdIds.length > 0) results.push({ customerId: c.id, created: r.createdIds.length })
      } catch (err) {
        console.error(`Fel vid regenerering av ${c.id}:`, err)
      }
    }
    return results
  }

  /**
   * Legacy: kundens avtalsartiklar via importcontainern (synth-kunder).
   * Riktiga avtal läser sina egna rader i loadContractSources.
   */
  private static async getServiceItemsForCustomer(customerId: string, freq: BillingFrequency): Promise<ContractServiceItem[]> {
    try {
      const contractId = await ImportedCustomerContractService.findContract(customerId)
      if (!contractId) return []
      const { services } = await ImportedCustomerContractService.getItems(contractId)
      if (services.length === 0) return []
      const divisor = periodDivisor(freq)
      return services.map((s) => {
        const anyS = s as unknown as Record<string, unknown>
        return {
          case_billing_item_id: s.id,
          article_id: s.article_id,
          display_code: (anyS.service_code as string | null) ?? s.article_code ?? null,
          display_name: (anyS.service_name as string | null) ?? s.article_name ?? 'Avtalstjänst',
          quantity: s.quantity,
          unit_price: Math.round((Number(s.unit_price) * 100) / divisor) / 100,
          total_price: Math.round((Number(s.total_price) * 100) / divisor) / 100,
          vat_rate: Number(s.vat_rate),
          discount_percent: Number(s.discount_percent ?? 0),
          rot_rut_type: (anyS.rot_rut_type as string | null) ?? null,
          fastighetsbeteckning: (anyS.fastighetsbeteckning as string | null) ?? null,
        }
      })
    } catch (err) {
      console.error('Kunde inte hämta avtalsartiklar:', err)
      return []
    }
  }

  /** Rader för synth-avtal: importcontainerns § 4-rader, annars generisk. */
  private static async buildLegacyRows(customer: CustomerRow, planned: PlannedInvoice): Promise<InvoiceRowSpec[]> {
    const serviceItems = await this.getServiceItemsForCustomer(customer.id, customer.billing_frequency!)
    if (serviceItems.length > 0) {
      return serviceItems.map((it) => ({
        contract_id: null,
        line_kind: 'premium',
        case_billing_item_id: it.case_billing_item_id,
        article_id: null,
        article_code: it.display_code,
        article_name: it.display_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
        vat_rate: it.vat_rate,
        discount_percent: it.discount_percent,
        rot_rut_type: it.rot_rut_type,
        fastighetsbeteckning: it.fastighetsbeteckning,
      }))
    }
    return [
      {
        contract_id: null,
        line_kind: 'generic',
        article_code: null,
        article_name: `Årspremie, ${periodLabel(planned)}`,
        quantity: 1,
        unit_price: planned.amount,
        total_price: planned.amount,
        vat_rate: 25,
        discount_percent: 0,
      },
    ]
  }

  private static toItemRows(invoiceId: string, rows: InvoiceRowSpec[]): Array<Record<string, unknown>> {
    return toInvoiceItemRows(invoiceId, rows)
  }

  private static buildLegacyNotes(planned: PlannedInvoice): string {
    return `Årspremie · Betalning ${planned.sequenceNumber}/${planned.totalSequenceCount} · Period ${periodLabel(planned)}`
  }

  // ------- Privata hjälpare för DB-skrivning -------

  private static async insertContractInvoice(
    customer: CustomerRow,
    planned: PlannedInvoice,
    contractId: string | null,
    entry?: BillingPlanEntry
  ): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber()
    const rows = entry?.rows ?? (await this.buildLegacyRows(customer, planned))
    const notes = entry?.notes ?? this.buildLegacyNotes(planned)
    // Fakturadatum = ledtiden före periodstart (planerarens invoiceDate)
    const createdAt = parseLocalDate(planned.invoiceDate).toISOString()
    const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
    const vat = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        customer_id: customer.id,
        contract_id: contractId,
        is_consolidated: entry?.consolidated ?? false,
        contract_invoice_kind: planned.kind ?? 'premium',
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal,
        vat_amount: vat,
        total_amount: Math.round((subtotal + vat) * 100) / 100,
        status: 'pending_approval',
        requires_approval: false,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: planned.dueDate,
        is_historical: false,
        invoice_marking: entry?.marking ?? customer.billing_reference ?? null,
        notes,
        created_at: createdAt,
        // Nya tilläggsregler: märkningsnyckeln (en tilläggsfaktura per referenskod)
        ...(entry?.markingKey !== undefined ? { marking_key: entry.markingKey } : {}),
      })
      .select('id')
      .single()

    if (error) throw new Error(`Kunde inte skapa faktura: ${error.message}`)
    if (!inv) throw new Error('Faktura skapades ej')

    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(inv.id, rows))
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)

    return inv.id
  }

  /**
   * Fortnox-kontrollens koppling: periodens utkast (eller den tomma perioden)
   * görs om till Fortnox-fakturan F-{nr} via samma import som § 6 använder.
   * Utkast som ändrats sedan planen räknades (skickats, fått Fortnox-nummer)
   * rörs inte. Indexerad träff på ett årsavtal lägger ett indexsteg i trappan
   * från periodstart, så att nästa års plan räknar på det nya beloppet.
   */
  private static async linkFortnoxInvoice(
    plan: BillingPlan,
    entry: BillingPlanEntry,
    candidate: FortnoxCandidate,
    contractId: string | null
  ): Promise<{ invoiceId: string; indexed: boolean; indexError?: string } | null> {
    if (!entry.planned) return null
    let customerId = entry.consolidated ? plan.customerId : (entry.customerId ?? plan.customerId)
    let periodStart = entry.planned.periodStart
    let periodEnd = entry.planned.periodEnd
    if (entry.existingId) {
      const { data: row } = await supabase
        .from('invoices')
        .select('customer_id, status, fortnox_document_number, billing_period_start, billing_period_end')
        .eq('id', entry.existingId)
        .maybeSingle()
      const r = row as { customer_id: string | null; status: string | null; fortnox_document_number: string | null; billing_period_start: string | null; billing_period_end: string | null } | null
      if (!r || !EDITABLE_STATUSES.has(r.status ?? 'draft') || r.fortnox_document_number) return null
      customerId = r.customer_id ?? customerId
      periodStart = r.billing_period_start ?? periodStart
      periodEnd = r.billing_period_end ?? periodEnd
    }
    const consolidated = !!entry.consolidated
    const coveredContractIds = consolidated
      ? [...new Set((entry.rows ?? []).map((r) => r.contract_id).filter((id): id is string => !!id))]
      : undefined
    const imported = await ContractInvoiceImportService.importForPeriod({
      fortnoxNumber: candidate.documentNumber,
      customerId,
      contractId: consolidated ? null : contractId,
      kind: entry.kind === 'equipment' ? 'equipment' : 'premium',
      periodStart,
      periodEnd,
      coveredContractIds,
      replaceInvoiceId: entry.existingId ?? null,
      removeInvoiceIds: entry.duplicateIds,
    })

    let indexed = false
    let indexError: string | undefined
    if (entry.action === 'link-fortnox-indexed' && !consolidated && contractId && (entry.kind ?? 'premium') === 'premium') {
      try {
        indexed = await this.addIndexStepFromFortnox(contractId, entry.planned, imported.subtotal, candidate.documentNumber)
      } catch (err) {
        indexError = err instanceof Error ? err.message : 'Kunde inte lägga indexsteget'
      }
    }
    return { invoiceId: imported.invoiceId, indexed, indexError }
  }

  /**
   * Indexsteg ur en indexerad Fortnox-faktura. Bara årsavtal: en period är
   * ett år, så fakturans belopp är årspremien. Delperiod (pro rata) eller
   * utrustning på samma faktura skalas med samma faktor. Finns redan en
   * indexering från periodstart görs ingenting.
   */
  private static async addIndexStepFromFortnox(
    contractId: string,
    planned: PlannedPeriod,
    net: number,
    fortnoxNumber: string
  ): Promise<boolean> {
    const { data: c } = await supabase.from('contracts').select('billing_frequency').eq('id', contractId).maybeSingle()
    if ((c as { billing_frequency?: string | null } | null)?.billing_frequency !== 'annual') return false
    const { data: same } = await supabase
      .from('contract_premium_events')
      .select('id')
      .eq('contract_id', contractId)
      .eq('effective_from', planned.periodStart)
      .eq('event_type', 'indexation')
      .limit(1)
    if ((same ?? []).length > 0) return false
    const plain = Math.abs(planned.subtotal - planned.annualInForce) < 1
    const annual = plain || planned.subtotal <= 0 ? Math.round(net) : Math.round((planned.annualInForce * net) / planned.subtotal)
    if (!(annual > 0)) return false
    await ContractScopeService.addPremiumEvent(contractId, {
      eventType: 'indexation',
      effectiveFrom: planned.periodStart,
      annualValue: annual,
      note: `Indexerat belopp enligt Fortnox ${fortnoxNumber}`,
    })
    return true
  }

  /**
   * Historisk faktura direkt som status=paid, is_historical=true. Bara för
   * synth-avtal (kunder utan avtalsrad); riktiga avtal får 'uncovered'.
   */
  /**
   * En passerad period som fakturerats utanför portalen (systemet före
   * Fortnox, manuell faktura) registreras som historisk, betald faktura så
   * att planen räknar perioden som täckt. Motsvarar "koppla Fortnox-faktura"
   * för perioder som inte finns i Fortnox. Beloppet är det användaren anger,
   * märkt som ej verifierat i noteringen.
   */
  static async markPeriodInvoicedOutside(
    customerId: string,
    contractId: string | null,
    planned: PlannedInvoice,
    input: { amount: number; invoicedAt: string; note: string | null }
  ): Promise<string> {
    // Ett enhetsavtal faktureras på enhetens kundrad, inte på huvudkontoret:
    // annars hamnar historiken på fel kund i fakturafliken (Huddinge Pastorat
    // 2026-09-18). Avtalets egen customer_id vinner över den som anropade.
    let billedCustomerId = customerId
    if (contractId) {
      const { data: c } = await supabase.from('contracts').select('customer_id').eq('id', contractId).maybeSingle()
      const owner = (c as { customer_id?: string | null } | null)?.customer_id
      if (owner) billedCustomerId = owner
    }
    const customer = await this.loadCustomer(billedCustomerId)
    const label = contractId ? (await this.loadContractSources(contractId)).label : null
    const invoiceNumber = `HIST-${planned.periodStart.slice(0, 7)}-${billedCustomerId.slice(0, 8)}`
    const { data: dup } = await supabase.from('invoices').select('id').eq('invoice_number', invoiceNumber).maybeSingle()
    if (dup) throw new Error('Perioden är redan registrerad som fakturerad utanför portalen')

    const amount = Math.round(input.amount * 100) / 100
    const vat = Math.round(amount * 25) / 100
    const invoicedAt = parseLocalDate(input.invoicedAt).toISOString()
    const notes = `Årspremie · Period ${periodLabel(planned)} · Fakturerad utanför portalen ${input.invoicedAt}, belopp ej verifierat mot Fortnox.${
      input.note ? ` ${input.note}` : ''
    }`

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        contract_invoice_kind: planned.kind ?? 'premium',
        is_consolidated: false,
        customer_id: customer.id,
        contract_id: contractId,
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: amount,
        vat_amount: vat,
        total_amount: Math.round((amount + vat) * 100) / 100,
        status: 'paid',
        requires_approval: false,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: input.invoicedAt,
        booked_at: invoicedAt,
        sent_at: invoicedAt,
        paid_at: invoicedAt,
        is_historical: true,
        notes,
        created_at: invoicedAt,
      })
      .select('id')
      .single()
    if (error) throw new Error(`Kunde inte registrera perioden: ${error.message}`)
    if (!inv) throw new Error('Perioden registrerades inte')

    const { error: itemErr } = await supabase.from('invoice_items').insert(
      this.toItemRows(inv.id, [
        {
          contract_id: contractId,
          line_kind: 'premium',
          article_code: null,
          article_name: `Årspremie ${label ?? 'avtal'}, ${periodLabel(planned)} (fakturerad utanför portalen)`,
          quantity: 1,
          unit_price: amount,
          total_price: amount,
          vat_rate: 25,
          discount_percent: 0,
        },
      ])
    )
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)
    return inv.id
  }

  private static async insertHistoricalPaidInvoice(customer: CustomerRow, planned: PlannedInvoice, contractId: string | null): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber()
    const periodStart = parseLocalDate(planned.periodStart)
    const bookedSentAt = periodStart.toISOString()
    const paidAt = parseLocalDate(planned.dueDate).toISOString()
    const rows = await this.buildLegacyRows(customer, planned)
    const notes = `${this.buildLegacyNotes(planned)} · Autogenererad historik utan Fortnox-verifikat`

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: 'contract',
        customer_id: customer.id,
        contract_id: contractId,
        case_id: null,
        case_type: null,
        customer_name: customer.company_name,
        customer_email: customer.billing_email ?? customer.contact_email,
        customer_phone: customer.contact_phone,
        customer_address: customer.billing_address ?? customer.contact_address,
        organization_number: customer.organization_number,
        subtotal: planned.amount,
        vat_amount: planned.vatAmount,
        total_amount: planned.totalAmount,
        status: 'paid',
        requires_approval: false,
        billing_period_start: planned.periodStart,
        billing_period_end: planned.periodEnd,
        due_date: planned.dueDate,
        booked_at: bookedSentAt,
        sent_at: bookedSentAt,
        paid_at: paidAt,
        is_historical: true,
        notes,
        created_at: bookedSentAt,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Kunde inte skapa historisk faktura: ${error.message}`)
    if (!inv) throw new Error('Historisk faktura skapades ej')

    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(inv.id, rows))
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)

    return inv.id
  }

  private static async backfillHistoricalPaid(invoiceId: string, customer: CustomerRow, planned: PlannedInvoice, contractId: string | null): Promise<void> {
    const periodStart = parseLocalDate(planned.periodStart)
    const bookedSentAt = periodStart.toISOString()
    const paidAt = parseLocalDate(planned.dueDate).toISOString()
    const rows = await this.buildLegacyRows(customer, planned)

    const updatePayload: Record<string, unknown> = {
      status: 'paid',
      requires_approval: false,
      booked_at: bookedSentAt,
      sent_at: bookedSentAt,
      paid_at: paidAt,
      is_historical: true,
      notes: `${this.buildLegacyNotes(planned)} · Autogenererad historik utan Fortnox-verifikat`,
      created_at: bookedSentAt,
    }
    if (contractId) updatePayload.contract_id = contractId

    const { error } = await supabase.from('invoices').update(updatePayload).eq('id', invoiceId)
    if (error) throw new Error(`Kunde inte backfilla historisk: ${error.message}`)

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(invoiceId, rows))
    if (itemErr) throw new Error(`Kunde inte uppdatera fakturarader: ${itemErr.message}`)
  }

  private static async updateContractInvoice(
    invoiceId: string,
    customer: CustomerRow,
    planned: PlannedInvoice,
    contractId: string | null,
    entry?: BillingPlanEntry
  ): Promise<void> {
    const rows = entry?.rows ?? (await this.buildLegacyRows(customer, planned))
    const notes = entry?.notes ?? this.buildLegacyNotes(planned)
    const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
    const vat = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100

    const updatePayload: Record<string, unknown> = {
      customer_name: customer.company_name,
      customer_email: customer.billing_email ?? customer.contact_email,
      customer_phone: customer.contact_phone,
      customer_address: customer.billing_address ?? customer.contact_address,
      organization_number: customer.organization_number,
      subtotal,
      vat_amount: vat,
      total_amount: Math.round((subtotal + vat) * 100) / 100,
      billing_period_start: planned.periodStart,
      billing_period_end: planned.periodEnd,
      due_date: planned.dueDate,
      created_at: parseLocalDate(planned.invoiceDate).toISOString(),
      notes,
      requires_approval: false,
    }
    if (contractId) updatePayload.contract_id = contractId
    if (entry?.marking !== undefined) updatePayload.invoice_marking = entry.marking
    if (entry?.markingKey !== undefined) updatePayload.marking_key = entry.markingKey
    if (entry?.consolidated) updatePayload.is_consolidated = true
    if (planned.kind) updatePayload.contract_invoice_kind = planned.kind
    // En redan godkänd faktura vars rader ändras ska granskas igen
    if (entry?.existingStatus === 'ready') updatePayload.status = 'pending_approval'

    const { error } = await supabase.from('invoices').update(updatePayload).eq('id', invoiceId)
    if (error) throw new Error(`Kunde inte uppdatera faktura: ${error.message}`)

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const { error: itemErr } = await supabase.from('invoice_items').insert(this.toItemRows(invoiceId, rows))
    if (itemErr) throw new Error(`Kunde inte skapa fakturarad: ${itemErr.message}`)
  }

  private static async generateInvoiceNumber(): Promise<string> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `INV-${year}${month}`
    // Högsta befintliga sekvensnummer i stället för count(): count räknar inte
    // raderade rader, vilket kolliderar när rader städats bort.
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextSeq = 1
    if (data?.invoice_number) {
      const match = /-(\d+)$/.exec(data.invoice_number)
      if (match) nextSeq = parseInt(match[1], 10) + 1
    }
    return `${prefix}-${String(nextSeq).padStart(4, '0')}`
  }
}
