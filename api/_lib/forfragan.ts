// api/_lib/forfragan.ts
// Leads (Webb): validering, kvittensmejl och notis för förfrågningar från formulären på begone.se.
// Används av api/forfragan.ts. Plan: docs/begone-se/forfragningar-plan.md.
//
// Personuppgifter (namn, telefon, e-post, adress, meddelande, IP) loggas aldrig härifrån.

import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { baseTemplate } from '../email-templates'

export const BUCKET = 'web-inquiry-images'
export const MAX_BILDER = 3
export const MAX_BILD_BYTES = 3 * 1024 * 1024
export const TILLATNA_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const DETALJ_NYCKLAR = new Set([
  'fraga', 'svar', 'foljfraga', 'folj', 'akut', 'nar_ringa', 'antal_bilder',
  'kalla', 'fran', 'kundgrupp', 'art', 'sakerhet', 'utfall', 'vag',
  // Om besökaren samtyckt till marknadsföringscookies (Google Ads) när förfrågan skickades. Styr om
  // klick-id:n får användas för att stämma av konverteringar i Ads.
  'samtycke_marknadsforing',
])

const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TELEFON = /^0\d{7,9}$/
const POSTNUMMER = /^\d{5}$/

export type Kundgrupp = 'privat' | 'brf_fastighet' | 'verksamhet'

export interface BildBegaran {
  mime: string
  bytes: number
}

export interface ValideradForfragan {
  rad: Record<string, unknown>
  bilder: BildBegaran[]
  fornamn: string
}

export class ValideringsFel extends Error {
  constructor(public falt: string) {
    super(`validering:${falt}`)
  }
}

function text(v: unknown, max: number): string | null {
  if (v == null) return null
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

function tid(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** 070-123 45 67, +46 70 123 45 67 och 0046... blir 0701234567. */
export function normalTelefon(v: unknown): string {
  let s = String(v ?? '').replace(/[^\d+]/g, '')
  if (s.startsWith('+46')) s = '0' + s.slice(3)
  else if (s.startsWith('0046')) s = '0' + s.slice(4)
  s = s.replace(/\D/g, '')
  if (s.startsWith('46') && s.length >= 10 && s.length <= 12) s = '0' + s.slice(2)
  return s
}

/** Sidan där formuläret skickades (body.sida, en sökväg). Saknas den: landningssidans sökväg. */
function sidaFran(sida: unknown, landing: string | null): string | null {
  if (typeof sida === 'string' && /^\/\S{0,299}$/.test(sida)) return sida
  return sokvag(landing)
}

function sokvag(landing: string | null): string | null {
  if (!landing) return null
  try {
    return new URL(landing).pathname.slice(0, 300)
  } catch {
    return null
  }
}

function rensaDetaljer(v: unknown): Record<string, string | number | boolean | null> {
  const ut: Record<string, string | number | boolean | null> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ut
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!DETALJ_NYCKLAR.has(k)) continue
    if (val == null) ut[k] = null
    else if (typeof val === 'boolean') ut[k] = val
    else if (typeof val === 'number' && Number.isFinite(val)) ut[k] = val
    else if (typeof val === 'string') ut[k] = val.trim().slice(0, 300)
  }
  return ut
}

/** Kontrollerar och översätter sajtens payload till en rad i web_inquiries. Kastar ValideringsFel. */
export function validera(body: Record<string, unknown>): ValideradForfragan {
  const details = rensaDetaljer(body.details)
  const kalla = details.kalla === 'artanalys' ? 'artanalys' : 'offertflode'

  const customerKind = body.customer_kind === 'foretag' ? 'foretag' : body.customer_kind === 'privat' || body.customer_kind == null ? 'privat' : null
  if (!customerKind) throw new ValideringsFel('customer_kind')

  const name = text(body.name, 120)
  if (!name) throw new ValideringsFel('name')

  const phone = normalTelefon(body.phone)
  if (!TELEFON.test(phone)) throw new ValideringsFel('phone')

  const postal = String(body.postal_code ?? '').replace(/\s/g, '')
  if (!POSTNUMMER.test(postal)) throw new ValideringsFel('postal_code')

  const email = text(body.email, 200)
  if (email && !EPOST.test(email)) throw new ValideringsFel('email')

  const companyName = customerKind === 'foretag' ? text(body.company_name, 200) : null
  if (customerKind === 'foretag' && kalla === 'offertflode') {
    if (!companyName) throw new ValideringsFel('company_name')
    if (!email) throw new ValideringsFel('email')
  }

  const pestRaw = body.pest_type == null ? null : String(body.pest_type).trim()
  if (pestRaw && pestRaw.length > 60) throw new ValideringsFel('pest_type')

  const message = body.message == null ? null : String(body.message).trim()
  if (message && message.length > 4000) throw new ValideringsFel('message')

  if (body.consent !== true) throw new ValideringsFel('consent')

  // Bilderna: bara mime och storlek, själva filerna laddas upp direkt till lagringen
  const bilderIn = Array.isArray(body.bilder) ? body.bilder : []
  if (bilderIn.length > MAX_BILDER) throw new ValideringsFel('bilder')
  const bilder: BildBegaran[] = bilderIn.map((b) => {
    const mime = String((b as { mime?: unknown })?.mime ?? '').toLowerCase()
    const bytes = Number((b as { bytes?: unknown })?.bytes)
    if (!TILLATNA_MIME[mime] || !Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BILD_BYTES) {
      throw new ValideringsFel('bilder')
    }
    return { mime, bytes: Math.round(bytes) }
  })

  // Kundgrupp: artanalysen skickar den, offertflödet härleds ur företagsfrågans svar
  let kundgrupp: Kundgrupp = 'privat'
  if (details.kundgrupp === 'brf_fastighet' || details.kundgrupp === 'verksamhet' || details.kundgrupp === 'privat') {
    kundgrupp = details.kundgrupp
  } else if (customerKind === 'foretag') {
    kundgrupp = details.svar === 'BRF eller fastighet' ? 'brf_fastighet' : 'verksamhet'
  }

  const formType = body.form_type === 'akut' ? 'akut' : 'offert'
  const landing = text(body.landing_url, 1000)
  const city = text(body.city, 80)
  const fran = text(details.fran, 120) ?? text(body.fran, 120)
  if (fran) details.fran = fran

  const rad: Record<string, unknown> = {
    kalla,
    fran,
    sida: sidaFran(body.sida, landing),
    landing_url: landing,
    referrer: text(body.referrer, 1000),
    utm_source: text(body.utm_source, 200),
    utm_medium: text(body.utm_medium, 200),
    utm_campaign: text(body.utm_campaign, 200),
    utm_term: text(body.utm_term, 200),
    utm_content: text(body.utm_content, 200),
    gclid: text(body.gclid, 300),
    gbraid: text(body.gbraid, 300),
    wbraid: text(body.wbraid, 300),
    form_type: formType,
    akut: formType === 'akut' || details.akut === true,
    customer_kind: customerKind,
    kundgrupp,
    name,
    phone,
    email,
    company_name: companyName,
    organization_number: customerKind === 'foretag' ? text(body.organization_number, 20) : null,
    address: text(body.address, 200),
    postal_code: postal,
    city,
    omrade_tackt: !!city,
    pest_type: pestRaw || null,
    message: message || null,
    details,
    consent: true,
    consent_text_version: text(body.consent_text_version, 40),
    privacy_notice_shown: body.privacy_notice_shown === true,
    started_at: tid(body.started_at),
    submitted_at: tid(body.submitted_at),
  }

  return { rad, bilder, fornamn: name.split(/\s+/)[0] }
}

/** Honungsfält eller för snabbt inskick (under 3 s). Robotar får samma svar som ett lyckat inskick, utan id. */
export function arRobot(body: Record<string, unknown>): boolean {
  if (typeof body.website === 'string' && body.website.trim() !== '') return true
  const start = Date.parse(String(body.started_at ?? ''))
  const slut = Date.parse(String(body.submitted_at ?? ''))
  if (Number.isFinite(start) && Number.isFinite(slut) && slut - start < 3000) return true
  return false
}

/** HMAC för IP och telefon i hastighetsnycklar. Nyckeln ligger i miljön. */
export function hmac(varde: string, syfte: string): string {
  const nyckel = process.env.FORFRAGAN_IP_SALT || process.env.ARTANALYS_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  return createHmac('sha256', `forfragan:${syfte}:${nyckel}`).update(varde).digest('hex')
}

// ---------------------------------------------------------------------------
// Texter

const DJUR_LITEN: Record<string, string> = {
  getingar: 'getingar',
  rattor: 'råttor',
  moss: 'möss',
  vaggloss: 'vägglöss',
  silverfisk: 'silverfisk',
  myror: 'myror',
  kackerlackor: 'kackerlackor',
  faglar: 'fåglar',
  annat: 'skadedjur',
  vetinte: 'ett okänt skadedjur',
  foretag: 'skadedjur',
}

/** Tjänsten i löptext: djurets namn, eller svaret under Annat med liten begynnelsebokstav. */
export function djurLopText(pest: string | null | undefined): string {
  if (!pest) return 'skadedjur'
  const k = DJUR_LITEN[pest]
  if (k) return k
  return pest.charAt(0).toLowerCase() + pest.slice(1)
}

const KUNDGRUPP_TEXT: Record<Kundgrupp, string> = {
  privat: 'Privat',
  brf_fastighet: 'BRF eller fastighet',
  verksamhet: 'Verksamhet',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

// ---------------------------------------------------------------------------
// Kvittensmejl till kunden (planen avsnitt 6). Resend REST, samma avsändare som övriga kundmejl.

export async function skickaKvittens(params: {
  till: string
  fornamn: string
  referens: string
  pest: string | null
  foretag: string | null
}): Promise<boolean> {
  const nyckel = process.env.RESEND_API_KEY
  if (!nyckel) return false
  const ni = !!params.foretag
  const amne = 'Vi har tagit emot din förfrågan'
  const djur = escapeHtml(djurLopText(params.pest))
  const vad = ni
    ? `förfrågan från ${escapeHtml(params.foretag!)} om ${djur}`
    : `förfrågan om ${djur}`
  const innehall = `
    <p style="margin: 0 0 16px;">Hej ${escapeHtml(params.fornamn)},</p>
    <p style="margin: 0 0 16px;">Tack, vi har tagit emot ${ni ? 'er' : 'din'} ${vad}. Vi ringer upp när vi ser den, alltid samma dag om den kommer in vardagar 08 till 17.</p>
    <p style="margin: 0 0 16px;">${ni ? 'Ert' : 'Ditt'} nummer är <strong>${escapeHtml(params.referens)}</strong>. Har ${ni ? 'ni' : 'du'} fler bilder eller något att lägga till kan ${ni ? 'ni' : 'du'} svara på det här mejlet.</p>
    <p style="margin: 24px 0 0;">Begone Skadedjur</p>`
  try {
    const svar = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${nyckel}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BeGone Kundportal <noreply@begone.se>',
        to: [params.till],
        reply_to: 'info@begone.se',
        subject: amne,
        html: baseTemplate(innehall, amne),
      }),
    })
    if (!svar.ok) {
      console.warn('[forfragan] kvittensen kunde inte skickas, status', svar.status)
      return false
    }
    return true
  } catch {
    console.warn('[forfragan] kvittensen kunde inte skickas, nätfel')
    return false
  }
}

// ---------------------------------------------------------------------------
// Notis till koordinatorerna (planen avsnitt 7).
//
// CHECK-villkoret notifications_case_type_check tillåter 'web_inquiry' sedan 2026-10-05 (migrationen
// 20261005_notiser_webbforfragan, godkänd av Christian). FORFRAGAN_NOTIS=0 i Vercel stänger av notisen.

export async function notifieraKoordinatorer(
  db: SupabaseClient,
  forfragan: { id: string; pest: string | null; city: string | null; akut: boolean; kundgrupp: Kundgrupp; kalla: string; fran: string | null },
): Promise<number> {
  if (process.env.FORFRAGAN_NOTIS === '0') return 0
  const { data, error } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'koordinator')
    .eq('is_active', true)
  if (error || !data?.length) return 0
  const djur = djurLopText(forfragan.pest)
  const titel = `Ny webbförfrågan: ${djur.charAt(0).toUpperCase() + djur.slice(1)}${forfragan.city ? `, ${forfragan.city}` : ''}${forfragan.akut ? ', akut' : ''}`
  const kalla = forfragan.kalla === 'artanalys' ? 'artanalys' : `formulär${forfragan.fran ? ` (${forfragan.fran})` : ''}`
  const rader = data.map((p) => ({
    recipient_id: p.id,
    case_id: forfragan.id,
    case_type: 'web_inquiry',
    title: titel.slice(0, 200),
    preview: `${KUNDGRUPP_TEXT[forfragan.kundgrupp]}, ${kalla}`.slice(0, 500),
    case_title: titel.slice(0, 200),
    sender_id: p.id,
    sender_name: 'begone.se',
    is_read: false,
  }))
  const ins = await db.from('notifications').insert(rader)
  if (ins.error) {
    console.warn('[forfragan] notisen kunde inte skrivas', ins.error.code)
    return 0
  }
  return rader.length
}
