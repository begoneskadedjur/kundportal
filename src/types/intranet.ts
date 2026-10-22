// src/types/intranet.ts
// Typer för Intranät: interna dokument med läs- och förståelsekvittens

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, ShieldCheck, HeartPulse, Leaf, FileText,
  MessageSquareText, ClipboardList, MapPin, AlertTriangle, Users,
  Calculator, Receipt, Wallet, CalendarPlus, CalendarDays, Repeat, PackagePlus, Search,
  Lightbulb, Handshake, Target, FileStack, Footprints, ReceiptText,
} from 'lucide-react'

// ─── Innehållsblock (jsonb i intranet_documents.content) ───

/** Länkkort i ett hopp-block. target = id på en rubrik i samma dokument */
export interface IntranetJumpItem {
  label: string
  description?: string
  target: string
}

export type IntranetBlock =
  /** id = stabilt ankare (#id) för länkar och hopp-block; annars avsnitt-<index> */
  | { type: 'h2'; text: string; id?: string }
  | { type: 'h3'; text: string; id?: string }
  /** Kort som hoppar till rubriker i dokumentet, t.ex. ett per roll */
  | { type: 'jump'; title?: string; items: IntranetJumpItem[] }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  /** Numrerade steg med visuell stegmarkering - för gör så här-instruktioner */
  | { type: 'steps'; items: string[] }
  | { type: 'callout'; variant: 'info' | 'warning' | 'success'; title?: string; text: string }
  | { type: 'motto'; text: string }
  | { type: 'chain'; title?: string; steps: string[]; labels?: string[] }
  /** Länk till ett annat intranätdokument (kort med titel + beskrivning) */
  | { type: 'link'; slug: string; label: string; description?: string }
  /** Interaktiv demo - component slås upp i registret i dokumentläsaren */
  | { type: 'interactive'; component: string; variant?: string }
  // ─── Guidemallen (2026-10-16): åtta delar i fast ordning, se GUIDE_DELAR ───
  // I text i mallens block blir [[Knappnamn]] en knapp och [[Knappnamn|ikon.namn]]
  // en knapp med portalens ikon.
  /** 1. Huvud: för vem, var i portalen, hur lång tid, vad som måste vara klart */
  | { type: 'intro'; roller: GuideRoll[]; var: string; tar: string; behover?: string; enhet: 'mobil' | 'dator' }
  /** 2. Kort svar: en till tre meningar */
  | { type: 'kortsvar'; text: string }
  /** 3. Gör så här: steg bredvid skärmen. modul = guidemodulens namn (standard: dokumentets slug) */
  | { type: 'visning'; steg: GuideSteg[]; modul?: string }
  /** 4. Blev det inte som du tänkt? */
  | { type: 'felsok'; items: { fraga: string; svar: string }[] }
  /** 5. Bra att veta: högst fem punkter */
  | { type: 'bra'; items: string[] }
  /** 6. Prova själv: övningen i guidemodulen */
  | { type: 'ovning'; uppdrag: string; modul?: string }
  /** 7. Kolla att du kan: två eller tre frågor */
  | { type: 'quiz'; fragor: GuideFraga[] }
  /** 8. Läs också och fråga */
  | { type: 'avslut'; lankar: { slug: string; label: string; description?: string }[]; fraga: string }

/** Rollerna i guidemallen, samma värden som audience_roles */
export type GuideRoll = 'technician' | 'koordinator' | 'admin' | 'säljare'

export interface GuideSteg {
  /** Vad man gör, en handling. [[Knapp]] blir en knapp. */
  text: string
  /** Vad man ser efteråt, så man vet att det gick rätt */
  ser?: string
}

export interface GuideFraga {
  fraga: string
  alternativ: string[]
  /** Index i alternativ för rätt svar */
  ratt: number
  forklaring: string
}

export type IntranetSection = 'obligatoriskt' | 'handbok'
export type IntranetCategory =
  | 'introduktion' | 'policy' | 'rutin' | 'guide'
  | 'kommunikation' | 'arenden' | 'utrustning' | 'sakerhet' | 'ekonomi'

export interface IntranetDocument {
  id: string
  slug: string
  title: string
  summary: string | null
  section: IntranetSection
  category: IntranetCategory
  content: IntranetBlock[]
  version: number
  requires_acknowledgement: boolean
  is_published: boolean
  sort_order: number
  source_updated_at: string | null
  created_at: string
  updated_at: string
  /** null = alla interna roller; annars synligt för dessa roller */
  audience_roles: string[] | null
  /** Specifikt utvalda användare (utöver rollerna, ELLER-logik) */
  audience_user_ids: string[] | null
}

export const AUDIENCE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'koordinator', label: 'Koordinator' },
  { value: 'technician', label: 'Tekniker' },
  { value: 'säljare', label: 'Säljare' },
]

/** Kort beskrivning av ett dokuments målgrupp, t.ex. för admin-knappen */
export function describeAudience(doc: Pick<IntranetDocument, 'audience_roles' | 'audience_user_ids'>): string {
  const roles = doc.audience_roles || []
  const users = doc.audience_user_ids || []
  if (roles.length === 0 && users.length === 0) return 'Alla roller'
  const parts: string[] = []
  if (roles.length > 0) {
    parts.push(roles.map(r => AUDIENCE_ROLE_OPTIONS.find(o => o.value === r)?.label || r).join(' + '))
  }
  if (users.length > 0) parts.push(`${users.length} utvalda`)
  return parts.join(' + ')
}

export interface IntranetAcknowledgement {
  id: string
  document_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  version: number
  acknowledged_at: string
}

/** En öppning av en guide i läsloggen (intranet_guide_views) */
export interface IntranetGuideView {
  id: string
  document_id: string
  user_id: string
  user_name: string | null
  version: number
  active_view: string | null
  opened_at: string
  last_seen_at: string
  active_seconds: number
  scroll_pct: number
  steps_total: number | null
  max_step: number
  exercise_started_at: string | null
  quiz_total: number | null
  quiz_answered: number
  quiz_correct: number
  quiz_first_correct: number
}

/** Läsloggen sammanställd per person och guide (RPC intranet_guide_stats) */
export interface IntranetGuideStat {
  user_id: string
  document_id: string
  opens: number
  first_opened_at: string
  last_opened_at: string
  active_seconds: number
  steps_total: number | null
  max_step: number
  exercise_started: boolean
  quiz_total: number | null
  quiz_best_correct: number
  quiz_best_first_correct: number
  max_scroll_pct: number
}

/** Dokument berikat med den inloggades kvittensstatus */
export interface IntranetDocumentWithStatus extends IntranetDocument {
  /** Kvittens för aktuell version (null = ej kvitterad) */
  currentAck: IntranetAcknowledgement | null
  /** Senaste kvittens oavsett version (för "dokumentet har uppdaterats"-banner) */
  latestAck: IntranetAcknowledgement | null
}

// ─── UI-konfiguration per kategori ───

interface CategoryConfig {
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
}

export const INTRANET_CATEGORY_CONFIG: Record<IntranetCategory, CategoryConfig> = {
  introduktion: { label: 'Introduktion', icon: BookOpen, color: 'text-cyan-400', bgColor: 'bg-cyan-500/15' },
  policy: { label: 'Policy', icon: ShieldCheck, color: 'text-[#20c58f]', bgColor: 'bg-[#20c58f]/15' },
  rutin: { label: 'Rutin', icon: FileText, color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
  guide: { label: 'Guide', icon: BookOpen, color: 'text-purple-400', bgColor: 'bg-purple-500/15' },
  kommunikation: { label: 'Kommunikation', icon: MessageSquareText, color: 'text-cyan-400', bgColor: 'bg-cyan-500/15' },
  arenden: { label: 'Ärendehantering', icon: ClipboardList, color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
  utrustning: { label: 'Utrustning', icon: MapPin, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15' },
  sakerhet: { label: 'Säkerhet & KMA', icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/15' },
  ekonomi: { label: 'Ekonomi & Pris', icon: Wallet, color: 'text-teal-400', bgColor: 'bg-teal-500/15' },
}

/** Ikon per dokument-slug för mer igenkännbara kort (fallback = kategorins ikon) */
export const INTRANET_SLUG_ICONS: Record<string, LucideIcon> = {
  'introduktion-km-arbete': BookOpen,
  'arbetsmiljopolicy': HeartPulse,
  'kvalitetspolicy': ShieldCheck,
  'miljopolicy': Leaf,
  'guide-ticket-systemet': MessageSquareText,
  'guide-foljearenden': ClipboardList,
  'guide-avbryta-arenden': FileText,
  'guide-placera-stationer': MapPin,
  'guide-rapportera-tillbud': AlertTriangle,
  'guide-roller-och-vyer': Users,
  'guide-prissattning': Calculator,
  'guide-fakturering': Receipt,
  'guide-fakturering-kontor': Wallet,
  'guide-skapa-arenden': CalendarPlus,
  'guide-schemavyn': CalendarDays,
  'guide-aterkommande-schema': Repeat,
  'guide-tillaggsstationer': PackagePlus,
  'guide-sokrutan-tekniker': Search,
  'guide-sokrutan-kontor': Search,
  'guide-leads-tekniker': Lightbulb,
  'guide-leads-saljare': Handshake,
  'guide-leads-kontor': Target,
  'guide-specialrapporter': FileStack,
  'guide-aterbesok': Footprints,
  'guide-delfakturering': ReceiptText,
}

// ─── Anslagstavla ───

export interface IntranetPost {
  id: string
  title: string
  body: string
  pinned: boolean
  is_published: boolean
  author_user_id: string
  author_name: string | null
  published_at: string
  created_at: string
  updated_at: string
}

// ─── Kontakter & ansvar ───

export interface IntranetResponsibility {
  id: string
  area: string
  description: string | null
  person_name: string
  email: string | null
  phone: string | null
  sort_order: number
}

export interface IntranetContact {
  id: string
  name: string
  role: string
  email: string | null
  direct_phone: string | null
  office_phone: string | null
}

// ─── KMA-statistik ───

export interface KmaStats {
  open_count: number
  handled_this_year: number
  reported_this_year: number
}

// ─── Roller ───

/** Rollerna en profil har: primärroll, extra roller och admin-flaggan */
export function profilRoller(p: { role?: string | null; is_admin?: boolean | null; extra_roles?: string[] | null } | null | undefined): Set<string> {
  const r = new Set<string>()
  if (p?.role) r.add(p.role)
  if (p?.is_admin) r.add('admin')
  for (const x of p?.extra_roles || []) r.add(x)
  return r
}

/** Är dokumentet till för någon av rollerna? Utan audience_roles gäller det alla. */
export function forRollerna(doc: Pick<IntranetDocument, 'audience_roles'>, roller: Set<string>): boolean {
  return !doc.audience_roles?.length || doc.audience_roles.some(r => roller.has(r))
}

// ─── Onboarding ───

/** Kurerad läsordning för nyanställda (dokument- och guide-slugs i ordning) */
export const ONBOARDING_SLUGS: { slug: string; label: string }[] = [
  { slug: 'introduktion-km-arbete', label: 'Introduktion till KM-arbetet' },
  { slug: 'arbetsmiljopolicy', label: 'Arbetsmiljöpolicy' },
  { slug: 'kvalitetspolicy', label: 'Kvalitetspolicy' },
  { slug: 'miljopolicy', label: 'Miljöpolicy' },
  // Grundguiderna finns i en tekniker- och en kontorsversion. Listan i
  // IntranetStart filtreras på rollen, så var och en ser bara sin version.
  { slug: 'guide-roller-och-vyer', label: 'Guide: Hitta rätt i portalen' },
  { slug: 'guide-roller-och-vyer-kontor', label: 'Guide: Hitta rätt i portalen' },
  { slug: 'guide-ticket-systemet', label: 'Guide: Ticket-systemet' },
  { slug: 'guide-ticket-systemet-kontor', label: 'Guide: Ticket-systemet' },
  { slug: 'guide-rapportera-tillbud', label: 'Guide: Rapportera tillbud' },
  { slug: 'guide-rapportera-tillbud-kontor', label: 'Guide: Rapportera tillbud' },
  // Syns bara för tekniker (audience_roles), andra roller hoppar över steget
  { slug: 'guide-leads-tekniker', label: 'Guide: Tipsa om en lead' },
  { slug: 'guide-specialrapporter', label: 'Guide: Skriv en specialrapport' },
]

/** Ungefärlig lästid i minuter utifrån innehållsblocken */
export function estimateReadingMinutes(content: IntranetBlock[]): number {
  let words = 0
  for (const block of content) {
    if ('text' in block && block.text) words += block.text.split(/\s+/).length
    if (block.type === 'list' || block.type === 'steps') words += block.items.join(' ').split(/\s+/).length
    if (block.type === 'chain') words += block.steps.length * 2
    if (block.type === 'jump') words += block.items.length * 4
    if (block.type === 'visning') words += block.steg.map(s => `${s.text} ${s.ser ?? ''}`).join(' ').split(/\s+/).length
    if (block.type === 'felsok') words += block.items.map(i => `${i.fraga} ${i.svar}`).join(' ').split(/\s+/).length
    if (block.type === 'bra') words += block.items.join(' ').split(/\s+/).length
    if (block.type === 'quiz') words += block.fragor.map(f => `${f.fraga} ${f.alternativ.join(' ')}`).join(' ').split(/\s+/).length
  }
  return Math.max(1, Math.round(words / 180))
}
