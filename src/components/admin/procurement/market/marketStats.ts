// src/components/admin/procurement/market/marketStats.ts
// Rena aggregat för upphandlingsportalens Marknad, Avtalsklocka, Köpare och
// Konkurrenter. Ingen databas, inga React-beroenden: allt räknas ur raderna som
// ProcurementService redan hämtat, så att reglerna går att testa
// (marketStats.test.ts).
//
// Grundbegrepp
//   - En upphandling (ProcurementGroup) är alla tilldelningsrader med samma
//     källa och source_ref. Ett ramavtal med tre leverantörer blir en grupp med
//     tre vinnare.
//   - Samma upphandling kan finnas i både TED och UHM (2021 till 2023). Grupper
//     från olika källor slås ihop när köpare, vinnarmängd och år stämmer
//     (mergeCrossSource), annars räknas marknaden dubbelt.
//   - Värdet har alltid en art: 'ceiling' är avtalets ramtak (inte vinnande
//     pris), 'actual' är verkligt pris. Marknadens storlek räknar bara de två.
//   - Leverantörer matchas på orgnr, aldrig på namn.
//
// Plan: docs/upphandlingsportal-plan.md avsnitt 2, 3, 4 (verktyg 5, 8, 9, 10).

import type { AwardWithRelations, BidderWithSupplier } from '../../../../services/procurementService'
import type {
  ProcurementAwardSource,
  ProcurementAwardStatus,
  ProcurementEndSource,
  ProcurementFollowupStatus,
  ProcurementNotice,
  ProcurementSourceHealth,
  ProcurementValueKind,
} from '../../../../types/procurement'
import {
  BEGONE_COUNTIES,
  addMonthsIso,
  countyFromName,
  daysBetweenIso,
  normalizeOrgNumber,
  normalizeName,
  quarterOf,
  swedishDate,
  workWindow,
} from '../../../../shared/procurementRules'

// ---------------------------------------------------------------------------
// Leverantörer

export const ORG_ANTICIMEX = '5560329285'
export const ORG_NOMOR = '5565263976'
export const ORG_BEGONE = '5593789208'

export type SupplierClass = 'anticimex' | 'nomor' | 'begone' | 'other'

export const SUPPLIER_CLASSES: SupplierClass[] = ['anticimex', 'nomor', 'begone', 'other']

export const SUPPLIER_CLASS_LABEL: Record<SupplierClass, string> = {
  anticimex: 'Anticimex',
  nomor: 'Nomor/Rentokil',
  begone: 'BeGone',
  other: 'Övriga',
}

/** Fast färg per leverantörsklass, följer leverantören oavsett filter */
export const SUPPLIER_CLASS_COLOR: Record<SupplierClass, string> = {
  begone: '#20c58f',
  anticimex: '#38bdf8',
  nomor: '#f59e0b',
  other: '#94a3b8',
}

export function classifyOrg(org: string | null | undefined, isBegone = false): SupplierClass {
  if (isBegone) return 'begone'
  const o = normalizeOrgNumber(org)
  if (o === ORG_ANTICIMEX) return 'anticimex'
  if (o === ORG_NOMOR) return 'nomor'
  if (o === ORG_BEGONE) return 'begone'
  return 'other'
}

// ---------------------------------------------------------------------------
// Avtalsklockans status

export const AWARD_STATUS_LABEL: Record<ProcurementAwardStatus, string> = {
  open: 'Öppen',
  contacted: 'Kontaktad',
  planned: 'Planerad',
  done: 'Klar',
  ignored: 'Ignorerad',
}

export const AWARD_STATUS_DOT: Record<ProcurementAwardStatus, string> = {
  open: 'bg-sky-400',
  contacted: 'bg-amber-400',
  planned: 'bg-[#20c58f]',
  done: 'bg-emerald-400',
  ignored: 'bg-slate-600',
}

export const VALUE_KIND_LABEL: Record<ProcurementValueKind, string> = {
  ceiling: 'ramtak',
  actual: 'verkligt pris',
  estimated: 'uppskattat',
  unknown: 'okänd art',
}

export const AWARD_SOURCE_LABEL: Record<ProcurementAwardSource, string> = {
  mercell: 'Mercell',
  ted: 'TED',
  ted_xml: 'TED (äldre)',
  uhm: 'UHM',
  email: 'E-post',
  manual: 'Manuell',
}

// ---------------------------------------------------------------------------
// Hjälpare

export function median(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

function dateOnly(v: string | null | undefined): string | null {
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return swedishDate(v)
}

function yearFromRaw(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null
  const candidates: unknown[] = [raw['year'], raw['år']]
  const inner = raw['upphandling']
  if (inner && typeof inner === 'object') {
    for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
      if (k.trim().toLowerCase() === 'år' || k.trim().toLowerCase() === 'ar') candidates.push(v)
    }
  }
  for (const c of candidates) {
    const s = String(c ?? '').trim()
    if (/^\d{4}$/.test(s)) return Number(s)
  }
  return null
}

/**
 * Upphandlingens år: tilldelning, tecknat avtal eller avtalsstart. UHM saknar
 * datum och har året i rådatan; som sista reserv räknas antagandet två plus två
 * år baklänges från det beräknade slutet.
 */
export function awardYear(
  a: Pick<AwardWithRelations, 'award_date' | 'contract_signed_date' | 'contract_start' | 'raw' | 'calc_end_source' | 'calc_end_date'> &
    Partial<Pick<AwardWithRelations, 'start_basis_date'>>
): number | null {
  const d = a.award_date ?? a.contract_signed_date ?? a.contract_start
  if (d && /^\d{4}/.test(d)) return Number(d.slice(0, 4))
  const fromRaw = yearFromRaw(a.raw)
  if (fromRaw) return fromRaw
  // Äldre TED-XML: tilldelningsannonsens datum är startbasen
  if (a.start_basis_date && /^\d{4}/.test(a.start_basis_date)) return Number(a.start_basis_date.slice(0, 4))
  if (a.calc_end_source === 'assumption_2_2' && a.calc_end_date) return Number(a.calc_end_date.slice(0, 4)) - 4
  return null
}

const VALUE_KIND_RANK: Record<ProcurementValueKind, number> = { actual: 3, ceiling: 2, estimated: 1, unknown: 0 }

const END_SOURCE_RANK: Record<ProcurementEndSource, number> = {
  manual: 7,
  ted_end_plus_renewals: 6,
  ted_end: 5,
  mercell_expiry: 4,
  contract_duration: 3,
  text_duration: 2,
  assumption_2_2: 1,
}

/** Starkaste uppföljningen vinner när källor slås ihop */
const FOLLOWUP_RANK: Record<ProcurementFollowupStatus, number> = { new_notice: 4, new_award: 3, passed_no_notice: 2, stale: 1 }

/** Räknas in i marknadens storlek och andelar: ramtak eller verkligt pris */
export function isContractedKind(kind: ProcurementValueKind | null | undefined): boolean {
  return kind === 'ceiling' || kind === 'actual'
}

// ---------------------------------------------------------------------------
// Upphandlingar (grupper av tilldelningsrader)

export interface GroupWinner {
  supplierId: string | null
  org: string | null
  name: string
  cls: SupplierClass
  /** Radens värde (UHM: hela ramtaket per vinnare, TED: delområdets värde) */
  value: number | null
  valueKind: ProcurementValueKind
}

export interface ProcurementGroup {
  key: string
  /** source:source_ref för alla ingående källor, för uppslag av anbudsgivare */
  refs: string[]
  sources: ProcurementAwardSource[]
  sourceRefs: string[]
  awardIds: string[]
  noticeId: string | null
  buyerId: string | null
  buyerName: string | null
  buyerOrg: string | null
  buyerCustomerId: string | null
  countyCode: string | null
  title: string | null
  year: number | null
  awardDate: string | null
  contractStart: string | null
  value: number | null
  valueKind: ProcurementValueKind
  bidsReceived: number | null
  lowestBid: number | null
  highestBid: number | null
  criteriaType: string | null
  procedureType: string | null
  isFramework: boolean | null
  wasAppealed: boolean | null
  winners: GroupWinner[]
  calcEndDate: string | null
  calcEndSource: ProcurementEndSource | null
  correctedEndDate: string | null
  /** Rättat slut om satt, annars beräknat */
  endDate: string | null
  endSource: ProcurementEndSource | null
  windowStart: string | null
  windowEnd: string | null
  /** Beräkningen av slutdatumet i klartext (procurement_awards.calc_basis) */
  calcBasis: string | null
  /** Ny annons, ny tilldelning eller slut passerat (procurement_refresh_award_followups) */
  followupStatus: ProcurementFollowupStatus | null
  followupNoticeId: string | null
  followupUrl: string | null
  followupTitle: string | null
  followupDate: string | null
  status: ProcurementAwardStatus
  ownerId: string | null
  notes: string | null
  /** Rådata från första raden (uppskattat mot kontrakterat värde i UHM) */
  raw: Record<string, unknown> | null
}

function takeFollowup(
  g: ProcurementGroup,
  status: ProcurementFollowupStatus | null,
  noticeId: string | null,
  url: string | null,
  title: string | null,
  date: string | null
) {
  // Bara ny annons och ny tilldelning tas från databasen. Slut passerat och
  // gammalt avtal räknas ur gruppens eget slutdatum (followupOf), så att en
  // sammanslagen grupp aldrig visar en status som motsäger datumet.
  if (status !== 'new_notice' && status !== 'new_award') return
  if (g.followupStatus && FOLLOWUP_RANK[g.followupStatus] >= FOLLOWUP_RANK[status]) return
  g.followupStatus = status
  g.followupNoticeId = noticeId
  g.followupUrl = url
  g.followupTitle = title
  g.followupDate = date
}

function groupValue(winners: GroupWinner[]): { value: number | null; kind: ProcurementValueKind } {
  let bestKind: ProcurementValueKind = 'unknown'
  for (const w of winners) if (w.value != null && VALUE_KIND_RANK[w.valueKind] > VALUE_KIND_RANK[bestKind]) bestKind = w.valueKind
  const vals = winners.filter((w) => w.value != null && w.valueKind === bestKind).map((w) => Number(w.value))
  if (vals.length === 0) return { value: null, kind: winners[0]?.valueKind ?? 'unknown' }
  // UHM ger hela ramtaket på varje vinnare: samma tal ska räknas en gång.
  // TED ger delområdenas värden: olika tal summeras.
  const distinct = [...new Set(vals)]
  const value = distinct.length === 1 ? distinct[0] : distinct.reduce((s, v) => s + v, 0)
  return { value, kind: bestKind }
}

function applyEnd(g: ProcurementGroup) {
  g.endDate = g.correctedEndDate ?? g.calcEndDate
  g.endSource = g.correctedEndDate ? 'manual' : g.calcEndSource
  const w = workWindow(g.endDate)
  g.windowStart = w.start
  g.windowEnd = w.end
}

/** En grupp per källa och source_ref, i indataordning */
export function groupAwards(awards: AwardWithRelations[]): ProcurementGroup[] {
  const byKey = new Map<string, ProcurementGroup>()
  for (const a of awards) {
    const ref = a.source_ref ?? `id:${a.id}`
    const key = `${a.source}:${ref}`
    let g = byKey.get(key)
    if (!g) {
      g = {
        key,
        refs: [key],
        sources: [a.source],
        sourceRefs: a.source_ref ? [a.source_ref] : [],
        awardIds: [],
        noticeId: null,
        buyerId: a.buyer_id ?? a.buyer?.id ?? null,
        buyerName: a.buyer?.name ?? a.buyer_name ?? null,
        buyerOrg: normalizeOrgNumber(a.buyer?.org_number ?? null),
        buyerCustomerId: a.buyer?.customer_id ?? null,
        countyCode: a.county_code ?? countyFromName(a.buyer?.county_name ?? null),
        title: a.title,
        year: null,
        awardDate: null,
        contractStart: null,
        value: null,
        valueKind: 'unknown',
        bidsReceived: null,
        lowestBid: null,
        highestBid: null,
        criteriaType: null,
        procedureType: null,
        isFramework: null,
        wasAppealed: null,
        winners: [],
        calcEndDate: null,
        calcEndSource: null,
        correctedEndDate: null,
        endDate: null,
        endSource: null,
        windowStart: null,
        windowEnd: null,
        calcBasis: null,
        followupStatus: null,
        followupNoticeId: null,
        followupUrl: null,
        followupTitle: null,
        followupDate: null,
        status: a.status ?? 'open',
        ownerId: a.owner_id ?? null,
        notes: a.notes ?? null,
        raw: a.raw ?? null,
      }
      byKey.set(key, g)
    }
    g.awardIds.push(a.id)
    g.noticeId ??= a.notice_id ?? null
    g.title ??= a.title
    g.countyCode ??= a.county_code ?? countyFromName(a.buyer?.county_name ?? null)
    const y = awardYear(a)
    if (y != null && (g.year == null || y < g.year)) g.year = y
    const ad = a.award_date ?? a.contract_signed_date ?? null
    if (ad && (!g.awardDate || ad < g.awardDate)) g.awardDate = ad
    if (a.contract_start && (!g.contractStart || a.contract_start < g.contractStart)) g.contractStart = a.contract_start
    if (a.bids_received != null) g.bidsReceived = Math.max(g.bidsReceived ?? 0, a.bids_received)
    if (a.lowest_bid != null) g.lowestBid = g.lowestBid == null ? a.lowest_bid : Math.min(g.lowestBid, a.lowest_bid)
    if (a.highest_bid != null) g.highestBid = g.highestBid == null ? a.highest_bid : Math.max(g.highestBid, a.highest_bid)
    g.criteriaType ??= a.criteria_type ?? null
    g.procedureType ??= a.procedure_type ?? null
    if (g.isFramework == null && a.is_framework != null) g.isFramework = a.is_framework
    if (a.was_appealed != null) g.wasAppealed = !!g.wasAppealed || a.was_appealed
    if (a.corrected_end_date && (!g.correctedEndDate || a.corrected_end_date > g.correctedEndDate)) g.correctedEndDate = a.corrected_end_date
    if (a.calc_end_date) {
      const rank = a.calc_end_source ? END_SOURCE_RANK[a.calc_end_source] : 0
      const cur = g.calcEndSource ? END_SOURCE_RANK[g.calcEndSource] : -1
      if (rank > cur || (rank === cur && (!g.calcEndDate || a.calc_end_date > g.calcEndDate))) {
        g.calcEndDate = a.calc_end_date
        g.calcEndSource = a.calc_end_source
        g.calcBasis = a.calc_basis ?? null
      }
    }
    takeFollowup(g, a.followup_status ?? null, a.followup_notice_id ?? null, a.followup_url ?? null, a.followup_title ?? null, a.followup_date ?? null)
    const org = normalizeOrgNumber(a.winner_org_number ?? a.supplier?.org_number ?? null)
    const name = a.supplier?.name ?? a.winner_name ?? 'Okänd leverantör'
    const wKey = a.supplier_id ?? org ?? normalizeName(name)
    const exists = g.winners.find((w) => (w.supplierId ?? w.org ?? normalizeName(w.name)) === wKey)
    if (!exists) {
      g.winners.push({
        supplierId: a.supplier_id ?? a.supplier?.id ?? null,
        org,
        name,
        cls: classifyOrg(org, !!a.supplier?.is_begone),
        value: a.value,
        valueKind: a.value_kind ?? 'unknown',
      })
    } else if (a.value != null && (exists.value == null || VALUE_KIND_RANK[a.value_kind] > VALUE_KIND_RANK[exists.valueKind])) {
      exists.value = a.value
      exists.valueKind = a.value_kind
    }
  }
  const groups = [...byKey.values()]
  for (const g of groups) {
    const v = groupValue(g.winners)
    g.value = v.value
    g.valueKind = v.kind
    applyEnd(g)
  }
  return groups
}

function winnerSetKey(g: ProcurementGroup): string | null {
  if (g.winners.length === 0) return null
  const keys = g.winners.map((w) => w.org ?? w.supplierId)
  if (keys.some((k) => !k)) return null
  return [...new Set(keys)].sort().join(',')
}

function sameBuyer(a: ProcurementGroup, b: ProcurementGroup): boolean {
  if (a.buyerId && b.buyerId) return a.buyerId === b.buyerId
  if (a.buyerOrg && b.buyerOrg) return a.buyerOrg === b.buyerOrg
  return false
}

/**
 * Slår ihop samma upphandling från olika källor (TED och UHM överlappar
 * 2021 till 2023). Krav: olika källor, samma köpare, samma vinnare på orgnr och
 * år inom ett år. Värdet tas från källan med bäst värdeart, slutdatumet från
 * källan med bäst datumkälla (TED före antagandet).
 */
export function mergeCrossSource(groups: ProcurementGroup[]): ProcurementGroup[] {
  const out: ProcurementGroup[] = []
  for (const g of groups) {
    const wk = winnerSetKey(g)
    const match = wk
      ? out.find(
          (m) =>
            !m.sources.some((s) => g.sources.includes(s)) &&
            sameBuyer(m, g) &&
            winnerSetKey(m) === wk &&
            m.year != null &&
            g.year != null &&
            Math.abs(m.year - g.year) <= 1
        )
      : undefined
    if (!match) {
      out.push({ ...g, refs: [...g.refs], sources: [...g.sources], sourceRefs: [...g.sourceRefs], awardIds: [...g.awardIds], winners: g.winners.map((w) => ({ ...w })) })
      continue
    }
    match.refs.push(...g.refs)
    match.sources.push(...g.sources)
    match.sourceRefs.push(...g.sourceRefs)
    match.awardIds.push(...g.awardIds)
    if (VALUE_KIND_RANK[g.valueKind] > VALUE_KIND_RANK[match.valueKind] && g.value != null) {
      match.value = g.value
      match.valueKind = g.valueKind
      match.winners = g.winners.map((w) => ({ ...w }))
    }
    match.noticeId ??= g.noticeId
    match.countyCode ??= g.countyCode
    match.title ??= g.title
    match.buyerId ??= g.buyerId
    match.buyerOrg ??= g.buyerOrg
    match.buyerCustomerId ??= g.buyerCustomerId
    if (g.year != null && (match.year == null || g.year < match.year)) match.year = g.year
    match.awardDate ??= g.awardDate
    match.contractStart ??= g.contractStart
    if (g.bidsReceived != null) match.bidsReceived = Math.max(match.bidsReceived ?? 0, g.bidsReceived)
    match.lowestBid ??= g.lowestBid
    match.highestBid ??= g.highestBid
    match.criteriaType ??= g.criteriaType
    match.procedureType ??= g.procedureType
    match.isFramework ??= g.isFramework
    if (g.wasAppealed != null) match.wasAppealed = !!match.wasAppealed || g.wasAppealed
    if (g.correctedEndDate && (!match.correctedEndDate || g.correctedEndDate > match.correctedEndDate)) match.correctedEndDate = g.correctedEndDate
    const gr = g.calcEndSource ? END_SOURCE_RANK[g.calcEndSource] : -1
    const mr = match.calcEndSource ? END_SOURCE_RANK[match.calcEndSource] : -1
    if (g.calcEndDate && gr > mr) {
      match.calcEndDate = g.calcEndDate
      match.calcEndSource = g.calcEndSource
      match.calcBasis = g.calcBasis
    }
    takeFollowup(match, g.followupStatus, g.followupNoticeId, g.followupUrl, g.followupTitle, g.followupDate)
    if (match.status === 'open' && g.status !== 'open') match.status = g.status
    match.ownerId ??= g.ownerId
    match.notes ??= g.notes
    applyEnd(match)
  }
  return out
}

/** Tilldelningar till upphandlingar, sammanslagna över källor */
export function buildProcurements(awards: AwardWithRelations[]): ProcurementGroup[] {
  return mergeCrossSource(groupAwards(awards))
}

// ---------------------------------------------------------------------------
// Län

/** 'begone' = BeGones län, 'all' = alla, annars en NUTS3-kod */
export type CountyFilter = 'begone' | 'all' | string

export function matchesCounty(code: string | null | undefined, filter: CountyFilter): boolean {
  if (filter === 'all') return true
  if (!code) return false
  if (filter === 'begone') return BEGONE_COUNTIES.includes(code)
  return code === filter
}

// ---------------------------------------------------------------------------
// Marknadens storlek

export interface YearMarket {
  year: number
  procurements: number
  /** Upphandlingar med ramtak eller verkligt pris */
  valued: number
  /** Summa ramtak plus verkliga priser */
  value: number
  ceilingValue: number
  actualValue: number
}

export function marketByYear(groups: ProcurementGroup[]): YearMarket[] {
  const map = new Map<number, YearMarket>()
  for (const g of groups) {
    if (g.year == null) continue
    const row = map.get(g.year) ?? { year: g.year, procurements: 0, valued: 0, value: 0, ceilingValue: 0, actualValue: 0 }
    row.procurements += 1
    if (g.value != null && isContractedKind(g.valueKind)) {
      row.valued += 1
      row.value += g.value
      if (g.valueKind === 'ceiling') row.ceilingValue += g.value
      else row.actualValue += g.value
    }
    map.set(g.year, row)
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

// ---------------------------------------------------------------------------
// Marknadsandel

export interface YearShare {
  year: number
  total: number
  anticimex: number
  nomor: number
  begone: number
  other: number
}

/**
 * Andel av avtalat tak per leverantörsklass och år. Varje vinnare räknas med
 * sin rads värde (planens räkning: hela ramtaket per vinnare i UHM), så
 * andelarna summerar till 100 procent av summan per vinnare.
 */
export function sharesByYear(groups: ProcurementGroup[]): YearShare[] {
  const map = new Map<number, YearShare>()
  for (const g of groups) {
    if (g.year == null) continue
    for (const w of g.winners) {
      if (w.value == null || !isContractedKind(w.valueKind)) continue
      const row = map.get(g.year) ?? { year: g.year, total: 0, anticimex: 0, nomor: 0, begone: 0, other: 0 }
      row[w.cls] += w.value
      row.total += w.value
      map.set(g.year, row)
    }
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

export function shareTotals(rows: YearShare[]): YearShare {
  return rows.reduce(
    (acc, r) => ({
      year: 0,
      total: acc.total + r.total,
      anticimex: acc.anticimex + r.anticimex,
      nomor: acc.nomor + r.nomor,
      begone: acc.begone + r.begone,
      other: acc.other + r.other,
    }),
    { year: 0, total: 0, anticimex: 0, nomor: 0, begone: 0, other: 0 }
  )
}

// ---------------------------------------------------------------------------
// Antal anbud

export interface YearBids {
  year: number
  known: number
  median: number | null
  b1: number
  b2: number
  b3: number
  b4plus: number
}

export function bidsByYear(groups: ProcurementGroup[]): YearBids[] {
  const map = new Map<number, number[]>()
  for (const g of groups) {
    if (g.year == null || g.bidsReceived == null || g.bidsReceived <= 0) continue
    const list = map.get(g.year) ?? []
    list.push(g.bidsReceived)
    map.set(g.year, list)
  }
  return [...map.entries()]
    .map(([year, list]) => ({
      year,
      known: list.length,
      median: median(list),
      b1: list.filter((n) => n === 1).length,
      b2: list.filter((n) => n === 2).length,
      b3: list.filter((n) => n === 3).length,
      b4plus: list.filter((n) => n >= 4).length,
    }))
    .sort((a, b) => a.year - b.year)
}

export function overallBidsMedian(groups: ProcurementGroup[]): number | null {
  return median(groups.map((g) => (g.bidsReceived != null && g.bidsReceived > 0 ? g.bidsReceived : null)))
}

// ---------------------------------------------------------------------------
// Avtalsklockan

/** Avtalstid i år för årsvärdet: avtalsstart till slut, annars fyra år (två plus två) */
export function contractYears(g: Pick<ProcurementGroup, 'contractStart' | 'awardDate' | 'endDate'>): number {
  const start = g.contractStart ?? g.awardDate
  if (start && g.endDate) {
    // Hela månader, så att 2024-01-01 till 2026-01-01 blir exakt två år
    const months = Math.round(daysBetweenIso(start, g.endDate) / 30.4375)
    if (months >= 6) return Math.max(1, months / 12)
  }
  return 4
}

/** Årsvärde ur ramtak eller verkligt pris, annars null */
export function annualValueOfGroup(g: ProcurementGroup): number | null {
  if (g.value == null || g.valueKind === 'unknown') return null
  return g.value / contractYears(g)
}

export function isInWindow(g: Pick<ProcurementGroup, 'windowStart' | 'windowEnd'>, today: string): boolean {
  return !!g.windowStart && !!g.windowEnd && g.windowStart <= today && today <= g.windowEnd
}

/**
 * Förväntad annons: kvartalet då bearbetningsfönstret öppnar. Har fönstret
 * redan öppnat men avtalet inte löpt ut räknas innevarande kvartal.
 */
export function expectedAnnouncementQuarter(g: Pick<ProcurementGroup, 'windowStart' | 'endDate'> & Partial<Pick<ProcurementGroup, 'followupStatus'>>, today: string): string | null {
  // Ny annons eller ny tilldelning finns: inget förväntat. Slut passerat utan
  // ny annons: annonsen väntas nu, aldrig i en förfluten kvartalsruta.
  const f = followupOf({ followupStatus: g.followupStatus ?? null, endDate: g.endDate }, today)
  if (f === 'new_notice' || f === 'new_award' || f === 'stale') return null
  if (f === 'passed_no_notice') return quarterOf(today)
  if (!g.windowStart) return null
  if (g.windowStart < today && g.endDate && g.endDate >= today) return quarterOf(today)
  return quarterOf(g.windowStart)
}

/** Kommande kvartal från och med innevarande: 2026-Q3, 2026-Q4 ... */
export function nextQuarters(today: string, count: number): string[] {
  const out: string[] = []
  let d = `${today.slice(0, 7)}-01`
  const seen = new Set<string>()
  while (out.length < count) {
    const q = quarterOf(d)!
    if (!seen.has(q)) {
      seen.add(q)
      out.push(q)
    }
    d = addMonthsIso(d, 1)
  }
  return out
}

export type HorizonFilter = 'window' | '12' | '18' | '24' | 'upcoming' | 'passed' | 'reannounced' | 'all'

/** Har köparen redan annonserat eller tilldelat en ny upphandling? */
export function isReannounced(g: Pick<ProcurementGroup, 'followupStatus'>): boolean {
  return g.followupStatus === 'new_notice' || g.followupStatus === 'new_award'
}

/**
 * Uppföljningen för en grupp: ny annons eller ny tilldelning från databasen,
 * annars ur gruppens slutdatum: passerat under de senaste två åren ger
 * "slut passerat, ingen ny annons", äldre ger "stale".
 */
export function followupOf(g: Pick<ProcurementGroup, 'followupStatus' | 'endDate'>, today: string): ProcurementFollowupStatus | null {
  if (isReannounced(g)) return g.followupStatus
  if (!g.endDate || g.endDate >= today) return null
  return g.endDate >= addMonthsIso(today, -24) ? 'passed_no_notice' : 'stale'
}

/** Avtalsklockans tidsfilter */
export function matchesHorizon(g: ProcurementGroup, horizon: HorizonFilter, today: string): boolean {
  if (horizon === 'all') return true
  if (horizon === 'reannounced') return isReannounced(g)
  const f = followupOf(g, today)
  if (horizon === 'passed') return f === 'passed_no_notice'
  // Köpare som redan annonserat eller tilldelat på nytt tas ur fönstret
  if (f === 'new_notice' || f === 'new_award' || f === 'stale') return false
  // Slut passerat utan ny annons: annonsen väntas nu, visas i alla framåtblickande filter
  if (f === 'passed_no_notice') return true
  if (!g.endDate) return false
  if (horizon === 'window') return isInWindow(g, today)
  if (g.endDate < today) return false
  if (horizon === 'upcoming') return true
  return g.endDate <= addMonthsIso(today, Number(horizon))
}

export interface QuarterPipeline {
  quarter: string
  notices: number
  contribution: number
  clock: number
  clockAnnualValue: number
}

const CLOSED_NOTICE_STATUSES = new Set(['won', 'lost', 'declined', 'cancelled', 'archived'])

/**
 * Pipeline per kvartal (verktyg 5): förväntat täckningsbidrag i bevakningen
 * per kvartal för sista anbudsdag, plus avtalsklockans avtal per kvartal för
 * förväntad annons med årsvärde. Bara kommande kvartal.
 */
export function pipelineByQuarter(
  notices: Array<Pick<ProcurementNotice, 'tender_deadline' | 'expected_contribution' | 'our_status'>>,
  groups: ProcurementGroup[],
  today: string,
  count = 8
): QuarterPipeline[] {
  const quarters = nextQuarters(today, count)
  const rows = new Map<string, QuarterPipeline>(quarters.map((q) => [q, { quarter: q, notices: 0, contribution: 0, clock: 0, clockAnnualValue: 0 }]))
  for (const n of notices) {
    if (CLOSED_NOTICE_STATUSES.has(n.our_status)) continue
    const d = dateOnly(n.tender_deadline)
    if (!d || d < today) continue
    const row = rows.get(quarterOf(d) ?? '')
    if (!row) continue
    row.notices += 1
    row.contribution += Number(n.expected_contribution ?? 0) || 0
  }
  for (const g of groups) {
    const f = followupOf(g, today)
    if (g.status === 'ignored' || g.status === 'done' || f === 'new_notice' || f === 'new_award' || f === 'stale') continue
    if (!g.endDate) continue
    const row = rows.get(expectedAnnouncementQuarter(g, today) ?? '')
    if (!row) continue
    row.clock += 1
    row.clockAnnualValue += annualValueOfGroup(g) ?? 0
  }
  return quarters.map((q) => rows.get(q)!)
}

// ---------------------------------------------------------------------------
// Utmanarläge (verktyg 8)

export interface ChallengerRow {
  buyerKey: string
  buyerId: string | null
  buyerName: string
  countyCode: string | null
  group: ProcurementGroup
  bidderClasses: SupplierClass[]
  /** Hur vi vet vilka som lämnade anbud */
  basis: 'bidders' | 'bid_count'
  endDate: string
}

function buyerKeyOf(g: ProcurementGroup): string {
  return g.buyerId ?? (g.buyerOrg ? `o:${g.buyerOrg}` : `n:${normalizeName(g.buyerName)}`)
}

/** Indexerar anbudsgivare på source:source_ref, samma nyckel som ProcurementGroup.refs */
export function indexBidders(bidders: Array<Pick<BidderWithSupplier, 'source' | 'source_ref' | 'org_number' | 'supplier' | 'is_begone' | 'is_winner' | 'name' | 'supplier_id' | 'price'>>) {
  const map = new Map<string, typeof bidders>()
  for (const b of bidders) {
    if (!b.source_ref) continue
    const k = `${b.source}:${b.source_ref}`
    const list = map.get(k) ?? []
    list.push(b)
    map.set(k, list)
  }
  return map
}

/**
 * Köpare där bara Anticimex och Nomor/Rentokil lämnade anbud i den senaste
 * kända upphandlingen, och avtalet löper ut inom `months` månader.
 * Anbudsgivarna läses ur procurement_bidders (UHM 2024, TED). Saknas de räcker
 * det att antalet anbud är högst antalet vinnare och att alla vinnare är
 * Anticimex eller Nomor/Rentokil. Matchning på orgnr.
 */
export function challengerBuyers(
  groups: ProcurementGroup[],
  biddersByRef: ReturnType<typeof indexBidders>,
  today: string,
  months = 18
): ChallengerRow[] {
  const latest = new Map<string, ProcurementGroup>()
  for (const g of groups) {
    const k = buyerKeyOf(g)
    const cur = latest.get(k)
    const gKey = `${g.year ?? 0}|${g.awardDate ?? ''}|${g.endDate ?? ''}`
    const cKey = cur ? `${cur.year ?? 0}|${cur.awardDate ?? ''}|${cur.endDate ?? ''}` : ''
    if (!cur || gKey > cKey) latest.set(k, g)
  }
  const limit = addMonthsIso(today, months)
  const duo = new Set<SupplierClass>(['anticimex', 'nomor'])
  const out: ChallengerRow[] = []
  for (const [k, g] of latest) {
    if (!g.endDate || g.endDate < today || g.endDate > limit) continue
    const bidders = g.refs.flatMap((r) => biddersByRef.get(r) ?? [])
    let classes: SupplierClass[] | null = null
    let basis: ChallengerRow['basis'] = 'bidders'
    if (bidders.length > 0) {
      const orgs = bidders.map((b) => normalizeOrgNumber(b.org_number ?? b.supplier?.org_number ?? null))
      if (orgs.some((o) => !o)) continue
      classes = [...new Set(bidders.map((b) => classifyOrg(b.org_number ?? b.supplier?.org_number ?? null, b.is_begone || !!b.supplier?.is_begone)))]
    } else if (g.bidsReceived != null && g.winners.length > 0 && g.bidsReceived <= g.winners.length && g.winners.every((w) => w.org)) {
      classes = [...new Set(g.winners.map((w) => w.cls))]
      basis = 'bid_count'
    }
    if (!classes || classes.length === 0 || !classes.every((c) => duo.has(c))) continue
    out.push({ buyerKey: k, buyerId: g.buyerId, buyerName: g.buyerName ?? 'Okänd köpare', countyCode: g.countyCode, group: g, bidderClasses: classes, basis, endDate: g.endDate })
  }
  return out.sort((a, b) => a.endDate.localeCompare(b.endDate))
}

// ---------------------------------------------------------------------------
// Kvalitetsviktade köpare (verktyg 9)

export interface QualityBuyerRow {
  buyerKey: string
  buyerId: string | null
  buyerName: string
  countyCode: string | null
  qualityCount: number
  total: number
  latestCriteria: string | null
  latestWinners: string[]
  nextEnd: string | null
}

export function qualityBuyers(groups: ProcurementGroup[], today: string): QualityBuyerRow[] {
  const map = new Map<string, { rows: ProcurementGroup[] }>()
  for (const g of groups) {
    const k = buyerKeyOf(g)
    const e = map.get(k) ?? { rows: [] }
    e.rows.push(g)
    map.set(k, e)
  }
  const out: QualityBuyerRow[] = []
  for (const [k, { rows }] of map) {
    const quality = rows.filter((g) => g.criteriaType === 'quality' || g.criteriaType === 'mixed')
    if (quality.length === 0) continue
    const sorted = [...rows].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || String(b.awardDate ?? '').localeCompare(String(a.awardDate ?? '')))
    const latest = sorted[0]
    const future = rows.map((g) => g.endDate).filter((d): d is string => !!d && d >= today).sort()
    out.push({
      buyerKey: k,
      buyerId: latest.buyerId,
      buyerName: latest.buyerName ?? 'Okänd köpare',
      countyCode: latest.countyCode,
      qualityCount: quality.length,
      total: rows.length,
      latestCriteria: latest.criteriaType,
      latestWinners: latest.winners.map((w) => w.name),
      nextEnd: future[0] ?? null,
    })
  }
  return out.sort((a, b) => (a.nextEnd ?? '9999').localeCompare(b.nextEnd ?? '9999') || a.buyerName.localeCompare(b.buyerName, 'sv'))
}

// ---------------------------------------------------------------------------
// Källhälsa

export interface SourceHealthState {
  tone: 'good' | 'warn' | 'bad' | 'muted'
  label: string
  silentHours: number | null
}

export const SOURCE_LABEL: Record<string, string> = {
  mercell: 'Mercell',
  ted: 'TED',
  kommers: 'Kommers',
  signals: 'Signalkällor',
  deadlines: 'Påminnelser',
  digest: 'Sammandrag',
}

/** Tyst över 24 timmar ger varning, tre fel i rad ger fel */
export function sourceHealthState(h: Pick<ProcurementSourceHealth, 'last_run_at' | 'last_success_at' | 'consecutive_failures'>, nowMs: number): SourceHealthState {
  const silentHours = h.last_success_at ? Math.floor((nowMs - new Date(h.last_success_at).getTime()) / 3_600_000) : null
  if ((h.consecutive_failures ?? 0) >= 3) return { tone: 'bad', label: `${h.consecutive_failures} fel i rad`, silentHours }
  if (!h.last_run_at && !h.last_success_at) return { tone: 'muted', label: 'Aldrig körd', silentHours }
  if (silentHours == null) return { tone: 'bad', label: 'Aldrig lyckad', silentHours }
  if (silentHours > 24) return { tone: 'warn', label: `Tyst i ${silentHours} timmar`, silentHours }
  if ((h.consecutive_failures ?? 0) > 0) return { tone: 'warn', label: `${h.consecutive_failures} fel i rad`, silentHours }
  return { tone: 'good', label: 'I drift', silentHours }
}
