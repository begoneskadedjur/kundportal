// src/types/index.ts

export interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  clickup_task_id: string;
  customer_id: string;
  case_number: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  pest_type: string;
  location_details: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  created_date: string;
  updated_at: string;
  visits?: Visit[];
}

export interface Visit {
  id: string;
  case_id: string;
  visit_date: string;
  technician_name: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

export interface Stats {
  activeCases: number;
  completedCases: number;
  nextVisit: Case | null;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  count?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: number;
  lists?: any[];
}