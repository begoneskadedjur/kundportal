// Matchning av planerade avtalsperioder mot befintliga fakturor.
//
// En enda matchning för Planera fakturor (contractInvoiceGenerator), nattjobbet
// (api/cron/generate-continuing-contracts), signeringen (api/_lib/contractSigning)
// och regressionsskriptet (scripts/regression/plan-dump.mts). Ren modul utan
// databasanrop, så att den kan köras på servern och i tester.
//
// Steg 2 i docs/planer/avtalsar-exakt-arsdag-teknik.md flyttade koden hit
// ordagrant. Steg 7 lägger till överlappsmatchningen (avsnitt 5 i planen):
//
// - Läget 'legacy' (avtal utan billing_anchor_mode, alla avtal i dag) matchar
//   på periodstartens månad exakt som förut. Regressionsskriptet visar att
//   resultatet är identiskt med baslinjen.
// - Läget 'overlap' (avtal med billing_anchor_mode = 'start_day') matchar på
//   datumöverlapp. Andelen räknas som överlappsvakten i databasen
//   (guard_contract_invoice_overlap): dagar i snittet delat med dagarna i den
//   KORTARE perioden, båda ändar med. Gränsen är minst hälften. Därmed föreslår
//   planen aldrig en ny faktura som vakten stoppar som dubblett.

import { parseLocalDate, type PlannedPeriod } from './contractPlanner'
import { isStartDayMode } from './contractPeriods'

/**
 * Fakturan är bokförd, skickad, förfallen eller betald: rörs aldrig av planen.
 * overdue lades till i steg 7; förut föll den i grenen "Okänd status" som
 * också lämnade fakturan orörd.
 */
export const LOCKED_STATUSES: ReadonlySet<string> = new Set(['booked', 'sent', 'overdue', 'paid'])
/** Fakturan är ett utkast som planen får uppdatera eller radera. */
export const EDITABLE_STATUSES: ReadonlySet<string> = new Set(['draft', 'pending_approval', 'ready'])

/** Hur planerade perioder paras med befintliga fakturor. */
export type MatchMode = 'legacy' | 'overlap'

/** Avtal med exakt avtalsdag matchar på överlapp, alla andra på månad (dagens regel). */
export function matchModeFor(c: { billing_anchor_mode?: string | null; contract_start_date?: string | null } | null | undefined): MatchMode {
  return c && isStartDayMode({ billing_anchor_mode: c.billing_anchor_mode ?? null, contract_start_date: c.contract_start_date ?? null })
    ? 'overlap'
    : 'legacy'
}

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
 * ur generatorn och signeringen. Används bara i läget 'legacy'.
 */
export function overlapShare(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>, r: DateRange): number {
  const ps = parseLocalDate(p.periodStart).getTime()
  const pe = parseLocalDate(p.periodEnd).getTime()
  const os = Math.max(ps, parseLocalDate(r.start).getTime())
  const oe = Math.min(pe, parseLocalDate(r.end).getTime())
  if (oe < os || pe <= ps) return 0
  return (oe - os) / (pe - ps)
}

/** Dagnummer för ett ÅÅÅÅ-MM-DD-datum (UTC-räkning, så sommartid inte flyttar något). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86400000)
}

/** Antal dagar i intervallet, båda ändar med. */
export function daysInclusive(r: DateRange): number {
  return dayNumber(r.end) - dayNumber(r.start) + 1
}

/**
 * Överlappsandel som i databasens överlappsvakt (guard_contract_invoice_overlap,
 * steg 3): dagar i snittet / dagar i den kortare perioden, båda ändar med.
 * 0 när intervallen inte möts. Symmetrisk.
 */
export function periodOverlapShare(a: DateRange, b: DateRange): number {
  const from = Math.max(dayNumber(a.start), dayNumber(b.start))
  const to = Math.min(dayNumber(a.end), dayNumber(b.end))
  if (to < from) return 0
  const shorter = Math.max(Math.min(daysInclusive(a), daysInclusive(b)), 1)
  return (to - from + 1) / shorter
}

/** Gränsen för samma period: minst hälften av den kortare perioden (samma som vakten). */
export const SAME_PERIOD_SHARE = 0.5

const asRange = (p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>): DateRange => ({ start: p.periodStart, end: p.periodEnd })

/**
 * Planera fakturor och signeringen: en Fortnox-faktura (F-, is_historical)
 * täcker perioden om den överlappar minst halva perioden. Ren överlappning
 * räckte inte: fakturan för 2026-02-16 till 2027-02-15 överlappade planens
 * 2027-02-01 med två veckor och gjorde att nästa årsfaktura aldrig föreslogs
 * (Drottningens Pizzeria 2026-09-18). I läget 'overlap' räknas andelen som
 * överlappsvakten (mot den kortare perioden).
 */
export function fortnoxCovers(p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>, ranges: DateRange[], mode: MatchMode = 'legacy'): boolean {
  if (mode === 'overlap') return ranges.some((r) => periodOverlapShare(asRange(p), r) >= SAME_PERIOD_SHARE)
  return ranges.some((r) => overlapShare(p, r) >= 0.5)
}

/**
 * Nattjobbet: en Fortnox-import av samma fakturatyp täcker perioden vid
 * minsta överlapp. Strängare än fortnoxCovers (cronen skapar hellre ingenting
 * än en dubblett). Gäller den skarpa körningen för avtal utan exakt avtalsdag;
 * se cronFortnoxCovers.
 */
export function coveredByFortnox(
  p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd' | 'kind'>,
  ranges: Array<DateRange & { kind: string }>
): boolean {
  return ranges.some((r) => r.kind === (p.kind ?? 'premium') && p.periodStart <= r.end && p.periodEnd >= r.start)
}

/**
 * Nattjobbets Fortnox-regel per avtal (steg 7):
 * - avtal med exakt avtalsdag: som generatorn i läget 'overlap' (minst hälften av den kortare perioden),
 * - övriga avtal med v2 (CONTINUING_CONTRACTS_V2 eller torrkörningen): som generatorn (minst halva perioden),
 * - övriga avtal i den skarpa körningen: varje överlapp, som förut.
 * Alltid bara importer av samma fakturatyp.
 */
export function cronFortnoxCovers(
  p: Pick<PlannedPeriod, 'periodStart' | 'periodEnd' | 'kind'>,
  ranges: Array<DateRange & { kind: string }>,
  opts: { mode: MatchMode; v2: boolean }
): boolean {
  if (opts.mode === 'legacy' && !opts.v2) return coveredByFortnox(p, ranges)
  const sameKind = ranges.filter((r) => r.kind === (p.kind ?? 'premium'))
  return fortnoxCovers(p, sameKind, opts.mode)
}

/** En befintlig faktura sedd som intervall, för matchningen. */
export type ExistingRange = DateRange & {
  id: string
  status?: string | null
  invoice_number?: string | null
}

export interface PeriodMatch {
  /** Planerad period (index) -> befintlig faktura (index) */
  pairs: Map<number, number>
  /** Befintliga (index) som varken paras eller räknas till en planerad period: blir delete eller locked */
  unmatchedExisting: number[]
}

/**
 * Para planerade perioder med befintliga fakturor (avsnitt 5 i planen).
 *
 * 'legacy': dagens regel ordagrant. Nyckel = periodstartens månad; finns flera
 * befintliga i samma månad vinner den sista i listan (som Map-uppslaget i dag)
 * och de andra räknas ändå som tillhörande perioden (de syns som dubbletter).
 * Befintliga utan planerad period i sin månad är omatchade.
 *
 * 'overlap': alla par med andel minst hälften (periodOverlapShare, samma regel
 * som databasens vakt) sorteras på andel fallande, sedan på avståndet mellan
 * startdagarna, sedan på fakturans id, och tas girigt: varje planerad period
 * och varje faktura högst en gång. Ingen månadsreserv.
 */
export function matchPeriods(planned: DateRange[], existing: ExistingRange[], mode: MatchMode): PeriodMatch {
  const pairs = new Map<number, number>()
  if (mode === 'legacy') {
    const byMonth = new Map<string, number>()
    existing.forEach((e, j) => {
      if (e.start) byMonth.set(monthKey(e.start), j)
    })
    const plannedMonths = new Set(planned.map((p) => monthKey(p.start)))
    planned.forEach((p, i) => {
      const j = byMonth.get(monthKey(p.start))
      if (j !== undefined) pairs.set(i, j)
    })
    const unmatchedExisting = existing
      .map((e, j) => ({ e, j }))
      .filter(({ e }) => !!e.start && !plannedMonths.has(monthKey(e.start)))
      .map(({ j }) => j)
    return { pairs, unmatchedExisting }
  }

  const candidates: Array<{ i: number; j: number; share: number; dist: number; id: string }> = []
  planned.forEach((p, i) => {
    existing.forEach((e, j) => {
      if (!e.start) return
      const share = periodOverlapShare(p, { start: e.start, end: e.end || e.start })
      if (share >= SAME_PERIOD_SHARE) {
        candidates.push({ i, j, share, dist: Math.abs(dayNumber(p.start) - dayNumber(e.start)), id: e.id })
      }
    })
  })
  candidates.sort((a, b) => b.share - a.share || a.dist - b.dist || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || a.i - b.i)
  const usedExisting = new Set<number>()
  for (const c of candidates) {
    if (pairs.has(c.i) || usedExisting.has(c.j)) continue
    pairs.set(c.i, c.j)
    usedExisting.add(c.j)
  }
  const unmatchedExisting = existing.map((e, j) => ({ e, j })).filter(({ e, j }) => !!e.start && !usedExisting.has(j)).map(({ j }) => j)
  return { pairs, unmatchedExisting }
}

/**
 * Nattjobbet och signeringen (de skapar bara): finns perioden redan?
 * 'legacy': samma månad och typ som en befintlig faktura (dagens nyckel).
 * 'overlap': en befintlig faktura tar minst hälften av den kortare perioden,
 * eller ett utkast (inte låst, inte Fortnox-import) överlappar alls. Båda
 * fallen stoppas annars av databasens vakt; utkastet flyttas av Planera fakturor.
 */
export function isCovered(p: DateRange, existing: ExistingRange[], mode: MatchMode): boolean {
  if (mode === 'legacy') return existing.some((e) => !!e.start && monthKey(e.start) === monthKey(p.start))
  return existing.some((e) => {
    if (!e.start) return false
    const share = periodOverlapShare(p, { start: e.start, end: e.end || e.start })
    if (share >= SAME_PERIOD_SHARE) return true
    const locked = LOCKED_STATUSES.has(e.status ?? '') || (e.invoice_number ?? '').startsWith('F-')
    return share > 0 && !locked
  })
}

/**
 * Den planerade perioden som en befintlig faktura hör till (cronens radbyte på
 * redigerbara fakturor). 'legacy': exakt samma startdag (dagens regel).
 * 'overlap': störst andel, minst hälften.
 */
export function findPlannedFor<T extends Pick<PlannedPeriod, 'periodStart' | 'periodEnd'>>(
  planned: T[],
  inv: { start: string; end?: string | null },
  mode: MatchMode
): T | undefined {
  if (mode === 'legacy') return planned.find((p) => p.periodStart === inv.start)
  let best: T | undefined
  let bestShare = 0
  for (const p of planned) {
    const share = periodOverlapShare(asRange(p), { start: inv.start, end: inv.end || inv.start })
    if (share >= SAME_PERIOD_SHARE && share > bestShare) {
      best = p
      bestShare = share
    }
  }
  return best
}

/**
 * Samlingsgruppens nyckel (generatorn och cronen): avtal med samma nyckel
 * hamnar på samma samlingsfaktura. Exakt avtalsdag: frekvens plus avtalsdagens
 * månad och dag, så att avtal med olika avtalsdag aldrig delar faktura.
 */
export function consolidationGroupKey(c: {
  billing_frequency?: string | null
  billing_anchor_month?: number | null
  billing_anchor_mode?: string | null
  contract_start_date?: string | null
}): string {
  if (matchModeFor(c) === 'overlap') return `${c.billing_frequency ?? ''}|start_day|${(c.contract_start_date as string).slice(5, 10)}`
  return `${c.billing_frequency ?? ''}|${c.billing_anchor_month ?? ''}`
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
  /** Samlingsfakturor där avtalet redan ligger med en rad (contract_id på raden) */
  consolidatedInvoices?: MatchableInvoice[]
  /** 'legacy' (standard) = dagens månadsnyckel, 'overlap' = exakt avtalsdag */
  mode?: MatchMode
}

const rangeOf = (e: MatchableInvoice): DateRange => ({
  start: e.billing_period_start as string,
  end: (e.billing_period_end ?? e.billing_period_start) as string,
})

/**
 * Bygg diff: planerade vs befintliga. Matchningen görs av matchPeriods i
 * avtalets läge; för 'legacy' är resultatet detsamma som före steg 7.
 */
export function buildContractDiff(
  planned: PlannedPeriod[],
  existing: MatchableInvoice[],
  opts: ContractDiffOptions
): ContractDiffEntry[] {
  const mode: MatchMode = opts.mode ?? 'legacy'
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
      : planned.filter((p) => !fortnoxCovers(p, coveredRanges, mode))

  const contractInvoices = existing.filter((e) => e.invoice_type === 'contract' && !(e.invoice_number ?? '').startsWith('F-'))
  // legacy: nyckel = periodens MÅNAD. Importerade fakturor bär ofta avtalets
  // startdag (2025-11-18) medan planen räknar från den 1:a (2025-11-01); samma
  // period ska matcha, annars flaggas den som saknad och fakturan som utanför plan.
  // overlap: datumöverlapp, se matchPeriods.
  const withStart = contractInvoices.filter((e) => e.billing_period_start)
  const match = matchPeriods(
    filteredPlanned.map((p) => asRange(p)),
    withStart.map((e) => ({ ...rangeOf(e), id: e.id, status: e.status, invoice_number: e.invoice_number ?? null })),
    mode
  )

  // Samlingsfakturan där avtalet redan ligger. legacy: samma månad, den sista
  // i listan vinner (som kartan förut). overlap: störst andel, minst hälften.
  const consolidatedFor = (p: PlannedPeriod): MatchableInvoice | undefined => {
    const list = (opts.consolidatedInvoices ?? []).filter((c) => c.billing_period_start)
    if (mode === 'legacy') {
      let hit: MatchableInvoice | undefined
      for (const c of list) if (monthKey(c.billing_period_start as string) === monthKey(p.periodStart)) hit = c
      return hit
    }
    let best: MatchableInvoice | undefined
    let bestShare = 0
    for (const c of list) {
      const share = periodOverlapShare(asRange(p), rangeOf(c))
      if (share >= SAME_PERIOD_SHARE && share > bestShare) {
        best = c
        bestShare = share
      }
    }
    return best
  }

  const entries: ContractDiffEntry[] = []

  filteredPlanned.forEach((p, i) => {
    const consolidated = consolidatedFor(p)
    if (consolidated) {
      entries.push({
        action: 'consolidated',
        planned: p,
        existingId: consolidated.id,
        existingStatus: consolidated.status ?? undefined,
        existingAmount: consolidated.total_amount, existingSubtotal: consolidated.subtotal,
        reason: 'Ligger på kundens samlingsfaktura',
      })
      return
    }

    const j = match.pairs.get(i)
    const ex = j === undefined ? undefined : withStart[j]

    // Planen innehåller bara nuvarande bindningstid, och nästa
    // bindningsperiod först när sista uppsägningsdag passerat
    // (contractPlanner.bindingWindow). En förlängningsperiod i planen är
    // alltså säker och skapas direkt; den väntar inte på fakturadatumet.
    if (!ex) {
      // overlap: en låst faktura som tar minst hälften av perioden men redan
      // parats med en annan period. Vakten stoppar en ny faktura här; perioden
      // visas som låst i stället för att föreslås.
      const blocker =
        mode === 'overlap'
          ? withStart.find(
              (e) => LOCKED_STATUSES.has(e.status ?? '') && periodOverlapShare(asRange(p), rangeOf(e)) >= SAME_PERIOD_SHARE
            )
          : undefined
      if (blocker) {
        entries.push({
          action: 'locked',
          planned: p,
          existingId: blocker.id,
          existingStatus: blocker.status ?? undefined,
          existingAmount: blocker.total_amount,
          existingSubtotal: blocker.subtotal,
          reason: 'Perioden täcks till minst hälften av en faktura som redan är bokförd/skickad/betald',
        })
        return
      }
      if (p.isHistorical) {
        entries.push(
          opts.real
            ? { action: 'uncovered', planned: p, reason: 'Passerad period utan faktura i portalen. Importera från Fortnox.' }
            : { action: 'create-historical', planned: p }
        )
      } else {
        entries.push({ action: 'create', planned: p })
      }
      return
    }

    const status = ex.status ?? 'draft'

    if (p.isHistorical) {
      if (!opts.real && (status !== 'paid' || !ex.is_historical)) {
        entries.push({ action: 'backfill-historical-paid', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
      } else {
        entries.push({ action: 'keep', planned: p, existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal })
      }
      return
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
      return
    }
    const amountMatches = Math.abs(Number(ex.subtotal) - p.subtotal) < 0.5
    const needsItemsRefresh = amountMatches && ex.has_generic_items === true
    // overlap: också periodens datum. Ett utkast som följer den 1:a får
    // avtalsdagens datum (update). legacy jämför bara beloppet, som förut.
    const datesMatch =
      mode === 'legacy' || (ex.billing_period_start === p.periodStart && (ex.billing_period_end ?? null) === p.periodEnd)
    entries.push({
      action: amountMatches && !needsItemsRefresh && datesMatch ? 'keep' : 'update',
      planned: p,
      existingId: ex.id,
      existingStatus: status,
      existingAmount: ex.total_amount, existingSubtotal: ex.subtotal,
    })
  })

  // Befintliga utan motsvarande plan
  const lastPlannedStart = filteredPlanned.reduce((m, p) => (p.periodStart > m ? p.periodStart : m), '')
  const lastPlannedEnd = filteredPlanned.reduce((m, p) => (p.periodEnd > m ? p.periodEnd : m), '')
  for (const j of match.unmatchedExisting) {
    const ex = withStart[j]
    const start = ex.billing_period_start as string
    const status = ex.status ?? 'draft'
    if (LOCKED_STATUSES.has(status)) {
      entries.push({ action: 'locked', existingId: ex.id, existingStatus: status, existingAmount: ex.total_amount, existingSubtotal: ex.subtotal, reason: 'Utanför nuvarande plan men redan bokförd/skickad/betald' })
    } else if (EDITABLE_STATUSES.has(status)) {
      // Ett utkast efter planens sista period är en förlängning som skapats
      // för tidigt: den planeras igen dagen efter sista uppsägningsdag.
      const afterPlan =
        mode === 'legacy'
          ? !!lastPlannedStart && monthKey(start) > monthKey(lastPlannedStart)
          : !!lastPlannedEnd && start > lastPlannedEnd
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
  // 2026-10-15). legacy: samma månad. overlap: minst hälften av den kortare perioden.
  const byId = new Map(contractInvoices.map((e) => [e.id, e]))
  const samePeriod = (a: MatchableInvoice, b: MatchableInvoice): boolean =>
    mode === 'legacy'
      ? monthKey(a.billing_period_start as string) === monthKey(b.billing_period_start as string)
      : periodOverlapShare(rangeOf(a), rangeOf(b)) >= SAME_PERIOD_SHARE
  return entries.map((e) => {
    if (!e.existingId) return e
    const ex = byId.get(e.existingId)
    if (!ex) return e
    const duplicateIds = ex.billing_period_start
      ? contractInvoices
          .filter(
            (o) =>
              o.id !== ex.id &&
              !!o.billing_period_start &&
              samePeriod(o, ex) &&
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
