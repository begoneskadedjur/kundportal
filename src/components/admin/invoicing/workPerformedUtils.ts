// src/components/admin/invoicing/workPerformedUtils.ts
// Hjälpare för rutan Utfört arbete i fakturamodalen och dess läspanel (2026-10).

import type { IconName } from '../../icons/Icon'
import type { SpecialReportListItem } from '../../../types/specialReport'
import { datumAv, rapportStatus, uppraknad } from '../../shared/specialReports/specialReportUtils'

/** En arbetsrapport i läspanelen: ett besök eller ärendets egen rapport */
export interface ReportEntry {
  key: string
  label: string
  date: string | null
  technicians: string | null
  text: string
}

// Skadedjursnivå 0-4 och problembild 1-5, samma skala, färger och etiketter
// som VisitHistoryPanel. Punkt och text, aldrig piller.
export const pestLevelColors: Record<number, string> = {
  0: 'text-emerald-400',
  1: 'text-yellow-400',
  2: 'text-orange-400',
  3: 'text-red-400',
  4: 'text-red-300',
}

export const pestLevelLabels: Record<number, string> = {
  0: 'Ingen aktivitet',
  1: 'Låg',
  2: 'Medel',
  3: 'Hög',
  4: 'Kritisk',
}

export const problemRatingColors: Record<number, string> = {
  1: 'text-emerald-400',
  2: 'text-emerald-400',
  3: 'text-amber-400',
  4: 'text-red-400',
  5: 'text-red-300',
}

export const problemRatingLabels: Record<number, string> = {
  1: 'Utmärkt',
  2: 'Bra',
  3: 'OK',
  4: 'Allvarligt',
  5: 'Kritiskt',
}

/** Minuter som "Xh Ym" */
export function formatTimeSpent(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// Ärendets skadedjur är fritext ("Råttor", "Inspektion Gnagare", "Möss").
// Ordstammar per art; bara EN träffad art ger artens ikon, ingen eller flera
// (t.ex. "Råttor och möss") ger skalbaggen.
const PEST_PATTERNS: Array<[RegExp, IconName]> = [
  [/råtta|råttor|gnagare/, 'tjanst.rattor'],
  [/(^|[^a-zåäö])mus($|[^a-zåäö])|möss/, 'tjanst.moss'],
  [/fågel|fåglar|duva|duvor|kaja|kajor|mås|måsar/, 'tjanst.faglar'],
  [/geting|bålgeting/, 'tjanst.getingar'],
  [/vägglus|vägglöss/, 'tjanst.vaggloss'],
  [/silverfisk/, 'tjanst.silverfisk'],
  [/myra|myror|hästmyr|faraomyr/, 'tjanst.myror'],
  [/kackerlack/, 'tjanst.kackerlackor'],
  [/pälsänger/, 'tjanst.palsanger'],
  [/mjölbagge|mjölbaggar/, 'tjanst.mjolbaggar'],
  [/klädmal|pälsmal|(^|[^a-zåäö])mal($|[^a-zåäö])/, 'tjanst.mal'],
  [/fluga|flugor/, 'tjanst.flugor'],
  [/mögel/, 'tjanst.mogel'],
]

export function pestIcon(pestType: string | null | undefined): IconName {
  const text = (pestType ?? '').toLowerCase()
  if (!text.trim()) return 'falt.bugg'
  const hits = new Set<IconName>()
  for (const [re, icon] of PEST_PATTERNS) if (re.test(text)) hits.add(icon)
  return hits.size === 1 ? [...hits][0] : 'falt.bugg'
}

/** Första raden med text, för utdraget på rapportraden */
export function firstLine(text: string | null | undefined): string {
  return (text ?? '').split('\n').map(s => s.trim()).find(Boolean) ?? ''
}

export type DotTone = 'gron' | 'gra' | 'gul'

export const DOT_CLASS: Record<DotTone, string> = {
  gron: 'bg-[#20c58f]',
  gra: 'bg-slate-500',
  gul: 'bg-amber-400',
}

/** Statusraden för en specialrapport: skickad version, datum och mottagare */
export function specialReportStatus(r: SpecialReportListItem): { tone: DotTone; text: string } {
  if (r.last_sent_version == null || !r.last_sent_at) return { tone: 'gul', text: 'Inte skickad' }
  const till = r.last_sent_to.length > 0 ? ` till ${uppraknad(r.last_sent_to)}` : ''
  const text = `Version ${r.last_sent_version} skickad ${datumAv(r.last_sent_at)}${till}`
  if (rapportStatus(r) === 'pagar') return { tone: 'gul', text: `${text}, ändrad efter utskicket` }
  return { tone: 'gron', text }
}

/** Samma filnamn som servern ger (som CaseSpecialReportsSection) */
export function specialReportFilename(titel: string, version: number | null): string {
  const namn = titel.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Rapport'
  return `${namn}, version ${version ?? 1}.pdf`
}
