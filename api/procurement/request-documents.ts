// api/procurement/request-documents.ts
// POST { noticeId, docTypes, recipientEmail, awardId?, message?, preview? }
// Begäran om allmän handling till köparens registratur (docs/upphandlingsportal-plan.md avsnitt 5c, steg 1).
//
// Skickas från PROCUREMENT_FROM_EMAIL med svarsadressen
// upphandling+bgu-{nr}@{PROCUREMENT_REPLY_DOMAIN} och taggen [BGU-{nr}] i ämnet,
// så att svaret matchas automatiskt av api/procurement/inbound-email.ts.
// preview=true returnerar bara ämne och text utan att skicka något.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  PROCUREMENT_FROM_EMAIL,
  db,
  escapeHtml,
  replyAddressFor,
  requireProcurementAccess,
  sendEmail,
} from '../_lib/procurement'
import { swedishDate } from '../../src/shared/procurementRules'
import { DOCUMENT_REQUEST_TYPES } from '../../src/types/procurement'

export const config = { maxDuration: 30 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@<>()",;:]+@[a-z0-9.-]+\.[a-z]{2,}$/i

const BEGONE_NAME = 'BeGone Skadedjur & Sanering AB'
const BEGONE_ORG = '559378-9208'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte' })
  const auth = await requireProcurementAccess(req, res)
  if (!auth) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const noticeId = typeof body.noticeId === 'string' ? body.noticeId.trim() : ''
  const awardId = typeof body.awardId === 'string' && body.awardId.trim() ? body.awardId.trim() : null
  const recipientEmail = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim().toLowerCase() : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  const preview = body.preview === true
  const validKeys = DOCUMENT_REQUEST_TYPES.map((t) => t.key)
  const docTypes = Array.isArray(body.docTypes)
    ? Array.from(new Set(body.docTypes.filter((t): t is string => typeof t === 'string' && validKeys.includes(t))))
    : []

  if (!UUID_RE.test(noticeId)) return res.status(400).json({ error: 'noticeId saknas eller är ogiltigt' })
  if (awardId && !UUID_RE.test(awardId)) return res.status(400).json({ error: 'awardId är ogiltigt' })
  if (docTypes.length === 0) return res.status(400).json({ error: 'Välj minst en handling' })
  if (!EMAIL_RE.test(recipientEmail)) return res.status(400).json({ error: 'Mottagarens e-postadress är ogiltig' })

  const sb = db()
  const { data: notice, error: nErr } = await sb
    .from('procurement_notices')
    .select('id, bgu_number, title, buyer_id, buyer_name, award_decision_at')
    .eq('id', noticeId)
    .maybeSingle()
  if (nErr) return res.status(500).json({ error: nErr.message })
  if (!notice) return res.status(404).json({ error: 'Upphandlingen finns inte' })

  // Köparens tilldelning: vald, annars senaste på upphandlingen
  let award: { id: string; award_date: string | null; source_ref: string | null } | null = null
  {
    const q = sb.from('procurement_awards').select('id, award_date, source_ref, notice_id')
    const { data } = awardId
      ? await q.eq('id', awardId).limit(1)
      : await q.eq('notice_id', noticeId).order('award_date', { ascending: false, nullsFirst: false }).limit(1)
    award = data?.[0] ?? null
    if (awardId && !award) return res.status(404).json({ error: 'Tilldelningen finns inte' })
  }

  const { data: buyer } = notice.buyer_id
    ? await sb.from('procurement_buyers').select('id, name, registrar_email').eq('id', notice.buyer_id).maybeSingle()
    : { data: null }
  const { data: me } = await sb.from('profiles').select('display_name').eq('user_id', auth.userId).maybeSingle()
  const senderName = (me?.display_name as string | null) ?? null

  const replyTo = replyAddressFor(notice.bgu_number)
  const tag = `BGU-${notice.bgu_number}`
  const subject = `Begäran om allmän handling: ${notice.title} [${tag}]`
  const decisionDate = swedishDate(award?.award_date ?? notice.award_decision_at ?? null)
  const labels = docTypes.map((k) => DOCUMENT_REQUEST_TYPES.find((t) => t.key === k)?.label ?? k)

  const text = buildLetter({
    buyerName: buyer?.name ?? notice.buyer_name ?? null,
    title: notice.title,
    decisionDate,
    labels,
    replyTo,
    tag,
    message,
    senderName,
  })

  if (preview) return res.status(200).json({ ok: true, preview: true, subject, text, replyTo, recipientEmail })

  let resendId: string | null
  try {
    resendId = await sendEmail({
      to: [recipientEmail],
      subject,
      text,
      html: letterHtml(text),
      from: PROCUREMENT_FROM_EMAIL,
      replyTo,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[procurement/request-documents] utskick misslyckades', msg)
    return res.status(502).json({ error: `E-postmeddelandet kunde inte skickas: ${msg}` })
  }

  const now = new Date().toISOString()
  const { data: request, error: rErr } = await sb
    .from('procurement_document_requests')
    .insert({
      notice_id: noticeId,
      award_id: award?.id ?? null,
      buyer_id: notice.buyer_id ?? null,
      doc_types: docTypes,
      recipient_email: recipientEmail,
      reply_to: replyTo,
      subject,
      body: text,
      status: 'sent',
      sent_at: now,
      resend_message_id: resendId,
      created_by: auth.userId,
    })
    .select('id')
    .single()
  if (rErr) {
    // Mejlet är skickat; svaret matchas ändå på svarsadressen
    console.error('[procurement/request-documents] begäran skickad men inte sparad', rErr.message)
    return res.status(500).json({ error: `Begäran skickades men kunde inte sparas: ${rErr.message}`, sent: true, resendId })
  }

  if (buyer && !buyer.registrar_email) {
    await sb.from('procurement_buyers').update({ registrar_email: recipientEmail }).eq('id', buyer.id)
  }

  await sb.from('procurement_events').insert({
    notice_id: noticeId,
    award_id: award?.id ?? null,
    event_type: 'document_requested',
    title: 'Begäran om allmän handling skickad',
    detail: `${labels.join(', ')} till ${recipientEmail}`,
    metadata: { request_id: request.id, doc_types: docTypes, recipient: recipientEmail, resend_message_id: resendId },
    actor_id: auth.userId,
    actor_name: senderName ?? auth.email ?? null,
  })

  return res.status(200).json({ ok: true, requestId: request.id, subject, replyTo, resendId })
}

interface LetterInput {
  buyerName: string | null
  title: string
  decisionDate: string | null
  labels: string[]
  replyTo: string
  tag: string
  message: string
  senderName: string | null
}

function buildLetter(i: LetterInput): string {
  const lines: string[] = []
  lines.push(i.buyerName ? `Till registratorn, ${i.buyerName}` : 'Till registratorn')
  lines.push('')
  lines.push('Hej,')
  lines.push('')
  lines.push(
    `${BEGONE_NAME} begär med stöd av offentlighetsprincipen i 2 kap. tryckfrihetsförordningen att få ta del av följande allmänna handlingar i upphandlingen "${i.title}"${i.decisionDate ? ` (tilldelningsbeslut ${i.decisionDate})` : ''}:`
  )
  lines.push('')
  for (const l of i.labels) lines.push(`- ${l}`)
  lines.push('')
  lines.push(
    'Enligt 2 kap. tryckfrihetsförordningen ska en begäran om att ta del av allmänna handlingar behandlas skyndsamt. Vi ber om kopior i elektronisk form, helst PDF, per e-post till ' +
      `${i.replyTo}.`
  )
  lines.push('')
  lines.push(
    'Om någon uppgift bedöms omfattas av sekretess ber vi att få handlingarna med just de uppgifterna maskerade. Om begäran avslås helt eller delvis ber vi om ett skriftligt beslut med hänvisning till tillämplig bestämmelse och en upplysning om hur beslutet överklagas.'
  )
  lines.push('')
  lines.push('Om ni tar ut en avgift för kopiorna ber vi er meddela beloppet innan handlingarna skickas.')
  if (i.message) {
    lines.push('')
    lines.push(i.message)
  }
  lines.push('')
  lines.push(`Ange gärna referensen [${i.tag}] i ämnesraden när ni svarar.`)
  lines.push('')
  lines.push('Med vänliga hälsningar')
  if (i.senderName) lines.push(i.senderName)
  lines.push(BEGONE_NAME)
  lines.push(`Org.nr ${BEGONE_ORG}`)
  lines.push(i.replyTo)
  return lines.join('\n')
}

/** Brevet som enkel HTML: samma text, radbrytningar bevarade */
function letterHtml(text: string): string {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:640px;margin:0 auto;padding:24px;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(text)}</div>
</body></html>`
}
