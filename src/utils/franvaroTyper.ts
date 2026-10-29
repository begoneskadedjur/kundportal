// src/utils/franvaroTyper.ts
// Frånvarotyperna i schemat, en lista för alla vyer (3.108.0).
// technician_absences.reason lagrar id:t som text. Typen styr bara färg, ikon
// och text: all frånvaro räknas som upptagen tid i bokning och ruttplanering.

import type { IconName } from '../components/icons/Icon'

export type FranvaroGrupp = 'tjanst' | 'ledig'

export interface FranvaroTyp {
  /** Värdet i technician_absences.reason */
  id: string
  /** Kort namn på rutor och block */
  kort: string
  grupp: FranvaroGrupp
  ikon: IconName
  /** Typens färg (hex), används för kant, ränder och ikon */
  farg: string
  beskrivning?: string
}

export const FRANVARO_TYPER: FranvaroTyp[] = [
  { id: 'Möte', kort: 'Möte', grupp: 'tjanst', ikon: 'kontakt.mote', farg: '#8b5cf6', beskrivning: 'Teknikermöte, ledningsmöte, genomgång' },
  { id: 'Admin', kort: 'Admin', grupp: 'tjanst', ikon: 'franvaro.admin', farg: '#6366f1', beskrivning: 'Offerter, rapporter, kontorsarbete' },
  { id: 'Utbildning', kort: 'Utbildning', grupp: 'tjanst', ikon: 'franvaro.utbildning', farg: '#3b82f6', beskrivning: 'Kurs, certifiering, internutbildning' },
  { id: 'Kundbesök', kort: 'Kundbesök', grupp: 'tjanst', ikon: 'franvaro.kundbesok', farg: '#14b8a6', beskrivning: 'Besök eller uppföljning utan ärende' },
  { id: 'Bilservice', kort: 'Bilservice', grupp: 'tjanst', ikon: 'franvaro.bilservice', farg: '#64748b', beskrivning: 'Verkstad, däckbyte, besiktning' },
  { id: 'Semester', kort: 'Semester', grupp: 'ledig', ikon: 'franvaro.semester', farg: '#22c55e' },
  { id: 'Sjukdom', kort: 'Sjukdom', grupp: 'ledig', ikon: 'franvaro.sjukdom', farg: '#ef4444' },
  { id: 'Vård av barn (VAB)', kort: 'VAB', grupp: 'ledig', ikon: 'franvaro.vab', farg: '#f97316' },
  { id: 'Föräldraledighet', kort: 'Föräldraledig', grupp: 'ledig', ikon: 'franvaro.foraldraledig', farg: '#ec4899' },
  { id: 'Tjänstledighet', kort: 'Tjänstledig', grupp: 'ledig', ikon: 'franvaro.tjanstledig', farg: '#eab308' },
  { id: 'Kompledigt', kort: 'Kompledigt', grupp: 'ledig', ikon: 'franvaro.komp', farg: '#06b6d4', beskrivning: 'Uttag av komptid' },
  { id: 'Läkarbesök', kort: 'Läkarbesök', grupp: 'ledig', ikon: 'franvaro.lakare', farg: '#e879f9', beskrivning: 'Läkare eller tandläkare' },
  { id: 'Övrigt', kort: 'Övrigt', grupp: 'ledig', ikon: 'franvaro.ovrigt', farg: '#94a3b8', beskrivning: 'Allt annat, skriv vad i anteckningen' },
]

export const FRANVARO_GRUPP_TEXT: Record<FranvaroGrupp, string> = {
  tjanst: 'I tjänst',
  ledig: 'Ledig',
}

const OKAND: Omit<FranvaroTyp, 'id' | 'kort'> = { grupp: 'ledig', ikon: 'franvaro.ovrigt', farg: '#94a3b8' }

/** Typen för ett lagrat reason-värde. Okända värden visas som Övrigt men behåller sin text. */
export function franvaroTyp(reason: string | null | undefined): FranvaroTyp {
  const r = (reason ?? '').trim()
  const hit = FRANVARO_TYPER.find(t => t.id === r)
  if (hit) return hit
  return { id: r || 'Övrigt', kort: r || 'Övrigt', ...OKAND }
}

/** Texten på blocket: rubriken om den finns, annars typens korta namn */
export function franvaroRubrik(a: { reason?: string | null; title?: string | null }): string {
  return a.title?.trim() || franvaroTyp(a.reason).kort
}

/** Hexfärg med genomskinlighet, t.ex. farg + alfa(0.2) */
export function alfa(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')
}
