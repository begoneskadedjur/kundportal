// api/procurement/notify-manager.ts
// Anropas från personkortet under Användarkonton (Personal) när reglaget
// Upphandlingsansvarig slås på. Personen får en notis i portalen och ett
// mejl med länk till upphandlingsportalen (PROCUREMENT_PORTAL_URL). Bara admin och koordinator (samma
// som får ändra flaggan enligt guard_profile_privilege_columns).
//
// POST { userId }

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../_lib/auth'
import { PROCUREMENT_PORTAL_URL, db, emailLayout, escapeHtml, insertNotifications, sendEmail } from '../_lib/procurement'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte' })
  const auth = await requireAuth(req, res, ['admin', 'koordinator'])
  if (!auth) return

  const userId = typeof req.body?.userId === 'string' ? req.body.userId : null
  if (!userId) return res.status(400).json({ error: 'userId saknas' })

  const sb = db()
  const { data: profile, error } = await sb
    .from('profiles')
    .select('user_id, email, display_name, is_procurement_manager, is_active')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!profile) return res.status(404).json({ error: 'Profilen finns inte' })
  // Notisen går bara ut när flaggan faktiskt är satt, så endpointen kan inte
  // användas för att skicka godtyckliga mejl.
  if (!profile.is_procurement_manager) return res.status(409).json({ error: 'Personen är inte upphandlingsansvarig' })

  const link = PROCUREMENT_PORTAL_URL
  const name = profile.display_name || profile.email

  // Notisen och mejlet är oberoende: misslyckas det ena ska det andra ändå gå.
  let notified = false
  let notifyError: string | null = null
  try {
    await insertNotifications(
      [profile.user_id],
      null,
      'Du är nu upphandlingsansvarig',
      'Du har fått åtkomst till Upphandlingar under Försäljning: bevakning, marknad, avtalsklocka och anbudskalkyl.',
      'Upphandlingar'
    )
    notified = true
  } catch (err) {
    notifyError = err instanceof Error ? err.message : String(err)
    console.error('[procurement/notify-manager] notis misslyckades', notifyError)
  }

  let emailed = false
  let emailError: string | null = null
  try {
    await sendEmail({
      to: [profile.email],
      subject: 'Du är nu upphandlingsansvarig i kundportalen',
      html: emailLayout(
        'Du är nu upphandlingsansvarig',
        `<p style="font-size:14px">Hej ${escapeHtml(name)},</p>
         <p style="font-size:14px">Du har fått åtkomst till upphandlingsportalen. Där ser du nya upphandlingar inom skadedjursbekämpning, marknaden, avtal som löper ut och anbudskalkylen. Du får notiser vid nya träffar och ett dagligt sammandrag på vardagar klockan 07.45, som du kan stänga av under Inställningar.</p>
         <p><a href="${link}" style="color:#0f766e">Öppna Upphandlingar</a></p>`
      ),
    })
    emailed = true
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err)
  }

  await sb.from('procurement_events').insert({
    event_type: 'manager_added',
    title: `${name} blev upphandlingsansvarig`,
    detail: [
      notified ? 'Notis skickad' : `Notisen misslyckades: ${notifyError}`,
      emailed ? 'mejl skickat' : `mejlet misslyckades: ${emailError}`,
    ].join(', '),
    metadata: { user_id: profile.user_id, by: auth.userId },
    actor_id: auth.userId,
  })

  return res.status(200).json({ success: true, notified, notifyError, emailed, emailError })
}
