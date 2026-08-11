// src/types/intranet.ts
// Typer för Intranät: interna dokument med läs- och förståelsekvittens

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, ShieldCheck, HeartPulse, Leaf, FileText,
  MessageSquareText, ClipboardList, MapPin, AlertTriangle, Users,
  Calculator, Receipt, Wallet,
} from 'lucide-react'

// ─── Innehållsblock (jsonb i intranet_documents.content) ───

export type IntranetBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
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
  | { type: 'interactive'; component: string }

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

// ─── Onboarding ───

/** Kurerad läsordning för nyanställda (dokument- och guide-slugs i ordning) */
export const ONBOARDING_SLUGS: { slug: string; label: string }[] = [
  { slug: 'introduktion-km-arbete', label: 'Introduktion till KM-arbetet' },
  { slug: 'arbetsmiljopolicy', label: 'Arbetsmiljöpolicy' },
  { slug: 'kvalitetspolicy', label: 'Kvalitetspolicy' },
  { slug: 'miljopolicy', label: 'Miljöpolicy' },
  { slug: 'guide-ticket-systemet', label: 'Guide: Ticket-systemet' },
  { slug: 'guide-rapportera-tillbud', label: 'Guide: Rapportera tillbud' },
]

/** Ungefärlig lästid i minuter utifrån innehållsblocken */
export function estimateReadingMinutes(content: IntranetBlock[]): number {
  let words = 0
  for (const block of content) {
    if ('text' in block && block.text) words += block.text.split(/\s+/).length
    if (block.type === 'list' || block.type === 'steps') words += block.items.join(' ').split(/\s+/).length
    if (block.type === 'chain') words += block.steps.length * 2
  }
  return Math.max(1, Math.round(words / 180))
}
