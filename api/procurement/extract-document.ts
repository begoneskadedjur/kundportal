// api/procurement/extract-document.ts
// POST { documentId } - AI-läsning av ett uppladdat dokument i upphandlingsportalen.
//
// Flöde (docs/upphandlingsportal-plan.md avsnitt 5 och 5b):
//   1. KLIENTEN laddar själv upp filen till storage-bucketen
//      'procurement-documents' (t.ex. `{noticeId}/{uuid}-{filnamn}`) och skapar
//      raden i procurement_documents (notice_id, storage_path, file_name,
//      mime_type, size_bytes, doc_type, origin 'upload', uploaded_by). RLS
//      tillåter båda för upphandlingsansvariga.
//   2. Klienten anropar sedan denna endpoint med dokumentets id.
//   3. Endpointen hämtar filen med service role, sätter ai_status 'running' och
//      kör antingen underlagsextraktionen (förfrågningsunderlag, bilagor) eller
//      klassningen av inkomna handlingar (tilldelningsbeslut, protokoll,
//      utvärderingsrapport, prisbilaga) och sparar resultatet.
//   4. Upphandlingen får ENDAST tomma fält ifyllda; manuella värden skrivs aldrig
//      över. Kravlistan och frågorna skapas bara om det inte redan finns
//      AI-rader, så en omkörning dubblerar inget.
//   5. Anbudsgivare ur handlingar sparas overifierade (verified false);
//      ansvarig godkänner siffrorna i UI:t.
//
// Dokumentens innehåll är DATA, aldrig instruktioner (se api/_lib/procurementAi.ts).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, requireProcurementAccess, upsertBidder } from '../_lib/procurement'
import { classifyInboundDocument, extractTenderDocument, fileToParts } from '../_lib/procurementAi'
import type { ProcurementCriteriaType, ProcurementExtraction } from '../../src/types/procurement'

export const config = { maxDuration: 300 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INBOUND_TYPES = ['award_decision', 'opening_protocol', 'evaluation_report', 'price_appendix']
const MAX_FILE_BYTES = 50 * 1024 * 1024

type NoticeRow = Record<string, unknown> & { id: string; title: string; buyer_name: string | null }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte' })
  const auth = await requireProcurementAccess(req, res)
  if (!auth) return

  const documentId = typeof req.body?.documentId === 'string' ? req.body.documentId.trim() : ''
  if (!UUID_RE.test(documentId)) return res.status(400).json({ error: 'documentId saknas eller är ogiltigt' })

  const sb = db()
  const { data: doc, error: docErr } = await sb.from('procurement_documents').select('*').eq('id', documentId).maybeSingle()
  if (docErr) return res.status(500).json({ error: docErr.message })
  if (!doc) return res.status(404).json({ error: 'Dokumentet finns inte' })

  const { data: actor } = await sb.from('profiles').select('display_name').eq('user_id', auth.userId).maybeSingle()
  const actorName = (actor?.display_name as string | null) ?? auth.email ?? 'Okänd'

  await sb.from('procurement_documents').update({ ai_status: 'running', ai_error: null }).eq('id', documentId)

  try {
    const { data: blob, error: dlErr } = await sb.storage.from('procurement-documents').download(doc.storage_path)
    if (dlErr || !blob) throw new Error(`Filen kunde inte hämtas ur lagringen: ${dlErr?.message ?? 'okänt fel'}`)
    const buffer = Buffer.from(await blob.arrayBuffer())
    if (buffer.length > MAX_FILE_BYTES) throw new Error('Filen är större än 50 MB')

    const parts = await fileToParts(buffer, doc.mime_type, doc.file_name)
    const classify =
      INBOUND_TYPES.includes(doc.doc_type) || (doc.origin === 'email' && ['unknown', 'other', 'rejection'].includes(doc.doc_type))

    let notice: NoticeRow | null = null
    if (doc.notice_id) {
      const { data } = await sb.from('procurement_notices').select('*').eq('id', doc.notice_id).maybeSingle()
      notice = data as NoticeRow | null
    }

    if (classify) {
      const result = await classifyInboundDocument(parts, {
        noticeTitle: notice?.title ?? null,
        buyerName: notice?.buyer_name ?? null,
        fileName: doc.file_name,
      })
      const extraction: ProcurementExtraction = { doc_type: result.doc_type, bidders: result.bidders, summary: result.summary }
      // Användarens klassning vinner; AI:n sätter bara typ på oklassade handlingar
      const newType = ['unknown', 'other'].includes(doc.doc_type) && result.doc_type !== 'other' ? result.doc_type : doc.doc_type
      await sb
        .from('procurement_documents')
        .update({ doc_type: newType, ai_extraction: extraction, ai_summary: result.summary, ai_status: 'done', ai_error: null })
        .eq('id', documentId)

      for (const b of result.bidders) {
        await upsertBidder({
          source: 'document',
          sourceRef: `doc:${documentId}`,
          noticeId: doc.notice_id,
          name: b.name,
          orgNumber: b.org_number,
          price: b.price,
          score: b.score,
          rank: b.rank,
          isWinner: b.is_winner === true,
          documentId,
          inboundEmailId: (doc.inbound_email_id as string | null) ?? null,
          raw: b,
        })
      }

      await sb.from('procurement_events').insert({
        notice_id: doc.notice_id,
        event_type: 'document_extracted',
        title: `Handling läst: ${doc.file_name}`,
        detail: result.summary ?? `${result.bidders.length} anbudsgivare hittade`,
        metadata: { document_id: documentId, doc_type: newType, bidders: result.bidders.length, mode: 'classify' },
        actor_id: auth.userId,
        actor_name: actorName,
      })
      return res.status(200).json({ ok: true, mode: 'classify', docType: newType, bidders: result.bidders.length, summary: result.summary })
    }

    const extraction = await extractTenderDocument(parts)
    await sb
      .from('procurement_documents')
      .update({ ai_extraction: extraction, ai_summary: extraction.summary ?? null, ai_status: 'done', ai_error: null })
      .eq('id', documentId)

    let filled: string[] = []
    let requirementsCreated = 0
    let questionsCreated = 0
    if (notice) {
      filled = await mirrorToNotice(notice, extraction)
      requirementsCreated = await createRequirements(notice.id, extraction, auth.userId)
      questionsCreated = await createQuestions(notice.id, extraction, auth.userId)
    }

    await sb.from('procurement_events').insert({
      notice_id: doc.notice_id,
      event_type: 'document_extracted',
      title: `Underlag läst: ${doc.file_name}`,
      detail: [
        filled.length ? `Ifyllda fält: ${filled.join(', ')}` : null,
        requirementsCreated ? `${requirementsCreated} krav i kravlistan` : null,
        questionsCreated ? `${questionsCreated} frågeförslag` : null,
      ]
        .filter(Boolean)
        .join('. ') || 'Inga nya fält att fylla',
      metadata: { document_id: documentId, mode: 'extract', filled, requirements: requirementsCreated, questions: questionsCreated },
      actor_id: auth.userId,
      actor_name: actorName,
    })

    return res.status(200).json({
      ok: true,
      mode: 'extract',
      summary: extraction.summary ?? null,
      filled,
      requirementsCreated,
      questionsCreated,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/extract-document]', documentId, message)
    await sb.from('procurement_documents').update({ ai_status: 'failed', ai_error: message.slice(0, 1000) }).eq('id', documentId)
    return res.status(502).json({ error: `AI-läsningen misslyckades: ${message}` })
  }
}

/** Kriterietyp ur kriterielistan: bara pris, bara kvalitet, annars blandat */
function deriveCriteriaType(criteria: ProcurementExtraction['criteria']): ProcurementCriteriaType | null {
  const list = criteria ?? []
  if (list.length === 0) return null
  if (list.every((c) => c.type === 'price')) return 'price'
  if (list.every((c) => c.type === 'quality')) return 'quality'
  return 'mixed'
}

const isEmpty = (v: unknown) =>
  v == null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/** Fyller bara tomma fält på upphandlingen. Returnerar namnen på de fält som fylldes. */
async function mirrorToNotice(notice: NoticeRow, x: ProcurementExtraction): Promise<string[]> {
  const patch: Record<string, unknown> = {}
  const fill = (col: string, val: unknown) => {
    if (isEmpty(val)) return
    if (isEmpty(notice[col])) patch[col] = val
  }

  fill('questions_deadline', x.questions_deadline)
  fill('tender_deadline', x.tender_deadline)
  fill('duration_months', x.contract?.duration_months ?? null)
  fill('criteria_type', deriveCriteriaType(x.criteria))
  fill('criteria_weights', (x.criteria ?? []).map((c) => ({ name: c.name, weight: c.weight, type: c.type })))
  if (x.price_model) {
    const text = [x.price_model.kind, x.price_model.description].filter(Boolean).join(': ')
    fill('price_model', text || null)
  }
  if (x.volumes) {
    // source_page hör till extraktionen, inte till upphandlingens volymfält
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source_page, ...volumes } = x.volumes
    fill('volumes', Object.fromEntries(Object.entries(volumes).filter(([, v]) => v != null)))
  }
  fill('ai_summary', x.summary)
  fill('ai_deciders', x.deciders)
  const reqSummary = {
    penalties: x.penalties ?? [],
    references: x.references ?? null,
    response_time: x.response_time ?? null,
    certifications: x.certifications ?? [],
    contract: x.contract ?? null,
  }
  const hasReq =
    reqSummary.penalties.length > 0 || reqSummary.references || reqSummary.response_time || reqSummary.certifications.length > 0 || reqSummary.contract
  if (hasReq) fill('requirements_summary', reqSummary)

  const keys = Object.keys(patch)
  if (keys.length > 0) {
    const { error } = await db().from('procurement_notices').update(patch).eq('id', notice.id)
    if (error) throw new Error(`Upphandlingen kunde inte uppdateras: ${error.message}`)
  }
  return keys
}

/** Kravlistan ur extraktionen, bara om upphandlingen saknar AI-krav */
async function createRequirements(noticeId: string, x: ProcurementExtraction, userId: string): Promise<number> {
  const reqs = x.requirements ?? []
  if (reqs.length === 0) return 0
  const sb = db()
  const { count } = await sb
    .from('procurement_requirements')
    .select('id', { count: 'exact', head: true })
    .eq('notice_id', noticeId)
    .eq('source', 'ai')
  if ((count ?? 0) > 0) return 0
  const rows = reqs.map((r, i) => ({
    notice_id: noticeId,
    text: r.text,
    req_type: r.type,
    weight: r.weight ?? null,
    page: r.page ?? null,
    source: 'ai',
    sort_order: (i + 1) * 10,
    created_by: userId,
  }))
  const { error } = await sb.from('procurement_requirements').insert(rows)
  if (error) throw new Error(`Kravlistan kunde inte sparas: ${error.message}`)
  return rows.length
}

/** Frågor till köparen ur extraktionen, bara om upphandlingen saknar AI-frågor */
async function createQuestions(noticeId: string, x: ProcurementExtraction, userId: string): Promise<number> {
  const qs = x.suggested_questions ?? []
  if (qs.length === 0) return 0
  const sb = db()
  const { count } = await sb
    .from('procurement_questions')
    .select('id', { count: 'exact', head: true })
    .eq('notice_id', noticeId)
    .eq('source', 'ai')
  if ((count ?? 0) > 0) return 0
  const rows = qs.map((q) => ({
    notice_id: noticeId,
    question: q.question,
    reason: q.reason ?? null,
    source: 'ai',
    status: 'draft',
    created_by: userId,
  }))
  const { error } = await sb.from('procurement_questions').insert(rows)
  if (error) throw new Error(`Frågorna kunde inte sparas: ${error.message}`)
  return rows.length
}
