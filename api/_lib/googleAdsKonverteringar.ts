// api/_lib/googleAdsKonverteringar.ts
// Offline-konverteringar från Leads (Webb) till Google Ads: "Bokat uppdrag (kundportalen)" och
// "Genomfört uppdrag (kundportalen)". Urvalet och värdena räknas i databasfunktionen
// google_ads_konverteringar_urval() (migrationen 20261006_google_ads_konverteringar.sql); här
// byggs händelserna och anropen.
//
// Uppladdningen går via Data Manager API (POST https://datamanager.googleapis.com/v1/events:ingest).
// Google Ads API:s uploadClickConversions är stängt för nya integrationer (svarar
// CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE, provat 2026-10-06). Konverteringsåtgärdernas id slås
// fortfarande upp på namn via Google Ads API (GAQL). OAuth-nyckeln måste därför ha båda scopen
// adwords och datamanager (scripts/ads/oauth.mjs begär båda sedan 2026-10-06).
//
// Data Manager API underkänner hela anropet om en enda händelse är ogiltig (fast-fail). Felaktiga
// händelser plockas därför ut ur felsvaret och anropet görs om utan dem. Bearbetningen sker sedan
// asynkront; utfallet per anrop hämtas med requestStatus:retrieve vid nästa körning.
//
// Miljövariabler (samma som scripts/ads): GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
// GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID (annonskontot), GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC).
// Valfria: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_API_VERSION (standard v25).
//
// Ingen Supabase-import här, så att filen kan köras fristående (torrkörning lokalt).

import { createHash } from 'node:crypto'

export type KonverteringsTyp = 'bokat' | 'genomfort'
export type KlickIdTyp = 'gclid' | 'gbraid' | 'wbraid' | 'ingen'

/** Konverteringsåtgärdernas namn i kontot. Slås upp på namn vid varje körning, id hårdkodas aldrig. */
export const ATGARDSNAMN: Record<KonverteringsTyp, string> = {
  bokat: 'Bokat uppdrag (kundportalen)',
  genomfort: 'Genomfört uppdrag (kundportalen)',
}

/** En rad ur google_ads_konverteringar_urval(). */
export interface UrvalsRad {
  inquiry_id: string
  typ: KonverteringsTyp
  gclid: string | null
  gbraid: string | null
  wbraid: string | null
  email: string | null
  phone: string | null
  klick_tid: string
  tidpunkt: string
  varde: number | string | null
  for_gammal: boolean
  forsok: number
}

export interface Konvertering {
  rad: UrvalsRad
  klickIdTyp: KlickIdTyp
  varde: number | null
  /** ISO 8601 i svensk tid med offset, t.ex. 2026-10-06T10:15:00+02:00 */
  tidpunkt: string
  transactionId: string
  /** Händelsen i Data Manager API:s format. */
  event: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Tid: lokal svensk tid med explicit offset, aldrig rå toISOString()

const DELAR = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
})

/** 2026-10-06T08:15:00Z till '2026-10-06T10:15:00+02:00' (svensk tid, sommar +02:00, vinter +01:00). */
export function svenskTidMedOffset(tid: string | Date): string {
  const d = typeof tid === 'string' ? new Date(tid) : tid
  const p = Object.fromEntries(DELAR.formatToParts(d).map((x) => [x.type, x.value]))
  // longOffset ger 'GMT+02:00' (eller 'GMT' vid noll, förekommer inte i Sverige men hanteras)
  const off = (p.timeZoneName ?? 'GMT').replace('GMT', '') || '+00:00'
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off}`
}

// ---------------------------------------------------------------------------
// Förbättrade konverteringar för leads: normaliserad och hashad e-post och telefon (SHA-256, hex)

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

/** Googles normalisering: gemener, utan blanksteg; för gmail.com och googlemail.com tas punkter före @ bort. */
export function normaliseraEpost(epost: string): string | null {
  const e = epost.trim().toLowerCase().replace(/\s+/g, '')
  const m = /^([^@]+)@([^@]+\.[^@]+)$/.exec(e)
  if (!m) return null
  let lokal = m[1]!
  const doman = m[2]!
  if (doman === 'gmail.com' || doman === 'googlemail.com') lokal = lokal.replace(/\./g, '')
  return `${lokal}@${doman}`
}

/** 070-123 45 67 till +46701234567 (E.164). Ogiltigt nummer ger null. */
export function e164(telefon: string): string | null {
  let s = telefon.replace(/[^\d+]/g, '')
  if (s.startsWith('+46')) s = s.slice(3)
  else if (s.startsWith('0046')) s = s.slice(4)
  else if (s.startsWith('0')) s = s.slice(1)
  else return null
  return /^\d{7,9}$/.test(s) ? `+46${s}` : null
}

// ---------------------------------------------------------------------------
// Bygg händelserna

/** Ett klick-id åt gången: gclid i första hand, annars gbraid, annars wbraid. */
export function valjKlickId(rad: UrvalsRad): { typ: KlickIdTyp; varde: string | null } {
  if (rad.gclid) return { typ: 'gclid', varde: rad.gclid }
  if (rad.gbraid) return { typ: 'gbraid', varde: rad.gbraid }
  if (rad.wbraid) return { typ: 'wbraid', varde: rad.wbraid }
  return { typ: 'ingen', varde: null }
}

export const transaktionsId = (rad: Pick<UrvalsRad, 'inquiry_id' | 'typ'>) => `${rad.inquiry_id}-${rad.typ}`

/** Händelsen för en rad, eller null om det inte finns något att matcha på (varken klick-id eller e-post/telefon). */
export function byggKonvertering(rad: UrvalsRad): Konvertering | null {
  const klick = valjKlickId(rad)
  const rått = rad.varde == null ? null : Math.round(Number(rad.varde) * 100) / 100
  const varde = rått != null && Number.isFinite(rått) && rått > 0 ? rått : null
  const tidpunkt = svenskTidMedOffset(rad.tidpunkt)
  const transactionId = transaktionsId(rad)

  const event: Record<string, unknown> = {
    eventTimestamp: tidpunkt,
    transactionId,
    eventSource: 'WEB',
  }
  if (klick.typ !== 'ingen') event.adIdentifiers = { [klick.typ]: klick.varde }
  if (varde != null) {
    event.conversionValue = varde
    event.currency = 'SEK'
  }

  const ids: Record<string, string>[] = []
  const epost = rad.email ? normaliseraEpost(rad.email) : null
  if (epost) ids.push({ emailAddress: sha256(epost) })
  const tel = rad.phone ? e164(rad.phone) : null
  if (tel) ids.push({ phoneNumber: sha256(tel) })
  if (ids.length) event.userData = { userIdentifiers: ids }

  if (klick.typ === 'ingen' && !ids.length) return null
  return { rad, klickIdTyp: klick.typ, varde, tidpunkt, transactionId, event }
}

// ---------------------------------------------------------------------------
// Inloggning och Google Ads API (uppslag av åtgärderna)

const env = () => process.env

export function saknadeMiljovariabler(): string[] {
  return [
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
    'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  ].filter((n) => !env()[n])
}

const adsBas = () => `https://googleads.googleapis.com/${env().GOOGLE_ADS_API_VERSION || 'v25'}`
const DM_BAS = 'https://datamanager.googleapis.com/v1'
const kundId = () => (env().GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')
const mccId = () => (env().GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '')

export async function hamtaAccessToken(): Promise<string> {
  const svar = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env().GOOGLE_ADS_CLIENT_ID ?? '',
      client_secret: env().GOOGLE_ADS_CLIENT_SECRET ?? '',
      refresh_token: env().GOOGLE_ADS_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  })
  const data = (await svar.json().catch(() => ({}))) as { access_token?: string; error?: string; scope?: string }
  // Skriv aldrig ut svaret i sin helhet; felkoden räcker (t.ex. invalid_grant).
  if (!data.access_token) throw new Error(`Inloggningen till Google misslyckades (${data.error ?? svar.status})`)
  if (data.scope && !data.scope.includes('auth/datamanager')) {
    throw new Error(
      'Inloggningen saknar behörigheten datamanager. Kör scripts/ads/oauth.mjs igen (begär adwords och datamanager) och lägg in den nya GOOGLE_ADS_REFRESH_TOKEN i Vercel.',
    )
  }
  return data.access_token
}

function adsHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (env().GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = env().GOOGLE_ADS_DEVELOPER_TOKEN!
  if (mccId()) h['login-customer-id'] = mccId()
  return h
}

/** Slår upp konverteringsåtgärdernas id på namn (bara aktiva av typen UPLOAD_CLICKS). Saknade ger null. */
export async function hamtaAtgarder(token: string): Promise<Record<KonverteringsTyp, string | null>> {
  const namn = Object.values(ATGARDSNAMN).map((n) => `'${n.replace(/'/g, "\\'")}'`).join(', ')
  const query =
    'SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type ' +
    `FROM conversion_action WHERE conversion_action.name IN (${namn}) AND conversion_action.status = 'ENABLED'`
  const svar = await fetch(`${adsBas()}/customers/${kundId()}/googleAds:searchStream`, {
    method: 'POST',
    headers: adsHeaders(token),
    body: JSON.stringify({ query }),
  })
  const data = (await svar.json().catch(() => null)) as unknown
  if (!svar.ok || !Array.isArray(data)) {
    const msg = (data as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${svar.status}`
    throw new Error(`Kunde inte läsa konverteringsåtgärderna: ${msg}`)
  }
  const ut: Record<KonverteringsTyp, string | null> = { bokat: null, genomfort: null }
  const rader = (data as Array<{ results?: Array<{ conversionAction: { id: string; name: string; type: string } }> }>).flatMap(
    (d) => d.results ?? [],
  )
  for (const r of rader) {
    const ca = r.conversionAction
    if (ca.type !== 'UPLOAD_CLICKS') continue
    for (const typ of Object.keys(ATGARDSNAMN) as KonverteringsTyp[]) {
      if (ca.name === ATGARDSNAMN[typ]) ut[typ] = String(ca.id)
    }
  }
  return ut
}

// ---------------------------------------------------------------------------
// Data Manager API

export interface IngestResultat {
  /** requestId när anropet godtogs (inte vid validateOnly). */
  requestId: string | null
  /** Händelser som underkändes, per index i den skickade listan. */
  felPerIndex: Map<number, string>
  /** Fel för hela anropet som inte kan knytas till en händelse (behörighet, konto m.m.). */
  helaAnropetFel: string | null
  varningar: unknown
}

interface DmFel {
  error?: {
    code?: number
    message?: string
    status?: string
    details?: Array<{ '@type'?: string; reason?: string; fieldViolations?: Array<{ field?: string; description?: string; reason?: string }> }>
  }
}

async function ingestEnGang(token: string, atgardId: string, events: Record<string, unknown>[], validateOnly: boolean): Promise<IngestResultat> {
  const body = {
    destinations: [
      {
        operatingAccount: { accountType: 'GOOGLE_ADS', accountId: kundId() },
        loginAccount: { accountType: 'GOOGLE_ADS', accountId: mccId() || kundId() },
        productDestinationId: atgardId,
      },
    ],
    encoding: 'HEX',
    // Alla i urvalet har samtyckt till marknadsföring. Ingen riktad reklam: personalisering nekas.
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    events,
    validateOnly,
  }
  const svar = await fetch(`${DM_BAS}/events:ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await svar.json().catch(() => null)) as ({ requestId?: string; fieldWarnings?: unknown } & DmFel) | null
  const felPerIndex = new Map<number, string>()
  if (svar.ok) return { requestId: data?.requestId ?? null, felPerIndex, helaAnropetFel: null, varningar: data?.fieldWarnings ?? null }

  const ovrigt: string[] = []
  for (const d of data?.error?.details ?? []) {
    for (const v of d.fieldViolations ?? []) {
      const m = /^events\[(\d+)\]/.exec(v.field ?? '')
      const text = [v.reason, v.field, v.description].filter(Boolean).join(': ')
      if (m) felPerIndex.set(Number(m[1]), [felPerIndex.get(Number(m[1])), text].filter(Boolean).join(' | '))
      else ovrigt.push(text)
    }
    if (!d.fieldViolations && d.reason) ovrigt.push(d.reason)
  }
  const helaAnropetFel =
    felPerIndex.size && !ovrigt.length ? null : [data?.error?.message ?? `HTTP ${svar.status}`, ...ovrigt].join(' | ')
  return { requestId: null, felPerIndex, helaAnropetFel, varningar: null }
}

/**
 * Skickar händelserna till konverteringsåtgärden. Underkänns enskilda händelser görs anropet om en gång
 * utan dem (Data Manager API underkänner annars hela anropet). Index i svaret avser listan som skickades in.
 */
export async function laddaUpp(token: string, atgardId: string, events: Record<string, unknown>[], validateOnly: boolean): Promise<IngestResultat> {
  const forsta = await ingestEnGang(token, atgardId, events, validateOnly)
  if (forsta.helaAnropetFel || !forsta.felPerIndex.size) return forsta
  const kvar = events.map((_, i) => i).filter((i) => !forsta.felPerIndex.has(i))
  if (!kvar.length) return forsta
  const andra = await ingestEnGang(token, atgardId, kvar.map((i) => events[i]!), validateOnly)
  const felPerIndex = new Map(forsta.felPerIndex)
  for (const [j, fel] of andra.felPerIndex) felPerIndex.set(kvar[j]!, fel)
  if (andra.helaAnropetFel) for (const i of kvar) if (!felPerIndex.has(i)) felPerIndex.set(i, andra.helaAnropetFel)
  return { requestId: andra.requestId, felPerIndex, helaAnropetFel: null, varningar: andra.varningar }
}

export interface RequestStatus {
  status: string
  svar: unknown
}

/** Bearbetningens utfall för ett godtaget anrop: SUCCESS, PARTIAL_SUCCESS, FAILED eller PROCESSING. */
export async function hamtaRequestStatus(token: string, requestId: string): Promise<RequestStatus> {
  const svar = await fetch(`${DM_BAS}/requestStatus:retrieve?requestId=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await svar.json().catch(() => null)) as
    | { requestStatusPerDestination?: Array<{ requestStatus?: string }> } & DmFel
    | null
  if (!svar.ok) return { status: 'OKAND', svar: { fel: data?.error?.message ?? `HTTP ${svar.status}` } }
  const statusar = (data?.requestStatusPerDestination ?? []).map((d) => d.requestStatus ?? 'OKAND')
  return { status: statusar[0] ?? 'OKAND', svar: data }
}
