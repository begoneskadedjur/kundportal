// src/components/admin/procurement/uiFormat.ts
// Format och stilkonstanter för upphandlingsportalen (utbrutna ur ui.tsx så att
// komponentfilen bara exporterar komponenter, för Reacts fast refresh).
// Svenska format: datum ÅÅÅÅ-MM-DD i svensk tid, komma som decimal,
// mellanslag som tusentalsavgränsare.

import { swedishDate, todaySwedish, daysBetweenIso } from '../../../shared/procurementRules'

// Format

const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 })

/** 1 234 567 kr. Null blir ett streck. */
export function fmtKr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '–'
  return `${nf0.format(Math.round(Number(n)))} kr`
}

/** 3,5 Mkr / 820 tkr / 900 kr */
export function fmtKrShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '–'
  const v = Number(n)
  if (Math.abs(v) >= 1_000_000) return `${nf1.format(v / 1_000_000)} Mkr`
  if (Math.abs(v) >= 10_000) return `${nf0.format(v / 1000)} tkr`
  return `${nf0.format(v)} kr`
}

export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(Number(n))) return '–'
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(Number(n))
}

/** 33 % (heltal) från en andel 0..1 */
export function fmtPct(share: number | null | undefined, decimals = 0): string {
  if (share == null || !Number.isFinite(Number(share))) return '–'
  return `${fmtNum(Number(share) * 100, decimals)} %`
}

/** ÅÅÅÅ-MM-DD i svensk tid, eller streck */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '–'
  // Rena datum (ÅÅÅÅ-MM-DD) visas som de är, tider räknas om till svensk tid
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return swedishDate(value) ?? '–'
}

/** ÅÅÅÅ-MM-DD HH:MM i svensk tid */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '–'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '–'
  const time = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).format(d)
  return `${swedishDate(d)} ${time}`
}

/** Dagar kvar till ett datum (negativt om passerat), räknat i svensk tid */
export function daysUntil(value: string | null | undefined): number | null {
  const d = value ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : swedishDate(value)) : null
  if (!d) return null
  return daysBetweenIso(todaySwedish(), d)
}

/** "om 5 dagar", "i dag", "för 3 dagar sedan" */
export function fmtRelativeDays(value: string | null | undefined): string {
  const n = daysUntil(value)
  if (n == null) return ''
  if (n === 0) return 'i dag'
  if (n === 1) return 'i morgon'
  if (n > 0) return `om ${n} dagar`
  if (n === -1) return 'i går'
  return `för ${-n} dagar sedan`
}

// ---------------------------------------------------------------------------
// Byggstenar

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'muted'

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-slate-100',
  good: 'text-[#20c58f]',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  info: 'text-sky-400',
  muted: 'text-slate-500',
}

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  good: 'bg-[#20c58f]',
  warn: 'bg-amber-400',
  bad: 'bg-red-400',
  info: 'bg-sky-400',
  muted: 'bg-slate-600',
}

/** Tabellklasser: 12 till 13 px, tabular-nums, tunna radavdelare */
export const tableCls = {
  table: 'w-full text-[12.5px] tabular-nums',
  thead: 'text-[10px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-800',
  th: 'px-3 py-2 text-left font-medium whitespace-nowrap',
  thRight: 'px-3 py-2 text-right font-medium whitespace-nowrap',
  tr: 'border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30 transition-colors',
  td: 'px-3 py-2 text-slate-300 align-top',
  tdRight: 'px-3 py-2 text-slate-300 text-right align-top whitespace-nowrap',
}

/** Diagramfärger: en färg per serie, brandgrönt först. Fungerar i ljust och mörkt läge. */
export const SERIES_COLORS = ['#20c58f', '#38bdf8', '#f59e0b', '#a78bfa', '#f472b6', '#94a3b8']
