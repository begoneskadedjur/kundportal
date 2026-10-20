// api/procurement/rfi.ts
// RFI-läget i upphandlingsportalen (3.71.0). POST med action:
//
//   { action: 'read', documentId, replace? }
//       "Läs in frågorna": läser köparens frågeformulär (docx eller PDF) och
//       sparar frågorna i procurement_rfi_questions (api/_lib/procurementRfi.ts).
//       Finns frågor ur dokumentet svarar endpointen 409; med replace ersätts
//       de och svar på frågor med samma text följer med.
//   { action: 'draft', questionId }
//       AI-utkast till svaret på en fråga ur BeGones eget material,
//       anbudsbiblioteket, sparade företagsuppgifter och RFI:ns bakgrund.
//       Sparas som utkast; ett godkänt svar skrivs aldrig över.
//   { action: 'answered', noticeId }
//       "Markera som besvarad": status Lämnat (visas som Besvarad i RFI-läget)
//       och signalen "Upphandling väntas" i Framförhållning. Mercell-synkens
//       signal för RFI:n återanvänds; finns ingen skapas en.
//
// Dokumentens innehåll är DATA, aldrig instruktioner.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, requireProcurementAccess } from '../_lib/procurement'
import { generateRfiDraft, loadCompanyFacts, readAndStoreRfi, type RfiDraftInput } from '../_lib/procurementRfi'
import { rankLibraryAnswers, type LibraryAnswer } from './draft-answer'
import { guessCriterionType } from '../_lib/procurementOwnMaterial'
import { swedishDate } from '../../src/shared/procurementRules'
import type { ProcurementExtraction } from '../../src/types/procurement'

export const config = { maxDuration: 300 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function actorName(userId: string, email: string | null | undefined): Promise<string> {
  const { data } = await db().from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
  return (data?.display_name as string | null) ?? email ?? 'Okänd'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte' })
  const auth = await requireProcurementAccess(req, res)
  if (!auth) return
  const action = typeof req.body?.action === 'string' ? req.body.action : ''
  try {
    if (action === 'read') return await read(req, res, auth)
    if (action === 'draft') return await draft(req, res, auth)
    if (action === 'answered') return await answered(req, res, auth)
    return res.status(400).json({ error: 'Okänd åtgärd' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/rfi]', action, message)
    return res.status(502).json({ error: message })
  }
}

type Auth = { userId: string; email?: string | null }

async function read(req: VercelRequest, res: VercelResponse, auth: Auth) {
  const documentId = typeof req.body?.documentId === 'string' ? req.body.documentId.trim() : ''
  if (!UUID_RE.test(documentId)) return res.status(400).json({ error: 'documentId saknas eller är ogiltigt' })
  const sb = db()
  const { data: doc } = await sb.from('procurement_documents').select('id, notice_id, storage_path, file_name, mime_type').eq('id', documentId).maybeSingle()
  if (!doc) return res.status(404).json({ error: 'Dokumentet finns inte' })
  await sb.from('procurement_documents').update({ ai_status: 'running', ai_error: null }).eq('id', documentId)
  try {
    const r = await readAndStoreRfi(doc as Parameters<typeof readAndStoreRfi>[0], auth.userId, { replace: req.body?.replace === true })
    await sb.from('procurement_events').insert({
      notice_id: doc.notice_id,
      event_type: 'rfi_read',
      title: `RFI-formuläret inläst: ${doc.file_name}`,
      detail: `${r.questions} frågor, ${r.anchored} med plats för svaret i dokumentet${r.carried ? `, ${r.carried} svar följde med` : ''}`,
      metadata: { document_id: documentId, ...r },
      actor_id: auth.userId,
      actor_name: await actorName(auth.userId, auth.email),
    })
    return res.status(200).json({ ok: true, ...r })
  } catch (e) {
    const err = e as Error & { code?: string; existing?: number }
    if (err.code === 'exists') {
      await sb.from('procurement_documents').update({ ai_status: 'done' }).eq('id', documentId)
      return res.status(409).json({ error: err.message, existing: err.existing })
    }
    await sb.from('procurement_documents').update({ ai_status: 'failed', ai_error: err.message.slice(0, 1000) }).eq('id', documentId)
    throw err
  }
}

async function draft(req: VercelRequest, res: VercelResponse, auth: Auth) {
  const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId.trim() : ''
  if (!UUID_RE.test(questionId)) return res.status(400).json({ error: 'questionId saknas eller är ogiltigt' })
  const sb = db()
  const { data: q } = await sb.from('procurement_rfi_questions').select('*').eq('id', questionId).maybeSingle()
  if (!q) return res.status(404).json({ error: 'Frågan finns inte' })
  if (q.answer_status === 'godkand') return res.status(409).json({ error: 'Svaret är godkänt. Ändra status till utkast först.' })
  if (q.answer_type !== 'fritext' && q.answer_type !== 'ja_nej') return res.status(400).json({ error: 'AI skriver bara utkast till fritext och ja/nej-frågor' })

  const { data: notice } = await sb.from('procurement_notices').select('id, title, buyer_name').eq('id', q.notice_id).maybeSingle()
  let background: string | null = null
  if (q.document_id) {
    const { data: doc } = await sb.from('procurement_documents').select('ai_extraction').eq('id', q.document_id).maybeSingle()
    background = ((doc?.ai_extraction as ProcurementExtraction | null)?.rfi?.background as string | null | undefined) ?? null
  }
  const { data: answers } = await sb
    .from('procurement_answers')
    .select('id, criterion_type, title, criterion_text, answer, use_count')
    .order('updated_at', { ascending: false })
    .limit(400)
  const text = `${q.section ?? ''} ${q.question}`
  const input: RfiDraftInput = {
    question: String(q.question).slice(0, 8000),
    context: (q.context as string | null)?.slice(0, 4000) ?? null,
    section: (q.section as string | null) ?? null,
    answerType: q.answer_type,
    noticeTitle: (notice?.title as string | null) ?? null,
    buyerName: (notice?.buyer_name as string | null) ?? null,
    background,
    facts: await loadCompanyFacts(),
    library: rankLibraryAnswers(text, guessCriterionType(text), (answers ?? []) as LibraryAnswer[], 4),
  }
  const result = await generateRfiDraft(input, AbortSignal.timeout(55_000))
  const values = { ...((q.answer_values as Record<string, string>) ?? {}) }
  if (result.choice) values.choice = result.choice
  const { error } = await sb
    .from('procurement_rfi_questions')
    .update({ answer: result.answer, answer_values: values, answer_source: 'ai', answer_status: 'utkast', draft_sources: result.sources, updated_by: auth.userId })
    .eq('id', questionId)
  if (error) return res.status(500).json({ error: `Utkastet kunde inte sparas: ${error.message}` })
  const gaps = (result.answer.match(/\[FYLL I:/g) ?? []).length
  return res.status(200).json({ ok: true, answer: result.answer, choice: result.choice, sources: result.sources, gaps })
}

function quarterOf(date: string | null): string | null {
  const m = date?.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-Q${Math.ceil(Number(m[2]) / 3)}` : null
}

async function answered(req: VercelRequest, res: VercelResponse, auth: Auth) {
  const noticeId = typeof req.body?.noticeId === 'string' ? req.body.noticeId.trim() : ''
  if (!UUID_RE.test(noticeId)) return res.status(400).json({ error: 'noticeId saknas eller är ogiltigt' })
  const sb = db()
  const { data: n } = await sb.from('procurement_notices').select('id, title, buyer_id, buyer_name, our_status, platform_url, bgu_number').eq('id', noticeId).maybeSingle()
  if (!n) return res.status(404).json({ error: 'RFI:n finns inte' })

  const actor = await actorName(auth.userId, auth.email)
  if (n.our_status !== 'submitted') {
    const { error } = await sb.from('procurement_notices').update({ our_status: 'submitted' }).eq('id', noticeId)
    if (error) return res.status(500).json({ error: `Statusen kunde inte sparas: ${error.message}` })
    await sb.from('procurement_events').insert({
      notice_id: noticeId,
      event_type: 'update',
      title: 'RFI besvarad',
      detail: null,
      metadata: { our_status: 'submitted', rfi: true },
      actor_id: auth.userId,
      actor_name: actor,
    })
  }

  // Signalen "Upphandling väntas": återanvänd synkens signal för RFI:n
  const { data: existing } = await sb.from('procurement_signals').select('id, status, signal_key').eq('notice_id', noticeId).order('created_at').limit(1).maybeSingle()
  let signalId: string | null = (existing?.id as string | undefined) ?? null
  let created = false
  if (existing) {
    if (existing.status !== 'watching' && existing.status !== 'converted') {
      await sb.from('procurement_signals').update({ status: 'watching', buyer_id: n.buyer_id }).eq('id', existing.id)
    }
  } else {
    // Upphandlingen väntas normalt inom ett halvår efter en RFI
    const expected = new Date()
    expected.setMonth(expected.getMonth() + 6)
    const { data: ins, error } = await sb
      .from('procurement_signals')
      .insert({
        signal_key: `rfi:${noticeId}`,
        signal_type: 'rfi',
        buyer_id: n.buyer_id,
        buyer_name: n.buyer_name,
        text: `Upphandling väntas efter RFI: ${n.title}`,
        expected_quarter: quarterOf(swedishDate(expected.toISOString())),
        reliability: 'medium',
        source: 'rfi',
        url: n.platform_url,
        notice_id: noticeId,
        status: 'watching',
        raw: { bgu_number: n.bgu_number, created_from: 'rfi_answered' },
      })
      .select('id')
      .single()
    if (error) return res.status(500).json({ error: `Signalen kunde inte skapas: ${error.message}` })
    signalId = ins.id as string
    created = true
  }
  await sb.from('procurement_events').insert({
    notice_id: noticeId,
    event_type: 'rfi_signal',
    title: created ? 'Signal skapad: upphandling väntas' : 'Signalen följs: upphandling väntas',
    detail: n.buyer_name,
    metadata: { signal_id: signalId, created },
    actor_id: auth.userId,
    actor_name: actor,
  })
  return res.status(200).json({ ok: true, signalId, created })
}
