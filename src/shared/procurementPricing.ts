// src/shared/procurementPricing.ts
// Prisbilagan i fyra steg (beslut 4, docs/upphandlingsportal-ux-plan.md),
// steg b "Föreslå priser": pris och kostnad per rad i köparens prisbilaga ur
// BeGones prislistor eller kalkylen. Marginalen räknas med marginEngine.
// Ren logik utan nätverk; komponenten hämtar prislistan och kalkylen.
//
// Regler:
//   - Träff i prislistan (benämningen matchas ord för ord): prislistans pris.
//     Kostnad: artikelns inköpspris, annars uppskattad ur kalkylen.
//   - Ingen träff men raden är ett besök, en utryckning eller en timme:
//     kostnad ur kalkylen (timpris, tid per besök, restid, förbrukning) och
//     pris vid målmarginalen.
//   - Annars inget förslag. Raden får en anteckning om varför.
//   - Rader som justerats för hand skrivs aldrig över.

import { marginPercent, marginTone, type MarginSettings, type MarginTone } from './marginEngine'

export interface CatalogItem {
  /** price_list_items.id */
  id: string
  name: string
  unit: string | null
  price: number
  /** Inköpspris för artiklar, null för tjänster */
  cost: number | null
  kind: 'service' | 'article'
  listName: string
}

export interface CalcBasis {
  hourlyCost: number
  hoursPerVisit: number
  travelHoursPerVisit: number
  consumablesPerVisit: number
  hoursPerCallout: number
  targetMarginPercent: number
}

export type LineKind = 'visit' | 'callout' | 'hour' | 'other'

export interface PriceSuggestion {
  unitPrice: number | null
  unitCost: number | null
  priceListItemId: string | null
  source: 'price_list' | 'calc' | 'none'
  note: string
  marginPct: number | null
}

/** Anteckningen som markerar en hand-justerad rad */
export const MANUAL_NOTE = 'Justerat för hand'
const SUGGESTION_PREFIX = 'Förslag'

const STOPWORDS = new Set([
  'och', 'per', 'för', 'med', 'samt', 'inkl', 'exkl', 'enligt', 'avser', 'styck', 'st', 'år', 'kr', 'pris', 'priset', 'som',
  'utan', 'eller', 'vid', 'till', 'från', 'den', 'det', 'att', 'inom', 'alla', 'övrig', 'övriga', 'ska', 'skall', 'moms',
])

/** Ord att matcha på: gemener, utan skiljetecken och stoppord, minst tre tecken */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^a-z0-9åäöéü]+/i)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
}

/** Två ord räknas som samma om de delar de första fem tecknen (råttbekämpning, råttbekämpningen) */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  const n = Math.min(5, a.length, b.length)
  return n >= 4 && a.slice(0, n) === b.slice(0, n)
}

/** Andel av radens ord som finns i kandidatens namn, 0 till 1 */
export function matchScore(lineLabel: string, candidate: string): number {
  const a = [...new Set(tokens(lineLabel))]
  const b = [...new Set(tokens(candidate))]
  if (a.length === 0 || b.length === 0) return 0
  const hits = a.filter((t) => b.some((u) => sameWord(t, u))).length
  // Prislistans namn väger tyngst: alla dess ord i raden är en träff även när
  // köparen skriver mer ("Råttbekämpning, kontroll per besök")
  return (hits / b.length) * 0.7 + (hits / a.length) * 0.3
}

export const MATCH_THRESHOLD = 0.55

export function bestCatalogMatch(label: string, catalog: CatalogItem[]): { item: CatalogItem; score: number } | null {
  let best: { item: CatalogItem; score: number } | null = null
  for (const item of catalog) {
    const score = matchScore(label, item.name)
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { item, score }
  }
  return best
}

/** Vad raden är, ur benämning och enhet */
export function lineKind(label: string, unit: string | null | undefined): LineKind {
  const l = label.toLowerCase()
  const u = (unit ?? '').toLowerCase().trim()
  if (/^(tim|timme|timmar|h|tim\.)$/.test(u) || /timpris|per timme|\/tim|kr\/h\b/.test(l)) return 'hour'
  if (/akut|utryck|jour/.test(l)) return 'callout'
  if (/besök|kontroll|rond|per objekt|inspektion/.test(l) || /^(besök|objekt|ggr|gång|tillfälle)/.test(u)) return 'visit'
  return 'other'
}

const KIND_TEXT: Record<Exclude<LineKind, 'other'>, string> = {
  visit: 'besök',
  callout: 'utryckning',
  hour: 'timme',
}

/** Vår kostnad per enhet ur kalkylen, eller null när raden inte är ett besök, en utryckning eller en timme */
export function calcCost(kind: LineKind, basis: CalcBasis): number | null {
  switch (kind) {
    case 'hour':
      return basis.hourlyCost
    case 'visit':
      return (basis.hoursPerVisit + basis.travelHoursPerVisit) * basis.hourlyCost + basis.consumablesPerVisit
    case 'callout':
      return (basis.hoursPerCallout + basis.travelHoursPerVisit) * basis.hourlyCost + basis.consumablesPerVisit
    default:
      return null
  }
}

/** Pris vid målmarginalen: kostnad / (1 - mål) */
export function priceAtMargin(cost: number, marginPercentTarget: number): number {
  const m = Math.min(Math.max(marginPercentTarget, 0), 90) / 100
  return cost / (1 - m)
}

const roundKr = (n: number) => Math.round(n)

/** Ska raden få ett förslag: tomt pris eller ett tidigare förslag, aldrig en hand-justerad rad */
export function shouldSuggest(line: { unit_price: number | null; notes: string | null }): boolean {
  if (line.notes?.startsWith(MANUAL_NOTE)) return false
  if (line.unit_price == null) return true
  return !!line.notes?.startsWith(SUGGESTION_PREFIX)
}

export function suggestPrice(line: { label: string; unit: string | null }, catalog: CatalogItem[], basis: CalcBasis | null): PriceSuggestion {
  const kind = lineKind(line.label, line.unit)
  const estimated = basis ? calcCost(kind, basis) : null
  const match = bestCatalogMatch(line.label, catalog)
  if (match) {
    const cost = match.item.cost ?? estimated
    return {
      unitPrice: roundKr(match.item.price),
      unitCost: cost != null ? roundKr(cost) : null,
      priceListItemId: match.item.id,
      source: 'price_list',
      note: `${SUGGESTION_PREFIX} från prislistan ${match.item.listName}: ${match.item.name}${match.item.cost == null && cost != null ? `, kostnad ur kalkylen per ${KIND_TEXT[kind as Exclude<LineKind, 'other'>]}` : ''}`,
      marginPct: cost != null ? marginPercent(match.item.price, cost) : null,
    }
  }
  if (estimated != null && basis) {
    const price = roundKr(priceAtMargin(estimated, basis.targetMarginPercent))
    return {
      unitPrice: price,
      unitCost: roundKr(estimated),
      priceListItemId: null,
      source: 'calc',
      note: `${SUGGESTION_PREFIX} från kalkylen: kostnad per ${KIND_TEXT[kind as Exclude<LineKind, 'other'>]} vid målmarginal ${String(basis.targetMarginPercent).replace('.', ',')} %`,
      marginPct: marginPercent(price, estimated),
    }
  }
  return {
    unitPrice: null,
    unitCost: null,
    priceListItemId: null,
    source: 'none',
    note: 'Inget förslag: ingen träff i prislistan och raden är inte ett besök, en utryckning eller en timme',
    marginPct: null,
  }
}

/** Marginalens färg per rad: röd under 0 %, annars prisinställningarnas gränser */
export function lineMarginTone(pct: number | null | undefined, settings?: MarginSettings | null): MarginTone {
  if (pct == null || !Number.isFinite(pct)) return 'none'
  if (pct < 0) return 'bad'
  return marginTone(pct, settings)
}

/** Summor för prisbilagan. Marginal bara när kostnad finns på alla rader med pris. */
export function appendixTotals(lines: Array<{ quantity: number | null; unit_price: number | null; unit_cost: number | null }>): {
  revenue: number
  cost: number
  costKnown: boolean
  margin: number | null
} {
  let revenue = 0
  let cost = 0
  let costKnown = true
  for (const l of lines) {
    const q = Number(l.quantity) || 0
    revenue += q * (Number(l.unit_price) || 0)
    if (l.unit_cost == null) {
      if (l.unit_price != null) costKnown = false
    } else cost += q * Number(l.unit_cost)
  }
  return { revenue, cost, costKnown, margin: costKnown ? marginPercent(revenue, cost) : null }
}
