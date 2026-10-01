// src/shared/invoiceAddonLines.ts
// Tilläggsrader på en faktura: kopplingen fakturarad → merförsäljningsrad →
// ärendets tilläggsrad (pro rata per stationstyp eller arbetstid), periodtexten
// under raden, priskontrollen mot avtalspriset och raderna som skickas till
// Fortnox. Ren modul utan DB. All matte kommer från addonEconomics
// (timelineFromRow, timelineForProposal), här räknas inget nytt.
//
// Regler (Christian 2026-09-30, BE-0008974):
// - Första tilläggsfakturan täcker tiden fram till dagen före avtalets nästa
//   periodstart. Därefter faktureras tilläggen årsvis på en egen faktura i
//   samband med årsfakturan.
// - Arbetstiden faktureras som timmar: antal = timmar, à-pris = timpris ×
//   dagar / 365. Summan är sanningen; à-priset avrundas till två decimaler
//   när summan inte går jämnt ut på timmarna (1,5 h à 399,37 = 599,05).

import { timelineForProposal, timelineFromRow, type AddonTimeline, type AddonTimelineRow } from './addonEconomics'
import { toVatInclusivePrice } from './fortnoxCustomerNumbers'

/** Ärendets rad (case_billing_items) med det tidslinjen och kopplingen behöver. */
export interface AddonCaseRow extends AddonTimelineRow {
  id: string
  case_id?: string | null
  item_type?: string | null
  status?: string | null
  service_id?: string | null
  service_code?: string | null
  article_code?: string | null
  service_name?: string | null
  article_name?: string | null
  is_addon_prorata_line?: boolean | null
  station_type_id?: string | null
}

/** Merförsäljningsraden (contract_billing_items) som fakturaraden pekar på. */
export interface BillingItemLink {
  id: string
  case_id: string | null
  case_billing_item_id?: string | null
  article_code?: string | null
}

export interface InvoiceItemLike {
  id: string
  article_code: string | null
  article_name: string
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  discount_percent: number
  contract_billing_item_id?: string | null
  rot_rut_type?: string | null
  line_kind?: string | null
}

export type InvoiceAddonKind = 'station' | 'labour'

export interface InvoiceAddonLine {
  invoiceItemId: string
  kind: InvoiceAddonKind
  row: AddonCaseRow
  timeline: AddonTimeline
}

const isAddonRow = (r: AddonCaseRow) => r.is_addon_prorata_line === true && r.status !== 'cancelled'
const codeOf = (r: AddonCaseRow) => r.service_code || r.article_code || null

/**
 * Fakturarad → ärendets tilläggsrad. Primärt via
 * contract_billing_items.case_billing_item_id, annars (äldre rader) en
 * entydig träff på samma ärende + kod bland tilläggsraderna. Rader som inte
 * är tillägg, eller saknar årspris, ger ingen tilläggsrad.
 */
export function matchInvoiceAddonLines(
  items: Array<Pick<InvoiceItemLike, 'id' | 'article_code' | 'contract_billing_item_id'>>,
  billingItems: BillingItemLink[],
  caseRows: AddonCaseRow[]
): InvoiceAddonLine[] {
  const byBillingId = new Map(billingItems.map((b) => [b.id, b]))
  const byRowId = new Map(caseRows.map((r) => [r.id, r]))
  const out: InvoiceAddonLine[] = []
  for (const item of items) {
    const link = item.contract_billing_item_id ? byBillingId.get(item.contract_billing_item_id) : undefined
    if (!link) continue
    let row = link.case_billing_item_id ? byRowId.get(link.case_billing_item_id) : undefined
    if (!row && !link.case_billing_item_id && link.case_id) {
      const code = item.article_code ?? link.article_code ?? null
      const candidates = caseRows.filter((r) => r.case_id === link.case_id && isAddonRow(r) && code != null && codeOf(r) === code)
      if (candidates.length === 1) row = candidates[0]
    }
    if (!row || !isAddonRow(row)) continue
    const timeline = timelineFromRow(row)
    if (!timeline) continue
    out.push({ invoiceItemId: item.id, kind: row.is_addon_labour_line ? 'labour' : 'station', row, timeline })
  }
  return out
}

/** "2026-09-29 till 2027-06-30" */
export function addonPeriodText(t: Pick<AddonTimeline, 'fromDate' | 'toDate'>): string | null {
  if (!t.fromDate || !t.toDate) return null
  return `${t.fromDate} till ${t.toDate}`
}

/** Fakturans tilläggsperiod: första dag som betalas till dagen före nästa periodstart. */
export function addonInvoicePeriod(lines: InvoiceAddonLine[]): { start: string; end: string; nextStart: string } | null {
  const withDates = lines.filter((l) => l.timeline.fromDate && l.timeline.toDate && l.timeline.startDate && l.timeline.totalNow > 0)
  if (withDates.length === 0) return null
  const start = withDates.map((l) => l.timeline.fromDate!).sort()[0]
  const end = withDates.map((l) => l.timeline.toDate!).sort().reverse()[0]
  const nextStart = withDates.map((l) => l.timeline.startDate!).sort()[0]
  return { start, end, nextStart }
}

/** Radnamnet på fakturan: "Mekanisk fälla (tilläggsstation)" → "Mekanisk fälla, tilläggsstation". */
export function addonLineName(name: string, kind: InvoiceAddonKind): string {
  if (kind === 'labour') return 'Arbetstid för att hantera tilläggen'
  return name.replace(/\s*\(tilläggsstation\)\s*$/i, ', tilläggsstation')
}

/** Stationstypens namn utan suffix ("Mekanisk fälla"). */
export function addonTypeName(name: string | null | undefined): string {
  return (name || 'Tilläggsstation').replace(/\s*[,(]\s*tilläggsstation\)?\s*$/i, '')
}

/**
 * Vad raden ska kosta enligt avtalspriset: samma dagar som raden avser,
 * årspriset ur prislistan. Samma formel som RPC:n och tidslinjen
 * (timelineForProposal), ingen egen matte.
 */
export function addonExpectedTotal(line: InvoiceAddonLine, listAnnual: number): number {
  const t = line.timeline
  if (t.fromDate && t.startDate) {
    return timelineForProposal({
      fromDate: t.fromDate,
      startDate: t.startDate,
      perUnitAnnual: listAnnual,
      quantityNow: t.quantityNow,
      unit: t.unit,
      model: t.model,
    }).totalNow
  }
  return Math.round(Math.round(listAnnual * t.fraction * 100) / 100 * t.quantityNow * 100) / 100
}

/** Textraden efter fakturaraderna till kunden (Fortnox). */
export function addonCustomerNote(nextStart: string): string[] {
  return [
    'Tilläggsstationerna faktureras för tiden fram till avtalets nästa årspremie.',
    `Från ${nextStart} faktureras de årsvis i samband med avtalets årsfaktura, med samma faktureringsperiod som avtalet.`,
  ]
}

/** Förklaringen i fakturamodalen (för ekonomi). */
export function addonInvoiceExplanation(nextStart: string | null): string {
  return nextStart
    ? `Fakturan täcker tiden fram till dagen före avtalets nästa årspremie. Från ${nextStart} faktureras tilläggen på en egen faktura i samband med årsfakturan och följer sedan samma faktureringsperiod som avtalet.`
    : 'Fakturan täcker tiden fram till dagen före avtalets nästa årspremie. Därefter faktureras tilläggen på en egen faktura i samband med årsfakturan och följer samma faktureringsperiod som avtalet.'
}

// ─── Fortnox ──────────────────────────────────────────────────────────────

export type FortnoxInvoiceRow =
  | { Description: string }
  | {
      ArticleNumber?: string
      Description: string
      DeliveredQuantity: number
      Price: number
      VAT: number
      Discount?: number
      DiscountType?: 'PERCENT'
      HouseWork?: boolean
      HouseWorkType?: string
    }

const houseWorkTypeFor = (rotRut: string | null | undefined) =>
  rotRut?.toUpperCase() === 'ROT' ? 'CONSTRUCTION'
  : rotRut?.toUpperCase() === 'RUT' ? 'CLEANING'
  : undefined

/**
 * Fakturaraderna till Fortnox. Textrader (line_kind index_note, 0 kr) skickas
 * som ren Description så Fortnox inte bokför en 0-rad med artikel och moms.
 * Tilläggsrader får perioden som textrad direkt under, arbetstiden skickas
 * som timmar ("…, timmar"), och efter sista raden kommer förklaringen om
 * när tilläggen faktureras nästa gång.
 */
export function buildFortnoxInvoiceRows(
  items: InvoiceItemLike[],
  opts: {
    vatIncluded: boolean
    fastighetsbeteckning?: string | null
    addonLines?: InvoiceAddonLine[]
  }
): FortnoxInvoiceRow[] {
  const addonByItem = new Map((opts.addonLines ?? []).map((l) => [l.invoiceItemId, l]))
  const rows: FortnoxInvoiceRow[] = []
  for (const item of items) {
    if (item.line_kind === 'index_note') {
      rows.push({ Description: item.article_name.slice(0, 200) })
      continue
    }
    const addon = addonByItem.get(item.id)
    const name = addon
      ? addon.kind === 'labour'
        ? `${addonLineName(item.article_name, 'labour')}, timmar`
        : addonLineName(item.article_name, 'station')
      : item.article_name
    rows.push({
      ArticleNumber: item.article_code || undefined,
      Description: name.slice(0, 200),
      DeliveredQuantity: Number(item.quantity),
      Price: opts.vatIncluded ? toVatInclusivePrice(Number(item.unit_price), item.vat_rate) : Number(item.unit_price),
      VAT: item.vat_rate,
      ...(item.discount_percent > 0 ? { Discount: item.discount_percent, DiscountType: 'PERCENT' as const } : {}),
      ...(item.rot_rut_type && opts.fastighetsbeteckning
        ? { HouseWork: true, HouseWorkType: houseWorkTypeFor(item.rot_rut_type) }
        : {}),
    })
    const period = addon ? addonPeriodText(addon.timeline) : null
    if (period) rows.push({ Description: `Period ${period}` })
  }
  const period = addonInvoicePeriod(opts.addonLines ?? [])
  if (period && (opts.addonLines ?? []).some((l) => l.kind === 'station')) {
    for (const line of addonCustomerNote(period.nextStart)) rows.push({ Description: line.slice(0, 200) })
  }
  return rows
}
