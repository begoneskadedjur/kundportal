// src/types/cases.ts - Case Management Types

// Use ClickUpStatus from database.ts instead
export type CasePriority = 'normal' | 'urgent'
export type ServiceType = 'routine' | 'acute' | 'inspection' | 'other'
export type BillingStatus = 'pending' | 'sent' | 'paid' | 'skip'

export interface Case {
  // Core fields
  id: string
  customer_id: string
  case_number: string
  title: string
  description: string | null
  status: string // Uses ClickUpStatus from database.ts
  priority: CasePriority
  service_type: ServiceType | null
  created_at: string
  updated_at: string

  // Contact info
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null

  // Location & Pest
  address: {
    lat?: number
    lng?: number
    formatted_address: string
  } | null
  pest_type: string | null
  other_pest_type: string | null

  // Scheduling
  scheduled_start: string | null
  scheduled_end: string | null
  completed_date: string | null
  next_scheduled_visit: string | null

  // Technician & Work
  primary_technician_id: string | null
  primary_technician_name: string | null
  primary_technician_email: string | null
  secondary_technician_id: string | null
  secondary_technician_name: string | null
  secondary_technician_email: string | null
  work_report: string | null
  time_spent_minutes: number | null
  work_started_at: string | null
  material_cost: number | null

  // Economics
  price: number | null
  billing_status: BillingStatus
  billing_updated_at: string | null
  billing_updated_by_id: string | null
  commission_amount: number | null
  commission_calculated_at: string | null

  // Documentation
  files: Array<{
    name: string
    url: string
    type: string
    size: number
    uploaded_at: string
  }> | null
  incidents_report: string | null
  recommendations: string | null

  // Traffic Light Assessment (for contract customers)
  pest_level: 0 | 1 | 2 | 3 | null  // 0=None, 1=Low, 2=Medium, 3=High
  problem_rating: 1 | 2 | 3 | 4 | 5 | null  // 1=Excellent to 5=Critical
  assessment_date: string | null
  assessed_by: string | null
  pest_level_trend: 'improving' | 'stable' | 'worsening' | null

  // Internal processes
  send_booking_confirmation: boolean
  send_offer: boolean
  notes: string | null
}

// Create case input type (for customer requests)
export interface CreateCaseInput {
  customer_id: string
  title: string
  description: string
  service_type: ServiceType
  priority: CasePriority
  pest_type?: string
  other_pest_type?: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  address?: {
    lat?: number
    lng?: number
    formatted_address: string
  }
  files?: File[]
}

// Status configurations moved to database.ts - use STATUS_CONFIG from there

// Service type configurations
export const serviceTypeConfig = {
  routine: {
    label: 'Rutinkontroll',
    description: 'Schemalagd återkommande kontroll',
    icon: 'CalendarCheck'
  },
  acute: {
    label: 'Akut ärende',
    description: 'Brådskande åtgärd krävs',
    icon: 'AlertCircle'
  },
  inspection: {
    label: 'Inspektion',
    description: 'Undersökning av misstänkt aktivitet',
    icon: 'Search'
  },
  other: {
    label: 'Övrigt',
    description: 'Annan typ av service',
    icon: 'HelpCircle'
  }
}

// Priority configurations
export const priorityConfig = {
  normal: {
    label: 'Normal',
    color: 'slate',
    responseTime: 'Inom 2-3 arbetsdagar'
  },
  urgent: {
    label: 'Brådskande',
    color: 'red',
    responseTime: 'Inom 24 timmar'
  }
}