// src/shared/contractInvoiceRows.ts
// Fakturaraderna för en avtalsperiod. Ren modul utan databas, utbruten ur
// ContractInvoiceGenerator (src/services/contractInvoiceGenerator.ts) så att
// samma rader byggs i webben (Planera fakturor) och server-side vid signering
// (api/_lib/contractSigning.ts). Ändra radernas utseende HÄR, aldrig i en kopia.

import { resolvePremiumShares, allocateByShares } from './premiumShares'
import type { EquipmentLine, PlannedPeriod, PremiumStep } from './contractPlanner'
import { gapRowName, GAP_INVOICE_NOTE, isV2Row, v2AddonRowName } from './addonPlanV2'

export interface ContractServiceItem {
  case_billing_item_id: string
  article_id: string | null
  display_code: string | null // service_code || article_code (samma fallback som invoiceService)
  display_name: string // service_name || article_name
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  rot_rut_type: string | null
  fastighetsbeteckning: string | null
  /** Bärande § 4-rad (avtalstypen): restposten av premien */
  is_premium_carrier?: boolean
  /** Andel av premien på icke-bärande rad, null = 0 */
  premium_share?: number | null
}

export type InvoiceLineKind = 'premium' | 'equipment_annual' | 'equipment_monthly' | 'index_note' | 'addon_round' | 'service' | 'article' | 'generic'

/** Fakturarad som planen bär fram till apply. */
export interface InvoiceRowSpec {
  contract_id: string | null
  line_kind: InvoiceLineKind
  case_billing_item_id?: string | null
  article_id?: string | null
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  rot_rut_type?: string | null
  fastighetsbeteckning?: string | null
  /** Tilläggsstationerna raden avsåg när fakturan skapades (fryst kopia) */
  station_ids?: string[] | null
}

/** Det radbyggaren behöver från avtalets källor. */
export interface ContractRowSources {
  premiumItems: ContractServiceItem[]
  equipment: EquipmentLine[]
  /** Tilläggssteg i trappan med text: textrad på periodens premiefaktura */
  additionNotes: Array<{ effective_from: string; note: string }>
  label: string | null
  diaryNumber: string | null
}

// ------- Källor -------
// Samma mappning från databasraderna till radbyggarens källor i Planera
// fakturor (ContractInvoiceGenerator.loadContractSources) och nattjobbet
// (api/cron/generate-continuing-contracts.ts), så att båda bygger samma rader.

/** Kolumnerna på case_billing_items som källorna läser (§ 4, § 6) */
export const CONTRACT_SOURCE_ITEM_COLUMNS =
  'id, article_id, article_code, article_name, service_id, service_code, service_name, quantity, unit_price, total_price, vat_rate, discount_percent, rot_rut_type, fastighetsbeteckning, billing_model, billing_start_date, site_customer_id, station_type_id, status, is_premium_carrier, premium_share, addon_billing_group_id'

export interface ContractSourceItemRow {
  id: string
  article_id?: string | null
  article_code: string | null
  article_name: string | null
  service_code?: string | null
  service_name?: string | null
  quantity: number | string
  unit_price: number | string
  total_price: number | string
  vat_rate: number | string
  discount_percent: number | string | null
  rot_rut_type?: string | null
  fastighetsbeteckning?: string | null
  billing_model: string | null
  billing_start_date?: string | null
  site_customer_id?: string | null
  station_type_id?: string | null
  is_premium_carrier?: boolean | null
  premium_share?: number | string | null
  /** Faktureringsgrupp för § 6-raden (nya tilläggsregler) */
  addon_billing_group_id?: string | null
}

export interface ContractSourceStepRow {
  effective_from: string
  annual_value: number | string
  event_type?: string | null
  note?: string | null
}

export interface ContractSourceLedgerRow {
  station_id: string
  unit_id: string
  station_type_id: string | null
  removed_at: string | null
}

export interface ContractSourceContract {
  display_name?: string | null
  label?: string | null
  contract_type?: string | null
  invoice_reference?: string | null
  diary_number?: string | null
}

export interface ContractSourcesData extends ContractRowSources {
  steps: PremiumStep[]
  invoiceReference: string | null
}

/** Avtalets namn på fakturaraden: användarsatt namn, label, typ */
export function contractRowLabel(c: ContractSourceContract | null | undefined): string | null {
  return (c?.display_name && c.display_name.trim()) || c?.label || c?.contract_type || null
}

/** Premietrappa, § 4-rader (premium) och § 6-rader (per_year, per_month) som radbyggarens källor. */
export function contractSourcesFromRows(
  contractId: string,
  contract: ContractSourceContract | null | undefined,
  steps: ContractSourceStepRow[],
  items: ContractSourceItemRow[],
  ledger: ContractSourceLedgerRow[]
): ContractSourcesData {
  // Stationerna bakom varje § 6-rad (enhet + stationstyp), fryses på fakturaraden
  const stationIdsByRow = new Map<string, string[]>()
  for (const l of ledger) {
    if (l.removed_at) continue
    const k = `${l.unit_id}|${l.station_type_id ?? ''}`
    stationIdsByRow.set(k, [...(stationIdsByRow.get(k) ?? []), l.station_id])
  }
  const premiumItems: ContractServiceItem[] = items
    .filter((r) => (r.billing_model ?? 'premium') === 'premium')
    .map((s) => ({
      case_billing_item_id: s.id,
      article_id: s.article_id ?? null,
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
  const equipment: EquipmentLine[] = items
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
      // Bara när raden har en grupp: dumparna för rader utan grupp är oförändrade
      ...(s.addon_billing_group_id ? { billing_group_id: s.addon_billing_group_id } : {}),
    }))
  return {
    steps: steps.map((s) => ({ effective_from: s.effective_from, annual_value: Number(s.annual_value), event_type: s.event_type ?? null })),
    additionNotes: steps
      .filter((s) => s.event_type === 'addition' && !!s.note)
      .map((s) => ({ effective_from: s.effective_from, note: s.note as string })),
    premiumItems,
    equipment,
    label: contractRowLabel(contract),
    invoiceReference: contract?.invoice_reference ?? null,
    diaryNumber: contract?.diary_number ?? null,
  }
}

export function periodLabel(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>): string {
  return `${p.periodStart} t.o.m. ${p.periodEnd}`
}

/**
 * Premiens namn efter periodens längd: Månadspremie, Kvartalspremie,
 * Halvårspremie eller Årspremie. Andra längder (förkortad första period o.d.)
 * heter bara Premie. Texten står på kundens faktura.
 */
export function premiumLabel(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>): string {
  const [y1, m1, d1] = p.periodStart.split('-').map(Number)
  const [ye, me, de] = p.periodEnd.split('-').map(Number)
  const end = new Date(Date.UTC(ye, me - 1, de) + 86_400_000)
  const [y2, m2, d2] = [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()]
  const months = (y2 - y1) * 12 + (m2 - m1)
  // Hela månader: samma dag, eller start den sista och nästa period på kortare månad
  const whole = d2 === d1 || (d1 > 28 && d2 < d1 && new Date(Date.UTC(y2, m2 - 1, d2 + 1)).getUTCDate() === 1)
  if (!whole) return 'Premie'
  return months === 1 ? 'Månadspremie' : months === 3 ? 'Kvartalspremie' : months === 6 ? 'Halvårspremie' : months === 12 ? 'Årspremie' : 'Premie'
}

export function buildContractInvoiceRows(contractId: string, sources: ContractRowSources, planned: PlannedPeriod): InvoiceRowSpec[] {
  const period = periodLabel(planned)
  const diary = sources.diaryNumber ? ` (${sources.diaryNumber})` : ''
  const rows: InvoiceRowSpec[] = []

  // Glappfaktura (nya tilläggsregler, steg 11): en rad per enhet och
  // stationstyp, dagarna från utsättningen till nästa periodstart
  if (planned.kind === 'equipment_gap') {
    for (const eq of planned.equipmentRows) {
      rows.push({
        contract_id: contractId,
        line_kind: 'equipment_annual',
        case_billing_item_id: null,
        article_code: eq.code,
        article_name: gapRowName(eq, period),
        quantity: eq.quantity,
        unit_price: eq.unit_price,
        total_price: eq.total_price,
        vat_rate: eq.vat_rate,
        discount_percent: 0,
        station_ids: eq.station_ids ?? null,
      })
    }
    return rows
  }

  // Egna tilläggsfakturor: bara utrustningsraderna
  if (planned.kind === 'equipment' || planned.kind === 'equipment_monthly') {
    for (const eq of planned.equipmentRows) {
      // Nya tilläggsregler: enhetens namn på raden och periodens stationer
      const v2 = isV2Row(eq)
      rows.push({
        contract_id: contractId,
        line_kind: planned.kind === 'equipment_monthly' ? 'equipment_monthly' : 'equipment_annual',
        case_billing_item_id: eq.source_id,
        article_code: eq.code,
        article_name: v2
          ? v2AddonRowName(eq, sources.label, period)
          : `${eq.name}, tillägg utöver avtal${sources.label ? ` ${sources.label}` : ''}, ${period}, ${eq.quantity} st`,
        quantity: eq.quantity,
        unit_price: eq.unit_price,
        total_price: eq.total_price,
        vat_rate: eq.vat_rate,
        discount_percent: 0,
        station_ids: v2 ? (eq.station_ids ?? null) : (sources.equipment.find((e) => e.id === eq.source_id)?.station_ids ?? null),
      })
    }
    return rows
  }

  // § 4-raderna bär ANDELAR av premien, aldrig belopp. Beloppet är alltid
  // periodens premie ur § 6-trappan. Bärande raden (avtalstypen) är
  // restposten; rader med andel 0 skrivs som textrad "ingår" (0 kr) så
  // kunden ser vad premien täcker. Fakturan kan aldrig bli 0 kr så länge
  // § 6 har en premie: saknas andelar helt skrivs en vanlig premierad.
  const shareResult = resolvePremiumShares(
    sources.premiumItems.map((it) => ({
      id: it.case_billing_item_id,
      is_premium_carrier: it.is_premium_carrier,
      premium_share: it.premium_share,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.total_price,
    }))
  )
  const order = [...sources.premiumItems]
    .sort((a, b) => Number(!!b.is_premium_carrier) - Number(!!a.is_premium_carrier))
    .map((it) => it.case_billing_item_id)
  const anyShare = order.some((id) => (shareResult.shares.get(id) ?? 0) > 0)

  if (sources.premiumItems.length > 0 && anyShare && planned.amount > 0) {
    const amounts = allocateByShares(planned.amount, order, shareResult.shares)
    for (const id of order) {
      const it = sources.premiumItems.find((x) => x.case_billing_item_id === id)!
      const total = amounts.get(id) ?? 0
      if (total <= 0) {
        // Ingår utan debitering: textrad, 0 kr (samma hantering som index_note vid sändning)
        rows.push({
          contract_id: contractId,
          line_kind: 'index_note',
          case_billing_item_id: it.case_billing_item_id,
          article_id: null,
          article_code: it.display_code,
          article_name: `${it.display_name}, ingår i avtalet${it.quantity > 1 ? `, ${it.quantity} st` : ''}`,
          quantity: 0,
          unit_price: 0,
          total_price: 0,
          vat_rate: it.vat_rate,
          discount_percent: 0,
        })
        continue
      }
      const isCarrier = !!it.is_premium_carrier
      const quantity = isCarrier ? 1 : it.quantity > 0 ? it.quantity : 1
      const unit = Math.round((total / quantity) * 100) / 100
      rows.push({
        contract_id: contractId,
        line_kind: 'premium',
        case_billing_item_id: it.case_billing_item_id,
        article_id: null,
        article_code: it.display_code,
        article_name: isCarrier
          ? `${premiumLabel(planned)} ${sources.label ?? it.display_name}, ${period}${diary}`
          : `${it.display_name}, andel av ${premiumLabel(planned).toLowerCase()}n ${period}${diary}`,
        quantity,
        unit_price: unit,
        total_price: total,
        vat_rate: it.vat_rate,
        // Premien ur § 6 är redan priset efter avtalets rabatt (Oneflow-beloppet
        // är netto, contracts.annual_value). À-priset ovan är alltså nettot och
        // raden får ingen rabatt till: med radens procent här drog Fortnox
        // (Price × antal × (1 − Discount)) rabatten en gång till varje år.
        discount_percent: 0,
        rot_rut_type: it.rot_rut_type,
        fastighetsbeteckning: it.fastighetsbeteckning,
      })
    }
  } else if (planned.amount > 0) {
    rows.push({
      contract_id: contractId,
      line_kind: 'premium',
      article_code: null,
      article_name: `${premiumLabel(planned)} ${sources.label ?? 'avtal'}, ${period}${diary}`,
      quantity: 1,
      unit_price: planned.amount,
      total_price: planned.amount,
      vat_rate: 25,
      discount_percent: 0,
    })
  }

  for (const eq of planned.equipmentRows) {
    // Nya tilläggsregler med månadspremie: tilläggen på premiefakturan, med
    // enhetens namn och stationerna (täckningen skrivs när fakturan skickas)
    const v2 = isV2Row(eq)
    rows.push({
      contract_id: contractId,
      line_kind: 'equipment_annual',
      case_billing_item_id: eq.source_id,
      article_code: eq.code,
      article_name: v2 ? v2AddonRowName(eq, null, period) : `${eq.name}, tillägg utöver avtal, ${period}`,
      quantity: eq.quantity,
      unit_price: eq.unit_price,
      total_price: eq.total_price,
      vat_rate: eq.vat_rate,
      discount_percent: 0,
      ...(v2 ? { station_ids: eq.station_ids ?? null } : {}),
    })
  }

  // Inbakade tillägg: textrad (0 kr) som förklarar höjningen på den
  // period där steget träder i kraft ("Tilläggsstationer adderade …")
  for (const step of sources.additionNotes) {
    if (step.effective_from < planned.periodStart || step.effective_from > planned.periodEnd) continue
    rows.push({
      contract_id: contractId,
      line_kind: 'index_note',
      article_code: null,
      article_name: step.note.slice(0, 200),
      quantity: 0,
      unit_price: 0,
      total_price: 0,
      vat_rate: 25,
      discount_percent: 0,
    })
  }

  return rows
}

export function buildContractInvoiceNotes(planned: PlannedPeriod, label: string | null, diary: string | null): string {
  if (planned.kind === 'equipment_gap') {
    return `${GAP_INVOICE_NOTE}${label ? ` · ${label}` : ''} · Period ${periodLabel(planned)}${diary ? ` · ${diary}` : ''}`
  }
  if (planned.kind === 'equipment' || planned.kind === 'equipment_monthly') {
    return `Tilläggsstationer utöver avtal${label ? ` ${label}` : ''} · Period ${periodLabel(planned)}${diary ? ` · ${diary}` : ''}`
  }
  return `${premiumLabel(planned)}${label ? ` ${label}` : ''} · Period ${periodLabel(planned)}${
    diary ? ` · ${diary}` : ''
  }`
}

/**
 * Samlingsfakturans anteckning: avtalens namn och diarienummer i gruppen
 * (beslut 2026-09-02: huvudkundens referens i huvudet, avtalen som rader).
 */
export function buildConsolidatedInvoiceNotes(planned: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>, labels: string[], diaries: string[]): string {
  return `${premiumLabel(planned)} · Period ${periodLabel(planned)} · Avtal: ${labels.join(', ')}${diaries.length ? ` · ${diaries.join(', ')}` : ''}`
}

/** Samlingsfakturans märkning: kundens referens, annars avtalens gemensamma referens */
export function consolidatedInvoiceMarking(customerReference: string | null | undefined, contractReferences: Array<string | null>): string | null {
  const first = contractReferences[0] ?? null
  const allSameRef = contractReferences.every((r) => r && r === first)
  return customerReference ?? (allSameRef ? first : null)
}

/** invoice_items-rader för en faktura */
export function toInvoiceItemRows(invoiceId: string, rows: InvoiceRowSpec[]): Array<Record<string, unknown>> {
  return rows.map((r) => ({
    invoice_id: invoiceId,
    contract_id: r.contract_id,
    line_kind: r.line_kind,
    case_billing_item_id: r.case_billing_item_id ?? null,
    article_id: r.article_id ?? null,
    article_code: r.article_code,
    article_name: r.article_name,
    quantity: r.quantity,
    unit_price: r.unit_price,
    total_price: r.total_price,
    vat_rate: r.vat_rate,
    discount_percent: r.discount_percent,
    rot_rut_type: r.rot_rut_type ?? null,
    fastighetsbeteckning: r.fastighetsbeteckning ?? null,
    station_ids: r.station_ids ?? null,
  }))
}

/** Fakturans summor ur raderna (exkl. moms, moms, totalt), avrundade till ören */
export function invoiceTotals(rows: InvoiceRowSpec[]): { subtotal: number; vat: number; total: number } {
  const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
  const vat = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100
  return { subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100 }
}

/** Fakturanumret efter den högsta sekvensen i månaden (INV-ÅÅÅÅMM-NNNN) */
export function nextInvoiceNumber(prefix: string, highest: string | null | undefined): string {
  let next = 1
  const match = highest ? /-(\d+)$/.exec(highest) : null
  if (match) next = parseInt(match[1], 10) + 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}
