// src/services/procurementRfiService.ts
// RFI-läget i upphandlingsportalen (3.71.0): frågorna i köparens formulär,
// svaren, företagsuppgifterna, signalen efter besvarad RFI och spara i
// anbudsbiblioteket. Läsning och skrivning via RLS (has_procurement_access);
// utläsning, AI-utkast och signalen går via api/procurement/rfi.

import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { ProcurementService } from './procurementService'
import type {
  ProcurementCompanyFact,
  ProcurementNotice,
  ProcurementRfiQuestion,
  ProcurementSignal,
  ProcurementWorkMode,
} from '../types/procurement'
import { answerAsText, matchFollowUps, type ContactPerson, type FollowUpCandidate } from '../shared/procurementRfi'

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'okänt fel'}`)
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Du är inte inloggad')
  return data.user.id
}

async function post<T>(body: Record<string, unknown>, what: string): Promise<{ status: number; body: T & { error?: string } }> {
  const res = await apiFetch('/api/procurement/rfi', { method: 'POST', body: JSON.stringify(body) })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok && res.status !== 409) throw new Error(json.error ?? `${what} misslyckades (${res.status})`)
  return { status: res.status, body: json }
}

export interface RfiReadResponse {
  questions: number
  anchored: number
  method: 'ai' | 'tolkning'
  kind: 'docx' | 'pdf'
  carried: number
  aiError: string | null
}

export type RfiAnswerPatch = Partial<Pick<ProcurementRfiQuestion, 'answer' | 'answer_values' | 'answer_status' | 'answer_source'>>

export class ProcurementRfiService {
  // -------------------------------------------------------------------------
  // Frågor och svar

  static async listQuestions(noticeId: string): Promise<ProcurementRfiQuestion[]> {
    const { data, error } = await supabase
      .from('procurement_rfi_questions')
      .select('*')
      .eq('notice_id', noticeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) fail('Kunde inte hämta frågorna', error)
    return (data ?? []) as unknown as ProcurementRfiQuestion[]
  }

  static async saveAnswer(id: string, patch: RfiAnswerPatch): Promise<void> {
    const updated_by = await currentUserId()
    const { error } = await supabase
      .from('procurement_rfi_questions')
      .update({ ...patch, updated_by } as never)
      .eq('id', id)
    if (error) fail('Kunde inte spara svaret', error)
  }

  /** "Läs in frågorna". Finns frågor ur dokumentet returneras conflict med antalet. */
  static async readDocument(documentId: string, replace = false): Promise<RfiReadResponse | { conflict: number }> {
    const r = await post<RfiReadResponse & { existing?: number }>({ action: 'read', documentId, replace }, 'Inläsningen')
    if (r.status === 409) return { conflict: r.body.existing ?? 0 }
    return r.body
  }

  static async draft(questionId: string): Promise<{ answer: string; choice: 'ja' | 'nej' | null; gaps: number }> {
    const r = await post<{ answer: string; choice: 'ja' | 'nej' | null; gaps: number }>({ action: 'draft', questionId }, 'Utkastet')
    if (r.status === 409) throw new Error(r.body.error ?? 'Svaret är godkänt')
    return r.body
  }

  /** "Markera som besvarad": status och signalen Upphandling väntas */
  static async markAnswered(noticeId: string): Promise<{ signalId: string | null; created: boolean }> {
    const r = await post<{ signalId: string | null; created: boolean }>({ action: 'answered', noticeId }, 'Markera som besvarad')
    return r.body
  }

  // -------------------------------------------------------------------------
  // Läge

  static async setWorkMode(noticeId: string, mode: ProcurementWorkMode | null, title: string): Promise<void> {
    const { error } = await supabase.from('procurement_notices').update({ work_mode: mode } as never).eq('id', noticeId)
    if (error) fail('Kunde inte byta läge', error)
    await ProcurementService.addEvent(noticeId, 'update', title, null, { work_mode: mode })
  }

  // -------------------------------------------------------------------------
  // Företagsuppgifter

  static async listFacts(): Promise<ProcurementCompanyFact[]> {
    const { data, error } = await supabase.from('procurement_company_facts').select('*').order('label')
    if (error) fail('Kunde inte hämta företagsuppgifterna', error)
    return (data ?? []) as unknown as ProcurementCompanyFact[]
  }

  static async saveFacts(facts: Array<{ key: string; label: string; value: string }>): Promise<void> {
    const rows = facts.filter((f) => /^[a-z0-9_]{1,80}$/.test(f.key))
    if (rows.length === 0) return
    const updated_by = await currentUserId()
    const { error } = await supabase
      .from('procurement_company_facts')
      .upsert(rows.map((f) => ({ key: f.key, label: f.label.slice(0, 300), value: f.value.trim(), updated_by })) as never, { onConflict: 'key' })
    if (error) fail('Kunde inte spara företagsuppgifterna', error)
  }

  /** Ansvarig för upphandlingen som kontaktperson (namn, e-post, telefon) */
  static async getContact(userId: string | null): Promise<ContactPerson | null> {
    if (!userId) return null
    const { data } = await supabase.from('profiles').select('display_name, email, phone').eq('user_id', userId).maybeSingle()
    const p = data as { display_name: string | null; email: string | null; phone: string | null } | null
    return p ? { name: p.display_name, email: p.email, phone: p.phone } : null
  }

  // -------------------------------------------------------------------------
  // Uppföljning

  static async getSignal(noticeId: string): Promise<ProcurementSignal | null> {
    const { data, error } = await supabase.from('procurement_signals').select('*').eq('notice_id', noticeId).order('created_at').limit(1).maybeSingle()
    if (error) fail('Kunde inte hämta signalen', error)
    return (data as unknown as ProcurementSignal | null) ?? null
  }

  /** Senare annonser hos samma köpare som liknar RFI:n */
  static async listFollowUps(
    rfi: Pick<ProcurementNotice, 'id' | 'title' | 'buyer_id' | 'buyer_name' | 'published_at' | 'created_at'>
  ): Promise<Array<FollowUpCandidate & { score: number }>> {
    let q = supabase.from('procurement_notices').select('id, title, buyer_id, buyer_name, notice_kind, published_at, tender_deadline, bgu_number').neq('id', rfi.id)
    if (rfi.buyer_id) q = q.eq('buyer_id', rfi.buyer_id)
    else if (rfi.buyer_name) q = q.ilike('buyer_name', rfi.buyer_name.replace(/[%_,]/g, ' '))
    else return []
    const { data, error } = await q.order('published_at', { ascending: false, nullsFirst: false }).limit(200)
    if (error) fail('Kunde inte söka efter annonsen', error)
    return matchFollowUps(rfi, (data ?? []) as unknown as FollowUpCandidate[]).slice(0, 5)
  }

  /**
   * Sparar godkända svar (fritext och ja/nej) som poster i anbudsbiblioteket
   * med taggarna rfi, köparen och avsnittet. Frågor som redan sparats hoppas över.
   */
  static async saveToLibrary(notice: Pick<ProcurementNotice, 'id' | 'buyer_name' | 'title'>, questions: ProcurementRfiQuestion[]): Promise<number> {
    const created_by = await currentUserId()
    const todo = questions.filter(
      (q) => q.answer_status === 'godkand' && !q.library_answer_id && (q.answer_type === 'fritext' || q.answer_type === 'ja_nej') && answerAsText(q).trim()
    )
    let saved = 0
    for (const q of todo) {
      const title = q.question.split('\n')[0].replace(/\s+/g, ' ').slice(0, 140)
      const tags = ['rfi', notice.buyer_name, q.section].filter((t): t is string => !!t && !!t.trim()).map((t) => t.trim().slice(0, 80))
      const { data, error } = await supabase
        .from('procurement_answers')
        .insert({
          title,
          answer: answerAsText(q),
          criterion_type: 'annat',
          criterion_text: [q.context, q.question].filter(Boolean).join('\n\n').slice(0, 4000),
          tags,
          source_notice_id: notice.id,
          created_by,
        } as never)
        .select('id')
        .single()
      if (error) fail('Kunde inte spara i anbudsbiblioteket', error)
      const answerId = (data as unknown as { id: string }).id
      const { error: linkErr } = await supabase.from('procurement_rfi_questions').update({ library_answer_id: answerId } as never).eq('id', q.id)
      if (linkErr) fail('Svaret sparades men frågan kunde inte kopplas', linkErr)
      saved++
    }
    return saved
  }
}
