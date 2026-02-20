// src/types/casePipeline.ts — Typer för koordinatorns offerthantering

export type CoordinatorCaseStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'contacted'
  | 'booked'
  | 'completed'

export type ContactMethod = 'phone' | 'email' | 'sms'

export interface CoordinatorCaseAction {
  id: string
  case_id: string
  case_type: 'private' | 'business'
  coordinator_status: CoordinatorCaseStatus
  acknowledged_at: string | null
  acknowledged_by: string | null
  contact_attempts: number
  last_contact_attempt_at: string | null
  last_contact_method: string | null
  coordinator_notes: string | null
  created_at: string
  updated_at: string
}

/** Sammanslaget ärende + coordinator action för tabellvyn */
export interface PipelineCaseRow {
  id: string
  case_type: 'private' | 'business'
  case_number: string | null
  title: string
  status: string
  kontaktperson: string | null
  telefon_kontaktperson: string | null
  e_post_kontaktperson: string | null
  adress: any
  skadedjur: string | null
  pris: number | null
  primary_assignee_name: string | null
  primary_assignee_id: string | null
  bestallare: string | null
  start_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  action: CoordinatorCaseAction | null
}

export const COORDINATOR_STATUS_CONFIG: Record<CoordinatorCaseStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  new: { label: 'Ny', color: 'text-slate-400', bgColor: 'bg-slate-500/15' },
  acknowledged: { label: 'Mottagen', color: 'text-blue-400', bgColor: 'bg-blue-500/15' },
  in_progress: { label: 'Pågår', color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
  contacted: { label: 'Kontaktad', color: 'text-purple-400', bgColor: 'bg-purple-500/15' },
  booked: { label: 'Inbokad', color: 'text-[#20c58f]', bgColor: 'bg-[#20c58f]/15' },
  completed: { label: 'Klar', color: 'text-emerald-400', bgColor: 'bg-emerald-500/15' },
}

export type PipelineTab = 'offert_skickad' | 'signerad' | 'alla'

export const PIPELINE_TABS: { key: PipelineTab; label: string; statuses: string[] }[] = [
  { key: 'offert_skickad', label: 'Offert skickad', statuses: ['Offert skickad'] },
  { key: 'signerad', label: 'Signerad — att boka', statuses: ['Offert signerad - boka in'] },
  { key: 'alla', label: 'Alla', statuses: ['Offert skickad', 'Offert signerad - boka in'] },
]
