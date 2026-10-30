// src/shared/contractReview.ts
// Kontrollerat avtal (2026-10-28).
//
// Ett avtal som gåtts igenom mot det signerade avtalet och Fortnox markeras som
// kontrollerat. Vid markeringen sparas en ögonblicksbild (contracts.review_snapshot)
// av fälten som avgör om avtalsfakturan blir rätt. Avviker avtalet senare från
// bilden blir märkningen "Ändrat efter kontroll" och ändringarna listas.
// Ingenting spärras; märkningen är en hjälp för den som godkänner fakturan.
//
// Ren logik utan React och Supabase. Delas av webben (contractReviewService)
// och skriptet som markerar avtal i efterhand.

export const REVIEW_SNAPSHOT_VERSION = 1

export type ReviewStateKind = 'ok' | 'andrad' | 'ej'

export interface ReviewPremiumEvent {
  event_type: string
  annual_value: number | null
  effective_from: string
}

/** Fälten som avgör fakturans riktighet, normaliserade för jämförelse. */
export interface ReviewSnapshot {
  v: number
  annual_value: number | null
  premium_events: ReviewPremiumEvent[]
  billing_frequency: string | null
  billing_anchor_month: number | null
  contract_start_date: string | null
  contract_length: string | null
  /** Fortnox-kundnumret som text */
  customer_number: string | null
  /** Bara siffror */
  organization_number: string | null
  contract_type: string | null
  display_name: string | null
  /**
   * Avtalsåret: 'start_day' = följer avtalsdagen, null = börjar den 1:a.
   * Saknas i bilder sparade före 3.113.0 och läses då som null.
   */
  billing_anchor_mode?: string | null
  /** Tilläggsreglerna: 'v2' = följer premien, null = som tidigare */
  addon_rules?: string | null
}

type Num = number | string | null | undefined

export interface ReviewInput {
  contract: {
    annual_value?: Num
    billing_frequency?: string | null
    billing_anchor_month?: Num
    contract_start_date?: string | null
    start_date?: string | null
    contract_length?: string | null
    contract_type?: string | null
    display_name?: string | null
    billing_anchor_mode?: string | null
    addon_rules?: string | null
  }
  premiumEvents?: ReadonlyArray<{ event_type: string; annual_value: Num; effective_from: string }> | null
  customer?: { customer_number?: Num; organization_number?: string | null } | null
}

export interface ReviewStateResult {
  state: ReviewStateKind
  /** Läsbara svenska rader, tom utom i läget 'andrad' */
  changes: string[]
}

// ---------------------------------------------------------------------------
// Format

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const FREQUENCY_LABEL: Record<string, string> = {
  annual: 'årsvis',
  semi_annual: 'halvårsvis',
  quarterly: 'kvartalsvis',
  monthly: 'månadsvis',
  on_demand: 'vid behov',
}

const EVENT_LABEL: Record<string, string> = {
  start: 'Start',
  step_up: 'Upptrappning',
  indexation: 'Indexering',
  addition: 'Avtalstillägg',
  adjustment: 'Justering',
  termination: 'Avslut',
}

/** 27798 -> "27 798 kr" (vanliga mellanslag, så att texten går att söka och testa). */
export function formatReviewKr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'ingen premie'
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '-' : ''
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}${digits} kr`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Tidsstämpel -> ÅÅÅÅ-MM-DD i lokal tid (aldrig UTC-datumet ur strängen). */
export function reviewDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Tidsstämpel -> "28 okt" för kompakta listor. */
export function reviewShortDate(iso: string | null | undefined): string | null {
  const key = reviewDateKey(iso)
  if (!key) return null
  const m = Number(key.slice(5, 7))
  const d = Number(key.slice(8, 10))
  return `${d} ${MONTHS_SHORT[m - 1] ?? ''}`.trim()
}

function todayLocalKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function lengthLabel(v: string | null): string {
  if (!v) return 'ej angiven'
  return /^\d+$/.test(v) ? `${v} år` : v
}

/** "2026-06-30" -> "30 juni" */
export function anchorDayText(startIso: string): string {
  const m = Number(startIso.slice(5, 7))
  const d = Number(startIso.slice(8, 10))
  return `${d} ${MONTHS[m - 1] ?? ''}`.trim()
}

/**
 * Avtalsårets första och sista dag som text: start 2026-06-30 ger
 * "30 juni till 29 juni", start 2026-01-01 ger "1 januari till 31 december".
 * Klampning som periodregeln: start 2024-02-29 ger "29 februari till 27 februari".
 */
export function anchorDayRangeText(startIso: string): string {
  const [y, m, d] = startIso.slice(0, 10).split('-').map(Number)
  const last = new Date(y + 1, m, 0).getDate()
  const end = new Date(y + 1, m - 1, Math.min(d, last) - 1)
  return `${d} ${MONTHS[m - 1]} till ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

function monthLabel(m: number | null): string {
  return m && m >= 1 && m <= 12 ? MONTHS[m - 1] : 'avtalsstarten'
}

// ---------------------------------------------------------------------------
// Ögonblicksbild

function num(v: Num): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function text(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t ? t : null
}

function dateText(v: string | null | undefined): string | null {
  const t = text(v)
  return t ? t.slice(0, 10) : null
}

export function buildReviewSnapshot(input: ReviewInput): ReviewSnapshot {
  const c = input.contract
  const events = (input.premiumEvents ?? [])
    .map((e) => ({
      event_type: String(e.event_type),
      annual_value: num(e.annual_value),
      effective_from: dateText(e.effective_from) ?? '',
    }))
    .sort(
      (a, b) =>
        a.effective_from.localeCompare(b.effective_from) ||
        a.event_type.localeCompare(b.event_type) ||
        (a.annual_value ?? 0) - (b.annual_value ?? 0)
    )
  const customerNumber = input.customer?.customer_number
  const org = text(input.customer?.organization_number ?? null)
  const anchor = num(c.billing_anchor_month)
  return {
    v: REVIEW_SNAPSHOT_VERSION,
    annual_value: num(c.annual_value),
    premium_events: events,
    billing_frequency: text(c.billing_frequency ?? null),
    billing_anchor_month: anchor == null ? null : Math.round(anchor),
    contract_start_date: dateText(c.contract_start_date ?? null) ?? dateText(c.start_date ?? null),
    contract_length: text(c.contract_length ?? null),
    customer_number: customerNumber == null || customerNumber === '' ? null : String(customerNumber).trim(),
    organization_number: org ? org.replace(/\D/g, '') || null : null,
    contract_type: text(c.contract_type ?? null),
    display_name: text(c.display_name ?? null),
    billing_anchor_mode: text(c.billing_anchor_mode ?? null),
    addon_rules: text(c.addon_rules ?? null),
  }
}

/** Läs en lagrad bild (jsonb) defensivt. Ogiltig eller saknad bild -> null. */
export function parseReviewSnapshot(raw: unknown): ReviewSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.v !== 'number') return null
  const events = Array.isArray(r.premium_events) ? r.premium_events : []
  return {
    v: r.v,
    annual_value: num(r.annual_value as Num),
    premium_events: events
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e) => ({
        event_type: String(e.event_type ?? ''),
        annual_value: num(e.annual_value as Num),
        effective_from: String(e.effective_from ?? ''),
      })),
    billing_frequency: (r.billing_frequency as string | null) ?? null,
    billing_anchor_month: num(r.billing_anchor_month as Num),
    contract_start_date: (r.contract_start_date as string | null) ?? null,
    contract_length: (r.contract_length as string | null) ?? null,
    customer_number: r.customer_number == null ? null : String(r.customer_number),
    organization_number: (r.organization_number as string | null) ?? null,
    contract_type: (r.contract_type as string | null) ?? null,
    display_name: (r.display_name as string | null) ?? null,
    billing_anchor_mode: (r.billing_anchor_mode as string | null) ?? null,
    addon_rules: (r.addon_rules as string | null) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Läget

const eventKey = (e: ReviewPremiumEvent) => `${e.event_type}|${e.effective_from}`

function premiumEventChanges(before: ReviewSnapshot, after: ReviewSnapshot): string[] {
  const out: string[] = []
  const prev = new Map<string, ReviewPremiumEvent[]>()
  for (const e of before.premium_events) {
    const list = prev.get(eventKey(e)) ?? []
    list.push(e)
    prev.set(eventKey(e), list)
  }
  const annualChanged = before.annual_value !== after.annual_value
  for (const e of after.premium_events) {
    const list = prev.get(eventKey(e))
    const label = EVENT_LABEL[e.event_type] ?? e.event_type
    if (list && list.length > 0) {
      const same = list.findIndex((p) => p.annual_value === e.annual_value)
      if (same >= 0) {
        list.splice(same, 1)
        continue
      }
      const old = list.shift() as ReviewPremiumEvent
      // Startsteget följer årspremien: samma ändring står redan som premieraden
      if (
        e.event_type === 'start' &&
        annualChanged &&
        old.annual_value === before.annual_value &&
        e.annual_value === after.annual_value
      ) {
        continue
      }
      out.push(`${label} från ${e.effective_from} ändrades från ${formatReviewKr(old.annual_value)} till ${formatReviewKr(e.annual_value)}`)
      continue
    }
    out.push(`${label} från ${e.effective_from} lades till, premien blir ${formatReviewKr(e.annual_value)}`)
  }
  for (const list of prev.values()) {
    for (const e of list) {
      out.push(`${EVENT_LABEL[e.event_type] ?? e.event_type} från ${e.effective_from} togs bort (${formatReviewKr(e.annual_value)})`)
    }
  }
  return out
}

/** Jämför bilden vid kontrollen med nuläget. Utan bild: 'ej'. */
export function reviewState(snapshot: ReviewSnapshot | null | undefined, current: ReviewSnapshot): ReviewStateResult {
  if (!snapshot) return { state: 'ej', changes: [] }
  const s = snapshot
  const c = current
  const changes: string[] = []

  if (s.annual_value !== c.annual_value) {
    if (s.annual_value == null) changes.push(`Premien sattes till ${formatReviewKr(c.annual_value)}`)
    else if (c.annual_value == null) changes.push(`Premien togs bort (var ${formatReviewKr(s.annual_value)})`)
    else changes.push(`Premien ändrades från ${formatReviewKr(s.annual_value)} till ${formatReviewKr(c.annual_value)}`)
  }
  changes.push(...premiumEventChanges(s, c))
  if ((s.billing_frequency ?? null) !== (c.billing_frequency ?? null)) {
    const from = s.billing_frequency ? FREQUENCY_LABEL[s.billing_frequency] ?? s.billing_frequency : 'ej angiven'
    const to = c.billing_frequency ? FREQUENCY_LABEL[c.billing_frequency] ?? c.billing_frequency : 'ej angiven'
    changes.push(`Faktureringen ändrades från ${from} till ${to}`)
  }
  if ((s.billing_anchor_month ?? null) !== (c.billing_anchor_month ?? null)) {
    changes.push(`Faktureringsmånaden ändrades från ${monthLabel(s.billing_anchor_month)} till ${monthLabel(c.billing_anchor_month)}`)
  }
  if ((s.contract_start_date ?? null) !== (c.contract_start_date ?? null)) {
    changes.push(`Avtalsstarten ändrades från ${s.contract_start_date ?? 'ej angiven'} till ${c.contract_start_date ?? 'ej angiven'}`)
  }
  if ((s.contract_length ?? null) !== (c.contract_length ?? null)) {
    changes.push(`Avtalstiden ändrades från ${lengthLabel(s.contract_length)} till ${lengthLabel(c.contract_length)}`)
  }
  if ((s.customer_number ?? null) !== (c.customer_number ?? null)) {
    changes.push(
      s.customer_number && c.customer_number
        ? `Kundnumret ändrades från ${s.customer_number} till ${c.customer_number}`
        : c.customer_number
          ? `Kundnumret sattes till ${c.customer_number}`
          : 'Kundnumret togs bort'
    )
  }
  if ((s.organization_number ?? null) !== (c.organization_number ?? null)) {
    changes.push('Org.nr ändrades')
  }
  if ((s.contract_type ?? null) !== (c.contract_type ?? null)) {
    changes.push(`Avtalstypen ändrades från ${s.contract_type ?? 'ingen'} till ${c.contract_type ?? 'ingen'}`)
  }
  if ((s.display_name ?? null) !== (c.display_name ?? null)) {
    changes.push('Avtalets namn ändrades')
  }
  if ((s.billing_anchor_mode ?? null) !== (c.billing_anchor_mode ?? null)) {
    changes.push(
      c.billing_anchor_mode === 'start_day'
        ? 'Avtalsåret ändrades till avtalsdagen'
        : 'Avtalsåret ändrades till att börja den 1:a'
    )
  }
  if ((s.addon_rules ?? null) !== (c.addon_rules ?? null)) {
    changes.push(
      c.addon_rules === 'v2'
        ? 'Tilläggsreglerna ändrades till att följa premien'
        : 'Tilläggsreglerna ändrades tillbaka till som tidigare'
    )
  }

  return changes.length > 0 ? { state: 'andrad', changes } : { state: 'ok', changes: [] }
}

/**
 * Sammanvägt läge för en faktura med ett eller flera avtal (samlad faktura):
 * något 'andrad' -> 'andrad', alla 'ok' -> 'ok', annars 'ej'.
 */
export function combineReviewStates(states: ReadonlyArray<ReviewStateKind>): ReviewStateKind {
  if (states.length === 0) return 'ej'
  if (states.includes('andrad')) return 'andrad'
  return states.every((s) => s === 'ok') ? 'ok' : 'ej'
}

// ---------------------------------------------------------------------------
// Checklistan (tooltip och ruta i fakturan)

/** Premien som gäller idag enligt bilden: senaste trappsteg som börjat, annars annual_value. */
export function snapshotPremiumInForce(s: ReviewSnapshot, today: string = todayLocalKey()): number | null {
  const past = s.premium_events.filter((e) => e.effective_from && e.effective_from <= today && e.annual_value != null)
  const last = past[past.length - 1]
  return last ? last.annual_value : s.annual_value
}

/**
 * Raderna som visar vad kontrollen omfattar.
 * kort = tooltipen i listan, lang = rutan i fakturan.
 */
export function reviewChecklist(
  s: ReviewSnapshot,
  opts: { variant?: 'kort' | 'lang'; oneflowId?: string | null; today?: string } = {}
): string[] {
  const lang = opts.variant === 'lang'
  const premium = snapshotPremiumInForce(s, opts.today)
  const oneflow = lang && opts.oneflowId && /^\d+$/.test(opts.oneflowId) ? ` (Oneflow ${opts.oneflowId})` : ''
  const rows: string[] = []
  rows.push(premium != null ? `Premie ${formatReviewKr(premium)} enligt signerat avtal${oneflow}` : `Premien enligt signerat avtal${oneflow}`)
  rows.push(
    s.customer_number
      ? `Fortnox-kort ${s.customer_number} stämmer med namn och org.nr`
      : 'Fortnox-kortet stämmer med namn och org.nr'
  )
  if (lang && s.billing_anchor_mode === 'start_day' && s.contract_start_date) {
    rows.push(`Fakturaperioden följer avtalsdagen, ${anchorDayRangeText(s.contract_start_date)}`)
    rows.push('Ingen period är fakturerad tidigare')
  } else if (lang) {
    const startMonth = s.contract_start_date ? Number(s.contract_start_date.slice(5, 7)) : null
    const anchor = s.billing_anchor_month ?? startMonth
    if (anchor && anchor >= 1 && anchor <= 12) {
      const freq = s.billing_frequency ?? 'annual'
      rows.push(
        freq === 'annual'
          ? `Fakturaperioden följer avtalsåret, ${MONTHS[anchor - 1]} till ${MONTHS[(anchor + 10) % 12]}`
          : `Fakturaperioden följer avtalsåret, ${FREQUENCY_LABEL[freq] ?? freq} från ${MONTHS[anchor - 1]}`
      )
    } else {
      rows.push('Fakturaperioden följer avtalsåret')
    }
    rows.push('Ingen period är fakturerad tidigare')
  } else {
    rows.push('Perioden följer avtalsåret')
    rows.push('Ingen period fakturerad tidigare')
  }
  return rows
}
