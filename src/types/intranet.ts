// src/types/intranet.ts
// Typer för Intranät: interna dokument med läs- och förståelsekvittens

import type { LucideIcon } from 'lucide-react'
import { BookOpen, ShieldCheck, HeartPulse, Leaf, FileText } from 'lucide-react'

// ─── Innehållsblock (jsonb i intranet_documents.content) ───

export type IntranetBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; variant: 'info' | 'warning' | 'success'; title?: string; text: string }
  | { type: 'motto'; text: string }
  | { type: 'chain'; title?: string; steps: string[]; labels?: string[] }

export type IntranetSection = 'obligatoriskt' | 'handbok'
export type IntranetCategory = 'introduktion' | 'policy' | 'rutin' | 'guide'

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
}

/** Ikon per dokument-slug för mer igenkännbara kort (fallback = kategorins ikon) */
export const INTRANET_SLUG_ICONS: Record<string, LucideIcon> = {
  'introduktion-km-arbete': BookOpen,
  'arbetsmiljopolicy': HeartPulse,
  'kvalitetspolicy': ShieldCheck,
  'miljopolicy': Leaf,
}

/** Ungefärlig lästid i minuter utifrån innehållsblocken */
export function estimateReadingMinutes(content: IntranetBlock[]): number {
  let words = 0
  for (const block of content) {
    if ('text' in block && block.text) words += block.text.split(/\s+/).length
    if (block.type === 'list') words += block.items.join(' ').split(/\s+/).length
    if (block.type === 'chain') words += block.steps.length * 2
  }
  return Math.max(1, Math.round(words / 180))
}
