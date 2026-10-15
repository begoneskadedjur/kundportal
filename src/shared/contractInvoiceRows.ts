// src/shared/contractInvoiceRows.ts
// Fakturaraderna för en avtalsperiod. Ren modul utan databas, utbruten ur
// ContractInvoiceGenerator (src/services/contractInvoiceGenerator.ts) så att
// samma rader byggs i webben (Planera fakturor) och server-side vid signering
// (api/_lib/contractSigning.ts). Ändra radernas utseende HÄR, aldrig i en kopia.

import { resolvePremiumShares, allocateByShares } from './premiumShares'
import type { EquipmentLine, PlannedPeriod } from './contractPlanner'

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

export function periodLabel(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>): string {
  return `${p.periodStart} t.o.m. ${p.periodEnd}`
}

export function buildContractInvoiceRows(contractId: string, sources: ContractRowSources, planned: PlannedPeriod): InvoiceRowSpec[] {
  const period = periodLabel(planned)
  const diary = sources.diaryNumber ? ` (${sources.diaryNumber})` : ''
  const rows: InvoiceRowSpec[] = []

  // Egna tilläggsfakturor: bara utrustningsraderna
  if (planned.kind === 'equipment' || planned.kind === 'equipment_monthly') {
    for (const eq of planned.equipmentRows) {
      rows.push({
        contract_id: contractId,
        line_kind: planned.kind === 'equipment_monthly' ? 'equipment_monthly' : 'equipment_annual',
        case_billing_item_id: eq.source_id,
        article_code: eq.code,
        article_name: `${eq.name}, tillägg utöver avtal${sources.label ? ` ${sources.label}` : ''}, ${period}, ${eq.quantity} st`,
        quantity: eq.quantity,
        unit_price: eq.unit_price,
        total_price: eq.total_price,
        vat_rate: eq.vat_rate,
        discount_percent: 0,
        station_ids: sources.equipment.find((e) => e.id === eq.source_id)?.station_ids ?? null,
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
          ? `Årspremie ${sources.label ?? it.display_name}, ${period}${diary}`
          : `${it.display_name}, andel av årspremien ${period}${diary}`,
        quantity,
        unit_price: unit,
        total_price: total,
        vat_rate: it.vat_rate,
        discount_percent: it.discount_percent,
        rot_rut_type: it.rot_rut_type,
        fastighetsbeteckning: it.fastighetsbeteckning,
      })
    }
  } else if (planned.amount > 0) {
    rows.push({
      contract_id: contractId,
      line_kind: 'premium',
      article_code: null,
      article_name: `Årspremie ${sources.label ?? 'avtal'}, ${period}${diary}`,
      quantity: 1,
      unit_price: planned.amount,
      total_price: planned.amount,
      vat_rate: 25,
      discount_percent: 0,
    })
  }

  for (const eq of planned.equipmentRows) {
    rows.push({
      contract_id: contractId,
      line_kind: 'equipment_annual',
      case_billing_item_id: eq.source_id,
      article_code: eq.code,
      article_name: `${eq.name}, tillägg utöver avtal, ${period}`,
      quantity: eq.quantity,
      unit_price: eq.unit_price,
      total_price: eq.total_price,
      vat_rate: eq.vat_rate,
      discount_percent: 0,
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
  if (planned.kind === 'equipment' || planned.kind === 'equipment_monthly') {
    return `Tilläggsstationer utöver avtal${label ? ` ${label}` : ''} · Period ${periodLabel(planned)}${diary ? ` · ${diary}` : ''}`
  }
  return `Årspremie${label ? ` ${label}` : ''} · Betalning ${planned.sequenceNumber}/${planned.totalSequenceCount} · Period ${periodLabel(planned)}${
    diary ? ` · ${diary}` : ''
  }`
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
