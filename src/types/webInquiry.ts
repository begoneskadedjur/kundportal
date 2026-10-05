// src/types/webInquiry.ts
// Leads (Webb): förfrågningar från formulären på begone.se (tabellerna web_inquiries och
// web_inquiry_events). Skilt från B2B-leadsen i tabellen leads.

export type WebInquiryStatus = 'ny' | 'kontaktad' | 'offert' | 'vunnen' | 'forlorad' | 'skrap'
export type WebInquiryKundgrupp = 'privat' | 'brf_fastighet' | 'verksamhet'
export type WebInquiryKalla = 'offertflode' | 'artanalys'
export type WebInquiryEventTyp = 'anteckning' | 'status' | 'tilldelning' | 'konvertering' | 'bilder'

export interface WebInquiryBild {
  path: string
  mime: string
  bytes: number
  uppladdad: boolean
}

export interface WebInquiry {
  id: string
  referens: string
  created_at: string
  updated_at: string
  kalla: WebInquiryKalla
  fran: string | null
  sida: string | null
  landing_url: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  gclid: string | null
  form_type: 'offert' | 'akut'
  akut: boolean
  customer_kind: 'privat' | 'foretag'
  kundgrupp: WebInquiryKundgrupp
  name: string
  phone: string
  email: string | null
  company_name: string | null
  organization_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  omrade_tackt: boolean
  pest_type: string | null
  message: string | null
  details: Record<string, string | number | boolean | null>
  bilder: WebInquiryBild[]
  consent: boolean
  consent_text_version: string | null
  status: WebInquiryStatus
  status_andrad_at: string | null
  forsta_kontakt_at: string | null
  tilldelad_till: string | null
  tilldelad_at: string | null
  lead_id: string | null
  customer_id: string | null
  kvittens_skickad_at: string | null
}

export interface WebInquiryEvent {
  id: string
  inquiry_id: string
  typ: WebInquiryEventTyp
  text: string | null
  fran_varde: string | null
  till_varde: string | null
  profile_id: string | null
  created_at: string
}

export interface StaffProfile {
  id: string
  display_name: string | null
  email: string
  role: string | null
}

export const STATUS_ORDNING: WebInquiryStatus[] = ['ny', 'kontaktad', 'offert', 'vunnen', 'forlorad', 'skrap']

export const STATUS_CONFIG: Record<WebInquiryStatus, { label: string; text: string; dot: string }> = {
  ny: { label: 'Ny', text: 'text-amber-400', dot: 'bg-amber-400' },
  kontaktad: { label: 'Kontaktad', text: 'text-sky-400', dot: 'bg-sky-400' },
  offert: { label: 'Offert', text: 'text-violet-400', dot: 'bg-violet-400' },
  vunnen: { label: 'Vunnen', text: 'text-[#20c58f]', dot: 'bg-[#20c58f]' },
  forlorad: { label: 'Förlorad', text: 'text-slate-400', dot: 'bg-slate-500' },
  skrap: { label: 'Skräp', text: 'text-slate-500', dot: 'bg-slate-600' },
}

export const KUNDGRUPP_LABEL: Record<WebInquiryKundgrupp, string> = {
  privat: 'Privat',
  brf_fastighet: 'BRF eller fastighet',
  verksamhet: 'Verksamhet',
}

const DJUR: Record<string, string> = {
  getingar: 'Getingar',
  rattor: 'Råttor',
  moss: 'Möss',
  vaggloss: 'Vägglöss',
  silverfisk: 'Silverfisk',
  myror: 'Myror',
  kackerlackor: 'Kackerlackor',
  faglar: 'Fåglar',
  annat: 'Annat',
  vetinte: 'Vet inte',
  foretag: 'Företag, ospecificerat',
}

/** Tjänsten som visningstext: djurets namn, annars sajtens svar under Annat som det står. */
export function tjanstLabel(pest: string | null | undefined): string {
  if (!pest) return 'Okänt'
  return DJUR[pest] ?? pest
}

/** Källan som visningstext: artanalys eller formulärets ingång (fran). */
export function kallaLabel(i: Pick<WebInquiry, 'kalla' | 'fran'>): string {
  if (i.kalla === 'artanalys') return 'Artanalys'
  if (!i.fran) return 'Formulär'
  if (i.fran.startsWith('tjanst-')) return `Tjänstesida: ${i.fran.slice(7)}`
  const map: Record<string, string> = { start: 'Startsidan', kontakt: 'Kontakt', foretag: 'Företagssidan', prisforslag: 'Prisförslag' }
  return map[i.fran] ?? i.fran
}
