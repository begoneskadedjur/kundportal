// src/components/technician/ny/kundresa/kundresaData.ts
// Data och regler för Min kundresa i nya arbetsvyn.
//
// All data kommer från RPC:n min_kundresa (supabase/migrations/20261023_min_kundresa_rpc.sql),
// security definer, som bara lämnar ut den inloggades egna dokument. Sidan läser alltså
// aldrig oneflow_sync_log direkt. Tidpunkterna:
//   skickad_at   första contract:publish (offerter utan händelse: created_at som reserv)
//   signerad_at  första contract:sign, inte contracts.signed_at
//   forfoll_at   sista contract:signing_period_expire när slutläget är overdue
// Arkiverat (legacy_archived_at) och allt skickat före 2026-05-01 filtreras redan i RPC:n.
//
// Steg som visas: Skickad, Signerad, Förföll, Raderades, Väntar. Öppnad och Tackade nej
// visas inte (Oneflow skickar inte händelserna). Efter Signerad mäts inget än, utom Bokad
// för dokument med booked_case_id.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { laggTillDagar, svenskDag, svenskMidnatt } from '../../../../services/teknikerDagService'
import { dagarMellan, svDatum, svTid } from '../dokument/dokumentData'
import type { Ton } from '../besokTyp'

export type DokTyp = 'offer' | 'contract'
export type PeriodDagar = 30 | 90 | 365
export type Utfall = 'signerad' | 'vantar' | 'forfoll' | 'raderad' | 'annat'

/** Dagen då nya systemet tog över. Allt före är arkiverat och räknas inte. */
export const ARKIVGRANS = '2026-05-01'
/** Från den dagen sätter Boka in booked_case_id på offerter */
export const BOKNING_MATS_FRAN = '2026-10-23'
/** Minsta antal dokument i båda perioderna för att en jämförelse ska skrivas */
export const MINSTA_FOR_JAMFORELSE = 5

export interface KundresaDok {
  id: string
  typ: DokTyp
  kundnamn: string
  belopp: number | null
  skickad_at: string
  signerad_at: string | null
  forfoll_at: string | null
  status: string
  signing_deadline: string | null
  booked_case_id: string | null
  bokad_start: string | null
}

export function utfall(d: KundresaDok): Utfall {
  if (d.signerad_at) return 'signerad'
  if (d.status === 'pending') return 'vantar'
  if (d.status === 'overdue') return 'forfoll'
  if (d.status === 'trashed') return 'raderad'
  return 'annat'
}

// ─── Hämtning ───

const TOM: KundresaDok[] = []

/** Hämtar alla egna dokument sedan arkivgränsen för en typ. Perioderna räknas i webbläsaren. */
export function useMinKundresa(typ: DokTyp) {
  const [data, setData] = useState<{ typ: DokTyp; rader: KundresaDok[] } | null>(null)
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)
  const [hamtad, setHamtad] = useState<Date | null>(null)

  const ladda = useCallback(async () => {
    setLaddar(true)
    setFel(null)
    const { data, error } = await supabase.rpc('min_kundresa', {
      p_typ: typ,
      p_fran: svenskMidnatt(ARKIVGRANS),
      p_till: new Date(Date.now() + 60_000).toISOString(),
    })
    if (error) {
      console.error('[MinKundresa] min_kundresa misslyckades:', error)
      setFel('Siffrorna kunde inte hämtas. Försök igen om en stund.')
      setLaddar(false)
      return
    }
    const rader = ((data ?? []) as Array<KundresaDok & { belopp: number | string | null }>).map(r => ({
      ...r,
      belopp: r.belopp === null ? null : Number(r.belopp),
    }))
    setData({ typ, rader })
    setHamtad(new Date())
    setLaddar(false)
  }, [typ])

  useEffect(() => { void ladda() }, [ladda])

  // Rader för en annan typ visas aldrig medan den nya hämtas
  const dok = data && data.typ === typ ? data.rader : TOM
  return { dok, laddar, fel, ladda, hamtad }
}

// ─── Perioder, rullande och i svensk tid ───

export interface Period {
  /** Första dagen, ÅÅÅÅ-MM-DD */
  fran: string
  /** Sista dagen, ÅÅÅÅ-MM-DD */
  till: string
  /** Gränser som tidsstämplar (från ink, till ex) */
  franTs: number
  tillTs: number
}

export interface Perioder {
  nu: Period
  fore: Period
  /** 'hel' jämförelse, 'delvis' (perioden före börjar före arkivgränsen) eller 'ingen' */
  jamforelse: 'hel' | 'delvis' | 'ingen'
  /** Nuvarande perioden börjar före arkivgränsen */
  nuDelvis: boolean
}

function period(fran: string, till: string): Period {
  return {
    fran,
    till,
    franTs: new Date(svenskMidnatt(fran)).getTime(),
    tillTs: new Date(svenskMidnatt(laggTillDagar(till, 1))).getTime(),
  }
}

export function perioder(dagar: PeriodDagar, idag: string = svenskDag()): Perioder {
  const nu = period(laggTillDagar(idag, -(dagar - 1)), idag)
  const fore = period(laggTillDagar(idag, -(2 * dagar - 1)), laggTillDagar(idag, -dagar))
  const jamforelse = fore.till < ARKIVGRANS ? 'ingen' : fore.fran < ARKIVGRANS ? 'delvis' : 'hel'
  return { nu, fore, jamforelse, nuDelvis: nu.fran < ARKIVGRANS }
}

export function iPeriod(d: KundresaDok, p: Period): boolean {
  const t = new Date(d.skickad_at).getTime()
  return t >= p.franTs && t < p.tillTs
}

// ─── Statistik för en period ───

export interface Flode {
  skickade: number
  signerade: number
  vantar: number
  forfoll: number
  raderades: number
  annat: number
  /** Signerade med booked_case_id */
  bokade: number
  /** Median i dagar, null om inget att räkna på */
  medianSignerad: number | null
  medianForfoll: number | null
  /** Signerade inom 3 dygn efter utskicket */
  inom3: number
  /** Förfallna dokument, nyast först, för länkar i texten */
  forfallna: KundresaDok[]
}

const DYGN = 86_400_000

function median(v: number[]): number | null {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const dygnMellan = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / DYGN

export function raknaFlode(dok: KundresaDok[]): Flode {
  const f: Flode = {
    skickade: dok.length, signerade: 0, vantar: 0, forfoll: 0, raderades: 0, annat: 0, bokade: 0,
    medianSignerad: null, medianForfoll: null, inom3: 0, forfallna: [],
  }
  const tSig: number[] = []
  const tFor: number[] = []
  for (const d of dok) {
    const u = utfall(d)
    if (u === 'signerad') {
      f.signerade++
      if (d.booked_case_id) f.bokade++
      const t = dygnMellan(d.skickad_at, d.signerad_at as string)
      if (t >= 0) {
        tSig.push(t)
        if (t <= 3) f.inom3++
      }
    } else if (u === 'vantar') f.vantar++
    else if (u === 'forfoll') {
      f.forfoll++
      f.forfallna.push(d)
      if (d.forfoll_at) {
        const t = dygnMellan(d.skickad_at, d.forfoll_at)
        if (t >= 0) tFor.push(t)
      }
    } else if (u === 'raderad') f.raderades++
    else f.annat++
  }
  f.medianSignerad = median(tSig)
  f.medianForfoll = median(tFor)
  f.forfallna.sort((a, b) => (b.forfoll_at ?? b.skickad_at).localeCompare(a.forfoll_at ?? a.skickad_at))
  return f
}

// ─── Text ───

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

export function typOrd(typ: DokTyp, antal: number): string {
  if (typ === 'offer') return antal === 1 ? 'offert' : 'offerter'
  return 'avtal'
}

export const typOrdBest = (typ: DokTyp) => (typ === 'offer' ? 'offerterna' : 'avtalen')

/** Tid i klartext med komma som decimal: "5 timmar", "1 dag", "1,2 dagar" */
export function tidText(dygn: number | null): string {
  if (dygn === null) return ''
  if (dygn < 1) {
    const h = Math.max(1, Math.round(dygn * 24))
    return h === 1 ? '1 timme' : `${h} timmar`
  }
  const v = Math.round(dygn * 10) / 10
  if (v === 1) return '1 dag'
  return `${String(v).replace('.', ',')} dagar`
}

/** "kortare", "längre" eller "lika" mellan två medianer (inom 10 % räknas som lika) */
export function trend(nu: number | null, fore: number | null): 'kortare' | 'langre' | 'lika' | null {
  if (nu === null || fore === null) return null
  if (fore === 0 && nu === 0) return 'lika'
  const diff = nu - fore
  if (Math.abs(diff) <= Math.max(0.1 * fore, 2 / 24)) return 'lika'
  return diff < 0 ? 'kortare' : 'langre'
}

// ─── Vad siffrorna säger, regelstyrda meningar ───

export interface Insikt {
  ton: 'bra' | 'tips' | 'info'
  fet: string
  text: string
  lankar?: KundresaDok[]
}

export function insikter(typ: DokTyp, nu: Flode, fore: Flode, per: Perioder): Insikt[] {
  const ut: Insikt[] = []
  const ord = (n: number) => typOrd(typ, n)
  const kanJamfora = per.jamforelse !== 'ingen'
    && nu.skickade >= MINSTA_FOR_JAMFORELSE
    && fore.skickade >= MINSTA_FOR_JAMFORELSE

  if (kanJamfora) {
    const a = pct(nu.signerade, nu.skickade)
    const b = pct(fore.signerade, fore.skickade)
    const ton = a >= b ? 'bra' : 'info'
    const vantar = nu.vantar > 0 ? ` ${nu.vantar} väntar fortfarande på svar och kan ännu signeras.` : ''
    ut.push({
      ton,
      fet: `${nu.signerade} av ${nu.skickade} ${ord(nu.skickade)} signerades, ${a} %.`,
      text: `Perioden före signerades ${fore.signerade} av ${fore.skickade}, ${b} %.${vantar}`,
    })
    if (nu.medianSignerad !== null && fore.medianSignerad !== null && nu.signerade >= 2 && fore.signerade >= 2) {
      const t = trend(nu.medianSignerad, fore.medianSignerad)
      const fet = t === 'kortare' ? 'Kunderna signerar snabbare.' : t === 'langre' ? 'Kunderna tar längre tid på sig.' : 'Kunderna signerar lika snabbt som förut.'
      ut.push({
        ton: t === 'langre' ? 'info' : 'bra',
        fet,
        text: `Hälften av de signerade signerades inom ${tidText(nu.medianSignerad)} efter att du skickat dem, och ${nu.inom3} av ${nu.signerade} inom 3 dagar. Perioden före tog hälften ${tidText(fore.medianSignerad)}.`,
      })
    }
  } else if (nu.signerade > 0 && nu.medianSignerad !== null) {
    ut.push({
      ton: 'bra',
      fet: `${nu.signerade} av ${nu.skickade} ${ord(nu.skickade)} signerades, ${pct(nu.signerade, nu.skickade)} %.`,
      text: `Hälften av de signerade signerades inom ${tidText(nu.medianSignerad)} efter att du skickat dem, och ${nu.inom3} av ${nu.signerade} inom 3 dagar.`,
    })
  }

  if (nu.forfoll > 0) {
    const snabba = nu.signerade > 0 && nu.inom3 / nu.signerade >= 0.5
    ut.push({
      ton: 'tips',
      fet: `${nu.forfoll} ${ord(nu.forfoll)} förföll när fristen gick ut.`,
      text: snabba
        ? 'De flesta som signerar gör det inom 3 dagar. Har kunden inte signerat då är det ett bra läge att ringa.'
        : 'Har kunden inte signerat efter några dagar är det ett bra läge att ringa.',
      lankar: nu.forfallna.slice(0, 3),
    })
  }
  return ut
}

/** Varför jämförelsen saknas, eller null om den finns */
export function utanJamforelse(nu: Flode, fore: Flode, per: Perioder): string | null {
  if (per.jamforelse === 'ingen') {
    return `Ingen jämförelse än. Perioden före ligger före ${ARKIVGRANS}, då portalen tog över, och de dokumenten räknas inte.`
  }
  if (nu.skickade < MINSTA_FOR_JAMFORELSE || fore.skickade < MINSTA_FOR_JAMFORELSE) {
    return `Ingen jämförelse än. Den skrivs när båda perioderna har minst ${MINSTA_FOR_JAMFORELSE} dokument (nu ${nu.skickade}, perioden före ${fore.skickade}).`
  }
  return null
}

// ─── Just nu i din resa ───

export interface JustNuRad {
  dok: KundresaDok
  steg: string
  ton: Ton
  status: string
  nasta: string
  /** Dagar sedan händelsen */
  dagar: number
}

export function justNu(dok: KundresaDok[], idag: string = svenskDag()): JustNuRad[] {
  const vantar: JustNuRad[] = []
  const forfallna: JustNuRad[] = []
  const signerade: JustNuRad[] = []
  for (const d of dok) {
    const u = utfall(d)
    const skickad = svDatum(d.skickad_at)
    if (u === 'vantar') {
      const frist = d.signing_deadline
      const kvar = frist ? dagarMellan(idag, frist) : null
      vantar.push({
        dok: d,
        steg: 'Väntar på svar',
        ton: kvar !== null && kvar <= 3 ? 'gul' : 'bla',
        status: frist
          ? kvar !== null && kvar < 0 ? `Fristen gick ut ${frist}` : `Skickad ${skickad}, fristen går ut ${frist}`
          : `Skickad ${skickad}, ingen frist satt`,
        nasta: kvar !== null && kvar <= 3 ? 'Ring kunden före fristen' : 'Ring om kunden inte signerat inom 3 dagar',
        dagar: dagarMellan(skickad, idag),
      })
    } else if (u === 'forfoll') {
      const nar = svDatum(d.forfoll_at ?? d.signing_deadline ?? d.skickad_at)
      const dagar = dagarMellan(nar, idag)
      if (dagar > 30) continue
      forfallna.push({
        dok: d,
        steg: 'Förföll',
        ton: 'gra',
        status: `Fristen gick ut ${nar}`,
        nasta: d.typ === 'offer' ? 'Fråga om kunden vill ha en ny offert' : 'Fråga om kunden vill ha ett nytt avtal',
        dagar,
      })
    } else if (u === 'signerad') {
      const nar = svDatum(d.signerad_at)
      const dagar = dagarMellan(nar, idag)
      const bokadDag = d.bokad_start ? svDatum(d.bokad_start) : null
      // Signerade visas i 30 dagar, eller tills det bokade besöket har varit
      if (dagar > 30 && !(bokadDag && bokadDag >= idag)) continue
      if (d.booked_case_id) {
        signerade.push({
          dok: d,
          steg: 'Signerad',
          ton: 'gron',
          status: bokadDag ? `Bokad till ${bokadDag} kl ${svTid(d.bokad_start)}` : 'Bokad, tid saknas än',
          nasta: bokadDag && bokadDag < idag ? 'Besöket har varit' : 'Besöket är bokat',
          dagar,
        })
      } else {
        signerade.push({
          dok: d,
          steg: 'Signerad',
          ton: 'gra',
          status: 'Ingen bokning kopplad än',
          nasta: d.typ === 'offer' ? 'Kontoret bokar in, inget för dig' : 'Kontoret lägger upp avtalet, inget för dig',
          dagar,
        })
      }
    }
  }
  vantar.sort((a, b) => (a.dok.signing_deadline ?? '9999').localeCompare(b.dok.signing_deadline ?? '9999'))
  forfallna.sort((a, b) => a.dagar - b.dagar)
  signerade.sort((a, b) => a.dagar - b.dagar)
  return [...vantar, ...forfallna, ...signerade]
}

export const dokLank = (id: string) => `/technician/dokumentsignering?id=${encodeURIComponent(id)}`
