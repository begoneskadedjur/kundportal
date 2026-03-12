// src/types/caseIncidents.ts
// Typer för tillbud och avvikelser kopplade till ärenden

export type IncidentType = 'tillbud' | 'avvikelse'

export interface IncidentEmployee {
  id: string
  incident_id: string
  technician_id: string
  technician_name: string
}

export interface CaseIncident {
  id: string
  case_id: string | null
  case_type: 'private' | 'business' | 'contract' | null
  type: IncidentType
  description: string
  occurred_at: string
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
  description: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  tillbud: {
    label: 'Tillbud',
    description: 'Händelse som kunde ha lett till skada eller olycka',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  avvikelse: {
    label: 'Avvikelse',
    description: 'Avsteg från rutin, process eller kvalitetskrav',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  }
}
