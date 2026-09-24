// src/shared/procurementRules.ts
// Upphandlingsportalens rena regler, utan databas och utan import.meta så att
// samma kod körs i synk-cronen (api/cron/procurement-*) och i klienten.
//
//   - normalisering av orgnr, namn och titlar
//   - dedup-nyckel (köparens orgnr + normaliserad titel + sista anbudsdag)
//   - matchning mot bevakningsregler (planens avsnitt 7)
//   - beräknat avtalsslut och bearbetningsfönster (avsnitt 3)
//   - län ur NUTS-koder
//   - grov vinstsannolikhet (1 delat med förväntat antal anbud)
//
// Plan: docs/upphandlingsportal-plan.md

import type { ProcurementEndSource, ProcurementMatchReason, ProcurementWatchRule } from '../types/procurement'

// ---------------------------------------------------------------------------
// Normalisering

/** Tio siffror utan bindestreck. 12-siffriga (16 + orgnr) kortas. Null om det inte ser ut som ett orgnr. */
export function normalizeOrgNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = String(raw).replace(/\D/g, '')
  if (d.length === 12 && (d.startsWith('16') || d.startsWith('19') || d.startsWith('20'))) d = d.slice(2)
  return d.length === 10 ? d : null
}

/** 5560329285 -> 556032-9285 */
export function formatOrgNumber(org: string | null | undefined): string {
  const d = normalizeOrgNumber(org)
  return d ? `${d.slice(0, 6)}-${d.slice(6)}` : org ?? ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<\/?em[^>]*>/gi, '')
}

/** Rensar HTML-entiteter och Mercells markering, trimmar. För visning. */
export function cleanText(s: string | null | undefined): string {
  return decodeEntities(String(s ?? '')).replace(/\s+/g, ' ').trim()
}

const COMPANY_NOISE = /\b(aktiebolag|ab|publ|hb|kb|ek för|ekonomisk förening|i likvidation)\b/g

/** Företagsnamn för jämförelse: gemener, utan bolagsform, skiljetecken och "och"/"&". */
export function normalizeName(name: string | null | undefined): string {
  return decodeEntities(String(name ?? ''))
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[&+]/g, ' ')
    .replace(/\boch\b/g, ' ')
    .replace(/[^a-z0-9åäöéü ]+/g, ' ')
    .replace(COMPANY_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Titel för dedup och trigramlikhet: gemener, bara bokstäver och siffror. */
export function normalizeTitle(title: string | null | undefined): string {
  return decodeEntities(String(title ?? ''))
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/[^a-z0-9åäöéü ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** TED-publiceringsnummer utan inledande nollor: 00657962-2026 -> 657962-2026 */
export function normalizeTedNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = String(raw).trim().match(/^0*(\d+)-(\d{4})$/)
  return m ? `${m[1]}-${m[2]}` : null
}

// ---------------------------------------------------------------------------
// Datum i svensk tid. Aldrig rå toISOString() för datum som visas eller jämförs.

const SE_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' })

/** ÅÅÅÅ-MM-DD för ett ögonblick, räknat i svensk tid */
export function swedishDate(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return SE_DATE.format(d)
}

/** Dagens datum i svensk tid */
export function todaySwedish(): string {
  return SE_DATE.format(new Date())
}

/** Lägg till dagar på ett ÅÅÅÅ-MM-DD (kalenderdatum, oberoende av tidszon) */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Lägg till månader på ett ÅÅÅÅ-MM-DD, sista dagen i månaden om dagen saknas */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Antal kalenderdagar från a till b (ÅÅÅÅ-MM-DD) */
export function daysBetweenIso(a: string, b: string): number {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000)
}

/** TED skriver datum som 2026-09-09Z eller 2026-06-18+02:00. Plockar ut kalenderdatumet. */
export function tedDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** Kvartal som 2027-Q1 för ett ÅÅÅÅ-MM-DD */
export function quarterOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const [y, m] = iso.split('-').map(Number)
  if (!y || !m) return null
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
}

// ---------------------------------------------------------------------------
// Dedup

export interface DedupInput {
  buyerOrgNumber?: string | null
  buyerName?: string | null
  title: string
  /** Sista anbudsdag som ISO-tid eller datum */
  deadline?: string | null
}

/**
 * Primär dedup-nyckel: köparens orgnr (eller normaliserat namn när Mercell
 * saknar orgnr) plus normaliserad titel plus sista anbudsdag i svensk tid.
 */
export function buildDedupKey(input: DedupInput): string {
  const org = normalizeOrgNumber(input.buyerOrgNumber)
  const who = org ? `o:${org}` : `n:${normalizeName(input.buyerName)}`
  const day = input.deadline ? swedishDate(input.deadline) ?? 'x' : 'x'
  return `${who}|${normalizeTitle(input.title)}|${day}`
}

// ---------------------------------------------------------------------------
// Län ur NUTS3 (Sverige). BeGone verkar i sex av dem.

export const SE_COUNTIES: Record<string, string> = {
  SE110: 'Stockholms län',
  SE121: 'Uppsala län',
  SE122: 'Södermanlands län',
  SE123: 'Östergötlands län',
  SE124: 'Örebro län',
  SE125: 'Västmanlands län',
  SE211: 'Jönköpings län',
  SE212: 'Kronobergs län',
  SE213: 'Kalmar län',
  SE214: 'Gotlands län',
  SE221: 'Blekinge län',
  SE224: 'Skåne län',
  SE231: 'Hallands län',
  SE232: 'Västra Götalands län',
  SE311: 'Värmlands län',
  SE312: 'Dalarnas län',
  SE313: 'Gävleborgs län',
  SE321: 'Västernorrlands län',
  SE322: 'Jämtlands län',
  SE331: 'Västerbottens län',
  SE332: 'Norrbottens län',
}

export const BEGONE_COUNTIES = ['SE110', 'SE121', 'SE122', 'SE123', 'SE312', 'SE313']

/** Unika NUTS3-koder för Sverige ur en blandad lista (SE110, SWE, SE1 ...) */
export function countiesFromNuts(codes: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const c of codes) {
    const code = String(c ?? '').toUpperCase().trim()
    if (SE_COUNTIES[code]) out.add(code)
  }
  return [...out]
}

/** Länskod ur ett länsnamn (Mercells deliveryPlaceNames) */
export function countyFromName(name: string | null | undefined): string | null {
  const n = String(name ?? '').toLowerCase().trim()
  if (!n) return null
  for (const [code, label] of Object.entries(SE_COUNTIES)) {
    if (label.toLowerCase() === n || label.toLowerCase().replace(' län', '') === n.replace(' län', '')) return code
  }
  return null
}

// ---------------------------------------------------------------------------
// Matchning

export interface MatchInput {
  title: string
  description?: string | null
  cpv_codes: string[]
  county_codes?: string[]
}

export interface MatchResult {
  score: number
  hard: boolean
  reasons: ProcurementMatchReason[]
}

/** Tröskel för notis och direktnotis, planens avsnitt 7 */
export const NOTIFY_SCORE = 60
export const DIRECT_NOTIFY_SCORE = 100

/** Standardregler om tabellen är tom (samma som seeden i migrationen) */
export const DEFAULT_WATCH_RULES: Array<Pick<ProcurementWatchRule, 'name' | 'rule_type' | 'cpv_prefixes' | 'keywords' | 'county_codes' | 'points' | 'active'>> = [
  { name: 'Skadedjursbekämpning (CPV 9092)', rule_type: 'cpv_hard', cpv_prefixes: ['9092'], keywords: [], county_codes: [], points: 100, active: true },
  { name: 'Närliggande CPV-grupper', rule_type: 'cpv_soft', cpv_prefixes: ['909', '9091', '90911', '70', '7033', '507', '772312'], keywords: [], county_codes: [], points: 50, active: true },
  {
    name: 'Nyckelord', rule_type: 'keyword', cpv_prefixes: [], county_codes: [], points: 10, active: true,
    keywords: ['skadedjur', 'skadedjursbekämpning', 'skadedjurssanering', 'skadedjurskontroll', 'råttbekämpning', 'råttor', 'råtta',
      'möss', 'gnagare', 'kackerlackor', 'vägglöss', 'insektsbekämpning', 'fågelsäkring', 'duvor', 'getingar',
      'myror', 'mygg', 'pest control', 'sanering av anläggningar', 'saneringstjänster'],
  },
  { name: 'Negativa ord', rule_type: 'negative', cpv_prefixes: [], keywords: ['asbest', 'pcb', 'marksanering', 'radon', 'rivning', 'fuktsanering', 'mögelsanering', 'klottersanering'], county_codes: [], points: -50, active: true },
  { name: 'BeGones län', rule_type: 'county', cpv_prefixes: [], keywords: [], county_codes: BEGONE_COUNTIES, points: 10, active: true },
]

type RuleLike = Pick<ProcurementWatchRule, 'name' | 'rule_type' | 'cpv_prefixes' | 'keywords' | 'county_codes' | 'points' | 'active'>

function cpvHits(codes: string[], prefixes: string[]): string[] {
  const clean = codes.map((c) => String(c).replace(/\D/g, ''))
  return clean.filter((c) => prefixes.some((p) => p && c.startsWith(p)))
}

function keywordHits(text: string, keywords: string[]): string[] {
  const hay = ` ${decodeEntities(text).toLowerCase()} `
  return keywords.filter((k) => k && hay.includes(k.toLowerCase()))
}

/**
 * Poäng enligt planens avsnitt 7:
 *   - hård träff: någon CPV börjar på 9092 ger 100
 *   - mjuk träff: CPV i närliggande grupp OCH minst ett nyckelord ger 50 + 10 per nyckelord
 *   - nyckelord i titeln utan närliggande CPV ger också 50 + 10 per nyckelord
 *     (Mercell saknar ibland CPV; en titel som "Skadedjursbekämpning" ska aldrig missas)
 *   - nyckelord bara i beskrivningen utan CPV-stöd ger 20 + 10 per nyckelord
 *   - negativa ord drar av på allt utom hårda träffar
 *   - län: tillägg när leveransorten ligger i BeGones län
 * Notis vid 60, direktnotis vid 100.
 */
export function scoreNotice(input: MatchInput, rules: RuleLike[] = DEFAULT_WATCH_RULES): MatchResult {
  const active = rules.filter((r) => r.active)
  const reasons: ProcurementMatchReason[] = []
  const cpv = input.cpv_codes ?? []
  const title = input.title ?? ''
  const desc = input.description ?? ''

  const hardRules = active.filter((r) => r.rule_type === 'cpv_hard')
  const hardHit = hardRules.find((r) => cpvHits(cpv, r.cpv_prefixes).length > 0)

  const kwList = active.filter((r) => r.rule_type === 'keyword').flatMap((r) => r.keywords)
  const kwPoints = active.find((r) => r.rule_type === 'keyword')?.points ?? 10
  const titleKw = keywordHits(title, kwList)
  const allKw = Array.from(new Set([...titleKw, ...keywordHits(desc, kwList)]))

  let score = 0
  if (hardHit) {
    const hits = cpvHits(cpv, hardHit.cpv_prefixes)
    score = hardHit.points
    reasons.push({ rule: 'cpv_hard', label: `CPV ${hits[0]}`, points: hardHit.points })
  } else {
    const softRule = active.find((r) => r.rule_type === 'cpv_soft')
    const softHits = softRule ? cpvHits(cpv, softRule.cpv_prefixes) : []
    if (allKw.length > 0 && (softHits.length > 0 || titleKw.length > 0)) {
      const base = softRule?.points ?? 50
      score = base
      reasons.push(
        softHits.length > 0
          ? { rule: 'cpv_soft', label: `Närliggande CPV ${softHits[0]}`, points: base }
          : { rule: 'keyword', label: 'Nyckelord i titeln', points: base }
      )
    } else if (allKw.length > 0) {
      score = 20
      reasons.push({ rule: 'keyword', label: 'Nyckelord i beskrivningen', points: 20 })
    }
    if (allKw.length > 0) {
      score += kwPoints * allKw.length
      reasons.push({ rule: 'keyword', label: `Nyckelord: ${allKw.join(', ')}`, points: kwPoints * allKw.length })
    }
    if (score > 0) {
      for (const r of active.filter((x) => x.rule_type === 'negative')) {
        const neg = keywordHits(`${title} ${desc}`, r.keywords)
        if (neg.length > 0) {
          score += r.points
          reasons.push({ rule: 'negative', label: `Negativt ord: ${neg.join(', ')}`, points: r.points })
        }
      }
    }
  }

  if (score > 0) {
    for (const r of active.filter((x) => x.rule_type === 'county')) {
      const hit = (input.county_codes ?? []).find((c) => r.county_codes.includes(c))
      if (hit) {
        score += r.points
        reasons.push({ rule: 'county', label: SE_COUNTIES[hit] ?? hit, points: r.points })
      }
    }
  }

  return { score: Math.max(0, Math.round(score)), hard: !!hardHit, reasons }
}

// ---------------------------------------------------------------------------
// Avtalsklockan

export interface EndDateInput {
  /** TED contract-duration-end-date-lot */
  tedEnd?: string | null
  /** TED renewal-maximum-lot: antal möjliga förlängningar */
  renewalMax?: number | null
  /** Mercell contractExpiryDate */
  mercellExpiry?: string | null
  /** Avtalsstart, tecknat eller tilldelningsdatum: basen för antagandet */
  startOrAwardDate?: string | null
}

/**
 * Antagen längd per förlängning när TED bara anger antalet. Svensk praxis är
 * nästan alltid "två år plus 1 + 1", därför ett år per förlängning.
 */
export const RENEWAL_YEARS_EACH = 1

/** Beräknat avtalsslut i planens ordning: TED + förlängningar, Mercell, två plus två år. */
export function computeContractEnd(input: EndDateInput): { date: string | null; source: ProcurementEndSource | null } {
  const ted = tedDate(input.tedEnd)
  if (ted) {
    const renewals = Math.max(0, Number(input.renewalMax ?? 0) || 0)
    if (renewals > 0) return { date: addMonthsIso(ted, renewals * 12 * RENEWAL_YEARS_EACH), source: 'ted_end_plus_renewals' }
    return { date: ted, source: 'ted_end' }
  }
  const mercell = input.mercellExpiry ? swedishDate(input.mercellExpiry) : null
  if (mercell) return { date: mercell, source: 'mercell_expiry' }
  const base = tedDate(input.startOrAwardDate)
  if (base) return { date: addMonthsIso(base, 48), source: 'assumption_2_2' }
  return { date: null, source: null }
}

/** Bearbetningsfönstret: 18 till 12 månader före slutdatum */
export function workWindow(endDate: string | null): { start: string | null; end: string | null } {
  if (!endDate) return { start: null, end: null }
  return { start: addMonthsIso(endDate, -18), end: addMonthsIso(endDate, -12) }
}

// ---------------------------------------------------------------------------
// Sannolikhet

/** Median antal anbud per upphandling i CPV 9092 (UHM 2021 till 2025) */
export const MARKET_MEDIAN_BIDS = 2

export interface ProbabilityInput {
  /** Förväntat antal ANDRA anbudsgivare (köparens historik, annars marknadens median) */
  expectedOtherBids?: number | null
  criteriaType?: string | null
  /** Egen historik: vunna och lämnade anbud */
  ownWins?: number
  ownBids?: number
}

/**
 * Basen är 1 delat med förväntat antal anbud inklusive vårt eget. Justeras
 * för kriterietyp (kvalitet väger in rapportering och egenkontroll där vi är
 * starka, rent pris gynnar den största aktören) och, när minst fem egna utfall
 * finns, mot vår egen vinstfrekvens. Aldrig över 0,8.
 */
export function estimateWinProbability(input: ProbabilityInput): { probability: number; expectedBids: number } {
  const others = input.expectedOtherBids != null && input.expectedOtherBids > 0 ? input.expectedOtherBids : MARKET_MEDIAN_BIDS
  const expectedBids = others + 1
  let p = 1 / expectedBids
  if (input.criteriaType === 'quality' || input.criteriaType === 'mixed') p *= 1.15
  else if (input.criteriaType === 'price') p *= 0.9
  if ((input.ownBids ?? 0) >= 5) {
    const own = (input.ownWins ?? 0) / (input.ownBids ?? 1)
    p = 0.5 * p + 0.5 * own
  }
  return { probability: Math.min(0.8, Math.max(0.02, p)), expectedBids }
}

/** Årsvärde = uppskattat värde delat med avtalstid i år (minst ett år) */
export function annualValueOf(estimatedValue: number | null | undefined, durationMonths: number | null | undefined): number | null {
  if (estimatedValue == null || !(estimatedValue > 0)) return null
  const years = durationMonths && durationMonths > 0 ? Math.max(1, durationMonths / 12) : 4
  return estimatedValue / years
}
