// src/services/teknikerDagService.ts
// Datahämtning för nya arbetsvyn (Idag, Karta, Mina ärenden).
//
// Läser teknikerns besök ur ALLA tre källor:
//  - cases (avtalsärenden): scheduled_start, primary/secondary/tertiary_technician_id,
//    deleted_at null, status inte Borttaget
//  - private_cases och business_cases: start_date, primary/secondary/tertiary_assignee_id,
//    deleted_at null, legacy_archived_at null (ClickUp-arkivet före 2026-05-01 visas inte)
//
// Datum räknas alltid i svensk tid (Europe/Stockholm) och dagens gränser skickas
// som ISO-strängar med uttrycklig offset, aldrig rå toISOString().

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { supabase } from '../lib/supabase'
import { OfferFollowUpService } from './offerFollowUpService'

export const SVENSK_TZ = 'Europe/Stockholm'

export type ArendeKalla = 'cases' | 'private' | 'business'

/** Typen styr ikon, etikett och vilken modal som öppnar ärendet */
export type BesokTyp =
  | 'inspection'
  | 'establishment'
  | 'routine'
  | 'contract_extra'
  | 'rondering'
  | 'egenkontroll'
  | 'contract'
  | 'private'
  | 'business'

export interface DagBesok {
  /** Unik nyckel över källorna, t.ex. "cases:uuid" */
  nyckel: string
  kalla: ArendeKalla
  id: string
  typ: BesokTyp
  serviceType: string | null
  start: Date | null
  slut: Date | null
  /** YYYY-MM-DD i svensk tid, null om ingen tid är satt */
  dag: string | null
  status: string
  avslutad: boolean
  kund: string
  titel: string | null
  adress: string
  telefon: string | null
  kontaktperson: string | null
  customerId: string | null
  skadedjur: string | null
  arendenummer: string | null
  avslutsdatum: Date | null
}

// ─── Svensk tid ───

/** YYYY-MM-DD för ett ögonblick, räknat i svensk tid */
export function svenskDag(d: Date = new Date()): string {
  return formatInTimeZone(d, SVENSK_TZ, 'yyyy-MM-dd')
}

/** Lägger till dagar på en YYYY-MM-DD (kalenderdagar, oberoende av sommartid) */
export function laggTillDagar(dag: string, antal: number): string {
  const [y, m, d] = dag.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + antal, 12))
  return utc.toISOString().slice(0, 10)
}

/** Midnatt för en svensk kalenderdag som ISO-sträng med uttrycklig offset */
export function svenskMidnatt(dag: string): string {
  const ogonblick = fromZonedTime(`${dag}T00:00:00`, SVENSK_TZ)
  return formatInTimeZone(ogonblick, SVENSK_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

/** Veckodag 1 (måndag) till 7 (söndag) för en YYYY-MM-DD */
export function veckodag(dag: string): number {
  const [y, m, d] = dag.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return wd === 0 ? 7 : wd
}

/** Sista dagen (söndag) i veckan som dagen tillhör */
export function veckansSlut(dag: string): string {
  return laggTillDagar(dag, 7 - veckodag(dag))
}

export function klockslag(d: Date | null): string {
  if (!d) return ''
  return formatInTimeZone(d, SVENSK_TZ, 'HH:mm')
}

const VECKODAGAR_KORT = ['', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön']
const VECKODAGAR = ['', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** "Onsdag 22 oktober" */
export function langtDatum(dag: string): string {
  const [, m, d] = dag.split('-').map(Number)
  const v = VECKODAGAR[veckodag(dag)]
  return `${v.charAt(0).toUpperCase()}${v.slice(1)} ${d} ${MANADER[m - 1]}`
}

/** "Idag", "Imorgon", "Tors" eller datumet */
export function kortDag(dag: string | null, idag: string = svenskDag()): string {
  if (!dag) return ''
  if (dag === idag) return 'Idag'
  if (dag === laggTillDagar(idag, 1)) return 'Imorgon'
  if (dag === laggTillDagar(idag, -1)) return 'Igår'
  if (dag > idag && dag <= veckansSlut(idag)) return VECKODAGAR_KORT[veckodag(dag)]
  return dag
}

// ─── Etiketter ───

export const TYP_ETIKETT: Record<BesokTyp, string> = {
  inspection: 'Kontrollbesök',
  establishment: 'Etablering',
  routine: 'Rutinbesök',
  contract_extra: 'Extrabesök',
  rondering: 'Rondering',
  egenkontroll: 'Egenkontroll',
  contract: 'Avtalsärende',
  private: 'Privat',
  business: 'Företag',
}

/** Typ plus skadedjur för privat- och företagsärenden, t.ex. "Privat, råttor" */
export function besokBeskrivning(b: DagBesok): string {
  if ((b.typ === 'private' || b.typ === 'business') && b.skadedjur) {
    return `${TYP_ETIKETT[b.typ]}, ${b.skadedjur.toLowerCase()}`
  }
  return TYP_ETIKETT[b.typ]
}

export function arAvtalsbesok(b: DagBesok): boolean {
  return b.kalla === 'cases'
}

// ─── Länkar ───

export function navigeraUrl(adress: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adress)}`
}

export function telUrl(telefon: string): string {
  return `tel:${telefon.replace(/[^\d+]/g, '')}`
}

// ─── Mappning ───

/** Adressfälten är jsonb: sträng, JSON-sträng eller { formatted_address } */
export function formateraAdress(varde: unknown): string {
  if (!varde) return ''
  if (typeof varde === 'object') {
    const o = varde as { formatted_address?: string }
    return o.formatted_address || ''
  }
  if (typeof varde === 'string') {
    const s = varde.trim()
    if (s.startsWith('{') || s.startsWith('"')) {
      try {
        const p = JSON.parse(s)
        if (typeof p === 'string') return p
        if (p && typeof p === 'object' && p.formatted_address) return p.formatted_address
      } catch {
        /* vanlig sträng */
      }
    }
    return s
  }
  return ''
}

function tid(v: unknown): Date | null {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function typForServiceType(st: string | null | undefined): BesokTyp {
  switch (st) {
    case 'inspection': return 'inspection'
    case 'establishment': return 'establishment'
    case 'routine': return 'routine'
    case 'contract_extra': return 'contract_extra'
    case 'rondering_trafikkontoret': return 'rondering'
    case 'egenkontroll_trafikkontoret': return 'egenkontroll'
    default: return 'contract'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function franCases(c: any): DagBesok {
  const kund = c.customer || {}
  const start = tid(c.scheduled_start)
  return {
    nyckel: `cases:${c.id}`,
    kalla: 'cases',
    id: c.id,
    typ: typForServiceType(c.service_type),
    serviceType: c.service_type ?? null,
    start,
    slut: tid(c.scheduled_end),
    dag: start ? svenskDag(start) : null,
    status: c.status || '',
    avslutad: c.status === 'Avslutat',
    kund: kund.company_name || c.title || 'Okänd kund',
    titel: c.title ?? null,
    adress: formateraAdress(c.address) || kund.contact_address || '',
    telefon: c.contact_phone || kund.contact_phone || null,
    kontaktperson: c.contact_person || kund.contact_person || null,
    customerId: c.customer_id ?? null,
    skadedjur: c.pest_type ?? null,
    arendenummer: c.case_number ?? null,
    avslutsdatum: tid(c.completed_date),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function franClickUp(c: any, kalla: 'private' | 'business'): DagBesok {
  const start = tid(c.start_date)
  return {
    nyckel: `${kalla}:${c.id}`,
    kalla,
    id: c.id,
    typ: kalla,
    serviceType: null,
    start,
    slut: tid(c.due_date),
    dag: start ? svenskDag(start) : null,
    status: c.status || '',
    avslutad: c.status === 'Avslutat',
    kund: (kalla === 'business' ? c.company_name || c.bestallare : null) || c.kontaktperson || c.title || 'Okänd kund',
    titel: c.title ?? null,
    adress: formateraAdress(c.adress),
    telefon: c.telefon_kontaktperson || null,
    kontaktperson: c.kontaktperson || null,
    customerId: null,
    skadedjur: c.skadedjur || c.annat_skadedjur || null,
    arendenummer: c.case_number ?? null,
    avslutsdatum: tid(c.completed_date),
  }
}

const CASES_FALT = 'id, title, status, service_type, scheduled_start, scheduled_end, completed_date, address, contact_person, contact_phone, customer_id, case_number, pest_type, customer:customers(company_name, contact_address, contact_person, contact_phone)'
const CLICKUP_FALT_PRIVAT = 'id, title, status, start_date, due_date, completed_date, adress, kontaktperson, telefon_kontaktperson, skadedjur, annat_skadedjur, case_number'
const CLICKUP_FALT_FORETAG = `${CLICKUP_FALT_PRIVAT}, company_name, bestallare`

function sortera(lista: DagBesok[]): DagBesok[] {
  return lista.sort((a, b) => {
    const ta = a.start?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = b.start?.getTime() ?? Number.MAX_SAFE_INTEGER
    return ta - tb
  })
}

/**
 * Teknikerns besök från och med dagen `fran` till och med dagen `till` (YYYY-MM-DD, svensk tid).
 * Borttagna ärenden tas aldrig med.
 */
export async function hamtaBesok(technicianId: string, fran: string, till: string): Promise<DagBesok[]> {
  const gte = svenskMidnatt(fran)
  const lt = svenskMidnatt(laggTillDagar(till, 1))
  const tek = technicianId

  const [casesRes, privRes, bizRes] = await Promise.all([
    supabase.from('cases').select(CASES_FALT)
      .or(`primary_technician_id.eq.${tek},secondary_technician_id.eq.${tek},tertiary_technician_id.eq.${tek}`)
      .is('deleted_at', null)
      .neq('status', 'Borttaget')
      .gte('scheduled_start', gte)
      .lt('scheduled_start', lt),
    supabase.from('private_cases').select(CLICKUP_FALT_PRIVAT)
      .or(`primary_assignee_id.eq.${tek},secondary_assignee_id.eq.${tek},tertiary_assignee_id.eq.${tek}`)
      .is('deleted_at', null)
      .is('legacy_archived_at', null)
      .neq('status', 'Borttaget')
      .gte('start_date', gte)
      .lt('start_date', lt),
    supabase.from('business_cases').select(CLICKUP_FALT_FORETAG)
      .or(`primary_assignee_id.eq.${tek},secondary_assignee_id.eq.${tek},tertiary_assignee_id.eq.${tek}`)
      .is('deleted_at', null)
      .is('legacy_archived_at', null)
      .neq('status', 'Borttaget')
      .gte('start_date', gte)
      .lt('start_date', lt),
  ])
  if (casesRes.error) throw casesRes.error
  if (privRes.error) throw privRes.error
  if (bizRes.error) throw bizRes.error

  return sortera([
    ...(casesRes.data || []).map(franCases),
    ...(privRes.data || []).map(c => franClickUp(c, 'private')),
    ...(bizRes.data || []).map(c => franClickUp(c, 'business')),
  ])
}

/** Alla teknikerns ärenden (alla datum) för Mina ärenden. Borttagna tas inte med. */
export async function hamtaAllaArenden(technicianId: string): Promise<DagBesok[]> {
  const tek = technicianId
  const [casesRes, privRes, bizRes] = await Promise.all([
    supabase.from('cases').select(CASES_FALT)
      .or(`primary_technician_id.eq.${tek},secondary_technician_id.eq.${tek},tertiary_technician_id.eq.${tek}`)
      .is('deleted_at', null)
      .neq('status', 'Borttaget')
      .limit(5000),
    supabase.from('private_cases').select(CLICKUP_FALT_PRIVAT)
      .or(`primary_assignee_id.eq.${tek},secondary_assignee_id.eq.${tek},tertiary_assignee_id.eq.${tek}`)
      .is('deleted_at', null)
      .is('legacy_archived_at', null)
      .neq('status', 'Borttaget')
      .limit(5000),
    supabase.from('business_cases').select(CLICKUP_FALT_FORETAG)
      .or(`primary_assignee_id.eq.${tek},secondary_assignee_id.eq.${tek},tertiary_assignee_id.eq.${tek}`)
      .is('deleted_at', null)
      .is('legacy_archived_at', null)
      .neq('status', 'Borttaget')
      .limit(5000),
  ])
  if (casesRes.error) throw casesRes.error
  if (privRes.error) throw privRes.error
  if (bizRes.error) throw bizRes.error

  return sortera([
    ...(casesRes.data || []).map(franCases),
    ...(privRes.data || []).map(c => franClickUp(c, 'private')),
    ...(bizRes.data || []).map(c => franClickUp(c, 'business')),
  ])
}

/** Antal aktiva stationer (ute + inne) per kund. Tomt om inget går att läsa. */
export async function hamtaStationsantal(customerIds: string[]): Promise<Map<string, number>> {
  const antal = new Map<string, number>()
  const ids = [...new Set(customerIds.filter(Boolean))]
  if (ids.length === 0) return antal
  try {
    const [ute, planer] = await Promise.all([
      supabase.from('equipment_placements').select('customer_id').in('customer_id', ids).eq('status', 'active'),
      supabase.from('floor_plans').select('id, customer_id').in('customer_id', ids),
    ])
    for (const r of ute.data || []) {
      antal.set(r.customer_id, (antal.get(r.customer_id) || 0) + 1)
    }
    const planTillKund = new Map<string, string>()
    for (const p of planer.data || []) planTillKund.set(p.id, p.customer_id)
    if (planTillKund.size > 0) {
      const inne = await supabase.from('indoor_stations').select('floor_plan_id').in('floor_plan_id', [...planTillKund.keys()]).eq('status', 'active')
      for (const r of inne.data || []) {
        const k = planTillKund.get(r.floor_plan_id)
        if (k) antal.set(k, (antal.get(k) || 0) + 1)
      }
    }
  } catch (e) {
    console.warn('[teknikerDag] stationsantal kunde inte läsas', e)
  }
  return antal
}

// ─── Grupperingar ───

/** Status som betyder att ärendet behöver bokas (samma mappning som CaseSummaryCard) */
const BEHOVER_BOKAS = new Set(['Öppen', 'Offert signerad - boka in', 'Avtal signerat - Etablera'])

export type VantarOrsak = 'boka' | 'avsluta'

export interface VantarRad {
  besok: DagBesok
  orsak: VantarOrsak
}

/**
 * Det som väntar på teknikern och som går att räkna säkert:
 *  - boka: privat- eller företagsärende med status som betyder att tid saknas
 *  - avsluta: bokat besök vars dag har passerat utan att ärendet avslutats
 */
export function vantarPaDig(alla: DagBesok[], idag: string = svenskDag()): VantarRad[] {
  const ut: VantarRad[] = []
  for (const b of alla) {
    if (b.avslutad) continue
    if (b.kalla !== 'cases' && BEHOVER_BOKAS.has(b.status)) {
      ut.push({ besok: b, orsak: 'boka' })
    } else if (b.dag && b.dag < idag && (b.status === 'Bokad' || b.status === 'Återbesök')) {
      ut.push({ besok: b, orsak: 'avsluta' })
    }
  }
  return ut
}

export interface OffertLage {
  forfallna: number
  attFolja: number
}

/** Offerter att följa upp, samma regel som OfferSummaryCard (förfallen eller väntande minst 5 dagar) */
export async function hamtaOffertLage(technicianId: string): Promise<OffertLage | null> {
  const { data: tek } = await supabase.from('technicians').select('email').eq('id', technicianId).maybeSingle()
  const email = tek?.email
  if (!email) return null
  const { offers } = await OfferFollowUpService.getDashboardData(email)
  let forfallna = 0
  let attFolja = 0
  for (const o of offers) {
    if (o.status === 'overdue') forfallna++
    else if (o.status === 'pending' && o.age_days >= 5) attFolja++
  }
  return { forfallna, attFolja }
}

/** Nästa besök: första ej avslutade som inte slutat för mer än en timme sedan */
export function nastaBesok(dagens: DagBesok[], nu: Date = new Date()): DagBesok | null {
  const kvar = dagens.filter(b => !b.avslutad)
  const grans = nu.getTime() - 60 * 60 * 1000
  const pagaende = kvar.find(b => {
    const t = (b.slut ?? b.start)?.getTime()
    return t !== undefined && t >= grans
  })
  return pagaende ?? kvar[0] ?? null
}

/** "om 25 min", "om 2 h 10 min", "pågår" eller tomt */
export function tidTill(start: Date | null, nu: Date = new Date()): string {
  if (!start) return ''
  const min = Math.round((start.getTime() - nu.getTime()) / 60000)
  if (min <= 0) return min > -90 ? 'nu' : ''
  if (min < 60) return `om ${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest ? `om ${h} h ${rest} min` : `om ${h} h`
}
