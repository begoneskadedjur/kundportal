// src/components/technician/ny/provision/provisionData.ts
// Data och klartext för teknikerns provisionssida i nya arbetsvyn (NyProvision).
//
// Inga egna provisionsberäkningar. Allt belopp kommer från commission_posts via
// ProvisionService (samma anrop som gamla TechnicianCommissions), och
// utbetalningsmånaden från utils/provisionPayout (groupPostsByPayoutMonth,
// getPostPayoutMonth, monthlyEarnedSeries), samma funktioner som adminvyn och
// gamla teknikervyn använder. Här finns bara gruppering per månad, summering av
// postbeloppen och texterna.
//
// Skillnad mot gamla sidan: posterna hämtas från första dagen 12 månader bakåt
// (gamla sidan: från 1 januari i år), så att 12-månadersdiagrammet visar riktiga
// värden även i början av året. Beloppen per post är desamma.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ProvisionService } from '../../../../services/provisionService'
import { svenskDag } from '../../../../services/teknikerDagService'
import type { CommissionPost, CommissionSettings, CommissionStatus } from '../../../../types/provision'
import {
  DEFAULT_PAYOUT_CUTOFF_DAY,
  UNPAID_AGE_WARNING_DAYS,
  computePreliminaryPayoutMonth,
  daysSince,
  getPostPayoutMonth,
  payoutSalaryLabel,
} from '../../../../utils/provisionPayout'
import type { IconName } from '../../../icons/Icon'
import type { Ton } from '../besokTyp'
import type { ArendeRef } from '../OppnaArende'

const MANADER = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Hårt mellanslag, så att belopp och enhet inte bryts isär */
export const NBSP = String.fromCharCode(160)

/** 'YYYY-MM' för ett datum, samma nyckling som monthlyEarnedSeries (lokal tid) */
export function skapandeManad(datum: string): string {
  const d = new Date(datum)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function manadNyckel(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function flyttaManad(nyckel: string, steg: number): string {
  const [ar, man] = nyckel.split('-').map(Number)
  return manadNyckel(new Date(ar, man - 1 + steg, 1))
}

/** 'YYYY-MM' -> 'oktober' (med år om det inte är innevarande år) */
export function manadNamn(nyckel: string, nu: Date, medAr = false): string {
  const [ar, man] = nyckel.split('-').map(Number)
  const namn = MANADER[(man || 1) - 1] ?? nyckel
  return medAr || ar !== nu.getFullYear() ? `${namn} ${ar}` : namn
}

/** ÅÅÅÅ-MM-DD i svensk tid för en tidsstämpel (timestamptz), aldrig rå UTC-slice */
export function dagFor(tidsstampel: string): string {
  const d = new Date(tidsstampel)
  return Number.isNaN(d.getTime()) ? tidsstampel.slice(0, 10) : svenskDag(d)
}

export function versal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Belopp i hela kronor med mellanslag, samma avrundning som formatCurrency */
export function kr(belopp: number): string {
  const avrundat = Math.round(belopp)
  const text = Math.abs(avrundat).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${avrundat < 0 ? '-' : ''}${text}${NBSP}kr`
}

/** Procent med komma som decimaltecken, utan onödiga nollor */
export function procent(v: number): string {
  return `${Number(v.toFixed(2)).toString().replace('.', ',')}${NBSP}%`
}

/** 'novemberlönen' eller 'novemberlönen och decemberlönen' */
export function lonerText(manader: string[]): string {
  const unika = Array.from(new Set(manader)).sort()
  const namn = unika.map(payoutSalaryLabel)
  if (namn.length <= 1) return namn[0] ?? ''
  return `${namn.slice(0, -1).join(', ')} och ${namn[namn.length - 1]}`
}

/**
 * Utbetalningsregeln i en mening med den här månadens exempel. Månaderna räknas
 * med computePreliminaryPayoutMonth, som speglar DB-funktionen compute_payout_month:
 * betald senast brytdagen ger nästa månads lön, betald senare lönen månaden därpå.
 */
export function utbetalningsRegel(cutoff: number, nu: Date): string {
  const fore = computePreliminaryPayoutMonth(new Date(nu.getFullYear(), nu.getMonth(), cutoff), cutoff)
  const efter = computePreliminaryPayoutMonth(new Date(nu.getFullYear(), nu.getMonth(), cutoff + 1), cutoff)
  const dag = (d: number) => `${manadNyckel(nu)}-${pad2(d)}`
  const regel = `Provisionen betalas ut med lönen när kunden har betalat fakturan. Betalar kunden senast den ${cutoff} i månaden kommer den med nästa månads lön, annars med lönen månaden efter.`
  if (cutoff >= 28) return regel
  return `${regel} Betald ${dag(cutoff)} ger ${payoutSalaryLabel(fore)}, betald ${dag(cutoff + 1)} ger ${payoutSalaryLabel(efter)}.`
}

// ─── Status ─────────────────────────────────────────────────────

export interface StatusInfo {
  ton: Ton
  rubrik: string
  /** Kort rad om vad som händer härnäst för just den här posten */
  detalj: string
  /** Obetald längre än UNPAID_AGE_WARNING_DAYS */
  gammal: boolean
}

/** Förklaringarna i hjälpdelen, i flödets ordning */
export const STATUS_FORKLARING: Array<{ status: CommissionStatus; ton: Ton; rubrik: string; text: string }> = [
  {
    status: 'pending_invoice',
    ton: 'gul',
    rubrik: 'Väntar på kundens betalning',
    text: 'Ärendet är avslutat och provisionen är registrerad. Den blir klar för utbetalning av sig själv när kunden har betalat fakturan.',
  },
  {
    status: 'ready_for_payout',
    ton: 'bla',
    rubrik: 'Klar för utbetalning',
    text: 'Kunden har betalat. Posten ligger på en lönemånad och väntar på att löneadministratören godkänner den.',
  },
  {
    status: 'approved',
    ton: 'gron',
    rubrik: 'Godkänd för lön',
    text: 'Löneadministratören har godkänt posten. Den betalas ut med lönen som står på raden.',
  },
  {
    status: 'paid_out',
    ton: 'gra',
    rubrik: 'Utbetald',
    text: 'Provisionen är betald med lönen.',
  },
]

const STATUS_TON: Record<CommissionStatus, Ton> = {
  pending_invoice: 'gul',
  ready_for_payout: 'bla',
  approved: 'gron',
  paid_out: 'gra',
}

const STATUS_RUBRIK: Record<CommissionStatus, string> = {
  pending_invoice: 'Väntar på kundens betalning',
  ready_for_payout: 'Klar för utbetalning',
  approved: 'Godkänd för lön',
  paid_out: 'Utbetald',
}

export function statusInfo(post: CommissionPost, cutoff: number, nu: Date): StatusInfo {
  const { month } = getPostPayoutMonth(post, cutoff, nu)
  const ton = STATUS_TON[post.status]
  const rubrik = STATUS_RUBRIK[post.status]
  switch (post.status) {
    case 'pending_invoice': {
      const dagar = daysSince(post.created_at, nu)
      return {
        ton,
        rubrik,
        detalj: dagar === 0 ? 'Registrerad idag' : `Registrerad för ${dagar} ${dagar === 1 ? 'dag' : 'dagar'} sedan`,
        gammal: dagar > UNPAID_AGE_WARNING_DAYS,
      }
    }
    case 'ready_for_payout':
      return {
        ton,
        rubrik,
        detalj: post.invoice_paid_date
          ? `Kunden betalade ${post.invoice_paid_date.slice(0, 10)}, kommer med ${payoutSalaryLabel(month)}`
          : `Kommer med ${payoutSalaryLabel(month)}`,
        gammal: false,
      }
    case 'approved':
      return { ton, rubrik, detalj: `Betalas ut med ${payoutSalaryLabel(month)}`, gammal: false }
    case 'paid_out':
      return {
        ton,
        rubrik,
        detalj: `Med ${payoutSalaryLabel(post.payout_month || month)}${post.paid_out_at ? `, ${dagFor(post.paid_out_at)}` : ''}`,
        gammal: false,
      }
  }
}

// ─── Typ av post ────────────────────────────────────────────────

export function postTyp(post: CommissionPost): { ikon: IconName; text: string } {
  if (post.commission_type === 'tipsbonus' || post.case_type === 'lead') return { ikon: 'lead.tips', text: 'Tipsbonus' }
  if (post.case_type === 'private') return { ikon: 'arende.privat', text: 'Privatperson' }
  if (post.case_type === 'business') return { ikon: 'allman.foretag', text: 'Företag' }
  return { ikon: 'kund.avtal', text: 'Avtalskund' }
}

/** Ärendet som posten hör till, om det går att öppna (tipsbonus pekar på en lead) */
export function arendeFor(post: CommissionPost): ArendeRef | null {
  if (!post.case_id) return null
  if (post.case_type === 'private') return { kalla: 'private', id: post.case_id }
  if (post.case_type === 'business') return { kalla: 'business', id: post.case_id }
  if (post.case_type === 'contract') return { kalla: 'cases', id: post.case_id }
  return null
}

/** BE-numret: case_number, annars case_title när den är ett ärendenummer */
export function arendeNummer(post: CommissionPost, uppslag?: ArendeUppslag): string | null {
  if (post.case_number) return post.case_number
  if (uppslag?.nummer) return uppslag.nummer
  if (post.case_title && /^BE-\d+/i.test(post.case_title)) return post.case_title
  return null
}

// ─── Summering per period ───────────────────────────────────────

export interface Summa {
  totalt: number
  vantar: number
  klar: number
  godkand: number
  utbetald: number
  arenden: number
  poster: number
}

/** Summerar postbeloppen per status, inga omräkningar */
export function summera(poster: CommissionPost[]): Summa {
  const s: Summa = { totalt: 0, vantar: 0, klar: 0, godkand: 0, utbetald: 0, arenden: 0, poster: poster.length }
  const arenden = new Set<string>()
  for (const p of poster) {
    s.totalt += p.commission_amount
    if (p.status === 'pending_invoice') s.vantar += p.commission_amount
    else if (p.status === 'ready_for_payout') s.klar += p.commission_amount
    else if (p.status === 'approved') s.godkand += p.commission_amount
    else if (p.status === 'paid_out') s.utbetald += p.commission_amount
    arenden.add(p.case_id || p.id)
  }
  s.arenden = arenden.size
  return s
}

// ─── Hämtning ───────────────────────────────────────────────────

export interface ArendeUppslag {
  kund: string | null
  nummer: string | null
}

/** Kundnamn och ärendenummer för posterna. Bara visning, misslyckas tyst. */
async function hamtaUppslag(poster: CommissionPost[]): Promise<Map<string, ArendeUppslag>> {
  const ut = new Map<string, ArendeUppslag>()
  const ids = (typ: CommissionPost['case_type']) =>
    Array.from(new Set(poster.filter(p => p.case_type === typ && p.case_id).map(p => p.case_id)))
  const avtal = ids('contract')
  const privat = ids('private')
  const foretag = ids('business')

  const [a, p, f] = await Promise.all([
    avtal.length
      ? supabase.from('cases').select('id, case_number, title, customer:customers(company_name)').in('id', avtal)
      : Promise.resolve({ data: [], error: null }),
    privat.length
      ? supabase.from('private_cases').select('id, case_number, title, kontaktperson').in('id', privat)
      : Promise.resolve({ data: [], error: null }),
    foretag.length
      ? supabase.from('business_cases').select('id, case_number, title, company_name, bestallare').in('id', foretag)
      : Promise.resolve({ data: [], error: null }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rader = (r: { data: any; error: unknown }) => (r.error ? [] : ((r.data ?? []) as any[]))
  for (const r of rader(a)) {
    const kund = Array.isArray(r.customer) ? r.customer[0]?.company_name : r.customer?.company_name
    ut.set(r.id, { kund: kund || r.title || null, nummer: r.case_number || null })
  }
  for (const r of rader(p)) ut.set(r.id, { kund: r.kontaktperson || r.title || null, nummer: r.case_number || null })
  for (const r of rader(f)) ut.set(r.id, { kund: r.company_name || r.bestallare || r.title || null, nummer: r.case_number || null })
  return ut
}

export interface MinProvision {
  poster: CommissionPost[]
  settings: CommissionSettings | null
  cutoff: number
  uppslag: Map<string, ArendeUppslag>
  laddar: boolean
  fel: string | null
  ladda: () => Promise<void>
}

export function useMinProvision(technicianId: string | null | undefined, nu: Date): MinProvision {
  const [poster, setPoster] = useState<CommissionPost[]>([])
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [uppslag, setUppslag] = useState<Map<string, ArendeUppslag>>(new Map())
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)

  const franDatum = (() => {
    const d = new Date(nu.getFullYear(), nu.getMonth() - 12, 1)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
  })()

  const ladda = useCallback(async () => {
    if (!technicianId) return
    setLaddar(true)
    setFel(null)
    try {
      const [alla, inst] = await Promise.all([
        ProvisionService.getPostsForTechnician(technicianId, franDatum),
        ProvisionService.getSettings(),
      ])
      // Databasen låter teknikern läsa kollegornas andelar på gemensamma ärenden,
      // så bara egna poster visas (samma filter som gamla sidan)
      const egna = alla.filter(p => p.technician_id === technicianId)
      setPoster(egna)
      setSettings(inst)
      hamtaUppslag(egna).then(setUppslag).catch(() => setUppslag(new Map()))
    } catch (e) {
      console.error('[NyProvision] Kunde inte hämta provisionen', e)
      setFel(e instanceof Error ? e.message : 'Kunde inte hämta provisionen')
    } finally {
      setLaddar(false)
    }
  }, [technicianId, franDatum])

  useEffect(() => {
    ladda()
  }, [ladda])

  return {
    poster,
    settings,
    // Samma reserv som gamla sidan när inställningen saknas
    cutoff: settings?.payout_cutoff_day || DEFAULT_PAYOUT_CUTOFF_DAY,
    uppslag,
    laddar,
    fel,
    ladda,
  }
}
