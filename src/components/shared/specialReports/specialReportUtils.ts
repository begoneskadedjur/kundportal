// src/components/shared/specialReports/specialReportUtils.ts
// Hjälpfunktioner för specialrapporternas gränssnitt: datum som lokal svensk
// tid, status i listan, sökväg per roll, punkt i område och fördröjd sparning.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import type { IconName } from '../../icons/Icon'
import {
  SECTION_COLORS,
  type LatLng,
  type SpecialReportDocType,
  type SpecialReportEventType,
  type SpecialReportFull,
  type SpecialReportListItem,
} from '../../../types/specialReport'

export interface PreviewPage {
  key: string
  namn: string
  /** Delens nummer och färg för delsidor */
  nr?: number
  farg?: string
}

/** Rapportens sidor i ordning, samma som i PDF:en */
export function byggSidor(r: SpecialReportFull): PreviewPage[] {
  return [
    { key: 'om', namn: 'Om rapporten' },
    ...(r.map_view ? [{ key: 'oversikt', namn: 'Översikt' }] : []),
    ...r.sections.map((s, i) => ({ key: s.id, namn: s.title.trim() || 'Utan rubrik', nr: i + 1, farg: fargForDel(s.color, i) })),
    { key: 'samm', namn: 'Bedömning och åtgärder' },
  ]
}

/** Vilken sida en vy i redigeraren visar. Kartan utan översikt visar första sidan */
export function sidaForVy(sidor: PreviewPage[], vy: string): number {
  const i = sidor.findIndex(p => p.key === vy)
  return i >= 0 ? i : 0
}

/** Delens färg, med reserv i tur och ordning om färgen saknas */
export function fargForDel(color: string | null | undefined, index: number): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : SECTION_COLORS[index % SECTION_COLORS.length].value
}

/** Föreslagen typ av rapport utifrån ärendets titel och tjänst */
export function foreslaDokumenttyp(...texter: (string | null | undefined)[]): SpecialReportDocType {
  const t = texter.filter(Boolean).join(' ').toLowerCase()
  if (t.includes('inspektion')) return 'Inspektionsrapport'
  return 'Saneringsrapport'
}

/** Vart en punkt i "Klar att skicka" leder: en vy och ett fält, eller valet Lägg till del */
export type KlarMal = { vy: string; falt: string | null } | { laggTillDel: true }

export interface KlarPunkt {
  key: 'intro' | 'delar' | 'handelser' | 'bedomning' | 'rekommendationer'
  text: string
  /** Kort form i "2 saker saknas: ..." */
  saknas: string
  klar: boolean
  mal: KlarMal
}

/** De fem punkterna i "Klar att skicka", räknade från rapportens lokala tillstånd */
export function klarAttSkicka(r: SpecialReportFull): KlarPunkt[] {
  const harText = (v: string | null | undefined) => !!v && v.trim().length > 0
  const sorterade = [...r.sections].sort((a, b) => a.position - b.position)
  const forsta = sorterade[0]
  const medHandelseblock = sorterade.find(s => s.blocks.some(b => b.type === 'events')) ?? forsta
  return [
    { key: 'intro', text: 'Inledning skriven', saknas: 'inledning', klar: harText(r.intro), mal: { vy: 'om', falt: 'rapport:intro' } },
    { key: 'delar', text: 'Minst ett område eller besök', saknas: 'minst en del', klar: sorterade.length > 0, mal: forsta ? { vy: forsta.id, falt: `del:${forsta.id}:rubrik` } : { laggTillDel: true } },
    {
      key: 'handelser',
      text: 'Händelser registrerade',
      saknas: 'händelser',
      klar: sorterade.some(s => s.events.length > 0),
      mal: medHandelseblock ? { vy: medHandelseblock.id, falt: `del:${medHandelseblock.id}:handelser` } : { laggTillDel: true },
    },
    { key: 'bedomning', text: 'Bedömning skriven', saknas: 'bedömning', klar: harText(r.assessment), mal: { vy: 'samm', falt: 'rapport:assessment' } },
    { key: 'rekommendationer', text: 'Rekommendationer skrivna', saknas: 'rekommendationer', klar: harText(r.recommendations), mal: { vy: 'samm', falt: 'rapport:recommendations' } },
  ]
}

/** "a", "a och b", "a, b och c" */
export function uppraknad(lista: string[]): string {
  if (lista.length <= 1) return lista[0] ?? ''
  return `${lista.slice(0, -1).join(', ')} och ${lista[lista.length - 1]}`
}

/** Sant från lg (1024 px), följer fönsterbredden */
export function useArDesktop(): boolean {
  const fraga = '(min-width: 1024px)'
  const [ar, setAr] = useState(() => typeof window !== 'undefined' && window.matchMedia(fraga).matches)
  useEffect(() => {
    const mq = window.matchMedia(fraga)
    const andrad = () => setAr(mq.matches)
    andrad()
    mq.addEventListener('change', andrad)
    return () => mq.removeEventListener('change', andrad)
  }, [])
  return ar
}

/** Dagens datum som ÅÅÅÅ-MM-DD i lokal tid (aldrig toISOString, den ger UTC-datum) */
export function idagISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dag = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dag}`
}

/** Klockslag HH:MM i svensk tid */
export function klockslag(d: Date): string {
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

/** Datumdelen av en tidsstämpel, ÅÅÅÅ-MM-DD i lokal tid */
export function datumAv(tidsstampel: string | null | undefined): string {
  if (!tidsstampel) return ''
  const d = new Date(tidsstampel)
  if (Number.isNaN(d.getTime())) return tidsstampel.slice(0, 10)
  return idagISO(d)
}

/** "I dag 14:32" eller "2026-10-09" */
export function senastAndrad(tidsstampel: string): string {
  const d = new Date(tidsstampel)
  if (Number.isNaN(d.getTime())) return ''
  return idagISO(d) === idagISO() ? `I dag ${klockslag(d)}` : idagISO(d)
}

export type RapportStatus = 'utkast' | 'pagar' | 'skickad'

/**
 * Status i listan. Skickad låser versionen och räknar upp current_version,
 * så "pågår" avgörs av om rapporten ändrats efter senaste utskicket. En minut
 * marginal eftersom själva utskicket också rör updated_at.
 */
export function rapportStatus(r: Pick<SpecialReportListItem, 'last_sent_at' | 'last_sent_version' | 'updated_at'>): RapportStatus {
  if (r.last_sent_version == null || !r.last_sent_at) return 'utkast'
  const andrad = new Date(r.updated_at).getTime()
  const skickad = new Date(r.last_sent_at).getTime()
  return andrad - skickad > 60_000 ? 'pagar' : 'skickad'
}

export const STATUS_FARG: Record<RapportStatus, { punkt: string; text: string }> = {
  utkast: { punkt: 'bg-slate-500', text: 'text-slate-400' },
  pagar: { punkt: 'bg-amber-400', text: 'text-amber-400' },
  skickad: { punkt: 'bg-[#20c58f]', text: 'text-[#20c58f]' },
}

/** Ikon per händelsetyp */
export const EVENT_ICON: Record<SpecialReportEventType, IconName> = {
  inspektion: 'rapport.inspektion',
  besok: 'rapport.besok',
  betning: 'rapport.betning',
  atgard: 'rapport.atgard',
  underlev: 'rapport.underlev',
  notering: 'rapport.notering',
}

/** Primär handling: brandgrön yta med mörk text (skissen), text + ikon */
export const PRIMAR_KNAPP =
  'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#20c58f] text-[#04140d] text-sm font-semibold hover:bg-[#1ba876] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed'

/** Sekundär handling med text */
export const SEKUNDAR_KNAPP =
  'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-700 text-slate-200 text-sm hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-50 disabled:cursor-not-allowed'

/** Sekundär handling som ikonknapp, minst 44 px */
export const IKON_KNAPP =
  'inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-40 disabled:cursor-not-allowed'

/** Ikonknapp utan ram (i blockhuvuden och rader), minst 44 px */
export const IKON_KNAPP_LATT =
  'inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-30 disabled:cursor-not-allowed'

/** Textfält enligt skissen */
export const FALT =
  'w-full h-11 px-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f]'

export const TEXTFALT =
  'w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 text-sm leading-relaxed placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f] resize-y'

export const DOC_TYPES =['Saneringsrapport', 'Inspektionsrapport', 'Åtgärdsrapport'] as const

/**
 * Sökvägen till specialrapporterna för den inloggade. Tekniker hamnar under
 * /technician, alla andra (koordinator, admin) under /koordinator.
 */
export function useSpecialReportBase(): string {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  if (pathname.startsWith('/technician')) return '/technician/specialrapporter'
  if (pathname.startsWith('/koordinator')) return '/koordinator/specialrapporter'
  if (profile?.role === 'technician') return '/technician/specialrapporter'
  return '/koordinator/specialrapporter'
}

/** Ligger punkten i området? Strålkastning, räcker gott för byggnader och gårdar. */
export function punktIOmrade(p: LatLng, omrade: LatLng[]): boolean {
  let inne = false
  for (let i = 0, j = omrade.length - 1; i < omrade.length; j = i++) {
    const a = omrade[i]
    const b = omrade[j]
    const korsar = (a.lat > p.lat) !== (b.lat > p.lat)
      && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
    if (korsar) inne = !inne
  }
  return inne
}

/** Medelpunkt av hörnen, för numret på kartan */
export function mittpunkt(omrade: LatLng[]): LatLng {
  const n = omrade.length || 1
  return {
    lat: omrade.reduce((s, p) => s + p.lat, 0) / n,
    lng: omrade.reduce((s, p) => s + p.lng, 0) / n,
  }
}

/**
 * Öppna en URL som hämtas asynkront i en ny flik. Fliken öppnas direkt vid
 * klicket (annars stoppar popup-spärren den) och får adressen när den finns.
 */
export async function oppnaINyFlik(hamta: () => Promise<string>): Promise<void> {
  const flik = window.open('', '_blank')
  try {
    const url = await hamta()
    if (flik && !flik.closed) {
      flik.location.href = url
    } else {
      window.location.assign(url)
    }
  } catch (e) {
    flik?.close()
    throw e
  }
}

/** Ladda ned en fil från en (signerad) URL med rätt filnamn */
export async function laddaNed(url: string, filnamn: string): Promise<void> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Nedladdningen misslyckades')
    const blob = await res.blob()
    const lank = document.createElement('a')
    const objektUrl = URL.createObjectURL(blob)
    lank.href = objektUrl
    lank.download = filnamn
    document.body.appendChild(lank)
    lank.click()
    lank.remove()
    setTimeout(() => URL.revokeObjectURL(objektUrl), 10_000)
  } catch {
    // Faller tillbaka på att öppna filen om hämtningen stoppas
    window.open(url, '_blank')
  }
}

/** Enkel kontroll av e-postadress */
export function arEpost(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

/** Läs/skriv i localStorage utan att någonsin kasta */
export function lasLokalt(nyckel: string): string | null {
  try { return window.localStorage.getItem(nyckel) } catch { return null }
}
export function skrivLokalt(nyckel: string, varde: string): void {
  try { window.localStorage.setItem(nyckel, varde) } catch { /* privat läge */ }
}

export type SparStatus = 'vilar' | 'sparar' | 'sparad' | 'fel'

/**
 * Fördröjd sparning per fält. schedule(nyckel, fn) väntar ~600 ms efter senaste
 * ändringen innan fn körs; en ny ändring på samma nyckel ersätter den gamla.
 * Allt som väntar körs direkt när komponenten avmonteras.
 */
export function useDebouncedSaver(delay = 600) {
  const timers = useRef(new Map<string, { t: ReturnType<typeof setTimeout>; fn: () => Promise<void> }>())
  const pagaende = useRef(0)
  // Sparningar som körs just nu, så att flush kan vänta in även dem
  const aktiva = useRef(new Set<Promise<void>>())
  // Räknas upp vid varje ändring, så att en hämtning kan se om något ändrats under tiden
  const andringar = useRef(0)
  const [status, setStatus] = useState<SparStatus>('vilar')
  const [sparadTid, setSparadTid] = useState<Date | null>(null)

  const kor = useCallback((fn: () => Promise<void>): Promise<void> => {
    pagaende.current += 1
    setStatus('sparar')
    const p = (async () => {
      try {
        await fn()
        pagaende.current -= 1
        if (pagaende.current === 0) {
          setStatus('sparad')
          setSparadTid(new Date())
        }
      } catch (e) {
        pagaende.current -= 1
        setStatus('fel')
        throw e
      }
    })()
    const klar = p.then(() => {}, () => {})
    aktiva.current.add(klar)
    void klar.then(() => { aktiva.current.delete(klar) })
    return p
  }, [])

  const schedule = useCallback((nyckel: string, fn: () => Promise<void>, onError?: (e: unknown) => void) => {
    andringar.current += 1
    const gammal = timers.current.get(nyckel)
    if (gammal) clearTimeout(gammal.t)
    setStatus('sparar')
    const t = setTimeout(() => {
      timers.current.delete(nyckel)
      kor(fn).catch(e => onError?.(e))
    }, delay)
    timers.current.set(nyckel, { t, fn })
  }, [delay, kor])

  /** Släpp en väntande sparning utan att köra den (t.ex. tom rubrik) */
  const cancel = useCallback((nyckel: string) => {
    const gammal = timers.current.get(nyckel)
    if (gammal) clearTimeout(gammal.t)
    timers.current.delete(nyckel)
    if (timers.current.size === 0 && pagaende.current === 0) setStatus(s => (s === 'sparar' ? 'sparad' : s))
  }, [])

  /** Kör en sparning direkt (t.ex. borttag eller ny händelse) och uppdatera statusen */
  const now = useCallback((fn: () => Promise<void>) => {
    andringar.current += 1
    return kor(fn)
  }, [kor])

  /**
   * Kör allt som väntar direkt och vänta in det, även sparningar som redan
   * hunnit starta (t.ex. före PDF, annars kan den sista ändringen saknas)
   */
  const flush = useCallback(async (): Promise<void> => {
    const vantande = [...timers.current.values()]
    timers.current.clear()
    vantande.forEach(v => {
      clearTimeout(v.t)
      kor(v.fn).catch(() => { /* rapporteras redan via status */ })
    })
    await Promise.all([...aktiva.current])
  }, [kor])

  /** Finns det sparningar som väntar eller pågår */
  const harVantande = useCallback(() => timers.current.size > 0 || pagaende.current > 0, [])

  /** Antal ändringar hittills (ökar vid schedule och now) */
  const andringsNr = useCallback(() => andringar.current, [])

  // Sidan stängs eller göms: spara direkt, och varna vid stängning om något inte hunnit sparas
  useEffect(() => {
    const vidStangning = (e: BeforeUnloadEvent) => {
      if (timers.current.size === 0 && pagaende.current === 0) return
      void flush()
      e.preventDefault()
      e.returnValue = ''
    }
    const vidDold = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const vidPagehide = () => { void flush() }
    window.addEventListener('beforeunload', vidStangning)
    document.addEventListener('visibilitychange', vidDold)
    window.addEventListener('pagehide', vidPagehide)
    return () => {
      window.removeEventListener('beforeunload', vidStangning)
      document.removeEventListener('visibilitychange', vidDold)
      window.removeEventListener('pagehide', vidPagehide)
    }
  }, [flush])

  useEffect(() => () => {
    // Avmontering: spara det som väntar så inget tappas
    timers.current.forEach(v => {
      clearTimeout(v.t)
      v.fn().catch(() => { /* komponenten är borta */ })
    })
    timers.current.clear()
  }, [])

  return { schedule, cancel, now, flush, harVantande, andringsNr, status, sparadTid }
}

/** Snygga till i blockhuvuden och rubriker: grön text, ikon + text (bara ikon på mobil), minst 44 px */
export const SNYGGA_KNAPP =
  'inline-flex items-center justify-center gap-1.5 h-11 min-w-11 flex-shrink-0 rounded-lg px-2 text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 disabled:opacity-40 disabled:cursor-not-allowed'
