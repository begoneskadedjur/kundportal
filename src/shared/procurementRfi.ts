// src/shared/procurementRfi.ts
// RFI-läget i upphandlingsportalen (3.71.0): ren logik som klienten, API:t
// och testerna delar. En RFI (request for information) är ett formulär med
// frågor som BeGone svarar på och skickar in. Den är inte bindande, har inget
// pris och inga krav, men svaren påverkar hur den kommande upphandlingen skrivs.
//
//   workModeOf          arbetsläget: manuellt valt, annars ur notice_kind
//   rfiStepStates       stegpunkterna i RFI-läget (grå, gul, grön)
//   prefillValues       företagsuppgifter ur sparade uppgifter, BeGones fasta
//                       uppgifter och ansvarig för upphandlingen
//   answerFills         vad som ska skrivas i vilket stycke vid export
//   exportIssues        obesvarade och ej godkända frågor före export
//   matchFollowUps      senare annonser hos samma köpare som liknar RFI:n

import type { ProcurementNotice, ProcurementRfiQuestion, ProcurementWorkMode } from '../types/procurement'
import { checkAnchor, fillDocxXml, parseDocxParagraphs, type DocxFill } from './procurementRfiDocx'

// ---------------------------------------------------------------------------
// Läge

export function workModeOf(n: Pick<ProcurementNotice, 'notice_kind'> & { work_mode?: ProcurementWorkMode | null }): ProcurementWorkMode {
  if (n.work_mode === 'rfi' || n.work_mode === 'tender') return n.work_mode
  return n.notice_kind === 'rfi' ? 'rfi' : 'tender'
}

export const RFI_ANSWER_TYPE_LABEL: Record<ProcurementRfiQuestion['answer_type'], string> = {
  fritext: 'Fritext',
  ja_nej: 'Ja eller nej',
  procent_per_ar: 'Procent per år',
  foretagsuppgift: 'Företagsuppgifter',
}

// ---------------------------------------------------------------------------
// Svar

type Q = Pick<ProcurementRfiQuestion, 'answer_type' | 'answer' | 'answer_values' | 'answer_meta' | 'answer_status' | 'anchor'>

/** Nycklarna som ett strukturerat svar ska ha värden för */
export function valueKeys(q: Pick<Q, 'answer_type' | 'answer_meta'>): string[] {
  if (q.answer_type === 'procent_per_ar') return (q.answer_meta.years ?? []).map(String)
  if (q.answer_type === 'foretagsuppgift') return (q.answer_meta.fields ?? []).map((f) => f.key)
  return []
}

/** Frågan har ett svar (alla fält ifyllda för strukturerade typer) */
export function isAnswered(q: Q): boolean {
  const v = q.answer_values ?? {}
  if (q.answer_type === 'fritext') return !!q.answer?.trim()
  if (q.answer_type === 'ja_nej') return v.choice === 'ja' || v.choice === 'nej'
  const keys = valueKeys(q)
  return keys.length > 0 && keys.every((k) => (v[k] ?? '').trim() !== '')
}

export function rfiProgress(qs: Q[]): { total: number; answered: number; approved: number } {
  return {
    total: qs.length,
    answered: qs.filter(isAnswered).length,
    approved: qs.filter((q) => q.answer_status === 'godkand').length,
  }
}

/** Luckor i ett AI-utkast: [FYLL I: ...] */
export const FILL_GAP_RE = /\[FYLL I:\s*([^\]]*)\]/g

export function gapsIn(text: string | null | undefined): string[] {
  return [...(text ?? '').matchAll(FILL_GAP_RE)].map((m) => m[1].trim())
}

/** Procent som "30 %" (tal med komma, procenttecknet med mellanslag) */
export function fmtPercentAnswer(raw: string): string {
  const s = raw.trim().replace(/\s*%$/, '').replace('.', ',')
  return s ? `${s} %` : ''
}

/** Text att skriva i köparens dokument, per stycke */
export function answerFills(q: Q): Array<{ p: number; text: string }> {
  const a = q.anchor
  if (!a) return []
  const v = q.answer_values ?? {}
  if (q.answer_type === 'fritext' && a.p != null) return q.answer?.trim() ? [{ p: a.p, text: q.answer.trim() }] : []
  if (q.answer_type === 'ja_nej' && a.p != null) {
    const choice = v.choice === 'ja' ? 'Ja' : v.choice === 'nej' ? 'Nej' : ''
    const text = [choice, q.answer?.trim()].filter(Boolean).join('. ')
    return text ? [{ p: a.p, text }] : []
  }
  const out: Array<{ p: number; text: string }> = []
  for (const [key, p] of Object.entries(a.cells ?? {})) {
    const raw = (v[key] ?? '').trim()
    if (!raw) continue
    out.push({ p, text: q.answer_type === 'procent_per_ar' ? fmtPercentAnswer(raw) : raw })
  }
  return out
}

/** Svaret som läsbar text, för exporten utan originalfil och för anbudsbiblioteket */
export function answerAsText(q: Q): string {
  const v = q.answer_values ?? {}
  if (q.answer_type === 'fritext') return q.answer?.trim() ?? ''
  if (q.answer_type === 'ja_nej') {
    const choice = v.choice === 'ja' ? 'Ja' : v.choice === 'nej' ? 'Nej' : ''
    return [choice, q.answer?.trim()].filter(Boolean).join('. ')
  }
  if (q.answer_type === 'procent_per_ar') {
    return (q.answer_meta.years ?? [])
      .map((y) => `${y}: ${fmtPercentAnswer(v[String(y)] ?? '') || 'ej ifyllt'}`)
      .join('\n')
  }
  return (q.answer_meta.fields ?? []).map((f) => `${f.label}: ${(v[f.key] ?? '').trim() || 'ej ifyllt'}`).join('\n')
}

export interface ExportIssues {
  unanswered: number
  notApproved: number
  withGaps: number
  /** Frågor utan ankare i dokumentet: svaret kan inte skrivas in automatiskt */
  unanchored: number
}

export function exportIssues(qs: Q[]): ExportIssues {
  return {
    unanswered: qs.filter((q) => !isAnswered(q)).length,
    notApproved: qs.filter((q) => q.answer_status !== 'godkand').length,
    withGaps: qs.filter((q) => gapsIn(q.answer).length > 0).length,
    unanchored: qs.filter((q) => !q.anchor || (q.anchor.p == null && Object.keys(q.anchor.cells ?? {}).length === 0)).length,
  }
}

/**
 * Skriver svaren i köparens document.xml. Varje frågas ankare kontrolleras
 * först mot dokumentet (finns, är tomt, samma text före som vid inläsningen);
 * frågor som inte håller hoppas över och listas. Allt annat lämnas orört.
 */
export function fillRfiAnswers(
  documentXml: string,
  questions: Array<Q & { id: string }>
): { xml: string; written: number; skipped: Array<{ id: string; reason: 'ankare' | 'obesvarad' }> } {
  const paras = parseDocxParagraphs(documentXml)
  const fills: DocxFill[] = []
  const skipped: Array<{ id: string; reason: 'ankare' | 'obesvarad' }> = []
  let written = 0
  for (const q of questions) {
    const f = answerFills(q)
    if (f.length === 0) {
      skipped.push({ id: q.id, reason: 'obesvarad' })
      continue
    }
    const bad = checkAnchor(paras, q.anchor ?? null)
    const ok = f.filter((x) => {
      const key = q.anchor?.p === x.p ? 'p' : Object.entries(q.anchor?.cells ?? {}).find(([, p]) => p === x.p)?.[0]
      return key != null && !bad.includes(key)
    })
    if (ok.length === 0) {
      skipped.push({ id: q.id, reason: 'ankare' })
      continue
    }
    fills.push(...ok)
    written++
  }
  return { xml: fills.length ? fillDocxXml(documentXml, fills) : documentXml, written, skipped }
}

// ---------------------------------------------------------------------------
// Företagsuppgifter

/** BeGones fasta uppgifter (begone.se företagsfakta, kontrollrapportens sidfot) */
export const BEGONE_COMPANY = {
  foretagsnamn: 'BeGone Skadedjur & Sanering AB',
  organisationsnummer: '559378-9208',
} as const

/** Uppgifter som hämtas ur ansvarig för upphandlingen och inte sparas som företagsuppgift */
export const CONTACT_KEYS = ['kontakt_namn_titel', 'kontakt_namn', 'kontakt_epost', 'kontakt_telefon'] as const

export function isContactKey(key: string): boolean {
  return (CONTACT_KEYS as readonly string[]).includes(key)
}

/** Förslag på uppgifter som bara Christian har och som återkommer i RFI:er */
export const SUGGESTED_FACTS: Array<{ key: string; label: string }> = [
  { key: 'moderbolag', label: 'Moderbolag (inkl. land)' },
  { key: 'certifieringar', label: 'Certifikat och certifieringar' },
  { key: 'ledningssystem', label: 'Ledningssystem (kvalitet, miljö, arbetsmiljö, informationssäkerhet)' },
  { key: 'fordonsflotta', label: 'Fordonsflotta och drivmedel' },
  { key: 'kontakt_adress', label: 'Postadress' },
]

export interface ContactPerson {
  name: string | null
  email: string | null
  phone: string | null
  title?: string | null
}

/**
 * Förifyllda värden för en tabell med företagsuppgifter. Ordning: sparade
 * företagsuppgifter, BeGones fasta uppgifter, ansvarig för upphandlingen.
 * Värden som redan är ifyllda lämnas orörda.
 */
export function prefillValues(
  fields: Array<{ key: string }>,
  current: Record<string, string>,
  facts: Record<string, string>,
  contact: ContactPerson | null
): Record<string, string> {
  const out: Record<string, string> = { ...current }
  for (const { key } of fields) {
    if ((out[key] ?? '').trim()) continue
    let v: string | null | undefined = facts[key]
    if (!v && key in BEGONE_COMPANY) v = BEGONE_COMPANY[key as keyof typeof BEGONE_COMPANY]
    if (!v && contact) {
      if (key === 'kontakt_namn_titel') v = [contact.name, contact.title].filter(Boolean).join(', ') || null
      else if (key === 'kontakt_namn') v = contact.name
      else if (key === 'kontakt_epost') v = contact.email
      else if (key === 'kontakt_telefon') v = contact.phone
    }
    if (v && v.trim()) out[key] = v.trim()
  }
  return out
}

// ---------------------------------------------------------------------------
// Stegen i RFI-läget: 1 Översikt, 2 Underlag, 3 Svar, 4 Uppföljning (+ Logg)

export type RfiStepKey = 'oversikt' | 'underlag' | 'svar' | 'uppfoljning'
export type RfiStepState = 'todo' | 'doing' | 'done'

export interface RfiStepFacts {
  status: ProcurementNotice['our_status']
  documents: number
  questions: number
  answered: number
  approved: number
  /** Signalen "Upphandling väntas" följs i Framförhållning */
  signalFollowed: boolean
  /** Godkända svar sparade i anbudsbiblioteket */
  savedToLibrary: number
}

export const RFI_ANSWERED_STATUSES: Array<ProcurementNotice['our_status']> = ['submitted', 'won', 'lost']

export function rfiStepStates(f: RfiStepFacts): Record<RfiStepKey, RfiStepState> {
  const answered = RFI_ANSWERED_STATUSES.includes(f.status)
  return {
    oversikt: f.status === 'new' ? 'doing' : 'done',
    underlag: f.questions > 0 ? 'done' : f.documents > 0 ? 'doing' : 'todo',
    svar:
      answered || (f.questions > 0 && f.approved === f.questions)
        ? 'done'
        : f.answered > 0 || f.approved > 0
          ? 'doing'
          : 'todo',
    uppfoljning: answered && f.signalFollowed && (f.savedToLibrary > 0 || f.approved === 0) ? 'done' : answered ? 'doing' : 'todo',
  }
}

// ---------------------------------------------------------------------------
// Uppföljning: när den riktiga annonsen dyker upp

const STOP = new Set([
  'rfi', 'request', 'for', 'information', 'förfrågan', 'information', 'upphandling', 'upphandlingen', 'avseende', 'avtal',
  'ramavtal', 'och', 'för', 'av', 'med', 'till', 'inom', 'stad', 'kommun', 'regionen', 'region', 'tjänster', 'tjänst',
])

function words(s: string): Set<string> {
  const out = new Set<string>()
  for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length >= 4 && !STOP.has(w)) out.add(w)
  }
  return out
}

/** Gemensamma ord i titlarna, plus att skadedjur nämns i båda */
export function titleSimilarity(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  if (wa.size === 0 || wb.size === 0) return 0
  let hits = 0
  for (const w of wa) {
    if (wb.has(w) || [...wb].some((x) => x.length >= 6 && w.length >= 6 && (x.startsWith(w.slice(0, 6)) || w.startsWith(x.slice(0, 6))))) hits++
  }
  return hits / Math.min(wa.size, wb.size)
}

export type FollowUpCandidate = Pick<ProcurementNotice, 'id' | 'title' | 'buyer_id' | 'buyer_name' | 'notice_kind' | 'published_at' | 'tender_deadline' | 'bgu_number'>

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Senare annonser hos samma köpare (köpar-id eller samma namn) som liknar
 * RFI:n. Enkel heuristik: publicerad efter RFI:n, inte en RFI, minst hälften
 * av de kortaste titelns innehållsord gemensamma eller att båda handlar om
 * skadedjur. Bäst först.
 */
export function matchFollowUps(
  rfi: Pick<ProcurementNotice, 'id' | 'title' | 'buyer_id' | 'buyer_name' | 'published_at' | 'created_at'>,
  candidates: FollowUpCandidate[]
): Array<FollowUpCandidate & { score: number }> {
  const since = rfi.published_at ?? rfi.created_at
  const pest = /skadedjur|sanering|råtta|råttor|gnagare/i
  return candidates
    .filter((c) => c.id !== rfi.id && c.notice_kind !== 'rfi')
    .filter((c) => (rfi.buyer_id && c.buyer_id ? c.buyer_id === rfi.buyer_id : norm(c.buyer_name) === norm(rfi.buyer_name) && !!norm(rfi.buyer_name)))
    .filter((c) => !since || !c.published_at || c.published_at > since)
    .map((c) => {
      const sim = titleSimilarity(rfi.title, c.title)
      const bothPest = pest.test(rfi.title) && pest.test(c.title)
      return { ...c, score: Math.max(sim, bothPest ? 0.6 : 0) }
    })
    .filter((c) => c.score >= 0.5)
    .sort((a, b) => b.score - a.score || String(b.published_at).localeCompare(String(a.published_at)))
}
