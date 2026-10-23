// src/components/coordinator/dokument/kontorData.ts
// Data och vylogik för kontorsläget av Dokumentsignering (koordinator och admin,
// /koordinator/dokumentsignering). Säljarna har kvar OfferFollowUp och teknikerna
// sin egen vy (components/technician/ny/dokument). Tid, datum, behörigheter och
// bokningar lånas därifrån så att båda lägena räknar likadant.
//
// All data kommer från OfferFollowUpService.getDashboardData utan ownDocsEmail,
// alltså alla dokument. Här görs bara vylagret, i kontorets arbetsordning:
//
//   Att boka in           signerade som inte bokats (queue_category boka) och inte
//                         skrivits av, äldst först
//   Väntar på kontoret    Kunden har skrivit (senaste inlägget i Oneflow är kundens,
//                         gemensamt för alla, inte per läsare), Ring idag (planerad
//                         uppföljning idag eller tidigare) och egna utkast att skicka
//   Fastnat hos tekniker  förfallna, nära fristen (3 dagar), mejl som inte kom fram,
//                         aldrig öppnade (5 dagar), andras utkast och obesvarade
//                         äldre än 10 dagar. Per tekniker.
//   Bokade                signerade med booked_case_id, 14 dagar efter bokningen
//   Väntar på kunden      resten av de skickade (hopfälld)
//   Klara                 avböjda, avskrivna och bokade sedan länge (hopfälld)
//
// Ingen koordinatorstatus väljs. Det kontoret gör syns i kontaktloggen
// (samtal, mejl, Oneflow, förlängningar, påminnelser, Boka in, Skriv av), och
// listan visar senaste posten som en grå rad.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'
import { paminnTekniker } from '../../../services/bokaInService'
import { createSystemComment } from '../../../services/communicationService'
import type { IconName } from '../../icons/Icon'
import type { Ton } from '../../technician/ny/besokTyp'
import {
  BOKAD_SYNLIG_DAGAR, UTFALL_TEXT, dagarMellan, dagarSedanText, idagSv, plusDagar, sedan, svDatum, svTid,
  type Bokning,
} from '../../technician/ny/dokument/dokumentData'

// Otypad klient: tabellerna läses med smala select och filtreras här
const db = supabase as unknown as SupabaseClient

export const FASTNAT_OBESVARAD_DAGAR = 10
const FRIST_NARA_DAGAR = 3
const ALDRIG_OPPNAD_DAGAR = 5
const VIEW_TRACKING_START = '2026-08-18'
const BOKA_GUL_DAGAR = 3

const signDatum = (o: FollowUpOffer) => (o as FollowUpOffer & { signed_at?: string | null }).signed_at || o.status_updated_at || o.updated_at

// ─── Teknikern bakom dokumentet ───

export interface DokTekniker {
  /** Grupperingsnyckel: namnet i gemener, annars e-posten. '' när båda saknas */
  nyckel: string
  /** Gemener, avsändarens e-post. '' när den saknas */
  epost: string
  namn: string
}

export function dokTekniker(o: FollowUpOffer): DokTekniker {
  const epost = (o.begone_employee_email || o.created_by_email || '').toLowerCase()
  const namn = o.technician_name || o.begone_employee_name || o.created_by_name || 'Okänd avsändare'
  // Samma person kan ha skickat från flera adresser: gruppera på namnet när det finns,
  // annars blir det ett val per adress och filtret visar bara en del av dokumenten
  const harNamn = !!(o.technician_name || o.begone_employee_name || o.created_by_name)
  return { nyckel: harNamn ? namn.trim().toLowerCase() : epost, epost, namn }
}

export const fornamn = (namn: string | null | undefined) => (namn || '').trim().split(/\s+/)[0] || ''

// ─── Kontaktposter ───

export type KontaktTyp =
  | 'samtal' | 'mejl' | 'sms' | 'oneflow-in' | 'oneflow-ut' | 'anteckning'
  | 'forlangning' | 'paminnelse-kund' | 'paminnelse-tekniker'
  | 'skickad' | 'signerad' | 'avbojd' | 'forfallen' | 'raderad' | 'bokad' | 'avskriven' | 'handelse'

export interface KontaktPost {
  key: string
  typ: KontaktTyp
  /** Vem gjorde det (namn), null när det är Oneflow eller systemet */
  vem: string | null
  /** Kort etikett efter namnet, till exempel "samtal" eller "Oneflow, till kunden" */
  etikett: string
  /** Innehållet: citat, anteckning, ny frist */
  text: string | null
  at: string
}

export const KONTAKT_IKON: Record<KontaktTyp, IconName> = {
  samtal: 'kontakt.telefon',
  mejl: 'kontakt.mejl',
  sms: 'kontakt.mejl',
  'oneflow-in': 'dok.konversation',
  'oneflow-ut': 'dok.konversation',
  anteckning: 'allman.anteckning',
  forlangning: 'upphandling.forlangning',
  'paminnelse-kund': 'upphandling.notis',
  'paminnelse-tekniker': 'upphandling.notis',
  skickad: 'rapport.skicka',
  signerad: 'falt.signera',
  avbojd: 'allman.stang',
  forfallen: 'allman.klocka',
  raderad: 'allman.radera',
  bokad: 'arendelista.boka',
  avskriven: 'allman.arkiv',
  handelse: 'allman.historik',
}

/** Kontaktförsök som schemats låda och kontorsläget sparar som anteckning */
const KONTAKTFORSOK = /^Kontaktförsök via (Telefon|E-post|SMS)(?::\s*([\s\S]*))?$/

/** Systemkommentarer på dokumentet som hör till kontakten med kunden eller teknikern */
function systemTyp(text: string): KontaktTyp | null {
  if (/^Signeringsperiod förlängd/i.test(text)) return 'forlangning'
  if (/^Påminnelse skickad till kunden/i.test(text)) return 'paminnelse-kund'
  if (/^Påminnelse till /i.test(text)) return 'paminnelse-tekniker'
  if (/^Bokad in /i.test(text)) return 'bokad'
  return null
}

export interface KommentarRad {
  id: string
  case_id: string
  author_name: string | null
  content: string
  is_system_comment: boolean | null
  created_at: string
}

/** En anteckning eller systemkommentar på dokumentet som kontaktpost (null = hör inte hit) */
export function kommentarTillPost(c: KommentarRad, prefix = 'k'): KontaktPost | null {
  const text = (c.content || '').trim()
  if (c.is_system_comment) {
    const typ = systemTyp(text)
    if (!typ) return null
    return { key: `${prefix}-${c.id}`, typ, vem: null, etikett: typ === 'bokad' ? 'Boka in' : typ === 'forlangning' ? 'förlängning' : 'påminnelse', text, at: c.created_at }
  }
  const m = text.match(KONTAKTFORSOK)
  if (m) {
    const typ: KontaktTyp = m[1] === 'Telefon' ? 'samtal' : m[1] === 'SMS' ? 'sms' : 'mejl'
    return {
      key: `${prefix}-${c.id}`,
      typ,
      vem: c.author_name,
      etikett: typ === 'samtal' ? 'kontaktförsök, telefon' : typ === 'sms' ? 'sms till kunden' : 'mejl till kunden',
      text: m[2]?.trim() || null,
      at: c.created_at,
    }
  }
  return { key: `${prefix}-${c.id}`, typ: 'anteckning', vem: c.author_name, etikett: 'intern anteckning', text, at: c.created_at }
}

export interface SamtalRad {
  id: string
  contract_id?: string
  outcome: string
  note: string | null
  called_by_name: string | null
  created_at: string
}

export function samtalTillPost(s: SamtalRad): KontaktPost {
  const utfall = UTFALL_TEXT[s.outcome] ?? 'loggat'
  return {
    key: `s-${s.id}`,
    typ: 'samtal',
    vem: s.called_by_name,
    etikett: 'samtal',
    text: s.note ? `${utfall[0].toUpperCase()}${utfall.slice(1)}. ${s.note}` : `${utfall[0].toUpperCase()}${utfall.slice(1)}.`,
    at: s.created_at,
  }
}

export interface OneflowRad {
  id: string
  author_name: string | null
  author_type: string
  body: string
  commented_at: string
}

export function oneflowTillPost(c: OneflowRad): KontaktPost {
  const kund = c.author_type === 'customer'
  return {
    key: `of-${c.id}`,
    typ: kund ? 'oneflow-in' : 'oneflow-ut',
    vem: c.author_name || (kund ? 'Kunden' : 'Okänd'),
    etikett: kund ? 'kunden, Oneflow' : 'Oneflow, till kunden',
    text: `"${c.body.replace(/\s+/g, ' ').trim()}"`,
    at: c.commented_at,
  }
}

/** Avskrivet eller hanterat utan ärende: dismissed_at och anledningen i coordinator_notes */
export function avskrivenPost(o: FollowUpOffer): KontaktPost | null {
  const a = o.action
  if (!a?.dismissed_at) return null
  const not = (a.coordinator_notes || '').trim()
  return {
    key: `av-${o.id}`,
    typ: 'avskriven',
    vem: null,
    etikett: /^Inget ärende/.test(not) ? 'Boka in, inget ärende' : 'Skriv av',
    text: not || 'Avskriven utan anledning.',
    at: a.dismissed_at,
  }
}

/** Bokningen som post när Boka in inte lämnat en egen systemkommentar */
export function bokningPost(o: FollowUpOffer, b: Bokning | undefined): KontaktPost | null {
  if (!o.booked_case_id || !b) return null
  const tid = b.start ? `${svDatum(b.start)}${/^\d{4}-\d{2}-\d{2}$/.test(b.start) ? '' : ` ${svTid(b.start)}`}` : 'tid inte satt'
  return {
    key: `bk-${o.id}`,
    typ: 'bokad',
    vem: null,
    etikett: 'Boka in',
    text: `Bokad in som ${b.arendenummer || 'nytt ärende'}, ${tid}${b.teknikerNamn ? `, ${b.teknikerNamn}` : ''}.`,
    at: b.skapad,
  }
}

const EVENT_TYP: Record<string, KontaktTyp> = {
  offer_sent: 'skickad',
  offer_signed: 'signerad',
  offer_declined: 'avbojd',
  offer_expired: 'forfallen',
  offer_deleted: 'raderad',
}

/** Signeringshändelserna ur event_log (webhooken) för ett dokument */
export async function hamtaSigneringshandelser(contractId: string): Promise<KontaktPost[]> {
  const { data, error } = await db
    .from('event_log')
    .select('id, event_type, description, performed_by_name, created_at')
    .eq('case_id', contractId)
    .in('event_type', Object.keys(EVENT_TYP))
    .order('created_at', { ascending: true })
  if (error) { console.error('hamtaSigneringshandelser:', error); return [] }
  return ((data || []) as Array<{ id: string; event_type: string; description: string | null; performed_by_name: string | null; created_at: string }>).map(e => ({
    key: `ev-${e.id}`,
    typ: EVENT_TYP[e.event_type] ?? 'handelse',
    vem: e.event_type === 'offer_sent' ? e.performed_by_name : null,
    etikett: e.event_type === 'offer_sent' ? 'skickade i Oneflow' : 'signeringshändelse',
    text: e.description,
    at: e.created_at,
  }))
}

/** Kontaktförsök som loggats på ursprungsärendet från schemats låda */
export async function hamtaUrsprungetsKontakt(o: FollowUpOffer): Promise<KontaktPost[]> {
  if (!o.source_id || (o.source_type !== 'private_case' && o.source_type !== 'business_case')) return []
  const { data, error } = await db
    .from('case_comments')
    .select('id, case_id, author_name, content, is_system_comment, created_at')
    .eq('case_id', o.source_id)
    .eq('case_type', o.source_type === 'private_case' ? 'private' : 'business')
    .like('content', 'Kontaktförsök via%')
    .order('created_at', { ascending: true })
  if (error) { console.error('hamtaUrsprungetsKontakt:', error); return [] }
  return ((data || []) as KommentarRad[]).map(c => kommentarTillPost(c, 'u')).filter((p): p is KontaktPost => !!p)
}

// ─── Senaste kontakt för listan ───

export interface Kontaktlage {
  /** Senaste posten i kontaktloggen (utan signeringshändelser) */
  senast: KontaktPost | null
  /** Senaste inlägget i Oneflow-chatten, oavsett vem */
  oneflow: { arKund: boolean; at: string; body: string } | null
}

/**
 * Senaste kontakten per dokument: samtal, Oneflow-chatten, anteckningar och
 * kontorets systemkommentarer (förlängd, påmind, bokad in) samt avskrivning.
 * Tabellerna är små och läses utan id-lista (en id-lista över alla dokument
 * blir för lång för en GET).
 */
export async function hamtaKontaktlagen(offers: FollowUpOffer[]): Promise<Map<string, Kontaktlage>> {
  const map = new Map<string, Kontaktlage>()
  if (offers.length === 0) return map
  const ids = new Set(offers.map(o => o.id))
  const oneflowTillId = new Map(offers.map(o => [o.oneflow_contract_id, o.id]))

  const [samtal, oneflow, kommentarer] = await Promise.all([
    db.from('document_call_logs').select('id, contract_id, outcome, note, called_by_name, created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('oneflow_comments').select('id, oneflow_contract_id, author_name, author_type, body, commented_at').eq('is_private', false).order('commented_at', { ascending: false }).limit(5000),
    db.from('case_comments').select('id, case_id, author_name, content, is_system_comment, created_at').eq('case_type', 'contract').order('created_at', { ascending: false }).limit(5000),
  ])
  if (samtal.error) console.error('hamtaKontaktlagen samtal:', samtal.error)
  if (oneflow.error) console.error('hamtaKontaktlagen oneflow:', oneflow.error)
  if (kommentarer.error) console.error('hamtaKontaktlagen kommentarer:', kommentarer.error)

  const lage = (id: string): Kontaktlage => {
    let l = map.get(id)
    if (!l) { l = { senast: null, oneflow: null }; map.set(id, l) }
    return l
  }
  const ny = (id: string, p: KontaktPost) => {
    const l = lage(id)
    if (!l.senast || p.at > l.senast.at) l.senast = p
  }

  for (const s of (samtal.data || []) as SamtalRad[]) {
    if (s.contract_id && ids.has(s.contract_id)) ny(s.contract_id, samtalTillPost(s))
  }
  for (const c of (oneflow.data || []) as Array<OneflowRad & { oneflow_contract_id: string }>) {
    const id = oneflowTillId.get(c.oneflow_contract_id)
    if (!id) continue
    const l = lage(id)
    if (!l.oneflow || c.commented_at > l.oneflow.at) l.oneflow = { arKund: c.author_type === 'customer', at: c.commented_at, body: c.body }
    ny(id, oneflowTillPost(c))
  }
  for (const c of (kommentarer.data || []) as KommentarRad[]) {
    if (!ids.has(c.case_id)) continue
    const p = kommentarTillPost(c)
    if (p) ny(c.case_id, p)
  }
  for (const o of offers) {
    const p = avskrivenPost(o)
    if (p) ny(o.id, p)
  }
  return map
}

/** Senaste kontakten som kort grå rad, till exempel "Ringd 2026-10-15 av Sofia, inget svar" */
export function kontaktText(p: KontaktPost | null): string | null {
  if (!p) return null
  const dag = svDatum(p.at)
  const av = p.vem ? ` av ${fornamn(p.vem)}` : ''
  const citat = (s: string | null, max = 70) => {
    if (!s) return ''
    const t = s.replace(/\s+/g, ' ').trim()
    return t.length > max ? `${t.slice(0, max - 1)}…` : t
  }
  switch (p.typ) {
    case 'samtal': {
      const t = (p.text || '').replace(/\.$/, '').toLowerCase()
      return `Ringd ${dag}${av}${t ? `, ${citat(t, 60)}` : ''}`
    }
    case 'mejl': return `Mejl till kunden ${dag}${av}`
    case 'sms': return `Sms till kunden ${dag}${av}`
    case 'oneflow-in': return `Kunden i Oneflow: ${citat(p.text)}`
    case 'oneflow-ut': return `Svar i Oneflow ${dag}${av}`
    case 'anteckning': return `Anteckning ${dag}${av}`
    case 'forlangning': return `Fristen förlängd ${dag}`
    case 'paminnelse-kund': return `Påminnelse till kunden ${dag}`
    case 'paminnelse-tekniker': return `Teknikern påmind ${dag}`
    case 'bokad': return `Bokad in ${dag}`
    case 'avskriven': return `${p.etikett === 'Skriv av' ? 'Avskriven' : 'Hanterad utan ärende'} ${dag}${p.text ? `: ${citat(p.text.replace(/^(Avskriven|Inget ärende):\s*/, ''), 50)}` : ''}`
    default: return `${p.etikett} ${dag}`
  }
}

// ─── Grupperna ───

export type KontorGrupp = 'boka' | 'kontoret' | 'fastnat' | 'bokade' | 'vantar' | 'klara'
export type KontoretUnder = 'skrivit' | 'ring' | 'utkast'
export type FastnatOrsak = 'forfallen' | 'nara' | 'mejl' | 'oppnad' | 'utkast' | 'lange'

export interface KontorPlats {
  grupp: KontorGrupp
  under?: KontoretUnder
  orsak?: FastnatOrsak
}

export const KONTORET_UNDER: { key: KontoretUnder; rubrik: string }[] = [
  { key: 'skrivit', rubrik: 'Kunden har skrivit' },
  { key: 'ring', rubrik: 'Ring idag' },
  { key: 'utkast', rubrik: 'Dina utkast att skicka' },
]

const ORSAK_ORDNING: FastnatOrsak[] = ['forfallen', 'nara', 'mejl', 'oppnad', 'utkast', 'lange']

function bokadNyligen(o: FollowUpOffer, b: Bokning | undefined): boolean {
  const dag = svDatum(b?.skapad || o.status_updated_at || o.updated_at)
  if (!dag) return false
  return dagarMellan(dag, idagSv()) <= BOKAD_SYNLIG_DAGAR
}

export function placeraKontor(
  o: FollowUpOffer,
  lage: Kontaktlage | undefined,
  bokningar: Map<string, Bokning>,
  minEpost: string,
): KontorPlats {
  const avskriven = !!o.action?.dismissed_at
  const idag = idagSv()
  if (o.status === 'signed') {
    if (o.queue_category === 'boka' && !avskriven) return { grupp: 'boka' }
    if (o.booked_case_id && bokadNyligen(o, bokningar.get(o.booked_case_id))) return { grupp: 'bokade' }
    return { grupp: 'klara' }
  }
  if (o.status === 'declined' || avskriven) return { grupp: 'klara' }

  if (o.status === 'draft') {
    const egen = !!minEpost && [o.created_by_email, o.begone_employee_email].some(e => (e || '').toLowerCase() === minEpost)
    return egen ? { grupp: 'kontoret', under: 'utkast' } : { grupp: 'fastnat', orsak: 'utkast' }
  }

  if (lage?.oneflow?.arKund) return { grupp: 'kontoret', under: 'skrivit' }

  const f = o.action?.follow_up_at || null
  if (f && f <= idag) return { grupp: 'kontoret', under: 'ring' }

  if (o.status === 'overdue') {
    // Förfallna som hanterats med den gamla statusen ligger kvar i Klara
    if (o.action?.coordinator_status === 'completed') return { grupp: 'klara' }
    return { grupp: 'fastnat', orsak: 'forfallen' }
  }

  // Pågående. Uppföljning planerad framåt: kontoret har det, vänta
  if (f && f > idag) return { grupp: 'vantar' }
  const d = o.days_until_deadline
  if (d !== null && d <= FRIST_NARA_DAGAR) return { grupp: 'fastnat', orsak: 'nara' }
  if (o.email_delivery_failed_at) return { grupp: 'fastnat', orsak: 'mejl' }
  if (!o.customer_first_viewed_at && o.created_at >= VIEW_TRACKING_START && o.age_days >= ALDRIG_OPPNAD_DAGAR) return { grupp: 'fastnat', orsak: 'oppnad' }
  if (o.age_days > FASTNAT_OBESVARAD_DAGAR) return { grupp: 'fastnat', orsak: 'lange' }
  return { grupp: 'vantar' }
}

export interface FastnatTekniker {
  tekniker: DokTekniker
  dokument: FollowUpOffer[]
}

export interface KontorGrupperat {
  boka: FollowUpOffer[]
  kontoret: Record<KontoretUnder, FollowUpOffer[]>
  fastnat: FastnatTekniker[]
  bokade: FollowUpOffer[]
  vantar: FollowUpOffer[]
  klara: FollowUpOffer[]
  plats: Map<string, KontorPlats>
  antal: Record<KontorGrupp, number>
}

export function grupperaKontor(
  offers: FollowUpOffer[],
  kontakt: Map<string, Kontaktlage>,
  bokningar: Map<string, Bokning>,
  minEpost: string,
): KontorGrupperat {
  const g: KontorGrupperat = {
    boka: [],
    kontoret: { skrivit: [], ring: [], utkast: [] },
    fastnat: [],
    bokade: [],
    vantar: [],
    klara: [],
    plats: new Map(),
    antal: { boka: 0, kontoret: 0, fastnat: 0, bokade: 0, vantar: 0, klara: 0 },
  }
  const perTekniker = new Map<string, FastnatTekniker>()
  for (const o of offers) {
    const p = placeraKontor(o, kontakt.get(o.id), bokningar, minEpost)
    g.plats.set(o.id, p)
    g.antal[p.grupp]++
    switch (p.grupp) {
      case 'boka': g.boka.push(o); break
      case 'kontoret': g.kontoret[p.under ?? 'skrivit'].push(o); break
      case 'fastnat': {
        const t = dokTekniker(o)
        const nyckel = t.nyckel || `namn:${t.namn}`
        const rad = perTekniker.get(nyckel) ?? { tekniker: t, dokument: [] }
        rad.dokument.push(o)
        perTekniker.set(nyckel, rad)
        break
      }
      case 'bokade': g.bokade.push(o); break
      case 'vantar': g.vantar.push(o); break
      default: g.klara.push(o)
    }
  }
  // Att boka in: äldst signerade först
  g.boka.sort((a, b) => signDatum(a).localeCompare(signDatum(b)))
  // Kunden har skrivit: den som väntat längst först
  g.kontoret.skrivit.sort((a, b) => (kontakt.get(a.id)?.oneflow?.at || '').localeCompare(kontakt.get(b.id)?.oneflow?.at || ''))
  g.kontoret.ring.sort((a, b) => (a.action?.follow_up_at || '').localeCompare(b.action?.follow_up_at || ''))
  g.kontoret.utkast.sort((a, b) => a.created_at.localeCompare(b.created_at))
  // Fastnat: tekniker med flest först, inom teknikern efter orsak och ålder
  const orsak = (o: FollowUpOffer) => ORSAK_ORDNING.indexOf(g.plats.get(o.id)?.orsak ?? 'lange')
  g.fastnat = [...perTekniker.values()]
    .map(t => ({ ...t, dokument: t.dokument.sort((a, b) => orsak(a) - orsak(b) || a.created_at.localeCompare(b.created_at)) }))
    .sort((a, b) => b.dokument.length - a.dokument.length || a.tekniker.namn.localeCompare(b.tekniker.namn, 'sv'))
  // Bokade: senast bokade först
  const bokad = (o: FollowUpOffer) => (o.booked_case_id && bokningar.get(o.booked_case_id)?.skapad) || o.status_updated_at || o.updated_at
  g.bokade.sort((a, b) => bokad(b).localeCompare(bokad(a)))
  g.vantar.sort((a, b) => (a.days_until_deadline ?? 999) - (b.days_until_deadline ?? 999))
  g.klara.sort((a, b) => (b.status_updated_at || b.updated_at).localeCompare(a.status_updated_at || a.updated_at))
  return g
}

/** Visningsordningen (för piltangenterna) */
export function ordningKontor(g: KontorGrupperat, vantarOppen: boolean, klaraOppen: boolean): FollowUpOffer[] {
  return [
    ...g.boka,
    ...KONTORET_UNDER.flatMap(u => g.kontoret[u.key]),
    ...g.fastnat.flatMap(t => t.dokument),
    ...g.bokade,
    ...(vantarOppen ? g.vantar : []),
    ...(klaraOppen ? g.klara : []),
  ]
}

/** Sammanfattning per tekniker på telefonen: "1 förfallen, 1 inte öppnad, 1 utkast" */
export function fastnatSammanfattning(t: FastnatTekniker, plats: Map<string, KontorPlats>): string {
  const n: Record<FastnatOrsak, number> = { forfallen: 0, nara: 0, mejl: 0, oppnad: 0, utkast: 0, lange: 0 }
  for (const o of t.dokument) n[plats.get(o.id)?.orsak ?? 'lange']++
  const delar: string[] = []
  if (n.forfallen) delar.push(`${n.forfallen} ${n.forfallen === 1 ? 'förfallen' : 'förfallna'}`)
  if (n.nara) delar.push(`${n.nara} nära fristen`)
  if (n.mejl) delar.push(n.mejl === 1 ? 'mejlet kom inte fram' : `${n.mejl} mejl kom inte fram`)
  if (n.oppnad) delar.push(`${n.oppnad} inte ${n.oppnad === 1 ? 'öppnad' : 'öppnade'}`)
  if (n.utkast) delar.push(`${n.utkast} ${n.utkast === 1 ? 'utkast' : 'utkast'}`)
  if (n.lange) delar.push(`${n.lange} utan svar`)
  const s = delar.join(', ')
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}

// ─── Raden i listan ───

export interface KontorRadStatus {
  ton: Ton
  text: string
  /** Grå rad: senaste kontakt, citat eller orsak */
  detalj: string | null
  /** Avtal där kunden inte lades upp, visas med ikon i stället för den grå raden */
  ingenKund?: boolean
}

const startText = (start: string) => `${svDatum(start)}${/^\d{4}-\d{2}-\d{2}$/.test(start) ? '' : ` kl ${svTid(start)}`}`

export function kontorRadStatus(o: FollowUpOffer, p: KontorPlats, lage: Kontaktlage | undefined, bokning: Bokning | undefined): KontorRadStatus {
  const senast = kontaktText(lage?.senast ?? null)
  const idag = idagSv()
  switch (p.grupp) {
    case 'boka': {
      const dagar = dagarMellan(svDatum(signDatum(o)), idag)
      const ingenKund = o.type === 'contract' && !o.customer_id
      return {
        ton: dagar > BOKA_GUL_DAGAR ? 'gul' : 'gron',
        text: `Signerad ${sedan(signDatum(o), true)}`,
        detalj: ingenKund ? 'Kunden lades inte upp automatiskt' : senast || 'Ingen kontakt sedan signeringen',
        ingenKund,
      }
    }
    case 'kontoret':
      if (p.under === 'skrivit') {
        const of = lage?.oneflow
        return {
          ton: 'bla',
          text: `Skrev ${sedan(of?.at, true)}, inget svar än`,
          detalj: of?.body ? `Kunden i Oneflow: "${of.body.replace(/\s+/g, ' ').trim()}"` : senast,
        }
      }
      if (p.under === 'ring') {
        const f = o.action?.follow_up_at || idag
        return {
          ton: 'gul',
          text: f < idag ? `Skulle ringas ${f}` : 'Ring idag',
          detalj: o.action?.follow_up_note ? `"${o.action.follow_up_note}"` : senast,
        }
      }
      return { ton: 'gul', text: `Ditt utkast, skapat ${sedan(o.created_at)}`, detalj: 'Inte skickat till kunden' }
    case 'fastnat': {
      const tom = 'Ingen kontakt sedan utskicket'
      switch (p.orsak) {
        case 'forfallen':
          return { ton: 'rod', text: `Förföll ${dagarSedanText(o.days_since_overdue ?? 0)}`, detalj: senast || 'Ingen kontakt loggad' }
        case 'nara': {
          const d = o.days_until_deadline ?? 0
          return { ton: 'gul', text: d <= 0 ? 'Fristen går ut idag' : `Fristen går ut om ${d} ${d === 1 ? 'dag' : 'dagar'}`, detalj: senast || tom }
        }
        case 'mejl': return { ton: 'rod', text: 'Mejlet kom inte fram', detalj: senast || `Skickad ${sedan(o.created_at)}` }
        case 'oppnad': return { ton: 'gul', text: `Inte öppnad, skickad ${sedan(o.created_at)}`, detalj: senast || tom }
        case 'utkast': {
          const n = dagarMellan(svDatum(o.created_at), idag)
          return {
            ton: 'gul',
            text: n <= 0 ? 'Utkast sedan idag, inte skickat' : `Utkast sedan ${n} ${n === 1 ? 'dag' : 'dagar'}, inte skickat`,
            detalj: senast || `Skapat ${svDatum(o.created_at)}${o.created_by_name ? ` av ${fornamn(o.created_by_name)}` : ''}`,
          }
        }
        default:
          return { ton: 'gul', text: `Skickad ${sedan(o.created_at)}, inget svar`, detalj: senast || tom }
      }
    }
    case 'bokade': {
      const tekniker = bokning?.teknikerNamn ? `, ${fornamn(bokning.teknikerNamn)}` : ''
      return {
        ton: 'gron',
        text: bokning?.start ? `Bokad ${startText(bokning.start)}${tekniker}` : `Bokad, tiden är inte satt${tekniker}`,
        detalj: `Bokad in ${svDatum(bokning?.skapad || o.status_updated_at)}${bokning?.arendenummer ? `, ärende ${bokning.arendenummer}` : ''}`,
      }
    }
    case 'vantar': {
      const f = o.action?.follow_up_at
      if (f && f > idag) return { ton: 'gra', text: `Ring ${f}`, detalj: o.action?.follow_up_note ? `"${o.action.follow_up_note}"` : senast }
      const oppnad = o.customer_first_viewed_at ? `Öppnad ${sedan(o.customer_first_viewed_at)}` : 'Inte öppnad än'
      const d = o.days_until_deadline
      const kvar = d !== null && d > 0 ? `, ${d} ${d === 1 ? 'dag' : 'dagar'} kvar` : ''
      return { ton: 'gra', text: `${oppnad}${kvar}`, detalj: senast || `Skickad ${sedan(o.created_at)}` }
    }
    default: {
      const av = avskrivenPost(o)
      if (av) return { ton: 'gra', text: kontaktText(av) || 'Avskriven', detalj: null }
      if (o.status === 'declined') return { ton: 'gra', text: `Avböjd ${sedan(o.status_updated_at)}`, detalj: senast }
      if (o.status === 'overdue') return { ton: 'gra', text: 'Förfallen, hanterad', detalj: senast }
      if (o.status === 'signed') return { ton: 'gron', text: o.booked_case_id ? `Bokad ${svDatum(bokning?.skapad || o.status_updated_at)}` : 'Signerad, klar', detalj: bokning?.arendenummer ? `Ärende ${bokning.arendenummer}` : null }
      return { ton: 'gra', text: 'Klar', detalj: senast }
    }
  }
}

// ─── Nästa steg ───

export type KontorAtgard = 'bokaIn' | 'svara' | 'ring' | 'paminn' | 'forlang' | 'skicka' | 'oppnaBokning' | null

export interface KontorNastaSteg {
  ton: Ton
  status: string
  text: string | null
  primar: KontorAtgard
}

export function kontorNastaSteg(
  o: FollowUpOffer,
  p: KontorPlats,
  lage: Kontaktlage | undefined,
  bokning: Bokning | undefined,
  kanPaminna: boolean,
): KontorNastaSteg {
  const kontakt = o.contact_person || o.company_name || 'kunden'
  const t = fornamn(dokTekniker(o).namn) || 'teknikern'
  const harTel = !!o.contact_phone
  const senastDag = lage?.senast ? `, senaste kontakt ${svDatum(lage.senast.at)}` : ''
  const vad = o.type === 'offer' ? 'offerten' : 'avtalet'
  switch (p.grupp) {
    case 'boka': {
      const ingenKund = o.type === 'contract' && !o.customer_id
      return {
        ton: dagarMellan(svDatum(signDatum(o)), idagSv()) > BOKA_GUL_DAGAR ? 'gul' : 'gron',
        status: `Signerad ${sedan(signDatum(o), true)}`,
        text: ingenKund
          ? 'boka in. Kunden lades inte upp automatiskt vid signeringen. Boka in visar orsaken och kan köra signeringen igen.'
          : o.type === 'offer'
            ? 'boka in och schemalägg. Ursprungsärendet stängs och offertens rader följer med till det nya ärendet.'
            : 'boka in och schemalägg. Ursprungsärendet stängs. Premien faktureras via avtalets fakturaplan.',
        primar: 'bokaIn',
      }
    }
    case 'kontoret':
      if (p.under === 'skrivit') {
        return {
          ton: 'bla',
          status: `Kunden har skrivit ${sedan(lage?.oneflow?.at, true)}`,
          text: `svara kunden i Oneflow, eller ring ${kontakt}.`,
          primar: 'svara',
        }
      }
      if (p.under === 'ring') {
        return {
          ton: 'gul',
          status: 'Ring idag',
          text: o.action?.follow_up_note ? `ring ${kontakt}. Anteckningen: "${o.action.follow_up_note}"` : `ring ${kontakt}.`,
          primar: harTel ? 'ring' : 'svara',
        }
      }
      return { ton: 'gul', status: 'Ditt utkast, inte skickat', text: `granska PDF:en och skicka ${vad} till kunden.`, primar: 'skicka' }
    case 'fastnat': {
      const paminn: KontorAtgard = kanPaminna ? 'paminn' : null
      switch (p.orsak) {
        case 'forfallen':
          return {
            ton: 'rod',
            status: `Förföll ${dagarSedanText(o.days_since_overdue ?? 0)}${senastDag}`,
            text: kanPaminna ? `påminn ${t} att förlänga och ringa kunden, eller förläng och ring själv.` : 'förläng fristen och ring kunden.',
            primar: paminn ?? 'forlang',
          }
        case 'nara': {
          const d = o.days_until_deadline ?? 0
          return {
            ton: 'gul',
            status: `${d <= 0 ? 'Fristen går ut idag' : `Fristen går ut om ${d} ${d === 1 ? 'dag' : 'dagar'}`}${senastDag}`,
            text: kanPaminna ? `påminn ${t}, eller förläng fristen och påminn kunden.` : 'förläng fristen och påminn kunden.',
            primar: paminn ?? 'forlang',
          }
        }
        case 'mejl':
          return {
            ton: 'rod',
            status: 'Mejlet kom inte fram',
            text: kanPaminna ? `påminn ${t} att kontrollera mejladressen, eller ring ${kontakt}.` : `ring ${kontakt} och kontrollera mejladressen.`,
            primar: paminn ?? (harTel ? 'ring' : null),
          }
        case 'oppnad':
          return {
            ton: 'gul',
            status: `Inte öppnad, skickad ${sedan(o.created_at)}${senastDag}`,
            text: kanPaminna ? `påminn ${t}, eller ring ${kontakt} och hör om ${vad} kom fram.` : `ring ${kontakt} och hör om ${vad} kom fram.`,
            primar: paminn ?? (harTel ? 'ring' : null),
          }
        case 'utkast':
          return {
            ton: 'gul',
            status: `Utkast, inte skickat, skapat ${svDatum(o.created_at)}`,
            text: kanPaminna ? `påminn ${t} att skicka, eller granska och skicka själv.` : 'granska PDF:en och skicka till kunden.',
            primar: paminn ?? 'skicka',
          }
        default:
          return {
            ton: 'gul',
            status: `Skickad ${sedan(o.created_at)}, inget svar${senastDag}`,
            text: kanPaminna ? `påminn ${t}, eller ring ${kontakt}.` : `ring ${kontakt}.`,
            primar: paminn ?? (harTel ? 'ring' : null),
          }
      }
    }
    case 'bokade':
      return {
        ton: 'gron',
        status: bokning?.start ? `Bokad ${startText(bokning.start)}` : 'Bokad',
        text: bokning?.arendenummer ? `inget. Dokumentet är inbokat som ärende ${bokning.arendenummer}.` : 'inget. Dokumentet är inbokat.',
        primar: bokning ? 'oppnaBokning' : null,
      }
    case 'vantar': {
      const f = o.action?.follow_up_at
      return {
        ton: 'gra',
        status: f && f > idagSv() ? `Ring ${f}` : o.customer_first_viewed_at ? `Öppnad ${sedan(o.customer_first_viewed_at)}` : 'Inte öppnad än',
        text: o.signing_deadline ? `inget att göra än. Kunden har till ${o.signing_deadline} på sig att signera.` : 'inget att göra än. Kunden har fått dokumentet.',
        primar: null,
      }
    }
    default: {
      const av = avskrivenPost(o)
      if (av) return { ton: 'gra', status: kontaktText(av) || 'Avskriven', text: null, primar: null }
      if (o.status === 'declined') return { ton: 'gra', status: `Avböjd ${sedan(o.status_updated_at)}`, text: null, primar: null }
      if (o.status === 'signed') return { ton: 'gron', status: o.booked_case_id ? 'Bokad' : 'Signerad', text: null, primar: bokning ? 'oppnaBokning' : null }
      return { ton: 'gra', status: 'Klar', text: null, primar: null }
    }
  }
}

// ─── Statistikraden ───

/** Förfallna och inte avskrivna bland dokumenten skickade de senaste 90 dagarna */
export function forfallna90(offers: FollowUpOffer[]): number {
  const fran = plusDagar(idagSv(), -90)
  return offers.filter(o => o.status === 'overdue' && !o.action?.dismissed_at && svDatum(o.created_at) >= fran).length
}

// ─── Påminn teknikern ───

/** Notis till dokumentets tekniker (bokaInService.paminnTekniker) och en post i kontaktloggen. Kastar vid fel. */
export async function skickaPaminnelse(o: FollowUpOffer, userId: string, userName: string): Promise<string> {
  const { mottagareNamn } = await paminnTekniker(o.id, { userId, namn: userName })
  createSystemComment(o.id, 'contract', 'status_change', `Påminnelse till ${mottagareNamn} skickad av ${userName}`, userId, userName)
    .catch(err => console.error('Systemkommentar påminnelse:', err))
  return mottagareNamn
}

// ─── Skriv av ───

export const SKRIV_AV_ANLEDNINGAR = ['Kunden valde någon annan', 'Priset', 'Når inte kunden', 'Dubblett', 'Annat'] as const

/** Skriv av med anledning: dismissed_at, dismissed_by och anledningen i coordinator_notes */
export async function skrivAvMedAnledning(contractId: string, anledning: string, userId: string): Promise<void> {
  const nu = new Date().toISOString()
  const { error } = await db
    .from('coordinator_case_actions')
    .upsert(
      { contract_id: contractId, dismissed_at: nu, dismissed_by: userId, coordinator_notes: `Avskriven: ${anledning}` },
      { onConflict: 'contract_id' },
    )
  if (error) throw error
}
