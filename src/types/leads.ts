// src/types/leads.ts
// Leads (B2B) sedan etapp 3 (2026-10-10): steg, källa, aktiviteter och delning.
// Databasen: supabase/migrations/20261010_leads_datamodell.sql. Sammanfattning: docs/leads/ETAPP-3-4.md.

export type LeadStage = 'ny' | 'kontaktad' | 'besok_bokat' | 'offert_skickad' | 'vunnen' | 'forlorad' | 'parkerad'

export type LeadSource =
  | 'tekniker_tips' | 'engangsarende' | 'webbforfragan' | 'telefon' | 'mejl'
  | 'rekommendation' | 'befintlig_kund' | 'upphandling' | 'kall_bearbetning' | 'ovrigt'

export type LeadTyp = 'nytt_avtal' | 'utokning'
export type LeadKundgrupp = 'foretag' | 'privat' | 'forening'
export type LeadUrsprungTabell = 'private_cases' | 'business_cases' | 'cases' | 'station_inspection_sessions'

export type LeadForlustorsak =
  | 'pris' | 'annan_leverantor' | 'ingen_budget' | 'inget_behov'
  | 'ingen_kontakt' | 'fel_tidpunkt' | 'dubblett' | 'ovrigt'

export type LeadAktivitetSystem =
  | 'skapad' | 'stage' | 'agare' | 'varde' | 'nasta_steg' | 'parkerad' | 'forlorad' | 'delad' | 'delning_borttagen'
  | 'kund_kopplad' | 'arende_kopplat' | 'offert_skickad' | 'offert_avbojd' | 'avtal_signerat' | 'tipsbonus'
export type LeadAktivitetManuell = 'anteckning' | 'samtal' | 'mejl' | 'mote'
export type LeadAktivitetTyp = LeadAktivitetSystem | LeadAktivitetManuell

export interface LeadAktivitet {
  id: string
  lead_id: string
  kind: LeadAktivitetTyp
  text: string | null
  fran_varde: string | null
  till_varde: string | null
  ref_table: string | null
  ref_id: string | null
  occurred_at: string
  profile_id: string | null
  created_at: string
}

export interface LeadMedlem {
  id: string
  lead_id: string
  profile_id: string
  added_by: string | null
  created_at: string
  removed_at: string | null
  removed_by: string | null
}

/** Personal från RPC lead_personal (alla anställda kan äga en lead). */
export interface LeadPerson {
  id: string
  namn: string
  roll: string
  aktiv: boolean
}

/** Träff från RPC lead_dubbletter. */
export interface LeadDubblett {
  id: string
  company_name: string
  stage: LeadStage
  agare: string | null
  traff: 'org.nr' | 'telefon' | 'e-post'
  kan_oppna: boolean
}

// ---------------------------------------------------------------------------
// Etiketter och färger (status som färgad punkt + text, aldrig piller)
// ---------------------------------------------------------------------------
export const LEAD_STAGES: LeadStage[] = ['ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'vunnen', 'forlorad', 'parkerad']
export const OPPNA_STAGES: LeadStage[] = ['ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'parkerad']
/** Steg som säljaren sätter för hand. Övriga sätts av systemet (etapp 5); admin/koordinator kan sätta dem i ⋯-menyn. */
export const MANUELLA_STAGES: LeadStage[] = ['ny', 'kontaktad']
export const AUTOMATISKA_STAGES: LeadStage[] = ['besok_bokat', 'offert_skickad', 'vunnen']

export const STAGE_ETIKETT: Record<LeadStage, string> = {
  ny: 'Ny',
  kontaktad: 'Kontaktad',
  besok_bokat: 'Besök bokat',
  offert_skickad: 'Offert skickad',
  vunnen: 'Vunnen',
  forlorad: 'Förlorad',
  parkerad: 'Parkerad',
}

/** Punktfärg (bg) och textfärg per steg. */
export const STAGE_FARG: Record<LeadStage, { punkt: string; text: string }> = {
  ny: { punkt: 'bg-blue-400', text: 'text-blue-300' },
  kontaktad: { punkt: 'bg-amber-400', text: 'text-amber-300' },
  besok_bokat: { punkt: 'bg-cyan-400', text: 'text-cyan-300' },
  offert_skickad: { punkt: 'bg-orange-400', text: 'text-orange-300' },
  vunnen: { punkt: 'bg-[#20c58f]', text: 'text-[#20c58f]' },
  forlorad: { punkt: 'bg-red-400', text: 'text-red-300' },
  parkerad: { punkt: 'bg-slate-400', text: 'text-slate-300' },
}

export const KALLA_ETIKETT: Record<LeadSource, string> = {
  tekniker_tips: 'Teknikertips',
  engangsarende: 'Engångsärende',
  webbforfragan: 'Webbförfrågan',
  telefon: 'Telefon',
  mejl: 'Mejl',
  rekommendation: 'Rekommendation',
  befintlig_kund: 'Befintlig kund',
  upphandling: 'Upphandling',
  kall_bearbetning: 'Kall bearbetning',
  ovrigt: 'Övrigt',
}
export const LEAD_KALLOR = Object.keys(KALLA_ETIKETT) as LeadSource[]

export const TYP_ETIKETT: Record<LeadTyp, string> = {
  nytt_avtal: 'Nytt avtal',
  utokning: 'Utökning',
}

export const KUNDGRUPP_ETIKETT: Record<LeadKundgrupp, string> = {
  foretag: 'Företag',
  privat: 'Privatperson',
  forening: 'Förening',
}

export const FORLUSTORSAK_ETIKETT: Record<LeadForlustorsak, string> = {
  pris: 'Pris',
  annan_leverantor: 'Valde annan leverantör',
  ingen_budget: 'Ingen budget',
  inget_behov: 'Inget behov',
  ingen_kontakt: 'Fick aldrig kontakt',
  fel_tidpunkt: 'Fel tidpunkt',
  dubblett: 'Dubblett',
  ovrigt: 'Övrigt',
}
export const FORLUSTORSAKER = Object.keys(FORLUSTORSAK_ETIKETT) as LeadForlustorsak[]

export const URSPRUNG_ETIKETT: Record<LeadUrsprungTabell, string> = {
  private_cases: 'privat engångsärende',
  business_cases: 'företagsärende',
  cases: 'avtalsärende',
  station_inspection_sessions: 'stationskontroll',
}

export const AKTIVITET_ETIKETT: Record<LeadAktivitetTyp, string> = {
  skapad: 'Lead skapad',
  stage: 'Status ändrad',
  agare: 'Ny ägare',
  varde: 'Årspremie ändrad',
  nasta_steg: 'Nästa steg',
  parkerad: 'Parkerad',
  forlorad: 'Förlorad',
  delad: 'Delad med',
  delning_borttagen: 'Delning borttagen',
  kund_kopplad: 'Kund kopplad',
  arende_kopplat: 'Ärende kopplat',
  offert_skickad: 'Offert skickad',
  offert_avbojd: 'Offert avböjd',
  avtal_signerat: 'Avtal signerat',
  tipsbonus: 'Tipsbonus',
  anteckning: 'Anteckning',
  samtal: 'Samtal',
  mejl: 'Mejl',
  mote: 'Möte',
}

export const MANUELLA_AKTIVITETER: LeadAktivitetManuell[] = ['anteckning', 'samtal', 'mejl', 'mote']

export const arOppen = (stage: LeadStage) => stage !== 'vunnen' && stage !== 'forlorad'

// ---------------------------------------------------------------------------
// Etapp 5: lead från engångsärende (RPC lead_arende_underlag och lead_fran_arende)
// ---------------------------------------------------------------------------
export type LeadArendeTabell = 'private_cases' | 'business_cases'
export type LeadBokatTabell = 'private_cases' | 'business_cases' | 'cases'

/** "Vad gäller det?" Företag: de tre första. Privat: de tre sista (forening och foretag kräver namn). */
export type LeadGaller = 'lopande_avtal' | 'fler_adresser' | 'annan_tjanst' | 'hemmet' | 'forening' | 'foretag'

export const GALLER_FORETAG: { varde: LeadGaller; etikett: string; hjalp: string }[] = [
  { varde: 'lopande_avtal', etikett: 'Löpande avtal', hjalp: 'Kunden vill ha regelbunden kontroll' },
  { varde: 'fler_adresser', etikett: 'Fler adresser', hjalp: 'Kunden har fler lokaler' },
  { varde: 'annan_tjanst', etikett: 'Annan tjänst', hjalp: 'Till exempel sanering eller tätning' },
]
export const GALLER_PRIVAT: { varde: LeadGaller; etikett: string; hjalp: string }[] = [
  { varde: 'hemmet', etikett: 'Löpande avtal för hemmet', hjalp: 'Kunden vill ha regelbunden kontroll' },
  { varde: 'forening', etikett: 'Bostadsrättsföreningen', hjalp: 'Kunden sitter i styrelsen eller vet vem som gör det' },
  { varde: 'foretag', etikett: 'Kundens företag', hjalp: 'Kunden driver eller arbetar på ett företag med behov' },
]

/** Lead som redan finns på ärendet (unikt per ursprungsärende). */
export interface LeadPaArende {
  id: string
  company_name: string
  stage: LeadStage
  kan_oppna: boolean
}

/** Ärendets uppgifter för modalen. Personnummer lämnar aldrig databasen. */
export interface LeadArendeUnderlag {
  case_type: LeadArendeTabell
  case_id: string
  case_number: string | null
  foretag: string | null
  org_nr: string | null
  kontakt: string | null
  telefon: string | null
  epost: string | null
  adress: string | null
  skadedjur: string | null
  befintlig: LeadPaArende | null
  dubbletter: LeadDubblett[]
}

export interface LeadFranArendeSvar {
  lead_id: string
  company_name: string
  skapad: boolean
  kan_oppna: boolean
}

// ---------------------------------------------------------------------------
// Etapp 6: statistik (RPC lead_statistik). Pipeline och hygien är läget nu, resten gäller perioden.
// ---------------------------------------------------------------------------
export interface LeadStatSumma {
  skapade: number
  tips: number
  vunna: number
  forlorade: number
  vunnen_premie: number
  vunnen_nytt: number
  vunnen_utokning: number
  oppna: number
  pipeline: number
  parkerade: number
  ledtid_vunnen_median: number | null
  ledtid_vunnen_antal: number
}

export interface LeadStatPipelineSteg {
  steg: LeadStage
  antal: number
  varde: number
}

export interface LeadStatAgare {
  profile_id: string | null
  namn: string
  antal: number
  varde: number
  ny: number
  kontaktad: number
  besok_bokat: number
  offert_skickad: number
  varde_offert: number
}

export interface LeadStatManad {
  manad: string
  skapade: number
  tips: number
  vunna: number
  forlorade: number
  vunnen_nytt: number
  vunnen_utokning: number
}

/** En rad i kedjan skapade, kontaktade, besök, offert, vunnen (per källa eller ursprung). */
export interface LeadStatKedja {
  nyckel: string
  skapade: number
  kontaktade: number
  besok: number
  offert: number
  vunna: number
  forlorade: number
  oppna: number
  vunnen_premie: number
}

export interface LeadStatTidISteg {
  steg: LeadStage
  antal: number
  median_dagar: number | null
  p75_dagar: number | null
}

export interface LeadStatHygien {
  profile_id: string | null
  namn: string
  oppna: number
  forsenade: number
  saknar_nasta: number
  /** Leads skapade i perioden där tvådagarsfristen gått ut eller kontakt tagits (tidpunkt känd). */
  nya_bedomda: number
  nya_inom: number
  nya_sena: number
  nya_ej: number
}

export interface LeadStatTips {
  profile_id: string
  namn: string
  roll: string | null
  tips: number
  oppna: number
  vunna: number
  forlorade: number
  vunnen_premie: number
}

export interface LeadStatistik {
  behorighet: 'alla' | 'egna'
  fran: string
  till: string
  summa: LeadStatSumma
  pipeline_steg: LeadStatPipelineSteg[]
  pipeline_agare: LeadStatAgare[]
  manader: LeadStatManad[]
  kedja_kalla: LeadStatKedja[]
  kedja_ursprung: LeadStatKedja[]
  tid_i_steg: LeadStatTidISteg[]
  forlustorsaker: { orsak: LeadForlustorsak; antal: number }[]
  hygien: LeadStatHygien[]
  tips: LeadStatTips[]
}
