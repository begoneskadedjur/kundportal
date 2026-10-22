// src/components/technician/ny/arenden/arendeLogik.ts
// Gruppering, filter och sortering för Mina ärenden i nya arbetsvyn.
//
// Samma grupper och samma regler som förra versionen av sidan:
//  - Den här veckan: besök från idag till och med söndag som inte väntar på teknikern
//  - Väntar på dig (vantarPaDig i teknikerDagService):
//      boka     privat- eller företagsärende vars status betyder att tid saknas
//      avsluta  bokat besök (Bokad, Återbesök) vars dag har passerat utan avslut
//  - Övriga öppna: utan tid eller med passerat datum, men med en status som inte
//    väntar på teknikern (till exempel offert skickad eller ombokning)
//  - Kommande: allt öppet efter denna vecka. Närmaste fyra veckorna per vecka,
//    resten per kund (avtalskundernas återkommande besök), hopfällt. Aldrig försenat.
//  - Avslutade: senaste först, per månad

import {
  laggTillDagar, svenskDag, vantarPaDig, veckansSlut, type BesokTyp, type DagBesok,
} from '../../../../services/teknikerDagService'
import { matcharSok, veckansMandag } from '../schema/schemaLogik'
import type { Ton } from '../besokTyp'

export type Lage = 'attgora' | 'kommande' | 'avslutade'
export type Sortering = 'aldst' | 'nyast' | 'kund'
export type Alder = 'alla' | 'nya' | 'gamla'

/** Antal veckor efter denna som visas vecka för vecka under Kommande */
export const KOMMANDE_VECKOR = 4

/**
 * Gränsen för när ett passerat besök som inte är avslutat tonas orange.
 * Ett passerat besök utan avslut är nästan alltid ett utfört jobb som inte
 * klarmarkerats, alltså administration och inte en akut kund. Därför är det
 * neutralt de första 30 dagarna. Efter en månad hinner faktureringen och
 * provisionen släpa en hel period, och då ska det synas. Rött används inte här,
 * det är reserverat för reklamation, bomkörning och ombokning.
 */
export const GAMMALT_EFTER_DAGAR = 30

export interface ArendeFilter {
  doldaTyper: Set<BesokTyp>
  alder: Alder
}

export function standardFilter(): ArendeFilter {
  return { doldaTyper: new Set(), alder: 'alla' }
}

export function filterAktivt(f: ArendeFilter): number {
  return f.doldaTyper.size + (f.alder !== 'alla' ? 1 : 0)
}

export const STANDARD_SORTERING: Record<Lage, Sortering> = {
  attgora: 'aldst',
  kommande: 'aldst',
  avslutade: 'nyast',
}

export const SORTERING_TEXT: Record<Sortering, string> = {
  aldst: 'Äldst först',
  nyast: 'Nyast först',
  kund: 'Kund A till Ö',
}

export const ALDER_TEXT: Record<Alder, string> = {
  alla: 'Alla',
  nya: `Högst ${GAMMALT_EFTER_DAGAR} dagar gamla`,
  gamla: `Äldre än ${GAMMALT_EFTER_DAGAR} dagar`,
}

// ─── Datum ───

function utc(dag: string): number {
  const [y, m, d] = dag.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Hela dagar från `dag` till `idag` (negativt för framtida dagar) */
export function dagarSedan(dag: string, idag: string = svenskDag()): number {
  return Math.round((utc(idag) - utc(dag)) / 86_400_000)
}

/** "idag", "igår", "3 dagar sedan" */
export function sedanText(dagar: number): string {
  if (dagar <= 0) return 'idag'
  if (dagar === 1) return 'igår'
  return `${dagar} dagar sedan`
}

const MANAD_KORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const MANAD_LANG = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** "16 apr", med år om det inte är i år */
export function kortDatum(dag: string, idag: string = svenskDag()): string {
  const [y, m, d] = dag.split('-').map(Number)
  const ar = y !== Number(idag.slice(0, 4)) ? ` ${y}` : ''
  return `${d} ${MANAD_KORT[m - 1]}${ar}`
}

/** "16 april", med år om det inte är i år */
export function langDatum(dag: string, idag: string = svenskDag()): string {
  const [y, m, d] = dag.split('-').map(Number)
  const ar = y !== Number(idag.slice(0, 4)) ? ` ${y}` : ''
  return `${d} ${MANAD_LANG[m - 1]}${ar}`
}

/** Dagen ärendet avslutades, annars besöksdagen */
export function avslutsdag(b: DagBesok): string | null {
  if (b.avslutsdatum) return svenskDag(b.avslutsdatum)
  return b.dag
}

/** Ton för ett passerat besök som inte är avslutat, se GAMMALT_EFTER_DAGAR */
export function alderTon(dagar: number): Ton {
  return dagar > GAMMALT_EFTER_DAGAR ? 'gul' : 'gra'
}

// ─── Sortering ───

function tidsvarde(b: DagBesok, lage: Lage): number {
  if (lage === 'avslutade') return (b.avslutsdatum ?? b.start)?.getTime() ?? 0
  return b.start?.getTime() ?? Number.MAX_SAFE_INTEGER
}

export function sortera(lista: DagBesok[], s: Sortering, lage: Lage): DagBesok[] {
  const ut = [...lista]
  if (s === 'kund') return ut.sort((a, b) => a.kund.localeCompare(b.kund, 'sv') || tidsvarde(a, lage) - tidsvarde(b, lage))
  ut.sort((a, b) => tidsvarde(a, lage) - tidsvarde(b, lage))
  return s === 'nyast' ? ut.reverse() : ut
}

// ─── Gruppering ───

export interface VeckoGrupp {
  /** Måndagen i veckan, YYYY-MM-DD */
  mandag: string
  besok: DagBesok[]
}

export interface KundGrupp {
  nyckel: string
  kund: string
  besok: DagBesok[]
}

export interface ManadGrupp {
  /** YYYY-MM, eller "utan" för ärenden utan datum */
  manad: string
  besok: DagBesok[]
}

export interface Grupper {
  vecka: DagBesok[]
  boka: DagBesok[]
  avsluta: DagBesok[]
  ovriga: DagBesok[]
  veckor: VeckoGrupp[]
  langreFram: KundGrupp[]
  avslutade: ManadGrupp[]
  antal: Record<Lage, number>
  /** Typerna som finns bland teknikerns ärenden, för filtret */
  typer: Map<BesokTyp, number>
}

function passerarAlder(b: DagBesok, f: Alder, idag: string): boolean {
  if (f === 'alla') return true
  const dag = b.avslutad ? avslutsdag(b) : b.dag
  if (!dag) return false
  const d = dagarSedan(dag, idag)
  return f === 'nya' ? d <= GAMMALT_EFTER_DAGAR : d > GAMMALT_EFTER_DAGAR
}

export function gruppera(alla: DagBesok[], q: string, filter: ArendeFilter, sortering: Record<Lage, Sortering>, idag: string): Grupper {
  const veckoslut = veckansSlut(idag)
  const kommandeSlut = laggTillDagar(veckoslut, 7 * KOMMANDE_VECKOR)

  const typer = new Map<BesokTyp, number>()
  for (const b of alla) typer.set(b.typ, (typer.get(b.typ) ?? 0) + 1)

  const filtrerade = alla.filter(b => matcharSok(b, q) && !filter.doldaTyper.has(b.typ))
  const vantar = vantarPaDig(filtrerade, idag)
  const vantarNycklar = new Set(vantar.map(v => v.besok.nyckel))

  // Åldersfiltret gäller Att göra och Avslutade, aldrig Kommande
  const alderOk = (b: DagBesok) => passerarAlder(b, filter.alder, idag)

  const vecka = filtrerade.filter(b => b.dag && b.dag >= idag && b.dag <= veckoslut && !vantarNycklar.has(b.nyckel) && alderOk(b))
  const boka = vantar.filter(v => v.orsak === 'boka').map(v => v.besok).filter(alderOk)
  const avsluta = vantar.filter(v => v.orsak === 'avsluta').map(v => v.besok).filter(alderOk)
  const ovriga = filtrerade.filter(b => !b.avslutad && (!b.dag || b.dag < idag) && !vantarNycklar.has(b.nyckel) && alderOk(b))

  const kommande = filtrerade.filter(b => !b.avslutad && b.dag && b.dag > veckoslut && !vantarNycklar.has(b.nyckel))
  const sk = sortering.kommande

  const veckoKarta = new Map<string, DagBesok[]>()
  const kundKarta = new Map<string, KundGrupp>()
  for (const b of sortera(kommande, sk === 'kund' ? 'aldst' : sk, 'kommande')) {
    const dag = b.dag as string
    if (dag <= kommandeSlut) {
      const m = veckansMandag(dag)
      const l = veckoKarta.get(m)
      if (l) l.push(b); else veckoKarta.set(m, [b])
    } else {
      const nyckel = b.customerId || `namn:${b.kund}`
      const g = kundKarta.get(nyckel) ?? { nyckel, kund: b.kund, besok: [] }
      g.besok.push(b)
      kundKarta.set(nyckel, g)
    }
  }
  const veckor = [...veckoKarta.entries()]
    .map(([mandag, besok]) => ({ mandag, besok: sk === 'kund' ? sortera(besok, 'kund', 'kommande') : besok }))
    .sort((a, b) => (sk === 'nyast' ? b.mandag.localeCompare(a.mandag) : a.mandag.localeCompare(b.mandag)))
  const langreFram = [...kundKarta.values()].sort((a, b) => {
    if (sk === 'kund') return a.kund.localeCompare(b.kund, 'sv')
    const d = (a.besok[0].dag ?? '').localeCompare(b.besok[0].dag ?? '')
    return sk === 'nyast' ? -d : d
  })
  for (const g of langreFram) g.besok.sort((a, b) => (a.dag ?? '').localeCompare(b.dag ?? ''))

  const sa = sortering.avslutade
  const manadKarta = new Map<string, DagBesok[]>()
  for (const b of sortera(filtrerade.filter(x => x.avslutad && alderOk(x)), sa === 'kund' ? 'nyast' : sa, 'avslutade')) {
    const dag = avslutsdag(b)
    const m = dag ? dag.slice(0, 7) : 'utan'
    const l = manadKarta.get(m)
    if (l) l.push(b); else manadKarta.set(m, [b])
  }
  const avslutade = [...manadKarta.entries()]
    .map(([manad, besok]) => ({ manad, besok: sa === 'kund' ? sortera(besok, 'kund', 'avslutade') : besok }))
    .sort((a, b) => {
      if (a.manad === 'utan') return 1
      if (b.manad === 'utan') return -1
      return sa === 'aldst' ? a.manad.localeCompare(b.manad) : b.manad.localeCompare(a.manad)
    })

  const sg = sortering.attgora
  const sorteraAttGora = (l: DagBesok[]) => sortera(l, sg, 'attgora')

  const kommandeAntal = kommande.length
  const avslutadeAntal = avslutade.reduce((s, g) => s + g.besok.length, 0)

  return {
    vecka: sorteraAttGora(vecka),
    boka: sorteraAttGora(boka),
    avsluta: sorteraAttGora(avsluta),
    ovriga: sorteraAttGora(ovriga),
    veckor,
    langreFram,
    avslutade,
    antal: {
      attgora: vecka.filter(b => !b.avslutad).length + boka.length + avsluta.length,
      kommande: kommandeAntal,
      avslutade: avslutadeAntal,
    },
    typer,
  }
}

/** Läget där ett ärende står, för djuplänkar */
export function lageFor(b: DagBesok, idag: string): Lage {
  if (b.avslutad) return 'avslutade'
  const veckoslut = veckansSlut(idag)
  if (b.dag && b.dag > veckoslut && vantarPaDig([b], idag).length === 0) return 'kommande'
  return 'attgora'
}

/** Rubrik för en månadsgrupp: "Oktober 2026" */
export function manadText(manad: string): string {
  if (manad === 'utan') return 'Utan datum'
  const [y, m] = manad.split('-').map(Number)
  const n = MANAD_LANG[m - 1]
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`
}

function plural(n: number, en: string, flera: string): string {
  return `${n} ${n === 1 ? en : flera}`
}

/** Sammanfattningen överst, i klartext */
export function sammanfattning(g: Grupper, idag: string): string {
  const kvar = g.vecka.filter(b => !b.avslutad).length
  const delar: string[] = []
  if (g.boka.length > 0) delar.push(`${plural(g.boka.length, 'ärende behöver', 'ärenden behöver')} en tid`)
  if (g.avsluta.length > 0) {
    const aldsta = g.avsluta.reduce<string | null>((min, b) => (b.dag && (!min || b.dag < min) ? b.dag : min), null)
    delar.push(`${plural(g.avsluta.length, 'passerat besök ska', 'passerade besök ska')} avslutas${aldsta ? `, det äldsta från ${langDatum(aldsta, idag)}` : ''}`)
  }
  const vecka = kvar === 0 ? 'Inget mer inbokat den här veckan.' : `${plural(kvar, 'besök', 'besök')} kvar den här veckan.`
  if (delar.length === 0) return `${vecka} Inget annat väntar på dig.`
  const vantar = delar.join(' och ')
  return `${vecka} ${vantar.charAt(0).toUpperCase()}${vantar.slice(1)}.`
}
