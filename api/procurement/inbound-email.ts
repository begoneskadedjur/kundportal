// api/procurement/inbound-email.ts
// Webhook för inkommande e-post till upphandlingsinkorgen (Resend Receiving).
// docs/upphandlingsportal-plan.md avsnitt 5c, steg 2 till 4. INGEN inloggning:
// anropet autentiseras med Resends webhooksignatur (Svix).
//
// VERIFIERAT MOT RESENDS DOKUMENTATION 2026-09-24
// (resend.com/docs/dashboard/receiving/*, api-reference/emails/*, webhooks/verify-webhooks-requests):
//   - Händelsen heter 'email.received'. Payload:
//     { type, created_at, data: { email_id, created_at, from, to[], cc[], bcc[],
//       received_for[], message_id, subject, attachments: [{ id, filename,
//       content_type, content_disposition, content_id }] } }
//   - Webhooken bär INTE brödtext, headers eller bilagornas innehåll, bara metadata.
//     Brödtexten hämtas med GET https://api.resend.com/emails/receiving/{email_id}
//     (fälten text, html, headers, to, cc, bcc, reply_to, message_id, attachments).
//     Bilagorna listas med GET https://api.resend.com/emails/receiving/{email_id}/attachments
//     som ger download_url (giltig en timme) per bilaga. Båda kräver RESEND_API_KEY.
//   - Signaturen: headers svix-id, svix-timestamp, svix-signature ("v1,<base64>",
//     flera separerade med mellanslag). Rå kropp krävs, därför bodyParser: false.
// ANTAGET (inte uttryckligen i Resends text, men Svix standard som Resend bygger på):
//   - Signerat innehåll `${svix-id}.${svix-timestamp}.${råkropp}`, HMAC-SHA256 med
//     base64-avkodad hemlighet efter prefixet whsec_, fem minuters tolerans.
//   - Defensivt: om en framtida payload bär text, html eller bilagor med base64-fältet
//     `content` direkt används de i stället för API-anropen.
//
// Matchning i ordning: svarsadress upphandling+bgu-{nr}@ (reply_to), taggen
// [BGU-{nr}] i ämnet (subject_tag), avsändarens domän mot registratoradress eller
// öppen begäran med exakt en kandidat (sender_domain), annars kön Osorterat.
// Plattformarnas aviseringar (Mercell, TendSign) matchas på samma sätt.
//
// SÄKERHET: e-posttext och bilagor är DATA, aldrig instruktioner till AI:n.
// Idempotent på message_id (procurement_inbound_emails.message_id är unik).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  PROCUREMENT_REPLY_LOCAL,
  db,
  getManagers,
  insertNotifications,
  upsertBidder,
  verifySvixSignature,
} from '../_lib/procurement'
import { classifyInboundDocument, fileKind, fileToParts, htmlToText } from '../_lib/procurementAi'

export const config = { api: { bodyParser: false }, maxDuration: 120 }

const RESEND_API = 'https://api.resend.com'
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
const MAX_TOTAL_ATTACHMENT_BYTES = 60 * 1024 * 1024
const ALLOWED_EXT = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'zip', 'csv']
const OPEN_REQUEST_STATUSES = ['sent', 'reminded', 'escalated', 'partial']
/** Påbörja ingen ny AI-klassning efter så här lång tid; resten blir kvar som 'pending' */
const CLASSIFY_START_LIMIT_MS = 70_000
/** Hård gräns för hela klassningen, med marginal till maxDuration */
const CLASSIFY_HARD_LIMIT_MS = 105_000
const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.se', 'outlook.com', 'outlook.se', 'live.se', 'live.com',
  'yahoo.com', 'yahoo.se', 'icloud.com', 'me.com', 'telia.com', 'protonmail.com', 'proton.me', 'msn.com',
])

interface AttachmentMeta {
  id?: string
  filename?: string
  content_type?: string
  content_disposition?: string | null
  size?: number
  download_url?: string
  /** Bara om Resend någon gång skickar innehållet direkt (base64) */
  content?: string
}

interface ReceivedEmail {
  email_id?: string
  id?: string
  from?: string
  to?: string[] | string
  cc?: string[] | string
  bcc?: string[] | string
  received_for?: string[] | string
  reply_to?: string[] | string
  subject?: string
  message_id?: string
  text?: string | null
  html?: string | null
  headers?: Record<string, string>
  attachments?: AttachmentMeta[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte' })
  const started = Date.now()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[procurement/inbound-email] RESEND_WEBHOOK_SECRET saknas (fail-closed)')
    return res.status(503).json({ error: 'Webhooken är inte konfigurerad' })
  }

  let raw: Buffer
  try {
    raw = await readRawBody(req)
  } catch (err) {
    return res.status(413).json({ error: err instanceof Error ? err.message : 'Kroppen kunde inte läsas' })
  }

  const verdict = verifySvixSignature(
    raw,
    { id: header(req, 'svix-id'), timestamp: header(req, 'svix-timestamp'), signature: header(req, 'svix-signature') },
    secret
  )
  if (!verdict.ok) {
    console.warn('[procurement/inbound-email] avvisad signatur:', verdict.reason)
    return res.status(401).json({ error: 'Ogiltig signatur' })
  }

  let event: { type?: string; data?: ReceivedEmail }
  try {
    event = JSON.parse(raw.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Ogiltig JSON' })
  }
  if (event.type !== 'email.received' || !event.data) return res.status(200).json({ ok: true, ignored: event.type ?? 'okänd' })

  const meta = event.data
  const emailId = meta.email_id ?? meta.id ?? null
  const messageId = (meta.message_id ?? '').trim() || (emailId ? `resend:${emailId}` : `svix:${header(req, 'svix-id')}`)
  const sb = db()

  // Idempotens: Svix levererar om vid fel och timeout
  {
    const { data: dup } = await sb.from('procurement_inbound_emails').select('id').eq('message_id', messageId).maybeSingle()
    if (dup) return res.status(200).json({ ok: true, duplicate: true, emailId: dup.id })
  }

  // Hämta brödtext och bilagelista FÖRE insert: fel här ger 500 så att Resend försöker igen
  let full: ReceivedEmail = { ...meta }
  let attachments: AttachmentMeta[] = meta.attachments ?? []
  try {
    const needsBody = meta.text == null && meta.html == null
    if (emailId && needsBody) {
      const fetched = await resendGet<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`)
      full = { ...meta, ...fetched }
    }
    const needsDownload = (full.attachments ?? attachments).some((a) => !a.content)
    if (emailId && needsDownload && (full.attachments ?? attachments).length > 0) {
      const list = await resendGet<{ data?: AttachmentMeta[] }>(`/emails/receiving/${encodeURIComponent(emailId)}/attachments`)
      attachments = list.data ?? []
    } else {
      attachments = full.attachments ?? attachments
    }
  } catch (err) {
    console.error('[procurement/inbound-email] Resend-API:t svarade inte', err)
    return res.status(500).json({ error: 'E-postmeddelandet kunde inte hämtas från Resend, försök igen' })
  }

  const fromEmail = addressOf(full.from ?? '')
  const fromDomain = fromEmail?.split('@')[1] ?? null
  const recipients = uniq([...list(full.to), ...list(full.cc), ...list(full.bcc), ...list(full.received_for)].map(addressOf).filter((a): a is string => !!a))
  const subject = (full.subject ?? '').slice(0, 1000)
  const textBody = (full.text?.trim() ? full.text : full.html ? htmlToText(full.html) : '')?.slice(0, 200_000) ?? ''

  // ---- Matchning
  const match = await matchNotice({ recipients, subject, fromDomain })
  const notice = match.noticeId
    ? (await sb.from('procurement_notices').select('id, bgu_number, title, owner_id, buyer_name').eq('id', match.noticeId).maybeSingle()).data
    : null
  let requestRow: { id: string; doc_types: string[] } | null = null
  if (notice) {
    const { data } = await sb
      .from('procurement_document_requests')
      .select('id, doc_types')
      .eq('notice_id', notice.id)
      .in('status', OPEN_REQUEST_STATUSES)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1)
    requestRow = data?.[0] ?? null
  }

  const { data: inserted, error: insErr } = await sb
    .from('procurement_inbound_emails')
    .insert({
      message_id: messageId,
      from_email: fromEmail,
      from_domain: fromDomain,
      to_emails: recipients,
      subject,
      text_body: textBody,
      notice_id: notice?.id ?? null,
      request_id: requestRow?.id ?? null,
      match_method: notice ? match.method : null,
      status: notice ? 'matched' : 'unsorted',
      raw: {
        resend_email_id: emailId,
        webhook: meta,
        headers: pickHeaders(full.headers),
        attachments: attachments.map((a) => ({ id: a.id, filename: a.filename, content_type: a.content_type, size: a.size })),
      },
    })
    .select('id')
    .single()
  if (insErr) {
    if (insErr.code === '23505') return res.status(200).json({ ok: true, duplicate: true })
    console.error('[procurement/inbound-email] insert misslyckades', insErr.message)
    return res.status(500).json({ error: 'E-postmeddelandet kunde inte sparas' })
  }
  const inboundId = inserted.id as string

  // Härifrån svarar vi alltid 200: raden finns och en omleverans skulle bara bli dubblett
  const docs: Array<{ id: string; fileName: string; docType: string; summary: string | null; bidders: number; status: string }> = []
  const errors: string[] = []
  try {
    let totalBytes = 0
    let index = 0
    for (const att of attachments) {
      const fileName = (att.filename ?? '').trim() || `bilaga-${index + 1}`
      const ext = fileName.toLowerCase().split('.').pop() ?? ''
      if (!ALLOWED_EXT.includes(ext)) continue
      if (att.size && att.size > MAX_ATTACHMENT_BYTES) {
        errors.push(`${fileName}: större än 25 MB`)
        continue
      }
      let buffer: Buffer
      try {
        buffer = await downloadAttachment(att)
      } catch (err) {
        errors.push(`${fileName}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
      if (buffer.length > MAX_ATTACHMENT_BYTES || totalBytes + buffer.length > MAX_TOTAL_ATTACHMENT_BYTES) {
        errors.push(`${fileName}: för stor`)
        continue
      }
      totalBytes += buffer.length
      index++
      const storagePath = `${notice?.id ?? 'osorterat'}/inbound/${inboundId}/${index}-${storageSafe(fileName)}`
      const mimeType = att.content_type || mimeFromExt(ext)
      const { error: upErr } = await sb.storage.from('procurement-documents').upload(storagePath, buffer, { contentType: mimeType, upsert: true })
      if (upErr) {
        errors.push(`${fileName}: uppladdning misslyckades (${upErr.message})`)
        continue
      }
      const { data: docRow, error: docErr } = await sb
        .from('procurement_documents')
        .insert({
          notice_id: notice?.id ?? null,
          request_id: requestRow?.id ?? null,
          inbound_email_id: inboundId,
          storage_path: storagePath,
          file_name: fileName.slice(0, 300),
          mime_type: mimeType,
          size_bytes: buffer.length,
          doc_type: 'unknown',
          origin: 'email',
          ai_status: 'pending',
        })
        .select('id')
        .single()
      if (docErr) {
        errors.push(`${fileName}: ${docErr.message}`)
        continue
      }
      const entry = { id: docRow.id as string, fileName, docType: 'unknown', summary: null as string | null, bidders: 0, status: 'pending' }
      docs.push(entry)

      // Klassning inom tidsgränsen, annars ligger dokumentet kvar som 'pending'
      const elapsed = Date.now() - started
      if (elapsed > CLASSIFY_START_LIMIT_MS) continue
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), Math.max(10_000, CLASSIFY_HARD_LIMIT_MS - elapsed))
      try {
        await sb.from('procurement_documents').update({ ai_status: 'running' }).eq('id', entry.id)
        const parts = await fileToParts(buffer, mimeType, fileName)
        const result = await classifyInboundDocument(
          parts,
          { noticeTitle: notice?.title ?? null, buyerName: notice?.buyer_name ?? null, fileName, emailSubject: subject },
          { abortSignal: ctrl.signal }
        )
        await sb
          .from('procurement_documents')
          .update({
            doc_type: result.doc_type,
            ai_extraction: { doc_type: result.doc_type, bidders: result.bidders, summary: result.summary },
            ai_summary: result.summary,
            ai_status: 'done',
            ai_error: null,
          })
          .eq('id', entry.id)
        for (const b of result.bidders) {
          await upsertBidder({
            source: 'email',
            sourceRef: `doc:${entry.id}`,
            noticeId: notice?.id ?? null,
            name: b.name,
            orgNumber: b.org_number,
            price: b.price,
            score: b.score,
            rank: b.rank,
            isWinner: b.is_winner === true,
            documentId: entry.id,
            raw: b,
          })
        }
        entry.docType = result.doc_type
        entry.summary = result.summary
        entry.bidders = result.bidders.length
        entry.status = 'done'
      } catch (err) {
        const aborted = ctrl.signal.aborted
        const msg = err instanceof Error ? err.message : String(err)
        await sb
          .from('procurement_documents')
          .update(aborted ? { ai_status: 'pending', ai_error: null } : { ai_status: 'failed', ai_error: msg.slice(0, 1000) })
          .eq('id', entry.id)
        entry.status = aborted ? 'pending' : 'failed'
        if (!aborted) errors.push(`${fileName}: klassning misslyckades (${msg})`)
      } finally {
        clearTimeout(timer)
      }
    }

    if (docs.length > 0) {
      await sb
        .from('procurement_inbound_emails')
        .update({ ai_classification: { documents: docs, errors } })
        .eq('id', inboundId)
    }

    // ---- Begäran: mottagen eller delvis mottagen
    if (requestRow && docs.length > 0) {
      const { data: all } = await sb.from('procurement_documents').select('doc_type').eq('request_id', requestRow.id)
      const got = new Set((all ?? []).map((d) => d.doc_type as string))
      const onlyRejections = docs.every((d) => d.docType === 'rejection')
      const covered = requestRow.doc_types.length > 0 && requestRow.doc_types.every((t) => got.has(t))
      await sb
        .from('procurement_document_requests')
        .update({ status: onlyRejections ? 'rejected' : covered ? 'received' : 'partial', received_at: new Date().toISOString() })
        .eq('id', requestRow.id)
    }

    // ---- Notis och händelse
    const recipientsToNotify = notice?.owner_id ? [notice.owner_id as string] : (await getManagers()).map((m) => m.user_id)
    const docNote = docs.length ? ` · ${docs.length} bilaga${docs.length === 1 ? '' : 'or'}` : ''
    await insertNotifications(
      recipientsToNotify,
      notice?.id ?? null,
      notice ? `Handling inkommen: ${notice.title}` : 'Osorterad e-post i upphandlingsinkorgen',
      `${fromEmail ?? 'Okänd avsändare'}: ${subject || '(inget ämne)'}${docNote}`,
      notice?.title ?? 'Upphandlingsinkorgen'
    )
    await sb.from('procurement_events').insert({
      notice_id: notice?.id ?? null,
      event_type: 'email_received',
      title: notice ? 'E-post inkommen' : 'Osorterad e-post inkommen',
      detail: `${fromEmail ?? 'Okänd avsändare'}: ${subject || '(inget ämne)'}${docNote}`,
      metadata: {
        inbound_email_id: inboundId,
        match_method: notice ? match.method : null,
        request_id: requestRow?.id ?? null,
        documents: docs.map((d) => ({ id: d.id, doc_type: d.docType, status: d.status })),
      },
      actor_name: 'Upphandlingsinkorgen',
    })
  } catch (err) {
    console.error('[procurement/inbound-email] efterbehandling misslyckades', err)
    errors.push(err instanceof Error ? err.message : String(err))
  }

  return res.status(200).json({
    ok: true,
    emailId: inboundId,
    status: notice ? 'matched' : 'unsorted',
    matchMethod: notice ? match.method : null,
    noticeId: notice?.id ?? null,
    documents: docs.length,
    errors,
  })
}

// ---------------------------------------------------------------------------
// Matchning

async function matchNotice(input: {
  recipients: string[]
  subject: string
  fromDomain: string | null
}): Promise<{ noticeId: string | null; method: 'reply_to' | 'subject_tag' | 'sender_domain' | null }> {
  const sb = db()
  const byBgu = async (nr: string) => {
    const n = Number(nr)
    if (!Number.isSafeInteger(n) || n <= 0) return null
    const { data } = await sb.from('procurement_notices').select('id').eq('bgu_number', n).maybeSingle()
    return (data?.id as string | undefined) ?? null
  }

  // 1. Svarsadressen upphandling+bgu-{nr}@...
  const local = PROCUREMENT_REPLY_LOCAL.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${local}\\+bgu-(\\d+)@`, 'i')
  for (const r of input.recipients) {
    const m = r.match(re)
    if (m) {
      const id = await byBgu(m[1])
      if (id) return { noticeId: id, method: 'reply_to' }
    }
  }

  // 2. Taggen [BGU-{nr}] i ämnet
  const tag = input.subject.match(/\[BGU-(\d+)\]/i)
  if (tag) {
    const id = await byBgu(tag[1])
    if (id) return { noticeId: id, method: 'subject_tag' }
  }

  // 3. Avsändarens domän mot registratoradress eller öppen begäran, bara vid exakt en kandidat
  const domain = input.fromDomain
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) && !FREEMAIL.has(domain)) {
    const pattern = `%@${domain}`
    const candidates = new Set<string>()
    const { data: reqs } = await sb
      .from('procurement_document_requests')
      .select('notice_id')
      .in('status', OPEN_REQUEST_STATUSES)
      .ilike('recipient_email', pattern)
    for (const r of reqs ?? []) if (r.notice_id) candidates.add(r.notice_id as string)
    const { data: buyers } = await sb.from('procurement_buyers').select('id').ilike('registrar_email', pattern)
    const buyerIds = (buyers ?? []).map((b) => b.id as string)
    if (buyerIds.length > 0) {
      const { data: byBuyer } = await sb
        .from('procurement_document_requests')
        .select('notice_id')
        .in('status', OPEN_REQUEST_STATUSES)
        .in('buyer_id', buyerIds)
      for (const r of byBuyer ?? []) if (r.notice_id) candidates.add(r.notice_id as string)
    }
    if (candidates.size === 1) return { noticeId: [...candidates][0], method: 'sender_domain' }
  }

  return { noticeId: null, method: null }
}

// ---------------------------------------------------------------------------
// Hjälpare

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buf.length
    if (size > MAX_BODY_BYTES) throw new Error('Kroppen är för stor')
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers[name]
  return Array.isArray(v) ? v[0] : v
}

async function resendGet<T>(path: string): Promise<T> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY saknas')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20_000)
  try {
    const res = await fetch(`${RESEND_API}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function downloadAttachment(att: AttachmentMeta): Promise<Buffer> {
  if (att.content) return Buffer.from(att.content, 'base64')
  if (!att.download_url) throw new Error('nedladdningslänk saknas')
  const url = new URL(att.download_url)
  if (url.protocol !== 'https:') throw new Error('nedladdningslänken är inte https')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`nedladdning ${res.status}`)
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_ATTACHMENT_BYTES) throw new Error('större än 25 MB')
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

function list(v: string[] | string | undefined | null): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : String(v).split(',')
}

/** "Namn <adress@doman.se>" eller "adress@doman.se" till gemen adress */
function addressOf(v: string): string | null {
  const m = v.match(/<([^<>\s]+@[^<>\s]+)>/) ?? v.match(/([^\s<>"',;]+@[^\s<>"',;]+)/)
  return m ? m[1].toLowerCase() : null
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs))
}

function pickHeaders(h: Record<string, string> | undefined): Record<string, string> {
  if (!h) return {}
  const keep = ['from', 'to', 'cc', 'date', 'subject', 'message-id', 'in-reply-to', 'references', 'return-path', 'reply-to']
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(h)) if (keep.includes(k.toLowerCase())) out[k.toLowerCase()] = String(v).slice(0, 2000)
  return out
}

/** Storage-nycklar tål bara ASCII: å ä ö translittereras, övrigt blir understreck */
function storageSafe(name: string): string {
  const base = name
    .replace(/[åä]/g, 'a').replace(/[ÅÄ]/g, 'A').replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
  return (base || 'bilaga').slice(-120)
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    zip: 'application/zip',
    csv: 'text/csv',
  }
  return map[ext] ?? (fileKind(null, `x.${ext}`) === 'text' ? 'text/plain' : 'application/octet-stream')
}
