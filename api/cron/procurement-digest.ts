// api/cron/procurement-digest.ts
// Dagligt sammandrag via Resend till alla upphandlingsansvariga som inte
// stängt av det (procurement_user_settings.digest_enabled). Vardagar 07:45
// svensk tid.
//
// Vercel-cron går i UTC och Sverige byter mellan UTC+1 och UTC+2, därför är
// jobbet schemalagt både 05:45 och 06:45 UTC och skickar bara när klockan är
// 7 i svensk tid (?force=1 för manuell körning).
//
// Innehåll (planens avsnitt 8): nya träffar sedan förra sammandraget,
// deadlines inom sju dagar, avtal som gått in i bearbetningsfönstret, nya
// signaler, handlingar att begära (tilldelningar i BeGones län senaste 30
// dagarna utan begäran). Inget mejl skickas när allt är tomt.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronSecret } from '../_lib/cronAuth'
import { withCronLog } from '../_lib/cronLogger'
import { PROCUREMENT_PORTAL_URL, db, emailLayout, escapeHtml, getManagers, noticeLink, recordHealth, sendEmail, swedishHour, swedishWeekday } from '../_lib/procurement'
import { BEGONE_COUNTIES, addDaysIso, daysBetweenIso, swedishDate, todaySwedish } from '../../src/shared/procurementRules'

export const config = { maxDuration: 120 }

const kr = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(n))} kr`)

function list(items: string[]): string {
  return `<ul style="padding-left:18px;margin:6px 0 16px;font-size:13px;line-height:1.5">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
}

function heading(text: string): string {
  return `<h2 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin:18px 0 4px">${escapeHtml(text)}</h2>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronSecret(req, res)) return
  const force = req.query.force === '1'
  if (!force && (swedishHour() !== 7 || swedishWeekday() > 5)) {
    return res.status(200).json({ success: true, skipped: 'inte 07 en vardag i svensk tid' })
  }

  const result = await withCronLog<Record<string, unknown>>('procurement-digest', async () => {
    const sb = db()
    const today = todaySwedish()
    // Måndag täcker helgen
    const lookbackDays = swedishWeekday() === 1 ? 3 : 1
    const sinceIso = new Date(Date.now() - lookbackDays * 86400000).toISOString()
    const sinceDay = addDaysIso(today, -lookbackDays)

    try {
      const managers = (await getManagers()).filter((m) => m.digest_enabled)
      if (managers.length === 0) {
        await recordHealth('digest', true, { count: 0 })
        return { status: 'success' as const, summary: { sent: 0, reason: 'inga mottagare' } }
      }

      const [{ data: fresh }, { data: deadlines }, { data: windowAwards }, { data: signals }, { data: recentAwards }, { data: requests }] = await Promise.all([
        sb.from('procurement_notices').select('id, title, buyer_name, match_score, tender_deadline, annual_value').gte('first_seen_at', sinceIso).gte('match_score', 60).order('match_score', { ascending: false }).limit(30),
        sb.from('procurement_notices').select('id, title, buyer_name, tender_deadline').in('our_status', ['new', 'watching', 'analyzing', 'bidding']).gte('match_score', 60).gte('tender_deadline', new Date().toISOString()).lte('tender_deadline', `${addDaysIso(today, 8)}T00:00:00Z`).order('tender_deadline').limit(30),
        sb.from('procurement_awards').select('id, buyer_name, winner_name, calc_end_date, corrected_end_date, window_start, county_code').gt('window_start', sinceDay).lte('window_start', today).neq('status', 'ignored').limit(30),
        sb.from('procurement_signals').select('id, buyer_name, text, expected_quarter, url').gte('created_at', sinceIso).eq('status', 'new').limit(30),
        sb.from('procurement_awards').select('id, notice_id, buyer_name, winner_name, award_date, county_code, title').gte('award_date', addDaysIso(today, -30)).in('county_code', BEGONE_COUNTIES).not('notice_id', 'is', null).limit(100),
        sb.from('procurement_document_requests').select('notice_id'),
      ])

      const requested = new Set((requests ?? []).map((r) => r.notice_id))
      const toRequest = new Map<string, { title: string | null; buyer: string | null; winner: string | null; date: string | null }>()
      for (const a of recentAwards ?? []) {
        if (!a.notice_id || requested.has(a.notice_id) || toRequest.has(a.notice_id)) continue
        toRequest.set(a.notice_id, { title: a.title, buyer: a.buyer_name, winner: a.winner_name, date: a.award_date })
      }

      const sections: string[] = []
      if ((fresh ?? []).length > 0) {
        sections.push(
          heading(`Nya träffar (${fresh!.length})`) +
            list(fresh!.map((n) => `<a href="${noticeLink(n.id)}" style="color:#0f766e">${escapeHtml(n.title)}</a>, ${escapeHtml(n.buyer_name ?? '')} · ${n.match_score} poäng${n.tender_deadline ? ` · sista dag ${swedishDate(n.tender_deadline)}` : ''}${n.annual_value ? ` · ${kr(n.annual_value)} per år` : ''}`))
        )
      }
      if ((deadlines ?? []).length > 0) {
        sections.push(
          heading('Sista anbudsdag inom sju dagar') +
            list(deadlines!.map((n) => {
              const d = swedishDate(n.tender_deadline)
              return `<a href="${noticeLink(n.id)}" style="color:#0f766e">${escapeHtml(n.title)}</a>, ${escapeHtml(n.buyer_name ?? '')} · ${d}${d ? ` (${daysBetweenIso(today, d)} dagar)` : ''}`
            }))
        )
      }
      if ((windowAwards ?? []).length > 0) {
        sections.push(
          heading('Avtal som gått in i bearbetningsfönstret') +
            list(windowAwards!.map((a) => `${escapeHtml(a.buyer_name ?? '')}: ${escapeHtml(a.winner_name ?? 'okänd leverantör')}, slut ${a.corrected_end_date ?? a.calc_end_date ?? 'okänt'}`))
        )
      }
      if ((signals ?? []).length > 0) {
        sections.push(
          heading('Nya signaler') +
            list(signals!.map((s) => `${escapeHtml(s.buyer_name ?? '')}: ${escapeHtml(s.text)}${s.expected_quarter ? ` (${s.expected_quarter})` : ''}`))
        )
      }
      if (toRequest.size > 0) {
        sections.push(
          heading('Handlingar att begära') +
            list([...toRequest.entries()].map(([id, a]) => `<a href="${noticeLink(id)}" style="color:#0f766e">${escapeHtml(a.title ?? 'Upphandling')}</a>, ${escapeHtml(a.buyer ?? '')} · vinnare ${escapeHtml(a.winner ?? 'okänd')} ${a.date ?? ''}`))
        )
      }

      if (sections.length === 0) {
        await recordHealth('digest', true, { count: 0 })
        return { status: 'success' as const, summary: { sent: 0, reason: 'inget nytt' } }
      }

      const html = emailLayout(
        `Upphandlingar ${today}`,
        `${sections.join('')}<p style="font-size:12px;color:#64748b">Stäng av sammandraget under <a href="${PROCUREMENT_PORTAL_URL}/installningar" style="color:#0f766e">Upphandlingar, Inställningar</a>.</p>`
      )
      let sent = 0
      const errors: string[] = []
      // Ett mejl per mottagare så att ingen ser de andras adresser
      for (const m of managers) {
        try {
          await sendEmail({ to: [m.email], subject: `Upphandlingar ${today}: ${(fresh ?? []).length} nya träffar`, html })
          sent++
        } catch (err) {
          errors.push(`${m.email}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      await recordHealth('digest', errors.length === 0, { count: sent, error: errors[0] ?? null })
      return {
        status: errors.length > 0 ? ('partial' as const) : ('success' as const),
        summary: { sent, fresh: (fresh ?? []).length, deadlines: (deadlines ?? []).length, window: (windowAwards ?? []).length, signals: (signals ?? []).length, to_request: toRequest.size, errors },
      }
    } catch (err) {
      await recordHealth('digest', false, { error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  })

  if (result.status === 'failed') return res.status(500).json({ success: false, error: result.errorMessage })
  return res.status(200).json({ success: true, ...(result.summary as object) })
}
