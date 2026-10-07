// src/components/admin/webLeads/leadFilter.ts
// Filtren i Leads (Webb) bor i adressen (useSearchParams) så att en länk öppnar samma urval.
// Parametrar: flik, q, status, tjanst, kundgrupp, kalla, tilldelad, fran, till, arkiv. id öppnar en
// förfrågan och hör inte till filtret.

import {
  KUNDGRUPP_LABEL,
  STATUS_CONFIG,
  type StaffProfile,
  type WebInquiry,
  type WebInquiryKundgrupp,
  type WebInquiryStatus,
} from '../../../types/webInquiry'
import { adressDelar } from '../../../shared/webLeadUppgifter'
import { svDatum } from './format'
import { KANAL_LABEL, TJANST_LABEL, kanalFor, tjanstNyckel, type Kanal } from './leadKlassning'
import type { TjanstIkon } from './WebLeadIcons'

export type Flik = 'inkorg' | 'alla' | 'statistik'

export interface LeadFilter {
  q: string
  status: WebInquiryStatus | ''
  tjanst: TjanstIkon | ''
  kundgrupp: WebInquiryKundgrupp | ''
  /** En kanal, eller 'artanalys' för förfrågningar från artanalysen. */
  kalla: Kanal | 'artanalys' | ''
  /** '' alla, 'mig', 'ingen' eller en profils id. */
  tilldelad: string
  fran: string
  till: string
  arkiv: boolean
}

export const FILTER_NYCKLAR = ['q', 'status', 'tjanst', 'kundgrupp', 'kalla', 'tilldelad', 'fran', 'till', 'arkiv'] as const

export function lasFlik(p: URLSearchParams): Flik {
  const f = p.get('flik')
  return f === 'alla' || f === 'statistik' ? f : 'inkorg'
}

const har = (o: object, k: string) => k !== '' && Object.prototype.hasOwnProperty.call(o, k)

export function lasFilter(p: URLSearchParams): LeadFilter {
  const status = p.get('status') ?? ''
  const tjanst = p.get('tjanst') ?? ''
  const kundgrupp = p.get('kundgrupp') ?? ''
  const kalla = p.get('kalla') ?? ''
  const datum = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
  return {
    q: p.get('q') ?? '',
    status: har(STATUS_CONFIG, status) ? (status as WebInquiryStatus) : '',
    tjanst: har(TJANST_LABEL, tjanst) ? (tjanst as TjanstIkon) : '',
    kundgrupp: har(KUNDGRUPP_LABEL, kundgrupp) ? (kundgrupp as WebInquiryKundgrupp) : '',
    kalla: kalla === 'artanalys' || har(KANAL_LABEL, kalla) ? (kalla as Kanal | 'artanalys') : '',
    tilldelad: p.get('tilldelad') ?? '',
    fran: datum(p.get('fran')),
    till: datum(p.get('till')),
    arkiv: p.get('arkiv') === '1',
  }
}

/** Ett aktivt filter som platt text i sammanfattningen, med parametern som rensar det. */
export interface AktivtFilter {
  nyckel: (typeof FILTER_NYCKLAR)[number]
  text: string
}

export function aktivaFilter(f: LeadFilter, flik: Flik, staff: StaffProfile[]): AktivtFilter[] {
  const ut: AktivtFilter[] = []
  if (f.q.trim()) ut.push({ nyckel: 'q', text: `Sök: ${f.q.trim()}` })
  if (f.status && flik !== 'inkorg') ut.push({ nyckel: 'status', text: `Status: ${STATUS_CONFIG[f.status].label}` })
  if (f.tjanst) ut.push({ nyckel: 'tjanst', text: `Tjänst: ${TJANST_LABEL[f.tjanst]}` })
  if (f.kundgrupp) ut.push({ nyckel: 'kundgrupp', text: `Kundgrupp: ${KUNDGRUPP_LABEL[f.kundgrupp]}` })
  if (f.kalla) ut.push({ nyckel: 'kalla', text: `Källa: ${f.kalla === 'artanalys' ? 'Artanalys' : KANAL_LABEL[f.kalla]}` })
  if (f.tilldelad) {
    const p = staff.find((s) => s.id === f.tilldelad)
    const namn = f.tilldelad === 'mig' ? 'mig' : f.tilldelad === 'ingen' ? 'ingen' : p ? p.display_name || p.email : 'okänd'
    ut.push({ nyckel: 'tilldelad', text: `Tilldelad: ${namn}` })
  }
  if (f.fran) ut.push({ nyckel: 'fran', text: `Från ${f.fran}` })
  if (f.till) ut.push({ nyckel: 'till', text: `Till ${f.till}` })
  if (f.arkiv) ut.push({ nyckel: 'arkiv', text: 'Visar arkiverade' })
  return ut
}

function siffror(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '')
}

/** Fritextsökning: namn, företag, telefon, e-post, ort, postnummer, förfrågans nummer och ärendenummer. */
export function matcharSok(i: WebInquiry, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  const text = [i.name, i.company_name, i.email, i.city, adressDelar(i).ort, i.rattad_ort, i.referens, i.arende_nummer, i.address]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (text.includes(t)) return true
  const s = siffror(t)
  if (s.length >= 3) {
    // Telefon i alla format: 070-123 45 67, +46701234567 och 0701234567 ger samma träff
    const tel = siffror(i.phone)
    const telNational = tel.startsWith('46') ? `0${tel.slice(2)}` : tel
    const sNational = s.startsWith('46') ? `0${s.slice(2)}` : s
    if (tel.includes(s) || telNational.includes(sNational)) return true
    if (siffror(i.postal_code).includes(s)) return true
  }
  return false
}

export function filtrera(rader: WebInquiry[], f: LeadFilter, flik: Flik, minProfilId: string | null): WebInquiry[] {
  return rader.filter((i) => {
    if (!f.arkiv && i.archived_at) return false
    if (flik === 'inkorg' && i.status !== 'ny') return false
    if (flik !== 'inkorg' && f.status && i.status !== f.status) return false
    if (f.tjanst && tjanstNyckel(i.pest_type) !== f.tjanst) return false
    if (f.kundgrupp && i.kundgrupp !== f.kundgrupp) return false
    if (f.kalla) {
      if (f.kalla === 'artanalys' ? i.kalla !== 'artanalys' : kanalFor(i).kanal !== f.kalla) return false
    }
    if (f.tilldelad) {
      if (f.tilldelad === 'ingen' ? !!i.tilldelad_till : f.tilldelad === 'mig' ? i.tilldelad_till !== minProfilId : i.tilldelad_till !== f.tilldelad) return false
    }
    if (f.fran || f.till) {
      const dag = svDatum(i.created_at)
      if (f.fran && dag < f.fran) return false
      if (f.till && dag > f.till) return false
    }
    return matcharSok(i, f.q)
  })
}

/** Inkorgen: akuta först, sedan äldst först. Alla: nyast först. */
export function sortera(rader: WebInquiry[], flik: Flik): WebInquiry[] {
  const kopia = [...rader]
  if (flik === 'inkorg') return kopia.sort((a, b) => Number(b.akut) - Number(a.akut) || a.created_at.localeCompare(b.created_at))
  return kopia.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

