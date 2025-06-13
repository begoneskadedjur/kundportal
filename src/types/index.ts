// src/types/index.ts

/**
 * Representerar en kund i systemet.
 * Matchar 'customers'-tabellen i databasen.
 */
export interface Customer {
  id: string;
  company_name: string;
  org_number: string;
  contact_person: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  contract_type_id: string;
  clickup_list_id: string | null;
  clickup_list_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Representerar ett ärende (Case) i systemet.
 * Matchar 'cases'-tabellen i databasen.
 */
export interface Case {
  id: string;
  customer_id: string;
  clickup_task_id: string | null;
  case_number: string | null;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  pest_type: string | null;
  location_details: string | null;
  description: string | null;
  created_date: string;
  scheduled_date: string | null;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
  // Innehåller en lista av alla besök kopplade till detta ärende
  visits: Visit[];
}

/**
 * Representerar ett enskilt besök hos en kund.
 * Matchar 'visits'-tabellen i databasen.
 */
export interface Visit {
  id: string;
  case_id: string;
  visit_date: string;
  technician_name: string | null;
  work_performed: string | null;
  findings: string | null;
  recommendations: string | null;
  next_visit_date: string | null;
  photos: string[] | null; // Antagande: en array av bild-URL:er
  status: 'planned' | 'completed' | 'cancelled';
  report_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Representerar den sammanställda statistiken för en kunds dashboard.
 */
export interface Stats {
  activeCases: number;
  completedCases: number;
  // VIKTIGT: 'nextVisit' är av typen Visit, inte Case.
  nextVisit: Visit | null;
}

/**
 * Representerar resultatet från en synkronisering med ClickUp.
 */
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