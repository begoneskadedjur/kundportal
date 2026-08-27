// api/_lib/accountEvents.ts
//
// Loggar kontohändelser för kund- och multisite-konton till
// customer_account_events. Läses av kundkortets flik Åtkomst & konton.
//
// Bakgrunden: inbjudningar och lösenordsutskick var tidigare osynliga i
// portalen. create-multisite-users skapade konton utan att skriva en
// inbjudningsrad, och send-new-password loggade bara till konsolen - i
// auth.audit_log_entries syns utskicken som anonyma user_modified av
// service_role, utan avsändare och utan orsak.
//
// Loggningen får ALDRIG fälla anropet den hör till: har ett lösenord väl
// skickats är det viktigare att admin får veta det än att raden hamnade rätt.
// Därför sväljs fel här och rapporteras bara till konsolen.

import { createClient } from '@supabase/supabase-js'

export type AccountEventType =
  | 'invited'
  | 'password_sent'
  | 'email_changed'
  | 'role_changed'
  | 'deactivated'
  | 'reactivated'

export interface AccountEventInput {
  user_id: string
  event_type: AccountEventType
  customer_id?: string | null
  organization_id?: string | null
  /** Snapshot av mottagarens uppgifter - överlever att profilen ändras */
  target_email?: string | null
  target_name?: string | null
  /** Vem som utförde händelsen. Utelämnas för systemhändelser. */
  actor_id?: string | null
  actor_email?: string | null
  /** Sammanhang, t.ex. "Regionchef - 4 enheter" eller gamla e-postadressen */
  note?: string | null
}

// Repot använder båda namnen på service-nyckeln beroende på fil - båda måste
// accepteras här, annars blir loggningen tyst verkningslös i produktion.
function adminClient() {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Skriver en kontohändelse. Kastar aldrig - anroparen ska inte behöva
 * try/catch:a runt loggning.
 */
export async function logAccountEvent(event: AccountEventInput): Promise<void> {
  try {
    const supabase = adminClient()
    if (!supabase) {
      console.warn('logAccountEvent: saknar Supabase-konfiguration, hoppar över')
      return
    }

    const { error } = await supabase.from('customer_account_events').insert({
      user_id: event.user_id,
      customer_id: event.customer_id ?? null,
      organization_id: event.organization_id ?? null,
      event_type: event.event_type,
      target_email: event.target_email ?? null,
      target_name: event.target_name ?? null,
      actor_id: event.actor_id ?? null,
      actor_email: event.actor_email ?? null,
      note: event.note ?? null,
    })

    if (error) {
      console.error('logAccountEvent misslyckades:', error.message, event.event_type, event.user_id)
    }
  } catch (err) {
    console.error('logAccountEvent kastade:', err instanceof Error ? err.message : err)
  }
}

/** Flera händelser i en skrivning - används när ett flöde skapar många konton. */
export async function logAccountEvents(events: AccountEventInput[]): Promise<void> {
  if (events.length === 0) return
  try {
    const supabase = adminClient()
    if (!supabase) {
      console.warn('logAccountEvents: saknar Supabase-konfiguration, hoppar över')
      return
    }

    const { error } = await supabase.from('customer_account_events').insert(
      events.map((e) => ({
        user_id: e.user_id,
        customer_id: e.customer_id ?? null,
        organization_id: e.organization_id ?? null,
        event_type: e.event_type,
        target_email: e.target_email ?? null,
        target_name: e.target_name ?? null,
        actor_id: e.actor_id ?? null,
        actor_email: e.actor_email ?? null,
        note: e.note ?? null,
      }))
    )

    if (error) {
      console.error('logAccountEvents misslyckades:', error.message, `${events.length} händelser`)
    }
  } catch (err) {
    console.error('logAccountEvents kastade:', err instanceof Error ? err.message : err)
  }
}
