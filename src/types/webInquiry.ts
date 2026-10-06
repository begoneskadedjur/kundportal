// src/types/webInquiry.ts
// Leads (Webb): förfrågningar från formulären på begone.se (tabellerna web_inquiries och
// web_inquiry_events). Skilt från B2B-leadsen i tabellen leads.

export type WebInquiryStatus = 'ny' | 'kontaktad' | 'offert' | 'bokad' | 'befintlig_kund' | 'vunnen' | 'forlorad' | 'skrap'
/** cases = avtalsärende, stationskontroll eller etablering för en befintlig avtalskund. */
export type WebInquiryArendeTabell = 'private_cases' | 'business_cases' | 'cases'
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
  /** Ärendet som skapades från förfrågan (sätts en gång och ger status Bokad). */
  arende_tabell: WebInquiryArendeTabell | null
  arende_id: string | null
  bokad_at: string | null
  /** Sant om förfrågan någon gång haft status Offert: 90 dagars frist i stället för 30. */
  haft_offert: boolean
  /** När det kopplade ärendet fakturerades (sätts av dygnsjobbet). */
  fakturerad_at: string | null
  /** Oneflow-id för offerten som skickades från förfrågan (sätts av guiden, ger status Offert). */
  offert_oneflow_id: string | null
  offert_contract_id: string | null
  offert_skickad_at: string | null
  /** Tjänsten koordinatorn valde i ärendet. Kundens eget val står kvar i pest_type. */
  bokad_tjanst: string | null
  /** Ärendenumret kunden fick (case_number). Har inget med förfrågans referens att göra. */
  arende_nummer: string | null
  /** Sant när ett befintligt ärende kopplades i efterhand i stället för att skapas från förfrågan. */
  arende_kopplat: boolean
  /**
   * Kompletteringar efter samtalet. Kundens originalsvar ovan står kvar oförändrade.
   * id_nummer: personnummer (ÅÅÅÅMMDD-XXXX) eller org.nr (XXXXXX-XXXX). Logga aldrig värdet.
   */
  id_nummer: string | null
  id_nummer_typ: 'personnummer' | 'orgnr' | null
  rattad_adress: string | null
  rattad_postnummer: string | null
  rattad_ort: string | null
  kompletterad_at: string | null
  kompletterad_av: string | null
}

export interface WebInquiryKomplettering {
  id_nummer: string | null
  id_nummer_typ: 'personnummer' | 'orgnr' | null
  rattad_adress: string | null
  rattad_postnummer: string | null
  rattad_ort: string | null
}

/** Hur en förfrågan matchades mot en befintlig kund, i prioritetsordning. */
export type KundMatchSatt = 'orgnr' | 'epostdoman' | 'telefon'

export const KUND_MATCH_LABEL: Record<KundMatchSatt, string> = {
  orgnr: 'org.nr',
  epostdoman: 'e-postdomän',
  telefon: 'telefonnummer',
}

/** En aktiv kund i kundregistret som förfrågan matchar. */
export interface KundMatchning {
  customer_id: string
  namn: string
  kundnummer: number | null
  /** Enheten under ett huvudkontor; huvudkontor_id pekar då på huvudkontoret. */
  ar_enhet: boolean
  huvudkontor_id: string | null
  huvudkontor_namn: string | null
  /** Gällande avtal (eget, via avtalsomfattning, via huvudkontoret eller på kundraden). */
  har_avtal: boolean
  /** Avtalets slutdatum ÅÅÅÅ-MM-DD, null när det saknas (tillsvidare). */
  avtal_till: string | null
  satt: KundMatchSatt
}

/** Ett ärende som hittats på ärendenummer för Koppla befintligt ärende. */
export interface ArendeTraff {
  tabell: WebInquiryArendeTabell
  id: string
  case_number: string
  created_at: string
  /** Kundens namn eller kontaktpersonen. */
  kund: string | null
  /** Ärendets typ i klartext: Privatperson, Företag, Avtalsärende, Stationskontroll, Etablering. */
  typ: string
  service_type: string | null
  status: string | null
  /** Sant när ärendet redan är kopplat till en förfrågan. */
  kopplat: boolean
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

export const STATUS_ORDNING: WebInquiryStatus[] = ['ny', 'kontaktad', 'offert', 'bokad', 'befintlig_kund', 'vunnen', 'forlorad', 'skrap']

/**
 * Statusar som personalen kan sätta för hand på en förfrågan som inte bokats. Offert sätts när en
 * offert skickats från förfrågan, Bokad när ett ärende skapas och Vunnen bara av dygnsjobbet;
 * databasens trigger spärrar resten.
 */
export const MANUELLA_STATUSAR: WebInquiryStatus[] = ['ny', 'kontaktad', 'forlorad', 'skrap']

/** Dagar från bokningen som ärendet har på sig att faktureras för att räknas som vunnet. */
export const FRIST_DAGAR = 30
export const FRIST_DAGAR_OFFERT = 90

export const STATUS_CONFIG: Record<WebInquiryStatus, { label: string; text: string; dot: string }> = {
  ny: { label: 'Ny', text: 'text-amber-400', dot: 'bg-amber-400' },
  kontaktad: { label: 'Kontaktad', text: 'text-sky-400', dot: 'bg-sky-400' },
  offert: { label: 'Offert', text: 'text-violet-400', dot: 'bg-violet-400' },
  bokad: { label: 'Bokad', text: 'text-teal-300', dot: 'bg-teal-300' },
  befintlig_kund: { label: 'Befintlig kund', text: 'text-cyan-300', dot: 'bg-cyan-300' },
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
