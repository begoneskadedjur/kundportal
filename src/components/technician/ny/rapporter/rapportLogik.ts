// src/components/technician/ny/rapporter/rapportLogik.ts
// Rena funktioner för sidan Mina rapporter i nya arbetsvyn: rapporttyp per
// ärendetyp, period, sökning, typfilter och gruppering per månad.
// Inga anrop här, så allt går att testa (rapportLogik.test.ts).

import { formatInTimeZone } from 'date-fns-tz'
import { SVENSK_TZ, laggTillDagar, type ArendeKalla, type BesokTyp } from '../../../../services/teknikerDagService'

/** Vilken rapport ärendet har */
export type RapportSort = 'sanering' | 'arende' | 'kontroll'

export const RAPPORT_NAMN: Record<RapportSort, string> = {
  sanering: 'Saneringsrapport',
  arende: 'Ärenderapport',
  kontroll: 'Kontrollrapport',
}

/** Typfiltret på sidan */
export type RapportTypFilter = 'alla' | 'privat' | 'foretag' | 'avtal' | 'kontroll' | 'rondering'

export const TYP_FILTER_VAL: { id: RapportTypFilter; text: string }[] = [
  { id: 'alla', text: 'Alla typer' },
  { id: 'privat', text: 'Privat' },
  { id: 'foretag', text: 'Företag' },
  { id: 'avtal', text: 'Avtal: extrabesök, etablering, övriga' },
  { id: 'kontroll', text: 'Stationskontroll' },
  { id: 'rondering', text: 'Rondering' },
]

export type RapportPeriod = '30' | '90' | '365'

export const PERIOD_VAL: { id: RapportPeriod; kort: string; lang: string }[] = [
  { id: '30', kort: '30 dagar', lang: '30 dagar' },
  { id: '90', kort: '90 dagar', lang: '90 dagar' },
  { id: '365', kort: '12 mån', lang: '12 månader' },
]

export interface RapportRad {
  /** Unik nyckel över källorna, "cases:uuid" */
  nyckel: string
  kalla: ArendeKalla
  id: string
  typ: BesokTyp
  sort: RapportSort
  arendenummer: string | null
  /** Avslutsdatum som ögonblick */
  avslutad: Date
  /** YYYY-MM-DD i svensk tid */
  dag: string
  kund: string
  /** Ärendetyp och skadedjur, t.ex. "Privat, råttor" */
  tjanst: string
  /** Adressen rapporten skickas till när teknikern väljer Skicka till kund */
  kundEpost: string | null
  kontaktperson: string | null
}

/** Rapporten som hör till ärendetypen. Egenkontroll har ingen ärenderapport: null. */
export function rapportSortFor(typ: BesokTyp): RapportSort | null {
  if (typ === 'egenkontroll') return null
  if (typ === 'private' || typ === 'business') return 'sanering'
  if (typ === 'inspection') return 'kontroll'
  return 'arende'
}

export function matcharTyp(rad: Pick<RapportRad, 'typ'>, filter: RapportTypFilter): boolean {
  switch (filter) {
    case 'alla': return true
    case 'privat': return rad.typ === 'private'
    case 'foretag': return rad.typ === 'business'
    case 'kontroll': return rad.typ === 'inspection'
    case 'rondering': return rad.typ === 'rondering'
    case 'avtal': return rad.typ === 'contract_extra' || rad.typ === 'establishment' || rad.typ === 'routine' || rad.typ === 'contract'
  }
}

/** Första dagen i perioden (YYYY-MM-DD), räknat bakåt från idag i svensk tid */
export function periodFran(period: RapportPeriod, idag: string): string {
  return laggTillDagar(idag, -(Number(period) - 1))
}

/** Sök på kund, ärendenummer, kontaktperson och e-post. Tom sökning matchar allt. */
export function matcharSok(rad: RapportRad, sok: string): boolean {
  const q = sok.trim().toLowerCase()
  if (!q) return true
  return [rad.kund, rad.arendenummer, rad.kontaktperson, rad.kundEpost]
    .some(v => typeof v === 'string' && v.toLowerCase().includes(q))
}

/** Filtrerar på sökning och typ, senaste först */
export function filtreraRapporter(rader: RapportRad[], sok: string, typ: RapportTypFilter): RapportRad[] {
  return rader
    .filter(r => matcharTyp(r, typ) && matcharSok(r, sok))
    .sort((a, b) => b.avslutad.getTime() - a.avslutad.getTime())
}

export interface RapportManad {
  /** YYYY-MM */
  manad: string
  rader: RapportRad[]
}

/** Grupperar per månad i den ordning raderna kommer (senaste först om listan är sorterad så) */
export function grupperaPerManad(rader: RapportRad[]): RapportManad[] {
  const ut: RapportManad[] = []
  const index = new Map<string, RapportManad>()
  for (const r of rader) {
    const m = r.dag.slice(0, 7)
    let grupp = index.get(m)
    if (!grupp) {
      grupp = { manad: m, rader: [] }
      index.set(m, grupp)
      ut.push(grupp)
    }
    grupp.rader.push(r)
  }
  return ut
}

/** YYYY-MM-DD i svensk tid för ett ögonblick */
export function dagFor(d: Date): string {
  return formatInTimeZone(d, SVENSK_TZ, 'yyyy-MM-dd')
}

/** "Saneringsrapport" blir "saneringsrapporten" */
export function bestamdForm(namn: string): string {
  return `${namn.charAt(0).toLowerCase()}${namn.slice(1)}en`
}

const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function arGiltigEpost(v: string | null | undefined): boolean {
  return !!v && EPOST.test(v.trim())
}
