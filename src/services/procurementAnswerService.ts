// src/services/procurementAnswerService.ts
// Anbudsstöd i upphandlingsportalen (docs/upphandlingsportal-plan.md avsnitt 5,
// 5b Kvalitetssvar och verktyg 12): AI-utkast per kvalitetskriterium,
// anbudsbiblioteket (procurement_answers) och lärdomar vunnet mot förlorat.
//
// Läsning och skrivning via RLS (has_procurement_access). AI-utkastet skapas
// på servern i api/procurement/draft-answer.ts som också sparar det på kravet.

import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import type { ProcurementBid, ProcurementCriteriaType, ProcurementRequirement } from '../types/procurement'

// ---------------------------------------------------------------------------
// Typer

/** Kriterietyper i anbudsbiblioteket. Samma lista finns i api/_lib/procurementOwnMaterial.ts. */
export const CRITERION_TYPES = [
  'rapportering',
  'egenkontroll',
  'miljo',
  'kvalitetssakring',
  'bemanning',
  'installelsetid',
  'kommunikation',
  'annat',
] as const

export type CriterionType = (typeof CRITERION_TYPES)[number]

export const CRITERION_TYPE_LABEL: Record<CriterionType, string> = {
  rapportering: 'Rapportering',
  egenkontroll: 'Egenkontroll',
  miljo: 'Miljö',
  kvalitetssakring: 'Kvalitetssäkring',
  bemanning: 'Bemanning och kompetens',
  installelsetid: 'Inställelsetid',
  kommunikation: 'Kommunikation och kundtjänst',
  annat: 'Annat',
}

export function isCriterionType(v: unknown): v is CriterionType {
  return typeof v === 'string' && (CRITERION_TYPES as readonly string[]).includes(v)
}

export function criterionLabel(v: string | null | undefined): string {
  return isCriterionType(v) ? CRITERION_TYPE_LABEL[v] : 'Ej satt'
}

export interface ProcurementAnswer {
  id: string
  criterion_type: string
  title: string
  criterion_text: string | null
  answer: string
  tags: string[]
  source_notice_id: string | null
  source_requirement_id: string | null
  use_count: number
  last_used_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AnswerWithNotice = ProcurementAnswer & {
  source_notice: { id: string; title: string; buyer_name: string | null; bgu_number: number } | null
}

/** En källa som utkastet bygger på: ett materialblock eller ett tidigare svar */
export interface DraftSource {
  id: string
  kind: 'material' | 'svar'
  title: string
  source: string | null
}

/** Kravrad med kolumnerna för kvalitetssvar */
export type RequirementWithDraft = ProcurementRequirement & {
  criterion_type: string | null
  draft_answer: string | null
  draft_sources: DraftSource[] | null
  draft_updated_at: string | null
  answer_id: string | null
}

export interface DraftResponse {
  draft: string
  sources: DraftSource[]
  criterion_type: CriterionType
  draft_updated_at: string
  gaps: number
}

export interface LessonRow {
  bidId: string
  noticeId: string
  bguNumber: number | null
  title: string
  buyerName: string | null
  criteriaType: ProcurementCriteriaType | null
  outcome: 'won' | 'lost'
  bidsReceived: number | null
  ourPrice: number | null
  winnerName: string | null
  winnerPrice: number | null
  /** Vårt pris mot vinnarens, (vårt - vinnarens) / vinnarens. Bara för förlorade anbud med båda priserna. */
  priceGap: number | null
  lesson: string | null
  decidedAt: string
}

export interface LessonGroup {
  key: string
  label: string
  won: number
  total: number
}

export interface LessonsData {
  rows: LessonRow[]
  byCriteria: LessonGroup[]
  byBidCount: LessonGroup[]
  /** Median av prisavståndet bland förlorade anbud där vinnarens pris är känt */
  medianGap: number | null
  gapCount: number
}

/** Planen säger minst 10 till 15 egna utfall innan slutsatser dras */
export const LESSONS_MIN_OUTCOMES = 10

// ---------------------------------------------------------------------------
// Hjälpare

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'okänt fel'}`)
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Du är inte inloggad')
  return id
}

/** Tecken som PostgREST-filtret .or() inte tål tas bort ur söktexten */
function cleanSearch(s: string): string {
  return s.replace(/[,()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim()
}

const CRITERIA_LABEL: Record<string, string> = {
  price: 'Pris',
  quality: 'Kvalitet',
  mixed: 'Pris och kvalitet',
  cost: 'Kostnad',
  unknown: 'Okänd kriterietyp',
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function bidCountBucket(n: number | null): { key: string; label: string } {
  if (n == null) return { key: 'z', label: 'Okänt antal' }
  if (n <= 2) return { key: 'a', label: '1 till 2 anbud' }
  if (n === 3) return { key: 'b', label: '3 anbud' }
  return { key: 'c', label: '4 eller fler anbud' }
}

function groupRows(rows: LessonRow[], keyOf: (r: LessonRow) => { key: string; label: string }): LessonGroup[] {
  const map = new Map<string, LessonGroup>()
  for (const r of rows) {
    const { key, label } = keyOf(r)
    const g = map.get(key) ?? { key, label, won: 0, total: 0 }
    g.total++
    if (r.outcome === 'won') g.won++
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

// ---------------------------------------------------------------------------

export class ProcurementAnswerService {
  // Anbudsbiblioteket

  static async listAnswers(search = '', type: CriterionType | 'all' = 'all'): Promise<AnswerWithNotice[]> {
    let q = supabase
      .from('procurement_answers')
      .select('*, source_notice:procurement_notices(id, title, buyer_name, bgu_number)')
      .order('use_count', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(300)
    if (type !== 'all') q = q.eq('criterion_type', type)
    const s = cleanSearch(search)
    if (s) q = q.or(`title.ilike.*${s}*,answer.ilike.*${s}*,criterion_text.ilike.*${s}*`)
    const { data, error } = await q
    if (error) fail('Kunde inte hämta anbudsbiblioteket', error)
    return (data ?? []) as unknown as AnswerWithNotice[]
  }

  /**
   * Skapar eller uppdaterar ett svar. Vid nytt svar med source_requirement_id
   * kopplas kravet till svaret (requirements.answer_id).
   */
  static async saveAnswer(
    input: Partial<Pick<ProcurementAnswer, 'id' | 'criterion_type' | 'criterion_text' | 'tags' | 'source_notice_id' | 'source_requirement_id'>> & {
      title: string
      answer: string
    }
  ): Promise<ProcurementAnswer> {
    const title = input.title.trim()
    const answer = input.answer.trim()
    if (!title) throw new Error('Svaret behöver en rubrik')
    if (!answer) throw new Error('Svaret är tomt')
    const base = {
      title,
      answer,
      criterion_type: isCriterionType(input.criterion_type) ? input.criterion_type : 'annat',
      criterion_text: input.criterion_text?.trim() || null,
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    }

    if (input.id) {
      const { data, error } = await supabase.from('procurement_answers').update(base as never).eq('id', input.id).select('*').single()
      if (error) fail('Kunde inte spara svaret', error)
      return data as unknown as ProcurementAnswer
    }

    const created_by = await currentUserId()
    const { data, error } = await supabase
      .from('procurement_answers')
      .insert({
        ...base,
        source_notice_id: input.source_notice_id ?? null,
        source_requirement_id: input.source_requirement_id ?? null,
        created_by,
      } as never)
      .select('*')
      .single()
    if (error) fail('Kunde inte spara svaret i biblioteket', error)
    const row = data as unknown as ProcurementAnswer
    if (input.source_requirement_id) {
      const { error: linkErr } = await supabase
        .from('procurement_requirements')
        .update({ answer_id: row.id } as never)
        .eq('id', input.source_requirement_id)
      if (linkErr) fail('Svaret sparades men kravet kunde inte kopplas', linkErr)
    }
    return row
  }

  static async deleteAnswer(id: string): Promise<void> {
    // Kravens answer_id nollas av databasen (ON DELETE SET NULL)
    const { error } = await supabase.from('procurement_answers').delete().eq('id', id)
    if (error) fail('Kunde inte ta bort svaret', error)
  }

  /**
   * "Använd igen": kopierar svaret till kravets utkast, kopplar kravet till
   * svaret och räknar upp användningen.
   */
  static async useAnswer(answerId: string, requirementId: string): Promise<void> {
    const { data: a, error } = await supabase.from('procurement_answers').select('*').eq('id', answerId).single()
    if (error || !a) fail('Kunde inte hämta svaret', error)
    const answer = a as unknown as ProcurementAnswer

    const { data: r } = await supabase.from('procurement_requirements').select('criterion_type').eq('id', requirementId).maybeSingle()
    const currentType = (r as { criterion_type: string | null } | null)?.criterion_type ?? null
    const now = new Date().toISOString()
    const source: DraftSource = { id: answer.id, kind: 'svar', title: answer.title, source: null }

    const { error: upErr } = await supabase
      .from('procurement_requirements')
      .update({
        draft_answer: answer.answer,
        draft_sources: [source],
        draft_updated_at: now,
        answer_id: answer.id,
        ...(currentType ? {} : { criterion_type: answer.criterion_type }),
      } as never)
      .eq('id', requirementId)
    if (upErr) fail('Kunde inte kopiera svaret till kravet', upErr)

    // Räknaren läses och skrivs i två steg; en samtidig användning kan tappa ett steg, vilket är godtagbart
    const { error: cntErr } = await supabase
      .from('procurement_answers')
      .update({ use_count: (answer.use_count ?? 0) + 1, last_used_at: now } as never)
      .eq('id', answer.id)
    if (cntErr) fail('Svaret kopierades men användningen kunde inte räknas', cntErr)
  }

  /**
   * Samma som useAnswer. Komponenter anropar den här, eftersom React-lintern
   * tolkar Klass.useNågot() som en hook.
   */
  static async reuseAnswer(answerId: string, requirementId: string): Promise<void> {
    return this.useAnswer(answerId, requirementId)
  }

  // Utkast per kvalitetskriterium

  /** AI-utkast ur eget material och biblioteket. Sparas på kravet av servern. */
  static async draftAnswer(requirementId: string): Promise<DraftResponse> {
    const res = await apiFetch('/api/procurement/draft-answer', {
      method: 'POST',
      body: JSON.stringify({ requirementId }),
    })
    const body = (await res.json().catch(() => ({}))) as Partial<DraftResponse> & { error?: string }
    if (!res.ok) throw new Error(body.error ?? `Utkastet kunde inte skapas (${res.status})`)
    return body as DraftResponse
  }

  static async saveDraft(requirementId: string, text: string): Promise<void> {
    const value = text.trim() ? text : null
    const { error } = await supabase
      .from('procurement_requirements')
      .update({ draft_answer: value, draft_updated_at: new Date().toISOString() } as never)
      .eq('id', requirementId)
    if (error) fail('Kunde inte spara utkastet', error)
  }

  static async setCriterionType(requirementId: string, type: CriterionType | null): Promise<void> {
    const { error } = await supabase.from('procurement_requirements').update({ criterion_type: type } as never).eq('id', requirementId)
    if (error) fail('Kunde inte spara kriterietypen', error)
  }

  // Lärdomar vunnet mot förlorat

  static async listLessons(): Promise<LessonsData> {
    const { data: bidData, error } = await supabase
      .from('procurement_bids')
      .select('id, notice_id, outcome, submitted_price, lesson, is_current, created_at, updated_at, notice:procurement_notices(id, title, buyer_name, criteria_type, bgu_number)')
      .in('outcome', ['won', 'lost'])
      .order('updated_at', { ascending: false })
    if (error) fail('Kunde inte hämta anbuden', error)

    type BidRow = Pick<ProcurementBid, 'id' | 'notice_id' | 'outcome' | 'submitted_price' | 'lesson' | 'is_current' | 'created_at' | 'updated_at'> & {
      notice: { id: string; title: string; buyer_name: string | null; criteria_type: ProcurementCriteriaType | null; bgu_number: number } | null
    }
    // Ett utfall per upphandling: aktuellt anbud först, annars det senast ändrade
    const perNotice = new Map<string, BidRow>()
    for (const b of (bidData ?? []) as unknown as BidRow[]) {
      const prev = perNotice.get(b.notice_id)
      if (!prev || (b.is_current && !prev.is_current)) perNotice.set(b.notice_id, b)
    }
    const bids = [...perNotice.values()]
    const noticeIds = bids.map((b) => b.notice_id)

    type AwardRow = { notice_id: string; bids_received: number | null; value: number | null; value_kind: string; winner_name: string | null; supplier: { name: string; is_begone: boolean } | null }
    type BidderRow = { notice_id: string; name: string; price: number | null; is_winner: boolean; is_begone: boolean; supplier: { name: string; is_begone: boolean } | null }
    let awards: AwardRow[] = []
    let bidders: BidderRow[] = []
    if (noticeIds.length > 0) {
      const [aRes, bRes] = await Promise.all([
        supabase
          .from('procurement_awards')
          .select('notice_id, bids_received, value, value_kind, winner_name, supplier:procurement_suppliers(name, is_begone)')
          .in('notice_id', noticeIds)
          .is('excluded_reason', null),
        supabase
          .from('procurement_bidders')
          .select('notice_id, name, price, is_winner, is_begone, supplier:procurement_suppliers(name, is_begone)')
          .in('notice_id', noticeIds),
      ])
      if (aRes.error) fail('Kunde inte hämta tilldelningarna', aRes.error)
      if (bRes.error) fail('Kunde inte hämta anbudsgivarna', bRes.error)
      awards = (aRes.data ?? []) as unknown as AwardRow[]
      bidders = (bRes.data ?? []) as unknown as BidderRow[]
    }

    const rows: LessonRow[] = bids.map((b) => {
      const nAwards = awards.filter((a) => a.notice_id === b.notice_id)
      const nBidders = bidders.filter((x) => x.notice_id === b.notice_id)
      const outcome = b.outcome as 'won' | 'lost'

      const fromAward = nAwards.map((a) => a.bids_received).filter((n): n is number => n != null)
      const distinctBidders = new Set(nBidders.map((x) => (x.supplier?.name ?? x.name).toLowerCase())).size
      const bidsReceived = fromAward.length > 0 ? Math.max(...fromAward) : distinctBidders > 0 ? distinctBidders : null

      // Vinnaren: en annan anbudsgivare markerad som vinnare, annars tilldelningen
      const otherWinner = nBidders.find((x) => x.is_winner && !x.is_begone && !x.supplier?.is_begone)
      const award = nAwards.find((a) => !a.supplier?.is_begone) ?? nAwards[0]
      let winnerName: string | null = null
      let winnerPrice: number | null = null
      if (outcome === 'won') {
        winnerName = 'BeGone'
        winnerPrice = b.submitted_price
      } else if (otherWinner) {
        winnerName = otherWinner.supplier?.name ?? otherWinner.name
        winnerPrice = otherWinner.price
      } else if (award) {
        winnerName = award.supplier?.name ?? award.winner_name
        winnerPrice = award.value_kind === 'actual' ? award.value : null
      }

      const ourPrice = b.submitted_price
      const priceGap = outcome === 'lost' && ourPrice != null && winnerPrice != null && winnerPrice > 0 ? (ourPrice - winnerPrice) / winnerPrice : null

      return {
        bidId: b.id,
        noticeId: b.notice_id,
        bguNumber: b.notice?.bgu_number ?? null,
        title: b.notice?.title ?? 'Okänd upphandling',
        buyerName: b.notice?.buyer_name ?? null,
        criteriaType: b.notice?.criteria_type ?? null,
        outcome,
        bidsReceived,
        ourPrice,
        winnerName,
        winnerPrice,
        priceGap,
        lesson: b.lesson,
        decidedAt: b.updated_at,
      }
    })
    rows.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))

    const gaps = rows.map((r) => r.priceGap).filter((g): g is number => g != null)
    return {
      rows,
      byCriteria: groupRows(rows, (r) => {
        const key = r.criteriaType ?? 'unknown'
        return { key: key === 'unknown' ? 'zz' : key, label: CRITERIA_LABEL[key] ?? key }
      }),
      byBidCount: groupRows(rows, (r) => bidCountBucket(r.bidsReceived)),
      medianGap: median(gaps),
      gapCount: gaps.length,
    }
  }
}
