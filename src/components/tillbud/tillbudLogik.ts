// src/components/tillbud/tillbudLogik.ts
// Logik för sidan Tillbud och avvikelser (IncidentsPage): typer och statusar som
// ton och ikon, svensk tid, grupperingar, bekräftelsetexter och CSV-exporten.

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { IconName } from '../icons/Icon'
import type { CaseIncident, IncidentStatus, IncidentType } from '../../types/caseIncidents'
import { INCIDENT_CATEGORY_CONFIG, INCIDENT_STATUS_CONFIG, INCIDENT_TYPE_CONFIG } from '../../types/caseIncidents'

export const SVENSK_TZ = 'Europe/Stockholm'

export type Ton = 'gul' | 'rod' | 'bla' | 'gron' | 'gra'

export interface Anstalld { id: string; name: string }

/** Ärendet en rapport kopplas till. typ = case_type i case_incidents. */
export interface KoppladArende {
  id: string
  typ: 'private' | 'business' | 'contract'
  kund: string
  nummer: string | null
  rad: string
}

export const TYP_IKON: Record<IncidentType, IconName> = {
  tillbud: 'tillbud.tillbud',
  olycka: 'tillbud.olycka',
  avvikelse: 'tillbud.avvikelse',
}

export const TYP_TON: Record<IncidentType, Ton> = { tillbud: 'gul', olycka: 'rod', avvikelse: 'bla' }

export const STATUS_TON: Record<IncidentStatus, Ton> = {
  ny: 'gul',
  under_utredning: 'bla',
  atgardad: 'gron',
  avslutad: 'gra',
}

export const TON_TEXT: Record<Ton, string> = {
  gul: 'text-amber-500',
  rod: 'text-red-400',
  bla: 'text-sky-400',
  gron: 'text-[#20c58f]',
  gra: 'text-slate-400',
}

export const TON_PUNKT: Record<Ton, string> = {
  gul: 'bg-amber-500',
  rod: 'bg-red-500',
  bla: 'bg-sky-500',
  gron: 'bg-[#20c58f]',
  gra: 'bg-slate-500',
}

export const TON_RAM: Record<Ton, string> = {
  gul: 'border-amber-500 bg-amber-500/10',
  rod: 'border-red-500 bg-red-500/10',
  bla: 'border-sky-500 bg-sky-500/10',
  gron: 'border-[#20c58f] bg-[#20c58f]/10',
  gra: 'border-slate-500 bg-slate-500/10',
}

/** Vad statusen betyder för den som rapporterat */
export const STATUS_FORKLARING: Record<IncidentStatus, string> = {
  ny: 'Mottagarna har fått rapporten men ingen har börjat utreda den än.',
  under_utredning: 'Någon utreder vad som hände och varför.',
  atgardad: 'En åtgärd är beslutad. Den följs upp innan rapporten avslutas.',
  avslutad: 'Åtgärden är genomförd och uppföljd. Rapporten är klar.',
}

export function typText(t: IncidentType): string {
  return INCIDENT_TYPE_CONFIG[t]?.label || t
}

export function statusText(s: IncidentStatus): string {
  return INCIDENT_STATUS_CONFIG[s]?.label || s
}

export function kategoriText(k: CaseIncident['category']): string {
  return k ? INCIDENT_CATEGORY_CONFIG[k]?.label || '' : ''
}

/** "Tillbudet är rapporterat", "Olyckan är rapporterad", "Avvikelsen är rapporterad" */
export function rapporteradText(t: IncidentType): string {
  if (t === 'tillbud') return 'Tillbudet är rapporterat'
  if (t === 'olycka') return 'Olyckan är rapporterad'
  return 'Avvikelsen är rapporterad'
}

// ─── Svensk tid ───

/** 2026-10-26 07:30 */
export function datumTid(iso: string | null | undefined): string {
  if (!iso) return ''
  return formatInTimeZone(new Date(iso), SVENSK_TZ, 'yyyy-MM-dd HH:mm')
}

/** 2026-10-26 */
export function datum(iso: string | null | undefined): string {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return formatInTimeZone(new Date(iso), SVENSK_TZ, 'yyyy-MM-dd')
}

/** Dagens datum i svensk tid, yyyy-MM-dd */
export function idagSvensk(): string {
  return formatInTimeZone(new Date(), SVENSK_TZ, 'yyyy-MM-dd')
}

/** Värde för <input type="datetime-local"> i svensk tid */
export function nuLokalt(d: Date = new Date()): string {
  return formatInTimeZone(d, SVENSK_TZ, "yyyy-MM-dd'T'HH:mm")
}

/** datetime-local i svensk tid till tidsstämpel med offset, för databasen */
export function lokaltTillTidsstampel(varde: string): string {
  const ogonblick = fromZonedTime(`${varde.length === 16 ? `${varde}:00` : varde}`, SVENSK_TZ)
  return formatInTimeZone(ogonblick, SVENSK_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

/** Nu som tidsstämpel med svensk offset */
export function nuTidsstampel(): string {
  return formatInTimeZone(new Date(), SVENSK_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

/** Midnatt en svensk dag (yyyy-MM-dd) som tidsstämpel med offset, för datumfilter */
export function svenskMidnatt(dag: string): string {
  return formatInTimeZone(fromZonedTime(`${dag}T00:00:00`, SVENSK_TZ), SVENSK_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

export function laggTillDag(dag: string, antal: number): string {
  const [y, m, d] = dag.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + antal, 12))
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`
}

// ─── Rapporterna ───

export function berordaNamn(i: CaseIncident): string {
  const namn = (i.incident_employees || []).map(e => e.technician_name).filter(Boolean)
  return namn.length > 0 ? namn.join(', ') : (i.technician_name || '')
}

/** Rapporten är min: jag har rapporterat den eller står som berörd */
export function arMin(i: CaseIncident, userId: string | null | undefined, technicianId: string | null | undefined): boolean {
  if (userId && i.reported_by_id === userId) return true
  if (!technicianId) return false
  if (i.technician_id === technicianId) return true
  return (i.incident_employees || []).some(e => e.technician_id === technicianId)
}

export function forsenad(i: CaseIncident): boolean {
  return !!i.due_date && i.status !== 'avslutad' && i.due_date < idagSvensk()
}

const STATUS_ORDNING: Record<string, number> = { ny: 0, under_utredning: 1, atgardad: 2, avslutad: 3 }

/** Nya överst, sedan senaste först */
export function sortera(lista: CaseIncident[]): CaseIncident[] {
  return [...lista].sort((a, b) => {
    const diff = (STATUS_ORDNING[a.status] ?? 9) - (STATUS_ORDNING[b.status] ?? 9)
    if (diff !== 0) return diff
    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  })
}

export function matcharSok(i: CaseIncident, sok: string): boolean {
  const q = sok.trim().toLowerCase()
  if (!q) return true
  return [i.description, i.technician_name, i.reported_by_name, i.action_taken, i.responsible_name, berordaNamn(i)]
    .some(v => (v || '').toLowerCase().includes(q))
}

// ─── CSV för Excel (ISO-revision) ───

export function exporteraCsv(rader: CaseIncident[]): void {
  const esc = (v: string | null | undefined) => `"${(v || '').replace(/"/g, '""')}"`
  const rows = rader.map(i => {
    const closed = i.status === 'avslutad' && i.closed_at
      ? `${datum(i.closed_at)} ${i.closed_by_name || ''}`.trim()
      : ''
    return [
      datum(i.occurred_at),
      typText(i.type),
      kategoriText(i.category),
      i.description,
      i.immediate_action,
      i.authority_report === 'ja' ? 'Ja' : i.authority_report === 'nej' ? 'Nej' : '',
      i.why_occurred,
      i.root_cause,
      i.action_taken,
      i.responsible_name,
      i.due_date ? datum(i.due_date) : '',
      i.follow_up,
      statusText(i.status),
      closed,
      i.reported_by_name,
      berordaNamn(i),
    ].map(v => esc(typeof v === 'string' ? v : v ?? '')).join(';')
  })
  const header = [
    'Inträffade', 'Typ av ärende', 'Miljö/Kvalitet/Arbetsmiljö', 'Vad har hänt?',
    'Vad har vi redan gjort?', 'Anmälan till anmalarbetsskada.se?',
    'Varför inträffade händelsen? (direkt orsak)', 'Grundorsak', 'Beslutad åtgärd',
    'Ansvarig', 'Klart till', 'Uppföljning, är åtgärden genomförd och tillräcklig?',
    'Status', 'Ärendet avslutat (datum + signatur)', 'Rapporterad av', 'Berörda anställda',
  ].map(esc).join(';')
  // BOM och semikolon så att svensk Excel öppnar filen rätt
  const blob = new Blob(['﻿' + header + '\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tillbud-avvikelser-${idagSvensk()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
