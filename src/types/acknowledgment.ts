// src/types/acknowledgment.ts - Typer för kunders läskvitton

export interface CaseAcknowledgment {
  id: string
  case_id: string
  user_id: string
  user_email: string
  user_name: string | null
  pest_level_at_acknowledgment: number | null
  problem_rating_at_acknowledgment: number | null
  acknowledged_at: string
}

export interface CreateAcknowledgmentData {
  case_id: string
  user_id: string
  user_email: string
  user_name?: string | null
  pest_level_at_acknowledgment?: number | null
  problem_rating_at_acknowledgment?: number | null
}

// Bedömningsnivåer för trafikljussystemet
export type AssessmentLevel = 'ok' | 'warning' | 'critical'

export interface AssessmentConfig {
  level: AssessmentLevel
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  label: string
  description: string
}

// Konfiguration för pest_level (0-3)
export const PEST_LEVEL_CONFIG: Record<number, AssessmentConfig> = {
  0: {
    level: 'ok',
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    label: 'Ingen aktivitet',
    description: 'Inga tecken på skadedjursaktivitet påträffades.'
  },
  1: {
    level: 'ok',
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    label: 'Låg aktivitet',
    description: 'Minimal aktivitet upptäckt. Situationen är under kontroll.'
  },
  2: {
    level: 'warning',
    color: 'amber',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    label: 'Måttlig aktivitet',
    description: 'Aktivitet som kräver uppmärksamhet. Uppföljning rekommenderas.'
  },
  3: {
    level: 'critical',
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    label: 'Hög aktivitet',
    description: 'Betydande aktivitet upptäckt. Omedelbara åtgärder vidtas.'
  }
}

// Konfiguration för problem_rating (1-5)
export const PROBLEM_RATING_CONFIG: Record<number, AssessmentConfig> = {
  1: {
    level: 'ok',
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    label: 'Utmärkt',
    description: 'Situationen är mycket bra. Inga problem identifierade.'
  },
  2: {
    level: 'ok',
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    label: 'Bra',
    description: 'Läget är gott med endast mindre observationer.'
  },
  3: {
    level: 'warning',
    color: 'amber',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    label: 'Varning',
    description: 'Situationen kräver uppmärksamhet och uppföljning.'
  },
  4: {
    level: 'critical',
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    label: 'Allvarligt',
    description: 'Allvarlig situation som kräver prioriterade åtgärder.'
  },
  5: {
    level: 'critical',
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    label: 'Kritiskt',
    description: 'Kritisk situation. Akuta insatser krävs omedelbart.'
  }
}

// Hjälpfunktion för att avgöra om bekräftelse krävs
export function requiresAcknowledgment(pestLevel: number | null, problemRating: number | null): boolean {
  return (pestLevel !== null && pestLevel >= 3) || (problemRating !== null && problemRating >= 4)
}

// Hjälpfunktion för att få övergripande bedömningsnivå
export function getOverallAssessmentLevel(pestLevel: number | null, problemRating: number | null): AssessmentLevel {
  // Kritisk om pest_level >= 3 eller problem_rating >= 4
  if ((pestLevel !== null && pestLevel >= 3) || (problemRating !== null && problemRating >= 4)) {
    return 'critical'
  }
  // Varning om pest_level === 2 eller problem_rating === 3
  if ((pestLevel !== null && pestLevel === 2) || (problemRating !== null && problemRating === 3)) {
    return 'warning'
  }
  return 'ok'
}
