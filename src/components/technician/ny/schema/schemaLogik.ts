// src/components/technician/ny/schema/schemaLogik.ts
// Räkningar för schemat i nya arbetsvyn (NySchema). Inga anrop, bara rena funktioner.
//
// Belastningen räknas som i gamla TechnicianSchedule (kopierad, inte delad, så att
// gamla vyn inte ändras): ledig dag enligt arbetsschemat, heldagsfrånvaro, bokade
// timmar delat med getTechWorkHours, gränserna 70 och 90 procent. En skillnad:
// gamla vyn räknar bara besöken som syns med statusfiltret (standard utan avslutade),
// här räknas alla dagens besök, avslutade också, så att timmarna stämmer hela dagen.
//
// All tid räknas i svensk tid. Dagar är YYYY-MM-DD, klockslag skrivs med klockslag().

import { fromZonedTime } from 'date-fns-tz'
import { ALL_VALID_STATUSES, type DaySchedule, type WorkSchedule } from '../../../../types/database'
import { getTechWorkHours } from '../../../coordinator/schedule/scheduleUtils'
import {
  SVENSK_TZ, laggTillDagar, veckodag, svenskDag, type BesokTyp, type DagBesok,
} from '../../../../services/teknikerDagService'
import { statusTon, type Ton } from '../besokTyp'

export interface Franvaro {
  id: string
  technician_id: string
  start_date: string
  end_date: string
  reason: string | null
  notes: string | null
  /** Rubrik på blocket, t.ex. Teknikermöte */
  title?: string | null
}

// ─── Datum ───

const DAG_NYCKLAR: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const VECKODAG_KORT = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
const VECKODAG_LANG = ['', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
const MANAD = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const MANAD_KORT = ['jan', 'feb', 'mars', 'apr', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec']

function delar(dag: string): [number, number, number] {
  const [y, m, d] = dag.split('-').map(Number)
  return [y, m, d]
}

/** Ett ögonblick mitt på dagen, samma veckodag i alla europeiska tidszoner */
function middag(dag: string): Date {
  const [y, m, d] = delar(dag)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function dagNummer(dag: string): number {
  return delar(dag)[2]
}

export function veckodagKort(dag: string): string {
  return VECKODAG_KORT[veckodag(dag)]
}

/** "Torsdag 22 oktober" */
export function dagRubrik(dag: string): string {
  const [, m, d] = delar(dag)
  const v = VECKODAG_LANG[veckodag(dag)]
  return `${v.charAt(0).toUpperCase()}${v.slice(1)} ${d} ${MANAD[m - 1]}`
}

/** "Oktober 2026" */
export function manadRubrik(dag: string): string {
  const [y, m] = delar(dag)
  const n = MANAD[m - 1]
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`
}

export function veckansMandag(dag: string): string {
  return laggTillDagar(dag, 1 - veckodag(dag))
}

export function veckansDagar(dag: string): string[] {
  const man = veckansMandag(dag)
  return Array.from({ length: 7 }, (_, i) => laggTillDagar(man, i))
}

/** ISO-veckonummer */
export function veckonummer(dag: string): number {
  const d = middag(dag)
  const tors = new Date(d)
  tors.setUTCDate(d.getUTCDate() + 4 - (veckodag(dag)))
  const arStart = new Date(Date.UTC(tors.getUTCFullYear(), 0, 1))
  return Math.ceil(((tors.getTime() - arStart.getTime()) / 86_400_000 + 1) / 7)
}

/** "19 till 25 okt" eller "27 okt till 2 nov" */
export function veckoSpann(dag: string, langManad = false): string {
  const dagar = veckansDagar(dag)
  const [, m1, d1] = delar(dagar[0])
  const [y2, m2, d2] = delar(dagar[6])
  const namn = langManad ? MANAD : MANAD_KORT
  const ar = langManad ? ` ${y2}` : ''
  if (m1 === m2) return `${d1} till ${d2} ${namn[m2 - 1]}${ar}`
  return `${d1} ${namn[m1 - 1]} till ${d2} ${namn[m2 - 1]}${ar}`
}

export function forstaIManad(dag: string): string {
  const [y, m] = delar(dag)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

export function laggTillManader(dag: string, antal: number): string {
  const [y, m] = delar(dag)
  const d = new Date(Date.UTC(y, m - 1 + antal, 1, 12))
  return d.toISOString().slice(0, 10)
}

/** Veckorna (måndag först) som täcker månaden där dagen ligger */
export function manadsVeckor(dag: string): string[][] {
  const forsta = forstaIManad(dag)
  const [, m] = delar(forsta)
  const veckor: string[][] = []
  let man = veckansMandag(forsta)
  for (;;) {
    const vecka = Array.from({ length: 7 }, (_, i) => laggTillDagar(man, i))
    veckor.push(vecka)
    man = laggTillDagar(man, 7)
    if (delar(man)[1] !== m) break
  }
  return veckor
}

export function sammaManad(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** Ögonblicket för ett svenskt klockslag en viss dag */
export function svenskTid(dag: string, hhmm: string): Date {
  return fromZonedTime(`${dag}T${hhmm}:00`, SVENSK_TZ)
}

/** Minuter sedan midnatt i svensk tid */
export function minuterIDag(d: Date): number {
  const s = new Intl.DateTimeFormat('sv-SE', { timeZone: SVENSK_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const [h, m] = s.split(':').map(Number)
  return (h % 24) * 60 + m
}

// ─── Arbetstid och frånvaro ───

function dagensSchema(dag: string, ws: WorkSchedule | null): DaySchedule | null {
  if (!ws) return null
  return ws[DAG_NYCKLAR[veckodag(dag) % 7]] ?? null
}

/** Ledig dag enligt arbetsschemat (som gamla vyns isOffDay: utan schema är ingen dag ledig) */
export function arLedigDag(dag: string, ws: WorkSchedule | null): boolean {
  if (!ws) return false
  return !dagensSchema(dag, ws)?.active
}

/** Arbetsdagens början och slut. Utan schema 08:00 till 17:00, som gamla vyn. Null på lediga dagar. */
export function arbetstid(dag: string, ws: WorkSchedule | null): { start: Date; slut: Date; startText: string; slutText: string } | null {
  if (arLedigDag(dag, ws)) return null
  const s = dagensSchema(dag, ws)
  const startText = s?.start || '08:00'
  const slutText = s?.end || '17:00'
  return { start: svenskTid(dag, startText), slut: svenskTid(dag, slutText), startText, slutText }
}

function tidpunkt(v: string): Date {
  return new Date(v.replace(' ', 'T'))
}

export interface FranvaroDag {
  /** Frånvaron täcker hela arbetsdagen */
  heldag: boolean
  /** Frånvaron inom dagen, klippt till kalenderdagen */
  block: { start: Date; slut: Date; orsak: string | null; rubrik: string | null }[]
}

export function franvaroForDag(dag: string, franvaro: Franvaro[], ws: WorkSchedule | null): FranvaroDag {
  const dagStart = svenskTid(dag, '00:00')
  const dagSlut = svenskTid(laggTillDagar(dag, 1), '00:00')
  const block: FranvaroDag['block'] = []
  let heldag = false
  const s = dagensSchema(dag, ws)
  const arbStart = svenskTid(dag, s?.start || '08:00')
  const arbSlut = svenskTid(dag, s?.end || '17:00')
  for (const a of franvaro) {
    const aStart = tidpunkt(a.start_date)
    const aSlut = tidpunkt(a.end_date)
    if (isNaN(aStart.getTime()) || isNaN(aSlut.getTime())) continue
    if (aStart >= dagSlut || aSlut < dagStart) continue
    if (aStart <= arbStart && aSlut >= arbSlut) heldag = true
    block.push({
      start: aStart < dagStart ? dagStart : aStart,
      slut: aSlut > dagSlut ? dagSlut : aSlut,
      orsak: a.reason ?? null,
      rubrik: a.title?.trim() || null,
    })
  }
  return { heldag, block }
}

// ─── Belastning ───

export type Niva = 'ledig' | 'franvaro' | 'tom' | 'lag' | 'hog' | 'full'

export interface Belastning {
  niva: Niva
  bokadeTim: number
  kapacitetTim: number
  antal: number
}

export const NIVA_TEXT: Record<Niva, string> = {
  ledig: 'Ledig',
  franvaro: 'Frånvaro',
  tom: 'Inget bokat',
  lag: 'Plats kvar',
  hog: 'Nästan fullt',
  full: 'Fullt',
}

export const NIVA_TON: Record<Niva, Ton> = {
  ledig: 'gra',
  franvaro: 'gra',
  tom: 'gra',
  lag: 'gron',
  hog: 'gul',
  full: 'rod',
}

export function bokadeTimmar(besok: DagBesok[]): number {
  let h = 0
  for (const b of besok) {
    if (b.start && b.slut) h += (b.slut.getTime() - b.start.getTime()) / 3_600_000
  }
  return h
}

export function belastning(dag: string, besok: DagBesok[], ws: WorkSchedule | null, franvaro: Franvaro[]): Belastning {
  const antal = besok.length
  const bokadeTim = bokadeTimmar(besok)
  if (arLedigDag(dag, ws)) return { niva: 'ledig', bokadeTim, kapacitetTim: 0, antal }
  if (franvaroForDag(dag, franvaro, ws).heldag) return { niva: 'franvaro', bokadeTim, kapacitetTim: 0, antal }
  const kapacitetTim = getTechWorkHours(ws, middag(dag))
  const kvot = kapacitetTim > 0 ? Math.min(bokadeTim / kapacitetTim, 1) : 0
  const niva: Niva = kvot === 0 ? 'tom' : kvot < 0.7 ? 'lag' : kvot < 0.9 ? 'hog' : 'full'
  return { niva, bokadeTim, kapacitetTim, antal }
}

/** 7,5 eller 8 */
export function timText(h: number): string {
  const r = Math.round(h * 10) / 10
  return String(r).replace('.', ',')
}

/** "5 av 8 tim bokade" */
export function bokadeText(b: Belastning, lang = false): string {
  return `${timText(b.bokadeTim)} av ${timText(b.kapacitetTim)} ${lang ? 'timmar' : 'tim'} bokade`
}

// ─── Luckor ───

export interface Lucka {
  start: Date
  slut: Date
}

/**
 * Lediga stunder inom arbetstiden, minst `minMinuter` långa. Räknas ur alla dagens besök
 * (oavsett filter) och frånvaron. Besök utan sluttid räknas som en timme.
 */
export function luckor(dag: string, besok: DagBesok[], ws: WorkSchedule | null, franvaro: Franvaro[], minMinuter = 30): Lucka[] {
  const at = arbetstid(dag, ws)
  if (!at) return []
  const fv = franvaroForDag(dag, franvaro, ws)
  if (fv.heldag) return []
  const upptaget: Lucka[] = []
  for (const b of besok) {
    if (!b.start) continue
    upptaget.push({ start: b.start, slut: b.slut && b.slut > b.start ? b.slut : new Date(b.start.getTime() + 3_600_000) })
  }
  for (const f of fv.block) upptaget.push({ start: f.start, slut: f.slut })
  upptaget.sort((a, b) => a.start.getTime() - b.start.getTime())

  const ut: Lucka[] = []
  const min = minMinuter * 60_000
  let markor = at.start.getTime()
  const slut = at.slut.getTime()
  for (const u of upptaget) {
    const s = Math.min(u.start.getTime(), slut)
    if (s - markor >= min) ut.push({ start: new Date(markor), slut: new Date(s) })
    markor = Math.max(markor, u.slut.getTime())
    if (markor >= slut) break
  }
  if (slut - markor >= min) ut.push({ start: new Date(markor), slut: new Date(slut) })
  return ut
}

/** "2 tim 30 min", "45 min" */
export function varaktighet(minuter: number): string {
  const m = Math.round(minuter)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} tim ${r} min` : `${h} tim`
}

// ─── Status och filter ───

/** Status för schemat: som statusTon, men ett passerat besök som inte är avslutat står som Inte klarmarkerat */
export function schemaStatus(b: DagBesok, idag: string = svenskDag()): { ton: Ton; text: string } {
  if (!b.avslutad && b.dag && b.dag < idag && (b.status === 'Bokad' || b.status === 'Återbesök')) {
    return { ton: 'gul', text: 'Inte klarmarkerat' }
  }
  return statusTon(b)
}

export interface StatusGrupp {
  id: string
  rubrik: string
  text: string
  statusar: string[]
}

export const STATUS_GRUPPER: StatusGrupp[] = [
  { id: 'boka', rubrik: 'Inte bokade och att boka', text: 'Öppen, offert signerad, avtal signerat', statusar: ['Öppen', 'Offert signerad - boka in', 'Avtal signerat - Etablera'] },
  { id: 'bokad', rubrik: 'Bokade och återbesök', text: 'Bokad, återbesök', statusar: ['Bokad', 'Återbesök'] },
  { id: 'ombokning', rubrik: 'Ombokning och reklamation', text: 'Ombokning, bomkörning, reklamation', statusar: ['Ombokning', 'Bomkörning', 'Reklamation'] },
  { id: 'kund', rubrik: 'Väntar på kunden', text: 'Offert skickad, avtal skickat', statusar: ['Offert skickad', 'Avtal skickat'] },
  { id: 'klara', rubrik: 'Klara', text: 'Avslutade besök, visas nedtonade', statusar: ['Avslutat'] },
]

/** Stängda statusar (innehåller "Stängt") är dolda som standard, som i gamla vyn */
export const STANGDA_GRUPP = { id: 'stangda', rubrik: 'Stängda', text: 'Stängda ärenden' }

/** De enskilda statusarna bakom Välj enskilda statusar. Borttagna hämtas aldrig. */
export const ENSKILDA_STATUSAR: string[] = ALL_VALID_STATUSES.filter(s => s !== 'Borttaget')

export const ALLA_TYPER: BesokTyp[] = [
  'inspection', 'establishment', 'routine', 'contract_extra', 'rondering', 'egenkontroll', 'contract', 'private', 'business',
]

export interface SchemaFilter {
  dolda: Set<string>
  doldaTyper: Set<BesokTyp>
  visaStangda: boolean
}

export function standardFilter(): SchemaFilter {
  return { dolda: new Set(), doldaTyper: new Set(), visaStangda: false }
}

export function filterArAndrat(f: SchemaFilter): boolean {
  return f.dolda.size > 0 || f.doldaTyper.size > 0 || f.visaStangda
}

export function syns(b: DagBesok, f: SchemaFilter): boolean {
  if (f.doldaTyper.has(b.typ)) return false
  if (f.dolda.has(b.status)) return false
  if (!f.visaStangda && b.status.includes('Stängt')) return false
  return true
}

/** Stationsantal visas för kontrollbesök och etableringar */
export function visaStationer(b: DagBesok): boolean {
  return b.kalla === 'cases' && (b.typ === 'inspection' || b.typ === 'establishment')
}

// ─── Sök ───

/** Samma fält som gamla vyns sökning: titel, kontaktperson, kund, ärendenummer, skadedjur, telefon, adress */
export function matcharSok(b: DagBesok, q: string): boolean {
  if (!q) return true
  return [b.titel, b.kontaktperson, b.kund, b.arendenummer, b.skadedjur, b.telefon, b.adress]
    .some(f => f && f.toLowerCase().includes(q))
}

// ─── Arbetad tid ───

/** Arbetade minuter inklusive pågående pass */
export function arbetadeMinuter(b: DagBesok, nu: Date = new Date()): number {
  const pagaende = b.arbeteStartat ? Math.max(0, (nu.getTime() - b.arbeteStartat.getTime()) / 60_000) : 0
  return b.arbetadeMinuter + pagaende
}

/** "01:12:05", som gamla vyns timer */
export function timerText(minuter: number): string {
  const sek = Math.floor(minuter * 60)
  const h = Math.floor(sek / 3600)
  const m = Math.floor((sek % 3600) / 60)
  const s = sek % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Kollegorna på besöket (övriga tekniker än jag), förnamn */
export function kollegor(b: DagBesok, minId: string | null | undefined): string[] {
  return b.tekniker
    .filter(t => t.id !== minId && t.namn)
    .map(t => t.namn as string)
}
