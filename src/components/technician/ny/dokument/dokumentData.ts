// src/components/technician/ny/dokument/dokumentData.ts
// Data och vylogik för teknikerns Dokumentsignering i nya arbetsvyn.
//
// All data kommer från OfferFollowUpService.getDashboardData(ownDocsEmail, userId)
// och klassningen (queue_category) är densamma som i gamla vyn. Här görs bara
// vylagret: nio kategorier blir fyra grupper efter vem som gör nästa steg.
//
//   Att göra          Kunden har skrivit (svar), Förfallna (forfallna, högst 30 dagar),
//                     Väntar länge på svar (loper_ut, aldrig_fram), Ring idag (ringlista),
//                     Utkast att skicka (utkast)
//   Väntar på kunden  bevakas
//   Signerade         boka, plus signerade med booked_case_id i 14 dagar efter bokningen
//   Klara             resten av klart och förfallna äldre än 30 dagar (bara i visningen,
//                     ingen ändring i databasen)
//
// Behörigheter (läst ur RLS och api/oneflow 2026-10-23):
//   Oneflow-anrop (konversation, svar, förläng, radera) kräver admin, koordinator
//   eller säljare i requireAuth (primärroll, is_admin eller extra_roles).
//   coordinator_case_actions (Skriv av, ring åter, kontaktförsök) läses och skrivs
//   bara av admin och koordinator (role eller is_admin).
//   contracts.hidden_by (Dölj) uppdateras bara av admin, koordinator och säljare
//   (is_admin eller primärroll).
// Knappar som rollen inte får använda visas inte.

import { supabase } from '../../../../lib/supabase'
import { OfferFollowUpService, type FollowUpOffer } from '../../../../services/offerFollowUpService'
import type { Profile } from '../../../../contexts/AuthContext'
import type { ArendeKalla } from '../../../../services/teknikerDagService'
import type { Ton } from '../besokTyp'

// ─── Tid och datum, alltid svensk tid ───

const TZ = 'Europe/Stockholm'

/** ÅÅÅÅ-MM-DD i svensk tid för en tidsstämpel */
export function svDatum(iso: string | null | undefined): string {
  if (!iso) return ''
  // Rena datum (signing_deadline, follow_up_at) är redan svenska kalenderdagar
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { timeZone: TZ })
}

/** HH:MM i svensk tid */
export function svTid(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

export function idagSv(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ })
}

/** Kalenderdagar från ett datum till ett annat (ÅÅÅÅ-MM-DD) */
export function dagarMellan(fran: string, till: string): number {
  const [y1, m1, d1] = fran.split('-').map(Number)
  const [y2, m2, d2] = till.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Datum plus n dagar, ÅÅÅÅ-MM-DD */
export function plusDagar(datum: string, n: number): string {
  const [y, m, d] = datum.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().substring(0, 10)
}

/** Ålder i klartext: "idag 16:42", "igår 16:42", "för 5 dagar sedan" eller datumet */
export function sedan(iso: string | null | undefined, medTid = false): string {
  if (!iso) return ''
  const dag = svDatum(iso)
  const n = dagarMellan(dag, idagSv())
  const tid = medTid && !/^\d{4}-\d{2}-\d{2}$/.test(iso) ? ` ${svTid(iso)}` : ''
  if (n <= 0) return `idag${tid}`
  if (n === 1) return `igår${tid}`
  if (n < 14) return `för ${n} dagar sedan`
  return dag
}

/** "för 9 dagar sedan", "idag" eller "igår" från ett antal dagar */
export function dagarSedanText(n: number): string {
  if (n <= 0) return 'idag'
  if (n === 1) return 'igår'
  return `för ${n} dagar sedan`
}

export function kr(v: number | null | undefined): string | null {
  if (v == null || Number(v) <= 0) return null
  return `${Math.round(Number(v)).toLocaleString('sv-SE')} kr`
}

// ─── Behörigheter ───

export interface Behorighet {
  /** Oneflow via api/oneflow: läs och svara i konversationen, förläng, radera */
  oneflow: boolean
  /** coordinator_case_actions: Skriv av, ring åter */
  atgarder: boolean
  /** contracts.hidden_by: Dölj i min lista */
  dolja: boolean
}

export function behorighet(profile: Profile | null): Behorighet {
  if (!profile) return { oneflow: false, atgarder: false, dolja: false }
  const roller = new Set<string>()
  if (profile.role) roller.add(profile.role)
  if (profile.is_admin) roller.add('admin')
  for (const r of profile.extra_roles || []) roller.add(r)
  return {
    oneflow: roller.has('admin') || roller.has('koordinator') || roller.has('säljare'),
    atgarder: profile.is_admin === true || profile.role === 'admin' || profile.role === 'koordinator',
    dolja: profile.is_admin === true || profile.role === 'admin' || profile.role === 'koordinator' || profile.role === 'säljare',
  }
}

// ─── Samtal och bokningar ───

export interface SamtalInfo {
  antal: number
  utanSvar: boolean
  senast: { outcome: string; at: string } | null
}

export const UTFALL_TEXT: Record<string, string> = {
  reached: 'nådde kunden',
  voicemail: 'röstbrevlåda',
  no_answer: 'inget svar',
}

/** Samtalsloggen för alla dokument i en fråga (document_call_logs läses av alla inloggade) */
export async function hamtaSamtal(contractIds: string[]): Promise<Map<string, SamtalInfo>> {
  const map = new Map<string, SamtalInfo>()
  if (contractIds.length === 0) return map
  const { data, error } = await supabase
    .from('document_call_logs')
    .select('contract_id, outcome, created_at')
    .in('contract_id', contractIds)
    .order('created_at', { ascending: true })
  if (error) { console.error('hamtaSamtal:', error); return map }
  for (const r of data || []) {
    const prev = map.get(r.contract_id) ?? { antal: 0, utanSvar: true, senast: null }
    map.set(r.contract_id, {
      antal: prev.antal + 1,
      utanSvar: prev.utanSvar && r.outcome !== 'reached',
      senast: { outcome: r.outcome, at: r.created_at },
    })
  }
  return map
}

export function samtalText(s: SamtalInfo | undefined): string | null {
  if (!s || s.antal === 0) return null
  if (s.utanSvar) return `${s.antal} samtal utan svar`
  return `${s.antal} samtal, senast ${UTFALL_TEXT[s.senast?.outcome ?? ''] ?? 'loggat'}`
}

export interface Bokning {
  kalla: ArendeKalla
  id: string
  arendenummer: string | null
  /** Starttid i ärendet, null om ingen tid är satt */
  start: string | null
  /** När ärendet skapades, det vill säga när kontoret bokade in */
  skapad: string
  teknikerId: string | null
  teknikerNamn: string | null
}

/**
 * Ärendena som signerade dokument bokats in på (contracts.booked_case_id).
 * Id:t kan peka på cases (avtal), private_cases eller business_cases (offerter).
 * Ärenden som RLS inte låter teknikern läsa saknas i svaret.
 */
export async function hamtaBokningar(caseIds: string[]): Promise<Map<string, Bokning>> {
  const map = new Map<string, Bokning>()
  const ids = [...new Set(caseIds)]
  if (ids.length === 0) return map
  const [avtal, privat, foretag] = await Promise.all([
    supabase.from('cases').select('id, case_number, scheduled_start, created_at, primary_technician_id, primary_technician_name').in('id', ids),
    supabase.from('private_cases').select('id, case_number, start_date, created_at, primary_assignee_id, primary_assignee_name').in('id', ids),
    supabase.from('business_cases').select('id, case_number, start_date, created_at, primary_assignee_id, primary_assignee_name').in('id', ids),
  ])
  for (const r of avtal.data || []) {
    map.set(r.id, { kalla: 'cases', id: r.id, arendenummer: r.case_number, start: r.scheduled_start, skapad: r.created_at, teknikerId: r.primary_technician_id, teknikerNamn: r.primary_technician_name })
  }
  for (const [kalla, res] of [['private', privat], ['business', foretag]] as const) {
    for (const r of res.data || []) {
      map.set(r.id, { kalla, id: r.id, arendenummer: r.case_number, start: r.start_date, skapad: r.created_at, teknikerId: r.primary_assignee_id, teknikerNamn: r.primary_assignee_name })
    }
  }
  return map
}

/** Har kundens stationer en sida för teknikern (/technician/equipment/customer/:id) */
export async function kundHarStationer(customerId: string): Promise<boolean> {
  const [ute, ritning] = await Promise.all([
    supabase.from('equipment_placements').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    supabase.from('floor_plans').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
  ])
  return (ute.count ?? 0) > 0 || (ritning.count ?? 0) > 0
}

/** Ursprungsärendet som dokumentet skapades från, om det finns */
export function kallArende(o: FollowUpOffer): { kalla: ArendeKalla; id: string } | null {
  if (!o.source_id) return null
  if (o.source_type === 'private_case') return { kalla: 'private', id: o.source_id }
  if (o.source_type === 'business_case') return { kalla: 'business', id: o.source_id }
  return null
}

/**
 * Logga ett samtal. Med behörighet till coordinator_case_actions går det via
 * OfferFollowUpService.logCall (kontaktförsök och ring åter). Utan behörighet
 * sparas bara samtalet, eftersom åtgärdsraden inte får skrivas av rollen.
 */
export async function loggaSamtal(
  contractId: string,
  input: { outcome: 'reached' | 'voicemail' | 'no_answer'; note: string | null; followUpAt: string | null; byName: string | null; byEmail: string | null },
  b: Behorighet,
): Promise<void> {
  if (b.atgarder) {
    await OfferFollowUpService.logCall(contractId, input)
    return
  }
  const { error } = await supabase.from('document_call_logs').insert({
    contract_id: contractId,
    outcome: input.outcome,
    note: input.note || null,
    called_by_email: input.byEmail || null,
    called_by_name: input.byName || null,
  })
  if (error) throw error
}

// ─── Grupperna ───

export type Grupp = 'attgora' | 'vantar' | 'signerade' | 'klara'
export type Undergrupp = 'svar' | 'forfallna' | 'lange' | 'ring' | 'utkast'

export const FORFALLEN_TILL_KLARA_DAGAR = 30
export const BOKAD_SYNLIG_DAGAR = 14

export const UNDERGRUPPER: { key: Undergrupp; rubrik: string }[] = [
  { key: 'svar', rubrik: 'Kunden har skrivit' },
  { key: 'forfallna', rubrik: 'Förfallna' },
  { key: 'lange', rubrik: 'Väntar länge på svar' },
  { key: 'ring', rubrik: 'Ring idag' },
  { key: 'utkast', rubrik: 'Utkast att skicka' },
]

export interface Plats {
  grupp: Grupp
  under?: Undergrupp
  /** Förfallet för mer än 30 dagar sedan, flyttat till Klara i visningen */
  gammalForfallen?: boolean
  /** Signerat och bokat, visas under Signerade en tid */
  bokad?: boolean
}

function bokadNyligen(o: FollowUpOffer, bokning: Bokning | undefined): boolean {
  const tid = bokning?.skapad || o.status_updated_at || o.updated_at
  const dag = svDatum(tid)
  if (!dag) return false
  return dagarMellan(dag, idagSv()) <= BOKAD_SYNLIG_DAGAR
}

export function placera(o: FollowUpOffer, bokningar: Map<string, Bokning>): Plats {
  switch (o.queue_category) {
    case 'svar': return { grupp: 'attgora', under: 'svar' }
    case 'forfallna':
      return (o.days_since_overdue ?? 0) > FORFALLEN_TILL_KLARA_DAGAR
        ? { grupp: 'klara', gammalForfallen: true }
        : { grupp: 'attgora', under: 'forfallna' }
    case 'loper_ut':
    case 'aldrig_fram': return { grupp: 'attgora', under: 'lange' }
    case 'ringlista': return { grupp: 'attgora', under: 'ring' }
    case 'utkast': return { grupp: 'attgora', under: 'utkast' }
    case 'bevakas': return { grupp: 'vantar' }
    case 'boka': return { grupp: 'signerade' }
    default:
      if (o.status === 'signed' && o.booked_case_id && bokadNyligen(o, bokningar.get(o.booked_case_id))) {
        return { grupp: 'signerade', bokad: true }
      }
      return { grupp: 'klara' }
  }
}

export interface Grupperat {
  attgora: Record<Undergrupp, FollowUpOffer[]>
  vantar: FollowUpOffer[]
  signerade: FollowUpOffer[]
  klara: FollowUpOffer[]
  plats: Map<string, Plats>
  antal: { attgora: number; vantar: number; signerade: number; klara: number }
}

/** Senaste aktivitet först inom varje grupp, förfallna med kortast tid sedan förfall först */
function sortera(lista: FollowUpOffer[], under?: Undergrupp): FollowUpOffer[] {
  const tid = (o: FollowUpOffer) => {
    if (under === 'svar') return o.latest_customer_comment?.at || o.created_at
    if (under === 'forfallna') return o.status_updated_at || o.updated_at
    return o.status_updated_at || o.created_at
  }
  return [...lista].sort((a, b) => tid(b).localeCompare(tid(a)))
}

export function gruppera(offers: FollowUpOffer[], bokningar: Map<string, Bokning>): Grupperat {
  const attgora: Record<Undergrupp, FollowUpOffer[]> = { svar: [], forfallna: [], lange: [], ring: [], utkast: [] }
  const vantar: FollowUpOffer[] = []
  const signerade: FollowUpOffer[] = []
  const klara: FollowUpOffer[] = []
  const plats = new Map<string, Plats>()
  for (const o of offers) {
    const p = placera(o, bokningar)
    plats.set(o.id, p)
    if (p.grupp === 'attgora' && p.under) attgora[p.under].push(o)
    else if (p.grupp === 'vantar') vantar.push(o)
    else if (p.grupp === 'signerade') signerade.push(o)
    else klara.push(o)
  }
  for (const u of UNDERGRUPPER) attgora[u.key] = sortera(attgora[u.key], u.key)
  // Löper ut snart: kortast frist först
  attgora.lange.sort((a, b) => (a.days_until_deadline ?? 999) - (b.days_until_deadline ?? 999))
  // Väntar på kunden: kortast frist först
  vantar.sort((a, b) => (a.days_until_deadline ?? 999) - (b.days_until_deadline ?? 999))
  // Signerade: de som inte är bokade först
  const sig = sortera(signerade).sort((a, b) => Number(plats.get(a.id)?.bokad ?? false) - Number(plats.get(b.id)?.bokad ?? false))
  const antalAttGora = UNDERGRUPPER.reduce((s, u) => s + attgora[u.key].length, 0)
  return {
    attgora,
    vantar,
    signerade: sig,
    klara: sortera(klara),
    plats,
    antal: { attgora: antalAttGora, vantar: vantar.length, signerade: sig.length, klara: klara.length },
  }
}

/** Visningsordningen, samma som listan renderas i (för piltangenterna) */
export function ordning(g: Grupperat, klaraOppen: boolean): FollowUpOffer[] {
  return [
    ...UNDERGRUPPER.flatMap(u => g.attgora[u.key]),
    ...g.vantar,
    ...g.signerade,
    ...(klaraOppen ? g.klara : []),
  ]
}

// ─── Status och nästa steg ───

const VIEW_TRACKING_START = '2026-08-18'

export function oppnadText(o: FollowUpOffer): string | null {
  if (o.email_delivery_failed_at) return 'Mejlet kom inte fram'
  if (o.customer_first_viewed_at) return `Öppnad ${svDatum(o.customer_first_viewed_at)}`
  if (o.created_at >= VIEW_TRACKING_START && o.status !== 'draft') return 'Aldrig öppnad'
  return null
}

function fristKvar(o: FollowUpOffer): string | null {
  const d = o.days_until_deadline
  if (d === null) return null
  if (d <= 0) return 'fristen går ut idag'
  return `${d} ${d === 1 ? 'dag' : 'dagar'} kvar`
}

export interface RadStatus {
  ton: Ton
  text: string
  /** Tredje raden: orsaken (citat, samtal, frist) */
  detalj: string | null
}

export function radStatus(o: FollowUpOffer, p: Plats, samtal: SamtalInfo | undefined, bokning: Bokning | undefined, minTeknikerId: string | null): RadStatus {
  const idag = idagSv()
  if (p.grupp === 'attgora') {
    switch (p.under) {
      case 'svar':
        return {
          ton: 'bla',
          text: `Skrev ${sedan(o.latest_customer_comment?.at, true)}`,
          detalj: o.latest_customer_comment?.body ? `"${o.latest_customer_comment.body.replace(/\s+/g, ' ').trim()}"` : null,
        }
      case 'forfallna':
        return {
          ton: 'rod',
          text: `Förföll ${dagarSedanText(o.days_since_overdue ?? 0)}`,
          detalj: [oppnadText(o), samtalText(samtal)].filter(Boolean).join(', ') || null,
        }
      case 'lange': {
        if (o.email_delivery_failed_at) {
          return { ton: 'rod', text: 'Mejlet kom inte fram', detalj: `Skickad ${sedan(o.created_at)}` }
        }
        const d = o.days_until_deadline
        if (d !== null && d <= 3) {
          return {
            ton: 'gul',
            text: d <= 0 ? 'Fristen går ut idag' : `Fristen går ut om ${d} ${d === 1 ? 'dag' : 'dagar'}`,
            detalj: [oppnadText(o), samtalText(samtal)].filter(Boolean).join(', ') || null,
          }
        }
        if (!o.customer_first_viewed_at && o.queue_category === 'aldrig_fram') {
          return {
            ton: 'gul',
            text: `Inte öppnad, skickad ${sedan(o.created_at)}`,
            detalj: o.signing_deadline ? `Fristen går ut ${o.signing_deadline}` : samtalText(samtal),
          }
        }
        return {
          ton: 'gul',
          text: `Skickad ${sedan(o.created_at)}, inget svar`,
          detalj: [oppnadText(o), samtalText(samtal)].filter(Boolean).join(', ') || null,
        }
      }
      case 'ring': {
        const f = o.action?.follow_up_at || idag
        return {
          ton: 'gul',
          text: f < idag ? `Du planerade att ringa ${f}` : 'Du planerade att ringa idag',
          detalj: o.action?.follow_up_note ? `"${o.action.follow_up_note}"` : samtalText(samtal),
        }
      }
      case 'utkast':
        return { ton: 'gul', text: 'Utkast, inte skickat till kunden', detalj: `Skapat ${sedan(o.created_at)}` }
    }
  }
  if (p.grupp === 'vantar') {
    const f = o.action?.follow_up_at
    if (f && f > idag) return { ton: 'gra', text: `Du ringer ${f}`, detalj: o.action?.follow_up_note ? `"${o.action.follow_up_note}"` : `Skickad ${sedan(o.created_at)}` }
    const oppnad = o.customer_first_viewed_at ? `Öppnad ${sedan(o.customer_first_viewed_at)}` : 'Inte öppnad än'
    const kvar = fristKvar(o)
    return { ton: 'gra', text: kvar ? `${oppnad}, ${kvar}` : oppnad, detalj: `Skickad ${sedan(o.created_at, true)}` }
  }
  if (p.grupp === 'signerade') {
    if (p.bokad) {
      const start = bokning?.start
      const text = start
        ? `Bokad ${svDatum(start)}${/^\d{4}-\d{2}-\d{2}$/.test(start) ? '' : ` kl ${svTid(start)}`}`
        : 'Bokad, tiden är inte satt än'
      const vem = !bokning?.teknikerNamn ? null : bokning.teknikerId && bokning.teknikerId === minTeknikerId ? 'hos dig' : bokning.teknikerNamn
      const detalj = bokning?.arendenummer ? `Ärende ${bokning.arendenummer}${vem ? `, ${vem}` : ''}` : 'Kontoret har bokat in'
      return { ton: 'gron', text, detalj }
    }
    const sign = (o as FollowUpOffer & { signed_at?: string | null }).signed_at || o.status_updated_at
    return { ton: 'gron', text: `Signerad ${sedan(sign)}, kontoret bokar in`, detalj: 'Du behöver inte göra något' }
  }
  // Klara
  if (p.gammalForfallen) return { ton: 'gra', text: `Förföll ${sedan(o.status_updated_at || o.updated_at)}`, detalj: 'Flyttad hit efter 30 dagar' }
  if (o.status === 'declined') return { ton: 'gra', text: `Avböjd ${sedan(o.status_updated_at)}`, detalj: null }
  if (o.status === 'overdue') return { ton: 'gra', text: 'Avskriven', detalj: `Förföll ${sedan(o.status_updated_at || o.updated_at)}` }
  if (o.status === 'signed') return { ton: 'gron', text: o.booked_case_id ? 'Bokad' : 'Signerad, klar', detalj: null }
  return { ton: 'gra', text: 'Klar', detalj: null }
}

export type PrimarAtgard = 'svara' | 'forlang' | 'ring' | 'skicka' | 'oppnaBokning' | null

export interface NastaSteg {
  ton: Ton
  status: string
  /** Meningen efter "Nästa steg:" (null = ingen nästa steg-text) */
  text: string | null
  primar: PrimarAtgard
}

/** Nästa steg-rutan i detaljen: statusrad, en mening och EN primär knapp */
export function nastaSteg(o: FollowUpOffer, p: Plats, b: Behorighet, bokning: Bokning | undefined, kontakt: string): NastaSteg {
  const vad = o.type === 'offer' ? 'offerten' : 'avtalet'
  const harTel = !!o.contact_phone
  if (p.grupp === 'attgora') {
    switch (p.under) {
      case 'svar':
        return {
          ton: 'bla',
          status: `Kunden har skrivit ${sedan(o.latest_customer_comment?.at, true)}`,
          text: b.oneflow
            ? 'svara på kundens fråga. Svaret syns för kunden i Oneflow.'
            : `svara på kundens fråga. Ring ${kontakt} eller skriv en intern anteckning så svarar kontoret i Oneflow.`,
          primar: b.oneflow ? 'svara' : harTel ? 'ring' : 'svara',
        }
      case 'forfallna':
        return {
          ton: 'rod',
          status: `Förföll ${dagarSedanText(o.days_since_overdue ?? 0)}`,
          text: b.oneflow
            ? `kunden kan inte signera längre. Förläng fristen så öppnas ${vad} igen, och skicka en påminnelse.`
            : `kunden kan inte signera längre. Ring ${kontakt}, och be kontoret förlänga fristen om kunden vill ha mer tid.`,
          primar: b.oneflow ? 'forlang' : harTel ? 'ring' : null,
        }
      case 'lange': {
        if (o.email_delivery_failed_at) {
          return { ton: 'rod', status: 'Mejlet kom inte fram', text: `ring ${kontakt} och kontrollera mejladressen.`, primar: harTel ? 'ring' : null }
        }
        const d = o.days_until_deadline
        if (d !== null && d <= 3) {
          return {
            ton: 'gul',
            status: d <= 0 ? 'Fristen går ut idag' : `Fristen går ut om ${d} ${d === 1 ? 'dag' : 'dagar'}`,
            text: b.oneflow ? 'förläng fristen och påminn kunden, eller ring.' : `ring ${kontakt} innan fristen går ut.`,
            primar: b.oneflow ? 'forlang' : harTel ? 'ring' : null,
          }
        }
        return {
          ton: 'gul',
          status: o.customer_first_viewed_at ? `Skickad ${sedan(o.created_at)}, inget svar` : `Inte öppnad, skickad ${sedan(o.created_at)}`,
          text: `ring ${kontakt} och hör om ${vad} kom fram.`,
          primar: harTel ? 'ring' : null,
        }
      }
      case 'ring':
        return {
          ton: 'gul',
          status: 'Du planerade att ringa idag',
          text: o.action?.follow_up_note ? `ring ${kontakt}. Din anteckning: "${o.action.follow_up_note}"` : `ring ${kontakt}.`,
          primar: harTel ? 'ring' : null,
        }
      case 'utkast':
        return { ton: 'gul', status: 'Utkast, inte skickat till kunden', text: `granska PDF:en och skicka ${vad} till kunden.`, primar: 'skicka' }
    }
  }
  if (p.grupp === 'vantar') {
    const f = o.action?.follow_up_at
    return {
      ton: 'gra',
      status: f && f > idagSv() ? `Du ringer ${f}` : o.customer_first_viewed_at ? `Öppnad ${sedan(o.customer_first_viewed_at)}` : 'Inte öppnad än',
      text: o.signing_deadline ? `inget att göra än. Kunden har till ${o.signing_deadline} på sig att signera.` : 'inget att göra än. Kunden har fått dokumentet.',
      primar: null,
    }
  }
  if (p.grupp === 'signerade') {
    if (p.bokad) {
      const start = bokning?.start
      return {
        ton: 'gron',
        status: start ? `Bokad ${svDatum(start)}${/^\d{4}-\d{2}-\d{2}$/.test(start) ? '' : ` kl ${svTid(start)}`}` : 'Bokad',
        text: bokning?.arendenummer ? `inget. Kontoret har bokat in ärende ${bokning.arendenummer}.` : 'inget. Kontoret har bokat in.',
        primar: bokning ? 'oppnaBokning' : null,
      }
    }
    return { ton: 'gron', status: `Signerad ${sedan((o as FollowUpOffer & { signed_at?: string | null }).signed_at || o.status_updated_at)}`, text: 'inget. Kontoret registrerar kunden och bokar in, du behöver inte göra något.', primar: null }
  }
  if (p.gammalForfallen) return { ton: 'gra', status: `Förföll ${sedan(o.status_updated_at || o.updated_at)}`, text: 'inget. Dokumentet flyttades till Klara efter 30 dagar. Förläng fristen om kunden hör av sig.', primar: null }
  if (o.status === 'declined') return { ton: 'gra', status: 'Avböjd', text: null, primar: null }
  if (o.status === 'overdue') return { ton: 'gra', status: 'Avskriven', text: null, primar: null }
  return { ton: 'gron', status: o.booked_case_id ? 'Bokad' : 'Klar', text: null, primar: bokning ? 'oppnaBokning' : null }
}

// ─── Statistikraden ───

export interface Statistik90 {
  skickade: number
  signerade: number
  grad: number | null
  dagarTillSignering: number | null
}

/** Senaste 90 dagarna på teknikerns egna dokument (utkast räknas inte) */
export function statistik90(offers: FollowUpOffer[]): Statistik90 {
  const fran = plusDagar(idagSv(), -90)
  const skickade = offers.filter(o => o.status !== 'draft' && svDatum(o.created_at) >= fran)
  const sign = skickade.filter(o => o.status === 'signed')
  const dagar = sign
    .map(o => {
      const s = (o as FollowUpOffer & { signed_at?: string | null }).signed_at || o.status_updated_at
      return s ? (new Date(s).getTime() - new Date(o.created_at).getTime()) / 86_400_000 : null
    })
    .filter((d): d is number => d !== null && d >= 0)
  return {
    skickade: skickade.length,
    signerade: sign.length,
    grad: skickade.length > 0 ? Math.round((sign.length / skickade.length) * 100) : null,
    dagarTillSignering: dagar.length > 0 ? dagar.reduce((a, b) => a + b, 0) / dagar.length : null,
  }
}

/** Förifylld påminnelse när fristen förlängs */
export function paminnelseText(o: FollowUpOffer, datum: string, avsandare: string | null): string {
  const fornamn = (o.contact_person || '').trim().split(/\s+/)[0]
  const vad = o.type === 'offer' ? 'offerten' : 'avtalet'
  const jag = (avsandare || '').trim().split(/\s+/)[0]
  return `Hej${fornamn ? ` ${fornamn}` : ''}! Jag har förlängt ${vad} till ${datum} så att du hinner signera. Ring mig gärna om något är oklart.${jag ? ` ${jag}` : ''}`
}
