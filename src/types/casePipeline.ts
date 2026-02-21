// src/types/casePipeline.ts — Typer för koordinatorns offerthantering (Oneflow-baserad)

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
  case_id: string | null
  case_type: 'private' | 'business' | 'contract' | null
  contract_id: string | null
  coordinator_status: CoordinatorCaseStatus
  acknowledged_at: string | null
  acknowledged_by: string | null
  contact_attempts: number
  last_contact_attempt_at: string | null
  last_contact_method: string | null
  coordinator_notes: string | null
  dismissed_at: string | null
  dismissed_by: string | null
  created_at: string
  updated_at: string
}

/** Oneflow-baserad offert-rad för tabellvyn */
export interface PipelineOfferRow {
  id: string                        // contracts.id (uuid)
  oneflow_contract_id: string
  status: string                    // pending / signed / declined / overdue
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  total_value: number | null
  template_id: string | null
  begone_employee_name: string | null
  source_id: string | null          // FK till ärendet offerten skapades från
  created_at: string
  updated_at: string
  action: CoordinatorCaseAction | null
}

/** Legacy: ClickUp-baserad rad (behålls för bakåtkompatibilitet med schema-v2) */
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

export interface OfferStats {
  total_sent: number
  signed: number
  declined: number
  pending: number
  overdue: number
  sign_rate: number
  total_value_sent: number
  total_value_signed: number
  last_synced_at: string
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

export const OFFER_STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
}> = {
  pending: { label: 'Pågående', color: 'text-blue-400', bgColor: 'bg-blue-500/15' },
  signed: { label: 'Signerat', color: 'text-green-400', bgColor: 'bg-green-500/15' },
  overdue: { label: 'Förfallet', color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
  declined: { label: 'Avfärdat', color: 'text-red-400', bgColor: 'bg-red-500/15' },
}

export type PipelineTab = 'pending' | 'signed' | 'overdue' | 'declined' | 'alla'

export const PIPELINE_TABS: { key: PipelineTab; label: string; statuses: string[] }[] = [
  { key: 'alla', label: 'Alla', statuses: ['pending', 'signed', 'overdue', 'declined'] },
  { key: 'pending', label: 'Pågående', statuses: ['pending'] },
  { key: 'signed', label: 'Signerat', statuses: ['signed'] },
  { key: 'overdue', label: 'Förfallet', statuses: ['overdue'] },
  { key: 'declined', label: 'Avfärdat', statuses: ['declined'] },
]
