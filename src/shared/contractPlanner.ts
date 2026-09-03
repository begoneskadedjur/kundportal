// src/shared/contractPlanner.ts
// Periodmatematiken för årspremiefakturor, delad av webben
// (contractInvoiceGenerator) och cron-jobbet (generate-continuing-contracts).
// Inga DB-anrop, inga importer från src/lib: modulen ska kunna köras i Node
// utan Vite-miljö.
//
// Avtalet är källan: beloppet per period kommer ur premietrappan
// (contract_premium_events) och faller tillbaka på annual_value när trappan
// saknar steg. Utrustning "per styck och år" (§ 6) blir egna rader på samma
// faktura, skalade per period precis som premien.

export type BillingFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand'

/**
 * Fakturatyp för avtalsfakturor. premium = årspremien (med § 6 per år-rader
 * när avtalet fakturerar utrustning på premiefakturan), equipment = egna
 * fakturor för § 6 per år-rader, equipment_monthly = egna månadsfakturor för
 * § 6 per månad-rader. Diffen mot befintliga fakturor görs alltid per typ.
 */
export type ContractInvoiceKind = 'premium' | 'equipment' | 'equipment_monthly'

/** Var § 6 per år-rader hamnar: på premiefakturan eller på egna fakturor. */
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
}

/** Ett steg i premietrappan: årsvärdet som gäller från och med datumet. */
export interface PremiumStep {
  effective_from: string
  annual_value: number | string
}

/**
 * § 6-rad med faktureringsläge per år eller per månad.
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
   * Horisont bortom avtalets slutdatum: rullande avtal fortsätter efter
   * contract_end_date tills de sägs upp, så planeringen får en horisont
   * (t.ex. 12 månader framåt) i stället för att stanna vid slutdatumet.
   */
  horizonEnd?: string
  /** Var § 6 per år-rader hamnar (default with_premium = på premiefakturan) */
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
 * - Inom bindningstid (terminated_at <= contract_end_date): avtalet löper till contract_end_date.
 * - Fortlöpande (terminated_at > contract_end_date): terminated_at + notice_period_months.
 * Null när avtalet inte är uppsagt.
 */
export function computeTerminationCutoff(c: PlanningContract): Date | null {
  if (!c.terminated_at) return null
  const notice = c.notice_period_months ?? 2
  const termDate = new Date(c.terminated_at)
  const contractEnd = c.contract_end_date ? parseLocalDate(c.contract_end_date) : null
  if (contractEnd && termDate <= contractEnd) return contractEnd
  const cutoff = new Date(termDate)
  cutoff.setMonth(cutoff.getMonth() + notice)
  return cutoff
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
  anchorMonth: number | null
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
      if (fiveAhead > end) break
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
      if (elevenAhead > end) break
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
 * Ren funktion: alla fakturaperioder för ett avtal med belopp per period.
 * Används av webben (planering, förhandsvisning, tillägg) och cronen.
 */
export function computePlannedPeriods(contract: PlanningContract, opts: PlanOptions = {}): PlannedPeriod[] {
  const freq = (contract.billing_frequency ?? null) as string | null
  const start = contract.contract_start_date ? parseLocalDate(contract.contract_start_date) : null
  const declaredEnd = contract.contract_end_date ? parseLocalDate(contract.contract_end_date) : null
  const end = opts.horizonEnd
    ? declaredEnd && declaredEnd > parseLocalDate(opts.horizonEnd)
      ? declaredEnd
      : parseLocalDate(opts.horizonEnd)
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

  const intervals = iterPeriodsPure(start, effectiveEnd, freq, contract.billing_anchor_month)
  const today = opts.today ? parseLocalDate(opts.today) : todayLocal()
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const paymentTermsDays = opts.paymentTermsDays ?? 30
  const leadDays = opts.leadDays ?? DEFAULT_INVOICE_LEAD_DAYS
  const divisor = periodDivisor(freq)

  return intervals.map(({ periodStart, periodEnd }, idx) => {
    const periodStartIso = toLocalIsoDate(periodStart)
    const annual = annualValueInForce(contract, opts.steps, periodStartIso)
    const amount = amountPerPeriodPure(annual, freq)

    const equipmentRows: PlannedEquipmentRow[] = (onPremium ? yearlyLines : [])
      .filter((e) => e.quantity > 0 && e.unit_price_annual > 0 && (!e.billing_start_date || e.billing_start_date <= periodStartIso))
      .map((e) => {
        const unit = Math.round((e.unit_price_annual * 100) / divisor) / 100
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
 * Egna fakturor (kind equipment) för § 6 per år-rader: samma perioder som
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
 * Egna månadsfakturor (kind equipment_monthly) för § 6 per månad-rader.
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
  let cur = startOfCurrentMonth
  if (earliestStart) {
    const es = parseLocalDate(earliestStart)
    const esMonth = new Date(es.getFullYear(), es.getMonth(), 1)
    if (esMonth > cur) cur = esMonth
  }
  const horizon = opts.horizonEnd ? parseLocalDate(opts.horizonEnd) : new Date(today.getFullYear() + 1, today.getMonth(), 1)
  let end = horizon
  const cutoff = computeTerminationCutoff(contract)
  if (cutoff && cutoff < end) end = cutoff
  const paymentTermsDays = opts.paymentTermsDays ?? 30

  const out: PlannedPeriod[] = []
  let idx = 0
  while (cur <= end) {
    const periodStartIso = toLocalIsoDate(cur)
    const periodEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
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
      })
    }
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  for (const p of out) p.totalSequenceCount = out.length
  return out
}

/** Horisont för rullande avtal: 12 månader framåt från idag. */
export function rollingHorizonEnd(today: Date = todayLocal()): string {
  return toLocalIsoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))
}
