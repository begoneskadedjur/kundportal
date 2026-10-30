// src/shared/contractPlanner.ts
// Periodmatematiken för årspremiefakturor, delad av webben
// (contractInvoiceGenerator) och cron-jobbet (generate-continuing-contracts).
// Inga DB-anrop, inga importer från src/lib: modulen ska kunna köras i Node
// utan Vite-miljö.
//
// Avtalet är källan: beloppet per period kommer ur premietrappan
// (contract_premium_events) och faller tillbaka på annual_value när trappan
// saknar steg. Utrustning "per styck och år" (§ 5) blir egna rader på samma
// faktura, skalade per period precis som premien.

import {
  addMonthsClampedIso,
  exactPeriodIndexContaining,
  exactPeriods,
  isStartDayMode,
  periodStepMonths,
} from './contractPeriods'

export type BillingFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand'

/**
 * Fakturatyp för avtalsfakturor. premium = årspremien (med § 5 per år-rader
 * när avtalet fakturerar utrustning på premiefakturan), equipment = egna
 * fakturor för § 5 per år-rader, equipment_monthly = egna månadsfakturor för
 * § 5 per månad-rader. Diffen mot befintliga fakturor görs alltid per typ.
 * equipment_gap = glappfaktura för tilläggsstationer från utsättningen till
 * nästa periodstart (bara avtal med addon_rules = 'v2', steg 11).
 */
export type ContractInvoiceKind = 'premium' | 'equipment' | 'equipment_monthly' | 'equipment_gap'

/** Var § 5 per år-rader hamnar: på premiefakturan eller på egna fakturor. */
export type EquipmentInvoiceMode = 'with_premium' | 'separate'

/** Fält planeringen behöver från ett avtal (eller kundraden för synth-avtal). */
export interface PlanningContract {
  annual_value: number | string | null
  contract_start_date: string | null
  contract_end_date: string | null
  terminated_at: string | null
  billing_frequency: BillingFrequency | string | null
  billing_anchor_month: number | null
  billing_active: boolean | null
  notice_period_months: number | null
  /** § 8 förlängningsläge: rolling (default), fixed eller option */
  renewal_mode?: string | null
  /**
   * Uppsägningens sista giltiga dag (satt vid uppsägning). Går före den
   * beräknade kapningen: kunden betalar till och med detta datum.
   */
  effective_end_date?: string | null
  /**
   * 'start_day' = perioderna börjar på exakta avtalsdagen (contractPeriods.ts).
   * NULL = dagens regel: perioden börjar den 1:a, årsvis i ankarmånaden.
   */
  billing_anchor_mode?: string | null
}

/** Ett steg i premietrappan: årsvärdet som gäller från och med datumet. */
export interface PremiumStep {
  effective_from: string
  annual_value: number | string
  /** contract_premium_events.event_type; 'indexation' styr regeln i annualValueForExactPeriod */
  event_type?: string | null
}

/**
 * § 5-rad med faktureringsläge per år eller per månad.
 * per_year: unit_price_annual = pris per styck och år.
 * per_month: unit_price_month = pris per styck och månad (årspris / 12).
 * billing_start_date: raden tas bara med i perioder som börjar från och med
 * datumet (perioden dessförinnan täcks av pro rata på etableringsärendet).
 */
export interface EquipmentLine {
  id: string
  contract_id?: string | null
  name: string
  code: string | null
  quantity: number
  unit_price_annual: number
  unit_price_month?: number
  vat_rate: number
  billing_model?: 'per_year' | 'per_month'
  billing_start_date?: string | null
  /** Tilläggsstationerna bakom raden just nu, fryses på fakturaraden */
  station_ids?: string[] | null
  /** Nya tilläggsregler (v2): enheten raden hör till, dess namn och märkning */
  site_customer_id?: string | null
  station_type_id?: string | null
  unit_name?: string | null
  marking?: string | null
}

/** En utrustningsrad skalad till fakturaperioden. */
export interface PlannedEquipmentRow {
  source_id: string
  contract_id: string | null
  name: string
  code: string | null
  quantity: number
  unit_price: number
  total_price: number
  vat_rate: number
  /**
   * Nya tilläggsregler (v2, steg 11): enhetens namn på raden och stationerna
   * som faktureras just den perioden. Sätts bara i v2; undefined i gamla läget
   * (regressionsdumpen ska vara oförändrad).
   */
  unit_name?: string | null
  station_ids?: string[] | null
  /** Enhetens referenskod när den skiljer sig från fakturans (en faktura för hela avtalet) */
  unit_marking?: string | null
  /**
   * Exakt avtalsdag: § 6-radens billing_start_date (som låg strax efter
   * periodstart, ett arv från den 1:a) och raden togs med från periodstart.
   */
  billing_start_snapped?: string
}

export interface PlannedPeriod {
  /** Fakturatyp perioden avser (premium om inget annat sägs) */
  kind: ContractInvoiceKind
  periodStart: string
  periodEnd: string
  /** Premiebelopp för perioden (exkl. moms) */
  amount: number
  /** Årsvärdet som gällde vid periodstart (ur trappan) */
  annualInForce: number
  equipmentRows: PlannedEquipmentRow[]
  /** Premie + utrustning, exkl. moms */
  subtotal: number
  vatAmount: number
  totalAmount: number
  /** Dagen fakturan ska skapas: periodstart minus ledtid, aldrig före idag */
  invoiceDate: string
  dueDate: string
  /** Perioden började före innevarande månad */
  isHistorical: boolean
  sequenceNumber: number
  totalSequenceCount: number
  /**
   * Förlängningsperiod: perioden hör till nästa bindningsperiod (eller, för
   * ett avtal som löper tills vidare, har inte börjat än) och kom med i
   * planen först när sista uppsägningsdag passerat. Cronen skapar sådana
   * utkast direkt, utan att vänta på fakturadatumet.
   */
  renewal?: boolean
}

export interface PlanOptions {
  steps?: PremiumStep[]
  equipment?: EquipmentLine[]
  /** Betalningsvillkor i dagar (kategori contract) */
  paymentTermsDays?: number
  /**
   * Ledtid: fakturan skapas så många dagar före periodstart att den med
   * betalningsvillkoren är betald innan kundens nya avtalsår börjar.
   */
  leadDays?: number
  /** Idag (lokal ÅÅÅÅ-MM-DD), för tester */
  today?: string
  /**
   * Fri horisont bortom avtalets slutdatum (perioden får börja före
   * horisonten utan att rymmas helt). Används bara av vyer som vill titta
   * längre fram; fakturaplaneringen använder window: 'binding'.
   */
  horizonEnd?: string
  /**
   * binding = planera bara avtalets nuvarande bindningstid, plus nästa
   * bindningsperiod när sista uppsägningsdag passerat utan uppsägning
   * (bindingWindow). Samma regel för Planera fakturor, signeringen och
   * cronen. Uppsagda avtal planeras som utan horisont (slutdatum och
   * uppsägningens kapning). Går före horizonEnd.
   */
  window?: 'binding'
  /** Var § 5 per år-rader hamnar (default with_premium = på premiefakturan) */
  equipmentMode?: EquipmentInvoiceMode
}

/** Standardledtid: 30 dagars betalningsvillkor plus tio dagars marginal. */
export const DEFAULT_INVOICE_LEAD_DAYS = 40

export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayLocal(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setDate(out.getDate() + days)
  return out
}

/**
 * Kapningsdatum vid uppsägning:
 * - Satt slutdatum (effective_end_date, sista giltiga dag): det datumet.
 *   Kunden betalar till och med slutdatumet (beslut Christian 2026-10-21).
 * - Annars inom bindningstid (terminated_at <= contract_end_date): contract_end_date.
 * - Annars fortlöpande: terminated_at + notice_period_months.
 * Null när avtalet inte är uppsagt.
 */
export function computeTerminationCutoff(c: PlanningContract): Date | null {
  if (!c.terminated_at) return null
  if (c.effective_end_date) return parseLocalDate(c.effective_end_date)
  const notice = c.notice_period_months ?? 2
  const termDate = new Date(c.terminated_at)
  const contractEnd = c.contract_end_date ? parseLocalDate(c.contract_end_date) : null
  if (contractEnd && termDate <= contractEnd) return contractEnd
  const cutoff = new Date(termDate)
  cutoff.setMonth(cutoff.getMonth() + notice)
  return cutoff
}

/**
 * Slutet på den avtalsperiod som gäller i dag. Ett avtal som rullar vidare
 * förlängs ett år i taget efter slutdatumet, så ett passerat slutdatum
 * flyttas fram tills det ligger framför i dag. Uppsagda avtal och avtal med
 * option behåller sitt datum; slutdatumet i databasen rörs aldrig, det är
 * bara beräkningen (sista uppsägningsdag, periodskifte, påminnelse) som
 * följer avtalet.
 */
export function rollingEndDate(
  c: { contract_end_date: string | null; terminated_at?: string | null; renewal_mode?: string | null; effective_end_date?: string | null },
  todayIso: string = toLocalIsoDate(todayLocal())
): string | null {
  const end = c.contract_end_date ?? null
  if (!end) return null
  if (c.terminated_at) return c.effective_end_date ?? end
  if ((c.renewal_mode ?? 'rolling') === 'option') return end
  if (end >= todayIso) return end
  const d = parseLocalDate(end)
  let guard = 0
  while (toLocalIsoDate(d) < todayIso && guard < 100) {
    d.setFullYear(d.getFullYear() + 1)
    guard++
  }
  return toLocalIsoDate(d)
}

/** Uppsägningstid när avtalet saknar uppgift (samma antagande som computeTerminationCutoff). */
export const DEFAULT_NOTICE_MONTHS = 2

/** Lokal datumaritmetik i hela månader (JS-överslag som i övriga uppsägningsberäkningar). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toLocalIsoDate(new Date(y, (m ?? 1) - 1 + months, d ?? 1))
}

export function addDaysIso(iso: string, days: number): string {
  return toLocalIsoDate(addDays(parseLocalDate(iso), days))
}

/**
 * Sista uppsägningsdag inför ett periodskifte: periodens slut minus
 * uppsägningstiden. Den enda beräkningen av datumet: kundkortets bevakning
 * (lastTerminationDay) och fakturaplaneringen använder båda den här.
 */
export function lastNoticeDay(periodEndIso: string, noticeMonths: number): string {
  return addMonthsIso(periodEndIso, -noticeMonths)
}

/** Planeringsfönstret för ett avtal en viss dag. */
export interface BindingWindow {
  /** Slutet på nuvarande bindningstid (rullat fram år för år); null = tills vidare */
  currentEnd: string | null
  /** Sista uppsägningsdag inför currentEnd; null för tills vidare och option */
  lastNoticeDay: string | null
  /** Sista uppsägningsdag har passerat utan uppsägning: nästa bindningsperiod är säker */
  renewalDue: boolean
  /** Planeringens slut */
  planEnd: string
  /** Tills vidare: perioder som börjar före planEnd tas med */
  openEnded: boolean
}

/**
 * Vilka perioder får planeras i dag? Regeln (beslut 2026-10-15):
 * - Avtal med slutdatum: perioderna i nuvarande bindningstid
 *   (contract_start_date till slutdatumet, eller för ett rullande avtal som
 *   redan förlängts, den löpande ettårsperioden). Nästa bindningsperiod
 *   (ett år) kommer med först dagen efter sista uppsägningsdag.
 * - Option: bara till slutdatumet. Förlängningen sker när optionen nyttjas
 *   (slutdatumet flyttas), aldrig automatiskt.
 * - Tills vidare (inget slutdatum): en period kommer med när en uppsägning
 *   i dag inte längre hinner före periodstart, alltså perioder som börjar
 *   före i dag plus uppsägningstiden.
 * null = uppsagt avtal eller startdatum saknas: planeras som förut, utan
 * horisont (slutdatum och uppsägningens kapning).
 */
export function bindingWindow(c: PlanningContract, todayIso: string = toLocalIsoDate(todayLocal())): BindingWindow | null {
  if (c.terminated_at) return null
  if (!c.contract_start_date) return null
  const notice = c.notice_period_months ?? DEFAULT_NOTICE_MONTHS
  if (!c.contract_end_date) {
    return { currentEnd: null, lastNoticeDay: null, renewalDue: false, planEnd: addMonthsIso(todayIso, notice), openEnded: true }
  }
  if ((c.renewal_mode ?? 'rolling') === 'option') {
    return { currentEnd: c.contract_end_date, lastNoticeDay: null, renewalDue: false, planEnd: c.contract_end_date, openEnded: false }
  }
  const currentEnd = rollingEndDate(c, todayIso) ?? c.contract_end_date
  const deadline = lastNoticeDay(currentEnd, notice)
  const renewalDue = todayIso > deadline
  return {
    currentEnd,
    lastNoticeDay: deadline,
    renewalDue,
    planEnd: renewalDue ? addMonthsIso(currentEnd, 12) : currentEnd,
    openEnded: false,
  }
}

/**
 * Nästa förlängning som ännu INTE är planerad: sista dag att säga upp den,
 * dagen den planeras (dagen efter) och dess första period. null för uppsagda
 * avtal, option och avtal utan perioder. Visas i kundkortet som "Därefter".
 */
export function nextRenewal(
  c: PlanningContract,
  opts: Omit<PlanOptions, 'window' | 'horizonEnd'> = {}
): { noticeDeadline: string; planDate: string; period: PlannedPeriod } | null {
  const todayIso = opts.today ?? toLocalIsoDate(todayLocal())
  const w = bindingWindow(c, todayIso)
  if (!w) return null
  let deadline: string
  if (w.openEnded) {
    // Första perioden som inte ryms i dagens fönster
    const later = computePlannedPeriods(c, { ...opts, horizonEnd: addMonthsIso(w.planEnd, 24) })
    const next = later.find((p) => p.periodStart >= w.planEnd)
    if (!next) return null
    deadline = lastNoticeDay(next.periodStart, c.notice_period_months ?? DEFAULT_NOTICE_MONTHS)
  } else {
    if (!w.lastNoticeDay) return null
    const end = w.renewalDue ? w.planEnd : w.currentEnd!
    deadline = lastNoticeDay(end, c.notice_period_months ?? DEFAULT_NOTICE_MONTHS)
  }
  const planDate = addDaysIso(deadline, 1)
  const periods = computePlannedPeriods(c, { ...opts, today: planDate, window: 'binding' }).filter((p) => p.renewal)
  if (periods.length === 0) return null
  return { noticeDeadline: deadline, planDate, period: periods[0] }
}

/**
 * Cronens regel för när en planerad period blir utkast: en förlängning
 * (säker sedan sista uppsägningsdag passerat) direkt, övriga perioder när
 * fakturadatumet är inne. Fakturadatumet är aldrig före planeringsdagen.
 */
export function isDueForCreation(p: Pick<PlannedPeriod, 'renewal' | 'invoiceDate'>, todayIso: string): boolean {
  return !!p.renewal || p.invoiceDate <= todayIso
}

/** Högst så många dagar efter periodstart får billing_start_date ligga för att raden ska tas med från periodstart. */
export const SNAP_MAX_DAYS = 31

/**
 * Exakt avtalsdag (steg 11, FEV-fyndet i steg 7): en § 6-rad vars
 * billing_start_date ligger högst SNAP_MAX_DAYS dagar efter periodstart i en
 * halvårs- eller årsperiod är ett arv från perioden som började den 1:a
 * (FEV: 2027-07-01 mot avtalsdagen 2027-06-30). Raden tas med från
 * periodstart i stället för att falla ur hela perioden. Gäller bara exakt läge.
 */
export function snapsToPeriodStart(billingStart: string, periodStartIso: string, periodEndIso: string): boolean {
  if (billingStart <= periodStartIso || billingStart > periodEndIso) return false
  const day = 86_400_000
  const ps = parseLocalDate(periodStartIso).getTime()
  const len = Math.round((parseLocalDate(periodEndIso).getTime() - ps) / day) + 1
  const after = Math.round((parseLocalDate(billingStart).getTime() - ps) / day)
  return len >= 180 && after <= SNAP_MAX_DAYS
}

/** Periodens mittpunkt ligger före datumet: perioden hör till största delen till tiden före. */
function midpointBefore(periodStart: Date, periodEnd: Date, limit: Date): boolean {
  return (periodStart.getTime() + periodEnd.getTime()) / 2 < limit.getTime()
}

/**
 * Mittpunktsregeln för bindningsfönstret i båda lägena. Gamla läget: som
 * midpointBefore. Exakt avtalsdag (exactStepMonths satt): perioden avgörs av
 * motsvarande period i gamla läget, alltså samma månader räknat från den 1:a
 * (periodens startmånad till dagen före startmånaden plus steget). Då
 * förlänger exakt läge ett löpande avtal på samma sätt som gamla läget
 * (förlängning, uppsägning, mittpunkt, option), bara med perioder från
 * avtalsdagen. Utan det hamnar mittpunkten exakt på eller strax efter det
 * rullade slutdatumet när bindningstiden inte är hela år (sex månaders
 * bindning med årsvis fakturering: Kleberg, Bockholmen), och perioden föll
 * bort (datasteg 18, STRUL 1).
 */
export function periodBeforeLimit(
  periodStart: Date,
  periodEnd: Date,
  limit: Date,
  exactStepMonths: number | null
): boolean {
  if (!exactStepMonths) return midpointBefore(periodStart, periodEnd, limit)
  const legacyStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
  const legacyEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + exactStepMonths, 0)
  return midpointBefore(legacyStart, legacyEnd, limit)
}

export function periodDivisor(freq: string | null): number {
  if (freq === 'monthly') return 12
  if (freq === 'quarterly') return 4
  if (freq === 'semi_annual') return 2
  return 1
}

export function amountPerPeriodPure(annual: number, freq: string | null): number {
  if (!freq || freq === 'on_demand') return 0
  return Math.round(annual / periodDivisor(freq))
}

export function iterPeriodsPure(
  start: Date,
  end: Date,
  freq: string,
  anchorMonth: number | null,
  /**
   * Hela perioden måste rymmas före end. Gäller avtalets eget slutdatum.
   * När end är en rullande horisont (avtalet förlängs period för period)
   * räcker det att perioden BÖRJAR före horisonten: annars syns nästa
   * årsperiod bara i ett smalt fönster strax innan den börjar.
   */
  requireFullPeriod = true
): Array<{ periodStart: Date; periodEnd: Date }> {
  const out: Array<{ periodStart: Date; periodEnd: Date }> = []

  if (freq === 'monthly') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      out.push({ periodStart: new Date(cur), periodEnd: new Date(cur.getFullYear(), cur.getMonth() + 1, 0) })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else if (freq === 'quarterly') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      out.push({ periodStart: new Date(cur), periodEnd: new Date(cur.getFullYear(), cur.getMonth() + 3, 0) })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1)
    }
  } else if (freq === 'semi_annual') {
    // Halvårsvis räknas från avtalets startmånad; hela sexmånadersperioden
    // måste rymmas inom avtalet.
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur < end) {
      const fiveAhead = new Date(cur.getFullYear(), cur.getMonth() + 5, 1)
      if (requireFullPeriod && fiveAhead > end) break
      out.push({ periodStart: new Date(cur), periodEnd: new Date(cur.getFullYear(), cur.getMonth() + 6, 0) })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 6, 1)
    }
  } else if (freq === 'annual') {
    const anchor = anchorMonth && anchorMonth >= 1 && anchorMonth <= 12 ? anchorMonth - 1 : start.getMonth()
    const startYear = start.getFullYear()
    const startOfStartMonth = new Date(startYear, start.getMonth(), 1)
    let firstStart = new Date(startYear, anchor, 1)
    if (firstStart < startOfStartMonth) firstStart = new Date(startYear + 1, anchor, 1)
    let cur = firstStart
    // < inte <=: en period som börjar exakt på slutdatumet ligger efter avtalstiden.
    while (cur < end) {
      const elevenAhead = new Date(cur.getFullYear(), cur.getMonth() + 11, 1)
      if (requireFullPeriod && elevenAhead > end) break
      out.push({ periodStart: new Date(cur), periodEnd: new Date(cur.getFullYear() + 1, cur.getMonth(), 0) })
      cur = new Date(cur.getFullYear() + 1, cur.getMonth(), 1)
    }
  }

  return out
}

/** Årsvärdet som gäller ett visst datum enligt trappan, annars avtalets annual_value. */
export function annualValueInForce(
  contract: Pick<PlanningContract, 'annual_value'>,
  steps: PremiumStep[] | undefined,
  dateIso: string
): number {
  const fallback = Number(contract.annual_value ?? 0)
  if (!steps || steps.length === 0) return fallback
  const applicable = steps
    .filter((s) => s.effective_from <= dateIso)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  if (applicable.length === 0) {
    // Perioden ligger före första steget: första steget är avtalets start
    const first = [...steps].sort((a, b) => a.effective_from.localeCompare(b.effective_from))[0]
    return Number(first.annual_value) || fallback
  }
  return Number(applicable[applicable.length - 1].annual_value) || fallback
}

/**
 * Årsvärdet för en period i exakt läge (datasteg 18, STRUL 2). Regeln: ett
 * indexsteg (event_type 'indexation') som börjar inom perioden och högst
 * SNAP_MAX_DAYS dagar efter periodstart, i en halvårs- eller årsperiod,
 * gäller från periodens start. Indexeringen hör till avtalsåret; steget
 * daterades den 1:a efter gamla läget (AngelRekt: indexsteget 2026-03-01,
 * avtalsdagen 15 februari). Samma gräns som snapsToPeriodStart för § 6-rader.
 * Andra steg (start, tillägg, justering) gäller som förut från sitt datum.
 * Gamla läget använder annualValueInForce oförändrad.
 */
export function annualValueForExactPeriod(
  contract: Pick<PlanningContract, 'annual_value'>,
  steps: PremiumStep[] | undefined,
  periodStartIso: string,
  periodEndIso: string
): number {
  if (!steps || steps.length === 0) return annualValueInForce(contract, steps, periodStartIso)
  const adjusted = steps.map((s) =>
    s.event_type === 'indexation' && snapsToPeriodStart(s.effective_from, periodStartIso, periodEndIso)
      ? { ...s, effective_from: periodStartIso }
      : s
  )
  return annualValueInForce(contract, adjusted, periodStartIso)
}

/**
 * Ren funktion: alla fakturaperioder för ett avtal med belopp per period.
 * Används av webben (planering, förhandsvisning, tillägg) och cronen.
 */
export function computePlannedPeriods(contract: PlanningContract, opts: PlanOptions = {}): PlannedPeriod[] {
  const freq = (contract.billing_frequency ?? null) as string | null
  const start = contract.contract_start_date ? parseLocalDate(contract.contract_start_date) : null
  const declaredEnd = contract.contract_end_date ? parseLocalDate(contract.contract_end_date) : null
  const todayIso = opts.today ?? toLocalIsoDate(todayLocal())
  // Bindningsfönstret går före den fria horisonten. null (uppsagt avtal) =
  // planera som utan horisont.
  const win = opts.window === 'binding' ? bindingWindow(contract, todayIso) : null
  const horizonIso = opts.window === 'binding' ? undefined : opts.horizonEnd
  // Uppsagt avtal i bindningsläget: planera till uppsägningens slutdatum, inte
  // till det ursprungliga slutdatumet (som för ett rullande avtal kan ha
  // passerat för länge sedan). Kunden betalar till och med slutdatumet.
  const terminationEnd = opts.window === 'binding' && !win ? computeTerminationCutoff(contract) : null
  const end = win
    ? parseLocalDate(win.planEnd)
    : terminationEnd
      ? terminationEnd
      : horizonIso
      ? declaredEnd && declaredEnd > parseLocalDate(horizonIso)
        ? declaredEnd
        : parseLocalDate(horizonIso)
      : declaredEnd

  if (!freq || freq === 'on_demand') return []
  if (!start || !end) return []
  if (contract.billing_active === false) return []

  const baseAnnual = Number(contract.annual_value ?? 0)
  const hasSteps = !!opts.steps && opts.steps.length > 0
  // Bara per år-rader hör hemma i avtalets perioder; per månad har egna
  // månadsperioder (computePlannedMonthlyEquipmentPeriods).
  const yearlyLines = (opts.equipment ?? []).filter((e) => (e.billing_model ?? 'per_year') === 'per_year')
  const onPremium = opts.equipmentMode !== 'separate'
  const hasEquipment = onPremium && yearlyLines.length > 0
  if (baseAnnual <= 0 && !hasSteps && !hasEquipment) return []

  let effectiveEnd = end
  const cutoff = computeTerminationCutoff(contract)
  if (cutoff && cutoff < effectiveEnd) effectiveEnd = cutoff

  // Slutet är en rullande horisont (inte avtalets eget slutdatum eller en
  // uppsägning): då får perioden börja före horisonten utan att rymmas helt.
  const endIsHorizon = !win && !cutoff && !!horizonIso && (!declaredEnd || declaredEnd < effectiveEnd)
  const exactMode = isStartDayMode(contract)
  const exactStep = exactMode ? periodStepMonths(freq) : null
  let intervals: Array<{ periodStart: Date; periodEnd: Date }>
  if (win) {
    // Bindningstid: en period hör till den bindningsperiod där största delen
    // av den ligger (mittpunkten). Perioderna är månadsankrade (1 okt) medan
    // avtalet slutar t.ex. den 14:e: perioden 1 okt till 30 sep efter ett
    // slutdatum 14 okt är nästa års, inte årets. Tills vidare: perioder som
    // börjar före fönstrets slut.
    // Exakt avtalsdag: samma fönster och mittpunkt, perioderna räknas från
    // startdagen (contractPeriods.ts).
    const raw = exactMode
      ? exactPeriods(contract.contract_start_date as string, effectiveEnd, effectiveEnd, periodStepMonths(freq), false)
      : iterPeriodsPure(start, effectiveEnd, freq, contract.billing_anchor_month, false)
    intervals = win.openEnded ? raw : raw.filter((r) => periodBeforeLimit(r.periodStart, r.periodEnd, effectiveEnd, exactStep))
  } else {
    intervals = exactMode
      ? exactPeriods(contract.contract_start_date as string, effectiveEnd, effectiveEnd, periodStepMonths(freq), !endIsHorizon)
      : iterPeriodsPure(start, effectiveEnd, freq, contract.billing_anchor_month, !endIsHorizon)
  }
  const currentEndDate = win?.currentEnd ? parseLocalDate(win.currentEnd) : null
  const isRenewal = (periodStart: Date, periodEnd: Date): boolean => {
    if (win) {
      if (win.openEnded) return toLocalIsoDate(periodStart) > todayIso
      return win.renewalDue && !!currentEndDate && !periodBeforeLimit(periodStart, periodEnd, currentEndDate, exactStep)
    }
    return endIsHorizon && !!declaredEnd && periodStart >= declaredEnd
  }
  const today = parseLocalDate(todayIso)
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const paymentTermsDays = opts.paymentTermsDays ?? 30
  const leadDays = opts.leadDays ?? DEFAULT_INVOICE_LEAD_DAYS
  const divisor = periodDivisor(freq)

  return intervals.map(({ periodStart, periodEnd }, idx) => {
    const periodStartIso = toLocalIsoDate(periodStart)
    const periodEndIso = toLocalIsoDate(periodEnd)
    const annual = exactMode
      ? annualValueForExactPeriod(contract, opts.steps, periodStartIso, periodEndIso)
      : annualValueInForce(contract, opts.steps, periodStartIso)
    const amount = amountPerPeriodPure(annual, freq)

    const equipmentRows: PlannedEquipmentRow[] = (onPremium ? yearlyLines : [])
      .filter(
        (e) =>
          e.quantity > 0 &&
          e.unit_price_annual > 0 &&
          (!e.billing_start_date ||
            e.billing_start_date <= periodStartIso ||
            (exactMode && snapsToPeriodStart(e.billing_start_date, periodStartIso, periodEndIso)))
      )
      .map((e) => {
        const unit = Math.round((e.unit_price_annual * 100) / divisor) / 100
        const row: PlannedEquipmentRow = {
          source_id: e.id,
          contract_id: e.contract_id ?? null,
          name: e.name,
          code: e.code,
          quantity: e.quantity,
          unit_price: unit,
          total_price: Math.round(unit * e.quantity * 100) / 100,
          vat_rate: e.vat_rate,
        }
        if (e.billing_start_date && e.billing_start_date > periodStartIso) row.billing_start_snapped = e.billing_start_date
        return row
      })

    const equipmentSubtotal = equipmentRows.reduce((s, r) => s + r.total_price, 0)
    const subtotal = Math.round((amount + equipmentSubtotal) * 100) / 100
    const vatAmount =
      Math.round(
        (amount * 0.25 + equipmentRows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0)) * 100
      ) / 100

    const isHistorical = periodStart < startOfCurrentMonth
    // Fakturadatum: ledtiden före periodstart, men aldrig bakåt i tiden.
    let invoiceDate = addDays(periodStart, -leadDays)
    if (invoiceDate < today) invoiceDate = today
    if (isHistorical) invoiceDate = new Date(periodStart.getTime())
    const due = addDays(invoiceDate, paymentTermsDays)

    return {
      kind: 'premium' as const,
      renewal: isRenewal(periodStart, periodEnd),
      periodStart: periodStartIso,
      periodEnd: toLocalIsoDate(periodEnd),
      amount,
      annualInForce: annual,
      equipmentRows,
      subtotal,
      vatAmount,
      totalAmount: Math.round((subtotal + vatAmount) * 100) / 100,
      invoiceDate: toLocalIsoDate(invoiceDate),
      dueDate: toLocalIsoDate(due),
      isHistorical,
      sequenceNumber: idx + 1,
      totalSequenceCount: intervals.length,
    }
  })
}

/**
 * Egna fakturor (kind equipment) för § 5 per år-rader: samma perioder som
 * premien, bara utrustningsraderna. Används när avtalet fakturerar
 * utrustning separat (equipment_invoice_mode = separate).
 */
export function computePlannedEquipmentPeriods(contract: PlanningContract, opts: PlanOptions = {}): PlannedPeriod[] {
  const yearly = (opts.equipment ?? []).filter((e) => (e.billing_model ?? 'per_year') === 'per_year')
  if (yearly.length === 0) return []
  const base = computePlannedPeriods(contract, { ...opts, equipment: yearly, equipmentMode: 'with_premium' })
  return base
    .filter((p) => p.equipmentRows.length > 0)
    .map((p) => {
      const subtotal = Math.round(p.equipmentRows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
      const vatAmount = Math.round(p.equipmentRows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100
      return {
        ...p,
        kind: 'equipment' as const,
        amount: 0,
        subtotal,
        vatAmount,
        totalAmount: Math.round((subtotal + vatAmount) * 100) / 100,
      }
    })
}

/**
 * Egna månadsfakturor (kind equipment_monthly) för § 5 per månad-rader.
 * Perioder = kalendermånader från och med innevarande månad (aldrig bakåt:
 * inga krediteringar, inga efterdebiteringar) fram till horisonten eller
 * uppsägningens kapningsdatum. Fakturadatum = månadens första dag.
 */
export function computePlannedMonthlyEquipmentPeriods(contract: PlanningContract, opts: PlanOptions = {}): PlannedPeriod[] {
  const monthly = (opts.equipment ?? []).filter(
    (e) => e.billing_model === 'per_month' && e.quantity > 0 && (e.unit_price_month ?? 0) > 0
  )
  if (monthly.length === 0) return []
  if (contract.billing_active === false) return []

  const today = opts.today ? parseLocalDate(opts.today) : todayLocal()
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const earliestStart = monthly
    .map((e) => e.billing_start_date)
    .filter((d): d is string => !!d)
    .sort()[0]
  // Exakt avtalsdag: månadsperioder från avtalsdagen, första perioden den
  // som innehåller max(idag, tidigaste billing_start_date).
  const exactStart = isStartDayMode(contract) ? (contract.contract_start_date as string) : null
  let exactK = 0
  let cur = startOfCurrentMonth
  if (exactStart) {
    const todayIsoFirst = toLocalIsoDate(today)
    const firstDay = earliestStart && earliestStart > todayIsoFirst ? earliestStart : todayIsoFirst
    exactK = exactPeriodIndexContaining(exactStart, 1, firstDay)
    cur = parseLocalDate(addMonthsClampedIso(exactStart, exactK))
  } else if (earliestStart) {
    const es = parseLocalDate(earliestStart)
    const esMonth = new Date(es.getFullYear(), es.getMonth(), 1)
    if (esMonth > cur) cur = esMonth
  }
  // Bindningsfönstret som för premien; uppsagda avtal (inget fönster) som förut
  const win = opts.window === 'binding' ? bindingWindow(contract, toLocalIsoDate(today)) : null
  const horizon = win
    ? parseLocalDate(win.planEnd)
    : opts.horizonEnd && opts.window !== 'binding'
      ? parseLocalDate(opts.horizonEnd)
      : new Date(today.getFullYear() + 1, today.getMonth(), 1)
  const todayIsoEq = toLocalIsoDate(today)
  const currentEndDate = win?.currentEnd ? parseLocalDate(win.currentEnd) : null
  let end = horizon
  const cutoff = computeTerminationCutoff(contract)
  if (cutoff && cutoff < end) end = cutoff
  const paymentTermsDays = opts.paymentTermsDays ?? 30

  const out: PlannedPeriod[] = []
  let idx = 0
  while (cur <= end) {
    const periodStartIso = toLocalIsoDate(cur)
    const periodEnd = exactStart
      ? addDays(parseLocalDate(addMonthsClampedIso(exactStart, exactK + 1)), -1)
      : new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    // Bindningstid: månaden hör dit största delen av den ligger, som premien
    if (win && !win.openEnded && !periodBeforeLimit(cur, periodEnd, end, exactStart ? 1 : null)) break
    const rows: PlannedEquipmentRow[] = monthly
      .filter((e) => !e.billing_start_date || e.billing_start_date <= periodStartIso)
      .map((e) => {
        const unit = Math.round((e.unit_price_month ?? 0) * 100) / 100
        return {
          source_id: e.id,
          contract_id: e.contract_id ?? null,
          name: e.name,
          code: e.code,
          quantity: e.quantity,
          unit_price: unit,
          total_price: Math.round(unit * e.quantity * 100) / 100,
          vat_rate: e.vat_rate,
        }
      })
    if (rows.length > 0) {
      const subtotal = Math.round(rows.reduce((s, r) => s + r.total_price, 0) * 100) / 100
      const vatAmount = Math.round(rows.reduce((s, r) => s + (r.total_price * r.vat_rate) / 100, 0) * 100) / 100
      let invoiceDate = new Date(cur.getTime())
      if (invoiceDate < today) invoiceDate = today
      idx += 1
      out.push({
        kind: 'equipment_monthly',
        periodStart: periodStartIso,
        periodEnd: toLocalIsoDate(periodEnd),
        amount: 0,
        annualInForce: 0,
        equipmentRows: rows,
        subtotal,
        vatAmount,
        totalAmount: Math.round((subtotal + vatAmount) * 100) / 100,
        invoiceDate: toLocalIsoDate(invoiceDate),
        dueDate: toLocalIsoDate(addDays(invoiceDate, paymentTermsDays)),
        isHistorical: false,
        sequenceNumber: idx,
        totalSequenceCount: 0,
        // Tills vidare: månader som inte börjat; bindningstid: månader i nästa
        // bindningsperiod (mittpunkten efter nuvarande slut)
        renewal: win
          ? win.openEnded
            ? periodStartIso > todayIsoEq
            : win.renewalDue && !!currentEndDate && !periodBeforeLimit(cur, periodEnd, currentEndDate, exactStart ? 1 : null)
          : false,
      })
    }
    if (exactStart) {
      exactK += 1
      cur = parseLocalDate(addMonthsClampedIso(exactStart, exactK))
    } else {
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  }
  for (const p of out) p.totalSequenceCount = out.length
  return out
}

/**
 * 12 månader framåt från idag. Styr inte längre vad som planeras (det gör
 * bindingWindow); cronen använder den bara för att gallra vilka avtal som
 * kan ha en förlängning nära.
 */
export function rollingHorizonEnd(today: Date = todayLocal()): string {
  return toLocalIsoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))
}
