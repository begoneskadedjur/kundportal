// src/shared/marginEngine.ts
// Enda stället marginal räknas. DB-fritt så att utkast i wizards och
// offerter kan använda samma beräkning som sparade rader.
//
// Bakgrund (docs/varaktig-utrustning-marginal-plan.md): fällor och stationer
// står kvar hos kunden i flera år, men alla vyer drog hela inköpet från ETT
// års intäkt och visade minus på bra affärer. Avtalen är rullande, så det
// finns ingen avtalsperiod att fördela över och ingen avskrivning byggs.
// I stället delas kostnaden i löpande (arbetstid, förbrukning) och varaktig
// (articles.is_durable), och avtal visar löpande marginal med utrustningen
// och återbetalningstiden bredvid. Ärenden är engångsjobb: där betalar
// fakturan för fällan, så år 1 förblir huvudtalet.

/** Avtal: löpande marginal är huvudtal. Ärende: år 1 är huvudtal. */
export type MarginContext = 'contract' | 'case'

/** Minsta rad motorn behöver. Matchar case_billing_items med article-relation. */
export interface MarginLine {
  item_type: 'service' | 'article'
  total_price: number | string | null
  quantity?: number | string | null
  article_name?: string | null
  status?: string | null
  article?: { is_durable?: boolean | null; category?: string | null } | null
}

export interface MarginSettings {
  min_margin_percent: number
  target_margin_percent: number
  max_payback_years?: number | null
}

export interface DurableLine {
  article_name: string
  quantity: number
  cost: number
}

export interface MarginBreakdown {
  context: MarginContext
  /** Tjänsterader exkl. moms, eller överstyrd årsintäkt på avtal */
  revenue: number
  /** Alla artikelrader: dagens "vår kostnad" */
  cost_total: number
  /** Artikelrader med articles.is_durable = true */
  cost_durable: number
  /** cost_total minus cost_durable: det som återkommer varje år */
  cost_ongoing: number
  /** Delmängd av cost_ongoing: articles.category = 'Arbetstid' */
  labour_cost: number
  labour_hours: number
  /**
   * Avtal med besök men mindre än en timme arbetstid per besök. Löpande
   * marginal är då exakt så bra som de saknade raderna, och ska inte visas
   * som en procentsiffra.
   */
  labour_missing: boolean
  consumable_cost: number
  /** (revenue - cost_total) / revenue: dagens siffra */
  margin_percent_year1: number | null
  /** (revenue - cost_ongoing) / revenue: huvudtal på avtal */
  margin_percent_ongoing: number | null
  /** revenue - cost_ongoing, kronor per år */
  contribution_ongoing: number
  /** cost_durable / contribution_ongoing. Null utan utrustning eller när den aldrig återbetalas. */
  payback_years: number | null
  /** Utrustning finns men täckningsbidraget är noll eller negativt */
  payback_never: boolean
  /**
   * Marginal över tre år: (3·revenue − 3·ongoing − durable) / (3·revenue).
   * Ett jämförelsetal mellan avtal med och utan utrustning, ingen bokföringsregel.
   */
  margin_percent_3y: number | null
  durable_count: number
  durable_lines: DurableLine[]
  /** Talet vyn ska lyfta fram: löpande på avtal, år 1 på ärenden */
  headline_percent: number | null
  headline_label: 'Löpande marginal' | 'Marginal'
}

export type MarginTone = 'good' | 'warn' | 'bad' | 'none'

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n as number) ? (n as number) : 0
}

export function isDurableLine(line: MarginLine): boolean {
  return line.item_type === 'article' && line.article?.is_durable === true
}

export function isLabourLine(line: MarginLine): boolean {
  return line.item_type === 'article' && line.article?.category === 'Arbetstid'
}

/** (försäljningspris − inköp) / försäljningspris · 100. Null när intäkt saknas. */
export function marginPercent(revenue: number, cost: number): number | null {
  if (revenue <= 0) return null
  return ((revenue - cost) / revenue) * 100
}

export interface SummarizeOptions {
  context: MarginContext
  settings?: MarginSettings | null
  /**
   * Avtal: årsintäkt från annual_value + tilläggsrader i stället för
   * radsumman (premieraden är ofta 0 kr eller avviker från avtalet).
   */
  revenueOverride?: number | null
  /** Avtal: planerade besök per år, för arbetstidsspärren */
  visitsPerYear?: number | null
}

export function summarizeBillingLines(lines: MarginLine[], opts: SummarizeOptions): MarginBreakdown {
  const active = lines.filter((l) => l.status !== 'cancelled')
  const services = active.filter((l) => l.item_type === 'service')
  const articles = active.filter((l) => l.item_type === 'article')

  const lineRevenue = services.reduce((s, l) => s + num(l.total_price), 0)
  const revenue =
    opts.revenueOverride != null && opts.revenueOverride > 0 ? opts.revenueOverride : lineRevenue

  const cost_total = articles.reduce((s, l) => s + num(l.total_price), 0)
  const durableLines = articles.filter(isDurableLine)
  const cost_durable = durableLines.reduce((s, l) => s + num(l.total_price), 0)
  const cost_ongoing = cost_total - cost_durable
  const labour = articles.filter(isLabourLine)
  const labour_cost = labour.reduce((s, l) => s + num(l.total_price), 0)
  const labour_hours = labour.reduce((s, l) => s + num(l.quantity), 0)
  const consumable_cost = cost_ongoing - labour_cost

  const contribution_ongoing = revenue - cost_ongoing
  const margin_percent_year1 = marginPercent(revenue, cost_total)
  const margin_percent_ongoing = marginPercent(revenue, cost_ongoing)

  let payback_years: number | null = null
  let payback_never = false
  if (cost_durable > 0) {
    if (contribution_ongoing > 0) payback_years = cost_durable / contribution_ongoing
    else payback_never = true
  }

  const margin_percent_3y =
    revenue > 0 ? ((3 * revenue - 3 * cost_ongoing - cost_durable) / (3 * revenue)) * 100 : null

  const visits = num(opts.visitsPerYear)
  const labour_missing = opts.context === 'contract' && visits > 0 && labour_hours < visits

  // Samma artikel på flera rader slås ihop, så § 5 kan skriva "Aurotrap × 7"
  const merged = new Map<string, DurableLine>()
  for (const l of durableLines) {
    const name = l.article_name || 'Utrustning'
    const cur = merged.get(name) ?? { article_name: name, quantity: 0, cost: 0 }
    cur.quantity += num(l.quantity)
    cur.cost += num(l.total_price)
    merged.set(name, cur)
  }
  const durable_lines = Array.from(merged.values()).sort((a, b) => b.cost - a.cost)

  const contract = opts.context === 'contract'
  return {
    context: opts.context,
    revenue,
    cost_total,
    cost_durable,
    cost_ongoing,
    labour_cost,
    labour_hours,
    labour_missing,
    consumable_cost,
    margin_percent_year1,
    margin_percent_ongoing,
    contribution_ongoing,
    payback_years,
    payback_never,
    margin_percent_3y,
    durable_count: durableLines.reduce((s, l) => s + num(l.quantity), 0),
    durable_lines,
    headline_percent: contract ? margin_percent_ongoing : margin_percent_year1,
    headline_label: contract && cost_durable > 0 ? 'Löpande marginal' : 'Marginal',
  }
}

/** Enda källan för färg på en marginalprocent. */
export function marginTone(pct: number | null | undefined, settings?: MarginSettings | null): MarginTone {
  if (pct == null || !Number.isFinite(pct)) return 'none'
  const target = settings?.target_margin_percent ?? 35
  const min = settings?.min_margin_percent ?? 20
  if (pct >= target) return 'good'
  if (pct >= min) return 'warn'
  return 'bad'
}

/** Färg på återbetalningstiden mot max_payback_years. */
export function paybackTone(b: Pick<MarginBreakdown, 'payback_years' | 'payback_never'>, settings?: MarginSettings | null): MarginTone {
  if (b.payback_never) return 'bad'
  if (b.payback_years == null) return 'none'
  const max = settings?.max_payback_years ?? 2
  return b.payback_years > max ? 'bad' : 'good'
}

/** "1,4 år", eller "8 mån" under ett år. */
export function formatPayback(years: number | null): string {
  if (years == null) return ''
  if (years < 1) return `${Math.max(1, Math.ceil(years * 12))} mån`
  return `${years.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} år`
}

/** Tailwind-textfärg för portalens mörka tema. */
export function toneTextClass(tone: MarginTone): string {
  switch (tone) {
    case 'good': return 'text-emerald-400'
    case 'warn': return 'text-yellow-400'
    case 'bad': return 'text-red-400'
    default: return 'text-slate-400'
  }
}
