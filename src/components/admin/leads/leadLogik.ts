// src/components/admin/leads/leadLogik.ts
// Leads (B2B): filter i adressen, flikar, grupperingen i Att göra och format.
// Parametrar: flik (att-gora | pagaende | nya-tips | alla), q, agare (mina | alla | profil-id), kalla, status.
// id öppnar en lead och hör inte till filtret.

import type { Lead } from '../../../types/database'
import { KALLA_ETIKETT, STAGE_ETIKETT, URSPRUNG_ETIKETT, arOppen, type LeadSource, type LeadStage } from '../../../types/leads'
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'
import { formatSvTid, svDatum } from '../webLeads/format'

export type Flik = 'att-gora' | 'pagaende' | 'nya-tips' | 'alla'
export const FLIKAR: Flik[] = ['att-gora', 'pagaende', 'nya-tips', 'alla']

export interface LeadsFilter {
  q: string
  /** 'mina' (standard), 'alla' eller en profils id */
  agare: string
  kalla: LeadSource | ''
  /** '' = alla (i Alla) eller alla öppna (övriga flikar), 'oppna' eller ett steg */
  status: LeadStage | 'oppna' | ''
}

export const FILTER_NYCKLAR = ['q', 'agare', 'kalla', 'status'] as const
export type FilterNyckel = (typeof FILTER_NYCKLAR)[number]

export function lasFlik(p: URLSearchParams): Flik {
  const f = p.get('flik')
  return f && (FLIKAR as string[]).includes(f) ? (f as Flik) : 'att-gora'
}

export function lasFilter(p: URLSearchParams): LeadsFilter {
  const kalla = p.get('kalla') ?? ''
  const status = p.get('status') ?? ''
  return {
    q: p.get('q') ?? '',
    agare: p.get('agare') || 'mina',
    kalla: kalla in KALLA_ETIKETT ? (kalla as LeadSource) : '',
    status: status === 'oppna' || status in STAGE_ETIKETT ? (status as LeadStage | 'oppna') : '',
  }
}

export interface Mig {
  profilId: string | null
  /** Lead-id där jag är delad medlem */
  delade: Set<string>
}

export const arMin = (l: Lead, mig: Mig) =>
  !!mig.profilId && (l.owner_profile_id === mig.profilId || l.tipped_by_profile_id === mig.profilId || mig.delade.has(l.id))

function siffror(s: string | null | undefined) {
  return (s ?? '').replace(/\D/g, '')
}

export function matcharSok(l: Lead, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  const text = [l.company_name, l.contact_person, l.email, l.organization_number, l.address, l.next_action, l.contract_with]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (text.includes(t)) return true
  const s = siffror(t)
  if (s.length >= 3) {
    const tel = l.phone_norm ?? siffror(l.phone_number)
    const sNat = s.startsWith('46') ? `0${s.slice(2)}` : s
    if (tel.includes(sNat) || (l.org_nr_norm ?? '').includes(s)) return true
  }
  return false
}

/** Nya tips: utan ägare, eller steg ny med en tipsare. */
export const arNyttTips = (l: Lead) => arOppen(l.stage) && (!l.owner_profile_id || (l.stage === 'ny' && !!l.tipped_by_profile_id))

export function filtrera(rader: Lead[], f: LeadsFilter, flik: Flik, mig: Mig): Lead[] {
  return rader.filter((l) => {
    if (flik !== 'nya-tips') {
      if (f.agare === 'mina' && !arMin(l, mig)) return false
      if (f.agare !== 'mina' && f.agare !== 'alla' && l.owner_profile_id !== f.agare) return false
    }
    if (flik === 'pagaende' || flik === 'att-gora') {
      if (!arOppen(l.stage)) return false
    }
    if (flik === 'nya-tips' && !arNyttTips(l)) return false
    if (f.status === 'oppna' && !arOppen(l.stage)) return false
    if (f.status && f.status !== 'oppna' && l.stage !== f.status) return false
    if (f.kalla && l.source !== f.kalla) return false
    return matcharSok(l, f.q)
  })
}

// ---------------------------------------------------------------------------
// Att göra: grupper
// ---------------------------------------------------------------------------
export type Grupp = 'forsenade' | 'idag' | 'saknar' | 'vaknar'
export const GRUPP_ETIKETT: Record<Grupp, string> = {
  forsenade: 'Försenade',
  idag: 'I dag',
  saknar: 'Saknar nästa steg',
  vaknar: 'Parkerade som vaknar i dag',
}
export const GRUPP_ORDNING: Grupp[] = ['forsenade', 'idag', 'saknar', 'vaknar']

export function idagSv(): string {
  return svDatum(new Date())
}

export function gruppFor(l: Lead, idag = idagSv()): Grupp | null {
  if (!arOppen(l.stage)) return null
  if (l.stage === 'parkerad') return l.parked_until && l.parked_until <= idag ? 'vaknar' : null
  if (!l.next_action_at) return 'saknar'
  const dag = svDatum(l.next_action_at)
  if (dag < idag) return 'forsenade'
  if (dag === idag) return 'idag'
  return null
}

export function arForsenad(l: Lead, idag = idagSv()): boolean {
  return arOppen(l.stage) && l.stage !== 'parkerad' && !!l.next_action_at && svDatum(l.next_action_at) < idag
}

/** Sortering på nästa steg: tidigast först, utan datum sist. */
export function sorteraNasta(a: Lead, b: Lead): number {
  if (a.next_action_at && b.next_action_at) return a.next_action_at.localeCompare(b.next_action_at)
  if (a.next_action_at) return -1
  if (b.next_action_at) return 1
  return b.created_at.localeCompare(a.created_at)
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------
const KR = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })

export function kr(v: number | null | undefined): string {
  if (v == null) return ''
  return `${KR.format(v)} kr`
}

/** "I dag 13:00", "2026-10-08 · 2 dagar sen", "I morgon" osv. */
export function nastaStegDatum(iso: string | null, idag = idagSv()): { text: string; sen: boolean } {
  if (!iso) return { text: '', sen: false }
  const dag = svDatum(iso)
  const tid = formatSvTid(iso).split(' ')[1] ?? ''
  const visaTid = tid && tid !== '00:00'
  if (dag === idag) return { text: `I dag${visaTid ? ` ${tid}` : ''}`, sen: false }
  const dagar = Math.round((Date.parse(`${idag}T12:00:00Z`) - Date.parse(`${dag}T12:00:00Z`)) / 86400000)
  if (dagar > 0) return { text: `${dag} · ${dagar === 1 ? '1 dag sen' : `${dagar} dagar sen`}`, sen: true }
  if (dagar === -1) return { text: `I morgon${visaTid ? ` ${tid}` : ''}`, sen: false }
  return { text: `${dag}${visaTid ? ` ${tid}` : ''}`, sen: false }
}

/** 'ÅÅÅÅ-MM-DDTHH:mm' (DateField withTime, lokal tid) till ISO med svensk offset. */
export function fransLokal(varde: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(varde)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 9, m[5] ? Number(m[5]) : 0)
  return toLocalISOStringWithOffset(d)
}

/** ISO från databasen till 'ÅÅÅÅ-MM-DDTHH:mm' i lokal tid för DateField withTime. */
export function tillLokal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Standardförslag för nästa steg: nästa vardag kl 09.00. */
export function forslagNastaDag(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`
}

export function initialer(namn: string): string {
  const delar = namn.trim().split(/\s+/).filter(Boolean)
  return ((delar[0]?.[0] ?? '') + (delar[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function fornamn(namn: string): string {
  return namn.trim().split(/\s+/)[0] ?? namn
}

/** Undertext under företaget: tipsare, ursprung eller källa. */
export function ursprungText(l: Lead, namnFor: (id: string | null) => string): string {
  const tipsare = l.tipped_by_profile_id ? namnFor(l.tipped_by_profile_id) : ''
  if (tipsare && l.origin_case_type) return `Tips från ${fornamn(tipsare)} · ${URSPRUNG_ETIKETT[l.origin_case_type]}`
  if (tipsare) return `Tips från ${fornamn(tipsare)}`
  if (l.origin_case_type) return `Från ${URSPRUNG_ETIKETT[l.origin_case_type]}`
  if (l.source) return KALLA_ETIKETT[l.source]
  return ''
}


// ---------------------------------------------------------------------------
// Klasser enligt modalstandarden (inget Card, sektioner p-3 bg-slate-800/30)
// ---------------------------------------------------------------------------
export const FALT =
  'w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'
export const DATUMFALT = `${FALT} pl-9`
export const ETIKETT = 'block text-xs font-medium text-slate-400 mb-1'
export const SEKTION = 'p-3 bg-slate-800/30 border border-slate-700 rounded-xl'
export const SEKTION_RUBRIK = 'text-sm font-semibold text-white flex items-center gap-1.5 mb-2'
/** Understrukna segmentval (inga piller). */
export function segment(aktiv: boolean): string {
  return `px-2.5 py-1 text-sm -mb-px border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
    aktiv ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
  }`
}

/** Rollens leadssida utifrån adressen (admin, koordinator, säljare och tekniker har alla /leads). */
export function leadsSidaFor(pathname: string): string {
  const bas = ['/admin', '/koordinator', '/saljare', '/technician'].find((b) => pathname === b || pathname.startsWith(`${b}/`)) ?? '/admin'
  return `${bas}/leads`
}
