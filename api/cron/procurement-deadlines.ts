// api/cron/procurement-deadlines.ts
// Daglig deadline-disciplin för upphandlingsportalen (planens verktyg 6 och
// avsnitt 5c, 10). Körs 06:00 svensk tid (vercel.json, UTC).
//
//   1. Sista anbudsdag och frågor senast: påminnelse sju och tre dagar före,
//      till ansvarig eller alla upphandlingsansvariga, notis och mejl.
//   2. Avtalsspärr: tilldelning på en upphandling vi lämnat anbud på ger en
//      påminnelse när spärren (tio dagar efter tilldelningsbeslutet enligt
//      LOU 20 kap. 1 §, att verifiera juridiskt) löper ut inom tre dagar.
//      Överprövning måste göras innan avtal tecknas.
//   3. Begäran om handlingar: påminnelse till köparen efter sju dagar utan
//      svar, eskalering internt efter fjorton.
//
// Idempotent: varje påminnelse loggas som procurement_events med en nyckel
// i metadata.reminder_key och skickas bara en gång.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import {
  PROCUREMENT_FROM_EMAIL,
  db,
  emailLayout,
  escapeHtml,
  insertNotifications,
  noticeLink,
  recipientsFor,
  recordHealth,
  sendEmail,
} from '../_lib/procurement'
import { addDaysIso, daysBetweenIso, swedishDate, todaySwedish } from '../../src/shared/procurementRules'

export const config = { maxDuration: 120 }

const OPEN_STATUSES = ['new', 'watching', 'analyzing', 'bidding']
const REMIND_DAYS = [7, 3]
/** Avtalsspärr i dagar efter tilldelningsbeslut (LOU 20 kap. 1 §, elektronisk underrättelse) */
const STANDSTILL_DAYS = 10

async function alreadySent(key: string): Promise<boolean> {
  const { data } = await db().from('procurement_events').select('id').contains('metadata', { reminder_key: key }).limit(1)
  return (data ?? []).length > 0
}

async function logReminder(noticeId: string | null, key: string, title: string, detail: string): Promise<void> {
  await db().from('procurement_events').insert({
    notice_id: noticeId,
    event_type: 'reminder',
    title,
    detail,
    metadata: { reminder_key: key },
    actor_name: 'Påminnelser',
  })
}

async function remind(noticeId: string, ownerId: string | null, key: string, title: string, detail: string, noticeTitle: string): Promise<boolean> {
  if (await alreadySent(key)) return false
  const recipients = await recipientsFor(ownerId)
  // Ingen mottagare ännu: logga inte, så att påminnelsen går ut när någon blivit ansvarig
  if (recipients.length === 0) return false
  await insertNotifications(recipients.map((r) => r.user_id), noticeId, title, detail, noticeTitle)
  try {
    await sendEmail({
      to: recipients.map((r) => r.email),
      subject: title,
      html: emailLayout(title, `<p style="font-size:14px">${escapeHtml(detail)}</p><p><a href="${noticeLink(noticeId)}" style="color:#0f766e">Öppna upphandlingen</a></p>`),
    })
  } catch (err) {
    console.warn('[procurement-deadlines] mejl misslyckades', err)
  }
  await logReminder(noticeId, key, title, detail)
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return

  const result = await withCronLog('procurement-deadlines', async () => {
    const sb = db()
    const today = todaySwedish()
    const counts = { deadlines: 0, questions: 0, standstill: 0, request_reminders: 0, escalations: 0 }
    const errors: string[] = []

    try {
      // 1. Sista anbudsdag och frågor senast
      const horizon = `${addDaysIso(today, 8)}T00:00:00Z`
      const { data: notices, error } = await sb
        .from('procurement_notices')
        .select('id, title, buyer_name, owner_id, tender_deadline, questions_deadline, our_status')
        .in('our_status', OPEN_STATUSES)
        .gte('match_score', 60)
        .or(`tender_deadline.lte.${horizon},questions_deadline.lte.${horizon}`)
      if (error) throw error
      for (const n of notices ?? []) {
        for (const [field, label, counter] of [
          ['tender_deadline', 'Sista anbudsdag', 'deadlines'],
          ['questions_deadline', 'Frågor senast', 'questions'],
        ] as const) {
          const day = swedishDate(n[field] as string | null)
          if (!day) continue
          const left = daysBetweenIso(today, day)
          for (const d of REMIND_DAYS) {
            // Påminn på dagen, eller i efterhand samma period om jobbet missat en körning
            if (left > d || left < (d === 7 ? 4 : 0)) continue
            try {
              const sent = await remind(
                n.id,
                n.owner_id,
                `${field}:${d}:${day}:${n.id}`,
                `${label} om ${left} dagar: ${n.title}`,
                `${label} för ${n.title} (${n.buyer_name ?? 'okänd köpare'}) är ${day}.`,
                n.title
              )
              if (sent) counts[counter]++
            } catch (err) {
              errors.push(err instanceof Error ? err.message : String(err))
            }
            break
          }
        }
      }

      // 2. Avtalsspärr på upphandlingar vi lämnat anbud på
      const since = addDaysIso(today, -STANDSTILL_DAYS - 1)
      const { data: awards } = await sb
        .from('procurement_awards')
        .select('id, notice_id, award_date, winner_name, notice:procurement_notices(id, title, owner_id, our_status)')
        .gte('award_date', since)
        .not('notice_id', 'is', null)
      for (const a of awards ?? []) {
        const notice = (Array.isArray(a.notice) ? a.notice[0] : a.notice) as { id: string; title: string; owner_id: string | null; our_status: string } | null
        if (!notice || !['submitted', 'won', 'lost'].includes(notice.our_status) || !a.award_date) continue
        const ends = addDaysIso(a.award_date, STANDSTILL_DAYS)
        const left = daysBetweenIso(today, ends)
        if (left < 0 || left > 3) continue
        try {
          const sent = await remind(
            notice.id,
            notice.owner_id,
            `standstill:${ends}:${notice.id}`,
            `Avtalsspärren löper ut ${ends}: ${notice.title}`,
            `Tilldelning till ${a.winner_name ?? 'okänd vinnare'} ${a.award_date}. Avtalsspärren löper ut ${ends} (tio dagar, verifiera mot underrättelsen). Överprövning måste ske innan dess.`,
            notice.title
          )
          if (sent) counts.standstill++
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }

      // 3. Begäran om handlingar: påminnelse efter 7 dagar, eskalering efter 14
      const { data: requests } = await sb
        .from('procurement_document_requests')
        .select('id, notice_id, recipient_email, reply_to, subject, body, status, sent_at, reminded_at, escalated_at, created_by, notice:procurement_notices(id, title, owner_id)')
        .in('status', ['sent', 'reminded'])
        .not('sent_at', 'is', null)
      for (const r of requests ?? []) {
        const sentDay = swedishDate(r.sent_at)
        if (!sentDay) continue
        const age = daysBetweenIso(sentDay, today)
        const notice = (Array.isArray(r.notice) ? r.notice[0] : r.notice) as { id: string; title: string; owner_id: string | null } | null
        try {
          if (r.status === 'sent' && age >= 7 && !r.reminded_at) {
            await sendEmail({
              to: [r.recipient_email],
              from: PROCUREMENT_FROM_EMAIL,
              replyTo: r.reply_to,
              subject: `Påminnelse: ${r.subject ?? 'Begäran om allmän handling'}`,
              html: emailLayout(
                'Påminnelse om begäran om allmän handling',
                `<p style="font-size:14px">Vi skickade en begäran om allmän handling ${sentDay} och har ännu inte fått svar. Enligt tryckfrihetsförordningen ska begäran behandlas skyndsamt. Vi är tacksamma för besked om när handlingarna kan lämnas ut.</p>
                 <p style="font-size:13px;color:#475569;white-space:pre-wrap">${escapeHtml(r.body ?? '')}</p>`
              ),
              text: `Påminnelse om vår begäran om allmän handling ${sentDay}.\n\n${r.body ?? ''}`,
            })
            await sb.from('procurement_document_requests').update({ status: 'reminded', reminded_at: new Date().toISOString() }).eq('id', r.id)
            await logReminder(r.notice_id, `request_reminder:${r.id}`, 'Påminnelse skickad till köparen', `Begäran från ${sentDay} utan svar efter ${age} dagar`)
            counts.request_reminders++
          } else if (age >= 14 && !r.escalated_at) {
            await sb.from('procurement_document_requests').update({ status: 'escalated', escalated_at: new Date().toISOString() }).eq('id', r.id)
            const recipients = await recipientsFor(notice?.owner_id ?? r.created_by ?? null)
            await insertNotifications(
              recipients.map((m) => m.user_id),
              r.notice_id,
              `Handlingar uteblir: ${notice?.title ?? 'upphandling'}`,
              `Begäran till ${r.recipient_email} från ${sentDay} är obesvarad efter ${age} dagar. Ring registratorn eller begär ett överklagbart beslut.`,
              notice?.title ?? 'Begäran om handlingar'
            )
            await logReminder(r.notice_id, `request_escalation:${r.id}`, 'Begäran eskalerad', `Obesvarad efter ${age} dagar`)
            counts.escalations++
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }

      await recordHealth('deadlines', true, { count: Object.values(counts).reduce((a, b) => a + b, 0) })
      return { status: errors.length > 0 ? ('partial' as const) : ('success' as const), summary: { today, ...counts, errors: errors.slice(0, 20) } }
    } catch (err) {
      await recordHealth('deadlines', false, { error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  })

  if (result.status === 'failed') return res.status(500).json({ success: false, error: result.errorMessage })
  return res.status(200).json({ success: true, ...(result.summary as object) })
}
