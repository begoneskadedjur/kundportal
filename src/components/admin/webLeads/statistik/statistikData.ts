// Statistik i Leads (Webb): period, tidshinkar, sammanslagning av RPC-rader per visningsnamn,
// kanalklassning ur gruppnyckeln, svarstid och CSV. Rena funktioner utan React-komponenter.

import type { ReactNode } from 'react'
import {
  SUMMERBARA,
  TOM_MATT,
  type StatGran,
  type StatGrupp,
  type StatMatt,
  type StatRad,
} from '../../../../services/webLeadStatistikService'
import { KUNDGRUPP_LABEL, kallaLabel, tjanstLabel, type WebInquiryKalla, type WebInquiryKundgrupp } from '../../../../types/webInquiry'
import { datumNyckel, parseDatum, plusDagar, tal } from '../../marknad/marknadFormat'
import { KANAL_LABEL, kanalFor, tjanstNyckel, type Kanal, type KanalInfo, type UnderdeladKanal } from '../leadKlassning'
import type { TjanstIkon } from '../WebLeadIcons'

// ---------- Period ----------

export type StatPeriod = '7' | '30' | '90' | '12m' | 'egen'

export const PERIODER: Array<[StatPeriod, string]> = [
  ['7', '7 dagar'],
  ['30', '30 dagar'],
  ['90', '90 dagar'],
  ['12m', '12 månader'],
  ['egen', 'Egen period'],
]

/** Snabbval som slutar i dag (förfrågningarna är levande, dagen räknas med). */
export function periodFor(val: Exclude<StatPeriod, 'egen'>, idag = new Date()): { fran: string; till: string } {
  const till = datumNyckel(idag)
  if (val === '12m') {
    // Hela månader: från första dagen elva månader bakåt till i dag
    return { fran: datumNyckel(new Date(idag.getFullYear(), idag.getMonth() - 11, 1)), till }
  }
  return { fran: plusDagar(till, -(Number(val) - 1)), till }
}

/** Granulariteten följer periodens längd. */
export function granFor(dagar: number): StatGran {
  if (dagar <= 31) return 'dag'
  if (dagar <= 184) return 'vecka'
  return 'manad'
}

export const GRAN_TEXT: Record<StatGran, string> = { dag: 'per dag', vecka: 'per vecka', manad: 'per månad' }

// ---------- Tidshinkar ----------

function mandag(s: string): string {
  const d = parseDatum(s)
  const dag = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dag)
  return datumNyckel(d)
}

/** Alla hinkar i perioden, så att tomma dagar, veckor och månader syns som noll. */
export function hinkar(fran: string, till: string, gran: StatGran): string[] {
  const ut: string[] = []
  if (gran === 'dag') {
    for (let d = fran; d <= till; d = plusDagar(d, 1)) ut.push(d)
  } else if (gran === 'vecka') {
    for (let d = mandag(fran); d <= till; d = plusDagar(d, 7)) ut.push(d)
  } else {
    const s = parseDatum(fran)
    const d = new Date(s.getFullYear(), s.getMonth(), 1)
    while (datumNyckel(d) <= till) {
      ut.push(datumNyckel(d))
      d.setMonth(d.getMonth() + 1)
    }
  }
  return ut
}

/** ISO-veckonummer för en måndag ÅÅÅÅ-MM-DD. */
export function veckonummer(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d!))
  const dag = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dag)
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
}

const MANAD_KORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const MANAD_LANG = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
export const VECKODAG_KORT = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön']
export const VECKODAG_LANG = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

/** Kort etikett för x-axeln. */
export function hinkEtikett(b: string, gran: StatGran): string {
  const d = parseDatum(b)
  if (gran === 'dag') return `${d.getDate()} ${MANAD_KORT[d.getMonth()]}`
  if (gran === 'vecka') return `v${veckonummer(b)}`
  return MANAD_KORT[d.getMonth()]!
}

/** Rubrik i tooltip: hela intervallet, klippt till perioden. */
export function hinkTitel(b: string, gran: StatGran, fran: string, till: string): string {
  const d = parseDatum(b)
  if (gran === 'dag') return `${b}, ${VECKODAG_LANG[(d.getDay() + 6) % 7]}`
  if (gran === 'vecka') {
    const start = b < fran ? fran : b
    const slut = plusDagar(b, 6) > till ? till : plusDagar(b, 6)
    return `Vecka ${veckonummer(b)}, ${start} till ${slut}`
  }
  return `${MANAD_LANG[d.getMonth()]} ${d.getFullYear()}`
}

// ---------- Sammanslagning ----------

export function summera(a: StatMatt, b: StatMatt): StatMatt {
  const ut = { ...a }
  for (const k of SUMMERBARA) ut[k] = a[k] + b[k]
  // Medianer går inte att slå ihop; behåll bara när en av dem är tom
  ut.svarstid_median = a.n === 0 ? b.svarstid_median : b.n === 0 ? a.svarstid_median : null
  return ut
}

export interface Grupprad extends StatMatt {
  /** Visningsnamnet som raderna slogs ihop på. */
  namn: string
  /** Första råa nyckeln (för ikon och sortering). */
  nyckel: string
}

/** Kanal ur RPC:ns gruppnyckel [klick-id, utm_source, utm_medium, annons-id i adressen, referrerns domän]. */
export function kanalFranNyckel(k: string): Kanal {
  return kanalInfoFranNyckel(k).kanal
}

/** Hela klassningen (kanal och AI-assistent) ur RPC:ns gruppnyckel. */
export function kanalInfoFranNyckel(k: string): KanalInfo {
  try {
    const [klick, kalla, medium, adsUrl, vard] = JSON.parse(k) as [boolean, string, string, boolean, string]
    return kanalFor({
      gclid: klick ? 'x' : null,
      gbraid: null,
      wbraid: null,
      utm_source: kalla || null,
      utm_medium: medium || null,
      utm_term: null,
      utm_campaign: null,
      landing_url: adsUrl ? 'https://begone.se/?gclid=x' : null,
      referrer: vard ? `https://${vard}/` : null,
    })
  } catch {
    return { kanal: 'direkt', detalj: '' }
  }
}

/** Visningsnamn för en gruppnyckel. */
export function etikett(g: StatGrupp, k: string): string {
  switch (g) {
    case 'tjanst':
      return tjanstLabel(k || null)
    case 'kundgrupp':
    case 'tid_kundgrupp':
      return KUNDGRUPP_LABEL[k as WebInquiryKundgrupp] ?? k
    case 'kalla': {
      const [kalla, fran] = k.split('|')
      return kallaLabel({ kalla: kalla as WebInquiryKalla, fran: fran || null })
    }
    case 'kanal':
    case 'tid_kanal':
      return KANAL_LABEL[kanalFranNyckel(k)]
    case 'ort':
      return k || 'Okänd ort'
    default:
      return k
  }
}

export function tjanstIkon(k: string): TjanstIkon {
  return tjanstNyckel(k)
}

/** Rader i en grupp, ihopslagna per visningsnamn och sorterade på antal. */
export function grupp(rader: StatRad[], g: StatGrupp): Grupprad[] {
  const m = new Map<string, Grupprad>()
  for (const r of rader) {
    if (r.g !== g) continue
    const namn = etikett(g, r.k)
    const fore = m.get(namn)
    m.set(namn, fore ? { ...fore, ...summera(fore, r) } : { ...TOM_MATT, ...r, namn, nyckel: r.k })
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.namn.localeCompare(b.namn, 'sv'))
}

/**
 * Kanalraderna för en uppdelad kanal ihopslagna per källa (AI-assistent per assistent, Hänvisning
 * per webbplats), sorterade på antal. Tom när ingen förfrågan kom från kanalen.
 */
export function underGrupp(rader: StatRad[], kanal: UnderdeladKanal): Grupprad[] {
  const m = new Map<string, Grupprad>()
  for (const r of rader) {
    if (r.g !== 'kanal') continue
    const info = kanalInfoFranNyckel(r.k)
    if (info.kanal !== kanal || !info.under) continue
    const fore = m.get(info.under.nyckel)
    m.set(info.under.nyckel, fore ? { ...fore, ...summera(fore, r) } : { ...TOM_MATT, ...r, namn: info.under.namn, nyckel: r.k })
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.namn.localeCompare(b.namn, 'sv'))
}

/** Summan av flera grupprader (medianen följer bara med när en enda rad har underlag). */
export function summaAv(rader: StatMatt[]): StatMatt {
  return rader.reduce<StatMatt>((s, r) => summera(s, r), TOM_MATT)
}

export function totalt(rader: StatRad[]): StatMatt {
  return rader.find((r) => r.g === 'totalt') ?? TOM_MATT
}

/** Tidsserien för hela urvalet, en post per hink (tomma hinkar som noll). */
export function tidserie(rader: StatRad[], alla: string[]): Array<StatMatt & { b: string }> {
  const m = new Map(rader.filter((r) => r.g === 'tid_alla').map((r) => [r.b as string, r]))
  return alla.map((b) => ({ ...TOM_MATT, ...m.get(b), b }))
}

// ---------- Format ----------

/** Hårt mellanslag mellan tal och enhet så att de inte bryts isär. */
export const NB = String.fromCharCode(160)

/** Minuter som läsbar tid: 45 min, 2 h 5 min, 1 d 4 h. */
export function svarstidText(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '–'
  if (min < 1) return '< 1 min'
  if (min < 60) return `${Math.round(min)}${NB}min`
  if (min < 24 * 60) {
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return m ? `${h}${NB}h ${m}${NB}min` : `${h}${NB}h`
  }
  const d = Math.floor(min / 1440)
  const h = Math.round((min % 1440) / 60)
  return h ? `${d}${NB}d ${h}${NB}h` : `${d}${NB}d`
}

/** Heltal i procent med komma vid behov: 4,7 %. */
export function andelText(del: number, hel: number, dec = 0): string {
  if (!hel) return '–'
  return `${tal((del / hel) * 100, dec)}${NB}%`
}

// ---------- Fördelning ----------

export interface Fordelningsrad {
  namn: string
  n: number
  ikon?: ReactNode
  /** Extra text i tooltip, t.ex. bokade och vunna. */
  detalj?: string
  /** Underrader som raden kan fällas ut till (AI-assistent per assistent). */
  under?: Fordelningsrad[]
}

export function tillFordelning(rader: Grupprad[], ikon?: (r: Grupprad) => ReactNode): Fordelningsrad[] {
  return rader.map((r) => ({
    namn: r.namn,
    n: r.n,
    ikon: ikon?.(r),
    detalj: r.bokade ? `${tal(r.bokade)} bokade, ${tal(r.vunna)} vunna` : undefined,
  }))
}

// ---------- CSV ----------

/** CSV för svenska Excel: semikolon, komma som decimal, BOM för å, ä och ö. */
export function laddaNerCsv(filnamn: string, rubriker: string[], rader: Array<Array<string | number>>) {
  const cell = (v: string | number) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = [rubriker, ...rader].map((r) => r.map(cell).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filnamn
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
