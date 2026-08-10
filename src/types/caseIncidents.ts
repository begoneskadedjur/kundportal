// src/types/caseIncidents.ts
// Typer för tillbud, olyckor och avvikelser kopplade till ärenden

export type IncidentType = 'tillbud' | 'olycka' | 'avvikelse'
export type IncidentStatus = 'ny' | 'under_utredning' | 'atgardad'

export interface IncidentEmployee {
  id: string
  incident_id: string
  technician_id: string
  technician_name: string
}

export interface IncidentRecipient {
  id: string
  user_id: string
  incident_type: IncidentType
  created_at?: string
}

export interface CaseIncident {
  id: string
  case_id: string | null
  case_type: 'private' | 'business' | 'contract' | null
  type: IncidentType
  description: string
  occurred_at: string
  status: IncidentStatus
  action_taken: string | null
  handled_by_name: string | null
  handled_at: string | null
  reported_by_id: string | null
  reported_by_name: string
  technician_id: string | null
  technician_name: string | null
  created_at: string
  updated_at: string
  incident_employees?: IncidentEmployee[]
}

export interface CreateCaseIncidentInput {
  case_id?: string | null
  case_type?: 'private' | 'business' | 'contract' | null
  type: IncidentType
  description: string
  occurred_at?: string
  reported_by_id?: string
  reported_by_name: string
  technician_id?: string
  technician_name?: string
}

export const INCIDENT_TYPE_CONFIG: Record<IncidentType, {
  label: string
  exclamation: string
  description: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  tillbud: {
    label: 'Tillbud',
    exclamation: 'Oj!',
    description: 'Det kunde ha gått illa, men ingen skadades. Nära ögat-händelse.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  olycka: {
    label: 'Olycka',
    exclamation: 'Aj!',
    description: 'Någon skadades, oavsett hur lindrigt. Även stänk, klämskador, bett.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  avvikelse: {
    label: 'Avvikelse',
    exclamation: 'Hmm',
    description: 'Något avvek från rutin, process eller kvalitetskrav.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  }
}

export const INCIDENT_STATUS_CONFIG: Record<IncidentStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  ny: {
    label: 'Ny',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10'
  },
  under_utredning: {
    label: 'Under utredning',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  atgardad: {
    label: 'Åtgärdad',
    color: 'text-[#20c58f]',
    bgColor: 'bg-[#20c58f]/10'
  }
}

export const ALL_INCIDENT_TYPES: IncidentType[] = ['tillbud', 'olycka', 'avvikelse']
