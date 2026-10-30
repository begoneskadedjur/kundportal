// Matchning av planerade avtalsperioder mot befintliga fakturor.
//
// En enda matchning för Planera fakturor (contractInvoiceGenerator), nattjobbet
// (api/cron/generate-continuing-contracts), signeringen (api/_lib/contractSigning)
// och regressionsskriptet (scripts/regression/plan-dump.mts). Ren modul utan
// databasanrop, så att den kan köras på servern och i tester.
//
// Steg 2 i docs/planer/avtalsar-exakt-arsdag-teknik.md: koden är flyttad
// ordagrant ur generatorn, cronen och signeringen. Beteendet är oförändrat,
// också där de tre skiljer sig åt (se fortnoxCovers och coveredByFortnox).

import { parseLocalDate, type PlannedPeriod } from './contractPlanner'

/** Fakturan är bokförd, skickad eller betald: rörs aldrig av planen. */
export const LOCKED_STATUSES: ReadonlySet<string> = new Set(['booked', 'sent', 'paid'])
/** Fakturan är ett utkast som planen får uppdatera eller radera. */
export const EDITABLE_STATUSES: ReadonlySet<string> = new Set(['draft', 'pending_approval', 'ready'])

/** Periodnyckel för matchning: ÅÅÅÅ-MM, dagen i månaden ignoreras. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/**
 * Nattjobbets täckningsnyckel: fakturatyp + periodens månad. Diffen är alltid
 * per typ. Nyckel per MÅNAD: importerade fakturor bär avtalets startdag, planen den 1:a.
 */
export function periodKey(kind: string | null | undefined, periodStart: string): string {
  return `${kind ?? 'premium'}|${monthKey(periodStart)}`
}

/** Ett datumintervall, ÅÅÅÅ-MM-DD, båda ändar med. */
export type DateRange = { start: string; end: string }

/**
 * Hur stor del av den planerade perioden som intervallet r täcker, 0 till 1.
 * Räknas som (snittets sista dag minus första dag) / (periodens sista dag minus
 * första dag), alltså utan att lägga till en dag i ändarna. Flyttad ordagrant
 * ur generatorn och signeringen.
 */
export function overlapShare(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>, r: DateRange): number {
  const ps = parseLocalDate(p.periodStart).getTime()
  const pe = parseLocalDate(p.periodEnd).getTime()
  const os = Math.max(ps, parseLocalDate(r.start).getTime())
  const oe = Math.min(pe, parseLocalDate(r.end).getTime())
  if (oe < os || pe <= ps) return 0
  return (oe - os) / (pe - ps)
}

/**
 * Planera fakturor och signeringen: en Fortnox-faktura (F-, is_historical)
 * täcker perioden om den överlappar minst halva perioden. Ren överlappning
 * räckte inte: fakturan för 2026-02-16 till 2027-02-15 överlappade planens
 * 2027-02-01 med två veckor och gjorde att nästa årsfaktura aldrig föreslogs
 * (Drottningens Pizzeria 2026-09-18).
 */
export function fortnoxCovers(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>, ranges: DateRange[]): boolean {
  return ranges.some((r) => overlapShare(p, r) >= 0.5)
}

/**
 * Nattjobbet: en Fortnox-import av samma fakturatyp täcker perioden vid
 * minsta överlapp. Strängare än fortnoxCovers (cronen skapar hellre ingenting
 * än en dubblett). Skillnaden är medveten i dag och ändras inte här.
 */
export function coveredByFortnox(
  p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd' | 'kind'>,
  ranges: Array<DateRange & { kind: string }>
): boolean {
  return ranges.some((r) => r.kind === (p.kind ?? 'premium') && p.periodStart <= r.end && p.periodEnd >= r.start)
}

/** De fält ur en befintlig faktura som matchningen läser. */
export interface MatchableInvoice {
  id: string
  invoice_number?: string | null
  status: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  total_amount: number
  subtotal: number
  is_historical: boolean | null
  invoice_type?: string | null
  fortnox_document_number?: string | null
  has_generic_items?: boolean
}

export type ContractDiffAction =
  | 'keep'
  | 'create'
  | 'update'
  | 'delete'
  | 'locked'
  | 'create-historical'
  | 'backfill-historical-paid'
  | 'uncovered'
  | 'consolidated'

export interface ContractDiffEntry {
  action: ContractDiffAction
  planned?: PlannedPeriod
  existingId?: string
  existingStatus?: string
  existingAmount?: number
  /** Exkl. moms, samma tal som pappret visar */
  existingSubtotal?: number
  reason?: string
  /** Befintliga fakturans Fortnox-nummer (null = aldrig skickad till Fortnox) */
  existingFortnoxNumber?: string | null
  /** Andra redigerbara utkast för samma period (dubbletter), utan Fortnox-nummer */
  duplicateIds?: string[]
}

export interface ContractDiffOptions {
  /** Riktigt avtal: passerade perioder utan faktura blir 'uncovered' (aldrig automatisk betald historik) */
  real: boolean
  /** Läses inte här; radjämförelsen görs av anroparen (refineWithRows i generatorn) */
  compareRows?: boolean
  /** Perioder där avtalet redan ligger på en samlad faktura, nyckel monthKey */
  consolidatedPeriods?: Map<string, MatchableInvoice>
}

/**
 * Bygg diff: planerade vs befintliga. Nyckel = periodstartens månad.
 * Flyttad ordagrant ur contractInvoiceGenerator.buildDiff.
 */
export function buildContractDiff(
  planned: PlannedPeriod[],
  existing: MatchableInvoice[],
  opts: ContractDiffOptions
): ContractDiffEntry[] {
  // Perioder täckta av importerade Fortnox-fakturor (F-, is_historical).
  // Period A överlappar B om A.start <= B.end och A.end >= B.start. Även
  // adhoc-typade importer räknas: år 1 kan ha importerats som engångsbelopp.
  const coveredRanges = existing
    .filter(
      (e) =>
        e.is_historical === true &&
        !!e.invoice_number &&
        e.invoice_number.startsWith('F-') &&
        !!e.billing_period_start &&
        !!e.billing_period_end
    )
    .map((e) => ({ start: e.billing_period_start as string, end: e.billing_period_end as string }))

  const filteredPlanned =
    coveredRanges.length === 0
      ? planned
      : planned.filter((p) => !fortnoxCovers(p, coveredRanges))

  const contractInvoices = existing.filter((e) => e.invoice_type === 'contract' && !(e.invoice_number ?? '').startsWith('F-'))
  // Nyckel = periodens MÅNAD. Importerade fakturor bär ofta avtalets startdag
  // (2025-11-18) medan planen räknar från den 1:a (2025-11-01); samma period
  // ska matcha, annars flaggas den som saknad och fakturan som utanför plan.
  const plannedByKey = new Map(filteredPlanned.map((p) => [monthKey(p.periodStart), p]))
  const existingByKey = new Map(
    contractInvoices.filter((e) => e.billing_period_start).map((e) => [monthKey(e.billing_period_start as string), e])
  )

  const entries: ContractDiffEntry[] = []

  for (const p of filteredPlanned) {
    const consolidated = opts.consolidatedPeriods?.get(monthKey(p.periodStart))
    if (consolidated) {
      entries.push({
        action: 'consolidated',
        planned: p,
        existingId: consolidated.id,
        existingStatus: consolidated.status ?? undefined,
        existingAmount: consolidated.total_amount, existingSubtotal: consolidated.subtotal,
        reason: 'Ligger på kundens samlingsfaktura',
      })
      continue
    }

    const ex = existingByKey.get(monthKey(p.periodStart))

    // Planen innehåller bara nuvarande bindningstid, och nästa
    // bindningsperiod först när sista uppsägningsdag passerat
    // (contractPlanner.bindingWindow). En förlängningsperiod i planen är
    // alltså säker och skapas direkt; den väntar inte på fakturadatumet.
    if (!ex) {
      if (p.isHistorical) {
        entries.push(
          opts.real
            ? { action: 'uncovered', planned: p, reason: 'Passerad period utan faktura i portalen. Importera från Fortnox.' }
            : { action: 'create-historical', planned: p }
        )
      } else {
        entries.push({ action: 'create', planned: p })
      }
      continue
    }

    const status = ex.status ?? 'draft'

    if (p.isHistorical) {
      if (!opts.real && (status !== 'paid' || !ex.is_historical)) {
        entries.push({ action: 'backfill-historical-paid', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
      } else {
        entries.push({ action: 'keep', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
      }
      continue
    }

    if (LOCKED_STATUSES.has(status)) {
      entries.push({
        action: 'locked',
        planned: p,
        existingId: ex.id,
        existingStatus: status,
        existingAmount: ex.total_amount, existingSubtotal: ex.subtotal,
        reason: 'Faktura redan bokförd/skickad/betald',
      })
      continue
    }
    const amountMatches = Math.abs(Number(ex.subtotal) - p.subtotal) < 0.5
    const needsItemsRefresh = amountMatches && ex.has_generic_items === true
    entries.push({
      action: amountMatches && !needsItemsRefresh ? 'keep' : 'update',
      planned: p,
      existingId: ex.id,
      existingStatus: status,
      existingAmount: ex.total_amount, existingSubtotal: ex.subtotal,
    })
  }

  // Befintliga utan motsvarande plan
  const lastPlannedStart = filteredPlanned.reduce((m, p) => (p.periodStart > m ? p.periodStart : m), '')
  for (const ex of contractInvoices) {
    if (!ex.billing_period_start) continue
    if (plannedByKey.has(monthKey(ex.billing_period_start))) continue
    const status = ex.status ?? 'draft'
    if (LOCKED_STATUSES.has(status)) {
      entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
    } else if (EDITABLE_STATUSES.has(status)) {
      // Ett utkast efter planens sista period är en förlängning som skapats
      // för tidigt: den planeras igen dagen efter sista uppsägningsdag.
      const afterPlan = !!lastPlannedStart && monthKey(ex.billing_period_start) > monthKey(lastPlannedStart)
      entries.push({
        action: 'delete',
        existingId: ex.id,
        existingStatus: status,
        existingAmount: ex.total_amount,
        existingSubtotal: ex.subtotal,
        ...(afterPlan
          ? { reason: 'Efter nuvarande bindningstid: planeras igen dagen efter sista uppsägningsdag om avtalet inte sägs upp' }
          : {}),
      })
    } else {
      entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: `Okänd status "${status}" - rör ej` })
    }
  }

  entries.sort((a, b) => (a.planned?.periodStart ?? '').localeCompare(b.planned?.periodStart ?? ''))

  // Fortnox-kontrollen behöver veta om fakturan gått till Fortnox, och
  // vilka andra utkast som ligger på samma period (dubbletter, HSB Kullen
  // 2026-10-15). Dubbletterna syns annars inte: kartan bär ett per månad.
  const byId = new Map(contractInvoices.map((e) => [e.id, e]))
  return entries.map((e) => {
    if (!e.existingId) return e
    const ex = byId.get(e.existingId)
    if (!ex) return e
    const key = ex.billing_period_start ? monthKey(ex.billing_period_start) : null
    const duplicateIds = key
      ? contractInvoices
          .filter(
            (o) =>
              o.id !== ex.id &&
              !!o.billing_period_start &&
              monthKey(o.billing_period_start) === key &&
              EDITABLE_STATUSES.has(o.status ?? 'draft') &&
              !o.fortnox_document_number
          )
          .map((o) => o.id)
      : []
    return {
      ...e,
      existingFortnoxNumber: ex.fortnox_document_number ?? null,
      ...(duplicateIds.length ? { duplicateIds } : {}),
    }
  })
}
