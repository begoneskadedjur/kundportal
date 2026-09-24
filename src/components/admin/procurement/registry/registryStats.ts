// src/components/admin/procurement/registry/registryStats.ts
// Rena aggregat för köpar- och konkurrentregistren (verktyg 2 och 4).
// Bygger på upphandlingsgrupperna i market/marketStats.ts, så att en
// upphandling som finns i både TED och UHM räknas en gång även här.
// Leverantörer identifieras på supplier_id, annars orgnr.

import type { BidderWithSupplier } from '../../../../services/procurementService'
import type { ProcurementSupplier } from '../../../../types/procurement'
import { normalizeOrgNumber } from '../../../../shared/procurementRules'
import { classifyOrg, isContractedKind, median, type ProcurementGroup, type SupplierClass } from '../market/marketStats'

export type BidderLike = Pick<BidderWithSupplier, 'source' | 'source_ref' | 'supplier_id' | 'org_number' | 'name' | 'price' | 'is_winner' | 'is_begone' | 'rank' | 'supplier'>

/** Uppslag orgnr -> leverantörs-id, för rader som saknar supplier_id */
export function supplierIdResolver(suppliers: Array<Pick<ProcurementSupplier, 'id' | 'org_number'>>) {
  const byOrg = new Map<string, string>()
  for (const s of suppliers) {
    const o = normalizeOrgNumber(s.org_number)
    if (o) byOrg.set(o, s.id)
  }
  return (supplierId: string | null | undefined, org: string | null | undefined): string | null =>
    supplierId ?? (normalizeOrgNumber(org) ? byOrg.get(normalizeOrgNumber(org)!) ?? null : null)
}

// ---------------------------------------------------------------------------
// Köpare

export interface BuyerSummary {
  count: number
  latest: ProcurementGroup | null
  nextEnd: string | null
}

export function buyerSummaries(groups: ProcurementGroup[], today: string): Map<string, BuyerSummary> {
  const map = new Map<string, BuyerSummary>()
  for (const g of groups) {
    if (!g.buyerId) continue
    const s = map.get(g.buyerId) ?? { count: 0, latest: null, nextEnd: null }
    s.count += 1
    if (!s.latest || sortKey(g) > sortKey(s.latest)) s.latest = g
    if (g.endDate && g.endDate >= today && (!s.nextEnd || g.endDate < s.nextEnd)) s.nextEnd = g.endDate
    map.set(g.buyerId, s)
  }
  return map
}

export function sortKey(g: ProcurementGroup): string {
  return `${g.year ?? 0}|${g.awardDate ?? ''}|${g.endDate ?? ''}`
}

/** Byter köparen leverantör? Jämför vinnarmängden mellan på varandra följande upphandlingar. */
export function supplierSwitches(groups: ProcurementGroup[]): { comparisons: number; switches: number } {
  const sorted = [...groups].filter((g) => g.winners.length > 0).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  let switches = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Set(sorted[i - 1].winners.map((w) => w.org ?? w.supplierId ?? w.name))
    const cur = sorted[i].winners.map((w) => w.org ?? w.supplierId ?? w.name)
    if (!cur.some((k) => prev.has(k))) switches += 1
  }
  return { comparisons: Math.max(0, sorted.length - 1), switches }
}

export function countBy<T>(items: T[], key: (t: T) => string | null | undefined): Array<{ key: string; count: number }> {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Leverantörer

export interface SupplierStats {
  supplierId: string
  wins: number
  /** Upphandlingar där leverantören lämnade anbud (kända anbudsgivare plus vinster) */
  bids: number
  /** Vinstfrekvens där anbudsgivarna är kända */
  knownBids: number
  knownWins: number
  winRate: number | null
  contracted: number
  counties: string[]
  buyers: string[]
  lastWinYear: number | null
}

/**
 * Nyckeltal per leverantör. Vinster ur tilldelningarna, lämnade anbud ur
 * procurement_bidders (UHM 2024 och TED) plus vinsterna. Vinstfrekvensen räknas
 * bara där anbudsgivarna är kända, annars blir den alltid 100 procent.
 */
export function supplierStats(groups: ProcurementGroup[], bidders: BidderLike[], resolve: ReturnType<typeof supplierIdResolver>): Map<string, SupplierStats> {
  const map = new Map<string, SupplierStats & { _refs: Set<string>; _knownRefs: Set<string>; _knownWinRefs: Set<string>; _counties: Set<string>; _buyers: Set<string> }>()
  const get = (id: string) => {
    let s = map.get(id)
    if (!s) {
      s = { supplierId: id, wins: 0, bids: 0, knownBids: 0, knownWins: 0, winRate: null, contracted: 0, counties: [], buyers: [], lastWinYear: null, _refs: new Set(), _knownRefs: new Set(), _knownWinRefs: new Set(), _counties: new Set(), _buyers: new Set() }
      map.set(id, s)
    }
    return s
  }
  const groupByRef = new Map<string, ProcurementGroup>()
  for (const g of groups) for (const r of g.refs) groupByRef.set(r, g)

  for (const g of groups) {
    for (const w of g.winners) {
      const id = resolve(w.supplierId, w.org)
      if (!id) continue
      const s = get(id)
      s.wins += 1
      s._refs.add(g.key)
      if (w.value != null && isContractedKind(w.valueKind)) s.contracted += w.value
      if (g.countyCode) s._counties.add(g.countyCode)
      if (g.buyerName) s._buyers.add(g.buyerName)
      if (g.year != null && (s.lastWinYear == null || g.year > s.lastWinYear)) s.lastWinYear = g.year
    }
  }
  for (const b of bidders) {
    const id = resolve(b.supplier_id ?? b.supplier?.id, b.org_number ?? b.supplier?.org_number)
    if (!id || !b.source_ref) continue
    const ref = `${b.source}:${b.source_ref}`
    const g = groupByRef.get(ref)
    const key = g?.key ?? ref
    const s = get(id)
    s._refs.add(key)
    s._knownRefs.add(key)
    if (b.is_winner) s._knownWinRefs.add(key)
    if (g?.countyCode) s._counties.add(g.countyCode)
  }
  const out = new Map<string, SupplierStats>()
  for (const [id, s] of map) {
    const knownBids = s._knownRefs.size
    const knownWins = s._knownWinRefs.size
    out.set(id, {
      supplierId: id,
      wins: s.wins,
      bids: s._refs.size,
      knownBids,
      knownWins,
      winRate: knownBids > 0 ? knownWins / knownBids : null,
      contracted: s.contracted,
      counties: [...s._counties].sort(),
      buyers: [...s._buyers].sort((a, b) => a.localeCompare(b, 'sv')),
      lastWinYear: s.lastWinYear,
    })
  }
  return out
}

export interface HeadToHead {
  otherKey: string
  otherId: string | null
  otherName: string
  otherClass: SupplierClass
  meetings: number
  weWon: number
  theyWon: number
  /** Ramavtal där båda tilldelades */
  bothWon: number
  neither: number
}

/**
 * Möten mot andra leverantörer: för varje annan leverantör antal upphandlingar
 * där båda lämnade anbud och vem som vann. Kräver kända anbudsgivare.
 */
export function headToHead(supplierId: string, bidders: BidderLike[], resolve: ReturnType<typeof supplierIdResolver>): HeadToHead[] {
  const byRef = new Map<string, BidderLike[]>()
  for (const b of bidders) {
    if (!b.source_ref) continue
    const k = `${b.source}:${b.source_ref}`
    const list = byRef.get(k) ?? []
    list.push(b)
    byRef.set(k, list)
  }
  const out = new Map<string, HeadToHead>()
  for (const list of byRef.values()) {
    const ours = list.filter((b) => resolve(b.supplier_id ?? b.supplier?.id, b.org_number ?? b.supplier?.org_number) === supplierId)
    if (ours.length === 0) continue
    const weWon = ours.some((b) => b.is_winner)
    const others = new Map<string, BidderLike>()
    for (const b of list) {
      const id = resolve(b.supplier_id ?? b.supplier?.id, b.org_number ?? b.supplier?.org_number)
      if (id === supplierId) continue
      const key = id ?? normalizeOrgNumber(b.org_number) ?? b.name.toLowerCase()
      const prev = others.get(key)
      if (!prev || (b.is_winner && !prev.is_winner)) others.set(key, b)
    }
    for (const [key, b] of others) {
      const row = out.get(key) ?? {
        otherKey: key,
        otherId: resolve(b.supplier_id ?? b.supplier?.id, b.org_number ?? b.supplier?.org_number),
        otherName: b.supplier?.name ?? b.name,
        otherClass: classifyOrg(b.org_number ?? b.supplier?.org_number, b.is_begone || !!b.supplier?.is_begone),
        meetings: 0,
        weWon: 0,
        theyWon: 0,
        bothWon: 0,
        neither: 0,
      }
      row.meetings += 1
      if (weWon && b.is_winner) row.bothWon += 1
      else if (weWon) row.weWon += 1
      else if (b.is_winner) row.theyWon += 1
      else row.neither += 1
      out.set(key, row)
    }
  }
  return [...out.values()].sort((a, b) => b.meetings - a.meetings || a.otherName.localeCompare(b.otherName, 'sv'))
}

export { median }
