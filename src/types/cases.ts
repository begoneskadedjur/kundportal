// src/types/cases.ts - Case Management Types

export type CaseStatus = 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
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
  status: CaseStatus
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

// Status configurations for UI
export const caseStatusConfig = {
  requested: {
    label: 'Väntar på schemaläggning',
    color: 'amber',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-500',
    icon: 'Clock'
  },
  scheduled: {
    label: 'Schemalagt',
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-500',
    icon: 'Calendar'
  },
  in_progress: {
    label: 'Pågående',
    color: 'purple',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    textColor: 'text-purple-500',
    icon: 'Wrench'
  },
  completed: {
    label: 'Slutfört',
    color: 'green',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    textColor: 'text-green-500',
    icon: 'CheckCircle'
  },
  cancelled: {
    label: 'Avbrutet',
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    textColor: 'text-red-500',
    icon: 'XCircle'
  }
}

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