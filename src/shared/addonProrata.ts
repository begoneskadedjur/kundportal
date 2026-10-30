// src/shared/addonProrata.ts
// Pro rata version 2 för tilläggsstationer, steg 9 i
// docs/planer/avtalsar-exakt-arsdag-teknik.md. Ren spegel av SQL-regeln i
// public.sync_addon_prorata_line_v2 / addon_prorata_v2_end /
// addon_station_uncovered_days (migrationerna 20261030_prorata_v2_*.sql), för
// förhandsvisning och tester. Gäller bara avtal med addon_rules = 'v2'; övriga
// avtal räknas av den gamla funktionen, oförändrad.
//
// Per station:
//   startdag  = addon_effective_from, annars svensk dag för markering/utsättning
//   ordinarie = nästa periodstart efter startdagen (contract_next_period_start)
//   slut      = ordinarie; så länge en låst tilläggsfaktura på avtalet
//               innehåller slut och INTE har stationen: slut = fakturans
//               period_end + 1 (ledtidsregeln). Har fakturans tilläggsrader inga
//               station_ids stannar förlängningen (okänd faktura rapporteras).
//   slut      = min(slut, avtalets sista giltiga dag + 1) när avtalet är
//               uppsagt, avslutat eller har option (kapning vid avtalsslut)
//   dagar     = dagar i [startdag, slut - 1] som saknar täckning
// Rader: en per (ärende, avtal, stationstyp, modell, slut), à-pris =
// round(årspris × medeldagar / 365, 2), samma formel som i dag.
//
// Inga DB-anrop och ingen Date.toISOString: datum är ÅÅÅÅ-MM-DD och räknas
// som hela dagar.

import { nextPeriodStart, type PeriodContract } from './contractPeriods'

export const PRORATA_YEAR_DAYS = 365

/** Avtalsfälten regeln läser. */
export interface ProrataContract extends PeriodContract {
  contract_end_date?: string | null
  effective_end_date?: string | null
  terminated_at?: string | null
  renewal_mode?: string | null
  status?: string | null
}

/**
 * Låst faktura (booked, sent, overdue, paid) på avtalet med tilläggsrader:
 * kind equipment/equipment_monthly/equipment_gap eller premie med
 * tilläggsrader. `stationIds` är alla station_ids på tilläggsraderna; null
 * eller tom när raderna saknar station_ids (gamla fakturor).
 */
export interface ProrataLockedInvoice {
  number?: string | null
  periodStart: string
  periodEnd: string
  stationIds: string[] | null
}

/** Täckt period (addon_station_coverage utan released_at), båda ändar med. */
export interface ProrataCoverage {
  from: string
  to: string
}

export interface ProrataEnd {
  ordinary: string
  endDay: string
  capped: boolean
  unknownInvoice: string | null
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

function isoFromDayNumber(n: number): string {
  const d = new Date(n * 86_400_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysIso(iso: string, days: number): string {
  return isoFromDayNumber(dayNumber(iso) + days)
}

/**
 * Avtalets sista giltiga dag när pro rata ska kapas: uppsagt, avslutat eller
 * option. Rullande avtal som löper vidare kapas inte (null).
 */
export function prorataLastValidDay(c: ProrataContract): string | null {
  const ending =
    !!c.terminated_at ||
    c.renewal_mode === 'option' ||
    (c.status != null && ['ended', 'trashed', 'declined'].includes(c.status))
  if (!ending) return null
  return c.effective_end_date ?? c.contract_end_date ?? null
}

/** Slutdagen (exklusive) för en station. Null när avtalet saknar perioder. */
export function prorataEnd(
  stationId: string,
  startDay: string,
  contract: ProrataContract,
  lockedInvoices: ProrataLockedInvoice[],
): ProrataEnd | null {
  const ordinary = nextPeriodStart(contract, startDay)
  if (!ordinary) return null
  let end = ordinary
  let unknownInvoice: string | null = null
  for (let guard = 0; guard < 60; guard++) {
    const containing = lockedInvoices
      .filter((i) => i.periodStart <= end && i.periodEnd >= end)
      .sort((a, b) => (a.periodStart < b.periodStart ? 1 : a.periodStart > b.periodStart ? -1 : 0))[0]
    if (!containing) break
    const ids = containing.stationIds ?? []
    if (ids.includes(stationId)) break
    if (ids.length === 0) {
      unknownInvoice = containing.number ?? containing.periodStart
      break
    }
    const next = addDaysIso(containing.periodEnd, 1)
    if (next <= end) break
    end = next
  }
  let capped = false
  const last = prorataLastValidDay(contract)
  if (last) {
    const cap = addDaysIso(last, 1)
    if (cap < end) {
      end = cap
      capped = true
    }
  }
  return { ordinary, endDay: end, capped, unknownInvoice }
}

/** Antal dagar i [from, to] (båda med) som ingen täckning omfattar. */
export function uncoveredDays(fromIso: string, toIso: string, coverage: ProrataCoverage[]): number {
  if (!fromIso || !toIso || toIso < fromIso) return 0
  const a = dayNumber(fromIso)
  const b = dayNumber(toIso)
  const ranges = coverage.map((c) => [dayNumber(c.from), dayNumber(c.to)] as const)
  let n = 0
  for (let d = a; d <= b; d++) {
    if (!ranges.some(([f, t]) => d >= f && d <= t)) n++
  }
  return n
}

export interface ProrataStationInput {
  stationId: string
  caseId: string
  contractId: string
  stationTypeId: string | null
  model: 'per_year' | 'per_month'
  /** Stationens årspris (addon_unit_price_annual), null om det saknas */
  annualPrice: number | null
  startDay: string
  coverage?: ProrataCoverage[]
}

export interface ProrataStationResult extends ProrataStationInput {
  endDay: string
  days: number
  capped: boolean
  unknownInvoice: string | null
}

/** Räknar en station. Null när avtalet saknar perioder eller inga dagar återstår. */
export function prorataStation(
  input: ProrataStationInput,
  contract: ProrataContract,
  lockedInvoices: ProrataLockedInvoice[],
): ProrataStationResult | null {
  const end = prorataEnd(input.stationId, input.startDay, contract, lockedInvoices)
  if (!end) return null
  const days = uncoveredDays(input.startDay, addDaysIso(end.endDay, -1), input.coverage ?? [])
  if (days <= 0) return null
  return { ...input, endDay: end.endDay, days, capped: end.capped, unknownInvoice: end.unknownInvoice }
}

export interface ProrataRow {
  caseId: string
  contractId: string
  stationTypeId: string | null
  model: 'per_year' | 'per_month'
  endDay: string
  quantity: number
  annualPrice: number
  unitPrice: number
  total: number
  stationIds: string[]
}

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * En rad per (ärende, avtal, stationstyp, modell, slut). Årspriset är
 * medelvärdet av stationernas pris när alla har pris, annars `fallbackPrice`
 * (typpriset ur prislistan). Grupper utan pris hoppas över.
 */
export function groupProrataRows(
  stations: ProrataStationResult[],
  fallbackPrice: (stationTypeId: string | null, contractId: string) => number | null = () => null,
): ProrataRow[] {
  const groups = new Map<string, ProrataStationResult[]>()
  for (const s of stations) {
    const key = [s.caseId, s.contractId, s.stationTypeId ?? '', s.model, s.endDay].join('|')
    const list = groups.get(key) ?? []
    list.push(s)
    groups.set(key, list)
  }
  const rows: ProrataRow[] = []
  for (const list of groups.values()) {
    const first = list[0]
    const n = list.length
    const allPriced = list.every((s) => s.annualPrice != null)
    const annual = allPriced
      ? round2(list.reduce((sum, s) => sum + (s.annualPrice as number), 0) / n)
      : fallbackPrice(first.stationTypeId, first.contractId)
    if (annual == null || annual <= 0) continue
    const daySum = list.reduce((sum, s) => sum + s.days, 0)
    const unitPrice = round2((annual * (daySum / n)) / PRORATA_YEAR_DAYS)
    rows.push({
      caseId: first.caseId,
      contractId: first.contractId,
      stationTypeId: first.stationTypeId,
      model: first.model,
      endDay: first.endDay,
      quantity: n,
      annualPrice: annual,
      unitPrice,
      total: round2(unitPrice * n),
      stationIds: list.map((s) => s.stationId).sort(),
    })
  }
  return rows.sort((a, b) =>
    a.caseId.localeCompare(b.caseId) ||
    (a.stationTypeId ?? '').localeCompare(b.stationTypeId ?? '') ||
    a.model.localeCompare(b.model) ||
    a.endDay.localeCompare(b.endDay))
}
