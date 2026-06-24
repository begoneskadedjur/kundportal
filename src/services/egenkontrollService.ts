import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────
// Typer
// ─────────────────────────────────────────────────────────────

export type EgenkontrollAnswerType = 'yes_no' | 'percent'

export interface EgenkontrollQuestion {
  id: string
  template_id: string
  question_text: string
  answer_type: EgenkontrollAnswerType
  sort_order: number
  active: boolean
}

export interface EgenkontrollTemplate {
  id: string
  organization_id: string | null
  customer_id: string | null
  name: string
  allow_deviations: boolean
  questions: EgenkontrollQuestion[]
}

export interface EgenkontrollAnswer {
  question_id: string
  value_bool: boolean | null
  value_percent: number | null
}

export interface EgenkontrollStationReview {
  id: string
  case_id: string
  station_id: string
  note: string | null
  reviewed_at: string | null
  created_at: string
  // question_id → svar (laddas in via getReviews)
  answers: Record<string, EgenkontrollAnswer>
}

export class EgenkontrollService {
  // ─── MALL & FRÅGOR ─────────────────────────────────────────

  /**
   * Hämtar mallen (med frågor) för en kund. Kedja:
   *   organisationens mall (via customers.organization_id) → global standardmall.
   * Returnerar null om ingen mall alls finns (bör ej hända då seed skapar global).
   */
  static async getTemplateForCustomer(customerId: string): Promise<EgenkontrollTemplate | null> {
    // Hämta kundens organisation
    const { data: cust } = await supabase
      .from('customers')
      .select('organization_id')
      .eq('id', customerId)
      .maybeSingle()
    const orgId = (cust as { organization_id: string | null } | null)?.organization_id ?? null

    // Försök org-mall först, annars global (organization_id IS NULL)
    let template: { id: string; organization_id: string | null; customer_id: string | null; name: string; allow_deviations: boolean } | null = null
    if (orgId) {
      const { data } = await supabase
        .from('egenkontroll_templates')
        .select('id, organization_id, customer_id, name, allow_deviations')
        .eq('organization_id', orgId)
        .is('customer_id', null)
        .maybeSingle()
      template = data ?? null
    }
    if (!template) {
      const { data } = await supabase
        .from('egenkontroll_templates')
        .select('id, organization_id, customer_id, name, allow_deviations')
        .is('organization_id', null)
        .is('customer_id', null)
        .maybeSingle()
      template = data ?? null
    }
    if (!template) return null

    const questions = await this.getQuestions(template.id)
    return { ...template, questions }
  }

  /** Hämta mall via organization_id direkt (för admin-byggaren). Skapar EJ. */
  static async getTemplateByOrganization(organizationId: string): Promise<EgenkontrollTemplate | null> {
    const { data } = await supabase
      .from('egenkontroll_templates')
      .select('id, organization_id, customer_id, name, allow_deviations')
      .eq('organization_id', organizationId)
      .is('customer_id', null)
      .maybeSingle()
    if (!data) return null
    const questions = await this.getQuestions(data.id)
    return { ...data, questions }
  }

  /** Hämta den globala standardmallen. */
  static async getGlobalTemplate(): Promise<EgenkontrollTemplate | null> {
    const { data } = await supabase
      .from('egenkontroll_templates')
      .select('id, organization_id, customer_id, name, allow_deviations')
      .is('organization_id', null)
      .is('customer_id', null)
      .maybeSingle()
    if (!data) return null
    const questions = await this.getQuestions(data.id)
    return { ...data, questions }
  }

  static async getQuestions(templateId: string): Promise<EgenkontrollQuestion[]> {
    const { data, error } = await supabase
      .from('egenkontroll_questions')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  /** Skapa en org-mall genom att klona den globala standardmallens frågor. */
  static async createTemplateForOrganization(organizationId: string): Promise<EgenkontrollTemplate> {
    const global = await this.getGlobalTemplate()
    const { data: tpl, error } = await supabase
      .from('egenkontroll_templates')
      .insert({
        organization_id: organizationId,
        customer_id: null,
        name: 'Egenkontroll',
        allow_deviations: global?.allow_deviations ?? true,
      })
      .select('id, organization_id, customer_id, name, allow_deviations')
      .single()
    if (error) throw new Error(error.message)

    // Klona globala frågor som startpunkt
    if (global && global.questions.length > 0) {
      const rows = global.questions.map(q => ({
        template_id: tpl.id,
        question_text: q.question_text,
        answer_type: q.answer_type,
        sort_order: q.sort_order,
        active: q.active,
      }))
      await supabase.from('egenkontroll_questions').insert(rows)
    }
    const questions = await this.getQuestions(tpl.id)
    return { ...tpl, questions }
  }

  static async updateTemplate(
    templateId: string,
    patch: { name?: string; allow_deviations?: boolean }
  ): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', templateId)
    if (error) throw new Error(error.message)
  }

  static async addQuestion(
    templateId: string,
    question: { question_text: string; answer_type: EgenkontrollAnswerType; sort_order: number }
  ): Promise<EgenkontrollQuestion> {
    const { data, error } = await supabase
      .from('egenkontroll_questions')
      .insert({ template_id: templateId, ...question })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  static async updateQuestion(
    questionId: string,
    patch: Partial<Pick<EgenkontrollQuestion, 'question_text' | 'answer_type' | 'sort_order' | 'active'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_questions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', questionId)
    if (error) throw new Error(error.message)
  }

  static async deleteQuestion(questionId: string): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_questions')
      .delete()
      .eq('id', questionId)
    if (error) throw new Error(error.message)
  }

  static async reorderQuestions(updates: { id: string; sort_order: number }[]): Promise<void> {
    const ops = updates.map(u =>
      supabase.from('egenkontroll_questions').update({ sort_order: u.sort_order }).eq('id', u.id)
    )
    const results = await Promise.all(ops)
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) throw new Error(firstErr.message)
  }

  // ─── STATION-REVIEWS & SVAR ────────────────────────────────

  /**
   * Hämtar alla station-reviews för ett ärende, med svar inladdade (batch-join,
   * ingen N+1). answers nycklas på question_id.
   */
  static async getReviews(caseId: string): Promise<EgenkontrollStationReview[]> {
    const { data, error } = await supabase
      .from('egenkontroll_station_reviews')
      .select('id, case_id, station_id, note, reviewed_at, created_at, egenkontroll_review_answers(question_id, value_bool, value_percent)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)

    return (data ?? []).map((row: any) => {
      const answers: Record<string, EgenkontrollAnswer> = {}
      for (const a of (row.egenkontroll_review_answers ?? [])) {
        answers[a.question_id] = {
          question_id: a.question_id,
          value_bool: a.value_bool,
          value_percent: a.value_percent,
        }
      }
      return {
        id: row.id,
        case_id: row.case_id,
        station_id: row.station_id,
        note: row.note,
        reviewed_at: row.reviewed_at,
        created_at: row.created_at,
        answers,
      }
    })
  }

  /** Eager-skapa review-raden för en station (måste finnas innan svar skrivs). */
  static async addStation(caseId: string, stationId: string): Promise<EgenkontrollStationReview> {
    const { data, error } = await supabase
      .from('egenkontroll_station_reviews')
      .insert({ case_id: caseId, station_id: stationId })
      .select('id, case_id, station_id, note, reviewed_at, created_at')
      .single()
    if (error) throw new Error(error.message)
    return { ...data, answers: {} }
  }

  static async removeStation(caseId: string, stationId: string): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_station_reviews')
      .delete()
      .eq('case_id', caseId)
      .eq('station_id', stationId)
    if (error) throw new Error(error.message)
  }

  /**
   * Säkerställ att review-raden finns (get-or-create på case_id+station_id) och
   * returnera dess id. Skyddar mot FK-race när svar skrivs innan addStation hunnit.
   */
  static async ensureReview(caseId: string, stationId: string): Promise<string> {
    const { data: existing } = await supabase
      .from('egenkontroll_station_reviews')
      .select('id')
      .eq('case_id', caseId)
      .eq('station_id', stationId)
      .maybeSingle()
    if (existing) return existing.id
    const created = await this.addStation(caseId, stationId)
    return created.id
  }

  /** Spara/uppdatera ett typat svar för en fråga på en station-review. */
  static async upsertAnswer(
    reviewId: string,
    questionId: string,
    value: { value_bool?: boolean | null; value_percent?: number | null }
  ): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_review_answers')
      .upsert(
        {
          review_id: reviewId,
          question_id: questionId,
          value_bool: value.value_bool ?? null,
          value_percent: value.value_percent ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'review_id,question_id' }
      )
    // Uppdatera reviewens tidsstämpel
    await supabase
      .from('egenkontroll_station_reviews')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', reviewId)
    if (error) throw new Error(error.message)
  }

  /** Spara notering på review-raden. */
  static async upsertNote(caseId: string, stationId: string, note: string): Promise<void> {
    const { error } = await supabase
      .from('egenkontroll_station_reviews')
      .upsert(
        { case_id: caseId, station_id: stationId, note, reviewed_at: new Date().toISOString() },
        { onConflict: 'case_id,station_id' }
      )
    if (error) throw new Error(error.message)
  }

  // ─── RÄKNING (mall-driven) ─────────────────────────────────

  /** Antal godkända yes_no-svar (value_bool === true). */
  static countChecked(review: EgenkontrollStationReview, questions: EgenkontrollQuestion[]): number {
    return questions.filter(q => {
      const a = review.answers[q.id]
      return q.answer_type === 'yes_no' && a?.value_bool === true
    }).length
  }

  /** Antal ej godkända yes_no-svar (value_bool === false). */
  static countFailed(review: EgenkontrollStationReview, questions: EgenkontrollQuestion[]): number {
    return questions.filter(q => {
      const a = review.answers[q.id]
      return q.answer_type === 'yes_no' && a?.value_bool === false
    }).length
  }

  /** Antal yes_no-frågor i mallen (nämnare för "x/y godkända"). */
  static yesNoQuestionCount(questions: EgenkontrollQuestion[]): number {
    return questions.filter(q => q.active && q.answer_type === 'yes_no').length
  }
}
